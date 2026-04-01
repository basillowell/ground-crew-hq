import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/StatusChip';
import type { Task, Assignment } from '@/data/seedData';
import { equipmentUnits } from '@/data/seedData';
import { X } from 'lucide-react';

interface TaskBlockProps {
  task: Task;
  assignment: Assignment;
  onRemove?: () => void;
}

export function TaskBlock({ task, assignment, onRemove }: TaskBlockProps) {
  const equipment = assignment.equipmentId
    ? equipmentUnits.find(u => u.id === assignment.equipmentId)
    : null;

  return (
    <div
      className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium border transition-all hover:shadow-sm"
      style={{
        backgroundColor: task.color + '18',
        borderColor: task.color + '40',
        color: task.color,
      }}
    >
      <span>{task.icon}</span>
      <span className="truncate">{task.name}</span>
      <StatusChip variant="neutral">{assignment.area}</StatusChip>
      <span className="text-muted-foreground ml-auto shrink-0">{assignment.duration}m</span>
      {equipment && (
        <Badge variant="outline" className="text-[10px] px-1 py-0">
          {equipment.unitNumber}
        </Badge>
      )}
      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-5 w-5 shrink-0 rounded-full"
          onClick={onRemove}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
