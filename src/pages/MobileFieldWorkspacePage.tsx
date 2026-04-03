import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Clock3, MapPin, MessageSquare, Phone, ShieldAlert } from 'lucide-react';
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

const MobileFieldMap = lazy(() =>
  import('@/components/field/MobileFieldMap').then((module) => ({ default: module.MobileFieldMap })),
);

type ClockAction = 'in' | 'out' | 'break';

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
    () =>
      assignments
        .filter((assignment) => assignment.employeeId === currentEmployee?.id)
        .sort((left, right) => {
          if ((left.status ?? 'planned') === 'completed' && (right.status ?? 'planned') !== 'completed') return 1;
          if ((right.status ?? 'planned') === 'completed' && (left.status ?? 'planned') !== 'completed') return -1;
          return left.startTime.localeCompare(right.startTime);
        }),
    [assignments, currentEmployee?.id],
  );

  const currentAssignment = employeeAssignments.find((assignment) => assignment.status !== 'completed') ?? employeeAssignments[0] ?? null;
  const currentTask = tasks.find((task) => task.id === currentAssignment?.taskId);
  const latestClockEvent = clockEvents.find((event) => event.employeeId === currentEmployee?.id) ?? null;
  const clockStatusLabel =
    latestClockEvent?.eventType === 'in'
      ? 'Clocked in'
      : latestClockEvent?.eventType === 'break'
        ? 'On break'
        : latestClockEvent?.eventType === 'out'
          ? 'Clocked out'
          : 'Ready to start';

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
    const { error } = await supabase.from('clock_events').insert({
      employee_id: currentEmployee.id,
      property_id: effectivePropertyId,
      event_type: eventType,
      timestamp: new Date().toISOString(),
      location_lat: coordinates?.latitude ?? null,
      location_lng: coordinates?.longitude ?? null,
    });

    if (error) {
      toast.error('Clock event could not be saved.');
      return;
    }

    toast.success(eventType === 'in' ? 'Clocked in' : eventType === 'out' ? 'Clocked out' : 'Break started');
    await queryClient.invalidateQueries({ queryKey: ['clock-events'] });
  }

  async function markAssignmentComplete(assignmentId?: string) {
    if (!supabase || !assignmentId) {
      toast.error('This task cannot be updated yet.');
      return;
    }

    const { error } = await supabase.from('assignments').update({ status: 'completed' }).eq('id', assignmentId);

    if (error) {
      toast.error('Task status could not be updated.');
      return;
    }

    toast.success('Task marked complete');
    await queryClient.invalidateQueries({ queryKey: ['assignments'] });
    await queryClient.invalidateQueries({ queryKey: ['dashboard-live-data'] });
    await queryClient.invalidateQueries({ queryKey: ['workflow-live-data'] });
  }

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

          <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Current Task</p>
            <h2 className="mt-2 text-lg font-semibold text-foreground">{currentTask?.name ?? 'No active task assigned'}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {currentTask?.notes || 'Your supervisor will assign the next task when the day is ready.'}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button className="min-h-11 rounded-2xl text-sm" onClick={() => void recordClockEvent('in')}>
              Clock In
            </Button>
            <Button className="min-h-11 rounded-2xl text-sm" variant="outline" onClick={() => void recordClockEvent('break')}>
              Break
            </Button>
            <Button className="min-h-11 rounded-2xl text-sm" variant="outline" onClick={() => void recordClockEvent('out')}>
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

                return (
                  <button
                    key={assignment.id ?? `${assignment.employeeId}-${assignment.taskId}-${assignment.area}`}
                    type="button"
                    onClick={() => void markAssignmentComplete(assignment.id)}
                    className="flex w-full items-start gap-3 rounded-2xl border border-border/70 bg-background px-4 py-4 text-left transition hover:border-primary/40"
                  >
                    <Checkbox checked={isComplete} className="mt-0.5 h-5 w-5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className={`text-sm font-semibold ${isComplete ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                            {task?.name ?? 'Assigned Task'}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">{assignment.area}</p>
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
