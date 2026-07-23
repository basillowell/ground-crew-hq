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

export type PropertyProject = {
  id: string;
  orgId: string;
  propertyId: string;
  name: string;
  status: string;
  description: string;
  startDate: string | null;
  targetEndDate: string | null;
  color: string | null;
  createdAt: string;
};

export type ProjectTimelineEvent = {
  id: string;
  orgId: string;
  projectId: string;
  propertyId: string;
  eventType: string;
  title: string;
  body: string;
  eventDate: string;
  createdBy: string | null;
  createdAt: string;
};

export type BillingClient = {
  id: string;
  orgId: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  active: boolean;
  createdAt: string;
};

export type RevenueInvoice = {
  id: string;
  orgId: string;
  propertyId: string | null;
  employeeId: string | null;
  clientId: string | null;
  invoiceNumber: number;
  status: 'draft' | 'sent' | 'paid' | 'void';
  subtotal: number;
  taxRate: number;
  total: number;
  notes: string;
  createdAt: string;
  sentAt: string | null;
  paidAt: string | null;
};

export type EstimateStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';

export type RevenueEstimate = {
  id: string;
  orgId: string;
  clientId: string;
  propertyId: string | null;
  estimateNumber: number;
  status: EstimateStatus;
  subtotal: number;
  taxRate: number;
  total: number;
  notes: string;
  validUntil: string | null;
  convertedInvoiceId: string | null;
  createdAt: string;
  sentAt: string | null;
  acceptedAt: string | null;
};

export type RevenueLineItem = {
  id: string;
  orgId: string;
  parentId: string;
  catalogId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  sortOrder: number;
  createdAt: string;
};

export type ServiceCatalogItem = {
  id: string;
  orgId: string;
  name: string;
  description: string;
  defaultUnitPrice: number;
  active: boolean;
  createdAt: string;
};

type DbProject = {
  id: string;
  org_id: string;
  property_id: string;
  name: string;
  status: string;
  description: string | null;
  start_date: string | null;
  target_end_date: string | null;
  color: string | null;
  created_at: string;
};

type DbProjectTimelineEvent = {
  id: string;
  org_id: string;
  project_id: string;
  property_id: string;
  event_type: string;
  title: string;
  body: string | null;
  event_date: string;
  created_by: string | null;
  created_at: string;
};

type DbBillingClient = {
  id: string;
  org_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
};

type DbRevenueInvoice = {
  id: string;
  org_id: string;
  property_id: string | null;
  employee_id: string | null;
  client_id: string | null;
  invoice_number: number;
  status: 'draft' | 'sent' | 'paid' | 'void';
  subtotal: number | string | null;
  tax_rate: number | string | null;
  total: number | string | null;
  notes: string | null;
  created_at: string;
  sent_at: string | null;
  paid_at: string | null;
};

type DbRevenueEstimate = {
  id: string;
  org_id: string;
  client_id: string;
  property_id: string | null;
  estimate_number: number;
  status: EstimateStatus;
  subtotal: number | string | null;
  tax_rate: number | string | null;
  total: number | string | null;
  notes: string | null;
  valid_until: string | null;
  converted_invoice_id: string | null;
  created_at: string;
  sent_at: string | null;
  accepted_at: string | null;
};

type DbEstimateLineItem = {
  id: string;
  org_id: string;
  estimate_id: string;
  catalog_id: string | null;
  description: string;
  quantity: number | string | null;
  unit_price: number | string | null;
  line_total: number | string | null;
  sort_order: number | null;
  created_at: string;
};

type DbInvoiceLineItem = {
  id: string;
  org_id: string;
  invoice_id: string;
  catalog_id: string | null;
  description: string;
  quantity: number | string | null;
  unit_price: number | string | null;
  line_total: number | string | null;
  sort_order: number | null;
  created_at: string;
};

type DbServiceCatalogItem = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  default_unit_price: number | string | null;
  active: boolean;
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
function toProject(row: DbProject): PropertyProject {
  return {
    id: row.id,
    orgId: row.org_id,
    propertyId: row.property_id,
    name: row.name,
    status: row.status,
    description: row.description ?? '',
    startDate: row.start_date,
    targetEndDate: row.target_end_date,
    color: row.color,
    createdAt: row.created_at,
  };
}

