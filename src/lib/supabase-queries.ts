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
  property_id: string | null;
  first_name: string;
  last_name: string;
  role: string;
  department: string;
  group_name?: string | null;
  role_id?: string | null;
  group_id?: string | null;
  department_id?: string | null;
  worker_type?: string | null;
  worker_type_id?: string | null;
  employment_type?: string | null;
  job_description_id?: string | null;
  job_description?: string | null;
  employment_status_id?: string | null;
  employment_status?: string | null;
  wage_category_id?: string | null;
  wage_category?: string | null;
  overtime_rule_id?: string | null;
  overtime_rule?: string | null;
  language?: string | null;
  hourly_rate?: number | null;
  default_location_id?: string | null;
  preferred_shift_template_id?: string | null;
  portal_enabled?: boolean | null;
  login_email?: string | null;
  active?: boolean | null;
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
  property_id: string;
  task_id: string | null;
  date: string;
  location: string | null;
  status: string;
  notes?: string | null;
  order_index?: number | null;
  estimated_hours?: number | null;
  actual_hours?: number | null;
  completed_at?: string | null;
  actual_start_at?: string | null;
  actual_completed_at?: string | null;
  start_time?: string | null;
  title?: string | null;
  equipment_unit_id?: string | null;
  created_at: string;
};

type DbTask = {
  id: string;
  org_id?: string | null;
  property_id: string | null;
  name: string;
  description: string | null;
  category: string;
  status: string;
  priority: number;
  duration?: number | null;
  estimated_hours?: number | null;
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
  weather_default_location_name?: string | null;
  weather_default_address?: string | null;
  weather_default_latitude?: number | null;
  weather_default_longitude?: number | null;
  weather_preferred_provider?: string | null;
  weather_enabled_panels?: string[] | null;
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
  org_id?: string | null;
  is_active?: boolean | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
  is_default?: boolean | null;
  forecast_provider?: 'auto' | 'noaa-nws' | null;
  radar_provider?: 'auto' | null;
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

type DbDepartmentOption = { id: string; org_id?: string | null; name: string; active?: boolean | null };
type DbGroupOption = { id: string; org_id?: string | null; name: string; color?: string | null; active?: boolean | null };
type DbRoleOption = { id: string; name: string };
type DbWorkforceRole = {
  id: string;
  org_id?: string | null;
  name: string;
  description?: string | null;
  active?: boolean | null;
};
type DbLanguageOption = { id: string; org_id?: string | null; name: string };
type DbShiftTemplate = {
  id: string;
  org_id?: string | null;
  name: string;
  start?: string | null;
  end?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  days: string[] | null;
  active?: boolean | null;
};
type DbWorkerType = { id: string; org_id?: string | null; name: string; active?: boolean | null };
type DbFrameworkOption = { id: string; org_id?: string | null; name: string; active?: boolean | null };
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
  supervisorName?: string | null;
  supervisorLicenseNumber?: string | null;
  equipmentUsedId?: string | null;
  weatherLogId?: string | null;
  weatherConditionsSummary?: string | null;
  windDirection?: string | null;
  windSpeedAtApplication?: number | null;
  temperatureAtApplication?: number | null;
  humidityAtApplication?: number | null;
  restrictedEntryUntil?: string | null;
  siteConditions?: string | null;
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
    propertyId: row.property_id ?? undefined,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role,
    department: row.department,
    status: (row.status as Employee['status']) ?? 'active',
    phone: row.phone ?? '',
    email: row.email ?? '',
    group: row.group_name ?? row.department ?? 'General',
    wage: Number(row.hourly_rate ?? 0),
    photo: '',
    language: row.language ?? 'English',
    workerType: (row.worker_type as Employee['workerType']) ?? 'full-time',
    employmentType: row.employment_type ?? undefined,
    active: row.active ?? row.status === 'active',
    jobDescriptionId: row.job_description_id ?? undefined,
    jobDescription: row.job_description ?? undefined,
    employmentStatusId: row.employment_status_id ?? undefined,
    employmentStatus: row.employment_status ?? undefined,
    wageCategoryId: row.wage_category_id ?? undefined,
    wageCategory: row.wage_category ?? undefined,
    overtimeRuleId: row.overtime_rule_id ?? undefined,
    overtimeRule: row.overtime_rule ?? undefined,
    hireDate: row.created_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    defaultLocationId: row.default_location_id ?? undefined,
    shiftTemplateId: row.preferred_shift_template_id ?? undefined,
    portalEnabled: row.portal_enabled ?? false,
    loginEmail: row.login_email ?? undefined,
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
  const estimatedHours = Number(row.estimated_hours ?? 1);
  const safeEstimatedHours = Number.isFinite(estimatedHours) ? Math.max(estimatedHours, 0) : 0;
  return {
    id: row.id,
    employeeId: row.employee_id,
    propertyId: row.property_id ?? undefined,
    taskId: row.task_id ?? '',
    date: row.date,
    startTime: String(row.start_time ?? '06:00').slice(0, 5),
    duration: Math.round(safeEstimatedHours * 60),
    estimatedHours: safeEstimatedHours,
    actualHours: Number(row.actual_hours ?? 0),
    actual_hours: Number(row.actual_hours ?? 0),
    title: row.title ?? undefined,
    notes: row.notes ?? undefined,
    area: row.location ?? 'Unassigned area',
    equipmentId: row.equipment_unit_id ?? undefined,
    order: row.order_index ?? undefined,
    actualStartAt: row.actual_start_at ?? null,
    actualCompletedAt: row.actual_completed_at ?? null,
    completedAt: row.completed_at ?? null,
    actual_start_at: row.actual_start_at ?? null,
    actual_completed_at: row.actual_completed_at ?? null,
    completed_at: row.completed_at ?? null,
    status: (row.status as Assignment['status']) ?? 'planned',
  };
}

