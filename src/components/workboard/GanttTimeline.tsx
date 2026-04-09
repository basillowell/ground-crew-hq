import { useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Assignment, Employee, Task, EquipmentUnit, ScheduleEntry } from '@/data/seedData';

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

const HOUR_START = 5;
const HOUR_END = 18;
const TOTAL_HOURS = HOUR_END - HOUR_START;
const HOUR_WIDTH = 80;

function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minuteToLeft(minute: number) {
  return ((minute - HOUR_START * 60) / (TOTAL_HOURS * 60)) * 100;
}

function durationToWidth(duration: number) {
  return (duration / (TOTAL_HOURS * 60)) * 100;
}

function TaskBar({ assignment, task, equipment, onClick }: {
  assignment: Assignment;
  task?: Task;
  equipment?: EquipmentUnit;
  onClick?: () => void;
}) {
  const startMin = timeToMinutes(assignment.startTime);
  const left = minuteToLeft(startMin);
  const width = durationToWidth(assignment.duration);
  const color = task?.color || '#6b7280';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="absolute top-1 bottom-1 rounded-md cursor-pointer flex items-center px-2 text-[11px] font-medium text-white shadow-sm transition-all hover:shadow-md hover:brightness-110 hover:scale-[1.02] active:scale-[0.98]"
          style={{
            left: `${left}%`,
            width: `${Math.max(width, 2)}%`,
            backgroundColor: color,
            zIndex: 10,
          }}
          onClick={onClick}
        >
          <span className="truncate">{task?.name || 'Task'}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs max-w-[220px]">
        <div className="font-semibold">{task?.name}</div>
        <div className="text-muted-foreground">
          {assignment.startTime} · {assignment.duration}min · {assignment.area}
        </div>
        {equipment && <div className="text-muted-foreground">🚜 {equipment.unitNumber}</div>}
      </TooltipContent>
    </Tooltip>
  );
}

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragOverEmployee, setDragOverEmployee] = useState<string | null>(null);

  const hours = useMemo(() =>
    Array.from({ length: TOTAL_HOURS }, (_, i) => {
      const h = HOUR_START + i;
      return { label: `${h > 12 ? h - 12 : h}${h >= 12 ? 'p' : 'a'}`, hour: h };
    }),
    []
  );

  const nowMinute = useMemo(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }, []);

  const nowLeft = minuteToLeft(nowMinute);
  const showNow = nowMinute >= HOUR_START * 60 && nowMinute <= HOUR_END * 60;

  return (
    <div className="border rounded-xl bg-card overflow-hidden">
      {/* Header */}
      <div className="flex border-b bg-muted/30 sticky top-0 z-20">
        <div className="w-[180px] shrink-0 p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-r">
          Crew Member
        </div>
        <div className="flex-1 flex relative">
          {hours.map((h) => (
            <div
              key={h.hour}
              className="flex-1 text-center text-[10px] font-medium text-muted-foreground py-2 border-r border-dashed border-border/50"
            >
              {h.label}
            </div>
          ))}
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y">
        {employees.map((emp) => {
          const empAssignments = assignments.filter((a) => a.employeeId === emp.id && a.date === date);
          const shift = scheduleEntries.find((s) => s.employeeId === emp.id && s.date === date);
          const totalMin = empAssignments.reduce((s, a) => s + a.duration, 0);
          const isDragOver = dragOverEmployee === emp.id;

          return (
            <div
              key={emp.id}
              className={`flex min-h-[48px] transition-colors ${isDragOver ? 'bg-primary/5' : 'hover:bg-muted/20'}`}
              onDragOver={(e) => { e.preventDefault(); setDragOverEmployee(emp.id); }}
              onDragLeave={() => setDragOverEmployee(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverEmployee(null);
                if (containerRef.current && onDropTask) {
                  const rect = containerRef.current.getBoundingClientRect();
                  const nameColWidth = 180;
                  const relX = e.clientX - rect.left - nameColWidth;
                  const pct = relX / (rect.width - nameColWidth);
                  const minute = Math.round(HOUR_START * 60 + pct * TOTAL_HOURS * 60);
                  onDropTask(emp.id, minute);
                }
              }}
            >
              {/* Name col */}
              <div className="w-[180px] shrink-0 flex items-center gap-2.5 px-3 border-r">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[10px] font-bold">
                  {emp.firstName[0]}{emp.lastName[0]}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate">{emp.firstName} {emp.lastName}</div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                    {shift ? `${shift.shiftStart}–${shift.shiftEnd}` : 'No shift'}
                    {totalMin > 0 && <span>· {Math.floor(totalMin / 60)}h{totalMin % 60 > 0 ? `${totalMin % 60}m` : ''}</span>}
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="flex-1 relative" ref={employees.indexOf(emp) === 0 ? containerRef : undefined}>
                {/* Hour grid lines */}
                {hours.map((h) => (
                  <div
                    key={h.hour}
                    className="absolute top-0 bottom-0 border-r border-dashed border-border/30"
                    style={{ left: `${((h.hour - HOUR_START) / TOTAL_HOURS) * 100}%` }}
                  />
                ))}

                {/* Shift background */}
                {shift && shift.status === 'scheduled' && (
                  <div
                    className="absolute top-0.5 bottom-0.5 rounded bg-accent/40"
                    style={{
                      left: `${minuteToLeft(timeToMinutes(shift.shiftStart))}%`,
                      width: `${durationToWidth(timeToMinutes(shift.shiftEnd) - timeToMinutes(shift.shiftStart))}%`,
                    }}
                  />
                )}

                {/* Now indicator */}
                {showNow && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-destructive/60 z-30"
                    style={{ left: `${nowLeft}%` }}
                  />
                )}

                {/* Task bars */}
                {empAssignments.map((a) => (
                  <TaskBar
                    key={a.id || `${a.employeeId}-${a.startTime}`}
                    assignment={a}
                    task={tasks.find((t) => t.id === a.taskId)}
                    equipment={a.equipmentId ? equipment.find((eq) => eq.id === a.equipmentId) : undefined}
                    onClick={() => onAssignmentClick?.(a)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
