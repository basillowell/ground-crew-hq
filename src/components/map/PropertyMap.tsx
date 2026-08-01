'use client';

import { useEffect, useMemo } from 'react';
import { CircleMarker, MapContainer, Polygon, Popup, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import type { Layer, PathOptions } from 'leaflet';
import { Button } from '@/components/ui/button';
import { FitBounds } from '@/components/map/FitBounds';
import { GeomanControl, layerToBoundaryGeoJson } from '@/components/map/GeomanControl';
import type { PropertyBoundary, PropertyBoundaryGeoJson, PropertyProject } from '@/lib/supabase-queries';
import { cn } from '@/lib/utils';

type LatLngTuple = [number, number];

type PropertyMapProps = {
  properties: PropertyBoundary[];
  currentPropertyId: string;
  className?: string;
  editMode: boolean;
  canEditBoundary: boolean;
  selectedProjectId: string | null;
  pinPlacementProject: { projectId: string; projectName: string } | null;
  pinPlacementDisabled: boolean;
  areaEditProjectId: string | null;
  onBoundaryChange: (geojson: PropertyBoundaryGeoJson | null) => void;
  onAreaChange: (geojson: PropertyBoundaryGeoJson | null) => void;
  onAreaCreate: (geojson: PropertyBoundaryGeoJson) => void | Promise<void>;
  onSelectProperty: (propertyId: string) => void;
  onSelectProject: (propertyId: string, projectId: string) => void;
  onPlaceProjectPin: (latitude: number, longitude: number) => void;
  onCancelPinPlacement: () => void;
};

const USGS_IMAGERY_TILE_URL =
  'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}';

type GeomanPathOptions = PathOptions & { pmIgnore: boolean };

type GeoJsonEditLayer = Layer & {
  toGeoJSON?: () => { type?: string; geometry?: unknown; coordinates?: unknown };
};

function propertyToPolygonPositions(property: PropertyBoundary): LatLngTuple[][] {
  return geoJsonToPolygonPositions(property.boundaryGeojson);
}

function geoJsonToPolygonPositions(geojson: PropertyBoundaryGeoJson | null | undefined): LatLngTuple[][] {
  return (geojson?.coordinates ?? []).map((ring) =>
    ring
      .filter((point) => point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]))
      .map(([longitude, latitude]) => [latitude, longitude] as LatLngTuple),
  );
}

function getInitialCenter(properties: PropertyBoundary[]): LatLngTuple {
  const projectPoint = properties
    .flatMap((property) => property.projects)
    .find((project) => {
      const point = project.locationGeojson?.coordinates;
      return point && Number.isFinite(point[0]) && Number.isFinite(point[1]);
    })?.locationGeojson?.coordinates;
  if (projectPoint) {
    return [projectPoint[1], projectPoint[0]];
  }
  const propertyPoint = properties.find(
    (property) => typeof property.latitude === 'number' && typeof property.longitude === 'number',
  );
  if (propertyPoint?.latitude && propertyPoint.longitude) {
    return [propertyPoint.latitude, propertyPoint.longitude];
  }
  return [27.3364, -82.5307];
}

type ProjectPin = PropertyProject & {
  propertyName: string;
  markerColor: string;
};

type ProjectArea = PropertyProject & {
  propertyName: string;
  areaColor: string;
};

function ProjectPinClickHandler({
  active,
  disabled,
  onPlaceProjectPin,
}: {
  active: boolean;
  disabled: boolean;
  onPlaceProjectPin: (latitude: number, longitude: number) => void;
}) {
  useMapEvents({
    click: (event) => {
      if (!active || disabled) return;
      onPlaceProjectPin(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}
function MapResizeInvalidator({ watchKey }: { watchKey: string }) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    let frameId: number | null = null;

    const invalidate = () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        map.invalidateSize({ animate: false, pan: false });
        frameId = null;
      });
    };

    invalidate();
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(invalidate)
      : null;
    resizeObserver?.observe(container);
    const delayedInvalidateId = window.setTimeout(invalidate, 220);

    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      window.clearTimeout(delayedInvalidateId);
      resizeObserver?.disconnect();
    };
  }, [map, watchKey]);

  return null;
}

