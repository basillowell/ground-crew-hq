import { useMemo } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, RefreshCw, UsersRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/EmptyState';
import { ErrorRetry } from '@/components/ErrorRetry';
import { PropertySelector } from '@/components/shared/PropertySelector';
import { TableSkeleton } from '@/components/TableSkeleton';
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

type BacklogAssignment = Assignment & {
  overdueDays: number;
  taskName: string;
  taskCategory: string;
};

type EmployeeBacklogGroup = {
  employeeId: string;
  employeeName: string;
  assignments: BacklogAssignment[];
};

type PropertyBacklogGroup = {
  propertyId: string;
  propertyName: string;
  assignmentCount: number;
  oldestDate: string;
  employees: EmployeeBacklogGroup[];
};

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
  const { data: properties = [], isLoading: propertiesLoading } = useProperties(queryOrgId);
  const [selectedPropertyId, setSelectedPropertyId] = usePagePropertySelection({
    currentUser,
    properties,
  });
  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const backlogQuery = useOpenAssignmentsBacklog(todayKey, selectedPropertyId, queryOrgId);
  const employeesQuery = useEmployees(undefined, queryOrgId, 'all');
  const tasksQuery = useTasks(undefined, queryOrgId);

  const groups = useMemo<PropertyBacklogGroup[]>(() => {
    const propertyById = new Map(properties.map((property) => [property.id, property]));
    const employeeById = new Map((employeesQuery.data ?? []).map((employee) => [employee.id, employee]));
    const taskById = new Map((tasksQuery.data ?? []).map((task) => [task.id, task]));
    const byProperty = new Map<string, Map<string, EmployeeBacklogGroup>>();

    (backlogQuery.data ?? []).forEach((assignment) => {
      const propertyId = assignment.propertyId ?? 'unknown-property';
      const employeeId = assignment.employeeId || 'unknown-employee';
      const propertyGroup = byProperty.get(propertyId) ?? new Map<string, EmployeeBacklogGroup>();
      const employee = employeeById.get(employeeId);
      const task = taskById.get(assignment.taskId);
      const employeeGroup = propertyGroup.get(employeeId) ?? {
        employeeId,
        employeeName: employeeName(employee),
        assignments: [],
      };

      employeeGroup.assignments.push({
        ...assignment,
        overdueDays: daysBetween(assignment.date, todayKey),
        taskName: assignment.title?.trim() || task?.name || 'Untitled Task',
        taskCategory: task?.category || 'General',
      });
      propertyGroup.set(employeeId, employeeGroup);
      byProperty.set(propertyId, propertyGroup);
    });

    return Array.from(byProperty.entries())
      .map(([propertyId, employees]) => {
        const property = propertyById.get(propertyId);
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
          propertyName: property?.name ?? 'Unknown Property',
          assignmentCount: assignments.length,
          oldestDate,
          employees: employeeGroups,
        };
      })
      .sort((first, second) => first.oldestDate.localeCompare(second.oldestDate) || first.propertyName.localeCompare(second.propertyName));
  }, [backlogQuery.data, employeesQuery.data, properties, tasksQuery.data, todayKey]);

  const totals = useMemo(() => {
    const assignments = groups.flatMap((property) => property.employees.flatMap((employee) => employee.assignments));
    return {
      assignments: assignments.length,
      properties: groups.length,
      employees: new Set(assignments.map((assignment) => assignment.employeeId)).size,
      oldestDays: assignments.reduce((max, assignment) => Math.max(max, assignment.overdueDays), 0),
    };
  }, [groups]);

  const isLoading = propertiesLoading || backlogQuery.isLoading || employeesQuery.isLoading || tasksQuery.isLoading;
  const error = backlogQuery.error || employeesQuery.error || tasksQuery.error;

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
            Assignments dated before {formatDisplayDate(todayKey)} that are not marked closed.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <PropertySelector
            className="w-full sm:w-64"
            orgId={orgId}
            value={selectedPropertyId}
            onChange={setSelectedPropertyId}
          />
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
            <h2 className="text-base font-semibold text-text-primary">Backlog by property and crew</h2>
            <p className="mt-1 text-xs text-text-muted">
              Closed statuses excluded: {CLOSED_ASSIGNMENT_STATUSES.join(', ')}.
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
        ) : groups.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="No open tasks in the backlog"
            description="Past assignments are closed out for the current property filter."
          />
        ) : (
          <div className="space-y-5">
            {groups.map((propertyGroup) => (
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

                {propertyGroup.employees.map((employeeGroup) => (
                  <div key={employeeGroup.employeeId} className="border-b border-surface-border last:border-b-0">
                    <div className="flex items-center gap-2 px-4 py-3">
                      <UsersRound className="h-4 w-4 text-text-muted" />
                      <h4 className="text-sm font-medium text-text-primary">{employeeGroup.employeeName}</h4>
                      <span className="text-xs text-text-muted">{employeeGroup.assignments.length} open</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[860px] border-collapse text-sm">
                        <thead className="bg-surface-card/70 text-left text-xs uppercase tracking-[0.12em] text-text-muted">
                          <tr>
                            <th className="px-4 py-2 font-medium">Employee</th>
                            <th className="px-4 py-2 font-medium">Task</th>
                            <th className="px-4 py-2 font-medium">Date</th>
                            <th className="px-4 py-2 font-medium">Scheduled</th>
                            <th className="px-4 py-2 font-medium">Status</th>
                            <th className="px-4 py-2 font-medium">Days overdue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {employeeGroup.assignments.map((assignment) => (
                            <tr key={assignment.id} className="border-t border-surface-border">
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
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
