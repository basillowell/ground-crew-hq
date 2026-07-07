import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase';
import type {
  Assignment,
  ClockEvent,
  Employee,
  EquipmentUnit,
  Note,
  ProgramSettings,
  Property,
  ScheduleEntry,
  Task,
} from '@/data/seedData';
import type {
  Employee as StoreEmployee,
  ProgramSettings as StoreProgramSettings,
  Property as StoreProperty,
} from '@/store/appStore';

const supabase = createClient();

type UseDashboardDataParams = {
  orgId?: string;
  propertyScope?: string;
  todayKey: string;
  start30Date: string;
  employees: StoreEmployee[];
  properties: StoreProperty[];
  programSettings: StoreProgramSettings | null;
};

type DashboardData = {
  properties: Property[];
  programSettings: ProgramSettings | null;
  employees: Employee[];
  assignments: Assignment[];
  scheduleEntries: ScheduleEntry[];
  scheduleEntriesLast30: ScheduleEntry[];
  equipmentUnits: EquipmentUnit[];
  tasks: Task[];
  notes: Note[];
  clockEvents: ClockEvent[];
};

function normalizeProperty(row: any): Property {
  return {
    id: String(row.id),
    orgId: row.org_id ?? '',
    name: String(row.name ?? ''),
    shortName: String(row.short_name ?? row.name ?? ''),
    logoInitials: String(row.logo_initials ?? 'HQ'),
    color: String(row.color ?? '#2FA866'),
    city: String(row.city ?? ''),
    state: String(row.state ?? ''),
    latitude: typeof row.latitude === 'number' ? row.latitude : row.latitude ? Number(row.latitude) : undefined,
    longitude: typeof row.longitude === 'number' ? row.longitude : row.longitude ? Number(row.longitude) : undefined,
    acreage: Number(row.acreage ?? 0),
    status: String(row.status ?? 'active') as Property['status'],
  };
}

function normalizeEmployee(row: any): Employee {
  return {
    id: String(row.id),
    orgId: row.org_id ?? '',
    propertyId: row.property_id ?? '',
    firstName: String(row.first_name ?? ''),
    lastName: String(row.last_name ?? ''),
    role: String(row.role ?? ''),
    department: String(row.department ?? ''),
    status: String(row.status ?? 'active') as Employee['status'],
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    hourlyRate: typeof row.hourly_rate === 'number' ? row.hourly_rate : row.hourly_rate ? Number(row.hourly_rate) : undefined,
  };
}

function normalizeAssignment(row: any): Assignment {
  return {
    id: String(row.id),
    employeeId: String(row.employee_id ?? row.employeeId ?? ''),
    propertyId: String(row.property_id ?? row.propertyId ?? ''),
    taskId: row.task_id ?? row.taskId ?? undefined,
    date: String(row.date ?? ''),
    location: row.location ?? undefined,
    area: row.area ?? undefined,
    startTime: row.start_time ?? row.startTime ?? undefined,
    duration: typeof row.duration === 'number' ? row.duration : undefined,
    equipmentId: row.equipment_id ?? row.equipmentId ?? undefined,
    status: String(row.status ?? 'planned') as Assignment['status'],
  };
}

function normalizeScheduleEntry(row: any): ScheduleEntry {
  return {
    id: String(row.id),
    employeeId: String(row.employee_id ?? ''),
    propertyId: String(row.property_id ?? ''),
    date: String(row.date ?? ''),
    shiftStart: String(row.shift_start ?? ''),
    shiftEnd: String(row.shift_end ?? ''),
    status: String(row.status ?? 'scheduled') as ScheduleEntry['status'],
  };
}

function normalizeEquipmentUnit(row: any): EquipmentUnit {
  return {
    id: String(row.id),
    propertyId: String(row.property_id ?? ''),
    name: String(row.name ?? row.unit_name ?? ''),
    type: String(row.type ?? ''),
    status: String(row.status ?? 'active') as EquipmentUnit['status'],
    location: row.location ?? undefined,
    lastServiced: row.last_serviced ?? undefined,
  };
}

function normalizeTask(row: any): Task {
  return {
    id: String(row.id),
    propertyId: String(row.property_id ?? ''),
    name: String(row.name ?? ''),
    description: row.description ?? undefined,
    category: String(row.category ?? 'General'),
    status: String(row.status ?? 'active') as Task['status'],
    priority: Number(row.priority ?? 1),
    duration: row.duration ?? undefined,
    color: row.color ?? undefined,
    icon: row.icon ?? undefined,
    skillTags: row.skillTags ?? undefined,
    equipmentTags: row.equipmentTags ?? undefined,
    notes: row.notes ?? undefined,
  };
}


