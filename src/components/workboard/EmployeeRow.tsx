import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AvatarInitials } from '@/components/shared';
import { TimeSelect } from '@/components/TimeSelect';
import { TaskBlock } from './TaskBlock';
import { CheckCircle2, Clock3, GripVertical, Loader2, Pencil, Play, Plus } from 'lucide-react';
import { useState } from 'react';
import type { Employee, Assignment, Task, Property } from '@/data/seedData';
import { storedIsoToWallClock, storedIsoToWallClockLabel } from '@/lib/timeWorkflow';

interface EmployeeRowProps {
  employee: Employee;
  assignments: Assignment[];
  tasks: Task[];
  properties: Property[];
  shiftLabel?: string;
  laneSummary?: string;
  laneWarning?: string;
  orderIndex?: number;
  isDragging?: boolean;
  isDropTarget?: boolean;
  onDragStart?: (employeeId: string) => void;
  onDragEnter?: (employeeId: string) => void;
  onDragEnd?: () => void;
  onDropRow?: (employeeId: string) => void;
  onAddTask?: (employeeId: string) => void;
  onEditAssignment?: (assignment: Assignment) => void;
  onRemoveAssignment?: (assignmentId: string) => void;
  onTaskDragStart?: (employeeId: string, assignmentId: string) => void;
  onTaskDropOnTask?: (employeeId: string, targetAssignmentId: string) => void;
  coveragePercent?: number;
  weatherWarningsByAssignment?: Record<string, Array<{ level: 'warning' | 'danger'; message: string }>>;
  assignmentTimelineById?: Record<string, { actualStartAt: string | null; actualCompletedAt: string | null }>;
  operationalTimezone?: string;
  onStartAssignment?: (assignment: Assignment) => Promise<void>;
  onCompleteAssignment?: (assignment: Assignment, employeeAssignments: Assignment[]) => Promise<void>;
  onSaveAssignmentTimes?: (assignment: Assignment, employeeAssignments: Assignment[], startInput: string, endInput: string) => void;
  savingTimelineAssignmentId?: string | null;
}

function coverageBadgeClass(coveragePercent: number | undefined) {
  if (typeof coveragePercent !== 'number') return 'bg-muted text-muted-foreground border-border';
  if (coveragePercent >= 80) return 'bg-green-100 text-green-800 border-green-200';
  if (coveragePercent >= 50) return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-red-100 text-red-800 border-red-200';
}

function normalizeStatus(status: string | null | undefined): string {
  if (!status) return 'planned';
  const s = status.toLowerCase().trim();
  if (s === 'done' || s === 'complete' || s === 'completed') return 'done';
  if (s === 'in-progress' || s === 'in_progress' || s === 'active' || s === 'started') return 'in-progress';
  return 'planned';
}

function timeToMinutes(value?: string) {
  if (!value) return 0;
  const [hours, minutes] = value.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
  return hours * 60 + minutes;
}

