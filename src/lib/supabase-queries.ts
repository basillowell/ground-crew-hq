import { useQuery } from '@tanstack/react-query';
import type {
  ApplicationArea,
  AppUser,
  Assignment,
  ChemicalApplicationLog,
  ChemicalApplicationTankMixItem,
  ChemicalProduct,
  DepartmentOption,
  Employee,
  EquipmentUnit,
  GroupOption,
  LanguageOption,
  Note,
  PropertyClassOption,
  ProgramSettings,
  Property,
  RoleOption,
  ScheduleEntry,
  ShiftTemplate,
  Task,
  WeatherDailyLog,
  WeatherLocation,
  WeatherStation,
  WorkLocation,
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

type DbPropertyClassOption = {
  id: string;
  name: string;
  description: string | null;
  enabledModules: string[] | null;
};

type DbWorkLocation = {
  id: string;
  name: string;
  propertyId?: string | null;
  property_id?: string | null;
  propertyName?: string | null;
  property_name?: string | null;
};

type DbWeatherLocation = {
  id: string;
  name: string;
  property: string;
  propertyId?: string | null;
  property_id?: string | null;
  area: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type DbWeatherDailyLog = {
  id: string;
  locationId?: string | null;
  location_id?: string | null;
  stationId?: string | null;
  station_id?: string | null;
  date: string;
  capturedAt?: string | null;
  captured_at?: string | null;
  currentConditions?: string | null;
  current_conditions?: string | null;
  forecast?: string | null;
  rainfallTotal?: number | null;
  rainfall_total?: number | null;
  temperature?: number | null;
  humidity?: number | null;
  wind?: number | null;
  windGust?: number | null;
  wind_gust?: number | null;
  et?: number | null;
  source?: 'station' | 'manual-override' | null;
  alerts?: string[] | null;
  notes?: string | null;
};

type DbDepartmentOption = { id: string; name: string };
type DbGroupOption = { id: string; name: string; color?: string | null };
type DbRoleOption = { id: string; name: string };
type DbLanguageOption = { id: string; name: string };
type DbShiftTemplate = { id: string; name: string; start: string; end: string; days: string[] | null };
type DbApplicationArea = {
  id: string;
  name: string;
  property: string;
  propertyId?: string | null;
  property_id?: string | null;
  weatherLocationId?: string | null;
  weather_location_id?: string | null;
};
type DbChemicalProduct = {
  id: string;
  name: string;
  productType?: string | null;
  product_type?: string | null;
  targetUse?: string | null;
  target_use?: string | null;
  rateUnit?: string | null;
  rate_unit?: string | null;
  epaRegistrationNumber?: string | null;
  epa_registration_number?: string | null;
  formulation?: string | null;
  signalWord?: string | null;
  signal_word?: string | null;
  restrictedUse?: boolean | null;
  restricted_use?: boolean | null;
  reentryIntervalHours?: number | null;
  reentry_interval_hours?: number | null;
  preHarvestIntervalHours?: number | null;
  pre_harvest_interval_hours?: number | null;
  defaultApplicationMethod?: string | null;
  default_application_method?: string | null;
};
type DbChemicalApplicationLog = {
  id: string;
  applicationDate?: string | null;
  application_date?: string | null;
  startTime?: string | null;
  start_time?: string | null;
  endTime?: string | null;
  end_time?: string | null;
  applicationTimestamp?: string | null;
  application_timestamp?: string | null;
  areaId?: string | null;
  area_id?: string | null;
  targetPest?: string | null;
  target_pest?: string | null;
  agronomicPurpose?: string | null;
  agronomic_purpose?: string | null;
  applicationMethod?: string | null;
  application_method?: string | null;
  carrierVolume?: number | null;
  carrier_volume?: number | null;
  totalMixVolume?: number | null;
  total_mix_volume?: number | null;
  areaTreated?: number | null;
  area_treated?: number | null;
  areaUnit?: string | null;
  area_unit?: string | null;
  applicatorId?: string | null;
  applicator_id?: string | null;
  applicatorLicenseNumber?: string | null;
  applicator_license_number?: string | null;
  supervisorName?: string | null;
  supervisor_name?: string | null;
  supervisorLicenseNumber?: string | null;
  supervisor_license_number?: string | null;
  equipmentUsedId?: string | null;
  equipment_used_id?: string | null;
  weatherLogId?: string | null;
  weather_log_id?: string | null;
  weatherConditionsSummary?: string | null;
  weather_conditions_summary?: string | null;
  windDirection?: string | null;
  wind_direction?: string | null;
  windSpeedAtApplication?: number | null;
  wind_speed_at_application?: number | null;
  temperatureAtApplication?: number | null;
  temperature_at_application?: number | null;
  humidityAtApplication?: number | null;
  humidity_at_application?: number | null;
  restrictedEntryUntil?: string | null;
  restricted_entry_until?: string | null;
  siteConditions?: string | null;
  site_conditions?: string | null;
  notes?: string | null;
};
type DbChemicalApplicationTankMixItem = {
  id: string;
  applicationLogId?: string | null;
  application_log_id?: string | null;
  productId?: string | null;
  product_id?: string | null;
  rateApplied?: number | null;
  rate_applied?: number | null;
  rateUnit?: string | null;
  rate_unit?: string | null;
  totalQuantityUsed?: number | null;
  total_quantity_used?: number | null;
  mixOrder?: number | null;
  mix_order?: number | null;
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
    propertyClassId: (row as DbProperty & { property_class_id?: string | null; propertyClassId?: string | null }).property_class_id
      ?? (row as DbProperty & { propertyClassId?: string | null }).propertyClassId
      ?? undefined,
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

function toPropertyClassOption(row: DbPropertyClassOption): PropertyClassOption {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    enabledModules: row.enabledModules ?? [],
  };
}

function toWorkLocation(row: DbWorkLocation): WorkLocation {
  return {
    id: row.id,
    name: row.name,
    propertyId: row.property_id ?? row.propertyId ?? undefined,
    propertyName: row.property_name ?? row.propertyName ?? undefined,
  };
}

function toWeatherLocation(row: DbWeatherLocation): WeatherLocation {
  return {
    id: row.id,
    name: row.name,
    property: row.property,
    propertyId: row.property_id ?? row.propertyId ?? undefined,
    area: row.area,
    address: row.address ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
  };
}

function toWeatherDailyLog(row: DbWeatherDailyLog): WeatherDailyLog {
  return {
    id: row.id,
    locationId: row.location_id ?? row.locationId ?? '',
    stationId: row.station_id ?? row.stationId ?? undefined,
    date: row.date,
    capturedAt: row.captured_at ?? row.capturedAt ?? undefined,
    currentConditions: row.current_conditions ?? row.currentConditions ?? 'Unknown',
    forecast: row.forecast ?? '',
    rainfallTotal: Number(row.rainfall_total ?? row.rainfallTotal ?? 0),
    temperature: Number(row.temperature ?? 0),
    humidity: Number(row.humidity ?? 0),
    wind: Number(row.wind ?? 0),
    windGust: Number(row.wind_gust ?? row.windGust ?? 0),
    et: Number(row.et ?? 0),
    source: row.source ?? 'station',
    alerts: row.alerts ?? [],
    notes: row.notes ?? '',
  };
}

function toApplicationArea(row: DbApplicationArea): ApplicationArea {
  return {
    id: row.id,
    name: row.name,
    property: row.property,
    weatherLocationId: row.weather_location_id ?? row.weatherLocationId ?? '',
  };
}

function toChemicalProduct(row: DbChemicalProduct): ChemicalProduct {
  return {
    id: row.id,
    name: row.name,
    productType: row.product_type ?? row.productType ?? '',
    targetUse: row.target_use ?? row.targetUse ?? '',
    rateUnit: row.rate_unit ?? row.rateUnit ?? 'oz/acre',
    epaRegistrationNumber: row.epa_registration_number ?? row.epaRegistrationNumber ?? undefined,
    formulation: row.formulation ?? undefined,
    signalWord: row.signal_word ?? row.signalWord ?? undefined,
    restrictedUse: row.restricted_use ?? row.restrictedUse ?? undefined,
    reentryIntervalHours: row.reentry_interval_hours ?? row.reentryIntervalHours ?? undefined,
    preHarvestIntervalHours: row.pre_harvest_interval_hours ?? row.preHarvestIntervalHours ?? undefined,
    defaultApplicationMethod: row.default_application_method ?? row.defaultApplicationMethod ?? undefined,
  };
}

function toChemicalApplicationLog(row: DbChemicalApplicationLog): ChemicalApplicationLog {
  return {
    id: row.id,
    applicationDate: row.application_date ?? row.applicationDate ?? '',
    startTime: String(row.start_time ?? row.startTime ?? '00:00').slice(0, 5),
    endTime: String(row.end_time ?? row.endTime ?? '00:00').slice(0, 5),
    applicationTimestamp: row.application_timestamp ?? row.applicationTimestamp ?? undefined,
    areaId: row.area_id ?? row.areaId ?? '',
    targetPest: row.target_pest ?? row.targetPest ?? '',
    agronomicPurpose: row.agronomic_purpose ?? row.agronomicPurpose ?? '',
    applicationMethod: row.application_method ?? row.applicationMethod ?? undefined,
    carrierVolume: Number(row.carrier_volume ?? row.carrierVolume ?? 0),
    totalMixVolume: row.total_mix_volume ?? row.totalMixVolume ?? undefined,
    areaTreated: Number(row.area_treated ?? row.areaTreated ?? 0),
    areaUnit: row.area_unit ?? row.areaUnit ?? 'acres',
    applicatorId: row.applicator_id ?? row.applicatorId ?? '',
    applicatorLicenseNumber: row.applicator_license_number ?? row.applicatorLicenseNumber ?? undefined,
    supervisorName: row.supervisor_name ?? row.supervisorName ?? undefined,
    supervisorLicenseNumber: row.supervisor_license_number ?? row.supervisorLicenseNumber ?? undefined,
    equipmentUsedId: row.equipment_used_id ?? row.equipmentUsedId ?? undefined,
    weatherLogId: row.weather_log_id ?? row.weatherLogId ?? undefined,
    weatherConditionsSummary: row.weather_conditions_summary ?? row.weatherConditionsSummary ?? undefined,
    windDirection: row.wind_direction ?? row.windDirection ?? undefined,
    windSpeedAtApplication: row.wind_speed_at_application ?? row.windSpeedAtApplication ?? undefined,
    temperatureAtApplication: row.temperature_at_application ?? row.temperatureAtApplication ?? undefined,
    humidityAtApplication: row.humidity_at_application ?? row.humidityAtApplication ?? undefined,
    restrictedEntryUntil: row.restricted_entry_until ?? row.restrictedEntryUntil ?? undefined,
    siteConditions: row.site_conditions ?? row.siteConditions ?? undefined,
    notes: row.notes ?? '',
  };
}

function toChemicalApplicationTankMixItem(row: DbChemicalApplicationTankMixItem): ChemicalApplicationTankMixItem {
  return {
    id: row.id,
    applicationLogId: row.application_log_id ?? row.applicationLogId ?? '',
    productId: row.product_id ?? row.productId ?? '',
    rateApplied: Number(row.rate_applied ?? row.rateApplied ?? 0),
    rateUnit: row.rate_unit ?? row.rateUnit ?? 'oz/acre',
    totalQuantityUsed: Number(row.total_quantity_used ?? row.totalQuantityUsed ?? 0),
    mixOrder: row.mix_order ?? row.mixOrder ?? undefined,
  };
}

async function fetchOptionalRows<T>(table: string, orderBy?: string) {
  const client = ensureSupabase();
  let query = client.from(table).select('*');
  if (orderBy) query = query.order(orderBy);
  const { data, error } = await query;
  if (error) return [] as T[];
  return (data ?? []) as T[];
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

async function fetchPropertyClassOptions(): Promise<PropertyClassOption[]> {
  const rows = await fetchOptionalRows<DbPropertyClassOption>('property_class_options', 'name');
  return rows.map(toPropertyClassOption);
}

async function fetchWorkLocations(): Promise<WorkLocation[]> {
  const rows = await fetchOptionalRows<DbWorkLocation>('work_locations', 'name');
  return rows.map(toWorkLocation);
}

export async function fetchWeatherLocations(propertyId?: string): Promise<WeatherLocation[]> {
  const client = ensureSupabase();
  const scopedPropertyId = propertyId && propertyId !== 'all' ? propertyId : undefined;
  const { data, error } = await client.from('weather_locations').select('*').order('name');
  if (error) throw error;
  const rows = (data as DbWeatherLocation[]) ?? [];
  if (!scopedPropertyId) return rows.map(toWeatherLocation);
  const filtered = rows.filter((row) => {
    const r = row as DbWeatherLocation & { property_id?: string | null };
    return (r.property_id ?? r.propertyId ?? row.property) === scopedPropertyId;
  });
  return filtered.map(toWeatherLocation);
}

/** Full table fetch for hooks that need unbounded history (e.g. Breakroom, Scheduler). */
async function fetchAllWeatherDailyLogs(): Promise<WeatherDailyLog[]> {
  const rows = await fetchOptionalRows<DbWeatherDailyLog>('weather_daily_logs', 'date');
  return rows.map(toWeatherDailyLog);
}

export async function fetchWeatherDailyLogs(startDate: string, endDate: string, propertyId?: string): Promise<WeatherDailyLog[]> {
  const client = ensureSupabase();
  const scopedPropertyId = propertyId && propertyId !== 'all' ? propertyId : undefined;
  let locationIds: string[] | undefined;
  if (scopedPropertyId) {
    const locations = await fetchWeatherLocations(scopedPropertyId);
    locationIds = locations.map((l) => l.id);
    if (locationIds.length === 0) return [];
  }
  let query = client
    .from('weather_daily_logs')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date');
  if (locationIds && locationIds.length > 0) {
    query = query.in('location_id', locationIds);
  }
  let { data, error } = await query;
  if (error) {
    let retry = client
      .from('weather_daily_logs')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date');
    if (locationIds && locationIds.length > 0) {
      retry = retry.in('locationId', locationIds);
    }
    const second = await retry;
    data = second.data;
    error = second.error;
  }
  if (error) throw error;
  return ((data as DbWeatherDailyLog[]) ?? []).map(toWeatherDailyLog);
}

async function fetchWeatherDailyLogsByIds(ids: string[]): Promise<WeatherDailyLog[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];
  const client = ensureSupabase();
  const { data, error } = await client.from('weather_daily_logs').select('*').in('id', unique);
  if (error) throw error;
  return ((data as DbWeatherDailyLog[]) ?? []).map(toWeatherDailyLog);
}

async function fetchDepartmentOptions(): Promise<DepartmentOption[]> {
  const rows = await fetchOptionalRows<DbDepartmentOption>('department_options', 'name');
  return rows.map((row) => ({ id: row.id, name: row.name }));
}

async function fetchGroupOptions(): Promise<GroupOption[]> {
  const rows = await fetchOptionalRows<DbGroupOption>('group_options', 'name');
  return rows.map((row) => ({ id: row.id, name: row.name, color: row.color ?? 'hsl(var(--primary))' }));
}

async function fetchRoleOptions(): Promise<RoleOption[]> {
  const rows = await fetchOptionalRows<DbRoleOption>('role_options', 'name');
  return rows.map((row) => ({ id: row.id, name: row.name }));
}

async function fetchLanguageOptions(): Promise<LanguageOption[]> {
  const rows = await fetchOptionalRows<DbLanguageOption>('language_options', 'name');
  return rows.map((row) => ({ id: row.id, name: row.name }));
}

async function fetchShiftTemplates(): Promise<ShiftTemplate[]> {
  const rows = await fetchOptionalRows<DbShiftTemplate>('shift_templates', 'name');
  return rows.map((row) => ({ id: row.id, name: row.name, start: row.start, end: row.end, days: row.days ?? [] }));
}

async function fetchChemicalApplicationLogFieldsForDate(
  date: string,
): Promise<Array<{ weatherLogId?: string | null; applicatorLicenseNumber?: string | null; supervisorLicenseNumber?: string | null }>> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from('chemical_application_logs')
    .select('weatherLogId, applicatorLicenseNumber, supervisorLicenseNumber, applicationDate')
    .eq('applicationDate', date);
  if (error) return [];
  return data ?? [];
}

export async function fetchChemicalApplicationLogs(startDate: string, endDate: string, propertyId?: string): Promise<ChemicalApplicationLog[]> {
  const client = ensureSupabase();
  const scopedPropertyId = propertyId && propertyId !== 'all' ? propertyId : undefined;
  let applicatorIds: string[] | undefined;
  if (scopedPropertyId) {
    const employees = await fetchEmployees(scopedPropertyId);
    applicatorIds = employees.map((e) => e.id);
    if (applicatorIds.length === 0) return [];
  }
  let query = client
    .from('chemical_application_logs')
    .select('*')
    .gte('applicationDate', startDate)
    .lte('applicationDate', endDate)
    .order('applicationDate');
  if (applicatorIds) {
    query = query.in('applicatorId', applicatorIds);
  }
  let { data, error } = await query;
  if (error) {
    let retry = client
      .from('chemical_application_logs')
      .select('*')
      .gte('application_date', startDate)
      .lte('application_date', endDate)
      .order('application_date');
    if (applicatorIds) {
      retry = retry.in('applicator_id', applicatorIds);
    }
    const second = await retry;
    data = second.data;
    error = second.error;
  }
  if (error) throw error;
  return ((data as DbChemicalApplicationLog[]) ?? []).map(toChemicalApplicationLog);
}

export async function fetchApplicationAreas(propertyId?: string): Promise<ApplicationArea[]> {
  const client = ensureSupabase();
  const { data, error } = await client.from('application_areas').select('*').order('name');
  if (error) throw error;
  const rows = (data as (DbApplicationArea & { property_id?: string | null; propertyId?: string | null })[]) ?? [];
  const scopedPropertyId = propertyId && propertyId !== 'all' ? propertyId : undefined;
  const filtered = scopedPropertyId
    ? rows.filter(
        (row) =>
          row.property_id === scopedPropertyId ||
          row.propertyId === scopedPropertyId ||
          row.property === scopedPropertyId,
      )
    : rows;
  return filtered.map(toApplicationArea);
}

async function fetchChemicalProducts(): Promise<ChemicalProduct[]> {
  const rows = await fetchOptionalRows<DbChemicalProduct>('chemical_products', 'name');
  return rows.map(toChemicalProduct);
}

async function fetchChemicalApplicationLogsAll(): Promise<ChemicalApplicationLog[]> {
  const rows = await fetchOptionalRows<DbChemicalApplicationLog>('chemical_application_logs', 'application_date');
  return rows.map(toChemicalApplicationLog);
}

async function fetchChemicalApplicationTankMixItems(): Promise<ChemicalApplicationTankMixItem[]> {
  const rows = await fetchOptionalRows<DbChemicalApplicationTankMixItem>('chemical_application_tank_mix_items', 'id');
  return rows.map(toChemicalApplicationTankMixItem);
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

export function usePropertyClassOptions() {
  return useQuery({
    queryKey: ['property-class-options'],
    queryFn: fetchPropertyClassOptions,
    staleTime: 1000 * 60 * 10,
  });
}

export function useWorkLocations() {
  return useQuery({
    queryKey: ['work-locations'],
    queryFn: fetchWorkLocations,
    staleTime: 1000 * 60 * 10,
  });
}

export function useWeatherLocations(propertyId?: string) {
  return useQuery({
    queryKey: ['weather-locations', propertyId ?? 'all'],
    queryFn: () => fetchWeatherLocations(propertyId),
    staleTime: 1000 * 60 * 10,
  });
}

export function useWeatherDailyLogs() {
  return useQuery({
    queryKey: ['weather-daily-logs-all'],
    queryFn: fetchAllWeatherDailyLogs,
    staleTime: 1000 * 60 * 10,
  });
}

export function useWeatherDailyLogsRange(startDate: string, endDate: string, propertyId?: string) {
  return useQuery({
    queryKey: ['weather-daily-logs-range', startDate, endDate, propertyId ?? 'all'],
    queryFn: () => fetchWeatherDailyLogs(startDate, endDate, propertyId),
    enabled: Boolean(startDate && endDate),
    staleTime: 1000 * 60 * 5,
  });
}

export function useWeatherDailyLogsByIds(ids: string[]) {
  const sortedKey = [...ids].filter(Boolean).sort().join(',');
  return useQuery({
    queryKey: ['weather-daily-logs-by-ids', sortedKey],
    queryFn: () => fetchWeatherDailyLogsByIds(ids),
    enabled: ids.some(Boolean),
    staleTime: 1000 * 60 * 5,
  });
}

export function useDepartmentOptions() {
  return useQuery({
    queryKey: ['department-options'],
    queryFn: fetchDepartmentOptions,
    staleTime: 1000 * 60 * 10,
  });
}

export function useGroupOptions() {
  return useQuery({
    queryKey: ['group-options'],
    queryFn: fetchGroupOptions,
    staleTime: 1000 * 60 * 10,
  });
}

export function useRoleOptions() {
  return useQuery({
    queryKey: ['role-options'],
    queryFn: fetchRoleOptions,
    staleTime: 1000 * 60 * 10,
  });
}

export function useLanguageOptions() {
  return useQuery({
    queryKey: ['language-options'],
    queryFn: fetchLanguageOptions,
    staleTime: 1000 * 60 * 10,
  });
}

export function useShiftTemplates() {
  return useQuery({
    queryKey: ['shift-templates'],
    queryFn: fetchShiftTemplates,
    staleTime: 1000 * 60 * 10,
  });
}

export function useChemicalApplicationLogs(date: string) {
  return useQuery({
    queryKey: ['chemical-application-logs', date],
    queryFn: () => fetchChemicalApplicationLogFieldsForDate(date),
    enabled: Boolean(date),
    staleTime: 1000 * 60 * 5,
  });
}

export function useChemicalApplicationLogsRange(startDate: string, endDate: string, propertyId?: string) {
  return useQuery({
    queryKey: ['chemical-application-logs-range', startDate, endDate, propertyId ?? 'all'],
    queryFn: () => fetchChemicalApplicationLogs(startDate, endDate, propertyId),
    enabled: Boolean(startDate && endDate),
    staleTime: 1000 * 60 * 5,
  });
}

export function useApplicationAreas(propertyId?: string) {
  return useQuery({
    queryKey: ['application-areas', propertyId ?? 'all'],
    queryFn: () => fetchApplicationAreas(propertyId),
    staleTime: 1000 * 60 * 10,
  });
}

export function useChemicalProducts() {
  return useQuery({
    queryKey: ['chemical-products'],
    queryFn: fetchChemicalProducts,
    staleTime: 1000 * 60 * 10,
  });
}

export function useChemicalApplicationLogsAll() {
  return useQuery({
    queryKey: ['chemical-application-logs-all'],
    queryFn: fetchChemicalApplicationLogsAll,
    staleTime: 1000 * 60 * 5,
  });
}

export function useChemicalApplicationTankMixItems() {
  return useQuery({
    queryKey: ['chemical-application-tank-mix-items'],
    queryFn: fetchChemicalApplicationTankMixItems,
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
