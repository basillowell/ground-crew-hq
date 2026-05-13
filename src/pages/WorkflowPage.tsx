import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Bell, Check, ChevronLeft, ChevronRight, Circle, Copy, MinusCircle, RefreshCw, Save, StickyNote, Trash2 } from 'lucide-react';

type AssignmentStatus = 'pending' | 'in_progress' | 'done';

type LaborEmployee = {
  id: string;
  first_name: string;
  last_name: string;
  department?: string | null;
  property_id?: string | null;
};

type ScheduleRow = {
  employee_id: string;
  shift_start: string;
  shift_end: string;
  status: string;
};

type AssignmentRow = {
  id: string;
  employee_id: string;
  property_id: string | null;
  date: string;
  title: string;
  location: string | null;
  notes: string | null;
  status: AssignmentStatus;
  estimated_hours: number | null;
  completed_at: string | null;
  order_index: number | null;
};

type CrewRow = {
  employee: LaborEmployee;
  shiftStart: string;
  shiftEnd: string;
  shiftStatus: string;
  assignments: AssignmentRow[];
};

type AddTaskDraft = {
  open: boolean;
  title: string;
  estimatedHours: string;
  location: string;
};

const STATUS_ORDER: AssignmentStatus[] = ['pending', 'in_progress', 'done'];

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function fromDateKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`);
}

function shiftDate(dateKey: string, offset: number) {
  const d = fromDateKey(dateKey);
  d.setDate(d.getDate() + offset);
  return toDateKey(d);
}

function prettyDate(dateKey: string) {
  return fromDateKey(dateKey).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatShortTime(value: string) {
  const [hourRaw, minuteRaw] = value.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw ?? '0');
  if (Number.isNaN(hour) || Number.isNaN(minute)) return value;
  const period = hour >= 12 ? 'pm' : 'am';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, '0')}${period}`;
}

function shiftHours(start: string, end: string) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if ([sh, sm, eh, em].some(Number.isNaN)) return 0;
  return Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60);
}

function nextStatus(status: AssignmentStatus): AssignmentStatus {
  const idx = STATUS_ORDER.indexOf(status);
  return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
}

function statusPill(status: AssignmentStatus) {
  if (status === 'done') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (status === 'in_progress') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-muted text-muted-foreground border-border';
}