export function EmployeeRow({
  employee,
  assignments: employeeAssignments,
  tasks,
  properties,
  shiftLabel,
  laneSummary: _laneSummary,
  laneWarning,
  orderIndex,
  isDragging,
  isDropTarget,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onDropRow,
  onAddTask,
  onEditAssignment,
  onRemoveAssignment,
  onTaskDragStart,
  onTaskDropOnTask,
  coveragePercent,
  weatherWarningsByAssignment,
  assignmentTimelineById,
  operationalTimezone = 'America/New_York',
  onStartAssignment,
  onCompleteAssignment,
  onSaveAssignmentTimes,
  savingTimelineAssignmentId,
}: EmployeeRowProps) {
  const [editingTimelineAssignmentId, setEditingTimelineAssignmentId] = useState<string | null>(null);
  const [timelineStartInput, setTimelineStartInput] = useState('');
  const [timelineEndInput, setTimelineEndInput] = useState('');
  const sortedAssignments = [...employeeAssignments];

  const formatLabel = (value?: string | null) => {
    if (!value) return '';
    return storedIsoToWallClockLabel(value, operationalTimezone);
  };

  const toInputValue = (value?: string | null) => {
    if (!value) return '';
    return storedIsoToWallClock(value, operationalTimezone);
  };

  const getEstimatedHours = (assignment: Assignment) => {
    const assignmentRecord = assignment as Assignment & Record<string, unknown>;
    const explicit = Number(assignmentRecord.estimatedHours ?? assignmentRecord.estimated_hours ?? 0);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    return Math.max(0, Number(assignment.duration ?? 0) / 60);
  };

  const getActualHours = (assignment: Assignment, startAt?: string | null, completedAt?: string | null) => {
    const assignmentRecord = assignment as Assignment & Record<string, unknown>;
    // Prefer timestamps first so visible runtime reflects edited actual start/end immediately.
    if (startAt && completedAt) {
      const startHHMM = storedIsoToWallClock(startAt, operationalTimezone);
      const endHHMM = storedIsoToWallClock(completedAt, operationalTimezone);
      if (startHHMM && endHHMM) {
        const diffMinutes = timeToMinutes(endHHMM) - timeToMinutes(startHHMM);
        if (diffMinutes >= 0) return diffMinutes / 60;
      }
    }
    const explicit = Number(assignmentRecord.actualHours ?? assignmentRecord.actual_hours ?? 0);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    return 0;
  };

  const getActualHoursTone = (actualHours: number, estimatedHours: number) => {
    if (actualHours <= 0 || estimatedHours <= 0) return 'text-muted-foreground';
    const ratio = actualHours / estimatedHours;
    if (ratio <= 1) return 'text-emerald-700';
    if (ratio < 1.25) return 'text-amber-700';
    return 'text-red-700';
  };

  return (
    <Card
      className={`rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/30 ${
        isDropTarget ? 'border-primary shadow-md ring-2 ring-primary/20' : ''
      } ${isDragging ? 'opacity-60' : ''}`}
      style={{ overflow: 'visible' }}
      onDragOver={(event) => event.preventDefault()}
      onDragEnter={() => onDragEnter?.(employee.id)}
      onDrop={() => onDropRow?.(employee.id)}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          draggable
          onDragStart={() => onDragStart?.(employee.id)}
          onDragEnd={onDragEnd}
          className="mt-1 flex cursor-grab items-center gap-1 rounded-full border border-dashed px-2 py-1 text-[11px] text-muted-foreground/60 hover:border-primary/30 hover:text-primary"
          title="Drag to reorder employee lanes for the display board"
        >
          <GripVertical className="h-4 w-4" />
          <span>Lane</span>
        </button>
        <AvatarInitials firstName={employee.firstName} lastName={employee.lastName} size="md" className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold">{employee.firstName} {employee.lastName}</span>
            <span className="text-sm text-muted-foreground">{employee.role}</span>
            {typeof orderIndex === 'number' ? <Badge variant="secondary">Lane {orderIndex + 1}</Badge> : null}
            <Badge variant="outline" className="rounded-full bg-muted/40">{shiftLabel || 'No shift'}</Badge>
            <Badge variant="outline" className={`rounded-full ${coverageBadgeClass(coveragePercent)}`}>
              {typeof coveragePercent === 'number' ? `${Math.round(coveragePercent)}%` : '—'}
            </Badge>
            <Badge variant="outline" className="ml-auto rounded-full">{sortedAssignments.length} task{sortedAssignments.length === 1 ? '' : 's'}</Badge>
          </div>

          {laneWarning ? (
            <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              {laneWarning}
            </div>
          ) : null}

          <div className="space-y-2">
            {sortedAssignments.length === 0 ? (
              <div className="rounded-xl border border-dashed px-3 py-5 text-center">
                <p className="text-sm text-muted-foreground">No tasks assigned</p>
                <Button variant="outline" size="sm" className="mt-3 h-9 rounded-lg" onClick={() => onAddTask?.(employee.id)}>
                  + Assign Task
                </Button>
              </div>
            ) : (
              sortedAssignments.map((assignment) => {
                const task = tasks.find((item) => item.id === assignment.taskId);
                const assignmentStatus = normalizeStatus(assignment.status);
                const timeline = assignmentTimelineById?.[assignment.id ?? ''];
                const assignmentRecord = assignment as Assignment & Record<string, unknown>;
                const actualStartSource =
                  timeline?.actualStartAt ??
                  (typeof assignmentRecord.actual_start_at === 'string' ? String(assignmentRecord.actual_start_at) : null);
                const actualCompletedSource =
                  timeline?.actualCompletedAt ??
                  (typeof assignmentRecord.actual_completed_at === 'string'
                    ? String(assignmentRecord.actual_completed_at)
                    : typeof assignmentRecord.completed_at === 'string'
                      ? String(assignmentRecord.completed_at)
                      : null);
                const startLabel = formatLabel(actualStartSource);
                const completedLabel = formatLabel(actualCompletedSource);
                const estimatedHours = getEstimatedHours(assignment);
                const actualHours = getActualHours(assignment, actualStartSource, actualCompletedSource);
                const actualHoursTone = getActualHoursTone(actualHours, estimatedHours);
                return (
                  <div key={assignment.id} className="min-h-[44px] space-y-1">
                    <TaskBlock
                      task={
                        task ?? {
                          id: assignment.taskId ?? assignment.id,
                          propertyId: assignment.propertyId ?? '',
                          name: assignment.title || 'Untitled task',
                          category: 'General',
                          estimatedHours: Math.max(0, Number(assignment.estimatedHours ?? 0)),
                          status: 'active',
                          priority: 3,
                          weatherDependency: false,
                          safetySensitive: false,
                          icon: 'clipboard',
                          color: '#6b7280',
                        }
                      }
                      assignment={assignment}
                      properties={properties}
                      priorityIndex={sortedAssignments.findIndex((item) => item.id === assignment.id)}
                      weatherWarnings={weatherWarningsByAssignment?.[assignment.id ?? ''] ?? []}
                      draggable
                      onDragStart={onTaskDragStart ? () => onTaskDragStart(employee.id, assignment.id ?? '') : undefined}
                      onDrop={onTaskDropOnTask ? () => onTaskDropOnTask(employee.id, assignment.id ?? '') : undefined}
                      onEdit={onEditAssignment ? () => onEditAssignment(assignment) : undefined}
                      onRemove={onRemoveAssignment ? () => onRemoveAssignment(assignment.id) : undefined}
                    />
                    <div className="flex min-h-[44px] flex-wrap items-center gap-2 px-2">
                      {assignmentStatus === 'planned' && onStartAssignment ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-11 w-full rounded-full px-3 text-sm sm:min-h-8 sm:w-auto sm:px-2 sm:text-[11px]"
                          onClick={() => void onStartAssignment(assignment)}
                          disabled={savingTimelineAssignmentId === assignment.id}
                        >
                          {savingTimelineAssignmentId === assignment.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Play className="mr-1 h-3 w-3" />} Start
                        </Button>
                      ) : null}
                      {assignmentStatus === 'in-progress' && onCompleteAssignment ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-11 w-full rounded-full px-3 text-sm sm:min-h-8 sm:w-auto sm:px-2 sm:text-[11px]"
                          onClick={() => void onCompleteAssignment(assignment, sortedAssignments)}
                          disabled={savingTimelineAssignmentId === assignment.id}
                        >
                          {savingTimelineAssignmentId === assignment.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-1 h-3 w-3" />} Complete
                        </Button>
                      ) : null}
                      <span className={`text-[11px] ${actualHoursTone}`}>
                        {startLabel && completedLabel
                          ? `${startLabel} → ${completedLabel} (${actualHours.toFixed(1)}h)`
                          : startLabel
                            ? `Started: ${startLabel}`
                            : completedLabel
                              ? `Completed: ${completedLabel}`
                              : assignmentStatus === 'in-progress'
                                ? 'Started: not logged'
                                : assignmentStatus === 'completed'
                                  ? 'Completed: not logged'
                                  : 'No actual times logged'}
                      </span>
                      {onSaveAssignmentTimes ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 rounded-full px-2 text-[11px]"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (editingTimelineAssignmentId === assignment.id) {
                              setEditingTimelineAssignmentId(null);
                              return;
                            }
                            setEditingTimelineAssignmentId(assignment.id ?? null);
                            setTimelineStartInput(toInputValue(actualStartSource));
                            setTimelineEndInput(toInputValue(actualCompletedSource));
                          }}
                        >
                          <Pencil className="mr-1 h-3 w-3" /> Edit times
                        </Button>
                      ) : null}
                    </div>
                    {editingTimelineAssignmentId === assignment.id && onSaveAssignmentTimes ? (
                      <div className="relative z-20 mx-2 mb-1 flex flex-wrap items-end gap-2 rounded-lg border bg-muted/20 p-2 pointer-events-auto">
                        <div className="w-40">
                          <span className="text-[10px] text-muted-foreground">Start</span>
                          <TimeSelect value={timelineStartInput} onChange={setTimelineStartInput} />
                        </div>
                        <div className="w-40">
                          <span className="text-[10px] text-muted-foreground">Complete</span>
                          <TimeSelect value={timelineEndInput} onChange={setTimelineEndInput} />
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className="h-10 rounded-lg bg-primary px-4 text-sm text-text-inverse hover:bg-primary/90"
                          onClick={(event) => {
                            event.stopPropagation();
                            onSaveAssignmentTimes(assignment, sortedAssignments, timelineStartInput, timelineEndInput);
                            setEditingTimelineAssignmentId(null);
                          }}
                          disabled={savingTimelineAssignmentId === assignment.id}
                        >
                          <Clock3 className="mr-1 h-3 w-3" /> Save
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>

          {sortedAssignments.length > 0 ? (
            <div className="mt-3 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 border border-dashed border-border px-3 text-xs text-muted-foreground"
                onClick={() => {
                  console.log('[DIAG] Add Task button clicked', { employeeId: employee.id, hasOnAddTask: Boolean(onAddTask) });
                  onAddTask?.(employee.id);
                }}
              >
                <Plus className="mr-1 h-3 w-3" /> Add Task
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
