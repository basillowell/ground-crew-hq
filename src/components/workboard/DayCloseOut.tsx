import { Fragment, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CloudRain, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TimeSelect } from '@/components/TimeSelect';
import { CardSkeleton } from '@/components/CardSkeleton';
import { ErrorRetry } from '@/components/ErrorRetry';
import type { Assignment, Employee, Property, Task } from '@/data/seedData';
import { getAssignmentApprovedAt } from '@/lib/assignments';
import { storedIsoToWallClock } from '@/lib/timeWorkflow';

export type DayCloseOutSaveOptions = {
  markComplete?: boolean;
};

export type DayCloseOutLane = {
  employee: Employee;
  assignments: Assignment[];
  shiftStart: string;
};

type DayCloseOutProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lanes: DayCloseOutLane[];
  tasks: Task[];
  boardDate: string;
  operationalTimezone: string;
  nowTime: string;
  isLoading: boolean;
  errorMessage: string;
  onRetry: () => void;
  onSaveAssignmentTimes: (
    assignment: Assignment,
    employeeAssignments: Assignment[],
    startInput: string,
    endInput: string,
    options?: DayCloseOutSaveOptions,
  ) => Promise<boolean>;
};

export type ChainedAssignmentRow = {
  assignment: Assignment;
  start: string;
  end: string;
  hours: number;
};

function timeToMinutes(value?: string) {
  if (!value) return 0;
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}

function normalizeReviewTimeInput(value?: string) {
  const [rawHour, rawMinute] = String(value || '').split(':');
  const hour = Number(rawHour);
  const minute = Number(rawMinute);
  if (!Number.isFinite(hour) || hour < 0 || hour > 23 || !Number.isFinite(minute) || minute < 0 || minute > 59) return '';
  const roundedMinute = Math.round(minute / 5) * 5;
  if (roundedMinute >= 60) {
    return `${String((hour + 1) % 24).padStart(2, '0')}:00`;
  }
  return `${String(hour).padStart(2, '0')}:${String(roundedMinute).padStart(2, '0')}`;
}

function getAssignmentId(assignment: Assignment, fallbackIndex: number) {
  return assignment.id ?? `assignment-${fallbackIndex}`;
}

function getActualStartInput(assignment: Assignment, timezone: string) {
  const assignmentRecord = assignment as Assignment & Record<string, unknown>;
  const source =
    assignment.actualStartAt ??
    assignment.actual_start_at ??
    (typeof assignmentRecord.actual_start_at === 'string' ? String(assignmentRecord.actual_start_at) : null);
  return source ? normalizeReviewTimeInput(storedIsoToWallClock(source, timezone)) : '';
}

function getActualEndInput(assignment: Assignment, timezone: string) {
  const assignmentRecord = assignment as Assignment & Record<string, unknown>;
  const source =
    assignment.actualCompletedAt ??
    assignment.actual_completed_at ??
    assignment.completedAt ??
    assignment.completed_at ??
    (typeof assignmentRecord.actual_completed_at === 'string'
      ? String(assignmentRecord.actual_completed_at)
      : typeof assignmentRecord.completed_at === 'string'
        ? String(assignmentRecord.completed_at)
        : null);
  return source ? normalizeReviewTimeInput(storedIsoToWallClock(source, timezone)) : '';
}

function normalizeStatus(status: string | null | undefined) {
  const value = String(status ?? '').trim().toLowerCase();
  if (value === 'in_progress' || value === 'in-progress' || value === 'active' || value === 'started') return 'in-progress';
  if (value === 'done' || value === 'complete' || value === 'completed') return 'done';
  return 'planned';
}

function calculateHours(start: string, end: string) {
  return Math.max(0, timeToMinutes(end) - timeToMinutes(start)) / 60;
}

export function getChainedAssignmentRows({
  assignments,
  shiftStart,
  nowTime,
  timezone,
  startOverrides = {},
  endOverrides = {},
}: {
  assignments: Assignment[];
  shiftStart: string;
  nowTime: string;
  timezone: string;
  startOverrides?: Record<string, string>;
  endOverrides?: Record<string, string>;
}): ChainedAssignmentRow[] {
  let nextDefaultStart = normalizeReviewTimeInput(shiftStart) || normalizeReviewTimeInput(nowTime);

  return assignments.map((assignment, index) => {
    const assignmentId = getAssignmentId(assignment, index);
    const actualStart = getActualStartInput(assignment, timezone);
    const chainedStart = actualStart || nextDefaultStart || normalizeReviewTimeInput(shiftStart) || normalizeReviewTimeInput(nowTime);
    const start = normalizeReviewTimeInput(startOverrides[assignmentId] ?? chainedStart);
    const actualEnd = getActualEndInput(assignment, timezone);
    const end = normalizeReviewTimeInput(endOverrides[assignmentId] ?? (actualEnd || nowTime));
    const hours = calculateHours(start, end);

    nextDefaultStart = end || normalizeReviewTimeInput(shiftStart) || normalizeReviewTimeInput(nowTime);
    return { assignment, start, end, hours };
  });
}

