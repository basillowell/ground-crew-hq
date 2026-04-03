import {
  applicationAreas,
  appUsers,
  chemicalApplicationLogs,
  chemicalApplicationTankMixItems,
  chemicalProducts,
  departmentOptions,
  assignments,
  employees,
  equipmentUnits,
  groupOptions,
  languageOptions,
  manualRainfallEntries,
  notes,
  propertyClassOptions,
  properties,
  programSettings,
  roleOptions,
  scheduleEntries,
  shiftTemplates,
  taskRequests,
  tasks,
  weatherDailyLogs,
  weatherLocations,
  weatherStations,
  workLocations,
  type ApplicationArea,
  type AppUser,
  type Assignment,
  type ChemicalApplicationLog,
  type ChemicalApplicationTankMixItem,
  type ChemicalProduct,
  type DepartmentOption,
  type EquipmentUnit,
  type Employee,
  type GroupOption,
  type LanguageOption,
  type ManualRainfallEntry,
  type Note,
  type PropertyClassOption,
  type Property,
  type ProgramSettings,
  type RoleOption,
  type ScheduleEntry,
  type ShiftTemplate,
  type Task,
  type TaskRequest,
  type WeatherDailyLog,
  type WeatherLocation,
  type WeatherStation,
  type WorkLocation,
} from '@/data/seedData';
import {
  loadApplicationAreas as loadApplicationAreasLocal,
  loadAppUsers as loadAppUsersLocal,
  loadAssignments as loadAssignmentsLocal,
  loadChemicalApplicationLogs as loadChemicalApplicationLogsLocal,
  loadChemicalApplicationTankMixItems as loadChemicalApplicationTankMixItemsLocal,
  loadChemicalProducts as loadChemicalProductsLocal,
  loadDepartmentOptions as loadDepartmentOptionsLocal,
  loadEmployees as loadEmployeesLocal,
  loadEquipmentUnits as loadEquipmentUnitsLocal,
  loadGroupOptions as loadGroupOptionsLocal,
  loadLanguageOptions as loadLanguageOptionsLocal,
  loadManualRainfallEntries as loadManualRainfallEntriesLocal,
  loadNotes as loadNotesLocal,
  loadProgramSettings as loadProgramSettingsLocal,
  loadPropertyClassOptions as loadPropertyClassOptionsLocal,
  loadProperties as loadPropertiesLocal,
  loadRoleOptions as loadRoleOptionsLocal,
  loadScheduleEntries as loadScheduleEntriesLocal,
  loadShiftTemplates as loadShiftTemplatesLocal,
  loadTaskRequests as loadTaskRequestsLocal,
  loadTasks as loadTasksLocal,
  loadWeatherDailyLogs as loadWeatherDailyLogsLocal,
  loadWeatherLocations as loadWeatherLocationsLocal,
  loadWeatherStations as loadWeatherStationsLocal,
  loadWorkLocations as loadWorkLocationsLocal,
  loadCurrentAppUserId as loadCurrentAppUserIdLocal,
  loadCurrentPropertyId as loadCurrentPropertyIdLocal,
  saveApplicationAreas as saveApplicationAreasLocal,
  saveAppUsers as saveAppUsersLocal,
  saveAssignments as saveAssignmentsLocal,
  saveChemicalApplicationLogs as saveChemicalApplicationLogsLocal,
  saveChemicalApplicationTankMixItems as saveChemicalApplicationTankMixItemsLocal,
  saveChemicalProducts as saveChemicalProductsLocal,
  saveDepartmentOptions as saveDepartmentOptionsLocal,
  saveEmployees as saveEmployeesLocal,
  saveEquipmentUnits as saveEquipmentUnitsLocal,
  saveGroupOptions as saveGroupOptionsLocal,
  saveLanguageOptions as saveLanguageOptionsLocal,
  saveManualRainfallEntries as saveManualRainfallEntriesLocal,
  saveNotes as saveNotesLocal,
  saveProgramSettings as saveProgramSettingsLocal,
  savePropertyClassOptions as savePropertyClassOptionsLocal,
  saveProperties as savePropertiesLocal,
  saveRoleOptions as saveRoleOptionsLocal,
  saveScheduleEntries as saveScheduleEntriesLocal,
  saveShiftTemplates as saveShiftTemplatesLocal,
  saveTaskRequests as saveTaskRequestsLocal,
  saveTasks as saveTasksLocal,
  saveWeatherDailyLogs as saveWeatherDailyLogsLocal,
  saveWeatherLocations as saveWeatherLocationsLocal,
  saveWeatherStations as saveWeatherStationsLocal,
  saveWorkLocations as saveWorkLocationsLocal,
  saveCurrentAppUserId as saveCurrentAppUserIdLocal,
  saveCurrentPropertyId as saveCurrentPropertyIdLocal,
} from './operationsStorage';
import { hasSupabaseConfig, supabase } from './supabase';

