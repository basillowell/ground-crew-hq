import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { Button } from '@/components/ui/button';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

if (typeof window !== 'undefined') {
  void import('leaflet/dist/leaflet.css');
}

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

type RainViewerFrame = {
  path: string;
  time: number;
};

type RadarMapProps = {
  latitude: number;
  longitude: number;
  propertyName: string;
  height?: string;
  lightningActive?: boolean;
  currentTempF?: number | null;
  windMph?: number | null;
  humidityPct?: number | null;
  conditionLabel?: string;
  feelsLikeF?: number | null;
  hasActiveAlerts?: boolean;
};

function formatFrameTime(unixSeconds?: number) {
  if (!unixSeconds) return '—';
  return new Date(unixSeconds * 1000).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function RadarMap({
  latitude,
  longitude,
  propertyName,
  height = '400px',
  lightningActive = false,
  currentTempF = null,
  windMph = null,
  humidityPct = null,
  conditionLabel = 'Unknown',
  feelsLikeF = null,
  hasActiveAlerts = false,
}: RadarMapProps) {
  const [frames, setFrames] = useState<RainViewerFrame[]>([]);
  const [activeFrame, setActiveFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [radarVisible, setRadarVisible] = useState(true);
  const [lightningVisible, setLightningVisible] = useState(false);
  const [windVisible, setWindVisible] = useState(false);
  const [tempVisible, setTempVisible] = useState(false);
  const [alertsVisible, setAlertsVisible] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadFrames = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');
        if (!response.ok) throw new Error(`Radar unavailable (${response.status})`);
        const payload = (await response.json()) as { radar?: { past?: RainViewerFrame[] } };
        const past = payload.radar?.past ?? [];
        if (!mounted) return;
        setFrames(past);
        setActiveFrame(Math.max(0, past.length - 1));
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Radar unavailable');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadFrames();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!playing || frames.length <= 1) return;
    const id = window.setInterval(() => {
      setActiveFrame((current) => (current + 1) % frames.length);
    }, 500);
    return () => window.clearInterval(id);
  }, [frames.length, playing]);

  const activeFrameData = frames[activeFrame];
  const radarTileUrl = useMemo(() => {
    if (!activeFrameData?.path) return '';
    return `https://tilecache.rainviewer.com${activeFrameData.path}/256/{z}/{x}/{y}/2/1_1.png`;
  }, [activeFrameData?.path]);

  const canAnimate = frames.length > 1 && !loading && !error;
  const latestFrame = frames.length > 0 ? frames[frames.length - 1] : null;

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl border border-slate-700">
        <div className="absolute right-3 top-3 z-[500] flex flex-wrap gap-2">
          <Button size="sm" variant={radarVisible ? 'default' : 'outline'} className="h-8 text-xs" onClick={() => setRadarVisible((current) => !current)}>Radar</Button>
          <Button size="sm" variant={lightningVisible ? 'default' : 'outline'} className="h-8 text-xs" onClick={() => setLightningVisible((current) => !current)}>Lightning</Button>
          <Button size="sm" variant={windVisible ? 'default' : 'outline'} className="h-8 text-xs" onClick={() => setWindVisible((current) => !current)}>Wind</Button>
          <Button size="sm" variant={tempVisible ? 'default' : 'outline'} className="h-8 text-xs" onClick={() => setTempVisible((current) => !current)}>Temp</Button>
          <Button size="sm" variant={alertsVisible ? 'default' : 'outline'} className="h-8 text-xs" onClick={() => setAlertsVisible((current) => !current)}>Alerts</Button>
        </div>

        <div className="absolute bottom-3 left-3 z-[500] rounded-lg bg-black/60 px-3 py-2 text-xs text-white backdrop-blur">
          <div className="font-semibold">
            {currentTempF !== null ? `${currentTempF}°F` : '--'} · {conditionLabel} · Wind {windMph !== null ? `${Math.round(windMph)} mph` : '--'} · {humidityPct !== null ? `${Math.round(humidityPct)}%` : '--'} humidity
          </div>
          <div className="mt-1">Feels like {feelsLikeF !== null ? `${Math.round(feelsLikeF)}°F` : '--'}</div>
        </div>

        {alertsVisible && hasActiveAlerts ? (
          <div className="absolute left-3 top-3 z-[500] rounded-full bg-red-600 px-2 py-1 text-[10px] font-semibold text-white">
            Active Alert
          </div>
        ) : null}

        {windVisible ? (
          <div className="absolute right-3 bottom-16 z-[500] rounded-md bg-slate-900/80 px-2 py-1 text-[10px] text-white">
            Wind: {windMph !== null ? `${Math.round(windMph)} mph` : '--'}
          </div>
        ) : null}
        {tempVisible ? (
          <div className="absolute right-3 bottom-8 z-[500] rounded-md bg-slate-900/80 px-2 py-1 text-[10px] text-white">
            Temp: {currentTempF !== null ? `${Math.round(currentTempF)}°F` : '--'}
          </div>
        ) : null}

        <MapContainer
          center={[latitude, longitude]}
          zoom={8}
          style={{ height, width: '100%' }}
          zoomControl
          scrollWheelZoom
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution="&copy; CARTO"
          />
          {radarVisible && radarTileUrl ? <TileLayer url={radarTileUrl} opacity={0.6} /> : null}
          <Marker position={[latitude, longitude]}>
            <Popup>{propertyName}</Popup>
          </Marker>
          {lightningVisible && lightningActive ? (
            <>
              <CircleMarker
                center={[latitude, longitude]}
                radius={14}
                pathOptions={{ color: '#facc15', fillColor: '#facc15', fillOpacity: 0.25, weight: 2 }}
              />
              <CircleMarker
                center={[latitude, longitude]}
                radius={8}
                pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.7, weight: 2 }}
              >
                <Tooltip direction="top" offset={[0, -4]} permanent>
                  ⚡ Active thunderstorm
                </Tooltip>
              </CircleMarker>
            </>
          ) : null}
        </MapContainer>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          variant="outline"
          className="h-9"
          onClick={() => setPlaying((current) => !current)}
          disabled={!canAnimate}
        >
          {playing ? 'Pause' : 'Play'}
        </Button>
        <span className="text-xs text-muted-foreground">
          Radar: {formatFrameTime(activeFrameData?.time)}
        </span>
        {loading ? <span className="text-xs text-muted-foreground">Loading radar frames…</span> : null}
        {error ? <span className="text-xs text-destructive">Radar unavailable</span> : null}
      </div>

      <input
        type="range"
        min={0}
        max={Math.max(0, frames.length - 1)}
        step={1}
        value={activeFrame}
        onChange={(event) => {
          setPlaying(false);
          setActiveFrame(Number(event.target.value));
        }}
        disabled={!canAnimate}
        className="w-full accent-primary"
      />
      <p className="text-xs text-muted-foreground">
        Last updated: {formatFrameTime(latestFrame?.time)} · Source: RainViewer
      </p>
    </div>
  );
}
