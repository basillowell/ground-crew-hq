import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/appStore';
import { PageSkeleton } from '@/components/PageSkeleton';
import { ErrorRetry } from '@/components/ErrorRetry';
import { toast } from '@/components/ui/sonner';
import { Receipt, Send, DollarSign, FileText } from 'lucide-react';
import { PageHeader } from '@/components/shared';

// columns from invoices migration
interface Invoice {
  id: string;
  org_id: string;
  property_id: string | null;
  employee_id: string | null;
  status: 'draft' | 'sent' | 'paid' | 'void';
  subtotal: number;
  tax_rate: number;
  total: number;
  notes: string | null;
  created_at: string;
  sent_at: string | null;
  paid_at: string | null;
}

type InvoiceTab = 'Draft' | 'Sent' | 'Paid';
const TABS: InvoiceTab[] = ['Draft', 'Sent', 'Paid'];

const statusStyles: Record<Invoice['status'], string> = {
  draft: 'bg-status-hold/10 text-status-hold border-status-hold/20',
  sent: 'bg-status-pending/10 text-status-pending border-status-pending/20',
  paid: 'bg-status-active/10 text-status-active border-status-active/20',
  void: 'bg-status-warning/10 text-status-warning border-status-warning/20',
};

function fmt(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function InvoicingPage() {
  const { orgId } = useAuth();
  const isHydrated = useAppStore((s) => s.isHydrated);
  const properties = useAppStore((s) => s.properties);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<InvoiceTab>('Draft');
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Invoicing — Ground Crew HQ';
  }, []);

  const fetchInvoices = useCallback(async () => {
    if (!orgId || !isHydrated) return;
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(() => setError('Request timed out after 8 seconds.'), 8000);
    try {
      const { data, error: err } = await supabase
        .from('invoices')
        .select('id, org_id, property_id, employee_id, status, subtotal, tax_rate, total, notes, created_at, sent_at, paid_at')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });
      if (err) throw err;
      setInvoices((data as Invoice[]) ?? []);
    } catch (e) {
      setError((e as Error).message || 'Failed to load invoices');
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }, [orgId, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    void fetchInvoices();
  }, [fetchInvoices, isHydrated]);

  const sendInvoice = async (id: string) => {
    setUpdating(id);
    const { error: err } = await supabase
      .from('invoices')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', id);
    setUpdating(null);
    if (err) { toast.error(err.message); return; }
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === id ? { ...inv, status: 'sent', sent_at: new Date().toISOString() } : inv,
      ),
    );
    toast.success('Invoice sent');
  };

  const markPaid = async (id: string) => {
    setUpdating(id);
    const { error: err } = await supabase
      .from('invoices')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', id);
    setUpdating(null);
    if (err) { toast.error(err.message); return; }
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === id ? { ...inv, status: 'paid', paid_at: new Date().toISOString() } : inv,
      ),
    );
    toast.success('Invoice marked as paid');
  };

  const getPropertyName = (id: string | null) =>
    id ? (properties.find((p) => p.id === id)?.name ?? 'Unknown property') : '—';

  const summary = useMemo(() => {
    const outstanding = invoices
      .filter((inv) => inv.status === 'sent')
      .reduce((sum, inv) => sum + inv.total, 0);
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const collected = invoices
      .filter(
        (inv) => inv.status === 'paid' && inv.paid_at?.startsWith(thisMonth),
      )
      .reduce((sum, inv) => sum + inv.total, 0);
    const overdue = invoices.filter(
      (inv) =>
        inv.status === 'sent' &&
        inv.sent_at &&
        Date.now() - new Date(inv.sent_at).getTime() > 30 * 24 * 60 * 60 * 1000,
    ).length;
    return { outstanding, collected, overdue };
  }, [invoices]);

  const tabInvoices = useMemo(
    () => invoices.filter((inv) => inv.status === activeTab.toLowerCase()),
    [invoices, activeTab],
  );

  if (!isHydrated || loading) return <PageSkeleton />;
  if (error) {
    return (
      <div className="p-6">
        <ErrorRetry message={error} onRetry={() => void fetchInvoices()} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <PageHeader title="Invoicing" subtitle="Manage and track invoices for your properties." />

      {/* Summary banner */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-surface-border bg-surface-card p-4">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-status-pending" />
            <span className="text-xs font-medium uppercase tracking-widest text-text-muted">
              Outstanding
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {fmt(summary.outstanding)}
          </div>
        </div>
        <div className="rounded-xl border border-surface-border bg-surface-card p-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-400" />
            <span className="text-xs font-medium uppercase tracking-widest text-text-muted">
              Collected This Month
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-green-400">
            {fmt(summary.collected)}
          </div>
        </div>
        <div className="rounded-xl border border-surface-border bg-surface-card p-4">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-medium uppercase tracking-widest text-text-muted">
              Overdue (&gt;30 days)
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-400">
            {summary.overdue}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-surface-border">
        {TABS.map((tab) => {
          const count = invoices.filter((inv) => inv.status === tab.toLowerCase()).length;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-brand text-brand'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab}
              {count > 0 && (
                <span className="rounded-full bg-surface-elevated px-1.5 py-0.5 text-xs text-text-muted">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tabInvoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-elevated">
            <FileText className="h-6 w-6 text-text-muted" />
          </div>
          <p className="mb-1 text-sm font-semibold text-text-primary">
            No {activeTab.toLowerCase()} invoices
          </p>
          <p className="max-w-xs text-sm text-text-secondary">
            {activeTab === 'Draft'
              ? 'Draft invoices will appear here once created.'
              : activeTab === 'Sent'
              ? 'Invoices marked as sent will appear here.'
              : 'Paid invoices will appear here.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-surface-border">
          <table className="w-full text-sm">
            <thead className="border-b border-surface-border bg-surface-elevated">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-text-muted">
                  Property
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-text-muted">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-text-muted">
                  Total
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-text-muted sm:table-cell">
                  Created
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-text-muted">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {tabInvoices.map((inv) => (
                <tr key={inv.id} className="transition-colors hover:bg-surface-hover">
                  <td className="px-4 py-3 font-medium text-text-primary">
                    {getPropertyName(inv.property_id)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${statusStyles[inv.status]}`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-text-primary">
                    {fmt(inv.total)}
                  </td>
                  <td className="hidden px-4 py-3 text-text-secondary sm:table-cell">
                    {fmtDate(inv.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {inv.status === 'draft' && (
                        <button
                          onClick={() => void sendInvoice(inv.id)}
                          disabled={updating === inv.id}
                          className="rounded-lg border border-status-pending/40 px-3 py-1.5 text-xs font-medium text-status-pending transition-colors hover:bg-status-pending/10 disabled:opacity-50"
                        >
                          {updating === inv.id ? '…' : 'Send'}
                        </button>
                      )}
                      {inv.status === 'sent' && (
                        <button
                          onClick={() => void markPaid(inv.id)}
                          disabled={updating === inv.id}
                          className="rounded-lg border border-status-active/40 px-3 py-1.5 text-xs font-medium text-status-active transition-colors hover:bg-status-active/10 disabled:opacity-50"
                        >
                          {updating === inv.id ? '…' : 'Mark Paid'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
