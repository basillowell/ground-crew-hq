import { useEffect, useMemo, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Task, Assignment, Property } from '@/data/seedData';
import { AlertTriangle, CircleAlert, Loader2, Pencil, Wrench, X } from 'lucide-react';
import { getAssignmentApprovedAt } from '@/lib/assignments';
import { wallClockToStoredIso } from '@/lib/timeWorkflow';

export type TaskEquipmentOption = {
  id: string;
  name?: string | null;
  unitNumber?: string | null;
  type?: string | null;
  typeId?: string | null;
  status?: string | null;
  active?: boolean | null;
  estimatedHours?: number | null;
  hours?: number | null;
  lastService?: string | null;
  propertyId?: string | null;
};

interface TaskBlockProps {
  task: Task;
  assignment: Assignment;
  properties: Property[];
  shiftEndTime: string | null;
  equipmentUnits?: TaskEquipmentOption[];
  favoriteEquipmentTypeIds?: ReadonlySet<string>;
  equipmentOverdueThresholdDays?: number;
  doubleBookedAssignmentIds?: ReadonlySet<string>;
  selectedAssignmentIds?: ReadonlySet<string>;
  onToggleSelect?: (assignmentId: string) => void;
  onAssignEquipment?: (assignment: Assignment, equipmentId: string) => void;
  savingEquipmentAssignmentId?: string | null;
  operationalTimezone?: string;
  priorityIndex?: number;
  onEdit?: () => void;
  onRemove?: () => void;
  draggable?: boolean;
  sortableId?: string;
  sortableData?: { type: 'assignment'; employeeId: string; assignmentId: string };
}

function normalizeStatus(status?: string) {
  const value = String(status ?? '').toLowerCase();
  if (value === 'in-progress' || value === 'in_progress') return 'in-progress';
  if (value === 'done' || value === 'complete' || value === 'completed') return 'done';
  return 'planned';
}

function statusContainerClass(status: string) {
  if (status === 'in-progress') return 'border-l-[3px] border-l-status-complete bg-surface-card';
  if (status === 'done') return 'border-l-[3px] border-l-status-active bg-surface-card';
  return 'border-l-[3px] border-l-status-hold bg-surface-card';
}

function statusDotClass(status: string) {
  if (status === 'in-progress') return 'bg-status-complete';
  if (status === 'done') return 'bg-status-active';
  return 'bg-status-hold';
}

