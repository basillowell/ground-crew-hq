import { useQuery } from '@tanstack/react-query';
import type {
  AppUser,
  Assignment,
  Employee,
  EquipmentUnit,
  Note,
  ProgramSettings,
  Property,
  ScheduleEntry,
  Task,
} from '@/data/seedData';
import { supabase } from '@/lib/supabase';

type DbProperty = {
  id: string;
  org_id?: string | null;
  name: string;
  short_name: string;
  logo_initials: string;
  color: string;
  city: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  acreage: number;
  status: string;
  created_at: string;
};

type DbEmployee = {
  id: string;
  org_id?: string | null;
  property_id: string;
  first_name: string;
  last_name: string;
  role: string;
  department: string;
  status: string;
  phone: string | null;
  email: string | null;
  created_at: string;
};

type DbAppUser = {
  id: string;
  org_id?: string | null;
  employee_id: string;
  role: 'admin' | 'manager' | 'employee';
  department: string | null;
  status: string;
  created_at: string;
  employees?: DbEmployee | null;
};

type DbScheduleEntry = {
  id: string;
  org_id?: string | null;
  employee_id: string;
  property_id: string;
  date: string;
  shift_start: string;
  shift_end: string;
  status: string;
  created_at: string;
};

type DbAssignment = {
  id: string;
  org_id?: string | null;
  employee_id: string;
  employeeId?: string;
  property_id: string;
  propertyId?: string;
  task_id: string | null;
  taskId?: string | null;
  date: string;
  location: string | null;
  area?: string | null;
  start_time?: string | null;
  startTime?: string | null;
  duration?: number | null;
  equipment_id?: string | null;
  equipmentId?: string | null;
  status: string;
  created_at: string;
};

type DbTask = {
  id: string;
  org_id?: string | null;
  property_id: string;
  name: string;
  description: string | null;
  category: string;
  status: string;
  priority: number;
  duration?: number | null;
  color?: string | null;
  icon?: string | null;
  skillTags?: string[] | null;
  equipmentTags?: string[] | null;
  notes?: string | null;
  created_at: string;
};

type DbEquipmentUnit = {
  id: string;
  org_id?: string | null;
  property_id: string;
  name: string;
  type: string;
  status: string;
  location: string | null;
  last_serviced: string | null;
  created_at: string;
};

type DbNote = {
  id: string;
  org_id?: string | null;
  property_id: string;
  propertyId?: string;
  type: string;
  title: string;
  content: string;
  location: string | null;
  created_by: string | null;
  author?: string | null;
  date?: string | null;
  created_at: string;
};

type DbProgramSettings = {
  id: string;
  org_id?: string | null;
  app_name: string;
  client_label: string;
  primary_color: string;
  accent_color: string;
  sidebar_color: string;
  font_theme_preset: string;
  logo_url: string | null;
  default_department: string;
  created_at: string;
};

type DbClockEvent = {
  id: string;
  org_id?: string | null;
  employee_id: string;
  property_id: string;
  event_type: 'in' | 'out' | 'break';
  timestamp: string;
  location_lat: number | null;
  location_lng: number | null;
};

type DbWeatherStation = {
  id: string;
  location_id?: string | null;
  name: string;
  provider: string;
  status: string;
  is_primary?: boolean | null;
};

type WeatherStationSummary = {
  id: string;
  name: string;
  provider: string;
  status: string;
  isPrimary: boolean;
};

export type ClockEvent = {
  id: string;
  employeeId: string;
  propertyId: string;
  eventType: 'in' | 'out' | 'break';
  timestamp: string;
  locationLat?: number;
  locationLng?: number;
};

function ensureSupabase() {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }
  return supabase;
}

function toProperty(row: DbProperty): Property {
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    type: 'Property',
    address: '',
    city: row.city,
    state: row.state,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    acreage: Number(row.acreage ?? 0),
    logoInitials: row.logo_initials,
    color: row.color,
    status: row.status as Property['status'],
  };
}