function toTimelineEvent(row: DbProjectTimelineEvent): ProjectTimelineEvent {
  return {
    id: row.id,
    orgId: row.org_id,
    projectId: row.project_id,
    propertyId: row.property_id,
    eventType: row.event_type,
    title: row.title,
    body: row.body ?? '',
    eventDate: row.event_date,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function toBillingClient(row: DbBillingClient): BillingClient {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    email: row.email ?? '',
    phone: row.phone ?? '',
    address: row.address ?? '',
    notes: row.notes ?? '',
    active: row.active,
    createdAt: row.created_at,
  };
}

function toRevenueInvoice(row: DbRevenueInvoice): RevenueInvoice {
  return {
    id: row.id,
    orgId: row.org_id,
    propertyId: row.property_id,
    employeeId: row.employee_id,
    clientId: row.client_id,
    invoiceNumber: Number(row.invoice_number ?? 0),
    status: row.status,
    subtotal: Number(row.subtotal ?? 0),
    taxRate: Number(row.tax_rate ?? 0),
    total: Number(row.total ?? 0),
    notes: row.notes ?? '',
    createdAt: row.created_at,
    sentAt: row.sent_at,
    paidAt: row.paid_at,
  };
}

function toRevenueEstimate(row: DbRevenueEstimate): RevenueEstimate {
  return {
    id: row.id,
    orgId: row.org_id,
    clientId: row.client_id,
    propertyId: row.property_id,
    estimateNumber: Number(row.estimate_number ?? 0),
    status: row.status,
    subtotal: Number(row.subtotal ?? 0),
    taxRate: Number(row.tax_rate ?? 0),
    total: Number(row.total ?? 0),
    notes: row.notes ?? '',
    validUntil: row.valid_until,
    convertedInvoiceId: row.converted_invoice_id,
    createdAt: row.created_at,
    sentAt: row.sent_at,
    acceptedAt: row.accepted_at,
  };
}

function toEstimateLineItem(row: DbEstimateLineItem): RevenueLineItem {
  return {
    id: row.id,
    orgId: row.org_id,
    parentId: row.estimate_id,
    catalogId: row.catalog_id,
    description: row.description,
    quantity: Number(row.quantity ?? 0),
    unitPrice: Number(row.unit_price ?? 0),
    lineTotal: Number(row.line_total ?? 0),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: row.created_at,
  };
}

function toInvoiceLineItem(row: DbInvoiceLineItem): RevenueLineItem {
  return {
    id: row.id,
    orgId: row.org_id,
    parentId: row.invoice_id,
    catalogId: row.catalog_id,
    description: row.description,
    quantity: Number(row.quantity ?? 0),
    unitPrice: Number(row.unit_price ?? 0),
    lineTotal: Number(row.line_total ?? 0),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: row.created_at,
  };
}

function toServiceCatalogItem(row: DbServiceCatalogItem): ServiceCatalogItem {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    description: row.description ?? '',
    defaultUnitPrice: Number(row.default_unit_price ?? 0),
    active: row.active,
    createdAt: row.created_at,
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

export type ClientMutationPayload = {
  id?: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  active?: boolean;
};

export type InvoiceMutationPayload = {
  id?: string;
  propertyId: string | null;
  clientId: string;
  subtotal: number;
  taxRate: number;
  total: number;
  notes?: string | null;
};

export type EstimateMutationPayload = {
  id?: string;
  propertyId: string | null;
  clientId: string;
  subtotal: number;
  taxRate: number;
  total: number;
  notes?: string | null;
  validUntil?: string | null;
  status?: EstimateStatus;
};

export type RevenueLineItemMutationPayload = {
  id?: string;
  parentId?: string;
  catalogId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  sortOrder: number;
};

export type ServiceCatalogMutationPayload = {
  id?: string;
  name: string;
  description?: string | null;
  defaultUnitPrice: number;
  active?: boolean;
};

export type InvoiceStatusMutationPayload = {
  id: string;
  status: 'sent' | 'paid' | 'void';
};

const invoiceSelectColumns = 'id, org_id, property_id, employee_id, client_id, invoice_number, status, subtotal, tax_rate, total, notes, created_at, sent_at, paid_at';
const estimateSelectColumns = 'id, org_id, client_id, property_id, estimate_number, status, subtotal, tax_rate, total, notes, valid_until, converted_invoice_id, created_at, sent_at, accepted_at';
const estimateLineItemSelectColumns = 'id, org_id, estimate_id, catalog_id, description, quantity, unit_price, line_total, sort_order, created_at';
const invoiceLineItemSelectColumns = 'id, org_id, invoice_id, catalog_id, description, quantity, unit_price, line_total, sort_order, created_at';
const serviceCatalogSelectColumns = 'id, org_id, name, description, default_unit_price, active, created_at';

async function fetchClients(orgId: string): Promise<BillingClient[]> {
  const client = ensureSupabase();
  const timeoutPromise = new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new Error('Clients request timed out.')), 15_000);
  });
  const fetchPromise = (async () => {
    const { data, error } = await client
      .from('clients')
      .select('id, org_id, name, email, phone, address, notes, active, created_at')
      .eq('org_id', orgId)
      .order('name', { ascending: true });
    if (error) throw error;
    return ((data ?? []) as DbBillingClient[]).map(toBillingClient);
  })();

  return Promise.race([fetchPromise, timeoutPromise]);
}

async function fetchInvoices(orgId: string): Promise<RevenueInvoice[]> {
  const client = ensureSupabase();
  const timeoutPromise = new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new Error('Invoices request timed out.')), 15_000);
  });
  const fetchPromise = (async () => {
    const { data, error } = await client
      .from('invoices')
      .select(invoiceSelectColumns)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return ((data ?? []) as DbRevenueInvoice[]).map(toRevenueInvoice);
  })();

  return Promise.race([fetchPromise, timeoutPromise]);
}

