import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, Calendar, CloudRain, MapPin, Plus, Users, Wrench } from 'lucide-react';
import {
  useAssignments,
  useClockEvents,
  useEmployees,
  useEquipmentUnits,
  useNotes,
  useProperties,
  useScheduleEntries,
} from '@/lib/supabase-queries';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getWeatherConditionMeta } from '@/lib/openMeteo';
import { useWeather } from '@/lib/weather';

function SummaryCard({
  title,
  value,
  onClick,
}: {
  title: string;
  value: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left"
    >
      <Card className="rounded-2xl border p-5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
        <div className="mt-2 text-3xl font-semibold">{value}</div>
      </Card>
    </button>
  );
}

function PropertySummaryCard({
  property,
  onViewDetails,
  onOpenWeatherSettings,
}: {
  property: {
    id: string;
    name: string;
    city: string;
    state: string;
    status: string;
    latitude?: number;
    longitude?: number;
  };
  onViewDetails: () => void;
  onOpenWeatherSettings: () => void;
}) {
  const weatherQuery = useWeather(property.id);
  const [showWeatherTimeout, setShowWeatherTimeout] = useState(false);
  const hasCoordinates = typeof property.latitude === 'number' && typeof property.longitude === 'number';

  useEffect(() => {
    if (!weatherQuery.isLoading) {
      setShowWeatherTimeout(false);
      return;
    }
    const timeoutId = window.setTimeout(() => setShowWeatherTimeout(true), 10000);
    return () => window.clearTimeout(timeoutId);
  }, [weatherQuery.isLoading]);

  const weatherMeta = getWeatherConditionMeta(weatherQuery.data?.current.weatherCode);
  const WeatherIcon = weatherMeta.icon;

  return (
    <Card className="rounded-2xl border p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">{property.name}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            {property.city}, {property.state}
          </p>
        </div>
        <Badge variant="outline" className="capitalize">
          {property.status}
        </Badge>
      </div>

      <div className="mt-4 rounded-xl border bg-muted/20 px-3 py-2">
        {weatherQuery.isLoading && !showWeatherTimeout ? (
          <div className="text-xs text-muted-foreground">Loading weather...</div>
        ) : weatherQuery.isLoading && showWeatherTimeout ? (
          hasCoordinates ? (
            <div className="text-xs text-muted-foreground">Weather temporarily unavailable</div>
          ) : (
            <button type="button" className="text-xs text-primary hover:underline" onClick={onOpenWeatherSettings}>
              Set weather location in Weather settings →
            </button>
          )
        ) : weatherQuery.data ? (
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <WeatherIcon className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium text-foreground">{Math.round(weatherQuery.data.current.temperature)}F</span>
              <span className="text-muted-foreground">{weatherMeta.label}</span>
            </div>
            <span className="text-muted-foreground">Wind {Math.round(weatherQuery.data.current.windSpeed)} mph</span>
          </div>
        ) : (
          hasCoordinates ? (
            <div className="text-xs text-muted-foreground">Weather temporarily unavailable</div>
          ) : (
            <button type="button" className="text-xs text-primary hover:underline" onClick={onOpenWeatherSettings}>
              Set weather location in Weather settings →
            </button>
          )
        )}
      </div>

      <div className="mt-4">
        <button type="button" onClick={onViewDetails} className="text-sm font-medium text-primary transition-colors hover:text-primary/80">
          View Details
        </button>
      </div>
    </Card>
  );
}

