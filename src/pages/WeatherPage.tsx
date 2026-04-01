import { useEffect, useMemo, useState } from 'react';
import { AreaChart, Area, BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CloudSun, Droplets, MapPin, PencilLine, Radar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared';
import { WeatherSnapshotCard } from '@/components/weather/WeatherSnapshotCard';
import {
  weatherLocations,
  weatherStations,
  type ManualRainfallEntry,
  type WeatherDailyLog,
} from '@/data/seedData';
import {
  loadManualRainfallEntries,
  loadWeatherDailyLogs,
  saveManualRainfallEntries,
  saveWeatherDailyLogs,
} from '@/lib/dataStore';

type EntryMode = 'rainfall' | 'override';

const emptyEntry = {
  locationId: weatherLocations[0]?.id ?? '',
  date: '2024-03-26',
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

export default function WeatherPage() {
  const [selectedLocationId, setSelectedLocationId] = useState(weatherLocations[0]?.id ?? '');
  const [weatherLogs, setWeatherLogs] = useState<WeatherDailyLog[]>([]);
  const [rainEntries, setRainEntries] = useState<ManualRainfallEntry[]>([]);
  const [dialogMode, setDialogMode] = useState<EntryMode>('rainfall');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState(emptyEntry);

  useEffect(() => {
    setWeatherLogs(loadWeatherDailyLogs());
    setRainEntries(loadManualRainfallEntries());
  }, []);

  const selectedLocation = weatherLocations.find((location) => location.id === selectedLocationId) ?? weatherLocations[0];
  const locationStations = weatherStations.filter((station) => station.locationId === selectedLocationId);
  const locationLogs = weatherLogs
    .filter((log) => log.locationId === selectedLocationId)
    .sort((left, right) => left.date.localeCompare(right.date));
  const latestLog = [...locationLogs].sort((left, right) => right.date.localeCompare(left.date))[0];
  const locationRain = rainEntries
    .filter((entry) => entry.locationId === selectedLocationId)
    .sort((left, right) => right.date.localeCompare(left.date));

  const historyData = locationLogs.map((log) => ({
    date: log.date.slice(5),
    temperature: log.temperature,
    rainfall: log.rainfallTotal,
    et: log.et,
  }));

  const stationsOnline = locationStations.filter((station) => station.status === 'online').length;
  const manualOverrideCount = locationLogs.filter((log) => log.source === 'manual-override').length;

  function openDialog(mode: EntryMode) {
    setDialogMode(mode);
    setDraft({ ...emptyEntry, locationId: selectedLocationId });
    setDialogOpen(true);
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
        subtitle="Station-based and manual weather tracking by property, area, and date."
        badge={<Badge variant="secondary">{weatherLocations.length} locations</Badge>}
        action={{ label: 'Manual Rainfall', onClick: () => openDialog('rainfall') }}
      >
        <Button variant="outline" size="sm" className="gap-1" onClick={() => openDialog('override')}>
          <CloudSun className="h-3.5 w-3.5" /> Manual Override
        </Button>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-3">
          {weatherLocations.map((location) => {
            const primaryStation = weatherStations.find((station) => station.locationId === location.id && station.isPrimary);
            return (
              <Card
                key={location.id}
                className={`cursor-pointer p-4 transition-colors ${selectedLocationId === location.id ? 'border-primary/40 bg-accent/40' : 'hover:bg-muted/30'}`}
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
