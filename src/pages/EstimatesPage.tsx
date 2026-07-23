import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Edit3, FileText, Plus, Send, XCircle } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';
import { useOrgProfile } from '@/hooks/useOrgProfile';
import {
  type EstimateStatus,
  type RevenueEstimate,
  type RevenueLineItem,
  useClients,
  useConvertEstimate,
  useCreateEstimate,
  useEstimateLineItems,
  useEstimates,
  useProperties,
  useReplaceEstimateLineItems,
  useServiceCatalog,
  useUpdateEstimate,
} from '@/lib/supabase-queries';

type EstimateTab = 'Draft' | 'Sent' | 'Accepted' | 'Declined' | 'Expired';
const TABS: EstimateTab[] = ['Draft', 'Sent', 'Accepted', 'Declined', 'Expired'];

type EstimateFormState = {
  clientId: string;
  validUntil: string;
  notes: string;
  taxRate: number;
  items: LineItemDraft[];
};

const statusStyles: Record<EstimateStatus, string> = {
  draft: 'bg-status-hold/10 text-status-hold border-status-hold/20',
  sent: 'bg-status-pending/10 text-status-pending border-status-pending/20',
  accepted: 'bg-status-active/10 text-status-active border-status-active/20',
  declined: 'bg-status-warning/10 text-status-warning border-status-warning/20',
  expired: 'bg-surface-elevated text-text-muted border-surface-border',
};

function emptyEstimateForm(): EstimateFormState {
  return {
    clientId: '',
    validUntil: '',
    notes: '',
    taxRate: 0,
    items: [createEmptyLineItem()],
  };
}

