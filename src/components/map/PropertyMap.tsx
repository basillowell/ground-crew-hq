'use client';

import { useMemo } from 'react';
import { MapContainer, Polygon, TileLayer, Tooltip } from 'react-leaflet';
import type { PathOptions } from 'leaflet';
import { FitBounds } from '@/components/map/FitBounds';
import { GeomanControl } from '@/components/map/GeomanControl';
import type { PropertyBoundary, PropertyBoundaryGeoJson } from '@/lib/supabase-queries';

type LatLngTuple = [number, number];

type PropertyMapProps = {
  properties: PropertyBoundary[];
  currentPropertyId: string;
  editMode: boolean;
  canEditBoundary: boolean;
  onBoundaryChange: (geojson: PropertyBoundaryGeoJson | null) => void;
  onSelectProperty: (propertyId: string) => void;
};

const USGS_IMAGERY_TILE_URL =
  'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}';

type GeomanPathOptions = PathOptions & { pmIgnore: boolean };

function propertyToPolygonPositions(property: PropertyBoundary): LatLngTuple[][] {
  return (property.boundaryGeojson?.coordinates ?? []).map((ring) =>
    ring
      .filter((point) => point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]))
      .map(([longitude, latitude]) => [latitude, longitude] as LatLngTuple),
  );
}

function getInitialCenter(properties: PropertyBoundary[]): LatLngTuple {
  const propertyPoint = properties.find(
    (property) => typeof property.latitude === 'number' && typeof property.longitude === 'number',
  );
  if (propertyPoint?.latitude && propertyPoint.longitude) {
    return [propertyPoint.latitude, propertyPoint.longitude];
  }
  return [27.3364, -82.5307];
}

export function PropertyMap({
  properties,
  currentPropertyId,
  editMode,
  canEditBoundary,
  onBoundaryChange,
  onSelectProperty,
}: PropertyMapProps) {
  const mappedProperties = properties.filter((property) => property.boundaryGeojson);
  const selectedProperty = currentPropertyId === 'all'
    ? null
    : properties.find((property) => property.id === currentPropertyId) ?? null;
  const initialCenter = getInitialCenter(properties);
  const canEditSelectedBoundary = editMode && canEditBoundary && currentPropertyId !== 'all' && Boolean(selectedProperty);

  const polygonOptionsById = useMemo(() => {
    const options = new Map<string, GeomanPathOptions>();
    mappedProperties.forEach((property) => {
      const isSelected = currentPropertyId !== 'all' && currentPropertyId === property.id;
      options.set(property.id, {
        color: isSelected ? '#ffffff' : property.color,
        fillColor: property.color,
        fillOpacity: isSelected ? 0.46 : 0.28,
        opacity: 0.95,
        pmIgnore: canEditSelectedBoundary ? !isSelected : true,
        weight: isSelected ? 4 : 2,
      });
    });
    return options;
  }, [canEditSelectedBoundary, currentPropertyId, mappedProperties]);

  return (
    <div className="relative h-[min(68vh,720px)] min-h-[520px] overflow-hidden rounded-xl border border-surface-border bg-surface-card shadow-md">
      <MapContainer
        center={initialCenter}
        zoom={13}
        maxZoom={19}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          attribution="USGS The National Map"
          maxZoom={19}
          url={USGS_IMAGERY_TILE_URL}
        />
        <FitBounds properties={mappedProperties} selectedPropertyId={currentPropertyId} />
        {canEditSelectedBoundary ? <GeomanControl onBoundaryChange={onBoundaryChange} /> : null}
        {mappedProperties.map((property) => (
          <Polygon
            key={`${property.id}-${currentPropertyId}-${canEditSelectedBoundary ? 'edit' : 'view'}`}
            positions={propertyToPolygonPositions(property)}
            pathOptions={polygonOptionsById.get(property.id)}
            eventHandlers={{
              click: () => onSelectProperty(property.id),
            }}
          >
            <Tooltip sticky>
              <div className="space-y-1">
                <div className="font-semibold">{property.name}</div>
                <div>{property.calculatedAcreage?.toFixed(1) ?? property.acreage.toFixed(1)} acres</div>
              </div>
            </Tooltip>
          </Polygon>
        ))}
      </MapContainer>
      {mappedProperties.length === 0 ? (
        <div className="absolute inset-0 z-[500] flex items-center justify-center bg-surface-base/70 p-6 text-center backdrop-blur-sm">
          <div className="max-w-sm rounded-xl border border-surface-border bg-surface-card p-5 shadow-lg">
            <div className="text-sm font-semibold text-text-primary">No property boundaries yet</div>
            <p className="mt-2 text-sm text-text-secondary">
              Drawn boundaries will appear here once they are saved to each property.
            </p>
          </div>
        </div>
      ) : null}
      {editMode && currentPropertyId === 'all' ? (
        <div className="absolute left-4 top-4 z-[500] rounded-lg border border-surface-border bg-surface-card px-3 py-2 text-sm text-text-secondary shadow-md">
          Select one property before drawing a boundary.
        </div>
      ) : null}
    </div>
  );
}