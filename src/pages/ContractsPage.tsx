import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Edit3, FileClock, PauseCircle, PlayCircle, Plus, RefreshCw, StopCircle } from 'lucide-react';
import { ErrorRetry } from '@/components/ErrorRetry';
import { PageSkeleton } from '@/components/PageSkeleton';
import { LineItemEditor, calculateLineItemTotals, createEmptyLineItem, normalizeLineItemDrafts, type LineItemDraft } from '@/components/revenue/LineItemEditor';
import { Badge } from '@/components/ui/badge';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/sonner';
import { useOrgProfile } from '@/hooks/useOrgProfile';
import { usePagePropertySelection } from '@/hooks/usePagePropertySelection';
import {
  type RevenueLineItem,
  type ServiceContract,
  type ServiceContractFrequency,
  type ServiceContractStatus,
  useClients,
  useContractInvoiceRuns,
  useCreateServiceContract,
  useGenerateContractInvoices,
  useProperties,
  useReplaceServiceContractLineItems,
  useServiceCatalog,
  useServiceContractLineItems,
  useServiceContracts,
  useUpdateServiceContract,
  useUpdateServiceContractStatus,
} from '@/lib/supabase-queries';

type ContractTab = 'Active' | 'Paused' | 'Ended';
const TABS: ContractTab[] = ['Active', 'Paused', 'Ended'];
const NO_PROPERTY_VALUE = 'none';
const FREQUENCIES: ServiceContractFrequency[] = ['weekly', 'biweekly', 'monthly', 'quarterly', 'seasonal'];

type ContractFormState = {
  name: string;
  clientId: string;
  propertyId: string | null;
  frequency: ServiceContractFrequency;
  startDate: string;
  endDate: string;
  pauseFrom: string;
  pauseUntil: string;
  taxRate: number;
  notes: string;
  items: LineItemDraft[];
};

