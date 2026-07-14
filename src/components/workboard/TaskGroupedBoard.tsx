import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import type { Assignment, Employee, Task } from '@/data/seedData';
import { formatTime } from '@/utils/formatTime';

type TaskGroupedBoardProps = {
  assignments: Assignment[];
  tasks: Task[];
  employees: Employee[];
  onEditAssignment?: (assignment: Assignment) => void;
};

type TaskGroup = {
  key: string;
  task: Task | null;
  title: string;
  assignments: Assignment[];
  order: number;
};

function normalizeStatus(status?: string) {
  const value = String(status ?? '').toLowerCase();
  if (value === 'in_progress' || value === 'in-progress') return 'in-progress';
  if (value === 'done' || value === 'complete' || value === 'completed') return 'done';
  return 'planned';
}

function statusLabel(status?: string) {
  const normalized = normalizeStatus(status);
  if (normalized === 'in-progress') return 'In Progress';
  if (normalized === 'done') return 'Done';
  return 'Planned';
}

function statusClassName(status?: string) {
  const normalized = normalizeStatus(status);
  if (normalized === 'in-progress') return 'border-blue-200 text-blue-700';
  if (normalized === 'done') return 'border-green-200 text-green-700';
  return 'border-surface-border text-text-secondary';
}

function employeeName(employee: Employee | undefined) {
  if (!employee) return 'Unassigned';
  return [employee.firstName, employee.lastName].filter(Boolean).join(' ') || 'Unnamed employee';
}

function assignmentSortValue(assignment: Assignment, employeesById: Map<string, Employee>) {
  const employee = employeesById.get(assignment.employeeId);
  return [assignment.startTime || '99:99', employeeName(employee).toLowerCase(), assignment.title ?? ''].join('|');
}

export function TaskGroupedBoard({ assignments, tasks, employees, onEditAssignment }: TaskGroupedBoardProps) {
  const { groups, employeesById } = useMemo(() => {
    const taskById = new Map(tasks.map((task) => [task.id, task]));
    const taskOrderById = new Map(tasks.map((task, index) => [task.id, index]));
    const employeeMap = new Map(employees.map((employee) => [employee.id, employee]));
    const grouped = new Map<string, TaskGroup>();

    assignments.forEach((assignment) => {
      const key = assignment.taskId || 'unassigned-task';
      const task = taskById.get(assignment.taskId) ?? null;
      const existing = grouped.get(key);
      if (existing) {
        existing.assignments.push(assignment);
        return;
      }
      grouped.set(key, {
        key,
        task,
        title: task?.name || assignment.title || 'Unassigned task',
        assignments: [assignment],
        order: taskOrderById.get(assignment.taskId) ?? Number.MAX_SAFE_INTEGER,
      });
    });

    const sortedGroups = Array.from(grouped.values()).sort(
      (a, b) => a.order - b.order || a.title.localeCompare(b.title),
    );
    sortedGroups.forEach((group) => {
      group.assignments.sort((a, b) => assignmentSortValue(a, employeeMap).localeCompare(assignmentSortValue(b, employeeMap)));
    });

    return { groups: sortedGroups, employeesById: employeeMap };
  }, [assignments, employees, tasks]);

  if (assignments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card/70 p-6 text-center text-sm text-muted-foreground">
        No tasks assigned for this date.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const accentStyle = group.task?.color ? { borderLeftColor: group.task.color } : undefined;
        return (
          <section key={group.key} className="rounded-xl border border-l-4 bg-card" style={accentStyle}>
            <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-3 py-2">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-foreground">{group.title}</h3>
                {group.task?.category ? (
                  <p className="text-xs text-muted-foreground">{group.task.category}</p>
                ) : null}
              </div>
              <Badge variant="secondary" className="shrink-0 text-[10px]">
                {group.assignments.length} assigned
              </Badge>
            </div>
            <div className="divide-y">
              {group.assignments.map((assignment, index) => {
                const employee = employeesById.get(assignment.employeeId);
                const assignmentKey = assignment.id ?? [group.key, assignment.employeeId, String(index)].join('-');
                const row = (
                  <>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{employeeName(employee)}</p>
                      {assignment.title && assignment.title !== group.title ? (
                        <p className="truncate text-xs text-muted-foreground">{assignment.title}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">{assignment.startTime ? formatTime(assignment.startTime) : 'No start'}</span>
                      <Badge variant="outline" className={statusClassName(assignment.status)}>
                        {statusLabel(assignment.status)}
                      </Badge>
                    </div>
                  </>
                );

                if (onEditAssignment) {
                  return (
                    <button
                      key={assignmentKey}
                      type="button"
                      className="flex min-h-12 w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => onEditAssignment(assignment)}
                    >
                      {row}
                    </button>
                  );
                }

                return (
                  <div
                    key={assignmentKey}
                    className="flex min-h-12 items-center justify-between gap-3 px-3 py-2"
                  >
                    {row}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
