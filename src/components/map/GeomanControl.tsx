'use client';

import { useEffect } from 'react';
import L, { Control, type ControlPosition, type Layer, type LeafletEventHandlerFnMap } from 'leaflet';
import { createControlComponent } from '@react-leaflet/core';
import { useMap } from 'react-leaflet';
import '@geoman-io/leaflet-geoman-free';
import type { PropertyBoundaryGeoJson } from '@/lib/supabase-queries';

type GeomanControlOptions = {
  position: ControlPosition;
  drawMarker: boolean;
  drawCircleMarker: boolean;
  drawPolyline: boolean;
  drawRectangle: boolean;
  drawCircle: boolean;
  drawText: boolean;
  drawPolygon: boolean;
  editMode: boolean;
  dragMode: boolean;
  removalMode: boolean;
  cutPolygon: boolean;
  rotateMode: boolean;
};

type GeomanMap = L.Map & {
  pm?: {
    addControls: (options: GeomanControlOptions) => void;
    removeControls: () => void;
    setGlobalOptions?: (options: Record<string, unknown>) => void;
  };
};

type BoundaryChangeHandler = (geojson: PropertyBoundaryGeoJson | null) => void;

type GeomanControlProps = {
  onBoundaryChange: BoundaryChangeHandler;
  position?: ControlPosition;
};

type GeoJsonLayer = Layer & {
  toGeoJSON?: () => { type?: string; geometry?: unknown; coordinates?: unknown };
  remove?: () => void;
};

type GeomanLayerEvent = L.LeafletEvent & {
  layer?: GeoJsonLayer;
};

function isPropertyBoundaryGeoJson(value: unknown): value is PropertyBoundaryGeoJson {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { type?: unknown; coordinates?: unknown };
  if (candidate.type !== 'Polygon' || !Array.isArray(candidate.coordinates)) return false;
  return candidate.coordinates.every((ring) =>
    Array.isArray(ring) &&
    ring.every((point) =>
      Array.isArray(point) &&
      point.length >= 2 &&
      typeof point[0] === 'number' &&
      typeof point[1] === 'number',
    ),
  );
}

export function layerToBoundaryGeoJson(layer?: GeoJsonLayer): PropertyBoundaryGeoJson | null {
  const layerGeoJson = layer?.toGeoJSON?.();
  const geometry = layerGeoJson && 'geometry' in layerGeoJson ? layerGeoJson.geometry : layerGeoJson;
  return isPropertyBoundaryGeoJson(geometry) ? geometry : null;
}

const LeafletGeomanControl = createControlComponent<Control, Pick<GeomanControlProps, 'position'>>(
  ({ position = 'topleft' }) => {
    const control = new Control({ position });

    control.onAdd = (map) => {
      const geomanMap = map as GeomanMap;
      geomanMap.pm?.addControls({
        position,
        drawMarker: false,
        drawCircleMarker: false,
        drawPolyline: false,
        drawRectangle: false,
        drawCircle: false,
        drawText: false,
        drawPolygon: true,
        editMode: true,
        dragMode: true,
        removalMode: true,
        cutPolygon: false,
        rotateMode: false,
      });
      geomanMap.pm?.setGlobalOptions?.({ snappable: true });
      return L.DomUtil.create('div', 'gchq-geoman-control-anchor');
    };

    control.onRemove = (map) => {
      (map as GeomanMap).pm?.removeControls();
    };

    return control;
  },
);

export function GeomanControl({ onBoundaryChange, position = 'topleft' }: GeomanControlProps) {
  const map = useMap();

  useEffect(() => {
    const eventHandlers: LeafletEventHandlerFnMap = {
      'pm:create': (event) => {
        const layerEvent = event as GeomanLayerEvent;
        const geometry = layerToBoundaryGeoJson(layerEvent.layer);
        if (geometry) onBoundaryChange(geometry);
        layerEvent.layer?.remove?.();
      },
      'pm:update': (event) => {
        const geometry = layerToBoundaryGeoJson((event as GeomanLayerEvent).layer);
        if (geometry) onBoundaryChange(geometry);
      },
      'pm:remove': () => {
        onBoundaryChange(null);
      },
    };

    map.on(eventHandlers);
    return () => {
      map.off(eventHandlers);
    };
  }, [map, onBoundaryChange]);

  return <LeafletGeomanControl position={position} />;
}