type PersistedRow = {
  id?: string;
  clubId?: string | null;
};

type CollectionConfig<T extends PersistedRow> = {
  table: string;
  seed: T[];
  loadLocal: () => T[];
  saveLocal: (value: T[]) => void;
};

export const DATA_STORE_UPDATED_EVENT = 'data-store-updated';

const collections = {
  employees: {
    table: 'employees',
    seed: employees,
    loadLocal: loadEmployeesLocal,
    saveLocal: saveEmployeesLocal,
  } satisfies CollectionConfig<Employee>,
  tasks: {
    table: 'tasks',
    seed: tasks,
    loadLocal: loadTasksLocal,
    saveLocal: saveTasksLocal,
  } satisfies CollectionConfig<Task>,
  scheduleEntries: {
    table: 'schedule_entries',
    seed: scheduleEntries,
    loadLocal: loadScheduleEntriesLocal,
    saveLocal: saveScheduleEntriesLocal,
  } satisfies CollectionConfig<ScheduleEntry>,
  assignments: {
    table: 'assignments',
    seed: assignments,
    loadLocal: loadAssignmentsLocal,
    saveLocal: saveAssignmentsLocal,
  } satisfies CollectionConfig<Assignment>,
  notes: {
    table: 'notes',
    seed: notes,
    loadLocal: loadNotesLocal,
    saveLocal: saveNotesLocal,
  } satisfies CollectionConfig<Note>,
  equipmentUnits: {
    table: 'equipment_units',
    seed: equipmentUnits,
    loadLocal: loadEquipmentUnitsLocal,
    saveLocal: saveEquipmentUnitsLocal,
  } satisfies CollectionConfig<EquipmentUnit>,
  weatherDailyLogs: {
    table: 'weather_daily_logs',
    seed: weatherDailyLogs,
    loadLocal: loadWeatherDailyLogsLocal,
    saveLocal: saveWeatherDailyLogsLocal,
  } satisfies CollectionConfig<WeatherDailyLog>,
  manualRainfallEntries: {
    table: 'manual_rainfall_entries',
    seed: manualRainfallEntries,
    loadLocal: loadManualRainfallEntriesLocal,
    saveLocal: saveManualRainfallEntriesLocal,
  } satisfies CollectionConfig<ManualRainfallEntry>,
  chemicalApplicationLogs: {
    table: 'chemical_application_logs',
    seed: chemicalApplicationLogs,
    loadLocal: loadChemicalApplicationLogsLocal,
    saveLocal: saveChemicalApplicationLogsLocal,
  } satisfies CollectionConfig<ChemicalApplicationLog>,
  chemicalApplicationTankMixItems: {
    table: 'chemical_application_tank_mix_items',
    seed: chemicalApplicationTankMixItems,
    loadLocal: loadChemicalApplicationTankMixItemsLocal,
    saveLocal: saveChemicalApplicationTankMixItemsLocal,
  } satisfies CollectionConfig<ChemicalApplicationTankMixItem>,
  weatherLocations: {
    table: 'weather_locations',
    seed: weatherLocations,
    loadLocal: loadWeatherLocationsLocal,
    saveLocal: saveWeatherLocationsLocal,
  } satisfies CollectionConfig<WeatherLocation>,
  weatherStations: {
    table: 'weather_stations',
    seed: weatherStations,
    loadLocal: loadWeatherStationsLocal,
    saveLocal: saveWeatherStationsLocal,
  } satisfies CollectionConfig<WeatherStation>,
  chemicalProducts: {
    table: 'chemical_products',
    seed: chemicalProducts,
    loadLocal: loadChemicalProductsLocal,
    saveLocal: saveChemicalProductsLocal,
  } satisfies CollectionConfig<ChemicalProduct>,
  applicationAreas: {
    table: 'application_areas',
    seed: applicationAreas,
    loadLocal: loadApplicationAreasLocal,
    saveLocal: saveApplicationAreasLocal,
  } satisfies CollectionConfig<ApplicationArea>,
  programSettings: {
    table: 'program_settings',
    seed: programSettings,
    loadLocal: loadProgramSettingsLocal,
    saveLocal: saveProgramSettingsLocal,
  } satisfies CollectionConfig<ProgramSettings>,
  departmentOptions: {
    table: 'department_options',
    seed: departmentOptions,
    loadLocal: loadDepartmentOptionsLocal,
    saveLocal: saveDepartmentOptionsLocal,
  } satisfies CollectionConfig<DepartmentOption>,
  groupOptions: {
    table: 'group_options',
    seed: groupOptions,
    loadLocal: loadGroupOptionsLocal,
    saveLocal: saveGroupOptionsLocal,
  } satisfies CollectionConfig<GroupOption>,
  roleOptions: {
    table: 'role_options',
    seed: roleOptions,
    loadLocal: loadRoleOptionsLocal,
    saveLocal: saveRoleOptionsLocal,
  } satisfies CollectionConfig<RoleOption>,
  languageOptions: {
    table: 'language_options',
    seed: languageOptions,
    loadLocal: loadLanguageOptionsLocal,
    saveLocal: saveLanguageOptionsLocal,
  } satisfies CollectionConfig<LanguageOption>,
  workLocations: {
    table: 'work_locations',
    seed: workLocations,
    loadLocal: loadWorkLocationsLocal,
    saveLocal: saveWorkLocationsLocal,
  } satisfies CollectionConfig<WorkLocation>,
  properties: {
    table: 'properties',
    seed: properties,
    loadLocal: loadPropertiesLocal,
    saveLocal: savePropertiesLocal,
  } satisfies CollectionConfig<Property>,
  propertyClassOptions: {
    table: 'property_class_options',
    seed: propertyClassOptions,
    loadLocal: loadPropertyClassOptionsLocal,
    saveLocal: savePropertyClassOptionsLocal,
  } satisfies CollectionConfig<PropertyClassOption>,
  taskRequests: {
    table: 'task_requests',
    seed: taskRequests,
    loadLocal: loadTaskRequestsLocal,
    saveLocal: saveTaskRequestsLocal,
  } satisfies CollectionConfig<TaskRequest>,
  shiftTemplates: {
    table: 'shift_templates',
    seed: shiftTemplates,
    loadLocal: loadShiftTemplatesLocal,
    saveLocal: saveShiftTemplatesLocal,
  } satisfies CollectionConfig<ShiftTemplate>,
  appUsers: {
    table: 'app_users',
    seed: appUsers,
    loadLocal: loadAppUsersLocal,
    saveLocal: saveAppUsersLocal,
  } satisfies CollectionConfig<AppUser>,
} as const;

