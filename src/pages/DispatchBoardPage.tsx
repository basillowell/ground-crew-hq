import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  GripVertical,
  MapPin,
  UserRound,
} from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useAppStore, type Employee, type Property } from '@/store/appStore';
import { formatTime } from '@/utils/formatTime';

type AssignmentRow = {
  id: string;
  employee_id: string;
  property_id: string;
  task_id: string | null;
  date: string;
  location: string | null;
  status: string;
  created_at: string;
  org_id: string | null;
  notes: string | null;
  order_index: number | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  completed_at: string | null;
  start_time: string | null;
  title: string | null;
  equipment_unit_id: string | null;
  actual_start_at: string | null;
  actual_completed_at: string | null;
};

type TaskRow = {
  id: string;
  name: string;
  category: string;
  color: string | null;
  estimated_hours: number | null;
  org_id: string | null;
};

type StatusTone = 'active' | 'pending' | 'complete' | 'hold' | 'warning';

type CellData = {
  type: 'cell' | 'assignment';
  employeeId: string;
  date: string;
};

const statusStyles: Record<StatusTone, string> = {
  active: 'border-status-active/20 bg-status-active/10 text-status-active',
  pending: 'border-status-pending/20 bg-status-pending/10 text-status-pending',
  complete: 'border-status-complete/20 bg-status-complete/10 text-status-complete',
  hold: 'border-status-hold/20 bg-status-hold/10 text-status-hold',
  warning: 'border-status-warning/20 bg-status-warning/10 text-status-warning',
};

