import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  WorkLocation,
} from '@/data/seedData';
import { createClient } from '@/lib/supabase';
import { parseThemeDarkness } from '@/lib/colorThemes';

const supabase = createClient();

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

export type PropertyBoundaryGeoJson = {
  type: 'Polygon';
  coordinates: number[][][];
};

export type PropertyBoundary = {
  id: string;
  orgId: string | null;
  name: string;
  shortName: string;
  color: string;
  acreage: number;
  calculatedAcreage: number | null;
  latitude: number | null;
  longitude: number | null;
  boundaryGeojson: PropertyBoundaryGeoJson | null;
};

type DbPropertyBoundary = {
  id: string;
  org_id: string | null;
  name: string;
  short_name: string | null;
  color: string | null;
  acreage: number | null;
  latitude: number | null;
  longitude: number | null;
  boundary_geojson: unknown;
  calculated_acreage: number | null;
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

export type EmployeeEquipmentHistoryRow = {
  id: string;
  date: string;
  equipment_unit_id: string | null;
  actual_hours: number | null;
  title: string | null;
  task_id: string | null;
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
  property_id: string | null;
  name: string;
  type: string;
  status: string;
  location: string | null;
  last_serviced: string | null;
  created_at: string;
  estimated_hours?: number | null;
  qr_token?: string | null;
  maintenance_interval_hours?: number | null;
  hours_at_last_service?: number | null;
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
  theme_darkness: unknown;
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

function isPropertyBoundaryGeoJson(value: unknown): value is PropertyBoundaryGeoJson {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { type?: unknown; coordinates?: unknown };
  if (candidate.type !== 'Polygon' || !Array.isArray(candidate.coordinates)) return false;
  return candidate.coordinates.every((ring) =>
    Array.isArray(ring) &&
    ring.every((point) =>
      Array.isArray(point) &&
      point.length >= 2 &&
      typeof point[0] === 'number' &&
      typeof point[1] === 'number',
    ),
  );
}

function toPropertyBoundary(row: DbPropertyBoundary): PropertyBoundary {
  return {
    id: row.id,
    orgId: row.org_id ?? null,
    name: row.name,
    shortName: row.short_name ?? row.name,
    color: row.color ?? '#166534',
    acreage: Number(row.acreage ?? 0),
    calculatedAcreage: row.calculated_acreage === null ? null : Number(row.calculated_acreage),
    latitude: row.latitude,
    longitude: row.longitude,
    boundaryGeojson: isPropertyBoundaryGeoJson(row.boundary_geojson) ? row.boundary_geojson : null,
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
    hours: Number(row.estimated_hours ?? 0),
    lastService: row.last_serviced ?? '',
    nextService: row.last_serviced ?? '',
    propertyId: row.property_id ?? undefined,
    qrToken: row.qr_token ?? undefined,
    estimatedHours: Number(row.estimated_hours ?? 0),
    maintenanceIntervalHours: row.maintenance_interval_hours == null ? null : Number(row.maintenance_interval_hours),
    hoursAtLastService: row.hours_at_last_service == null ? null : Number(row.hours_at_last_service),
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
    themeDarkness: parseThemeDarkness(row.theme_darkness),
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


function toApplicationArea(row: DbApplicationArea): ApplicationArea {
  return {
    id: row.id,
    name: row.name,
    property: row.property,
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

async function fetchEmployeeEquipmentHistory(employeeId: string, orgId?: string): Promise<EmployeeEquipmentHistoryRow[]> {
  const client = ensureSupabase();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);
  try {
    let query = client
      .from('assignments')
      .select('id, date, equipment_unit_id, actual_hours, title, task_id')
      .eq('employee_id', employeeId)
      .not('equipment_unit_id', 'is', null)
      .order('date', { ascending: false })
      .limit(3);
    if (orgId) query = query.eq('org_id', orgId);
    const { data, error } = await query.abortSignal(controller.signal);
    if (error) throw error;
    return (data ?? []) as EmployeeEquipmentHistoryRow[];
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('Employee equipment history request timed out after 15 seconds.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);
  try {
    let query = client.from('equipment_units').select('*').order('name');
    if (orgId) query = query.eq('org_id', orgId);
    if (scopedPropertyId) query = query.or(`property_id.is.null,property_id.eq.${scopedPropertyId}`);
    const { data, error } = await query.abortSignal(controller.signal);
    if (error) throw error;
    return (data as DbEquipmentUnit[]).map(toEquipmentUnit);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('Equipment units request timed out after 15 seconds.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
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


async function fetchPropertyClassOptions(): Promise<PropertyClassOption[]> {
  const rows = await fetchOptionalRows<DbPropertyClassOption>('property_class_options', 'name');
  return rows.map(toPropertyClassOption);
}

async function fetchWorkLocations(): Promise<WorkLocation[]> {
  const rows = await fetchOptionalRows<DbWorkLocation>('work_locations', 'name');
  return rows.map(toWorkLocation);
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
): Promise<Array<{ applicatorLicenseNumber?: string | null; supervisorLicenseNumber?: string | null }>> {
  try {
    const client = ensureSupabase();
    let query = client
      .from('chemical_application_logs')
      .select('applicator_license_number, supervisor_license_number, application_date')
      .eq('application_date', date);
    if (orgId) query = query.eq('org_id', orgId);
    const { data, error } = await query;
    if (error) return [];
    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
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
    structuralSharing: false,
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
    structuralSharing: false,
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

export function useEmployeeEquipmentHistory(employeeId?: string, orgId?: string) {
  return useQuery({
    queryKey: ['employee-equipment-history', employeeId ?? 'no-employee', orgId ?? 'all-orgs'],
    queryFn: () => fetchEmployeeEquipmentHistory(employeeId!, orgId),
    enabled: Boolean(employeeId && orgId),
    staleTime: 1000 * 60 * 3,
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
  let query = client.from('properties').select('*').order('sort_order', { ascending: true });
  if (orgId) query = query.eq('org_id', orgId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as DbProperty[]).map(toProperty);
}

async function fetchPropertyBoundaries(orgId?: string): Promise<PropertyBoundary[]> {
  const client = ensureSupabase();
  const timeoutPromise = new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new Error('Property boundaries request timed out.')), 15_000);
  });
  const fetchPromise = (async () => {
    let query = client
      .from('properties')
      .select('id, org_id, name, short_name, color, acreage, latitude, longitude, boundary_geojson, calculated_acreage')
      .order('sort_order', { ascending: true });
    if (orgId) query = query.eq('org_id', orgId);
    const { data, error } = await query;
    if (error) throw error;
    return ((data ?? []) as DbPropertyBoundary[]).map(toPropertyBoundary);
  })();

  return Promise.race([fetchPromise, timeoutPromise]);
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

export function usePropertyBoundaries(orgId?: string) {
  return useQuery({
    queryKey: ['property-boundaries', orgId ?? 'all-orgs'],
    queryFn: () => fetchPropertyBoundaries(orgId),
    enabled: Boolean(orgId),
    staleTime: 1000 * 60 * 10,
    placeholderData: (prev) => prev,
    retry: 2,
    retryDelay: 1000,
  });
}

type SavePropertyBoundaryPayload = {
  propertyId: string;
  boundaryGeojson: PropertyBoundaryGeoJson | null;
};

async function savePropertyBoundary(orgId: string, payload: SavePropertyBoundaryPayload) {
  const client = ensureSupabase();
  const { error } = await client
    .from('properties')
    .update({ boundary_geojson: payload.boundaryGeojson })
    .eq('id', payload.propertyId)
    .eq('org_id', orgId);
  if (error) throw error;
}

export function useSavePropertyBoundary(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SavePropertyBoundaryPayload) => {
      if (!orgId) throw new Error('Organization is required to save a property boundary.');
      return savePropertyBoundary(orgId, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['property-boundaries', orgId ?? 'all-orgs'] });
      await queryClient.invalidateQueries({ queryKey: ['properties', orgId ?? 'all-orgs'] });
    },
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
    enabled: typeof orgId === 'string' && orgId.length > 0,
    staleTime: 1000 * 60 * 60,
    placeholderData: (prev) => prev,
    structuralSharing: false,
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

type EquipmentUsageMutationPayload = {
  unitId: string;
  orgId: string;
  estimatedHours: number;
};

type EquipmentIssueMutationPayload = {
  unitId: string;
  orgId: string;
  notes?: string | null;
};

type EquipmentServiceMutationPayload = {
  unitId: string;
  orgId: string;
  estimatedHours: number;
};

async function updateEquipmentUsage({ unitId, orgId, estimatedHours }: EquipmentUsageMutationPayload) {
  const client = ensureSupabase();
  const { data, error } = await client
    .from('equipment_units')
    .update({ estimated_hours: estimatedHours, org_id: orgId })
    .eq('id', unitId)
    .eq('org_id', orgId)
    .select('*')
    .single();
  if (error) throw error;
  return toEquipmentUnit(data as DbEquipmentUnit);
}

async function flagEquipmentIssue({ unitId, orgId, notes }: EquipmentIssueMutationPayload) {
  const client = ensureSupabase();
  const payload: Record<string, unknown> = { status: 'maintenance', active: true, org_id: orgId };
  if (notes && notes.trim()) payload.notes = notes.trim();
  const { data, error } = await client
    .from('equipment_units')
    .update(payload)
    .eq('id', unitId)
    .eq('org_id', orgId)
    .select('*')
    .single();
  if (error) throw error;
  return toEquipmentUnit(data as DbEquipmentUnit);
}

async function logEquipmentService({ unitId, orgId, estimatedHours }: EquipmentServiceMutationPayload) {
  const client = ensureSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await client
    .from('equipment_units')
    .update({ hours_at_last_service: estimatedHours, last_serviced: today, status: 'available', active: true, org_id: orgId })
    .eq('id', unitId)
    .eq('org_id', orgId)
    .select('*')
    .single();
  if (error) throw error;
  return toEquipmentUnit(data as DbEquipmentUnit);
}
export function useUpdateEquipmentUsage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateEquipmentUsage,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['equipment-units'] });
      void queryClient.invalidateQueries({ queryKey: ['equipment-page-data', variables.orgId] });
    },
  });
}

export function useFlagEquipmentIssue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: flagEquipmentIssue,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['equipment-units'] });
      void queryClient.invalidateQueries({ queryKey: ['equipment-page-data', variables.orgId] });
    },
  });
}

export function useLogEquipmentService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logEquipmentService,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['equipment-units'] });
      void queryClient.invalidateQueries({ queryKey: ['equipment-page-data', variables.orgId] });
    },
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