const ASSIGNMENTS_SELECT_COLUMNS =
  `id,
  employee_id,
  property_id,
  task_id,
  date,
  location,
  status,
  estimated_hours,
  actual_hours,
  order_index,
  actual_start_at,
  actual_completed_at,
  title,
  notes,
  equipment_unit_id,
  created_at,
  org_id,
  completed_at,
  start_time`;
const SCHEDULE_ENTRIES_SELECT_COLUMNS =
  'id, employee_id, property_id, date, shift_start, shift_end, status, created_at, org_id, notes';

function toTask(row: DbTask): Task {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    duration: Number(row.estimated_hours ?? 1) * 60,
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
    weatherDefaultLocationName: row.weather_default_location_name ?? undefined,
    weatherDefaultAddress: row.weather_default_address ?? undefined,
    weatherDefaultLatitude: row.weather_default_latitude ?? undefined,
    weatherDefaultLongitude: row.weather_default_longitude ?? undefined,
    weatherPreferredProvider: row.weather_preferred_provider ?? undefined,
    weatherEnabledPanels: row.weather_enabled_panels ?? undefined,
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
  const latitude =
    typeof row.latitude === 'number'
      ? row.latitude
      : row.latitude == null
        ? undefined
        : Number(row.latitude);
  const longitude =
    typeof row.longitude === 'number'
      ? row.longitude
      : row.longitude == null
        ? undefined
        : Number(row.longitude);
  const propertyValue = String(row.property ?? '').trim();
  return {
    id: row.id,
    name: row.name,
    property: row.property,
    propertyId: row.property_id ?? row.propertyId ?? (propertyValue || undefined),
    area: row.area,
    address: row.address ?? undefined,
    latitude: Number.isFinite(latitude) ? latitude : undefined,
    longitude: Number.isFinite(longitude) ? longitude : undefined,
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

async function fetchScheduleEntries(date: string, propertyId?: string, orgId?: string): Promise<ScheduleEntry[]> {
  const client = ensureSupabase();
  const scopedPropertyId = propertyId && propertyId !== 'all' ? propertyId : undefined;
  let query = client.from('schedule_entries').select(SCHEDULE_ENTRIES_SELECT_COLUMNS).eq('date', date).order('shift_start');
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
    .select(SCHEDULE_ENTRIES_SELECT_COLUMNS)
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
  let query = client.from('assignments').select(ASSIGNMENTS_SELECT_COLUMNS).eq('date', date).order('created_at');
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
    .select(ASSIGNMENTS_SELECT_COLUMNS)
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

async function fetchTasks(orgId?: string): Promise<Task[]> {
  const client = ensureSupabase();
  let query = client.from('tasks').select('*');
  if (orgId) query = query.eq('org_id', orgId);
  const { data, error } = await query
    .eq('status', 'active')
    .order('category', { ascending: true })
    .order('name', { ascending: true });
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

export async function fetchWeatherLocations(propertyId?: string, orgId?: string, activeOnly = false): Promise<WeatherLocation[]> {
  try {
    const client = ensureSupabase();
    const scopedPropertyId = propertyId && propertyId !== 'all' ? propertyId : undefined;
    let query = client
      .from('weather_locations')
      .select('id, name, property, area, latitude, longitude, org_id, is_active, timezone, is_default, forecast_provider, radar_provider')
      .order('name');
    if (orgId) query = query.eq('org_id', orgId);
    if (activeOnly) query = query.eq('is_active', true);
    const { data, error } = await query;
    if (error) return [];
    const rows = (data as DbWeatherLocation[]) ?? [];
    if (!scopedPropertyId) return rows.map(toWeatherLocation);
    const filtered = rows.filter((row) => row.property === scopedPropertyId);
    return filtered.map(toWeatherLocation);
  } catch {
    return [];
  }
}

/** Full table fetch for hooks that need unbounded history (e.g. Breakroom, Scheduler). */
async function fetchAllWeatherDailyLogs(): Promise<WeatherDailyLog[]> {
  try {
    const rows = await fetchOptionalRows<DbWeatherDailyLog>('weather_daily_logs', 'date');
    return rows.map(toWeatherDailyLog);
  } catch {
    return [];
  }
}

export async function fetchWeatherDailyLogs(startDate: string, endDate: string, propertyId?: string): Promise<WeatherDailyLog[]> {
  try {
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
    const { data, error } = await query;
    if (error) return [];
    return ((data as DbWeatherDailyLog[]) ?? []).map(toWeatherDailyLog);
  } catch {
    return [];
  }
}

async function fetchWeatherDailyLogsByIds(ids: string[]): Promise<WeatherDailyLog[]> {
  try {
    const unique = [...new Set(ids.filter(Boolean))];
    if (unique.length === 0) return [];
    const client = ensureSupabase();
    const { data, error } = await client.from('weather_daily_logs').select('*').in('id', unique);
    if (error) return [];
    return ((data as DbWeatherDailyLog[]) ?? []).map(toWeatherDailyLog);
  } catch {
    return [];
  }
}

async function fetchDepartmentOptions(orgId?: string): Promise<DepartmentOption[]> {
  const client = ensureSupabase();
  let query = client.from('departments').select('id, name, active, org_id').order('name');
  if (orgId) query = query.eq('org_id', orgId);
  query = query.eq('active', true);
  const next = await query;
  if (!next.error) {
    return ((next.data as DbDepartmentOption[]) ?? []).map((row) => ({ id: row.id, name: row.name }));
  }
  const rows = await fetchOptionalRows<DbDepartmentOption>('department_options', 'name');
  return rows.map((row) => ({ id: row.id, name: row.name }));
}

async function fetchGroupOptions(orgId?: string): Promise<GroupOption[]> {
  const client = ensureSupabase();
  let query = client.from('employee_groups').select('id, name, active, org_id').order('name');
  if (orgId) query = query.eq('org_id', orgId);
  query = query.eq('active', true);
  const next = await query;
  if (!next.error) {
    return ((next.data as DbGroupOption[]) ?? []).map((row) => ({ id: row.id, name: row.name, color: 'hsl(var(--primary))' }));
  }
  const rows = await fetchOptionalRows<DbGroupOption>('group_options', 'name');
  return rows.map((row) => ({ id: row.id, name: row.name, color: row.color ?? 'hsl(var(--primary))' }));
}

async function fetchRoleOptions(orgId?: string): Promise<RoleOption[]> {
  const client = ensureSupabase();
  let query = client.from('workforce_roles').select('id, name, active, org_id').order('name');
  if (orgId) query = query.eq('org_id', orgId);
  query = query.eq('active', true);
  let { data, error } = await query;
  if (error) {
    let fallbackQuery = client.from('role_options').select('*').order('name');
    if (orgId) fallbackQuery = fallbackQuery.eq('org_id', orgId);
    const fallback = await fallbackQuery;
    if (fallback.error) return [];
    const rows = (fallback.data ?? []) as DbRoleOption[];
    return rows
      .map((row) => ({ id: row.id, name: row.name }))
      .filter((row) => row.name && row.name.trim().length > 0);
  }
  const rows = (data ?? []) as DbWorkforceRole[];
  return rows
    .map((row) => ({ id: row.id, name: row.name }))
    .filter((row) => row.name && row.name.trim().length > 0);
}

async function fetchLanguageOptions(orgId?: string): Promise<LanguageOption[]> {
  const client = ensureSupabase();
  let query = client.from('language_options').select('id, org_id, name').order('name');
  if (orgId) query = query.eq('org_id', orgId);
  const { data, error } = await query;
  if (!error) {
    return ((data as DbLanguageOption[]) ?? []).map((row) => ({ id: row.id, name: row.name }));
  }
  const rows = await fetchOptionalRows<DbLanguageOption>('language_options', 'name');
  const filtered = orgId ? rows.filter((row) => row.org_id === orgId) : rows;
  return filtered.map((row) => ({ id: row.id, name: row.name }));
}

async function fetchShiftTemplates(orgId?: string): Promise<ShiftTemplate[]> {
  const client = ensureSupabase();
  let query = client
    .from('shift_templates')
    .select('id, name, start, "end", start_time, end_time, days, active, org_id')
    .order('name');
  if (orgId) query = query.eq('org_id', orgId);
  let { data, error } = await query;
  if (!error) {
    return ((data as DbShiftTemplate[]) ?? [])
      .filter((row) => row.active ?? true)
      .map((row) => ({
        id: row.id,
        name: row.name,
        start: String(row.start_time ?? row.start ?? '06:00').slice(0, 5),
        end: String(row.end_time ?? row.end ?? '14:30').slice(0, 5),
        days: row.days ?? [],
      }));
  }
  const rows = await fetchOptionalRows<DbShiftTemplate>('shift_templates', 'name');
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    start: String(row.start_time ?? row.start ?? '06:00').slice(0, 5),
    end: String(row.end_time ?? row.end ?? '14:30').slice(0, 5),
    days: row.days ?? [],
  }));
}

async function fetchWorkerTypes(orgId?: string): Promise<Array<{ id: string; name: string }>> {
  const client = ensureSupabase();
  let query = client.from('worker_types').select('id, name, active, org_id').order('name');
  if (orgId) query = query.eq('org_id', orgId);
  query = query.eq('active', true);
  const { data, error } = await query;
  if (error) return [];
  const rows = (data as DbWorkerType[]) ?? [];
  return rows.map((row) => ({ id: row.id, name: row.name }));
}

async function fetchFrameworkOptions(table: 'job_descriptions' | 'employment_statuses' | 'wage_categories' | 'overtime_rules', orgId?: string): Promise<Array<{ id: string; name: string }>> {
  const client = ensureSupabase();
  let query = client.from(table).select('id, name, active, org_id').order('name');
  if (orgId) query = query.eq('org_id', orgId);
  query = query.eq('active', true);
  const { data, error } = await query;
  if (error) return [];
  const rows = (data as DbFrameworkOption[]) ?? [];
  return rows.map((row) => ({ id: row.id, name: row.name }));
}

async function fetchChemicalApplicationLogFieldsForDate(
  date: string,
  orgId?: string,
): Promise<Array<{ weatherLogId?: string | null; applicatorLicenseNumber?: string | null; supervisorLicenseNumber?: string | null }>> {
  try {
    const client = ensureSupabase();
    let query = client
      .from('chemical_application_logs')
      .select('weather_log_id, applicator_license_number, supervisor_license_number, application_date')
      .eq('application_date', date);
    if (orgId) query = query.eq('org_id', orgId);
    const { data, error } = await query;
    if (error) return [];
    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      weatherLogId: row.weather_log_id ? String(row.weather_log_id) : null,
      applicatorLicenseNumber: row.applicator_license_number ? String(row.applicator_license_number) : null,
      supervisorLicenseNumber: row.supervisor_license_number ? String(row.supervisor_license_number) : null,
    }));
  } catch {
    return [];
  }
}

