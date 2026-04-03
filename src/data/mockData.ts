// Legacy compatibility layer: app code should prefer importing seed values from `@/data/seedData`.

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  propertyId?: string;
  group: string;
  role: string;
  wage: number;
  phone: string;
  email: string;
  photo: string;
  status: 'active' | 'inactive';
  department: string;
  language: string;
  workerType: 'full-time' | 'part-time' | 'seasonal';
  hireDate: string;
  defaultLocationId?: string;
  shiftTemplateId?: string;
  portalEnabled?: boolean;
  loginEmail?: string;
  loginPassword?: string;
  appRole?: 'admin' | 'manager' | 'supervisor' | 'crew';
}

export interface Task {
  id: string;
  name: string;
  category: string;
  duration: number; // minutes
  color: string;
  icon: string;
  status?: 'active' | 'inactive' | 'archived';
  priority?: number;
  skillTags?: string[];
  equipmentTags?: string[];
  notes?: string;
}

export interface EquipmentType {
  id: string;
  name: string;
  category: string;
  totalUnits: number;
  activeUnits: number;
  inRepair: number;
}

export interface EquipmentUnit {
  id: string;
  typeId: string;
  unitNumber: string;
  status: 'available' | 'in-use' | 'maintenance' | 'out-of-service';
  assignedTo?: string;
  location: string;
  hours: number;
  lastService: string;
  nextService: string;
}

export interface WorkOrder {
  id: string;
  unitId: string;
  title: string;
  description: string;
  status: 'open' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  createdDate: string;
  completedDate?: string;
  cost: number;
}

export interface ScheduleEntry {
  id: string;
  employeeId: string;
  date: string;
  shiftStart: string;
  shiftEnd: string;
  status: 'scheduled' | 'day-off' | 'vacation' | 'sick';
}

export interface Note {
  id: string;
  type: 'daily' | 'general' | 'geo' | 'alert';
  title: string;
  content: string;
  author: string;
  date: string;
  location?: string;
}

export interface Assignment {
  id?: string;
  employeeId: string;
  taskId: string;
  equipmentId?: string;
  date: string;
  startTime: string;
  duration: number;
  area: string;
}

