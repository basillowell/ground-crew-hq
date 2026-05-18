import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AvatarInitials } from '@/components/shared';
import { TaskBlock } from './TaskBlock';
import { GripVertical, Plus } from 'lucide-react';
import type { Employee, Assignment, Task } from '@/data/seedData';

interface EmployeeRowProps {
  employee: Employee;
  assignments: Assignment[];
  tasks: Task[];
  shiftLabel?: string;
  laneSummary?: string;
  laneWarning?: string;
  orderIndex?: number;
  isDragging?: boolean;
  isDropTarget?: boolean;
  onDragStart?: (employeeId: string) => void;
  onDragEnter?: (employeeId: string) => void;
  onDragEnd?: () => void;
  onDropRow?: (employeeId: string) => void;
  onAddTask?: (employeeId: string) => void;
  onEditAssignment?: (assignment: Assignment) => void;
  onRemoveAssignment?: (assignmentId: string) => void;
  onTaskDragStart?: (employeeId: string, assignmentId: string) => void;
  onTaskDropOnTask?: (employeeId: string, targetAssignmentId: string) => void;
  coveragePercent?: number;
  weatherWarningsByAssignment?: Record<string, Array<{ level: 'warning' | 'danger'; message: string }>>;
}

function coverageBadgeClass(coveragePercent: number | undefined) {
  if (typeof coveragePercent !== 'number') return 'bg-muted text-muted-foreground border-border';
  if (coveragePercent >= 80) return 'bg-green-100 text-green-800 border-green-200';
  if (coveragePercent >= 50) return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-red-100 text-red-800 border-red-200';
}

export function EmployeeRow({
  employee,
  assignments: employeeAssignments,
  tasks,
  shiftLabel,
  laneSummary: _laneSummary,
  laneWarning,
  orderIndex,
  isDragging,
  isDropTarget,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onDropRow,
  onAddTask,
  onEditAssignment,
  onRemoveAssignment,
  onTaskDragStart,
  onTaskDropOnTask,
  coveragePercent,
  weatherWarningsByAssignment,
}: EmployeeRowProps) {
  const sortedAssignments = [...employeeAssignments];

  return (
    <Card
      className={`rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/30 ${
        isDropTarget ? 'border-primary shadow-md ring-2 ring-primary/20' : ''
      } ${isDragging ? 'opacity-60' : ''}`}
      onDragOver={(event) => event.preventDefault()}
      onDragEnter={() => onDragEnter?.(employee.id)}
      onDrop={() => onDropRow?.(employee.id)}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          draggable
          onDragStart={() => onDragStart?.(employee.id)}
          onDragEnd={onDragEnd}
          className="mt-1 flex cursor-grab items-center gap-1 rounded-full border border-dashed px-2 py-1 text-[11px] text-muted-foreground/60 hover:border-primary/30 hover:text-primary"
          title="Drag to reorder employee lanes for the display board"
        >
          <GripVertical className="h-4 w-4" />
          <span>Lane</span>
        </button>
        <AvatarInitials firstName={employee.firstName} lastName={employee.lastName} size="md" className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold">{employee.firstName} {employee.lastName}</span>
            <span className="text-sm text-muted-foreground">{employee.role}</span>
            {typeof orderIndex === 'number' ? <Badge variant="secondary">Lane {orderIndex + 1}</Badge> : null}
            <Badge variant="outline" className="rounded-full bg-muted/40">{shiftLabel || 'No shift'}</Badge>
            <Badge variant="outline" className={`rounded-full ${coverageBadgeClass(coveragePercent)}`}>
              {typeof coveragePercent === 'number' ? `${Math.round(coveragePercent)}%` : '—'}
            </Badge>
            <Badge variant="outline" className="ml-auto rounded-full">{sortedAssignments.length} task{sortedAssignments.length === 1 ? '' : 's'}</Badge>
          </div>

          {laneWarning ? (
            <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              {laneWarning}
            </div>
          ) : null}

          <div className="space-y-2">
            {sortedAssignments.length === 0 ? (
              <div className="rounded-xl border border-dashed px-3 py-5 text-center">
                <p className="text-sm text-muted-foreground">No tasks assigned</p>
                <Button variant="outline" size="sm" className="mt-3 h-9 rounded-lg" onClick={() => onAddTask?.(employee.id)}>
                  + Assign Task
                </Button>
              </div>
            ) : (
              sortedAssignments.map((assignment) => {
                const task = tasks.find((item) => item.id === assignment.taskId);
                return task ? (
                  <TaskBlock
                    key={assignment.id}
                    task={task}
                    assignment={assignment}
                    priorityIndex={sortedAssignments.findIndex((item) => item.id === assignment.id)}
                    weatherWarnings={weatherWarningsByAssignment?.[assignment.id ?? ''] ?? []}
                    draggable
                    onDragStart={onTaskDragStart ? () => onTaskDragStart(employee.id, assignment.id ?? '') : undefined}
                    onDrop={onTaskDropOnTask ? () => onTaskDropOnTask(employee.id, assignment.id ?? '') : undefined}
                    onEdit={onEditAssignment ? () => onEditAssignment(assignment) : undefined}
                    onRemove={onRemoveAssignment ? () => onRemoveAssignment(assignment.id) : undefined}
                  />
                ) : null;
              })
            )}
          </div>

          {sortedAssignments.length > 0 ? (
            <div className="mt-3 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 border border-dashed border-border px-3 text-xs text-muted-foreground"
                onClick={() => onAddTask?.(employee.id)}
              >
                <Plus className="mr-1 h-3 w-3" /> Add Task
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