function toEmployee(row: DbEmployee): Employee {
  return {
    id: row.id,
    propertyId: row.property_id,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role,
    department: row.department,
    status: (row.status as Employee['status']) ?? 'active',
    phone: row.phone ?? '',
    email: row.email ?? '',
    group: row.department || 'General',
    wage: 0,
    photo: '',
    language: 'English',
    workerType: 'full-time',
    hireDate: row.created_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
  };
}

function toAppUser(row: DbAppUser, clientLabel: string): AppUser {
  const employee = row.employees;
  const firstName = employee?.first_name ?? 'WorkForce';
  const lastName = employee?.last_name ?? 'User';
  const fullName = `${firstName} ${lastName}`.trim();
  const role = row.role === 'employee' ? 'crew' : row.role;
  return {
    id: row.id,
    fullName,
    email: employee?.email ?? '',
    role: role as AppUser['role'],
    title: employee?.role ?? role,
    department: row.department ?? employee?.department ?? 'Maintenance',
    clubId: employee?.property_id ?? 'default-property',
    clubLabel: clientLabel,
    avatarInitials: `${firstName[0] ?? 'W'}${lastName[0] ?? 'F'}`.toUpperCase(),
    status: (row.status as AppUser['status']) ?? 'active',
  };
}

function toScheduleEntry(row: DbScheduleEntry): ScheduleEntry {
  return {
    id: row.id,
    employeeId: row.employee_id,
    date: row.date,
    shiftStart: row.shift_start.slice(0, 5),
    shiftEnd: row.shift_end.slice(0, 5),
    status: (row.status as ScheduleEntry['status']) ?? 'scheduled',
  };
}

function toAssignment(row: DbAssignment): Assignment {
  return {
    id: row.id,
    employeeId: row.employeeId ?? row.employee_id,
    taskId: row.taskId ?? row.task_id ?? '',
    date: row.date,
    startTime: String(row.startTime ?? row.start_time ?? '06:00').slice(0, 5),
    duration: Number(row.duration ?? 60),
    area: row.area ?? row.location ?? 'Unassigned area',
    equipmentId: row.equipmentId ?? row.equipment_id ?? undefined,
    status: (row.status as Assignment['status']) ?? 'planned',
  };
}

function toTask(row: DbTask): Task {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    duration: Number(row.duration ?? 60),
    color: row.color ?? 'hsl(var(--primary))',
    icon: row.icon ?? 'list-checks',
    status: row.status as Task['status'],
    priority: row.priority,
    skillTags: row.skillTags ?? [],
    equipmentTags: row.equipmentTags ?? [],
    notes: row.notes ?? row.description ?? '',
  };
}

function toEquipmentUnit(row: DbEquipmentUnit): EquipmentUnit {
  return {
    id: row.id,
    typeId: row.type,
    unitNumber: row.name,
    status: row.status as EquipmentUnit['status'],
    location: row.location ?? '',
    hours: 0,
    lastService: row.last_serviced ?? '',
    nextService: row.last_serviced ?? '',
    propertyId: row.property_id,
  } as EquipmentUnit;
}

function toNote(row: DbNote): Note {
  return {
    id: row.id,
    type: row.type as Note['type'],
    title: row.title,
    content: row.content,
    author: row.author ?? row.created_by ?? 'System',
    date: row.date ?? row.created_at.slice(0, 10),
    location: row.location ?? undefined,
  };
}

function toProgramSettings(row: DbProgramSettings): ProgramSettings {
  return {
    id: row.id,
    organizationName: row.client_label || row.app_name,
    appName: row.app_name,
    navigationTitle: row.app_name,
    navigationSubtitle: row.client_label || 'Operations',
    clientLabel: row.client_label,
    logoInitials: (row.client_label || row.app_name).slice(0, 2).toUpperCase(),
    logoUrl: row.logo_url ?? undefined,
    primaryColor: row.primary_color,
    accentColor: row.accent_color,
    sidebarColor: row.sidebar_color,
    fontThemePreset: row.font_theme_preset,
    defaultDepartment: row.default_department,
    timeZone: 'America/New_York',
    fiscalYearStart: '01-01',
    enableMobileApp: true,
  };
}

