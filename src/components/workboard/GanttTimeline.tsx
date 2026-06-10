import { useEffect, useMemo, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Assignment, Employee, EquipmentUnit, ScheduleEntry, Task } from '@/data/seedData';
import { formatTime } from '@/utils/formatTime';

interface GanttTimelineProps {
  employees: Employee[];
  assignments: Assignment[];
  tasks: Task[];
  equipment: EquipmentUnit[];
  scheduleEntries: ScheduleEntry[];
  date: string;
  onAssignmentClick?: (assignment: Assignment) => void;
  onDropTask?: (employeeId: string, startMinute: number) => void;
}

const TIMELINE_START_MIN = 6 * 60;
const TIMELINE_END_MIN = 18 * 60;
const TIMELINE_TOTAL_MIN = TIMELINE_END_MIN - TIMELINE_START_MIN;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function timeToMinutes(value?: string) {
  if (!value) return TIMELINE_START_MIN;
  const [hours, minutes] = value.slice(0, 5).split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return TIMELINE_START_MIN;
  return hours * 60 + minutes;
}

function minuteToPct(minute: number) {
  return ((minute - TIMELINE_START_MIN) / TIMELINE_TOTAL_MIN) * 100;
}

function categoryTone(category: string | null | undefined) {
  const value = String(category ?? '').toLowerCase();
  if (value.includes('maintenance')) return { bg: '#dcfce7', border: '#16a34a', text: '#14532d' };
  if (value.includes('irrigation')) return { bg: '#dbeafe', border: '#2563eb', text: '#1e3a8a' };
  if (value.includes('field') || value.includes('mowing')) return { bg: '#fef3c7', border: '#d97706', text: '#78350f' };
  return { bg: '#f3f4f6', border: '#6b7280', text: '#1f2937' };
}

function normalizeStatus(status?: string) {
  const value = String(status ?? '').toLowerCase();
  if (value === 'in_progress' || value === 'in-progress') return 'in_progress';
  if (value === 'done' || value === 'complete' || value === 'completed') return 'done';
  return 'planned';
}

