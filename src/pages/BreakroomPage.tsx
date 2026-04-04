import { useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PageHeader, AvatarInitials } from '@/components/shared';
import { ClipboardList, CloudSun, MapPin, RefreshCcw, Users } from 'lucide-react';
import { WeatherSnapshotCard } from '@/components/weather/WeatherSnapshotCard';
import { useAuth } from '@/contexts/AuthContext';
import { useOperations } from '@/contexts/OperationsContext';
import {
  useAssignments,
  useEmployees,
  useNotes,
  useScheduleEntries,
  useTasks,
  useWeatherDailyLogs,
  useWeatherLocations,
} from '@/lib/supabase-queries';

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default function BreakroomPage() {
  const queryClient = useQueryClient();
  const { currentPropertyId, currentUser } = useAuth();
  const { currentDate, department } = useOperations();
  const boardDate = toDateKey(currentDate);
  const propertyId = currentPropertyId === 'all' ? 'all' : currentPropertyId || undefined;
  const employees = useEmployees(propertyId, currentUser?.orgId).data ?? [];
  const tasks = useTasks(propertyId, currentUser?.orgId).data ?? [];
  const assignments = useAssignments(boardDate, propertyId, currentUser?.orgId).data ?? [];
  const notes = useNotes(propertyId, currentUser?.orgId).data ?? [];
  const scheduleEntries = useScheduleEntries(boardDate, propertyId, currentUser?.orgId).data ?? [];
  const weatherLogs = useWeatherDailyLogs().data ?? [];
  const weatherLocations = useWeatherLocations().data ?? [];

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['employees'] }),
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        queryClient.invalidateQueries({ queryKey: ['assignments'] }),
        queryClient.invalidateQueries({ queryKey: ['notes'] }),
        queryClient.invalidateQueries({ queryKey: ['schedule-entries'] }),
        queryClient.invalidateQueries({ queryKey: ['weather-daily-logs'] }),
        queryClient.invalidateQueries({ queryKey: ['weather-locations'] }),
      ]);
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [queryClient]);

  const scheduledEmployees = useMemo(() => {
    const scheduledIds = new Set(
      scheduleEntries
        .filter((entry) => entry.date === boardDate && entry.status === 'scheduled')
        .map((entry) => entry.employeeId),
    );
    return employees
      .filter(
        (employee) =>
          employee.status === 'active' &&
          (!propertyId || propertyId === 'all' || employee.propertyId === propertyId) &&
          (!department || department === 'All Departments' || employee.department === department) &&
          scheduledIds.has(employee.id),
      )
      .sort((left, right) => `${left.firstName} ${left.lastName}`.localeCompare(`${right.firstName} ${right.lastName}`));
  }, [boardDate, department, employees, propertyId, scheduleEntries]);

  const dayAssignments = useMemo(
    () => assignments.filter((assignment) => assignment.date === boardDate),
    [assignments, boardDate],
  );

  const priorityCards = useMemo(
    () =>
      scheduledEmployees.map((employee) => {
        const employeeAssignments = dayAssignments
          .filter((assignment) => assignment.employeeId === employee.id)
          .map((assignment) => ({
            assignment,
            task: tasks.find((task) => task.id === assignment.taskId),
          }))
          .sort((left, right) => (left.task?.priority ?? 999) - (right.task?.priority ?? 999) || left.assignment.startTime.localeCompare(right.assignment.startTime));

        return {
          employee,
          topAssignment: employeeAssignments[0],
          extraAssignments: employeeAssignments.slice(1),
        };
      }),
    [dayAssignments, scheduledEmployees, tasks],
  );

  const weatherLocationsForProperty = useMemo(
    () => weatherLocations.filter((location) => !propertyId || propertyId === 'all' || location.propertyId === propertyId),
    [propertyId, weatherLocations],
  );

  const latestWeatherLog = useMemo(() => {
    const allowedLocationIds = new Set(weatherLocationsForProperty.map((location) => location.id));
    return [...weatherLogs]
      .filter((log) => log.date <= boardDate && (!propertyId || propertyId === 'all' || allowedLocationIds.has(log.locationId)))
      .sort((left, right) => right.date.localeCompare(left.date))[0];
  }, [boardDate, propertyId, weatherLocationsForProperty, weatherLogs]);

  const weatherLocation = latestWeatherLog
    ? weatherLocations.find((location) => location.id === latestWeatherLog.locationId) ?? weatherLocationsForProperty[0] ?? weatherLocations[0]
    : weatherLocationsForProperty[0] ?? weatherLocations[0];

  const boardNotes = useMemo(
    () => notes.filter((note) => note.date === boardDate || note.type === 'general').slice(0, 6),
    [boardDate, notes],
  );

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      <PageHeader
        title="Breakroom"
        subtitle="TV wallboard for scheduled crew, top-priority work, weather, and daily notes."
        badge={<Badge variant="secondary">{department} · {boardDate}</Badge>}
      />

      <Card className="rounded-3xl border bg-card/95 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Cast View Status</div>
            <p className="mt-1 text-xs text-muted-foreground">
              This page refreshes from the shared board data every 30 seconds so it can stay on a TV without manual manager cleanup.
            </p>
          </div>
          <Badge variant="outline" className="gap-1">
            <RefreshCcw className="h-3 w-3" />
            Auto refresh every 30s
          </Badge>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Crew On Board</div>
              <div className="mt-2 text-3xl font-semibold">{scheduledEmployees.length}</div>
            </div>
            <Users className="h-5 w-5 text-primary" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Assignments</div>
              <div className="mt-2 text-3xl font-semibold">{dayAssignments.length}</div>
            </div>
            <ClipboardList className="h-5 w-5 text-primary" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Board Notes</div>
              <div className="mt-2 text-3xl font-semibold">{boardNotes.length}</div>
            </div>
            <MapPin className="h-5 w-5 text-primary" />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          {priorityCards.map(({ employee, topAssignment, extraAssignments }) => (
            <Card key={employee.id} className="rounded-3xl border bg-card/95 p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <AvatarInitials firstName={employee.firstName} lastName={employee.lastName} size="lg" />
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-2xl font-semibold">{employee.firstName} {employee.lastName}</div>
                    <Badge>{employee.group}</Badge>
                    <Badge variant="outline">{employee.role}</Badge>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">{employee.department} · {employee.workerType} · {employee.language}</div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border bg-muted/20 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Top priority</div>
                {topAssignment?.task ? (
                  <div className="mt-2">
                    <div className="text-2xl font-semibold leading-tight">{topAssignment.task.name}</div>
                    <div className="mt-2 text-base text-muted-foreground">
                      {topAssignment.assignment.startTime} · {topAssignment.assignment.area} · {topAssignment.assignment.duration} minutes
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 text-base text-muted-foreground">No workflow assignment yet.</div>
                )}
              </div>

              {extraAssignments.length > 0 ? (
                <div className="mt-4 space-y-2">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Additional tasks</div>
                  {extraAssignments.map(({ assignment, task }) => (
                    <div key={assignment.id} className="rounded-xl border px-3 py-2 text-sm">
                      {task?.name ?? 'Unknown task'} · {assignment.startTime} · {assignment.area}
                    </div>
                  ))}
                </div>
              ) : null}
            </Card>
          ))}
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <CloudSun className="h-4 w-4 text-primary" />
              <div className="font-semibold">Weather Snapshot</div>
            </div>
            <div className="mt-3">
              {weatherLocation && latestWeatherLog ? (
                <WeatherSnapshotCard location={weatherLocation} log={latestWeatherLog} compact />
              ) : (
                <p className="text-sm text-muted-foreground">No weather snapshot available for this day.</p>
              )}
            </div>
          </Card>

          <Card className="p-4">
            <div className="font-semibold">Board Notes</div>
            <div className="mt-3 space-y-3">
              {boardNotes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No daily or general notes are posted for this operating date.</p>
              ) : (
                boardNotes.map((note) => (
                  <div key={note.id} className="rounded-xl border bg-muted/20 p-3">
                    <div className="font-medium">{note.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{note.content}</div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {note.type} · {note.author} {note.location ? `· ${note.location}` : ''}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
