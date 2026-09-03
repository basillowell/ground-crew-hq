import { CalendarDays, Camera, CheckCircle2, FileCheck2, PenLine, UserRound } from 'lucide-react';
import type { Assignment, Employee, Property } from '@/data/seedData';
import {
  type AssignmentSignature,
  type TaskWorkOrder,
  useAssignmentSignaturesForAssignments,
  useTaskWorkOrderAssignments,
} from '@/lib/supabase-queries';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

type BadgeVariant = 'active' | 'pending' | 'warning' | 'complete' | 'hold';

type TaskWorkOrderProofDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId?: string | null;
  workOrder: TaskWorkOrder | null;
  properties: Property[];
  employees: Employee[];
};

const stageVariants: Record<TaskWorkOrder['funnelStage'], BadgeVariant> = {
  new: 'pending',
  in_review: 'pending',
  accepted: 'active',
  rejected: 'warning',
  assigned: 'active',
  pending_verification: 'pending',
  completed: 'complete',
};

function titleCase(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not recorded';
  return new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Not recorded';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not recorded';
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatHours(value: number | null | undefined) {
  return `${Number(value ?? 0).toFixed(2)}h`;
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

function groupSignaturesByAssignment(signatures: AssignmentSignature[]) {
  return signatures.reduce<Record<string, AssignmentSignature[]>>((groups, signature) => {
    groups[signature.assignmentId] = [...(groups[signature.assignmentId] ?? []), signature];
    return groups;
  }, {});
}

export function TaskWorkOrderProofDialog({
  open,
  onOpenChange,
  orgId,
  workOrder,
  properties,
  employees,
}: TaskWorkOrderProofDialogProps) {
  const workOrderId = workOrder?.id ? [workOrder.id] : [];
  const assignmentsQuery = useTaskWorkOrderAssignments(orgId ?? undefined, workOrderId);
  const assignments = assignmentsQuery.data ?? [];
  const assignmentIds = assignments.map((assignment) => assignment.id).filter((id): id is string => Boolean(id));
  const signaturesQuery = useAssignmentSignaturesForAssignments(orgId ?? undefined, assignmentIds);
  const signatures = signaturesQuery.data ?? [];
  const property = properties.find((item) => item.id === workOrder?.propertyId);
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
  const signaturesByAssignment = groupSignaturesByAssignment(signatures);
  const isLoading = Boolean(workOrder && assignmentsQuery.isLoading && !assignmentsQuery.data);
  const signaturesLoading = Boolean(assignmentIds.length > 0 && signaturesQuery.isLoading && !signaturesQuery.data);
  const error = assignmentsQuery.error ?? signaturesQuery.error;
  const fieldCompletedAt = latestAssignmentCompletion(assignments);
  const totalHours = assignments.reduce((sum, assignment) => sum + Number(assignment.actualHours ?? assignment.actual_hours ?? 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-surface-border bg-surface-card text-text-primary sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Proof package</DialogTitle>
          <DialogDescription>
            Delivered work, crew time, verification details, and assignment signatures for this work order.
          </DialogDescription>
        </DialogHeader>

        {!workOrder ? (
          <div className="rounded-lg border border-surface-border bg-surface-elevated p-4 text-sm text-text-secondary">
            Select a work order to review proof.
          </div>
        ) : (
          <div className="space-y-4">
            <section className="rounded-lg border border-surface-border bg-surface-elevated p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-text-primary">{workOrder.title}</h3>
                  {workOrder.description ? (
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">{workOrder.description}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={stageVariants[workOrder.funnelStage]}>{titleCase(workOrder.funnelStage)}</Badge>
                  <Badge variant="hold" className="capitalize">{workOrder.source}</Badge>
                </div>
              </div>
              <div className="mt-4 grid gap-3 text-sm text-text-secondary sm:grid-cols-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-widest text-text-muted">Property</p>
                  <p className="mt-1 text-text-primary">{property?.name ?? 'Property not set'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-widest text-text-muted">Field completed</p>
                  <p className="mt-1 text-text-primary">{formatDateTime(fieldCompletedAt)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-widest text-text-muted">Verified</p>
                  <p className="mt-1 text-text-primary">{formatDateTime(workOrder.completedAt)}</p>
                </div>
              </div>
            </section>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-surface-border bg-surface-elevated p-3">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-text-muted">
                  <FileCheck2 className="h-3.5 w-3.5" />
                  Assignments
                </div>
                <p className="mt-2 text-xl font-semibold text-text-primary">{assignments.length}</p>
              </div>
              <div className="rounded-lg border border-surface-border bg-surface-elevated p-3">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-text-muted">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Crew Hours
                </div>
                <p className="mt-2 text-xl font-semibold text-text-primary">{formatHours(totalHours)}</p>
              </div>
              <div className="rounded-lg border border-surface-border bg-surface-elevated p-3">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-text-muted">
                  <PenLine className="h-3.5 w-3.5" />
                  Signatures
                </div>
                <p className="mt-2 text-xl font-semibold text-text-primary">{signatures.length}</p>
              </div>
            </div>

            {workOrder.punchList ? (
              <section className="rounded-lg border border-status-warning/25 bg-status-warning/10 p-3 text-sm text-text-secondary">
                <p className="font-medium text-status-warning">Punch list</p>
                <p className="mt-1 whitespace-pre-line">{workOrder.punchList}</p>
              </section>
            ) : null}

            <section className="rounded-lg border border-surface-border bg-surface-elevated p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-text-primary">Delivery record</h4>
                {isLoading ? <Badge variant="pending">Loading</Badge> : null}
              </div>
              {error ? (
                <p className="rounded-lg border border-status-warning/30 bg-status-warning/10 p-3 text-sm text-status-warning">
                  Delivery proof could not load.
                </p>
              ) : isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full bg-surface-card" />
                  <Skeleton className="h-16 w-full bg-surface-card" />
                </div>
              ) : assignments.length === 0 ? (
                <p className="rounded-lg border border-dashed border-surface-border bg-surface-card/60 p-4 text-sm text-text-secondary">
                  No linked assignments were found for this work order yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {assignments.map((assignment) => {
                    const assignmentSignatures = assignment.id ? signaturesByAssignment[assignment.id] ?? [] : [];
                    return (
                      <div key={assignment.id} className="rounded-lg border border-surface-border bg-surface-card p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-text-primary">{assignment.title || workOrder.title}</p>
                            <p className="mt-1 text-xs text-text-secondary">
                              {employeeName(employeeById.get(assignment.employeeId))} · {formatDate(assignment.date)}
                            </p>
                          </div>
                          <Badge variant={assignmentSignatures.length > 0 ? 'complete' : 'hold'}>
                            {assignmentSignatures.length > 0 ? `${assignmentSignatures.length} signature${assignmentSignatures.length === 1 ? '' : 's'}` : 'No signature'}
                          </Badge>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs text-text-secondary sm:grid-cols-4">
                          <span>Start {formatDateTime(assignment.actualStartAt ?? assignment.actual_start_at)}</span>
                          <span>End {formatDateTime(assignmentCompletionDate(assignment))}</span>
                          <span>Hours {formatHours(assignment.actualHours ?? assignment.actual_hours)}</span>
                          <span>Status {assignment.status ?? 'planned'}</span>
                        </div>
                        {assignmentSignatures.length > 0 ? (
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {assignmentSignatures.map((signature) => (
                              <div key={signature.id} className="rounded-lg border border-surface-border bg-surface-base p-2">
                                <div className="mb-2 flex items-center gap-2 text-xs text-text-secondary">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-status-complete" />
                                  <span>{signature.signerName} · {formatDateTime(signature.signedAt)}</span>
                                </div>
                                <img
                                  src={signature.signatureData}
                                  alt={`Signature from ${signature.signerName}`}
                                  className="h-20 w-full object-contain"
                                  loading="lazy"
                                />
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-lg border border-surface-border bg-surface-elevated p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-card">
                  <Camera className="h-5 w-5 text-text-muted" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-text-primary">Photos</h4>
                  <p className="mt-1 text-sm text-text-secondary">
                    Photos are project-level today and are not linked to this work order.
                  </p>
                </div>
              </div>
            </section>

            {signaturesLoading ? (
              <p className="text-xs text-text-muted">Loading signatures...</p>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
