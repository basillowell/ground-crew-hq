import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Clock3, MapPin, MessageSquare, Phone, PlayCircle, ShieldAlert } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/sonner';
import { getBrowserLocation } from '@/lib/integrations';
import { supabase } from '@/lib/supabase';
import { useAssignments, useClockEvents, useEmployees, useProperties, useScheduleEntries, useTasks } from '@/lib/supabase-queries';
import { useAuth } from '@/contexts/AuthContext';
import { computeTimecardSummary, getOrderedAssignmentsForEmployee, getShiftMinutes } from '@/lib/laborMetrics';

const MobileFieldMap = lazy(() =>
  import('@/components/field/MobileFieldMap').then((module) => ({ default: module.MobileFieldMap })),
);

type ClockAction = 'in' | 'out' | 'break';
type PendingClockEvent = {
  employee_id: string;
  property_id: string;
  event_type: ClockAction;
  timestamp: string;
  location_lat: number | null;
  location_lng: number | null;
  localId: string;
};
const PENDING_CLOCK_EVENTS_KEY = 'pending-clock-events';

function loadPendingClockEvents() {
  if (typeof window === 'undefined') return [] as PendingClockEvent[];
  try {
    const raw = window.localStorage.getItem(PENDING_CLOCK_EVENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as PendingClockEvent[]) : [];
  } catch {
    return [];
  }
}

function savePendingClockEvents(events: PendingClockEvent[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PENDING_CLOCK_EVENTS_KEY, JSON.stringify(events));
}

function MobileFieldSkeleton() {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-[430px] flex-col gap-4 px-4 py-5">
      <Skeleton className="h-28 rounded-3xl" />
      <Skeleton className="h-48 rounded-3xl" />
      <Skeleton className="h-32 rounded-3xl" />
      <Skeleton className="h-40 rounded-3xl" />
    </div>
  );
}