export interface WeatherLocation {
  id: string;
  name: string;
  property: string;
  propertyId?: string;
  area: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

export interface WeatherStation {
  id: string;
  locationId: string;
  name: string;
  provider: string;
  providerType?: 'manual' | 'open-meteo' | 'davis' | 'noaa' | 'airport';
  stationCode: string;
  latitude?: number;
  longitude?: number;
  timeZone?: string;
  stationCategory?: 'property' | 'airport' | 'regional-grid' | 'manual';
  distanceMiles?: number;
  isPrimary: boolean;
  status: 'online' | 'offline';
}

export interface WeatherStationSuggestion {
  id: string;
  name: string;
  provider: string;
  providerType: 'open-meteo' | 'noaa' | 'airport';
  stationCode: string;
  latitude: number;
  longitude: number;
  timeZone: string;
  stationCategory: 'airport' | 'regional-grid';
  distanceMiles?: number;
  reason: string;
}

export interface WeatherDailyLog {
  id: string;
  locationId: string;
  stationId?: string;
  date: string;
  currentConditions: string;
  forecast: string;
  rainfallTotal: number;
  temperature: number;
  humidity: number;
  wind: number;
  et: number;
  source: 'station' | 'manual-override';
  notes?: string;
}

export interface ManualRainfallEntry {
  id: string;
  locationId: string;
  date: string;
  rainfallAmount: number;
  enteredBy: string;
  notes?: string;
}

export interface ChemicalProduct {
  id: string;
  name: string;
  productType: string;
  targetUse: string;
  rateUnit: string;
  epaRegistrationNumber?: string;
  formulation?: string;
  signalWord?: string;
  restrictedUse?: boolean;
  reentryIntervalHours?: number;
  preHarvestIntervalHours?: number;
  defaultApplicationMethod?: string;
}

export interface ApplicationArea {
  id: string;
  name: string;
  property: string;
  weatherLocationId: string;
}

export interface ChemicalApplicationLog {
  id: string;
  applicationDate: string;
  startTime: string;
  endTime: string;
  applicationTimestamp?: string;
  areaId: string;
  targetPest: string;
  agronomicPurpose: string;
  applicationMethod?: string;
  carrierVolume: number;
  totalMixVolume?: number;
  areaTreated: number;
  areaUnit: string;
  applicatorId: string;
  applicatorLicenseNumber?: string;
  supervisorName?: string;
  supervisorLicenseNumber?: string;
  equipmentUsedId?: string;
  weatherLogId?: string;
  weatherConditionsSummary?: string;
  windDirection?: string;
  windSpeedAtApplication?: number;
  temperatureAtApplication?: number;
  humidityAtApplication?: number;
  restrictedEntryUntil?: string;
  siteConditions?: string;
  notes: string;
}

export interface ChemicalApplicationTankMixItem {
  id: string;
  applicationLogId: string;
  productId: string;
  rateApplied: number;
  rateUnit: string;
  totalQuantityUsed: number;
  mixOrder?: number;
}

export interface ProgramSettings {
  id: string;
  organizationName: string;
  appName: string;
  navigationTitle: string;
  navigationSubtitle: string;
  clientLabel: string;
  logoInitials: string;
  logoUrl?: string;
  uiThemePreset?: string;
  themeNotes?: string;
  fontThemePreset?: string;
  shellImageUrl?: string;
  primaryColor: string;
  accentColor: string;
  sidebarColor: string;
  defaultDepartment: string;
  timeZone: string;
  fiscalYearStart: string;
  enableMobileApp: boolean;
  overtimeTracking: boolean;
  equipmentQrCodes: boolean;
}

export interface DepartmentOption {
  id: string;
  name: string;
}

export interface GroupOption {
  id: string;
  name: string;
  color: string;
}

export interface RoleOption {
  id: string;
  name: string;
}

export interface LanguageOption {
  id: string;
  name: string;
}

export interface WorkLocation {
  id: string;
  name: string;
  propertyId?: string;
  propertyName?: string;
}

export interface Property {
  id: string;
  name: string;
  shortName: string;
  type: 'golf-course' | 'resort' | 'estate' | 'municipal';
  propertyClassId?: string;
  address: string;
  city: string;
  state: string;
  acreage: number;
  logoInitials: string;
  color: string;
  status: 'active' | 'onboarding' | 'paused';
}

export interface PropertyClassOption {
  id: string;
  name: string;
  description: string;
  enabledModules: string[];
}

export interface TaskRequest {
  id: string;
  propertyId: string;
  date: string;
  title: string;
  taskId?: string;
  requestedBy: string;
  requestedByType: 'client' | 'user' | 'admin';
  priority: 'low' | 'medium' | 'high';
  status: 'new' | 'planned' | 'assigned' | 'closed';
  preferredLocation?: string;
  notes: string;
}

export interface ShiftTemplate {
  id: string;
  name: string;
  start: string;
  end: string;
  days: string[];
}

export interface AppUser {
  id: string;
  fullName: string;
  email: string;
  role: 'admin' | 'manager' | 'supervisor' | 'crew';
  title: string;
  department: string;
  clubId: string;
  clubLabel: string;
  avatarInitials: string;
  status: 'active' | 'inactive';
}

export const employees: Employee[] = [
  { id: 'e1', firstName: 'Mike', lastName: 'Johnson', propertyId: 'prop-1', group: 'Greens', role: 'Lead', wage: 22, phone: '555-0101', email: 'mike.j@course.com', photo: '', status: 'active', department: 'Maintenance', language: 'English', workerType: 'full-time', hireDate: '2019-03-15', defaultLocationId: 'loc1', shiftTemplateId: 'st1', portalEnabled: true, loginEmail: 'mike.j@groundcrewhq.com', loginPassword: 'changeme', appRole: 'supervisor' },
  { id: 'e2', firstName: 'Carlos', lastName: 'Rivera', propertyId: 'prop-1', group: 'Fairways', role: 'Operator', wage: 18, phone: '555-0102', email: 'carlos.r@course.com', photo: '', status: 'active', department: 'Maintenance', language: 'Spanish', workerType: 'full-time', hireDate: '2020-06-01', defaultLocationId: 'loc3', shiftTemplateId: 'st1', portalEnabled: false, appRole: 'crew' },
  { id: 'e3', firstName: 'Sarah', lastName: 'Chen', propertyId: 'prop-2', group: 'Landscape', role: 'Specialist', wage: 20, phone: '555-0103', email: 'sarah.c@course.com', photo: '', status: 'active', department: 'Maintenance', language: 'English', workerType: 'full-time', hireDate: '2021-01-10', defaultLocationId: 'loc6', shiftTemplateId: 'st2', portalEnabled: true, loginEmail: 'sarah.chen@pinevalley.com', loginPassword: 'changeme', appRole: 'manager' },
  { id: 'e4', firstName: 'James', lastName: 'Wilson', propertyId: 'prop-1', group: 'Irrigation', role: 'Technician', wage: 24, phone: '555-0104', email: 'james.w@course.com', photo: '', status: 'active', department: 'Maintenance', language: 'English', workerType: 'full-time', hireDate: '2018-08-20', defaultLocationId: 'loc9', shiftTemplateId: 'st1', portalEnabled: false, appRole: 'crew' },
  { id: 'e5', firstName: 'David', lastName: 'Park', propertyId: 'prop-1', group: 'Greens', role: 'Operator', wage: 17, phone: '555-0105', email: 'david.p@course.com', photo: '', status: 'active', department: 'Maintenance', language: 'English', workerType: 'part-time', hireDate: '2022-04-01', defaultLocationId: 'loc2', shiftTemplateId: 'st2', portalEnabled: false, appRole: 'crew' },
  { id: 'e6', firstName: 'Maria', lastName: 'Santos', propertyId: 'prop-3', group: 'Bunkers', role: 'Operator', wage: 16, phone: '555-0106', email: 'maria.s@course.com', photo: '', status: 'active', department: 'Maintenance', language: 'Spanish', workerType: 'seasonal', hireDate: '2023-05-15', defaultLocationId: 'loc8', shiftTemplateId: 'st3', portalEnabled: false, appRole: 'crew' },
  { id: 'e7', firstName: 'Tom', lastName: 'Bradley', propertyId: 'prop-1', group: 'Mechanic', role: 'Lead Mechanic', wage: 28, phone: '555-0107', email: 'tom.b@course.com', photo: '', status: 'active', department: 'Equipment', language: 'English', workerType: 'full-time', hireDate: '2017-02-01', defaultLocationId: 'loc6', shiftTemplateId: 'st2', portalEnabled: true, loginEmail: 'tom.bradley@groundcrewhq.com', loginPassword: 'changeme', appRole: 'supervisor' },
  { id: 'e8', firstName: 'Alex', lastName: 'Kim', propertyId: 'prop-1', group: 'Fairways', role: 'Operator', wage: 17, phone: '555-0108', email: 'alex.k@course.com', photo: '', status: 'inactive', department: 'Maintenance', language: 'English', workerType: 'seasonal', hireDate: '2023-06-01', defaultLocationId: 'loc4', shiftTemplateId: 'st3', portalEnabled: false, appRole: 'crew' },
];

export const tasks: Task[] = [
  { id: 't1', name: 'Mow Greens', category: 'Mowing', duration: 120, color: 'hsl(152, 55%, 38%)', icon: '🌿' },
  { id: 't2', name: 'Mow Fairways', category: 'Mowing', duration: 180, color: 'hsl(152, 40%, 50%)', icon: '🌾' },
  { id: 't3', name: 'Mow Tees', category: 'Mowing', duration: 90, color: 'hsl(152, 35%, 55%)', icon: '⛳' },
  { id: 't4', name: 'Rake Bunkers', category: 'Bunkers', duration: 60, color: 'hsl(38, 70%, 55%)', icon: '🏖️' },
  { id: 't5', name: 'Change Cups', category: 'Greens', duration: 45, color: 'hsl(210, 60%, 50%)', icon: '🏌️' },
  { id: 't6', name: 'Water Plants', category: 'Irrigation', duration: 60, color: 'hsl(200, 70%, 50%)', icon: '💧' },
  { id: 't7', name: 'Trim Edges', category: 'Landscape', duration: 90, color: 'hsl(80, 50%, 45%)', icon: '✂️' },
  { id: 't8', name: 'Apply Fertilizer', category: 'Chemical', duration: 120, color: 'hsl(30, 80%, 50%)', icon: '🧪' },
  { id: 't9', name: 'Spray Greens', category: 'Chemical', duration: 60, color: 'hsl(270, 50%, 55%)', icon: '🔬' },
  { id: 't10', name: 'Repair Divots', category: 'Greens', duration: 45, color: 'hsl(120, 40%, 45%)', icon: '🔧' },
  { id: 't11', name: 'Set Up Range', category: 'Range', duration: 30, color: 'hsl(45, 70%, 50%)', icon: '🎯' },
  { id: 't12', name: 'Blow Debris', category: 'Clean Up', duration: 60, color: 'hsl(0, 0%, 55%)', icon: '🍃' },
];

export const equipmentTypes: EquipmentType[] = [
  { id: 'eq1', name: 'Greens Mower', category: 'Mowing', totalUnits: 6, activeUnits: 5, inRepair: 1 },
  { id: 'eq2', name: 'Fairway Mower', category: 'Mowing', totalUnits: 4, activeUnits: 3, inRepair: 1 },
  { id: 'eq3', name: 'Utility Vehicle', category: 'Transport', totalUnits: 8, activeUnits: 7, inRepair: 1 },
  { id: 'eq4', name: 'Sprayer', category: 'Chemical', totalUnits: 3, activeUnits: 3, inRepair: 0 },
  { id: 'eq5', name: 'Aerator', category: 'Turf', totalUnits: 2, activeUnits: 2, inRepair: 0 },
  { id: 'eq6', name: 'Bunker Machine', category: 'Bunkers', totalUnits: 3, activeUnits: 2, inRepair: 1 },
  { id: 'eq7', name: 'Blower', category: 'Clean Up', totalUnits: 5, activeUnits: 5, inRepair: 0 },
  { id: 'eq8', name: 'Topdresser', category: 'Turf', totalUnits: 2, activeUnits: 1, inRepair: 1 },
];

export const equipmentUnits: EquipmentUnit[] = [
  { id: 'u1', typeId: 'eq1', unitNumber: 'GM-001', status: 'available', location: 'Shop', hours: 1250, lastService: '2024-03-01', nextService: '2024-04-01' },
  { id: 'u2', typeId: 'eq1', unitNumber: 'GM-002', status: 'in-use', assignedTo: 'e1', location: 'Hole 3', hours: 980, lastService: '2024-02-15', nextService: '2024-03-15' },
  { id: 'u3', typeId: 'eq1', unitNumber: 'GM-003', status: 'maintenance', location: 'Shop', hours: 2100, lastService: '2024-01-10', nextService: '2024-02-10' },
  { id: 'u4', typeId: 'eq2', unitNumber: 'FM-001', status: 'in-use', assignedTo: 'e2', location: 'Fairway 7', hours: 3200, lastService: '2024-03-10', nextService: '2024-04-10' },
  { id: 'u5', typeId: 'eq3', unitNumber: 'UV-001', status: 'available', location: 'Shop', hours: 5600, lastService: '2024-03-05', nextService: '2024-04-05' },
  { id: 'u6', typeId: 'eq3', unitNumber: 'UV-002', status: 'in-use', assignedTo: 'e4', location: 'Irrigation Pump', hours: 4300, lastService: '2024-02-20', nextService: '2024-03-20' },
  { id: 'u7', typeId: 'eq4', unitNumber: 'SP-001', status: 'available', location: 'Chemical Shed', hours: 890, lastService: '2024-03-12', nextService: '2024-04-12' },
  { id: 'u8', typeId: 'eq6', unitNumber: 'BM-001', status: 'maintenance', location: 'Shop', hours: 1560, lastService: '2024-01-20', nextService: '2024-02-20' },
];

export const workOrders: WorkOrder[] = [
  { id: 'wo1', unitId: 'u3', title: 'Reel grinding', description: 'Annual reel grinding and bedknife replacement', status: 'in-progress', priority: 'high', createdDate: '2024-03-15', cost: 450 },
  { id: 'wo2', unitId: 'u8', title: 'Hydraulic leak repair', description: 'Fix hydraulic line leak on conveyor system', status: 'open', priority: 'medium', createdDate: '2024-03-18', cost: 280 },
  { id: 'wo3', unitId: 'u4', title: 'Oil change', description: 'Scheduled 500hr oil change and filter', status: 'completed', priority: 'low', createdDate: '2024-03-01', completedDate: '2024-03-02', cost: 85 },
  { id: 'wo4', unitId: 'u1', title: 'Belt replacement', description: 'Replace drive belt showing wear', status: 'completed', priority: 'medium', createdDate: '2024-02-25', completedDate: '2024-02-26', cost: 120 },
  { id: 'wo5', unitId: 'u6', title: 'Tire replacement', description: 'Replace two rear tires', status: 'open', priority: 'low', createdDate: '2024-03-20', cost: 340 },
];

export const scheduleEntries: ScheduleEntry[] = [
  { id: 's1', employeeId: 'e1', date: '2024-03-25', shiftStart: '05:00', shiftEnd: '13:30', status: 'scheduled' },
  { id: 's2', employeeId: 'e2', date: '2024-03-25', shiftStart: '05:30', shiftEnd: '14:00', status: 'scheduled' },
  { id: 's3', employeeId: 'e3', date: '2024-03-25', shiftStart: '06:00', shiftEnd: '14:30', status: 'scheduled' },
  { id: 's4', employeeId: 'e4', date: '2024-03-25', shiftStart: '05:00', shiftEnd: '13:30', status: 'scheduled' },
  { id: 's5', employeeId: 'e5', date: '2024-03-25', shiftStart: '06:00', shiftEnd: '12:00', status: 'scheduled' },
  { id: 's6', employeeId: 'e6', date: '2024-03-25', shiftStart: '06:00', shiftEnd: '14:00', status: 'scheduled' },
  { id: 's7', employeeId: 'e7', date: '2024-03-25', shiftStart: '06:30', shiftEnd: '15:00', status: 'scheduled' },
  { id: 's8', employeeId: 'e1', date: '2024-03-26', shiftStart: '05:00', shiftEnd: '13:30', status: 'scheduled' },
  { id: 's9', employeeId: 'e2', date: '2024-03-26', shiftStart: '05:30', shiftEnd: '14:00', status: 'day-off' },
  { id: 's10', employeeId: 'e3', date: '2024-03-26', shiftStart: '06:00', shiftEnd: '14:30', status: 'scheduled' },
];

export const notes: Note[] = [
  { id: 'n1', type: 'daily', title: 'Morning Setup Complete', content: 'All greens mowed and cups changed. Pin positions set per Tuesday rotation. Dew removal completed by 7:15 AM.', author: 'Mike Johnson', date: '2024-03-25' },
  { id: 'n2', type: 'general', title: 'Tournament Prep Notes', content: 'Member-guest tournament this weekend. Need extra bunker work Wed-Fri. Cart path cleanup needed on holes 12-15.', author: 'Sarah Chen', date: '2024-03-24' },
  { id: 'n3', type: 'alert', title: 'Irrigation Leak - Hole 9', content: 'Sprinkler head broken on #9 fairway, left side 150yd marker. Water pooling. James assigned to repair.', author: 'Carlos Rivera', date: '2024-03-25' },
  { id: 'n4', type: 'geo', title: 'Drainage Issue', content: 'Standing water near #14 green approach. Needs french drain evaluation.', author: 'James Wilson', date: '2024-03-23', location: 'Hole 14 Approach' },
  { id: 'n5', type: 'daily', title: 'Chemical Application Log', content: 'Applied fungicide to greens 1-9 this morning. 24hr re-entry period. Flags placed.', author: 'Mike Johnson', date: '2024-03-25' },
];

export const assignments: Assignment[] = [
  { id: 'a1', employeeId: 'e1', taskId: 't1', equipmentId: 'u2', date: '2024-03-25', startTime: '05:00', duration: 120, area: 'Greens 1-9' },
  { id: 'a2', employeeId: 'e1', taskId: 't5', date: '2024-03-25', startTime: '07:00', duration: 45, area: 'All Greens' },
  { id: 'a3', employeeId: 'e2', taskId: 't2', equipmentId: 'u4', date: '2024-03-25', startTime: '05:30', duration: 180, area: 'Fairways 1-9' },
  { id: 'a4', employeeId: 'e3', taskId: 't7', date: '2024-03-25', startTime: '06:00', duration: 90, area: 'Clubhouse Landscape' },
  { id: 'a5', employeeId: 'e3', taskId: 't12', date: '2024-03-25', startTime: '07:30', duration: 60, area: 'Cart Paths' },
  { id: 'a6', employeeId: 'e4', taskId: 't6', equipmentId: 'u6', date: '2024-03-25', startTime: '05:00', duration: 60, area: 'New Plantings' },
  { id: 'a7', employeeId: 'e5', taskId: 't3', date: '2024-03-25', startTime: '06:00', duration: 90, area: 'Tees 1-18' },
  { id: 'a8', employeeId: 'e6', taskId: 't4', date: '2024-03-25', equipmentId: 'u8', startTime: '06:00', duration: 120, area: 'All Bunkers' },
  { id: 'a9', employeeId: 'e7', taskId: 't10', date: '2024-03-25', startTime: '06:30', duration: 120, area: 'Shop' },
];

export const programSettings: ProgramSettings[] = [
  {
    id: 'ps1',
    organizationName: 'Ground Crew HQ',
    appName: 'WorkForce App',
    navigationTitle: 'GroundsCrew',
    navigationSubtitle: 'Task Tracker',
    clientLabel: 'Ground Crew HQ',
    logoInitials: 'GC',
    logoUrl: '',
    uiThemePreset: 'club-emerald',
    themeNotes: '',
    fontThemePreset: 'modern-sans',
    shellImageUrl: '',
    primaryColor: '#2f855a',
    accentColor: '#d7f5e5',
    sidebarColor: '#203127',
    defaultDepartment: 'Maintenance',
    timeZone: 'Eastern Time (ET)',
    fiscalYearStart: 'January',
    enableMobileApp: true,
    overtimeTracking: true,
    equipmentQrCodes: true,
  },
];

export const departmentOptions: DepartmentOption[] = [
  { id: 'dep1', name: 'Maintenance' },
  { id: 'dep2', name: 'Equipment' },
  { id: 'dep3', name: 'Landscape' },
  { id: 'dep4', name: 'Irrigation' },
];

export const groupOptions: GroupOption[] = [
  { id: 'grp1', name: 'Greens', color: 'hsl(152,55%,38%)' },
  { id: 'grp2', name: 'Fairways', color: 'hsl(152,40%,50%)' },
  { id: 'grp3', name: 'Bunkers', color: 'hsl(38,70%,55%)' },
  { id: 'grp4', name: 'Landscape', color: 'hsl(80,50%,45%)' },
  { id: 'grp5', name: 'Irrigation', color: 'hsl(200,70%,50%)' },
  { id: 'grp6', name: 'Mechanic', color: 'hsl(210,60%,50%)' },
  { id: 'grp7', name: 'Range', color: 'hsl(45,70%,50%)' },
];

export const roleOptions: RoleOption[] = [
  { id: 'role1', name: 'Operator' },
  { id: 'role2', name: 'Lead' },
  { id: 'role3', name: 'Technician' },
  { id: 'role4', name: 'Specialist' },
  { id: 'role5', name: 'Lead Mechanic' },
];

export const languageOptions: LanguageOption[] = [
  { id: 'lang1', name: 'English' },
  { id: 'lang2', name: 'Spanish' },
  { id: 'lang3', name: 'Bilingual' },
];

export const properties: Property[] = [
  { id: 'prop-1', name: 'Ground Crew HQ', shortName: 'GC HQ', type: 'golf-course', propertyClassId: 'pc-golf-premium', address: '1200 Championship Dr', city: 'Scottsdale', state: 'AZ', acreage: 180, logoInitials: 'GC', color: 'hsl(152, 55%, 38%)', status: 'active' },
  { id: 'prop-2', name: 'Pine Valley Club', shortName: 'PVC', type: 'golf-course', propertyClassId: 'pc-golf-premium', address: '450 Fairway Ln', city: 'Pine Valley', state: 'NJ', acreage: 220, logoInitials: 'PV', color: 'hsl(210, 80%, 52%)', status: 'active' },
  { id: 'prop-3', name: 'Oceanview Resort & Spa', shortName: 'OVR', type: 'resort', propertyClassId: 'pc-resort', address: '8900 Coastal Blvd', city: 'Carlsbad', state: 'CA', acreage: 95, logoInitials: 'OV', color: 'hsl(270, 60%, 55%)', status: 'active' },
];

export const propertyClassOptions: PropertyClassOption[] = [
  {
    id: 'pc-golf-premium',
    name: 'Golf Course Premium',
    description: 'Full agronomy, crew workflow, breakroom, applications, and weather tracking for private or destination golf properties.',
    enabledModules: ['command-center', 'workflow', 'breakroom', 'weather', 'applications', 'reports', 'field', 'equipment'],
  },
  {
    id: 'pc-resort',
    name: 'Resort Grounds',
    description: 'Balanced crew workflow for mixed landscape, guest areas, and light agronomic operations.',
    enabledModules: ['command-center', 'workflow', 'breakroom', 'weather', 'reports', 'equipment', 'field'],
  },
  {
    id: 'pc-municipal',
    name: 'Municipal Ops',
    description: 'Lean operational stack for public properties that need labor planning and equipment readiness without the full chemical suite.',
    enabledModules: ['command-center', 'workflow', 'breakroom', 'reports', 'equipment'],
  },
];

export const taskRequests: TaskRequest[] = [
  {
    id: 'tr1',
    propertyId: 'prop-1',
    date: '2026-04-02',
    title: 'Topdress practice green collars before member clinic',
    taskId: 't1',
    requestedBy: 'Nick Chavez',
    requestedByType: 'client',
    priority: 'high',
    status: 'new',
    preferredLocation: 'Practice Range',
    notes: 'Client requested completion before 8:30 AM due to guest clinic start.',
  },
  {
    id: 'tr2',
    propertyId: 'prop-1',
    date: '2026-04-02',
    title: 'Blow clubhouse entry and cart staging area',
    taskId: 't12',
    requestedBy: 'Basil Lowell',
    requestedByType: 'admin',
    priority: 'medium',
    status: 'planned',
    preferredLocation: 'Clubhouse',
    notes: 'Requested for visual cleanup ahead of afternoon board meeting.',
  },
];

export const workLocations: WorkLocation[] = [
  { id: 'loc1', name: 'Greens 1-9', propertyId: 'prop-1', propertyName: 'Ground Crew HQ' },
  { id: 'loc2', name: 'Greens 10-18', propertyId: 'prop-1', propertyName: 'Ground Crew HQ' },
  { id: 'loc3', name: 'Fairways 1-9', propertyId: 'prop-1', propertyName: 'Ground Crew HQ' },
  { id: 'loc4', name: 'Fairways 10-18', propertyId: 'prop-1', propertyName: 'Ground Crew HQ' },
  { id: 'loc5', name: 'Practice Range', propertyId: 'prop-2', propertyName: 'Pine Valley Club' },
  { id: 'loc6', name: 'Clubhouse', propertyId: 'prop-2', propertyName: 'Pine Valley Club' },
  { id: 'loc7', name: 'Cart Paths', propertyId: 'prop-3', propertyName: 'Oceanview Resort & Spa' },
  { id: 'loc8', name: 'Bunkers', propertyId: 'prop-3', propertyName: 'Oceanview Resort & Spa' },
  { id: 'loc9', name: 'Irrigation Pump House', propertyId: 'prop-1', propertyName: 'Ground Crew HQ' },
];

export const shiftTemplates: ShiftTemplate[] = [
  { id: 'st1', name: 'Morning Crew', start: '05:00', end: '13:30', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
  { id: 'st2', name: 'Day Crew', start: '06:00', end: '14:30', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
  { id: 'st3', name: 'Weekend Crew', start: '06:00', end: '12:00', days: ['Sat', 'Sun'] },
  { id: 'st4', name: 'Late Shift', start: '10:00', end: '18:00', days: ['Mon', 'Wed', 'Fri'] },
];

export const appUsers: AppUser[] = [
  {
    id: 'au1',
    fullName: 'Basil Lowell',
    email: 'basil@groundcrewhq.com',
    role: 'admin',
    title: 'Platform Admin',
    department: 'Maintenance',
    clubId: 'club-1',
    clubLabel: 'Ground Crew HQ',
    avatarInitials: 'BL',
    status: 'active',
  },
  {
    id: 'au2',
    fullName: 'Nick Chavez',
    email: 'nick@groundcrewhq.com',
    role: 'manager',
    title: 'Operations Manager',
    department: 'Maintenance',
    clubId: 'club-1',
    clubLabel: 'Ground Crew HQ',
    avatarInitials: 'NC',
    status: 'active',
  },
  {
    id: 'au3',
    fullName: 'Sarah Chen',
    email: 'sarah@groundcrewhq.com',
    role: 'supervisor',
    title: 'Course Supervisor',
    department: 'Landscape',
    clubId: 'club-1',
    clubLabel: 'Ground Crew HQ',
    avatarInitials: 'SC',
    status: 'active',
  },
];

export const departments = departmentOptions.map((department) => department.name);
export const groups = groupOptions.map((group) => group.name);

export const turfData = {
  mowPatterns: ['Single Cut', 'Double Cut', 'Cross Cut', 'Diagonal', 'Straight'],
  heightOfCut: [
    { area: 'Greens', height: '0.125"', frequency: 'Daily' },
    { area: 'Tees', height: '0.500"', frequency: '3x/week' },
    { area: 'Fairways', height: '0.625"', frequency: '3x/week' },
    { area: 'Rough', height: '2.000"', frequency: 'Weekly' },
  ],
  chemicals: [
    { name: 'Primo Maxx', type: 'Growth Regulator', lastApplied: '2024-03-20', nextDue: '2024-04-03' },
    { name: 'Banner Maxx', type: 'Fungicide', lastApplied: '2024-03-25', nextDue: '2024-04-08' },
    { name: 'Revolver', type: 'Herbicide', lastApplied: '2024-03-10', nextDue: '2024-04-10' },
  ],
};

export const reportCategories = [
  { id: 'r1', name: 'Labor Reports', reports: ['Daily Labor Summary', 'Weekly Hours by Employee', 'Overtime Report', 'Labor Cost by Task'] },
  { id: 'r2', name: 'Equipment Reports', reports: ['Equipment Usage Summary', 'Repair Cost Analysis', 'Downtime Report', 'Maintenance Schedule'] },
  { id: 'r3', name: 'Task Reports', reports: ['Task Completion Rate', 'Task Distribution', 'Area Coverage', 'Chemical Application Log'] },
  { id: 'r4', name: 'Safety Reports', reports: ['Incident Log', 'Safety Training Status', 'Equipment Inspection', 'Chemical Exposure'] },
  { id: 'r5', name: 'Weather Reports', reports: ['Rainfall History', 'Weather By Location', 'ET Trend Summary'] },
  { id: 'r6', name: 'Applications', reports: ['Application Log Register', 'Product Usage Summary', 'Rainfall vs Application Window'] },
];

export const weatherLocations: WeatherLocation[] = [
  { id: 'wl1', name: 'North Course', property: 'Ground Crew HQ', propertyId: 'prop-1', area: 'Greens + Fairways', address: '1200 Championship Dr, Scottsdale, AZ', latitude: 35.7796, longitude: -78.6382 },
  { id: 'wl2', name: 'South Course', property: 'Ground Crew HQ', propertyId: 'prop-1', area: 'Practice + Tees', address: '1200 Championship Dr, Scottsdale, AZ', latitude: 35.7688, longitude: -78.6484 },
  { id: 'wl3', name: 'Clubhouse Grounds', property: 'Ground Crew HQ', propertyId: 'prop-1', area: 'Landscape + Entry', address: '1200 Championship Dr, Scottsdale, AZ', latitude: 35.7762, longitude: -78.6328 },
];

export const weatherStations: WeatherStation[] = [
  { id: 'ws1', locationId: 'wl1', name: 'North Primary', provider: 'Open-Meteo', providerType: 'open-meteo', stationCode: 'NC-01', latitude: 35.7796, longitude: -78.6382, timeZone: 'America/New_York', stationCategory: 'regional-grid', isPrimary: true, status: 'online' },
  { id: 'ws2', locationId: 'wl1', name: 'North Backup', provider: 'Manual Feed', providerType: 'manual', stationCode: 'NC-ALT', latitude: 35.7815, longitude: -78.6401, timeZone: 'America/New_York', stationCategory: 'manual', isPrimary: false, status: 'online' },
  { id: 'ws3', locationId: 'wl2', name: 'South Primary', provider: 'Open-Meteo', providerType: 'open-meteo', stationCode: 'SC-01', latitude: 35.7688, longitude: -78.6484, timeZone: 'America/New_York', stationCategory: 'regional-grid', isPrimary: true, status: 'offline' },
  { id: 'ws4', locationId: 'wl3', name: 'Clubhouse Primary', provider: 'Open-Meteo', providerType: 'open-meteo', stationCode: 'CH-01', latitude: 35.7762, longitude: -78.6328, timeZone: 'America/New_York', stationCategory: 'regional-grid', isPrimary: true, status: 'online' },
];

export const weatherDailyLogs: WeatherDailyLog[] = [
  { id: 'wd1', locationId: 'wl1', stationId: 'ws1', date: '2024-03-25', currentConditions: 'Partly Cloudy', forecast: 'Warm afternoon with light wind', rainfallTotal: 0.08, temperature: 71, humidity: 64, wind: 7, et: 0.17, source: 'station' },
  { id: 'wd2', locationId: 'wl1', stationId: 'ws1', date: '2024-03-26', currentConditions: 'Sunny', forecast: 'Dry and bright', rainfallTotal: 0.0, temperature: 76, humidity: 58, wind: 6, et: 0.19, source: 'station' },
  { id: 'wd3', locationId: 'wl2', stationId: 'ws3', date: '2024-03-25', currentConditions: 'Manual Override', forecast: 'Station offline, conditions entered manually', rainfallTotal: 0.12, temperature: 69, humidity: 70, wind: 8, et: 0.14, source: 'manual-override', notes: 'South station offline at 5:40 AM' },
  { id: 'wd4', locationId: 'wl3', stationId: 'ws4', date: '2024-03-25', currentConditions: 'Cloudy', forecast: 'Chance of passing shower after 4 PM', rainfallTotal: 0.04, temperature: 68, humidity: 73, wind: 9, et: 0.12, source: 'station' },
];

export const manualRainfallEntries: ManualRainfallEntry[] = [
  { id: 'mr1', locationId: 'wl2', date: '2024-03-25', rainfallAmount: 0.12, enteredBy: 'James Wilson', notes: 'Measured at practice tee gauge due to station outage' },
  { id: 'mr2', locationId: 'wl3', date: '2024-03-24', rainfallAmount: 0.09, enteredBy: 'Sarah Chen', notes: 'Clubhouse landscape manual reading' },
];

export const chemicalProducts: ChemicalProduct[] = [
  { id: 'cp1', name: 'Primo Maxx', productType: 'Growth Regulator', targetUse: 'Growth control', rateUnit: 'oz/1000 sq ft', epaRegistrationNumber: '100-1017', formulation: 'EC', signalWord: 'Caution', restrictedUse: false, reentryIntervalHours: 12, preHarvestIntervalHours: 0, defaultApplicationMethod: 'Ground boom spray' },
  { id: 'cp2', name: 'Banner Maxx', productType: 'Fungicide', targetUse: 'Disease pressure', rateUnit: 'oz/acre', epaRegistrationNumber: '100-773', formulation: 'EC', signalWord: 'Warning', restrictedUse: false, reentryIntervalHours: 12, preHarvestIntervalHours: 0, defaultApplicationMethod: 'Ground spray' },
  { id: 'cp3', name: 'Revolver', productType: 'Herbicide', targetUse: 'Weed control', rateUnit: 'oz/acre', epaRegistrationNumber: '264-829', formulation: 'SC', signalWord: 'Warning', restrictedUse: false, reentryIntervalHours: 12, preHarvestIntervalHours: 0, defaultApplicationMethod: 'Directed spray' },
  { id: 'cp4', name: 'Wetting Agent 90', productType: 'Soil Surfactant', targetUse: 'Moisture management', rateUnit: 'gal/acre', epaRegistrationNumber: 'N/A', formulation: 'Liquid', signalWord: 'Caution', restrictedUse: false, reentryIntervalHours: 4, preHarvestIntervalHours: 0, defaultApplicationMethod: 'Spray rig' },
];

export const applicationAreas: ApplicationArea[] = [
  { id: 'aa1', name: 'Greens 1-9', property: 'Ground Crew HQ', weatherLocationId: 'wl1' },
  { id: 'aa2', name: 'Fairways 1-9', property: 'Ground Crew HQ', weatherLocationId: 'wl1' },
  { id: 'aa3', name: 'Practice Facility', property: 'Ground Crew HQ', weatherLocationId: 'wl2' },
  { id: 'aa4', name: 'Clubhouse Landscape', property: 'Ground Crew HQ', weatherLocationId: 'wl3' },
];

export const chemicalApplicationLogs: ChemicalApplicationLog[] = [
  { id: 'cal1', applicationDate: '2024-03-25', startTime: '05:45', endTime: '07:10', applicationTimestamp: '2024-03-25T05:45:00', areaId: 'aa1', targetPest: 'Dollar spot', agronomicPurpose: 'Preventive fungicide and growth regulation', applicationMethod: 'Ground boom spray', carrierVolume: 180, totalMixVolume: 180, areaTreated: 4.5, areaUnit: 'acres', applicatorId: 'e1', applicatorLicenseNumber: 'NC-45612', supervisorName: 'Mike Johnson', supervisorLicenseNumber: 'NC-45612', equipmentUsedId: 'u7', weatherLogId: 'wd1', weatherConditionsSummary: 'Partly cloudy, calm start, drying conditions after sunrise', windDirection: 'NE', windSpeedAtApplication: 4, temperatureAtApplication: 66, humidityAtApplication: 72, restrictedEntryUntil: '2024-03-25T19:10:00', siteConditions: 'Leaf surface slightly damp at first pass, no visible drift, greens closed until dry-down.', notes: 'Completed before golfer play. Light wind, no drift concerns.' },
  { id: 'cal2', applicationDate: '2024-03-25', startTime: '06:15', endTime: '07:05', applicationTimestamp: '2024-03-25T06:15:00', areaId: 'aa3', targetPest: 'Localized dry spot', agronomicPurpose: 'Moisture management', applicationMethod: 'Boom spray', carrierVolume: 90, totalMixVolume: 90, areaTreated: 2.1, areaUnit: 'acres', applicatorId: 'e4', applicatorLicenseNumber: 'NC-33820', supervisorName: 'James Wilson', supervisorLicenseNumber: 'NC-33820', equipmentUsedId: 'u6', weatherLogId: 'wd3', weatherConditionsSummary: 'Manual weather entry used due to station outage', windDirection: 'S', windSpeedAtApplication: 5, temperatureAtApplication: 65, humidityAtApplication: 76, restrictedEntryUntil: '2024-03-25T11:05:00', siteConditions: 'Practice facility closed during application. Moisture stress visible in center section.', notes: 'Manual weather entry used due to station outage.' },
];

export const chemicalApplicationTankMixItems: ChemicalApplicationTankMixItem[] = [
  { id: 'cmi1', applicationLogId: 'cal1', productId: 'cp1', rateApplied: 0.2, rateUnit: 'oz/1000 sq ft', totalQuantityUsed: 38, mixOrder: 1 },
  { id: 'cmi2', applicationLogId: 'cal1', productId: 'cp2', rateApplied: 18, rateUnit: 'oz/acre', totalQuantityUsed: 5.1, mixOrder: 2 },
  { id: 'cmi3', applicationLogId: 'cal2', productId: 'cp4', rateApplied: 2.5, rateUnit: 'gal/acre', totalQuantityUsed: 5.25, mixOrder: 1 },
];