function formatEquipmentLabel(unit: TaskEquipmentOption) {
  const label = unit.unitNumber || unit.name || 'Equipment';
  const meter = Number(unit.estimatedHours ?? unit.hours ?? 0);
  const meterLabel = Number.isFinite(meter) ? `${meter.toFixed(1)}h` : '0.0h';
  return `${label} - ${meterLabel}`;
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
  equipmentUnits = [],
  favoriteEquipmentTypeIds,
  equipmentOverdueThresholdDays = 90,
  doubleBookedAssignmentIds,
  selectedAssignmentIds,
  onToggleSelect,
  onAssignEquipment,
  savingEquipmentAssignmentId,
  operationalTimezone = 'America/New_York',
  priorityIndex,
  onEdit,
  onRemove,
  draggable,
  sortableId,
  sortableData,
}: TaskBlockProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [equipmentMode, setEquipmentMode] = useState<'favorites' | 'all'>('favorites');
  const equipment = assignment.equipmentId ? equipmentUnits.find((unit) => unit.id === assignment.equipmentId) : null;
  const selectableEquipmentUnits = useMemo(
    () =>
      equipmentUnits.filter(
        (unit) => unit.active !== false && String(unit.status ?? '').toLowerCase() === 'available',
      ),
    [equipmentUnits],
  );
  const favoriteEquipmentUnits = useMemo(
    () => selectableEquipmentUnits.filter((unit) => unit.typeId && favoriteEquipmentTypeIds?.has(unit.typeId)),
    [favoriteEquipmentTypeIds, selectableEquipmentUnits],
  );
  const visibleEquipmentUnits =
    equipmentMode === 'favorites' && favoriteEquipmentUnits.length > 0 ? favoriteEquipmentUnits : selectableEquipmentUnits;
  const currentEquipmentInVisibleList =
    !assignment.equipmentId || visibleEquipmentUnits.some((unit) => unit.id === assignment.equipmentId);
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
  const isEquipmentDoubleBooked = assignment.id ? Boolean(doubleBookedAssignmentIds?.has(assignment.id)) : false;
  const isSelected = assignment.id ? Boolean(selectedAssignmentIds?.has(assignment.id)) : false;
  const isSubmittedToPayroll = Boolean(getAssignmentApprovedAt(assignment));
  const isSavingEquipment = savingEquipmentAssignmentId === assignment.id;
  const canAssignEquipment = Boolean(assignment.id && onAssignEquipment && !isSubmittedToPayroll);
  const dndDisabled = !draggable || isSubmittedToPayroll || !sortableId;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: sortableId ?? `assignment:${assignment.id ?? task.id}`,
    data: sortableData,
    disabled: dndDisabled,
  });
  const canSelect = Boolean(assignment.id && onToggleSelect);
  const status = normalizeStatus(assignment.status);
  const assignmentRecord = assignment as Assignment & Record<string, unknown>;
  const publishValue = assignmentRecord.isPublished ?? assignmentRecord.is_published;
  const isPublished = typeof publishValue === 'boolean'
    ? publishValue
    : typeof publishValue === 'string'
      ? publishValue.toLowerCase() === 'true'
      : true;

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
      ? 'text-text-muted'
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
  const statusBadgeVariant = status === 'in-progress' ? 'complete' : status === 'done' ? 'active' : 'hold';

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
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`grid min-h-[46px] grid-cols-[auto_minmax(0,1.7fr)_auto_auto] items-center gap-2 overflow-hidden rounded-lg border px-2.5 py-2 text-xs transition-all hover:shadow-sm ${statusContainerClass(status)} ${isPublished ? 'border-status-active/20 shadow-[inset_3px_0_0_oklch(var(--status-active))]' : 'border-dashed border-status-pending/60 bg-status-pending/10 shadow-[inset_3px_0_0_oklch(var(--status-pending))]'} ${isSelected ? 'ring-1 ring-brand/40 bg-brand/5' : ''} ${!dndDisabled ? 'cursor-grab active:cursor-grabbing' : ''} ${isDragging ? 'opacity-60 ring-2 ring-brand/20' : ''}`}
      {...(!dndDisabled ? attributes : {})}
      {...(!dndDisabled ? listeners : {})}
    >
      {canSelect ? (
        <input
          type="checkbox"
          aria-label={`Select ${task.name}`}
          checked={isSelected}
          onChange={() => assignment.id && !isSubmittedToPayroll && onToggleSelect?.(assignment.id)}
          onClick={(event) => event.stopPropagation()}
          disabled={isSubmittedToPayroll}
          className="h-3.5 w-3.5 shrink-0 rounded border-surface-border accent-brand disabled:cursor-not-allowed disabled:opacity-50"
        />
      ) : (
        <span className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      )}
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
          <span className={`h-2 w-2 shrink-0 rounded-full ${statusDotClass(status)}`} aria-hidden="true" />
          <span className={`truncate text-sm font-semibold text-text-primary ${status === 'done' ? 'line-through text-text-muted' : ''}`}>
            {task.name}
          </span>
        </div>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-text-muted">
          {status === 'in-progress' && elapsedLabel ? (
            <span className="flex shrink-0 items-center gap-1 text-2xs text-text-muted">
              <span>Live {elapsedLabel}</span>
              {isElapsedCappedAtShiftEnd ? (
                <Badge variant="outline" className="gap-1 border-status-pending/20 bg-status-pending/10 px-1.5 py-0 text-3xs text-status-pending">
                  <span className="h-1.5 w-1.5 rounded-full bg-status-pending" aria-hidden="true" />
                  Past shift end
                </Badge>
              ) : null}
            </span>
          ) : null}
          {status === 'done' && doneLabel ? <span className="shrink-0 text-2xs text-text-muted">{doneLabel}</span> : null}
          <Badge variant="outline" className="shrink-0 text-3xs">{task.category}</Badge>
          {typeof priorityIndex === 'number' ? <Badge variant="secondary" className="shrink-0 text-3xs">#{priorityIndex + 1}</Badge> : null}
          <Badge variant="outline" className="shrink-0 text-3xs">{propertyLabel}</Badge>
        </div>
      </div>

      <div className="flex min-w-[72px] flex-col items-end justify-center">
        <span className="text-3xs font-semibold uppercase tracking-wide text-text-muted">Duration</span>
        <span className="font-mono text-sm font-semibold text-text-primary">
          {estimatedHours > 0 ? `${estimatedHours.toFixed(1)}h` : '—'}
        </span>
        {actualHours != null ? <span className={`text-3xs ${actualHoursTone}`}>{actualHours.toFixed(1)}h actual</span> : null}
      </div>

      <div className="flex min-w-[150px] flex-col items-end justify-center gap-1 text-2xs text-text-muted">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={favoriteEquipmentUnits.length === 0 || !canAssignEquipment}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              setEquipmentMode('favorites');
            }}
            className={`rounded-full border px-1.5 py-0.5 text-4xs font-semibold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${equipmentMode === 'favorites' && favoriteEquipmentUnits.length > 0 ? 'border-status-pending/30 bg-status-pending/10 text-status-pending' : 'border-surface-border bg-surface-card text-text-muted'}`}
          >
            Favorites
          </button>
          <button
            type="button"
            disabled={!canAssignEquipment}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              setEquipmentMode('all');
            }}
            className={`rounded-full border px-1.5 py-0.5 text-4xs font-semibold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${equipmentMode === 'all' || favoriteEquipmentUnits.length === 0 ? 'border-status-active/30 bg-status-active/10 text-status-active' : 'border-surface-border bg-surface-card text-text-muted'}`}
          >
            All
          </button>
        </div>
        <div className="flex w-full items-center justify-end gap-1.5">
        <Wrench className={`h-3.5 w-3.5 shrink-0 ${equipment ? 'text-text-secondary' : 'text-text-muted/70'}`} aria-hidden="true" />
        <select
          value={assignment.equipmentId ?? ''}
          disabled={!canAssignEquipment || isSavingEquipment}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => onAssignEquipment?.(assignment, event.target.value)}
          className="h-8 max-w-[132px] rounded-md border border-surface-border bg-surface-elevated px-2 text-2xs text-text-primary shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={`Assign equipment to ${task.name}`}
          title={equipment ? `${formatEquipmentLabel(equipment)} meter` : 'No equipment assigned'}
        >
          <option value="">No equipment</option>
          {!currentEquipmentInVisibleList && equipment ? (
            <option value={equipment.id}>{formatEquipmentLabel(equipment)}</option>
          ) : null}
          {visibleEquipmentUnits.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {formatEquipmentLabel(unit)}
            </option>
          ))}
        </select>
        {isSavingEquipment ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-text-muted" aria-label="Saving equipment assignment" /> : null}
        {isEquipmentOverdue ? (
          <AlertTriangle
            className="h-3.5 w-3.5 shrink-0 text-status-pending"
            aria-label="Equipment overdue for service"
          />
        ) : null}
        {isEquipmentDoubleBooked ? (
          <CircleAlert
            className="h-3.5 w-3.5 shrink-0 text-status-warning"
            aria-label="Equipment time-window conflict"
          />
        ) : null}
        </div>
      </div>

      <div className="flex items-start gap-1 pt-0.5">
        <Badge variant={statusBadgeVariant} className="hidden shrink-0 text-3xs sm:inline-flex">
          {status === 'in-progress' ? 'In Progress' : status === 'done' ? 'Done' : 'Planned'}
        </Badge>
        <Badge
          variant={isPublished ? 'active' : 'pending'}
          className="hidden shrink-0 text-3xs uppercase tracking-wide md:inline-flex"
        >
          {isPublished ? 'Published' : 'Draft'}
        </Badge>
        {isSubmittedToPayroll ? (
          <Badge variant="complete" className="hidden shrink-0 text-3xs lg:inline-flex">
            Payroll
          </Badge>
        ) : null}
        {onEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-full p-2"
            onClick={onEdit}
            disabled={isSubmittedToPayroll}
            aria-label="Edit task"
            title={isSubmittedToPayroll ? 'Submitted to payroll - review only' : 'Edit task'}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ) : null}
        {onRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-full p-2"
            onClick={onRemove}
            disabled={isSubmittedToPayroll}
            aria-label="Remove task"
            title={isSubmittedToPayroll ? 'Submitted to payroll - review only' : 'Remove task'}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
