import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle,
  CloudRain,
  MapPin,
  TrendingUp,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { Property } from '@/data/seedData';
import {
  useAssignments,
  useClockEvents,
  useEmployees,
  useEquipmentUnits,
  useNotes,
  useProperties,
  useScheduleEntries,
  useTasks,
} from '@/lib/supabase-queries';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getWeatherConditionMeta } from '@/lib/openMeteo';
import { useWeather } from '@/lib/weather';

type PropertyStats = {
  propertyId: string;
  crewScheduled: number;
  crewActive: number;
  tasksCompleted: number;
  tasksTotal: number;
  equipmentActive: number;
  equipmentDown: number;
  openWorkOrders: number;
  weatherAlert: boolean;
  complianceScore: number;
};

type PropertyOperationalStatus = 'operational' | 'maintenance' | 'critical';

const statusConfig: Record<PropertyOperationalStatus, { badgeClass: string; label: string }> = {
  operational: {
    badgeClass: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
    label: 'Operational',
  },
  maintenance: {
    badgeClass: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
    label: 'Maintenance',
  },
  critical: {
    badgeClass: 'bg-destructive/10 text-destructive border-destructive/20',
    label: 'Critical',
  },
};

function resolvePropertyStatus(stats: PropertyStats): PropertyOperationalStatus {
  if (stats.weatherAlert || stats.openWorkOrders >= 6 || stats.equipmentDown >= 4) return 'critical';
  if (stats.openWorkOrders >= 3 || stats.equipmentDown >= 2) return 'maintenance';
  return 'operational';
}

function AggregateMetricCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <Card className="rounded-2xl border p-6 shadow-sm transition-all hover:shadow-md">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{label}</div>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="text-3xl font-semibold" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
    </Card>
  );
}

function PropertyCard({
  property,
  stats,
  manager,
  onClick,
}: {
  property: Property;
  stats: PropertyStats;
  manager: string;
  onClick: () => void;
}) {
  const status = resolvePropertyStatus(stats);
  const taskCompletionPct = stats.tasksTotal > 0 ? Math.round((stats.tasksCompleted / stats.tasksTotal) * 100) : 0;
  const weatherQuery = useWeather(property.id);
  const weatherMeta = getWeatherConditionMeta(weatherQuery.data?.current.weatherCode);
  const WeatherIcon = weatherMeta.icon;

  return (
    <Card
      className="group overflow-hidden rounded-2xl border transition-all hover:border-primary/50 hover:shadow-lg"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <div className="p-6">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex-1">
            <h3 className="mb-2 text-lg font-semibold">{property.name}</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {property.city}, {property.state} - {property.acreage} acres
            </div>
          </div>
          <Badge variant="outline" className={`px-3 py-1.5 text-xs font-medium ${statusConfig[status].badgeClass}`}>
            {statusConfig[status].label}
          </Badge>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-4">
          <div>
            <div className="mb-1 text-sm text-muted-foreground">Manager</div>
            <div className="text-sm font-medium">{manager}</div>
          </div>
          <div>
            <div className="mb-1 text-sm text-muted-foreground">Compliance</div>
            <div className="text-sm font-medium">{stats.complianceScore}%</div>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-4 border-t pt-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10">
              <Users className="h-4 w-4 text-sky-700" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Crew</div>
              <div className="text-sm font-semibold">{stats.crewActive}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10">
              <Wrench className="h-4 w-4 text-emerald-700" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Equipment</div>
              <div className="text-sm font-semibold">{stats.equipmentActive}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10">
              <AlertCircle className="h-4 w-4 text-amber-700" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Issues</div>
              <div className="text-sm font-semibold">{stats.openWorkOrders}</div>
            </div>
          </div>
        </div>

        <div className="mb-3 space-y-1.5">
          <div className="flex justify-between text-[11px]">
            <span className="text-muted-foreground">Task completion</span>
            <span className="font-medium">
              {stats.tasksCompleted}/{stats.tasksTotal}
            </span>
          </div>
          <Progress value={taskCompletionPct} className="h-1.5" />
        </div>

        <div className="rounded-xl border bg-muted/20 px-3 py-2">
          {weatherQuery.isLoading ? (
            <div className="text-[11px] text-muted-foreground">Loading weather...</div>
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
            <div className="text-[11px] text-muted-foreground">Add property coordinates to show live weather.</div>
          )}
        </div>
      </div>

      <div className="border-t bg-accent/50 px-6 py-4">
        <button className="text-sm font-medium text-primary transition-colors hover:text-primary/80">
          View Details
        </button>
      </div>
    </Card>
  );
}