function toClockEvent(row: DbClockEvent): ClockEvent {
  return {
    id: row.id,
    employeeId: row.employee_id,
    propertyId: row.property_id,
    eventType: row.event_type,
    timestamp: row.timestamp,
    locationLat: row.location_lat ?? undefined,
    locationLng: row.location_lng ?? undefined,
  };
}

async function fetchProperties(orgId?: string): Promise<Property[]> {
  const client = ensureSupabase();
  let query = client.from('properties').select('*').order('name');
  if (orgId) query = query.eq('org_id', orgId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as DbProperty[]).map(toProperty);
}

async function fetchEmployees(propertyId?: string, orgId?: string): Promise<Employee[]> {
  const client = ensureSupabase();
  const scopedPropertyId = propertyId && propertyId !== 'all' ? propertyId : undefined;
  let query = client.from('employees').select('*').order('last_name').order('first_name');
  if (orgId) query = query.eq('org_id', orgId);
  if (scopedPropertyId) query = query.eq('property_id', scopedPropertyId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as DbEmployee[]).map(toEmployee);
}

async function fetchScheduleEntries(date: string, propertyId?: string, orgId?: string): Promise<ScheduleEntry[]> {
  const client = ensureSupabase();
  const scopedPropertyId = propertyId && propertyId !== 'all' ? propertyId : undefined;
  let query = client.from('schedule_entries').select('*').eq('date', date).order('shift_start');
  if (orgId) query = query.eq('org_id', orgId);
  if (scopedPropertyId) query = query.eq('property_id', scopedPropertyId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as DbScheduleEntry[]).map(toScheduleEntry);
}

async function fetchScheduleEntriesRange(startDate: string, endDate: string, propertyId?: string, orgId?: string): Promise<ScheduleEntry[]> {
  const client = ensureSupabase();
  const scopedPropertyId = propertyId && propertyId !== 'all' ? propertyId : undefined;
  let query = client
    .from('schedule_entries')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date')
    .order('shift_start');
  if (orgId) query = query.eq('org_id', orgId);
  if (scopedPropertyId) query = query.eq('property_id', scopedPropertyId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as DbScheduleEntry[]).map(toScheduleEntry);
}

async function fetchAssignments(date: string, propertyId?: string, orgId?: string): Promise<Assignment[]> {
  const client = ensureSupabase();
  const scopedPropertyId = propertyId && propertyId !== 'all' ? propertyId : undefined;
  let query = client.from('assignments').select('*').eq('date', date).order('created_at');
  if (orgId) query = query.eq('org_id', orgId);
  if (scopedPropertyId) query = query.eq('property_id', scopedPropertyId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as DbAssignment[]).map(toAssignment);
}

async function fetchAssignmentsRange(startDate: string, endDate: string, propertyId?: string, orgId?: string): Promise<Assignment[]> {
  const client = ensureSupabase();
  const scopedPropertyId = propertyId && propertyId !== 'all' ? propertyId : undefined;
  let query = client
    .from('assignments')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date')
    .order('created_at');
  if (orgId) query = query.eq('org_id', orgId);
  if (scopedPropertyId) query = query.eq('property_id', scopedPropertyId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as DbAssignment[]).map(toAssignment);
}

async function fetchTasks(propertyId?: string, orgId?: string): Promise<Task[]> {
  const client = ensureSupabase();
  const scopedPropertyId = propertyId && propertyId !== 'all' ? propertyId : undefined;
  let query = client.from('tasks').select('*').order('priority').order('name');
  if (orgId) query = query.eq('org_id', orgId);
  if (scopedPropertyId) query = query.eq('property_id', scopedPropertyId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as DbTask[]).map(toTask);
}

async function fetchEquipmentUnits(propertyId?: string, orgId?: string): Promise<EquipmentUnit[]> {
  const client = ensureSupabase();
  const scopedPropertyId = propertyId && propertyId !== 'all' ? propertyId : undefined;
  let query = client.from('equipment_units').select('*').order('name');
  if (orgId) query = query.eq('org_id', orgId);
  if (scopedPropertyId) query = query.eq('property_id', scopedPropertyId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as DbEquipmentUnit[]).map(toEquipmentUnit);
}