export async function fetchChemicalApplicationLogs(startDate: string, endDate: string, propertyId?: string, orgId?: string): Promise<ChemicalApplicationLog[]> {
  try {
    const client = ensureSupabase();
    const scopedPropertyId = propertyId && propertyId !== 'all' ? propertyId : undefined;
    let query = client
      .from('chemical_application_logs')
      .select('*')
      .gte('application_date', startDate)
      .lte('application_date', endDate)
      .order('application_date');
    if (orgId) query = query.eq('org_id', orgId);
    if (scopedPropertyId) query = query.eq('property_id', scopedPropertyId);
    const { data, error } = await query;
    if (error) return [];
    return ((data as DbChemicalApplicationLog[]) ?? []).map(toChemicalApplicationLog);
  } catch {
    return [];
  }
}

export async function fetchApplicationAreas(propertyId?: string): Promise<ApplicationArea[]> {
  try {
    const client = ensureSupabase();
    const { data, error } = await client.from('application_areas').select('*').order('name');
    if (error) return [];
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
  } catch {
    return [];
  }
}

async function fetchChemicalProducts(): Promise<ChemicalProduct[]> {
  const rows = await fetchOptionalRows<DbChemicalProduct>('chemical_products', 'name');
  return rows.map(toChemicalProduct);
}

