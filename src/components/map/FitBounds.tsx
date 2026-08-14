'use client';

import { useEffect, useMemo } from 'react';
import { useMap } from 'react-leaflet';
import type { LatLngBoundsExpression } from 'leaflet';
import type { PropertyBoundary } from '@/lib/supabase-queries';

type LatLngTuple = [number, number];

type FitBoundsProps = {
  properties: PropertyBoundary[];
  selectedPropertyId: string;
  disabled?: boolean;
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

function getFitSignature(properties: PropertyBoundary[], selectedPropertyId: string) {
  const fitProperties = selectedPropertyId === 'all'
    ? properties
    : properties.filter((property) => property.id === selectedPropertyId);

  return JSON.stringify(
    fitProperties.map((property) => ({
      id: property.id,
      boundary: property.boundaryGeojson?.coordinates ?? null,
    })),
  );
}

export function FitBounds({ properties, selectedPropertyId, disabled = false }: FitBoundsProps) {
  const map = useMap();
  const fitSignature = useMemo(() => getFitSignature(properties, selectedPropertyId), [properties, selectedPropertyId]);

  useEffect(() => {
    const isSingleProperty = selectedPropertyId !== 'all';
    const visibleProperties = isSingleProperty
      ? properties.filter((property) => property.id === selectedPropertyId)
      : properties;
    const bounds = getPropertyBounds(visibleProperties);

    // Always release any prior lock first, so fitBounds and edit-mode panning
    // are never fighting a stale maxBounds/minZoom from a previous selection.
    map.setMinZoom(0);
    map.setMaxBounds(null as unknown as LatLngBoundsExpression);

    // While drawing/placing, leave the map completely free to pan and zoom.
    if (disabled) return;
    if (!bounds) return;

    map.fitBounds(bounds, { animate: false, maxZoom: 18, padding: [32, 32] });

    // Hard-freeze: on a single selected property, keep it framed and centered.
    // maxBounds stops panning away; minZoom = the fitted zoom stops zooming out
    // past the whole property. Zooming *in* to inspect a spot stays allowed.
    if (isSingleProperty) {
      map.setMaxBounds(map.getBounds().pad(0.12));
      map.setMinZoom(map.getZoom());
    }
  }, [disabled, map, properties, selectedPropertyId, fitSignature]);

  return null;
}