async function fetchEstimates(orgId: string): Promise<RevenueEstimate[]> {
  const client = ensureSupabase();
  const timeoutPromise = new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new Error('Estimates request timed out.')), 15_000);
  });
  const fetchPromise = (async () => {
    const { data, error } = await client
      .from('estimates')
      .select(estimateSelectColumns)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return ((data ?? []) as DbRevenueEstimate[]).map(toRevenueEstimate);
  })();

  return Promise.race([fetchPromise, timeoutPromise]);
}

async function fetchEstimateLineItems(estimateId: string | undefined, orgId: string): Promise<RevenueLineItem[]> {
  const client = ensureSupabase();
  const timeoutPromise = new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new Error('Estimate line items request timed out.')), 15_000);
  });
  const fetchPromise = (async () => {
    let query = client
      .from('estimate_line_items')
      .select(estimateLineItemSelectColumns)
      .eq('org_id', orgId)
      .order('sort_order', { ascending: true });
    if (estimateId) query = query.eq('estimate_id', estimateId);
    const { data, error } = await query;
    if (error) throw error;
    return ((data ?? []) as DbEstimateLineItem[]).map(toEstimateLineItem);
  })();

  return Promise.race([fetchPromise, timeoutPromise]);
}

async function fetchInvoiceLineItems(invoiceId: string | undefined, orgId: string): Promise<RevenueLineItem[]> {
  const client = ensureSupabase();
  const timeoutPromise = new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new Error('Invoice line items request timed out.')), 15_000);
  });
  const fetchPromise = (async () => {
    let query = client
      .from('invoice_line_items')
      .select(invoiceLineItemSelectColumns)
      .eq('org_id', orgId)
      .order('sort_order', { ascending: true });
    if (invoiceId) query = query.eq('invoice_id', invoiceId);
    const { data, error } = await query;
    if (error) throw error;
    return ((data ?? []) as DbInvoiceLineItem[]).map(toInvoiceLineItem);
  })();

  return Promise.race([fetchPromise, timeoutPromise]);
}

async function fetchServiceCatalog(orgId: string): Promise<ServiceCatalogItem[]> {
  const client = ensureSupabase();
  const timeoutPromise = new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new Error('Service catalog request timed out.')), 15_000);
  });
  const fetchPromise = (async () => {
    const { data, error } = await client
      .from('service_catalog')
      .select(serviceCatalogSelectColumns)
      .eq('org_id', orgId)
      .order('name', { ascending: true });
    if (error) throw error;
    return ((data ?? []) as DbServiceCatalogItem[]).map(toServiceCatalogItem);
  })();

  return Promise.race([fetchPromise, timeoutPromise]);
}

async function createBillingClient(orgId: string, payload: ClientMutationPayload): Promise<BillingClient> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from('clients')
    .insert({
      org_id: orgId,
      name: payload.name,
      email: payload.email ?? null,
      phone: payload.phone ?? null,
      address: payload.address ?? null,
      notes: payload.notes ?? null,
      active: payload.active ?? true,
    })
    .select('id, org_id, name, email, phone, address, notes, active, created_at')
    .single();
  if (error) throw error;
  return toBillingClient(data as DbBillingClient);
}

async function updateBillingClient(orgId: string, payload: ClientMutationPayload): Promise<BillingClient> {
  if (!payload.id) throw new Error('Client id is required.');
  const client = ensureSupabase();
  const { data, error } = await client
    .from('clients')
    .update({
      name: payload.name,
      email: payload.email ?? null,
      phone: payload.phone ?? null,
      address: payload.address ?? null,
      notes: payload.notes ?? null,
      active: payload.active ?? true,
    })
    .eq('id', payload.id)
    .eq('org_id', orgId)
    .select('id, org_id, name, email, phone, address, notes, active, created_at')
    .single();
  if (error) throw error;
  return toBillingClient(data as DbBillingClient);
}

async function createRevenueInvoice(orgId: string, payload: InvoiceMutationPayload): Promise<RevenueInvoice> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from('invoices')
    .insert({
      org_id: orgId,
      property_id: payload.propertyId,
      client_id: payload.clientId,
      status: 'draft',
      subtotal: payload.subtotal,
      tax_rate: payload.taxRate,
      total: payload.total,
      notes: payload.notes ?? null,
    })
    .select(invoiceSelectColumns)
    .single();
  if (error) throw error;
  return toRevenueInvoice(data as DbRevenueInvoice);
}

async function updateRevenueInvoice(orgId: string, payload: InvoiceMutationPayload): Promise<RevenueInvoice> {
  if (!payload.id) throw new Error('Invoice id is required.');
  const client = ensureSupabase();
  const { data, error } = await client
    .from('invoices')
    .update({
      property_id: payload.propertyId,
      client_id: payload.clientId,
      subtotal: payload.subtotal,
      tax_rate: payload.taxRate,
      total: payload.total,
      notes: payload.notes ?? null,
    })
    .eq('id', payload.id)
    .eq('org_id', orgId)
    .select(invoiceSelectColumns)
    .single();
  if (error) throw error;
  return toRevenueInvoice(data as DbRevenueInvoice);
}