export function getChainedAssignmentStartTime({
  assignment,
  assignments,
  shiftStart,
  nowTime,
  timezone,
}: {
  assignment: Assignment;
  assignments: Assignment[];
  shiftStart: string;
  nowTime: string;
  timezone: string;
}) {
  const targetId = assignment.id ?? '';
  const rows = getChainedAssignmentRows({ assignments, shiftStart, nowTime, timezone });
  return rows.find((row) => row.assignment.id === targetId)?.start ?? shiftStart ?? nowTime;
}

function getTaskName(assignment: Assignment, tasks: Task[]) {
  if (assignment.title) return assignment.title;
  return tasks.find((task) => task.id === assignment.taskId)?.name ?? 'Task';
}

function getTaskCategory(assignment: Assignment, tasks: Task[]) {
  return tasks.find((task) => task.id === assignment.taskId)?.category ?? 'General';
}

function getTaskIsUnpaid(assignment: Assignment, tasks: Task[]) {
  const task = tasks.find((taskItem) => taskItem.id === assignment.taskId);
  return Boolean(task?.isUnpaid ?? task?.is_unpaid);
}

export function DayCloseOutReviewRows({
  rows,
  tasks,
  disabled = false,
  readOnlyAssignmentIds,
  showScheduledHours = false,
  properties = [],
  onTaskChange,
  onPropertyChange,
  onStartChange,
  onEndChange,
  onDelete,
  deletingAssignmentId,
  deleteDisabled = false,
  onInsertBreak,
  insertBreakDisabled = false,
  insertingBreakIndex = null,
  onInsertTask,
  insertTaskDisabled = false,
  insertingTaskIndex = null,
}: {
  rows: ChainedAssignmentRow[];
  tasks: Task[];
  disabled?: boolean;
  readOnlyAssignmentIds?: ReadonlySet<string>;
  showScheduledHours?: boolean;
  properties?: Property[];
  onTaskChange?: (assignmentId: string, taskId: string) => void;
  onPropertyChange?: (assignmentId: string, propertyId: string) => void;
  onStartChange?: (assignmentId: string, startTime: string) => void;
  onEndChange: (assignmentId: string, endTime: string) => void;
  onDelete?: (assignmentId: string) => void;
  deletingAssignmentId?: string | null;
  deleteDisabled?: boolean;
  onInsertBreak?: (insertIndex: number) => void;
  insertBreakDisabled?: boolean;
  insertingBreakIndex?: number | null;
  onInsertTask?: (insertIndex: number, taskId: string) => void;
  insertTaskDisabled?: boolean;
  insertingTaskIndex?: number | null;
}) {
  const [insertTaskSelections, setInsertTaskSelections] = useState<Record<number, string>>({});
  const groupedTasks = useMemo(() => {
    return tasks.reduce<Record<string, Task[]>>((groups, task) => {
      const category = task.category || 'General';
      groups[category] = groups[category] ?? [];
      groups[category].push(task);
      return groups;
    }, {});
  }, [tasks]);
  const orderedTaskCategories = useMemo(() => Object.keys(groupedTasks).sort((a, b) => a.localeCompare(b)), [groupedTasks]);
  const templateClass = showScheduledHours
    ? 'sm:grid-cols-[minmax(180px,1fr)_minmax(160px,0.8fr)_96px_176px_176px_116px]'
    : 'sm:grid-cols-[minmax(180px,1fr)_minmax(160px,0.8fr)_176px_176px_116px]';
  const renderInsertActions = (insertIndex: number, breakLabel: string, taskLabel: string) => {
    if (!onInsertBreak && !onInsertTask) return null;
    const isInsertingBreak = insertingBreakIndex === insertIndex;
    const isInsertingTask = insertingTaskIndex === insertIndex;
    return (
      <div className="flex flex-wrap gap-2 bg-surface-base px-3 py-2">
        {onInsertBreak ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-9 gap-2 border-dashed text-xs text-text-secondary hover:text-text-primary"
            onClick={() => onInsertBreak(insertIndex)}
            disabled={insertBreakDisabled || isInsertingBreak}
          >
            {isInsertingBreak ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            {breakLabel}
          </Button>
        ) : null}
        {onInsertTask ? (
          <label className="relative">
            <span className="sr-only">{taskLabel}</span>
            {isInsertingTask ? (
              <Loader2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-text-muted" />
            ) : (
              <Plus className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            )}
            <select
              value={insertTaskSelections[insertIndex] ?? ''}
              onChange={(event) => {
                const taskId = event.target.value;
                setInsertTaskSelections((current) => ({ ...current, [insertIndex]: taskId }));
                if (!taskId) return;
                onInsertTask(insertIndex, taskId);
                setInsertTaskSelections((current) => ({ ...current, [insertIndex]: '' }));
              }}
              disabled={insertTaskDisabled || isInsertingTask || tasks.length === 0}
              className="h-9 min-w-[220px] rounded-md border border-dashed border-input bg-background pl-8 pr-8 text-xs text-text-secondary hover:text-text-primary focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-70"
            >
              <option value="">{taskLabel}</option>
              {orderedTaskCategories.map((category) => (
                <optgroup key={category} label={category}>
                  {groupedTasks[category].map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.name} ({Number(task.estimatedHours ?? task.estimated_hours ?? 0)}h)
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    );
  };
  return (
    <div className="overflow-hidden rounded-xl border border-surface-border">
      <div className={`grid grid-cols-1 gap-3 bg-surface-elevated px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted ${templateClass}`}>
        <span>Task</span>
        <span>Property</span>
        {showScheduledHours ? <span>Scheduled</span> : null}
        <span>Start</span>
        <span>End</span>
        <span className="text-right">Hours</span>
      </div>
      <div className="divide-y divide-surface-border">
        {renderInsertActions(0, 'Insert break before first task', 'Insert task before first task')}
        {rows.map((row, index) => {
          const assignmentId = getAssignmentId(row.assignment, index);
          const status = normalizeStatus(row.assignment.status);
          const isDeleting = deletingAssignmentId === assignmentId;
          const isUnpaid = getTaskIsUnpaid(row.assignment, tasks);
          const isSubmittedToPayroll = Boolean(getAssignmentApprovedAt(row.assignment) || readOnlyAssignmentIds?.has(assignmentId));
          const isRowReadOnly = disabled || isSubmittedToPayroll;
          return (
            <Fragment key={assignmentId}>
            <div
              className={`grid grid-cols-1 gap-3 px-3 py-3 sm:items-center ${templateClass}`}
            >
              <div className="min-w-0">
                {onTaskChange ? (
                  <label className="block text-[10px] font-medium uppercase tracking-wide text-text-muted sm:normal-case sm:tracking-normal">
                    <span className="sm:hidden">Task</span>
                    <select
                      value={row.assignment.taskId ?? ''}
                      onChange={(event) => onTaskChange(assignmentId, event.target.value)}
                      disabled={isRowReadOnly}
                      className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <option value="">General assignment</option>
                      {orderedTaskCategories.map((category) => (
                        <optgroup key={category} label={category}>
                          {groupedTasks[category].map((task) => (
                            <option key={task.id} value={task.id}>
                              {task.name} ({Number(task.estimatedHours ?? task.estimated_hours ?? 0)}h)
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p className="truncate text-sm font-medium text-text-primary">{getTaskName(row.assignment, tasks)}</p>
                )}
                <div className="mt-1 flex flex-wrap gap-2">
                  <Badge variant="secondary" className="text-[10px] capitalize">
                    {status}
                  </Badge>
                  {showScheduledHours ? (
                    <Badge variant="outline" className="text-[10px]">
                      {getTaskCategory(row.assignment, tasks)}
                    </Badge>
                  ) : null}
                  {isUnpaid ? (
                    <Badge variant="outline" className="border-status-pending/40 text-[10px] text-status-pending">
                      Unpaid
                    </Badge>
                  ) : null}
                  {isSubmittedToPayroll ? (
                    <Badge variant="complete" className="text-[10px]">
                      Submitted to payroll &mdash; review only
                    </Badge>
                  ) : null}
                </div>
              </div>
              <label className="text-[10px] font-medium uppercase tracking-wide text-text-muted sm:normal-case sm:tracking-normal">
                <span className="sm:hidden">Property</span>
                {onPropertyChange ? (
                  <select
                    value={row.assignment.propertyId ?? ''}
                    onChange={(event) => onPropertyChange(assignmentId, event.target.value)}
                    disabled={isRowReadOnly || properties.length === 0}
                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <option value="">Choose property</option>
                    {properties.map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="mt-1 truncate text-sm text-text-primary">
                    {properties.find((property) => property.id === row.assignment.propertyId)?.name ?? row.assignment.area ?? 'Assigned property'}
                  </p>
                )}
              </label>
              {showScheduledHours ? (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-text-muted sm:hidden">Scheduled</p>
                  <p className="font-mono text-sm text-text-primary">{Number(row.assignment.estimatedHours ?? 0).toFixed(1)}h</p>
                </div>
              ) : null}
              <label className="text-[10px] font-medium uppercase tracking-wide text-text-muted sm:normal-case sm:tracking-normal">
                <span className="sm:hidden">Start</span>
                {onStartChange ? (
                  <TimeSelect
                    value={row.start}
                    onChange={(value) => onStartChange(assignmentId, value)}
                    disabled={isRowReadOnly}
                  />
                ) : (
                  <p className="font-mono text-sm text-text-primary">{row.start}</p>
                )}
              </label>
              <label className="text-[10px] font-medium uppercase tracking-wide text-text-muted sm:normal-case sm:tracking-normal">
                <span className="sm:hidden">End</span>
                <TimeSelect
                  value={row.end}
                  onChange={(value) => onEndChange(assignmentId, value)}
                  disabled={isRowReadOnly}
                />
              </label>
              <div className="flex items-center justify-between gap-2 sm:justify-end">
                <div className="text-left sm:text-right">
                  <p className="text-[10px] uppercase tracking-wide text-text-muted sm:hidden">Hours</p>
                  <p className="font-mono text-sm font-semibold text-text-primary">{row.hours.toFixed(2)}</p>
                </div>
                {onDelete ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0 text-status-warning hover:bg-status-warning/10 hover:text-status-warning"
                    onClick={() => onDelete(assignmentId)}
                    disabled={deleteDisabled || isDeleting || isSubmittedToPayroll}
                    aria-label={`Delete ${getTaskName(row.assignment, tasks)}`}
                    title="Delete assignment"
                  >
                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                ) : null}
              </div>
            </div>
            {renderInsertActions(
              index + 1,
              index === rows.length - 1 ? 'Insert break after last task' : 'Insert break here',
              index === rows.length - 1 ? 'Insert task after last task' : 'Insert task here',
            )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

export function DayCloseOut({
  open,
  onOpenChange,
  lanes,
  tasks,
  boardDate,
  operationalTimezone,
  nowTime,
  isLoading,
  errorMessage,
  onRetry,
  onSaveAssignmentTimes,
}: DayCloseOutProps) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [endOverrides, setEndOverrides] = useState<Record<string, string>>({});
  const [rainedOutTime, setRainedOutTime] = useState(nowTime);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const firstLane = lanes.find((lane) => lane.assignments.length > 0) ?? lanes[0];
    setSelectedEmployeeId((current) =>
      current && lanes.some((lane) => lane.employee.id === current)
        ? current
        : firstLane?.employee.id ?? '',
    );
    setRainedOutTime(nowTime);
  }, [lanes, nowTime, open]);

  useEffect(() => {
    if (!open) {
      setEndOverrides({});
      setSaveError(null);
      setIsSaving(false);
    }
  }, [open]);

  const selectedLane = lanes.find((lane) => lane.employee.id === selectedEmployeeId) ?? lanes[0] ?? null;
  const rows = useMemo(
    () =>
      selectedLane
        ? getChainedAssignmentRows({
            assignments: selectedLane.assignments,
            shiftStart: selectedLane.shiftStart,
            nowTime,
            timezone: operationalTimezone,
            endOverrides,
          })
        : [],
    [endOverrides, nowTime, operationalTimezone, selectedLane],
  );
  const totalHours = rows.reduce((sum, row) => sum + row.hours, 0);
  const inProgressRow =
    rows.find((row) => normalizeStatus(row.assignment.status) === 'in-progress') ??
    rows.find((row) => getActualStartInput(row.assignment, operationalTimezone) && !getActualEndInput(row.assignment, operationalTimezone));

  const handleSaveAll = async () => {
    if (!selectedLane || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    for (const row of rows) {
      if (!row.assignment.id) continue;
      const saved = await onSaveAssignmentTimes(row.assignment, selectedLane.assignments, row.start, row.end, { markComplete: true });
      if (!saved) {
        setSaveError('Close out day could not be saved. Retry after checking the highlighted task.');
        setIsSaving(false);
        return;
      }
    }
    setIsSaving(false);
    onOpenChange(false);
  };

  const handleRainedOut = async () => {
    if (!selectedLane || !inProgressRow?.assignment.id || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    setEndOverrides((current) => ({ ...current, [inProgressRow.assignment.id ?? '']: rainedOutTime }));
    const saved = await onSaveAssignmentTimes(
      inProgressRow.assignment,
      selectedLane.assignments,
      inProgressRow.start,
      rainedOutTime,
      { markComplete: true },
    );
    if (!saved) {
      setSaveError('Rained out could not be saved. Retry after checking the time.');
    }
    setIsSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!isSaving ? onOpenChange(nextOpen) : undefined)}>
      <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Close out day</DialogTitle>
          <DialogDescription>
            Review start, end, and hours for {boardDate}.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <CardSkeleton />
        ) : errorMessage ? (
          <ErrorRetry message={errorMessage} onRetry={onRetry} />
        ) : !selectedLane ? (
          <div className="rounded-xl border border-dashed bg-surface-elevated p-6 text-center text-sm text-text-muted">
            No crew scheduled for this day.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-xl border border-surface-border bg-surface-elevated p-3 sm:flex-row sm:items-end sm:justify-between">
              <label className="text-xs font-medium text-text-muted">
                Employee
                <select
                  value={selectedLane.employee.id}
                  onChange={(event) => {
                    setSelectedEmployeeId(event.target.value);
                    setEndOverrides({});
                    setSaveError(null);
                  }}
                  className="mt-1 h-10 w-full rounded-md border border-surface-border bg-surface-base px-3 text-sm text-text-primary sm:w-64"
                >
                  {lanes.map((lane) => (
                    <option key={lane.employee.id} value={lane.employee.id}>
                      {lane.employee.firstName} {lane.employee.lastName}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-wrap items-end gap-2">
                <label className="w-40 text-xs font-medium text-text-muted">
                  Rained out at
                  <TimeSelect value={rainedOutTime} onChange={setRainedOutTime} />
                </label>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-10 gap-2"
                  onClick={() => void handleRainedOut()}
                  disabled={isSaving || !inProgressRow}
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudRain className="h-4 w-4" />}
                  Rained out
                </Button>
              </div>
            </div>

            {rows.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-surface-elevated p-6 text-center text-sm text-text-muted">
                No tasks assigned.
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-surface-border">
                <div className="grid grid-cols-[minmax(0,1fr)_96px_176px_92px] gap-3 bg-surface-elevated px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                  <span>Task</span>
                  <span>Start</span>
                  <span>End</span>
                  <span className="text-right">Hours</span>
                </div>
                <div className="divide-y divide-surface-border">
                  {rows.map((row, index) => {
                    const assignmentId = getAssignmentId(row.assignment, index);
                    const status = normalizeStatus(row.assignment.status);
                    return (
                      <div
                        key={assignmentId}
                        className="grid grid-cols-1 gap-3 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_96px_176px_92px] sm:items-center"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-text-primary">{getTaskName(row.assignment, tasks)}</p>
                          <div className="mt-1 flex flex-wrap gap-2">
                            <Badge variant="secondary" className="text-[10px] capitalize">
                              {status}
                            </Badge>
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-text-muted sm:hidden">Start</p>
                          <p className="font-mono text-sm text-text-primary">{row.start}</p>
                        </div>
                        <label className="text-[10px] font-medium uppercase tracking-wide text-text-muted sm:normal-case sm:tracking-normal">
                          <span className="sm:hidden">End</span>
                          <TimeSelect
                            value={row.end}
                            onChange={(value) => setEndOverrides((current) => ({ ...current, [assignmentId]: value }))}
                          />
                        </label>
                        <div className="text-left sm:text-right">
                          <p className="text-[10px] uppercase tracking-wide text-text-muted sm:hidden">Hours</p>
                          <p className="font-mono text-sm font-semibold text-text-primary">{row.hours.toFixed(2)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 rounded-xl border border-surface-border bg-surface-elevated p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-text-muted">Total hours</p>
                <p className="font-mono text-2xl font-semibold text-text-primary">{totalHours.toFixed(2)}</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {saveError ? (
                  <p className="text-sm text-status-warning">{saveError}</p>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-10 gap-2"
                  onClick={onRetry}
                  disabled={isSaving}
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </Button>
                <Button
                  type="button"
                  className="min-h-10 gap-2"
                  onClick={() => void handleSaveAll()}
                  disabled={isSaving || rows.length === 0}
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
