import { useCallback, useEffect, useMemo, useState } from 'react';
import { DollarSign, FileText, Plus, Receipt, Send } from 'lucide-react';
import { ErrorRetry } from '@/components/ErrorRetry';
import { PageSkeleton } from '@/components/PageSkeleton';
import { PropertySelector } from '@/components/shared/PropertySelector';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/sonner';
import { useOrgProfile } from '@/hooks/useOrgProfile';
import {
  type RevenueInvoice,
  useClients,
  useCreateInvoice,
  useInvoices,
  useProperties,
  useUpdateInvoiceStatus,
} from '@/lib/supabase-queries';

type InvoiceTab = 'Draft' | 'Sent' | 'Paid';
const TABS: InvoiceTab[] = ['Draft', 'Sent', 'Paid'];

type InvoiceFormState = {
  clientId: string;
  subtotal: string;
  taxRate: string;
  notes: string;
};

const emptyInvoiceForm: InvoiceFormState = {
  clientId: '',
  subtotal: '',
  taxRate: '0',
  notes: '',
};

const statusStyles: Record<RevenueInvoice['status'], string> = {
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

function parseMoney(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function InvoicingPage() {
  const { orgId, currentPropertyId } = useOrgProfile();
  const { data: properties = [], isLoading: propertiesLoading } = useProperties(orgId ?? undefined);
  const clientsQuery = useClients(orgId ?? undefined);
  const invoicesQuery = useInvoices(orgId ?? undefined);
  const createInvoiceMutation = useCreateInvoice(orgId ?? undefined);
  const updateInvoiceStatusMutation = useUpdateInvoiceStatus(orgId ?? undefined);
  const [activeTab, setActiveTab] = useState<InvoiceTab>('Draft');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState<InvoiceFormState>(emptyInvoiceForm);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Invoicing - Ground Crew HQ';
  }, []);

  const invoices = invoicesQuery.data ?? [];
  const clients = clientsQuery.data ?? [];
  const activeClients = useMemo(() => clients.filter((client) => client.active), [clients]);
  const clientsById = useMemo(() => new Map(clients.map((client) => [client.id, client.name])), [clients]);
  const loading =
    (invoicesQuery.isLoading && !invoicesQuery.data) ||
    (clientsQuery.isLoading && !clientsQuery.data) ||
    propertiesLoading;
  const queryError = invoicesQuery.error ?? clientsQuery.error;
  const error = queryError instanceof Error ? queryError.message : null;

  const subtotal = parseMoney(invoiceForm.subtotal);
  const taxRate = parseMoney(invoiceForm.taxRate);
  const invoiceTotal = useMemo(() => {
    const safeSubtotal = Math.max(0, subtotal);
    const safeTaxRate = Math.max(0, taxRate);
    return safeSubtotal + safeSubtotal * (safeTaxRate / 100);
  }, [subtotal, taxRate]);

  const handleRetry = useCallback(() => {
    void invoicesQuery.refetch();
    void clientsQuery.refetch();
  }, [clientsQuery, invoicesQuery]);

  const closeDialog = () => {
    setDialogOpen(false);
    setInvoiceForm(emptyInvoiceForm);
    setSavingInvoice(false);
  };

  const getPropertyName = (id: string | null) =>
    id ? (properties.find((property) => property.id === id)?.name ?? 'Unknown property') : 'No property';

  const getClientName = (id: string | null) =>
    id ? (clientsById.get(id) ?? 'Unknown client') : 'No client';

  const createInvoice = async () => {
    if (savingInvoice) return;
    if (currentPropertyId === 'all') {
      toast.error('Select a property before creating an invoice');
      return;
    }
    if (!invoiceForm.clientId) {
      toast.error('Select a client before creating an invoice');
      return;
    }
    if (subtotal <= 0) {
      toast.error('Enter an invoice amount greater than zero');
      return;
    }
    if (taxRate < 0) {
      toast.error('Tax rate cannot be negative');
      return;
    }

    setSavingInvoice(true);
    try {
      await createInvoiceMutation.mutateAsync({
        propertyId: currentPropertyId,
        clientId: invoiceForm.clientId,
        subtotal,
        taxRate,
        total: invoiceTotal,
        notes: invoiceForm.notes.trim() || null,
      });
      toast.success('Invoice created');
      closeDialog();
      setActiveTab('Draft');
    } catch (createError) {
      toast.error(createError instanceof Error ? createError.message : 'Unable to create invoice');
      setSavingInvoice(false);
    }
  };

  const updateInvoiceStatus = async (id: string, status: 'sent' | 'paid') => {
    setUpdatingId(id);
    try {
      await updateInvoiceStatusMutation.mutateAsync({ id, status });
      toast.success(status === 'sent' ? 'Invoice sent' : 'Invoice marked as paid');
    } catch (updateError) {
      toast.error(updateError instanceof Error ? updateError.message : 'Unable to update invoice');
    } finally {
      setUpdatingId(null);
    }
  };

  const summary = useMemo(() => {
    const outstanding = invoices
      .filter((invoice) => invoice.status === 'sent')
      .reduce((sum, invoice) => sum + invoice.total, 0);
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const collected = invoices
      .filter((invoice) => invoice.status === 'paid' && invoice.paidAt?.startsWith(thisMonth))
      .reduce((sum, invoice) => sum + invoice.total, 0);
    const overdue = invoices.filter(
      (invoice) =>
        invoice.status === 'sent' &&
        invoice.sentAt &&
        Date.now() - new Date(invoice.sentAt).getTime() > 30 * 24 * 60 * 60 * 1000,
    ).length;
    return { outstanding, collected, overdue };
  }, [invoices]);

  const tabInvoices = useMemo(
    () => invoices.filter((invoice) => invoice.status === activeTab.toLowerCase()),
    [invoices, activeTab],
  );

  if (!orgId || loading) return <PageSkeleton />;
  if (error) {
    return (
      <div className="p-6">
        <ErrorRetry message={error} onRetry={handleRetry} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Invoicing</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Create client invoices and track draft, sent, and paid work.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <PropertySelector allowAllProperties className="sm:w-64" />
          <Button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="bg-brand text-text-inverse hover:bg-brand/90"
          >
            <Plus className="h-4 w-4" />
            New Invoice
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-surface-border bg-surface-card p-4">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-status-pending" />
            <span className="text-xs font-medium uppercase tracking-widest text-text-muted">
              Outstanding
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-text-primary">
            {fmt(summary.outstanding)}
          </div>
        </div>
        <div className="rounded-lg border border-surface-border bg-surface-card p-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-status-active" />
            <span className="text-xs font-medium uppercase tracking-widest text-text-muted">
              Collected This Month
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-status-active">
            {fmt(summary.collected)}
          </div>
        </div>
        <div className="rounded-lg border border-surface-border bg-surface-card p-4">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-status-warning" />
            <span className="text-xs font-medium uppercase tracking-widest text-text-muted">
              Overdue (&gt;30 days)
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold text-status-warning">
            {summary.overdue}
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-surface-border">
        {TABS.map((tab) => {
          const count = invoices.filter((invoice) => invoice.status === tab.toLowerCase()).length;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-brand text-brand'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab}
              {count > 0 ? (
                <span className="rounded-full bg-surface-elevated px-1.5 py-0.5 text-xs text-text-muted">
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {tabInvoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-border bg-surface-card/60 py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-surface-elevated">
            <FileText className="h-6 w-6 text-text-muted" />
          </div>
          <p className="mb-1 text-sm font-semibold text-text-primary">
            No {activeTab.toLowerCase()} invoices
          </p>
          <p className="max-w-xs text-sm text-text-secondary">
            {activeTab === 'Draft'
              ? 'Create a client invoice to start billing work.'
              : activeTab === 'Sent'
                ? 'Invoices marked as sent will appear here.'
                : 'Paid invoices will appear here.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-surface-border bg-surface-card">
          <table className="w-full text-sm">
            <thead className="border-b border-surface-border bg-surface-elevated">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-text-muted">
                  Invoice
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-text-muted">
                  Client
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-text-muted md:table-cell">
                  Property
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-text-muted">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-text-muted">
                  Total
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-text-muted lg:table-cell">
                  Created
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-text-muted">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {tabInvoices.map((invoice) => (
                <tr key={invoice.id} className="transition-colors hover:bg-surface-hover">
                  <td className="px-4 py-3 font-medium text-text-primary">
                    #{invoice.invoiceNumber}
                  </td>
                  <td className="px-4 py-3 text-text-primary">
                    <div className="font-medium">{getClientName(invoice.clientId)}</div>
                    <div className="mt-1 text-xs text-text-secondary md:hidden">
                      {getPropertyName(invoice.propertyId)}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-text-secondary md:table-cell">
                    {getPropertyName(invoice.propertyId)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${statusStyles[invoice.status]}`}
                    >
                      {invoice.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-text-primary">
                    {fmt(invoice.total)}
                  </td>
                  <td className="hidden px-4 py-3 text-text-secondary lg:table-cell">
                    {fmtDate(invoice.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {invoice.status === 'draft' ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void updateInvoiceStatus(invoice.id, 'sent')}
                          disabled={updatingId === invoice.id}
                          className="border-status-pending/40 text-status-pending hover:bg-status-pending/10"
                        >
                          {updatingId === invoice.id ? 'Saving' : 'Send'}
                        </Button>
                      ) : null}
                      {invoice.status === 'sent' ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void updateInvoiceStatus(invoice.id, 'paid')}
                          disabled={updatingId === invoice.id}
                          className="border-status-active/40 text-status-active hover:bg-status-active/10"
                        >
                          {updatingId === invoice.id ? 'Saving' : 'Mark Paid'}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}>
        <DialogContent className="border-surface-border bg-surface-card text-text-primary sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Invoice</DialogTitle>
            <DialogDescription>
              Create a draft invoice for the selected property and client.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-surface-border bg-surface-elevated/60 p-3 text-sm text-text-secondary">
              Property: <span className="font-medium text-text-primary">{currentPropertyId === 'all' ? 'Select property' : getPropertyName(currentPropertyId)}</span>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-text-muted">
                Client
              </label>
              <Select
                value={invoiceForm.clientId || undefined}
                onValueChange={(value) => setInvoiceForm((current) => ({ ...current, clientId: value }))}
              >
                <SelectTrigger className="border-surface-border bg-surface-elevated text-text-primary">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {activeClients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-text-muted">
                  Subtotal
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={invoiceForm.subtotal}
                  onChange={(event) => setInvoiceForm((current) => ({ ...current, subtotal: event.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-text-muted">
                  Tax Rate
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={invoiceForm.taxRate}
                  onChange={(event) => setInvoiceForm((current) => ({ ...current, taxRate: event.target.value }))}
                />
              </div>
            </div>
            <Textarea
              rows={3}
              placeholder="Notes"
              value={invoiceForm.notes}
              onChange={(event) => setInvoiceForm((current) => ({ ...current, notes: event.target.value }))}
            />
            <div className="flex items-center justify-between rounded-lg border border-surface-border bg-surface-elevated/60 px-3 py-2 text-sm">
              <span className="text-text-secondary">Total</span>
              <span className="font-semibold text-text-primary">{fmt(invoiceTotal)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog} disabled={savingInvoice}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void createInvoice()}
              disabled={savingInvoice || !invoiceForm.clientId || subtotal <= 0}
              className="bg-brand text-text-inverse hover:bg-brand/90"
            >
              {savingInvoice ? 'Saving' : 'Create Invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
