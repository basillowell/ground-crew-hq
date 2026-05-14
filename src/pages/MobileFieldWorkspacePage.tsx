import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatTime } from '@/utils/formatTime';

type AssignmentStatus = 'planned' | 'in_progress' | 'done' | 'in-progress' | 'completed';

type FieldAssignment = {
  id: string;
  taskId: string | null;
  title: string;
  location: string | null;
  notes: string | null;
  status: AssignmentStatus;
  orderIndex: number;
  estimatedHours: number;
  actualHours: number | null;
  startTime: string | null;
  completedAt: string | null;
};

type ShiftEntry = {
  propertyId: string | null;
  shiftStart: string;
  shiftEnd: string;
};

type EmployeeRecord = {
  id: string;
  firstName: string;
  lastName: string;
};

type TaskMeta = {
  id: string;
  category: string | null;
};

type PropertyRecord = {
  id: string;
  name: string;
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function displayStatus(status: AssignmentStatus) {
  if (status === 'in_progress' || status === 'in-progress') return 'in_progress';
  if (status === 'completed') return 'done';
  if (status === 'done') return 'done';
  return 'planned';
}

function statusBadgeLabel(status: AssignmentStatus) {
  const normalized = displayStatus(status);
  if (normalized === 'in_progress') return 'In Progress';
  if (normalized === 'done') return 'Done';
  return 'Planned';
}

function statusBadgeClass(status: AssignmentStatus) {
  const normalized = displayStatus(status);
  if (normalized === 'done') return 'bg-green-100 text-green-800';
  if (normalized === 'in_progress') return 'bg-blue-100 text-blue-800';
  return 'bg-slate-100 text-slate-800';
}

export default function MobileFieldWorkspacePage() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [employee, setEmployee] = useState<EmployeeRecord | null>(null);
  const [shift, setShift] = useState<ShiftEntry | null>(null);
  const [assignments, setAssignments] = useState<FieldAssignment[]>([]);
  const [taskMetaById, setTaskMetaById] = useState<Record<string, TaskMeta>>({});
  const [propertyName, setPropertyName] = useState<string>('Assigned Property');
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [actualHoursDraft, setActualHoursDraft] = useState<Record<string, string>>({});

  const employeeId = currentUser?.employeeId ?? null;
  const orgId = currentUser?.orgId ?? null;
  const boardDate = todayKey();

  const fetchFieldData = useCallback(async () => {
    if (!supabase || !employeeId || !orgId) {
      setLoading(false);
      setError('Field profile is not available for this account.');
      return;
    }

    setLoading(true);
    setError(null);

    const [{ data: employeeRow, error: employeeError }, { data: shiftRows, error: shiftError }, { data: assignmentRows, error: assignmentsError }, { data: taskRows, error: tasksError }, { data: propertyRows, error: propertyError }] = await Promise.all([
      supabase.from('employees').select('id, first_name, last_name').eq('org_id', orgId).eq('id', employeeId).maybeSingle(),
      supabase
        .from('schedule_entries')
        .select('property_id, shift_start, shift_end')
        .eq('org_id', orgId)
        .eq('employee_id', employeeId)
        .eq('date', boardDate)
        .limit(1),
      supabase
        .from('assignments')
        .select('id, task_id, title, location, notes, status, order_index, estimated_hours, actual_hours, start_time, completed_at')
        .eq('org_id', orgId)
        .eq('employee_id', employeeId)
        .eq('date', boardDate)
        .order('order_index', { ascending: true }),
      supabase
        .from('tasks')
        .select('id, category')
        .eq('org_id', orgId),
      supabase
        .from('properties')
        .select('id, name')
        .eq('org_id', orgId),
    ]);

    if (employeeError || shiftError || assignmentsError || tasksError || propertyError) {
      setError(
        employeeError?.message ||
          shiftError?.message ||
          assignmentsError?.message ||
          tasksError?.message ||
          propertyError?.message ||
          'Unable to load field data.',
      );
      setLoading(false);
      return;
    }

    setEmployee(
      employeeRow
        ? {
            id: String(employeeRow.id),
            firstName: String(employeeRow.first_name ?? ''),
            lastName: String(employeeRow.last_name ?? ''),
          }
        : null,
    );

    const shiftRow = shiftRows?.[0];
    setShift(
      shiftRow
        ? {
            propertyId: shiftRow.property_id ? String(shiftRow.property_id) : null,
            shiftStart: String(shiftRow.shift_start ?? '').slice(0, 5),
            shiftEnd: String(shiftRow.shift_end ?? '').slice(0, 5),
          }
        : null,
    );

    const normalizedAssignments: FieldAssignment[] = (assignmentRows ?? []).map((row) => ({
      id: String(row.id),
      taskId: row.task_id ? String(row.task_id) : null,
      title: String(row.title ?? 'Task'),
      location: row.location ? String(row.location) : null,
      notes: row.notes ? String(row.notes) : null,
      status: (String(row.status ?? 'planned') as AssignmentStatus),
      orderIndex: Number(row.order_index ?? 0),
      estimatedHours: Number(row.estimated_hours ?? 0),
      actualHours: row.actual_hours == null ? null : Number(row.actual_hours),
      startTime: row.start_time ? String(row.start_time).slice(0, 5) : null,
      completedAt: row.completed_at ? String(row.completed_at) : null,
    }));
    setAssignments(normalizedAssignments);

    const nextActualDraft: Record<string, string> = {};
    normalizedAssignments.forEach((assignment) => {
      nextActualDraft[assignment.id] = String(assignment.actualHours ?? assignment.estimatedHours ?? 0);
    });
    setActualHoursDraft(nextActualDraft);

    const taskMap: Record<string, TaskMeta> = {};
    (taskRows ?? []).forEach((row) => {
      const id = String(row.id);
      taskMap[id] = {
        id,
        category: row.category ? String(row.category) : null,
      };
    });
    setTaskMetaById(taskMap);

    const propertiesById = new Map<string, string>();
    (propertyRows ?? []).forEach((property: PropertyRecord) => {
      propertiesById.set(String(property.id), String(property.name));
    });

    if (shiftRow?.property_id && propertiesById.has(String(shiftRow.property_id))) {
      setPropertyName(propertiesById.get(String(shiftRow.property_id)) ?? 'Assigned Property');
    } else if (currentUser?.propertyId && propertiesById.has(String(currentUser.propertyId))) {
      setPropertyName(propertiesById.get(String(currentUser.propertyId)) ?? 'Assigned Property');
    } else {
      setPropertyName('Assigned Property');
    }

    setLoading(false);
  }, [boardDate, currentUser?.propertyId, employeeId, orgId]);

  useEffect(() => {
    void fetchFieldData();
  }, [fetchFieldData]);

  const setSaving = (assignmentId: string, isSaving: boolean) => {
    setSavingIds((current) => ({ ...current, [assignmentId]: isSaving }));
  };

  const updateTaskStatus = async (assignment: FieldAssignment) => {
    if (!supabase) return;
    const normalized = displayStatus(assignment.status);
    const nextStatus = normalized === 'planned' ? 'in_progress' : normalized === 'in_progress' ? 'done' : 'done';
    const nextCompletedAt = nextStatus === 'done' ? new Date().toISOString() : null;

    setSaving(assignment.id, true);
    setAssignments((current) =>
      current.map((item) =>
        item.id === assignment.id ? { ...item, status: nextStatus, completedAt: nextCompletedAt } : item,
      ),
    );

    const payload: Record<string, unknown> = {
      status: nextStatus,
      completed_at: nextCompletedAt,
    };

    const { error: updateError } = await supabase.from('assignments').update(payload).eq('id', assignment.id);
    setSaving(assignment.id, false);

    if (updateError) {
      setAssignments((current) =>
        current.map((item) =>
          item.id === assignment.id ? { ...item, status: assignment.status, completedAt: assignment.completedAt } : item,
        ),
      );
      toast.error('Unable to update task status', { description: updateError.message });
      return;
    }

    if (nextStatus === 'done') {
      toast.success('Task completed');
    } else if (nextStatus === 'in_progress') {
      toast.success('Task started');
    }
  };

  const saveActualHours = async (assignmentId: string) => {
    if (!supabase) return;
    const rawValue = actualHoursDraft[assignmentId] ?? '0';
    const parsed = Number(rawValue);
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 24) {
      toast.error('Enter actual hours between 0 and 24');
      return;
    }

    setSaving(assignmentId, true);
    setAssignments((current) =>
      current.map((assignment) =>
        assignment.id === assignmentId ? { ...assignment, actualHours: parsed } : assignment,
      ),
    );

    const { error: updateError } = await supabase
      .from('assignments')
      .update({ actual_hours: parsed })
      .eq('id', assignmentId);
    setSaving(assignmentId, false);

    if (updateError) {
      toast.error('Unable to save actual hours', { description: updateError.message });
      void fetchFieldData();
      return;
    }

    toast.success('Actual hours saved');
  };

  const doneCount = useMemo(
    () => assignments.filter((assignment) => displayStatus(assignment.status) === 'done').length,
    [assignments],
  );
  const actualHoursTotal = useMemo(
    () => assignments.reduce((sum, assignment) => sum + Number(assignment.actualHours ?? 0), 0),
    [assignments],
  );
  const scheduledHoursTotal = useMemo(
    () => assignments.reduce((sum, assignment) => sum + Number(assignment.estimatedHours ?? 0), 0),
    [assignments],
  );

  const employeeName = employee ? `${employee.firstName} ${employee.lastName}`.trim() : 'Crew Member';
  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[520px] px-4 py-4 font-sans">
        <Card className="rounded-2xl p-5">
          <p className="text-base">Loading your field workspace...</p>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-[520px] px-4 py-4 font-sans">
        <Card className="rounded-2xl p-5">
          <p className="text-base text-red-600">{error}</p>
          <Button className="mt-4 h-12 min-h-12 w-full text-base" onClick={() => void fetchFieldData()}>
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[520px] bg-background px-4 pb-24 pt-4 font-sans">
      <header className="mb-4 rounded-2xl border bg-card p-4">
        <p className="text-lg font-semibold leading-tight">{employeeName}</p>
        <p className="mt-1 text-base text-muted-foreground">{todayLabel}</p>
        <p className="mt-1 text-base text-muted-foreground">{propertyName}</p>
      </header>

      {!shift ? (
        <Card className="rounded-2xl p-5">
          <p className="text-base font-medium">You&apos;re not scheduled today.</p>
        </Card>
      ) : (
        <>
          <Card className="mb-4 rounded-2xl p-5">
            <p className="text-base font-medium">Your shift: {formatTime(shift.shiftStart)} – {formatTime(shift.shiftEnd)}</p>
          </Card>

          {assignments.length === 0 ? (
            <Card className="rounded-2xl p-5">
              <p className="text-base font-medium">No tasks assigned for today. Check with your supervisor.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {assignments.map((assignment) => {
                const normalizedStatus = displayStatus(assignment.status);
                const isSaving = Boolean(savingIds[assignment.id]);
                const category = assignment.taskId ? taskMetaById[assignment.taskId]?.category : null;
                return (
                  <Card key={assignment.id} className="rounded-2xl p-4">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold">{assignment.title}</h2>
                      <Badge className="text-sm">{category || 'General'}</Badge>
                    </div>
                    <div className="mb-2 flex flex-wrap gap-2">
                      <Badge variant="outline" className="text-sm">
                        {assignment.estimatedHours.toFixed(1)} hrs est.
                      </Badge>
                      <Badge className={`text-sm ${statusBadgeClass(assignment.status)}`}>
                        {statusBadgeLabel(assignment.status)}
                      </Badge>
                    </div>
                    {assignment.startTime ? <p className="text-base">Start: {formatTime(assignment.startTime)}</p> : null}
                    {assignment.location ? <p className="mt-1 text-base">Location: {assignment.location}</p> : null}
                    {assignment.notes ? <p className="mt-1 text-base">Notes: {assignment.notes}</p> : null}

                    <Button
                      className="mt-3 h-12 min-h-12 w-full text-base"
                      disabled={normalizedStatus === 'done' || isSaving}
                      variant={normalizedStatus === 'done' ? 'secondary' : 'default'}
                      onClick={() => void updateTaskStatus(assignment)}
                    >
                      {normalizedStatus === 'planned'
                        ? 'Start Task'
                        : normalizedStatus === 'in_progress'
                          ? 'Complete Task'
                          : 'Completed ✓'}
                    </Button>

                    {normalizedStatus === 'done' ? (
                      <div className="mt-3 rounded-xl border p-3">
                        <label className="mb-2 block text-base font-medium" htmlFor={`actual-hours-${assignment.id}`}>
                          How long did this take?
                        </label>
                        <div className="flex gap-2">
                          <Input
                            id={`actual-hours-${assignment.id}`}
                            type="number"
                            min={0}
                            max={24}
                            step={0.5}
                            className="h-12 min-h-12 text-base"
                            value={actualHoursDraft[assignment.id] ?? ''}
                            onChange={(event) =>
                              setActualHoursDraft((current) => ({
                                ...current,
                                [assignment.id]: event.target.value,
                              }))
                            }
                          />
                          <Button
                            className="h-12 min-h-12 px-5 text-base"
                            disabled={isSaving}
                            onClick={() => void saveActualHours(assignment.id)}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      <footer className="fixed bottom-0 left-0 right-0 border-t bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto w-full max-w-[520px]">
          <p className="text-base font-semibold">
            {doneCount}/{assignments.length} tasks done · {actualHoursTotal.toFixed(1)}h actual / {scheduledHoursTotal.toFixed(1)}h scheduled
          </p>
        </div>
      </footer>
    </div>
  );
}