async function fetchChemicalApplicationLogsAll(orgId?: string): Promise<ChemicalApplicationLog[]> {
  try {
    const client = ensureSupabase();
    let query = client
      .from('chemical_application_logs')
      .select('*')
      .order('application_date', { ascending: false });
    if (orgId) query = query.eq('org_id', orgId);
    const { data, error } = await query;
    if (error) return [];
    return ((data as DbChemicalApplicationLog[]) ?? []).map(toChemicalApplicationLog);
  } catch {
    return [];
  }
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

export function useScheduleEntries(date: string, propertyId?: string, orgId?: string) {
  return useQuery({
    queryKey: ['schedule-entries', date, propertyId ?? 'all', orgId ?? 'all-orgs'],
    queryFn: () => fetchScheduleEntries(date, propertyId, orgId),
    enabled: Boolean(date && orgId),
    staleTime: 1000 * 60 * 5,
    retry: 3,
    retryDelay: 1000,
  });
}

export function useScheduleEntriesRange(startDate: string, endDate: string, propertyId?: string, orgId?: string) {
  return useQuery({
    queryKey: ['schedule-entries-range', startDate, endDate, propertyId ?? 'all', orgId ?? 'all-orgs'],
    queryFn: () => fetchScheduleEntriesRange(startDate, endDate, propertyId, orgId),
    enabled: Boolean(startDate && endDate && orgId),
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev,
    retry: 3,
    retryDelay: 1000,
  });
}

export function useAssignments(date: string, propertyId?: string, orgId?: string) {
  return useQuery({
    queryKey: ['assignments', date, propertyId ?? 'all', orgId ?? 'all-orgs'],
    queryFn: () => fetchAssignments(date, propertyId, orgId),
    enabled: Boolean(date && orgId),
    staleTime: 1000 * 60 * 3,
    retry: 3,
    retryDelay: 1000,
  });
}

export function useAssignmentsRange(startDate: string, endDate: string, propertyId?: string, orgId?: string) {
  return useQuery({
    queryKey: ['assignments-range', startDate, endDate, propertyId ?? 'all', orgId ?? 'all-orgs'],
    queryFn: () => fetchAssignmentsRange(startDate, endDate, propertyId, orgId),
    enabled: Boolean(startDate && endDate && orgId),
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev,
    retry: 3,
    retryDelay: 1000,
  });
}

export type EmployeeStatusFilter = 'active' | 'inactive' | 'archived' | 'all';

async function fetchEmployees(
  propertyId?: string,
  orgId?: string,
  status: EmployeeStatusFilter = 'active',
): Promise<Employee[]> {
  const client = ensureSupabase();
  const scopedPropertyId = propertyId && propertyId !== 'all' ? propertyId : undefined;
  let query = client.from('employees').select('*').order('last_name').order('first_name');
  if (orgId) query = query.eq('org_id', orgId);
  if (scopedPropertyId) query = query.eq('property_id', scopedPropertyId);
  query = status === 'all'
    ? query.in('status', ['active', 'inactive', 'archived'])
    : query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return (data as DbEmployee[]).map(toEmployee);
}

async function fetchProperties(orgId?: string): Promise<Property[]> {
  const client = ensureSupabase();
  let query = client.from('properties').select('*').order('name');
  if (orgId) query = query.eq('org_id', orgId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as DbProperty[]).map(toProperty);
}

async function fetchProgramSettings(orgId: string): Promise<ProgramSettings | null> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from('program_settings')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle();
  if (error || !data) return null;
  return toProgramSettings(data as DbProgramSettings);
}