export function PropertyMap({
  properties,
  currentPropertyId,
  className,
  editMode,
  canEditBoundary,
  selectedProjectId,
  pinPlacementProject,
  pinPlacementDisabled,
  areaEditProjectId,
  onBoundaryChange,
  onAreaChange,
  onAreaCreate,
  onSelectProperty,
  onSelectProject,
  onPlaceProjectPin,
  onCancelPinPlacement,
}: PropertyMapProps) {
  const mappedProperties = useMemo(
    () => properties.filter((property) => property.boundaryGeojson),
    [properties],
  );
  const visibleProperties = useMemo(
    () => currentPropertyId === 'all'
      ? properties
      : properties.filter((property) => property.id === currentPropertyId),
    [currentPropertyId, properties],
  );
  const projectPins = useMemo(
    () =>
      visibleProperties.flatMap((property) =>
        property.projects
          .filter((project) => project.locationGeojson)
          .map((project) => ({
            ...project,
            propertyName: property.name,
            markerColor: project.color ?? property.color,
          })),
      ),
    [visibleProperties],
  );
  const projectAreas = useMemo(
    () =>
      visibleProperties.flatMap((property) =>
        property.projects
          .filter((project) => project.areaGeojson)
          .map((project) => ({
            ...project,
            propertyName: property.name,
            areaColor: project.color ?? property.color,
          })),
      ),
    [visibleProperties],
  );
  const selectedProperty = useMemo(
    () => currentPropertyId === 'all'
      ? null
      : properties.find((property) => property.id === currentPropertyId) ?? null,
    [currentPropertyId, properties],
  );
  const initialCenter = useMemo(() => getInitialCenter(properties), [properties]);
  const isPlacingProjectPin = Boolean(pinPlacementProject);
  const isAreaEditActive = Boolean(areaEditProjectId) && !editMode && !isPlacingProjectPin;
  const canEditSelectedBoundary = editMode && !isPlacingProjectPin && !areaEditProjectId && canEditBoundary && currentPropertyId !== 'all' && Boolean(selectedProperty);
  const isMapInteractionActive = editMode || isAreaEditActive || isPlacingProjectPin;
  const resizeWatchKey = [
    currentPropertyId,
    selectedProjectId ?? 'none',
    pinPlacementProject?.projectId ?? 'none',
    areaEditProjectId ?? 'none',
    editMode ? 'editing' : 'viewing',
    className ?? 'default',
  ].join('|');

  const polygonOptionsById = useMemo(() => {
    const options = new Map<string, GeomanPathOptions>();
    mappedProperties.forEach((property) => {
      const isSelected = currentPropertyId !== 'all' && currentPropertyId === property.id;
      options.set(property.id, {
        color: isSelected ? '#ffffff' : property.color,
        fillColor: property.color,
        fillOpacity: isSelected ? 0.2 : 0.28,
        opacity: 0.95,
        pmIgnore: canEditSelectedBoundary ? !isSelected : true,
        weight: isSelected ? 4 : 2,
      });
    });
    return options;
  }, [canEditSelectedBoundary, currentPropertyId, mappedProperties]);

  return (
    <div className={cn('relative h-[min(68vh,720px)] min-h-[520px] overflow-hidden rounded-xl border border-surface-border bg-surface-card shadow-md', className)}>
      <MapContainer
        center={initialCenter}
        zoom={13}
        maxZoom={19}
        scrollWheelZoom
        zoomSnap={0.25}
        zoomDelta={0.5}
        wheelPxPerZoomLevel={80}
        preferCanvas
        className="h-full w-full touch-none overscroll-contain"
      >
        <TileLayer
          attribution="USGS The National Map"
          maxZoom={19}
          maxNativeZoom={16}
          url={USGS_IMAGERY_TILE_URL}
        />
        <MapResizeInvalidator watchKey={resizeWatchKey} />
        <FitBounds properties={visibleProperties} selectedPropertyId={currentPropertyId} disabled={isMapInteractionActive} />
        <ProjectPinClickHandler
          active={isPlacingProjectPin}
          disabled={pinPlacementDisabled}
          onPlaceProjectPin={onPlaceProjectPin}
        />
        {canEditSelectedBoundary ? <GeomanControl onBoundaryChange={onBoundaryChange} /> : null}
        {isAreaEditActive ? <GeomanControl onBoundaryChange={onAreaChange} onCreateComplete={onAreaCreate} /> : null}
        {mappedProperties.map((property) => (
          <Polygon
            key={`${property.id}-${currentPropertyId}-${canEditSelectedBoundary ? 'edit' : 'view'}`}
            positions={propertyToPolygonPositions(property)}
            pathOptions={polygonOptionsById.get(property.id)}
            eventHandlers={{
              click: () => {
                if (!isPlacingProjectPin && !isAreaEditActive) onSelectProperty(property.id);
              },
              // Geoman fires edit events on the LAYER, not the map, so these must be
              // bound per-polygon. Binding them on the map (as GeomanControl does for
              // pm:create) silently never fires and leaves Save disabled after an edit.
              'pm:update': (event) => {
                const geometry = layerToBoundaryGeoJson(event.layer as GeoJsonEditLayer);
                if (geometry) onBoundaryChange(geometry);
              },
              'pm:dragend': (event) => {
                const geometry = layerToBoundaryGeoJson(event.layer as GeoJsonEditLayer);
                if (geometry) onBoundaryChange(geometry);
              },
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
        {projectAreas.map((project: ProjectArea) => {
          const isSelected = selectedProjectId === project.id;
          const isEditingThisArea = isAreaEditActive && areaEditProjectId === project.id;
          return (
            <Polygon
              key={`${project.id}-area-${isEditingThisArea ? 'edit' : 'view'}-${isSelected ? 'selected' : 'normal'}`}
              positions={geoJsonToPolygonPositions(project.areaGeojson)}
              pathOptions={{
                color: isSelected ? 'oklch(var(--text-inverse))' : project.areaColor,
                fillColor: project.areaColor,
                fillOpacity: isSelected ? 0.52 : 0.2,
                opacity: isSelected ? 1 : 0.85,
                pmIgnore: isAreaEditActive ? !isEditingThisArea : true,
                weight: isSelected ? 4 : 2,
              }}
              eventHandlers={{
                click: (event) => {
                  event.originalEvent.stopPropagation();
                  if (!isPlacingProjectPin && !isAreaEditActive) onSelectProject(project.propertyId, project.id);
                },
                'pm:update': (event) => {
                  if (!isEditingThisArea) return;
                  const geometry = layerToBoundaryGeoJson(event.layer as GeoJsonEditLayer);
                  if (geometry) onAreaChange(geometry);
                },
                'pm:dragend': (event) => {
                  if (!isEditingThisArea) return;
                  const geometry = layerToBoundaryGeoJson(event.layer as GeoJsonEditLayer);
                  if (geometry) onAreaChange(geometry);
                },
              }}
            >
              <Tooltip sticky>
                <div className="space-y-1">
                  <div className="font-semibold">{project.name}</div>
                  <div>{project.propertyName}</div>
                </div>
              </Tooltip>
            </Polygon>
          );
        })}
        {projectPins.map((project: ProjectPin) => {
          const coordinates = project.locationGeojson?.coordinates;
          if (!coordinates) return null;
          const markerCenter: LatLngTuple = [coordinates[1], coordinates[0]];
          return (
            <CircleMarker
              key={project.id}
              center={markerCenter}
              radius={9}
              pathOptions={{
                color: 'oklch(var(--text-inverse))',
                fillColor: project.markerColor,
                fillOpacity: 0.95,
                opacity: 1,
                weight: 2,
              }}
              eventHandlers={{
                click: (event) => {
                  event.originalEvent.stopPropagation();
                  if (!isPlacingProjectPin && !isAreaEditActive) onSelectProject(project.propertyId, project.id);
                },
              }}
            >
              <Tooltip sticky>
                <div className="space-y-1">
                  <div className="font-semibold">{project.name}</div>
                  <div>{project.status}</div>
                </div>
              </Tooltip>
              <Popup>
                <div className="space-y-1">
                  <div className="font-semibold">{project.name}</div>
                  <div>{project.status}</div>
                  <div>{project.propertyName}</div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
      {pinPlacementProject ? (
        <div className="absolute left-4 top-4 z-[500] max-w-sm rounded-lg border border-surface-border bg-surface-card px-3 py-3 text-sm text-text-secondary shadow-md">
          <div className="font-semibold text-text-primary">
            {pinPlacementDisabled ? 'Saving project pin...' : `Click the map to place ${pinPlacementProject.projectName}.`}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={onCancelPinPlacement}
            disabled={pinPlacementDisabled}
          >
            Cancel
          </Button>
        </div>
      ) : null}
      {mappedProperties.length === 0 && !editMode ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-[500] flex justify-center px-6 text-center">
          <div className="max-w-sm rounded-xl border border-surface-border bg-surface-card/95 p-5 shadow-lg">
            <div className="text-sm font-semibold text-text-primary">No property boundaries yet</div>
            <p className="mt-2 text-sm text-text-secondary">
              Select a property, then choose Edit boundary to draw its outline.
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