export default function CommandCenterOperationalPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentPropertyId, setCurrentPropertyId, currentUser, isAdmin, isManager } = useAuth();
  const [currentDate] = useState(() => new Date());

  const todayKey = currentDate.toISOString().slice(0, 10);
  const propertyScope = currentPropertyId === 'all' ? 'all' : currentPropertyId || currentUser?.propertyId || undefined;

  const propertiesQuery = useProperties(currentUser?.orgId);
  const employeesQuery = useEmployees(propertyScope, currentUser?.orgId);
  const assignmentsQuery = useAssignments(todayKey, propertyScope, currentUser?.orgId);
  const scheduleEntriesQuery = useScheduleEntries(todayKey, propertyScope, currentUser?.orgId);
  const equipmentUnitsQuery = useEquipmentUnits(propertyScope, currentUser?.orgId);
  const notesQuery = useNotes(propertyScope, currentUser?.orgId);
  const clockEventsQuery = useClockEvents(todayKey, propertyScope, currentUser?.orgId);

  const allProperties = propertiesQuery.data ?? [];
  const properties = useMemo(() => {
    if (isAdmin || isManager) return allProperties;
    if (!currentUser?.propertyId) return [];
    return allProperties.filter((property) => property.id === currentUser.propertyId);
  }, [allProperties, currentUser?.propertyId, isAdmin, isManager]);

  const employees = employeesQuery.data ?? [];
  const assignments = assignmentsQuery.data ?? [];
  const scheduleEntries = scheduleEntriesQuery.data ?? [];
  const equipmentUnits = equipmentUnitsQuery.data ?? [];
  const notes = notesQuery.data ?? [];
  const clockEvents = clockEventsQuery.data ?? [];

  useEffect(() => {
    if (isAdmin || isManager) {
      if (!currentPropertyId) setCurrentPropertyId('all');
      return;
    }
    if (!currentPropertyId && properties.length > 0) setCurrentPropertyId(properties[0].id);
  }, [currentPropertyId, isAdmin, isManager, properties, setCurrentPropertyId]);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('dashboard-live-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_entries', filter: `date=eq.${todayKey}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ['schedule-entries', todayKey] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments', filter: `date=eq.${todayKey}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ['assignments', todayKey] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clock_events' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['clock-events', todayKey] });
      })
      .subscribe();

    return () => {
      void channel.unsubscribe();
    };
  }, [queryClient, todayKey]);

  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.status === 'active'),
    [employees],
  );

  const assignmentsByEmployeeId = useMemo(() => {
    const map = new Map<string, (typeof assignments)[number]>();
    for (const assignment of assignments) {
      if (assignment.date !== todayKey) continue;
      if (!map.has(assignment.employeeId)) map.set(assignment.employeeId, assignment);
    }
    return map;
  }, [assignments, todayKey]);

  const scheduledRows = useMemo(() => {
    return scheduleEntries
      .filter((entry) => entry.date === todayKey && entry.status === 'scheduled')
      .map((entry) => {
        const employee = activeEmployees.find((item) => item.id === entry.employeeId);
        if (!employee) return null;
        const hasAssignment = assignmentsByEmployeeId.has(employee.id);
        return {
          id: entry.id,
          name: `${employee.firstName} ${employee.lastName}`,
          department: employee.department || 'Unassigned',
          shiftStart: entry.shiftStart,
          shiftEnd: entry.shiftEnd,
          assigned: hasAssignment,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
  }, [activeEmployees, assignmentsByEmployeeId, scheduleEntries, todayKey]);

  const crewScheduledCount = scheduledRows.length;
  const tasksAssignedCount = assignments.filter((assignment) => assignment.date === todayKey).length;
  const equipmentActiveCount = equipmentUnits.filter(
    (unit) => unit.status === 'active' || unit.status === 'available' || unit.status === 'in-use',
  ).length;
  const openIssuesCount = equipmentUnits.filter(
    (unit) => unit.status === 'maintenance' || unit.status === 'out-of-service',
  ).length;

  const selectedProperty = useMemo(() => {
    if (currentPropertyId && currentPropertyId !== 'all') {
      return properties.find((property) => property.id === currentPropertyId) ?? properties[0] ?? null;
    }
    return properties[0] ?? null;
  }, [currentPropertyId, properties]);

  const isLoading =
    propertiesQuery.isLoading ||
    employeesQuery.isLoading ||
    assignmentsQuery.isLoading ||
    scheduleEntriesQuery.isLoading ||
    equipmentUnitsQuery.isLoading;

  return (
    <div className="h-full overflow-auto bg-background p-6">
      <div className="mb-4">
        <h2 className="text-2xl font-semibold tracking-tight">Today's Operations Summary</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Morning snapshot of crew, assignments, and equipment readiness.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard title="Crew Scheduled Today" value={crewScheduledCount} onClick={() => navigate('/app/scheduler')} />
        <SummaryCard title="Tasks Assigned" value={tasksAssignedCount} onClick={() => navigate('/app/workboard')} />
        <SummaryCard title="Equipment Active" value={equipmentActiveCount} onClick={() => navigate('/app/equipment')} />
        <SummaryCard title="Open Issues" value={openIssuesCount} onClick={() => navigate('/app/equipment')} />
      </div>

      <Card className="mb-6 rounded-2xl border p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Button className="h-12 rounded-full text-sm font-semibold" onClick={() => navigate('/app/workboard')}>
            <ArrowRight className="mr-2 h-4 w-4" />
            Build Today's Plan
          </Button>
          <Button className="h-12 rounded-full text-sm font-semibold" variant="secondary" onClick={() => navigate('/app/scheduler')}>
            <Calendar className="mr-2 h-4 w-4" />
            Add Shift
          </Button>
          <Button className="h-12 rounded-full text-sm font-semibold" variant="outline" onClick={() => navigate('/app/employees')}>
            <Plus className="mr-2 h-4 w-4" />
            Add Employee
          </Button>
        </div>
      </Card>

      <Card className="mb-6 rounded-2xl border p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold">Today's Crew</h3>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : scheduledRows.length === 0 ? (
          <div className="rounded-xl border border-dashed px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">No crew scheduled today</p>
            <Button className="mt-3" size="sm" onClick={() => navigate('/app/scheduler')}>
              Go to Scheduler
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 font-medium">Employee</th>
                  <th className="pb-3 font-medium">Department</th>
                  <th className="pb-3 font-medium">Shift</th>
                  <th className="pb-3 font-medium">Assignment</th>
                </tr>
              </thead>
              <tbody>
                {scheduledRows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="py-3 font-medium">{row.name}</td>
                    <td className="py-3 text-muted-foreground">{row.department}</td>
                    <td className="py-3">{row.shiftStart} - {row.shiftEnd}</td>
                    <td className="py-3">
                      <Badge variant={row.assigned ? 'default' : 'outline'}>
                        {row.assigned ? 'Assigned' : 'Unassigned'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selectedProperty ? (
        <PropertySummaryCard
          property={selectedProperty}
          onOpenWeatherSettings={() => navigate('/app/weather')}
          onViewDetails={() => {
            setCurrentPropertyId(selectedProperty.id);
            navigate(`/app/workboard?property=${encodeURIComponent(selectedProperty.id)}`);
          }}
        />
      ) : (
        <Card className="rounded-2xl border p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">No properties available yet.</div>
        </Card>
      )}

      {notes.some((note) => note.type === 'alert') && !isLoading ? (
        <Card className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <CloudRain className="mt-0.5 h-4 w-4 text-destructive" />
            <div>
              <div className="text-sm font-semibold text-destructive">Active Alerts</div>
              <p className="mt-1 text-xs text-muted-foreground">
                {notes.filter((note) => note.type === 'alert').length} alert(s) detected today.
              </p>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