export function useEmployees(
  propertyId?: string,
  orgId?: string,
  status: EmployeeStatusFilter = 'active',
) {
  return useQuery({
    queryKey: ['employees', propertyId ?? 'all', orgId ?? 'all-orgs', status],
    queryFn: () => fetchEmployees(propertyId, orgId, status),
    enabled: Boolean(orgId),
    staleTime: 1000 * 60 * 30,
    placeholderData: (prev) => prev,
    retry: 3,
    retryDelay: 1000,
  });
}

export function useProperties(orgId?: string) {
  return useQuery({
    queryKey: ['properties', orgId ?? 'all-orgs'],
    queryFn: () => fetchProperties(orgId),
    enabled: Boolean(orgId),
    staleTime: 1000 * 60 * 60,
    placeholderData: (prev) => prev,
    retry: 3,
    retryDelay: 1000,
  });
}

export function useProgramSettings(orgId?: string) {
  return useQuery({
    queryKey: ['program-settings', orgId ?? 'all-orgs'],
    queryFn: () => fetchProgramSettings(orgId!),
    enabled: Boolean(orgId),
    staleTime: 1000 * 60 * 60 * 24,
    placeholderData: (prev) => prev,
    retry: 3,
    retryDelay: 1000,
  });
}

export function useTasks(_propertyId?: string, orgId?: string) {
  return useQuery({
    queryKey: ['tasks', orgId],
    queryFn: () => fetchTasks(orgId),
    enabled: !!orgId && orgId.length > 0,
    staleTime: 1000 * 60 * 60,
    placeholderData: (prev) => prev,
    retry: 3,
    retryDelay: 1000,
  });
}