async function updateRevenueInvoiceStatus(orgId: string, payload: InvoiceStatusMutationPayload): Promise<RevenueInvoice> {
  const sentAt = payload.status === 'sent' ? new Date().toISOString() : undefined;
  const paidAt = payload.status === 'paid' ? new Date().toISOString() : undefined;
  const client = ensureSupabase();
  const { data, error } = await client
    .from('invoices')
    .update({
      status: payload.status,
      ...(sentAt ? { sent_at: sentAt } : {}),
      ...(paidAt ? { paid_at: paidAt } : {}),
    })
    .eq('id', payload.id)
    .eq('org_id', orgId)
    .select(invoiceSelectColumns)
    .single();
  if (error) throw error;
  return toRevenueInvoice(data as DbRevenueInvoice);
}

async function createRevenueEstimate(orgId: string, payload: EstimateMutationPayload): Promise<RevenueEstimate> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from('estimates')
    .insert({
      org_id: orgId,
      property_id: payload.propertyId,
      client_id: payload.clientId,
      status: payload.status ?? 'draft',
      subtotal: payload.subtotal,
      tax_rate: payload.taxRate,
      total: payload.total,
      notes: payload.notes ?? null,
      valid_until: payload.validUntil ?? null,
    })
    .select(estimateSelectColumns)
    .single();
  if (error) throw error;
  return toRevenueEstimate(data as DbRevenueEstimate);
}

async function updateRevenueEstimate(orgId: string, payload: EstimateMutationPayload): Promise<RevenueEstimate> {
  if (!payload.id) throw new Error('Estimate id is required.');
  const client = ensureSupabase();
  const sentAt = payload.status === 'sent' ? new Date().toISOString() : undefined;
  const { data, error } = await client
    .from('estimates')
    .update({
      property_id: payload.propertyId,
      client_id: payload.clientId,
      subtotal: payload.subtotal,
      tax_rate: payload.taxRate,
      total: payload.total,
      notes: payload.notes ?? null,
      valid_until: payload.validUntil ?? null,
      ...(payload.status ? { status: payload.status } : {}),
      ...(sentAt ? { sent_at: sentAt } : {}),
    })
    .eq('id', payload.id)
    .eq('org_id', orgId)
    .select(estimateSelectColumns)
    .single();
  if (error) throw error;
  return toRevenueEstimate(data as DbRevenueEstimate);
}

async function deleteRevenueEstimate(orgId: string, estimateId: string): Promise<void> {
  const client = ensureSupabase();
  const { error } = await client
    .from('estimates')
    .delete()
    .eq('id', estimateId)
    .eq('org_id', orgId);
  if (error) throw error;
}

async function createEstimateLineItems(
  orgId: string,
  estimateId: string,
  items: RevenueLineItemMutationPayload[],
): Promise<RevenueLineItem[]> {
  if (items.length === 0) return [];
  const client = ensureSupabase();
  const { data, error } = await client
    .from('estimate_line_items')
    .insert(items.map((item) => ({
      org_id: orgId,
      estimate_id: estimateId,
      catalog_id: item.catalogId ?? null,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      line_total: item.lineTotal,
      sort_order: item.sortOrder,
    })))
    .select(estimateLineItemSelectColumns);
  if (error) throw error;
  return ((data ?? []) as DbEstimateLineItem[]).map(toEstimateLineItem);
}

async function updateEstimateLineItem(
  orgId: string,
  payload: RevenueLineItemMutationPayload,
): Promise<RevenueLineItem> {
  if (!payload.id) throw new Error('Line item id is required.');
  const client = ensureSupabase();
  const { data, error } = await client
    .from('estimate_line_items')
    .update({
      catalog_id: payload.catalogId ?? null,
      description: payload.description,
      quantity: payload.quantity,
      unit_price: payload.unitPrice,
      line_total: payload.lineTotal,
      sort_order: payload.sortOrder,
    })
    .eq('id', payload.id)
    .eq('org_id', orgId)
    .select(estimateLineItemSelectColumns)
    .single();
  if (error) throw error;
  return toEstimateLineItem(data as DbEstimateLineItem);
}

async function deleteEstimateLineItem(orgId: string, lineItemId: string): Promise<void> {
  const client = ensureSupabase();
  const { error } = await client
    .from('estimate_line_items')
    .delete()
    .eq('id', lineItemId)
    .eq('org_id', orgId);
  if (error) throw error;
}

async function replaceEstimateLineItems(
  orgId: string,
  estimateId: string,
  items: RevenueLineItemMutationPayload[],
): Promise<RevenueLineItem[]> {
  const client = ensureSupabase();
  const { error: deleteError } = await client
    .from('estimate_line_items')
    .delete()
    .eq('estimate_id', estimateId)
    .eq('org_id', orgId);
  if (deleteError) throw deleteError;
  return createEstimateLineItems(orgId, estimateId, items);
}

async function createInvoiceLineItems(
  orgId: string,
  invoiceId: string,
  items: RevenueLineItemMutationPayload[],
): Promise<RevenueLineItem[]> {
  if (items.length === 0) return [];
  const client = ensureSupabase();
  const { data, error } = await client
    .from('invoice_line_items')
    .insert(items.map((item) => ({
      org_id: orgId,
      invoice_id: invoiceId,
      catalog_id: item.catalogId ?? null,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      line_total: item.lineTotal,
      sort_order: item.sortOrder,
    })))
    .select(invoiceLineItemSelectColumns);
  if (error) throw error;
  return ((data ?? []) as DbInvoiceLineItem[]).map(toInvoiceLineItem);
}

