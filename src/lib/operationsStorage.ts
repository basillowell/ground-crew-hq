import {
  assignments,
  applicationAreas,
  chemicalApplicationLogs,
  chemicalApplicationTankMixItems,
  chemicalProducts,
  equipmentUnits,
  employees,
  manualRainfallEntries,
  notes,
  scheduleEntries,
  tasks,
  weatherDailyLogs,
  weatherLocations,
  weatherStations,
  type Assignment,
  type ApplicationArea,
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

// Legacy compatibility layer: this file now backs the clearer `dataStore` module.

const EMPLOYEES_KEY = 'gchq-employees';
const TASKS_KEY = 'gchq-tasks';
const SCHEDULE_ENTRIES_KEY = 'gchq-schedule-entries';
const ASSIGNMENTS_KEY = 'gchq-assignments';
const NOTES_KEY = 'gchq-notes';
const EQUIPMENT_UNITS_KEY = 'gchq-equipment-units';
const WEATHER_LOGS_KEY = 'gchq-weather-daily-logs';
const MANUAL_RAIN_KEY = 'gchq-manual-rainfall';
const APPLICATION_LOGS_KEY = 'gchq-application-logs';
const TANK_MIX_ITEMS_KEY = 'gchq-application-tank-mix';
const WEATHER_LOCATIONS_KEY = 'gchq-weather-locations';
const WEATHER_STATIONS_KEY = 'gchq-weather-stations';
const CHEMICAL_PRODUCTS_KEY = 'gchq-chemical-products';
const APPLICATION_AREAS_KEY = 'gchq-application-areas';

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readList<T>(key: string, fallback: T[]): T[] {
  if (!canUseStorage()) return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeList<T>(key: string, value: T[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function loadEmployees() {
  return readList<Employee>(EMPLOYEES_KEY, employees);
}

export function saveEmployees(value: Employee[]) {
  writeList(EMPLOYEES_KEY, value);
}

export function loadTasks() {
  return readList<Task>(TASKS_KEY, tasks);
}

export function saveTasks(value: Task[]) {
  writeList(TASKS_KEY, value);
}

export function loadScheduleEntries() {
  return readList<ScheduleEntry>(SCHEDULE_ENTRIES_KEY, scheduleEntries);
}

export function saveScheduleEntries(value: ScheduleEntry[]) {
  writeList(SCHEDULE_ENTRIES_KEY, value);
}

export function loadAssignments() {
  return readList<Assignment>(ASSIGNMENTS_KEY, assignments);
}

export function saveAssignments(value: Assignment[]) {
  writeList(ASSIGNMENTS_KEY, value);
}

export function loadNotes() {
  return readList<Note>(NOTES_KEY, notes);
}

export function saveNotes(value: Note[]) {
  writeList(NOTES_KEY, value);
}

export function loadEquipmentUnits() {
  return readList<EquipmentUnit>(EQUIPMENT_UNITS_KEY, equipmentUnits);
}

export function saveEquipmentUnits(value: EquipmentUnit[]) {
  writeList(EQUIPMENT_UNITS_KEY, value);
}

export function loadWeatherDailyLogs() {
  return readList<WeatherDailyLog>(WEATHER_LOGS_KEY, weatherDailyLogs);
}

export function saveWeatherDailyLogs(value: WeatherDailyLog[]) {
  writeList(WEATHER_LOGS_KEY, value);
}

export function loadManualRainfallEntries() {
  return readList<ManualRainfallEntry>(MANUAL_RAIN_KEY, manualRainfallEntries);
}

export function saveManualRainfallEntries(value: ManualRainfallEntry[]) {
  writeList(MANUAL_RAIN_KEY, value);
}

export function loadChemicalApplicationLogs() {
  return readList<ChemicalApplicationLog>(APPLICATION_LOGS_KEY, chemicalApplicationLogs);
}

export function saveChemicalApplicationLogs(value: ChemicalApplicationLog[]) {
  writeList(APPLICATION_LOGS_KEY, value);
}

export function loadChemicalApplicationTankMixItems() {
  return readList<ChemicalApplicationTankMixItem>(TANK_MIX_ITEMS_KEY, chemicalApplicationTankMixItems);
}

export function saveChemicalApplicationTankMixItems(value: ChemicalApplicationTankMixItem[]) {
  writeList(TANK_MIX_ITEMS_KEY, value);
}

export function loadWeatherLocations() {
  return readList<WeatherLocation>(WEATHER_LOCATIONS_KEY, weatherLocations);
}

export function saveWeatherLocations(value: WeatherLocation[]) {
  writeList(WEATHER_LOCATIONS_KEY, value);
}

export function loadWeatherStations() {
  return readList<WeatherStation>(WEATHER_STATIONS_KEY, weatherStations);
}

export function saveWeatherStations(value: WeatherStation[]) {
  writeList(WEATHER_STATIONS_KEY, value);
}

export function loadChemicalProducts() {
  return readList<ChemicalProduct>(CHEMICAL_PRODUCTS_KEY, chemicalProducts);
}

export function saveChemicalProducts(value: ChemicalProduct[]) {
  writeList(CHEMICAL_PRODUCTS_KEY, value);
}

export function loadApplicationAreas() {
  return readList<ApplicationArea>(APPLICATION_AREAS_KEY, applicationAreas);
}

export function saveApplicationAreas(value: ApplicationArea[]) {
  writeList(APPLICATION_AREAS_KEY, value);
}