async function fetchNotes(propertyId?: string, orgId?: string): Promise<Note[]> {
  const client = ensureSupabase();
  const scopedPropertyId = propertyId && propertyId !== 'all' ? propertyId : undefined;
  let query = client.from('notes').select('*').order('created_at', { ascending: false });
  if (orgId) query = query.eq('org_id', orgId);
  if (scopedPropertyId) query = query.eq('property_id', scopedPropertyId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as DbNote[]).map(toNote);
}

async function fetchProgramSettings(orgId?: string): Promise<ProgramSettings | null> {
  const client = ensureSupabase();
  let query = client.from('program_settings').select('*').order('created_at').limit(1);
  if (orgId) query = query.eq('org_id', orgId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data ? toProgramSettings(data as DbProgramSettings) : null;
}

async function fetchAppUsers(orgId?: string): Promise<AppUser[]> {
  const client = ensureSupabase();
  const programSettings = await fetchProgramSettings(orgId);
  let query = client
    .from('app_users')
    .select('*, employees (*)')
    .order('created_at');
  if (orgId) query = query.eq('org_id', orgId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as DbAppUser[]).map((row) => toAppUser(row, programSettings?.clientLabel ?? 'Client profile'));
}

async function fetchWeatherStations(): Promise<WeatherStationSummary[]> {
  const client = ensureSupabase();
  const { data, error } = await client.from('weather_stations').select('*').order('name');
  if (error) return [];
  return ((data as DbWeatherStation[]) ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    provider: row.provider,
    status: row.status,
    isPrimary: Boolean(row.is_primary),
  }));
}

async function fetchChemicalApplicationLogs(date: string): Promise<Array<{ weatherLogId?: string | null; applicatorLicenseNumber?: string | null; supervisorLicenseNumber?: string | null }>> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from('chemical_application_logs')
    .select('weatherLogId, applicatorLicenseNumber, supervisorLicenseNumber, applicationDate')
    .eq('applicationDate', date);
  if (error) return [];
  return data ?? [];
}

async function fetchClockEvents(date: string, propertyId?: string, orgId?: string): Promise<ClockEvent[]> {
  const client = ensureSupabase();
  const scopedPropertyId = propertyId && propertyId !== 'all' ? propertyId : undefined;
  const start = `${date}T00:00:00.000Z`;
  const end = `${date}T23:59:59.999Z`;
  let query = client
    .from('clock_events')
    .select('*')
    .gte('timestamp', start)
    .lte('timestamp', end)
    .order('timestamp', { ascending: false });
  if (orgId) query = query.eq('org_id', orgId);
  if (scopedPropertyId) query = query.eq('property_id', scopedPropertyId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as DbClockEvent[]).map(toClockEvent);
}

async function fetchClockEventsRange(startDate: string, endDate: string, propertyId?: string, orgId?: string): Promise<ClockEvent[]> {
  const client = ensureSupabase();
  const scopedPropertyId = propertyId && propertyId !== 'all' ? propertyId : undefined;
  const start = `${startDate}T00:00:00.000Z`;
  const end = `${endDate}T23:59:59.999Z`;
  let query = client
    .from('clock_events')
    .select('*')
    .gte('timestamp', start)
    .lte('timestamp', end)
    .order('timestamp', { ascending: false });
  if (orgId) query = query.eq('org_id', orgId);
  if (scopedPropertyId) query = query.eq('property_id', scopedPropertyId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as DbClockEvent[]).map(toClockEvent);
}

export function useProperties(orgId?: string) {
  return useQuery({
    queryKey: ['properties', orgId ?? 'all-orgs'],
    queryFn: () => fetchProperties(orgId),
    staleTime: 1000 * 60 * 5,
  });
}

export function useEmployees(propertyId?: string, orgId?: string) {
  return useQuery({
    queryKey: ['employees', propertyId ?? 'all', orgId ?? 'all-orgs'],
    queryFn: () => fetchEmployees(propertyId, orgId),
    staleTime: 1000 * 60 * 5,
  });
}

export function useScheduleEntries(date: string, propertyId?: string, orgId?: string) {
  return useQuery({
    queryKey: ['schedule-entries', date, propertyId ?? 'all', orgId ?? 'all-orgs'],
    queryFn: () => fetchScheduleEntries(date, propertyId, orgId),
    enabled: Boolean(date),
    staleTime: 1000 * 60 * 5,
  });
}