async function updateInvoiceLineItem(
  orgId: string,
  payload: RevenueLineItemMutationPayload,
): Promise<RevenueLineItem> {
  if (!payload.id) throw new Error('Line item id is required.');
  const client = ensureSupabase();
  const { data, error } = await client
    .from('invoice_line_items')
    .update({
      catalog_id: payload.catalogId ?? null,
      description: payload.description,
      quantity: payload.quantity,
      unit_price: payload.unitPrice,
      line_total: payload.lineTotal,
      sort_order: payload.sortOrder,
    })
    .eq('id', payload.id)
    .eq('org_id', orgId)
    .select(invoiceLineItemSelectColumns)
    .single();
  if (error) throw error;
  return toInvoiceLineItem(data as DbInvoiceLineItem);
}

async function deleteInvoiceLineItem(orgId: string, lineItemId: string): Promise<void> {
  const client = ensureSupabase();
  const { error } = await client
    .from('invoice_line_items')
    .delete()
    .eq('id', lineItemId)
    .eq('org_id', orgId);
  if (error) throw error;
}

async function replaceInvoiceLineItems(
  orgId: string,
  invoiceId: string,
  items: RevenueLineItemMutationPayload[],
): Promise<RevenueLineItem[]> {
  const client = ensureSupabase();
  const { error: deleteError } = await client
    .from('invoice_line_items')
    .delete()
    .eq('invoice_id', invoiceId)
    .eq('org_id', orgId);
  if (deleteError) throw deleteError;
  return createInvoiceLineItems(orgId, invoiceId, items);
}

async function createServiceCatalogItem(orgId: string, payload: ServiceCatalogMutationPayload): Promise<ServiceCatalogItem> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from('service_catalog')
    .insert({
      org_id: orgId,
      name: payload.name,
      description: payload.description ?? null,
      default_unit_price: payload.defaultUnitPrice,
      active: payload.active ?? true,
    })
    .select(serviceCatalogSelectColumns)
    .single();
  if (error) throw error;
  return toServiceCatalogItem(data as DbServiceCatalogItem);
}

async function updateServiceCatalogItem(orgId: string, payload: ServiceCatalogMutationPayload): Promise<ServiceCatalogItem> {
  if (!payload.id) throw new Error('Catalog item id is required.');
  const client = ensureSupabase();
  const { data, error } = await client
    .from('service_catalog')
    .update({
      name: payload.name,
      description: payload.description ?? null,
      default_unit_price: payload.defaultUnitPrice,
      active: payload.active ?? true,
    })
    .eq('id', payload.id)
    .eq('org_id', orgId)
    .select(serviceCatalogSelectColumns)
    .single();
  if (error) throw error;
  return toServiceCatalogItem(data as DbServiceCatalogItem);
}

async function deleteServiceCatalogItem(orgId: string, catalogItemId: string): Promise<void> {
  const client = ensureSupabase();
  const { error } = await client
    .from('service_catalog')
    .delete()
    .eq('id', catalogItemId)
    .eq('org_id', orgId);
  if (error) throw error;
}

async function convertEstimateToInvoice(targetEstimateId: string): Promise<string> {
  const client = ensureSupabase();
  const { data, error } = await client.rpc('convert_estimate_to_invoice', { target_estimate_id: targetEstimateId });
  if (error) throw error;
  return String(data);
}

export function useClients(orgId?: string) {
  return useQuery({
    queryKey: ['clients', orgId ?? 'all-orgs'],
    queryFn: () => fetchClients(orgId!),
    enabled: Boolean(orgId),
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev,
    retry: 2,
    retryDelay: 1000,
  });
}

export function useInvoices(orgId?: string) {
  return useQuery({
    queryKey: ['invoices', orgId ?? 'all-orgs'],
    queryFn: () => fetchInvoices(orgId!),
    enabled: Boolean(orgId),
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev,
    retry: 2,
    retryDelay: 1000,
  });
}

export function useEstimates(orgId?: string) {
  return useQuery({
    queryKey: ['estimates', orgId ?? 'all-orgs'],
    queryFn: () => fetchEstimates(orgId!),
    enabled: Boolean(orgId),
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev,
    retry: 2,
    retryDelay: 1000,
  });
}

export function useEstimateLineItems(estimateId?: string, orgId?: string) {
  return useQuery({
    queryKey: ['estimate-line-items', orgId ?? 'all-orgs', estimateId ?? 'all-estimates'],
    queryFn: () => fetchEstimateLineItems(estimateId, orgId!),
    enabled: Boolean(orgId),
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev,
    retry: 2,
    retryDelay: 1000,
  });
}