function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMonday(date: Date): Date {
  const monday = new Date(date);
  const day = monday.getDay();
  monday.setDate(monday.getDate() + (day === 0 ? -6 : 1 - day));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function statusTone(status: string): StatusTone {
  const normalized = status.toLowerCase().replaceAll('_', '-');
  if (['complete', 'completed', 'done'].includes(normalized)) return 'complete';
  if (['active', 'in-progress', 'scheduled'].includes(normalized)) return 'active';
  if (['hold', 'paused', 'deferred'].includes(normalized)) return 'hold';
  if (['blocked', 'warning', 'urgent', 'critical'].includes(normalized)) return 'warning';
  return 'pending';
}

function formatStatus(status: string): string {
  return status.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function StatusBadge({ status }: { status: string }) {
  const tone = statusTone(status);
  return (
    <span className={cn('rounded-full border px-2 py-0.5 text-xs font-medium', statusStyles[tone])}>
      {formatStatus(status)}
    </span>
  );
}

function employeeName(employee: Employee | undefined): string {
  return employee ? `${employee.first_name} ${employee.last_name}` : 'Unknown crew member';
}

function propertyName(property: Property | undefined): string {
  return property?.short_name || property?.name || 'Property';
}

function AssignmentCard({
  assignment,
  task,
  property,
  onOpen,
}: {
  assignment: AssignmentRow;
  task: TaskRow | undefined;
  property: Property | undefined;
  onOpen: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: assignment.id,
    data: {
      type: 'assignment',
      employeeId: assignment.employee_id,
      date: assignment.date,
    } satisfies CellData,
  });

  const transformStyle = transform
    ? `translate3d(${transform.x}px, ${transform.y}px, 0) scaleX(${transform.scaleX}) scaleY(${transform.scaleY})`
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: transformStyle, transition }}
      className={cn(
        'group rounded-lg border border-surface-border bg-surface-card p-2.5 shadow-sm',
        isDragging ? 'z-50 opacity-60 shadow-lg' : 'hover:border-brand-dim',
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          aria-label="Drag assignment"
          className="mt-0.5 flex min-h-11 min-w-11 shrink-0 cursor-grab items-center justify-center rounded-md text-text-muted hover:bg-surface-hover hover:text-text-primary active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-medium text-text-primary">
            {task?.name ?? assignment.title ?? 'General assignment'}
          </p>
          <p className="mt-1 truncate text-xs text-text-secondary">{propertyName(property)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={assignment.status} />
            <span className="text-xs text-text-muted">
              {assignment.estimated_hours ?? task?.estimated_hours ?? 0}h
            </span>
          </div>
        </button>
      </div>
    </div>
  );
}

function DispatchCell({
  employeeId,
  date,
  assignments,
  taskById,
  propertyById,
  onOpen,
}: {
  employeeId: string;
  date: string;
  assignments: AssignmentRow[];
  taskById: Map<string, TaskRow>;
  propertyById: Map<string, Property>;
  onOpen: (assignmentId: string) => void;
}) {
  const cellId = `cell:${employeeId}:${date}`;
  const { isOver, setNodeRef } = useDroppable({
    id: cellId,
    data: { type: 'cell', employeeId, date } satisfies CellData,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-32 border-l border-surface-border p-2 transition-colors',
        isOver ? 'bg-brand-ghost ring-2 ring-inset ring-brand' : 'bg-surface-base',
      )}
    >
      <SortableContext items={assignments.map((assignment) => assignment.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {assignments.map((assignment) => (
            <AssignmentCard
              key={assignment.id}
              assignment={assignment}
              task={assignment.task_id ? taskById.get(assignment.task_id) : undefined}
              property={propertyById.get(assignment.property_id)}
              onOpen={() => onOpen(assignment.id)}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

export default function DispatchBoardPage() {
  const { orgId } = useAuth();
  const employees = useAppStore((state) => state.employees);
  const properties = useAppStore((state) => state.properties);
  const isHydrated = useAppStore((state) => state.isHydrated);
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );
  const weekStartKey = getLocalDateKey(weekDays[0]);
  const weekEndKey = getLocalDateKey(weekDays[6]);

  useEffect(() => {
    if (!isHydrated || !orgId) return;

    let cancelled = false;

    const loadDispatchBoard = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      const [assignmentsResult, tasksResult] = await Promise.all([
        supabase
          .from('assignments')
          .select(
            'id, employee_id, property_id, task_id, date, location, status, created_at, org_id, notes, order_index, estimated_hours, actual_hours, completed_at, start_time, title, equipment_unit_id, actual_start_at, actual_completed_at',
          )
          .eq('org_id', orgId)
          .gte('date', weekStartKey)
          .lte('date', weekEndKey)
          .order('date', { ascending: true })
          .order('order_index', { ascending: true }),
        supabase
          .from('tasks')
          .select('id, name, category, color, estimated_hours, org_id')
          .eq('org_id', orgId),
      ]);

      if (cancelled) return;

      const queryError = assignmentsResult.error ?? tasksResult.error;
      if (queryError) {
        console.error('[DispatchBoard] Load failed:', queryError);
        setErrorMessage('The dispatch board could not be loaded. Refresh to try again.');
        setIsLoading(false);
        return;
      }

      setAssignments((assignmentsResult.data ?? []) as AssignmentRow[]);
      setTasks((tasksResult.data ?? []) as TaskRow[]);
      setIsLoading(false);
    };

    void loadDispatchBoard();
    return () => {
      cancelled = true;
    };
  }, [isHydrated, orgId, weekEndKey, weekStartKey]);

  const activeEmployees = useMemo(
    () =>
      employees
        .filter((employee) => employee.active !== false && employee.status === 'active')
        .sort((left, right) => employeeName(left).localeCompare(employeeName(right))),
    [employees],
  );
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const propertyById = useMemo(
    () => new Map(properties.map((property) => [property.id, property])),
    [properties],
  );
  const selectedAssignment = useMemo(
    () => assignments.find((assignment) => assignment.id === selectedAssignmentId) ?? null,
    [assignments, selectedAssignmentId],
  );

  const assignmentsByCell = useMemo(() => {
    const grouped = new Map<string, AssignmentRow[]>();
    assignments.forEach((assignment) => {
      const key = `${assignment.employee_id}:${assignment.date}`;
      const existing = grouped.get(key) ?? [];
      existing.push(assignment);
      grouped.set(key, existing);
    });
    return grouped;
  }, [assignments]);

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || !orgId) return;

    const assignment = assignments.find((item) => item.id === String(active.id));
    const target = over.data.current as CellData | undefined;
    if (!assignment || !target?.employeeId || !target.date) return;
    if (assignment.employee_id === target.employeeId && assignment.date === target.date) return;

    const previousAssignments = assignments;
    const updatedAssignment = {
      ...assignment,
      employee_id: target.employeeId,
      date: target.date,
    };
    setAssignments((current) =>
      current.map((item) => (item.id === assignment.id ? updatedAssignment : item)),
    );

    const { error } = await supabase
      .from('assignments')
      .update({ employee_id: target.employeeId, date: target.date })
      .eq('id', assignment.id)
      .eq('org_id', orgId);

    if (error) {
      console.error('[DispatchBoard] Move failed:', error);
      setAssignments(previousAssignments);
      toast.error('Assignment move failed. The board was restored.');
      return;
    }

    toast.success('Assignment moved');
  };

  const selectedTask = selectedAssignment?.task_id
    ? taskById.get(selectedAssignment.task_id)
    : undefined;
  const selectedEmployee = selectedAssignment
    ? employees.find((employee) => employee.id === selectedAssignment.employee_id)
    : undefined;
  const selectedProperty = selectedAssignment
    ? propertyById.get(selectedAssignment.property_id)
    : undefined;

  return (
    <div className="min-h-full bg-surface-base px-4 py-5 text-text-primary sm:px-6 lg:px-8">
      <div className="mx-auto max-w-full space-y-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="body-muted uppercase">Weekly operations</p>
            <h1 className="heading-xl mt-1">Dispatch Board</h1>
            <p className="body-base mt-2">
              Drag assignments between crew members and days to update the weekly plan.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWeekStart((current) => addDays(current, -7))}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-surface-border bg-surface-card text-text-secondary hover:bg-surface-hover hover:text-text-primary"
              aria-label="Previous week"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setWeekStart(getMonday(new Date()))}
              className="min-h-11 rounded-lg border border-surface-border bg-surface-card px-4 text-sm font-medium text-text-primary hover:bg-surface-hover"
            >
              {weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {' - '}
              {weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </button>
            <button
              type="button"
              onClick={() => setWeekStart((current) => addDays(current, 7))}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-surface-border bg-surface-card text-text-secondary hover:bg-surface-hover hover:text-text-primary"
              aria-label="Next week"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </header>

        {errorMessage ? (
          <div className="rounded-lg border border-status-warning/30 bg-status-warning/10 px-4 py-3 text-sm text-status-warning">
            {errorMessage}
          </div>
        ) : null}

        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={(event) => void handleDragEnd(event)}>
          <div className="overflow-x-auto rounded-lg border border-surface-border bg-surface-card">
            <div className="min-w-[1480px]">
              <div className="grid grid-cols-[220px_repeat(7,minmax(180px,1fr))] border-b border-surface-border bg-surface-elevated">
                <div className="sticky left-0 z-20 flex items-center border-r border-surface-border bg-surface-elevated px-4 py-3">
                  <span className="label-field">Crew Member</span>
                </div>
                {weekDays.map((day) => (
                  <div key={day.toISOString()} className="border-l border-surface-border px-3 py-3 text-center">
                    <p className="text-xs font-medium uppercase text-text-muted">
                      {day.toLocaleDateString('en-US', { weekday: 'short' })}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-text-primary">
                      {day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                ))}
              </div>

              {isLoading ? (
                <div className="space-y-px bg-surface-border">
                  {[0, 1, 2, 3].map((row) => (
                    <div key={row} className="h-32 animate-pulse bg-surface-elevated" />
                  ))}
                </div>
              ) : activeEmployees.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-surface-elevated">
                    <UserRound className="h-6 w-6 text-text-muted" />
                  </div>
                  <p className="heading-md">No active crew members</p>
                  <p className="body-base mt-1">Active employees will appear as dispatch rows.</p>
                </div>
              ) : (
                activeEmployees.map((employee) => (
                  <div
                    key={employee.id}
                    className="grid grid-cols-[220px_repeat(7,minmax(180px,1fr))] border-b border-surface-border last:border-b-0"
                  >
                    <div className="sticky left-0 z-10 border-r border-surface-border bg-surface-card px-4 py-3">
                      <p className="text-sm font-semibold text-text-primary">{employeeName(employee)}</p>
                      <p className="mt-1 truncate text-xs text-text-secondary">
                        {employee.role} · {employee.department}
                      </p>
                    </div>
                    {weekDays.map((day) => {
                      const date = getLocalDateKey(day);
                      return (
                        <DispatchCell
                          key={`${employee.id}:${date}`}
                          employeeId={employee.id}
                          date={date}
                          assignments={assignmentsByCell.get(`${employee.id}:${date}`) ?? []}
                          taskById={taskById}
                          propertyById={propertyById}
                          onOpen={setSelectedAssignmentId}
                        />
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        </DndContext>
      </div>

      <Sheet
        open={Boolean(selectedAssignment)}
        onOpenChange={(open) => {
          if (!open) setSelectedAssignmentId(null);
        }}
      >
        <SheetContent className="overflow-y-auto border-surface-border bg-surface-elevated text-text-primary sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="text-text-primary">
              {selectedTask?.name ?? selectedAssignment?.title ?? 'Assignment details'}
            </SheetTitle>
            <SheetDescription className="text-text-secondary">
              Full dispatch information for this job.
            </SheetDescription>
          </SheetHeader>

          {selectedAssignment ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-lg border border-surface-border bg-surface-card p-4">
                <StatusBadge status={selectedAssignment.status} />
                <dl className="mt-4 space-y-4">
                  <div className="flex gap-3">
                    <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-brand-bright" />
                    <div>
                      <dt className="text-xs uppercase text-text-muted">Crew member</dt>
                      <dd className="mt-1 text-sm text-text-primary">{employeeName(selectedEmployee)}</dd>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-brand-bright" />
                    <div>
                      <dt className="text-xs uppercase text-text-muted">Date</dt>
                      <dd className="mt-1 text-sm text-text-primary">
                        {new Date(`${selectedAssignment.date}T12:00:00`).toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </dd>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-bright" />
                    <div>
                      <dt className="text-xs uppercase text-text-muted">Property</dt>
                      <dd className="mt-1 text-sm text-text-primary">{propertyName(selectedProperty)}</dd>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-brand-bright" />
                    <div>
                      <dt className="text-xs uppercase text-text-muted">Timing</dt>
                      <dd className="mt-1 text-sm text-text-primary">
                        {formatTime(selectedAssignment.start_time) || 'Start time not set'}
                        {' · '}
                        {selectedAssignment.estimated_hours ?? selectedTask?.estimated_hours ?? 0} estimated hours
                      </dd>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-brand-bright" />
                    <div>
                      <dt className="text-xs uppercase text-text-muted">Category</dt>
                      <dd className="mt-1 text-sm text-text-primary">{selectedTask?.category ?? 'General'}</dd>
                    </div>
                  </div>
                </dl>
              </div>

              <div className="rounded-lg border border-surface-border bg-surface-card p-4">
                <p className="text-xs uppercase text-text-muted">Notes</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-text-secondary">
                  {selectedAssignment.notes || 'No notes added.'}
                </p>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
