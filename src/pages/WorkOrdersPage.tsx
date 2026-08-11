import { useEffect, useMemo, useState } from 'react';
import { Building2, CalendarDays, Inbox, Plus, UserRound } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/sonner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOrgProfile } from '@/hooks/useOrgProfile';
import {
  type BillingClient,
  type TaskWorkOrder,
  type TaskWorkOrderFunnelStage,
  useClients,
  useCreateTaskWorkOrder,
  useProperties,
  useTaskWorkOrders,
} from '@/lib/supabase-queries';
import type { Property } from '@/data/seedData';

type BadgeVariant = 'active' | 'pending' | 'warning' | 'complete' | 'hold';
type Priority = 'low' | 'medium' | 'high';

type WorkOrderFormState = {
  title: string;
  description: string;
  clientId: string;
  propertyId: string;
  priority: Priority;
};

type LaneConfig = {
  key: string;
  label: string;
  stages: TaskWorkOrderFunnelStage[];
  variant: BadgeVariant;
};

const UNSET_SELECT_VALUE = 'none';

const emptyForm: WorkOrderFormState = {
  title: '',
  description: '',
  clientId: UNSET_SELECT_VALUE,
  propertyId: UNSET_SELECT_VALUE,
  priority: 'medium',
};

const desktopLanes: LaneConfig[] = [
  { key: 'new', label: 'New', stages: ['new'], variant: 'pending' },
  { key: 'in_review', label: 'In Review', stages: ['in_review'], variant: 'pending' },
  { key: 'accepted', label: 'Accepted', stages: ['accepted'], variant: 'active' },
  { key: 'assigned', label: 'Assigned', stages: ['assigned'], variant: 'active' },
  { key: 'completed', label: 'Completed', stages: ['completed', 'rejected'], variant: 'complete' },
];

const mobileStages: Array<{ key: TaskWorkOrderFunnelStage; label: string }> = [
  { key: 'new', label: 'New' },
  { key: 'in_review', label: 'Review' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'completed', label: 'Done' },
  { key: 'rejected', label: 'Rejected' },
];

const stageLabels: Record<TaskWorkOrderFunnelStage, string> = {
  new: 'New',
  in_review: 'In Review',
  accepted: 'Accepted',
  rejected: 'Rejected',
  assigned: 'Assigned',
  completed: 'Completed',
};

const stageVariants: Record<TaskWorkOrderFunnelStage, BadgeVariant> = {
  new: 'pending',
  in_review: 'pending',
  accepted: 'active',
  rejected: 'warning',
  assigned: 'active',
  completed: 'complete',
};