function normalizeNote(row: any): Note {
  return {
    id: String(row.id),
    propertyId: String(row.property_id ?? row.propertyId ?? ''),
    type: String(row.type ?? 'general') as Note['type'],
    title: String(row.title ?? ''),
    content: String(row.content ?? ''),
    location: row.location ?? undefined,
    createdBy: row.created_by ?? undefined,
    author: row.author ?? undefined,
    date: row.date ?? undefined,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

function normalizeClockEvent(row: any): ClockEvent {
  return {
    id: String(row.id),
    employeeId: String(row.employee_id ?? ''),
    propertyId: String(row.property_id ?? ''),
    eventType: String(row.event_type ?? 'in') as ClockEvent['eventType'],
    timestamp: String(row.timestamp ?? ''),
    locationLat: typeof row.location_lat === 'number' ? row.location_lat : undefined,
    locationLng: typeof row.location_lng === 'number' ? row.location_lng : undefined,
  };
}

function normalizeProgramSettings(row: any): ProgramSettings {
  return {
    id: String(row.id),
    appName: String(row.app_name ?? 'Ground Crew HQ'),
    clientLabel: String(row.client_label ?? ''),
    primaryColor: String(row.primary_color ?? '#2FA866'),
    accentColor: String(row.accent_color ?? '#16a34a'),
    sidebarColor: String(row.sidebar_color ?? '#0f172a'),
    fontThemePreset: String(row.font_theme_preset ?? 'modern'),
    logoUrl: row.logo_url ?? undefined,
    defaultDepartment: String(row.default_department ?? 'Operations'),
  };
}

export function useDashboardData(params: UseDashboardDataParams) {
  const {
    orgId,
    propertyScope,
    todayKey,
    start30Date,
    employees,
    properties,
    programSettings,
  } = params;

  return useQuery<DashboardData>({
    queryKey: [
      'dashboard-data',
      orgId ?? 'no-org',
      propertyScope ?? 'all',
      todayKey,
      start30Date,
      employees.length,
      properties.length,
      programSettings?.id ?? 'no-settings',
    ],
    enabled: Boolean(orgId),
    staleTime: 1000 * 60 * 3,
    queryFn: async () => {
      const scopedPropertyId = propertyScope && propertyScope !== 'all' ? propertyScope : undefined;

      const withOrg = <T,>(query: any) => (orgId ? query.eq('org_id', orgId) : query) as T;
      const withProperty = <T,>(query: any) => (scopedPropertyId ? query.eq('property_id', scopedPropertyId) : query) as T;

      const [
        assignmentsResult,
        scheduleTodayResult,
        scheduleRangeResult,
        equipmentResult,
        tasksResult,
        notesResult,
        clockEventsResult,
      ] = await Promise.all([
        withProperty<any>(withOrg<any>(supabase.from('assignments').select('*').eq('date', todayKey).order('created_at'))),
        withProperty<any>(withOrg<any>(supabase.from('schedule_entries').select('*').eq('date', todayKey).order('shift_start'))),
        withProperty<any>(
          withOrg<any>(
            supabase.from('schedule_entries').select('*').gte('date', start30Date).lte('date', todayKey).order('date').order('shift_start'),
          ),
        ),
        withProperty<any>(withOrg<any>(supabase.from('equipment_units').select('*').order('name'))),
        withProperty<any>(withOrg<any>(supabase.from('tasks').select('*').order('name'))),
        withProperty<any>(withOrg<any>(supabase.from('notes').select('*').order('created_at', { ascending: false }))),
        withProperty<any>(withOrg<any>(supabase.from('clock_events').select('*').order('timestamp', { ascending: false }))),
      ]);

      const firstError =
        assignmentsResult.error ||
        scheduleTodayResult.error ||
        scheduleRangeResult.error ||
        equipmentResult.error ||
        tasksResult.error ||
        notesResult.error ||
        clockEventsResult.error;

      if (firstError) throw firstError;

      const scopedEmployees = scopedPropertyId
        ? employees.filter((employee) => employee.property_id === scopedPropertyId)
        : employees;

      return {
        properties: properties.map(normalizeProperty),
        programSettings: programSettings ? normalizeProgramSettings(programSettings) : null,
        employees: scopedEmployees.map(normalizeEmployee),
        assignments: (assignmentsResult.data ?? []).map(normalizeAssignment),
        scheduleEntries: (scheduleTodayResult.data ?? []).map(normalizeScheduleEntry),
        scheduleEntriesLast30: (scheduleRangeResult.data ?? []).map(normalizeScheduleEntry),
        equipmentUnits: (equipmentResult.data ?? []).map(normalizeEquipmentUnit),
        tasks: (tasksResult.data ?? []).map(normalizeTask),
        notes: (notesResult.data ?? []).map(normalizeNote),
        clockEvents: (clockEventsResult.data ?? []).map(normalizeClockEvent),
      };
    },
  });
}


