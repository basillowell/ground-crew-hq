import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { createClient } from '@/utils/supabase/server'

// Nodemailer needs the Node runtime (not edge).
export const runtime = 'nodejs'

type DocumentKind = 'estimate' | 'invoice'

function readSmtpConfig() {
  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM
  if (!host || !port || !user || !pass || !from) return null
  return { host, port: Number(port), user, pass, from }
}

export async function POST(request: NextRequest) {
  let body: { kind?: string; id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const kind = body.kind as DocumentKind
  const id = body.id
  if ((kind !== 'estimate' && kind !== 'invoice') || !id) {
    return NextResponse.json({ error: 'Missing document to send.' }, { status: 400 })
  }

  // Auth: this runs as the signed-in user (cookie session), so every query below
  // is RLS-scoped to their org - they can only email their own documents.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
  }

  const table = kind === 'estimate' ? 'estimates' : 'invoices'
  const numberColumn = kind === 'estimate' ? 'estimate_number' : 'invoice_number'

  const { data: doc, error: docError } = await supabase
    .from(table)
    .select(`id, share_token, org_id, client_id, total, ${numberColumn}`)
    .eq('id', id)
    .maybeSingle()

  if (docError || !doc) {
    return NextResponse.json({ error: 'That document could not be found.' }, { status: 404 })
  }
  if (!doc.client_id) {
    return NextResponse.json(
      { error: 'Add a client to this document before sending it.' },
      { status: 400 },
    )
  }

  // Client email + business name (separate queries, RLS-scoped, joined here - Rule 5).
  const [{ data: client }, { data: org }] = await Promise.all([
    supabase.from('clients').select('name, email').eq('id', doc.client_id).maybeSingle(),
    supabase.from('organizations').select('name').eq('id', doc.org_id).maybeSingle(),
  ])

  const recipient = client?.email?.trim()
  if (!recipient) {
    return NextResponse.json(
      { error: 'This client has no email address on file.' },
      { status: 400 },
    )
  }

  const smtp = readSmtpConfig()
  if (!smtp) {
    return NextResponse.json(
      { error: 'Email is not set up yet. Add your email settings to the app before sending.' },
      { status: 503 },
    )
  }

  const businessName = org?.name?.trim() || 'Ground Crew HQ'
  const docNumber = (doc as Record<string, unknown>)[numberColumn]
  const label = kind === 'estimate' ? 'Estimate' : 'Invoice'
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || request.nextUrl.origin
  const link = `${baseUrl}/view/${kind}/${doc.share_token}`

  const subject = `${label} #${docNumber} from ${businessName}`
  const greeting = client?.name ? `Hi ${client.name},` : 'Hello,'
  const text =
    `${greeting}\n\n` +
    `Your ${label.toLowerCase()} from ${businessName} is ready to view:\n${link}\n\n` +
    `Thank you,\n${businessName}`
  const html =
    `<p>${greeting}</p>` +
    `<p>Your ${label.toLowerCase()} from <strong>${businessName}</strong> is ready to view:</p>` +
    `<p><a href="${link}">View your ${label.toLowerCase()}</a></p>` +
    `<p>Thank you,<br/>${businessName}</p>`

  try {
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      auth: { user: smtp.user, pass: smtp.pass },
    })
    await transporter.sendMail({
      from: `${businessName} <${smtp.from}>`,
      to: recipient,
      subject,
      text,
      html,
    })
  } catch (sendError) {
    console.error('[SEND_DOCUMENT_ERROR]', sendError)
    return NextResponse.json(
      { error: 'The email could not be sent. Check your email settings and try again.' },
      { status: 502 },
    )
  }

  // Mark it sent (best-effort; RLS-scoped). Non-fatal if it fails.
  await supabase.from(table).update({ sent_at: new Date().toISOString() }).eq('id', id)

  return NextResponse.json({ ok: true, sentTo: recipient })
}