export function useInvoiceLineItems(invoiceId?: string, orgId?: string) {
  return useQuery({
    queryKey: ['invoice-line-items', orgId ?? 'all-orgs', invoiceId ?? 'all-invoices'],
    queryFn: () => fetchInvoiceLineItems(invoiceId, orgId!),
    enabled: Boolean(orgId),
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev,
    retry: 2,
    retryDelay: 1000,
  });
}

export function useServiceCatalog(orgId?: string) {
  return useQuery({
    queryKey: ['service-catalog', orgId ?? 'all-orgs'],
    queryFn: () => fetchServiceCatalog(orgId!),
    enabled: Boolean(orgId),
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev,
    retry: 2,
    retryDelay: 1000,
  });
}

export function useCreateClient(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ClientMutationPayload) => {
      if (!orgId) throw new Error('Organization is required to create a client.');
      return createBillingClient(orgId, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['clients', orgId ?? 'all-orgs'] });
    },
  });
}

export function useUpdateClient(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ClientMutationPayload) => {
      if (!orgId) throw new Error('Organization is required to update a client.');
      return updateBillingClient(orgId, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['clients', orgId ?? 'all-orgs'] });
    },
  });
}

export function useCreateInvoice(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: InvoiceMutationPayload) => {
      if (!orgId) throw new Error('Organization is required to create an invoice.');
      return createRevenueInvoice(orgId, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['invoices', orgId ?? 'all-orgs'] });
    },
  });
}

export function useUpdateInvoice(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: InvoiceMutationPayload) => {
      if (!orgId) throw new Error('Organization is required to update an invoice.');
      return updateRevenueInvoice(orgId, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['invoices', orgId ?? 'all-orgs'] });
    },
  });
}

export function useUpdateInvoiceStatus(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: InvoiceStatusMutationPayload) => {
      if (!orgId) throw new Error('Organization is required to update an invoice.');
      return updateRevenueInvoiceStatus(orgId, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['invoices', orgId ?? 'all-orgs'] });
    },
  });
}

export function useCreateEstimate(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: EstimateMutationPayload) => {
      if (!orgId) throw new Error('Organization is required to create an estimate.');
      return createRevenueEstimate(orgId, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['estimates', orgId ?? 'all-orgs'] });
    },
  });
}

export function useUpdateEstimate(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: EstimateMutationPayload) => {
      if (!orgId) throw new Error('Organization is required to update an estimate.');
      return updateRevenueEstimate(orgId, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['estimates', orgId ?? 'all-orgs'] });
    },
  });
}

export function useDeleteEstimate(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (estimateId: string) => {
      if (!orgId) throw new Error('Organization is required to delete an estimate.');
      return deleteRevenueEstimate(orgId, estimateId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['estimates', orgId ?? 'all-orgs'] });
      await queryClient.invalidateQueries({ queryKey: ['estimate-line-items', orgId ?? 'all-orgs'] });
    },
  });
}

export function useCreateEstimateLineItems(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ estimateId, items }: { estimateId: string; items: RevenueLineItemMutationPayload[] }) => {
      if (!orgId) throw new Error('Organization is required to create estimate line items.');
      return createEstimateLineItems(orgId, estimateId, items);
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['estimate-line-items', orgId ?? 'all-orgs'] });
      await queryClient.invalidateQueries({ queryKey: ['estimate-line-items', orgId ?? 'all-orgs', variables.estimateId] });
    },
  });
}

export function useUpdateEstimateLineItem(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RevenueLineItemMutationPayload) => {
      if (!orgId) throw new Error('Organization is required to update an estimate line item.');
      return updateEstimateLineItem(orgId, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['estimate-line-items', orgId ?? 'all-orgs'] });
    },
  });
}

export function useDeleteEstimateLineItem(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (lineItemId: string) => {
      if (!orgId) throw new Error('Organization is required to delete an estimate line item.');
      return deleteEstimateLineItem(orgId, lineItemId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['estimate-line-items', orgId ?? 'all-orgs'] });
    },
  });
}

export function useReplaceEstimateLineItems(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ estimateId, items }: { estimateId: string; items: RevenueLineItemMutationPayload[] }) => {
      if (!orgId) throw new Error('Organization is required to save estimate line items.');
      return replaceEstimateLineItems(orgId, estimateId, items);
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['estimate-line-items', orgId ?? 'all-orgs'] });
      await queryClient.invalidateQueries({ queryKey: ['estimate-line-items', orgId ?? 'all-orgs', variables.estimateId] });
    },
  });
}

export function useCreateInvoiceLineItems(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, items }: { invoiceId: string; items: RevenueLineItemMutationPayload[] }) => {
      if (!orgId) throw new Error('Organization is required to create invoice line items.');
      return createInvoiceLineItems(orgId, invoiceId, items);
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['invoice-line-items', orgId ?? 'all-orgs'] });
      await queryClient.invalidateQueries({ queryKey: ['invoice-line-items', orgId ?? 'all-orgs', variables.invoiceId] });
    },
  });
}

export function useUpdateInvoiceLineItem(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RevenueLineItemMutationPayload) => {
      if (!orgId) throw new Error('Organization is required to update an invoice line item.');
      return updateInvoiceLineItem(orgId, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['invoice-line-items', orgId ?? 'all-orgs'] });
    },
  });
}

