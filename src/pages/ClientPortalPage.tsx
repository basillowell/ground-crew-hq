import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { CheckCircle2, Clock, MapPin, FileText, Loader2 } from 'lucide-react';

const supabase = createClient();

// columns from clients migration
interface Client {
  id: string;
  org_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
}

interface UpcomingAssignment {
  id: string;
  date: string;
  title: string | null;
  status: string;
  estimated_hours: number | null;
}

interface LastInvoice {
  id: string;
  status: string;
  total: number;
  created_at: string;
}

function fmt(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

const invoiceStatusStyles: Record<string, { bg: string; text: string; label: string }> = {
  draft:   { bg: 'bg-surface-elevated', text: 'text-text-secondary', label: 'Draft' },
  sent:    { bg: 'bg-status-pending/10', text: 'text-status-pending', label: 'Awaiting Payment' },
  paid:    { bg: 'bg-status-active/10',  text: 'text-status-active',  label: 'Paid' },
  void:    { bg: 'bg-status-warning/10', text: 'text-status-warning', label: 'Void' },
};

export default function ClientPortalPage() {
  const { clientToken } = useParams<{ clientToken: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [assignments, setAssignments] = useState<UpcomingAssignment[]>([]);
  const [lastInvoice, setLastInvoice] = useState<LastInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Client Portal — Ground Crew HQ';
  }, []);

  const fetchClientData = useCallback(async () => {
    if (!clientToken) { setError('Invalid portal link.'); setLoading(false); return; }
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(() => { setError('Request timed out.'); setLoading(false); }, 8000);

    try {
      // Step 1: fetch client by token (public_token_read policy)
      const { data: clientData, error: clientErr } = await supabase
        .from('clients')
        .select('id, org_id, name, email, phone, address, notes, active, created_at')
        .eq('client_token', clientToken)
        .maybeSingle();

      if (clientErr) throw clientErr;
      if (!clientData) { setError('Portal link not found or expired.'); return; }
      setClient(clientData);

      // Steps 2 & 3: fetch assignments and invoices scoped to this client's org.
      // These use org_isolation RLS — anon access will return empty sets when unauthenticated,
      // which is the correct public-portal behaviour (data visible only when org auth is active).
      const today = new Date().toISOString().slice(0, 10);

      const [aResult, iResult] = await Promise.all([
        supabase
          .from('assignments')
          .select('id, date, title, status, estimated_hours')
          .eq('org_id', clientData.org_id)
          .gte('date', today)
          .order('date', { ascending: true })
          .limit(5),
        supabase
          .from('invoices')
          .select('id, status, total, created_at')
          .eq('org_id', clientData.org_id)
          .order('created_at', { ascending: false })
          .limit(1),
      ]);

      setAssignments((aResult.data as UpcomingAssignment[]) ?? []);
      setLastInvoice(((iResult.data as LastInvoice[]) ?? [])[0] ?? null);
    } catch (e) {
      setError((e as Error).message || 'Something went wrong loading your portal.');
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }, [clientToken]);

  useEffect(() => {
    void fetchClientData();
  }, [fetchClientData]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-base">
        <div className="flex items-center gap-3 rounded-2xl border border-surface-border bg-surface-card px-6 py-4">
          <Loader2 className="h-5 w-5 animate-spin text-brand" />
          <span className="text-sm font-medium text-text-secondary">Loading your portal…</span>
        </div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-base p-4">
        <div className="w-full max-w-md rounded-2xl border border-surface-border bg-surface-card p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-status-warning/10">
            <FileText className="h-6 w-6 text-status-warning" />
          </div>
          <h1 className="text-lg font-semibold text-text-primary">Portal unavailable</h1>
          <p className="mt-2 text-sm text-text-muted">
            {error ?? 'This portal link is invalid or has expired. Please contact your service team.'}
          </p>
        </div>
      </div>
    );
  }

  const invoiceStyle = lastInvoice
    ? (invoiceStatusStyles[lastInvoice.status] ?? invoiceStatusStyles.draft)
    : null;

  return (
    <div className="min-h-screen bg-surface-base">
      {/* Header */}
      <header className="border-b border-surface-border bg-surface-card">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand">
              <span className="text-sm font-bold text-text-inverse">GC</span>
            </div>
            <div>
              <div className="text-sm font-semibold text-text-primary">Ground Crew HQ</div>
              <div className="text-xs text-text-muted">Client Portal</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-status-active/10 px-3 py-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-status-active" />
            <span className="text-xs font-medium text-status-active">Active Client</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 p-4 py-8 md:px-6">
        {/* Client card */}
        <div className="rounded-2xl border border-surface-border bg-surface-card p-6">
          <h1 className="text-xl font-bold text-text-primary">{client.name}</h1>
          <div className="mt-3 flex flex-wrap gap-4">
            {client.email && (
              <a
                href={`mailto:${client.email}`}
                className="text-sm text-brand hover:underline"
              >
                {client.email}
              </a>
            )}
            {client.phone && (
              <a href={`tel:${client.phone}`} className="text-sm text-text-secondary hover:underline">
                {client.phone}
              </a>
            )}
            {client.address && (
              <span className="flex items-center gap-1 text-sm text-text-muted">
                <MapPin className="h-3.5 w-3.5" />
                {client.address}
              </span>
            )}
          </div>
          {client.notes && (
            <p className="mt-3 text-sm text-text-muted italic">{client.notes}</p>
          )}
        </div>

        {/* Last invoice */}
        <div className="rounded-2xl border border-surface-border bg-surface-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-4 w-4 text-text-muted" />
            <h2 className="text-sm font-semibold text-text-primary">Most Recent Invoice</h2>
          </div>
          {lastInvoice && invoiceStyle ? (
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-text-primary">{fmt(lastInvoice.total)}</div>
                <div className="mt-1 text-xs text-text-muted">
                  Issued {fmtDate(lastInvoice.created_at)}
                </div>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${invoiceStyle.bg} ${invoiceStyle.text}`}
              >
                {invoiceStyle.label}
              </span>
            </div>
          ) : (
            <p className="text-sm text-text-muted">No invoices on file yet.</p>
          )}
        </div>

        {/* Upcoming assignments */}
        <div className="rounded-2xl border border-surface-border bg-surface-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-4 w-4 text-text-muted" />
            <h2 className="text-sm font-semibold text-text-primary">Upcoming Scheduled Work</h2>
          </div>
          {assignments.length === 0 ? (
            <p className="text-sm text-text-muted">No upcoming visits scheduled yet.</p>
          ) : (
            <div className="space-y-3">
              {assignments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-xl border border-surface-border bg-surface-elevated px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-medium text-text-primary">
                      {a.title ?? 'Service visit'}
                    </div>
                    <div className="mt-0.5 text-xs text-text-muted">{fmtDate(a.date)}</div>
                  </div>
                  {a.estimated_hours != null && (
                    <span className="text-xs text-text-muted">
                      ~{a.estimated_hours}h
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-text-muted">
          Powered by Ground Crew HQ · Questions? Contact your service team directly.
        </p>
      </main>
    </div>
  );
}