let initialized = false;

function normalizeTask(task: Task, index = 0): Task {
  return {
    ...task,
    status: task.status ?? 'active',
    priority: task.priority ?? index + 1,
    skillTags: Array.isArray(task.skillTags) ? task.skillTags : [],
    equipmentTags: Array.isArray(task.equipmentTags) ? task.equipmentTags : [],
    notes: task.notes ?? '',
  };
}

function normalizePropertyClassOption(propertyClass: PropertyClassOption): PropertyClassOption {
  return {
    ...propertyClass,
    description: propertyClass.description ?? '',
    enabledModules: Array.isArray(propertyClass.enabledModules) ? propertyClass.enabledModules : [],
  };
}

function normalizeTaskRequest(request: TaskRequest): TaskRequest {
  return {
    ...request,
    requestedByType: request.requestedByType ?? 'user',
    priority: request.priority ?? 'medium',
    status: request.status ?? 'new',
    notes: request.notes ?? '',
  };
}

function normalizeWeatherLocation(location: WeatherLocation): WeatherLocation {
  return {
    ...location,
    propertyId: location.propertyId ?? '',
    address: location.address ?? '',
  };
}

function normalizeWeatherStation(station: WeatherStation): WeatherStation {
  return {
    ...station,
    providerType: station.providerType ?? 'manual',
    stationCategory: station.stationCategory ?? (station.providerType === 'manual' ? 'manual' : 'regional-grid'),
    timeZone: station.timeZone ?? '',
  };
}