export default function MobileFieldWorkspacePage() {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const { currentUser, currentPropertyId } = useAuth();
  const [shouldLoadMap, setShouldLoadMap] = useState(false);
  const [pendingClockEvents, setPendingClockEvents] = useState<PendingClockEvent[]>(() => loadPendingClockEvents());

  const effectivePropertyId =
    currentPropertyId && currentPropertyId !== 'all' ? currentPropertyId : currentUser?.propertyId ?? '';

  const propertiesQuery = useProperties();
  const employeesQuery = useEmployees(effectivePropertyId || undefined);
  const tasksQuery = useTasks(effectivePropertyId || undefined);
  const assignmentsQuery = useAssignments(today, effectivePropertyId || undefined);
  const scheduleQuery = useScheduleEntries(today, effectivePropertyId || undefined);
  const clockEventsQuery = useClockEvents(today, effectivePropertyId || undefined);
  const locationQuery = useQuery({
    queryKey: ['mobile-field-location'],
    queryFn: getBrowserLocation,
    staleTime: 1000 * 60 * 10,
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => setShouldLoadMap(true), 500);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    savePendingClockEvents(pendingClockEvents);
  }, [pendingClockEvents]);

  async function syncPendingClockEvents(showSuccessToast = false) {
    if (!supabase || pendingClockEvents.length === 0) return;

    let remaining = [...pendingClockEvents];

    for (const event of pendingClockEvents) {
      const { error } = await supabase.from('clock_events').insert({
        employee_id: event.employee_id,
        property_id: event.property_id,
        event_type: event.event_type,
        timestamp: event.timestamp,
        location_lat: event.location_lat,
        location_lng: event.location_lng,
      });

      if (!error) {
        remaining = remaining.filter((item) => item.localId !== event.localId);
      }
    }

    setPendingClockEvents(remaining);

    if (remaining.length !== pendingClockEvents.length) {
      await queryClient.invalidateQueries({ queryKey: ['clock-events'] });
    }

    if (showSuccessToast && remaining.length === 0 && pendingClockEvents.length > 0) {
      toast.success('Pending clock events synced');
    }
  }

  useEffect(() => {
    void syncPendingClockEvents();
    const handleOnline = () => {
      void syncPendingClockEvents(true);
    };
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [pendingClockEvents.length, queryClient]);

  useEffect(() => {
    if (!supabase || !currentUser?.employeeId) return;

    const channel = supabase
      .channel(`mobile-field-live-${currentUser.employeeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments', filter: `employee_id=eq.${currentUser.employeeId}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ['assignments'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_entries', filter: `employee_id=eq.${currentUser.employeeId}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ['schedule-entries'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clock_events', filter: `employee_id=eq.${currentUser.employeeId}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ['clock-events'] });
      })
      .subscribe();

    return () => {
      void channel.unsubscribe();
    };
  }, [currentUser?.employeeId, queryClient]);

  const properties = propertiesQuery.data ?? [];
  const employees = employeesQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const assignments = assignmentsQuery.data ?? [];
  const scheduleEntries = scheduleQuery.data ?? [];
  const clockEvents = clockEventsQuery.data ?? [];

  const currentEmployee = useMemo(
    () => employees.find((employee) => employee.id === currentUser?.employeeId) ?? null,
    [currentUser?.employeeId, employees],
  );

  const activeProperty = useMemo(
    () => properties.find((property) => property.id === effectivePropertyId) ?? null,
    [effectivePropertyId, properties],
  );

  const employeeSchedule = useMemo(
    () => scheduleEntries.find((entry) => entry.employeeId === currentEmployee?.id) ?? null,
    [currentEmployee?.id, scheduleEntries],
  );

  const employeeAssignments = useMemo(
    () => getOrderedAssignmentsForEmployee(assignments.filter((assignment) => assignment.employeeId === currentEmployee?.id), tasks),
    [assignments, currentEmployee?.id, tasks],
  );

  const currentAssignment =
    employeeAssignments.find((assignment) => assignment.status === 'in-progress') ??
    employeeAssignments.find((assignment) => assignment.status !== 'completed') ??
    employeeAssignments[0] ??
    null;
  const nextAssignment = employeeAssignments.find(
    (assignment) => assignment.id !== currentAssignment?.id && assignment.status !== 'completed',
  ) ?? null;
  const currentTask = tasks.find((task) => task.id === currentAssignment?.taskId);
  const nextTask = tasks.find((task) => task.id === nextAssignment?.taskId);
  const employeeClockEvents = useMemo(
    () => clockEvents.filter((event) => event.employeeId === currentEmployee?.id),
    [clockEvents, currentEmployee?.id],
  );
  const timecardSummary = useMemo(() => computeTimecardSummary(employeeClockEvents), [employeeClockEvents]);
  const clockStatusLabel = timecardSummary.statusLabel;

  const supervisor = useMemo(
    () =>
      employees.find((employee) => {
        if (employee.id === currentEmployee?.id || employee.status !== 'active') return false;
        return /manager|supervisor|lead/i.test(employee.role);
      }) ?? null,
    [currentEmployee?.id, employees],
  );

  const activeCrewMarkers = useMemo(
    () =>
      employees
        .map((employee) => {
          const lastClockIn = clockEvents.find((event) => event.employeeId === employee.id && event.eventType === 'in');
          if (!lastClockIn?.locationLat || !lastClockIn?.locationLng) return null;
          return {
            id: employee.id,
            name: `${employee.firstName} ${employee.lastName}`.trim(),
            latitude: lastClockIn.locationLat,
            longitude: lastClockIn.locationLng,
          };
        })
        .filter((marker): marker is { id: string; name: string; latitude: number; longitude: number } => Boolean(marker)),
    [clockEvents, employees],
  );

  const mapCenter =
    activeProperty?.latitude && activeProperty?.longitude
      ? ([activeProperty.latitude, activeProperty.longitude] as [number, number])
      : locationQuery.data?.ok && locationQuery.data.data
        ? ([locationQuery.data.data.latitude, locationQuery.data.data.longitude] as [number, number])
        : null;

  const isLoading =
    propertiesQuery.isLoading ||
    employeesQuery.isLoading ||
    tasksQuery.isLoading ||
    assignmentsQuery.isLoading ||
    scheduleQuery.isLoading ||
    clockEventsQuery.isLoading;

  async function recordClockEvent(eventType: ClockAction) {
    if (!supabase || !currentEmployee?.id || !effectivePropertyId) {
      toast.error('Your field profile is not ready yet.');
      return;
    }

    const coordinates = locationQuery.data?.ok ? locationQuery.data.data : null;
    const pendingEvent: PendingClockEvent = {
      employee_id: currentEmployee.id,
      property_id: effectivePropertyId,
      event_type: eventType,
      timestamp: new Date().toISOString(),
      location_lat: coordinates?.latitude ?? null,
      location_lng: coordinates?.longitude ?? null,
      localId: crypto.randomUUID(),
    };

    setPendingClockEvents((current) => [...current, pendingEvent]);

    const { error } = await supabase.from('clock_events').insert({
      employee_id: currentEmployee.id,
      property_id: effectivePropertyId,
      event_type: eventType,
      timestamp: pendingEvent.timestamp,
      location_lat: pendingEvent.location_lat,
      location_lng: pendingEvent.location_lng,
    });

    if (error) {
      toast('Saved locally - will sync when connected');
      return;
    }

    setPendingClockEvents((current) => current.filter((item) => item.localId !== pendingEvent.localId));
    toast.success(eventType === 'in' ? 'Clocked in' : eventType === 'out' ? 'Clocked out' : 'Break started');
    await queryClient.invalidateQueries({ queryKey: ['clock-events'] });
  }

  async function updateAssignmentStatus(assignmentId: string | undefined, status: 'planned' | 'in-progress' | 'completed') {
    if (!supabase || !assignmentId) {
      toast.error('This task cannot be updated yet.');
      return;
    }

    const { error } = await supabase.from('assignments').update({ status }).eq('id', assignmentId);
    if (error) {
      toast.error('Task status could not be updated.');
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ['assignments'] });
    await queryClient.invalidateQueries({ queryKey: ['dashboard-live-data'] });
    await queryClient.invalidateQueries({ queryKey: ['workflow-live-data'] });
    toast.success(status === 'completed' ? 'Task marked complete' : 'Task started');
  }

  async function markAssignmentComplete(assignmentId?: string) {
    await updateAssignmentStatus(assignmentId, 'completed');
  }

  const shiftMinutes = getShiftMinutes(employeeSchedule);
  const progressMinutes = currentAssignment?.duration ?? 0;
  const completedTasks = employeeAssignments.filter((assignment) => assignment.status === 'completed').length;
  const canClockIn = !timecardSummary.isClockedIn && !timecardSummary.isOnBreak;
  const breakButtonLabel = timecardSummary.isOnBreak ? 'Resume' : 'Break';
  const breakAction: ClockAction = timecardSummary.isOnBreak ? 'in' : 'break';

  if (isLoading) {
    return <MobileFieldSkeleton />;
  }

  if (!currentUser || !currentEmployee) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-[430px] items-center justify-center px-4 py-8">
        <Card className="w-full rounded-3xl border-border/70 p-6 text-center shadow-sm">
          <p className="text-base font-semibold text-foreground">Field access is not ready for this account.</p>
          <p className="mt-2 text-sm text-muted-foreground">Ask your admin to link your employee record and property.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[430px] flex-col gap-4 px-4 py-5">
      {pendingClockEvents.length > 0 ? (
        <Card className="rounded-2xl border-amber-300 bg-amber-50 shadow-sm">
          <div className="flex items-center justify-between gap-3 p-4">
            <div className="text-sm font-medium text-amber-950">{pendingClockEvents.length} events pending sync</div>
            <Button size="sm" variant="outline" className="min-h-11 rounded-2xl text-sm" onClick={() => void syncPendingClockEvents(true)}>
              Sync
            </Button>
          </div>
        </Card>
      ) : null}

      <Card className="rounded-3xl border-border/70 bg-card shadow-sm">
        <div className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">Today&apos;s Assignment</p>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{activeProperty?.name ?? 'Assigned Property'}</h1>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-primary" />
                  {currentAssignment?.area ?? 'Work location pending'}
                </span>
                <span>•</span>
                <span>{employeeSchedule ? `${employeeSchedule.shiftStart} - ${employeeSchedule.shiftEnd}` : 'Shift pending'}</span>
              </div>
            </div>
            <Badge variant="secondary" className="min-h-11 rounded-full px-3 text-sm">
              <Clock3 className="mr-1.5 h-4 w-4" />
              {clockStatusLabel}
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl border border-border/70 bg-background px-3 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Worked</div>
              <div className="mt-1 text-base font-semibold text-foreground">{timecardSummary.workedHours.toFixed(2)}h</div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background px-3 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Break</div>
              <div className="mt-1 text-base font-semibold text-foreground">{timecardSummary.breakMinutes} min</div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background px-3 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Shift</div>
              <div className="mt-1 text-base font-semibold text-foreground">{(shiftMinutes / 60).toFixed(1)}h</div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Current Task</p>
            <h2 className="mt-2 text-lg font-semibold text-foreground">{currentTask?.name ?? 'No active task assigned'}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {currentTask?.notes || 'Your supervisor will assign the next task when the day is ready.'}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="rounded-full">{currentAssignment?.area ?? 'No work location'}</Badge>
              <Badge variant="outline" className="rounded-full">{progressMinutes} min estimated</Badge>
              <Badge variant={currentAssignment?.status === 'completed' ? 'secondary' : 'default'} className="rounded-full">
                {(currentAssignment?.status ?? 'planned').replace('-', ' ')}
              </Badge>
            </div>
            {currentAssignment ? (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button
                  className="min-h-11 rounded-2xl text-sm"
                  variant={currentAssignment.status === 'in-progress' ? 'secondary' : 'outline'}
                  onClick={() => void updateAssignmentStatus(currentAssignment.id, 'in-progress')}
                  disabled={currentAssignment.status === 'completed'}
                >
                  <PlayCircle className="mr-2 h-4 w-4" />
                  {currentAssignment.status === 'in-progress' ? 'In Progress' : 'Start Task'}
                </Button>
                <Button
                  className="min-h-11 rounded-2xl text-sm"
                  onClick={() => void markAssignmentComplete(currentAssignment.id)}
                  disabled={currentAssignment.status === 'completed'}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Complete Task
                </Button>
              </div>
            ) : null}
            <div className="mt-4 rounded-2xl border border-dashed border-border/70 bg-background px-3 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Next Up</div>
              <div className="mt-1 text-sm font-medium text-foreground">{nextTask?.name ?? 'No next task queued yet'}</div>
              <div className="text-xs text-muted-foreground">{nextAssignment?.area ?? 'Awaiting supervisor assignment'}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button className="min-h-11 rounded-2xl text-sm" onClick={() => void recordClockEvent('in')} disabled={!canClockIn}>
              Clock In
            </Button>
            <Button className="min-h-11 rounded-2xl text-sm" variant="outline" onClick={() => void recordClockEvent(breakAction)} disabled={!timecardSummary.isClockedIn && !timecardSummary.isOnBreak}>
              {breakButtonLabel}
            </Button>
            <Button className="min-h-11 rounded-2xl text-sm" variant="outline" onClick={() => void recordClockEvent('out')} disabled={!timecardSummary.isClockedIn && !timecardSummary.isOnBreak}>
              Clock Out
            </Button>
          </div>
        </div>
      </Card>

      <Card className="rounded-3xl border-border/70 bg-card shadow-sm">
        <div className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">Task List</p>
              <h2 className="text-lg font-semibold text-foreground">Today&apos;s Work</h2>
            </div>
            <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
              {employeeAssignments.filter((assignment) => assignment.status === 'completed').length}/{employeeAssignments.length} complete
            </Badge>
          </div>

          {employeeAssignments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              No tasks are assigned yet. Check with your supervisor for the day&apos;s plan.
            </div>
          ) : (
            <div className="space-y-3">
              {employeeAssignments.map((assignment) => {
                const task = tasks.find((item) => item.id === assignment.taskId);
                const estimatedMinutes = task?.duration ?? assignment.duration ?? 0;
                const isComplete = assignment.status === 'completed';
                const isCurrent = assignment.id === currentAssignment?.id;

                return (
                  <button
                    key={assignment.id ?? `${assignment.employeeId}-${assignment.taskId}-${assignment.area}`}
                    type="button"
                    onClick={() => void (isComplete ? updateAssignmentStatus(assignment.id, 'planned') : markAssignmentComplete(assignment.id))}
                    className={`flex w-full items-start gap-3 rounded-2xl border border-border/70 bg-background px-4 py-4 text-left transition hover:border-primary/40 ${isCurrent ? 'border-primary/40 bg-primary/5' : ''}`}
                  >
                    <Checkbox checked={isComplete} className="mt-0.5 h-5 w-5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className={`text-sm font-semibold ${isComplete ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                            {task?.name ?? 'Assigned Task'}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">{assignment.area}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {(assignment.status ?? 'planned').replace('-', ' ')} {isCurrent ? '• current focus' : ''}
                          </p>
                        </div>
                        <Badge variant={isComplete ? 'secondary' : 'outline'} className="rounded-full text-xs">
                          {estimatedMinutes} min
                        </Badge>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      <Card className="rounded-3xl border-border/70 bg-card shadow-sm">
        <div className="space-y-4 p-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">Quick Contacts</p>
            <h2 className="text-lg font-semibold text-foreground">Need help?</h2>
          </div>

          <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
            <p className="text-sm font-semibold text-foreground">{supervisor ? `${supervisor.firstName} ${supervisor.lastName}` : 'Supervisor pending'}</p>
            <p className="mt-1 text-sm text-muted-foreground">{supervisor?.role ?? 'Crew lead'}</p>
          </div>

          <div className="grid gap-2">
            <Button
              variant="outline"
              className="min-h-11 justify-start rounded-2xl text-sm"
              onClick={() => {
                if (supervisor?.phone) {
                  window.location.href = `tel:${supervisor.phone}`;
                } else {
                  toast.error('No supervisor phone is on file yet.');
                }
              }}
            >
              <Phone className="mr-2 h-4 w-4" />
              {supervisor?.phone ? `Call ${supervisor.firstName}` : 'Call supervisor'}
            </Button>
            <Button
              variant="outline"
              className="min-h-11 justify-start rounded-2xl text-sm"
              onClick={() => {
                window.location.href = 'tel:911';
              }}
            >
              <ShieldAlert className="mr-2 h-4 w-4 text-destructive" />
              Emergency Contact
            </Button>
            <Button
              variant="outline"
              className="min-h-11 justify-start rounded-2xl text-sm"
              onClick={() => {
                window.location.href = '/app/messaging';
              }}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Open Messaging
            </Button>
          </div>
        </div>
      </Card>

      <Card className="rounded-3xl border-border/70 bg-card shadow-sm">
        <div className="space-y-4 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">Map</p>
              <p className="text-sm text-muted-foreground">Loads after your assignments so the page stays quick in low signal.</p>
            </div>
          </div>
          {!shouldLoadMap ? (
            <Skeleton className="h-56 rounded-2xl" />
          ) : mapCenter ? (
            <Suspense fallback={<Skeleton className="h-56 rounded-2xl" />}>
              <MobileFieldMap
                center={mapCenter}
                propertyName={activeProperty?.name ?? 'Assigned Property'}
                workLocation={currentAssignment?.area}
                crewMarkers={activeCrewMarkers}
              />
            </Suspense>
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              Allow location access or add property coordinates in Program Setup to use the field map.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