function hourLabel(hour24: number) {
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:00 ${period}`;
}

type AssignmentBar = {
  assignment: Assignment;
  taskName: string;
  taskCategory: string | null;
  equipmentName: string | null;
  startMinute: number;
  durationMinute: number;
  endMinute: number;
  leftPct: number;
  widthPct: number;
  status: 'planned' | 'in_progress' | 'done';
};

export function GanttTimeline({
  employees,
  assignments,
  tasks,
  equipment,
  scheduleEntries,
  date,
  onAssignmentClick,
  onDropTask,
}: GanttTimelineProps) {
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const hours = useMemo(() => Array.from({ length: 13 }, (_, i) => 6 + i), []);
  const isToday = date === new Date().toISOString().slice(0, 10);
  const nowMinute = now.getHours() * 60 + now.getMinutes();
  const showNow = isToday && nowMinute >= TIMELINE_START_MIN && nowMinute <= TIMELINE_END_MIN;
  const nowLeftPct = minuteToPct(nowMinute);

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="overflow-x-auto">
        <div className="min-w-[980px]">
          <div className="grid grid-cols-[220px_1fr] border-b bg-muted/25">
            <div className="border-r px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Crew
            </div>
            <div className="relative">
              <div className="grid grid-cols-12">
                {hours.slice(0, 12).map((hour) => (
                  <div key={`timeline-hour-${hour}`} className="border-r px-1 py-2 text-center text-[11px] text-muted-foreground last:border-r-0">
                    {hourLabel(hour)}
                  </div>
                ))}
              </div>
              {showNow ? (
                <div
                  className="pointer-events-none absolute bottom-0 top-0 z-20 border-l-2 border-dotted border-red-500"
                  style={{ left: `${clamp(nowLeftPct, 0, 100)}%` }}
                >
                  <span className="absolute -top-5 -translate-x-1/2 rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    Now
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="divide-y">
            {employees.map((employee) => {
              const shift = scheduleEntries.find((entry) => entry.employeeId === employee.id && entry.date === date);
              const shiftStart = clamp(timeToMinutes(shift?.shiftStart), TIMELINE_START_MIN, TIMELINE_END_MIN);
              const shiftEndRaw = timeToMinutes(shift?.shiftEnd);
              const shiftEnd = clamp(shiftEndRaw <= shiftStart ? shiftStart + 30 : shiftEndRaw, TIMELINE_START_MIN, TIMELINE_END_MIN);
              const shiftLeftPct = minuteToPct(shiftStart);
              const shiftWidthPct = Math.max(minuteToPct(shiftEnd) - shiftLeftPct, 1);

              const bars: AssignmentBar[] = assignments
                .filter((assignment) => assignment.employeeId === employee.id && assignment.date === date)
                .map((assignment) => {
                  const task = tasks.find((item) => item.id === assignment.taskId);
                  const equipmentUnit = assignment.equipmentId ? equipment.find((item) => item.id === assignment.equipmentId) : null;
                  const status = normalizeStatus(assignment.status);
                  const startMinuteRaw = assignment.startTime ? timeToMinutes(assignment.startTime) : shiftStart;
                  const startMinute = clamp(startMinuteRaw, TIMELINE_START_MIN, TIMELINE_END_MIN - 15);
                  const estimatedHourDuration = Number(assignment.estimatedHours ?? 0);
                  const assignmentDuration = estimatedHourDuration > 0 ? Math.round(estimatedHourDuration * 60) : Math.max(30, Number(assignment.duration ?? 30));
                  const durationMinute = clamp(assignmentDuration, 15, TIMELINE_TOTAL_MIN);
                  const endMinute = clamp(startMinute + durationMinute, TIMELINE_START_MIN, TIMELINE_END_MIN);
                  const leftPct = minuteToPct(startMinute);
                  const widthPct = Math.max(minuteToPct(endMinute) - leftPct, 1.5);
                  return {
                    assignment,
                    taskName: task?.name ?? assignment.taskId ?? 'Task',
                    taskCategory: task?.category ?? null,
                    equipmentName: equipmentUnit?.unitNumber ?? equipmentUnit?.name ?? null,
                    startMinute,
                    durationMinute,
                    endMinute,
                    leftPct,
                    widthPct,
                    status,
                  };
                });

              return (
                <div key={`timeline-row-${employee.id}`} className="grid grid-cols-[220px_1fr]">
                  <div className="border-r px-3 py-2">
                    <p className="truncate text-sm font-semibold">{employee.firstName} {employee.lastName}</p>
                    <p className="truncate text-xs text-muted-foreground">{employee.role || 'Crew'} · {formatTime(shift?.shiftStart || '')} – {formatTime(shift?.shiftEnd || '')}</p>
                  </div>

                  <div
                    className="relative min-h-16"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (!onDropTask) return;
                      const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
                      const pct = clamp((event.clientX - rect.left) / rect.width, 0, 1);
                      const startMinute = TIMELINE_START_MIN + Math.round(pct * TIMELINE_TOTAL_MIN);
                      onDropTask(employee.id, startMinute);
                    }}
                  >
                    <div className="absolute inset-0 grid grid-cols-12">
                      {hours.slice(0, 12).map((hour) => (
                        <div key={`grid-${employee.id}-${hour}`} className="border-r border-dashed border-border/50 last:border-r-0" />
                      ))}
                    </div>

                    <div
                      className="absolute bottom-2 top-2 rounded-md bg-surface-elevated/60"
                      style={{ left: `${shiftLeftPct}%`, width: `${shiftWidthPct}%` }}
                    />

                    {bars.map((bar) => {
                      const tone = categoryTone(bar.taskCategory);
                      const opacity = bar.status === 'in_progress' ? 1 : bar.status === 'done' ? 0.3 : 0.5;
                      return (
                        <Tooltip key={`bar-${bar.assignment.id ?? `${employee.id}-${bar.startMinute}`}`}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="absolute top-2 h-[calc(100%-16px)] rounded-md border px-2 text-left text-[11px] font-semibold shadow-sm transition hover:brightness-105"
                              style={{
                                left: `${bar.leftPct}%`,
                                width: `${bar.widthPct}%`,
                                backgroundColor: tone.bg,
                                borderColor: tone.border,
                                color: tone.text,
                                opacity,
                              }}
                              onClick={() => onAssignmentClick?.(bar.assignment)}
                            >
                              <span className="block truncate">
                                {bar.status === 'done' ? '✓ ' : ''}{bar.taskName}
                              </span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[280px] text-xs">
                            <p className="font-semibold">{bar.taskName}</p>
                            <p className="text-muted-foreground">Category: {bar.taskCategory || 'General'}</p>
                            <p className="text-muted-foreground">
                              Time: {formatTime(String(Math.floor(bar.startMinute / 60)).padStart(2, '0') + ':' + String(bar.startMinute % 60).padStart(2, '0'))}
                              {' '}–{' '}
                              {formatTime(String(Math.floor(bar.endMinute / 60)).padStart(2, '0') + ':' + String(bar.endMinute % 60).padStart(2, '0'))}
                            </p>
                            <p className="text-muted-foreground">Duration: {(bar.durationMinute / 60).toFixed(1)}h</p>
                            <p className="text-muted-foreground">Status: {bar.status === 'in_progress' ? 'In Progress' : bar.status === 'done' ? 'Done' : 'Planned'}</p>
                            {bar.equipmentName ? <p className="text-muted-foreground">Equipment: {bar.equipmentName}</p> : null}
                            {bar.assignment.area ? <p className="text-muted-foreground">Area: {bar.assignment.area}</p> : null}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