function getCurrentClubId() {
  const currentUserId = loadCurrentAppUserIdLocal();
  const currentUser = loadAppUsersLocal().find((user) => user.id === currentUserId);
  if (currentUser?.clubId) return currentUser.clubId;

  const settings = loadProgramSettingsLocal();
  const configuredClubId = (settings[0] as ProgramSettings & { clubId?: string } | undefined)?.clubId;
  if (configuredClubId) return configuredClubId;

  return 'club-1';
}

function attachClubId<T extends PersistedRow>(rows: T[], clubId: string) {
  return rows.map((row) => ({ ...row, clubId: row.clubId ?? clubId })) as T[];
}

function isMissingClubIdError(error: { message?: string | null; details?: string | null; hint?: string | null } | null) {
  if (!error) return false;
  const detail = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase();
  return detail.includes('clubid') && (detail.includes('column') || detail.includes('schema cache') || detail.includes('could not find'));
}

async function syncRemoteRowsGlobal<T extends PersistedRow>(table: string, rows: T[]) {
  if (!supabase) return;
  const { data: existingRows, error: existingError } = await supabase.from(table).select('id');
  if (existingError) throw existingError;

  const nextRows = rows.filter((row) => row.id);
  if (nextRows.length > 0) {
    const { error: upsertError } = await supabase.from(table).upsert(nextRows as never, { onConflict: 'id' });
    if (upsertError) throw upsertError;
  }

  const nextIds = new Set(nextRows.map((row) => row.id as string));
  const staleIds = (existingRows ?? [])
    .map((row) => row.id as string | null | undefined)
    .filter((id): id is string => Boolean(id) && !nextIds.has(id));

  if (staleIds.length > 0) {
    const { error: deleteError } = await supabase.from(table).delete().in('id', staleIds);
    if (deleteError) throw deleteError;
  }
}

async function syncRemoteRowsScoped<T extends PersistedRow>(table: string, rows: T[], clubId: string) {
  if (!supabase) return;
  const scopedRows = attachClubId(rows, clubId);
  const { data: existingRows, error: existingError } = await supabase.from(table).select('id').eq('clubId', clubId);
  if (existingError) {
    if (isMissingClubIdError(existingError)) {
      await syncRemoteRowsGlobal(table, rows);
      return;
    }
    throw existingError;
  }

  const nextRows = scopedRows.filter((row) => row.id);
  if (nextRows.length > 0) {
    const { error: upsertError } = await supabase.from(table).upsert(nextRows as never, { onConflict: 'id' });
    if (upsertError) {
      if (isMissingClubIdError(upsertError)) {
        await syncRemoteRowsGlobal(table, rows);
        return;
      }
      throw upsertError;
    }
  }

  const nextIds = new Set(nextRows.map((row) => row.id as string));
  const staleIds = (existingRows ?? [])
    .map((row) => row.id as string | null | undefined)
    .filter((id): id is string => Boolean(id) && !nextIds.has(id));

  if (staleIds.length > 0) {
    const { error: deleteError } = await supabase.from(table).delete().eq('clubId', clubId).in('id', staleIds);
    if (deleteError) throw deleteError;
  }
}

async function readRemoteRows<T extends PersistedRow>(table: string, clubId: string) {
  if (!supabase) return [] as T[];
  const { data: scopedRows, error: scopedError } = await supabase.from(table).select('*').eq('clubId', clubId);
  if (scopedError) {
    if (isMissingClubIdError(scopedError)) {
      const { data: globalRows, error: globalError } = await supabase.from(table).select('*');
      if (globalError) throw globalError;
      return (globalRows ?? []) as T[];
    }
    throw scopedError;
  }

  if ((scopedRows ?? []).length > 0) {
    return scopedRows as T[];
  }

  const { data: legacyRows, error: legacyError } = await supabase.from(table).select('*').is('clubId', null);
  if (legacyError) {
    if (isMissingClubIdError(legacyError)) return [];
    throw legacyError;
  }

  return attachClubId((legacyRows ?? []) as T[], clubId);
}

