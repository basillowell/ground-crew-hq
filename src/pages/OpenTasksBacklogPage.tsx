import { Fragment, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronDown, Loader2, RefreshCw, UsersRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from '@/components/ui/sonner';
import { EmptyState } from '@/components/EmptyState';
import { ErrorRetry } from '@/components/ErrorRetry';
import { PropertySelector } from '@/components/shared/PropertySelector';
import { TableSkeleton } from '@/components/TableSkeleton';
import { OpenTaskDayReviewPanel, approveReviewedDay } from '@/components/workboard/OpenTaskDayReviewPanel';
import { useOrgProfile } from '@/hooks/useOrgProfile';
import { usePagePropertySelection } from '@/hooks/usePagePropertySelection';
import {
  CLOSED_ASSIGNMENT_STATUSES,
  useEmployees,
  useOpenAssignmentsBacklog,
  useProperties,
  useTasks,
} from '@/lib/supabase-queries';
import { cn } from '@/lib/utils';
import type { Assignment } from '@/data/mockData';

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDisplayDate(dateKey: string) {
  const value = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(value.getTime())) return dateKey;
  return value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysBetween(startDateKey: string, endDateKey: string) {
  const start = new Date(`${startDateKey}T00:00:00`);
  const end = new Date(`${endDateKey}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86_400_000));
}

function employeeName(employee?: { firstName?: string | null; lastName?: string | null }) {
  if (!employee) return 'Unknown Employee';
  return `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim() || 'Unnamed Employee';
}

function normalizeStatusLabel(status?: string | null) {
  const value = String(status ?? 'planned').replace(/_/g, ' ').replace(/-/g, ' ').trim();
  return value ? value.replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Planned';
}

function makeReviewKey(employeeId: string, date: string) {
  return employeeId + '|' + date;
}

type BacklogAssignment = Assignment & {
  overdueDays: number;
  taskName: string;
  taskCategory: string;
};

type EnrichedBacklogAssignment = BacklogAssignment & {
  employeeName: string;
  propertyName: string;
};

type EmployeeBacklogGroup = {
  employeeId: string;
  employeeName: string;
  assignments: EnrichedBacklogAssignment[];
};

type PropertyBacklogGroup = {
  propertyId: string;
  propertyName: string;
  assignmentCount: number;
  oldestDate: string;
  employees: EmployeeBacklogGroup[];
};

type DateBacklogGroup = {
  date: string;
  assignments: EnrichedBacklogAssignment[];
};

type ReviewOrderItem = {
  key: string;
  employeeId: string;
  date: string;
};

function getAssignmentActualHours(assignment: Assignment) {
  const assignmentRecord = assignment as Assignment & Record<string, unknown>;
  const actualHours = Number(assignment.actualHours ?? assignmentRecord.actual_hours ?? 0);
  return Number.isFinite(actualHours) ? actualHours : 0;
}

function getAssignmentEstimatedHours(assignment: Assignment) {
  const assignmentRecord = assignment as Assignment & Record<string, unknown>;
  const estimatedHours = Number(assignment.estimatedHours ?? assignmentRecord.estimated_hours ?? 0);
  return Number.isFinite(estimatedHours) ? estimatedHours : 0;
}

function isQuickApproveEligible(assignments: EnrichedBacklogAssignment[]) {
  return assignments.length > 0 && assignments.every((assignment) => getAssignmentActualHours(assignment) === getAssignmentEstimatedHours(assignment));
}

function getAssignmentIds(assignments: EnrichedBacklogAssignment[]) {
  return assignments.map((assignment) => assignment.id).filter((id): id is string => Boolean(id));
}

function statusBadgeClass(status?: string | null) {
  const normalized = String(status ?? '').toLowerCase();
  if (normalized === 'in_progress' || normalized === 'in-progress' || normalized === 'started' || normalized === 'active') {
    return 'border-sky-400/30 bg-sky-400/10 text-sky-300';
  }
  return 'border-amber-400/30 bg-amber-400/10 text-amber-300';
}

export default function OpenTasksBacklogPage() {
  const { currentUser, orgId, userRole } = useOrgProfile();
  const role = String(userRole ?? currentUser?.role ?? '').toLowerCase();
  const canViewBacklog = role === 'admin' || role === 'manager';
  const queryOrgId = canViewBacklog ? orgId ?? undefined : undefined;
  const queryClient = useQueryClient();
  const { data: properties = [], isLoading: propertiesLoading } = useProperties(queryOrgId);
  const [selectedPropertyId, setSelectedPropertyId] = usePagePropertySelection({
    currentUser,
    properties,
  });
  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const backlogQuery = useOpenAssignmentsBacklog(todayKey, selectedPropertyId, queryOrgId);
  const employeesQuery = useEmployees(undefined, queryOrgId, 'all');
  const tasksQuery = useTasks(undefined, queryOrgId);
  const [expandedReviewKeys, setExpandedReviewKeys] = useState<Set<string>>(() => new Set());
  const [groupBy, setGroupBy] = useState<'employee' | 'date'>('employee');
  const [quickApprovingKey, setQuickApprovingKey] = useState<string | null>(null);

  const enrichedAssignments = useMemo<EnrichedBacklogAssignment[]>(() => {
    const propertyById = new Map(properties.map((property) => [property.id, property]));
    const employeeById = new Map((employeesQuery.data ?? []).map((employee) => [employee.id, employee]));
    const taskById = new Map((tasksQuery.data ?? []).map((task) => [task.id, task]));

    return (backlogQuery.data ?? []).map((assignment) => {
      const propertyId = assignment.propertyId ?? 'unknown-property';
      const employeeId = assignment.employeeId || 'unknown-employee';
      const employee = employeeById.get(employeeId);
      const task = taskById.get(assignment.taskId);
      const property = propertyById.get(propertyId);

      return {
        ...assignment,
        overdueDays: daysBetween(assignment.date, todayKey),
        taskName: assignment.title?.trim() || task?.name || 'Untitled Task',
        taskCategory: task?.category || 'General',
        employeeName: employeeName(employee),
        propertyName: property?.name ?? 'Unknown Property',
      };
    });
  }, [backlogQuery.data, employeesQuery.data, properties, tasksQuery.data, todayKey]);

  const groups = useMemo<PropertyBacklogGroup[]>(() => {
    const byProperty = new Map<string, Map<string, EmployeeBacklogGroup>>();

    enrichedAssignments.forEach((assignment) => {
      const propertyId = assignment.propertyId ?? 'unknown-property';
      const employeeId = assignment.employeeId || 'unknown-employee';
      const propertyGroup = byProperty.get(propertyId) ?? new Map<string, EmployeeBacklogGroup>();
      const employeeGroup = propertyGroup.get(employeeId) ?? {
        employeeId,
        employeeName: assignment.employeeName,
        assignments: [],
      };

      employeeGroup.assignments.push(assignment);
      propertyGroup.set(employeeId, employeeGroup);
      byProperty.set(propertyId, propertyGroup);
    });

    return Array.from(byProperty.entries())
      .map(([propertyId, employees]) => {
        const employeeGroups = Array.from(employees.values())
          .map((group) => ({
            ...group,
            assignments: group.assignments.sort((first, second) => first.date.localeCompare(second.date)),
          }))
          .sort((first, second) => {
            const firstDate = first.assignments[0]?.date ?? '';
            const secondDate = second.assignments[0]?.date ?? '';
            return firstDate.localeCompare(secondDate) || first.employeeName.localeCompare(second.employeeName);
          });
        const assignments = employeeGroups.flatMap((group) => group.assignments);
        const oldestDate = assignments[0]?.date ?? todayKey;
        return {
          propertyId,
          propertyName: assignments[0]?.propertyName ?? 'Unknown Property',
          assignmentCount: assignments.length,
          oldestDate,
          employees: employeeGroups,
        };
      })
      .sort((first, second) => first.oldestDate.localeCompare(second.oldestDate) || first.propertyName.localeCompare(second.propertyName));
  }, [enrichedAssignments, todayKey]);

  const dateGroups = useMemo<DateBacklogGroup[]>(() => {
    const byDate = new Map<string, EnrichedBacklogAssignment[]>();

    enrichedAssignments.forEach((assignment) => {
      const assignments = byDate.get(assignment.date) ?? [];
      assignments.push(assignment);
      byDate.set(assignment.date, assignments);
    });

    return Array.from(byDate.entries())
      .map(([date, assignments]) => ({
        date,
        assignments: assignments.sort(
          (first, second) =>
            first.employeeName.localeCompare(second.employeeName) ||
            first.propertyName.localeCompare(second.propertyName) ||
            first.taskName.localeCompare(second.taskName),
        ),
      }))
      .sort((first, second) => first.date.localeCompare(second.date));
  }, [enrichedAssignments]);

  const reviewOrder = useMemo<ReviewOrderItem[]>(() => {
    const seen = new Set<string>();
    const items: ReviewOrderItem[] = [];
    const addItem = (employeeId: string, date: string) => {
      if (!employeeId || employeeId === 'unknown-employee' || !date) return;
      const key = makeReviewKey(employeeId, date);
      if (seen.has(key)) return;
      seen.add(key);
      items.push({ key, employeeId, date });
    };

    if (groupBy === 'employee') {
      groups.forEach((propertyGroup) => {
        propertyGroup.employees.forEach((employeeGroup) => {
          employeeGroup.assignments.forEach((assignment) => addItem(employeeGroup.employeeId, assignment.date));
        });
      });
      return items;
    }

    dateGroups.forEach((dateGroup) => {
      dateGroup.assignments.forEach((assignment) => addItem(assignment.employeeId || 'unknown-employee', assignment.date));
    });
    return items;
  }, [dateGroups, groupBy, groups]);

  const totals = useMemo(() => {
    const assignments = enrichedAssignments;
    return {
      assignments: assignments.length,
      properties: new Set(assignments.map((assignment) => assignment.propertyId ?? 'unknown-property')).size,
      employees: new Set(assignments.map((assignment) => assignment.employeeId || 'unknown-employee')).size,
      oldestDays: assignments.reduce((max, assignment) => Math.max(max, assignment.overdueDays), 0),
    };
  }, [enrichedAssignments]);

  const isLoading = propertiesLoading || backlogQuery.isLoading || employeesQuery.isLoading || tasksQuery.isLoading;
  const error = backlogQuery.error || employeesQuery.error || tasksQuery.error;

  const advanceAfterApproval = (approvedKey: string) => {
    const currentIndex = reviewOrder.findIndex((item) => item.key === approvedKey);
    const nextItem = currentIndex >= 0
      ? reviewOrder.slice(currentIndex + 1).find((item) => item.key !== approvedKey)
      : reviewOrder.find((item) => item.key !== approvedKey);

    setExpandedReviewKeys((current) => {
      const next = new Set(current);
      next.delete(approvedKey);
      if (nextItem) next.add(nextItem.key);
      return next;
    });
  };

  const quickApproveMutation = useMutation({
    mutationFn: async ({
      employeeId,
      date,
      assignmentIds,
    }: {
      reviewKey: string;
      employeeId: string;
      date: string;
      assignmentIds: string[];
    }) => {
      if (!queryOrgId) throw new Error('Organization is still loading. Try again.');
      await approveReviewedDay({ orgId: queryOrgId, employeeId, date, assignmentIds });
    },
    onMutate: ({ reviewKey }) => {
      setQuickApprovingKey(reviewKey);
    },
    onSuccess: async (_data, variables) => {
      advanceAfterApproval(variables.reviewKey);
      await Promise.all([
        backlogQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: ['assignments'] }),
        queryClient.invalidateQueries({ queryKey: ['open-assignments-backlog'], refetchType: 'all' }),
      ]);
      toast.success('Day approved.');
    },
    onError: (mutationError) => {
      toast.error(mutationError instanceof Error ? mutationError.message : 'Day could not be approved.');
    },
    onSettled: () => {
      setQuickApprovingKey(null);
    },
  });

  const toggleDayReview = (employeeId: string, date: string) => {
    if (!employeeId || employeeId === 'unknown-employee' || !date) return;
    const key = makeReviewKey(employeeId, date);
    setExpandedReviewKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleReviewedDayApproved = (reviewKey: string) => {
    advanceAfterApproval(reviewKey);
    void backlogQuery.refetch();
  };

  const handleQuickApprove = (employeeId: string, date: string, assignments: EnrichedBacklogAssignment[]) => {
    const reviewKey = makeReviewKey(employeeId, date);
    if (!isQuickApproveEligible(assignments)) {
      toast.info('Open the full review for days with a time variance.');
      return;
    }
    const assignmentIds = getAssignmentIds(assignments);
    if (assignmentIds.length === 0) {
      toast.info('No assignments are available to approve.');
      return;
    }
    quickApproveMutation.mutate({ reviewKey, employeeId, date, assignmentIds });
  };

  const getVisibleReviewAssignments = (employeeId: string, date: string) =>
    enrichedAssignments.filter((assignment) => (assignment.employeeId || 'unknown-employee') === employeeId && assignment.date === date);

  const renderQuickApproveCell = (employeeId: string, date: string, assignments: EnrichedBacklogAssignment[], showAction: boolean) => {
    if (!showAction) return <td className="px-4 py-3" />;
    const reviewKey = makeReviewKey(employeeId, date);
    const isEligible = isQuickApproveEligible(assignments);
    const isApproving = quickApprovingKey === reviewKey && quickApproveMutation.isPending;
    return (
      <td className="px-4 py-3">
        {isEligible ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-9 gap-2 border-status-success/30 bg-status-success/10 text-status-success hover:bg-status-success/15 hover:text-status-success"
            onClick={(event) => {
              event.stopPropagation();
              handleQuickApprove(employeeId, date, assignments);
            }}
            disabled={quickApproveMutation.isPending}
          >
            {isApproving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Approve
          </Button>
        ) : (
          <Badge variant="outline" className="border-status-pending/30 bg-status-pending/10 text-status-pending">
            Needs review
          </Badge>
        )}
      </td>
    );
  };

  if (!canViewBacklog) {
    return (
      <div className="main-content space-y-6 p-4 md:p-6">
        <Card className="border-surface-border bg-surface-card p-8 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-8 w-8 text-status-pending" />
          <h2 className="mt-3 text-lg font-semibold text-text-primary">Supervisor access required</h2>
          <p className="mt-1 text-sm text-text-muted">Open tasks are available to admins and managers.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="main-content space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-status-pending">
            <CalendarClock className="h-4 w-4" />
            Past-due closeout queue
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-text-primary">Open Tasks</h1>
          <p className="mt-1 max-w-2xl text-sm text-text-muted">
            Assignments dated before {formatDisplayDate(todayKey)} that are not marked closed or approved.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <PropertySelector
            className="w-full sm:w-64"
            orgId={orgId}
            value={selectedPropertyId}
            onChange={setSelectedPropertyId}
          />
          <div className="flex h-10 items-center rounded-lg border border-surface-border bg-surface-elevated p-1">
            <span className="px-2 text-xs font-medium uppercase tracking-[0.14em] text-text-muted">Group by</span>
            {(['employee', 'date'] as const).map((mode) => {
              const isActive = groupBy === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  className={cn(
                    'h-8 rounded-md px-3 text-sm font-medium capitalize transition-colors',
                    isActive ? 'bg-surface-card text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary',
                  )}
                  onClick={() => setGroupBy(mode)}
                  aria-pressed={isActive}
                >
                  {mode === 'employee' ? 'Employee' : 'Date'}
                </button>
              );
            })}
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-10 gap-2"
            onClick={() => void backlogQuery.refetch()}
            disabled={backlogQuery.isFetching}
          >
            <RefreshCw className={cn('h-4 w-4', backlogQuery.isFetching ? 'animate-spin' : undefined)} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-surface-border bg-surface-card p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Open tasks</p>
          <p className="mt-2 text-2xl font-semibold text-text-primary">{totals.assignments}</p>
        </Card>
        <Card className="border-surface-border bg-surface-card p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Properties</p>
          <p className="mt-2 text-2xl font-semibold text-text-primary">{totals.properties}</p>
        </Card>
        <Card className="border-surface-border bg-surface-card p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Crew members</p>
          <p className="mt-2 text-2xl font-semibold text-text-primary">{totals.employees}</p>
        </Card>
        <Card className="border-surface-border bg-surface-card p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Oldest overdue</p>
          <p className="mt-2 text-2xl font-semibold text-text-primary">{totals.oldestDays}d</p>
        </Card>
      </div>

      <div className="rounded-xl border border-surface-border bg-surface-card p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-text-primary">{groupBy === 'employee' ? 'Backlog by property and crew' : 'Backlog by date'}</h2>
            <p className="mt-1 text-xs text-text-muted">
              Closed statuses excluded: {CLOSED_ASSIGNMENT_STATUSES.join(', ')}. Approved days are hidden from this queue.
            </p>
          </div>
          {totals.assignments > 0 ? (
            <Badge variant="outline" className="border-status-pending/30 bg-status-pending/10 text-status-pending">
              {totals.assignments} needs review
            </Badge>
          ) : null}
        </div>

        {isLoading ? (
          <TableSkeleton />
        ) : error ? (
          <ErrorRetry
            message={error instanceof Error ? error.message : 'Failed to load open tasks'}
            onRetry={() => void backlogQuery.refetch()}
          />
        ) : (groupBy === 'employee' ? groups.length === 0 : dateGroups.length === 0) ? (
          <EmptyState
            icon={CheckCircle2}
            title="No open tasks in the backlog"
            description="Past assignments are closed out for the current property filter."
          />
        ) : (
          <div className="space-y-5">
            {groupBy === 'employee' ? (
              groups.map((propertyGroup) => (
                <section key={propertyGroup.propertyId} className="overflow-hidden rounded-lg border border-surface-border bg-surface-elevated/40">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-border px-4 py-3">
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary">{propertyGroup.propertyName}</h3>
                      <p className="mt-0.5 text-xs text-text-muted">Oldest open task: {formatDisplayDate(propertyGroup.oldestDate)}</p>
                    </div>
                    <Badge variant="outline" className="border-surface-border text-text-secondary">
                      {propertyGroup.assignmentCount} task{propertyGroup.assignmentCount === 1 ? '' : 's'}
                    </Badge>
                  </div>

                  {propertyGroup.employees.map((employeeGroup) => {
                    const oldestDate = employeeGroup.assignments[0]?.date ?? '';
                    const oldestReviewKey = makeReviewKey(employeeGroup.employeeId, oldestDate);
                    const isOldestReviewExpanded = expandedReviewKeys.has(oldestReviewKey);

                    return (
                      <div key={employeeGroup.employeeId} className="border-b border-surface-border last:border-b-0">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-surface-card/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                          onClick={() => toggleDayReview(employeeGroup.employeeId, oldestDate)}
                          aria-expanded={isOldestReviewExpanded}
                          aria-label={`${isOldestReviewExpanded ? 'Collapse' : 'Review'} ${employeeGroup.employeeName}'s oldest open day`}
                        >
                          <ChevronDown className={cn('h-4 w-4 text-text-muted transition-transform', isOldestReviewExpanded ? undefined : '-rotate-90')} />
                          <UsersRound className="h-4 w-4 text-text-muted" />
                          <h4 className="text-sm font-medium text-text-primary">{employeeGroup.employeeName}</h4>
                          <span className="text-xs text-text-muted">{employeeGroup.assignments.length} open</span>
                        </button>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[980px] border-collapse text-sm">
                            <thead className="bg-surface-card/70 text-left text-xs uppercase tracking-[0.12em] text-text-muted">
                              <tr>
                                <th className="px-4 py-2 font-medium">Employee</th>
                                <th className="px-4 py-2 font-medium">Task</th>
                                <th className="px-4 py-2 font-medium">Date</th>
                                <th className="px-4 py-2 font-medium">Scheduled</th>
                                <th className="px-4 py-2 font-medium">Status</th>
                                <th className="px-4 py-2 font-medium">Days overdue</th>
                                <th className="px-4 py-2 font-medium">Review</th>
                              </tr>
                            </thead>
                            <tbody>
                              {employeeGroup.assignments.map((assignment, index) => {
                                const reviewKey = makeReviewKey(employeeGroup.employeeId, assignment.date);
                                const isExpanded = expandedReviewKeys.has(reviewKey);
                                const isLastForDate = employeeGroup.assignments[index + 1]?.date !== assignment.date;
                                const dayAssignments = getVisibleReviewAssignments(employeeGroup.employeeId, assignment.date);

                                return (
                                  <Fragment key={assignment.id}>
                                    <tr
                                      role="button"
                                      tabIndex={0}
                                      className={cn(
                                        'cursor-pointer border-t border-surface-border transition-colors hover:bg-surface-card/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
                                        isExpanded ? 'bg-surface-card/70' : undefined,
                                      )}
                                      onClick={() => toggleDayReview(employeeGroup.employeeId, assignment.date)}
                                      onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                          event.preventDefault();
                                          toggleDayReview(employeeGroup.employeeId, assignment.date);
                                        }
                                      }}
                                      aria-expanded={isExpanded}
                                      aria-label={`${isExpanded ? 'Collapse' : 'Review'} ${employeeGroup.employeeName} on ${formatDisplayDate(assignment.date)}`}
                                    >
                                      <td className="px-4 py-3 text-text-secondary">{employeeGroup.employeeName}</td>
                                      <td className="px-4 py-3">
                                        <div className="font-medium text-text-primary">{assignment.taskName}</div>
                                        <div className="mt-0.5 text-xs text-text-muted">{assignment.taskCategory}</div>
                                      </td>
                                      <td className="px-4 py-3 text-text-secondary">{formatDisplayDate(assignment.date)}</td>
                                      <td className="px-4 py-3 text-text-secondary">{Number(assignment.estimatedHours ?? 0).toFixed(1)}h</td>
                                      <td className="px-4 py-3">
                                        <Badge variant="outline" className={statusBadgeClass(assignment.status)}>
                                          {normalizeStatusLabel(assignment.status)}
                                        </Badge>
                                      </td>
                                      <td className="px-4 py-3 font-semibold text-status-pending">{assignment.overdueDays}d</td>
                                      {renderQuickApproveCell(employeeGroup.employeeId, assignment.date, dayAssignments, isLastForDate)}
                                    </tr>
                                    {isExpanded && isLastForDate ? (
                                      <tr className="border-t border-surface-border">
                                        <td colSpan={7} className="bg-surface-card/60 px-4 py-4">
                                          <OpenTaskDayReviewPanel
                                            employeeId={employeeGroup.employeeId}
                                            date={assignment.date}
                                            className="space-y-4"
                                            onApproved={() => handleReviewedDayApproved(reviewKey)}
                                          />
                                        </td>
                                      </tr>
                                    ) : null}
                                  </Fragment>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </section>
              ))
            ) : (
              dateGroups.map((dateGroup) => (
                <section key={dateGroup.date} className="overflow-hidden rounded-lg border border-surface-border bg-surface-elevated/40">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-border px-4 py-3">
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary">{formatDisplayDate(dateGroup.date)}</h3>
                      <p className="mt-0.5 text-xs text-text-muted">Oldest-first date queue across the current property filter</p>
                    </div>
                    <Badge variant="outline" className="border-surface-border text-text-secondary">
                      {dateGroup.assignments.length} task{dateGroup.assignments.length === 1 ? '' : 's'}
                    </Badge>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1060px] border-collapse text-sm">
                      <thead className="bg-surface-card/70 text-left text-xs uppercase tracking-[0.12em] text-text-muted">
                        <tr>
                          <th className="px-4 py-2 font-medium">Property</th>
                          <th className="px-4 py-2 font-medium">Employee</th>
                          <th className="px-4 py-2 font-medium">Task</th>
                          <th className="px-4 py-2 font-medium">Scheduled</th>
                          <th className="px-4 py-2 font-medium">Status</th>
                          <th className="px-4 py-2 font-medium">Days overdue</th>
                          <th className="px-4 py-2 font-medium">Review</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dateGroup.assignments.map((assignment, index) => {
                          const employeeId = assignment.employeeId || 'unknown-employee';
                          const reviewKey = makeReviewKey(employeeId, assignment.date);
                          const isExpanded = expandedReviewKeys.has(reviewKey);
                          const nextAssignment = dateGroup.assignments[index + 1];
                          const isLastForReview = nextAssignment?.employeeId !== assignment.employeeId || nextAssignment?.date !== assignment.date;
                          const dayAssignments = getVisibleReviewAssignments(employeeId, assignment.date);

                          return (
                            <Fragment key={assignment.id}>
                              <tr
                                role="button"
                                tabIndex={0}
                                className={cn(
                                  'cursor-pointer border-t border-surface-border transition-colors hover:bg-surface-card/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
                                  isExpanded ? 'bg-surface-card/70' : undefined,
                                )}
                                onClick={() => toggleDayReview(employeeId, assignment.date)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    toggleDayReview(employeeId, assignment.date);
                                  }
                                }}
                                aria-expanded={isExpanded}
                                aria-label={`${isExpanded ? 'Collapse' : 'Review'} ${assignment.employeeName} on ${formatDisplayDate(assignment.date)}`}
                              >
                                <td className="px-4 py-3 text-text-secondary">{assignment.propertyName}</td>
                                <td className="px-4 py-3 text-text-secondary">{assignment.employeeName}</td>
                                <td className="px-4 py-3">
                                  <div className="font-medium text-text-primary">{assignment.taskName}</div>
                                  <div className="mt-0.5 text-xs text-text-muted">{assignment.taskCategory}</div>
                                </td>
                                <td className="px-4 py-3 text-text-secondary">{Number(assignment.estimatedHours ?? 0).toFixed(1)}h</td>
                                <td className="px-4 py-3">
                                  <Badge variant="outline" className={statusBadgeClass(assignment.status)}>
                                    {normalizeStatusLabel(assignment.status)}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 font-semibold text-status-pending">{assignment.overdueDays}d</td>
                                {renderQuickApproveCell(employeeId, assignment.date, dayAssignments, isLastForReview)}
                              </tr>
                              {isExpanded && isLastForReview ? (
                                <tr className="border-t border-surface-border">
                                  <td colSpan={7} className="bg-surface-card/60 px-4 py-4">
                                    <OpenTaskDayReviewPanel
                                      employeeId={employeeId}
                                      date={assignment.date}
                                      className="space-y-4"
                                      onApproved={() => handleReviewedDayApproved(reviewKey)}
                                    />
                                  </td>
                                </tr>
                              ) : null}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
