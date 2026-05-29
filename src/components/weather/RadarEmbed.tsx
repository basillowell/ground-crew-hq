import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { fetchRainViewerFrames, getRadarTileUrl, type RainViewerFrame } from "@/lib/weather/providers";

function RadarCenter({ latitude, longitude }: { latitude: number; longitude: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([latitude, longitude]);
  }, [latitude, longitude, map]);
  return null;
}

export function RadarEmbed({ latitude, longitude }: { latitude: number; longitude: number }) {
  const [frames, setFrames] = useState<RainViewerFrame[]>([]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    void fetchRainViewerFrames()
      .then((result) => {
        if (!isMounted) return;
        setFrames(result);
        setFrameIndex(Math.max(0, result.length - 1));
      })
      .catch(() => {
        if (!isMounted) return;
        setError("Radar temporarily unavailable.");
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (frames.length <= 1) return;
    const timer = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % frames.length);
    }, 900);
    return () => window.clearInterval(timer);
  }, [frames]);

  const activeFrame = useMemo(() => {
    if (!frames.length) return null;
    return frames[Math.max(0, Math.min(frameIndex, frames.length - 1))];
  }, [frameIndex, frames]);

  if (loading) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading radar…</div>;
  }
  if (error || !activeFrame) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Radar temporarily unavailable.</div>;
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border">
      <MapContainer center={[latitude, longitude]} zoom={8} className="h-full w-full" zoomControl>
        <RadarCenter latitude={latitude} longitude={longitude} />
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <TileLayer
          attribution="RainViewer"
          url={getRadarTileUrl(activeFrame)}
          opacity={0.65}
        />
      </MapContainer>
    </div>
  );
}
