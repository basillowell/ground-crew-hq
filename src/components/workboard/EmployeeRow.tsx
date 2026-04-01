import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/StatusChip';
import { AvatarInitials } from '@/components/shared';
import { TaskBlock } from './TaskBlock';
import { GripVertical, Clock, Plus } from 'lucide-react';
import type { Employee, Assignment, Task } from '@/data/seedData';

interface EmployeeRowProps {
  employee: Employee;
  assignments: Assignment[];
  tasks: Task[];
  onAddTask?: (employeeId: string) => void;
  onRemoveAssignment?: (assignmentIndex: number) => void;
}

export function EmployeeRow({ employee, assignments: empAssignments, tasks, onAddTask, onRemoveAssignment }: EmployeeRowProps) {
  const totalMinutes = empAssignments.reduce((s, a) => s + a.duration, 0);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  return (
    <Card className="p-3 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="cursor-grab text-muted-foreground/40 mt-1 hidden sm:block">
          <GripVertical className="h-4 w-4" />
        </div>
        <AvatarInitials firstName={employee.firstName} lastName={employee.lastName} size="md" className="mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-medium text-sm">{employee.firstName} {employee.lastName}</span>
            <StatusChip variant="success">{employee.group}</StatusChip>
            <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {hours}h {mins}m
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {empAssignments.map((a, i) => {
              const task = tasks.find(t => t.id === a.taskId);
              return task ? <TaskBlock key={i} task={task} assignment={a} onRemove={onRemoveAssignment ? () => onRemoveAssignment(i) : undefined} /> : null;
            })}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground border border-dashed border-border px-2"
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
