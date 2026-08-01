import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CloudRain, Loader2, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TimeSelect } from '@/components/TimeSelect';
import { CardSkeleton } from '@/components/CardSkeleton';
import { ErrorRetry } from '@/components/ErrorRetry';
import type { Assignment, Employee, Task } from '@/data/seedData';
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

function getAssignmentId(assignment: Assignment, fallbackIndex: number) {
  return assignment.id ?? `assignment-${fallbackIndex}`;
}

function getActualStartInput(assignment: Assignment, timezone: string) {
  const assignmentRecord = assignment as Assignment & Record<string, unknown>;
  const source =
    assignment.actualStartAt ??
    assignment.actual_start_at ??
    (typeof assignmentRecord.actual_start_at === 'string' ? String(assignmentRecord.actual_start_at) : null);
  return source ? storedIsoToWallClock(source, timezone) : '';
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
  return source ? storedIsoToWallClock(source, timezone) : '';
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
  endOverrides = {},
}: {
  assignments: Assignment[];
  shiftStart: string;
  nowTime: string;
  timezone: string;
  endOverrides?: Record<string, string>;
}): ChainedAssignmentRow[] {
  let nextDefaultStart = shiftStart || nowTime;

  return assignments.map((assignment, index) => {
    const assignmentId = getAssignmentId(assignment, index);
    const actualStart = getActualStartInput(assignment, timezone);
    const start = actualStart || nextDefaultStart || shiftStart || nowTime;
    const actualEnd = getActualEndInput(assignment, timezone);
    const end = endOverrides[assignmentId] ?? (actualEnd || nowTime);
    const hours = calculateHours(start, end);

    nextDefaultStart = end || shiftStart || nowTime;
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

export function DayCloseOutReviewRows({
  rows,
  tasks,
  disabled = false,
  showScheduledHours = false,
  onEndChange,
}: {
  rows: ChainedAssignmentRow[];
  tasks: Task[];
  disabled?: boolean;
  showScheduledHours?: boolean;
  onEndChange: (assignmentId: string, endTime: string) => void;
}) {
  const templateClass = showScheduledHours
    ? 'sm:grid-cols-[minmax(0,1fr)_96px_96px_176px_92px]'
    : 'sm:grid-cols-[minmax(0,1fr)_96px_176px_92px]';
  return (
    <div className="overflow-hidden rounded-xl border border-surface-border">
      <div className={`grid grid-cols-1 gap-3 bg-surface-elevated px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted ${templateClass}`}>
        <span>Task</span>
        {showScheduledHours ? <span>Scheduled</span> : null}
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
              className={`grid grid-cols-1 gap-3 px-3 py-3 sm:items-center ${templateClass}`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text-primary">{getTaskName(row.assignment, tasks)}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Badge variant="secondary" className="text-[10px] capitalize">
                    {status}
                  </Badge>
                  {showScheduledHours ? (
                    <Badge variant="outline" className="text-[10px]">
                      {getTaskCategory(row.assignment, tasks)}
                    </Badge>
                  ) : null}
                </div>
              </div>
              {showScheduledHours ? (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-text-muted sm:hidden">Scheduled</p>
                  <p className="font-mono text-sm text-text-primary">{Number(row.assignment.estimatedHours ?? 0).toFixed(1)}h</p>
                </div>
              ) : null}
              <div>
                <p className="text-[10px] uppercase tracking-wide text-text-muted sm:hidden">Start</p>
                <p className="font-mono text-sm text-text-primary">{row.start}</p>
              </div>
              <label className="text-[10px] font-medium uppercase tracking-wide text-text-muted sm:normal-case sm:tracking-normal">
                <span className="sm:hidden">End</span>
                <TimeSelect
                  value={row.end}
                  onChange={(value) => onEndChange(assignmentId, value)}
                  className={disabled ? 'pointer-events-none opacity-70' : ''}
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
