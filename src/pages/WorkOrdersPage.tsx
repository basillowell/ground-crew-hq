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
  useAssignTaskWorkOrder,
  useBeginReviewTaskWorkOrder,
  useClients,
  useCompleteTaskWorkOrder,
  useCreateTaskWorkOrder,
  useEmployees,
  useProperties,
  useReviewTaskWorkOrder,
  useReturnTaskWorkOrder,
  useTaskWorkOrders,
} from '@/lib/supabase-queries';
import type { Employee, Property } from '@/data/seedData';

type BadgeVariant = 'active' | 'pending' | 'warning' | 'complete' | 'hold';
type Priority = 'low' | 'medium' | 'high';

type WorkOrderFormState = {
  title: string;
  description: string;
  clientId: string;
  propertyId: string;
  priority: Priority;
};

type AssignFormState = {
  employeeId: string;
  date: string;
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

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

const emptyAssignForm = (): AssignFormState => ({
  employeeId: UNSET_SELECT_VALUE,
  date: todayKey(),
});

const desktopLanes: LaneConfig[] = [
  { key: 'new', label: 'New', stages: ['new'], variant: 'pending' },
  { key: 'in_review', label: 'In Review', stages: ['in_review'], variant: 'pending' },
  { key: 'accepted', label: 'Accepted', stages: ['accepted'], variant: 'active' },
  { key: 'assigned', label: 'Assigned', stages: ['assigned'], variant: 'active' },
  { key: 'pending_verification', label: 'Pending Verification', stages: ['pending_verification'], variant: 'pending' },
  { key: 'completed', label: 'Completed', stages: ['completed', 'rejected'], variant: 'complete' },
];

const mobileStages: Array<{ key: TaskWorkOrderFunnelStage; label: string }> = [
  { key: 'new', label: 'New' },
  { key: 'in_review', label: 'Review' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'pending_verification', label: 'Pending Verification' },
  { key: 'completed', label: 'Done' },
  { key: 'rejected', label: 'Rejected' },
];

const stageLabels: Record<TaskWorkOrderFunnelStage, string> = {
  new: 'New',
  in_review: 'In Review',
  accepted: 'Accepted',
  rejected: 'Rejected',
  assigned: 'Assigned',
  pending_verification: 'Pending Verification',
  completed: 'Completed',
};

const stageVariants: Record<TaskWorkOrderFunnelStage, BadgeVariant> = {
  new: 'pending',
  in_review: 'pending',
  accepted: 'active',
  rejected: 'warning',
  assigned: 'active',
  pending_verification: 'pending',
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

function employeeName(employee: Employee) {
  return `${employee.firstName} ${employee.lastName}`.trim() || employee.email || 'Unnamed employee';
}

function WorkOrderCard({
  workOrder,
  clients,
  properties,
  onBeginReview,
  onAccept,
  onOpenReject,
  onOpenAssign,
  onComplete,
  onOpenReturn,
  pendingAction,
}: {
  workOrder: TaskWorkOrder;
  clients: BillingClient[];
  properties: Property[];
  onBeginReview: (workOrder: TaskWorkOrder) => void;
  onAccept: (workOrder: TaskWorkOrder) => void;
  onOpenReject: (workOrder: TaskWorkOrder) => void;
  onOpenAssign: (workOrder: TaskWorkOrder) => void;
  onComplete: (workOrder: TaskWorkOrder) => void;
  onOpenReturn: (workOrder: TaskWorkOrder) => void;
  pendingAction: string | null;
}) {
  const clientName = findNameById(clients, workOrder.clientId);
  const propertyName = findNameById(properties, workOrder.propertyId);
  const dueDate = formatDate(workOrder.dueDate);
  const priority = (workOrder.priority === 'low' || workOrder.priority === 'high' ? workOrder.priority : 'medium') as Priority;
  const isPending = pendingAction?.endsWith(`:${workOrder.id}`) ?? false;

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

      {workOrder.funnelStage === 'rejected' && workOrder.rejectedReason ? (
        <div className="rounded-lg border border-status-warning/25 bg-status-warning/10 p-2 text-xs text-text-secondary">
          <span className="font-medium text-status-warning">Rejected:</span> {workOrder.rejectedReason}
        </div>
      ) : null}

      {workOrder.punchList ? (
        <div className="rounded-lg border border-status-warning/25 bg-status-warning/10 p-2 text-xs leading-5 text-text-secondary">
          <p className="font-medium text-status-warning">Punch list</p>
          <p className="mt-1 whitespace-pre-line">{workOrder.punchList}</p>
        </div>
      ) : null}

      {workOrder.funnelStage === 'new' ? (
        <Button
          type="button"
          size="sm"
          className="w-full"
          disabled={isPending}
          onClick={() => onBeginReview(workOrder)}
        >
          {isPending ? 'Starting review' : 'Begin review'}
        </Button>
      ) : null}

      {workOrder.funnelStage === 'in_review' ? (
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            size="sm"
            disabled={isPending}
            onClick={() => onAccept(workOrder)}
          >
            {isPending ? 'Accepting' : 'Accept'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => onOpenReject(workOrder)}
          >
            Reject
          </Button>
        </div>
      ) : null}

      {workOrder.funnelStage === 'accepted' ? (
        <Button
          type="button"
          size="sm"
          className="w-full"
          disabled={isPending}
          onClick={() => onOpenAssign(workOrder)}
        >
          Assign
        </Button>
      ) : null}

      {workOrder.funnelStage === 'assigned' ? (
        <p className="rounded-lg border border-surface-border bg-surface-elevated/50 px-3 py-2 text-xs text-text-muted">
          Awaiting field completion
        </p>
      ) : null}

      {workOrder.funnelStage === 'pending_verification' ? (
        <div className="grid gap-2">
          <Button
            type="button"
            size="sm"
            className="w-full"
            disabled={isPending}
            onClick={() => onComplete(workOrder)}
          >
            {pendingAction === `complete:${workOrder.id}` ? 'Verifying' : 'Verify complete'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            disabled={isPending}
            onClick={() => onOpenReturn(workOrder)}
          >
            Return with punch list
          </Button>
        </div>
      ) : null}
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
    <div className="grid gap-4 md:grid-cols-6">
      {Array.from({ length: 6 }).map((_, laneIndex) => (
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
  const { orgId, currentRole, currentUser } = useOrgProfile();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<WorkOrderFormState>(emptyForm);
  const [mobileStage, setMobileStage] = useState<TaskWorkOrderFunnelStage>('new');
  const [rejectDialogWorkOrder, setRejectDialogWorkOrder] = useState<TaskWorkOrder | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [returnDialogWorkOrder, setReturnDialogWorkOrder] = useState<TaskWorkOrder | null>(null);
  const [punchList, setPunchList] = useState('');
  const [assignDialogWorkOrder, setAssignDialogWorkOrder] = useState<TaskWorkOrder | null>(null);
  const [assignForm, setAssignForm] = useState<AssignFormState>(() => emptyAssignForm());
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const canManage = currentRole === 'admin' || currentRole === 'manager';
  const queryOrgId = canManage ? orgId ?? undefined : undefined;
  const createWorkOrderMutation = useCreateTaskWorkOrder();
  const beginReviewMutation = useBeginReviewTaskWorkOrder();
  const reviewMutation = useReviewTaskWorkOrder();
  const assignMutation = useAssignTaskWorkOrder();
  const completeMutation = useCompleteTaskWorkOrder();
  const returnMutation = useReturnTaskWorkOrder();
  const workOrdersQuery = useTaskWorkOrders(queryOrgId);
  const clientsQuery = useClients(queryOrgId);
  const employeesQuery = useEmployees(undefined, queryOrgId);
  const propertiesQuery = useProperties(queryOrgId);

  useEffect(() => {
    document.title = 'Work Orders - Ground Crew HQ';
  }, []);

  const workOrders = workOrdersQuery.data ?? [];
  const clients = clientsQuery.data ?? [];
  const employees = employeesQuery.data ?? [];
  const properties = propertiesQuery.data ?? [];
  const firstLoad = (workOrdersQuery.isLoading || clientsQuery.isLoading || employeesQuery.isLoading || propertiesQuery.isLoading)
    && !workOrdersQuery.data
    && !clientsQuery.data
    && !employeesQuery.data
    && !propertiesQuery.data;
  const error = workOrdersQuery.error ?? clientsQuery.error ?? employeesQuery.error ?? propertiesQuery.error;

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
        pending_verification: [],
        completed: [],
      },
    );
  }, [workOrders]);

  const closeDialog = () => {
    setDialogOpen(false);
    setForm(emptyForm);
  };

  const reviewerId = currentUser?.id ?? '';

  const requireReviewer = () => {
    if (!reviewerId) {
      toast.error('Cannot identify your user profile for review.');
      return null;
    }
    return reviewerId;
  };

  const beginReview = async (workOrder: TaskWorkOrder) => {
    const reviewedBy = requireReviewer();
    if (!reviewedBy) return;
    setPendingAction(`begin:${workOrder.id}`);
    try {
      await beginReviewMutation.mutateAsync({ id: workOrder.id, reviewedBy });
      toast.success('Review started');
    } catch (beginError) {
      toast.error(getErrorMessage(beginError, 'Unable to begin review'));
    } finally {
      setPendingAction(null);
    }
  };

  const acceptWorkOrder = async (workOrder: TaskWorkOrder) => {
    const reviewedBy = requireReviewer();
    if (!reviewedBy) return;
    setPendingAction(`accept:${workOrder.id}`);
    try {
      await reviewMutation.mutateAsync({ id: workOrder.id, decision: 'accept', reviewedBy });
      toast.success('Work order accepted');
    } catch (acceptError) {
      toast.error(getErrorMessage(acceptError, 'Unable to accept work order'));
    } finally {
      setPendingAction(null);
    }
  };

  const openRejectDialog = (workOrder: TaskWorkOrder) => {
    setRejectDialogWorkOrder(workOrder);
    setRejectReason('');
  };

  const closeRejectDialog = () => {
    setRejectDialogWorkOrder(null);
    setRejectReason('');
  };

  const rejectWorkOrder = async () => {
    if (!rejectDialogWorkOrder) return;
    const reviewedBy = requireReviewer();
    if (!reviewedBy) return;
    setPendingAction(`reject:${rejectDialogWorkOrder.id}`);
    try {
      await reviewMutation.mutateAsync({
        id: rejectDialogWorkOrder.id,
        decision: 'reject',
        reviewedBy,
        rejectedReason: rejectReason.trim() || null,
      });
      toast.success('Work order rejected');
      closeRejectDialog();
    } catch (rejectError) {
      toast.error(getErrorMessage(rejectError, 'Unable to reject work order'));
    } finally {
      setPendingAction(null);
    }
  };

  const openReturnDialog = (workOrder: TaskWorkOrder) => {
    setReturnDialogWorkOrder(workOrder);
    setPunchList(workOrder.punchList ?? '');
  };

  const closeReturnDialog = () => {
    setReturnDialogWorkOrder(null);
    setPunchList('');
  };

  const returnWorkOrder = async () => {
    if (!returnDialogWorkOrder) return;
    const trimmedPunchList = punchList.trim();
    if (!trimmedPunchList) {
      toast.error('Punch list is required.');
      return;
    }
    setPendingAction(`return:${returnDialogWorkOrder.id}`);
    try {
      await returnMutation.mutateAsync({
        id: returnDialogWorkOrder.id,
        punchList: trimmedPunchList,
      });
      toast.success('Work order returned for rework');
      closeReturnDialog();
    } catch (returnError) {
      toast.error(getErrorMessage(returnError, 'Unable to return work order'));
    } finally {
      setPendingAction(null);
    }
  };

  const openAssignDialog = (workOrder: TaskWorkOrder) => {
    setAssignDialogWorkOrder(workOrder);
    setAssignForm(emptyAssignForm());
  };

  const closeAssignDialog = () => {
    setAssignDialogWorkOrder(null);
    setAssignForm(emptyAssignForm());
  };

  const assignableEmployees = useMemo(() => {
    if (!assignDialogWorkOrder?.propertyId) return employees;
    return employees.filter((employee) => employee.propertyId === assignDialogWorkOrder.propertyId);
  }, [assignDialogWorkOrder?.propertyId, employees]);

  const assignWorkOrder = async () => {
    if (!assignDialogWorkOrder) return;
    if (assignForm.employeeId === UNSET_SELECT_VALUE) {
      toast.error('Select an employee.');
      return;
    }
    if (!assignForm.date) {
      toast.error('Choose an assignment date.');
      return;
    }
    setPendingAction(`assign:${assignDialogWorkOrder.id}`);
    try {
      await assignMutation.mutateAsync({
        workOrder: assignDialogWorkOrder,
        employeeId: assignForm.employeeId,
        date: assignForm.date,
      });
      toast.success('Work order assigned');
      closeAssignDialog();
    } catch (assignError) {
      toast.error(getErrorMessage(assignError, 'Unable to assign work order'));
    } finally {
      setPendingAction(null);
    }
  };

  const completeWorkOrder = async (workOrder: TaskWorkOrder) => {
    setPendingAction(`complete:${workOrder.id}`);
    try {
      await completeMutation.mutateAsync({ id: workOrder.id });
      toast.success('Work order completed');
    } catch (completeError) {
      toast.error(getErrorMessage(completeError, 'Unable to complete work order'));
    } finally {
      setPendingAction(null);
    }
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
              void employeesQuery.refetch();
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
          <div className="hidden gap-4 md:grid md:grid-cols-6">
            {desktopLanes.map((lane) => {
              const laneOrders = lane.stages.flatMap((stage) => workOrdersByStage[stage]);
              return (
                <section key={lane.key} className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-sm font-medium text-text-primary">{lane.label}</span>
                    <Badge variant={lane.variant} className="flex h-5 min-w-5 items-center justify-center px-1.5 text-3xs">
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
                          onBeginReview={(targetWorkOrder) => void beginReview(targetWorkOrder)}
                          onAccept={(targetWorkOrder) => void acceptWorkOrder(targetWorkOrder)}
                          onOpenReject={openRejectDialog}
                          onOpenAssign={openAssignDialog}
                          onComplete={(targetWorkOrder) => void completeWorkOrder(targetWorkOrder)}
                          onOpenReturn={openReturnDialog}
                          pendingAction={pendingAction}
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
                    onBeginReview={(targetWorkOrder) => void beginReview(targetWorkOrder)}
                    onAccept={(targetWorkOrder) => void acceptWorkOrder(targetWorkOrder)}
                    onOpenReject={openRejectDialog}
                    onOpenAssign={openAssignDialog}
                    onComplete={(targetWorkOrder) => void completeWorkOrder(targetWorkOrder)}
                    onOpenReturn={openReturnDialog}
                    pendingAction={pendingAction}
                  />
                ))
              )}
            </div>
          </div>
        </>
      )}

      <Dialog open={Boolean(rejectDialogWorkOrder)} onOpenChange={(open) => (open ? undefined : closeRejectDialog())}>
        <DialogContent className="border-surface-border bg-surface-card text-text-primary sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reject Work Order</DialogTitle>
            <DialogDescription>
              Add a reason if it will help the requester understand the decision.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="work-order-reject-reason">Reason</Label>
            <Textarea
              id="work-order-reject-reason"
              rows={4}
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="Optional reason"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeRejectDialog} disabled={reviewMutation.isPending}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void rejectWorkOrder()}
              disabled={reviewMutation.isPending}
            >
              {reviewMutation.isPending ? 'Rejecting' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(returnDialogWorkOrder)} onOpenChange={(open) => (open ? undefined : closeReturnDialog())}>
        <DialogContent className="border-surface-border bg-surface-card text-text-primary sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Return with punch list</DialogTitle>
            <DialogDescription>
              Tell the crew what needs correcting before this work order can be verified.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="work-order-punch-list">What needs correcting?</Label>
            <Textarea
              id="work-order-punch-list"
              rows={5}
              value={punchList}
              onChange={(event) => setPunchList(event.target.value)}
              placeholder="List the corrections needed before this is complete."
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeReturnDialog} disabled={returnMutation.isPending}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void returnWorkOrder()}
              disabled={returnMutation.isPending || !punchList.trim()}
            >
              {returnMutation.isPending ? 'Returning' : 'Return for rework'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(assignDialogWorkOrder)} onOpenChange={(open) => (open ? undefined : closeAssignDialog())}>
        <DialogContent className="border-surface-border bg-surface-card text-text-primary sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Work Order</DialogTitle>
            <DialogDescription>
              Choose the crew member and date for the planned assignment.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Employee</Label>
              <Select
                value={assignForm.employeeId}
                onValueChange={(value) => setAssignForm((current) => ({ ...current, employeeId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET_SELECT_VALUE}>Select employee</SelectItem>
                  {assignableEmployees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employeeName(employee)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {assignableEmployees.length === 0 ? (
                <p className="text-xs text-text-secondary">
                  No active employees are available for this work order&apos;s property.
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="work-order-assign-date">Date</Label>
              <Input
                id="work-order-assign-date"
                type="date"
                value={assignForm.date}
                onChange={(event) => setAssignForm((current) => ({ ...current, date: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeAssignDialog} disabled={assignMutation.isPending}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void assignWorkOrder()}
              disabled={assignMutation.isPending || assignForm.employeeId === UNSET_SELECT_VALUE || !assignForm.date}
            >
              {assignMutation.isPending ? 'Assigning' : 'Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
