import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Task, Assignment, Property } from '@/data/seedData';
import { AlertTriangle, Pencil, X } from 'lucide-react';
import { useEquipmentUnits } from '@/lib/supabase-queries';
import { useOrgProfile } from '@/hooks/useOrgProfile';
import { formatTime } from '@/utils/formatTime';
import { wallClockToStoredIso } from '@/lib/timeWorkflow';

interface TaskBlockProps {
  task: Task;
  assignment: Assignment;
  properties: Property[];
  shiftEndTime: string | null;
  equipmentOverdueThresholdDays?: number;
  operationalTimezone?: string;
  priorityIndex?: number;
  onEdit?: () => void;
  onRemove?: () => void;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragEnter?: () => void;
  onDrop?: () => void;
}

function normalizeStatus(status?: string) {
  const value = String(status ?? '').toLowerCase();
  if (value === 'in-progress' || value === 'in_progress') return 'in-progress';
  if (value === 'done' || value === 'complete' || value === 'completed') return 'done';
  return 'planned';
}

function statusContainerClass(status: string) {
  if (status === 'in-progress') return 'border-l-[3px] border-l-status-complete bg-card';
  if (status === 'done') return 'border-l-[3px] border-l-status-active bg-card';
  return 'border-l-[3px] border-l-status-hold bg-card';
}

function parseShiftEndToTimestamp(
  shiftEndTime: string | null | undefined,
  assignmentDate: string,
  actualStartAt: string,
  timezone: string,
) {
  const dateKey = String(assignmentDate ?? '').slice(0, 10);
  const hhmm = String(shiftEndTime ?? '').trim().slice(0, 5);
  if (!dateKey || !hhmm) return null;
  const shiftEndMs = Date.parse(wallClockToStoredIso(dateKey, hhmm, timezone));
  if (!Number.isFinite(shiftEndMs)) return null;
  const startMs = Date.parse(actualStartAt);
  return Number.isFinite(startMs) && shiftEndMs < startMs ? shiftEndMs + 86_400_000 : shiftEndMs;
}

