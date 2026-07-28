'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { createClient } from '@/src/lib/supabase';

type SharedLineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

type SharedEstimate = {
  businessName: string;
  clientName: string;
  estimateNumber: number | string;
  createdAt: string | null;
  validUntil: string | null;
  status: string;
  subtotal: number;
  taxRate: number;
  taxTotal: number;
  total: number;
  notes: string;
  lineItems: SharedLineItem[];
  converted: boolean;
  invoiceToken: string | null;
};

type AcceptResult = {
  accepted?: boolean;
  already_accepted?: boolean;
  invoice_token?: string | null;
};

type LoadState = 'loading' | 'ready' | 'missing' | 'error';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function numberFrom(value: unknown): number {
  const next = Number(value ?? 0);
  return Number.isFinite(next) ? next : 0;
}

function stringFrom(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function formatDate(value: string | null) {
  if (!value) return 'Not set';
  return new Date(value.includes('T') ? value : `${value}T00:00:00`).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function getField(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return null;
}

function normalizeLineItems(items: unknown): SharedLineItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    const row = (item ?? {}) as Record<string, unknown>;
    return {
      description: stringFrom(getField(row, 'description'), 'Item'),
      quantity: numberFrom(getField(row, 'quantity', 'qty')),
      unitPrice: numberFrom(getField(row, 'unit_price', 'unitPrice')),
      lineTotal: numberFrom(getField(row, 'line_total', 'lineTotal')),
    };
  });
}

function normalizeEstimate(payload: unknown): SharedEstimate {
  const row = (payload ?? {}) as Record<string, unknown>;
  const subtotal = numberFrom(getField(row, 'subtotal'));
  const total = numberFrom(getField(row, 'total'));
  const taxRate = numberFrom(getField(row, 'tax_rate', 'taxRate'));
  const taxTotal = numberFrom(getField(row, 'tax_total', 'taxTotal')) || Math.max(total - subtotal, 0);
  const status = stringFrom(getField(row, 'status'), 'open').toLowerCase();
  const invoiceToken = stringFrom(getField(row, 'invoice_token', 'invoiceToken'), '') || null;
  const converted = Boolean(getField(row, 'converted')) || Boolean(invoiceToken) || status === 'accepted';

  return {
    businessName: stringFrom(getField(row, 'business_name', 'businessName', 'organization_name'), 'Ground Crew HQ'),
    clientName: stringFrom(getField(row, 'client_name', 'clientName'), ''),
    estimateNumber: stringFrom(getField(row, 'estimate_number', 'estimateNumber'), '') || numberFrom(getField(row, 'estimate_number', 'estimateNumber')),
    createdAt: stringFrom(getField(row, 'created_at', 'createdAt', 'date'), '') || null,
    validUntil: stringFrom(getField(row, 'valid_until', 'validUntil'), '') || null,
    status,
    subtotal,
    taxRate,
    taxTotal,
    total,
    notes: stringFrom(getField(row, 'notes'), ''),
    lineItems: normalizeLineItems(getField(row, 'line_items', 'lineItems')),
    converted,
    invoiceToken,
  };
}

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  let timeoutId = 0;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), 12_000);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => window.clearTimeout(timeoutId));
}

function safeAcceptMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (!message || /rpc|json|uuid|schema|postgres|supabase|token/i.test(message)) {
    return 'We could not accept this estimate. Please try again.';
  }
  return message;
}

function StatusBadge({ status, accepted }: { status: string; accepted: boolean }) {
  const label = accepted ? 'Accepted' : status;
  return (
    <span className="inline-flex rounded-full border border-surface-border bg-surface-elevated px-3 py-1 text-sm font-medium capitalize text-text-primary">
      {label}
    </span>
  );
}

function PageSkeleton() {
  return (
    <main className="min-h-screen bg-surface-base px-4 py-10 text-text-primary">
      <div className="mx-auto max-w-4xl rounded-lg border border-surface-border bg-surface-card p-6 shadow-sm md:p-10">
        <div className="h-7 w-48 animate-pulse rounded bg-surface-elevated" />
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="h-20 animate-pulse rounded bg-surface-elevated" />
          <div className="h-20 animate-pulse rounded bg-surface-elevated" />
          <div className="h-20 animate-pulse rounded bg-surface-elevated" />
        </div>
        <div className="mt-8 space-y-3">
          <div className="h-10 animate-pulse rounded bg-surface-elevated" />
          <div className="h-10 animate-pulse rounded bg-surface-elevated" />
          <div className="h-10 animate-pulse rounded bg-surface-elevated" />
        </div>
      </div>
    </main>
  );
}