const statusVariants: Record<ServiceContractStatus, 'active' | 'hold'> = {
  active: 'active',
  paused: 'hold',
  ended: 'hold',
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function emptyContractForm(): ContractFormState {
  return {
    name: '',
    clientId: '',
    propertyId: null,
    frequency: 'monthly',
    startDate: todayIso(),
    endDate: '',
    pauseFrom: '',
    pauseUntil: '',
    taxRate: 0,
    notes: '',
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

function fmtTimestamp(value: string) {
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function titleCase(value: string) {
  return value.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function calculateStoredLineItemTotals(items: RevenueLineItem[], taxRate: number) {
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  return {
    subtotal,
    total: subtotal + subtotal * (Math.max(0, taxRate) / 100),
  };
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  const day = next.getDate();
  next.setMonth(next.getMonth() + months);
  if (next.getDate() < day) next.setDate(0);
  return next;
}

function addFrequency(date: Date, frequency: ServiceContractFrequency) {
  const next = new Date(date);
  if (frequency === 'weekly') next.setDate(next.getDate() + 7);
  if (frequency === 'biweekly') next.setDate(next.getDate() + 14);
  if (frequency === 'monthly') return addMonths(next, 1);
  if (frequency === 'quarterly') return addMonths(next, 3);
  if (frequency === 'seasonal') return addMonths(next, 12);
  return next;
}

function getNextPeriodHint(contract: ServiceContract) {
  if (contract.status === 'ended') return 'Plan ended';
  let next = new Date(`${contract.startDate}T00:00:00`);
  const today = new Date(`${todayIso()}T00:00:00`);
  let guard = 0;
  while (next < today && guard < 520) {
    next = addFrequency(next, contract.frequency);
    guard += 1;
  }
  return `Next service period starts ${fmtDate(next.toISOString().slice(0, 10))}`;
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

export default function ContractsPage() {
  const { orgId, currentRole, currentUser } = useOrgProfile();
  const contractsQuery = useServiceContracts(orgId ?? undefined);
  const contractLineItemsQuery = useServiceContractLineItems(undefined, orgId ?? undefined);
  const clientsQuery = useClients(orgId ?? undefined);
  const serviceCatalogQuery = useServiceCatalog(orgId ?? undefined);
  const runsQuery = useContractInvoiceRuns(orgId ?? undefined);
  const { data: properties = [], isLoading: propertiesLoading } = useProperties(orgId ?? undefined);
  const [selectedPagePropertyId] = usePagePropertySelection({
    currentUser,
    properties,
  });
  const createContractMutation = useCreateServiceContract(orgId ?? undefined);
  const updateContractMutation = useUpdateServiceContract(orgId ?? undefined);
  const updateContractStatusMutation = useUpdateServiceContractStatus(orgId ?? undefined);
  const replaceLineItemsMutation = useReplaceServiceContractLineItems(orgId ?? undefined);
  const generateInvoicesMutation = useGenerateContractInvoices(orgId ?? undefined);
  const [activeTab, setActiveTab] = useState<ContractTab>('Active');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<ServiceContract | null>(null);
  const [form, setForm] = useState<ContractFormState>(() => emptyContractForm());
  const [saving, setSaving] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    document.title = 'Service Scope - Ground Crew HQ';
  }, []);

  const contracts = contractsQuery.data ?? [];
  const lineItems = contractLineItemsQuery.data ?? [];
  const clients = clientsQuery.data ?? [];
  const runs = runsQuery.data ?? [];
  const activeClients = useMemo(() => clients.filter((client) => client.active), [clients]);
  const clientsById = useMemo(() => new Map(clients.map((client) => [client.id, client.name])), [clients]);
  const propertiesById = useMemo(() => new Map(properties.map((property) => [property.id, property.name])), [properties]);
  const lineItemsByContractId = useMemo(() => {
    const grouped = new Map<string, RevenueLineItem[]>();
    lineItems.forEach((item) => {
      const current = grouped.get(item.parentId) ?? [];
      current.push(item);
      grouped.set(item.parentId, current);
    });
    return grouped;
  }, [lineItems]);
  const loading =
    (contractsQuery.isLoading && !contractsQuery.data) ||
    (contractLineItemsQuery.isLoading && !contractLineItemsQuery.data) ||
    (clientsQuery.isLoading && !clientsQuery.data) ||
    (serviceCatalogQuery.isLoading && !serviceCatalogQuery.data) ||
    (runsQuery.isLoading && !runsQuery.data) ||
    propertiesLoading;
  const queryError = contractsQuery.error ?? contractLineItemsQuery.error ?? clientsQuery.error ?? serviceCatalogQuery.error ?? runsQuery.error;
  const error = queryError instanceof Error ? queryError.message : null;
  const totals = calculateLineItemTotals(form.items, form.taxRate);
  const canGenerateInvoices = currentRole === 'admin' || currentRole === 'manager';

  const handleRetry = useCallback(() => {
    void contractsQuery.refetch();
    void contractLineItemsQuery.refetch();
    void clientsQuery.refetch();
    void serviceCatalogQuery.refetch();
    void runsQuery.refetch();
  }, [clientsQuery, contractLineItemsQuery, contractsQuery, runsQuery, serviceCatalogQuery]);

  const getClientName = (id: string) => clientsById.get(id) ?? 'Unknown account';
  const getPropertyName = (id: string | null) => (id ? propertiesById.get(id) ?? 'Unknown property' : 'No property');

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingContract(null);
    setForm(emptyContractForm());
    setSaving(false);
  };

  const openCreateDialog = () => {
    setEditingContract(null);
    setForm({
      ...emptyContractForm(),
      propertyId: selectedPagePropertyId && selectedPagePropertyId !== 'all' ? selectedPagePropertyId : null,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (contract: ServiceContract) => {
    setEditingContract(contract);
    setForm({
      name: contract.name,
      clientId: contract.clientId,
      propertyId: contract.propertyId,
      frequency: contract.frequency,
      startDate: contract.startDate,
      endDate: contract.endDate ?? '',
      pauseFrom: contract.pauseFrom ?? '',
      pauseUntil: contract.pauseUntil ?? '',
      taxRate: contract.taxRate,
      notes: contract.notes,
      items: draftsFromLineItems(lineItemsByContractId.get(contract.id) ?? []),
    });
    setDialogOpen(true);
  };

  const saveContract = async () => {
    if (saving) return;
    if (!form.name.trim()) {
      toast.error('Enter a scope name');
      return;
    }
    if (!form.clientId) {
      toast.error('Select an account before saving the scope');
      return;
    }
    if (!form.startDate) {
      toast.error('Choose a start date');
      return;
    }
    if (form.taxRate < 0) {
      toast.error('Tax rate cannot be negative');
      return;
    }
    if (form.pauseFrom && form.pauseUntil && form.pauseFrom > form.pauseUntil) {
      toast.error('Pause end must be after pause start');
      return;
    }
    if (form.endDate && form.endDate < form.startDate) {
      toast.error('End date must be after start date');
      return;
    }
    const normalizedItems = normalizeLineItemDrafts(form.items);
    if (normalizedItems.length === 0 || totals.subtotal <= 0) {
      toast.error('Add at least one priced line item');
      return;
    }

    setSaving(true);
    try {
      const savedContract = editingContract
        ? await updateContractMutation.mutateAsync({
            id: editingContract.id,
            clientId: form.clientId,
            propertyId: form.propertyId === 'all' ? null : form.propertyId,
            name: form.name,
            status: editingContract.status,
            frequency: form.frequency,
            startDate: form.startDate,
            endDate: form.endDate || null,
            pauseFrom: form.pauseFrom || null,
            pauseUntil: form.pauseUntil || null,
            taxRate: form.taxRate,
            notes: form.notes.trim() || null,
          })
        : await createContractMutation.mutateAsync({
            clientId: form.clientId,
            propertyId: form.propertyId === 'all' ? null : form.propertyId,
            name: form.name,
            status: 'active',
            frequency: form.frequency,
            startDate: form.startDate,
            endDate: form.endDate || null,
            pauseFrom: form.pauseFrom || null,
            pauseUntil: form.pauseUntil || null,
            taxRate: form.taxRate,
            notes: form.notes.trim() || null,
          });
      await replaceLineItemsMutation.mutateAsync({ contractId: savedContract.id, items: normalizedItems });
      toast.success(editingContract ? 'Scope updated' : 'Scope created');
      closeDialog();
      setActiveTab(titleCase(savedContract.status) as ContractTab);
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'Unable to save scope');
      setSaving(false);
    }
  };

  const updateStatus = async (contract: ServiceContract, status: ServiceContractStatus) => {
    if (statusUpdatingId) return;
    setStatusUpdatingId(contract.id);
    try {
      await updateContractStatusMutation.mutateAsync({ id: contract.id, status });
      toast.success(`Scope ${status}`);
      setActiveTab(titleCase(status) as ContractTab);
    } catch (statusError) {
      toast.error(statusError instanceof Error ? statusError.message : 'Unable to update scope');
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const generateInvoices = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const created = await generateInvoicesMutation.mutateAsync(todayIso());
      toast.success(created > 0 ? `Created ${created} invoices` : 'No invoices were due');
    } catch (generateError) {
      toast.error(generateError instanceof Error ? generateError.message : 'Unable to generate invoices');
    } finally {
      setGenerating(false);
    }
  };

  const tabContracts = useMemo(
    () => contracts.filter((contract) => contract.status === activeTab.toLowerCase()),
    [activeTab, contracts],
  );

  const monthlyValue = useMemo(
    () =>
      contracts
        .filter((contract) => contract.status === 'active')
        .reduce((sum, contract) => sum + calculateStoredLineItemTotals(lineItemsByContractId.get(contract.id) ?? [], contract.taxRate).total, 0),
    [contracts, lineItemsByContractId],
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
          <h1 className="text-2xl font-bold text-text-primary">Service Scope</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Define contracted scope, service cadence, and recurring commitments.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          {canGenerateInvoices ? (
            <Button type="button" variant="outline" onClick={() => void generateInvoices()} disabled={generating}>
              <RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
              {generating ? 'Generating' : 'Generate invoices'}
            </Button>
          ) : null}
          <Button type="button" onClick={openCreateDialog} className="bg-brand text-text-inverse hover:bg-brand/90">
            <Plus className="h-4 w-4" />
            New Scope
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-surface-border bg-surface-card p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-text-muted">
            <PlayCircle className="h-4 w-4 text-status-active" />
            Active
          </div>
          <div className="mt-2 text-2xl font-bold text-status-active">
            {contracts.filter((contract) => contract.status === 'active').length}
          </div>
        </div>
        <div className="rounded-lg border border-surface-border bg-surface-card p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-text-muted">
            <PauseCircle className="h-4 w-4 text-status-pending" />
            Paused
          </div>
          <div className="mt-2 text-2xl font-bold text-text-primary">
            {contracts.filter((contract) => contract.status === 'paused').length}
          </div>
        </div>
        <div className="rounded-lg border border-surface-border bg-surface-card p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-text-muted">
            <FileClock className="h-4 w-4 text-brand" />
            Active Scope Value
          </div>
          <div className="mt-2 text-2xl font-bold text-text-primary">{fmt(monthlyValue)}</div>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-surface-border">
        {TABS.map((tab) => {
          const count = contracts.filter((contract) => contract.status === tab.toLowerCase()).length;
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

      {tabContracts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-border bg-surface-card/60 py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-surface-elevated">
            <CalendarClock className="h-6 w-6 text-text-muted" />
          </div>
          <p className="mb-1 text-sm font-semibold text-text-primary">No {activeTab.toLowerCase()} scope</p>
          <p className="max-w-xs text-sm text-text-secondary">
            {activeTab === 'Active' ? 'Create recurring service scope to define expected work.' : 'Matching scope records will appear here.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-surface-border bg-surface-card">
          <table className="w-full text-sm">
            <thead className="border-b border-surface-border bg-surface-elevated">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-text-muted">Scope</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-text-muted">Account</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-text-muted md:table-cell">Property</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-text-muted lg:table-cell">Schedule</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-text-muted">Plan Total</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {tabContracts.map((contract) => {
                const contractItems = lineItemsByContractId.get(contract.id) ?? [];
                const contractTotals = calculateStoredLineItemTotals(contractItems, contract.taxRate);
                return (
                  <tr key={contract.id} className="transition-colors hover:bg-surface-hover">
                    <td className="px-4 py-3">
                      <div className="font-medium text-text-primary">{contract.name}</div>
                      <Badge variant={statusVariants[contract.status]} className="mt-1 capitalize">
                        {contract.status}
                      </Badge>
                      <div className="mt-1 text-xs text-text-secondary lg:hidden">{titleCase(contract.frequency)}</div>
                    </td>
                    <td className="px-4 py-3 text-text-primary">
                      <div className="font-medium">{getClientName(contract.clientId)}</div>
                      <div className="mt-1 text-xs text-text-secondary md:hidden">{getPropertyName(contract.propertyId)}</div>
                    </td>
                    <td className="hidden px-4 py-3 text-text-secondary md:table-cell">{getPropertyName(contract.propertyId)}</td>
                    <td className="hidden px-4 py-3 text-text-secondary lg:table-cell">
                      <div className="font-medium text-text-primary">{titleCase(contract.frequency)}</div>
                      <div className="mt-1 text-xs">{fmtDate(contract.startDate)} - {contract.endDate ? fmtDate(contract.endDate) : 'Open ended'}</div>
                      <div className="mt-1 text-xs">{getNextPeriodHint(contract)}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-text-primary">{fmt(contractTotals.total)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => openEditDialog(contract)} disabled={statusUpdatingId === contract.id}>
                          <Edit3 className="h-4 w-4" />
                          <span className="hidden sm:inline">Edit</span>
                        </Button>
                        {contract.status !== 'active' ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void updateStatus(contract, 'active')}
                            disabled={statusUpdatingId === contract.id || Boolean(statusUpdatingId)}
                            className="border-status-active/40 text-status-active hover:bg-status-active/10"
                          >
                            Active
                          </Button>
                        ) : null}
                        {contract.status !== 'paused' && contract.status !== 'ended' ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void updateStatus(contract, 'paused')}
                            disabled={statusUpdatingId === contract.id || Boolean(statusUpdatingId)}
                            className="border-status-pending/40 text-status-pending hover:bg-status-pending/10"
                          >
                            Pause
                          </Button>
                        ) : null}
                        {contract.status !== 'ended' ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void updateStatus(contract, 'ended')}
                            disabled={statusUpdatingId === contract.id || Boolean(statusUpdatingId)}
                            className="border-status-warning/40 text-status-warning hover:bg-status-warning/10"
                          >
                            <StopCircle className="h-4 w-4" />
                            <span className="hidden sm:inline">End</span>
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

      <section className="rounded-lg border border-surface-border bg-surface-card">
        <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Run History</h2>
            <p className="mt-0.5 text-xs text-text-secondary">Recent invoice results.</p>
          </div>
        </div>
        {runs.length === 0 ? (
          <div className="px-4 py-8 text-sm text-text-secondary">No invoice runs yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-surface-border bg-surface-elevated">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-text-muted">Run</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-text-muted">As Of</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-text-muted">Scopes</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-text-muted">Invoices</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-text-muted">Issue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td className="px-4 py-3 text-text-primary">{fmtTimestamp(run.runAt)}</td>
                    <td className="px-4 py-3 text-text-secondary">{fmtDate(run.asOf)}</td>
                    <td className="px-4 py-3 text-right text-text-primary">{run.contractsProcessed}</td>
                    <td className="px-4 py-3 text-right font-medium text-text-primary">{run.invoicesCreated}</td>
                    <td className="max-w-xs px-4 py-3 text-text-secondary">{run.error || 'None'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-surface-border bg-surface-card text-text-primary sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingContract ? 'Edit Scope' : 'New Scope'}</DialogTitle>
            <DialogDescription>
              Build the contracted service plan and line items that define recurring work.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-text-muted">Name</label>
                <Input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Scope name"
                  disabled={saving}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-text-muted">Account</label>
                <Select value={form.clientId || undefined} onValueChange={(value) => setForm((current) => ({ ...current, clientId: value }))} disabled={saving}>
                  <SelectTrigger className="border-surface-border bg-surface-elevated text-text-primary">
                    <SelectValue placeholder="Select account" />
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
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-text-muted">Property</label>
                <Select
                  value={form.propertyId ?? NO_PROPERTY_VALUE}
                  onValueChange={(value) => setForm((current) => ({ ...current, propertyId: value === NO_PROPERTY_VALUE ? null : value }))}
                  disabled={saving}
                >
                  <SelectTrigger className="border-surface-border bg-surface-elevated text-text-primary">
                    <SelectValue placeholder="No property" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PROPERTY_VALUE}>No property</SelectItem>
                    {properties.map((property) => (
                      <SelectItem key={property.id} value={property.id}>
                        {property.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-text-muted">Frequency</label>
                <Select value={form.frequency} onValueChange={(value) => setForm((current) => ({ ...current, frequency: value as ServiceContractFrequency }))} disabled={saving}>
                  <SelectTrigger className="border-surface-border bg-surface-elevated text-text-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map((frequency) => (
                      <SelectItem key={frequency} value={frequency}>
                        {titleCase(frequency)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-text-muted">Start Date</label>
                <Input type="date" value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} disabled={saving} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-text-muted">End Date</label>
                <Input type="date" value={form.endDate} onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))} disabled={saving} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-text-muted">Pause From</label>
                <Input type="date" value={form.pauseFrom} onChange={(event) => setForm((current) => ({ ...current, pauseFrom: event.target.value }))} disabled={saving} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-text-muted">Pause Until</label>
                <Input type="date" value={form.pauseUntil} onChange={(event) => setForm((current) => ({ ...current, pauseUntil: event.target.value }))} disabled={saving} />
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
            <Button type="button" onClick={() => void saveContract()} disabled={saving || !form.name.trim() || !form.clientId || totals.subtotal <= 0} className="bg-brand text-text-inverse hover:bg-brand/90">
              {saving ? 'Saving' : 'Save Scope'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
