import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AreaChart, Area, Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CloudSun, Crosshair, Droplets, MapPin, MapPinned, MoreHorizontal, PencilLine, Plus, Radar, RefreshCcw, Save, Search, Settings, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/shared';
import { WeatherSnapshotCard } from '@/components/weather/WeatherSnapshotCard';
import { type WeatherWidgetId, type WeatherWidgetLiveData } from '@/components/weather/OperationsView';
import { RainfallTracker } from '@/components/weather/RainfallTracker';
import { WeatherSettingsDrawer } from '@/components/weather/WeatherSettingsDrawer';
import {
  type ManualRainfallEntry,
  type Property,
  type ProgramSettings,
  type WeatherDailyLog,
  type WeatherLocation,
  type WeatherStation,
  type WeatherStationSuggestion,
  type WorkLocation,
} from '@/data/seedData';
import { toast } from '@/components/ui/sonner';
import { fetchPrimaryStationSnapshot, fetchStationForecastDetail, fetchWeatherStationSuggestions, type GeocodeResult, type WeatherForecastDetail } from '@/lib/weatherProviders';
import { fetchOpenMeteoWeather, getWeatherConditionMeta } from '@/lib/openMeteo';
import { DEFAULT_WEATHER_LOCATION, useWeather, getWeatherIconMeta } from '@/lib/weather';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useProperties, useProgramSettings, useWeatherLocations, useWorkLocations } from '@/lib/supabase-queries';
import { useNavigate, useSearchParams } from 'react-router-dom';

type EntryMode = 'rainfall' | 'override';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

const emptyEntry = {
  locationId: '',
  date: todayIsoDate(),
  rainfallAmount: '0.00',
  enteredBy: 'Operations Admin',
  notes: '',
  currentConditions: 'Manual Entry',
  forecast: 'Station unavailable',
  temperature: '72',
  humidity: '62',
  wind: '6',
  windGust: '10',
  et: '0.18',
};

