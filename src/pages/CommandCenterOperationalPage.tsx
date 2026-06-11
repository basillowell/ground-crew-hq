import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  ArrowRight,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Loader2,
  TriangleAlert,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import { fetchNwsAlerts } from '@/lib/weather/providers';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import {
  useAssignments,
  useAssignmentsRange,
  useEmployees,
  useEquipmentUnits,
  useProgramSettings,
  useProperties,
  useScheduleEntries,
  useScheduleEntriesRange,
  useTasks,
  useWeatherLocations,
} from '@/lib/supabase-queries';
import { formatTime } from '@/utils/formatTime';
import { PageHeader } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { useQueryClient } from '@tanstack/react-query';

type TaskRequestRow = {
  id: string;
  property_id: string | null;
  employee_id: string | null;
  title: string;
  status: string | null;
  priority: string | null;
  created_at: string | null;
};

type ClockEventRow = {
  id: string;
  employee_id: string;
  property_id: string;
  event_type: string;
  timestamp: string;
};

type DashboardData = {
  taskRequests: TaskRequestRow[];
  clockEventsToday: ClockEventRow[];
  recentClockEvents: ClockEventRow[];
  openTaskRequests: number;
  activeWorkOrders: number;
};

type StatusTone = 'active' | 'pending' | 'complete' | 'hold' | 'warning';

const statusStyles: Record<StatusTone, string> = {
  active: 'border-status-active/20 bg-status-active/10 text-status-active',
  pending: 'border-status-pending/20 bg-status-pending/10 text-status-pending',
  complete: 'border-status-complete/20 bg-status-complete/10 text-status-complete',
  hold: 'border-status-hold/20 bg-status-hold/10 text-status-hold',
  warning: 'border-status-warning/20 bg-status-warning/10 text-status-warning',
};

const emptyDashboardData: DashboardData = {
  taskRequests: [],
  clockEventsToday: [],
  recentClockEvents: [],
  openTaskRequests: 0,
  activeWorkOrders: 0,
};

function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekBounds(date: Date): { start: string; end: string } {
  const start = new Date(date);
  const day = start.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + offset);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: getLocalDateKey(start), end: getLocalDateKey(end) };
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function statusTone(status: string | null | undefined): StatusTone {
  const normalized = (status ?? '').toLowerCase().replaceAll('_', '-');
  if (['complete', 'completed', 'done', 'approved'].includes(normalized)) return 'complete';
  if (['active', 'in-progress', 'clock-in', 'scheduled'].includes(normalized)) return 'active';
  if (['hold', 'paused', 'deferred'].includes(normalized)) return 'hold';
  if (['warning', 'blocked', 'urgent', 'critical', 'rejected'].includes(normalized)) return 'warning';
  return 'pending';
}

function formatStatus(status: string | null | undefined): string {
  if (!status) return 'Pending';
  return status.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const tone = statusTone(status);
  return (
    <span className={cn('rounded-full border px-2 py-0.5 text-xs font-medium', statusStyles[tone])}>
      {formatStatus(status)}
    </span>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-surface-elevated">
        <Icon className="h-6 w-6 text-text-muted" />
      </div>
      <p className="heading-md mb-1">{title}</p>
      <p className="body-base max-w-xs">{description}</p>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-surface-border border-b-2 border-b-brand-bright/20 bg-surface-card p-4 transition-all hover:border-b-brand-bright/60 hover:shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="body-muted uppercase">{label}</p>
          <p className="mt-2 text-3xl font-bold text-text-primary">{value}</p>
          <p className="mt-1 text-xs text-text-secondary">{detail}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-elevated">
          <Icon className="h-5 w-5 text-brand-bright" />
        </div>
      </div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-surface-border bg-surface-card">
      <div className="flex items-center justify-between gap-4 border-b border-surface-border px-4 py-3">
        <h2 className="heading-md">{title}</h2>
        <span className="body-muted">{subtitle}</span>
      </div>
      {children}
    </section>
  );
}