function fmt(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function fmtDate(value: string | null) {
  if (!value) return 'No date set';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

export default function EstimatesPage() {
  const { orgId, currentPropertyId } = useOrgProfile();
  const estimatesQuery = useEstimates(orgId ?? undefined);
  const estimateLineItemsQuery = useEstimateLineItems(undefined, orgId ?? undefined);
  const clientsQuery = useClients(orgId ?? undefined);
  const serviceCatalogQuery = useServiceCatalog(orgId ?? undefined);
  const { data: properties = [], isLoading: propertiesLoading } = useProperties(orgId ?? undefined);
  const createEstimateMutation = useCreateEstimate(orgId ?? undefined);
  const updateEstimateMutation = useUpdateEstimate(orgId ?? undefined);
  const replaceLineItemsMutation = useReplaceEstimateLineItems(orgId ?? undefined);
  const convertEstimateMutation = useConvertEstimate(orgId ?? undefined);
  const [activeTab, setActiveTab] = useState<EstimateTab>('Draft');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEstimate, setEditingEstimate] = useState<RevenueEstimate | null>(null);
  const [form, setForm] = useState<EstimateFormState>(() => emptyEstimateForm());
  const [saving, setSaving] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Estimates - Ground Crew HQ';
  }, []);

  const estimates = estimatesQuery.data ?? [];
  const lineItems = estimateLineItemsQuery.data ?? [];
  const clients = clientsQuery.data ?? [];
  const activeClients = useMemo(() => clients.filter((client) => client.active), [clients]);
  const clientsById = useMemo(() => new Map(clients.map((client) => [client.id, client.name])), [clients]);
  const lineItemsByEstimateId = useMemo(() => {
    const grouped = new Map<string, RevenueLineItem[]>();
    lineItems.forEach((item) => {
      const current = grouped.get(item.parentId) ?? [];
      current.push(item);
      grouped.set(item.parentId, current);
    });
    return grouped;
  }, [lineItems]);
  const loading =
    (estimatesQuery.isLoading && !estimatesQuery.data) ||
    (estimateLineItemsQuery.isLoading && !estimateLineItemsQuery.data) ||
    (clientsQuery.isLoading && !clientsQuery.data) ||
    (serviceCatalogQuery.isLoading && !serviceCatalogQuery.data) ||
    propertiesLoading;
  const queryError = estimatesQuery.error ?? estimateLineItemsQuery.error ?? clientsQuery.error ?? serviceCatalogQuery.error;
  const error = queryError instanceof Error ? queryError.message : null;
  const totals = calculateLineItemTotals(form.items, form.taxRate);

  const handleRetry = useCallback(() => {
    void estimatesQuery.refetch();
    void estimateLineItemsQuery.refetch();
    void clientsQuery.refetch();
    void serviceCatalogQuery.refetch();
  }, [clientsQuery, estimateLineItemsQuery, estimatesQuery, serviceCatalogQuery]);

  const getPropertyName = (id: string | null) =>
    id ? (properties.find((property) => property.id === id)?.name ?? 'Unknown property') : 'No property';

  const getClientName = (id: string) => clientsById.get(id) ?? 'Unknown client';

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingEstimate(null);
    setForm(emptyEstimateForm());
    setSaving(false);
  };

  const openCreateDialog = () => {
    setEditingEstimate(null);
    setForm(emptyEstimateForm());
    setDialogOpen(true);
  };

  const openEditDialog = (estimate: RevenueEstimate) => {
    const estimateItems = lineItemsByEstimateId.get(estimate.id) ?? [];
    setEditingEstimate(estimate);
    setForm({
      clientId: estimate.clientId,
      validUntil: estimate.validUntil ?? '',
      notes: estimate.notes,
      taxRate: estimate.taxRate,
      items: draftsFromLineItems(estimateItems),
    });
    setDialogOpen(true);
  };

  const saveEstimate = async () => {
    if (saving) return;
    if (currentPropertyId === 'all' && !editingEstimate) {
      toast.error('Select a property before creating an estimate');
      return;
    }
    if (!form.clientId) {
      toast.error('Select a client before saving the estimate');
      return;
    }
    if (form.taxRate < 0) {
      toast.error('Tax rate cannot be negative');
      return;
    }
    const normalizedItems = normalizeLineItemDrafts(form.items);
    if (normalizedItems.length === 0 || totals.subtotal <= 0) {
      toast.error('Add at least one priced line item');
      return;
    }

    setSaving(true);
    try {
      const savedEstimate = editingEstimate
        ? await updateEstimateMutation.mutateAsync({
            id: editingEstimate.id,
            propertyId: editingEstimate.propertyId,
            clientId: form.clientId,
            subtotal: totals.subtotal,
            taxRate: form.taxRate,
            total: totals.total,
            notes: form.notes.trim() || null,
            validUntil: form.validUntil || null,
          })
        : await createEstimateMutation.mutateAsync({
            propertyId: currentPropertyId,
            clientId: form.clientId,
            subtotal: totals.subtotal,
            taxRate: form.taxRate,
            total: totals.total,
            notes: form.notes.trim() || null,
            validUntil: form.validUntil || null,
          });
      await replaceLineItemsMutation.mutateAsync({ estimateId: savedEstimate.id, items: normalizedItems });
      toast.success(editingEstimate ? 'Estimate updated' : 'Estimate created');
      closeDialog();
      setActiveTab('Draft');
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'Unable to save estimate');
      setSaving(false);
    }
  };

  const updateEstimateStatus = async (estimate: RevenueEstimate, status: EstimateStatus) => {
    if (statusUpdatingId) return;
    setStatusUpdatingId(estimate.id);
    try {
      await updateEstimateMutation.mutateAsync({
        id: estimate.id,
        propertyId: estimate.propertyId,
        clientId: estimate.clientId,
        subtotal: estimate.subtotal,
        taxRate: estimate.taxRate,
        total: estimate.total,
        notes: estimate.notes || null,
        validUntil: estimate.validUntil,
        status,
      });
      toast.success(status === 'sent' ? 'Estimate sent' : 'Estimate declined');
    } catch (statusError) {
      toast.error(statusError instanceof Error ? statusError.message : 'Unable to update estimate');
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const acceptEstimate = async (estimate: RevenueEstimate) => {
    if (acceptingId) return;
    setAcceptingId(estimate.id);
    try {
      await convertEstimateMutation.mutateAsync(estimate.id);
      toast.success('Estimate accepted and invoice created');
      setActiveTab('Accepted');
    } catch (acceptError) {
      toast.error(acceptError instanceof Error ? acceptError.message : 'Unable to accept estimate');
    } finally {
      setAcceptingId(null);
    }
  };

  const tabEstimates = useMemo(
    () => estimates.filter((estimate) => estimate.status === activeTab.toLowerCase()),
    [activeTab, estimates],
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
          <h1 className="text-2xl font-bold text-text-primary">Estimates</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Prepare itemized estimates and convert accepted work into invoices.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <PropertySelector allowAllProperties className="sm:w-64" />
          <Button type="button" onClick={openCreateDialog} className="bg-brand text-text-inverse hover:bg-brand/90">
            <Plus className="h-4 w-4" />
            New Estimate
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-surface-border bg-surface-card p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-text-muted">
            <FileText className="h-4 w-4 text-brand" />
            Draft
          </div>
          <div className="mt-2 text-2xl font-bold text-text-primary">
            {estimates.filter((estimate) => estimate.status === 'draft').length}
          </div>
        </div>
        <div className="rounded-lg border border-surface-border bg-surface-card p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-text-muted">
            <Send className="h-4 w-4 text-status-pending" />
            Sent Value
          </div>
          <div className="mt-2 text-2xl font-bold text-text-primary">
            {fmt(estimates.filter((estimate) => estimate.status === 'sent').reduce((sum, estimate) => sum + estimate.total, 0))}
          </div>
        </div>
        <div className="rounded-lg border border-surface-border bg-surface-card p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-text-muted">
            <CheckCircle2 className="h-4 w-4 text-status-active" />
            Accepted
          </div>
          <div className="mt-2 text-2xl font-bold text-status-active">
            {estimates.filter((estimate) => estimate.status === 'accepted').length}
          </div>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-surface-border">
        {TABS.map((tab) => {
          const count = estimates.filter((estimate) => estimate.status === tab.toLowerCase()).length;
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

      {tabEstimates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-border bg-surface-card/60 py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-surface-elevated">
            <FileText className="h-6 w-6 text-text-muted" />
          </div>
          <p className="mb-1 text-sm font-semibold text-text-primary">
            No {activeTab.toLowerCase()} estimates
          </p>
          <p className="max-w-xs text-sm text-text-secondary">
            {activeTab === 'Draft' ? 'Create an itemized estimate to start the approval flow.' : 'Matching estimates will appear here.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-surface-border bg-surface-card">
          <table className="w-full text-sm">
            <thead className="border-b border-surface-border bg-surface-elevated">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-text-muted">Estimate</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-text-muted">Client</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-text-muted md:table-cell">Property</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-text-muted lg:table-cell">Valid Until</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-text-muted">Total</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {tabEstimates.map((estimate) => (
                <tr key={estimate.id} className="transition-colors hover:bg-surface-hover">
                  <td className="px-4 py-3">
                    <div className="font-medium text-text-primary">#{estimate.estimateNumber}</div>
                    <span className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${statusStyles[estimate.status]}`}>
                      {estimate.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-primary">
                    <div className="font-medium">{getClientName(estimate.clientId)}</div>
                    <div className="mt-1 text-xs text-text-secondary md:hidden">{getPropertyName(estimate.propertyId)}</div>
                    <div className="mt-1 text-xs text-text-secondary lg:hidden">{fmtDate(estimate.validUntil)}</div>
                  </td>
                  <td className="hidden px-4 py-3 text-text-secondary md:table-cell">{getPropertyName(estimate.propertyId)}</td>
                  <td className="hidden px-4 py-3 text-text-secondary lg:table-cell">{fmtDate(estimate.validUntil)}</td>
                  <td className="px-4 py-3 text-right font-medium text-text-primary">{fmt(estimate.total)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => openEditDialog(estimate)} disabled={acceptingId === estimate.id}>
                        <Edit3 className="h-4 w-4" />
                        <span className="hidden sm:inline">Edit</span>
                      </Button>
                      {estimate.status === 'draft' ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void updateEstimateStatus(estimate, 'sent')}
                          disabled={statusUpdatingId === estimate.id}
                          className="border-status-pending/40 text-status-pending hover:bg-status-pending/10"
                        >
                          {statusUpdatingId === estimate.id ? 'Saving' : 'Send'}
                        </Button>
                      ) : null}
                      {estimate.status === 'draft' || estimate.status === 'sent' ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void updateEstimateStatus(estimate, 'declined')}
                            disabled={statusUpdatingId === estimate.id || acceptingId === estimate.id}
                            className="border-status-warning/40 text-status-warning hover:bg-status-warning/10"
                          >
                            <XCircle className="h-4 w-4" />
                            <span className="hidden sm:inline">Decline</span>
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => void acceptEstimate(estimate)}
                            disabled={acceptingId === estimate.id || Boolean(acceptingId)}
                            className="bg-status-active text-text-inverse hover:bg-status-active/90"
                          >
                            {acceptingId === estimate.id ? 'Saving' : 'Accept'}
                          </Button>
                        </>
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
        <DialogContent className="max-h-[90vh] overflow-y-auto border-surface-border bg-surface-card text-text-primary sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingEstimate ? 'Edit Estimate' : 'New Estimate'}</DialogTitle>
            <DialogDescription>
              Build an itemized estimate for the selected property and client.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-surface-border bg-surface-elevated/60 p-3 text-sm text-text-secondary">
              Property: <span className="font-medium text-text-primary">{editingEstimate ? getPropertyName(editingEstimate.propertyId) : currentPropertyId === 'all' ? 'Select property' : getPropertyName(currentPropertyId)}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-text-muted">Client</label>
                <Select value={form.clientId || undefined} onValueChange={(value) => setForm((current) => ({ ...current, clientId: value }))}>
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
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-text-muted">Valid Until</label>
                <Input
                  type="date"
                  value={form.validUntil}
                  onChange={(event) => setForm((current) => ({ ...current, validUntil: event.target.value }))}
                />
              </div>
            </div>
            <LineItemEditor
              items={form.items}
              onItemsChange={(items) => setForm((current) => ({ ...current, items }))}
              taxRate={form.taxRate}
              onTaxRateChange={(taxRate) => setForm((current) => ({ ...current, taxRate }))}
              serviceCatalog={serviceCatalogQuery.data ?? []}
              disabled={saving}
            />
            <Textarea
              rows={3}
              placeholder="Notes"
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              disabled={saving}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveEstimate()} disabled={saving || !form.clientId || totals.subtotal <= 0} className="bg-brand text-text-inverse hover:bg-brand/90">
              {saving ? 'Saving' : 'Save Estimate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
