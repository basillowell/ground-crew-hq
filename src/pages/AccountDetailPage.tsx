import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CheckCircle2,
  Clipboard,
  FileCheck2,
  Inbox,
  Mail,
  PenLine,
  Phone,
  Receipt,
} from 'lucide-react';
import { ErrorRetry } from '@/components/ErrorRetry';
import { PageSkeleton } from '@/components/PageSkeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { TaskWorkOrderProofDialog } from '@/components/work-orders/TaskWorkOrderProofDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/sonner';
import { useOrgProfile } from '@/hooks/useOrgProfile';
import type { Assignment, Employee, Property } from '@/data/seedData';
import { createClient } from '@/lib/supabase';
import { withRequestTimeout } from '@/lib/requestTimeout';
import {
  type BillingClient,
  type EstimateStatus,
  type RevenueInvoice,
  type RevenueLineItem,
  type ServiceContract,
  type TaskWorkOrder,
  type TaskWorkOrderFunnelStage,
  useAssignmentSignaturesForAssignments,
  useClientProperties,
  useClients,
  useEmployees,
  useEstimates,
  useInvoices,
  usePayments,
  useProgramSettings,
  useProperties,
  useServiceContractLineItems,
  useServiceContracts,
  useTaskWorkOrderAssignments,
  useTaskWorkOrders,
} from '@/lib/supabase-queries';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const workOrderStageVariants: Record<TaskWorkOrderFunnelStage, 'active' | 'pending' | 'warning' | 'complete' | 'hold'> = {
  new: 'pending',
  in_review: 'pending',
  accepted: 'active',
  rejected: 'warning',
  assigned: 'active',
  pending_verification: 'pending',
  completed: 'complete',
};

const estimateStatusVariants: Record<EstimateStatus, 'hold' | 'pending' | 'complete' | 'warning'> = {
  draft: 'hold',
  sent: 'pending',
  accepted: 'complete',
  declined: 'warning',
  expired: 'hold',
};

const invoiceStatusVariants: Record<RevenueInvoice['status'], 'hold' | 'pending' | 'complete' | 'warning'> = {
  draft: 'hold',
  sent: 'pending',
  paid: 'complete',
  void: 'warning',
};

const ALL_ACCOUNT_PROPERTIES_KEY = 'all-account-properties';

type ResultsBoardShareContext = {
  clientId: string;
  clientName: string;
  resultsBoardToken: string;
  resultsBoardEnabled: boolean;
};

function getRouteParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'No date set';
  return new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function titleCase(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatHours(value: number) {
  return `${value.toFixed(2)}h`;
}

function employeeName(employee: Employee | undefined) {
  if (!employee) return 'Unassigned employee';
  return `${employee.firstName} ${employee.lastName}`.trim() || employee.email || 'Unnamed employee';
}

function assignmentCompletionDate(assignment: Assignment) {
  return assignment.actualCompletedAt ?? assignment.actual_completed_at ?? assignment.completedAt ?? assignment.completed_at ?? null;
}

function latestAssignmentCompletion(assignments: Assignment[]) {
  return assignments
    .map(assignmentCompletionDate)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;
}

function contractTotal(contract: ServiceContract, lineItems: RevenueLineItem[]) {
  const subtotal = lineItems
    .filter((item) => item.parentId === contract.id)
    .reduce((sum, item) => sum + item.lineTotal, 0);
  return subtotal + subtotal * (Math.max(0, contract.taxRate) / 100);
}

function normalizeResultsBoardShareContext(payload: unknown): ResultsBoardShareContext | null {
  const row = (payload ?? {}) as Record<string, unknown>;
  const clientId = typeof row.client_id === 'string' ? row.client_id : '';
  const clientName = typeof row.client_name === 'string' ? row.client_name : '';
  const resultsBoardToken = typeof row.results_board_token === 'string' ? row.results_board_token : '';
  if (!clientId || !resultsBoardToken) return null;
  return {
    clientId,
    clientName,
    resultsBoardToken,
    resultsBoardEnabled: row.results_board_enabled === true,
  };
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-surface-border bg-surface-card">
      <div className="flex items-center gap-2 border-b border-surface-border px-4 py-3">
        {icon}
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function EmptySection({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-surface-border bg-surface-elevated/60 px-4 py-8 text-center text-sm text-text-secondary">
      {message}
    </div>
  );
}

function AccountMissingState() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="rounded-lg border border-surface-border bg-surface-card p-6">
        <h1 className="text-xl font-semibold text-text-primary">Account not found</h1>
        <p className="mt-2 text-sm text-text-secondary">
          This account could not be found for the current organization.
        </p>
        <Button asChild className="mt-4 bg-brand text-text-inverse hover:bg-brand/90">
          <Link href="/app/clients">
            <ArrowLeft className="h-4 w-4" />
            Back to Accounts
          </Link>
        </Button>
      </div>
    </div>
  );
}

