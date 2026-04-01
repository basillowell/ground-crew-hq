import {
  applicationAreas,
  chemicalApplicationLogs,
  chemicalApplicationTankMixItems,
  chemicalProducts,
  assignments,
  employees,
  equipmentUnits,
  manualRainfallEntries,
  notes,
  scheduleEntries,
  tasks,
  weatherDailyLogs,
  weatherLocations,
  weatherStations,
  type ApplicationArea,
  type Assignment,
  type ChemicalApplicationLog,
  type ChemicalApplicationTankMixItem,
  type ChemicalProduct,
  type EquipmentUnit,
  type Employee,
  type ManualRainfallEntry,
  type Note,
  type ScheduleEntry,
  type Task,
  type WeatherDailyLog,
  type WeatherLocation,
  type WeatherStation,
} from '@/data/seedData';
import {
  loadApplicationAreas as loadApplicationAreasLocal,
  loadAssignments as loadAssignmentsLocal,
  loadChemicalApplicationLogs as loadChemicalApplicationLogsLocal,
  loadChemicalApplicationTankMixItems as loadChemicalApplicationTankMixItemsLocal,
  loadChemicalProducts as loadChemicalProductsLocal,
  loadEmployees as loadEmployeesLocal,
  loadEquipmentUnits as loadEquipmentUnitsLocal,
  loadManualRainfallEntries as loadManualRainfallEntriesLocal,
  loadNotes as loadNotesLocal,
  loadScheduleEntries as loadScheduleEntriesLocal,
  loadTasks as loadTasksLocal,
  loadWeatherDailyLogs as loadWeatherDailyLogsLocal,
  loadWeatherLocations as loadWeatherLocationsLocal,
  loadWeatherStations as loadWeatherStationsLocal,
  saveApplicationAreas as saveApplicationAreasLocal,
  saveAssignments as saveAssignmentsLocal,
  saveChemicalApplicationLogs as saveChemicalApplicationLogsLocal,
  saveChemicalApplicationTankMixItems as saveChemicalApplicationTankMixItemsLocal,
  saveChemicalProducts as saveChemicalProductsLocal,
  saveEmployees as saveEmployeesLocal,
  saveEquipmentUnits as saveEquipmentUnitsLocal,
  saveManualRainfallEntries as saveManualRainfallEntriesLocal,
  saveNotes as saveNotesLocal,
  saveScheduleEntries as saveScheduleEntriesLocal,
  saveTasks as saveTasksLocal,
  saveWeatherDailyLogs as saveWeatherDailyLogsLocal,
  saveWeatherLocations as saveWeatherLocationsLocal,
  saveWeatherStations as saveWeatherStationsLocal,
} from './operationsStorage';
import { hasSupabaseConfig, supabase } from './supabase';

type CollectionConfig<T> = {
  table: string;
  seed: T[];
  loadLocal: () => T[];
  saveLocal: (value: T[]) => void;
};

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
} as const;

let initialized = false;

async function replaceRemoteRows<T extends { id?: string }>(table: string, rows: T[]) {
  if (!supabase) return;
  const { error: deleteError } = await supabase.from(table).delete().not('id', 'is', null);
  if (deleteError && !deleteError.message.includes('0 rows')) {
    throw deleteError;
  }
  if (rows.length === 0) return;
  const { error: insertError } = await supabase.from(table).insert(rows as never);
  if (insertError) throw insertError;
}

async function hydrateCollection<T extends { id?: string }>(config: CollectionConfig<T>) {
  if (!supabase) {
    return config.loadLocal();
  }

  const { data, error } = await supabase.from(config.table).select('*');
  if (error) {
    return config.loadLocal();
  }

  if (!data || data.length === 0) {
    const localRows = config.loadLocal();
    if (localRows.length > 0) {
      try {
        await replaceRemoteRows(config.table, localRows);
      } catch {
        return localRows;
      }
    }
    return localRows;
  }

  config.saveLocal(data as T[]);
  return data as T[];
}

function syncCollection<T extends { id?: string }>(config: CollectionConfig<T>, rows: T[]) {
  config.saveLocal(rows);
  if (!supabase) return;
  void replaceRemoteRows(config.table, rows).catch(() => undefined);
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
  ]);
}

export function loadEmployees() {
  return collections.employees.loadLocal();
}

export function saveEmployees(value: Employee[]) {
  syncCollection(collections.employees, value);
}

export function loadTasks() {
  return collections.tasks.loadLocal();
}

export function saveTasks(value: Task[]) {
  syncCollection(collections.tasks, value);
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
  return collections.weatherLocations.loadLocal();
}

export function saveWeatherLocations(value: WeatherLocation[]) {
  syncCollection(collections.weatherLocations, value);
}

export function loadWeatherStations() {
  return collections.weatherStations.loadLocal();
}

export function saveWeatherStations(value: WeatherStation[]) {
  syncCollection(collections.weatherStations, value);
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
