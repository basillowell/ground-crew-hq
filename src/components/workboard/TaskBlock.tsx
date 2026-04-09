import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/StatusChip';
import type { Task, Assignment } from '@/data/seedData';
import { Pencil, X } from 'lucide-react';
import { useEquipmentUnits } from '@/lib/supabase-queries';
import { useAuth } from '@/contexts/AuthContext';

interface TaskBlockProps {
  task: Task;
  assignment: Assignment;
  priorityIndex?: number;
  onEdit?: () => void;
  onRemove?: () => void;
}

export function TaskBlock({ task, assignment, priorityIndex, onEdit, onRemove }: TaskBlockProps) {
  const { currentPropertyId, currentUser } = useAuth();
  const propertyScope = currentPropertyId === 'all' ? 'all' : currentPropertyId || undefined;
  const equipmentUnits = useEquipmentUnits(propertyScope, currentUser?.orgId).data ?? [];
  const equipment = assignment.equipmentId
    ? equipmentUnits.find(u => u.id === assignment.equipmentId)
    : null;

  return (
    <div
      className="grid grid-cols-[1fr_auto] gap-3 rounded-xl border px-3 py-2.5 text-xs transition-all hover:shadow-sm"
      style={{
        backgroundColor: task.color + '18',
        borderColor: task.color + '40',
      }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm">{task.icon}</span>
          <span className="truncate text-sm font-semibold" style={{ color: task.color }}>{task.name}</span>
          <Badge variant="outline" className="text-[10px]">{task.category}</Badge>
          {typeof priorityIndex === 'number' ? (
            <Badge variant="secondary" className="text-[10px]">
              Priority {priorityIndex + 1}
            </Badge>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <StatusChip variant="neutral">{assignment.area}</StatusChip>
          <Badge variant="secondary" className="text-[10px]">{assignment.startTime}</Badge>
          <Badge variant="secondary" className="text-[10px]">{assignment.duration}m</Badge>
          {equipment && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {equipment.unitNumber}
            </Badge>
          )}
        </div>
      </div>
      <div className="flex items-start gap-1">
        {onEdit && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 rounded-full"
            onClick={onEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 rounded-full"
            onClick={onRemove}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