const priorityVariants: Record<Priority, BadgeVariant> = {
  low: 'hold',
  medium: 'pending',
  high: 'warning',
};

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function findNameById<T extends { id: string; name: string }>(items: T[], id: string | null) {
  if (!id) return null;
  return items.find((item) => item.id === id)?.name ?? null;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function WorkOrderCard({
  workOrder,
  clients,
  properties,
}: {
  workOrder: TaskWorkOrder;
  clients: BillingClient[];
  properties: Property[];
}) {
  const clientName = findNameById(clients, workOrder.clientId);
  const propertyName = findNameById(properties, workOrder.propertyId);
  const dueDate = formatDate(workOrder.dueDate);
  const priority = (workOrder.priority === 'low' || workOrder.priority === 'high' ? workOrder.priority : 'medium') as Priority;

  return (
    <div className="space-y-3 rounded-lg border border-surface-border bg-surface-card p-3 shadow-sm transition-colors hover:border-brand-dim hover:bg-surface-hover">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-text-primary">{workOrder.title}</h3>
          {workOrder.description ? (
            <p className="line-clamp-2 text-xs leading-5 text-text-secondary">{workOrder.description}</p>
          ) : null}
        </div>
        <Badge variant={priorityVariants[priority]} className="shrink-0 capitalize">
          {priority}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant={stageVariants[workOrder.funnelStage]}>
          {stageLabels[workOrder.funnelStage]}
        </Badge>
        <Badge variant="hold" className="capitalize">
          {workOrder.source}
        </Badge>
      </div>

      <div className="space-y-1.5 text-xs text-text-secondary">
        {clientName ? (
          <div className="flex items-center gap-2">
            <UserRound className="h-3.5 w-3.5 text-text-muted" />
            <span className="truncate">{clientName}</span>
          </div>
        ) : null}
        {propertyName ? (
          <div className="flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 text-text-muted" />
            <span className="truncate">{propertyName}</span>
          </div>
        ) : null}
        {dueDate ? (
          <div className="flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5 text-text-muted" />
            <span>Due {dueDate}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LaneEmptyState({ label }: { label: string }) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center rounded-lg border border-dashed border-surface-border bg-surface-card/60 px-4 py-8 text-center">
      <Inbox className="mb-3 h-5 w-5 text-text-muted" />
      <p className="text-xs font-medium text-text-secondary">No {label.toLowerCase()} work orders</p>
    </div>
  );
}

function LoadingBoard() {
  return (
    <div className="grid gap-4 md:grid-cols-5">
      {Array.from({ length: 5 }).map((_, laneIndex) => (
        <div key={`work-order-lane-skeleton-${laneIndex}`} className="space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-24 bg-surface-elevated" />
            <Skeleton className="h-5 w-8 rounded-full bg-surface-elevated" />
          </div>
          <div className="space-y-2 rounded-lg border border-dashed border-surface-border bg-surface-elevated/40 p-2">
            {Array.from({ length: 3 }).map((__, cardIndex) => (
              <div key={`work-order-card-skeleton-${laneIndex}-${cardIndex}`} className="rounded-lg border border-surface-border bg-surface-card p-3">
                <Skeleton className="h-4 w-3/4 bg-surface-elevated" />
                <Skeleton className="mt-3 h-3 w-full bg-surface-elevated" />
                <Skeleton className="mt-2 h-3 w-2/3 bg-surface-elevated" />
                <div className="mt-4 flex gap-2">
                  <Skeleton className="h-5 w-16 rounded-full bg-surface-elevated" />
                  <Skeleton className="h-5 w-14 rounded-full bg-surface-elevated" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function WorkOrdersPage() {
  const { orgId, currentRole } = useOrgProfile();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<WorkOrderFormState>(emptyForm);
  const [mobileStage, setMobileStage] = useState<TaskWorkOrderFunnelStage>('new');
  const canManage = currentRole === 'admin' || currentRole === 'manager';
  const queryOrgId = canManage ? orgId ?? undefined : undefined;
  const createWorkOrderMutation = useCreateTaskWorkOrder();
  const workOrdersQuery = useTaskWorkOrders(queryOrgId);
  const clientsQuery = useClients(queryOrgId);
  const propertiesQuery = useProperties(queryOrgId);

  useEffect(() => {
    document.title = 'Work Orders - Ground Crew HQ';
  }, []);

  const workOrders = workOrdersQuery.data ?? [];
  const clients = clientsQuery.data ?? [];
  const properties = propertiesQuery.data ?? [];
  const firstLoad = (workOrdersQuery.isLoading || clientsQuery.isLoading || propertiesQuery.isLoading)
    && !workOrdersQuery.data
    && !clientsQuery.data
    && !propertiesQuery.data;
  const error = workOrdersQuery.error ?? clientsQuery.error ?? propertiesQuery.error;

  const workOrdersByStage = useMemo(() => {
    return workOrders.reduce<Record<TaskWorkOrderFunnelStage, TaskWorkOrder[]>>(
      (groups, workOrder) => {
        groups[workOrder.funnelStage].push(workOrder);
        return groups;
      },
      {
        new: [],
        in_review: [],
        accepted: [],
        rejected: [],
        assigned: [],
        completed: [],
      },
    );
  }, [workOrders]);

  const closeDialog = () => {
    setDialogOpen(false);
    setForm(emptyForm);
  };

  const submitWorkOrder = async () => {
    if (!orgId || createWorkOrderMutation.isPending) return;
    const title = form.title.trim();
    if (!title) {
      toast.error('Work order title is required');
      return;
    }

    const clientId = form.clientId === UNSET_SELECT_VALUE ? null : form.clientId;
    const propertyId = form.propertyId === UNSET_SELECT_VALUE ? null : form.propertyId;

    try {
      await createWorkOrderMutation.mutateAsync({
        orgId,
        title,
        description: form.description.trim() || null,
        clientId,
        propertyId,
        priority: form.priority,
        source: clientId ? 'client' : 'internal',
      });
      toast.success('Work order created');
      closeDialog();
      setMobileStage('new');
    } catch (createError) {
      toast.error(getErrorMessage(createError, 'Unable to create work order'));
    }
  };

  if (!canManage) {
    return (
      <div className="mx-auto max-w-4xl p-4 md:p-6">
        <div className="rounded-lg border border-surface-border bg-surface-card p-6">
          <p className="text-sm font-semibold text-text-primary">Supervisors only</p>
          <p className="mt-1 text-sm text-text-secondary">Work order intake is available to admins and managers.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
      <PageHeader compact title="Work Orders">
        <Button
          type="button"
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="bg-brand text-text-inverse hover:bg-brand/90"
        >
          <Plus className="h-4 w-4" />
          New Work Order
        </Button>
      </PageHeader>

      {error ? (
        <div className="rounded-lg border border-status-warning/30 bg-status-warning/10 p-4 text-sm text-status-warning">
          <p className="font-semibold">Unable to load work orders</p>
          <p className="mt-1 text-text-secondary">{getErrorMessage(error, 'Try again in a moment.')}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 border-surface-border text-text-primary"
            onClick={() => {
              void workOrdersQuery.refetch();
              void clientsQuery.refetch();
              void propertiesQuery.refetch();
            }}
          >
            Retry
          </Button>
        </div>
      ) : firstLoad ? (
        <LoadingBoard />
      ) : (
        <>
          <div className="hidden gap-4 md:grid md:grid-cols-5">
            {desktopLanes.map((lane) => {
              const laneOrders = lane.stages.flatMap((stage) => workOrdersByStage[stage]);
              return (
                <section key={lane.key} className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-sm font-medium text-text-primary">{lane.label}</span>
                    <Badge variant={lane.variant} className="flex h-5 min-w-5 items-center justify-center px-1.5 text-[10px]">
                      {laneOrders.length}
                    </Badge>
                  </div>
                  <div className="max-h-[calc(100vh-12rem)] min-h-52 space-y-2 overflow-y-auto rounded-lg border border-dashed border-surface-border bg-surface-elevated/40 p-2">
                    {laneOrders.length === 0 ? (
                      <LaneEmptyState label={lane.label} />
                    ) : (
                      laneOrders.map((workOrder) => (
                        <WorkOrderCard
                          key={workOrder.id}
                          workOrder={workOrder}
                          clients={clients}
                          properties={properties}
                        />
                      ))
                    )}
                  </div>
                </section>
              );
            })}
          </div>

          <div className="space-y-3 md:hidden">
            <Tabs value={mobileStage} onValueChange={(value) => setMobileStage(value as TaskWorkOrderFunnelStage)}>
              <TabsList className="grid h-auto w-full grid-cols-3 gap-1 bg-surface-elevated p-1 text-text-secondary">
                {mobileStages.map((stage) => (
                  <TabsTrigger
                    key={stage.key}
                    value={stage.key}
                    className="data-[state=active]:bg-surface-card data-[state=active]:text-text-primary"
                  >
                    {stage.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className="space-y-2">
              {workOrdersByStage[mobileStage].length === 0 ? (
                <LaneEmptyState label={stageLabels[mobileStage]} />
              ) : (
                workOrdersByStage[mobileStage].map((workOrder) => (
                  <WorkOrderCard
                    key={workOrder.id}
                    workOrder={workOrder}
                    clients={clients}
                    properties={properties}
                  />
                ))
              )}
            </div>
          </div>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}>
        <DialogContent className="border-surface-border bg-surface-card text-text-primary sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>New Work Order</DialogTitle>
            <DialogDescription>
              Capture client or internal task requests for supervisor review.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="work-order-title">Title</Label>
              <Input
                id="work-order-title"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Mow approach rough"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="work-order-description">Description</Label>
              <Textarea
                id="work-order-description"
                rows={4}
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Add details the supervisor should see before accepting the work."
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Client</Label>
                <Select value={form.clientId} onValueChange={(value) => setForm((current) => ({ ...current, clientId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Optional client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNSET_SELECT_VALUE}>No client</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Property</Label>
                <Select value={form.propertyId} onValueChange={(value) => setForm((current) => ({ ...current, propertyId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Optional property" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNSET_SELECT_VALUE}>No property</SelectItem>
                    {properties.map((property) => (
                      <SelectItem key={property.id} value={property.id}>
                        {property.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(value) => setForm((current) => ({ ...current, priority: value as Priority }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog} disabled={createWorkOrderMutation.isPending}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void submitWorkOrder()}
              disabled={createWorkOrderMutation.isPending || !form.title.trim() || !orgId}
              className="bg-brand text-text-inverse hover:bg-brand/90"
            >
              {createWorkOrderMutation.isPending ? 'Creating' : 'Create Work Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
