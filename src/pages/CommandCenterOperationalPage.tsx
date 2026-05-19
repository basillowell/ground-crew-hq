import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/sonner';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Calendar, CheckCircle2, Circle, CloudRain, HelpCircle, MapPin, Plus, Users, Wrench, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatTime } from '@/utils/formatTime';
import { useAuth } from '@/contexts/AuthContext';
import { fetchOpenMeteoWeather, getWeatherConditionMeta } from '@/lib/openMeteo';
import { useWeather } from '@/lib/weather';
import { useDashboardData } from '@/hooks/useDashboardData';
import { OnboardingWizardV2 } from '@/components/OnboardingWizardV2';
import { EmptyState } from '@/components/EmptyState';
import { CardSkeleton } from '@/components/CardSkeleton';
import { LayoutDashboard } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const RechartsResponsiveContainer = lazy(() =>
  import('recharts').then((m) => ({ default: m.ResponsiveContainer })),
);
const RechartsLineChart = lazy(() =>
  import('recharts').then((m) => ({ default: m.LineChart })),
);
const RechartsLine = lazy(() =>
  import('recharts').then((m) => ({ default: m.Line })),
);
const RechartsBarChart = lazy(() =>
  import('recharts').then((m) => ({ default: m.BarChart })),
);
const RechartsBar = lazy(() =>
  import('recharts').then((m) => ({ default: m.Bar })),
);
const RechartsCartesianGrid = lazy(() =>
  import('recharts').then((m) => ({ default: m.CartesianGrid })),
);
const RechartsCell = lazy(() =>
  import('recharts').then((m) => ({ default: m.Cell })),
);
const RechartsLabelList = lazy(() =>
  import('recharts').then((m) => ({ default: m.LabelList })),
);
const RechartsLegend = lazy(() =>
  import('recharts').then((m) => ({ default: m.Legend })),
);
const RechartsTooltip = lazy(() =>
  import('recharts').then((m) => ({ default: m.Tooltip })),
);
const RechartsXAxis = lazy(() =>
  import('recharts').then((m) => ({ default: m.XAxis })),
);
const RechartsYAxis = lazy(() =>
  import('recharts').then((m) => ({ default: m.YAxis })),
);

const DAILY_BRIEF_MODEL = 'claude-sonnet-4-20250514';
const DAILY_BRIEF_STORAGE_PREFIX = 'gchq-daily-brief';

type DailyBriefContext = {
  date: string;
  property: string;
  crew: {
    count: number;
    members: Array<{ name: string; shiftStart: string; shiftEnd: string }>;
  };
  tasks: {
    count: number;
    names: string[];
    coveragePercent: number;
  };
  weather: {
    temperatureF: number | null;
    windMph: number | null;
    rainProbabilityPct: number | null;
    conditions: string;
  };
  equipmentAlerts: {
    overdueCount: number;
    items: string[];
  };
  openNeedsCount: number;
  yesterdayCompletionRatePct: number;
};

type NextStepItem = {
  id: string;
  message: string;
  actionLabel?: string;
  actionPath?: string;
  icon: typeof Calendar;
};

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
      <Card className="rounded-xl border p-5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md">
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
      ? 'border-green-500'
      : tone === 'warning'
        ? 'border-yellow-500'
        : tone === 'critical'
          ? 'border-red-500'
          : 'border-slate-400';
  return (
    <Card className={`rounded-xl border border-l-4 bg-card p-4 shadow-sm transition-all duration-150 hover:bg-muted/30 ${toneClass}`}>
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
    </Card>
  );
}

