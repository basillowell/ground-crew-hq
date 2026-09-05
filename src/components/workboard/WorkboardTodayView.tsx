import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, CheckCircle2, Clock3, ImageIcon, MapPin, StickyNote, Users, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PropertySelector } from '@/components/shared/PropertySelector';
import { WorkboardWeatherSafetyStrip, type WorkboardWeatherSnapshot } from '@/components/workboard/WorkboardWeatherSafetyStrip';
import { CardSkeleton } from '@/components/CardSkeleton';
import { ErrorRetry } from '@/components/ErrorRetry';
import { EmptyState } from '@/components/EmptyState';
import { useOrgProfile } from '@/hooks/useOrgProfile';
import { usePagePropertySelection } from '@/hooks/usePagePropertySelection';
import { createClient } from '@/lib/supabase';
import {
  useAssignments,
  useEmployees,
  useEquipmentUnits,
  useLocatedProjectPhotos,
  useNotes,
  useProgramSettings,
  useProperties,
  useScheduleEntries,
  useTasks,
} from '@/lib/supabase-queries';
import { withRequestTimeout } from '@/lib/requestTimeout';
import { getOperationalTimezone, storedIsoToWallClockLabel, wallClockToStoredIso } from '@/lib/timeWorkflow';
import { formatTime } from '@/utils/formatTime';
import type { Assignment, Employee, EquipmentUnit, Note, Property, ScheduleEntry, Task } from '@/data/seedData';

const supabase = createClient();

type WeatherLocationRow = {
  id: string;
  name: string | null;
  property: string | null;
  area: string | null;
  is_default: boolean | null;
  forecast_provider: string | null;
};

type WeatherDisplayPrefRow = {
  user_id: string | null;
  location_id: string | null;
};

type WeatherDailyLogRow = {
  current_conditions: string | null;
  forecast: string | null;
  rainfall_total: number | string | null;
  temperature: number | string | null;
  wind: number | string | null;
  source: string | null;
};

type ClockEventRow = {
  employee_id: string | null;
  event_type: string | null;
  timestamp: string | null;
};

type CrewClockStatus = {
  label: string;
  tone: 'active' | 'pending' | 'hold';
  timestampLabel: string | null;
};

function toDateKey(date: Date) {
  return date.toLocaleDateString('en-CA');
}

function normalizeText(value: unknown) {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : null;
}

function normalizeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeMatch(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase();
}

function statusLabel(status?: string | null) {
  const value = String(status ?? 'planned').toLowerCase();
  if (value === 'done' || value === 'complete' || value === 'completed') return 'Done';
  if (value === 'in_progress' || value === 'in-progress') return 'In progress';
  return 'Planned';
}

function statusVariant(status?: string | null): 'active' | 'pending' | 'complete' | 'hold' {
  const value = String(status ?? 'planned').toLowerCase();
  if (value === 'done' || value === 'complete' || value === 'completed') return 'complete';
  if (value === 'in_progress' || value === 'in-progress') return 'active';
  return 'pending';
}