export function useDeleteInvoiceLineItem(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (lineItemId: string) => {
      if (!orgId) throw new Error('Organization is required to delete an invoice line item.');
      return deleteInvoiceLineItem(orgId, lineItemId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['invoice-line-items', orgId ?? 'all-orgs'] });
    },
  });
}

export function useReplaceInvoiceLineItems(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, items }: { invoiceId: string; items: RevenueLineItemMutationPayload[] }) => {
      if (!orgId) throw new Error('Organization is required to save invoice line items.');
      return replaceInvoiceLineItems(orgId, invoiceId, items);
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['invoice-line-items', orgId ?? 'all-orgs'] });
      await queryClient.invalidateQueries({ queryKey: ['invoice-line-items', orgId ?? 'all-orgs', variables.invoiceId] });
    },
  });
}

export function useCreateServiceCatalogItem(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ServiceCatalogMutationPayload) => {
      if (!orgId) throw new Error('Organization is required to create a catalog item.');
      return createServiceCatalogItem(orgId, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['service-catalog', orgId ?? 'all-orgs'] });
    },
  });
}

export function useUpdateServiceCatalogItem(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ServiceCatalogMutationPayload) => {
      if (!orgId) throw new Error('Organization is required to update a catalog item.');
      return updateServiceCatalogItem(orgId, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['service-catalog', orgId ?? 'all-orgs'] });
    },
  });
}

export function useDeleteServiceCatalogItem(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (catalogItemId: string) => {
      if (!orgId) throw new Error('Organization is required to delete a catalog item.');
      return deleteServiceCatalogItem(orgId, catalogItemId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['service-catalog', orgId ?? 'all-orgs'] });
    },
  });
}

export function useConvertEstimate(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (targetEstimateId: string) => convertEstimateToInvoice(targetEstimateId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['estimates', orgId ?? 'all-orgs'] });
      await queryClient.invalidateQueries({ queryKey: ['invoices', orgId ?? 'all-orgs'] });
      await queryClient.invalidateQueries({ queryKey: ['estimate-line-items', orgId ?? 'all-orgs'] });
      await queryClient.invalidateQueries({ queryKey: ['invoice-line-items', orgId ?? 'all-orgs'] });
    },
  });
}
type ProjectMutationPayload = {
  id?: string;
  propertyId: string;
  name: string;
  status: string;
  description?: string | null;
  startDate?: string | null;
  targetEndDate?: string | null;
  color?: string | null;
};

type TimelineEventMutationPayload = {
  id?: string;
  projectId: string;
  propertyId: string;
  eventType: string;
  title: string;
  body?: string | null;
  eventDate: string;
  createdBy?: string | null;
};

async function fetchProjects(propertyId: string, orgId?: string): Promise<PropertyProject[]> {
  const client = ensureSupabase();
  const timeoutPromise = new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new Error('Projects request timed out.')), 15_000);
  });
  const fetchPromise = (async () => {
    let query = client
      .from('projects')
      .select('id, org_id, property_id, name, status, description, start_date, target_end_date, color, created_at')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false });
    if (orgId) query = query.eq('org_id', orgId);
    const { data, error } = await query;
    if (error) throw error;
    return ((data ?? []) as DbProject[]).map(toProject);
  })();

  return Promise.race([fetchPromise, timeoutPromise]);
}

async function fetchTimelineEvents(projectId: string, orgId?: string): Promise<ProjectTimelineEvent[]> {
  const client = ensureSupabase();
  const timeoutPromise = new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new Error('Timeline events request timed out.')), 15_000);
  });
  const fetchPromise = (async () => {
    let query = client
      .from('project_timeline_events')
      .select('id, org_id, project_id, property_id, event_type, title, body, event_date, created_by, created_at')
      .eq('project_id', projectId)
      .order('event_date', { ascending: true })
      .order('created_at', { ascending: true });
    if (orgId) query = query.eq('org_id', orgId);
    const { data, error } = await query;
    if (error) throw error;
    return ((data ?? []) as DbProjectTimelineEvent[]).map(toTimelineEvent);
  })();

  return Promise.race([fetchPromise, timeoutPromise]);
}

async function createProject(orgId: string, payload: ProjectMutationPayload): Promise<PropertyProject> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from('projects')
    .insert({
      org_id: orgId,
      property_id: payload.propertyId,
      name: payload.name,
      status: payload.status,
      description: payload.description ?? null,
      start_date: payload.startDate ?? null,
      target_end_date: payload.targetEndDate ?? null,
      color: payload.color ?? null,
    })
    .select('id, org_id, property_id, name, status, description, start_date, target_end_date, color, created_at')
    .single();
  if (error) throw error;
  return toProject(data as DbProject);
}

async function updateProject(orgId: string, payload: ProjectMutationPayload): Promise<PropertyProject> {
  if (!payload.id) throw new Error('Project id is required.');
  const client = ensureSupabase();
  const { data, error } = await client
    .from('projects')
    .update({
      name: payload.name,
      status: payload.status,
      description: payload.description ?? null,
      start_date: payload.startDate ?? null,
      target_end_date: payload.targetEndDate ?? null,
      color: payload.color ?? null,
    })
    .eq('id', payload.id)
    .eq('property_id', payload.propertyId)
    .eq('org_id', orgId)
    .select('id, org_id, property_id, name, status, description, start_date, target_end_date, color, created_at')
    .single();
  if (error) throw error;
  return toProject(data as DbProject);
}