function MessageState({ title, body, onRetry }: { title: string; body: string; onRetry?: () => void }) {
  return (
    <main className="min-h-screen bg-surface-base px-4 py-10 text-text-primary">
      <section className="mx-auto max-w-xl rounded-lg border border-surface-border bg-surface-card p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-3 text-sm text-text-secondary">{body}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-text-inverse hover:bg-brand/90"
          >
            Retry
          </button>
        ) : null}
      </section>
    </main>
  );
}

export default function SharedEstimatePage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? '';
  const [state, setState] = useState<LoadState>('loading');
  const [estimate, setEstimate] = useState<SharedEstimate | null>(null);
  const [signerName, setSignerName] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [acceptMessage, setAcceptMessage] = useState<string | null>(null);
  const [acceptedInvoiceToken, setAcceptedInvoiceToken] = useState<string | null>(null);

  const loadEstimate = useCallback(async () => {
    if (!uuidPattern.test(token)) {
      setState('missing');
      return;
    }

    setState('loading');
    setAcceptMessage(null);
    try {
      const supabase = createClient();
      const { data, error } = await withTimeout(
        supabase.rpc('get_shared_estimate', { p_token: token }),
        'Estimate request timed out.',
      );
      if (error) throw error;
      if (!data) {
        setEstimate(null);
        setState('missing');
        return;
      }
      const normalized = normalizeEstimate(data);
      setEstimate(normalized);
      setAcceptedInvoiceToken(normalized.invoiceToken);
      setState('ready');
    } catch {
      setState('error');
    }
  }, [token]);

  useEffect(() => {
    void loadEstimate();
  }, [loadEstimate]);

  const handleAccept = async () => {
    if (accepting || !uuidPattern.test(token)) return;
    setAccepting(true);
    setAcceptMessage(null);
    try {
      const supabase = createClient();
      const { data, error } = await withTimeout(
        supabase.rpc('accept_shared_estimate', { p_token: token, p_signer: signerName.trim() || null }),
        'Estimate acceptance timed out.',
      );
      if (error) throw error;
      const result = (data ?? {}) as AcceptResult;
      if (result.accepted || result.already_accepted) {
        const invoiceToken = result.invoice_token ?? acceptedInvoiceToken;
        setAcceptedInvoiceToken(invoiceToken ?? null);
        setEstimate((current) => (current ? { ...current, converted: true, status: 'accepted', invoiceToken: invoiceToken ?? current.invoiceToken } : current));
        setAcceptMessage('Thank you - your estimate is accepted.');
      } else {
        setAcceptMessage('Thank you - your estimate is accepted.');
      }
    } catch (acceptError) {
      setAcceptMessage(safeAcceptMessage(acceptError));
    } finally {
      setAccepting(false);
    }
  };

  const accepted = Boolean(estimate?.converted || acceptedInvoiceToken);
  const canAccept = useMemo(() => {
    if (!estimate || accepted) return false;
    return !['declined', 'expired'].includes(estimate.status);
  }, [accepted, estimate]);

  if (state === 'loading') return <PageSkeleton />;
  if (state === 'missing') {
    return <MessageState title="Estimate unavailable" body="This link is not valid or has expired." />;
  }
  if (state === 'error') {
    return <MessageState title="We could not load this estimate" body="Please try again." onRetry={() => void loadEstimate()} />;
  }
  if (!estimate) return null;

  return (
    <main className="min-h-screen bg-surface-base px-4 py-8 text-text-primary md:py-12">
      <article className="mx-auto max-w-4xl rounded-lg border border-surface-border bg-surface-card p-6 shadow-sm md:p-10">
        <header className="flex flex-col gap-6 border-b border-surface-border pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-text-secondary">Estimate</p>
            <h1 className="mt-2 text-3xl font-bold">{estimate.businessName}</h1>
            {estimate.clientName ? <p className="mt-2 text-text-secondary">Prepared for {estimate.clientName}</p> : null}
          </div>
          <div className="space-y-2 text-left sm:text-right">
            <div className="text-2xl font-bold">#{estimate.estimateNumber}</div>
            <StatusBadge status={estimate.status} accepted={accepted} />
          </div>
        </header>

        <section className="grid gap-4 border-b border-surface-border py-6 sm:grid-cols-3">
          <div>
            <div className="text-sm text-text-secondary">Date</div>
            <div className="mt-1 font-medium">{formatDate(estimate.createdAt)}</div>
          </div>
          <div>
            <div className="text-sm text-text-secondary">Valid until</div>
            <div className="mt-1 font-medium">{formatDate(estimate.validUntil)}</div>
          </div>
          <div>
            <div className="text-sm text-text-secondary">Total</div>
            <div className="mt-1 text-xl font-bold">{formatCurrency(estimate.total)}</div>
          </div>
        </section>

        <section className="py-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-surface-border text-left text-text-secondary">
                  <th className="py-3 pr-4 font-medium">Description</th>
                  <th className="px-4 py-3 text-right font-medium">Qty</th>
                  <th className="px-4 py-3 text-right font-medium">Unit price</th>
                  <th className="py-3 pl-4 text-right font-medium">Line total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {estimate.lineItems.length === 0 ? (
                  <tr>
                    <td className="py-6 text-text-secondary" colSpan={4}>No line items listed.</td>
                  </tr>
                ) : (
                  estimate.lineItems.map((item, index) => (
                    <tr key={`${item.description}-${index}`}>
                      <td className="py-4 pr-4">{item.description}</td>
                      <td className="px-4 py-4 text-right">{item.quantity}</td>
                      <td className="px-4 py-4 text-right">{formatCurrency(item.unitPrice)}</td>
                      <td className="py-4 pl-4 text-right font-medium">{formatCurrency(item.lineTotal)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex justify-end border-b border-surface-border pb-6">
          <div className="w-full max-w-sm space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Subtotal</span>
              <span className="font-medium">{formatCurrency(estimate.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Tax {estimate.taxRate ? `(${estimate.taxRate}%)` : ''}</span>
              <span className="font-medium">{formatCurrency(estimate.taxTotal)}</span>
            </div>
            <div className="flex justify-between border-t border-surface-border pt-3 text-lg font-bold">
              <span>Total</span>
              <span>{formatCurrency(estimate.total)}</span>
            </div>
          </div>
        </section>

        {estimate.notes ? (
          <section className="border-b border-surface-border py-6">
            <h2 className="text-sm font-semibold">Notes</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-secondary">{estimate.notes}</p>
          </section>
        ) : null}

        <section className="pt-6">
          {accepted ? (
            <div className="rounded-lg border border-status-active/30 bg-status-active/10 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-status-active" />
                <div>
                  <p className="font-semibold text-text-primary">Thank you - your estimate is accepted.</p>
                  {acceptedInvoiceToken ? (
                    <Link className="mt-3 inline-flex text-sm font-semibold text-brand hover:underline" href={`/view/invoice/${acceptedInvoiceToken}`}>
                      View invoice
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          ) : canAccept ? (
            <div className="rounded-lg border border-surface-border bg-surface-elevated/50 p-4">
              <label className="text-sm font-medium" htmlFor="signer-name">Your name</label>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <input
                  id="signer-name"
                  value={signerName}
                  onChange={(event) => setSignerName(event.target.value)}
                  disabled={accepting}
                  className="h-10 flex-1 rounded-md border border-surface-border bg-surface-card px-3 text-sm outline-none focus:ring-2 focus:ring-brand"
                  placeholder="Optional"
                />
                <button
                  type="button"
                  onClick={() => void handleAccept()}
                  disabled={accepting}
                  className="inline-flex h-10 items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-text-inverse hover:bg-brand/90 disabled:opacity-60"
                >
                  {accepting ? 'Accepting' : 'Accept this estimate'}
                </button>
              </div>
              {acceptMessage ? <p className="mt-3 text-sm text-text-secondary">{acceptMessage}</p> : null}
            </div>
          ) : (
            <p className="text-sm text-text-secondary">This estimate can no longer be accepted.</p>
          )}
        </section>
      </article>
    </main>
  );
}