function employeeName(employee: Employee) {
  return `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim() || 'Unnamed employee';
}

function getShiftMinutes(shift: ScheduleEntry | undefined) {
  if (!shift?.shiftStart || !shift.shiftEnd) return 0;
  const start = timeToMinutes(shift.shiftStart);
  const end = timeToMinutes(shift.shiftEnd);
  return Math.max(0, end - start);
}

function timeToMinutes(value?: string | null) {
  if (!value) return 0;
  const [hours, minutes] = value.slice(0, 5).split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}

function formatHours(hours: number) {
  return `${Math.max(0, hours).toFixed(1)}h`;
}

function formatMinutesAsHours(minutes: number) {
  return formatHours(minutes / 60);
}

function assignmentEstimatedHours(assignment: Assignment, task?: Task) {
  const record = assignment as Assignment & Record<string, unknown>;
  const explicit = Number(record.estimatedHours ?? record.estimated_hours ?? assignment.estimatedHours ?? 0);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const taskHours = Number(task?.estimatedHours ?? task?.estimated_hours ?? 0);
  if (Number.isFinite(taskHours) && taskHours > 0) return taskHours;
  const durationMinutes = Number(assignment.duration ?? 0);
  return Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes / 60 : 0;
}

function assignmentActualHours(assignment: Assignment) {
  const record = assignment as Assignment & Record<string, unknown>;
  const actual = Number(record.actualHours ?? record.actual_hours ?? assignment.actualHours ?? 0);
  return Number.isFinite(actual) ? actual : 0;
}

function equipmentLabel(equipment?: EquipmentUnit) {
  if (!equipment) return 'Equipment open';
  return equipment.unitNumber || equipment.unit_name || equipment.name || 'Equipment';
}

function noteTone(note: Note): 'pending' | 'warning' | 'complete' {
  if (note.type === 'alert') return 'warning';
  if (note.type === 'geo') return 'complete';
  return 'pending';
}

function clockToneClass(tone: CrewClockStatus['tone']) {
  if (tone === 'active') return 'bg-status-active';
  if (tone === 'pending') return 'bg-status-pending';
  return 'bg-status-hold';
}

export function WorkboardTodayView() {
  const { currentUser, orgId: authOrgId } = useOrgProfile();
  const orgId = authOrgId ?? currentUser?.orgId;
  const today = useMemo(() => toDateKey(new Date()), []);
  const { data: properties = [], isLoading: propertiesLoading, error: propertiesError, refetch: refetchProperties } = useProperties(orgId);
  const programSettingsQuery = useProgramSettings(orgId);
  const [selectedPropertyId, setSelectedPropertyId] = usePagePropertySelection({ currentUser, properties });
  const effectivePropertyId = selectedPropertyId || (currentUser?.role === 'employee' ? currentUser.propertyId : 'all');
  const scopedPropertyId = effectivePropertyId && effectivePropertyId !== 'all' ? effectivePropertyId : undefined;
  const activeProperty = useMemo(
    () => properties.find((property) => property.id === scopedPropertyId) ?? null,
    [properties, scopedPropertyId],
  );
  const operationalTimezone = useMemo(() => getOperationalTimezone(activeProperty), [activeProperty]);

  const employeesQuery = useEmployees(scopedPropertyId, orgId);
  const assignmentsQuery = useAssignments(today, scopedPropertyId, orgId);
  const scheduleQuery = useScheduleEntries(today, scopedPropertyId, orgId);
  const tasksQuery = useTasks(undefined, orgId);
  const equipmentQuery = useEquipmentUnits(scopedPropertyId, orgId);
  const notesQuery = useNotes(scopedPropertyId, orgId);
  const photosQuery = useLocatedProjectPhotos(orgId, scopedPropertyId);

  const weatherQuery = useQuery({
    queryKey: [
      'workboard-today-weather',
      orgId ?? 'all-orgs',
      today,
      scopedPropertyId ?? 'all',
      activeProperty?.name ?? 'all-properties',
      currentUser?.id ?? 'anonymous',
    ],
    enabled: Boolean(orgId),
    queryFn: async (): Promise<WorkboardWeatherSnapshot | null> => {
      if (!supabase || !orgId) return null;
      const [locationsResult, prefsResult] = await Promise.all([
        withRequestTimeout(
          supabase
            .from('weather_locations')
            .select('id, name, property, area, is_default, forecast_provider')
            .eq('org_id', orgId)
            .eq('is_active', true)
            .order('is_default', { ascending: false })
            .order('name', { ascending: true }),
          'Today weather request timed out after 15 seconds.',
        ),
        withRequestTimeout(
          supabase
            .from('weather_display_prefs')
            .select('user_id, location_id')
            .eq('org_id', orgId)
            .order('updated_at', { ascending: false }),
          'Today weather request timed out after 15 seconds.',
        ),
      ]);
      if (locationsResult.error) throw locationsResult.error;
      if (prefsResult.error) throw prefsResult.error;

      const locations = ((locationsResult.data ?? []) as WeatherLocationRow[]).filter((location) => location.id);
      if (locations.length === 0) return null;
      const propertyName = normalizeMatch(activeProperty?.name);
      const propertyLocation = propertyName
        ? locations.find(
            (location) =>
              normalizeMatch(location.property) === propertyName ||
              normalizeMatch(location.name) === propertyName,
          )
        : null;
      const prefs = (prefsResult.data ?? []) as WeatherDisplayPrefRow[];
      const preferredLocationId =
        prefs.find((pref) => pref.user_id === currentUser?.id && pref.location_id)?.location_id ??
        prefs.find((pref) => !pref.user_id && pref.location_id)?.location_id ??
        prefs.find((pref) => pref.location_id)?.location_id ??
        null;
      const preferredLocation = preferredLocationId
        ? locations.find((location) => location.id === preferredLocationId)
        : null;
      const selectedLocation = propertyLocation ?? preferredLocation ?? locations.find((location) => location.is_default) ?? locations[0];
      if (!selectedLocation?.id) return null;

      const { data, error } = await withRequestTimeout(
        supabase
          .from('weather_daily_logs')
          .select('current_conditions, forecast, rainfall_total, temperature, wind, source')
          .eq('org_id', orgId)
          .eq('location_id', selectedLocation.id)
          .eq('date', today)
          .limit(1),
        'Today weather request timed out after 15 seconds.',
      );
      if (error) throw error;
      const log = ((data ?? []) as WeatherDailyLogRow[])[0] ?? null;
      return {
        locationName: normalizeText(selectedLocation.name) ?? normalizeText(selectedLocation.property) ?? 'Weather location',
        propertyName: normalizeText(selectedLocation.property),
        area: normalizeText(selectedLocation.area),
        currentConditions: normalizeText(log?.current_conditions),
        forecast: normalizeText(log?.forecast),
        temperatureF: normalizeNumber(log?.temperature),
        windMph: normalizeNumber(log?.wind),
        rainfallIn: normalizeNumber(log?.rainfall_total),
        source: normalizeText(log?.source) ?? normalizeText(selectedLocation.forecast_provider),
      };
    },
    staleTime: 1000 * 60 * 10,
  });

  const clockStatusQuery = useQuery({
    queryKey: ['workboard-today-clock-status', orgId ?? 'all-orgs', today, operationalTimezone],
    enabled: Boolean(orgId),
    queryFn: async () => {
      if (!supabase || !orgId) return [] as ClockEventRow[];
      const startIso = wallClockToStoredIso(today, '00:00', operationalTimezone);
      const endIso = wallClockToStoredIso(toDateKey(new Date(new Date(`${today}T00:00:00`).getTime() + 86_400_000)), '00:00', operationalTimezone);
      if (!startIso || !endIso) return [] as ClockEventRow[];
      const { data, error } = await withRequestTimeout(
        supabase
          .from('clock_events')
          .select('employee_id, event_type, timestamp')
          .eq('org_id', orgId)
          .in('event_type', ['clock_in', 'clock_out', 'in', 'out', 'break'])
          .gte('timestamp', startIso)
          .lt('timestamp', endIso)
          .order('timestamp', { ascending: false }),
        'Today clock status request timed out after 15 seconds.',
      );
      if (error) throw error;
      return (data ?? []) as ClockEventRow[];
    },
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 30,
  });

  const employees = employeesQuery.data ?? [];
  const assignments = assignmentsQuery.data ?? [];
  const scheduleEntries = scheduleQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const equipmentUnits = equipmentQuery.data ?? [];
  const notes = notesQuery.data ?? [];
  const photos = photosQuery.data ?? [];
  const programSettings = programSettingsQuery.data;
  const brandLabel = (programSettings?.clientLabel || programSettings?.appName || 'Ground Crew HQ').trim() || 'Ground Crew HQ';
  const brandInitials = brandLabel
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'GC';
  const todayLabel = useMemo(
    () => new Date(`${today}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
    [today],
  );

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const equipmentById = useMemo(() => new Map(equipmentUnits.map((unit) => [unit.id, unit])), [equipmentUnits]);
  const scheduleByEmployee = useMemo(() => {
    const map = new Map<string, ScheduleEntry>();
    for (const entry of scheduleEntries) {
      if (entry.status === 'scheduled') map.set(entry.employeeId, entry);
    }
    return map;
  }, [scheduleEntries]);
  const assignmentsByEmployee = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    for (const assignment of assignments) {
      const current = map.get(assignment.employeeId) ?? [];
      current.push(assignment);
      map.set(assignment.employeeId, current);
    }
    for (const rows of map.values()) {
      rows.sort((a, b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99'));
    }
    return map;
  }, [assignments]);
  const clockStatusByEmployee = useMemo(() => {
    const map = new Map<string, CrewClockStatus>();
    for (const event of clockStatusQuery.data ?? []) {
      if (!event.employee_id || !event.timestamp || map.has(event.employee_id)) continue;
      const eventType = String(event.event_type ?? '').toLowerCase();
      const timestampLabel = storedIsoToWallClockLabel(event.timestamp, operationalTimezone);
      if (eventType === 'clock_in' || eventType === 'in') {
        map.set(event.employee_id, { label: 'Clocked in', tone: 'active', timestampLabel });
      } else if (eventType === 'break') {
        map.set(event.employee_id, { label: 'On break', tone: 'pending', timestampLabel });
      } else {
        map.set(event.employee_id, { label: 'Clocked out', tone: 'hold', timestampLabel });
      }
    }
    return map;
  }, [clockStatusQuery.data, operationalTimezone]);
  const scheduledEmployees = useMemo(() => {
    const scheduledIds = new Set(scheduleEntries.filter((entry) => entry.status === 'scheduled').map((entry) => entry.employeeId));
    return employees
      .filter((employee) => employee.status === 'active' && (scheduledIds.has(employee.id) || assignmentsByEmployee.has(employee.id)))
      .sort((a, b) => {
        const aShift = scheduleByEmployee.get(a.id)?.shiftStart ?? '99:99';
        const bShift = scheduleByEmployee.get(b.id)?.shiftStart ?? '99:99';
        return aShift.localeCompare(bShift) || employeeName(a).localeCompare(employeeName(b));
      });
  }, [assignmentsByEmployee, employees, scheduleByEmployee, scheduleEntries]);
  const activeNotes = useMemo(
    () =>
      notes
        .filter((note) => note.type === 'daily' || note.type === 'alert' || (note.type === 'geo' && note.showOnDisplayBoard === true))
        .slice(0, 6),
    [notes],
  );
  const heroPhoto = photos[0] ?? null;
  const totalEstimatedHours = assignments.reduce((sum, assignment) => sum + assignmentEstimatedHours(assignment, taskById.get(assignment.taskId)), 0);
  const totalActualHours = assignments.reduce((sum, assignment) => sum + assignmentActualHours(assignment), 0);
  const totalShiftMinutes = scheduleEntries.reduce((sum, entry) => sum + getShiftMinutes(entry), 0);
  const boardError =
    (propertiesError as { message?: string } | null)?.message ||
    (employeesQuery.error as { message?: string } | null)?.message ||
    (assignmentsQuery.error as { message?: string } | null)?.message ||
    (scheduleQuery.error as { message?: string } | null)?.message ||
    (tasksQuery.error as { message?: string } | null)?.message ||
    (equipmentQuery.error as { message?: string } | null)?.message ||
    (notesQuery.error as { message?: string } | null)?.message ||
    (photosQuery.error as { message?: string } | null)?.message ||
    '';
  const isLoading =
    propertiesLoading ||
    employeesQuery.isLoading ||
    assignmentsQuery.isLoading ||
    scheduleQuery.isLoading ||
    tasksQuery.isLoading ||
    equipmentQuery.isLoading ||
    notesQuery.isLoading ||
    photosQuery.isLoading;

  if (isLoading) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (boardError) {
    return (
      <div className="p-4 md:p-6">
        <ErrorRetry
          message={boardError}
          onRetry={() => {
            void refetchProperties();
            void employeesQuery.refetch();
            void assignmentsQuery.refetch();
            void scheduleQuery.refetch();
            void tasksQuery.refetch();
            void equipmentQuery.refetch();
            void notesQuery.refetch();
            void photosQuery.refetch();
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-surface-base">
      <div className="border-b border-surface-border bg-surface-card px-3 py-3 md:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-surface-border bg-brand/10 text-sm font-bold text-brand">
              {programSettings?.logoUrl ? (
                <img src={programSettings.logoUrl} alt={`${brandLabel} logo`} className="h-full w-full object-contain p-1" />
              ) : (
                <span>{brandInitials}</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-3xs font-semibold uppercase tracking-wide text-text-muted">{brandLabel}</p>
              <h2 className="truncate text-lg font-semibold text-text-primary">Today</h2>
              <p className="text-xs text-text-secondary">{todayLabel}</p>
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
            <PropertySelector
              className="w-full sm:w-64"
              orgId={orgId}
              value={selectedPropertyId}
              onChange={setSelectedPropertyId}
            />
            <Badge variant="secondary" className="justify-center border-surface-border bg-surface-elevated text-text-secondary">
              Morning meeting
            </Badge>
          </div>
        </div>
      </div>

      <WorkboardWeatherSafetyStrip
        weather={weatherQuery.data ?? null}
        isWeatherLoading={weatherQuery.isLoading}
        weatherErrorMessage={(weatherQuery.error as { message?: string } | null)?.message ?? null}
        propertyLabel={activeProperty?.name ?? 'All Properties'}
      />

      <div className="min-h-0 flex-1 overflow-auto p-4 md:p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <main className="min-w-0 space-y-4">
            <div className="grid gap-2 sm:grid-cols-4">
              <Card className="border-surface-border bg-surface-card p-3">
                <p className="text-3xs font-semibold uppercase tracking-wide text-text-muted">Crew</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-text-primary">{scheduledEmployees.length}</p>
              </Card>
              <Card className="border-surface-border bg-surface-card p-3">
                <p className="text-3xs font-semibold uppercase tracking-wide text-text-muted">Tasks</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-status-pending">{assignments.length}</p>
              </Card>
              <Card className="border-surface-border bg-surface-card p-3">
                <p className="text-3xs font-semibold uppercase tracking-wide text-text-muted">Planned</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-text-primary">{formatHours(totalEstimatedHours)}</p>
              </Card>
              <Card className="border-surface-border bg-surface-card p-3">
                <p className="text-3xs font-semibold uppercase tracking-wide text-text-muted">Logged</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-status-active">{formatHours(totalActualHours)}</p>
              </Card>
            </div>

            {scheduledEmployees.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No crew scheduled today"
                description="Add shifts in Workboard Week mode to make the morning board useful."
              />
            ) : (
              <div className="space-y-2">
                <div className="rounded-xl border border-surface-border bg-surface-card/70 px-3 py-2 text-2xs font-medium uppercase tracking-wide text-text-muted">
                  <div className="grid grid-cols-[minmax(0,1fr)_90px_90px] items-center gap-3">
                    <span>Crew and work</span>
                    <span className="text-right">Shift</span>
                    <span className="text-right">Load</span>
                  </div>
                </div>
                {scheduledEmployees.map((employee) => {
                  const shift = scheduleByEmployee.get(employee.id);
                  const employeeAssignments = assignmentsByEmployee.get(employee.id) ?? [];
                  const assignedHours = employeeAssignments.reduce(
                    (sum, assignment) => sum + assignmentEstimatedHours(assignment, taskById.get(assignment.taskId)),
                    0,
                  );
                  const shiftMinutes = getShiftMinutes(shift);
                  const clockStatus = clockStatusByEmployee.get(employee.id) ?? { label: 'No punch', tone: 'hold' as const, timestampLabel: null };
                  const initials = `${employee.firstName?.[0] ?? ''}${employee.lastName?.[0] ?? ''}`.toUpperCase() || 'GC';
                  return (
                    <Card key={employee.id} className="border-surface-border bg-surface-card p-3">
                      <div className="grid gap-3 lg:grid-cols-[minmax(180px,240px)_minmax(0,1fr)_90px_96px] lg:items-start">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className={`h-2.5 w-2.5 rounded-full ${clockToneClass(clockStatus.tone)}`} aria-hidden="true" />
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                            {initials}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-text-primary">{employeeName(employee)}</p>
                            <p className="truncate text-2xs text-text-muted">
                              {clockStatus.label}{clockStatus.timestampLabel ? ` · ${clockStatus.timestampLabel}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="min-w-0">
                          {employeeAssignments.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-surface-border bg-surface-elevated px-3 py-2 text-xs text-text-muted">
                              No tasks assigned.
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {employeeAssignments.map((assignment) => {
                                const task = taskById.get(assignment.taskId);
                                const equipment = assignment.equipmentId ? equipmentById.get(assignment.equipmentId) : undefined;
                                const estimated = assignmentEstimatedHours(assignment, task);
                                const actual = assignmentActualHours(assignment);
                                return (
                                  <div
                                    key={assignment.id ?? `${employee.id}-${assignment.taskId}-${assignment.startTime}`}
                                    className="min-w-[180px] max-w-full rounded-lg border border-surface-border bg-surface-elevated px-3 py-2"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="min-w-0 truncate text-xs font-semibold text-text-primary">
                                        {assignment.title || task?.name || 'Task'}
                                      </p>
                                      <Badge variant={statusVariant(assignment.status)} className="shrink-0 text-4xs">
                                        {statusLabel(assignment.status)}
                                      </Badge>
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-2xs text-text-muted">
                                      <span>{assignment.startTime ? formatTime(assignment.startTime) : 'No start'}</span>
                                      <span>Est {formatHours(estimated)}</span>
                                      {actual > 0 ? <span className="text-status-active">Actual {formatHours(actual)}</span> : null}
                                      <span className="inline-flex items-center gap-1">
                                        <Wrench className="h-3 w-3" />
                                        {equipmentLabel(equipment)}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div className="text-right text-xs text-text-secondary">
                          {shift ? `${formatTime(shift.shiftStart)}-${formatTime(shift.shiftEnd)}` : 'No shift'}
                        </div>
                        <div className="rounded-lg border border-surface-border bg-surface-elevated px-2 py-1 text-right">
                          <p className="text-4xs font-semibold uppercase tracking-wide text-text-muted">Load</p>
                          <p className="font-mono text-xs font-semibold text-text-primary">
                            {formatHours(assignedHours)}{shiftMinutes > 0 ? ` / ${formatMinutesAsHours(shiftMinutes)}` : ''}
                          </p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </main>

          <aside className="space-y-4">
            <Card className="overflow-hidden border-surface-border bg-surface-card">
              {heroPhoto?.signedUrl ? (
                <div className="relative aspect-[4/3] bg-surface-elevated">
                  <img
                    src={heroPhoto.signedUrl}
                    alt={heroPhoto.caption || 'Property progress'}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-surface-base/80 p-3">
                    <p className="truncate text-xs font-semibold text-text-primary">{heroPhoto.caption || 'Property progress'}</p>
                    <p className="text-3xs text-text-muted">{new Date(heroPhoto.createdAt).toLocaleDateString('en-US')}</p>
                  </div>
                </div>
              ) : (
                <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 bg-surface-elevated p-6 text-center">
                  <ImageIcon className="h-8 w-8 text-text-muted" />
                  <p className="text-sm font-medium text-text-primary">No property image yet</p>
                  <p className="text-xs text-text-muted">Placed progress photos will appear here for the morning meeting.</p>
                </div>
              )}
            </Card>

            <Card className="border-surface-border bg-surface-card p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <StickyNote className="h-4 w-4 text-brand" />
                  <h3 className="text-sm font-semibold text-text-primary">Active notes</h3>
                </div>
                <Badge variant="secondary" className="text-3xs">{activeNotes.length}</Badge>
              </div>
              {activeNotes.length === 0 ? (
                <div className="rounded-lg border border-dashed border-surface-border bg-surface-elevated p-4 text-center text-xs text-text-muted">
                  No daily, alert, or geo notes for this view.
                </div>
              ) : (
                <div className="space-y-2">
                  {activeNotes.map((note) => (
                    <div key={note.id} className="rounded-lg border border-surface-border bg-surface-elevated p-3">
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <p className="min-w-0 truncate text-xs font-semibold text-text-primary">{note.title}</p>
                        <div className="flex shrink-0 items-center gap-1">
                          {note.type === 'geo' && note.showOnDisplayBoard ? (
                            <Badge variant="pending" className="text-4xs">Board</Badge>
                          ) : null}
                          <Badge variant={noteTone(note)} className="text-4xs capitalize">
                            {note.type}
                          </Badge>
                        </div>
                      </div>
                      <p className="line-clamp-3 text-xs text-text-secondary">{note.content}</p>
                      {note.location ? <p className="mt-2 text-3xs text-text-muted">{note.location}</p> : null}
                      {note.type === 'geo' && note.locationGeojson ? (
                        <p className="mt-2 flex items-center gap-1 text-3xs text-status-pending">
                          <MapPin className="h-3 w-3" />
                          Map note
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="border-surface-border bg-surface-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-3xs font-semibold uppercase tracking-wide text-text-muted">Today at a glance</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    {formatMinutesAsHours(totalShiftMinutes)} scheduled across {scheduleEntries.length} shift{scheduleEntries.length === 1 ? '' : 's'}.
                  </p>
                </div>
                <CheckCircle2 className="h-5 w-5 text-status-active" />
              </div>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}
