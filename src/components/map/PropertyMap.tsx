'use client';

import { MapContainer, Polygon, TileLayer, Tooltip } from 'react-leaflet';
import { FitBounds } from '@/components/map/FitBounds';
import type { PropertyBoundary } from '@/lib/supabase-queries';

type LatLngTuple = [number, number];

type PropertyMapProps = {
  properties: PropertyBoundary[];
  currentPropertyId: string;
  onSelectProperty: (propertyId: string) => void;
};

const USGS_IMAGERY_TILE_URL =
  'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}';

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

export function PropertyMap({ properties, currentPropertyId, onSelectProperty }: PropertyMapProps) {
  const mappedProperties = properties.filter((property) => property.boundaryGeojson);
  const initialCenter = getInitialCenter(properties);

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
        {mappedProperties.map((property) => {
          const isSelected = currentPropertyId !== 'all' && currentPropertyId === property.id;
          return (
            <Polygon
              key={property.id}
              positions={propertyToPolygonPositions(property)}
              pathOptions={{
                color: isSelected ? '#ffffff' : property.color,
                fillColor: property.color,
                fillOpacity: isSelected ? 0.46 : 0.28,
                opacity: 0.95,
                weight: isSelected ? 4 : 2,
              }}
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
          );
        })}
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
    </div>
  );
}