export default function AccountDetailPage() {
  const params = useParams();
  const clientId = getRouteParam(params?.id);
  const validClientId = Boolean(clientId && uuidPattern.test(clientId));
  const [proofWorkOrder, setProofWorkOrder] = useState<TaskWorkOrder | null>(null);
  const [resultsBoardDialogOpen, setResultsBoardDialogOpen] = useState(false);
  const [resultsBoardLoading, setResultsBoardLoading] = useState(false);
  const [resultsBoardSaving, setResultsBoardSaving] = useState(false);
  const [resultsBoardCopying, setResultsBoardCopying] = useState(false);
  const [resultsBoardError, setResultsBoardError] = useState<string | null>(null);
  const [resultsBoardContext, setResultsBoardContext] = useState<ResultsBoardShareContext | null>(null);
  const { orgId, currentRole } = useOrgProfile();
  const queryClient = useQueryClient();
  const clientsQuery = useClients(orgId ?? undefined);
  const propertiesQuery = useProperties(orgId ?? undefined);
  const employeesQuery = useEmployees(undefined, orgId ?? undefined);
  const clientPropertiesQuery = useClientProperties(orgId ?? undefined, clientId, validClientId);
  const serviceContractsQuery = useServiceContracts(orgId ?? undefined);
  const serviceContractLineItemsQuery = useServiceContractLineItems(undefined, orgId ?? undefined);
  const taskWorkOrdersQuery = useTaskWorkOrders(orgId ?? undefined);
  const programSettingsQuery = useProgramSettings(orgId ?? undefined);
  const estimatesQuery = useEstimates(orgId ?? undefined);
  const invoicesQuery = useInvoices(orgId ?? undefined);
  const paymentsQuery = usePayments(undefined, orgId ?? undefined);

  useEffect(() => {
    document.title = 'Account Detail - Ground Crew HQ';
  }, []);

  const billingEnabled = programSettingsQuery.data?.billingEnabled ?? true;
  const clients = clientsQuery.data ?? [];
  const properties = propertiesQuery.data ?? [];
  const employees = employeesQuery.data ?? [];
  const clientProperties = clientPropertiesQuery.data ?? [];
  const serviceContracts = serviceContractsQuery.data ?? [];
  const serviceContractLineItems = serviceContractLineItemsQuery.data ?? [];
  const taskWorkOrders = taskWorkOrdersQuery.data ?? [];
  const estimates = estimatesQuery.data ?? [];
  const invoices = invoicesQuery.data ?? [];
  const payments = paymentsQuery.data ?? [];

  const account = useMemo<BillingClient | undefined>(
    () => clients.find((client) => client.id === clientId),
    [clientId, clients],
  );
  const canManageResultsBoard = currentRole === 'admin' || currentRole === 'manager';
  const resultsBoardUrl = useMemo(() => {
    if (!resultsBoardContext?.resultsBoardToken) return '';
    if (typeof window === 'undefined') return `/view/account/${resultsBoardContext.resultsBoardToken}`;
    return `${window.location.origin}/view/account/${resultsBoardContext.resultsBoardToken}`;
  }, [resultsBoardContext?.resultsBoardToken]);

  const propertiesById = useMemo(() => new Map(properties.map((property) => [property.id, property])), [properties]);
  const accountProperties = useMemo(
    () =>
      clientProperties
        .filter((relationship) => relationship.clientId === clientId)
        .map((relationship) => propertiesById.get(relationship.propertyId))
        .filter((property): property is Property => Boolean(property)),
    [clientId, clientProperties, propertiesById],
  );

  const accountContracts = useMemo(
    () => serviceContracts.filter((contract) => contract.clientId === clientId),
    [clientId, serviceContracts],
  );
  const activeContracts = useMemo(
    () => accountContracts.filter((contract) => contract.status === 'active'),
    [accountContracts],
  );
  const activeScopeGroups = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; contracts: ServiceContract[] }>();
    activeContracts.forEach((contract) => {
      const key = contract.propertyId ?? ALL_ACCOUNT_PROPERTIES_KEY;
      const label = contract.propertyId ? propertiesById.get(contract.propertyId)?.name ?? 'Property not found' : 'All account properties';
      const current = groups.get(key) ?? { key, label, contracts: [] };
      current.contracts.push(contract);
      groups.set(key, current);
    });

    return Array.from(groups.values()).sort((first, second) => {
      if (first.key === ALL_ACCOUNT_PROPERTIES_KEY) return -1;
      if (second.key === ALL_ACCOUNT_PROPERTIES_KEY) return 1;
      return first.label.localeCompare(second.label);
    });
  }, [activeContracts, propertiesById]);
  const accountWorkOrders = useMemo(
    () => taskWorkOrders.filter((workOrder) => workOrder.clientId === clientId),
    [clientId, taskWorkOrders],
  );
  const openWorkOrders = useMemo(
    () => accountWorkOrders.filter((workOrder) => !['completed', 'rejected'].includes(workOrder.funnelStage)),
    [accountWorkOrders],
  );
  const completedWorkOrders = useMemo(
    () => accountWorkOrders.filter((workOrder) => workOrder.funnelStage === 'completed'),
    [accountWorkOrders],
  );
  const deliveredWorkOrders = useMemo(
    () => accountWorkOrders.filter((workOrder) => ['completed', 'pending_verification'].includes(workOrder.funnelStage)),
    [accountWorkOrders],
  );
  const deliveredWorkOrderIds = useMemo(() => deliveredWorkOrders.map((workOrder) => workOrder.id), [deliveredWorkOrders]);
  const deliveredAssignmentsQuery = useTaskWorkOrderAssignments(orgId ?? undefined, deliveredWorkOrderIds);
  const deliveredAssignments = deliveredAssignmentsQuery.data ?? [];
  const deliveredAssignmentIds = useMemo(
    () => deliveredAssignments.map((assignment) => assignment.id).filter((id): id is string => Boolean(id)),
    [deliveredAssignments],
  );
  const deliveredSignaturesQuery = useAssignmentSignaturesForAssignments(orgId ?? undefined, deliveredAssignmentIds);
  const deliveredSignatures = deliveredSignaturesQuery.data ?? [];
  const accountEstimates = useMemo(
    () => estimates.filter((estimate) => estimate.clientId === clientId),
    [clientId, estimates],
  );
  const accountInvoices = useMemo(
    () => invoices.filter((invoice) => invoice.clientId === clientId),
    [clientId, invoices],
  );
  const invoiceIds = useMemo(() => new Set(accountInvoices.map((invoice) => invoice.id)), [accountInvoices]);
  const accountPayments = useMemo(
    () => payments.filter((payment) => invoiceIds.has(payment.invoiceId)),
    [invoiceIds, payments],
  );

  const coreLoading =
    !orgId ||
    (clientsQuery.isLoading && !clientsQuery.data) ||
    (propertiesQuery.isLoading && !propertiesQuery.data) ||
    (employeesQuery.isLoading && !employeesQuery.data) ||
    (clientPropertiesQuery.isLoading && !clientPropertiesQuery.data) ||
    (serviceContractsQuery.isLoading && !serviceContractsQuery.data) ||
    (serviceContractLineItemsQuery.isLoading && !serviceContractLineItemsQuery.data) ||
    (taskWorkOrdersQuery.isLoading && !taskWorkOrdersQuery.data) ||
    (programSettingsQuery.isLoading && !programSettingsQuery.data);
  const billingLoading =
    billingEnabled &&
    ((estimatesQuery.isLoading && !estimatesQuery.data) ||
      (invoicesQuery.isLoading && !invoicesQuery.data) ||
      (paymentsQuery.isLoading && !paymentsQuery.data));
  const queryError =
    clientsQuery.error ??
    propertiesQuery.error ??
    employeesQuery.error ??
    clientPropertiesQuery.error ??
    serviceContractsQuery.error ??
    serviceContractLineItemsQuery.error ??
    taskWorkOrdersQuery.error ??
    programSettingsQuery.error ??
    (billingEnabled ? estimatesQuery.error ?? invoicesQuery.error ?? paymentsQuery.error : null);
  const error = queryError instanceof Error ? queryError.message : null;

  const totals = useMemo(() => {
    const activeScopeValue = activeContracts.reduce(
      (sum, contract) => sum + contractTotal(contract, serviceContractLineItems),
      0,
    );
    const estimateValue = accountEstimates.reduce((sum, estimate) => sum + estimate.total, 0);
    const invoiceValue = accountInvoices
      .filter((invoice) => invoice.status !== 'void')
      .reduce((sum, invoice) => sum + invoice.total, 0);
    const paidValue = accountPayments.reduce((sum, payment) => sum + payment.amount, 0);
    return { activeScopeValue, estimateValue, invoiceValue, paidValue };
  }, [accountEstimates, accountInvoices, accountPayments, activeContracts, serviceContractLineItems]);

  const employeeById = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);
  const deliveredAssignmentSummaryByWorkOrderId = useMemo(() => {
    const signatureCountByAssignmentId = deliveredSignatures.reduce<Record<string, number>>((counts, signature) => {
      counts[signature.assignmentId] = (counts[signature.assignmentId] ?? 0) + 1;
      return counts;
    }, {});
    return deliveredAssignments.reduce<Record<string, {
      assignmentCount: number;
      crewNames: string[];
      fieldCompletedAt: string | null;
      signatureCount: number;
      totalHours: number;
    }>>((summary, assignment) => {
      const workOrderId = assignment.taskWorkOrderId ?? assignment.task_work_order_id;
      if (!workOrderId) return summary;
      const current = summary[workOrderId] ?? {
        assignmentCount: 0,
        crewNames: [],
        fieldCompletedAt: null,
        signatureCount: 0,
        totalHours: 0,
      };
      const crewName = employeeName(employeeById.get(assignment.employeeId));
      const completedAt = assignmentCompletionDate(assignment);
      summary[workOrderId] = {
        assignmentCount: current.assignmentCount + 1,
        crewNames: current.crewNames.includes(crewName) ? current.crewNames : [...current.crewNames, crewName],
        fieldCompletedAt: [current.fieldCompletedAt, completedAt].filter((value): value is string => Boolean(value)).sort().at(-1) ?? null,
        signatureCount: current.signatureCount + (assignment.id ? signatureCountByAssignmentId[assignment.id] ?? 0 : 0),
        totalHours: current.totalHours + Number(assignment.actualHours ?? assignment.actual_hours ?? 0),
      };
      return summary;
    }, {});
  }, [deliveredAssignments, deliveredSignatures, employeeById]);

  const copyRequestLink = async () => {
    if (!account) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/view/request/${account.clientToken}`);
      toast.success('Link copied');
    } catch {
      toast.error('Unable to copy link');
    }
  };

  const openResultsBoardDialog = useCallback(async () => {
    if (!canManageResultsBoard) {
      toast.error('Only supervisors can share the results board.');
      return;
    }
    if (!clientId || !validClientId) {
      toast.error('Choose a valid account before sharing its results board.');
      return;
    }

    setResultsBoardDialogOpen(true);
    setResultsBoardLoading(true);
    setResultsBoardError(null);
    setResultsBoardContext(null);
    try {
      const supabase = createClient();
      const { data, error } = await withRequestTimeout(
        supabase.rpc('get_account_results_board_share_context', { p_client_id: clientId }),
        'Results board link request timed out after 15 seconds.',
      );
      if (error) throw error;
      const normalized = normalizeResultsBoardShareContext(data);
      if (!normalized) throw new Error('Results board link is not available for this account.');
      setResultsBoardContext(normalized);
    } catch (error) {
      setResultsBoardError(error instanceof Error ? error.message : 'Unable to load results board link.');
    } finally {
      setResultsBoardLoading(false);
    }
  }, [canManageResultsBoard, clientId, validClientId]);

  const toggleResultsBoardEnabled = useCallback(async (nextEnabled: boolean) => {
    if (!canManageResultsBoard || !orgId || !resultsBoardContext) {
      toast.error('Only supervisors can update results board sharing.');
      return;
    }
    setResultsBoardSaving(true);
    try {
      const supabase = createClient();
      const { error } = await withRequestTimeout(
        supabase
          .from('clients')
          .update({ results_board_enabled: nextEnabled })
          .eq('id', resultsBoardContext.clientId)
          .eq('org_id', orgId),
        'Results board sharing update timed out after 15 seconds.',
      );
      if (error) {
        toast.error(`Could not ${nextEnabled ? 'enable' : 'disable'} results board: ${error.message}`);
        return;
      }
      setResultsBoardContext((current) => current ? { ...current, resultsBoardEnabled: nextEnabled } : current);
      await queryClient.invalidateQueries({ queryKey: ['clients', orgId] });
      toast.success(nextEnabled ? 'Results board enabled' : 'Results board disabled');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update results board sharing.');
    } finally {
      setResultsBoardSaving(false);
    }
  }, [canManageResultsBoard, orgId, queryClient, resultsBoardContext]);

  const copyResultsBoardLink = useCallback(async () => {
    if (!resultsBoardContext || !resultsBoardUrl) return;
    if (!resultsBoardContext.resultsBoardEnabled) {
      toast.info('Enable the results board before sharing the link.');
      return;
    }
    setResultsBoardCopying(true);
    try {
      await navigator.clipboard.writeText(resultsBoardUrl);
      toast.success('Results board link copied');
    } catch {
      toast.error('Unable to copy results board link');
    } finally {
      setResultsBoardCopying(false);
    }
  }, [resultsBoardContext, resultsBoardUrl]);

  const handleRetry = () => {
    void clientsQuery.refetch();
    void propertiesQuery.refetch();
    void employeesQuery.refetch();
    void clientPropertiesQuery.refetch();
    void serviceContractsQuery.refetch();
    void serviceContractLineItemsQuery.refetch();
    void taskWorkOrdersQuery.refetch();
    void deliveredAssignmentsQuery.refetch();
    void deliveredSignaturesQuery.refetch();
    void programSettingsQuery.refetch();
    if (billingEnabled) {
      void estimatesQuery.refetch();
      void invoicesQuery.refetch();
      void paymentsQuery.refetch();
    }
  };

  if (coreLoading || billingLoading) return <PageSkeleton />;
  if (!validClientId || !account) return <AccountMissingState />;
  if (error) {
    return (
      <div className="p-6">
        <ErrorRetry message={error} onRetry={handleRetry} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <PageHeader
        title={account.name}
        subtitle="Account hub"
        badge={<Badge variant={account.active ? 'active' : 'hold'}>{account.active ? 'Active' : 'Inactive'}</Badge>}
      >
        <Button asChild variant="outline" size="sm">
          <Link href="/app/clients">
            <ArrowLeft className="h-4 w-4" />
            Accounts
          </Link>
        </Button>
        <Button type="button" size="sm" onClick={() => void copyRequestLink()} className="bg-brand text-text-inverse hover:bg-brand/90">
          <Clipboard className="h-4 w-4" />
          Copy request link
        </Button>
        {canManageResultsBoard ? (
          <Button type="button" size="sm" variant="outline" onClick={() => void openResultsBoardDialog()}>
            <Clipboard className="h-4 w-4" />
            Share results board
          </Button>
        ) : null}
      </PageHeader>

      <section className="rounded-lg border border-surface-border bg-surface-card p-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-widest text-text-muted">Contact</div>
            <div className="mt-2 space-y-1 text-sm text-text-secondary">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-text-muted" />
                <span>{account.email || 'No email'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-text-muted" />
                <span>{account.phone || 'No phone'}</span>
              </div>
            </div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-widest text-text-muted">Address</div>
            <p className="mt-2 text-sm text-text-secondary">{account.address || 'No address on file'}</p>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-widest text-text-muted">Notes</div>
            <p className="mt-2 text-sm text-text-secondary">{account.notes || 'No notes yet'}</p>
          </div>
        </div>
      </section>

      <div className={`grid gap-4 ${billingEnabled ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
        <div className="rounded-lg border border-surface-border bg-surface-card p-4">
          <div className="text-xs font-medium uppercase tracking-widest text-text-muted">Properties</div>
          <div className="mt-2 text-2xl font-bold text-text-primary">{accountProperties.length}</div>
        </div>
        <div className="rounded-lg border border-surface-border bg-surface-card p-4">
          <div className="text-xs font-medium uppercase tracking-widest text-text-muted">Open Work Orders</div>
          <div className="mt-2 text-2xl font-bold text-text-primary">{openWorkOrders.length}</div>
        </div>
        <div className="rounded-lg border border-surface-border bg-surface-card p-4">
          <div className="text-xs font-medium uppercase tracking-widest text-text-muted">Verified Work</div>
          <div className="mt-2 text-2xl font-bold text-text-primary">{completedWorkOrders.length}</div>
        </div>
        {billingEnabled ? (
          <div className="rounded-lg border border-surface-border bg-surface-card p-4">
            <div className="text-xs font-medium uppercase tracking-widest text-text-muted">Billed</div>
            <div className="mt-2 text-2xl font-bold text-text-primary">{formatCurrency(totals.invoiceValue)}</div>
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
        <div className="space-y-6">
          <Section title="Properties" icon={<Building2 className="h-4 w-4 text-brand" />}>
            {accountProperties.length === 0 ? (
              <EmptySection message="No properties are linked to this account yet." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {accountProperties.map((property) => (
                  <div key={property.id} className="rounded-lg border border-surface-border bg-surface-elevated p-3">
                    <div className="font-medium text-text-primary">{property.name}</div>
                    <div className="mt-1 text-xs text-text-secondary">
                      {[property.city, property.state].filter(Boolean).join(', ') || 'No location'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Scope Baseline" icon={<Briefcase className="h-4 w-4 text-status-active" />}>
            {activeContracts.length === 0 ? (
              <EmptySection message="No active contracted scope is linked to this account." />
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-text-secondary">
                  Contracted scope and cadence for this account. Use this as the yardstick for delivered work; automatic scope matching is not inferred yet.
                </p>
                {activeScopeGroups.map((group) => (
                  <div key={group.key} className="rounded-lg border border-surface-border bg-surface-elevated">
                    <div className="flex items-center justify-between gap-3 border-b border-surface-border px-3 py-2">
                      <div>
                        <div className="text-sm font-semibold text-text-primary">{group.label}</div>
                        <div className="text-xs text-text-secondary">
                          {group.contracts.length} active scope{group.contracts.length === 1 ? '' : 's'}
                        </div>
                      </div>
                      <Badge variant="active">Scope baseline</Badge>
                    </div>
                    <div className="space-y-3 p-3">
                      {group.contracts.map((contract) => {
                        const contractItems = serviceContractLineItems
                          .filter((item) => item.parentId === contract.id)
                          .sort((first, second) => first.sortOrder - second.sortOrder);
                        return (
                          <details key={contract.id} className="rounded-lg border border-surface-border bg-surface-card p-3" open>
                            <summary className="cursor-pointer list-none">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <div className="font-medium text-text-primary">{contract.name}</div>
                                  <div className="mt-1 text-xs text-text-secondary">
                                    Cadence: {titleCase(contract.frequency)} · Starts {formatDate(contract.startDate)} · Ends {formatDate(contract.endDate)}
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="pending">{titleCase(contract.frequency)}</Badge>
                                  <Badge variant="active">Active</Badge>
                                </div>
                              </div>
                            </summary>
                            {contractItems.length === 0 ? (
                              <div className="mt-3 rounded-lg border border-dashed border-surface-border bg-surface-elevated/60 p-3 text-xs text-text-secondary">
                                No scope checklist items yet.
                              </div>
                            ) : (
                              <ul className="mt-3 space-y-2">
                                {contractItems.map((item) => (
                                  <li key={item.id} className="flex items-start gap-2 rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-text-secondary">
                                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-status-complete" />
                                    <div className="min-w-0 flex-1">
                                      <div className="font-medium text-text-primary">{item.description}</div>
                                      <div className="mt-1 text-xs text-text-muted">Quantity {item.quantity}</div>
                                    </div>
                                    {billingEnabled ? (
                                      <div className="text-right text-xs text-text-secondary">
                                        <div>{formatCurrency(item.lineTotal)}</div>
                                      </div>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            )}
                            {billingEnabled ? (
                              <div className="mt-3 text-right text-xs text-text-secondary">
                                Billing value {formatCurrency(contractTotal(contract, serviceContractLineItems))}
                              </div>
                            ) : null}
                          </details>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Work Orders" icon={<Inbox className="h-4 w-4 text-status-pending" />}>
            {openWorkOrders.length === 0 ? (
              <EmptySection message="No open work orders for this account." />
            ) : (
              <div className="space-y-3">
                {openWorkOrders.slice(0, 8).map((workOrder) => (
                  <WorkOrderCard key={workOrder.id} workOrder={workOrder} propertiesById={propertiesById} />
                ))}
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Delivered Against This Account" icon={<CheckCircle2 className="h-4 w-4 text-status-complete" />}>
            {deliveredAssignmentsQuery.isError || deliveredSignaturesQuery.isError ? (
              <div className="rounded-lg border border-status-warning/30 bg-status-warning/10 p-3 text-sm text-status-warning">
                Delivered proof details could not load.
              </div>
            ) : deliveredWorkOrders.length === 0 ? (
              <EmptySection message="No delivered results yet." />
            ) : (
              <div className="space-y-3">
                {deliveredWorkOrders.slice(0, 6).map((workOrder) => (
                  <WorkOrderCard
                    key={workOrder.id}
                    workOrder={workOrder}
                    propertiesById={propertiesById}
                    proofSummary={deliveredAssignmentSummaryByWorkOrderId[workOrder.id]}
                    proofLoading={deliveredAssignmentsQuery.isLoading || deliveredSignaturesQuery.isLoading}
                    onOpenProof={setProofWorkOrder}
                  />
                ))}
              </div>
            )}
          </Section>

          {billingEnabled ? (
            <Section title="Billing Outputs" icon={<Receipt className="h-4 w-4 text-brand" />}>
              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <div className="rounded-lg border border-surface-border bg-surface-elevated p-3">
                  <div className="text-xs font-medium uppercase tracking-widest text-text-muted">Estimates</div>
                  <div className="mt-2 text-lg font-semibold text-text-primary">{accountEstimates.length}</div>
                  <div className="text-xs text-text-secondary">{formatCurrency(totals.estimateValue)}</div>
                </div>
                <div className="rounded-lg border border-surface-border bg-surface-elevated p-3">
                  <div className="text-xs font-medium uppercase tracking-widest text-text-muted">Invoices</div>
                  <div className="mt-2 text-lg font-semibold text-text-primary">{accountInvoices.length}</div>
                  <div className="text-xs text-text-secondary">{formatCurrency(totals.invoiceValue)}</div>
                </div>
                <div className="rounded-lg border border-surface-border bg-surface-elevated p-3">
                  <div className="text-xs font-medium uppercase tracking-widest text-text-muted">Collected</div>
                  <div className="mt-2 text-lg font-semibold text-status-active">{formatCurrency(totals.paidValue)}</div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {[...accountInvoices].slice(0, 4).map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between gap-3 rounded-lg border border-surface-border bg-surface-elevated p-3">
                    <div>
                      <div className="text-sm font-medium text-text-primary">Invoice #{invoice.invoiceNumber}</div>
                      <div className="text-xs text-text-secondary">{formatDate(invoice.createdAt)}</div>
                    </div>
                    <div className="text-right">
                      <Badge variant={invoiceStatusVariants[invoice.status]} className="capitalize">{invoice.status}</Badge>
                      <div className="mt-1 text-xs text-text-secondary">{formatCurrency(invoice.total)}</div>
                    </div>
                  </div>
                ))}
                {accountInvoices.length === 0 ? <EmptySection message="No invoices for this account yet." /> : null}
              </div>

              {accountEstimates.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {accountEstimates.slice(0, 3).map((estimate) => (
                    <div key={estimate.id} className="flex items-center justify-between gap-3 rounded-lg border border-surface-border bg-surface-elevated p-3">
                      <div>
                        <div className="text-sm font-medium text-text-primary">Estimate #{estimate.estimateNumber}</div>
                        <div className="text-xs text-text-secondary">{formatDate(estimate.createdAt)}</div>
                      </div>
                      <div className="text-right">
                        <Badge variant={estimateStatusVariants[estimate.status]} className="capitalize">{estimate.status}</Badge>
                        <div className="mt-1 text-xs text-text-secondary">{formatCurrency(estimate.total)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </Section>
          ) : null}
        </div>
      </div>

      <TaskWorkOrderProofDialog
        open={Boolean(proofWorkOrder)}
        onOpenChange={(open) => {
          if (!open) setProofWorkOrder(null);
        }}
        orgId={orgId}
        workOrder={proofWorkOrder}
        properties={properties}
        employees={employees}
      />

      <Dialog
        open={resultsBoardDialogOpen}
        onOpenChange={(open) => {
          setResultsBoardDialogOpen(open);
          if (!open) {
            setResultsBoardError(null);
          }
        }}
      >
        <DialogContent role="dialog" aria-modal="true" className="max-w-lg">
          <DialogDescription className="sr-only">
            Enable or disable the public results board for this account and copy its share link.
          </DialogDescription>
          <DialogHeader>
            <DialogTitle>Results Board</DialogTitle>
          </DialogHeader>
          {resultsBoardLoading ? (
            <div className="space-y-3 py-3">
              <div className="h-4 w-48 animate-pulse rounded bg-surface-elevated" />
              <div className="h-10 animate-pulse rounded bg-surface-elevated" />
              <div className="h-10 w-36 animate-pulse rounded bg-surface-elevated" />
            </div>
          ) : resultsBoardError ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-status-warning/30 bg-status-warning/10 p-3 text-sm text-status-warning">
                {resultsBoardError}
              </div>
              <Button type="button" variant="outline" onClick={() => void openResultsBoardDialog()}>
                Retry
              </Button>
            </div>
          ) : resultsBoardContext ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-surface-border bg-surface-elevated p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{resultsBoardContext.clientName || account.name}</p>
                    <p className="mt-1 text-xs text-text-secondary">
                      Public owner/HOA results board for delivered work and scope baseline.
                    </p>
                  </div>
                  <Badge variant={resultsBoardContext.resultsBoardEnabled ? 'active' : 'hold'}>
                    {resultsBoardContext.resultsBoardEnabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
              </div>
              <div className="rounded-lg border border-surface-border bg-surface-elevated p-3">
                <p className="text-xs font-medium uppercase tracking-widest text-text-muted">Share link</p>
                <p className="mt-2 break-all rounded-md border border-surface-border bg-surface-card px-3 py-2 text-sm text-text-secondary">
                  {resultsBoardUrl}
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void toggleResultsBoardEnabled(!resultsBoardContext.resultsBoardEnabled)}
                  disabled={resultsBoardSaving}
                >
                  {resultsBoardSaving
                    ? 'Saving...'
                    : resultsBoardContext.resultsBoardEnabled
                      ? 'Disable results board'
                      : 'Enable results board'}
                </Button>
                <Button
                  type="button"
                  className="bg-brand text-text-inverse hover:bg-brand/90"
                  onClick={() => void copyResultsBoardLink()}
                  disabled={resultsBoardCopying || !resultsBoardContext.resultsBoardEnabled}
                >
                  <Clipboard className="h-4 w-4" />
                  {resultsBoardCopying ? 'Copying...' : 'Copy results board link'}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WorkOrderCard({
  workOrder,
  propertiesById,
  proofSummary,
  proofLoading = false,
  onOpenProof,
}: {
  workOrder: TaskWorkOrder;
  propertiesById: Map<string, Property>;
  proofSummary?: {
    assignmentCount: number;
    crewNames: string[];
    fieldCompletedAt: string | null;
    signatureCount: number;
    totalHours: number;
  };
  proofLoading?: boolean;
  onOpenProof?: (workOrder: TaskWorkOrder) => void;
}) {
  const deliveredAt = workOrder.completedAt ?? proofSummary?.fieldCompletedAt ?? null;
  const deliveredLabel = workOrder.completedAt ? 'Verified' : 'Field complete';
  return (
    <div className="rounded-lg border border-surface-border bg-surface-elevated p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-medium text-text-primary">{workOrder.title}</div>
          <div className="mt-1 text-xs text-text-secondary">
            {propertiesById.get(workOrder.propertyId ?? '')?.name ?? 'Property not set'} · {formatDate(workOrder.createdAt)}
          </div>
        </div>
        <Badge variant={workOrderStageVariants[workOrder.funnelStage]}>{titleCase(workOrder.funnelStage)}</Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Badge variant="hold" className="capitalize">{workOrder.source}</Badge>
        {deliveredAt ? <Badge variant="complete">{deliveredLabel} {formatDate(deliveredAt)}</Badge> : null}
      </div>
      {workOrder.description ? (
        <p className="mt-3 line-clamp-2 text-sm text-text-secondary">{workOrder.description}</p>
      ) : null}
      {proofSummary ? (
        <div className="mt-3 grid gap-2 text-xs text-text-secondary">
          <div className="flex items-center gap-2">
            <FileCheck2 className="h-3.5 w-3.5 text-text-muted" />
            <span>{proofSummary.assignmentCount} linked assignment{proofSummary.assignmentCount === 1 ? '' : 's'} · {formatHours(proofSummary.totalHours)}</span>
          </div>
          <div className="flex items-center gap-2">
            <PenLine className="h-3.5 w-3.5 text-text-muted" />
            <span>{proofSummary.signatureCount} signature{proofSummary.signatureCount === 1 ? '' : 's'} captured</span>
          </div>
          {proofSummary.crewNames.length > 0 ? (
            <div className="text-text-muted">Crew: {proofSummary.crewNames.slice(0, 3).join(', ')}</div>
          ) : null}
        </div>
      ) : proofLoading ? (
        <div className="mt-3 text-xs text-text-muted">Loading proof details...</div>
      ) : null}
      {workOrder.punchList ? (
        <div className="mt-3 rounded-lg border border-status-warning/25 bg-status-warning/10 p-2 text-xs leading-5 text-text-secondary">
          <p className="font-medium text-status-warning">Punch list</p>
          <p className="mt-1 whitespace-pre-line">{workOrder.punchList}</p>
        </div>
      ) : null}
      {onOpenProof ? (
        <Button type="button" variant="outline" size="sm" className="mt-3 w-full" onClick={() => onOpenProof(workOrder)}>
          View proof package
        </Button>
      ) : null}
    </div>
  );
}