export function useScheduleEntriesRange(startDate: string, endDate: string, propertyId?: string, orgId?: string) {
  return useQuery({
    queryKey: ['schedule-entries-range', startDate, endDate, propertyId ?? 'all', orgId ?? 'all-orgs'],
    queryFn: () => fetchScheduleEntriesRange(startDate, endDate, propertyId, orgId),
    enabled: Boolean(startDate && endDate),
    staleTime: 1000 * 60 * 5,
  });
}

export function useAssignments(date: string, propertyId?: string, orgId?: string) {
  return useQuery({
    queryKey: ['assignments', date, propertyId ?? 'all', orgId ?? 'all-orgs'],
    queryFn: () => fetchAssignments(date, propertyId, orgId),
    enabled: Boolean(date),
    staleTime: 1000 * 60 * 5,
  });
}

export function useAssignmentsRange(startDate: string, endDate: string, propertyId?: string, orgId?: string) {
  return useQuery({
    queryKey: ['assignments-range', startDate, endDate, propertyId ?? 'all', orgId ?? 'all-orgs'],
    queryFn: () => fetchAssignmentsRange(startDate, endDate, propertyId, orgId),
    enabled: Boolean(startDate && endDate),
    staleTime: 1000 * 60 * 5,
  });
}

export function useTasks(propertyId?: string, orgId?: string) {
  return useQuery({
    queryKey: ['tasks', propertyId ?? 'all', orgId ?? 'all-orgs'],
    queryFn: () => fetchTasks(propertyId, orgId),
    staleTime: 1000 * 60 * 5,
  });
}

export function useEquipmentUnits(propertyId?: string, orgId?: string) {
  return useQuery({
    queryKey: ['equipment-units', propertyId ?? 'all', orgId ?? 'all-orgs'],
    queryFn: () => fetchEquipmentUnits(propertyId, orgId),
    staleTime: 1000 * 60 * 5,
  });
}

export function useProgramSettings(orgId?: string) {
  return useQuery({
    queryKey: ['program-settings', orgId ?? 'all-orgs'],
    queryFn: () => fetchProgramSettings(orgId),
    staleTime: 1000 * 60 * 10,
  });
}

export function useAppUsers(orgId?: string) {
  return useQuery({
    queryKey: ['app-users', orgId ?? 'all-orgs'],
    queryFn: () => fetchAppUsers(orgId),
    staleTime: 1000 * 60 * 5,
  });
}

export function useNotes(propertyId?: string, orgId?: string) {
  return useQuery({
    queryKey: ['notes', propertyId ?? 'all', orgId ?? 'all-orgs'],
    queryFn: () => fetchNotes(propertyId, orgId),
    staleTime: 1000 * 60 * 5,
  });
}

export function useWeatherStations() {
  return useQuery({
    queryKey: ['weather-stations'],
    queryFn: fetchWeatherStations,
    staleTime: 1000 * 60 * 5,
  });
}

export function useChemicalApplicationLogs(date: string) {
  return useQuery({
    queryKey: ['chemical-application-logs', date],
    queryFn: () => fetchChemicalApplicationLogs(date),
    enabled: Boolean(date),
    staleTime: 1000 * 60 * 5,
  });
}

export function useClockEvents(date: string, propertyId?: string, orgId?: string) {
  return useQuery({
    queryKey: ['clock-events', date, propertyId ?? 'all', orgId ?? 'all-orgs'],
    queryFn: () => fetchClockEvents(date, propertyId, orgId),
    enabled: Boolean(date),
    staleTime: 1000 * 60 * 1,
  });
}

export function useClockEventsRange(startDate: string, endDate: string, propertyId?: string, orgId?: string) {
  return useQuery({
    queryKey: ['clock-events-range', startDate, endDate, propertyId ?? 'all', orgId ?? 'all-orgs'],
    queryFn: () => fetchClockEventsRange(startDate, endDate, propertyId, orgId),
    enabled: Boolean(startDate && endDate),
    staleTime: 1000 * 60 * 1,
  });
}