async function hydrateCollection<T extends PersistedRow>(config: CollectionConfig<T>) {
  const clubId = getCurrentClubId();
  const localRows = attachClubId(config.loadLocal(), clubId);
  if (!supabase) {
    if (localRows.length > 0) config.saveLocal(localRows);
    return localRows;
  }

  let remoteRows: T[] = [];
  try {
    remoteRows = await readRemoteRows<T>(config.table, clubId);
  } catch {
    return localRows;
  }

  if (remoteRows.length === 0) {
    if (localRows.length > 0) {
      try {
        await syncRemoteRowsScoped(config.table, localRows, clubId);
      } catch {
        return localRows;
      }
    }
    return localRows;
  }

  const normalizedRemoteRows = attachClubId(remoteRows, clubId);
  config.saveLocal(normalizedRemoteRows);
  return normalizedRemoteRows;
}

function syncCollection<T extends PersistedRow>(config: CollectionConfig<T>, rows: T[]) {
  const clubId = getCurrentClubId();
  const scopedRows = attachClubId(rows, clubId);
  config.saveLocal(scopedRows);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(DATA_STORE_UPDATED_EVENT, {
        detail: { table: config.table },
      }),
    );
  }
  if (!supabase) return;
  void syncRemoteRowsScoped(config.table, scopedRows, clubId).catch((error) => {
    console.error(`Failed to sync ${config.table}`, error);
  });
}

export async function initializeDataStore() {
  if (initialized) return;
  initialized = true;

  if (!hasSupabaseConfig) return;

  await Promise.all([
    hydrateCollection(collections.employees),
    hydrateCollection(collections.tasks),
    hydrateCollection(collections.scheduleEntries),
    hydrateCollection(collections.assignments),
    hydrateCollection(collections.notes),
    hydrateCollection(collections.equipmentUnits),
    hydrateCollection(collections.weatherDailyLogs),
    hydrateCollection(collections.manualRainfallEntries),
    hydrateCollection(collections.chemicalApplicationLogs),
    hydrateCollection(collections.chemicalApplicationTankMixItems),
    hydrateCollection(collections.weatherLocations),
    hydrateCollection(collections.weatherStations),
    hydrateCollection(collections.chemicalProducts),
    hydrateCollection(collections.applicationAreas),
    hydrateCollection(collections.programSettings),
    hydrateCollection(collections.departmentOptions),
    hydrateCollection(collections.groupOptions),
    hydrateCollection(collections.roleOptions),
    hydrateCollection(collections.languageOptions),
    hydrateCollection(collections.workLocations),
    hydrateCollection(collections.properties),
    hydrateCollection(collections.propertyClassOptions),
    hydrateCollection(collections.taskRequests),
    hydrateCollection(collections.shiftTemplates),
    hydrateCollection(collections.appUsers),
  ]);
}

export function loadEmployees() {
  return collections.employees.loadLocal();
}

export function saveEmployees(value: Employee[]) {
  syncCollection(collections.employees, value);
}

export function loadTasks() {
  return collections.tasks.loadLocal().map((task, index) => normalizeTask(task, index));
}

export function saveTasks(value: Task[]) {
  syncCollection(collections.tasks, value.map((task, index) => normalizeTask(task, index)));
}

export function loadScheduleEntries() {
  return collections.scheduleEntries.loadLocal();
}

export function saveScheduleEntries(value: ScheduleEntry[]) {
  syncCollection(collections.scheduleEntries, value);
}

export function loadAssignments() {
  return collections.assignments.loadLocal();
}

export function saveAssignments(value: Assignment[]) {
  syncCollection(collections.assignments, value);
}

export function loadNotes() {
  return collections.notes.loadLocal();
}

export function saveNotes(value: Note[]) {
  syncCollection(collections.notes, value);
}

export function loadEquipmentUnits() {
  return collections.equipmentUnits.loadLocal();
}

export function saveEquipmentUnits(value: EquipmentUnit[]) {
  syncCollection(collections.equipmentUnits, value);
}

export function loadWeatherDailyLogs() {
  return collections.weatherDailyLogs.loadLocal();
}

export function saveWeatherDailyLogs(value: WeatherDailyLog[]) {
  syncCollection(collections.weatherDailyLogs, value);
}

export function loadManualRainfallEntries() {
  return collections.manualRainfallEntries.loadLocal();
}

export function saveManualRainfallEntries(value: ManualRainfallEntry[]) {
  syncCollection(collections.manualRainfallEntries, value);
}

