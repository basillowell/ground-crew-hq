import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Task, Assignment } from '@/data/seedData';
import { Pencil, X } from 'lucide-react';
import { useEquipmentUnits } from '@/lib/supabase-queries';
import { useAuth } from '@/contexts/AuthContext';
import { formatTime } from '@/utils/formatTime';

interface TaskBlockProps {
  task: Task;
  assignment: Assignment;
  priorityIndex?: number;
  onEdit?: () => void;
  onRemove?: () => void;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragEnter?: () => void;
  onDrop?: () => void;
  weatherWarnings?: Array<{ level: 'warning' | 'danger'; message: string }>;
}

function normalizeStatus(status?: string) {
  const value = String(status ?? '').toLowerCase();
  if (value === 'in-progress' || value === 'in_progress') return 'in-progress';
  if (value === 'done' || value === 'complete' || value === 'completed') return 'done';
  return 'planned';
}

function statusContainerClass(status: string) {
  if (status === 'in-progress') return 'border-l-[3px] border-l-blue-500 bg-blue-50';
  if (status === 'done') return 'border-l-[3px] border-l-green-500 bg-green-50';
  return 'border-l-[3px] border-l-gray-400 bg-card';
}

export function TaskBlock({
  task,
  assignment,
  priorityIndex,
  onEdit,
  onRemove,
  draggable,
  onDragStart,
  onDragEnter,
  onDrop,
  weatherWarnings = [],
}: TaskBlockProps) {
  const { currentPropertyId, currentUser } = useAuth();
  const propertyScope = currentPropertyId === 'all' ? 'all' : currentPropertyId || undefined;
  const equipmentUnits = useEquipmentUnits(propertyScope, currentUser?.orgId).data ?? [];
  const equipment = assignment.equipmentId ? equipmentUnits.find((unit) => unit.id === assignment.equipmentId) : null;
  const status = normalizeStatus(assignment.status);

  return (
    <div
      className={`grid grid-cols-[1fr_auto] gap-3 rounded-xl border px-3 py-2.5 text-xs transition-all hover:shadow-sm ${statusContainerClass(status)}`}
      draggable={Boolean(draggable)}
      onDragStart={draggable ? onDragStart : undefined}
      onDragEnter={draggable ? onDragEnter : undefined}
      onDragOver={draggable ? (event) => event.preventDefault() : undefined}
      onDrop={draggable ? onDrop : undefined}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={`truncate text-sm font-semibold ${status === 'done' ? 'line-through text-muted-foreground' : ''}`} style={{ color: status === 'done' ? undefined : task.color }}>
            {task.name}
          </span>
          <Badge variant="outline" className="text-[10px]">{task.category}</Badge>
          {typeof priorityIndex === 'number' ? <Badge variant="secondary" className="text-[10px]">#{priorityIndex + 1}</Badge> : null}
          <Badge
            variant={status === 'planned' ? 'outline' : 'default'}
            className={
              status === 'in-progress'
                ? 'bg-blue-500 text-white hover:bg-blue-500'
                : status === 'done'
                  ? 'bg-green-600 text-white hover:bg-green-600'
                  : ''
            }
          >
            {status === 'in-progress' ? 'In Progress' : status === 'done' ? 'Done ✓' : 'Planned'}
          </Badge>
        </div>

        <div className="mt-2 grid gap-2 rounded-lg border bg-background/70 p-2 text-[11px] text-muted-foreground sm:grid-cols-4">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground/80">Location</div>
            <div className="truncate font-medium text-foreground/90">{assignment.area}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground/80">Start</div>
            <div className="font-medium text-foreground/90">{formatTime(assignment.startTime)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground/80">Duration</div>
            <div className="font-medium text-foreground/90">{assignment.duration} min</div>
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground/80">Equipment</div>
            <div className="truncate font-medium text-foreground/90">{equipment ? equipment.unitNumber : 'None'}</div>
          </div>
        </div>

        {weatherWarnings.length > 0 ? (
          <div className="mt-2 space-y-1">
            {weatherWarnings.map((warning, index) => (
              <div
                key={`${assignment.id ?? 'assignment'}-weather-warning-${index}`}
                className={`rounded-md border px-2 py-1 text-[11px] font-medium ${
                  warning.level === 'danger'
                    ? 'border-red-300 bg-red-100 text-red-800'
                    : 'border-amber-300 bg-amber-100 text-amber-800'
                }`}
              >
                {warning.message}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex items-start gap-1">
        {onEdit ? (
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 rounded-full" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ) : null}
        {onRemove ? (
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 rounded-full" onClick={onRemove}>
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
