import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusChip } from '@/components/StatusChip';
import { AvatarInitials } from '@/components/shared';
import { TaskBlock } from './TaskBlock';
import { GripVertical, Clock, Plus } from 'lucide-react';
import type { Employee, Assignment, Task } from '@/data/seedData';

interface EmployeeRowProps {
  employee: Employee;
  assignments: Assignment[];
  tasks: Task[];
  shiftLabel?: string;
  laneSummary?: string;
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
}

export function EmployeeRow({
  employee,
  assignments: empAssignments,
  tasks,
  shiftLabel,
  laneSummary,
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
}: EmployeeRowProps) {
  const sortedAssignments = [...empAssignments].sort((left, right) => {
    if (left.startTime !== right.startTime) return left.startTime.localeCompare(right.startTime);
    return left.duration - right.duration;
  });
  const totalMinutes = sortedAssignments.reduce((s, a) => s + a.duration, 0);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const nextTask = sortedAssignments[0] ? tasks.find((task) => task.id === sortedAssignments[0].taskId) : null;

  return (
    <Card
      className={`rounded-3xl border bg-card/95 p-4 shadow-sm transition-shadow hover:shadow-md ${
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
          className="cursor-grab text-muted-foreground/60 mt-1 flex items-center gap-1 rounded-full border border-dashed px-2 py-1 text-[11px] hover:border-primary/30 hover:text-primary"
          title="Drag to reorder employee lanes for the display board"
        >
          <GripVertical className="h-4 w-4" />
          <span>Lane</span>
        </button>
        <AvatarInitials firstName={employee.firstName} lastName={employee.lastName} size="md" className="mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-base font-semibold">{employee.firstName} {employee.lastName}</span>
            {typeof orderIndex === 'number' ? <Badge variant="secondary">Lane {orderIndex + 1}</Badge> : null}
            <StatusChip variant="success">{employee.group}</StatusChip>
            <StatusChip variant="neutral">{employee.department}</StatusChip>
            <Badge variant="outline">{sortedAssignments.length} tasks</Badge>
            <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {hours}h {mins}m
            </span>
          </div>
          <div className="text-xs text-muted-foreground mb-3">
            {employee.role} · {employee.workerType} · {employee.language} {shiftLabel ? `· Shift ${shiftLabel}` : ''}
          </div>
          {laneSummary ? (
            <div className="mb-3 rounded-xl border bg-muted/40 px-3 py-2 text-[11px] font-medium text-muted-foreground">
              {laneSummary}
            </div>
          ) : null}
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <Badge variant="outline">{sortedAssignments.length > 0 ? 'Assigned' : 'Awaiting assignment'}</Badge>
            {nextTask ? (
              <span>
                Next up: <span className="font-medium text-foreground">{nextTask.name}</span>
              </span>
            ) : (
              <span>No task order has been built yet.</span>
            )}
          </div>
          <div className="space-y-2">
            {sortedAssignments.length === 0 && (
              <div className="rounded-xl border border-dashed px-3 py-3 text-xs text-muted-foreground">
                No tasks assigned yet for this crew member on the selected board date.
              </div>
            )}
            {sortedAssignments.map((a) => {
              const task = tasks.find(t => t.id === a.taskId);
              return task ? (
                <TaskBlock
                  key={a.id}
                  task={task}
                  assignment={a}
                  priorityIndex={sortedAssignments.findIndex((assignment) => assignment.id === a.id)}
                  onEdit={onEditAssignment ? () => onEditAssignment(a) : undefined}
                  onRemove={onRemoveAssignment ? () => onRemoveAssignment(a.id) : undefined}
                />
              ) : null;
            })}
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground border border-dashed border-border px-3"
              onClick={() => onAddTask?.(employee.id)}
            >
              <Plus className="h-3 w-3 mr-1" /> Add Task
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