function makeId(prefix: string) {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function hasValidCoordinates(latitude?: number, longitude?: number) {
  return typeof latitude === 'number' && Number.isFinite(latitude) && typeof longitude === 'number' && Number.isFinite(longitude);
}

function isLegacyPlaceholderCoordinates(latitude?: number, longitude?: number) {
  if (!hasValidCoordinates(latitude, longitude)) return false;
  return Math.abs((latitude ?? 0) - 35.78) < 0.0001 && Math.abs((longitude ?? 0) - (-78.64)) < 0.0001;
}

function mapWeatherStationRow(row: any): WeatherStation {
  return {
    id: String(row.id),
    locationId: String(row.location_id ?? row.locationId ?? ''),
    name: String(row.name ?? 'Weather Station'),
    provider: String(row.provider ?? 'Manual'),
    providerType: (row.provider_type ?? row.providerType ?? 'manual') as WeatherStation['providerType'],
    stationCode: String(row.station_code ?? row.stationCode ?? 'STATION'),
    latitude: typeof row.latitude === 'number' ? row.latitude : row.latitude ? Number(row.latitude) : undefined,
    longitude: typeof row.longitude === 'number' ? row.longitude : row.longitude ? Number(row.longitude) : undefined,
    timeZone: row.time_zone ?? row.timeZone ?? undefined,
    stationCategory: (row.station_category ?? row.stationCategory ?? undefined) as WeatherStation['stationCategory'],
    distanceMiles:
      typeof row.distance_miles === 'number' ? row.distance_miles : typeof row.distanceMiles === 'number' ? row.distanceMiles : undefined,
    isPrimary: Boolean(row.is_primary ?? row.isPrimary),
    status: (row.status ?? 'offline') as WeatherStation['status'],
  };
}

function mapWeatherDailyLogRow(row: any): WeatherDailyLog {
  return {
    id: String(row.id),
    locationId: String(row.location_id ?? row.locationId ?? ''),
    stationId: row.station_id ?? row.stationId ?? undefined,
    date: String(row.date),
    capturedAt: row.captured_at ?? row.capturedAt ?? undefined,
    currentConditions: String(row.current_conditions ?? row.currentConditions ?? 'Unknown'),
    forecast: String(row.forecast ?? ''),
    rainfallTotal: Number(row.rainfall_total ?? row.rainfallTotal ?? 0),
    temperature: Number(row.temperature ?? 0),
    humidity: Number(row.humidity ?? 0),
    wind: Number(row.wind ?? 0),
    windGust: Number(row.wind_gust ?? row.windGust ?? 0),
    et: Number(row.et ?? 0),
    source: (row.source ?? 'station') as WeatherDailyLog['source'],
    alerts: Array.isArray(row.alerts) ? row.alerts : [],
    notes: row.notes ?? '',
  };
}

function mapManualRainEntryRow(row: any): ManualRainfallEntry {
  return {
    id: String(row.id),
    locationId: String(row.location_id ?? row.locationId ?? ''),
    date: String(row.date),
    rainfallAmount: Number(row.rainfall_amount ?? row.rainfallAmount ?? 0),
    enteredBy: String(row.entered_by ?? row.enteredBy ?? 'Operations Admin'),
    notes: row.notes ?? '',
  };
}

function isRecoverableWeatherQueryError(error: unknown) {
  const code = (error as { code?: string } | null)?.code ?? '';
  const message = String((error as { message?: string } | null)?.message ?? '').toLowerCase();
  return (
    code === '42703' ||
    code === '42P01' ||
    (message.includes('column') && message.includes('org_id')) ||
    (message.includes('relation') && message.includes('does not exist'))
  );
}

const DEFAULT_FACILITY_LABEL = 'Sarasota Polo Club · 8201 Polo Club Lane, Sarasota, FL 34240';
const DEFAULT_SETTINGS_PANELS = [
  'current-conditions',
  'hourly-forecast',
  'daily-forecast',
  'wind',
  'rain',
  'alerts',
  'turf-risk-notes',
] as const;
const DEFAULT_WIDGETS: WeatherWidgetId[] = [
  'current',
  'hourly_forecast',
  'wind',
  'precipitation',
  'humidity',
  'uv_index',
  'feels_like',
  '7day_forecast',
];
const SARASOTA_WIDGET_FALLBACK = { latitude: 27.3364, longitude: -82.5307 };
const PANEL_TO_WIDGET: Record<string, WeatherWidgetId> = {
  'current-conditions': 'current',
  'hourly-forecast': 'hourly_forecast',
  'daily-forecast': '7day_forecast',
  wind: 'wind',
  rain: 'precipitation',
  alerts: 'uv_index',
  'turf-risk-notes': 'feels_like',
};

export default function WeatherPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser, currentPropertyId } = useAuth();
  const setupMode = searchParams.get('setup') === 'true';
  const setupPropertyId = searchParams.get('propertyId');
  const weatherScopePropertyId = setupMode && setupPropertyId ? setupPropertyId : currentPropertyId;
  const propertiesQuery = useProperties(currentUser?.orgId);
  const properties = useMemo(() => propertiesQuery.data ?? [], [propertiesQuery.data]);
  const programSettingQuery = useProgramSettings(currentUser?.orgId);
  const programSetting = programSettingQuery.data ?? null;
  const workLocationsQuery = useWorkLocations();
  const workLocations = useMemo(() => workLocationsQuery.data ?? [], [workLocationsQuery.data]);
  const weatherLocationsQuery = useWeatherLocations(undefined, currentUser?.orgId, true);
  const weatherStationsQuery = useQuery({
    queryKey: ['weather-stations-full', currentUser?.orgId ?? 'all-orgs'],
    enabled: Boolean(currentUser),
    queryFn: async () => {
      const filteredQuery = currentUser?.orgId
        ? supabase.from('weather_stations').select('*').eq('org_id', currentUser.orgId).order('name')
        : supabase.from('weather_stations').select('*').order('name');
      const filteredResult = await filteredQuery;
      if (!filteredResult.error) {
        return ((filteredResult.data as any[]) ?? []).map(mapWeatherStationRow);
      }
      if (!isRecoverableWeatherQueryError(filteredResult.error)) throw filteredResult.error;
      if ((filteredResult.error as { code?: string } | null)?.code === '42P01') return [];

      const fallbackResult = await supabase.from('weather_stations').select('*').order('name');
      if (fallbackResult.error) {
        if ((fallbackResult.error as { code?: string } | null)?.code === '42P01') return [];
        throw fallbackResult.error;
      }
      return ((fallbackResult.data as any[]) ?? []).map(mapWeatherStationRow);
    },
    staleTime: 1000 * 60 * 5,
  });
  const weatherLogsQuery = useQuery({
    queryKey: ['weather-daily-logs-page', currentUser?.orgId ?? 'all-orgs'],
    enabled: Boolean(currentUser),
    queryFn: async () => {
      const filteredQuery = currentUser?.orgId
        ? supabase
            .from('weather_daily_logs')
            .select('*')
            .eq('org_id', currentUser.orgId)
            .order('date', { ascending: false })
            .limit(180)
        : supabase.from('weather_daily_logs').select('*').order('date', { ascending: false }).limit(180);
      const filteredResult = await filteredQuery;
      if (!filteredResult.error) {
        return ((filteredResult.data as any[]) ?? []).map(mapWeatherDailyLogRow);
      }
      if (!isRecoverableWeatherQueryError(filteredResult.error)) throw filteredResult.error;
      if ((filteredResult.error as { code?: string } | null)?.code === '42P01') return [];

      const fallbackResult = await supabase.from('weather_daily_logs').select('*').order('date', { ascending: false }).limit(180);
      if (fallbackResult.error) {
        if ((fallbackResult.error as { code?: string } | null)?.code === '42P01') return [];
        throw fallbackResult.error;
      }
      return ((fallbackResult.data as any[]) ?? []).map(mapWeatherDailyLogRow);
    },
    staleTime: 1000 * 60 * 2,
  });
  const rainfallEntriesQuery = useQuery({
    queryKey: ['manual-rainfall-entries-page', currentUser?.orgId ?? 'all-orgs'],
    enabled: Boolean(currentUser),
    queryFn: async () => {
      const filteredQuery = currentUser?.orgId
        ? supabase
            .from('manual_rainfall_entries')
            .select('*')
            .eq('org_id', currentUser.orgId)
            .order('date', { ascending: false })
            .limit(180)
        : supabase.from('manual_rainfall_entries').select('*').order('date', { ascending: false }).limit(180);
      const filteredResult = await filteredQuery;
      if (!filteredResult.error) {
        return ((filteredResult.data as any[]) ?? []).map(mapManualRainEntryRow);
      }
      if (!isRecoverableWeatherQueryError(filteredResult.error)) throw filteredResult.error;
      if ((filteredResult.error as { code?: string } | null)?.code === '42P01') return [];

      const fallbackResult = await supabase.from('manual_rainfall_entries').select('*').order('date', { ascending: false }).limit(180);
      if (fallbackResult.error) {
        if ((fallbackResult.error as { code?: string } | null)?.code === '42P01') return [];
        throw fallbackResult.error;
      }
      return ((fallbackResult.data as any[]) ?? []).map(mapManualRainEntryRow);
    },
    staleTime: 1000 * 60 * 2,
  });
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [selectedWorkLocationId, setSelectedWorkLocationId] = useState('');
  const [weatherLocations, setWeatherLocations] = useState<WeatherLocation[]>([]);
  const [weatherStations, setWeatherStations] = useState<WeatherStation[]>([]);
  const [weatherLogs, setWeatherLogs] = useState<WeatherDailyLog[]>([]);
  const [rainEntries, setRainEntries] = useState<ManualRainfallEntry[]>([]);
  const [liveLog, setLiveLog] = useState<WeatherDailyLog | null>(null);
  const [liveStatus, setLiveStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [dialogMode, setDialogMode] = useState<EntryMode>('rainfall');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState(emptyEntry);
  const [customAreaName, setCustomAreaName] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);
  const [geoLoadingStationId, setGeoLoadingStationId] = useState<string | null>(null);
  const [stationSearchQuery, setStationSearchQuery] = useState('');
  const [discoveryAnchor, setDiscoveryAnchor] = useState<GeocodeResult | null>(null);
  const [useSearchAnchorAsLiveSource, setUseSearchAnchorAsLiveSource] = useState(false);
  const [stationSuggestions, setStationSuggestions] = useState<WeatherStationSuggestion[]>([]);
  const [stationSearchStatus, setStationSearchStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [propertyLiveLogs, setPropertyLiveLogs] = useState<Record<string, WeatherDailyLog | null>>({});
  const [selectedForecast, setSelectedForecast] = useState<WeatherForecastDetail | null>(null);
  const [browserCoordinates, setBrowserCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showHourlyForecast, setShowHourlyForecast] = useState(true);
  const [showCurrentConditions, setShowCurrentConditions] = useState(true);
  const [showDailyForecast, setShowDailyForecast] = useState(true);
  const [showWind, setShowWind] = useState(true);
  const [showRain, setShowRain] = useState(true);
  const [showAlerts, setShowAlerts] = useState(true);
  const [showTurfRiskNotes, setShowTurfRiskNotes] = useState(true);
  const [showStationManagement, setShowStationManagement] = useState(false);
  const [showPropertyWeatherCards, setShowPropertyWeatherCards] = useState(true);
  const [showManualRainfallHistory, setShowManualRainfallHistory] = useState(false);
  const [showDetailedDiagnostics, setShowDetailedDiagnostics] = useState(false);
  const [showHourlyTempMetric, setShowHourlyTempMetric] = useState(true);
  const [showHourlyRainMetric, setShowHourlyRainMetric] = useState(true);
  const [showHourlyWindMetric, setShowHourlyWindMetric] = useState(true);
  const [showOperationsControls, setShowOperationsControls] = useState(false);
  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false);
  const [prefsDraftWidgets, setPrefsDraftWidgets] = useState<WeatherWidgetId[]>([]);
  const [prefsDraftEnabledWidgets, setPrefsDraftEnabledWidgets] = useState<WeatherWidgetId[]>([]);
  const [prefsDraftLocationId, setPrefsDraftLocationId] = useState('');
  const [showLocationSetup, setShowLocationSetup] = useState(false);
  const [locationQuery, setLocationQuery] = useState('');
  const [locationSearchResults, setLocationSearchResults] = useState<Array<{ label: string; latitude: number; longitude: number }>>([]);
  const [locationSearchLoading, setLocationSearchLoading] = useState(false);
  const [locationSaveLoading, setLocationSaveLoading] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<1 | 2 | 3>(1);
  const [onboardingMethod, setOnboardingMethod] = useState<'none' | 'search' | 'manual'>('none');
  const [onboardingSearchQuery, setOnboardingSearchQuery] = useState('');
  const [onboardingSearchLoading, setOnboardingSearchLoading] = useState(false);
  const [onboardingSearchResults, setOnboardingSearchResults] = useState<Array<{ label: string; latitude: number; longitude: number }>>([]);
  const [onboardingSelectedLat, setOnboardingSelectedLat] = useState<number | null>(null);
  const [onboardingSelectedLng, setOnboardingSelectedLng] = useState<number | null>(null);
  const [onboardingSelectedLabel, setOnboardingSelectedLabel] = useState('');
  const [onboardingManualLat, setOnboardingManualLat] = useState('');
  const [onboardingManualLng, setOnboardingManualLng] = useState('');
  const [onboardingAreaName, setOnboardingAreaName] = useState('');
  const [onboardingSaving, setOnboardingSaving] = useState(false);
  const [onboardingSheetOpen, setOnboardingSheetOpen] = useState(false);
  const [removeAreaId, setRemoveAreaId] = useState<string | null>(null);
  const [widgetPrefsId, setWidgetPrefsId] = useState<string | null>(null);
  const [weatherLoadTimedOut, setWeatherLoadTimedOut] = useState(false);

  const settingsDefaultWeather = useMemo(() => {
    const locationName = programSetting?.weatherDefaultLocationName?.trim() || 'Sarasota Polo Club';
    const address = programSetting?.weatherDefaultAddress?.trim() || '8201 Polo Club Lane, Sarasota, FL 34240';
    const latitude = Number.isFinite(programSetting?.weatherDefaultLatitude) ? Number(programSetting?.weatherDefaultLatitude) : 27.3364;
    const longitude = Number.isFinite(programSetting?.weatherDefaultLongitude) ? Number(programSetting?.weatherDefaultLongitude) : -82.5307;
    const panels = programSetting?.weatherEnabledPanels?.length ? programSetting.weatherEnabledPanels : [...DEFAULT_SETTINGS_PANELS];
    return { locationName, address, latitude, longitude, panels };
  }, [programSetting]);

  useEffect(() => {
    const enabled = new Set(settingsDefaultWeather.panels);
    setShowCurrentConditions(enabled.has('current-conditions'));
    setShowHourlyForecast(enabled.has('hourly-forecast'));
    setShowDailyForecast(enabled.has('daily-forecast'));
    setShowWind(enabled.has('wind'));
    setShowRain(enabled.has('rain'));
    setShowAlerts(enabled.has('alerts'));
    setShowTurfRiskNotes(enabled.has('turf-risk-notes'));
  }, [settingsDefaultWeather.panels]);

  useEffect(() => {
    setSelectedWorkLocationId((current) => {
      if (!workLocations.length) return '';
      if (current && workLocations.some((location) => location.id === current)) return current;
      return workLocations[0]?.id ?? '';
    });
  }, [workLocations]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setBrowserCoordinates({
          latitude: Number(position.coords.latitude.toFixed(4)),
          longitude: Number(position.coords.longitude.toFixed(4)),
        });
      },
      () => undefined,
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 1000 * 60 * 30,
      },
    );
  }, []);

  useEffect(() => {
    if (weatherLocationsQuery.data) {
      setWeatherLocations(weatherLocationsQuery.data);
    }
    if (weatherStationsQuery.data) {
      setWeatherStations(weatherStationsQuery.data);
    }
    if (weatherLogsQuery.data) {
      setWeatherLogs(weatherLogsQuery.data);
    }
    if (rainfallEntriesQuery.data) {
      setRainEntries(rainfallEntriesQuery.data);
    }
  }, [rainfallEntriesQuery.data, weatherLocationsQuery.data, weatherLogsQuery.data, weatherStationsQuery.data]);

  const currentProperty = properties.find((property) => property.id === weatherScopePropertyId) ?? null;
  const hasLocation = hasValidCoordinates(currentProperty?.latitude, currentProperty?.longitude);
  useEffect(() => {
    if (currentProperty?.name && !onboardingAreaName.trim()) {
      setOnboardingAreaName(currentProperty.name);
    }
  }, [currentProperty?.name, onboardingAreaName]);
  const propertyScopedWeatherLocations = useMemo(() => {
    if (!currentProperty) return [];
    const propertyName = currentProperty.name.trim().toLowerCase();
    return weatherLocations.filter(
      (location) =>
        location.propertyId === currentProperty.id ||
        (location.property ?? '').trim().toLowerCase() === propertyName,
    );
  }, [currentProperty, weatherLocations]);
  const needsPropertyWeatherOnboarding =
    Boolean(currentProperty && currentPropertyId && currentPropertyId !== 'all') &&
    propertyScopedWeatherLocations.length === 0;

  function resolveLocationForProperty(property: Property | null | undefined) {
    if (!property) return null;
    const byPropertyId = weatherLocations.find((location) => location.propertyId === property.id);
    if (byPropertyId) return byPropertyId;
    const propertyName = property.name.trim().toLowerCase();
    const byPropertyName = weatherLocations.find((location) => (location.property ?? '').trim().toLowerCase() === propertyName);
    return byPropertyName ?? null;
  }

  const selectedLocation = useMemo(() => {
    const bySelection = weatherLocations.find((location) => location.id === selectedLocationId);
    if (bySelection) return bySelection;
    const byCurrentProperty = resolveLocationForProperty(currentProperty);
    if (byCurrentProperty) return byCurrentProperty;
    return weatherLocations[0] ?? null;
  }, [currentProperty, selectedLocationId, weatherLocations]);

  useEffect(() => {
    if (!weatherLocations.length) {
      if (selectedLocationId) setSelectedLocationId('');
      return;
    }
    if (selectedLocation && selectedLocation.id !== selectedLocationId) {
      setSelectedLocationId(selectedLocation.id);
      return;
    }
    if (!selectedLocationId) {
      setSelectedLocationId(selectedLocation?.id ?? weatherLocations[0]?.id ?? '');
    }
  }, [selectedLocation, selectedLocationId, weatherLocations]);

  const selectedProperty = selectedLocation
    ? properties.find((property) => property.id === selectedLocation.propertyId) ??
      properties.find((property) => property.name.trim().toLowerCase() === (selectedLocation.property ?? '').trim().toLowerCase()) ??
      currentProperty
    : currentProperty;
  const selectedPropertyWeatherQuery = useWeather(selectedProperty?.id);
  const locationStations = weatherStations
    .filter((station) => station.locationId === (selectedLocation?.id ?? selectedLocationId))
    .sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary));
  const primaryStation = locationStations.find((station) => station.isPrimary) ?? locationStations[0];
  const selectedPropertyWeatherMeta = getWeatherIconMeta(selectedPropertyWeatherQuery.data?.current.weatherCode);
  const SelectedPropertyWeatherIcon = selectedPropertyWeatherMeta.icon;
  const locationLogs = weatherLogs
    .filter((log) => log.locationId === (selectedLocation?.id ?? selectedLocationId))
    .sort((left, right) => left.date.localeCompare(right.date));
  const latestStoredLog = [...locationLogs].sort((left, right) => right.date.localeCompare(left.date))[0];
  const locationRain = rainEntries
    .filter((entry) => entry.locationId === (selectedLocation?.id ?? selectedLocationId))
    .sort((left, right) => right.date.localeCompare(left.date));
  const availableWorkLocations = workLocations.filter(
    (location) => !weatherLocations.some((weatherLocation) => weatherLocation.area === location.name),
  );

  const historyData = locationLogs.map((log) => ({
    date: log.date.slice(5),
    temperature: log.temperature,
    rainfall: log.rainfallTotal,
    et: log.et,
  }));

  const stationsOnline = locationStations.filter((station) => station.status === 'online').length;
  const manualOverrideCount = locationLogs.filter((log) => log.source === 'manual-override').length;
  const scopedLocationIds = new Set(weatherLocations.map((location) => location.id));
  const scopedStationCount = weatherStations.filter((station) => scopedLocationIds.has(station.locationId)).length;
  const isWeatherSetupIncomplete = weatherLocations.length === 0 || scopedStationCount === 0;
  const isInitialWeatherSetupLoading =
    weatherLocationsQuery.isLoading ||
    weatherStationsQuery.isLoading ||
    weatherLogsQuery.isLoading ||
    rainfallEntriesQuery.isLoading;
  const hasWeatherSetupError =
    weatherLocationsQuery.isError ||
    weatherStationsQuery.isError ||
    weatherLogsQuery.isError ||
    rainfallEntriesQuery.isError;
  const weatherSetupErrorMessage =
    (weatherLocationsQuery.error as { message?: string } | null)?.message ||
    (weatherStationsQuery.error as { message?: string } | null)?.message ||
    (weatherLogsQuery.error as { message?: string } | null)?.message ||
    (rainfallEntriesQuery.error as { message?: string } | null)?.message ||
    'Unknown weather query failure.';
  const weatherQueryErrors = useMemo(
    () =>
      [
        (weatherLocationsQuery.error as { message?: string } | null)?.message,
        (weatherStationsQuery.error as { message?: string } | null)?.message,
        (weatherLogsQuery.error as { message?: string } | null)?.message,
        (rainfallEntriesQuery.error as { message?: string } | null)?.message,
      ].filter(Boolean) as string[],
    [rainfallEntriesQuery.error, weatherLocationsQuery.error, weatherLogsQuery.error, weatherStationsQuery.error],
  );

  useEffect(() => {
    if (!isInitialWeatherSetupLoading) {
      setWeatherLoadTimedOut(false);
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setWeatherLoadTimedOut(true);
    }, 10000);
    return () => window.clearTimeout(timeoutId);
  }, [isInitialWeatherSetupLoading]);
  const selectedLocationPrimary = locationStations.find((station) => station.isPrimary) ?? null;
  const liveWeatherCoordinates = useMemo(() => {
    if (
      hasValidCoordinates(selectedLocationPrimary?.latitude, selectedLocationPrimary?.longitude) &&
      !isLegacyPlaceholderCoordinates(selectedLocationPrimary?.latitude, selectedLocationPrimary?.longitude)
    ) {
      return {
        latitude: selectedLocationPrimary!.latitude!,
        longitude: selectedLocationPrimary!.longitude!,
        label: `${selectedLocationPrimary.name} · ${selectedLocationPrimary.provider}`,
        sourceType: 'primary-station' as const,
      };
    }

    if (hasValidCoordinates(selectedLocation?.latitude, selectedLocation?.longitude)) {
      return {
        latitude: selectedLocation!.latitude!,
        longitude: selectedLocation!.longitude!,
        label: `${selectedLocation.name} area coordinates`,
        sourceType: 'area-coordinates' as const,
      };
    }

    if (hasValidCoordinates(currentProperty?.latitude, currentProperty?.longitude)) {
      const propertyWeatherLabel =
        ((currentProperty as Property & { weatherLocationLabel?: string; weather_location_label?: string }).weatherLocationLabel) ||
        ((currentProperty as Property & { weatherLocationLabel?: string; weather_location_label?: string }).weather_location_label);
      return {
        latitude: currentProperty!.latitude!,
        longitude: currentProperty!.longitude!,
        label: propertyWeatherLabel || `${currentProperty?.name ?? 'Property'} coordinates`,
        sourceType: 'area-coordinates' as const,
      };
    }

    if (useSearchAnchorAsLiveSource && hasValidCoordinates(discoveryAnchor?.latitude, discoveryAnchor?.longitude)) {
      return {
        latitude: discoveryAnchor!.latitude!,
        longitude: discoveryAnchor!.longitude!,
        label: `${discoveryAnchor!.label}`,
        sourceType: 'search-anchor' as const,
      };
    }

    if (hasValidCoordinates(settingsDefaultWeather.latitude, settingsDefaultWeather.longitude)) {
      return {
        latitude: settingsDefaultWeather.latitude,
        longitude: settingsDefaultWeather.longitude,
        label: `${settingsDefaultWeather.locationName} · ${settingsDefaultWeather.address}`,
        sourceType: 'settings-default' as const,
      };
    }

    if (browserCoordinates) {
      return {
        latitude: browserCoordinates.latitude,
        longitude: browserCoordinates.longitude,
        label: 'Current device location',
        sourceType: 'device-location' as const,
      };
    }

    return {
      latitude: settingsDefaultWeather.latitude ?? DEFAULT_WEATHER_LOCATION.latitude,
      longitude: settingsDefaultWeather.longitude ?? DEFAULT_WEATHER_LOCATION.longitude,
      label: DEFAULT_FACILITY_LABEL,
      sourceType: 'area-coordinates' as const,
    };
  }, [browserCoordinates, currentProperty, discoveryAnchor, selectedLocation, selectedLocationPrimary, settingsDefaultWeather.address, settingsDefaultWeather.latitude, settingsDefaultWeather.locationName, settingsDefaultWeather.longitude, useSearchAnchorAsLiveSource]);
  const isPrimaryStationActiveSource =
    hasValidCoordinates(selectedLocationPrimary?.latitude, selectedLocationPrimary?.longitude) &&
    !isLegacyPlaceholderCoordinates(selectedLocationPrimary?.latitude, selectedLocationPrimary?.longitude);
  const weatherDisplayPrefsQuery = useQuery({
    queryKey: ['weather-display-prefs', currentUser?.orgId ?? 'all-orgs', currentUser?.appUserId ?? currentUser?.authUser?.id ?? 'no-user'],
    enabled: Boolean(currentUser?.orgId && (currentUser?.appUserId || currentUser?.authUser?.id)),
    queryFn: async () => {
      const userId = currentUser?.appUserId ?? currentUser?.authUser?.id;
      if (!userId || !currentUser?.orgId) {
        return {
          id: null as string | null,
          enabledWidgets: [...DEFAULT_WIDGETS],
          widgetOrder: [...DEFAULT_WIDGETS],
          locationId: selectedLocation?.id ?? null,
        };
      }
      const { data, error } = await supabase
        .from('weather_display_prefs')
        .select('*')
        .eq('org_id', currentUser.orgId)
        .eq('user_id', userId)
        .maybeSingle();
      if (error && (error as { code?: string } | null)?.code !== '42P01') throw error;
      const row = (data as Record<string, unknown> | null) ?? null;
      const enabledWidgets = Array.isArray(row?.enabled_widgets)
        ? (row!.enabled_widgets as string[]).filter((widget): widget is WeatherWidgetId => DEFAULT_WIDGETS.includes(widget as WeatherWidgetId))
        : [...DEFAULT_WIDGETS];
      const widgetOrder = Array.isArray(row?.widget_order)
        ? (row!.widget_order as string[]).filter((widget): widget is WeatherWidgetId => DEFAULT_WIDGETS.includes(widget as WeatherWidgetId))
        : [];
      return {
        id: row?.id ? String(row.id) : null,
        enabledWidgets: enabledWidgets.length ? enabledWidgets : [...DEFAULT_WIDGETS],
        widgetOrder,
        locationId: row?.location_id ? String(row.location_id) : null,
      };
    },
    staleTime: 1000 * 60 * 5,
  });
  const widgetLiveDataQuery = useQuery({
    queryKey: [
      'weather-widget-live-data',
      liveWeatherCoordinates?.latitude ?? SARASOTA_WIDGET_FALLBACK.latitude,
      liveWeatherCoordinates?.longitude ?? SARASOTA_WIDGET_FALLBACK.longitude,
    ],
    enabled: true,
    queryFn: async (): Promise<WeatherWidgetLiveData> => {
      const latitude = liveWeatherCoordinates?.latitude ?? SARASOTA_WIDGET_FALLBACK.latitude;
      const longitude = liveWeatherCoordinates?.longitude ?? SARASOTA_WIDGET_FALLBACK.longitude;
      const params = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        current: 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,wind_speed_10m,wind_gusts_10m,wind_direction_10m,uv_index',
        hourly: 'temperature_2m,precipitation_probability,wind_speed_10m',
        daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum',
        temperature_unit: 'fahrenheit',
        wind_speed_unit: 'mph',
        precipitation_unit: 'inch',
        forecast_days: '7',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
      });
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
      if (!response.ok) throw new Error(`Open-Meteo request failed with status ${response.status}`);
      const payload = await response.json();
      const hourlyTime: string[] = Array.isArray(payload?.hourly?.time) ? payload.hourly.time : [];
      const hourlyTemp: number[] = Array.isArray(payload?.hourly?.temperature_2m) ? payload.hourly.temperature_2m : [];
      const hourlyRainProb: number[] = Array.isArray(payload?.hourly?.precipitation_probability) ? payload.hourly.precipitation_probability : [];
      const hourlyWind: number[] = Array.isArray(payload?.hourly?.wind_speed_10m) ? payload.hourly.wind_speed_10m : [];
      const dailyTime: string[] = Array.isArray(payload?.daily?.time) ? payload.daily.time : [];
      const dailyMax: number[] = Array.isArray(payload?.daily?.temperature_2m_max) ? payload.daily.temperature_2m_max : [];
      const dailyMin: number[] = Array.isArray(payload?.daily?.temperature_2m_min) ? payload.daily.temperature_2m_min : [];
      const dailyRain: number[] = Array.isArray(payload?.daily?.precipitation_sum) ? payload.daily.precipitation_sum : [];
      return {
        source: 'Open-Meteo',
        locationLabel: liveWeatherCoordinates?.label ?? 'Sarasota Polo Club',
        lastUpdatedLabel: new Date().toLocaleString(),
        current: {
          temperature: Number(payload?.current?.temperature_2m ?? 0),
          feelsLike: Number(payload?.current?.apparent_temperature ?? 0),
          humidity: Number(payload?.current?.relative_humidity_2m ?? 0),
          windSpeed: Number(payload?.current?.wind_speed_10m ?? 0),
          windGust: Number(payload?.current?.wind_gusts_10m ?? 0),
          windDirection: Number(payload?.current?.wind_direction_10m ?? 0),
          precipitation: Number(payload?.current?.precipitation ?? 0),
          uvIndex: Number(payload?.current?.uv_index ?? 0),
        },
        hourly: hourlyTime.slice(0, 24).map((time, index) => ({
          time,
          temperature: Number(hourlyTemp[index] ?? 0),
          windSpeed: Number(hourlyWind[index] ?? 0),
          precipitationProbability: Number(hourlyRainProb[index] ?? 0),
        })),
        daily: dailyTime.slice(0, 7).map((date, index) => ({
          date,
          tempMax: Number(dailyMax[index] ?? 0),
          tempMin: Number(dailyMin[index] ?? 0),
          precipitationSum: Number(dailyRain[index] ?? 0),
        })),
      };
    },
    staleTime: 1000 * 60 * 5,
  });
  const weatherWidgetIds = useMemo<WeatherWidgetId[]>(() => {
    const enabled = weatherDisplayPrefsQuery.data?.enabledWidgets ?? DEFAULT_WIDGETS;
    const order = weatherDisplayPrefsQuery.data?.widgetOrder ?? [];
    const ordered = order.filter((widget) => enabled.includes(widget));
    const remainder = enabled.filter((widget) => !ordered.includes(widget));
    return [...ordered, ...remainder];
  }, [weatherDisplayPrefsQuery.data]);
  const isWeatherAdminUser = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  useEffect(() => {
    if (weatherDisplayPrefsQuery.data?.id) {
      setWidgetPrefsId(weatherDisplayPrefsQuery.data.id);
    }
  }, [weatherDisplayPrefsQuery.data?.id]);
  useEffect(() => {
    if (!settingsDrawerOpen) return;
    setPrefsDraftWidgets(weatherWidgetIds);
    setPrefsDraftEnabledWidgets(weatherDisplayPrefsQuery.data?.enabledWidgets ?? [...DEFAULT_WIDGETS]);
    setPrefsDraftLocationId(weatherDisplayPrefsQuery.data?.locationId ?? selectedLocation?.id ?? '');
  }, [settingsDrawerOpen, selectedLocation?.id, weatherDisplayPrefsQuery.data?.enabledWidgets, weatherDisplayPrefsQuery.data?.locationId, weatherWidgetIds]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateLiveWeather() {
      if (!selectedLocation) {
        setLiveLog(null);
        setLiveStatus('idle');
        return;
      }

      const selectedLiveStation: WeatherStation | null =
        primaryStation && primaryStation.status === 'online' && primaryStation.providerType !== 'manual' && primaryStation.providerType !== 'davis'
          ? primaryStation
          : liveWeatherCoordinates
            ? {
                id: `fallback-${selectedLocation.id}`,
                locationId: selectedLocation.id,
                name: `${selectedLocation.name} fallback`,
                provider: 'Open-Meteo',
                providerType: 'open-meteo',
                stationCode: 'AREA-FALLBACK',
                latitude: liveWeatherCoordinates.latitude,
                longitude: liveWeatherCoordinates.longitude,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                isPrimary: false,
                status: 'online',
              }
            : null;

      if (!selectedLiveStation) {
        setLiveLog(null);
        setLiveStatus('idle');
        return;
      }

      setLiveStatus('loading');
      try {
        const snapshot = await fetchPrimaryStationSnapshot(selectedLocation.id, selectedLiveStation);
        if (cancelled) return;
        setLiveLog(snapshot);
        setLiveStatus(snapshot ? 'ready' : 'idle');
      } catch {
        if (cancelled) return;
        setLiveLog(null);
        setLiveStatus('error');
      }
    }

    void hydrateLiveWeather();
    return () => {
      cancelled = true;
    };
  }, [liveWeatherCoordinates, primaryStation, refreshTick, selectedLocation]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateForecast() {
      const forecastStation: WeatherStation | null =
        primaryStation && primaryStation.status === 'online'
          ? primaryStation
          : liveWeatherCoordinates
            ? {
                id: `forecast-${selectedLocation?.id || 'none'}`,
                locationId: selectedLocation?.id || '',
                name: 'Area Forecast Fallback',
                provider: 'Open-Meteo',
                providerType: 'open-meteo',
                stationCode: 'AREA-FALLBACK',
                latitude: liveWeatherCoordinates.latitude,
                longitude: liveWeatherCoordinates.longitude,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                isPrimary: false,
                status: 'online',
              }
            : null;

      if (!forecastStation) {
        setSelectedForecast(null);
        return;
      }

      try {
        const forecast = await fetchStationForecastDetail(forecastStation);
        if (!cancelled) setSelectedForecast(forecast);
      } catch {
        if (!cancelled) setSelectedForecast(null);
      }
    }

    void hydrateForecast();
    return () => {
      cancelled = true;
    };
  }, [liveWeatherCoordinates, primaryStation, refreshTick, selectedLocation?.id]);

  useEffect(() => {
    let cancelled = false;

    async function hydratePropertyWeather() {
      const nextEntries = await Promise.all(
        weatherLocations.map(async (location) => {
          const station = weatherStations
            .filter((candidate) => candidate.locationId === location.id)
            .sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary))[0];

          const fallbackStation: WeatherStation | null =
            typeof location.latitude === 'number' && typeof location.longitude === 'number'
              ? {
                  id: `property-fallback-${location.id}`,
                  locationId: location.id,
                  name: `${location.name} fallback`,
                  provider: 'Open-Meteo',
                  providerType: 'open-meteo',
                  stationCode: 'AREA-FALLBACK',
                  latitude: location.latitude,
                  longitude: location.longitude,
                  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                  isPrimary: false,
                  status: 'online',
                }
              : null;

          const liveStation =
            station && station.status === 'online' && station.providerType !== 'manual' && station.providerType !== 'davis'
              ? station
              : fallbackStation;

          if (!liveStation) return [location.id, null] as const;

          try {
            const snapshot = await fetchPrimaryStationSnapshot(location.id, liveStation);
            return [location.id, snapshot] as const;
          } catch {
            return [location.id, null] as const;
          }
        }),
      );

      if (cancelled) return;
      setPropertyLiveLogs(Object.fromEntries(nextEntries));
    }

    void hydratePropertyWeather();
    return () => {
      cancelled = true;
    };
  }, [refreshTick, weatherLocations, weatherStations]);

  function openDialog(mode: EntryMode) {
    setDialogMode(mode);
    setDraft({ ...emptyEntry, locationId: selectedLocationId, date: todayIsoDate() });
    setDialogOpen(true);
  }

  function refreshLiveWeather() {
    setRefreshTick((current) => current + 1);
    void weatherLocationsQuery.refetch();
    void weatherStationsQuery.refetch();
    void weatherLogsQuery.refetch();
    void rainfallEntriesQuery.refetch();
    void propertiesQuery.refetch();
    void queryClient.invalidateQueries({ queryKey: ['weather-page-open-meteo'] });
    void queryClient.invalidateQueries({ queryKey: ['weather', selectedProperty?.id] });
    void selectedPropertyWeatherQuery.refetch();
    void liveForecastQuery.refetch();
  }

  async function savePropertyWeatherLocation(selectedLat: number, selectedLng: number, selectedLabel: string) {
    if (!currentPropertyId) {
      toast('Property not selected', {
        description: 'Select a property first, then save weather location.',
      });
      return;
    }
    setLocationSaveLoading(true);
    const { error } = await supabase
      .from('properties')
      .update({
        latitude: selectedLat,
        longitude: selectedLng,
        weather_location_label: selectedLabel,
      })
      .eq('id', currentPropertyId);
    setLocationSaveLoading(false);

    if (error) {
      toast('Unable to save weather location', {
        description: error.message,
      });
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ['properties'] });
    await propertiesQuery.refetch();
    setShowLocationSetup(false);
    setLocationQuery('');
    setLocationSearchResults([]);
    toast(`Weather location saved for ${currentProperty?.name ?? 'selected property'}`);
  }

  async function handleLocationSearch() {
    const query = locationQuery.trim();
    if (!query) return;
    setLocationSearchLoading(true);
    setLocationSearchResults([]);
    try {
      const response = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`,
      );
      if (!response.ok) {
        throw new Error(`Location search failed (${response.status})`);
      }
      const payload = await response.json();
      const nextResults = (payload?.results ?? []).slice(0, 5).map((result: any) => ({
        label: [result?.name, result?.admin1, result?.country].filter(Boolean).join(', '),
        latitude: Number(result?.latitude),
        longitude: Number(result?.longitude),
      }));
      setLocationSearchResults(nextResults.filter((item: { latitude: number; longitude: number }) => hasValidCoordinates(item.latitude, item.longitude)));
      if (!nextResults.length) {
        toast('No matching locations found', {
          description: 'Try a different city, state, or address.',
        });
      }
    } catch (error) {
      toast('Location search failed', {
        description: (error as Error)?.message ?? 'Could not search Open-Meteo geocoding.',
      });
    } finally {
      setLocationSearchLoading(false);
    }
  }

  async function handleUseCurrentLocationForProperty() {
    if (!navigator.geolocation) {
      toast('Location unavailable', {
        description: 'This browser does not support device geolocation.',
      });
      return;
    }
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000,
        });
      });
      const selectedLat = Number(position.coords.latitude.toFixed(4));
      const selectedLng = Number(position.coords.longitude.toFixed(4));
      await savePropertyWeatherLocation(selectedLat, selectedLng, 'Current Device Location');
    } catch {
      toast('Location permission needed', {
        description: 'Allow location access to save your current property weather location.',
      });
    }
  }

  async function handleOnboardingUseCurrentLocation() {
    if (!navigator.geolocation) {
      toast('Location unavailable', {
        description: 'This browser does not support device geolocation.',
      });
      return;
    }
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000,
        });
      });
      const lat = Number(position.coords.latitude.toFixed(4));
      const lng = Number(position.coords.longitude.toFixed(4));
      setOnboardingSelectedLat(lat);
      setOnboardingSelectedLng(lng);
      setOnboardingSelectedLabel('Current Device Location');
      setOnboardingStep(2);
    } catch {
      toast('Location permission needed', {
        description: 'Allow location access to use your current location.',
      });
    }
  }

  async function handleOnboardingSearch() {
    const query = onboardingSearchQuery.trim();
    if (!query) return;
    setOnboardingSearchLoading(true);
    setOnboardingSearchResults([]);
    try {
      const response = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`,
      );
      if (!response.ok) throw new Error(`Location search failed (${response.status})`);
      const payload = await response.json();
      const nextResults = (payload?.results ?? [])
        .slice(0, 5)
        .map((result: any) => ({
          label: [result?.name, result?.admin1, result?.country].filter(Boolean).join(', '),
          latitude: Number(result?.latitude),
          longitude: Number(result?.longitude),
        }))
        .filter((item: { latitude: number; longitude: number }) => hasValidCoordinates(item.latitude, item.longitude));
      setOnboardingSearchResults(nextResults);
      if (!nextResults.length) {
        toast('No matching locations found', {
          description: 'Try a more specific address or nearest city.',
        });
      }
    } catch (error) {
      toast('Location search failed', {
        description: (error as Error)?.message ?? 'Could not search Open-Meteo geocoding.',
      });
    } finally {
      setOnboardingSearchLoading(false);
    }
  }

  function handleOnboardingManualConfirm() {
    const lat = Number(onboardingManualLat);
    const lng = Number(onboardingManualLng);
    if (!hasValidCoordinates(lat, lng)) {
      toast('Invalid coordinates', {
        description: 'Enter valid latitude and longitude values.',
      });
      return;
    }
    setOnboardingSelectedLat(lat);
    setOnboardingSelectedLng(lng);
    setOnboardingSelectedLabel('Manual Coordinates');
    setOnboardingStep(2);
  }

  async function handleSaveOnboardingWeatherArea() {
    if (!currentUser?.orgId || !weatherScopePropertyId || !currentProperty) {
      toast('Unable to save setup', {
        description: 'Missing property or user scope. Refresh and try again.',
      });
      return;
    }
    const resolvedLatitude =
      onboardingSelectedLat ??
      (hasValidCoordinates(currentProperty.latitude, currentProperty.longitude) ? currentProperty.latitude : null) ??
      settingsDefaultWeather.latitude;
    const resolvedLongitude =
      onboardingSelectedLng ??
      (hasValidCoordinates(currentProperty.latitude, currentProperty.longitude) ? currentProperty.longitude : null) ??
      settingsDefaultWeather.longitude;
    if (!hasValidCoordinates(resolvedLatitude, resolvedLongitude)) {
      toast('Unable to save setup', {
        description: 'No valid coordinates were found. Search or enter a location first.',
      });
      return;
    }
    const areaName = onboardingAreaName.trim() || currentProperty.name;
    const existingAreaCount = propertyScopedWeatherLocations.length;
    setOnboardingSaving(true);
    try {
      const newLocationId = crypto.randomUUID();

      const locationInsert = await supabase
        .from('weather_locations')
        .insert({
          id: newLocationId,
          name: areaName,
          property: currentProperty.name,
          area: areaName,
        })
        .select('id')
        .single();

      if (locationInsert.error || !locationInsert.data) {
        throw locationInsert.error ?? new Error('Weather location insert failed');
      }

      const stationInsert = await supabase.from('weather_stations').insert({
        id: crypto.randomUUID(),
        location_id: locationInsert.data.id,
        name: `${areaName} — Live Weather`,
        provider: 'Open-Meteo',
        provider_type: 'open-meteo',
        station_code: `${weatherScopePropertyId.slice(0, 8).toUpperCase()}-${String(existingAreaCount + 1).padStart(2, '0')}`,
        latitude: resolvedLatitude,
        longitude: resolvedLongitude,
        time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        is_primary: existingAreaCount === 0,
        status: 'online',
        org_id: currentUser.orgId,
      });

      if (stationInsert.error) {
        throw stationInsert.error;
      }

      await queryClient.invalidateQueries({ queryKey: ['weather-locations'] });
      await queryClient.invalidateQueries({ queryKey: ['weather-stations'] });
      await weatherLocationsQuery.refetch();
      await weatherStationsQuery.refetch();
      setSelectedLocationId(locationInsert.data.id);
      setSettingsDrawerOpen(false);
      setOnboardingStep(1);
      setOnboardingMethod('none');
      setOnboardingSearchResults([]);
      setOnboardingSheetOpen(false);
      toast('Weather setup complete', {
        description: `${areaName} is now configured with live Open-Meteo weather.`,
      });
      if (setupMode) {
        navigate('/app/settings?section=properties');
      }
    } catch (error) {
      toast('Setup failed', {
        description: (error as Error)?.message ?? 'Could not complete weather setup.',
      });
    } finally {
      setOnboardingSaving(false);
    }
  }

  function startAddAreaFlow() {
    setOnboardingStep(1);
    setOnboardingMethod('none');
    setOnboardingSearchQuery('');
    setOnboardingSearchResults([]);
    setOnboardingSelectedLat(null);
    setOnboardingSelectedLng(null);
    setOnboardingSelectedLabel('');
    setOnboardingManualLat('');
    setOnboardingManualLng('');
    setOnboardingAreaName(currentProperty?.name ?? '');
    setOnboardingSheetOpen(true);
  }

  async function setPrimaryStationForArea(locationId: string) {
    const stationsInArea = weatherStations.filter((station) => station.locationId === locationId);
    if (!stationsInArea.length) {
      toast('No station available', { description: 'Add a station for this area first.' });
      return;
    }
    const targetStation = stationsInArea[0];
    const updated = weatherStations.map((station) =>
      station.locationId === locationId ? { ...station, isPrimary: station.id === targetStation.id } : station,
    );
    setWeatherStations(updated);
    const updates = stationsInArea.map((station) =>
      supabase
        .from('weather_stations')
        .update({ is_primary: station.id === targetStation.id })
        .eq('id', station.id),
    );
    await Promise.all(updates);
    await queryClient.invalidateQueries({ queryKey: ['weather-stations'] });
    toast('Primary station updated', { description: `${targetStation.name} is now primary for this area.` });
  }

  async function removeArea(locationId: string) {
    const stationsInArea = weatherStations.filter((station) => station.locationId === locationId);
    for (const station of stationsInArea) {
      await supabase.from('weather_stations').delete().eq('id', station.id);
    }
    await supabase.from('weather_locations').delete().eq('id', locationId);
    await queryClient.invalidateQueries({ queryKey: ['weather-stations'] });
    await queryClient.invalidateQueries({ queryKey: ['weather-locations'] });
    await weatherStationsQuery.refetch();
    await weatherLocationsQuery.refetch();
    setRemoveAreaId(null);
    toast('Area removed', { description: 'Weather area and linked stations were removed.' });
  }

  async function searchStationsByAddress(queryOverride?: string) {
    const query = (queryOverride ?? stationSearchQuery).trim();
    if (!query) return;
    setStationSearchStatus('loading');
    try {
      const result = await fetchWeatherStationSuggestions({ query });
      setDiscoveryAnchor(result.anchor);
      setUseSearchAnchorAsLiveSource(false);
      setStationSuggestions(result.suggestions);
      if (result.anchor) {
        toast('Search anchor ready', {
          description: `Found ${result.anchor.label}. Apply these coordinates to the area or station to make it the live source.`,
        });
      }
      setStationSearchStatus('ready');
      if (!result.anchor) {
        toast('No station suggestions found', {
          description: 'Try a more specific address or property name.',
        });
      }
    } catch {
      setStationSearchStatus('error');
      toast('Station lookup failed', {
        description: 'The live station search could not complete. Please try again or use current location.',
      });
    }
  }

  async function searchStationsByCurrentLocation() {
    if (!navigator.geolocation) {
      toast('Location unavailable', {
        description: 'This browser does not support device geolocation.',
      });
      return;
    }
    setStationSearchStatus('loading');
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000,
        });
      });
      const result = await fetchWeatherStationSuggestions({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      setDiscoveryAnchor(result.anchor);
      setUseSearchAnchorAsLiveSource(false);
      setStationSuggestions(result.suggestions);
      setStationSearchStatus('ready');
    } catch {
      setStationSearchStatus('error');
      toast('Location lookup failed', {
        description: 'Allow location access or search by address to find nearby live stations.',
      });
    }
  }

  function activateSearchAnchorAsLiveSource() {
    if (!discoveryAnchor || !hasValidCoordinates(discoveryAnchor.latitude, discoveryAnchor.longitude)) {
      toast('Search anchor unavailable', {
        description: 'Search for an address first to activate search-anchor live weather.',
      });
      return;
    }
    setUseSearchAnchorAsLiveSource(true);
    toast('Search anchor live source enabled', {
      description: `${discoveryAnchor.label} now powers live weather until you apply area or station coordinates.`,
    });
  }

  function applyDiscoveryAnchorToSelectedArea() {
    if (!selectedLocation || !discoveryAnchor || !hasValidCoordinates(discoveryAnchor.latitude, discoveryAnchor.longitude)) {
      toast('Search anchor unavailable', {
        description: 'Search for an address first, then apply its coordinates to this weather area.',
      });
      return;
    }
    updateSelectedLocation({
      address: discoveryAnchor.label,
      latitude: discoveryAnchor.latitude,
      longitude: discoveryAnchor.longitude,
    });
    setUseSearchAnchorAsLiveSource(false);
    toast('Area coordinates updated', {
      description: `Applied ${discoveryAnchor.label} to ${selectedLocation.name}. Save area to persist.`,
    });
  }

  function applyDiscoveryAnchorToPrimaryStation() {
    if (!discoveryAnchor || !hasValidCoordinates(discoveryAnchor.latitude, discoveryAnchor.longitude)) {
      toast('Search anchor unavailable', {
        description: 'Search for an address first, then apply its coordinates to a station.',
      });
      return;
    }
    const targetStation = selectedLocationPrimary ?? locationStations[0];
    if (!targetStation) {
      toast('No station available', {
        description: 'Add a station first, then apply search-anchor coordinates to that station.',
      });
      return;
    }
    updateStation(targetStation.id, {
      latitude: discoveryAnchor.latitude,
      longitude: discoveryAnchor.longitude,
      providerType: targetStation.providerType ?? 'open-meteo',
      status: targetStation.status ?? 'online',
    });
    setUseSearchAnchorAsLiveSource(false);
    toast('Station coordinates updated', {
      description: `Applied ${discoveryAnchor.label} to ${targetStation.name}. Save stations to persist.`,
    });
  }

  async function applyDeviceLocationFallback() {
    if (!navigator.geolocation) {
      toast('Location unavailable', {
        description: 'This browser does not support device geolocation.',
      });
      return;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000,
        });
      });
      setBrowserCoordinates({
        latitude: Number(position.coords.latitude.toFixed(4)),
        longitude: Number(position.coords.longitude.toFixed(4)),
      });
      setSettingsDrawerOpen(false);
      toast('Device location ready', {
        description: 'Live weather can now use this device location as a fallback.',
      });
    } catch {
      toast('Location permission needed', {
        description: 'Allow location access in your browser to use device fallback weather.',
      });
    }
  }

  function createStarterWeatherArea() {
    const baseProperty = properties.find((property) => property.id === currentPropertyId) ?? properties[0];
    const starterName = baseProperty?.name ? `${baseProperty.shortName} Weather Area` : 'Primary Weather Area';

    const nextLocation: WeatherLocation = {
      id: makeId('wl'),
      name: starterName,
      property: baseProperty?.name || programSetting?.organizationName || 'Club Property',
      propertyId: baseProperty?.id,
      area: starterName,
      address: baseProperty ? `${baseProperty.address}, ${baseProperty.city}, ${baseProperty.state}` : '',
    };

    const nextLocations = [...weatherLocations, nextLocation];
    void persistWeatherSetup(nextLocations, weatherStations);
    setSelectedLocationId(nextLocation.id);
    setSettingsDrawerOpen(true);
    toast('Weather area created', {
      description: 'Now add a station to enable live weather for this area.',
    });
  }

  function addSuggestedStation(suggestion: WeatherStationSuggestion) {
    if (!selectedLocation) return;
    const nextLocations = weatherLocations.map((location) =>
      location.id === selectedLocation.id
        ? {
            ...location,
            address: location.address || discoveryAnchor?.label || selectedProperty?.address || '',
            latitude: location.latitude ?? discoveryAnchor?.latitude ?? suggestion.latitude,
            longitude: location.longitude ?? discoveryAnchor?.longitude ?? suggestion.longitude,
          }
        : location,
    );
    const nextStation: WeatherStation = {
      id: makeId('ws'),
      locationId: selectedLocation.id,
      name: suggestion.name,
      provider: suggestion.provider,
      providerType: suggestion.providerType,
      stationCode: suggestion.stationCode,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
      timeZone: suggestion.timeZone,
      stationCategory: suggestion.stationCategory,
      distanceMiles: suggestion.distanceMiles,
      isPrimary: locationStations.length === 0,
      status: 'online',
    };
    const nextStations = [...weatherStations, nextStation];
    persistWeatherSetup(nextLocations, nextStations);
    toast('Suggested station added', {
      description: `${suggestion.name} is now available for ${selectedLocation.name}.`,
    });
  }

  async function setDeviceLocationForStation(stationId: string) {
    if (!navigator.geolocation) {
      toast('Location unavailable', {
        description: 'This browser does not support device geolocation.',
      });
      return;
    }

    setGeoLoadingStationId(stationId);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000,
        });
      });

      const nextStations = weatherStations.map((station) =>
        station.id === stationId
          ? {
              ...station,
              latitude: Number(position.coords.latitude.toFixed(4)),
              longitude: Number(position.coords.longitude.toFixed(4)),
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            }
          : station,
      );
      persistWeatherSetup(weatherLocations, nextStations);
      toast('Station coordinates updated', {
        description: 'This station is now pointed at your current device location for live weather.',
      });
    } catch {
      toast('Location permission needed', {
        description: 'Allow location access in the browser to use current device coordinates.',
      });
    } finally {
      setGeoLoadingStationId(null);
    }
  }

  async function persistWeatherSetup(nextLocations: WeatherLocation[], nextStations: WeatherStation[]) {
    setWeatherLocations(nextLocations);
    setWeatherStations(nextStations);
    if (currentUser?.orgId) {
      await supabase.from('weather_locations').upsert(
        nextLocations.map(location => ({
          id: location.id,
          name: location.name,
          property: location.property,
          area: location.area,
        }))
      );
      await supabase.from('weather_stations').upsert(
        nextStations.map(station => ({
          ...station,
          org_id: currentUser.orgId,
        }))
      );
      queryClient.invalidateQueries({ queryKey: ['weather-locations'] });
      queryClient.invalidateQueries({ queryKey: ['weather-stations'] });
      queryClient.invalidateQueries({ queryKey: ['weather-stations-full'] });
    }
  }

  function addWeatherAreaFromLocation() {
    const source = workLocations.find((location) => location.id === selectedWorkLocationId);
    if (!source) return;
    const sourceProperty = properties.find((property) => property.id === source.propertyId);

    const nextLocation: WeatherLocation = {
      id: makeId('wl'),
      name: source.name,
      property: source.propertyName || sourceProperty?.name || programSetting?.organizationName || 'Club Property',
      propertyId: source.propertyId,
      area: source.name,
      address: sourceProperty ? `${sourceProperty.address}, ${sourceProperty.city}, ${sourceProperty.state}` : '',
    };

    const nextLocations = [...weatherLocations, nextLocation];
    persistWeatherSetup(nextLocations, weatherStations);
    setSelectedLocationId(nextLocation.id);
    toast('Weather area added', { description: `${source.name} is now available for station setup.` });
  }

  function addCustomWeatherArea() {
    const trimmed = customAreaName.trim();
    if (!trimmed) return;
    const baseProperty = properties.find((property) => property.id === currentPropertyId) ?? properties[0];

    const nextLocation: WeatherLocation = {
      id: makeId('wl'),
      name: trimmed,
      property: baseProperty?.name || programSetting?.organizationName || 'Club Property',
      propertyId: baseProperty?.id,
      area: trimmed,
      address: baseProperty ? `${baseProperty.address}, ${baseProperty.city}, ${baseProperty.state}` : '',
    };

    const nextLocations = [...weatherLocations, nextLocation];
    persistWeatherSetup(nextLocations, weatherStations);
    setSelectedLocationId(nextLocation.id);
    setCustomAreaName('');
    toast('Custom weather area added', { description: `${trimmed} is ready for live weather station selection.` });
  }

  function updateSelectedLocation(patch: Partial<WeatherLocation>) {
    if (!selectedLocation) return;
    setWeatherLocations((current) =>
      current.map((location) => (location.id === selectedLocation.id ? { ...location, ...patch } : location)),
    );
  }

  async function saveSelectedLocation() {
    if (currentUser?.orgId) {
      const { error } = await supabase.from('weather_locations').upsert(
        weatherLocations.map(location => ({
          id: location.id,
          name: location.name,
          property: location.property,
          property_id: location.propertyId ?? null,
          area: location.area,
          address: location.address ?? null,
          latitude: location.latitude ?? null,
          longitude: location.longitude ?? null,
          org_id: currentUser.orgId,
          is_active: true,
        }))
      );
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['weather-locations'] });
    }
    toast('Weather area saved', { description: 'Area naming and property details have been updated.' });
  }

  function addStationForLocation(locationId: string) {
    const targetLocation = weatherLocations.find((location) => location.id === locationId);
    if (!targetLocation) return;
    const targetProperty = properties.find((property) => property.id === targetLocation.propertyId);
    const targetLocationStations = weatherStations.filter((station) => station.locationId === locationId);
    const seedLatitude =
      targetLocation.latitude ??
      targetProperty?.latitude ??
      browserCoordinates?.latitude;
    const seedLongitude =
      targetLocation.longitude ??
      targetProperty?.longitude ??
      browserCoordinates?.longitude;
    const nextStation: WeatherStation = {
      id: makeId('ws'),
      locationId,
      name: `${targetLocation.name} Station`,
      provider: 'Open-Meteo',
      providerType: 'open-meteo',
      stationCode: `${locationId.toUpperCase()}-${targetLocationStations.length + 1}`,
      latitude: seedLatitude,
      longitude: seedLongitude,
      timeZone: 'America/New_York',
      isPrimary: targetLocationStations.length === 0,
      status: 'online',
    };

    const nextStations = [...weatherStations, nextStation];
    persistWeatherSetup(weatherLocations, nextStations);
    toast('Station added', { description: 'Set the coordinates and provider, then save stations.' });
  }

  function addStation() {
    if (!selectedLocation) return;
    addStationForLocation(selectedLocation.id);
  }

  function addFirstStationFromSetup() {
    if (selectedLocation) {
      addStationForLocation(selectedLocation.id);
      setSettingsDrawerOpen(true);
      return;
    }
    const fallbackLocation = weatherLocations[0];
    if (!fallbackLocation) {
      createStarterWeatherArea();
      return;
    }
    setSelectedLocationId(fallbackLocation.id);
    addStationForLocation(fallbackLocation.id);
    setSettingsDrawerOpen(true);
  }

  function updateStation(stationId: string, patch: Partial<WeatherStation>) {
    setWeatherStations((current) =>
      current.map((station) => (station.id === stationId ? { ...station, ...patch } : station)),
    );
  }

  function setPrimaryStation(stationId: string) {
    const nextStations = weatherStations.map((station) =>
      station.locationId === selectedLocationId ? { ...station, isPrimary: station.id === stationId } : station,
    );
    persistWeatherSetup(weatherLocations, nextStations);
    toast('Primary station updated', { description: 'This station now drives the live weather snapshot.' });
  }

  function removeStation(stationId: string) {
    const removed = weatherStations.find((station) => station.id === stationId);
    const filteredStations = weatherStations.filter((station) => station.id !== stationId);
    const nextStations = removed?.isPrimary
      ? filteredStations.map((station, index) =>
          station.locationId === selectedLocationId ? { ...station, isPrimary: index === 0 } : station,
        )
      : filteredStations;
    persistWeatherSetup(weatherLocations, nextStations);
    toast('Station removed', { description: 'Station setup has been updated for this weather area.' });
  }

  async function saveStations() {
    if (currentUser?.orgId) {
      await supabase.from('weather_stations').upsert(
        weatherStations.map(station => ({
          ...station,
          org_id: currentUser.orgId,
        }))
      );
      queryClient.invalidateQueries({ queryKey: ['weather-stations'] });
      queryClient.invalidateQueries({ queryKey: ['weather-stations-full'] });
    }
    toast('Stations saved', { description: 'Provider configuration and live-station selection are stored.' });
  }

  async function saveEntry() {
    if (dialogMode === 'rainfall') {
      const nextEntry: ManualRainfallEntry = {
        id: `mr-${Date.now()}`,
        locationId: draft.locationId,
        date: draft.date,
        rainfallAmount: Number(draft.rainfallAmount),
        enteredBy: draft.enteredBy,
        notes: draft.notes,
      };
      const next = [nextEntry, ...rainEntries];
      setRainEntries(next);
      if (currentUser?.orgId) {
        await supabase.from('manual_rainfall_entries').insert({
          ...nextEntry,
          org_id: currentUser.orgId,
        });
        queryClient.invalidateQueries({ queryKey: ['manual-rainfall-entries-page'] });
        queryClient.invalidateQueries({ queryKey: ['manual-rainfall-entries'] });
      }
    } else {
      const nextLog: WeatherDailyLog = {
        id: `wd-${Date.now()}`,
        locationId: draft.locationId,
        date: draft.date,
        capturedAt: new Date().toISOString(),
        currentConditions: draft.currentConditions,
        forecast: draft.forecast,
        rainfallTotal: Number(draft.rainfallAmount),
        temperature: Number(draft.temperature),
        humidity: Number(draft.humidity),
        wind: Number(draft.wind),
        windGust: Number(draft.windGust),
        et: Number(draft.et),
        source: 'manual-override',
        alerts: [],
        notes: draft.notes,
      };
      const next = [nextLog, ...weatherLogs];
      setWeatherLogs(next);
      if (currentUser?.orgId) {
        await supabase.from('weather_daily_logs').insert({
          ...nextLog,
          org_id: currentUser.orgId,
        });
        queryClient.invalidateQueries({ queryKey: ['weather-daily-logs-page'] });
        queryClient.invalidateQueries({ queryKey: ['weather-daily-logs'] });
      }
    }
    setDialogOpen(false);
  }

  const summaryCards = useMemo(() => ([
    { label: 'Locations', value: weatherLocations.length, icon: MapPin },
    { label: 'Stations Online', value: `${stationsOnline}/${locationStations.length || 0}`, icon: Radar },
    { label: 'Rainfall Entries', value: locationRain.length, icon: Droplets },
    { label: 'Manual Overrides', value: manualOverrideCount, icon: PencilLine },
  ]), [locationRain.length, locationStations.length, manualOverrideCount, stationsOnline, weatherLocations.length]);

  const propertyWeatherCards = useMemo(() => {
    return properties
      .map((property) => {
        const location = resolveLocationForProperty(property);
        if (!location) return null;
        const stations = weatherStations
          .filter((station) => station.locationId === location.id)
          .sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary));
        const station = stations[0];
        const storedLog = [...weatherLogs]
          .filter((log) => log.locationId === location.id)
          .sort((left, right) => right.date.localeCompare(left.date))[0];
        const live = propertyLiveLogs[location.id] ?? null;
        const log = live ?? storedLog ?? null;
        const recentRain24 = Number((live?.rainfallTotal ?? storedLog?.rainfallTotal ?? 0).toFixed(2));
        return { property, location, station, log, recentRain24 };
      })
      .filter(Boolean) as { property: Property; location: WeatherLocation; station?: WeatherStation; log: WeatherDailyLog | null; recentRain24: number }[];
  }, [properties, propertyLiveLogs, weatherLocations, weatherStations, weatherLogs]);

  const hasLiveWeatherCoordinates = hasValidCoordinates(liveWeatherCoordinates?.latitude, liveWeatherCoordinates?.longitude);
  const liveForecastQuery = useQuery({
    queryKey: [
      'weather-page-open-meteo',
      selectedLocation?.id ?? 'none',
      liveWeatherCoordinates?.latitude ?? null,
      liveWeatherCoordinates?.longitude ?? null,
      liveWeatherCoordinates?.sourceType ?? 'none',
    ],
    enabled: hasLiveWeatherCoordinates,
    staleTime: 1000 * 60 * 30,
    retry: 1,
    refetchOnWindowFocus: false,
    queryFn: async () =>
      fetchOpenMeteoWeather({
        latitude: liveWeatherCoordinates!.latitude!,
        longitude: liveWeatherCoordinates!.longitude!,
      }),
  });
  const onboardingPreviewQuery = useQuery({
    queryKey: ['weather-onboarding-preview', onboardingSelectedLat, onboardingSelectedLng],
    enabled: onboardingStep === 2 && onboardingSelectedLat !== null && onboardingSelectedLng !== null,
    staleTime: 1000 * 60 * 5,
    retry: 1,
    queryFn: async () =>
      fetchOpenMeteoWeather({
        latitude: onboardingSelectedLat!,
        longitude: onboardingSelectedLng!,
      }),
  });
  const liveForecastHours = useMemo(() => liveForecastQuery.data?.hourly ?? [], [liveForecastQuery.data?.hourly]);
  const hourlyForecastChartData = useMemo(
    () =>
      liveForecastHours.slice(0, 24).map((point, index) => {
        const date = new Date(point.time);
        const hourLabel = date.toLocaleTimeString([], { hour: 'numeric' });
        return {
          id: `${point.time}-${index}`,
          hourLabel,
          index,
          timeMs: date.getTime(),
          temperature: Math.round(point.temperature),
          precipitationProbability: Math.round(point.precipitationProbability ?? 0),
          windSpeed: Math.round(point.windSpeed),
        };
      }),
    [liveForecastHours],
  );
  const currentHourChartLabel = useMemo(() => {
    if (!hourlyForecastChartData.length) return null;
    const now = Date.now();
    const closest = hourlyForecastChartData.reduce((best, point) => {
      if (!best) return point;
      return Math.abs(point.timeMs - now) < Math.abs(best.timeMs - now) ? point : best;
    }, hourlyForecastChartData[0]);
    return closest?.hourLabel ?? null;
  }, [hourlyForecastChartData]);

  useEffect(() => {
    async function syncLiveForecastLog() {
      if (!selectedLocation?.id || !currentUser?.orgId || !liveForecastQuery.data) return;
      const current = liveForecastQuery.data.current;
      const today = todayIsoDate();
      const expectedRain = Number(
        (liveForecastQuery.data.hourly ?? [])
          .slice(0, 8)
          .reduce((sum, point) => sum + (Number(point.precipitationProbability ?? 0) / 100) * 0.1, 0)
          .toFixed(2),
      );

      const payload = {
        locationId: selectedLocation.id,
        date: today,
        orgId: currentUser.orgId,
        capturedAt: new Date().toISOString(),
        currentConditions: getWeatherConditionMeta(current.weatherCode).label,
        forecast: 'Live forecast from Open-Meteo.',
        rainfallTotal: expectedRain,
        temperature: current.temperature,
        humidity: latestStoredLog?.humidity ?? null,
        wind: current.windSpeed,
        windGust: latestStoredLog?.windGust ?? current.windSpeed,
        et: latestStoredLog?.et ?? null,
        source: 'open-meteo',
        notes: 'Auto-updated from Open-Meteo forecast fetch.',
      };

      const result = await supabase.from('weather_daily_logs').upsert(payload, { onConflict: 'locationId,date' });
      if (result.error) {
        const fallbackPayload = {
          location_id: selectedLocation.id,
          date: today,
          org_id: currentUser.orgId,
          captured_at: new Date().toISOString(),
          current_conditions: getWeatherConditionMeta(current.weatherCode).label,
          forecast: 'Live forecast from Open-Meteo.',
          rainfall_total: expectedRain,
          temperature: current.temperature,
          humidity: latestStoredLog?.humidity ?? null,
          wind: current.windSpeed,
          wind_gust: latestStoredLog?.windGust ?? current.windSpeed,
          et: latestStoredLog?.et ?? null,
          source: 'open-meteo',
          notes: 'Auto-updated from Open-Meteo forecast fetch.',
        };
        const fallbackResult = await supabase.from('weather_daily_logs').upsert(fallbackPayload, { onConflict: 'location_id,date' });
        if (fallbackResult.error) {
          console.warn('[weather] live log upsert failed', fallbackResult.error.message);
        }
      }
    }

    void syncLiveForecastLog();
  }, [currentUser?.orgId, latestStoredLog?.et, latestStoredLog?.humidity, latestStoredLog?.windGust, liveForecastQuery.data, selectedLocation?.id]);

  const fallbackLiveLog = useMemo<WeatherDailyLog | null>(() => {
    if (!selectedLocation || !liveForecastQuery.data) return null;
    const current = liveForecastQuery.data.current;
    const totalRain = Number(
      liveForecastHours.slice(0, 8).reduce((sum, point) => sum + (Number(point.precipitationProbability ?? 0) / 100) * 0.1, 0).toFixed(2),
    );
    return {
      id: `fallback-${selectedLocation.id}-${todayIsoDate()}`,
      locationId: selectedLocation.id,
      stationId: selectedLocationPrimary?.id,
      date: todayIsoDate(),
      capturedAt: new Date().toISOString(),
      currentConditions: getWeatherConditionMeta(current.weatherCode).label,
      forecast: 'Fallback forecast using selected area coordinates.',
      rainfallTotal: totalRain,
      temperature: current.temperature,
      humidity: latestStoredLog?.humidity ?? 0,
      wind: current.windSpeed,
      windGust: latestStoredLog?.windGust ?? current.windSpeed,
      et: latestStoredLog?.et ?? 0,
      source: 'station',
      alerts: [],
      notes: `Fallback live weather from ${liveWeatherCoordinates?.label ?? 'area coordinates'}`,
    };
  }, [latestStoredLog?.et, latestStoredLog?.humidity, latestStoredLog?.windGust, liveForecastHours, liveForecastQuery.data, liveWeatherCoordinates?.label, selectedLocation, selectedLocationPrimary?.id]);

  const latestLog = liveLog ?? fallbackLiveLog ?? latestStoredLog;

  const liveConditionMeta = getWeatherConditionMeta(liveForecastQuery.data?.current.weatherCode);
  const LiveConditionIcon = liveConditionMeta.icon;
  const activeLiveSourceTypeLabel =
    liveWeatherCoordinates?.sourceType === 'primary-station'
      ? 'Primary Station'
      : liveWeatherCoordinates?.sourceType === 'area-coordinates'
        ? 'Area Coordinates'
        : liveWeatherCoordinates?.sourceType === 'settings-default'
          ? 'Settings Default Location'
        : liveWeatherCoordinates?.sourceType === 'search-anchor'
          ? 'Search Anchor Coordinates'
          : liveWeatherCoordinates?.sourceType === 'device-location'
            ? 'Current Device Location'
            : 'No live source';
  const selectedLiveSourceLabel = liveWeatherCoordinates ? liveWeatherCoordinates.label : 'No live source configured';
  const selectedLiveSourceVariant: 'default' | 'secondary' | 'outline' =
    isPrimaryStationActiveSource ? 'secondary' : liveWeatherCoordinates ? 'outline' : 'outline';
  const activeLiveSourceCoordinatesLabel = liveWeatherCoordinates
    ? `${liveWeatherCoordinates.latitude.toFixed(4)}, ${liveWeatherCoordinates.longitude.toFixed(4)}`
    : 'No active coordinates';
  const liveCurrentTemperatureF =
    liveForecastQuery.data?.current?.temperature !== undefined
      ? Math.round(liveForecastQuery.data.current.temperature)
      : null;
  const selectedPropertyCurrentTemperatureF =
    selectedPropertyWeatherQuery.data?.current?.temperature !== undefined
      ? Math.round(selectedPropertyWeatherQuery.data.current.temperature)
      : null;
  const canConfigureCurrentProperty = Boolean(currentProperty && currentPropertyId && currentPropertyId !== 'all');
  const shouldShowLocationSetup = canConfigureCurrentProperty && (!hasLocation || showLocationSetup);
  const currentPropertyWeatherLabel =
    ((currentProperty as (Property & { weatherLocationLabel?: string; weather_location_label?: string }) | null)?.weatherLocationLabel) ||
    ((currentProperty as (Property & { weatherLocationLabel?: string; weather_location_label?: string }) | null)?.weather_location_label) ||
    '';
  const propertyLocationLabel = currentPropertyWeatherLabel
    || (hasLocation ? `${currentProperty?.latitude?.toFixed(4)}, ${currentProperty?.longitude?.toFixed(4)}` : 'No location saved');
  const liveStatusLabel =
    liveStatus === 'ready'
      ? 'Live feed active'
      : liveStatus === 'loading'
        ? 'Refreshing live feed'
        : liveStatus === 'error'
          ? 'Live feed degraded'
          : 'Awaiting live source';
  const liveStatusBadgeVariant: 'default' | 'secondary' | 'outline' =
    liveStatus === 'ready' ? 'secondary' : liveStatus === 'error' ? 'default' : 'outline';
  const latestCaptureLabel = latestLog?.capturedAt
    ? new Date(latestLog.capturedAt).toLocaleString()
    : latestLog?.date
      ? `${latestLog.date} (daily log)`
      : 'No capture available';
  const activeProviderLabel =
    selectedLocationPrimary?.provider ||
    (liveWeatherCoordinates?.sourceType === 'device-location' ? 'Open-Meteo (device coordinates)' : 'Open-Meteo');
  const selectedPropertyRainContext = selectedProperty
    ? propertyWeatherCards.find((entry) => entry.property.id === selectedProperty.id)?.recentRain24 ?? null
    : null;
  const forecastConfidenceLabel = isPrimaryStationActiveSource && selectedLocationPrimary
    ? `Driven by primary station ${selectedLocationPrimary.name}`
    : liveWeatherCoordinates
      ? `Fallback from ${liveWeatherCoordinates.label}`
      : 'No source configured';
  const next8HourRainEstimate = Number(
    liveForecastHours.slice(0, 8).reduce((sum, point) => sum + (Number(point.precipitationProbability ?? 0) / 100) * 0.1, 0).toFixed(2),
  );
  const next8HourAvgWind = liveForecastHours.length
    ? Math.round(liveForecastHours.slice(0, 8).reduce((sum, point) => sum + Number(point.windSpeed ?? 0), 0) / Math.max(1, Math.min(8, liveForecastHours.length)))
    : null;
  const recentRainfallTotals = useMemo(
    () =>
      locationRain
        .slice(0, 5)
        .map((entry) => ({
          id: entry.id,
          date: entry.date,
          amount: entry.rainfallAmount,
          source: entry.enteredBy || 'Manual',
        })),
    [locationRain],
  );
  const rainfallAndWindSummary = useMemo(
    () => [
      {
        label: 'Past 24h Rainfall',
        value: latestLog ? `${latestLog.rainfallTotal.toFixed(2)} in` : '--',
        hint: latestLog ? `Captured ${latestLog.date}` : 'Awaiting capture',
      },
      {
        label: 'Next 8h Rainfall',
        value: `${next8HourRainEstimate.toFixed(2)} in`,
        hint: 'Probability-weighted estimate',
      },
      {
        label: 'Current Wind',
        value: latestLog ? `${Math.round(latestLog.wind)} mph` : '--',
        hint: latestLog ? `Gust ${Math.round(latestLog.windGust ?? 0)} mph` : 'No wind capture',
      },
      {
        label: 'Avg Wind (8h)',
        value: next8HourAvgWind !== null ? `${next8HourAvgWind} mph` : '--',
        hint: 'Forecast horizon average',
      },
    ],
    [latestLog, next8HourAvgWind, next8HourRainEstimate],
  );
  const decisionCards = useMemo(() => {
    if (!latestLog) {
      return [
        { label: 'Event Outlook', value: 'Waiting on data', detail: 'Connect a live station or enter a manual reading.' },
        { label: 'Spray Window', value: 'Undetermined', detail: 'Need current rain and wind data.' },
        { label: 'Traffic Risk', value: 'Undetermined', detail: 'Rainfall log not available yet.' },
      ];
    }

    const eventOutlook =
      latestLog.alerts?.some((alert) => alert.toLowerCase().includes('storm')) || latestLog.rainfallTotal >= 0.35
        ? { value: 'High watch', detail: 'Use this when evaluating tournament, guest, or event setup timing.' }
        : latestLog.rainfallTotal >= 0.15
          ? { value: 'Monitor', detail: 'Surface moisture may affect playability and setup windows.' }
          : { value: 'Favorable', detail: 'No major weather pressure on normal property operations.' };

    const sprayWindow =
      (latestLog.windGust ?? 0) >= 15 || latestLog.rainfallTotal >= 0.1
        ? { value: 'Caution', detail: 'Wind or moisture is elevated. Recheck before spraying.' }
        : { value: 'Open', detail: 'Wind and rainfall are currently within a more favorable operating window.' };

    const trafficRisk =
      latestLog.rainfallTotal >= 0.2
        ? { value: 'Soft surfaces', detail: 'Expect cart-path pressure and turf wear risk.' }
        : { value: 'Normal', detail: 'No unusual rainfall pressure for vehicle or foot traffic.' };

    return [
      { label: 'Event Outlook', ...eventOutlook },
      { label: 'Spray Window', ...sprayWindow },
      { label: 'Traffic Risk', ...trafficRisk },
    ];
  }, [latestLog]);

  const locationSetupBlock = shouldShowLocationSetup ? (
    <Card className="border-amber-300/80 bg-amber-50/40 p-4">
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-semibold text-amber-900">Set Weather Location</p>
          <p className="text-xs text-amber-900/80">Choose your property location to enable live weather.</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-2 rounded-xl border border-amber-200/70 bg-white/70 p-3">
            <p className="text-xs font-medium text-amber-900">Search by city/address</p>
            <div className="flex gap-2">
              <Input
                placeholder="City, State or Address"
                value={locationQuery}
                onChange={(event) => setLocationQuery(event.target.value)}
              />
              <Button size="sm" variant="outline" onClick={() => void handleLocationSearch()} disabled={locationSearchLoading || !locationQuery.trim()}>
                {locationSearchLoading ? 'Searching...' : 'Search'}
              </Button>
            </div>
            {locationSearchResults.length ? (
              <div className="grid gap-2">
                {locationSearchResults.map((result) => (
                  <button
                    key={`${result.label}-${result.latitude}-${result.longitude}`}
                    type="button"
                    onClick={() => void savePropertyWeatherLocation(result.latitude, result.longitude, result.label)}
                    className="rounded-lg border bg-background px-3 py-2 text-left text-xs transition hover:bg-muted/40"
                    disabled={locationSaveLoading}
                  >
                    <div className="font-medium">{result.label}</div>
                    <div className="text-muted-foreground">{result.latitude.toFixed(4)}, {result.longitude.toFixed(4)}</div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="space-y-2 rounded-xl border border-amber-200/70 bg-white/70 p-3">
            <p className="text-xs font-medium text-amber-900">Use device location</p>
            <Button size="sm" variant="outline" onClick={() => void handleUseCurrentLocationForProperty()} disabled={locationSaveLoading}>
              Use My Current Location
            </Button>
          </div>
        </div>
      </div>
    </Card>
  ) : null;

  function toggleDraftWidget(widgetId: WeatherWidgetId, checked: boolean) {
    setPrefsDraftEnabledWidgets((current) => {
      if (checked) {
        return current.includes(widgetId) ? current : [...current, widgetId];
      }
      return current.filter((widget) => widget !== widgetId);
    });
  }

  const enabledPanelPrefs = useMemo(() => {
    const nextPanels = Object.entries(PANEL_TO_WIDGET)
      .filter(([, widgetId]) => prefsDraftEnabledWidgets.includes(widgetId))
      .map(([panelId]) => panelId);
    return nextPanels.length ? nextPanels : [...DEFAULT_SETTINGS_PANELS];
  }, [prefsDraftEnabledWidgets]);

  async function togglePanelPreference(panelId: string, checked: boolean) {
    const mappedWidget = PANEL_TO_WIDGET[panelId];
    if (!mappedWidget) return;
    const nextWidgets = checked
      ? Array.from(new Set([...prefsDraftEnabledWidgets, mappedWidget]))
      : prefsDraftEnabledWidgets.filter((widget) => widget !== mappedWidget);
    setPrefsDraftEnabledWidgets(nextWidgets);

    const userId = currentUser?.appUserId ?? currentUser?.authUser?.id;
    if (!currentUser?.orgId || !userId) return;
    const nextId =
      widgetPrefsId ??
      (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : null);
    const orderedEnabled = prefsDraftWidgets.filter((widget) => nextWidgets.includes(widget));
    const payload: Record<string, unknown> = {
      org_id: currentUser.orgId,
      user_id: userId,
      location_id: prefsDraftLocationId || selectedLocation?.id || null,
      enabled_widgets: nextWidgets,
      widget_order: orderedEnabled,
      updated_at: new Date().toISOString(),
    };
    if (nextId) payload.id = nextId;
    const { error } = await supabase.from('weather_display_prefs').upsert(payload);
    if (error) {
      toast.error('Could not save panel preference', { description: error.message });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['weather-display-prefs'] });
  }

  async function handleDrawerLocationChange(name: string, address: string): Promise<boolean> {
    if (!selectedLocation) {
      setOnboardingAreaName(name);
      setOnboardingSearchQuery(address);
      setOnboardingSheetOpen(true);
      return true;
    }
    updateSelectedLocation({ name, address });
    try {
      await saveSelectedLocation();
      return true;
    } catch (error) {
      toast.error('Could not save weather area', {
        description: (error as Error)?.message ?? 'Unknown save failure',
      });
      return false;
    }
  }

  function moveDraftWidget(widgetId: WeatherWidgetId, direction: 'up' | 'down') {
    setPrefsDraftWidgets((current) => {
      const index = current.indexOf(widgetId);
      if (index < 0) return current;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });
  }

  async function saveDrawerWeatherPrefs() {
    const userId = currentUser?.appUserId ?? currentUser?.authUser?.id;
    if (!currentUser?.orgId || !userId) return;
    const nextId =
      widgetPrefsId ??
      (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : null);
    const orderedEnabled = prefsDraftWidgets.filter((widget) => prefsDraftEnabledWidgets.includes(widget));
    const payload: Record<string, unknown> = {
      org_id: currentUser.orgId,
      user_id: userId,
      location_id: prefsDraftLocationId || null,
      enabled_widgets: prefsDraftEnabledWidgets,
      widget_order: orderedEnabled,
      updated_at: new Date().toISOString(),
    };
    if (nextId) payload.id = nextId;
    const { error } = await supabase.from('weather_display_prefs').upsert(payload);
    if (error) {
      toast.error('Could not save weather display preferences', { description: error.message });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['weather-display-prefs'] });
    if (prefsDraftLocationId) {
      setSelectedLocationId(prefsDraftLocationId);
    }
  }

  async function handleSettingsDrawerOpenChange(open: boolean) {
    if (!open && settingsDrawerOpen) {
      await saveDrawerWeatherPrefs();
    }
    setSettingsDrawerOpen(open);
  }

  async function disableWeatherWidget(widgetId: WeatherWidgetId) {
    const userId = currentUser?.appUserId ?? currentUser?.authUser?.id;
    if (!currentUser?.orgId || !userId) return;
    const nextId =
      widgetPrefsId ??
      (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : null);
    const nextEnabled = weatherWidgetIds.filter((widget) => widget !== widgetId);
    const payload: Record<string, unknown> = {
      org_id: currentUser.orgId,
      user_id: userId,
      location_id: selectedLocation?.id ?? null,
      enabled_widgets: nextEnabled,
      widget_order: nextEnabled,
      updated_at: new Date().toISOString(),
    };
    if (nextId) payload.id = nextId;
    const { error } = await supabase.from('weather_display_prefs').upsert(payload);
    if (error) {
      toast.error('Could not update widget preferences', { description: error.message });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['weather-display-prefs'] });
  }

  if (needsPropertyWeatherOnboarding && !isInitialWeatherSetupLoading && !hasWeatherSetupError) {
    return (
      <div className="p-4 max-w-3xl mx-auto min-h-[70vh] flex items-center">
        <Card className="w-full p-6 space-y-5">
          <div>
            <p className="text-xl font-semibold">Set up weather for {currentProperty?.name ?? 'this property'}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose how to find your property location. This takes about 60 seconds.
            </p>
          </div>

          {onboardingStep === 1 ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <button
                  type="button"
                  onClick={() => void handleOnboardingUseCurrentLocation()}
                  className="rounded-xl border p-4 text-left hover:bg-muted/30 transition"
                >
                  <Crosshair className="h-5 w-5 text-primary" />
                  <p className="mt-2 text-sm font-semibold">Use my current location</p>
                  <p className="mt-1 text-xs text-muted-foreground">Best for mobile — uses your device GPS</p>
                </button>

                <button
                  type="button"
                  onClick={() => setOnboardingMethod((current) => (current === 'search' ? 'none' : 'search'))}
                  className="rounded-xl border p-4 text-left hover:bg-muted/30 transition"
                >
                  <Search className="h-5 w-5 text-primary" />
                  <p className="mt-2 text-sm font-semibold">Search by address or city</p>
                  <p className="mt-1 text-xs text-muted-foreground">Type your property address or nearest city</p>
                </button>

                <button
                  type="button"
                  onClick={() => setOnboardingMethod((current) => (current === 'manual' ? 'none' : 'manual'))}
                  className="rounded-xl border p-4 text-left hover:bg-muted/30 transition"
                >
                  <MapPin className="h-5 w-5 text-primary" />
                  <p className="mt-2 text-sm font-semibold">Enter coordinates manually</p>
                  <p className="mt-1 text-xs text-muted-foreground">For properties already in another system</p>
                </button>
              </div>

              {onboardingMethod === 'search' ? (
                <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                  <div className="flex gap-2">
                    <Input
                      value={onboardingSearchQuery}
                      onChange={(event) => setOnboardingSearchQuery(event.target.value)}
                      placeholder="e.g. 123 Main St, Sarasota FL"
                    />
                    <Button onClick={() => void handleOnboardingSearch()} disabled={onboardingSearchLoading || !onboardingSearchQuery.trim()}>
                      {onboardingSearchLoading ? 'Searching...' : 'Search'}
                    </Button>
                  </div>
                  {onboardingSearchResults.length ? (
                    <div className="space-y-2">
                      {onboardingSearchResults.map((result) => (
                        <button
                          key={`${result.label}-${result.latitude}-${result.longitude}`}
                          type="button"
                          onClick={() => {
                            setOnboardingSelectedLat(result.latitude);
                            setOnboardingSelectedLng(result.longitude);
                            setOnboardingSelectedLabel(result.label);
                            setOnboardingStep(2);
                          }}
                          className="w-full rounded-lg border bg-background px-3 py-2 text-left text-sm hover:bg-muted/30"
                        >
                          <div className="font-medium">{result.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {result.latitude.toFixed(4)}, {result.longitude.toFixed(4)}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {onboardingMethod === 'manual' ? (
                <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      type="number"
                      step="0.0001"
                      value={onboardingManualLat}
                      onChange={(event) => setOnboardingManualLat(event.target.value)}
                      placeholder="Latitude"
                    />
                    <Input
                      type="number"
                      step="0.0001"
                      value={onboardingManualLng}
                      onChange={(event) => setOnboardingManualLng(event.target.value)}
                      placeholder="Longitude"
                    />
                  </div>
                  <Button variant="outline" onClick={handleOnboardingManualConfirm}>
                    Confirm Coordinates
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          {onboardingStep === 2 ? (
            <div className="space-y-4">
              <Card className="p-4 border-dashed">
                <p className="text-sm font-semibold">Weather will be loaded for:</p>
                <p className="mt-2 text-lg font-semibold">{onboardingSelectedLabel || `${onboardingSelectedLat}, ${onboardingSelectedLng}`}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Coordinates: {onboardingSelectedLat?.toFixed(4)}, {onboardingSelectedLng?.toFixed(4)}
                </p>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" onClick={() => setOnboardingStep(1)}>
                    ← Change location
                  </Button>
                  <Button onClick={() => setOnboardingStep(3)}>
                    Looks right →
                  </Button>
                </div>
              </Card>

              <Card className="p-4">
                <p className="text-sm font-semibold">Current conditions at this location:</p>
                {onboardingPreviewQuery.isLoading ? (
                  <p className="mt-2 text-sm text-muted-foreground">Loading preview...</p>
                ) : onboardingPreviewQuery.data ? (
                  <div className="mt-2 text-sm">
                    <span className="font-semibold">{Math.round(onboardingPreviewQuery.data.current.temperature)}F</span>
                    <span className="text-muted-foreground"> · {getWeatherConditionMeta(onboardingPreviewQuery.data.current.weatherCode).label}</span>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">Preview unavailable right now.</p>
                )}
              </Card>
            </div>
          ) : null}

          {onboardingStep === 3 ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">What do you call this area?</label>
                <Input
                  id="onboarding-area-name"
                  className="mt-2"
                  value={onboardingAreaName}
                  onChange={(event) => setOnboardingAreaName(event.target.value)}
                  placeholder="e.g. Main Course, North Fields, Tournament Grounds"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  You can add more weather areas later for different zones of your property.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {['Main Course', 'Practice Range', 'Maintenance Yard', 'Tournament Grounds', 'North Fields', 'South Fields'].map((name) => (
                    <button
                      key={name}
                      type="button"
                      className="rounded-full border px-3 py-1 text-xs hover:bg-muted/30"
                      onClick={() => setOnboardingAreaName(name)}
                    >
                      {name}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="rounded-full border px-3 py-1 text-xs hover:bg-muted/30"
                    onClick={() => {
                      const input = document.getElementById('onboarding-area-name') as HTMLInputElement | null;
                      input?.focus();
                    }}
                  >
                    Custom...
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setOnboardingStep(2)}>
                  ← Back
                </Button>
                <Button onClick={() => void handleSaveOnboardingWeatherArea()} disabled={onboardingSaving}>
                  {onboardingSaving ? 'Saving...' : 'Save and load weather →'}
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      </div>
    );
  }

  if (isWeatherSetupIncomplete && !isInitialWeatherSetupLoading && !hasWeatherSetupError) {
    const noAreasExist = weatherLocations.length === 0;
    const noStationsExist = scopedStationCount === 0;
    return (
      <div className="p-4 max-w-7xl mx-auto">
        {locationSetupBlock}
        <Card className="p-6 text-sm space-y-4">
          <div>
            <p className="font-semibold">Weather setup is not complete yet.</p>
            <p className="mt-1 text-muted-foreground">
              {noAreasExist
                ? 'Create your first weather area so live conditions and forecasts can load.'
                : noStationsExist
                  ? 'Add your first station for this property so a primary source can drive live weather.'
                  : 'Complete setup to continue.'}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Button size="sm" className="gap-1" onClick={createStarterWeatherArea}>
              <Plus className="h-3.5 w-3.5" /> Create Area from Property
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={addWeatherAreaFromLocation}
              disabled={!selectedWorkLocationId || availableWorkLocations.length === 0}
            >
              <MapPinned className="h-3.5 w-3.5" /> Add Area from Work Location
            </Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => void applyDeviceLocationFallback()}>
              <Crosshair className="h-3.5 w-3.5" /> Use Device Location
            </Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={addFirstStationFromSetup}>
              <Radar className="h-3.5 w-3.5" /> Add First Station
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <Input
              value={customAreaName}
              onChange={(event) => setCustomAreaName(event.target.value)}
              placeholder="Create a custom weather area (e.g., Tournament Grounds)"
            />
            <Button size="sm" variant="outline" className="gap-1" onClick={addCustomWeatherArea}>
              <Plus className="h-3.5 w-3.5" /> Create Custom Area
            </Button>
          </div>
          {!selectedWorkLocationId && availableWorkLocations.length > 0 ? (
            <p className="text-xs text-muted-foreground">Pick a work location in Weather Management to enable one-click area import.</p>
          ) : null}
        </Card>
      </div>
    );
  }

  if (!selectedLocation) {
    if (isInitialWeatherSetupLoading) {
      return (
        <div className="p-4 max-w-7xl mx-auto space-y-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
          {weatherLoadTimedOut ? (
            <Card className="p-4 text-sm">
              <p className="font-medium">Weather data is taking longer than expected.</p>
              <p className="mt-1 text-muted-foreground">You can refresh weather data without reloading your session.</p>
              <Button className="mt-3" size="sm" variant="outline" onClick={refreshLiveWeather}>
                Refresh
              </Button>
            </Card>
          ) : null}
        </div>
      );
    }

    if (hasWeatherSetupError) {
      return (
        <div className="p-4 max-w-7xl mx-auto">
          <Card className="p-6 text-sm">
            <p className="font-semibold">Weather setup could not load.</p>
            <p className="mt-1 text-muted-foreground">
              A weather setup query failed. Check Supabase connectivity and retry.
            </p>
            <p className="mt-2 rounded-md border bg-muted/30 px-2 py-1 text-xs text-muted-foreground">{weatherSetupErrorMessage}</p>
            <Button className="mt-4" size="sm" variant="outline" onClick={refreshLiveWeather}>
              Retry
            </Button>
          </Card>
        </div>
      );
    }

    return (
      <div className="p-4 max-w-7xl mx-auto">
        {locationSetupBlock}
        <Card className="p-6 text-sm space-y-4">
          <div>
            <p className="font-semibold">Weather setup is not complete yet.</p>
            <p className="mt-1 text-muted-foreground">
              Create a weather area, connect a station, or use device location so Operations View can load live weather.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Button size="sm" className="gap-1" onClick={createStarterWeatherArea}>
              <Plus className="h-3.5 w-3.5" /> Create Weather Area
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => {
                if (!selectedLocation) {
                  createStarterWeatherArea();
                  return;
                }
                addStation();
                setSettingsDrawerOpen(true);
              }}
            >
              <Radar className="h-3.5 w-3.5" /> Add Station
            </Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => void applyDeviceLocationFallback()}>
              <Crosshair className="h-3.5 w-3.5" /> Use Device Location
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      {locationSetupBlock}
      <PageHeader
        title="Weather"
        subtitle={
          selectedProperty
            ? `Operations View: live conditions and forecast for ${selectedProperty.name}. Use the settings drawer for station and area setup.`
            : 'Operations View for day-to-day weather decisions, with a settings drawer for setup and controls.'
        }
        badge={<Badge variant="secondary">{weatherLocations.length} locations</Badge>}
      >
        <Button size="icon" variant="outline" onClick={() => setSettingsDrawerOpen(true)} aria-label="Open weather settings">
          <Settings className="h-4 w-4" />
        </Button>
      </PageHeader>

      <div className="hidden space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-2">
            <p className="truncate text-xs text-muted-foreground">
              {(selectedLocation?.name ?? 'Sarasota Polo Club')} · {activeProviderLabel} · Last updated {latestCaptureLabel}
              {liveCurrentTemperatureF !== null ? ` · ${liveCurrentTemperatureF}°F` : ''}{' '}
              {liveConditionMeta.label}
            </p>
            <Button size="icon" variant="ghost" onClick={refreshLiveWeather} aria-label="Refresh live weather">
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Live Data Source</p>
              <p className="mt-2 text-base font-semibold">{selectedLiveSourceLabel}</p>
              <p className="mt-1 text-xs text-muted-foreground">{forecastConfidenceLabel}</p>
              <p className="mt-2 text-xs text-muted-foreground">Last capture: {latestCaptureLabel}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Selected Property Context</p>
              <p className="mt-2 text-base font-semibold">{selectedProperty?.name ?? 'No property selected'}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                24h rainfall context: {selectedPropertyRainContext !== null ? `${selectedPropertyRainContext.toFixed(2)} in` : 'Unavailable'}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Area: {selectedLocation.name} · Station: {selectedLocationPrimary?.name ?? 'Not assigned'}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Decision Snapshot</p>
              <p className="mt-2 text-base font-semibold">
                Event: {decisionCards[0]?.value ?? 'Undetermined'} · Spray: {decisionCards[1]?.value ?? 'Undetermined'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Traffic risk: {decisionCards[2]?.value ?? 'Undetermined'}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Next 8h rain {next8HourRainEstimate.toFixed(2)} in · Avg wind {next8HourAvgWind !== null ? `${next8HourAvgWind} mph` : '--'}
              </p>
            </Card>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Operational Metrics</p>
              <p className="text-sm font-semibold">Current Weather Posture</p>
            </div>
            <Badge variant="outline">{selectedProperty?.shortName ?? 'All Areas'}</Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((item) => (
              <Card key={item.label} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{item.label}</p>
                    <p className="mt-2 text-2xl font-semibold">{item.value}</p>
                  </div>
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
              </Card>
            ))}
          </div>

          <Card className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">View Controls</p>
                <p className="text-xs text-muted-foreground">Default view is operations-focused. Open advanced controls only when needed.</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">Operational Filters</Badge>
                <Button size="sm" variant="outline" onClick={() => setShowOperationsControls((current) => !current)}>
                  {showOperationsControls ? 'Hide Controls' : 'Show Controls'}
                </Button>
              </div>
            </div>
            {showOperationsControls ? (
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <label className="flex items-center justify-between rounded-xl border bg-background/70 px-3 py-2 text-xs">
                  <span>Current Conditions</span>
                  <Switch checked={showCurrentConditions} onCheckedChange={setShowCurrentConditions} />
                </label>
                <label className="flex items-center justify-between rounded-xl border bg-background/70 px-3 py-2 text-xs">
                  <span>Hourly Forecast</span>
                  <Switch checked={showHourlyForecast} onCheckedChange={setShowHourlyForecast} />
                </label>
                <label className="flex items-center justify-between rounded-xl border bg-background/70 px-3 py-2 text-xs">
                  <span>Daily Forecast</span>
                  <Switch checked={showDailyForecast} onCheckedChange={setShowDailyForecast} />
                </label>
                <label className="flex items-center justify-between rounded-xl border bg-background/70 px-3 py-2 text-xs">
                  <span>Wind</span>
                  <Switch checked={showWind} onCheckedChange={setShowWind} />
                </label>
                <label className="flex items-center justify-between rounded-xl border bg-background/70 px-3 py-2 text-xs">
                  <span>Rain</span>
                  <Switch checked={showRain} onCheckedChange={setShowRain} />
                </label>
                <label className="flex items-center justify-between rounded-xl border bg-background/70 px-3 py-2 text-xs">
                  <span>Alerts</span>
                  <Switch checked={showAlerts} onCheckedChange={setShowAlerts} />
                </label>
                <label className="flex items-center justify-between rounded-xl border bg-background/70 px-3 py-2 text-xs">
                  <span>Turf Risk Notes</span>
                  <Switch checked={showTurfRiskNotes} onCheckedChange={setShowTurfRiskNotes} />
                </label>
                <label className="flex items-center justify-between rounded-xl border bg-background/70 px-3 py-2 text-xs">
                  <span>Property Weather Cards</span>
                  <Switch checked={showPropertyWeatherCards} onCheckedChange={setShowPropertyWeatherCards} />
                </label>
                <label className="flex items-center justify-between rounded-xl border bg-background/70 px-3 py-2 text-xs">
                  <span>Manual Rainfall History</span>
                  <Switch checked={showManualRainfallHistory} onCheckedChange={setShowManualRainfallHistory} />
                </label>
                <label className="flex items-center justify-between rounded-xl border bg-background/70 px-3 py-2 text-xs">
                  <span>Detailed Diagnostics</span>
                  <Switch checked={showDetailedDiagnostics} onCheckedChange={setShowDetailedDiagnostics} />
                </label>
                <label className="flex items-center justify-between rounded-xl border bg-background/70 px-3 py-2 text-xs">
                  <span>Station Management</span>
                  <Switch checked={showStationManagement} onCheckedChange={setShowStationManagement} />
                </label>
              </div>
            ) : null}
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">Real-Time Forecast</p>
                <p className="text-xs text-muted-foreground">
                  Open-Meteo current conditions and hourly outlook for immediate operational planning.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={selectedLiveSourceVariant}>{selectedLiveSourceLabel}</Badge>
                <Badge variant="outline">{liveWeatherCoordinates?.label ?? 'Waiting for coordinates'}</Badge>
              </div>
            </div>

            {liveForecastQuery.isLoading || liveForecastQuery.isFetching ? (
              <div className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
                  <Skeleton className="h-36 rounded-2xl" />
                  <Skeleton className="h-36 rounded-2xl" />
                </div>
                <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <Skeleton key={index} className="h-24 rounded-2xl" />
                  ))}
                </div>
              </div>
            ) : !liveWeatherCoordinates ? (
              <div className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground space-y-3">
                <p>No live coordinates available yet.</p>
                <p className="text-xs">Set station coordinates, set area coordinates, or allow browser location to load forecast data.</p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => setSettingsDrawerOpen(true)}>
                    <Radar className="h-3.5 w-3.5" /> Open Weather Management
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => void applyDeviceLocationFallback()}>
                    <Crosshair className="h-3.5 w-3.5" /> Use Device Location
                  </Button>
                </div>
              </div>
            ) : liveForecastQuery.data ? (
              <>
                <div className={`grid gap-4 ${(showHourlyForecast && showCurrentConditions) ? 'lg:grid-cols-[0.8fr_1.2fr]' : ''}`}>
                  {showCurrentConditions ? (
                  <div className="rounded-2xl border bg-background/70 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Current Conditions</div>
                        <div className="mt-3 text-4xl font-semibold">{liveCurrentTemperatureF !== null ? `${liveCurrentTemperatureF}F` : '--'}</div>
                        <div className="mt-1 text-sm text-muted-foreground">{liveConditionMeta.label}</div>
                        <div className="mt-3 text-xs text-muted-foreground">
                          Wind {Math.round(liveForecastQuery.data.current.windSpeed)} mph
                        </div>
                      </div>
                      <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                        <LiveConditionIcon className="h-8 w-8" />
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Active Live Source: {activeLiveSourceTypeLabel} · {selectedLiveSourceLabel} ({activeLiveSourceCoordinatesLabel})
                    </div>
                  </div>
                  ) : null}

                  {showHourlyForecast ? (
                    <div className="rounded-2xl border bg-background/70 p-5">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Hourly Forecast</div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button size="sm" variant={showHourlyTempMetric ? 'default' : 'outline'} onClick={() => setShowHourlyTempMetric((current) => !current)}>
                          Temp
                        </Button>
                        <Button size="sm" variant={showHourlyRainMetric ? 'default' : 'outline'} onClick={() => setShowHourlyRainMetric((current) => !current)}>
                          Rain %
                        </Button>
                        <Button size="sm" variant={showHourlyWindMetric ? 'default' : 'outline'} onClick={() => setShowHourlyWindMetric((current) => !current)}>
                          Wind
                        </Button>
                      </div>
                      <div className="mt-4 overflow-x-auto">
                        <div style={{ minWidth: `${Math.max(960, hourlyForecastChartData.length * 48)}px` }}>
                          <ResponsiveContainer width="100%" height={160}>
                            <ComposedChart data={hourlyForecastChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis
                                dataKey="hourLabel"
                                tick={{ fontSize: 11 }}
                                interval={1}
                                tickFormatter={(_, index) => (index % 2 === 0 ? String(hourlyForecastChartData[index]?.hourLabel ?? '') : '')}
                              />
                              <YAxis
                                yAxisId="temp"
                                tick={{ fontSize: 11 }}
                                width={34}
                                tickFormatter={(value) => `${value}°`}
                              />
                              <YAxis
                                yAxisId="conditions"
                                orientation="right"
                                tick={{ fontSize: 11 }}
                                width={34}
                                tickFormatter={(value) => `${value}`}
                              />
                              <Tooltip
                                formatter={(value: number, name) => {
                                  if (name === 'Temperature') return [`${value}°F`, name];
                                  if (name === 'Rain %') return [`${value}%`, name];
                                  if (name === 'Wind') return [`${value} mph`, name];
                                  return [value, name];
                                }}
                                labelFormatter={(label) => `${label}`}
                              />
                              {currentHourChartLabel ? (
                                <ReferenceLine x={currentHourChartLabel} stroke="#475569" strokeDasharray="4 4" yAxisId="temp" />
                              ) : null}
                              {showHourlyRainMetric ? (
                                <Bar yAxisId="conditions" dataKey="precipitationProbability" name="Rain %" fill="#3b82f6" fillOpacity={0.35} radius={[4, 4, 0, 0]} />
                              ) : null}
                              {showHourlyTempMetric ? (
                                <Line yAxisId="temp" type="monotone" dataKey="temperature" name="Temperature" stroke="#166534" strokeWidth={2} dot={false} />
                              ) : null}
                              {showHourlyWindMetric ? (
                                <Line yAxisId="conditions" type="monotone" dataKey="windSpeed" name="Wind" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 4" dot={false} />
                              ) : null}
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-3">
                        <div className="rounded-xl border bg-muted/25 px-3 py-2 text-xs">
                          <div className="text-muted-foreground">8h Rain</div>
                          <div className="font-semibold">{next8HourRainEstimate.toFixed(2)} in</div>
                        </div>
                        <div className="rounded-xl border bg-muted/25 px-3 py-2 text-xs">
                          <div className="text-muted-foreground">8h Avg Wind</div>
                          <div className="font-semibold">{next8HourAvgWind !== null ? `${next8HourAvgWind} mph` : '--'}</div>
                        </div>
                        <div className="rounded-xl border bg-muted/25 px-3 py-2 text-xs">
                          <div className="text-muted-foreground">Data Source</div>
                          <div className="font-semibold truncate">{primaryStation?.provider ?? 'Fallback'}</div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            ) : liveForecastQuery.isError ? (
              <div className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground space-y-3">
                <p>Live forecast is temporarily unavailable.</p>
                <p className="text-xs">
                  {latestStoredLog
                    ? `Showing stored weather context from ${latestStoredLog.date} while live data recovers.`
                    : 'Stored logs and manual entries are still available while live data recovers.'}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button size="sm" variant="outline" className="gap-1" onClick={refreshLiveWeather}>
                    <RefreshCcw className="h-3.5 w-3.5" /> Retry Live Forecast
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => openDialog('override')}>
                    <CloudSun className="h-3.5 w-3.5" /> Add Manual Override
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                Connect a station with coordinates or allow location access to load live weather.
              </div>
            )}
          </Card>

          {showPropertyWeatherCards && showDailyForecast ? (
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Property Weather Now</p>
                <p className="text-xs text-muted-foreground">At-a-glance weather posture across properties with rainfall and wind emphasis.</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">Actionable Summary</Badge>
                <Button size="sm" variant="outline" className="gap-1" onClick={refreshLiveWeather}>
                  <RefreshCcw className="h-3.5 w-3.5" /> Refresh Live Weather
                </Button>
              </div>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              {propertyWeatherCards.map(({ property, location, station, log, recentRain24 }) => (
                <button
                  key={property.id}
                  type="button"
                  onClick={() => setSelectedLocationId(location.id)}
                  className={`rounded-2xl border p-4 text-left transition ${selectedLocationId === location.id ? 'bg-accent/40 shadow-sm' : 'hover:bg-muted/20'}`}
                  style={selectedLocationId === location.id ? { borderColor: `${property.color}66` } : undefined}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{property.name}</div>
                      <div className="text-xs text-muted-foreground">{location.name}</div>
                    </div>
                    <Badge variant="outline" style={{ borderColor: property.color, color: property.color }}>
                      {property.shortName}
                    </Badge>
                  </div>
                  <div className="mt-3 text-3xl font-semibold">
                    {log ? `${Math.round(log.temperature)}F` : '--'}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{station ? `${station.name} - ${station.provider}` : 'No station selected'}</div>
                  <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                    <div className="rounded-xl bg-muted/30 px-2 py-2">
                      <div className="text-muted-foreground">Past 24h</div>
                      <div className="font-medium">{`${recentRain24.toFixed(2)} in`}</div>
                    </div>
                    <div className="rounded-xl bg-muted/30 px-2 py-2">
                      <div className="text-muted-foreground">Rain</div>
                      <div className="font-medium">{log ? `${log.rainfallTotal.toFixed(2)} in` : '--'}</div>
                    </div>
                    <div className="rounded-xl bg-muted/30 px-2 py-2">
                      <div className="text-muted-foreground">Wind</div>
                      <div className="font-medium">{log ? `${Math.round(log.wind)} mph` : '--'}</div>
                    </div>
                    <div className="rounded-xl bg-muted/30 px-2 py-2">
                      <div className="text-muted-foreground">Gust</div>
                      <div className="font-medium">{log ? `${Math.round(log.windGust ?? 0)} mph` : '--'}</div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {location.id === selectedLocationId && selectedForecast ? `Next 24h expected: ${selectedForecast.next24Rainfall.toFixed(2)} in` : 'Tap to drill into hourly forecast'}
                  </div>
                </button>
              ))}
            </div>
          </Card>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            {(showRain || showWind) ? (
            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Rainfall & Wind Summary</p>
                  <p className="text-xs text-muted-foreground">
                    Fast operational readout for moisture and wind-sensitive planning.
                  </p>
                </div>
                <Badge variant="outline">{selectedProperty?.shortName ?? selectedLocation.name}</Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {rainfallAndWindSummary
                  .filter((item) => (showRain ? true : !item.label.toLowerCase().includes('rain')))
                  .filter((item) => (showWind ? true : !item.label.toLowerCase().includes('wind')))
                  .map((item) => (
                  <div key={item.label} className="rounded-xl border bg-muted/20 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{item.label}</div>
                    <div className="mt-2 text-lg font-semibold">{item.value}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{item.hint}</div>
                  </div>
                ))}
              </div>
            </Card>
            ) : null}

            <RainfallTracker
              loading={weatherLogsQuery.isLoading || weatherLogsQuery.isFetching}
              logs={locationLogs.map((log) => ({
                date: log.date,
                rainfallTotal: Number(log.rainfallTotal ?? 0),
                source: log.source,
                notes: log.notes,
              }))}
            />
          </div>

          {showManualRainfallHistory ? (
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Recent Rainfall Totals</p>
                <p className="text-xs text-muted-foreground">
                  Latest manual entries for client-visible rainfall verification.
                </p>
              </div>
              <Badge variant="outline">{recentRainfallTotals.length} recent</Badge>
            </div>
            {recentRainfallTotals.length === 0 ? (
              <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                No recent rainfall totals recorded.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {recentRainfallTotals.map((entry) => (
                  <div key={entry.id} className="rounded-xl border bg-background/70 px-3 py-3">
                    <div className="text-xs text-muted-foreground">{entry.date}</div>
                    <div className="mt-1 text-lg font-semibold">{entry.amount.toFixed(2)} in</div>
                    <div className="text-xs text-muted-foreground">{entry.source}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
          ) : null}

          {selectedLocation && showDetailedDiagnostics ? (
            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-4">
                <WeatherSnapshotCard location={selectedLocation} log={latestLog} title="Daily Weather" />

                <Card className="p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Live Forecast</p>
                      <p className="text-xs text-muted-foreground">Open-Meteo forecast for the selected property coordinates with the next 8 hours of precipitation probability.</p>
                    </div>
                    <Badge variant="outline">{selectedProperty?.shortName ?? 'No property'}</Badge>
                  </div>
                  {selectedPropertyWeatherQuery.isLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-20 rounded-2xl" />
                      <Skeleton className="h-24 rounded-2xl" />
                    </div>
                  ) : selectedPropertyWeatherQuery.data ? (
                    <div className="space-y-4">
                      <div className="rounded-2xl border bg-background/70 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Current Conditions</div>
                            <div className="mt-2 text-3xl font-semibold">
                              {selectedPropertyCurrentTemperatureF !== null ? `${selectedPropertyCurrentTemperatureF}F` : '--'}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">{selectedPropertyWeatherMeta.label}</div>
                          </div>
                          <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                            <SelectedPropertyWeatherIcon className="h-6 w-6" />
                          </div>
                        </div>
                        <div className="mt-3 text-xs text-muted-foreground">Wind {Math.round(selectedPropertyWeatherQuery.data.current.windSpeed)} mph</div>
                      </div>
                      <div className="space-y-2">
                        {(selectedPropertyWeatherQuery.data.hourly ?? []).map((point) => {
                          const pointMeta = getWeatherIconMeta(point.weatherCode);
                          const PointIcon = pointMeta.icon;
                          return (
                            <div key={point.time} className="grid grid-cols-4 items-center gap-3 rounded-lg bg-muted/30 px-3 py-2 text-xs">
                              <div className="flex items-center gap-2">
                                <PointIcon className="h-3.5 w-3.5 text-primary" />
                                <span>{new Date(point.time).toLocaleTimeString([], { hour: 'numeric' })}</span>
                              </div>
                              <span>{Math.round(point.temperature)}F</span>
                              <span>{point.precipitationProbability}% rain</span>
                              <span>{Math.round(point.windSpeed)} mph wind</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                      Add latitude and longitude on the property record to enable the live Open-Meteo forecast.
                    </div>
                  )}
                </Card>

                <Card className="p-5">
                  <div className="mb-4">
                    <p className="text-sm font-semibold">Selected Live Station</p>
                    <p className="text-xs text-muted-foreground">This station currently drives live weather for the selected property.</p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border bg-background/70 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Station</div>
                      <div className="mt-2 text-sm font-semibold">{selectedLocationPrimary ? selectedLocationPrimary.name : 'No live station selected'}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {selectedLocationPrimary ? `${selectedLocationPrimary.provider} - ${selectedLocationPrimary.stationCode}` : 'Open Weather Management to connect a station.'}
                      </div>
                    </div>
                    <div className="rounded-xl border bg-background/70 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Current Alerts</div>
                      <div className="mt-2 text-sm font-semibold">
                        {showAlerts ? (latestLog?.alerts?.length ? latestLog.alerts.join(', ') : 'No major alerts') : 'Alerts hidden by view controls'}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {latestLog?.capturedAt ? `Last capture ${new Date(latestLog.capturedAt).toLocaleString()}` : 'No live capture yet'}
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="p-5">
                  <div className="mb-4">
                    <p className="text-sm font-semibold">Next 24 Hours</p>
                    <p className="text-xs text-muted-foreground">Forecast outlook from the selected station coordinates, with a simple hourly drill-in.</p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border bg-background/70 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Expected Rainfall</div>
                      <div className="mt-2 text-2xl font-semibold">
                        {selectedForecast ? `${selectedForecast.next24Rainfall.toFixed(2)} in` : '--'}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {selectedForecast?.summary ?? 'Forecast detail unavailable for this station yet.'}
                      </div>
                    </div>
                    <div className="rounded-xl border bg-background/70 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Hourly Drill-In</div>
                      <div className="mt-2 space-y-2">
                        {selectedForecast?.hourly?.slice(0, 6).map((point) => (
                          <div key={point.time} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-xs">
                            <span>{new Date(point.time).toLocaleTimeString([], { hour: 'numeric' })}</span>
                            <span>{Math.round(point.temperature)}F</span>
                            <span>{point.rain.toFixed(2)} in</span>
                            <span>{Math.round(point.gust)} mph gust</span>
                          </div>
                        )) ?? <p className="text-xs text-muted-foreground">No hourly forecast loaded.</p>}
                      </div>
                    </div>
                  </div>
                </Card>

                {showDetailedDiagnostics && (
                <Card className="p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Rainfall + Wind History</p>
                      <p className="text-xs text-muted-foreground">Use this for future agronomic reflection, not just current dispatch.</p>
                    </div>
                    <Badge variant="outline">{selectedLocation.name}</Badge>
                  </div>
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={locationLogs.map((log) => ({ date: log.date.slice(5), rainfall: log.rainfallTotal, gust: log.windGust ?? 0 }))}>
                      <defs>
                        <linearGradient id="rainDaily" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--info))" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="hsl(var(--info))" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="rainfall" stroke="hsl(var(--info))" fill="url(#rainDaily)" />
                      <Area type="monotone" dataKey="gust" stroke="hsl(var(--warning))" fillOpacity={0} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>
                )}
              </div>

              <div className="space-y-4">
                {showDetailedDiagnostics && (
                <Card className="p-5">
                  <div className="mb-4">
                    <p className="text-sm font-semibold">Forecast Service Strategy</p>
                    <p className="text-xs text-muted-foreground">Use free live feeds now, and connect paid services next for deeper forecast confidence.</p>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="rounded-xl border bg-background/70 p-4">
                      <div className="font-medium">Live today</div>
                      <div className="mt-1 text-xs text-muted-foreground">Open-Meteo, NOAA, and airport observations are active in this app today.</div>
                    </div>
                    <div className="rounded-xl border bg-background/70 p-4">
                      <div className="font-medium">Paid service ready</div>
                      <div className="mt-1 text-xs text-muted-foreground">WeatherBug, DTN, or Tomorrow.io can be connected next as premium forecast layers per property.</div>
                    </div>
                  </div>
                </Card>
                )}

                {showManualRainfallHistory && (
                <Card className="p-5">
                  <div className="mb-4">
                    <p className="text-sm font-semibold">Recent Rainfall Entries</p>
                    <p className="text-xs text-muted-foreground">Manual gauge entries stay visible whenever they are more trustworthy than the live feed.</p>
                  </div>
                  <div className="space-y-3">
                    {locationRain.length === 0 ? (
                      <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                        No manual rainfall entries yet.
                      </div>
                    ) : (
                      locationRain.slice(0, 6).map((entry) => (
                        <div key={entry.id} className="rounded-xl border bg-background/70 px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium">{entry.date}</p>
                              <p className="text-xs text-muted-foreground">{entry.enteredBy}</p>
                            </div>
                            <Badge variant="outline">{entry.rainfallAmount.toFixed(2)} in</Badge>
                          </div>
                          {entry.notes ? <p className="mt-2 text-xs text-muted-foreground">{entry.notes}</p> : null}
                        </div>
                      ))
                    )}
                  </div>
                </Card>
                )}
              </div>
            </div>
          ) : null}
        </div>

      <div className="space-y-4">
        <Card className="overflow-hidden border-0 bg-[#166534] text-white">
          <div className="grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-5xl font-semibold leading-none">{liveCurrentTemperatureF !== null ? `${liveCurrentTemperatureF}°F` : '--'}</p>
              <p className="mt-1 text-sm text-white/70">{liveConditionMeta.label}</p>
              <p className="mt-1 text-xs text-white/60">Feels like {liveForecastQuery.data?.current?.apparentTemperature ? `${Math.round(liveForecastQuery.data.current.apparentTemperature)}°F` : '--'}</p>
              <div className="mt-3 flex items-center gap-2 text-xs text-white/80">
                <span>{selectedLocation?.name ?? 'Sarasota Polo Club'} · Open-Meteo · {latestCaptureLabel}</span>
                <Button size="icon" variant="ghost" onClick={refreshLiveWeather} className="h-7 w-7 text-white hover:bg-white/10 hover:text-white" aria-label="Refresh live weather">
                  <RefreshCcw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs">☁ {liveConditionMeta.label}</span>
              <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs">💨 {Math.round(liveForecastQuery.data?.current.windSpeed ?? 0)} mph · Gust {Math.round(liveForecastQuery.data?.current.windGust ?? liveForecastQuery.data?.current.windSpeed ?? 0)} mph</span>
              <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs">💧 {Math.round(latestLog?.humidity ?? 0)}% humidity</span>
              <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs">☀ UV {liveForecastQuery.data?.current?.uvIndex ? Number(liveForecastQuery.data.current.uvIndex).toFixed(1) : '--'}</span>
              <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs sm:col-span-2">🌧 {(liveForecastQuery.data?.current?.precipitation ?? 0).toFixed(2)} in/hr precip</span>
            </div>
          </div>
        </Card>

        <Card className="border-[#e5e7eb] bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[#111827]">Next 24 Hours</p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant={showHourlyTempMetric ? 'default' : 'outline'} className={showHourlyTempMetric ? 'bg-[#166534] text-white hover:bg-[#14532d]' : ''} onClick={() => setShowHourlyTempMetric((current) => !current)}>Temp</Button>
              <Button size="sm" variant={showHourlyRainMetric ? 'default' : 'outline'} className={showHourlyRainMetric ? 'bg-[#166534] text-white hover:bg-[#14532d]' : ''} onClick={() => setShowHourlyRainMetric((current) => !current)}>Rain %</Button>
              <Button size="sm" variant={showHourlyWindMetric ? 'default' : 'outline'} className={showHourlyWindMetric ? 'bg-[#166534] text-white hover:bg-[#14532d]' : ''} onClick={() => setShowHourlyWindMetric((current) => !current)}>Wind</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div style={{ minWidth: `${Math.max(960, hourlyForecastChartData.length * 48)}px` }}>
              <ResponsiveContainer width="100%" height={160}>
                <ComposedChart data={hourlyForecastChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#f3f4f6" strokeDasharray="3 3" />
                  <XAxis dataKey="hourLabel" tick={{ fontSize: 11 }} interval={1} tickFormatter={(_, index) => (index % 2 === 0 ? String(hourlyForecastChartData[index]?.hourLabel ?? '') : '')} />
                  <YAxis yAxisId="temp" tick={{ fontSize: 11 }} width={34} tickFormatter={(value) => `${value}°`} />
                  <YAxis yAxisId="conditions" orientation="right" tick={{ fontSize: 11 }} width={34} tickFormatter={(value) => `${value}`} />
                  <Tooltip formatter={(value: number, name) => (name === 'Temperature' ? [`${value}°F`, name] : name === 'Rain %' ? [`${value}%`, name] : name === 'Wind' ? [`${value} mph`, name] : [value, name])} labelFormatter={(label) => `${label}`} />
                  {currentHourChartLabel ? <ReferenceLine x={currentHourChartLabel} stroke="#166534" strokeDasharray="4 4" yAxisId="temp" /> : null}
                  {showHourlyRainMetric ? <Bar yAxisId="conditions" dataKey="precipitationProbability" name="Rain %" fill="#3b82f6" fillOpacity={0.25} radius={[4, 4, 0, 0]} /> : null}
                  {showHourlyTempMetric ? <Line yAxisId="temp" type="monotone" dataKey="temperature" name="Temperature" stroke="#166534" strokeWidth={2} dot={false} /> : null}
                  {showHourlyWindMetric ? <Line yAxisId="conditions" type="monotone" dataKey="windSpeed" name="Wind" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 4" dot={false} /> : null}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-[#e5e7eb] bg-[#f9fafb] px-3 py-1 text-[#6b7280]">8h Rain {next8HourRainEstimate.toFixed(2)} in</span>
            <span className="rounded-full border border-[#e5e7eb] bg-[#f9fafb] px-3 py-1 text-[#6b7280]">8h Avg Wind {next8HourAvgWind !== null ? `${next8HourAvgWind} mph` : '--'}</span>
            <span className="rounded-full border border-[#e5e7eb] bg-[#f9fafb] px-3 py-1 text-[#6b7280]">Open-Meteo</span>
          </div>
        </Card>

        <Card className="border-[#e5e7eb] bg-white p-4">
          <div className="overflow-x-auto">
            <div className="flex min-w-[740px] gap-3">
              {(liveForecastQuery.data?.daily ?? []).slice(0, 7).map((day) => (
                <div key={day.date} className="w-[100px] rounded-lg border border-[#e5e7eb] bg-white p-3 text-center">
                  <p className="text-xs font-medium text-[#6b7280]">{new Date(day.date).toLocaleDateString([], { weekday: 'short' })}</p>
                  <p className="mt-1 text-lg">{day.precipitationSum > 0.05 ? '🌧️' : '☀️'}</p>
                  <p className="mt-1 text-sm font-semibold text-[#111827]">{Math.round(day.tempMax)}° / {Math.round(day.tempMin)}°</p>
                  <p className={`mt-1 text-xs ${day.precipitationSum > 0 ? 'text-[#3b82f6]' : 'text-[#6b7280]'}`}>{day.precipitationSum.toFixed(2)} in</p>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
          <RainfallTracker
            loading={weatherLogsQuery.isLoading || weatherLogsQuery.isFetching}
            logs={locationLogs.map((log) => ({
              date: log.date,
              rainfallTotal: Number(log.rainfallTotal ?? 0),
              source: log.source,
              notes: log.notes,
            }))}
          />
          <Card className="border-[#e5e7eb] bg-white p-5">
            <p className="text-sm font-semibold text-[#111827]">Wind & Conditions Summary</p>
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2">
                <div className="text-xs text-[#6b7280]">WIND NOW</div>
                <div className="mt-1 font-semibold text-[#111827]">{Math.round(liveForecastQuery.data?.current.windSpeed ?? 0)} mph · Gust {Math.round(liveForecastQuery.data?.current.windGust ?? liveForecastQuery.data?.current.windSpeed ?? 0)} mph · Direction {Math.round(liveForecastQuery.data?.current.windDirection ?? 0)}°</div>
              </div>
              <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2">
                <div className="text-xs text-[#6b7280]">AVG 8H WIND</div>
                <div className="mt-1 font-semibold text-[#111827]">{next8HourAvgWind !== null ? `${next8HourAvgWind} mph` : '--'}</div>
              </div>
              <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2">
                <div className="text-xs text-[#6b7280]">SPRAY WINDOW</div>
                {((liveForecastQuery.data?.current.windSpeed ?? 0) < 15 && (liveForecastQuery.data?.current.precipitation ?? 0) < 0.1) ? (
                  <Badge className="mt-1 bg-green-600 text-white hover:bg-green-600">Open</Badge>
                ) : (
                  <Badge className="mt-1 bg-red-600 text-white hover:bg-red-600">Closed</Badge>
                )}
              </div>
              <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2">
                <div className="text-xs text-[#6b7280]">UV TODAY</div>
                <div className="mt-1 font-semibold text-[#111827]">{liveForecastQuery.data?.current?.uvIndex ? `${Number(liveForecastQuery.data.current.uvIndex).toFixed(1)} — High` : '--'}</div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <WeatherSettingsDrawer
        open={settingsDrawerOpen}
        onOpenChange={(open) => {
          void handleSettingsDrawerOpenChange(open);
        }}
        isAdmin={isWeatherAdminUser}
        activeLocation={
          selectedLocation
            ? {
                name: selectedLocation.name || selectedLocation.area || 'Weather area',
                address: selectedLocation.address,
                latitude: selectedLocation.latitude,
                longitude: selectedLocation.longitude,
                isActive: true,
              }
            : null
        }
        enabledPanels={enabledPanelPrefs}
        onTogglePanel={(panelId, checked) => {
          void togglePanelPreference(panelId, checked);
        }}
        onChangeLocation={handleDrawerLocationChange}
        onRefreshLiveWeather={refreshLiveWeather}
        onAddManualRainEntry={() => openDialog('rainfall')}
      />

      <Sheet open={onboardingSheetOpen} onOpenChange={setOnboardingSheetOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Add Weather Area</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            {onboardingStep === 1 ? (
              <div className="space-y-4">
                <div className="grid gap-3">
                  <button type="button" onClick={() => void handleOnboardingUseCurrentLocation()} className="rounded-xl border p-4 text-left hover:bg-muted/30 transition">
                    <Crosshair className="h-5 w-5 text-primary" />
                    <p className="mt-2 text-sm font-semibold">Use my current location</p>
                    <p className="mt-1 text-xs text-muted-foreground">Best for mobile — uses your device GPS</p>
                  </button>
                  <button type="button" onClick={() => setOnboardingMethod((current) => (current === 'search' ? 'none' : 'search'))} className="rounded-xl border p-4 text-left hover:bg-muted/30 transition">
                    <Search className="h-5 w-5 text-primary" />
                    <p className="mt-2 text-sm font-semibold">Search by address or city</p>
                    <p className="mt-1 text-xs text-muted-foreground">Type your property address or nearest city</p>
                  </button>
                  <button type="button" onClick={() => setOnboardingMethod((current) => (current === 'manual' ? 'none' : 'manual'))} className="rounded-xl border p-4 text-left hover:bg-muted/30 transition">
                    <MapPin className="h-5 w-5 text-primary" />
                    <p className="mt-2 text-sm font-semibold">Enter coordinates manually</p>
                    <p className="mt-1 text-xs text-muted-foreground">For properties already in another system</p>
                  </button>
                </div>
                {onboardingMethod === 'search' ? (
                  <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                    <div className="flex gap-2">
                      <Input value={onboardingSearchQuery} onChange={(event) => setOnboardingSearchQuery(event.target.value)} placeholder="e.g. 123 Main St, Sarasota FL" />
                      <Button onClick={() => void handleOnboardingSearch()} disabled={onboardingSearchLoading || !onboardingSearchQuery.trim()}>
                        {onboardingSearchLoading ? 'Searching...' : 'Search'}
                      </Button>
                    </div>
                    {onboardingSearchResults.map((result) => (
                      <button
                        key={`${result.label}-${result.latitude}-${result.longitude}-sheet`}
                        type="button"
                        onClick={() => {
                          setOnboardingSelectedLat(result.latitude);
                          setOnboardingSelectedLng(result.longitude);
                          setOnboardingSelectedLabel(result.label);
                          setOnboardingStep(2);
                        }}
                        className="w-full rounded-lg border bg-background px-3 py-2 text-left text-sm hover:bg-muted/30"
                      >
                        <div className="font-medium">{result.label}</div>
                        <div className="text-xs text-muted-foreground">{result.latitude.toFixed(4)}, {result.longitude.toFixed(4)}</div>
                      </button>
                    ))}
                  </div>
                ) : null}
                {onboardingMethod === 'manual' ? (
                  <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input type="number" step="0.0001" value={onboardingManualLat} onChange={(event) => setOnboardingManualLat(event.target.value)} placeholder="Latitude" />
                      <Input type="number" step="0.0001" value={onboardingManualLng} onChange={(event) => setOnboardingManualLng(event.target.value)} placeholder="Longitude" />
                    </div>
                    <Button variant="outline" onClick={handleOnboardingManualConfirm}>Confirm Coordinates</Button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {onboardingStep === 2 ? (
              <div className="space-y-4">
                <Card className="p-4 border-dashed">
                  <p className="text-sm font-semibold">Weather will be loaded for:</p>
                  <p className="mt-2 text-lg font-semibold">{onboardingSelectedLabel || `${onboardingSelectedLat}, ${onboardingSelectedLng}`}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Coordinates: {onboardingSelectedLat?.toFixed(4)}, {onboardingSelectedLng?.toFixed(4)}</p>
                  <div className="mt-4 flex gap-2">
                    <Button variant="outline" onClick={() => setOnboardingStep(1)}>← Change location</Button>
                    <Button onClick={() => setOnboardingStep(3)}>Looks right →</Button>
                  </div>
                </Card>
                <Card className="p-4">
                  <p className="text-sm font-semibold">Current conditions at this location:</p>
                  {onboardingPreviewQuery.isLoading ? (
                    <p className="mt-2 text-sm text-muted-foreground">Loading preview...</p>
                  ) : onboardingPreviewQuery.data ? (
                    <div className="mt-2 text-sm">
                      <span className="font-semibold">{Math.round(onboardingPreviewQuery.data.current.temperature)}F</span>
                      <span className="text-muted-foreground"> · {getWeatherConditionMeta(onboardingPreviewQuery.data.current.weatherCode).label}</span>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">Preview unavailable right now.</p>
                  )}
                </Card>
              </div>
            ) : null}

            {onboardingStep === 3 ? (
              <div className="space-y-4">
                <label className="text-sm font-medium">What do you call this area?</label>
                <Input value={onboardingAreaName} onChange={(event) => setOnboardingAreaName(event.target.value)} placeholder="e.g. Main Course, North Fields, Tournament Grounds" />
                <div className="flex flex-wrap gap-2">
                  {['Main Course', 'Practice Range', 'Maintenance Yard', 'Tournament Grounds', 'North Fields', 'South Fields'].map((name) => (
                    <button key={`${name}-sheet`} type="button" className="rounded-full border px-3 py-1 text-xs hover:bg-muted/30" onClick={() => setOnboardingAreaName(name)}>
                      {name}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">You can add more weather areas later for different zones of your property.</p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setOnboardingStep(2)}>← Back</Button>
                  <Button onClick={() => void handleSaveOnboardingWeatherArea()} disabled={onboardingSaving}>
                    {onboardingSaving ? 'Saving...' : 'Save and load weather →'}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={Boolean(removeAreaId)} onOpenChange={(open) => !open && setRemoveAreaId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove weather area?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will remove the selected weather area and all linked stations.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRemoveAreaId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => removeAreaId && void removeArea(removeAreaId)}>
              Remove area
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{dialogMode === 'rainfall' ? 'Manual Rainfall Entry' : 'Manual Weather Override'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Location</label>
                <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.locationId} onChange={(e) => setDraft((current) => ({ ...current, locationId: e.target.value }))}>
                  {weatherLocations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Date</label>
                <Input className="mt-1" type="date" value={draft.date} onChange={(e) => setDraft((current) => ({ ...current, date: e.target.value }))} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Rainfall (inches)</label>
                <Input className="mt-1" type="number" step="0.01" value={draft.rainfallAmount} onChange={(e) => setDraft((current) => ({ ...current, rainfallAmount: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Entered By</label>
                <Input className="mt-1" value={draft.enteredBy} onChange={(e) => setDraft((current) => ({ ...current, enteredBy: e.target.value }))} />
              </div>
            </div>

            {dialogMode === 'override' && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Current Conditions</label>
                    <Input className="mt-1" value={draft.currentConditions} onChange={(e) => setDraft((current) => ({ ...current, currentConditions: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Forecast</label>
                    <Input className="mt-1" value={draft.forecast} onChange={(e) => setDraft((current) => ({ ...current, forecast: e.target.value }))} />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-5">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Temp</label>
                    <Input className="mt-1" type="number" value={draft.temperature} onChange={(e) => setDraft((current) => ({ ...current, temperature: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Humidity</label>
                    <Input className="mt-1" type="number" value={draft.humidity} onChange={(e) => setDraft((current) => ({ ...current, humidity: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Wind</label>
                    <Input className="mt-1" type="number" value={draft.wind} onChange={(e) => setDraft((current) => ({ ...current, wind: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Gust</label>
                    <Input className="mt-1" type="number" value={draft.windGust} onChange={(e) => setDraft((current) => ({ ...current, windGust: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">ET</label>
                    <Input className="mt-1" type="number" step="0.01" value={draft.et} onChange={(e) => setDraft((current) => ({ ...current, et: e.target.value }))} />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="text-xs font-medium text-muted-foreground">Notes</label>
              <textarea className="mt-1 min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={draft.notes} onChange={(e) => setDraft((current) => ({ ...current, notes: e.target.value }))} />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={saveEntry}>Save Entry</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
