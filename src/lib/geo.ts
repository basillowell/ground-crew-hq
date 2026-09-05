import type { PropertyBoundaryGeoJson } from '@/lib/supabase-queries';

// Client-side geodesic polygon area, so a drawn project zone can show its own
// size without a PostGIS round-trip. Same formula as Leaflet.draw's
// L.GeometryUtil.geodesicArea. Ring coordinates are [lng, lat].
const EARTH_RADIUS_M = 6378137;
const SQ_METERS_PER_ACRE = 4046.8564224;
const SQ_FEET_PER_ACRE = 43560;

export function geojsonPolygonAcres(geojson: PropertyBoundaryGeoJson | null | undefined): number | null {
  const rings = geojson?.coordinates;
  if (!rings || rings.length === 0) return null;
  const ring = (rings[0] ?? []).filter(
    (point) => point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]),
  );
  if (ring.length < 3) return null;

  const d2r = Math.PI / 180;
  let area = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const [lng1, lat1] = ring[i];
    const [lng2, lat2] = ring[(i + 1) % ring.length];
    area += (lng2 - lng1) * d2r * (2 + Math.sin(lat1 * d2r) + Math.sin(lat2 * d2r));
  }
  area = Math.abs((area * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
  return area / SQ_METERS_PER_ACRE;
}

export function formatAcres(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)} ac` : '—';
}

export function acresToSquareFeet(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value * SQ_FEET_PER_ACRE : null;
}

export function formatSquareFeet(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value).toLocaleString()} sq ft` : '—';
}