export default function CommandCenterOperationalPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const { currentPropertyId, setCurrentPropertyId, currentUser, isAdmin, isManager } = useAuth();

  const today = new Date().toISOString().slice(0, 10);
  const propertyScope = currentPropertyId === 'all' ? 'all' : currentPropertyId || currentUser?.propertyId || undefined;

  const propertiesQuery = useProperties(currentUser?.orgId);
  const employeesQuery = useEmployees(propertyScope, currentUser?.orgId);
  const assignmentsQuery = useAssignments(today, propertyScope, currentUser?.orgId);
  const scheduleEntriesQuery = useScheduleEntries(today, propertyScope, currentUser?.orgId);
  const tasksQuery = useTasks(propertyScope, currentUser?.orgId);
  const notesQuery = useNotes(propertyScope, currentUser?.orgId);
  const equipmentUnitsQuery = useEquipmentUnits(propertyScope, currentUser?.orgId);
  const clockEventsQuery = useClockEvents(today, propertyScope, currentUser?.orgId);

  const allProperties = propertiesQuery.data ?? [];
  const properties = useMemo(() => {
    if (isAdmin || isManager) return allProperties;
    if (!currentUser?.propertyId) return [];
    return allProperties.filter((property) => property.id === currentUser.propertyId);
  }, [allProperties, currentUser?.propertyId, isAdmin, isManager]);

  const employees = employeesQuery.data ?? [];
  const assignments = assignmentsQuery.data ?? [];
  const scheduleEntries = scheduleEntriesQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const notes = notesQuery.data ?? [];
  const equipmentUnits = equipmentUnitsQuery.data ?? [];
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_entries', filter: `date=eq.${today}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ['schedule-entries', today] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments', filter: `date=eq.${today}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ['assignments', today] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clock_events' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['clock-events', today] });
      })
      .subscribe();

    return () => {
      void channel.unsubscribe();
    };
  }, [queryClient, today]);

  const propertyStats = useMemo<PropertyStats[]>(() => {
    return properties.map((property) => {
      const propertyEmployees = employees.filter((employee) => employee.propertyId === property.id && employee.status === 'active');
      const propertyEmployeeIds = new Set(propertyEmployees.map((employee) => employee.id));
      const scheduledToday = scheduleEntries.filter(
        (entry) => entry.date === today && entry.status === 'scheduled' && propertyEmployeeIds.has(entry.employeeId),
      );
      const propertyAssignments = assignments.filter(
        (assignment) => assignment.date === today && propertyEmployeeIds.has(assignment.employeeId),
      );
      const equipmentAtProperty = equipmentUnits.filter((unit) => (unit as { propertyId?: string }).propertyId === property.id);
      const propertyAlerts = notes.filter((note) => note.type === 'alert');
      const weatherAlert = propertyAlerts.some((note) => /weather|storm|rain/i.test(`${note.title} ${note.content}`));
      const equipmentDown = equipmentAtProperty.filter(
        (unit) => unit.status === 'maintenance' || unit.status === 'out-of-service',
      ).length;
      const openWorkOrders = propertyAlerts.length;
      const taskBacklog = tasks.filter((task) => (task.status ?? 'active') === 'active').length;

      return {
        propertyId: property.id,
        crewScheduled: scheduledToday.length,
        crewActive: new Set(propertyAssignments.map((assignment) => assignment.employeeId)).size,
        tasksCompleted: propertyAssignments.length,
        tasksTotal: Math.max(taskBacklog, propertyAssignments.length),
        equipmentActive: equipmentAtProperty.filter(
          (unit) => unit.status === 'available' || unit.status === 'in-use',
        ).length,
        equipmentDown,
        openWorkOrders,
        weatherAlert,
        complianceScore: Math.max(74, 100 - equipmentDown * 8 - openWorkOrders * 3),
      };
    });
  }, [assignments, employees, equipmentUnits, notes, properties, scheduleEntries, tasks, today]);

  const totals = useMemo(() => {
    return propertyStats.reduce(
      (acc, stats) => ({
        crew: acc.crew + stats.crewActive,
        equipment: acc.equipment + stats.equipmentActive,
        issues: acc.issues + stats.openWorkOrders,
      }),
      { crew: 0, equipment: 0, issues: 0 },
    );
  }, [propertyStats]);

  const activeEmployeesCount = useMemo(
    () => employees.filter((employee) => employee.status === 'active').length,
    [employees],
  );

  const managerByProperty = useMemo(() => {
    return new Map(
      properties.map((property) => {
        const propertyEmployees = employees.filter((employee) => employee.propertyId === property.id);
        const manager =
          propertyEmployees.find((employee) => /manager|supervisor|lead/i.test(employee.role)) ?? propertyEmployees[0];
        const managerName = manager
          ? `${manager.firstName} ${manager.lastName}`
          : currentUser?.fullName || 'Operations Lead';
        return [property.id, managerName];
      }),
    );
  }, [currentUser?.fullName, employees, properties]);

  const liveCrew = useMemo(() => {
    return employees
      .filter((employee) => employee.status === 'active')
      .slice(0, 6)
      .map((employee) => {
        const assignment = assignments.find((entry) => entry.employeeId === employee.id && entry.date === today);
        const isScheduled = scheduleEntries.some(
          (entry) => entry.employeeId === employee.id && entry.date === today && entry.status === 'scheduled',
        );
        const latestClockEvent = clockEvents.find((event) => event.employeeId === employee.id);

        return {
          id: employee.id,
          name: `${employee.firstName} ${employee.lastName}`,
          role: employee.role,
          status:
            latestClockEvent?.eventType === 'out'
              ? 'traveling'
              : latestClockEvent?.eventType === 'break'
                ? 'on-break'
                : assignment || latestClockEvent?.eventType === 'in'
                  ? 'active'
                  : isScheduled
                    ? 'on-break'
                    : 'traveling',
          currentTask: assignment ? tasks.find((task) => task.id === assignment.taskId)?.name || 'Assigned' : '',
        };
      });
  }, [assignments, clockEvents, employees, scheduleEntries, tasks, today]);

  const performanceRows = useMemo(() => {
    return properties.map((property) => {
      const stats = propertyStats.find((item) => item.propertyId === property.id);
      if (!stats) {
        return {
          id: property.id,
          name: property.name,
          coveragePct: 0,
          trendPct: 0,
          crews: 0,
        };
      }

      const coveragePct = stats.crewScheduled > 0 ? Math.min(100, Math.round((stats.crewActive / stats.crewScheduled) * 100)) : 0;
      const trendPct = stats.tasksTotal > 0 ? Math.round((stats.tasksCompleted / stats.tasksTotal) * 20 - 4) : 0;

      return {
        id: property.id,
        name: property.name,
        coveragePct,
        trendPct,
        crews: stats.crewActive,
      };
    });
  }, [properties, propertyStats]);

  const openPropertyWorkflow = (propertyId: string) => {
    setCurrentPropertyId(propertyId);
    navigate(`/app/workboard?property=${encodeURIComponent(propertyId)}&focus=requests`);
  };

  const isLoading =
    propertiesQuery.isLoading ||
    employeesQuery.isLoading ||
    assignmentsQuery.isLoading ||
    scheduleEntriesQuery.isLoading ||
    tasksQuery.isLoading ||
    equipmentUnitsQuery.isLoading;

  return (
    <div className="h-full overflow-auto bg-background p-6">
      <div className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Properties</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage locations, resources, and operational status
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/app/workboard')}>
              <ArrowRight className="mr-2 h-4 w-4" />
              Open Workboard
            </Button>
            <Button onClick={() => navigate('/app/settings')}>
              <MapPin className="mr-2 h-4 w-4" />
              Manage Properties
            </Button>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <AggregateMetricCard icon={MapPin} label="Total Properties" value={properties.length} />
        <AggregateMetricCard icon={Users} label="Active Crews" value={totals.crew} />
        <AggregateMetricCard icon={Wrench} label="Total Equipment" value={totals.equipment} />
        <AggregateMetricCard icon={AlertCircle} label="Open Issues" value={totals.issues} accent="hsl(var(--warning))" />
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">Property View</h3>
        <Tabs value={view} onValueChange={(value) => setView(value as 'grid' | 'list')}>
          <TabsList className="h-9">
            <TabsTrigger value="grid" className="px-4 text-xs">Grid</TabsTrigger>
            <TabsTrigger value="list" className="px-4 text-xs">List</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-64 rounded-2xl" />
          ))}
        </div>
      ) : view === 'grid' ? (
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {properties.map((property) => {
            const stats = propertyStats.find((item) => item.propertyId === property.id);
            if (!stats) return null;
            return (
              <PropertyCard
                key={property.id}
                property={property}
                stats={stats}
                manager={managerByProperty.get(property.id) ?? 'Operations Lead'}
                onClick={() => openPropertyWorkflow(property.id)}
              />
            );
          })}
        </div>
      ) : (
        <Card className="mb-6 divide-y rounded-2xl border">
          {properties.map((property) => {
            const stats = propertyStats.find((item) => item.propertyId === property.id);
            if (!stats) return null;
            const status = resolvePropertyStatus(stats);
            const taskCompletionPct = stats.tasksTotal > 0 ? Math.round((stats.tasksCompleted / stats.tasksTotal) * 100) : 0;
            return (
              <div
                key={property.id}
                className="flex cursor-pointer items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/30"
                onClick={() => openPropertyWorkflow(property.id)}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: property.color }}>
                  {property.logoInitials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{property.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {property.city}, {property.state} - {managerByProperty.get(property.id) ?? 'Operations Lead'}
                  </div>
                </div>
                <div className="hidden items-center gap-4 text-xs md:flex">
                  <span>{stats.crewActive} crew</span>
                  <span>{taskCompletionPct}% tasks</span>
                  <span>{stats.equipmentActive} equip</span>
                </div>
                <Badge variant="outline" className={statusConfig[status].badgeClass}>
                  {statusConfig[status].label}
                </Badge>
              </div>
            );
          })}
        </Card>
      )}

      <Card className="mb-6 rounded-2xl border p-6 shadow-sm">
        <h3 className="mb-6 text-lg font-semibold">Property Performance</h3>
        <div className="space-y-4">
          {performanceRows.map((row) => (
            <div key={row.id} className="flex items-center gap-4">
              <div className="w-48 truncate font-medium">{row.name}</div>
              <div className="flex-1">
                <div className="flex h-10 items-center overflow-hidden rounded-xl bg-muted">
                  <div
                    className="flex h-full items-center justify-end rounded-xl bg-primary px-3"
                    style={{ width: `${Math.max(row.coveragePct, 8)}%` }}
                  >
                    <span className="text-xs font-medium text-primary-foreground">{row.crews} crews</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                <TrendingUp className="h-4 w-4" />
                <span>{row.trendPct >= 0 ? `+${row.trendPct}%` : `${row.trendPct}%`}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="rounded-2xl border p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <Activity className="h-5 w-5 text-primary" />
            Live Crew Activity
          </h3>
          <Badge variant="outline" className="text-xs">
            <span className="mr-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Realtime
          </Badge>
        </div>

        {liveCrew.length === 0 ? (
          <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            No active crew data yet for today.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {liveCrew.map((member) => {
              const statusColor =
                member.status === 'active'
                  ? 'bg-emerald-500'
                  : member.status === 'on-break'
                    ? 'bg-amber-500'
                    : 'bg-sky-500';

              return (
                <div key={member.id} className="flex items-center gap-3 rounded-xl border p-3">
                  <span className={`h-2 w-2 rounded-full ${statusColor}`} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{member.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {member.currentTask || member.status.replace('-', ' ')}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {member.role}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/app/scheduler')}>
            <Calendar className="mr-1.5 h-3.5 w-3.5" />
            Scheduler
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/app/workboard')}>
            <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
            Workboard
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/app/reports')}>
            <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
            Reports
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/app/weather')}>
            <CloudRain className="mr-1.5 h-3.5 w-3.5" />
            Weather
          </Button>
        </div>
      </Card>

      {notes.some((note) => note.type === 'alert') ? (
        <Card className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <CloudRain className="mt-0.5 h-4 w-4 text-destructive" />
            <div>
              <div className="text-sm font-semibold text-destructive">Active Alerts</div>
              <p className="mt-1 text-xs text-muted-foreground">
                {notes.filter((note) => note.type === 'alert').length} alert(s) detected across properties.
              </p>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
