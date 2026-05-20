import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AvatarInitials } from '@/components/shared';
import { TaskBlock } from './TaskBlock';
import { CheckCircle2, Clock3, GripVertical, Pencil, Play, Plus } from 'lucide-react';
import { useState } from 'react';
import type { Employee, Assignment, Task } from '@/data/seedData';

interface EmployeeRowProps {
  employee: Employee;
  assignments: Assignment[];
  tasks: Task[];
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
  onStartAssignment?: (assignment: Assignment) => void;
  onCompleteAssignment?: (assignment: Assignment, employeeAssignments: Assignment[]) => void;
  onSaveAssignmentTimes?: (assignment: Assignment, employeeAssignments: Assignment[], startInput: string, endInput: string) => void;
  savingTimelineAssignmentId?: string | null;
}

function coverageBadgeClass(coveragePercent: number | undefined) {
  if (typeof coveragePercent !== 'number') return 'bg-muted text-muted-foreground border-border';
  if (coveragePercent >= 80) return 'bg-green-100 text-green-800 border-green-200';
  if (coveragePercent >= 50) return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-red-100 text-red-800 border-red-200';
}

export function EmployeeRow({
  employee,
  assignments: employeeAssignments,
  tasks,
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
  onStartAssignment,
  onCompleteAssignment,
  onSaveAssignmentTimes,
  savingTimelineAssignmentId,
}: EmployeeRowProps) {
  const [editingTimelineAssignmentId, setEditingTimelineAssignmentId] = useState<string | null>(null);
  const [timelineStartInput, setTimelineStartInput] = useState('');
  const [timelineEndInput, setTimelineEndInput] = useState('');
  const sortedAssignments = [...employeeAssignments];
  const hasInProgress = sortedAssignments.some((item) => normalizeStatus(item.status) === 'in-progress');

  const formatLabel = (value?: string | null) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const toInputValue = (value?: string | null) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
  };

  const getEstimatedHours = (assignment: Assignment) => {
    const assignmentRecord = assignment as Assignment & Record<string, unknown>;
    const explicit = Number(assignmentRecord.estimatedHours ?? assignmentRecord.estimated_hours ?? 0);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    return Math.max(0, Number(assignment.duration ?? 0) / 60);
  };

  const getActualHours = (assignment: Assignment, startAt?: string | null, completedAt?: string | null) => {
    const assignmentRecord = assignment as Assignment & Record<string, unknown>;
    const explicit = Number(assignmentRecord.actualHours ?? assignmentRecord.actual_hours ?? 0);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    if (startAt && completedAt) {
      const startDate = new Date(startAt);
      const endDate = new Date(completedAt);
      if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime()) && endDate >= startDate) {
        return (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
      }
    }
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
                const startLabel = formatLabel(timeline?.actualStartAt);
                const completedLabel = formatLabel(timeline?.actualCompletedAt);
                const estimatedHours = getEstimatedHours(assignment);
                const actualHours = getActualHours(assignment, timeline?.actualStartAt, timeline?.actualCompletedAt);
                const actualHoursTone = getActualHoursTone(actualHours, estimatedHours);
                const isFirstPlannedTask = assignmentStatus === 'planned' && !hasInProgress && sortedAssignments[0]?.id === assignment.id;
                return task ? (
                  <div key={assignment.id} className="space-y-1">
                    <TaskBlock
                      task={task}
                      assignment={assignment}
                      priorityIndex={sortedAssignments.findIndex((item) => item.id === assignment.id)}
                      weatherWarnings={weatherWarningsByAssignment?.[assignment.id ?? ''] ?? []}
                      draggable
                      onDragStart={onTaskDragStart ? () => onTaskDragStart(employee.id, assignment.id ?? '') : undefined}
                      onDrop={onTaskDropOnTask ? () => onTaskDropOnTask(employee.id, assignment.id ?? '') : undefined}
                      onEdit={onEditAssignment ? () => onEditAssignment(assignment) : undefined}
                      onRemove={onRemoveAssignment ? () => onRemoveAssignment(assignment.id) : undefined}
                    />
                    <div className="flex flex-wrap items-center gap-2 px-2 pb-1">
                      {isFirstPlannedTask && onStartAssignment ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 rounded-full px-2 text-[11px]"
                          onClick={() => onStartAssignment(assignment)}
                          disabled={savingTimelineAssignmentId === assignment.id}
                        >
                          <Play className="mr-1 h-3 w-3" /> Start
                        </Button>
                      ) : null}
                      {assignmentStatus === 'in-progress' && onCompleteAssignment ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 rounded-full px-2 text-[11px]"
                          onClick={() => onCompleteAssignment(assignment, sortedAssignments)}
                          disabled={savingTimelineAssignmentId === assignment.id}
                        >
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Complete
                        </Button>
                      ) : null}
                      <span className={`text-[11px] ${actualHoursTone}`}>
                        {startLabel && completedLabel
                          ? `${startLabel} → ${completedLabel} (${actualHours.toFixed(1)}h)`
                          : startLabel
                            ? `Started: ${startLabel}`
                            : completedLabel
                              ? `Completed: ${completedLabel}`
                              : 'No actual times logged'}
                      </span>
                      {onSaveAssignmentTimes ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 rounded-full px-2 text-[11px]"
                          onClick={() => {
                            if (editingTimelineAssignmentId === assignment.id) {
                              setEditingTimelineAssignmentId(null);
                              return;
                            }
                            setEditingTimelineAssignmentId(assignment.id ?? null);
                            setTimelineStartInput(toInputValue(timeline?.actualStartAt));
                            setTimelineEndInput(toInputValue(timeline?.actualCompletedAt));
                          }}
                        >
                          <Pencil className="mr-1 h-3 w-3" /> Edit times
                        </Button>
                      ) : null}
                    </div>
                    {editingTimelineAssignmentId === assignment.id && onSaveAssignmentTimes ? (
                      <div className="mx-2 mb-1 flex flex-wrap items-end gap-2 rounded-lg border bg-muted/20 p-2">
                        <label className="text-[10px] text-muted-foreground">
                          Start
                          <input
                            type="time"
                            value={timelineStartInput}
                            onChange={(event) => setTimelineStartInput(event.target.value)}
                            className="ml-1 h-7 rounded border px-2 text-[11px]"
                          />
                        </label>
                        <label className="text-[10px] text-muted-foreground">
                          Complete
                          <input
                            type="time"
                            value={timelineEndInput}
                            onChange={(event) => setTimelineEndInput(event.target.value)}
                            className="ml-1 h-7 rounded border px-2 text-[11px]"
                          />
                        </label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 rounded-full px-2 text-[11px]"
                          onClick={() => {
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
                ) : null;
              })
            )}
          </div>

          {sortedAssignments.length > 0 ? (
            <div className="mt-3 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 border border-dashed border-border px-3 text-xs text-muted-foreground"
                onClick={() => onAddTask?.(employee.id)}
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
