import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/sonner';
import { ArrowRight, Calendar, CheckCircle2, Circle, CloudRain, MapPin, Plus, Users, Wrench } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatTime } from '@/utils/formatTime';
import { useAuth } from '@/contexts/AuthContext';
import { fetchOpenMeteoWeather, getWeatherConditionMeta } from '@/lib/openMeteo';
import { useWeather } from '@/lib/weather';
import { useDashboardData } from '@/hooks/useDashboardData';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { OnboardingWizard } from '@/components/OnboardingWizard';
import { EmptyState } from '@/components/EmptyState';
import { CardSkeleton } from '@/components/CardSkeleton';
import { LayoutDashboard } from 'lucide-react';

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
      ? 'border-green-500 bg-emerald-50/60'
      : tone === 'warning'
        ? 'border-yellow-500 bg-amber-50/60'
        : tone === 'critical'
          ? 'border-red-500 bg-red-50/50'
          : 'border-gray-400 bg-card';
  return (
    <Card className={`rounded-2xl border-l-4 p-5 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md ${toneClass}`}>
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
  const [onboardingDismissedLocally, setOnboardingDismissedLocally] = useState(false);

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
  const laborTrendQuery = useQuery({
    queryKey: ['dashboard-labor-trend-7d', orgId ?? 'no-org'],
    enabled: Boolean(orgId),
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      if (!supabase || !orgId) return [] as Array<{ date: string; scheduled: number; actual: number }>;
      const today = new Date();
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      const startDate = start.toISOString().slice(0, 10);
      const endDate = today.toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('assignments')
        .select('date, estimated_hours, actual_hours')
        .eq('org_id', orgId)
        .gte('date', startDate)
        .lte('date', endDate);
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
    queryKey: ['dashboard-spray-window', selectedProperty?.id ?? 'none'],
    enabled:
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
    queryKey: ['dashboard-morning-open-needs', orgId ?? 'no-org', todayKey],
    enabled: Boolean(orgId),
    staleTime: 1000 * 60,
    queryFn: async () => {
      if (!supabase || !orgId) return 0;
      const { count, error } = await supabase
        .from('task_requests')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('date', todayKey)
        .eq('status', 'open');
      if (error) throw error;
      return count ?? 0;
    },
  });

  const morningBriefWeatherQuery = useQuery({
    queryKey: ['dashboard-morning-brief-weather', selectedProperty?.id ?? 'none', todayKey],
    enabled:
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
    queryKey: ['dashboard-equipment-alerts', orgId ?? 'no-org'],
    enabled: Boolean(orgId),
    staleTime: 1000 * 60,
    queryFn: async () => {
      if (!supabase || !orgId) {
        return [] as Array<{ id: string; name: string | null; unit_name: string | null; type: string | null; last_serviced: string | null }>;
      }
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - 90);
      const thresholdKey = thresholdDate.toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from('equipment_units')
        .select('id, name, unit_name, type, last_serviced')
        .eq('org_id', orgId)
        .eq('active', true)
        .lt('last_serviced', thresholdKey)
        .order('last_serviced', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string | null; unit_name: string | null; type: string | null; last_serviced: string | null }>;
    },
  });
  const weeklyLaborCostQuery = useQuery({
    queryKey: ['dashboard-weekly-labor-cost', orgId ?? 'no-org', todayKey],
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

      const [assignmentsResult, employeesResult] = await Promise.all([
        supabase
          .from('assignments')
          .select('date, employee_id, actual_hours')
          .eq('org_id', orgId)
          .gte('date', startDate)
          .lte('date', endDate),
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
  const morningPropertyLabel = selectedProperty?.name ?? 'No property selected';
  const openNeedsCount = morningNeedsQuery.data ?? 0;
  const overdueEquipmentCount = equipmentAlertsQuery.data?.length ?? 0;
  const morningWeatherLine = useMemo(() => {
    if (morningBriefWeatherQuery.isLoading) return 'Loading weather...';
    if (morningBriefWeatherQuery.error || !morningBriefWeatherQuery.data) return 'Weather unavailable';
    const details = morningBriefWeatherQuery.data;
    const clearUntil = formatTime(`${String(details.clearUntilHour).padStart(2, '0')}:00`);
    return `${details.temperature}°F, ${details.weatherLabel} until ${clearUntil} | Wind: ${details.windSpeed} mph`;
  }, [morningBriefWeatherQuery.data, morningBriefWeatherQuery.error, morningBriefWeatherQuery.isLoading]);

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
    !isLoading &&
    !onboardingCheckQuery.isLoading &&
    !localOnboardingDone &&
    (
      (onboardingCheckQuery.data?.propertyCount ?? 0) === 0 ||
      (onboardingCheckQuery.data?.employeeCount ?? 0) === 0 ||
      (onboardingCheckQuery.data?.taskCount ?? 0) === 0
    );

  if (shouldShowOnboarding) {
    return (
      <OnboardingWizard
        orgId={orgId}
        userId={currentUser?.appUserId}
        onComplete={() => {
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
    <div className="h-full overflow-auto bg-background p-3 md:p-6">
      <Card className="mb-6 rounded-2xl border p-6 shadow-sm bg-gradient-to-r from-emerald-50 to-white">
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
      </div> : null}

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
        <h3 className="text-sm font-semibold">Spray Window — Today</h3>
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
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={laborTrendData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6b7280' }} />
                <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="scheduled" name="Scheduled" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                  <LabelList
                    dataKey="scheduled"
                    position="top"
                    fontSize={10}
                    fill="#2563eb"
                    formatter={(value: number) => value.toFixed(1)}
                  />
                </Bar>
                <Bar dataKey="actual" name="Actual" radius={[4, 4, 0, 0]}>
                  {laborTrendData.map((entry) => (
                    <Cell
                      key={`actual-cell-${entry.date}`}
                      fill={entry.actual > entry.scheduled ? '#f97316' : '#16a34a'}
                    />
                  ))}
                  <LabelList
                    dataKey="actual"
                    position="top"
                    fontSize={10}
                    fill="#166534"
                    formatter={(value: number) => value.toFixed(1)}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

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
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyLaborCostQuery.data?.daily ?? []} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6b7280' }} />
                <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
                <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
                <Bar dataKey="cost" name="Cost" fill="#166534" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
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
