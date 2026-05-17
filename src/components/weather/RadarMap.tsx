import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import { Button } from '@/components/ui/button';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

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
};

function formatFrameTime(unixSeconds?: number) {
  if (!unixSeconds) return '—';
  return new Date(unixSeconds * 1000).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function RadarMap({ latitude, longitude, propertyName, height = '400px' }: RadarMapProps) {
  const [frames, setFrames] = useState<RainViewerFrame[]>([]);
  const [activeFrame, setActiveFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <div className="overflow-hidden rounded-xl border">
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
          {radarTileUrl ? <TileLayer url={radarTileUrl} opacity={0.6} /> : null}
          <Marker position={[latitude, longitude]}>
            <Popup>{propertyName}</Popup>
          </Marker>
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
