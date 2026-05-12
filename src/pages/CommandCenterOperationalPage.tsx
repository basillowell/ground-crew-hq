import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/sonner';
import { ArrowRight, Calendar, CheckCircle2, Circle, CloudRain, MapPin, Plus, Users, Wrench } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getWeatherConditionMeta } from '@/lib/openMeteo';
import { useWeather } from '@/lib/weather';
import { useDashboardData } from '@/hooks/useDashboardData';

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

function OpsSignalCard({
  title,
  value,
  subtitle,
  tone = 'neutral',
}: {
  title: string;
  value: string;
  subtitle: string;
  tone?: 'good' | 'warning' | 'critical' | 'neutral';
}) {
  const toneClass =
    tone === 'good'
      ? 'border-emerald-200/70 bg-emerald-50/60'
      : tone === 'warning'
        ? 'border-amber-200/70 bg-amber-50/60'
        : tone === 'critical'
          ? 'border-red-200/70 bg-red-50/50'
          : 'border-border bg-card';
  return (
    <Card className={`rounded-2xl p-5 shadow-sm ${toneClass}`}>
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{title}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
    </Card>
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
  const { currentPropertyId, setCurrentPropertyId, currentUser, isAdmin, isManager, isReady, orgId } = useAuth();
  const [currentDate] = useState(() => new Date());
  const [queryTimeoutReached, setQueryTimeoutReached] = useState(false);

  const todayKey = currentDate.toISOString().slice(0, 10);
  const propertyScope = currentPropertyId === 'all' ? 'all' : currentPropertyId || currentUser?.propertyId || undefined;
  const start30Date = useMemo(() => {
    const date = new Date(currentDate);
    date.setDate(date.getDate() - 30);
    return date.toISOString().slice(0, 10);
  }, [currentDate]);

  const dashboardDataQuery = useDashboardData({
    orgId: orgId ?? undefined,
    propertyScope,
    todayKey,
    start30Date,
  });

  const allProperties = dashboardDataQuery.data?.properties ?? [];
  const properties = useMemo(() => {
    if (isAdmin || isManager) return allProperties;
    if (!currentUser?.propertyId) return [];
    return allProperties.filter((property) => property.id === currentUser.propertyId);
  }, [allProperties, currentUser?.propertyId, isAdmin, isManager]);

  const employees = dashboardDataQuery.data?.employees ?? [];
  const assignments = dashboardDataQuery.data?.assignments ?? [];
  const scheduleEntries = dashboardDataQuery.data?.scheduleEntries ?? [];
  const scheduleEntriesLast30 = dashboardDataQuery.data?.scheduleEntriesLast30 ?? [];
  const equipmentUnits = dashboardDataQuery.data?.equipmentUnits ?? [];
  const tasks = dashboardDataQuery.data?.tasks ?? [];
  const weatherLocations = dashboardDataQuery.data?.weatherLocations ?? [];
  const notes = dashboardDataQuery.data?.notes ?? [];
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

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
        void dashboardDataQuery.refetch();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments', filter: `date=eq.${todayKey}` }, () => {
        void dashboardDataQuery.refetch();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clock_events' }, () => {
        void dashboardDataQuery.refetch();
      })
      .subscribe();

    return () => {
      void channel.unsubscribe();
    };
  }, [dashboardDataQuery, queryClient, todayKey]);

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
  const selectedWeatherQuery = useWeather(selectedProperty?.id);

  const onboardingDismissKey = useMemo(
    () => (currentUser?.orgId ? `gcrew-onboarding-dismissed-${currentUser.orgId}` : ''),
    [currentUser?.orgId],
  );

  useEffect(() => {
    if (!onboardingDismissKey) return;
    setOnboardingDismissed(localStorage.getItem(onboardingDismissKey) === 'true');
  }, [onboardingDismissKey]);

  const onboardingItems = useMemo(() => {
    const items = [
      { id: 'employees', label: 'Add your first employee', complete: employees.length > 0, action: 'Add employee →', to: '/app/employees' },
      { id: 'weather', label: 'Set up weather for this property', complete: weatherLocations.length > 0, action: 'Set up weather →', to: '/app/weather?setup=true' },
      { id: 'equipment', label: 'Add your equipment fleet', complete: equipmentUnits.length > 0, action: 'Add equipment →', to: '/app/equipment' },
      { id: 'tasks', label: 'Build your task library', complete: tasks.length > 0, action: 'Add tasks →', to: '/app/tasks' },
      { id: 'schedule', label: 'Schedule your first shift', complete: scheduleEntries.length > 0, action: 'Open scheduler →', to: '/app/scheduler' },
      { id: 'assign', label: 'Assign work on the workboard', complete: assignments.length > 0, action: 'Open workboard →', to: '/app/workboard' },
    ];
    return items;
  }, [assignments.length, employees.length, equipmentUnits.length, scheduleEntries.length, tasks.length, weatherLocations.length]);

  const onboardingCompleted = onboardingItems.filter((item) => item.complete).length;
  const showGettingStarted =
    !onboardingDismissed &&
    employees.length < 3 &&
    scheduleEntriesLast30.length === 0 &&
    onboardingCompleted < onboardingItems.length;

  const pendingAssignmentsCount = useMemo(
    () => assignments.filter((assignment) => assignment.date === todayKey && assignment.status !== 'completed').length,
    [assignments, todayKey],
  );

  const lastWeatherLogSummary = useMemo(() => {
    const weatherNote = notes
      .filter((note) => note.type === 'weather' || note.type === 'alert')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    if (!weatherNote) return 'No weather log summary available yet.';
    return weatherNote.title || weatherNote.content || 'Weather log captured.';
  }, [notes]);

  const unassignedScheduledCount = useMemo(
    () => scheduledRows.filter((row) => !row.assigned).length,
    [scheduledRows],
  );

  const weatherRiskSummary = useMemo(() => {
    if (!selectedProperty) {
      return {
        value: 'No property selected',
        subtitle: 'Select a property to evaluate weather risk.',
        tone: 'warning' as const,
      };
    }
    if (selectedWeatherQuery.isLoading) {
      return {
        value: 'Loading weather',
        subtitle: 'Live weather source is being checked.',
        tone: 'neutral' as const,
      };
    }
    if (selectedWeatherQuery.error || !selectedWeatherQuery.data) {
      return {
        value: 'Weather unavailable',
        subtitle: 'No live weather response yet. Check weather setup.',
        tone: 'warning' as const,
      };
    }
    const current = selectedWeatherQuery.data.current;
    if (current.windSpeed >= 20 || current.weatherCode >= 95) {
      return {
        value: `${Math.round(current.temperature)}F / High Risk`,
        subtitle: `Wind ${Math.round(current.windSpeed)} mph · review field plans`,
        tone: 'critical' as const,
      };
    }
    if (current.windSpeed >= 12) {
      return {
        value: `${Math.round(current.temperature)}F / Caution`,
        subtitle: `Wind ${Math.round(current.windSpeed)} mph · monitor spray windows`,
        tone: 'warning' as const,
      };
    }
    return {
      value: `${Math.round(current.temperature)}F / Stable`,
      subtitle: `Wind ${Math.round(current.windSpeed)} mph · normal operating window`,
      tone: 'good' as const,
    };
  }, [selectedProperty, selectedWeatherQuery.data, selectedWeatherQuery.error, selectedWeatherQuery.isLoading]);

  const coverageSummary = useMemo(() => {
    if (crewScheduledCount === 0) {
      return {
        value: 'No shifts scheduled',
        subtitle: 'Open Scheduler to assign today’s crew.',
        tone: 'critical' as const,
      };
    }
    if (unassignedScheduledCount > 0) {
      return {
        value: `${crewScheduledCount - unassignedScheduledCount}/${crewScheduledCount} covered`,
        subtitle: `${unassignedScheduledCount} scheduled crew still need assignments`,
        tone: 'warning' as const,
      };
    }
    return {
      value: `${crewScheduledCount}/${crewScheduledCount} covered`,
      subtitle: 'All scheduled crew have assignments.',
      tone: 'good' as const,
    };
  }, [crewScheduledCount, unassignedScheduledCount]);

  const blockersSummary = useMemo(() => {
    const alertCount = notes.filter((note) => note.type === 'alert').length;
    const blockers = openIssuesCount + unassignedScheduledCount + alertCount;
    if (blockers === 0) {
      return {
        value: 'No blockers detected',
        subtitle: 'Equipment, workflow, and alerts are clear right now.',
        tone: 'good' as const,
      };
    }
    return {
      value: `${blockers} active blocker${blockers === 1 ? '' : 's'}`,
      subtitle: `${openIssuesCount} equipment issues · ${unassignedScheduledCount} unassigned crew · ${alertCount} alerts`,
      tone: blockers >= 3 ? ('critical' as const) : ('warning' as const),
    };
  }, [notes, openIssuesCount, unassignedScheduledCount]);

  const isLoading = dashboardDataQuery.isLoading;
  const canLoadDashboard = isReady && Boolean(orgId);

  useEffect(() => {
    if (!canLoadDashboard || !isLoading) {
      setQueryTimeoutReached(false);
      return;
    }
    const timeoutId = window.setTimeout(() => setQueryTimeoutReached(true), 8000);
    return () => window.clearTimeout(timeoutId);
  }, [canLoadDashboard, isLoading]);

  if (!isReady) {
    return (
      <div className="h-full overflow-auto bg-background p-6">
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="mt-3 h-4 w-96" />
        </div>
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="h-full overflow-auto bg-background p-6">
        <Card className="rounded-2xl border p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Unable to load workspace</h2>
          <p className="mt-1 text-sm text-muted-foreground">We couldn&apos;t load your organization profile yet.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => window.location.reload()}>
              Retry
            </Button>
            <Button
              onClick={() => {
                if (!supabase) {
                  navigate('/');
                  return;
                }
                void supabase.auth.signOut().finally(() => navigate('/'));
              }}
            >
              Clear session and sign in fresh
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  async function handleGenerateBrief() {
    if (!supabase || !currentUser?.orgId || (!isAdmin && !isManager)) return;
    const summary = [
      `Crew scheduled: ${crewScheduledCount}`,
      `Pending assignments: ${pendingAssignmentsCount}`,
      `Weather summary: ${lastWeatherLogSummary}`,
    ].join('\n');
    const { error } = await supabase.from('notes').insert({
      org_id: currentUser.orgId,
      property_id: selectedProperty?.id ?? null,
      type: 'announcement',
      title: `Morning Brief ${todayKey}`,
      content: summary,
      created_by: currentUser.id,
    });
    if (error) {
      toast.error('Failed to generate brief', { description: error.message });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['notes'] });
    toast.success('Morning brief posted');
  }

  return (
    <div className="h-full overflow-auto bg-background p-6">
      {showGettingStarted ? (
        <Card className="mb-6 rounded-2xl border p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Welcome to Ground Crew HQ — let&apos;s get you set up</h3>
              <p className="mt-1 text-sm text-muted-foreground">Complete these steps to get your team operational</p>
            </div>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              onClick={() => {
                if (!onboardingDismissKey) return;
                localStorage.setItem(onboardingDismissKey, 'true');
                setOnboardingDismissed(true);
              }}
            >
              Dismiss
            </button>
          </div>
          <div className="mt-4">
            <div className="mb-2 text-xs text-muted-foreground">{onboardingCompleted} of {onboardingItems.length} complete</div>
            <div className="h-2 w-full rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-emerald-500 transition-all"
                style={{ width: `${(onboardingCompleted / onboardingItems.length) * 100}%` }}
              />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {onboardingItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                <div className={`flex items-center gap-2 text-sm ${item.complete ? 'text-muted-foreground' : 'text-foreground'}`}>
                  {item.complete ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                  <span>{item.label}</span>
                </div>
                {!item.complete ? (
                  <Button size="sm" variant="outline" onClick={() => navigate(item.to)}>
                    {item.action}
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="mb-4">
        <h2 className="text-2xl font-semibold tracking-tight">Today's Operations Summary</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Are we ready for today? Review readiness, risks, and blockers at a glance.
        </p>
      </div>

      {isLoading && !queryTimeoutReached ? (
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={`ops-skeleton-${index}`} className="rounded-2xl border p-5 shadow-sm">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="mt-3 h-8 w-40" />
              <Skeleton className="mt-2 h-3 w-56" />
            </Card>
          ))}
        </div>
      ) : null}

      {isLoading && queryTimeoutReached ? (
        <Card className="mb-6 rounded-2xl border p-5 shadow-sm">
          <h3 className="text-base font-semibold">Taking longer than expected</h3>
          <p className="mt-1 text-sm text-muted-foreground">Try refreshing.</p>
        </Card>
      ) : null}

      {!isLoading && !queryTimeoutReached ? <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <OpsSignalCard
          title="Today's Crew Readiness"
          value={crewScheduledCount === 0 ? 'No crew scheduled' : `${crewScheduledCount} scheduled`}
          subtitle={
            crewScheduledCount === 0
              ? 'Create today’s shifts in Scheduler to begin planning.'
              : `${activeEmployees.length} active crew available in roster`
          }
          tone={crewScheduledCount === 0 ? 'critical' : 'good'}
        />
        <OpsSignalCard
          title="Active Tasks / Workflow"
          value={`${tasksAssignedCount} assigned`}
          subtitle={
            tasksAssignedCount === 0
              ? 'No assignments created yet for today.'
              : `${pendingAssignmentsCount} still in progress or planned`
          }
          tone={tasksAssignedCount === 0 ? 'warning' : 'neutral'}
        />
        <OpsSignalCard
          title="Weather Risk"
          value={weatherRiskSummary.value}
          subtitle={weatherRiskSummary.subtitle}
          tone={weatherRiskSummary.tone}
        />
        <OpsSignalCard
          title="Equipment Readiness"
          value={equipmentUnits.length === 0 ? 'No equipment data' : `${equipmentActiveCount} ready`}
          subtitle={
            equipmentUnits.length === 0
              ? 'Add equipment units to track operational readiness.'
              : `${openIssuesCount} units flagged as maintenance/out-of-service`
          }
          tone={equipmentUnits.length === 0 ? 'warning' : openIssuesCount > 0 ? 'warning' : 'good'}
        />
        <OpsSignalCard
          title="Schedule Coverage"
          value={coverageSummary.value}
          subtitle={coverageSummary.subtitle}
          tone={coverageSummary.tone}
        />
        <OpsSignalCard
          title="Alerts / Blockers"
          value={blockersSummary.value}
          subtitle={blockersSummary.subtitle}
          tone={blockersSummary.tone}
        />
      </div> : null}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard title="Crew Scheduled Today" value={crewScheduledCount} onClick={() => navigate('/app/scheduler')} />
        <SummaryCard title="Tasks Assigned" value={tasksAssignedCount} onClick={() => navigate('/app/workboard')} />
        <SummaryCard title="Equipment Active" value={equipmentActiveCount} onClick={() => navigate('/app/equipment')} />
        <SummaryCard title="Open Issues" value={openIssuesCount} onClick={() => navigate('/app/equipment')} />
      </div>

      {isAdmin || isManager ? (
        <Card className="mb-6 rounded-2xl border p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">Ops Brief</h3>
              <p className="mt-1 text-sm text-muted-foreground">Generate and post the morning operations brief for the crew.</p>
            </div>
            <Button onClick={() => void handleGenerateBrief()}>Generate Brief</Button>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
            <div className="rounded-xl border bg-muted/20 p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Scheduled Crew</div>
              <div className="mt-1 text-lg font-semibold">{crewScheduledCount}</div>
            </div>
            <div className="rounded-xl border bg-muted/20 p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Pending Assignments</div>
              <div className="mt-1 text-lg font-semibold">{pendingAssignmentsCount}</div>
            </div>
            <div className="rounded-xl border bg-muted/20 p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Last Weather Log</div>
              <div className="mt-1 text-sm font-medium">{lastWeatherLogSummary}</div>
            </div>
          </div>
        </Card>
      ) : null}

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

      {!isLoading && selectedProperty ? (
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
          <div className="text-sm text-muted-foreground">{isLoading ? 'Loading property...' : 'No properties available yet.'}</div>
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
