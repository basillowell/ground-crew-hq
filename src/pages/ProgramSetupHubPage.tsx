import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceSettings } from '@/components/settings/WorkspaceSettings';
import { WorkforceSettings } from '@/components/settings/WorkforceSettings';
import { SchedulerSettings } from '@/components/settings/SchedulerSettings';
import { WeatherSettings } from '@/components/settings/WeatherSettings';
import { AccessSettings } from '@/components/settings/AccessSettings';
import { HelpSettings } from '@/components/settings/HelpSettings';

type SettingsTabId = 'workspace' | 'workforce' | 'scheduler' | 'weather' | 'access' | 'help';

type MetricsResult = {
  propertiesCount: number;
  portalUsersCount: number;
  activeCrewCount: number;
  workforceReadyPercent: number;
  schedulerReadyPercent: number;
  schedulerConfigured: boolean;
  weatherConfigured: boolean;
  orgName: string;
  orgPlan: string;
};

const TABS: Array<{ id: SettingsTabId; label: string }> = [
  { id: 'workspace', label: 'Workspace' },
  { id: 'workforce', label: 'Workforce' },
  { id: 'scheduler', label: 'Scheduler' },
  { id: 'weather', label: 'Weather' },
  { id: 'access', label: 'Access' },
  { id: 'help', label: 'Help' },
];

const STORAGE_KEY = 'settings_active_tab';

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + diffToMonday);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  return {
    start: weekStart.toISOString().slice(0, 10),
    end: weekEnd.toISOString().slice(0, 10),
  };
}

