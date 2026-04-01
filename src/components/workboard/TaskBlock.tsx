import { Badge } from '@/components/ui/badge';
import { StatusChip } from '@/components/StatusChip';
import type { Task, Assignment } from '@/data/mockData';
import { equipmentUnits } from '@/data/mockData';

interface TaskBlockProps {
  task: Task;
  assignment: Assignment;
}

export function TaskBlock({ task, assignment }: TaskBlockProps) {
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
      <span className="text-muted-foreground ml-auto shrink-0">{assignment.duration}m</span>
      {equipment && (
        <Badge variant="outline" className="text-[10px] px-1 py-0">
          {equipment.unitNumber}
        </Badge>
      )}
    </div>
  );
}