export function TaskBlock({
  task,
  assignment,
  properties,
  shiftEndTime,
  equipmentOverdueThresholdDays = 90,
  operationalTimezone = 'America/New_York',
  priorityIndex,
  onEdit,
  onRemove,
  draggable,
  onDragStart,
  onDragEnter,
  onDrop,
}: TaskBlockProps) {
  const { currentPropertyId, currentUser } = useOrgProfile();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const propertyScope = currentPropertyId === 'all' ? 'all' : currentPropertyId || undefined;
  const equipmentUnits = useEquipmentUnits(propertyScope, currentUser?.orgId).data ?? [];
  const equipment = assignment.equipmentId ? equipmentUnits.find((unit) => unit.id === assignment.equipmentId) : null;
  const isEquipmentOverdue = useMemo(() => {
    if (!equipment?.lastService) return false;
    const overdueThresholdDays = Math.max(1, equipmentOverdueThresholdDays);
    const overdueThresholdDate = new Date();
    overdueThresholdDate.setDate(overdueThresholdDate.getDate() - overdueThresholdDays);
    const lastServicedDate = new Date(String(equipment.lastService));
    if (Number.isNaN(lastServicedDate.getTime()) || lastServicedDate >= overdueThresholdDate) return false;
    const overdueDays = Math.max(
      0,
      Math.floor((Date.now() - lastServicedDate.getTime()) / (1000 * 60 * 60 * 24)) - overdueThresholdDays,
    );
    return overdueDays >= 0;
  }, [equipment?.lastService, equipmentOverdueThresholdDays]);
  const status = normalizeStatus(assignment.status);
  const assignmentRecord = assignment as Assignment & Record<string, unknown>;

  const propertyLabel = properties.find((property) => property.id === assignment.propertyId)?.name ?? 'No property';
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
        ? 'text-status-pending'
        : 'text-status-active';

  const elapsedState = useMemo(() => {
    if (status !== 'in-progress' || !actualStartAt) return null;
    const startMs = Date.parse(actualStartAt);
    if (!Number.isFinite(startMs)) return null;
    const shiftEndMs = parseShiftEndToTimestamp(shiftEndTime, assignment.date, actualStartAt, operationalTimezone);
    const cappedAtShiftEnd = shiftEndMs != null && nowMs > shiftEndMs;
    const effectiveNow = cappedAtShiftEnd ? shiftEndMs : nowMs;
    const elapsedMs = Math.max(0, effectiveNow - startMs);
    const totalMinutes = Math.floor(elapsedMs / 60_000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) return { label: `${hours}:${String(minutes).padStart(2, '0')}`, cappedAtShiftEnd };
    const seconds = Math.floor((elapsedMs % 60_000) / 1_000);
    return { label: `${minutes}:${String(seconds).padStart(2, '0')}`, cappedAtShiftEnd };
  }, [actualStartAt, assignment.date, nowMs, operationalTimezone, shiftEndTime, status]);

  const elapsedLabel = elapsedState?.label ?? null;
  const isElapsedCappedAtShiftEnd = Boolean(elapsedState?.cappedAtShiftEnd);

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
      className={`grid min-h-[58px] grid-cols-[1fr_auto] items-start gap-3 overflow-hidden rounded-xl border px-3 py-2 text-xs transition-all hover:shadow-sm ${statusContainerClass(status)}`}
      draggable={Boolean(draggable)}
      onDragStart={draggable ? onDragStart : undefined}
      onDragEnter={draggable ? onDragEnter : undefined}
      onDragOver={draggable ? (event) => event.preventDefault() : undefined}
      onDrop={draggable ? onDrop : undefined}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
          <span className={`truncate text-sm font-semibold ${status === 'done' ? 'line-through text-muted-foreground' : ''}`} style={{ color: status === 'done' ? undefined : task.color }}>
            {task.name}
          </span>
          <Badge variant="outline" className="shrink-0 text-[10px]">{propertyLabel}</Badge>
          <Badge
            variant="outline"
            className={
              status === 'in-progress'
                ? 'shrink-0 border-status-complete/20 text-status-complete'
                : status === 'done'
                  ? 'shrink-0 border-status-active/20 text-status-active'
                  : 'shrink-0 border-surface-border text-text-secondary'
            }
          >
            {status === 'in-progress' ? 'In Progress' : status === 'done' ? 'Done' : 'Planned'}
          </Badge>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
          <span className="shrink-0 text-[11px] text-muted-foreground">
            est {estimatedHours > 0 ? `${estimatedHours.toFixed(1)}h` : '—'} →{' '}
            <span className={actualHoursTone}>{actualHours != null ? `${actualHours.toFixed(1)}h actual` : '—'}</span>
          </span>
          {status === 'in-progress' && elapsedLabel ? (
            <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
              <span>Live {elapsedLabel}</span>
              {isElapsedCappedAtShiftEnd ? (
                <Badge variant="outline" className="gap-1 border-status-pending/20 bg-status-pending/10 px-1.5 py-0 text-[10px] text-status-pending">
                  <span className="h-1.5 w-1.5 rounded-full bg-status-pending" aria-hidden="true" />
                  Past shift end
                </Badge>
              ) : null}
            </span>
          ) : null}
          {status === 'done' && doneLabel ? <span className="shrink-0 text-[11px] text-muted-foreground">{doneLabel}</span> : null}
          <Badge variant="outline" className="shrink-0 text-[10px]">{task.category}</Badge>
          {typeof priorityIndex === 'number' ? <Badge variant="secondary" className="shrink-0 text-[10px]">#{priorityIndex + 1}</Badge> : null}
          <span className="inline-flex min-w-0 items-center gap-1 truncate text-[11px] text-muted-foreground">
            <span className="truncate">
              {formatTime(assignment.startTime)} · {assignment.duration}m · {equipment ? equipment.unitNumber : 'None'}
            </span>
            {isEquipmentOverdue ? (
              <AlertTriangle
                className="h-3.5 w-3.5 shrink-0 text-status-pending"
                aria-label="Equipment overdue for service"
                title="Equipment overdue for service"
              />
            ) : null}
          </span>
        </div>
      </div>

      <div className="flex items-start gap-1 pt-0.5">
        {onEdit ? (
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full p-2" onClick={onEdit} aria-label="Edit task">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ) : null}
        {onRemove ? (
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full p-2" onClick={onRemove} aria-label="Remove task">
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