function percentage(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function segmentClass(configured: boolean) {
  return configured ? 'bg-[#166534]' : 'bg-[#e5e7eb]';
}

export default function ProgramSetupHubPage() {
  const { user, orgId, userRole, isReady } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTabId>('workspace');

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as SettingsTabId | null;
    if (stored && TABS.some((tab) => tab.id === stored)) setActiveTab(stored);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, activeTab);
  }, [activeTab]);

  const metricsQuery = useQuery({
    queryKey: ['settings-readiness-metrics', orgId],
    enabled: Boolean(isReady && orgId),
    queryFn: async (): Promise<MetricsResult> => {
      if (!supabase || !orgId) throw new Error('Supabase client is not configured.');
      const { start, end } = getWeekRange();

      const [
        propertiesResult,
        appUsersResult,
        activeEmployeesResult,
        employeesResult,
        scheduleResult,
        schedulerSettingsResult,
        weatherLocationsResult,
        organizationResult,
        programSettingsResult,
      ] = await Promise.all([
        supabase.from('properties').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
        supabase.from('app_users').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
        supabase.from('employees').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'active'),
        supabase.from('employees').select('id, role, department').eq('org_id', orgId),
        supabase.from('schedule_entries').select('id').eq('org_id', orgId).gte('date', start).lte('date', end),
        supabase.from('scheduler_settings').select('id').eq('org_id', orgId).limit(1).maybeSingle(),
        supabase.from('weather_locations').select('id').eq('org_id', orgId).eq('is_active', true).limit(1).maybeSingle(),
        supabase.from('organizations').select('name, plan').eq('id', orgId).single(),
        supabase.from('program_settings').select('app_name').eq('org_id', orgId).single(),
      ]);

      const error =
        propertiesResult.error ||
        appUsersResult.error ||
        activeEmployeesResult.error ||
        employeesResult.error ||
        scheduleResult.error ||
        schedulerSettingsResult.error ||
        weatherLocationsResult.error ||
        organizationResult.error ||
        programSettingsResult.error;
      if (error) throw error;

      const activeCrewCount = activeEmployeesResult.count ?? 0;
      const employees = employeesResult.data ?? [];
      const workforceReadyCount = employees.filter(
        (employee) => Boolean((employee.role ?? '').trim()) && Boolean((employee.department ?? '').trim()),
      ).length;
      const workforceReadyPercent = employees.length ? (workforceReadyCount / employees.length) * 100 : 0;
      const scheduleEntriesThisWeek = scheduleResult.data?.length ?? 0;
      const schedulerTarget = Math.max((activeCrewCount || 0) * 5, 1);
      const schedulerReadyPercent = (scheduleEntriesThisWeek / schedulerTarget) * 100;

      return {
        propertiesCount: propertiesResult.count ?? 0,
        portalUsersCount: appUsersResult.count ?? 0,
        activeCrewCount,
        workforceReadyPercent: percentage(workforceReadyPercent),
        schedulerReadyPercent: percentage(schedulerReadyPercent),
        schedulerConfigured: Boolean(schedulerSettingsResult.data?.id),
        weatherConfigured: Boolean(weatherLocationsResult.data?.id),
        orgName: organizationResult.data?.name ?? programSettingsResult.data?.app_name ?? 'Ground Crew HQ',
        orgPlan: organizationResult.data?.plan ?? 'starter',
      };
    },
  });

  const metrics = metricsQuery.data;

  const readinessSegments = useMemo(() => {
    const workforceConfigured = Boolean((metrics?.activeCrewCount ?? 0) > 0);
    const schedulerConfigured = Boolean(metrics?.schedulerConfigured);
    const propertiesConfigured = Boolean((metrics?.propertiesCount ?? 0) > 0);
    const weatherConfigured = Boolean(metrics?.weatherConfigured);
    return { workforceConfigured, schedulerConfigured, propertiesConfigured, weatherConfigured };
  }, [metrics]);

  const operationalReadyPercent = useMemo(() => {
    const values = [
      readinessSegments.workforceConfigured,
      readinessSegments.schedulerConfigured,
      readinessSegments.propertiesConfigured,
      readinessSegments.weatherConfigured,
    ];
    return Math.round((values.filter(Boolean).length / 4) * 100);
  }, [readinessSegments]);

  if (!isReady) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    );
  }

  if (!user || !orgId) {
    return (
      <div className="space-y-3 p-6">
        <p className="text-sm text-muted-foreground">Unable to load workspace settings.</p>
        <Button asChild variant="outline">
          <Link to="/">Return to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Operations Control Center</h1>
          <p className="text-sm text-muted-foreground">
            {metricsQuery.isLoading
              ? 'Loading organization...'
              : `${metrics?.orgName ?? 'Ground Crew HQ'} · ${metrics?.orgPlan ?? 'starter'} plan`}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">{user.email}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        {metricsQuery.isLoading ? (
          Array.from({ length: 5 }).map((_, index) => <Skeleton key={`metric-${index}`} className="h-24 rounded-xl" />)
        ) : metricsQuery.error ? (
          <Card className="col-span-full p-4">
            <p className="text-sm text-destructive">
              Failed to load: {String((metricsQuery.error as { message?: string } | null)?.message ?? 'Unknown error')}
            </p>
            <Button className="mt-3" variant="outline" size="sm" onClick={() => void metricsQuery.refetch()}>
              Retry
            </Button>
          </Card>
        ) : (
          <>
            <Card className="rounded-xl p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Properties</p>
              <p className="mt-2 text-2xl font-semibold">{metrics?.propertiesCount ?? 0} Properties</p>
            </Card>
            <Card className="rounded-xl p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Portal Users</p>
              <p className="mt-2 text-2xl font-semibold">{metrics?.portalUsersCount ?? 0} Users</p>
            </Card>
            <Card className="rounded-xl p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Active Crew</p>
              <p className="mt-2 text-2xl font-semibold">{metrics?.activeCrewCount ?? 0} Crew</p>
            </Card>
            <Card className="rounded-xl p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Workforce Ready</p>
              <p className="mt-2 text-2xl font-semibold">{metrics?.workforceReadyPercent ?? 0}% Workforce</p>
            </Card>
            <Card className="rounded-xl p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Scheduler Ready</p>
              <p className="mt-2 text-2xl font-semibold">{metrics?.schedulerReadyPercent ?? 0}% Scheduler</p>
            </Card>
          </>
        )}
      </div>

      <Card className="space-y-3 rounded-xl p-4">
        <div className="grid grid-cols-4 overflow-hidden rounded-full">
          <div className={`h-4 ${segmentClass(readinessSegments.workforceConfigured)}`} />
          <div className={`h-4 ${segmentClass(readinessSegments.schedulerConfigured)}`} />
          <div className={`h-4 ${segmentClass(readinessSegments.propertiesConfigured)}`} />
          <div className={`h-4 ${segmentClass(readinessSegments.weatherConfigured)}`} />
        </div>
        <div className="grid grid-cols-4 text-xs text-muted-foreground">
          <span>Workforce</span>
          <span>Scheduler</span>
          <span>Properties</span>
          <span>Weather</span>
        </div>
        <p className="text-sm font-medium">{operationalReadyPercent}% Operational Ready</p>
      </Card>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Button
            key={tab.id}
            size="sm"
            variant={activeTab === tab.id ? 'default' : 'outline'}
            className={activeTab === tab.id ? 'bg-[#166534] text-white hover:bg-[#14532d]' : ''}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === 'workspace' ? <WorkspaceSettings orgId={orgId} user={user} userRole={userRole} /> : null}
      {activeTab === 'workforce' ? <WorkforceSettings orgId={orgId} user={user} userRole={userRole} /> : null}
      {activeTab === 'scheduler' ? <SchedulerSettings orgId={orgId} user={user} userRole={userRole} /> : null}
      {activeTab === 'weather' ? <WeatherSettings orgId={orgId} user={user} userRole={userRole} /> : null}
      {activeTab === 'access' ? <AccessSettings orgId={orgId} user={user} userRole={userRole} /> : null}
      {activeTab === 'help' ? <HelpSettings orgId={orgId} user={user} userRole={userRole} /> : null}
    </div>
  );
}
