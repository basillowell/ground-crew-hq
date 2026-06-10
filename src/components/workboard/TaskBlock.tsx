import { useEffect, useMemo, useState } from 'react';
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
  if (status === 'in-progress') return 'border-l-[3px] border-l-blue-500 bg-card';
  if (status === 'done') return 'border-l-[3px] border-l-green-500 bg-card';
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
}: TaskBlockProps) {
  const { currentPropertyId, currentUser } = useAuth();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const propertyScope = currentPropertyId === 'all' ? 'all' : currentPropertyId || undefined;
  const equipmentUnits = useEquipmentUnits(propertyScope, currentUser?.orgId).data ?? [];
  const equipment = assignment.equipmentId ? equipmentUnits.find((unit) => unit.id === assignment.equipmentId) : null;
  const status = normalizeStatus(assignment.status);
  const assignmentRecord = assignment as Assignment & Record<string, unknown>;

  const locationLabel = String(assignmentRecord.area ?? assignmentRecord.location ?? 'Unspecified');
  const estimatedHours = useMemo(() => {
    const explicit = Number(assignmentRecord.estimatedHours ?? assignmentRecord.estimated_hours ?? 0);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    const durationMinutes = Number(assignmentRecord.duration ?? 0);
    return Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes / 60 : 0;
  }, [assignmentRecord]);

  const actualStartAt = typeof assignmentRecord.actual_start_at === 'string' ? String(assignmentRecord.actual_start_at) : null;
  const actualCompletedAt =
    typeof assignmentRecord.actual_completed_at === 'string'
      ? String(assignmentRecord.actual_completed_at)
      : typeof assignmentRecord.completed_at === 'string'
        ? String(assignmentRecord.completed_at)
        : null;

  const actualHours = useMemo(() => {
    const explicit = Number(assignmentRecord.actualHours ?? assignmentRecord.actual_hours ?? 0);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    if (!actualStartAt || !actualCompletedAt) return null;
    const startMs = Date.parse(actualStartAt);
    const endMs = Date.parse(actualCompletedAt);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return null;
    return (endMs - startMs) / 3_600_000;
  }, [actualCompletedAt, actualStartAt, assignmentRecord]);

  const actualHoursTone =
    actualHours == null || estimatedHours <= 0
      ? 'text-muted-foreground'
      : actualHours > estimatedHours
        ? 'text-amber-700'
        : 'text-emerald-700';

  const elapsedLabel = useMemo(() => {
    if (status !== 'in-progress' || !actualStartAt) return null;
    const startMs = Date.parse(actualStartAt);
    if (!Number.isFinite(startMs)) return null;
    const elapsedMs = Math.max(0, nowMs - startMs);
    const totalMinutes = Math.floor(elapsedMs / 60_000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}`;
    const seconds = Math.floor((elapsedMs % 60_000) / 1_000);
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }, [actualStartAt, nowMs, status]);

  const doneLabel = useMemo(() => {
    if (status !== 'done' || !actualCompletedAt) return null;
    const timeLabel = new Date(actualCompletedAt)
      .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      .toLowerCase()
      .replace(' ', '');
    return `Done ${timeLabel}`;
  }, [actualCompletedAt, status]);

  useEffect(() => {
    if (status !== 'in-progress' || !actualStartAt) return;
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(intervalId);
  }, [actualStartAt, status]);

  return (
    <div
      className={`grid h-[44px] min-h-[44px] grid-cols-[1fr_auto] items-center gap-3 overflow-hidden rounded-xl border px-3 text-xs transition-all hover:shadow-sm ${statusContainerClass(status)}`}
      draggable={Boolean(draggable)}
      onDragStart={draggable ? onDragStart : undefined}
      onDragEnter={draggable ? onDragEnter : undefined}
      onDragOver={draggable ? (event) => event.preventDefault() : undefined}
      onDrop={draggable ? onDrop : undefined}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className={`truncate text-sm font-semibold ${status === 'done' ? 'line-through text-muted-foreground' : ''}`} style={{ color: status === 'done' ? undefined : task.color }}>
            {task.name}
          </span>
          <Badge variant="outline" className="shrink-0 text-[10px]">{locationLabel}</Badge>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            est {estimatedHours > 0 ? `${estimatedHours.toFixed(1)}h` : '—'} →{' '}
            <span className={actualHoursTone}>{actualHours != null ? `${actualHours.toFixed(1)}h actual` : '—'}</span>
          </span>
          {status === 'in-progress' && elapsedLabel ? <span className="shrink-0 text-[11px] text-muted-foreground">Live {elapsedLabel}</span> : null}
          {status === 'done' && doneLabel ? <span className="shrink-0 text-[11px] text-muted-foreground">{doneLabel}</span> : null}
          <Badge variant="outline" className="shrink-0 text-[10px]">{task.category}</Badge>
          {typeof priorityIndex === 'number' ? <Badge variant="secondary" className="shrink-0 text-[10px]">#{priorityIndex + 1}</Badge> : null}
          <span className="truncate text-[11px] text-muted-foreground">
            {formatTime(assignment.startTime)} · {assignment.duration}m · {equipment ? equipment.unitNumber : 'None'}
          </span>
          <Badge
            variant="outline"
            className={
              status === 'in-progress'
                ? 'border-blue-200 text-blue-700'
                : status === 'done'
                  ? 'border-green-200 text-green-700'
                  : 'border-surface-border text-text-secondary'
            }
          >
            {status === 'in-progress' ? 'In Progress' : status === 'done' ? 'Done' : 'Planned'}
          </Badge>
        </div>
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