export function useEquipmentUnits(propertyId?: string, orgId?: string) {
  return useQuery({
    queryKey: ['equipment-units', propertyId ?? 'all', orgId ?? 'all-orgs'],
    queryFn: () => fetchEquipmentUnits(propertyId, orgId),
    enabled: Boolean(orgId),
    staleTime: 1000 * 60 * 30,
    retry: 3,
    retryDelay: 1000,
  });
}

export function useNotes(propertyId?: string, orgId?: string) {
  return useQuery({
    queryKey: ['notes', propertyId ?? 'all', orgId ?? 'all-orgs'],
    queryFn: () => fetchNotes(propertyId, orgId),
    enabled: Boolean(orgId),
    staleTime: 1000 * 60 * 5,
    retry: 3,
    retryDelay: 1000,
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

export function useWorkLocations(propertyId?: string, orgId?: string) {
  return useQuery({
    queryKey: ['work-locations', propertyId ?? 'all', orgId ?? 'all-orgs'],
    queryFn: async () => {
      const locations = await fetchWorkLocations();
      return locations.filter((location) => {
        const propertyMatch = !propertyId || propertyId === 'all' || location.propertyId === propertyId;
        return propertyMatch;
      });
    },
    enabled: Boolean(orgId),
    staleTime: 1000 * 60 * 10,
    retry: 3,
    retryDelay: 1000,
  });
}

export function useWeatherLocations(propertyId?: string, orgId?: string, activeOnly = false) {
  return useQuery({
    queryKey: ['weather-locations', propertyId ?? 'all', orgId ?? 'all-orgs', activeOnly ? 'active' : 'all-statuses'],
    queryFn: () => fetchWeatherLocations(propertyId, orgId, activeOnly),
    enabled: Boolean(orgId),
    staleTime: 1000 * 60 * 10,
    retry: 3,
    retryDelay: 1000,
  });
}

export function useWeatherDailyLogs() {
  return useQuery({
    queryKey: ['weather-daily-logs-all'],
    queryFn: fetchAllWeatherDailyLogs,
    staleTime: 1000 * 60 * 10,
  });
}

export function useWeatherDailyLogsRange(startDate: string, endDate: string, propertyId?: string, orgId?: string) {
  return useQuery({
    queryKey: ['weather-daily-logs-range', startDate, endDate, propertyId ?? 'all', orgId ?? 'all-orgs'],
    queryFn: () => fetchWeatherDailyLogs(startDate, endDate, propertyId),
    enabled: Boolean(orgId && startDate && endDate),
    staleTime: 1000 * 60 * 5,
    retry: 3,
    retryDelay: 1000,
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

export function useDepartmentOptions(orgId?: string) {
  return useQuery({
    queryKey: ['department-options', orgId ?? 'all-orgs'],
    queryFn: () => fetchDepartmentOptions(orgId),
    enabled: Boolean(orgId),
    staleTime: 1000 * 60 * 10,
    retry: 3,
    retryDelay: 1000,
  });
}

export function useGroupOptions(orgId?: string) {
  return useQuery({
    queryKey: ['group-options', orgId ?? 'all-orgs'],
    queryFn: () => fetchGroupOptions(orgId),
    enabled: Boolean(orgId),
    staleTime: 1000 * 60 * 10,
    retry: 3,
    retryDelay: 1000,
  });
}

export function useRoleOptions(orgId?: string) {
  return useQuery({
    queryKey: ['role-options', orgId ?? 'all-orgs'],
    queryFn: () => fetchRoleOptions(orgId),
    enabled: Boolean(orgId),
    staleTime: 1000 * 60 * 10,
    retry: 3,
    retryDelay: 1000,
  });
}

export function useLanguageOptions(orgId?: string) {
  return useQuery({
    queryKey: ['language-options', orgId ?? 'all-orgs'],
    queryFn: () => fetchLanguageOptions(orgId),
    enabled: Boolean(orgId),
    staleTime: 1000 * 60 * 10,
    retry: 3,
    retryDelay: 1000,
  });
}

export function useShiftTemplates(orgId?: string) {
  return useQuery({
    queryKey: ['shift-templates', orgId ?? 'all-orgs'],
    queryFn: () => fetchShiftTemplates(orgId),
    enabled: Boolean(orgId),
    staleTime: 1000 * 60 * 10,
    retry: 3,
    retryDelay: 1000,
  });
}

export function useWorkerTypes(orgId?: string) {
  return useQuery({
    queryKey: ['worker-types', orgId ?? 'all-orgs'],
    queryFn: () => fetchWorkerTypes(orgId),
    enabled: Boolean(orgId),
    staleTime: 1000 * 60 * 10,
    retry: 3,
    retryDelay: 1000,
  });
}

export function useJobDescriptions(orgId?: string) {
  return useQuery({
    queryKey: ['job-descriptions', orgId ?? 'all-orgs'],
    queryFn: () => fetchFrameworkOptions('job_descriptions', orgId),
    enabled: Boolean(orgId),
    staleTime: 1000 * 60 * 10,
    retry: 3,
    retryDelay: 1000,
  });
}

export function useEmploymentStatuses(orgId?: string) {
  return useQuery({
    queryKey: ['employment-statuses', orgId ?? 'all-orgs'],
    queryFn: () => fetchFrameworkOptions('employment_statuses', orgId),
    enabled: Boolean(orgId),
    staleTime: 1000 * 60 * 10,
    retry: 3,
    retryDelay: 1000,
  });
}

export function useWageCategories(orgId?: string) {
  return useQuery({
    queryKey: ['wage-categories', orgId ?? 'all-orgs'],
    queryFn: () => fetchFrameworkOptions('wage_categories', orgId),
    enabled: Boolean(orgId),
    staleTime: 1000 * 60 * 10,
    retry: 3,
    retryDelay: 1000,
  });
}

export function useOvertimeRules(orgId?: string) {
  return useQuery({
    queryKey: ['overtime-rules', orgId ?? 'all-orgs'],
    queryFn: () => fetchFrameworkOptions('overtime_rules', orgId),
    enabled: Boolean(orgId),
    staleTime: 1000 * 60 * 10,
    retry: 3,
    retryDelay: 1000,
  });
}

export function useChemicalApplicationLogs(date: string, orgId?: string) {
  return useQuery({
    queryKey: ['chemical-application-logs', date, orgId ?? 'all-orgs'],
    queryFn: () => fetchChemicalApplicationLogFieldsForDate(date, orgId),
    enabled: Boolean(orgId && date),
    staleTime: 1000 * 60 * 5,
    retry: 3,
    retryDelay: 1000,
  });
}

export function useChemicalApplicationLogsRange(startDate: string, endDate: string, propertyId?: string, orgId?: string) {
  return useQuery({
    queryKey: ['chemical-application-logs-range', startDate, endDate, propertyId ?? 'all', orgId ?? 'all-orgs'],
    queryFn: () => fetchChemicalApplicationLogs(startDate, endDate, propertyId, orgId),
    enabled: Boolean(orgId && startDate && endDate),
    staleTime: 1000 * 60 * 5,
    retry: 3,
    retryDelay: 1000,
  });
}

export function useApplicationAreas(propertyId?: string) {
  return useQuery({
    queryKey: ['application-areas', propertyId ?? 'all'],
    queryFn: () => fetchApplicationAreas(propertyId),
    staleTime: 1000 * 60 * 10,
    retry: false,
  });
}

export function useChemicalProducts() {
  return useQuery({
    queryKey: ['chemical-products'],
    queryFn: fetchChemicalProducts,
    staleTime: 1000 * 60 * 10,
    retry: false,
  });
}

export function useChemicalApplicationLogsAll(orgId?: string) {
  return useQuery({
    queryKey: ['chemical-application-logs-all', orgId ?? 'all-orgs'],
    queryFn: () => fetchChemicalApplicationLogsAll(orgId),
    enabled: Boolean(orgId),
    staleTime: 1000 * 60 * 5,
    retry: 3,
    retryDelay: 1000,
  });
}

export function useChemicalApplicationTankMixItems() {
  return useQuery({
    queryKey: ['chemical-application-tank-mix-items'],
    queryFn: fetchChemicalApplicationTankMixItems,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
}

export function useClockEvents(date: string, propertyId?: string, orgId?: string) {
  return useQuery({
    queryKey: ['clock-events', date, propertyId ?? 'all', orgId ?? 'all-orgs'],
    queryFn: () => fetchClockEvents(date, propertyId, orgId),
    enabled: Boolean(date && orgId),
    staleTime: 1000 * 60 * 1,
    retry: 3,
    retryDelay: 1000,
  });
}

export function useClockEventsRange(startDate: string, endDate: string, propertyId?: string, orgId?: string) {
  return useQuery({
    queryKey: ['clock-events-range', startDate, endDate, propertyId ?? 'all', orgId ?? 'all-orgs'],
    queryFn: () => fetchClockEventsRange(startDate, endDate, propertyId, orgId),
    enabled: Boolean(startDate && endDate && orgId),
    staleTime: 1000 * 60 * 1,
    placeholderData: (prev) => prev,
    retry: 3,
    retryDelay: 1000,
  });
}

export async function updatePropertyLocation(
  propertyId: string,
  latitude: number,
  longitude: number,
  label: string,
) {
  const { error } = await ensureSupabase()
    .from('properties')
    .update({
      latitude,
      longitude,
      weather_location_label: label,
    })
    .eq('id', propertyId);

  if (error) throw error;
}