export default function WorkflowPage() {
  const { currentUser, currentPropertyId } = useAuth();
  const orgId = currentUser?.orgId ?? '';
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [crewRows, setCrewRows] = useState<CrewRow[]>([]);
  const [dailyNotes, setDailyNotes] = useState('');
  const [planningSummary, setPlanningSummary] = useState('');
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [addTaskDrafts, setAddTaskDrafts] = useState<Record<string, AddTaskDraft>>({});
  const [copyTargetDate, setCopyTargetDate] = useState('');
  const [showCopyPanel, setShowCopyPanel] = useState(false);

  const propertyId = currentPropertyId && currentPropertyId !== 'all' ? currentPropertyId : currentUser?.propertyId ?? null;

  const fetchBoard = useCallback(async () => {
    if (!supabase || !orgId) {
      setError('Unable to load workflow context.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const schedulesQuery = supabase
      .from('schedule_entries')
      .select('employee_id, shift_start, shift_end, status')
      .eq('org_id', orgId)
      .eq('date', selectedDate);
    const filteredSchedulesQuery =
      propertyId ? schedulesQuery.eq('property_id', propertyId) : schedulesQuery;

    const { data: scheduleRows, error: scheduleError } = await filteredSchedulesQuery;
    if (scheduleError) {
      setError(scheduleError.message);
      setLoading(false);
      return;
    }

    const normalizedSchedules = (scheduleRows ?? []) as ScheduleRow[];
    const workingSchedules = normalizedSchedules.filter((entry) => entry.status.toLowerCase() === 'scheduled');
    const employeeIds = Array.from(new Set(workingSchedules.map((entry) => entry.employee_id)));

    if (employeeIds.length === 0) {
      setCrewRows([]);
      setLoading(false);
      return;
    }

    const { data: employeesData, error: employeesError } = await supabase
      .from('employees')
      .select('id, first_name, last_name, department, property_id')
      .in('id', employeeIds)
      .eq('org_id', orgId);
    if (employeesError) {
      setError(employeesError.message);
      setLoading(false);
      return;
    }

    const { data: assignmentsData, error: assignmentsError } = await supabase
      .from('assignments')
      .select('id, employee_id, property_id, date, title, location, notes, status, estimated_hours, completed_at, order_index')
      .eq('org_id', orgId)
      .eq('date', selectedDate)
      .in('employee_id', employeeIds)
      .order('order_index', { ascending: true });
    if (assignmentsError) {
      setError(assignmentsError.message);
      setLoading(false);
      return;
    }

    const employeeMap = new Map<string, LaborEmployee>(
      ((employeesData ?? []) as LaborEmployee[]).map((emp) => [emp.id, emp]),
    );

    const assignmentByEmployee = new Map<string, AssignmentRow[]>();
    for (const row of (assignmentsData ?? []) as AssignmentRow[]) {
      if (!assignmentByEmployee.has(row.employee_id)) assignmentByEmployee.set(row.employee_id, []);
      assignmentByEmployee.get(row.employee_id)?.push({
        ...row,
        status: (row.status as AssignmentStatus) || 'pending',
      });
    }

    const builtRows: CrewRow[] = workingSchedules
      .map((schedule) => {
        const employee = employeeMap.get(schedule.employee_id);
        if (!employee) return null;
        return {
          employee,
          shiftStart: schedule.shift_start?.slice(0, 5) ?? '',
          shiftEnd: schedule.shift_end?.slice(0, 5) ?? '',
          shiftStatus: schedule.status,
          assignments: assignmentByEmployee.get(schedule.employee_id) ?? [],
        };
      })
      .filter((row): row is CrewRow => Boolean(row))
      .sort((a, b) => `${a.employee.first_name} ${a.employee.last_name}`.localeCompare(`${b.employee.first_name} ${b.employee.last_name}`));

    setCrewRows(builtRows);
    setLoading(false);
  }, [orgId, selectedDate, propertyId]);

  useEffect(() => {
    void fetchBoard();
  }, [fetchBoard]);

  const totalEstimatedHours = useMemo(
    () =>
      crewRows
        .flatMap((row) => row.assignments)
        .reduce((sum, assignment) => sum + Number(assignment.estimated_hours ?? 0), 0),
    [crewRows],
  );

  const daySummary = useMemo(() => {
    const rows = crewRows.map((row) => {
      const scheduledHours = shiftHours(row.shiftStart, row.shiftEnd);
      const estimatedTaskHours = row.assignments.reduce((sum, task) => sum + Number(task.estimated_hours ?? 0), 0);
      const tasksDone = row.assignments.filter((task) => task.status === 'done').length;
      const tasksTotal = row.assignments.length;
      return {
        employeeName: `${row.employee.first_name} ${row.employee.last_name}`,
        scheduledHours,
        estimatedTaskHours,
        tasksDone,
        tasksTotal,
      };
    });
    const totals = rows.reduce(
      (acc, row) => ({
        scheduledHours: acc.scheduledHours + row.scheduledHours,
        estimatedTaskHours: acc.estimatedTaskHours + row.estimatedTaskHours,
        tasksDone: acc.tasksDone + row.tasksDone,
        tasksTotal: acc.tasksTotal + row.tasksTotal,
      }),
      { scheduledHours: 0, estimatedTaskHours: 0, tasksDone: 0, tasksTotal: 0 },
    );
    return { rows, totals };
  }, [crewRows]);

  const updateAssignment = async (id: string, patch: Partial<AssignmentRow>) => {
    if (!supabase || !orgId) return;
    const { error: updateError } = await supabase
      .from('assignments')
      .update(patch)
      .eq('id', id)
      .eq('org_id', orgId);
    if (updateError) {
      toast.error('Update failed', { description: updateError.message });
      return;
    }
    setCrewRows((current) =>
      current.map((row) => ({
        ...row,
        assignments: row.assignments.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      })),
    );
  };

  const toggleAssignmentStatus = async (assignment: AssignmentRow) => {
    const status = nextStatus(assignment.status);
    await updateAssignment(assignment.id, {
      status,
      completed_at: status === 'done' ? new Date().toISOString() : null,
    });
  };

  const deleteAssignment = async (id: string) => {
    if (!supabase || !orgId) return;
    const { error: deleteError } = await supabase
      .from('assignments')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);
    if (deleteError) {
      toast.error('Delete failed', { description: deleteError.message });
      return;
    }
    setCrewRows((current) =>
      current.map((row) => ({
        ...row,
        assignments: row.assignments.filter((item) => item.id !== id),
      })),
    );
  };

  const openAddTask = (employeeId: string) => {
    setAddTaskDrafts((current) => ({
      ...current,
      [employeeId]: {
        open: true,
        title: '',
        estimatedHours: '1',
        location: '',
      },
    }));
  };

  const closeAddTask = (employeeId: string) => {
    setAddTaskDrafts((current) => ({
      ...current,
      [employeeId]: {
        open: false,
        title: '',
        estimatedHours: '1',
        location: '',
      },
    }));
  };

  const saveAddTask = async (employeeId: string) => {
    if (!supabase || !orgId) return;
    const draft = addTaskDrafts[employeeId];
    if (!draft?.title.trim()) {
      toast.error('Task title is required.');
      return;
    }
    const orderIndex =
      (crewRows.find((row) => row.employee.id === employeeId)?.assignments.length ?? 0) + 1;
    const payload = {
      org_id: orgId,
      employee_id: employeeId,
      property_id: propertyId,
      date: selectedDate,
      title: draft.title.trim(),
      estimated_hours: Number(draft.estimatedHours || '0'),
      location: draft.location.trim() || null,
      status: 'pending' as AssignmentStatus,
      order_index: orderIndex,
      completed_at: null,
    };
    const { data, error: insertError } = await supabase
      .from('assignments')
      .insert(payload)
      .select('id, employee_id, property_id, date, title, location, notes, status, estimated_hours, completed_at, order_index')
      .single();
    if (insertError) {
      toast.error('Add task failed', { description: insertError.message });
      return;
    }
    const inserted = data as AssignmentRow;
    setCrewRows((current) =>
      current.map((row) =>
        row.employee.id === employeeId
          ? {
              ...row,
              assignments: [...row.assignments, inserted],
            }
          : row,
      ),
    );
    closeAddTask(employeeId);
  };

  const copyDay = async () => {
    if (!supabase || !orgId || !copyTargetDate) return;
    const sourceAssignments = crewRows.flatMap((row) => row.assignments);
    if (sourceAssignments.length === 0) {
      toast.message('No assignments to copy.');
      return;
    }
    const inserts = sourceAssignments.map((task) => ({
      org_id: orgId,
      employee_id: task.employee_id,
      property_id: task.property_id,
      date: copyTargetDate,
      title: task.title,
      location: task.location,
      notes: task.notes,
      estimated_hours: task.estimated_hours,
      order_index: task.order_index,
      status: 'pending',
      completed_at: null,
    }));
    const { error: insertError } = await supabase.from('assignments').insert(inserts);
    if (insertError) {
      toast.error('Copy day failed', { description: insertError.message });
      return;
    }
    setShowCopyPanel(false);
    setCopyTargetDate('');
    toast.success(`Copied ${inserts.length} tasks to ${copyTargetDate}.`);
  };

  const savePlanningNotes = () => {
    toast.success('Planning notes saved locally.');
  };

  if (!orgId) {
    return (
      <div className="p-6">
        <Card className="p-4 text-sm text-destructive">Unable to load workflow without organization context.</Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setSelectedDate((prev) => shiftDate(prev, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[220px] text-center text-sm font-semibold">{prettyDate(selectedDate)}</div>
            <Button variant="outline" size="icon" onClick={() => setSelectedDate((prev) => shiftDate(prev, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => setSelectedDate(toDateKey(new Date()))}>Today</Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={savePlanningNotes}>
              <Save className="mr-1 h-4 w-4" /> Save
            </Button>
            <Button variant="outline" onClick={() => void fetchBoard()}>
              <RefreshCw className="mr-1 h-4 w-4" /> Refresh
            </Button>
            <Button variant="outline">
              <Bell className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => setShowCopyPanel((prev) => !prev)}>
              <Copy className="mr-1 h-4 w-4" /> Copy Day
            </Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span>Property: Sarasota Polo Club</span>
          <span>Workday Hours: {totalEstimatedHours.toFixed(1)}</span>
        </div>
        {showCopyPanel ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-dashed p-3">
            <span className="text-sm">Copy {selectedDate} tasks to:</span>
            <Input type="date" value={copyTargetDate} onChange={(e) => setCopyTargetDate(e.target.value)} className="w-[180px]" />
            <Button size="sm" onClick={() => void copyDay()} disabled={!copyTargetDate}>Confirm Copy</Button>
          </div>
        ) : null}
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
        <div className="space-y-4">
          {loading ? (
            <Card className="p-4 space-y-2">
              <div className="h-8 w-1/3 animate-pulse rounded bg-muted" />
              <div className="h-20 animate-pulse rounded bg-muted" />
              <div className="h-20 animate-pulse rounded bg-muted" />
            </Card>
          ) : error ? (
            <Card className="p-4 text-sm">
              <div className="text-destructive">{error}</div>
              <Button className="mt-3" variant="outline" onClick={() => void fetchBoard()}>Retry</Button>
            </Card>
          ) : crewRows.length === 0 ? (
            <Card className="p-6 text-center space-y-2">
              <div className="text-sm font-medium">No crew scheduled for this day</div>
              <Link to="/app/scheduler" className="text-sm text-primary underline">
                Go to Scheduler →
              </Link>
            </Card>
          ) : (
            <>
              {crewRows.map((row) => {
                const employeeName = `${row.employee.first_name} ${row.employee.last_name}`;
                const addDraft = addTaskDrafts[row.employee.id];
                return (
                  <Card key={row.employee.id} className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold">{employeeName}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.employee.department ?? 'Crew'} · {row.shiftStart}–{row.shiftEnd}
                        </div>
                      </div>
                      <Badge variant="outline">{formatShortTime(row.shiftStart)}–{formatShortTime(row.shiftEnd)}</Badge>
                    </div>

                    <div className="space-y-2">
                      {row.assignments.length === 0 ? (
                        <button
                          type="button"
                          className="text-xs text-muted-foreground underline"
                          onClick={() => openAddTask(row.employee.id)}
                        >
                          + Add first task for {row.employee.first_name}
                        </button>
                      ) : (
                        row.assignments.map((task) => (
                          <div key={task.id} className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-2 rounded border p-2">
                            <button
                              type="button"
                              className={`h-7 w-7 rounded-full border flex items-center justify-center ${statusPill(task.status)}`}
                              onClick={() => void toggleAssignmentStatus(task)}
                            >
                              {task.status === 'done' ? <Check className="h-4 w-4" /> : task.status === 'in_progress' ? <MinusCircle className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                            </button>
                            <Input
                              value={task.title}
                              onChange={(e) => {
                                const value = e.target.value;
                                setCrewRows((current) =>
                                  current.map((entry) => ({
                                    ...entry,
                                    assignments: entry.assignments.map((item) =>
                                      item.id === task.id ? { ...item, title: value } : item,
                                    ),
                                  })),
                                );
                              }}
                              onBlur={(e) => void updateAssignment(task.id, { title: e.target.value.trim() || task.title })}
                            />
                            <Input
                              className="w-24"
                              value={String(task.estimated_hours ?? 0)}
                              onChange={(e) => {
                                const value = Number(e.target.value || '0');
                                setCrewRows((current) =>
                                  current.map((entry) => ({
                                    ...entry,
                                    assignments: entry.assignments.map((item) =>
                                      item.id === task.id ? { ...item, estimated_hours: value } : item,
                                    ),
                                  })),
                                );
                              }}
                              onBlur={(e) => void updateAssignment(task.id, { estimated_hours: Number(e.target.value || '0') })}
                            />
                            <button
                              type="button"
                              className="h-8 w-8 rounded border text-muted-foreground hover:text-foreground"
                              title={task.notes || 'No notes'}
                            >
                              <StickyNote className="h-4 w-4 mx-auto" />
                            </button>
                            <button
                              type="button"
                              className="h-8 w-8 rounded border text-destructive hover:bg-destructive/10"
                              onClick={() => void deleteAssignment(task.id)}
                            >
                              <Trash2 className="h-4 w-4 mx-auto" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    {addDraft?.open ? (
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_1fr_auto_auto] gap-2 rounded border border-dashed p-3">
                        <Input
                          placeholder="Task title"
                          value={addDraft.title}
                          onChange={(e) =>
                            setAddTaskDrafts((current) => ({
                              ...current,
                              [row.employee.id]: { ...(current[row.employee.id] ?? addDraft), title: e.target.value },
                            }))
                          }
                        />
                        <Input
                          placeholder="Hours"
                          value={addDraft.estimatedHours}
                          onChange={(e) =>
                            setAddTaskDrafts((current) => ({
                              ...current,
                              [row.employee.id]: { ...(current[row.employee.id] ?? addDraft), estimatedHours: e.target.value },
                            }))
                          }
                        />
                        <Input
                          placeholder="Location (optional)"
                          value={addDraft.location}
                          onChange={(e) =>
                            setAddTaskDrafts((current) => ({
                              ...current,
                              [row.employee.id]: { ...(current[row.employee.id] ?? addDraft), location: e.target.value },
                            }))
                          }
                        />
                        <Button size="sm" onClick={() => void saveAddTask(row.employee.id)}>Save</Button>
                        <Button size="sm" variant="outline" onClick={() => closeAddTask(row.employee.id)}>Cancel</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => openAddTask(row.employee.id)}>
                        + Add task
                      </Button>
                    )}
                  </Card>
                );
              })}

              <Card className="p-4">
                <div className="text-sm font-semibold mb-2">Day Summary</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="py-1">Employee</th>
                        <th className="py-1">Scheduled Hrs</th>
                        <th className="py-1">Est. Task Hrs</th>
                        <th className="py-1">Tasks Done</th>
                        <th className="py-1">Tasks Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {daySummary.rows.map((row) => (
                        <tr key={row.employeeName} className="border-t">
                          <td className="py-1">{row.employeeName}</td>
                          <td className="py-1">{row.scheduledHours.toFixed(1)}</td>
                          <td className="py-1">{row.estimatedTaskHours.toFixed(1)}</td>
                          <td className="py-1">{row.tasksDone}</td>
                          <td className="py-1">{row.tasksTotal}</td>
                        </tr>
                      ))}
                      <tr className="border-t font-semibold">
                        <td className="py-1">Totals</td>
                        <td className="py-1">{daySummary.totals.scheduledHours.toFixed(1)}</td>
                        <td className="py-1">{daySummary.totals.estimatedTaskHours.toFixed(1)}</td>
                        <td className="py-1">{daySummary.totals.tasksDone}</td>
                        <td className="py-1">{daySummary.totals.tasksTotal}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </div>

        <Card className={`p-4 ${rightPanelOpen ? 'block' : 'hidden xl:block'}`}>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold">Daily Notes & Planning</div>
            <Button variant="outline" size="sm" onClick={() => setRightPanelOpen((prev) => !prev)}>
              {rightPanelOpen ? 'Collapse' : 'Expand'}
            </Button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Daily Notes</label>
              <Textarea
                value={dailyNotes}
                onChange={(e) => setDailyNotes(e.target.value)}
                placeholder="Weather, constraints, crew notes..."
                className="mt-1 min-h-28"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Planning Summary</label>
              <Textarea
                value={planningSummary}
                onChange={(e) => setPlanningSummary(e.target.value)}
                placeholder="Priority outcomes for this day..."
                className="mt-1 min-h-28"
              />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

