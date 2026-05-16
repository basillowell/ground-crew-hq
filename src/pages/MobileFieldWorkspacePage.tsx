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
import { fieldTranslations, type FieldLanguage } from '@/i18n/field-translations';

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
  language: string | null;
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

const QUICK_HOURS_OPTIONS = ['1', '1.5', '2', '2.5', '3', '4'];

export default function MobileFieldWorkspacePage() {
  const LANG_STORAGE_KEY = 'ground-crew-field-lang';
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
  const [activeDonePromptId, setActiveDonePromptId] = useState<string | null>(null);
  const [showOtherActualInputId, setShowOtherActualInputId] = useState<string | null>(null);
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
  const [language, setLanguage] = useState<FieldLanguage>('en');

  const employeeId = currentUser?.employeeId ?? null;
  const orgId = currentUser?.orgId ?? null;
  const boardDate = todayKey();
  const t = fieldTranslations[language];

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
      supabase.from('employees').select('id, first_name, last_name, language').eq('org_id', orgId).eq('id', employeeId).maybeSingle(),
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
            language: employeeRow.language ? String(employeeRow.language) : null,
          }
        : null,
    );

    if (employeeRow) {
      const localPref = window.localStorage.getItem(LANG_STORAGE_KEY);
      const employeeLang = String(employeeRow.language ?? '').toLowerCase();
      const nextLang: FieldLanguage =
        localPref === 'en' || localPref === 'es'
          ? localPref
          : employeeLang.startsWith('es')
            ? 'es'
            : 'en';
      setLanguage(nextLang);
    }

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
  }, [LANG_STORAGE_KEY, boardDate, currentUser?.propertyId, employeeId, orgId]);

  useEffect(() => {
    void fetchFieldData();
  }, [fetchFieldData]);

  const setSaving = (assignmentId: string, isSaving: boolean) => {
    setSavingIds((current) => ({ ...current, [assignmentId]: isSaving }));
  };

  const updateTaskStatus = async (
    assignment: FieldAssignment,
    nextStatus: 'in_progress' | 'done',
    actualHours?: number,
  ) => {
    if (!supabase) return;
    const nextCompletedAt = nextStatus === 'done' ? new Date().toISOString() : null;
    const nextActualHours = nextStatus === 'done' ? actualHours ?? assignment.estimatedHours : assignment.actualHours;

    setSaving(assignment.id, true);
    setAssignments((current) =>
      current.map((item) =>
        item.id === assignment.id
          ? { ...item, status: nextStatus, completedAt: nextCompletedAt, actualHours: nextActualHours }
          : item,
      ),
    );

    const payload: Record<string, unknown> = {
      status: nextStatus,
      completed_at: nextCompletedAt,
    };
    if (nextStatus === 'done') {
      payload.actual_hours = nextActualHours;
    }

    const { error: updateError } = await supabase.from('assignments').update(payload).eq('id', assignment.id);
    setSaving(assignment.id, false);

    if (updateError) {
      setAssignments((current) =>
        current.map((item) =>
          item.id === assignment.id
            ? {
                ...item,
                status: assignment.status,
                completedAt: assignment.completedAt,
                actualHours: assignment.actualHours,
              }
            : item,
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

  const completeTaskWithHours = async (assignment: FieldAssignment) => {
    const assignmentId = assignment.id;
    const rawValue = actualHoursDraft[assignmentId] ?? '0';
    const parsed = Number(rawValue);
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 24) {
      toast.error('Enter actual hours between 0 and 24');
      return;
    }
    await updateTaskStatus(assignment, 'done', parsed);
    setActiveDonePromptId(null);
    setShowOtherActualInputId(null);
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
  const completionPct = assignments.length > 0 ? Math.round((doneCount / assignments.length) * 100) : 0;

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
    return `${t.shiftComplete}: ${startTime} – ${endTime} (${hours}h ${minutes}m)`;
  }, [latestClockIn, latestClockOut, t.shiftComplete]);

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
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold leading-tight">{employeeName}</p>
            <p className="mt-1 text-base text-muted-foreground">{todayLabel}</p>
            <p className="mt-1 text-base text-muted-foreground">{propertyName}</p>
          </div>
          <div className="flex items-center rounded-md border bg-background p-1 text-xs font-medium">
            <button
              type="button"
              className={`rounded px-2 py-1 ${language === 'en' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              onClick={() => {
                setLanguage('en');
                window.localStorage.setItem(LANG_STORAGE_KEY, 'en');
              }}
            >
              EN
            </button>
            <span className="px-1 text-muted-foreground">|</span>
            <button
              type="button"
              className={`rounded px-2 py-1 ${language === 'es' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              onClick={() => {
                setLanguage('es');
                window.localStorage.setItem(LANG_STORAGE_KEY, 'es');
              }}
            >
              ES
            </button>
          </div>
        </div>
      </header>

      {!shift ? (
        <Card className="rounded-2xl p-5">
          <p className="text-base font-medium">{t.notScheduled}</p>
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
                {t.clockIn}
              </Button>
            ) : isClockedIn ? (
              <div className="space-y-3">
                <p className="text-base font-medium">Elapsed time: {elapsedLabel}</p>
                <Button
                  className="h-12 min-h-12 w-full bg-red-600 text-base hover:bg-red-700"
                  disabled={clockActionSaving}
                  onClick={() => void handleClockEvent('clock_out')}
                >
                  {t.clockOut}
                </Button>
              </div>
            ) : (
              <p className="text-base font-medium">{shiftCompleteLabel}</p>
            )}
          </Card>

          <Card className="mb-4 rounded-2xl p-5">
            <p className="text-base font-medium">{t.yourShift}: {formatTime(shift.shiftStart)} – {formatTime(shift.shiftEnd)}</p>
          </Card>

          <Card className="mb-4 rounded-2xl p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-base font-semibold">Task Progress</p>
              <p className="text-base font-medium">{doneCount}/{assignments.length} {t.tasksDone}</p>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-green-600 transition-all duration-300"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </Card>

          {assignments.length === 0 ? (
            <Card className="rounded-2xl p-5">
              <p className="text-base font-medium">{t.noTasks}. Check with your supervisor.</p>
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

                    {normalizedStatus === 'planned' ? (
                      <Button
                        className="mt-3 h-14 min-h-14 w-full bg-green-600 text-base font-semibold hover:bg-green-700"
                        disabled={isSaving}
                        onClick={() => void updateTaskStatus(assignment, 'in_progress')}
                      >
                        {t.start}
                      </Button>
                    ) : null}

                    {normalizedStatus === 'in_progress' ? (
                      <div className="mt-3 space-y-3">
                        <Button
                          className="h-14 min-h-14 w-full bg-blue-600 text-base font-semibold hover:bg-blue-700"
                          disabled={isSaving}
                          onClick={() => {
                            setActiveDonePromptId(assignment.id);
                            setActualHoursDraft((current) => ({
                              ...current,
                              [assignment.id]: current[assignment.id] ?? String(assignment.estimatedHours || 0),
                            }));
                          }}
                        >
                          {t.done}
                        </Button>

                        {activeDonePromptId === assignment.id ? (
                          <div className="rounded-xl border p-3">
                            <p className="mb-2 text-base font-medium">{t.howLong}</p>
                            <div className="grid grid-cols-4 gap-2">
                              {QUICK_HOURS_OPTIONS.map((option) => {
                                const selected = actualHoursDraft[assignment.id] === option;
                                return (
                                  <button
                                    key={option}
                                    type="button"
                                    className={`h-11 rounded-md border text-sm font-medium ${selected ? 'border-green-700 bg-green-100 text-green-900' : 'border-input bg-background text-foreground'}`}
                                    onClick={() => {
                                      setActualHoursDraft((current) => ({ ...current, [assignment.id]: option }));
                                      setShowOtherActualInputId(null);
                                    }}
                                  >
                                    {option}h
                                  </button>
                                );
                              })}
                              <button
                                type="button"
                                className={`h-11 rounded-md border text-sm font-medium ${showOtherActualInputId === assignment.id ? 'border-green-700 bg-green-100 text-green-900' : 'border-input bg-background text-foreground'}`}
                                onClick={() => setShowOtherActualInputId(assignment.id)}
                              >
                                Other
                              </button>
                            </div>

                            {showOtherActualInputId === assignment.id ? (
                              <Input
                                type="number"
                                min={0}
                                max={24}
                                step={0.5}
                                className="mt-2 h-11 text-base"
                                value={actualHoursDraft[assignment.id] ?? ''}
                                onChange={(event) =>
                                  setActualHoursDraft((current) => ({
                                    ...current,
                                    [assignment.id]: event.target.value,
                                  }))
                                }
                              />
                            ) : null}

                            <div className="mt-3 flex gap-2">
                              <Button
                                className="h-11 min-h-11 flex-1 text-base"
                                disabled={isSaving}
                                onClick={() => void completeTaskWithHours(assignment)}
                              >
                                Confirm Done
                              </Button>
                              <Button
                                className="h-11 min-h-11 px-4 text-base"
                                variant="outline"
                                onClick={() => {
                                  setActiveDonePromptId(null);
                                  setShowOtherActualInputId(null);
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {normalizedStatus === 'done' ? (
                      <div className="mt-3 flex h-14 min-h-14 items-center justify-center rounded-md bg-green-100 text-base font-semibold text-green-900">
                        {t.completed} ✓ · {(assignment.actualHours ?? assignment.estimatedHours ?? 0).toFixed(1)}h
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
            {doneCount}/{assignments.length} {t.tasksDone} · {actualHoursTotal.toFixed(1)}h actual / {scheduledHoursTotal.toFixed(1)}h scheduled
          </p>
          <Button className="mt-2 h-12 min-h-12 w-full text-base" variant="outline" onClick={() => setNeedsOpen(true)}>
            {t.reportNeed}
          </Button>
        </div>
      </footer>

      {needsOpen ? (
        <div className="fixed inset-0 z-50 bg-background">
          <div className="mx-auto flex h-full w-full max-w-[520px] flex-col px-4 pb-4 pt-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t.reportNeed}</h2>
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
