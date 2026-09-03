import { useEffect, useMemo, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CheckCircle2,
  Clipboard,
  Inbox,
  Mail,
  Phone,
  Receipt,
} from 'lucide-react';
import { ErrorRetry } from '@/components/ErrorRetry';
import { PageSkeleton } from '@/components/PageSkeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { useOrgProfile } from '@/hooks/useOrgProfile';
import type { Property } from '@/data/seedData';
import {
  type BillingClient,
  type EstimateStatus,
  type RevenueInvoice,
  type RevenueLineItem,
  type ServiceContract,
  type TaskWorkOrder,
  type TaskWorkOrderFunnelStage,
  useClientProperties,
  useClients,
  useEstimates,
  useInvoices,
  usePayments,
  useProgramSettings,
  useProperties,
  useServiceContractLineItems,
  useServiceContracts,
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

function contractTotal(contract: ServiceContract, lineItems: RevenueLineItem[]) {
  const subtotal = lineItems
    .filter((item) => item.parentId === contract.id)
    .reduce((sum, item) => sum + item.lineTotal, 0);
  return subtotal + subtotal * (Math.max(0, contract.taxRate) / 100);
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
  const { orgId } = useOrgProfile();
  const clientsQuery = useClients(orgId ?? undefined);
  const propertiesQuery = useProperties(orgId ?? undefined);
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

  const copyRequestLink = async () => {
    if (!account) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/view/request/${account.clientToken}`);
      toast.success('Link copied');
    } catch {
      toast.error('Unable to copy link');
    }
  };

  const handleRetry = () => {
    void clientsQuery.refetch();
    void propertiesQuery.refetch();
    void clientPropertiesQuery.refetch();
    void serviceContractsQuery.refetch();
    void serviceContractLineItemsQuery.refetch();
    void taskWorkOrdersQuery.refetch();
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

          <Section title="Active Service Scope" icon={<Briefcase className="h-4 w-4 text-status-active" />}>
            {activeContracts.length === 0 ? (
              <EmptySection message="No active service scope is linked to this account." />
            ) : (
              <div className="space-y-3">
                {activeContracts.map((contract) => (
                  <div key={contract.id} className="rounded-lg border border-surface-border bg-surface-elevated p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-text-primary">{contract.name}</div>
                        <div className="mt-1 text-xs text-text-secondary">
                          {propertiesById.get(contract.propertyId ?? '')?.name ?? 'All account properties'} · {titleCase(contract.frequency)}
                        </div>
                      </div>
                      <Badge variant="active">Active</Badge>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-text-secondary sm:grid-cols-3">
                      <div>Starts {formatDate(contract.startDate)}</div>
                      <div>Ends {formatDate(contract.endDate)}</div>
                      {billingEnabled ? <div>{formatCurrency(contractTotal(contract, serviceContractLineItems))}</div> : null}
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
          <Section title="Completed & Verified Work" icon={<CheckCircle2 className="h-4 w-4 text-status-complete" />}>
            {completedWorkOrders.length === 0 ? (
              <EmptySection message="No verified completed work yet." />
            ) : (
              <div className="space-y-3">
                {completedWorkOrders.slice(0, 6).map((workOrder) => (
                  <WorkOrderCard key={workOrder.id} workOrder={workOrder} propertiesById={propertiesById} />
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
    </div>
  );
}

function WorkOrderCard({
  workOrder,
  propertiesById,
}: {
  workOrder: TaskWorkOrder;
  propertiesById: Map<string, Property>;
}) {
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
      {workOrder.description ? (
        <p className="mt-3 line-clamp-2 text-sm text-text-secondary">{workOrder.description}</p>
      ) : null}
      {workOrder.completedAt ? (
        <div className="mt-3 text-xs text-text-muted">Verified {formatDate(workOrder.completedAt)}</div>
      ) : null}
    </div>
  );
}
