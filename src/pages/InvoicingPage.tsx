import { useCallback, useEffect, useMemo, useState } from 'react';
import { DollarSign, Edit3, FileText, Plus, Receipt, Send } from 'lucide-react';
import { ErrorRetry } from '@/components/ErrorRetry';
import { PageSkeleton } from '@/components/PageSkeleton';
import { LineItemEditor, calculateLineItemTotals, createEmptyLineItem, normalizeLineItemDrafts, type LineItemDraft } from '@/components/revenue/LineItemEditor';
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
  type RevenueLineItem,
  useClients,
  useCreateInvoice,
  useInvoiceLineItems,
  useInvoices,
  useProperties,
  useReplaceInvoiceLineItems,
  useServiceCatalog,
  useUpdateInvoice,
  useUpdateInvoiceStatus,
} from '@/lib/supabase-queries';

type InvoiceTab = 'Draft' | 'Sent' | 'Paid';
const TABS: InvoiceTab[] = ['Draft', 'Sent', 'Paid'];

type InvoiceFormState = {
  clientId: string;
  taxRate: number;
  notes: string;
  items: LineItemDraft[];
};

const statusStyles: Record<RevenueInvoice['status'], string> = {
  draft: 'bg-status-hold/10 text-status-hold border-status-hold/20',
  sent: 'bg-status-pending/10 text-status-pending border-status-pending/20',
  paid: 'bg-status-active/10 text-status-active border-status-active/20',
  void: 'bg-status-warning/10 text-status-warning border-status-warning/20',
};

function emptyInvoiceForm(): InvoiceFormState {
  return {
    clientId: '',
    taxRate: 0,
    notes: '',
    items: [createEmptyLineItem()],
  };
}

