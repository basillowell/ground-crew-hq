import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AreaChart, Area, BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CloudSun, Crosshair, Droplets, MapPin, MapPinned, PencilLine, Plus, Radar, RefreshCcw, Save, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared';
import { WeatherSnapshotCard } from '@/components/weather/WeatherSnapshotCard';
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
import { useWeather, getWeatherIconMeta } from '@/lib/weather';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useProperties, useProgramSettings, useWeatherLocations, useWorkLocations } from '@/lib/supabase-queries';

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

export default function WeatherPage() {
  const queryClient = useQueryClient();
  const { currentUser, currentPropertyId } = useAuth();
  const propertiesQuery = useProperties(currentUser?.orgId);
  const properties = useMemo(() => propertiesQuery.data ?? [], [propertiesQuery.data]);
  const programSettingQuery = useProgramSettings(currentUser?.orgId);
  const programSetting = programSettingQuery.data ?? null;
  const workLocationsQuery = useWorkLocations();
  const workLocations = useMemo(() => workLocationsQuery.data ?? [], [workLocationsQuery.data]);
  const weatherLocationsQuery = useWeatherLocations(currentPropertyId);
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
  const [stationSuggestions, setStationSuggestions] = useState<WeatherStationSuggestion[]>([]);
  const [stationSearchStatus, setStationSearchStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [propertyLiveLogs, setPropertyLiveLogs] = useState<Record<string, WeatherDailyLog | null>>({});
  const [selectedForecast, setSelectedForecast] = useState<WeatherForecastDetail | null>(null);
  const [browserCoordinates, setBrowserCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showHourlyForecast, setShowHourlyForecast] = useState(true);
  const [showStationManagement, setShowStationManagement] = useState(false);
  const [showPropertyWeatherCards, setShowPropertyWeatherCards] = useState(true);
  const [showManualRainfallHistory, setShowManualRainfallHistory] = useState(false);
  const [showOperationalDecisionCards, setShowOperationalDecisionCards] = useState(true);
  const [showDetailedDiagnostics, setShowDetailedDiagnostics] = useState(false);
  const [showOperationsControls, setShowOperationsControls] = useState(false);
  const [activeTab, setActiveTab] = useState<'daily' | 'manage'>('daily');

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

  const currentProperty = properties.find((property) => property.id === currentPropertyId) ?? null;

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
  const selectedLocationPrimary = locationStations.find((station) => station.isPrimary) ?? null;
  const liveWeatherCoordinates = useMemo(() => {
    if (hasValidCoordinates(selectedLocationPrimary?.latitude, selectedLocationPrimary?.longitude)) {
      return {
        latitude: selectedLocationPrimary!.latitude!,
        longitude: selectedLocationPrimary!.longitude!,
        label: `${selectedLocationPrimary.name} · ${selectedLocationPrimary.provider}`,
      };
    }

    if (hasValidCoordinates(selectedLocation?.latitude, selectedLocation?.longitude)) {
      return {
        latitude: selectedLocation!.latitude!,
        longitude: selectedLocation!.longitude!,
        label: `${selectedLocation.name} area coordinates`,
      };
    }

    if (browserCoordinates) {
      return {
        latitude: browserCoordinates.latitude,
        longitude: browserCoordinates.longitude,
        label: 'Current device location',
      };
    }

    return null;
  }, [browserCoordinates, selectedLocation, selectedLocationPrimary]);

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
    void queryClient.invalidateQueries({ queryKey: ['weather-page-open-meteo'] });
    void queryClient.invalidateQueries({ queryKey: ['weather', selectedProperty?.id] });
    void selectedPropertyWeatherQuery.refetch();
    void liveForecastQuery.refetch();
  }

  async function searchStationsByAddress(queryOverride?: string) {
    const query = (queryOverride ?? stationSearchQuery).trim();
    if (!query) return;
    setStationSearchStatus('loading');
    try {
      const result = await fetchWeatherStationSuggestions({ query });
      setDiscoveryAnchor(result.anchor);
      setStationSuggestions(result.suggestions);
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
      setStationSuggestions(result.suggestions);
      setStationSearchStatus('ready');
    } catch {
      setStationSearchStatus('error');
      toast('Location lookup failed', {
        description: 'Allow location access or search by address to find nearby live stations.',
      });
    }
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
      setActiveTab('daily');
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
    setActiveTab('manage');
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
          ...location,
          org_id: currentUser.orgId,
          property_id: location.propertyId,
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
      await supabase.from('weather_locations').upsert(
        weatherLocations.map(location => ({
          ...location,
          org_id: currentUser.orgId,
          property_id: location.propertyId,
        }))
      );
      queryClient.invalidateQueries({ queryKey: ['weather-locations'] });
    }
    toast('Weather area saved', { description: 'Area naming and property details have been updated.' });
  }

  function addStationForLocation(locationId: string) {
    const targetLocation = weatherLocations.find((location) => location.id === locationId);
    if (!targetLocation) return;
    const targetLocationStations = weatherStations.filter((station) => station.locationId === locationId);
    const nextStation: WeatherStation = {
      id: makeId('ws'),
      locationId,
      name: `${targetLocation.name} Station`,
      provider: 'Open-Meteo',
      providerType: 'open-meteo',
      stationCode: `${locationId.toUpperCase()}-${targetLocationStations.length + 1}`,
      latitude: 35.78,
      longitude: -78.64,
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
      setActiveTab('manage');
      return;
    }
    const fallbackLocation = weatherLocations[0];
    if (!fallbackLocation) {
      createStarterWeatherArea();
      return;
    }
    setSelectedLocationId(fallbackLocation.id);
    addStationForLocation(fallbackLocation.id);
    setActiveTab('manage');
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

  const liveForecastQuery = useQuery({
    queryKey: ['weather-page-open-meteo', selectedLocation?.id ?? 'none', liveWeatherCoordinates?.latitude, liveWeatherCoordinates?.longitude],
    enabled: Boolean(liveWeatherCoordinates),
    staleTime: 1000 * 60 * 30,
    retry: 1,
    refetchOnWindowFocus: false,
    queryFn: async () =>
      fetchOpenMeteoWeather({
        latitude: liveWeatherCoordinates!.latitude,
        longitude: liveWeatherCoordinates!.longitude,
      }),
  });
  const liveForecastHours = useMemo(() => liveForecastQuery.data?.hourly ?? [], [liveForecastQuery.data?.hourly]);

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
  const selectedLiveSourceLabel = primaryStation
    ? `${primaryStation.name} · ${primaryStation.provider}`
    : liveWeatherCoordinates
      ? `Fallback · ${liveWeatherCoordinates.label}`
      : 'No live source configured';
  const selectedLiveSourceVariant: 'default' | 'secondary' | 'outline' =
    primaryStation ? 'secondary' : liveWeatherCoordinates ? 'outline' : 'outline';
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
  const selectedPropertyRainContext = selectedProperty
    ? propertyWeatherCards.find((entry) => entry.property.id === selectedProperty.id)?.recentRain24 ?? null
    : null;
  const forecastConfidenceLabel = primaryStation
    ? `Driven by primary station ${primaryStation.name}`
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

  if (isWeatherSetupIncomplete && !isInitialWeatherSetupLoading && !hasWeatherSetupError) {
    const noAreasExist = weatherLocations.length === 0;
    const noStationsExist = scopedStationCount === 0;
    return (
      <div className="p-4 max-w-7xl mx-auto">
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
                setActiveTab('manage');
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
      <PageHeader
        title="Weather"
        subtitle={
          selectedProperty
            ? `Operations View: live conditions and forecast for ${selectedProperty.name}. Weather Management: station and area setup.`
            : 'Operations View for day-to-day weather decisions, plus Weather Management for setup and controls.'
        }
        badge={<Badge variant="secondary">{weatherLocations.length} locations</Badge>}
      />

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'daily' | 'manage')} className="space-y-4">
        <TabsList>
          <TabsTrigger value="daily">Operations View</TabsTrigger>
          <TabsTrigger value="manage">Weather Management</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-4">
          <Card className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Operations Overview</p>
                <h2 className="mt-1 text-xl font-semibold">
                  {selectedProperty ? `${selectedProperty.name} Weather Command` : 'Property Weather Command'}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Live source transparency, short-horizon forecast signals, and decision-ready weather context.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant={liveStatusBadgeVariant}>{liveStatusLabel}</Badge>
                  <Badge variant={selectedLiveSourceVariant}>Source: {selectedLiveSourceLabel}</Badge>
                  <Badge variant="outline">Area: {selectedLocation.name}</Badge>
                  <Badge variant="outline">Logs: {locationLogs.length}</Badge>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border bg-muted/30 px-3 py-2 text-xs">
                  <div className="text-muted-foreground">Next 8h Rainfall</div>
                  <div className="text-sm font-semibold">{next8HourRainEstimate.toFixed(2)} in</div>
                </div>
                <div className="rounded-xl border bg-muted/30 px-3 py-2 text-xs">
                  <div className="text-muted-foreground">Next 8h Avg Wind</div>
                  <div className="text-sm font-semibold">{next8HourAvgWind !== null ? `${next8HourAvgWind} mph` : '--'}</div>
                </div>
                <Button size="sm" variant="outline" className="gap-1" onClick={refreshLiveWeather}>
                  <RefreshCcw className="h-3.5 w-3.5" /> Refresh Live Weather
                </Button>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => openDialog('rainfall')}>
                  <Droplets className="h-3.5 w-3.5" /> Add Rain Entry
                </Button>
              </div>
            </div>
          </Card>

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
                  <span>Hourly Forecast</span>
                  <Switch checked={showHourlyForecast} onCheckedChange={setShowHourlyForecast} />
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
                  <span>Operational Decision Cards</span>
                  <Switch checked={showOperationalDecisionCards} onCheckedChange={setShowOperationalDecisionCards} />
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
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => setActiveTab('manage')}>
                    <Radar className="h-3.5 w-3.5" /> Open Weather Management
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => void applyDeviceLocationFallback()}>
                    <Crosshair className="h-3.5 w-3.5" /> Use Device Location
                  </Button>
                </div>
              </div>
            ) : liveForecastQuery.data ? (
              <>
                <div className={`grid gap-4 ${showHourlyForecast ? 'lg:grid-cols-[0.8fr_1.2fr]' : ''}`}>
                  <div className="rounded-2xl border bg-background/70 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Current Conditions</div>
                        <div className="mt-3 text-4xl font-semibold">
                          {Math.round(liveForecastQuery.data.current.temperature)}F
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">{liveConditionMeta.label}</div>
                        <div className="mt-3 text-xs text-muted-foreground">
                          Wind {Math.round(liveForecastQuery.data.current.windSpeed)} mph
                        </div>
                      </div>
                      <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                        <LiveConditionIcon className="h-8 w-8" />
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

                  {showHourlyForecast ? (
                    <div className="rounded-2xl border bg-background/70 p-5">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Hourly Forecast</div>
                      <div className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-8">
                        {(liveForecastHours.length ? liveForecastHours : []).map((point) => {
                          const pointMeta = getWeatherConditionMeta(point.weatherCode);
                          const PointIcon = pointMeta.icon;
                          return (
                            <div key={point.time} className="rounded-xl bg-muted/25 px-3 py-3 text-center">
                              <div className="text-[11px] font-medium text-muted-foreground">
                                {new Date(point.time).toLocaleTimeString([], { hour: 'numeric' })}
                              </div>
                              <PointIcon className="mx-auto mt-2 h-4 w-4 text-primary" />
                              <div className="mt-2 text-sm font-semibold">{Math.round(point.temperature)}F</div>
                              <div className="mt-1 text-[11px] text-muted-foreground">{point.precipitationProbability}% rain</div>
                              <div className="text-[11px] text-muted-foreground">{Math.round(point.windSpeed)} mph wind</div>
                            </div>
                          );
                        })}
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

          {showPropertyWeatherCards ? (
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
                  <div className="mt-3 text-3xl font-semibold">{log ? `${Math.round(log.temperature)}F` : '--'}</div>
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
                {rainfallAndWindSummary.map((item) => (
                  <div key={item.label} className="rounded-xl border bg-muted/20 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{item.label}</div>
                    <div className="mt-2 text-lg font-semibold">{item.value}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{item.hint}</div>
                  </div>
                ))}
              </div>
            </Card>

            {showOperationalDecisionCards ? (
            <Card className="p-5">
              <div className="mb-4">
                <p className="text-sm font-semibold">Decision Cards</p>
                <p className="text-xs text-muted-foreground">
                  Event, spray, and traffic risk guidance based on current weather signals.
                </p>
              </div>
              <div className="space-y-3">
                {decisionCards.map((card) => (
                  <div key={card.label} className="rounded-xl border bg-background/70 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{card.label}</div>
                    <div className="mt-2 text-base font-semibold">{card.value}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{card.detail}</div>
                  </div>
                ))}
              </div>
            </Card>
            ) : null}
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
                            <div className="mt-2 text-3xl font-semibold">{Math.round(selectedPropertyWeatherQuery.data.current.temperature)}F</div>
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
                      <div className="mt-2 text-sm font-semibold">{latestLog?.alerts?.length ? latestLog.alerts.join(', ') : 'No major alerts'}</div>
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
        </TabsContent>

        <TabsContent value="manage" className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Weather Management</p>
            <h2 className="mt-1 text-xl font-semibold">Areas, Stations, and Manual Fallback</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Configure weather areas, choose primary stations, and maintain manual weather continuity.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{weatherLocations.length} areas</Badge>
            <Badge variant="outline">{weatherStations.length} stations</Badge>
          </div>
        </div>
      </Card>
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Setup Diagnostics</p>
            <p className="text-xs text-muted-foreground">Troubleshooting details for weather setup resolution and query health.</p>
          </div>
          <Badge variant="outline">Management Only</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-xl border bg-muted/20 px-3 py-2 text-xs">
            <div className="text-muted-foreground">Selected Property</div>
            <div className="mt-1 font-medium">{selectedProperty?.name ?? 'Unresolved'}</div>
            <div className="text-muted-foreground">{selectedProperty?.id ?? 'No property id'}</div>
          </div>
          <div className="rounded-xl border bg-muted/20 px-3 py-2 text-xs">
            <div className="text-muted-foreground">Resolved Weather Area</div>
            <div className="mt-1 font-medium">{selectedLocation?.name ?? 'Unresolved'}</div>
            <div className="text-muted-foreground">{selectedLocation?.id ?? 'No area id'}</div>
          </div>
          <div className="rounded-xl border bg-muted/20 px-3 py-2 text-xs">
            <div className="text-muted-foreground">Stations in Area</div>
            <div className="mt-1 font-medium">{locationStations.length}</div>
            <div className="text-muted-foreground">
              Primary: {selectedLocationPrimary ? selectedLocationPrimary.name : 'Not set'}
            </div>
          </div>
          <div className="rounded-xl border bg-muted/20 px-3 py-2 text-xs">
            <div className="text-muted-foreground">Live Forecast Coordinates</div>
            <div className="mt-1 font-medium">{liveWeatherCoordinates ? 'Available' : 'Missing'}</div>
            <div className="text-muted-foreground">
              {liveWeatherCoordinates ? `${liveWeatherCoordinates.latitude}, ${liveWeatherCoordinates.longitude}` : 'No resolved coordinates'}
            </div>
          </div>
          <div className="rounded-xl border bg-muted/20 px-3 py-2 text-xs md:col-span-2 xl:col-span-2">
            <div className="text-muted-foreground">Query Errors</div>
            {weatherQueryErrors.length > 0 ? (
              <ul className="mt-1 space-y-1">
                {weatherQueryErrors.map((message, index) => (
                  <li key={`${message}-${index}`} className="font-medium text-foreground/90">
                    {message}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-1 font-medium text-foreground/90">No active weather query errors.</div>
            )}
          </div>
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-3">
          <Card className="p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold">Build Weather Areas</p>
              <p className="text-xs text-muted-foreground">
                Define weather areas from Program Setup locations or add a custom area for a property or zone.
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Use Program Setup Location</label>
              <div className="mt-1 flex gap-2">
                <select
                  className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                  value={selectedWorkLocationId}
                  onChange={(event) => setSelectedWorkLocationId(event.target.value)}
                >
                  {availableWorkLocations.length === 0 ? (
                    <option value="">All locations already linked</option>
                  ) : (
                    availableWorkLocations.map((location) => (
                      <option key={location.id} value={location.id}>{location.name}</option>
                    ))
                  )}
                </select>
                <Button size="sm" className="gap-1" onClick={addWeatherAreaFromLocation} disabled={availableWorkLocations.length === 0}>
                  <Plus className="h-3.5 w-3.5" /> Add
                </Button>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Create Custom Weather Area</label>
              <div className="mt-1 flex gap-2">
                <Input
                  value={customAreaName}
                  onChange={(event) => setCustomAreaName(event.target.value)}
                  placeholder="Back Nine, Practice Center"
                />
                <Button size="sm" variant="outline" className="gap-1" onClick={addCustomWeatherArea}>
                  <Plus className="h-3.5 w-3.5" /> Create
                </Button>
              </div>
            </div>
          </Card>
          {weatherLocations.map((location) => {
            const primaryStation = weatherStations.find((station) => station.locationId === location.id && station.isPrimary);
            const locationProperty = properties.find((property) => property.id === location.propertyId);
            return (
              <Card
                key={location.id}
                className={`cursor-pointer p-4 transition-colors ${selectedLocationId === location.id ? 'bg-accent/40' : 'hover:bg-muted/30'}`}
                style={selectedLocationId === location.id && locationProperty?.color ? { borderColor: `${locationProperty.color}66` } : undefined}
                onClick={() => setSelectedLocationId(location.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{location.name}</p>
                    <p className="text-xs text-muted-foreground">{location.property} - {location.area}</p>
                  </div>
                  {primaryStation && <Badge variant="outline">Primary Station</Badge>}
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  {primaryStation ? `${primaryStation.name} · ${primaryStation.provider}` : 'No primary station selected'}
                </div>
              </Card>
            );
          })}
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Weather Management Actions</p>
                <p className="text-xs text-muted-foreground">
                  Admin setup controls for area definitions, station hierarchy, source selection, and manual fallback continuity.
                </p>
              </div>
              <Badge variant="secondary">Admin Workflow</Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              <Button size="sm" variant="outline" className="gap-1" onClick={() => openDialog('rainfall')}>
                <Droplets className="h-3.5 w-3.5" /> Manual Rainfall
              </Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => openDialog('override')}>
                <CloudSun className="h-3.5 w-3.5" /> Manual Override
              </Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={refreshLiveWeather}>
                <RefreshCcw className="h-3.5 w-3.5" /> Refresh Live Weather
              </Button>
              <Button size="sm" className="gap-1" onClick={saveSelectedLocation} disabled={!selectedLocation}>
                <Save className="h-3.5 w-3.5" /> Save Area
              </Button>
              <Button size="sm" className="gap-1" onClick={saveStations} disabled={!selectedLocation}>
                <Save className="h-3.5 w-3.5" /> Save Stations
              </Button>
            </div>
          </Card>

          {selectedLocation && (
            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">Area + Station Setup</p>
                  <p className="text-xs text-muted-foreground">
                    Choose the station that should provide live weather for this area and keep manual fallback available.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="gap-1" onClick={refreshLiveWeather}>
                    <RefreshCcw className="h-3.5 w-3.5" /> Refresh Live Weather
                  </Button>
                  <Button size="sm" className="gap-1" onClick={saveSelectedLocation}>
                    <Save className="h-3.5 w-3.5" /> Save Area
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="space-y-4">
                  {selectedProperty ? (
                    <div
                      className="rounded-2xl border bg-muted/20 p-4"
                      style={{ borderColor: `${selectedProperty.color}55` }}
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" style={{ borderColor: selectedProperty.color, color: selectedProperty.color }}>
                          {selectedProperty.shortName}
                        </Badge>
                        <span className="text-sm font-medium">{selectedProperty.name}</span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Use this property&apos;s address and current location to find the nearest live stations and improve rainfall accuracy for agronomic decisions.
                      </p>
                    </div>
                  ) : null}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Area Name</label>
                      <Input className="mt-1" value={selectedLocation.name} onChange={(event) => updateSelectedLocation({ name: event.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Property</label>
                      <select
                        className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={selectedLocation.propertyId || ''}
                        onChange={(event) => {
                          const property = properties.find((entry) => entry.id === event.target.value);
                          updateSelectedLocation({
                            propertyId: property?.id,
                            property: property?.name || selectedLocation.property,
                            address: property ? `${property.address}, ${property.city}, ${property.state}` : selectedLocation.address,
                          });
                        }}
                      >
                        <option value="">No property linked</option>
                        {properties.map((property) => (
                          <option key={property.id} value={property.id}>{property.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Coverage Zone</label>
                    <Input className="mt-1" value={selectedLocation.area} onChange={(event) => updateSelectedLocation({ area: event.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Address / Search Anchor</label>
                    <Input className="mt-1" value={selectedLocation.address ?? ''} onChange={(event) => updateSelectedLocation({ address: event.target.value })} placeholder="Property or area address" />
                  </div>
                  <div className="rounded-xl border bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Live Source</p>
                    <p className="mt-2 text-sm font-medium">
                      {primaryStation ? `${primaryStation.name} · ${primaryStation.provider}` : 'No primary station selected'}
                    </p>
                    {!primaryStation && liveWeatherCoordinates ? (
                      <p className="mt-1 text-xs text-muted-foreground">Fallback: {liveWeatherCoordinates.label}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {liveStatus === 'loading' && 'Fetching live station conditions now.'}
                      {liveStatus === 'ready' && 'Live station data is active for this weather area.'}
                      {liveStatus === 'error' && 'Live fetch failed, so the page is falling back to stored history or manual override.'}
                      {liveStatus === 'idle' && 'Use an online Open-Meteo station with coordinates for live data.'}
                    </p>
                  </div>

                  <div className="rounded-xl border bg-muted/20 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">Find Nearby Live Stations</p>
                        <p className="text-xs text-muted-foreground">Search by property address or use current location to find the best station options for rainfall monitoring.</p>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Input
                        value={stationSearchQuery}
                        onChange={(event) => setStationSearchQuery(event.target.value)}
                        placeholder={selectedProperty ? `${selectedProperty.address}, ${selectedProperty.city}` : 'Search by address'}
                      />
                      <Button
                        size="sm"
                        onClick={() => void searchStationsByAddress(stationSearchQuery || selectedLocation.address || `${selectedProperty?.address ?? ''} ${selectedProperty?.city ?? ''}`)}
                      >
                        Search
                      </Button>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => void searchStationsByCurrentLocation()}>
                        <Crosshair className="h-3.5 w-3.5" /> Use Current Location
                      </Button>
                      {selectedProperty?.address ? (
                        <Button size="sm" variant="outline" onClick={() => void searchStationsByAddress(`${selectedProperty.address}, ${selectedProperty.city}, ${selectedProperty.state}`)}>
                          Search Property Address
                        </Button>
                      ) : null}
                    </div>
                    {discoveryAnchor ? (
                      <div className="mt-3 rounded-xl border bg-background/70 p-3 text-xs text-muted-foreground">
                        Anchor: {discoveryAnchor.label}
                      </div>
                    ) : null}
                    {stationSearchStatus === 'loading' ? <p className="mt-3 text-sm text-muted-foreground">Searching live station candidates…</p> : null}
                    {stationSuggestions.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {stationSuggestions.map((suggestion, index) => (
                          <div key={suggestion.id} className="rounded-xl border bg-background/80 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <div className="text-sm font-medium">{suggestion.name}</div>
                                  <Badge variant="outline">{suggestion.provider}</Badge>
                                  {index === 0 ? <Badge>Best fit</Badge> : null}
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {suggestion.provider} · {suggestion.reason}
                                  {typeof suggestion.distanceMiles === 'number' ? ` · ${suggestion.distanceMiles} mi` : ''}
                                </div>
                              </div>
                              <Button size="sm" variant="outline" onClick={() => addSuggestedStation(suggestion)}>
                                Add Station
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Station Manager</p>
                      <p className="text-xs text-muted-foreground">Add stations, set provider coordinates, and mark one as the live primary feed.</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="gap-1" onClick={addStation}>
                        <Plus className="h-3.5 w-3.5" /> Add Station
                      </Button>
                      <Button size="sm" className="gap-1" onClick={saveStations}>
                        <Save className="h-3.5 w-3.5" /> Save Stations
                      </Button>
                    </div>
                  </div>

                  {!showStationManagement ? (
                    <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                      Station management is hidden in focused mode.
                      <div className="mt-2">
                        <Button size="sm" variant="outline" onClick={() => setShowStationManagement(true)}>
                          Show Station Manager
                        </Button>
                      </div>
                    </div>
                  ) : locationStations.length === 0 ? (
                    <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                      No stations are configured for this area yet.
                    </div>
                  ) : (
                    locationStations.map((station) => (
                      <div key={station.id} className="rounded-xl border bg-background/70 p-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            {station.isPrimary && <Badge>Live Primary</Badge>}
                            <Badge variant={station.status === 'online' ? 'secondary' : 'outline'}>{station.status}</Badge>
                          </div>
                          <div className="flex gap-2">
                            {!station.isPrimary && (
                              <Button size="sm" variant="outline" onClick={() => setPrimaryStation(station.id)}>
                                Use For Live Data
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" onClick={() => removeStation(station.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Station Name</label>
                            <Input className="mt-1" value={station.name} onChange={(event) => updateStation(station.id, { name: event.target.value })} />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Provider Label</label>
                            <Input className="mt-1" value={station.provider} onChange={(event) => updateStation(station.id, { provider: event.target.value })} />
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Provider Type</label>
                            <select
                              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                              value={station.providerType ?? 'manual'}
                              onChange={(event) => updateStation(station.id, { providerType: event.target.value as WeatherStation['providerType'] })}
                            >
                              <option value="manual">manual</option>
                              <option value="open-meteo">open-meteo</option>
                              <option value="davis">davis</option>
                              <option value="noaa">noaa</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Station Code</label>
                            <Input className="mt-1" value={station.stationCode} onChange={(event) => updateStation(station.id, { stationCode: event.target.value })} />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Status</label>
                            <select
                              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                              value={station.status}
                              onChange={(event) => updateStation(station.id, { status: event.target.value as WeatherStation['status'] })}
                            >
                              <option value="online">online</option>
                              <option value="offline">offline</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Latitude</label>
                            <Input className="mt-1" type="number" step="0.0001" value={station.latitude ?? ''} onChange={(event) => updateStation(station.id, { latitude: event.target.value ? Number(event.target.value) : undefined })} />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Longitude</label>
                            <Input className="mt-1" type="number" step="0.0001" value={station.longitude ?? ''} onChange={(event) => updateStation(station.id, { longitude: event.target.value ? Number(event.target.value) : undefined })} />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Time Zone</label>
                            <Input className="mt-1" value={station.timeZone ?? ''} onChange={(event) => updateStation(station.id, { timeZone: event.target.value })} />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => void setDeviceLocationForStation(station.id)}
                            disabled={geoLoadingStationId === station.id}
                          >
                            <Crosshair className="h-3.5 w-3.5" />
                            {geoLoadingStationId === station.id ? 'Locating…' : 'Use Current Device Location'}
                          </Button>
                          {station.providerType === 'open-meteo' && station.latitude && station.longitude && (
                            <span className="self-center text-[11px] text-muted-foreground">
                              Live weather uses {station.latitude}, {station.longitude}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
        </TabsContent>
      </Tabs>

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