export function loadChemicalApplicationLogs() {
  return collections.chemicalApplicationLogs.loadLocal();
}

export function saveChemicalApplicationLogs(value: ChemicalApplicationLog[]) {
  syncCollection(collections.chemicalApplicationLogs, value);
}

export function loadChemicalApplicationTankMixItems() {
  return collections.chemicalApplicationTankMixItems.loadLocal();
}

export function saveChemicalApplicationTankMixItems(value: ChemicalApplicationTankMixItem[]) {
  syncCollection(collections.chemicalApplicationTankMixItems, value);
}

export function loadWeatherLocations() {
  return collections.weatherLocations.loadLocal().map(normalizeWeatherLocation);
}

export function saveWeatherLocations(value: WeatherLocation[]) {
  syncCollection(collections.weatherLocations, value.map(normalizeWeatherLocation));
}

export function loadWeatherStations() {
  return collections.weatherStations.loadLocal().map(normalizeWeatherStation);
}

export function saveWeatherStations(value: WeatherStation[]) {
  syncCollection(collections.weatherStations, value.map(normalizeWeatherStation));
}

export function loadChemicalProducts() {
  return collections.chemicalProducts.loadLocal();
}

export function saveChemicalProducts(value: ChemicalProduct[]) {
  syncCollection(collections.chemicalProducts, value);
}

export function loadApplicationAreas() {
  return collections.applicationAreas.loadLocal();
}

export function saveApplicationAreas(value: ApplicationArea[]) {
  syncCollection(collections.applicationAreas, value);
}

export function loadProgramSettings() {
  return collections.programSettings.loadLocal();
}

export function saveProgramSettings(value: ProgramSettings[]) {
  syncCollection(collections.programSettings, value);
}

export function loadDepartmentOptions() {
  return collections.departmentOptions.loadLocal();
}

export function saveDepartmentOptions(value: DepartmentOption[]) {
  syncCollection(collections.departmentOptions, value);
}

export function loadGroupOptions() {
  return collections.groupOptions.loadLocal();
}

export function saveGroupOptions(value: GroupOption[]) {
  syncCollection(collections.groupOptions, value);
}

export function loadRoleOptions() {
  return collections.roleOptions.loadLocal();
}

export function saveRoleOptions(value: RoleOption[]) {
  syncCollection(collections.roleOptions, value);
}

export function loadLanguageOptions() {
  return collections.languageOptions.loadLocal();
}

export function saveLanguageOptions(value: LanguageOption[]) {
  syncCollection(collections.languageOptions, value);
}

export function loadWorkLocations() {
  return collections.workLocations.loadLocal();
}

export function saveWorkLocations(value: WorkLocation[]) {
  syncCollection(collections.workLocations, value);
}

export function loadProperties() {
  return collections.properties.loadLocal();
}

export function saveProperties(value: Property[]) {
  syncCollection(collections.properties, value);
}

export function loadPropertyClassOptions() {
  return collections.propertyClassOptions.loadLocal().map(normalizePropertyClassOption);
}

export function savePropertyClassOptions(value: PropertyClassOption[]) {
  syncCollection(collections.propertyClassOptions, value.map(normalizePropertyClassOption));
}

export function loadTaskRequests() {
  return collections.taskRequests.loadLocal().map(normalizeTaskRequest);
}

export function saveTaskRequests(value: TaskRequest[]) {
  syncCollection(collections.taskRequests, value.map(normalizeTaskRequest));
}

export function loadShiftTemplates() {
  return collections.shiftTemplates.loadLocal();
}

export function saveShiftTemplates(value: ShiftTemplate[]) {
  syncCollection(collections.shiftTemplates, value);
}

export function loadAppUsers() {
  return collections.appUsers.loadLocal();
}

export function saveAppUsers(value: AppUser[]) {
  syncCollection(collections.appUsers, value);
}

export function loadCurrentAppUserId() {
  return loadCurrentAppUserIdLocal();
}

export function saveCurrentAppUserId(value: string) {
  saveCurrentAppUserIdLocal(value);
}

export function loadCurrentPropertyId() {
  return loadCurrentPropertyIdLocal();
}

export function saveCurrentPropertyId(value: string) {
  saveCurrentPropertyIdLocal(value);
}