export default function CommandCenterOperationalPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentPropertyId, orgId } = useAuth();
  const [data, setData] = useState<DashboardData>(emptyDashboardData);
  const [supplementalLoading, setSupplementalLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [nwsAlert, setNwsAlert] = useState<string | null>(null);

  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => getLocalDateKey(today), [today]);
  const todayStartIso = useMemo(
    () => new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString(),
    [today],
  );
  const weekBounds = useMemo(() => getWeekBounds(today), [today]);
  const propertyScope = currentPropertyId || 'all';

  const propertiesQuery = useProperties(orgId ?? undefined);
  const employeesQuery = useEmployees(propertyScope, orgId ?? undefined);
  const assignmentsQuery = useAssignments(todayKey, propertyScope, orgId ?? undefined);
  const weeklyAssignmentsQuery = useAssignmentsRange(
    weekBounds.start,
    weekBounds.end,
    propertyScope,
    orgId ?? undefined,
  );
  const scheduleEntriesQuery = useScheduleEntries(todayKey, propertyScope, orgId ?? undefined);
  const tasksQuery = useTasks(propertyScope, orgId ?? undefined);
  const equipmentUnitsQuery = useEquipmentUnits(propertyScope, orgId ?? undefined);
  const programSettingsQuery = useProgramSettings(orgId ?? undefined);

  const properties = propertiesQuery.data ?? [];
  const employees = employeesQuery.data ?? [];
  const assignments = assignmentsQuery.data ?? [];
  const weeklyAssignments = weeklyAssignmentsQuery.data ?? [];
  const scheduleEntries = scheduleEntriesQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const equipmentUnits = equipmentUnitsQuery.data ?? [];
  const programSettings = programSettingsQuery.data ?? null;

  const dismissKey = `gcrew-onboarding-dismissed-${orgId ?? 'unknown'}`;
  const [checklistDismissed, setChecklistDismissed] = useState(() => !!localStorage.getItem(dismissKey));
  const handleDismissChecklist = () => {
    localStorage.setItem(dismissKey, '1');
    setChecklistDismissed(true);
  };

  const { data: weatherLocations = [] } = useWeatherLocations(propertyScope, orgId ?? undefined);
  const { data: allScheduleEntries = [] } = useScheduleEntriesRange('2020-01-01', '2099-12-31', undefined, orgId ?? undefined);
  const { data: allAssignments = [] } = useAssignmentsRange('2020-01-01', '2099-12-31', undefined, orgId ?? undefined);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void queryClient.invalidateQueries({ queryKey: ['assignments'] });
        void queryClient.invalidateQueries({ queryKey: ['schedule-entries'] });
        void queryClient.invalidateQueries({ queryKey: ['employees'] });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [queryClient]);

  useEffect(() => {
    if (!orgId) return;

    let cancelled = false;

    const loadDashboard = async () => {
      setSupplementalLoading(true);
      setErrorMessage(null);

      const [
        requestsResult,
        requestCountResult,
        workOrdersResult,
        clockEventsTodayResult,
        recentClockEventsResult,
      ] = await Promise.all([
        supabase
          .from('task_requests')
          .select('id, property_id, employee_id, title, status, priority, created_at')
          .eq('org_id', orgId)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('task_requests')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .eq('status', 'pending'),
        supabase
          .from('work_orders')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .eq('status', 'open'),
        supabase
          .from('clock_events')
          .select('id, employee_id, property_id, event_type, timestamp')
          .eq('org_id', orgId)
          .gte('timestamp', todayStartIso)
          .order('timestamp', { ascending: false }),
        supabase
          .from('clock_events')
          .select('id, employee_id, property_id, event_type, timestamp')
          .eq('org_id', orgId)
          .order('timestamp', { ascending: false })
          .limit(10),
      ]);

      const queryError =
        requestsResult.error ??
        requestCountResult.error ??
        workOrdersResult.error ??
        clockEventsTodayResult.error ??
        recentClockEventsResult.error;

      if (cancelled) return;

      if (queryError) {
        console.error('[CommandCenter] Dashboard load failed:', queryError);
        setErrorMessage('Operational data could not be loaded. Refresh to try again.');
        setSupplementalLoading(false);
        return;
      }

      setData({
        taskRequests: (requestsResult.data ?? []) as TaskRequestRow[],
        clockEventsToday: (clockEventsTodayResult.data ?? []) as ClockEventRow[],
        recentClockEvents: (recentClockEventsResult.data ?? []) as ClockEventRow[],
        openTaskRequests: requestCountResult.count ?? 0,
        activeWorkOrders: workOrdersResult.count ?? 0,
      });
      setSupplementalLoading(false);
    };

    void loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [orgId, todayStartIso]);

  useEffect(() => {
    if (!orgId) return;

    const latitude = programSettings?.weatherDefaultLatitude;
    const longitude = programSettings?.weatherDefaultLongitude;
    if (latitude == null || longitude == null) {
      setNwsAlert(null);
      return;
    }

    let cancelled = false;

    const loadNwsAlert = async () => {
      try {
        const response = await fetchNwsAlerts(latitude, longitude);
        if (cancelled) return;
        const alert = response.features?.[0]?.properties;
        setNwsAlert(alert?.headline ?? alert?.event ?? null);
      } catch (error) {
        if (!cancelled) {
          console.error('[CommandCenter] NWS alert load failed:', error);
          setNwsAlert(null);
        }
      }
    };

    void loadNwsAlert();
    return () => {
      cancelled = true;
    };
  }, [
    orgId,
    programSettings?.weatherDefaultLatitude,
    programSettings?.weatherDefaultLongitude,
  ]);

  const employeeById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees],
  );
  const propertyById = useMemo(
    () => new Map(properties.map((property) => [property.id, property])),
    [properties],
  );
  const taskById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks],
  );
  const shiftByEmployee = useMemo(
    () => new Map(scheduleEntries.map((entry) => [entry.employeeId, entry.shiftStart])),
    [scheduleEntries],
  );

  const todaysAssignments = assignments;

  const crewOnClock = useMemo(() => {
    const latestEventByEmployee = new Map<string, ClockEventRow>();
    data.clockEventsToday.forEach((event) => {
      if (!latestEventByEmployee.has(event.employee_id)) {
        latestEventByEmployee.set(event.employee_id, event);
      }
    });
    return [...latestEventByEmployee.values()].filter((event) => event.event_type === 'clock_in').length;
  }, [data.clockEventsToday]);

  const recentActivity = useMemo(() => {
    const taskActivity = data.taskRequests.map((request) => {
      const employee = request.employee_id ? employeeById.get(request.employee_id) : undefined;
      const property = request.property_id ? propertyById.get(request.property_id) : undefined;
      return {
        id: `request-${request.id}`,
        timestamp: request.created_at ?? '1970-01-01T00:00:00Z',
        title: request.title,
        detail: [
          employee ? `${employee.firstName} ${employee.lastName}` : null,
          property?.shortName || property?.name,
        ].filter(Boolean).join(' · '),
        status: request.status,
        type: 'Task request',
      };
    });

    const clockActivity = data.recentClockEvents.map((event) => {
      const employee = employeeById.get(event.employee_id);
      const property = propertyById.get(event.property_id);
      return {
        id: `clock-${event.id}`,
        timestamp: event.timestamp,
        title: employee ? `${employee.firstName} ${employee.lastName}` : 'Crew member',
        detail: property?.shortName || property?.name || 'Property',
        status: event.event_type,
        type: 'Clock event',
      };
    });

    return [...taskActivity, ...clockActivity]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [data.recentClockEvents, data.taskRequests, employeeById, propertyById]);

  const weeklyCategoryData = useMemo(() => {
    const grouped = new Map<string, number>();
    weeklyAssignments.forEach((assignment) => {
      const category = assignment.taskId
        ? taskById.get(assignment.taskId)?.category ?? 'General'
        : 'General';
      grouped.set(category, (grouped.get(category) ?? 0) + 1);
    });
    return [...grouped.entries()]
      .map(([category, assignments]) => ({ category, assignments }))
      .sort((a, b) => b.assignments - a.assignments);
  }, [taskById, weeklyAssignments]);

  const isLoading =
    propertiesQuery.isLoading ||
    employeesQuery.isLoading ||
    assignmentsQuery.isLoading ||
    weeklyAssignmentsQuery.isLoading ||
    scheduleEntriesQuery.isLoading ||
    tasksQuery.isLoading ||
    equipmentUnitsQuery.isLoading ||
    programSettingsQuery.isLoading ||
    supplementalLoading;

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Loading operations data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-surface-base px-4 py-5 text-text-primary sm:px-6 lg:px-8">
      <div className="mx-auto max-w-screen-2xl space-y-5">
        {nwsAlert ? (
          <div className="flex items-start gap-3 rounded-lg border border-status-pending/30 bg-status-pending/10 px-4 py-3 text-status-pending">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Active NWS alert</p>
              <p className="mt-0.5 text-sm">{nwsAlert}</p>
            </div>
          </div>
        ) : null}

        <PageHeader
          title="Command Center"
          subtitle={today.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          badge={(
            <Badge variant="outline" className="text-[10px]">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
              Live
            </Badge>
          )}
        />

        {errorMessage ? (
          <div className="rounded-lg border border-status-warning/30 bg-status-warning/10 px-4 py-3 text-sm text-status-warning">
            {errorMessage}
          </div>
        ) : null}

        {(() => {
          const checklistItems = [
            { label: 'Add your first employee', done: employees.length > 0, route: '/app/employees' },
            { label: 'Set up weather for this property', done: weatherLocations.length > 0, route: '/app/weather' },
            { label: 'Add equipment to your fleet', done: equipmentUnits.length > 0, route: '/app/equipment' },
            { label: 'Build your task library', done: tasks.length > 0, route: '/app/settings' },
            { label: 'Schedule your first shift', done: allScheduleEntries.length > 0, route: '/app/scheduler' },
            { label: 'Assign work on the workboard', done: allAssignments.length > 0, route: '/app/workboard' },
          ];
          const completedCount = checklistItems.filter((item) => item.done).length;
          const isNewOrg = employees.length < 3 && allScheduleEntries.length === 0;
          const showChecklist = isNewOrg && !checklistDismissed && completedCount < 6 && !isLoading;
          if (!showChecklist) return null;
          return (
            <section className="rounded-xl border border-brand-bright/20 bg-surface-card p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold text-text-primary">Get Ground Crew HQ ready for your team</h2>
                  <p className="mt-0.5 text-sm text-text-secondary">Complete these steps to go operational</p>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-elevated">
                      <div
                        className="h-full rounded-full bg-brand-bright transition-all duration-500"
                        style={{ width: `${(completedCount / checklistItems.length) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-text-secondary">{completedCount} of {checklistItems.length}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDismissChecklist}
                  className="rounded-md p-1 text-text-muted hover:bg-surface-elevated hover:text-text-primary"
                  aria-label="Dismiss getting started checklist"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {checklistItems.map((item) => (
                  <div
                    key={item.label}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border px-3 py-2.5',
                      item.done ? 'border-surface-border bg-surface-base opacity-50' : 'border-surface-border bg-surface-elevated',
                    )}
                  >
                    {item.done ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-bright" />
                    ) : (
                      <div className="h-4 w-4 shrink-0 rounded-full border-2 border-text-muted" />
                    )}
                    <span className={cn('min-w-0 flex-1 text-sm', item.done ? 'text-text-muted line-through' : 'text-text-primary')}>
                      {item.label}
                    </span>
                    {!item.done ? (
                      <button
                        type="button"
                        onClick={() => navigate(item.route)}
                        className="shrink-0 rounded p-1 text-text-muted hover:bg-surface-card hover:text-brand-bright"
                        aria-label={`Go to ${item.label}`}
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          );
        })()}

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={CalendarDays}
            label="Today's Assignments"
            value={isLoading ? 0 : todaysAssignments.length}
            detail="Planned for today"
          />
          <MetricCard
            icon={Clock3}
            label="Crew On-Clock"
            value={isLoading ? 0 : crewOnClock}
            detail="Latest event is clock in"
          />
          <MetricCard
            icon={ClipboardList}
            label="Open Task Requests"
            value={isLoading ? 0 : data.openTaskRequests}
            detail="Pending crew requests"
          />
          <MetricCard
            icon={Wrench}
            label="Active Work Orders"
            value={isLoading ? 0 : data.activeWorkOrders}
            detail="Open equipment work"
          />
        </section>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <Panel title="Today's Assignments" subtitle={`${todaysAssignments.length} total`}>
            {isLoading ? (
              <div className="space-y-3 p-4">
                {[0, 1, 2, 3].map((item) => (
                  <div key={item} className="h-16 animate-pulse rounded-lg bg-surface-elevated" />
                ))}
              </div>
            ) : todaysAssignments.length === 0 ? (
              <EmptyState
                icon={ClipboardCheck}
                title="No assignments today"
                description="Assignments added for today will appear here with crew, property, and start time."
              />
            ) : (
              <div className="divide-y divide-surface-border">
                {todaysAssignments.map((assignment) => {
                  const employee = employeeById.get(assignment.employeeId);
                  const property = assignment.propertyId ? propertyById.get(assignment.propertyId) : undefined;
                  const task = assignment.taskId ? taskById.get(assignment.taskId) : undefined;
                  const shiftStart = shiftByEmployee.get(assignment.employeeId) ?? assignment.startTime;
                  return (
                    <div key={assignment.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium text-text-primary">
                            {employee ? `${employee.firstName} ${employee.lastName}` : 'Unassigned crew'}
                          </p>
                          <StatusBadge status={assignment.status} />
                        </div>
                        <p className="mt-1 truncate text-sm text-text-secondary">
                          {task?.name ?? assignment.title ?? 'General assignment'}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-medium text-text-secondary">
                          {property?.shortName || property?.name || 'Property'}
                        </p>
                        <p className="mt-1 text-xs text-text-muted">
                          {formatTime(shiftStart) || 'Start not set'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel title="Recent Activity" subtitle="Latest operational events">
            {isLoading ? (
              <div className="space-y-3 p-4">
                {[0, 1, 2, 3].map((item) => (
                  <div key={item} className="h-16 animate-pulse rounded-lg bg-surface-elevated" />
                ))}
              </div>
            ) : recentActivity.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No recent activity"
                description="Task requests and crew clock events will appear here as operations begin."
              />
            ) : (
              <div className="divide-y divide-surface-border">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-hover">
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-elevated">
                      {activity.type === 'Task request' ? (
                        <ClipboardList className="h-4 w-4 text-brand-bright" />
                      ) : (
                        <Clock3 className="h-4 w-4 text-brand-bright" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-text-primary">{activity.title}</p>
                        <StatusBadge status={activity.status} />
                      </div>
                      <p className="mt-1 truncate text-xs text-text-secondary">
                        {activity.type}{activity.detail ? ` · ${activity.detail}` : ''}
                      </p>
                    </div>
                    <time className="shrink-0 text-xs text-text-muted" dateTime={activity.timestamp}>
                      {activity.timestamp.includes('T') ? formatTimestamp(activity.timestamp) : 'Recent'}
                    </time>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <Panel title="Assignments by Category" subtitle="Current week">
          {isLoading ? (
            <div className="h-80 animate-pulse bg-surface-elevated" />
          ) : weeklyCategoryData.length === 0 ? (
            <EmptyState
              icon={ChartNoAxesColumnIncreasing}
              title="No weekly assignment data"
              description="This chart will group the current week's assignments by task category."
            />
          ) : (
            <div className="h-80 w-full p-4 text-brand">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyCategoryData} margin={{ top: 12, right: 12, left: -16, bottom: 8 }}>
                  <CartesianGrid stroke="currentColor" strokeOpacity={0.12} vertical={false} />
                  <XAxis
                    dataKey="category"
                    tick={{ fill: 'currentColor', fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: 'currentColor', fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'currentColor', fillOpacity: 0.05 }}
                    contentStyle={{
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                    }}
                    content={({ active, payload, label }) =>
                      active && payload?.length ? (
                        <div className="rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-sm shadow-lg">
                          <p className="font-medium text-text-primary">{label}</p>
                          <p className="mt-1 text-text-secondary">{payload[0].value} assignments</p>
                        </div>
                      ) : null
                    }
                  />
                  <Bar dataKey="assignments" fill="currentColor" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