async function deleteProject(orgId: string, propertyId: string, projectId: string) {
  const client = ensureSupabase();
  const { error } = await client
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('property_id', propertyId)
    .eq('org_id', orgId);
  if (error) throw error;
}

async function createTimelineEvent(orgId: string, payload: TimelineEventMutationPayload): Promise<ProjectTimelineEvent> {
  const client = ensureSupabase();
  const { data, error } = await client
    .from('project_timeline_events')
    .insert({
      org_id: orgId,
      project_id: payload.projectId,
      property_id: payload.propertyId,
      event_type: payload.eventType,
      title: payload.title,
      body: payload.body ?? null,
      event_date: payload.eventDate,
      created_by: payload.createdBy ?? null,
    })
    .select('id, org_id, project_id, property_id, event_type, title, body, event_date, created_by, created_at')
    .single();
  if (error) throw error;
  return toTimelineEvent(data as DbProjectTimelineEvent);
}

async function updateTimelineEvent(orgId: string, payload: TimelineEventMutationPayload): Promise<ProjectTimelineEvent> {
  if (!payload.id) throw new Error('Timeline event id is required.');
  const client = ensureSupabase();
  const { data, error } = await client
    .from('project_timeline_events')
    .update({
      event_type: payload.eventType,
      title: payload.title,
      body: payload.body ?? null,
      event_date: payload.eventDate,
    })
    .eq('id', payload.id)
    .eq('project_id', payload.projectId)
    .eq('property_id', payload.propertyId)
    .eq('org_id', orgId)
    .select('id, org_id, project_id, property_id, event_type, title, body, event_date, created_by, created_at')
    .single();
  if (error) throw error;
  return toTimelineEvent(data as DbProjectTimelineEvent);
}

async function deleteTimelineEvent(orgId: string, propertyId: string, projectId: string, eventId: string) {
  const client = ensureSupabase();
  const { error } = await client
    .from('project_timeline_events')
    .delete()
    .eq('id', eventId)
    .eq('project_id', projectId)
    .eq('property_id', propertyId)
    .eq('org_id', orgId);
  if (error) throw error;
}

export function useProjects(propertyId?: string, orgId?: string) {
  return useQuery({
    queryKey: ['projects', propertyId ?? 'no-property', orgId ?? 'all-orgs'],
    queryFn: () => fetchProjects(propertyId!, orgId),
    enabled: Boolean(propertyId && propertyId !== 'all' && orgId),
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev,
    retry: 2,
    retryDelay: 1000,
  });
}

export function useTimelineEvents(projectId?: string, orgId?: string) {
  return useQuery({
    queryKey: ['project-timeline-events', projectId ?? 'no-project', orgId ?? 'all-orgs'],
    queryFn: () => fetchTimelineEvents(projectId!, orgId),
    enabled: Boolean(projectId && orgId),
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev,
    retry: 2,
    retryDelay: 1000,
  });
}

export function useCreateProject(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProjectMutationPayload) => {
      if (!orgId) throw new Error('Organization is required to create a project.');
      return createProject(orgId, payload);
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['projects', variables.propertyId, orgId ?? 'all-orgs'] });
    },
  });
}

export function useUpdateProject(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProjectMutationPayload) => {
      if (!orgId) throw new Error('Organization is required to update a project.');
      return updateProject(orgId, payload);
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['projects', variables.propertyId, orgId ?? 'all-orgs'] });
    },
  });
}

export function useDeleteProject(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ propertyId, projectId }: { propertyId: string; projectId: string }) => {
      if (!orgId) throw new Error('Organization is required to delete a project.');
      return deleteProject(orgId, propertyId, projectId);
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['projects', variables.propertyId, orgId ?? 'all-orgs'] });
      await queryClient.invalidateQueries({ queryKey: ['project-timeline-events'] });
    },
  });
}

export function useCreateTimelineEvent(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TimelineEventMutationPayload) => {
      if (!orgId) throw new Error('Organization is required to create a timeline event.');
      return createTimelineEvent(orgId, payload);
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['project-timeline-events', variables.projectId, orgId ?? 'all-orgs'] });
    },
  });
}

export function useUpdateTimelineEvent(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TimelineEventMutationPayload) => {
      if (!orgId) throw new Error('Organization is required to update a timeline event.');
      return updateTimelineEvent(orgId, payload);
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['project-timeline-events', variables.projectId, orgId ?? 'all-orgs'] });
    },
  });
}

export function useDeleteTimelineEvent(orgId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ propertyId, projectId, eventId }: { propertyId: string; projectId: string; eventId: string }) => {
      if (!orgId) throw new Error('Organization is required to delete a timeline event.');
      return deleteTimelineEvent(orgId, propertyId, projectId, eventId);
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['project-timeline-events', variables.projectId, orgId ?? 'all-orgs'] });
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


