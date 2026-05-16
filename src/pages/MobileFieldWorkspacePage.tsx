import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatTime } from '@/utils/formatTime';
import { PageSkeleton } from '@/components/PageSkeleton';
import { ErrorRetry } from '@/components/ErrorRetry';

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

type ClockEventRecord = {
  id: string;
  eventType: string;
  timestamp: string;
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
  const [clockEvents, setClockEvents] = useState<ClockEventRecord[]>([]);
  const [clockActionSaving, setClockActionSaving] = useState(false);
  const [liveNow, setLiveNow] = useState<Date>(new Date());
  const [needsOpen, setNeedsOpen] = useState(false);
  const [needsSaving, setNeedsSaving] = useState(false);
  const [needsTitle, setNeedsTitle] = useState('');
  const [needsPriority, setNeedsPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [needsLocation, setNeedsLocation] = useState('');
  const [needsNotes, setNeedsNotes] = useState('');
  const [needsPhotoBase64, setNeedsPhotoBase64] = useState<string | null>(null);

  const employeeId = currentUser?.employeeId ?? null;
  const orgId = currentUser?.orgId ?? null;
  const boardDate = todayKey();

  useEffect(() => {
    const timerId = window.setInterval(() => setLiveNow(new Date()), 60_000);
    return () => window.clearInterval(timerId);
  }, []);

  const fetchFieldData = useCallback(async () => {
    if (!supabase || !employeeId || !orgId) {
      setLoading(false);
      setError('Field profile is not available for this account.');
      return;
    }

    setLoading(true);
    setError(null);

    const startOfDayIso = new Date(`${boardDate}T00:00:00`).toISOString();
    const endOfDayIso = new Date(`${boardDate}T23:59:59`).toISOString();

    const [{ data: employeeRow, error: employeeError }, { data: shiftRows, error: shiftError }, { data: assignmentRows, error: assignmentsError }, { data: taskRows, error: tasksError }, { data: propertyRows, error: propertyError }, { data: clockRows, error: clockError }] = await Promise.all([
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
      supabase
        .from('clock_events')
        .select('id, event_type, timestamp')
        .eq('org_id', orgId)
        .eq('employee_id', employeeId)
        .gte('timestamp', startOfDayIso)
        .lte('timestamp', endOfDayIso)
        .order('timestamp', { ascending: true }),
    ]);

    if (employeeError || shiftError || assignmentsError || tasksError || propertyError || clockError) {
      setError(
        employeeError?.message ||
          shiftError?.message ||
          assignmentsError?.message ||
          tasksError?.message ||
          propertyError?.message ||
          clockError?.message ||
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

    const normalizedClockEvents: ClockEventRecord[] = (clockRows ?? []).map((row) => ({
      id: String(row.id),
      eventType: String(row.event_type ?? ''),
      timestamp: String(row.timestamp),
    }));
    setClockEvents(normalizedClockEvents);

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

  const latestClockIn = useMemo(
    () => [...clockEvents].reverse().find((event) => event.eventType === 'clock_in') ?? null,
    [clockEvents],
  );
  const latestClockOut = useMemo(
    () => [...clockEvents].reverse().find((event) => event.eventType === 'clock_out') ?? null,
    [clockEvents],
  );

  const isShiftComplete = Boolean(
    latestClockIn &&
      latestClockOut &&
      new Date(latestClockOut.timestamp).getTime() >= new Date(latestClockIn.timestamp).getTime(),
  );

  const isClockedIn = Boolean(latestClockIn && !isShiftComplete);

  const elapsedMinutes = useMemo(() => {
    if (!latestClockIn || !isClockedIn) return 0;
    const start = new Date(latestClockIn.timestamp).getTime();
    const now = liveNow.getTime();
    return Math.max(Math.round((now - start) / 60000), 0);
  }, [isClockedIn, latestClockIn, liveNow]);

  const elapsedLabel = useMemo(() => {
    const hours = Math.floor(elapsedMinutes / 60);
    const minutes = elapsedMinutes % 60;
    return `${hours}h ${minutes}m`;
  }, [elapsedMinutes]);

  const shiftCompleteLabel = useMemo(() => {
    if (!latestClockIn || !latestClockOut) return '';
    const start = new Date(latestClockIn.timestamp).getTime();
    const end = new Date(latestClockOut.timestamp).getTime();
    const totalMinutes = Math.max(Math.round((end - start) / 60000), 0);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const startTime = formatTime(new Date(latestClockIn.timestamp).toISOString().slice(11, 16));
    const endTime = formatTime(new Date(latestClockOut.timestamp).toISOString().slice(11, 16));
    return `Shift complete: ${startTime} – ${endTime} (${hours}h ${minutes}m)`;
  }, [latestClockIn, latestClockOut]);

  const handleClockEvent = useCallback(
    async (eventType: 'clock_in' | 'clock_out') => {
      if (!supabase || !employeeId || !orgId) return;
      const propertyId = shift?.propertyId ?? currentUser?.propertyId ?? null;
      if (!propertyId) {
        toast.error('Property is not available for clock event.');
        return;
      }

      setClockActionSaving(true);
      const optimisticEvent: ClockEventRecord = {
        id: `optimistic-${Date.now()}`,
        eventType,
        timestamp: new Date().toISOString(),
      };
      setClockEvents((current) => [...current, optimisticEvent]);

      const { data, error: insertError } = await supabase
        .from('clock_events')
        .insert({
          employee_id: employeeId,
          property_id: propertyId,
          org_id: orgId,
          event_type: eventType,
          timestamp: optimisticEvent.timestamp,
          location_lat: null,
          location_lng: null,
        })
        .select('id, event_type, timestamp')
        .single();

      setClockActionSaving(false);
      if (insertError) {
        setClockEvents((current) => current.filter((event) => event.id !== optimisticEvent.id));
        toast.error(`Unable to ${eventType === 'clock_in' ? 'clock in' : 'clock out'}`, {
          description: insertError.message,
        });
        return;
      }

      setClockEvents((current) =>
        current.map((event) =>
          event.id === optimisticEvent.id
            ? {
                id: String(data.id),
                eventType: String(data.event_type),
                timestamp: String(data.timestamp),
              }
            : event,
        ),
      );

      toast.success(eventType === 'clock_in' ? 'Clocked in' : 'Clocked out');
    },
    [currentUser?.propertyId, employeeId, orgId, shift?.propertyId],
  );

  const resetNeedsForm = () => {
    setNeedsTitle('');
    setNeedsPriority('medium');
    setNeedsLocation('');
    setNeedsNotes('');
    setNeedsPhotoBase64(null);
  };

  const handleNeedsPhotoChange = async (file: File | null) => {
    if (!file) {
      setNeedsPhotoBase64(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setNeedsPhotoBase64(result || null);
    };
    reader.readAsDataURL(file);
  };

  const submitNeed = async () => {
    if (!supabase || !employeeId || !orgId) return;
    if (!needsTitle.trim()) {
      toast.error('Title is required');
      return;
    }
    const propertyId = shift?.propertyId ?? currentUser?.propertyId ?? null;
    if (!propertyId) {
      toast.error('Property is not available for this request.');
      return;
    }

    const composedNotes = [needsNotes.trim(), needsPhotoBase64 ? `Photo (base64): ${needsPhotoBase64}` : '']
      .filter(Boolean)
      .join('\n\n');

    setNeedsSaving(true);
    const { error: insertError } = await supabase.from('task_requests').insert({
      org_id: orgId,
      property_id: propertyId,
      submitted_by: employeeId,
      status: 'open',
      date: boardDate,
      title: needsTitle.trim(),
      priority: needsPriority,
      location: needsLocation.trim() || null,
      notes: composedNotes || null,
      created_at: new Date().toISOString(),
    });
    setNeedsSaving(false);

    if (insertError) {
      toast.error('Unable to submit request', { description: insertError.message });
      return;
    }

    toast.success('Request submitted! Your supervisor will review it.');
    resetNeedsForm();
    setNeedsOpen(false);
  };

  if (loading) {
    return <PageSkeleton />;
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-[520px] px-4 py-4 font-sans">
        <ErrorRetry message={error} onRetry={() => void fetchFieldData()} />
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
            {!latestClockIn ? (
              <Button
                className="h-12 min-h-12 w-full bg-green-600 text-base hover:bg-green-700"
                disabled={clockActionSaving}
                onClick={() => void handleClockEvent('clock_in')}
              >
                Clock In
              </Button>
            ) : isClockedIn ? (
              <div className="space-y-3">
                <p className="text-base font-medium">Elapsed time: {elapsedLabel}</p>
                <Button
                  className="h-12 min-h-12 w-full bg-red-600 text-base hover:bg-red-700"
                  disabled={clockActionSaving}
                  onClick={() => void handleClockEvent('clock_out')}
                >
                  Clock Out
                </Button>
              </div>
            ) : (
              <p className="text-base font-medium">{shiftCompleteLabel}</p>
            )}
          </Card>

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
          <Button className="mt-2 h-12 min-h-12 w-full text-base" variant="outline" onClick={() => setNeedsOpen(true)}>
            Report a Need
          </Button>
        </div>
      </footer>

      {needsOpen ? (
        <div className="fixed inset-0 z-50 bg-background">
          <div className="mx-auto flex h-full w-full max-w-[520px] flex-col px-4 pb-4 pt-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Report a Need</h2>
              <button
                type="button"
                className="rounded-md border px-3 py-1.5 text-sm"
                onClick={() => {
                  setNeedsOpen(false);
                  resetNeedsForm();
                }}
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Title</label>
                <Input
                  value={needsTitle}
                  onChange={(event) => setNeedsTitle(event.target.value)}
                  placeholder="Sprinkler head broken on hole 7"
                  className="h-12 text-base"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Priority</label>
                <select
                  value={needsPriority}
                  onChange={(event) => setNeedsPriority(event.target.value as 'low' | 'medium' | 'high')}
                  className="h-12 w-full rounded-md border border-input bg-background px-3 text-base"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Location</label>
                <Input
                  value={needsLocation}
                  onChange={(event) => setNeedsLocation(event.target.value)}
                  placeholder="Hole 7 fairway"
                  className="h-12 text-base"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Notes</label>
                <Textarea
                  value={needsNotes}
                  onChange={(event) => setNeedsNotes(event.target.value)}
                  placeholder="Add extra details"
                  className="min-h-24 text-base"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Photo (optional)</label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(event) => void handleNeedsPhotoChange(event.target.files?.[0] ?? null)}
                  className="h-12 text-base"
                />
                {needsPhotoBase64 ? <p className="mt-1 text-xs text-muted-foreground">Photo attached</p> : null}
              </div>
            </div>

            <div className="mt-4">
              <Button className="h-12 min-h-12 w-full text-base" onClick={() => void submitNeed()} disabled={needsSaving || !needsTitle.trim()}>
                {needsSaving ? 'Submitting...' : 'Submit Request'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