function ScorecardMetricCard({
  label,
  value,
  trend,
  data,
  toneClass = 'border-gray-300',
}: {
  label: string;
  value: string;
  trend: 'up' | 'down' | 'flat';
  data: number[];
  toneClass?: string;
}) {
  return (
    <Card className={`rounded-xl border p-4 ${toneClass}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <span className="text-xs font-medium">
          {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      <div className="mt-3 h-14">
        <Suspense fallback={<div className="h-full animate-pulse rounded-xl bg-muted/40" />}>
          <RechartsResponsiveContainer width="100%" height="100%">
            <RechartsLineChart data={data.map((point, index) => ({ index, point }))}>
              <RechartsLine type="monotone" dataKey="point" stroke="#16a34a" strokeWidth={2} dot={false} />
            </RechartsLineChart>
          </RechartsResponsiveContainer>
        </Suspense>
      </div>
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
    <Card className="rounded-xl border p-6 shadow-sm">
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
  const [onboardingDismissedLocally, setOnboardingDismissedLocally] = useState(false);
  const [dailyBriefText, setDailyBriefText] = useState<string | null>(null);
  const [dailyBriefLoading, setDailyBriefLoading] = useState(false);
  const [dailyBriefError, setDailyBriefError] = useState<string | null>(null);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(false);
  const [forceOnboarding, setForceOnboarding] = useState(false);

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
    document.title = 'Dashboard — Ground Crew HQ';
  }, []);

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

  useEffect(() => {
    const dismissed = window.localStorage.getItem('ground-crew-welcome-dismissed') === 'true';
    setShowWelcomeBanner(!dismissed);
  }, []);

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
          employeeId: employee.id,
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
  const laborTrendQuery = useQuery({
    queryKey: ['dashboard-labor-trend-7d', orgId ?? 'no-org', propertyScope ?? 'all'],
    enabled: Boolean(orgId),
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      if (!supabase || !orgId) return [] as Array<{ date: string; scheduled: number; actual: number }>;
      const today = new Date();
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      const startDate = start.toISOString().slice(0, 10);
      const endDate = today.toISOString().slice(0, 10);
      let query = supabase
        .from('assignments')
        .select('date, estimated_hours, actual_hours')
        .eq('org_id', orgId)
        .gte('date', startDate)
        .lte('date', endDate);
      if (propertyScope && propertyScope !== 'all') {
        query = query.eq('property_id', propertyScope);
      }
      const { data, error } = await query;
      if (error) throw error;

      const byDate = new Map<string, { scheduled: number; actual: number }>();
      for (let i = 0; i < 7; i += 1) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        const key = date.toISOString().slice(0, 10);
        byDate.set(key, { scheduled: 0, actual: 0 });
      }

      (data ?? []).forEach((row) => {
        const key = String(row.date ?? '');
        const current = byDate.get(key);
        if (!current) return;
        current.scheduled += Number(row.estimated_hours ?? 0);
        current.actual += Number(row.actual_hours ?? 0);
      });

      return Array.from(byDate.entries()).map(([date, sums]) => ({
        date,
        scheduled: Number(sums.scheduled.toFixed(1)),
        actual: Number(sums.actual.toFixed(1)),
      }));
    },
  });
  const sprayWindowQuery = useQuery({
    queryKey: ['dashboard-spray-window', orgId ?? 'no-org', selectedProperty?.id ?? 'none'],
    enabled:
      Boolean(orgId) &&
      Boolean(selectedProperty) &&
      typeof selectedProperty?.latitude === 'number' &&
      typeof selectedProperty?.longitude === 'number',
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      if (!selectedProperty || typeof selectedProperty.latitude !== 'number' || typeof selectedProperty.longitude !== 'number') {
        return [] as Array<{ hour: number; safe: boolean }>;
      }
      const payload = await fetchOpenMeteoWeather({
        latitude: selectedProperty.latitude,
        longitude: selectedProperty.longitude,
        timezone: 'America/New_York',
      });
      const hourlyByHour = new Map<number, (typeof payload.hourly)[number]>();
      for (const point of payload.hourly) {
        const date = new Date(point.time);
        if (date.toISOString().slice(0, 10) !== todayKey) continue;
        hourlyByHour.set(date.getHours(), point);
      }
      return Array.from({ length: 12 }, (_, index) => {
        const hour = index + 6;
        const point = hourlyByHour.get(hour);
        const safe =
          Boolean(point) &&
          point!.windSpeed < 10 &&
          point!.precipitationProbability < 20 &&
          point!.temperature >= 45 &&
          point!.temperature <= 95;
        return { hour, safe };
      });
    },
  });
  const morningNeedsQuery = useQuery({
    queryKey: ['dashboard-morning-open-needs', orgId ?? 'no-org', todayKey, propertyScope ?? 'all'],
    enabled: Boolean(orgId),
    staleTime: 1000 * 60,
    queryFn: async () => {
      if (!supabase || !orgId) return 0;
      let query = supabase
        .from('task_requests')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('date', todayKey)
        .eq('status', 'open');
      if (propertyScope && propertyScope !== 'all') {
        query = query.eq('property_id', propertyScope);
      }
      const { count, error } = await query;
      if (error) throw error;
      return count ?? 0;
    },
  });
  const yesterdayCompletionQuery = useQuery({
    queryKey: ['dashboard-yesterday-completion-rate', orgId ?? 'no-org', propertyScope ?? 'all', todayKey],
    enabled: Boolean(orgId),
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      if (!supabase || !orgId) return 0;
      const yesterday = new Date(`${todayKey}T00:00:00`);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = yesterday.toISOString().slice(0, 10);
      let query = supabase
        .from('assignments')
        .select('status')
        .eq('org_id', orgId)
        .eq('date', yesterdayKey);
      if (propertyScope && propertyScope !== 'all') {
        query = query.eq('property_id', propertyScope);
      }
      const { data, error } = await query;
      if (error) throw error;
      const rows = data ?? [];
      if (rows.length === 0) return 0;
      const doneCount = rows.filter((row) => String(row.status ?? '').toLowerCase() === 'done').length;
      return Math.round((doneCount / rows.length) * 100);
    },
  });
  const efficiencyInputsQuery = useQuery({
    queryKey: ['dashboard-efficiency-inputs', orgId ?? 'no-org', propertyScope ?? 'all', todayKey],
    enabled: Boolean(orgId),
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      if (!supabase || !orgId) {
        return {
          assignments8d: [] as Array<{ date: string; status: string | null; estimated_hours: number | null; actual_hours: number | null }>,
          scheduleToday: [] as Array<{ shift_start: string | null; shift_end: string | null }>,
          scheduleYesterday: [] as Array<{ shift_start: string | null; shift_end: string | null }>,
          openNeedsToday: 0,
          openNeedsYesterday: 0,
        };
      }

      const todayDate = new Date(`${todayKey}T00:00:00`);
      const start8Date = new Date(todayDate);
      start8Date.setDate(start8Date.getDate() - 7);
      const start8Key = start8Date.toISOString().slice(0, 10);
      const yesterdayDate = new Date(todayDate);
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterdayKey = yesterdayDate.toISOString().slice(0, 10);

      let assignmentsQuery = supabase
        .from('assignments')
        .select('date, status, estimated_hours, actual_hours')
        .eq('org_id', orgId)
        .gte('date', start8Key)
        .lte('date', todayKey);
      let scheduleTodayQuery = supabase
        .from('schedule_entries')
        .select('shift_start, shift_end')
        .eq('org_id', orgId)
        .eq('date', todayKey)
        .eq('status', 'scheduled');
      let scheduleYesterdayQuery = supabase
        .from('schedule_entries')
        .select('shift_start, shift_end')
        .eq('org_id', orgId)
        .eq('date', yesterdayKey)
        .eq('status', 'scheduled');
      let openNeedsTodayQuery = supabase
        .from('task_requests')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('date', todayKey)
        .eq('status', 'open');
      let openNeedsYesterdayQuery = supabase
        .from('task_requests')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('date', yesterdayKey)
        .eq('status', 'open');

      if (propertyScope && propertyScope !== 'all') {
        assignmentsQuery = assignmentsQuery.eq('property_id', propertyScope);
        scheduleTodayQuery = scheduleTodayQuery.eq('property_id', propertyScope);
        scheduleYesterdayQuery = scheduleYesterdayQuery.eq('property_id', propertyScope);
        openNeedsTodayQuery = openNeedsTodayQuery.eq('property_id', propertyScope);
        openNeedsYesterdayQuery = openNeedsYesterdayQuery.eq('property_id', propertyScope);
      }

      const [
        assignmentsResult,
        scheduleTodayResult,
        scheduleYesterdayResult,
        openNeedsTodayResult,
        openNeedsYesterdayResult,
      ] = await Promise.all([
        assignmentsQuery,
        scheduleTodayQuery,
        scheduleYesterdayQuery,
        openNeedsTodayQuery,
        openNeedsYesterdayQuery,
      ]);

      if (assignmentsResult.error) throw assignmentsResult.error;
      if (scheduleTodayResult.error) throw scheduleTodayResult.error;
      if (scheduleYesterdayResult.error) throw scheduleYesterdayResult.error;
      if (openNeedsTodayResult.error) throw openNeedsTodayResult.error;
      if (openNeedsYesterdayResult.error) throw openNeedsYesterdayResult.error;

      return {
        assignments8d: (assignmentsResult.data ?? []) as Array<{ date: string; status: string | null; estimated_hours: number | null; actual_hours: number | null }>,
        scheduleToday: (scheduleTodayResult.data ?? []) as Array<{ shift_start: string | null; shift_end: string | null }>,
        scheduleYesterday: (scheduleYesterdayResult.data ?? []) as Array<{ shift_start: string | null; shift_end: string | null }>,
        openNeedsToday: openNeedsTodayResult.count ?? 0,
        openNeedsYesterday: openNeedsYesterdayResult.count ?? 0,
      };
    },
  });

  const operationsScorecardQuery = useQuery({
    queryKey: ['dashboard-operations-scorecard', orgId ?? 'no-org', propertyScope ?? 'all', todayKey],
    enabled: Boolean(orgId),
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      if (!supabase || !orgId) {
        return null;
      }
      const startDate = new Date(`${todayKey}T00:00:00`);
      startDate.setDate(startDate.getDate() - 13);
      const startKey = startDate.toISOString().slice(0, 10);
      let assignmentsQuery = supabase
        .from('assignments')
        .select('date, status, estimated_hours, actual_hours')
        .eq('org_id', orgId)
        .gte('date', startKey)
        .lte('date', todayKey);
      let scheduleQuery = supabase
        .from('schedule_entries')
        .select('date, employee_id, shift_start, shift_end, status')
        .eq('org_id', orgId)
        .gte('date', startKey)
        .lte('date', todayKey);
      if (propertyScope && propertyScope !== 'all') {
        assignmentsQuery = assignmentsQuery.eq('property_id', propertyScope);
        scheduleQuery = scheduleQuery.eq('property_id', propertyScope);
      }
      const [assignmentsResult, scheduleResult] = await Promise.all([assignmentsQuery, scheduleQuery]);
      if (assignmentsResult.error) throw assignmentsResult.error;
      if (scheduleResult.error) throw scheduleResult.error;
      return {
        assignments: assignmentsResult.data ?? [],
        schedule: scheduleResult.data ?? [],
      };
    },
  });

  const morningBriefWeatherQuery = useQuery({
    queryKey: ['dashboard-morning-brief-weather', orgId ?? 'no-org', selectedProperty?.id ?? 'none', todayKey],
    enabled:
      Boolean(orgId) &&
      Boolean(selectedProperty) &&
      typeof selectedProperty?.latitude === 'number' &&
      typeof selectedProperty?.longitude === 'number',
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      if (!selectedProperty || typeof selectedProperty.latitude !== 'number' || typeof selectedProperty.longitude !== 'number') {
        return null;
      }
      const payload = await fetchOpenMeteoWeather({
        latitude: selectedProperty.latitude,
        longitude: selectedProperty.longitude,
        timezone: 'America/New_York',
      });
      const weatherLabel = getWeatherConditionMeta(payload.current.weatherCode).label;
      const now = new Date();
      const nowHour = now.getHours();
      const todayHours = payload.hourly
        .map((point) => ({ ...point, date: new Date(point.time) }))
        .filter((point) => point.date.toISOString().slice(0, 10) === todayKey && point.date.getHours() >= nowHour);
      const firstShift = todayHours.find(
        (point) => point.weatherCode > 2 || point.precipitationProbability >= 25,
      );
      const clearUntilHour = firstShift ? firstShift.date.getHours() : 18;
      return {
        temperature: Math.round(payload.current.temperature),
        windSpeed: Math.round(payload.current.windSpeed),
        weatherLabel,
        clearUntilHour,
      };
    },
  });
  const equipmentAlertsQuery = useQuery({
    queryKey: ['dashboard-equipment-alerts', orgId ?? 'no-org', propertyScope ?? 'all'],
    enabled: Boolean(orgId),
    staleTime: 1000 * 60,
    queryFn: async () => {
      if (!supabase || !orgId) {
        return [] as Array<{ id: string; name: string | null; unit_name: string | null; type: string | null; last_serviced: string | null }>;
      }
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - 90);
      const thresholdKey = thresholdDate.toISOString().slice(0, 10);

      let query = supabase
        .from('equipment_units')
        .select('id, name, unit_name, type, last_serviced')
        .eq('org_id', orgId)
        .eq('active', true)
        .lt('last_serviced', thresholdKey)
        .order('last_serviced', { ascending: true });
      if (propertyScope && propertyScope !== 'all') {
        query = query.eq('property_id', propertyScope);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string | null; unit_name: string | null; type: string | null; last_serviced: string | null }>;
    },
  });
  const weeklyLaborCostQuery = useQuery({
    queryKey: ['dashboard-weekly-labor-cost', orgId ?? 'no-org', todayKey, propertyScope ?? 'all'],
    enabled: Boolean(orgId),
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      if (!supabase || !orgId) {
        return { totalCost: 0, daily: [] as Array<{ date: string; label: string; cost: number }>, hasHourlyRates: false };
      }
      const now = new Date();
      const weekStart = new Date(now);
      const weekDay = weekStart.getDay();
      const shift = weekDay === 0 ? -6 : 1 - weekDay;
      weekStart.setDate(weekStart.getDate() + shift);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const startDate = weekStart.toISOString().slice(0, 10);
      const endDate = weekEnd.toISOString().slice(0, 10);

      let assignmentsQuery = supabase
        .from('assignments')
        .select('date, employee_id, actual_hours')
        .eq('org_id', orgId)
        .gte('date', startDate)
        .lte('date', endDate);
      if (propertyScope && propertyScope !== 'all') {
        assignmentsQuery = assignmentsQuery.eq('property_id', propertyScope);
      }

      const [assignmentsResult, employeesResult] = await Promise.all([
        assignmentsQuery,
        supabase
          .from('employees')
          .select('id, hourly_rate')
          .eq('org_id', orgId),
      ]);

      if (assignmentsResult.error) throw assignmentsResult.error;
      if (employeesResult.error) throw employeesResult.error;

      const hourlyRateByEmployee = new Map<string, number>();
      (employeesResult.data ?? []).forEach((employee) => {
        hourlyRateByEmployee.set(String(employee.id), Number(employee.hourly_rate ?? 0));
      });
      const hasHourlyRates = Array.from(hourlyRateByEmployee.values()).some((rate) => rate > 0);

      const dailyMap = new Map<string, number>();
      for (let i = 0; i < 7; i += 1) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        dailyMap.set(date.toISOString().slice(0, 10), 0);
      }

      (assignmentsResult.data ?? []).forEach((assignment) => {
        const employeeId = String(assignment.employee_id ?? '');
        const rate = hourlyRateByEmployee.get(employeeId) ?? 0;
        const actualHours = Number(assignment.actual_hours ?? 0);
        const dayKey = String(assignment.date ?? '');
        if (!dailyMap.has(dayKey)) return;
        const nextCost = (dailyMap.get(dayKey) ?? 0) + actualHours * rate;
        dailyMap.set(dayKey, nextCost);
      });

      const daily = Array.from(dailyMap.entries()).map(([date, cost]) => ({
        date,
        label: new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' }),
        cost: Number(cost.toFixed(2)),
      }));
      const totalCost = Number(daily.reduce((sum, row) => sum + row.cost, 0).toFixed(2));

      return { totalCost, daily, hasHourlyRates };
    },
  });

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
      { id: 'tasks', label: 'Build your task library', complete: tasks.length > 0, action: 'Add tasks →', to: '/app/settings?tab=Tasks' },
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
  const sprayWindowSummary = useMemo(() => {
    const hours = sprayWindowQuery.data ?? [];
    if (hours.length === 0) return 'No safe spray windows today';

    const ranges: Array<{ start: number; end: number }> = [];
    let start: number | null = null;
    for (let index = 0; index < hours.length; index += 1) {
      const block = hours[index];
      if (block.safe && start === null) start = block.hour;
      if ((!block.safe || index === hours.length - 1) && start !== null) {
        const endHour = block.safe && index === hours.length - 1 ? block.hour + 1 : block.hour;
        ranges.push({ start, end: endHour });
        start = null;
      }
    }

    if (ranges.length === 0) return 'No safe spray windows today';

    const formatHourRange = (value: number) => {
      const padded = value.toString().padStart(2, '0');
      return formatTime(`${padded}:00`);
    };

    return `Safe to spray: ${ranges.map((range) => `${formatHourRange(range.start)} - ${formatHourRange(range.end)}`).join(', ')}`;
  }, [sprayWindowQuery.data]);
  const weeklyLaborBudget = useMemo(() => {
    const candidate = (dashboardDataQuery.data?.programSettings as Record<string, unknown> | null)?.weekly_labor_budget;
    const numeric = Number(candidate ?? 0);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  }, [dashboardDataQuery.data?.programSettings]);
  const weeklyLaborCostSummary = useMemo(() => {
    const total = weeklyLaborCostQuery.data?.totalCost ?? 0;
    if (weeklyLaborBudget && weeklyLaborBudget > 0) {
      return `This Week: $${total.toLocaleString()} spent · Budget: $${weeklyLaborBudget.toLocaleString()}`;
    }
    return `This Week: $${total.toLocaleString()} in labor costs`;
  }, [weeklyLaborBudget, weeklyLaborCostQuery.data?.totalCost]);
  const sprayCurrentMarkerPercent = useMemo(() => {
    const now = new Date();
    const nowValue = now.getHours() + now.getMinutes() / 60;
    if (nowValue < 6 || nowValue > 18) return null;
    return ((nowValue - 6) / 12) * 100;
  }, [currentDate]);

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
    const temperature = Math.round(current.temperature);
    const windSpeed = Math.round(current.windSpeed);
    const rainChance = Math.round(Number((current as { precipitationProbability?: number }).precipitationProbability ?? 0));
    if (temperature > 100 || windSpeed > 15 || rainChance > 60) {
      return {
        value: `${temperature}F / High Risk`,
        subtitle: `Wind ${Math.round(current.windSpeed)} mph · review field plans`,
        tone: 'critical' as const,
      };
    }
    if ((temperature >= 90 && temperature <= 100) || (windSpeed >= 10 && windSpeed <= 15)) {
      return {
        value: `${temperature}F / Caution`,
        subtitle: `Wind ${Math.round(current.windSpeed)} mph · monitor spray windows`,
        tone: 'warning' as const,
      };
    }
    return {
      value: `${temperature}F / Stable`,
      subtitle: `Wind ${Math.round(current.windSpeed)} mph · normal operating window`,
      tone: 'good' as const,
    };
  }, [selectedProperty, selectedWeatherQuery.data, selectedWeatherQuery.error, selectedWeatherQuery.isLoading]);

  const scheduleCoveragePercent = useMemo(() => {
    if (crewScheduledCount === 0) return 0;
    const covered = crewScheduledCount - unassignedScheduledCount;
    return Math.round((covered / crewScheduledCount) * 100);
  }, [crewScheduledCount, unassignedScheduledCount]);

  const coverageSummary = useMemo(() => {
    if (crewScheduledCount === 0) {
      return {
        value: '0% covered',
        subtitle: 'Open Scheduler to assign today’s crew.',
        tone: 'critical' as const,
      };
    }
    if (scheduleCoveragePercent < 50) {
      return {
        value: `${scheduleCoveragePercent}% covered`,
        subtitle: `${unassignedScheduledCount} scheduled crew still need assignments`,
        tone: 'critical' as const,
      };
    }
    if (scheduleCoveragePercent < 80) {
      return {
        value: `${scheduleCoveragePercent}% covered`,
        subtitle: `${unassignedScheduledCount} scheduled crew still need assignments`,
        tone: 'warning' as const,
      };
    }

    return {
      value: `${scheduleCoveragePercent}% covered`,
      subtitle: 'All scheduled crew have assignments.',
      tone: 'good' as const,
    };
  }, [crewScheduledCount, scheduleCoveragePercent, unassignedScheduledCount]);

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
      tone: 'critical' as const,
    };
  }, [notes, openIssuesCount, unassignedScheduledCount]);
  const laborTrendData = useMemo(
    () =>
      (laborTrendQuery.data ?? []).map((row) => ({
        ...row,
        label: new Date(`${row.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' }),
      })),
    [laborTrendQuery.data],
  );

  const isLoading = dashboardDataQuery.isLoading;
  const canLoadDashboard = isReady && Boolean(orgId);

  const onboardingCheckQuery = useQuery({
    queryKey: ['dashboard-onboarding-check', orgId ?? 'no-org', currentUser?.employeeId ?? 'no-employee'],
    enabled: Boolean(orgId),
    staleTime: 1000 * 60,
    queryFn: async () => {
      if (!supabase || !orgId) {
        return { propertyCount: 0, employeeCount: 0, taskCount: 0 };
      }
      const [propertiesResult, employeesResult, tasksResult] = await Promise.all([
        supabase.from('properties').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
        supabase.from('employees').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      ]);

      if (propertiesResult.error) throw propertiesResult.error;
      if (employeesResult.error) throw employeesResult.error;
      if (tasksResult.error) throw tasksResult.error;

      const totalEmployees = employeesResult.count ?? 0;
      const employeeCountExcludingSelf = Math.max(
        0,
        totalEmployees - (currentUser?.employeeId ? 1 : 0),
      );
      return {
        propertyCount: propertiesResult.count ?? 0,
        employeeCount: employeeCountExcludingSelf,
        taskCount: tasksResult.count ?? 0,
      };
    },
  });

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);
  const firstName = useMemo(() => {
    const raw = currentUser?.fullName?.trim() || currentUser?.email?.split('@')[0] || 'there';
    return raw.split(' ')[0];
  }, [currentUser?.email, currentUser?.fullName]);
  const morningDateLabel = useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }),
    [],
  );
  const isAllPropertiesView = currentPropertyId === 'all';
  const morningPropertyLabel = isAllPropertiesView
    ? `All Properties (${properties.length})`
    : selectedProperty?.name ?? 'No property selected';
  const openNeedsCount = morningNeedsQuery.data ?? 0;
  const openNeedsPreviewQuery = useQuery({
    queryKey: ['dashboard-open-needs-preview', orgId ?? 'no-org', propertyScope ?? 'all', todayKey],
    enabled: Boolean(orgId),
    staleTime: 1000 * 30,
    queryFn: async () => {
      if (!supabase || !orgId) return [] as Array<{ id: string; title: string }>;
      let query = supabase
        .from('task_requests')
        .select('id,title')
        .eq('org_id', orgId)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(2);
      if (propertyScope && propertyScope !== 'all') {
        query = query.eq('property_id', propertyScope);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: String(row.id),
        title: String(row.title ?? 'Untitled need'),
      }));
    },
  });
  const complianceStatusQuery = useQuery({
    queryKey: ['dashboard-compliance-status', orgId ?? 'no-org'],
    enabled: Boolean(orgId),
    staleTime: 1000 * 60,
    retry: false,
    queryFn: async () => {
      try {
        if (!supabase || !orgId) {
          return { pending: 0, incomplete: 0 };
        }
        const nowIso = new Date().toISOString();
        const [activeReiResult, missingSupervisorResult] = await Promise.all([
          supabase
            .from('chemical_application_logs')
            .select('id', { count: 'exact', head: true })
            .eq('org_id', orgId)
            .gt('restrictedEntryUntil', nowIso),
          supabase
            .from('chemical_application_logs')
            .select('id', { count: 'exact', head: true })
            .eq('org_id', orgId)
            .or('supervisorLicenseNumber.is.null,supervisorLicenseNumber.eq.'),
        ]);
        if (activeReiResult.error) return { pending: 0, incomplete: 0 };
        if (missingSupervisorResult.error) return { pending: 0, incomplete: 0 };
        return {
          pending: activeReiResult.count ?? 0,
          incomplete: missingSupervisorResult.count ?? 0,
        };
      } catch {
        return { pending: 0, incomplete: 0 };
      }
    },
  });
  const overdueEquipmentCount = equipmentAlertsQuery.data?.length ?? 0;
  const complianceSummary = useMemo(() => {
    const activeReiCount = complianceStatusQuery.data?.pending ?? 0;
    const missingSupervisorLicenseCount = complianceStatusQuery.data?.incomplete ?? 0;
    const issueCount = activeReiCount + missingSupervisorLicenseCount;
    if (complianceStatusQuery.isLoading) {
      return {
        value: 'Checking...',
        subtitle: 'Verifying chemical records',
        tone: 'neutral' as const,
      };
    }
    if (complianceStatusQuery.error) {
      return {
        value: 'Unavailable',
        subtitle: 'Compliance data could not be loaded',
        tone: 'warning' as const,
      };
    }
    if (issueCount === 0) {
      return {
        value: 'All Clear',
        subtitle: 'No active REI or incomplete records',
        tone: 'good' as const,
      };
    }
    return {
      value: `${issueCount} issue${issueCount === 1 ? '' : 's'}`,
      subtitle: `${activeReiCount} active REI · ${missingSupervisorLicenseCount} missing license`,
      tone: issueCount > 2 ? ('critical' as const) : ('warning' as const),
    };
  }, [complianceStatusQuery.data, complianceStatusQuery.error, complianceStatusQuery.isLoading]);
  const [dismissedNextStepIds, setDismissedNextStepIds] = useState<string[]>([]);

  useEffect(() => {
    const storageKey = `gchq-next-steps-dismissed-${todayKey}`;
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (!raw) {
        setDismissedNextStepIds([]);
        return;
      }
      const parsed = JSON.parse(raw);
      setDismissedNextStepIds(Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []);
    } catch {
      setDismissedNextStepIds([]);
    }
  }, [todayKey]);

  const dismissNextStep = useCallback(
    (id: string) => {
      const storageKey = `gchq-next-steps-dismissed-${todayKey}`;
      setDismissedNextStepIds((previous) => {
        if (previous.includes(id)) return previous;
        const next = [...previous, id];
        try {
          window.sessionStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // no-op if storage is unavailable
        }
        return next;
      });
    },
    [todayKey],
  );

  const nextSteps = useMemo<NextStepItem[]>(() => {
    const steps: NextStepItem[] = [];
    const weather = morningBriefWeatherQuery.data;
    const temperature = weather?.temperature ?? null;
    const wind = weather?.windSpeed ?? null;
    const rainProbability = weather?.rainProbability ?? null;

    if (crewScheduledCount === 0) {
      steps.push({
        id: 'rule-1-no-crew',
        icon: Calendar,
        message: 'Schedule your crew for today.',
        actionLabel: 'Open Scheduler',
        actionPath: '/app/scheduler',
      });
    }

    if (crewScheduledCount > 0 && tasksAssignedCount === 0) {
      steps.push({
        id: 'rule-2-no-tasks',
        icon: ArrowRight,
        message: 'Your crew is scheduled but has no tasks. Use Quick Plan or assign tasks.',
        actionLabel: 'Open Workflow',
        actionPath: '/app/workboard',
      });
    }

    const overdueEquipment = (equipmentAlertsQuery.data ?? [])
      .map((unit) => {
        const servicedDate = unit.last_serviced ? new Date(unit.last_serviced) : null;
        if (!servicedDate) return null;
        const daysSinceService = Math.floor((Date.now() - servicedDate.getTime()) / (1000 * 60 * 60 * 24));
        const overdueDays = Math.max(0, daysSinceService - 90);
        return {
          id: unit.id,
          name: unit.unit_name || unit.name || 'Equipment unit',
          overdueDays,
        };
      })
      .filter((unit): unit is { id: string; name: string; overdueDays: number } => Boolean(unit && unit.overdueDays > 0))
      .sort((a, b) => b.overdueDays - a.overdueDays);

    if (overdueEquipment.length > 0) {
      const topUnit = overdueEquipment[0];
      steps.push({
        id: `rule-3-overdue-${topUnit.id}`,
        icon: Wrench,
        message: `${topUnit.name} is overdue for service by ${topUnit.overdueDays} day${topUnit.overdueDays === 1 ? '' : 's'}.`,
        actionLabel: 'Open Equipment',
        actionPath: '/app/equipment',
      });
    }

    if (wind !== null && rainProbability !== null && (wind > 10 || rainProbability > 40)) {
      steps.push({
        id: 'rule-4-spray-unsafe',
        icon: CloudRain,
        message: `Spray conditions are unsafe. Wind ${Math.round(wind)} mph, Rain ${Math.round(rainProbability)}%. Postpone applications.`,
        actionLabel: 'Open Weather',
        actionPath: '/app/weather',
      });
    }

    if (temperature !== null && temperature > 95) {
      steps.push({
        id: 'rule-5-heat',
        icon: Circle,
        message: `Heat advisory: ${Math.round(temperature)}F. Schedule water breaks for outdoor crew.`,
        actionLabel: 'Open Workflow',
        actionPath: '/app/workboard',
      });
    }

    const firstUnassignedCrew = scheduledRows.find((row) => !row.assigned);
    if (firstUnassignedCrew) {
      steps.push({
        id: `rule-6-unassigned-${firstUnassignedCrew.id}`,
        icon: Users,
        message: `${firstUnassignedCrew.name} is scheduled but has no tasks assigned.`,
        actionLabel: 'Assign Work',
        actionPath: '/app/workboard',
      });
    }

    const yesterdayCompletionRate = yesterdayCompletionQuery.data ?? 0;
    if (yesterdayCompletionRate < 70) {
      steps.push({
        id: 'rule-7-yesterday-completion',
        icon: CheckCircle2,
        message: `Yesterday's completion was ${yesterdayCompletionRate}%. Review workboard for carryover tasks.`,
        actionLabel: 'Open Workflow',
        actionPath: '/app/workboard',
      });
    }

    if (steps.length === 0) {
      steps.push({
        id: 'rule-8-all-clear',
        icon: CheckCircle2,
        message: 'Operations look good. All crew assigned, weather clear, equipment ready. ✅',
      });
    }

    return steps;
  }, [
    crewScheduledCount,
    equipmentAlertsQuery.data,
    morningBriefWeatherQuery.data,
    scheduledRows,
    tasksAssignedCount,
    yesterdayCompletionQuery.data,
  ]);

  const visibleNextSteps = useMemo(
    () => nextSteps.filter((step) => !dismissedNextStepIds.includes(step.id)).slice(0, 3),
    [dismissedNextStepIds, nextSteps],
  );

  const efficiencyScoreSummary = useMemo(() => {
    const parseShiftMinutes = (start: string | null, end: string | null) => {
      if (!start || !end) return 0;
      const [startHour = '0', startMinute = '0'] = start.split(':');
      const [endHour = '0', endMinute = '0'] = end.split(':');
      const startMinutes = Number(startHour) * 60 + Number(startMinute);
      const endMinutes = Number(endHour) * 60 + Number(endMinute);
      const diff = endMinutes - startMinutes;
      return diff > 0 ? diff : 0;
    };
    const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
    const normalizeStatus = (status: string | null) => String(status ?? '').toLowerCase();
    const inputs = efficiencyInputsQuery.data;

    if (!inputs) {
      return {
        score: 0,
        label: 'Critical',
        toneClasses: 'border-red-500 bg-red-50/50 text-red-700',
        trend: 'flat' as const,
      };
    }

    const today = new Date(`${todayKey}T00:00:00`);
    const yesterdayDate = new Date(today);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayKey = yesterdayDate.toISOString().slice(0, 10);
    const startCurrentWindow = new Date(today);
    startCurrentWindow.setDate(startCurrentWindow.getDate() - 6);
    const startCurrentWindowKey = startCurrentWindow.toISOString().slice(0, 10);
    const startYesterdayWindow = new Date(yesterdayDate);
    startYesterdayWindow.setDate(startYesterdayWindow.getDate() - 6);
    const startYesterdayWindowKey = startYesterdayWindow.toISOString().slice(0, 10);

    const calculateScore = ({
      windowStart,
      windowEnd,
      scheduleRows,
      openNeeds,
    }: {
      windowStart: string;
      windowEnd: string;
      scheduleRows: Array<{ shift_start: string | null; shift_end: string | null }>;
      openNeeds: number;
    }) => {
      const inWindowAssignments = inputs.assignments8d.filter(
        (row) => row.date >= windowStart && row.date <= windowEnd,
      );
      const totalTasks = inWindowAssignments.length;
      const doneTasks = inWindowAssignments.filter((row) => normalizeStatus(row.status) === 'done').length;
      const completionScore = totalTasks > 0 ? (doneTasks / totalTasks) * 30 : 0;

      const shiftHours = scheduleRows.reduce(
        (sum, row) => sum + parseShiftMinutes(row.shift_start, row.shift_end) / 60,
        0,
      );
      const dayAssignments = inputs.assignments8d.filter((row) => row.date === windowEnd);
      const assignedHours = dayAssignments.reduce((sum, row) => sum + Number(row.estimated_hours ?? 0), 0);
      const coverageScore = shiftHours > 0 ? Math.min(25, (assignedHours / shiftHours) * 25) : 0;

      const scheduledHours = inWindowAssignments.reduce((sum, row) => sum + Number(row.estimated_hours ?? 0), 0);
      const actualHours = inWindowAssignments.reduce((sum, row) => sum + Number(row.actual_hours ?? 0), 0);
      const variancePenalty = scheduledHours > 0 ? (Math.abs(actualHours - scheduledHours) / scheduledHours) * 20 : 20;
      const laborVarianceScore = clamp(20 - variancePenalty, 0, 20);

      let equipmentHealthScore = 0;
      if (overdueEquipmentCount === 0) equipmentHealthScore = 15;
      else if (overdueEquipmentCount <= 2) equipmentHealthScore = 10;
      else if (overdueEquipmentCount <= 4) equipmentHealthScore = 5;

      let openNeedsScore = 0;
      if (openNeeds === 0) openNeedsScore = 10;
      else if (openNeeds <= 3) openNeedsScore = 5;

      return clamp(
        Math.round(completionScore + coverageScore + laborVarianceScore + equipmentHealthScore + openNeedsScore),
        0,
        100,
      );
    };

    const todayScore = calculateScore({
      windowStart: startCurrentWindowKey,
      windowEnd: todayKey,
      scheduleRows: inputs.scheduleToday,
      openNeeds: inputs.openNeedsToday,
    });
    const yesterdayScore = calculateScore({
      windowStart: startYesterdayWindowKey,
      windowEnd: yesterdayKey,
      scheduleRows: inputs.scheduleYesterday,
      openNeeds: inputs.openNeedsYesterday,
    });

    let label = 'Critical';
    let toneClasses = 'border-red-500 text-red-700';
    if (todayScore >= 90) {
      label = 'Excellent';
      toneClasses = 'border-green-500 text-green-700';
    } else if (todayScore >= 70) {
      label = 'Good';
      toneClasses = 'border-blue-500 text-blue-700';
    } else if (todayScore >= 50) {
      label = 'Needs Attention';
      toneClasses = 'border-yellow-500 text-amber-700';
    }

    return {
      score: todayScore,
      label,
      toneClasses,
      trend: todayScore > yesterdayScore ? 'up' : todayScore < yesterdayScore ? 'down' : 'flat',
    };
  }, [efficiencyInputsQuery.data, overdueEquipmentCount, todayKey]);

  const operationsScorecard = useMemo(() => {
    const payload = operationsScorecardQuery.data;
    if (!payload) return null;
    const parseShiftHours = (start: string | null, end: string | null) => {
      if (!start || !end) return 0;
      const [sh = '0', sm = '0'] = start.split(':');
      const [eh = '0', em = '0'] = end.split(':');
      const startMins = Number(sh) * 60 + Number(sm);
      const endMins = Number(eh) * 60 + Number(em);
      return Math.max(0, (endMins - startMins) / 60);
    };
    const normalizeStatus = (status: string | null) => String(status ?? '').toLowerCase();
    const today = new Date(`${todayKey}T00:00:00`);
    const allDays = Array.from({ length: 14 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (13 - index));
      return date.toISOString().slice(0, 10);
    });
    const last7 = allDays.slice(7);
    const previous7 = allDays.slice(0, 7);
    const assignments = payload.assignments as Array<{ date: string; status: string | null; estimated_hours: number | null; actual_hours: number | null }>;
    const schedule = payload.schedule as Array<{ date: string; employee_id: string | null; shift_start: string | null; shift_end: string | null; status: string | null }>;

    const computeCompletion = (days: string[]) => {
      const inRange = assignments.filter((row) => days.includes(String(row.date ?? '')));
      if (inRange.length === 0) return 0;
      const done = inRange.filter((row) => normalizeStatus(row.status) === 'done').length;
      return Math.round((done / inRange.length) * 100);
    };
    const computeLaborEfficiency = (days: string[]) => {
      const inRange = assignments.filter((row) => days.includes(String(row.date ?? '')));
      const scheduledHours = inRange.reduce((sum, row) => sum + Number(row.estimated_hours ?? 0), 0);
      const actualHours = inRange.reduce((sum, row) => sum + Number(row.actual_hours ?? 0), 0);
      if (scheduledHours <= 0) return 0;
      return Math.round((actualHours / scheduledHours) * 100);
    };
    const computeCoverage = (days: string[]) => {
      const ratios = days.map((day) => {
        const daySchedule = schedule.filter((row) => row.date === day && normalizeStatus(row.status) === 'scheduled');
        const shiftHours = daySchedule.reduce((sum, row) => sum + parseShiftHours(row.shift_start, row.shift_end), 0);
        const assigned = assignments.filter((row) => row.date === day).reduce((sum, row) => sum + Number(row.estimated_hours ?? 0), 0);
        if (shiftHours <= 0) return 0;
        return Math.min(100, Math.round((assigned / shiftHours) * 100));
      });
      if (ratios.length === 0) return 0;
      return Math.round(ratios.reduce((sum, value) => sum + value, 0) / ratios.length);
    };
    const completionDaily = last7.map((day) => computeCompletion([day]));
    const laborDaily = last7.map((day) => computeLaborEfficiency([day]));
    const coverageDaily = last7.map((day) => computeCoverage([day]));
    const equipmentTotal = equipmentUnits.length;
    const equipmentAvailable = equipmentUnits.filter((unit) => unit.status === 'available').length;
    const equipmentUptime = equipmentTotal > 0 ? Math.round((equipmentAvailable / equipmentTotal) * 100) : 0;
    const scheduledPairs = new Set(
      schedule
        .filter((row) => last7.includes(String(row.date ?? '')) && normalizeStatus(row.status) === 'scheduled')
        .map((row) => `${row.employee_id}:${row.date}`),
    );
    const possiblePairs = Math.max(1, employees.length * 7);
    const crewUtilization = Math.round((scheduledPairs.size / possiblePairs) * 100);
    const completionCurrent = computeCompletion(last7);
    const completionPrevious = computeCompletion(previous7);
    const laborCurrent = computeLaborEfficiency(last7);
    const laborPrevious = computeLaborEfficiency(previous7);
    const coverageCurrent = computeCoverage(last7);
    const coveragePrevious = computeCoverage(previous7);
    return {
      completionCurrent,
      completionTrend: completionCurrent > completionPrevious ? 'up' : completionCurrent < completionPrevious ? 'down' : 'flat',
      completionDaily,
      laborCurrent,
      laborTrend: laborCurrent > laborPrevious ? 'up' : laborCurrent < laborPrevious ? 'down' : 'flat',
      laborDaily,
      coverageCurrent,
      coverageTrend: coverageCurrent > coveragePrevious ? 'up' : coverageCurrent < coveragePrevious ? 'down' : 'flat',
      coverageDaily,
      equipmentUptime,
      equipmentTrend: 'flat' as const,
      equipmentDaily: Array.from({ length: 7 }, () => equipmentUptime),
      crewUtilization,
      crewTrend: 'flat' as const,
      crewDaily: Array.from({ length: 7 }, () => crewUtilization),
    };
  }, [employees.length, equipmentUnits, operationsScorecardQuery.data, todayKey]);
  const propertyBreakdownRows = useMemo(() => {
    if (!isAllPropertiesView) return [];
    return properties.map((property) => {
      const crewCount = scheduleEntries.filter(
        (entry) => entry.date === todayKey && entry.status === 'scheduled' && entry.propertyId === property.id,
      ).length;
      const taskCount = assignments.filter(
        (assignment) => assignment.date === todayKey && assignment.propertyId === property.id,
      ).length;
      const assignedCrewIds = new Set(
        assignments
          .filter((assignment) => assignment.date === todayKey && assignment.propertyId === property.id)
          .map((assignment) => assignment.employeeId),
      );
      const coveragePct = crewCount > 0 ? Math.round((assignedCrewIds.size / crewCount) * 100) : 0;
      return {
        propertyId: property.id,
        propertyName: property.name,
        crewCount,
        taskCount,
        coveragePct,
      };
    });
  }, [assignments, isAllPropertiesView, properties, scheduleEntries, todayKey]);
  const taskStatusSummary = useMemo(() => {
    const todayAssignments = assignments.filter((assignment) => assignment.date === todayKey);
    let planned = 0;
    let inProgress = 0;
    let done = 0;
    todayAssignments.forEach((assignment) => {
      const status = String(assignment.status ?? '').toLowerCase();
      if (status === 'done' || status === 'complete' || status === 'completed') {
        done += 1;
      } else if (status === 'in_progress' || status === 'in-progress') {
        inProgress += 1;
      } else {
        planned += 1;
      }
    });
    return {
      total: todayAssignments.length,
      planned,
      inProgress,
      done,
    };
  }, [assignments, todayKey]);
  const morningWeatherLine = useMemo(() => {
    if (morningBriefWeatherQuery.isLoading) return 'Loading weather...';
    if (morningBriefWeatherQuery.error || !morningBriefWeatherQuery.data) return 'Weather unavailable';
    const details = morningBriefWeatherQuery.data;
    const clearUntil = formatTime(`${String(details.clearUntilHour).padStart(2, '0')}:00`);
    return `${details.temperature}°F, ${details.weatherLabel} until ${clearUntil} | Wind: ${details.windSpeed} mph`;
  }, [morningBriefWeatherQuery.data, morningBriefWeatherQuery.error, morningBriefWeatherQuery.isLoading]);

  const fallbackDailyBrief = useMemo(() => {
    const weatherPart = morningBriefWeatherQuery.data
      ? `${morningBriefWeatherQuery.data.temperature}F with ${morningBriefWeatherQuery.data.weatherLabel.toLowerCase()}, wind near ${morningBriefWeatherQuery.data.windSpeed} mph`
      : 'weather data is currently unavailable';
    const gapPart =
      unassignedScheduledCount > 0
        ? `${unassignedScheduledCount} scheduled crew still need assignments`
        : 'all scheduled crew currently have assignments';
    const equipmentPart =
      overdueEquipmentCount > 0
        ? `${overdueEquipmentCount} equipment item${overdueEquipmentCount === 1 ? '' : 's'} are overdue for service`
        : 'equipment service status is clear';
    return `Today you have ${crewScheduledCount} crew scheduled and ${tasksAssignedCount} assigned tasks with ${scheduleCoveragePercent}% coverage. Expect ${weatherPart}, and keep an eye on conditions while dispatching. Right now ${gapPart}, and ${equipmentPart}.`;
  }, [
    crewScheduledCount,
    morningBriefWeatherQuery.data,
    overdueEquipmentCount,
    scheduleCoveragePercent,
    tasksAssignedCount,
    unassignedScheduledCount,
  ]);

  const dailyBriefContext = useMemo<DailyBriefContext>(() => {
    const rainProbability = selectedWeatherQuery.data?.current
      ? Number((selectedWeatherQuery.data.current as { precipitationProbability?: number }).precipitationProbability ?? 0)
      : null;
    return {
      date: todayKey,
      property: morningPropertyLabel,
      crew: {
        count: crewScheduledCount,
        members: scheduledRows.map((row) => ({
          name: row.name,
          shiftStart: row.shiftStart,
          shiftEnd: row.shiftEnd,
        })),
      },
      tasks: {
        count: tasksAssignedCount,
        names: Array.from(
          new Set(
            assignments
              .filter((assignment) => assignment.date === todayKey)
              .map((assignment) => assignment.title || 'Task'),
          ),
        ),
        coveragePercent: scheduleCoveragePercent,
      },
      weather: {
        temperatureF: morningBriefWeatherQuery.data?.temperature ?? null,
        windMph: morningBriefWeatherQuery.data?.windSpeed ?? null,
        rainProbabilityPct: rainProbability,
        conditions: morningBriefWeatherQuery.data?.weatherLabel ?? 'Unavailable',
      },
      equipmentAlerts: {
        overdueCount: overdueEquipmentCount,
        items: (equipmentAlertsQuery.data ?? []).map((item) => item.unit_name || item.name || 'Equipment'),
      },
      openNeedsCount: openNeedsCount,
      yesterdayCompletionRatePct: yesterdayCompletionQuery.data ?? 0,
    };
  }, [
    assignments,
    crewScheduledCount,
    equipmentAlertsQuery.data,
    morningBriefWeatherQuery.data,
    morningPropertyLabel,
    openNeedsCount,
    overdueEquipmentCount,
    scheduleCoveragePercent,
    scheduledRows,
    selectedWeatherQuery.data?.current,
    tasksAssignedCount,
    todayKey,
    yesterdayCompletionQuery.data,
  ]);

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

  const localOnboardingKey = `gcrew-onboarding-complete-${orgId}`;
  const localOnboardingDone = localStorage.getItem(localOnboardingKey) === 'true' || onboardingDismissedLocally;
  const shouldShowOnboarding =
    (forceOnboarding || (
    !isLoading &&
    !onboardingCheckQuery.isLoading &&
    !localOnboardingDone &&
    (
      (onboardingCheckQuery.data?.propertyCount ?? 0) === 0 ||
      (onboardingCheckQuery.data?.employeeCount ?? 0) === 0 ||
      (onboardingCheckQuery.data?.taskCount ?? 0) === 0
    )
    ));

  if (shouldShowOnboarding) {
    return (
      <OnboardingWizardV2
        orgId={orgId}
        userId={currentUser?.appUserId}
        onComplete={() => {
          setForceOnboarding(false);
          setOnboardingDismissedLocally(true);
          void onboardingCheckQuery.refetch();
          void dashboardDataQuery.refetch();
        }}
      />
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

  const handleEmailDigest = useCallback(() => {
    const preparedBy = currentUser?.fullName?.trim() || currentUser?.email || 'Ground Crew HQ User';
    const digestDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: '2-digit',
      year: 'numeric',
    });

    const crewLines =
      scheduledRows.length > 0
        ? scheduledRows
            .map((row) => {
              const assignedCount = assignments.filter(
                (assignment) => assignment.date === todayKey && assignment.employeeId === row.employeeId,
              ).length;
              return `${row.name} — ${formatTime(row.shiftStart)} - ${formatTime(row.shiftEnd)} — ${assignedCount} tasks assigned`;
            })
            .join('\n')
        : 'No crew scheduled';

    const weatherDetails = morningBriefWeatherQuery.data;
    const weatherCurrent = weatherDetails
      ? `${weatherDetails.temperature}°F, ${weatherDetails.weatherLabel}`
      : 'Weather unavailable';
    const windLine = weatherDetails ? `${weatherDetails.windSpeed} mph` : 'N/A';

    const equipmentLines =
      (equipmentAlertsQuery.data ?? []).length > 0
        ? (equipmentAlertsQuery.data ?? [])
            .map((item) => {
              const name = item.unit_name || item.name || 'Equipment';
              return `- ${name}`;
            })
            .join('\n')
        : 'All clear';

    const subject = `Ground Crew HQ — Daily Digest — ${morningPropertyLabel} — ${digestDate}`;
    const body = [
      'DAILY OPERATIONS DIGEST',
      `${morningPropertyLabel} — ${digestDate}`,
      `Prepared by: ${preparedBy}`,
      '',
      `CREW: ${crewScheduledCount} scheduled`,
      crewLines,
      '',
      'WEATHER:',
      `Current: ${weatherCurrent}`,
      `Wind: ${windLine}`,
      `Spray Window: ${sprayWindowSummary}`,
      '',
      `TASKS: ${taskStatusSummary.total} total — ${taskStatusSummary.planned} planned / ${taskStatusSummary.inProgress} in progress / ${taskStatusSummary.done} done`,
      `Coverage: ${coverageSummary.value} of scheduled hours covered`,
      '',
      'EQUIPMENT ALERTS:',
      equipmentLines,
      '',
      `OPEN NEEDS: ${openNeedsCount}`,
      '',
      '---',
      'Generated by Ground Crew HQ',
      'https://ground-crew-hq.vercel.app',
    ].join('\n');

    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [
    assignments,
    coverageSummary.value,
    crewScheduledCount,
    currentUser?.email,
    currentUser?.fullName,
    equipmentAlertsQuery.data,
    morningBriefWeatherQuery.data,
    morningPropertyLabel,
    openNeedsCount,
    scheduledRows,
    sprayWindowSummary,
    taskStatusSummary.done,
    taskStatusSummary.inProgress,
    taskStatusSummary.planned,
    taskStatusSummary.total,
    todayKey,
  ]);

  const handleWhatsAppDigest = useCallback(() => {
    const digestDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
    const crewLines =
      scheduledRows.length > 0
        ? scheduledRows
            .map((row) => {
              const crewTasks = assignments.filter(
                (assignment) => assignment.date === todayKey && assignment.employeeId === row.employeeId,
              );
              const taskLines =
                crewTasks.length > 0
                  ? crewTasks
                      .map((assignment) => `• ${assignment.title || 'Task'} (${Number(assignment.estimatedHours ?? 0).toFixed(1)}h)`)
                      .join('\n')
                  : '• No tasks assigned';
              return `👤 ${row.name}\n⏰ ${formatTime(row.shiftStart)} - ${formatTime(row.shiftEnd)}\n📋 Tasks:\n${taskLines}`;
            })
            .join('\n\n')
        : 'No scheduled crew';

    const weatherDetails = morningBriefWeatherQuery.data;
    const weatherLine = weatherDetails
      ? `${weatherDetails.temperature}°F, ${weatherDetails.weatherLabel}`
      : 'Weather unavailable';

    const text = [
      `*Ground Crew HQ — ${digestDate}*`,
      `*${morningPropertyLabel}*`,
      '',
      crewLines,
      '',
      `🌤️ Weather: ${weatherLine}`,
    ].join('\n');

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  }, [assignments, morningBriefWeatherQuery.data, morningPropertyLabel, scheduledRows, todayKey]);

  const markEquipmentServiced = useCallback(
    async (equipmentId: string) => {
      if (!supabase || !orgId) return;
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await supabase
        .from('equipment_units')
        .update({ last_serviced: today })
        .eq('id', equipmentId)
        .eq('org_id', orgId);
      if (error) {
        toast.error('Could not update service date', { description: error.message });
        return;
      }
      await equipmentAlertsQuery.refetch();
      await dashboardDataQuery.refetch();
      toast.success('Equipment marked serviced');
    },
    [dashboardDataQuery, equipmentAlertsQuery, orgId],
  );

  return (
    <div className="h-full overflow-auto bg-background p-4 md:p-6">
      {showWelcomeBanner ? (
        <Card className="mb-4 rounded-xl border border-green-500 bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold">Welcome to Ground Crew HQ, {firstName}! 👋</p>
              <p className="mt-1 text-sm text-white/90">Let's get your operation set up. Start with the setup wizard or explore the dashboard.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="h-9 gap-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => {
                    window.localStorage.setItem('ground-crew-welcome-dismissed', 'true');
                    setShowWelcomeBanner(false);
                    setForceOnboarding(true);
                  }}
                >
                  Start Setup
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 rounded-lg"
                  onClick={() => {
                    window.localStorage.setItem('ground-crew-welcome-dismissed', 'true');
                    setShowWelcomeBanner(false);
                  }}
                >
                  Explore Dashboard
                </Button>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-lg"
              onClick={() => {
                window.localStorage.setItem('ground-crew-welcome-dismissed', 'true');
                setShowWelcomeBanner(false);
              }}
            >
              ×
            </Button>
          </div>
        </Card>
      ) : null}
      <Card className="mb-6 rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="text-2xl font-semibold tracking-tight">
          {greeting}, {firstName}.
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Today: {morningDateLabel} · {morningPropertyLabel}
        </p>
        <div className="mt-4 space-y-2 text-sm">
          <p>
            👥 Crew: {crewScheduledCount} scheduled | ✅ Tasks: {tasksAssignedCount} assigned
          </p>
          <div className="flex flex-wrap gap-3">
            {crewScheduledCount === 0 ? (
              <button
                type="button"
                className="text-xs font-medium text-primary underline hover:text-primary/80"
                onClick={() => navigate('/app/scheduler')}
              >
                Schedule Crew
              </button>
            ) : null}
            {tasksAssignedCount === 0 ? (
              <button
                type="button"
                className="text-xs font-medium text-primary underline hover:text-primary/80"
                onClick={() => navigate('/app/workboard?quickPlan=1')}
              >
                Quick Plan
              </button>
            ) : null}
            {crewScheduledCount > 0 && tasksAssignedCount > 0 ? (
              <button
                type="button"
                className="text-xs font-medium text-primary underline hover:text-primary/80"
                onClick={() => navigate('/app/workboard')}
              >
                Open Workboard
              </button>
            ) : null}
          </div>
          <p>🌤️ Weather: {morningWeatherLine}</p>
          <div>
            <button
              type="button"
              className="text-xs font-medium text-primary underline hover:text-primary/80"
              onClick={() => navigate('/app/weather')}
            >
              View Full Weather
            </button>
          </div>
          <p>
            ⚠️ Alerts: {overdueEquipmentCount} equipment overdue | {openNeedsCount} open needs
          </p>
          <div>
            <button
              type="button"
              className="text-xs font-medium text-primary underline hover:text-primary/80"
              onClick={handleEmailDigest}
            >
              Email Digest
            </button>
            <button
              type="button"
              className="ml-3 text-xs font-medium text-primary underline hover:text-primary/80"
              onClick={handleWhatsAppDigest}
            >
              Send via WhatsApp
            </button>
          </div>
          {overdueEquipmentCount > 0 ? (
            <div>
              <button
                type="button"
                className="text-xs font-medium text-primary underline hover:text-primary/80"
                onClick={() => navigate('/app/equipment')}
              >
                Review Equipment
              </button>
            </div>
          ) : null}
        </div>
      </Card>

      {operationsScorecard ? (
        <Card className="mb-6 rounded-2xl border p-5 shadow-sm">
          <div className="mb-3">
            <h3 className="text-base font-semibold">Operations Scorecard</h3>
            <p className="text-xs text-muted-foreground">Last 7 days of operations with trend against previous week.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <ScorecardMetricCard
              label="Task Completion Rate"
              value={`${operationsScorecard.completionCurrent}%`}
              trend={operationsScorecard.completionTrend}
              data={operationsScorecard.completionDaily}
              toneClass="border-green-200"
            />
            <ScorecardMetricCard
              label="Labor Efficiency"
              value={`${operationsScorecard.laborCurrent}%`}
              trend={operationsScorecard.laborTrend}
              data={operationsScorecard.laborDaily}
              toneClass={
                operationsScorecard.laborCurrent >= 90 && operationsScorecard.laborCurrent <= 110
                  ? 'border-green-200'
                  : (operationsScorecard.laborCurrent >= 80 && operationsScorecard.laborCurrent < 90) || (operationsScorecard.laborCurrent > 110 && operationsScorecard.laborCurrent <= 120)
                    ? 'border-yellow-200'
                    : 'border-red-200'
              }
            />
            <ScorecardMetricCard
              label="Average Coverage"
              value={`${operationsScorecard.coverageCurrent}%`}
              trend={operationsScorecard.coverageTrend}
              data={operationsScorecard.coverageDaily}
              toneClass="border-blue-200"
            />
            <ScorecardMetricCard
              label="Equipment Uptime"
              value={`${operationsScorecard.equipmentUptime}%`}
              trend={operationsScorecard.equipmentTrend}
              data={operationsScorecard.equipmentDaily}
              toneClass="border-emerald-200"
            />
            <ScorecardMetricCard
              label="Crew Utilization"
              value={`${operationsScorecard.crewUtilization}%`}
              trend={operationsScorecard.crewTrend}
              data={operationsScorecard.crewDaily}
              toneClass="border-indigo-200"
            />
          </div>
        </Card>
      ) : null}

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
        <h1 className="text-lg font-semibold tracking-tight">Operations Summary</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Review readiness, risks, and blockers.</p>
      </div>

      {!isLoading && !queryTimeoutReached ? (
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="rounded-xl border bg-card p-4 lg:col-span-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Morning Briefing</div>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">
              {greeting}, {firstName}.
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Today: {morningDateLabel} · {morningPropertyLabel}
            </p>
            <p className="mt-3 text-sm">
              {dailyBriefText ?? `${crewScheduledCount} crew scheduled, ${tasksAssignedCount} tasks assigned, ${weatherRiskSummary.value}.`}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" className="h-9 gap-1.5 rounded-lg" onClick={() => navigate('/app/workboard')}>
                Open Workboard
              </Button>
              <Button size="sm" variant="outline" className="h-9 rounded-lg" onClick={() => navigate('/app/scheduler')}>
                Open Scheduler
              </Button>
            </div>
          </Card>

          <Card className="rounded-xl border bg-card p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Weather</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight">
              {selectedWeatherQuery.data ? `${Math.round(selectedWeatherQuery.data.current.temperature)}°F` : '--'}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {selectedWeatherQuery.data
                ? `${getWeatherConditionMeta(selectedWeatherQuery.data.current.weatherCode).label} · Wind ${Math.round(selectedWeatherQuery.data.current.windSpeed)} mph`
                : 'No weather data available'}
            </p>
            <button
              type="button"
              className="mt-3 text-xs font-medium text-primary underline"
              onClick={() => navigate('/app/weather')}
            >
              View Full Weather →
            </button>
          </Card>

          <OpsSignalCard title="Crew Count" value={`${crewScheduledCount}`} subtitle="Crew Scheduled" tone={crewScheduledCount > 0 ? 'good' : 'critical'} />
          <OpsSignalCard
            title="Tasks Count"
            value={`${tasksAssignedCount}`}
            subtitle={`${assignments.filter((item) => item.status === 'done').length}/${tasksAssignedCount || 0} done`}
            tone={tasksAssignedCount > 0 ? 'good' : crewScheduledCount > 0 ? 'warning' : 'neutral'}
          />

          <Card className="rounded-xl border bg-card p-4 lg:col-span-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Spray Window</div>
            <div className="mt-3">
              {sprayWindowQuery.isLoading ? (
                <Skeleton className="h-6 w-full rounded-full" />
              ) : (
                <div className="grid min-w-[520px] grid-cols-12 gap-1 overflow-x-auto">
                  {(sprayWindowQuery.data ?? []).map((block) => (
                    <div key={`spray-bento-${block.hour}`} className={`h-5 rounded ${block.safe ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  ))}
                </div>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{sprayWindowSummary}</p>
          </Card>

          <Card className={`rounded-xl border border-l-4 bg-card p-4 ${efficiencyScoreSummary.toneClasses}`}>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Efficiency Score</div>
            <div className="mt-2 text-4xl font-semibold tracking-tight">{efficiencyScoreSummary.score}</div>
            <p className="mt-1 text-sm">{efficiencyScoreSummary.label}</p>
            <p className="mt-2 text-xs">
              {efficiencyScoreSummary.trend === 'up' ? '↑' : efficiencyScoreSummary.trend === 'down' ? '↓' : '→'} vs yesterday
            </p>
          </Card>

          <OpsSignalCard title="Schedule Coverage" value={coverageSummary.value} subtitle={coverageSummary.subtitle} tone={coverageSummary.tone} />
          <OpsSignalCard
            title="Equipment Health"
            value={equipmentUnits.length === 0 ? 'No data' : `${equipmentActiveCount}/${equipmentUnits.length} Ready`}
            subtitle={overdueEquipmentCount > 0 ? `${overdueEquipmentCount} overdue` : 'All clear'}
            tone={overdueEquipmentCount === 0 ? 'good' : overdueEquipmentCount <= 2 ? 'warning' : 'critical'}
          />

          <Card className="rounded-xl border bg-card p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Open Needs</div>
            <div className="mt-2 text-2xl font-semibold">{openNeedsCount}</div>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              {(openNeedsPreviewQuery.data ?? []).map((need) => (
                <div key={need.id}>• {need.title}</div>
              ))}
              {(openNeedsPreviewQuery.data ?? []).length === 0 ? <div>No open needs</div> : null}
            </div>
            <button type="button" className="mt-3 text-xs font-medium text-primary underline" onClick={() => navigate('/app/workboard')}>
              View All →
            </button>
          </Card>

          {operationsScorecard ? (
            <Card className="rounded-xl border bg-card p-4 lg:col-span-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Operations Scorecard</div>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                <ScorecardMetricCard
                  label="Task Completion"
                  value={`${operationsScorecard.completionCurrent}%`}
                  trend={operationsScorecard.completionTrend}
                  data={operationsScorecard.completionDaily}
                  toneClass="border-green-200"
                />
                <ScorecardMetricCard
                  label="Labor Efficiency"
                  value={`${operationsScorecard.laborCurrent}%`}
                  trend={operationsScorecard.laborTrend}
                  data={operationsScorecard.laborDaily}
                  toneClass="border-blue-200"
                />
                <ScorecardMetricCard
                  label="Coverage"
                  value={`${operationsScorecard.coverageCurrent}%`}
                  trend={operationsScorecard.coverageTrend}
                  data={operationsScorecard.coverageDaily}
                  toneClass="border-indigo-200"
                />
                <ScorecardMetricCard
                  label="Equipment"
                  value={`${operationsScorecard.equipmentUptime}%`}
                  trend={operationsScorecard.equipmentTrend}
                  data={operationsScorecard.equipmentDaily}
                  toneClass="border-emerald-200"
                />
                <ScorecardMetricCard
                  label="Crew Utilization"
                  value={`${operationsScorecard.crewUtilization}%`}
                  trend={operationsScorecard.crewTrend}
                  data={operationsScorecard.crewDaily}
                  toneClass="border-amber-200"
                />
              </div>
            </Card>
          ) : null}
        </div>
      ) : null}

      {isLoading && !queryTimeoutReached ? <div className="mb-6"><CardSkeleton /></div> : null}

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
              ? crewScheduledCount > 0
                ? 'Crew is scheduled, but no tasks are assigned yet.'
                : 'No crew and no tasks scheduled yet.'
              : `${pendingAssignmentsCount} still in progress or planned`
          }
          tone={
            tasksAssignedCount > 0
              ? 'good'
              : crewScheduledCount > 0
                ? 'warning'
                : 'neutral'
          }
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
              : `${overdueEquipmentCount} units overdue for service`
          }
          tone={
            equipmentUnits.length === 0
              ? 'neutral'
              : overdueEquipmentCount === 0
                ? 'good'
                : overdueEquipmentCount <= 2
                  ? 'warning'
                  : 'critical'
          }
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
        <OpsSignalCard
          title="Compliance Status"
          value={complianceSummary.value}
          subtitle={complianceSummary.subtitle}
          tone={complianceSummary.tone}
        />
      </div> : null}

      {!isLoading && !queryTimeoutReached ? (
        <Card className="mb-6 rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">📋 Next Steps</h3>
            <span className="text-xs text-muted-foreground">Top priorities</span>
          </div>
          <div className="mt-3 space-y-2">
            {visibleNextSteps.length > 0 ? (
              visibleNextSteps.map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                    <div className="flex min-w-0 items-start gap-2">
                      <Icon className="mt-0.5 h-4 w-4 text-primary" />
                      <div>
                        <p className="text-sm">{step.message}</p>
                        {step.actionPath && step.actionLabel ? (
                          <button
                            type="button"
                            onClick={() => navigate(step.actionPath as string)}
                            className="mt-1 text-xs font-medium text-primary hover:text-primary/80"
                          >
                            {step.actionLabel} →
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => dismissNextStep(step.id)}
                      className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Dismiss next step"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                All current next-step items dismissed for this session.
              </div>
            )}
          </div>
        </Card>
      ) : null}

      {!isLoading && !queryTimeoutReached ? (
        <Card className={`mb-6 rounded-xl border-l-4 p-5 shadow-sm ${efficiencyScoreSummary.toneClasses}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Efficiency Score
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" aria-label="Efficiency score help">
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Based on task completion, coverage, labor variance, equipment health, and open needs.</TooltipContent>
                </Tooltip>
              </div>
              {efficiencyInputsQuery.isLoading ? (
                <Skeleton className="mt-2 h-10 w-20 rounded-md" />
              ) : (
                <div className="mt-2 text-4xl font-semibold tracking-tight">{efficiencyScoreSummary.score}</div>
              )}
              <p className="mt-1 text-sm">{efficiencyScoreSummary.label}</p>
            </div>
            <div className="flex items-center gap-1 text-xs font-medium">
              {efficiencyScoreSummary.trend === 'up' ? <ArrowUpRight className="h-4 w-4" /> : null}
              {efficiencyScoreSummary.trend === 'down' ? <ArrowDownRight className="h-4 w-4" /> : null}
              <span>
                {efficiencyScoreSummary.trend === 'up'
                  ? 'Higher than yesterday'
                  : efficiencyScoreSummary.trend === 'down'
                    ? 'Lower than yesterday'
                    : 'Same as yesterday'}
              </span>
            </div>
          </div>
          {efficiencyInputsQuery.error ? (
            <p className="mt-2 text-xs text-muted-foreground">Unable to calculate score right now.</p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Based on completion, coverage, labor variance, equipment health, and open needs.
            </p>
          )}
        </Card>
      ) : null}

      {!isLoading && crewScheduledCount === 0 && tasksAssignedCount === 0 ? (
        <div className="mb-6">
          <EmptyState
            icon={LayoutDashboard}
            title="Welcome to Ground Crew HQ"
            description="Set up your schedule and tasks to see today's operations summary."
            actionLabel="Open Scheduler"
            onAction={() => navigate('/app/scheduler')}
          />
        </div>
      ) : null}

      <Card className="mb-6 rounded-2xl border p-4 md:p-5 shadow-sm">
        <div className="flex items-center gap-1">
          <h3 className="text-sm font-semibold">Spray Window — Today</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" aria-label="Spray window help">
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Green = safe to spray. Red = wind or rain makes spraying risky.</TooltipContent>
          </Tooltip>
        </div>
        <div className="mt-3">
          {sprayWindowQuery.isLoading ? (
            <Skeleton className="h-6 w-full rounded-full" />
          ) : sprayWindowQuery.data && sprayWindowQuery.data.length > 0 ? (
            <div className="relative overflow-x-auto">
              <div className="grid min-w-[520px] grid-cols-12 gap-1">
                {sprayWindowQuery.data.map((block) => (
                  <div
                    key={`spray-hour-${block.hour}`}
                    className={`h-6 rounded ${block.safe ? 'bg-emerald-500' : 'bg-red-500'}`}
                    title={`${formatTime(`${block.hour.toString().padStart(2, '0')}:00`)} - ${formatTime(`${(block.hour + 1).toString().padStart(2, '0')}:00`)}`}
                  />
                ))}
              </div>
              {sprayCurrentMarkerPercent !== null ? (
                <div
                  className="pointer-events-none absolute -top-1 bottom-0 w-0.5 bg-foreground/80"
                  style={{ left: `${sprayCurrentMarkerPercent}%` }}
                >
                  <span className="absolute -top-4 -translate-x-1/2 text-[10px] font-medium text-foreground">
                    Now
                  </span>
                </div>
              ) : null}
              <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>6:00 AM</span>
                <span>12:00 PM</span>
                <span>6:00 PM</span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">No weather data available for spray window analysis.</div>
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{sprayWindowSummary}</p>
      </Card>

      <Card className="mb-6 rounded-2xl border p-5 shadow-sm">
        <h3 className="text-sm font-semibold">Labor: Scheduled vs Actual (Last 7 Days)</h3>
        <div className="mt-4 h-64">
          {laborTrendQuery.isLoading ? (
            <Skeleton className="h-full w-full rounded-xl" />
          ) : laborTrendQuery.error ? (
            <div className="text-xs text-muted-foreground">Unable to load labor chart.</div>
          ) : (
            <Suspense fallback={<Skeleton className="h-full w-full rounded-xl" />}>
              <RechartsResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={laborTrendData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <RechartsCartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <RechartsXAxis dataKey="label" tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <RechartsYAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <RechartsTooltip />
                  <RechartsLegend />
                  <RechartsBar dataKey="scheduled" name="Scheduled" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                    <RechartsLabelList
                      dataKey="scheduled"
                      position="top"
                      fontSize={10}
                      fill="#2563eb"
                      formatter={(value: number) => value.toFixed(1)}
                    />
                  </RechartsBar>
                  <RechartsBar dataKey="actual" name="Actual" radius={[4, 4, 0, 0]}>
                    {laborTrendData.map((entry) => (
                      <RechartsCell
                        key={`actual-cell-${entry.date}`}
                        fill={entry.actual > entry.scheduled ? '#f97316' : '#16a34a'}
                      />
                    ))}
                    <RechartsLabelList
                      dataKey="actual"
                      position="top"
                      fontSize={10}
                      fill="#166534"
                      formatter={(value: number) => value.toFixed(1)}
                    />
                  </RechartsBar>
                </RechartsBarChart>
              </RechartsResponsiveContainer>
            </Suspense>
          )}
        </div>
      </Card>

      {isAllPropertiesView ? (
        <Card className="mb-6 rounded-2xl border p-5 shadow-sm">
          <h3 className="text-sm font-semibold">Property Breakdown</h3>
          <p className="mt-1 text-xs text-muted-foreground">Crew, tasks, and coverage by property for today.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Property</th>
                  <th className="pb-2 font-medium">Crew</th>
                  <th className="pb-2 font-medium">Tasks</th>
                  <th className="pb-2 font-medium">Coverage</th>
                </tr>
              </thead>
              <tbody>
                {propertyBreakdownRows.map((row) => (
                  <tr
                    key={`property-breakdown-${row.propertyId}`}
                    className="cursor-pointer border-b last:border-0 hover:bg-muted/30"
                    onClick={() => {
                      setCurrentPropertyId(row.propertyId);
                      navigate(`/app/workboard?property=${encodeURIComponent(row.propertyId)}`);
                    }}
                  >
                    <td className="py-2 font-medium">{row.propertyName}</td>
                    <td className="py-2">{row.crewCount} crew</td>
                    <td className="py-2">{row.taskCount} tasks</td>
                    <td className="py-2">{row.coveragePct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <Card className="mb-6 rounded-2xl border p-5 shadow-sm">
        <h3 className="text-sm font-semibold">Labor Cost This Week</h3>
        <div className="mt-2 text-sm text-muted-foreground">{weeklyLaborCostSummary}</div>
        {!weeklyLaborCostQuery.isLoading && !weeklyLaborCostQuery.error && !weeklyLaborCostQuery.data?.hasHourlyRates ? (
          <p className="mt-2 text-xs text-amber-700">
            Set employee hourly rates in the Employees page to enable cost tracking.
          </p>
        ) : null}
        <div className="mt-4 h-44">
          {weeklyLaborCostQuery.isLoading ? (
            <Skeleton className="h-full w-full rounded-xl" />
          ) : weeklyLaborCostQuery.error ? (
            <div className="text-xs text-muted-foreground">Unable to load weekly labor costs.</div>
          ) : (
            <Suspense fallback={<Skeleton className="h-full w-full rounded-xl" />}>
              <RechartsResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={weeklyLaborCostQuery.data?.daily ?? []} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <RechartsCartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <RechartsXAxis dataKey="label" tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <RechartsYAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <RechartsTooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
                  <RechartsBar dataKey="cost" name="Cost" fill="#166534" radius={[4, 4, 0, 0]} />
                </RechartsBarChart>
              </RechartsResponsiveContainer>
            </Suspense>
          )}
        </div>
      </Card>

      <Card className="mb-6 rounded-2xl border p-5 shadow-sm">
        <h3 className="text-sm font-semibold">Equipment Alerts</h3>
        <div className="mt-3">
          {equipmentAlertsQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ) : equipmentAlertsQuery.error ? (
            <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
              Unable to load equipment service alerts.
              <Button
                size="sm"
                variant="outline"
                className="ml-2"
                onClick={() => void equipmentAlertsQuery.refetch()}
              >
                Retry
              </Button>
            </div>
          ) : (equipmentAlertsQuery.data ?? []).length === 0 ? (
            <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              All equipment is up to date ✓
            </div>
          ) : (
            <div className="space-y-2">
              {(equipmentAlertsQuery.data ?? []).map((item) => {
                const displayName = item.unit_name || item.name || 'Equipment';
                const servicedDate = item.last_serviced ? new Date(item.last_serviced) : null;
                const overdueDays = servicedDate
                  ? Math.max(0, Math.floor((Date.now() - servicedDate.getTime()) / (1000 * 60 * 60 * 24)) - 90)
                  : 0;
                return (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
                    <div className="text-sm">
                      <span className="font-medium">⚠️ {displayName}</span>
                      <span className="text-muted-foreground">
                        {' '}— overdue for service by {overdueDays} day{overdueDays === 1 ? '' : 's'}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void markEquipmentServiced(item.id)}
                    >
                      Mark Serviced
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
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

      <Card className="mb-6 rounded-xl border bg-card p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Button size="sm" className="h-9 gap-1.5 rounded-lg text-sm font-semibold" onClick={() => navigate('/app/workboard')}>
            <ArrowRight className="mr-2 h-4 w-4" />
            Build Today's Plan
          </Button>
          <Button size="sm" className="h-9 gap-1.5 rounded-lg text-sm font-semibold" variant="secondary" onClick={() => navigate('/app/scheduler')}>
            <Calendar className="mr-2 h-4 w-4" />
            Add Shift
          </Button>
          <Button size="sm" className="h-9 gap-1.5 rounded-lg text-sm font-semibold" variant="outline" onClick={() => navigate('/app/employees')}>
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
          <EmptyState
            icon={Users}
            title="No crew scheduled today"
            description="Add shifts in the Scheduler to see your crew here."
            actionLabel="Open Scheduler"
            onAction={() => navigate('/app/scheduler')}
          />
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
                    <td className="py-3">{formatTime(row.shiftStart)} - {formatTime(row.shiftEnd)}</td>
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
