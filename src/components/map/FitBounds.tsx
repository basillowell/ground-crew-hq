'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import type { PropertyBoundary } from '@/lib/supabase-queries';

type LatLngTuple = [number, number];

type FitBoundsProps = {
  properties: PropertyBoundary[];
  selectedPropertyId: string;
};

function coordinatesToLatLngs(property: PropertyBoundary): LatLngTuple[] {
  const rings = property.boundaryGeojson?.coordinates ?? [];
  const boundaryPoints = rings.flatMap((ring) =>
    ring
      .filter((point) => point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]))
      .map(([longitude, latitude]) => [latitude, longitude] as LatLngTuple),
  );
  const projectPoints = property.projects
    .map((project) => project.locationGeojson?.coordinates)
    .filter((point): point is [number, number] =>
      Boolean(point) &&
      Number.isFinite(point[0]) &&
      Number.isFinite(point[1]),
    )
    .map(([longitude, latitude]) => [latitude, longitude] as LatLngTuple);

  return [...boundaryPoints, ...projectPoints];
}

export function getPropertyBounds(properties: PropertyBoundary[]): [LatLngTuple, LatLngTuple] | null {
  const points = properties.flatMap(coordinatesToLatLngs);
  if (points.length === 0) return null;

  let minLat = points[0][0];
  let maxLat = points[0][0];
  let minLng = points[0][1];
  let maxLng = points[0][1];

  points.forEach(([latitude, longitude]) => {
    minLat = Math.min(minLat, latitude);
    maxLat = Math.max(maxLat, latitude);
    minLng = Math.min(minLng, longitude);
    maxLng = Math.max(maxLng, longitude);
  });

  return [[minLat, minLng], [maxLat, maxLng]];
}

export function FitBounds({ properties, selectedPropertyId }: FitBoundsProps) {
  const map = useMap();

  useEffect(() => {
    const visibleProperties = selectedPropertyId === 'all'
      ? properties
      : properties.filter((property) => property.id === selectedPropertyId);
    const bounds = getPropertyBounds(visibleProperties);
    if (!bounds) return;
    map.fitBounds(bounds, { animate: false, maxZoom: 18, padding: [32, 32] });
  }, [map, properties, selectedPropertyId]);

  return null;
}
