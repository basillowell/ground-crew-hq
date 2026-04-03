import { useEffect, useMemo, useState } from 'react';
import { AreaChart, Area, BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CloudSun, Crosshair, Droplets, MapPin, PencilLine, Plus, Radar, RefreshCcw, Save, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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
import {
  loadCurrentPropertyId,
  loadManualRainfallEntries,
  loadProperties,
  loadProgramSettings,
  loadWeatherDailyLogs,
  loadWeatherLocations,
  loadWeatherStations,
  loadWorkLocations,
  saveManualRainfallEntries,
  saveWeatherDailyLogs,
  saveWeatherLocations,
  saveWeatherStations,
} from '@/lib/dataStore';
import { toast } from '@/components/ui/sonner';
import { fetchPrimaryStationSnapshot, fetchWeatherStationSuggestions, type GeocodeResult } from '@/lib/weatherProviders';

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
  et: '0.18',
};

function makeId(prefix: string) {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function WeatherPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [currentPropertyId, setCurrentPropertyId] = useState('');
  const [weatherLocations, setWeatherLocations] = useState<WeatherLocation[]>([]);
  const [weatherStations, setWeatherStations] = useState<WeatherStation[]>([]);
  const [workLocations, setWorkLocations] = useState<WorkLocation[]>([]);
  const [programSetting, setProgramSetting] = useState<ProgramSettings | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [selectedWorkLocationId, setSelectedWorkLocationId] = useState('');
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

  useEffect(() => {
    const locations = loadWeatherLocations();
    const stations = loadWeatherStations();
    const opsLocations = loadWorkLocations();
    const propertyList = loadProperties();
    const activePropertyId = loadCurrentPropertyId();
    setProperties(propertyList);
    setCurrentPropertyId(activePropertyId);
    setWeatherLocations(locations);
    setWeatherStations(stations);
    setWorkLocations(opsLocations);
    setProgramSetting(loadProgramSettings()[0] ?? null);
    setSelectedLocationId((current) => current || locations[0]?.id || '');
    setSelectedWorkLocationId(opsLocations[0]?.id ?? '');
    setWeatherLogs(loadWeatherDailyLogs());
    setRainEntries(loadManualRainfallEntries());
  }, []);

  const selectedLocation = weatherLocations.find((location) => location.id === selectedLocationId) ?? weatherLocations[0];
  const selectedProperty = properties.find((property) => property.id === (selectedLocation?.propertyId || currentPropertyId));
  const locationStations = weatherStations
    .filter((station) => station.locationId === selectedLocationId)
    .sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary));
  const primaryStation = locationStations.find((station) => station.isPrimary);
  const locationLogs = weatherLogs
    .filter((log) => log.locationId === selectedLocationId)
    .sort((left, right) => left.date.localeCompare(right.date));
  const latestStoredLog = [...locationLogs].sort((left, right) => right.date.localeCompare(left.date))[0];
  const latestLog = liveLog ?? latestStoredLog;
  const locationRain = rainEntries
    .filter((entry) => entry.locationId === selectedLocationId)
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

  useEffect(() => {
    let cancelled = false;

    async function hydrateLiveWeather() {
      if (!selectedLocation || !primaryStation || primaryStation.status !== 'online') {
        setLiveLog(null);
        setLiveStatus('idle');
        return;
      }

      if (primaryStation.providerType === 'manual' || primaryStation.providerType === 'davis') {
        setLiveLog(null);
        setLiveStatus('idle');
        return;
      }

      setLiveStatus('loading');
      try {
        const snapshot = await fetchPrimaryStationSnapshot(selectedLocation.id, primaryStation);
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
  }, [primaryStation, refreshTick, selectedLocation]);

  function openDialog(mode: EntryMode) {
    setDialogMode(mode);
    setDraft({ ...emptyEntry, locationId: selectedLocationId, date: todayIsoDate() });
    setDialogOpen(true);
  }

  function refreshLiveWeather() {
    setRefreshTick((current) => current + 1);
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

  async function useCurrentLocationForStation(stationId: string) {
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

  function persistWeatherSetup(nextLocations: WeatherLocation[], nextStations: WeatherStation[]) {
    setWeatherLocations(nextLocations);
    setWeatherStations(nextStations);
    saveWeatherLocations(nextLocations);
    saveWeatherStations(nextStations);
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

  function saveSelectedLocation() {
    saveWeatherLocations(weatherLocations);
    toast('Weather area saved', { description: 'Area naming and property details have been updated.' });
  }

  function addStation() {
    if (!selectedLocation) return;

    const nextStation: WeatherStation = {
      id: makeId('ws'),
      locationId: selectedLocation.id,
      name: `${selectedLocation.name} Station`,
      provider: 'Open-Meteo',
      providerType: 'open-meteo',
      stationCode: `${selectedLocation.id.toUpperCase()}-${locationStations.length + 1}`,
      latitude: 35.78,
      longitude: -78.64,
      timeZone: 'America/New_York',
      isPrimary: locationStations.length === 0,
      status: 'online',
    };

    const nextStations = [...weatherStations, nextStation];
    persistWeatherSetup(weatherLocations, nextStations);
    toast('Station added', { description: 'Set the coordinates and provider, then save stations.' });
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

  function saveStations() {
    saveWeatherStations(weatherStations);
    toast('Stations saved', { description: 'Provider configuration and live-station selection are stored.' });
  }

  function saveEntry() {
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
      saveManualRainfallEntries(next);
    } else {
      const nextLog: WeatherDailyLog = {
        id: `wd-${Date.now()}`,
        locationId: draft.locationId,
        date: draft.date,
        currentConditions: draft.currentConditions,
        forecast: draft.forecast,
        rainfallTotal: Number(draft.rainfallAmount),
        temperature: Number(draft.temperature),
        humidity: Number(draft.humidity),
        wind: Number(draft.wind),
        et: Number(draft.et),
        source: 'manual-override',
        notes: draft.notes,
      };
      const next = [nextLog, ...weatherLogs];
      setWeatherLogs(next);
      saveWeatherDailyLogs(next);
    }
    setDialogOpen(false);
  }

  const summaryCards = useMemo(() => ([
    { label: 'Locations', value: weatherLocations.length, icon: MapPin },
    { label: 'Stations Online', value: `${stationsOnline}/${locationStations.length || 0}`, icon: Radar },
    { label: 'Rainfall Entries', value: locationRain.length, icon: Droplets },
    { label: 'Manual Overrides', value: manualOverrideCount, icon: PencilLine },
  ]), [locationRain.length, locationStations.length, manualOverrideCount, stationsOnline]);

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      <PageHeader
        title="Weather"
        subtitle={selectedProperty ? `Real-time station discovery and rainfall tracking for ${selectedProperty.name}.` : 'Station-based and manual weather tracking by property, area, and date.'}
        badge={<Badge variant="secondary">{weatherLocations.length} locations</Badge>}
        action={{ label: 'Manual Rainfall', onClick: () => openDialog('rainfall') }}
      >
        <Button variant="outline" size="sm" className="gap-1" onClick={() => openDialog('override')}>
          <CloudSun className="h-3.5 w-3.5" /> Manual Override
        </Button>
      </PageHeader>

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
                        Use this property’s address and current location to find the nearest live stations and improve rainfall accuracy for agronomic decisions.
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

                  {locationStations.length === 0 ? (
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
                            onClick={() => void useCurrentLocationForStation(station.id)}
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

          {selectedLocation && <WeatherSnapshotCard location={selectedLocation} log={latestLog} />}

          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Weather History</p>
                  <p className="text-xs text-muted-foreground">Rainfall, temperature, and ET by date</p>
                </div>
                <Badge variant="outline">{selectedLocation?.name}</Badge>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={historyData}>
                  <defs>
                    <linearGradient id="rain" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--info))" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="hsl(var(--info))" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="rainfall" stroke="hsl(var(--info))" fill="url(#rain)" />
                  <Area type="monotone" dataKey="et" stroke="hsl(var(--warning))" fillOpacity={0} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-5">
              <div className="mb-4">
                <p className="text-sm font-semibold">Temperature Trend</p>
                <p className="text-xs text-muted-foreground">Daily temperature by weather location</p>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={historyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="temperature" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <Card className="p-5">
              <div className="mb-4">
                <p className="text-sm font-semibold">Stations By Location</p>
                <p className="text-xs text-muted-foreground">Primary station selection, status, and provider</p>
              </div>
              <div className="space-y-3">
                {locationStations.map((station) => (
                  <div key={station.id} className="rounded-xl border bg-background/70 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{station.name}</p>
                        <p className="text-xs text-muted-foreground">{station.provider} · {station.stationCode}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {station.isPrimary && <Badge>Primary</Badge>}
                        <Badge variant={station.status === 'online' ? 'secondary' : 'outline'}>{station.status}</Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <div className="mb-4">
                <p className="text-sm font-semibold">Manual Rainfall Entries</p>
                <p className="text-xs text-muted-foreground">Daily rainfall entries when you need a manual record</p>
              </div>
              <div className="space-y-3">
                {locationRain.length === 0 ? (
                  <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                    No manual rainfall entries yet.
                  </div>
                ) : (
                  locationRain.map((entry) => (
                    <div key={entry.id} className="rounded-xl border bg-background/70 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{entry.date}</p>
                          <p className="text-xs text-muted-foreground">{entry.enteredBy}</p>
                        </div>
                        <Badge variant="outline">{entry.rainfallAmount.toFixed(2)} in</Badge>
                      </div>
                      {entry.notes && <p className="mt-2 text-xs text-muted-foreground">{entry.notes}</p>}
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

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
                <div className="grid gap-4 sm:grid-cols-4">
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