function fmt(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function draftsFromLineItems(items: RevenueLineItem[]): LineItemDraft[] {
  if (items.length === 0) return [createEmptyLineItem()];
  return [...items]
    .sort((first, second) => first.sortOrder - second.sortOrder)
    .map((item) => ({
      id: item.id,
      catalogId: item.catalogId,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    }));
}

export default function InvoicingPage() {
  const { orgId, currentPropertyId } = useOrgProfile();
  const { data: properties = [], isLoading: propertiesLoading } = useProperties(orgId ?? undefined);
  const clientsQuery = useClients(orgId ?? undefined);
  const invoicesQuery = useInvoices(orgId ?? undefined);
  const invoiceLineItemsQuery = useInvoiceLineItems(undefined, orgId ?? undefined);
  const serviceCatalogQuery = useServiceCatalog(orgId ?? undefined);
  const createInvoiceMutation = useCreateInvoice(orgId ?? undefined);
  const updateInvoiceMutation = useUpdateInvoice(orgId ?? undefined);
  const replaceLineItemsMutation = useReplaceInvoiceLineItems(orgId ?? undefined);
  const updateInvoiceStatusMutation = useUpdateInvoiceStatus(orgId ?? undefined);
  const [activeTab, setActiveTab] = useState<InvoiceTab>('Draft');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<RevenueInvoice | null>(null);
  const [invoiceForm, setInvoiceForm] = useState<InvoiceFormState>(() => emptyInvoiceForm());
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Invoicing - Ground Crew HQ';
  }, []);

  const invoices = invoicesQuery.data ?? [];
  const lineItems = invoiceLineItemsQuery.data ?? [];
  const clients = clientsQuery.data ?? [];
  const activeClients = useMemo(() => clients.filter((client) => client.active), [clients]);
  const clientsById = useMemo(() => new Map(clients.map((client) => [client.id, client.name])), [clients]);
  const lineItemsByInvoiceId = useMemo(() => {
    const grouped = new Map<string, RevenueLineItem[]>();
    lineItems.forEach((item) => {
      const current = grouped.get(item.parentId) ?? [];
      current.push(item);
      grouped.set(item.parentId, current);
    });
    return grouped;
  }, [lineItems]);
  const loading =
    (invoicesQuery.isLoading && !invoicesQuery.data) ||
    (invoiceLineItemsQuery.isLoading && !invoiceLineItemsQuery.data) ||
    (clientsQuery.isLoading && !clientsQuery.data) ||
    (serviceCatalogQuery.isLoading && !serviceCatalogQuery.data) ||
    propertiesLoading;
  const queryError = invoicesQuery.error ?? invoiceLineItemsQuery.error ?? clientsQuery.error ?? serviceCatalogQuery.error;
  const error = queryError instanceof Error ? queryError.message : null;
  const totals = calculateLineItemTotals(invoiceForm.items, invoiceForm.taxRate);

  const handleRetry = useCallback(() => {
    void invoicesQuery.refetch();
    void invoiceLineItemsQuery.refetch();
    void clientsQuery.refetch();
    void serviceCatalogQuery.refetch();
  }, [clientsQuery, invoiceLineItemsQuery, invoicesQuery, serviceCatalogQuery]);

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingInvoice(null);
    setInvoiceForm(emptyInvoiceForm());
    setSavingInvoice(false);
  };

  const openCreateDialog = () => {
    setEditingInvoice(null);
    setInvoiceForm(emptyInvoiceForm());
    setDialogOpen(true);
  };

  const openEditDialog = (invoice: RevenueInvoice) => {
    setEditingInvoice(invoice);
    setInvoiceForm({
      clientId: invoice.clientId ?? '',
      taxRate: invoice.taxRate,
      notes: invoice.notes,
      items: draftsFromLineItems(lineItemsByInvoiceId.get(invoice.id) ?? []),
    });
    setDialogOpen(true);
  };

  const getPropertyName = (id: string | null) =>
    id ? (properties.find((property) => property.id === id)?.name ?? 'Unknown property') : 'No property';

  const getClientName = (id: string | null) =>
    id ? (clientsById.get(id) ?? 'Unknown client') : 'No client';

  const saveInvoice = async () => {
    if (savingInvoice) return;
    if (currentPropertyId === 'all' && !editingInvoice) {
      toast.error('Select a property before creating an invoice');
      return;
    }
    if (!invoiceForm.clientId) {
      toast.error('Select a client before saving the invoice');
      return;
    }
    if (invoiceForm.taxRate < 0) {
      toast.error('Tax rate cannot be negative');
      return;
    }
    const normalizedItems = normalizeLineItemDrafts(invoiceForm.items);
    if (normalizedItems.length === 0 || totals.subtotal <= 0) {
      toast.error('Add at least one priced line item');
      return;
    }

    setSavingInvoice(true);
    try {
      const savedInvoice = editingInvoice
        ? await updateInvoiceMutation.mutateAsync({
            id: editingInvoice.id,
            propertyId: editingInvoice.propertyId,
            clientId: invoiceForm.clientId,
            subtotal: totals.subtotal,
            taxRate: invoiceForm.taxRate,
            total: totals.total,
            notes: invoiceForm.notes.trim() || null,
          })
        : await createInvoiceMutation.mutateAsync({
            propertyId: currentPropertyId,
            clientId: invoiceForm.clientId,
            subtotal: totals.subtotal,
            taxRate: invoiceForm.taxRate,
            total: totals.total,
            notes: invoiceForm.notes.trim() || null,
          });
      await replaceLineItemsMutation.mutateAsync({ invoiceId: savedInvoice.id, items: normalizedItems });
      toast.success(editingInvoice ? 'Invoice updated' : 'Invoice created');
      closeDialog();
      setActiveTab('Draft');
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'Unable to save invoice');
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
            Create itemized client invoices and track draft, sent, and paid work.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <PropertySelector allowAllProperties className="sm:w-64" />
          <Button type="button" onClick={openCreateDialog} className="bg-brand text-text-inverse hover:bg-brand/90">
            <Plus className="h-4 w-4" />
            New Invoice
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-surface-border bg-surface-card p-4">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-status-pending" />
            <span className="text-xs font-medium uppercase tracking-widest text-text-muted">Outstanding</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-text-primary">{fmt(summary.outstanding)}</div>
        </div>
        <div className="rounded-lg border border-surface-border bg-surface-card p-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-status-active" />
            <span className="text-xs font-medium uppercase tracking-widest text-text-muted">Collected This Month</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-status-active">{fmt(summary.collected)}</div>
        </div>
        <div className="rounded-lg border border-surface-border bg-surface-card p-4">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-status-warning" />
            <span className="text-xs font-medium uppercase tracking-widest text-text-muted">Overdue (&gt;30 days)</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-status-warning">{summary.overdue}</div>
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
                activeTab === tab ? 'border-b-2 border-brand text-brand' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab}
              {count > 0 ? <span className="rounded-full bg-surface-elevated px-1.5 py-0.5 text-xs text-text-muted">{count}</span> : null}
            </button>
          );
        })}
      </div>

      {tabInvoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-border bg-surface-card/60 py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-surface-elevated">
            <FileText className="h-6 w-6 text-text-muted" />
          </div>
          <p className="mb-1 text-sm font-semibold text-text-primary">No {activeTab.toLowerCase()} invoices</p>
          <p className="max-w-xs text-sm text-text-secondary">
            {activeTab === 'Draft' ? 'Create a client invoice to start billing work.' : activeTab === 'Sent' ? 'Invoices marked as sent will appear here.' : 'Paid invoices will appear here.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-surface-border bg-surface-card">
          <table className="w-full text-sm">
            <thead className="border-b border-surface-border bg-surface-elevated">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-text-muted">Invoice</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-text-muted">Client</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-text-muted md:table-cell">Property</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-text-muted">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-text-muted">Total</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-text-muted lg:table-cell">Created</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {tabInvoices.map((invoice) => {
                const invoiceItems = lineItemsByInvoiceId.get(invoice.id) ?? [];
                return (
                  <tr key={invoice.id} className="transition-colors hover:bg-surface-hover">
                    <td className="px-4 py-3">
                      <div className="font-medium text-text-primary">#{invoice.invoiceNumber}</div>
                      <div className="mt-1 space-y-0.5 text-xs text-text-secondary">
                        {invoiceItems.length === 0 ? (
                          <div>No line items</div>
                        ) : (
                          invoiceItems.slice(0, 2).map((item) => (
                            <div key={item.id} className="truncate">
                              {item.quantity} x {item.description}
                            </div>
                          ))
                        )}
                        {invoiceItems.length > 2 ? <div>{invoiceItems.length - 2} more</div> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-primary">
                      <div className="font-medium">{getClientName(invoice.clientId)}</div>
                      <div className="mt-1 text-xs text-text-secondary md:hidden">{getPropertyName(invoice.propertyId)}</div>
                    </td>
                    <td className="hidden px-4 py-3 text-text-secondary md:table-cell">{getPropertyName(invoice.propertyId)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${statusStyles[invoice.status]}`}>
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-text-primary">{fmt(invoice.total)}</td>
                    <td className="hidden px-4 py-3 text-text-secondary lg:table-cell">{fmtDate(invoice.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => openEditDialog(invoice)} disabled={updatingId === invoice.id}>
                          <Edit3 className="h-4 w-4" />
                          <span className="hidden sm:inline">Edit</span>
                        </Button>
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-surface-border bg-surface-card text-text-primary sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingInvoice ? 'Edit Invoice' : 'New Invoice'}</DialogTitle>
            <DialogDescription>
              Create a draft invoice for the selected property and client.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-surface-border bg-surface-elevated/60 p-3 text-sm text-text-secondary">
              Property: <span className="font-medium text-text-primary">{editingInvoice ? getPropertyName(editingInvoice.propertyId) : currentPropertyId === 'all' ? 'Select property' : getPropertyName(currentPropertyId)}</span>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-text-muted">Client</label>
              <Select value={invoiceForm.clientId || undefined} onValueChange={(value) => setInvoiceForm((current) => ({ ...current, clientId: value }))}>
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
            <LineItemEditor
              items={invoiceForm.items}
              onItemsChange={(items) => setInvoiceForm((current) => ({ ...current, items }))}
              taxRate={invoiceForm.taxRate}
              onTaxRateChange={(taxRate) => setInvoiceForm((current) => ({ ...current, taxRate }))}
              serviceCatalog={serviceCatalogQuery.data ?? []}
              disabled={savingInvoice}
            />
            <Textarea
              rows={3}
              placeholder="Notes"
              value={invoiceForm.notes}
              onChange={(event) => setInvoiceForm((current) => ({ ...current, notes: event.target.value }))}
              disabled={savingInvoice}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog} disabled={savingInvoice}>Cancel</Button>
            <Button type="button" onClick={() => void saveInvoice()} disabled={savingInvoice || !invoiceForm.clientId || totals.subtotal <= 0} className="bg-brand text-text-inverse hover:bg-brand/90">
              {savingInvoice ? 'Saving' : 'Save Invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
