'use client';

import { useEffect, useMemo } from 'react';
import { CircleMarker, MapContainer, Marker, Polygon, Popup, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { divIcon, type Layer, type PathOptions } from 'leaflet';
import { Button } from '@/components/ui/button';
import { FitBounds } from '@/components/map/FitBounds';
import { GeomanControl, layerToBoundaryGeoJson } from '@/components/map/GeomanControl';
import type { ProjectAreaType, ProjectPhoto, PropertyBoundary, PropertyBoundaryGeoJson, PropertyProject } from '@/lib/supabase-queries';
import type { Note } from '@/data/seedData';
import { PROJECT_STATUS_LEGEND, normalizeProjectStatus, projectStatusColor, statusKeyColor, type ProjectStatusKey } from '@/lib/project-status';
import { acresToSquareFeet, formatAcres, formatSquareFeet, geojsonPolygonAcres } from '@/lib/geo';
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
  photoPins: Array<ProjectPhoto & { projectName?: string }>;
  geoNotes?: Note[];
  photoPlacementActive: boolean;
  photoPlacementDisabled: boolean;
  areaEditProjectId: string | null;
  areaSelectionActive?: boolean;
  selectedAreaIds?: string[];
  onBoundaryChange: (geojson: PropertyBoundaryGeoJson | null) => void;
  onAreaChange: (geojson: PropertyBoundaryGeoJson | null) => void;
  onAreaCreate: (geojson: PropertyBoundaryGeoJson) => void | Promise<void>;
  onSelectProperty: (propertyId: string) => void;
  onSelectProject: (propertyId: string, projectId: string) => void;
  onToggleAreaSelection?: (project: PropertyProject) => void;
  onAssignSelectedAreas?: () => void;
  onCancelAreaSelection?: () => void;
  onPlaceProjectPin: (latitude: number, longitude: number) => void;
  onPlacePhotoPin: (latitude: number, longitude: number) => void;
  onSelectPhoto?: (photo: ProjectPhoto & { projectName?: string }) => void;
  onCancelPinPlacement: () => void;
  onCancelPhotoPlacement: () => void;
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
  areaAcres: number | null;
};

type ProjectAreaTypeMeta = {
  label: string;
  color: string;
};

const PROJECT_AREA_TYPE_META: Record<ProjectAreaType, ProjectAreaTypeMeta> = {
  green: { label: 'Green', color: 'oklch(var(--status-active))' },
  tee: { label: 'Tee', color: 'oklch(var(--status-pending))' },
  fairway: { label: 'Fairway', color: 'oklch(var(--brand-default))' },
  rough: { label: 'Rough', color: 'oklch(var(--status-hold))' },
  lake: { label: 'Lake', color: 'oklch(var(--status-complete))' },
  practice: { label: 'Practice', color: 'oklch(var(--brand-bright))' },
  other: { label: 'Other', color: 'oklch(var(--text-muted))' },
};

const PROJECT_AREA_TYPE_ORDER: ProjectAreaType[] = ['green', 'tee', 'fairway', 'rough', 'lake', 'practice', 'other'];

type GeoNotePin = Note & {
  propertyName: string;
};

function PlacementClickHandler({
  projectPinActive,
  photoPinActive,
  disabled,
  onPlaceProjectPin,
  onPlacePhotoPin,
}: {
  projectPinActive: boolean;
  photoPinActive: boolean;
  disabled: boolean;
  onPlaceProjectPin: (latitude: number, longitude: number) => void;
  onPlacePhotoPin: (latitude: number, longitude: number) => void;
}) {
  useMapEvents({
    click: (event) => {
      if (disabled) return;
      if (projectPinActive) {
        onPlaceProjectPin(event.latlng.lat, event.latlng.lng);
        return;
      }
      if (photoPinActive) {
        onPlacePhotoPin(event.latlng.lat, event.latlng.lng);
      }
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

// When area-edit or pin-move starts, bring that project's zone/pin up close so
// it's easy to work with (otherwise the map stays at the whole-property zoom and
// the target feels tiny and far away). Fits once per target — keyed on targetKey,
// not the geometry, so it never fights the user mid-edit.
function FitToFocus({ positions, targetKey }: { positions: LatLngTuple[] | null; targetKey: string }) {
  const map = useMap();
  useEffect(() => {
    if (!targetKey || !positions || positions.length === 0) return;
    const frame = window.requestAnimationFrame(() => {
      // Ensure Leaflet has the current (often just-grown) container size first.
      map.invalidateSize({ animate: false, pan: false });
      if (positions.length === 1) {
        map.setView(positions[0], Math.min(19, Math.max(map.getZoom(), 18)), { animate: true });
        return;
      }
      let minLat = positions[0][0];
      let maxLat = positions[0][0];
      let minLng = positions[0][1];
      let maxLng = positions[0][1];
      positions.forEach(([lat, lng]) => {
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
      });
      map.fitBounds([[minLat, minLng], [maxLat, maxLng]], { animate: true, maxZoom: 19, padding: [50, 50] });
    });
    return () => window.cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, targetKey]);
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
  photoPins,
  geoNotes = [],
  photoPlacementActive,
  photoPlacementDisabled,
  areaEditProjectId,
  areaSelectionActive = false,
  selectedAreaIds = [],
  onBoundaryChange,
  onAreaChange,
  onAreaCreate,
  onSelectProperty,
  onSelectProject,
  onToggleAreaSelection,
  onAssignSelectedAreas,
  onCancelAreaSelection,
  onPlaceProjectPin,
  onPlacePhotoPin,
  onSelectPhoto,
  onCancelPinPlacement,
  onCancelPhotoPlacement,
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
            markerColor: projectStatusColor(project.status),
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
            areaColor: PROJECT_AREA_TYPE_META[project.areaType].color,
            areaAcres: project.calculatedAreaAcres ?? geojsonPolygonAcres(project.areaGeojson),
          })),
      ),
    [visibleProperties],
  );
  const projectAreaLegend = useMemo(
    () => {
      const totals = new Map<ProjectAreaType, { acres: number; count: number }>();
      projectAreas.forEach((project) => {
        if (project.areaAcres === null) return;
        const current = totals.get(project.areaType) ?? { acres: 0, count: 0 };
        current.acres += project.areaAcres;
        current.count += 1;
        totals.set(project.areaType, current);
      });
      return PROJECT_AREA_TYPE_ORDER.flatMap((areaType) => {
        const total = totals.get(areaType);
        return total ? [{ areaType, ...total }] : [];
      });
    },
    [projectAreas],
  );
  const selectedAreaIdSet = useMemo(() => new Set(selectedAreaIds), [selectedAreaIds]);
  const selectedAreaSummary = useMemo(
    () => {
      const selected = projectAreas.filter((project) => selectedAreaIdSet.has(project.id));
      const totalAcres = selected.reduce((sum, project) => sum + (project.areaAcres ?? 0), 0);
      const breakdown = PROJECT_AREA_TYPE_ORDER.flatMap((areaType) => {
        const matching = selected.filter((project) => project.areaType === areaType);
        if (matching.length === 0) return [];
        const acres = matching.reduce((sum, project) => sum + (project.areaAcres ?? 0), 0);
        return [{ areaType, count: matching.length, acres }];
      });
      return { selected, totalAcres, breakdown };
    },
    [projectAreas, selectedAreaIdSet],
  );
  const geoNotePins = useMemo<GeoNotePin[]>(
    () => {
      const propertyNameById = new Map(visibleProperties.map((property) => [property.id, property.name]));
      return geoNotes
        .filter((note) => note.type === 'geo' && note.locationGeojson?.type === 'Point' && note.propertyId && propertyNameById.has(note.propertyId))
        .map((note) => ({
          ...note,
          propertyName: propertyNameById.get(note.propertyId ?? '') ?? 'Property',
        }));
    },
    [geoNotes, visibleProperties],
  );
  const selectedProperty = useMemo(
    () => currentPropertyId === 'all'
      ? null
      : properties.find((property) => property.id === currentPropertyId) ?? null,
    [currentPropertyId, properties],
  );
  const workSummary = useMemo(() => {
    if (currentPropertyId === 'all' || !selectedProperty) return null;
    const projects = selectedProperty.projects;
    if (projects.length === 0) return null;
    const counts = { active: 0, pending: 0, hold: 0, complete: 0, warning: 0 } as Record<ProjectStatusKey, number>;
    let mapped = 0;
    projects.forEach((project) => {
      counts[normalizeProjectStatus(project.status)] += 1;
      if (project.areaGeojson || project.locationGeojson) mapped += 1;
    });
    return { total: projects.length, counts, mapped };
  }, [currentPropertyId, selectedProperty]);
  const initialCenter = useMemo(() => getInitialCenter(properties), [properties]);
  const isPlacingPhotoPin = photoPlacementActive;
  const isPlacingProjectPin = Boolean(pinPlacementProject) && !isPlacingPhotoPin;
  const isAreaEditActive = Boolean(areaEditProjectId) && !editMode && !isPlacingProjectPin && !isPlacingPhotoPin;
  const isSingleProperty = currentPropertyId !== 'all';
  const canEditSelectedBoundary = editMode && !isPlacingProjectPin && !isPlacingPhotoPin && !areaEditProjectId && canEditBoundary && currentPropertyId !== 'all' && Boolean(selectedProperty);
  const isMapInteractionActive = editMode || isAreaEditActive || isPlacingProjectPin || isPlacingPhotoPin || areaSelectionActive;
  // Always-on project labels only when zoomed into one property and not mid-edit;
  // in the All view we label properties (name + count) instead, to avoid clutter.
  const showProjectLabels = isSingleProperty && !isMapInteractionActive;
  const showPropertyLabels = !isSingleProperty;
  // The zone/pin to zoom to when its edit/move starts (see FitToFocus).
  const focusTarget = useMemo<{ key: string; positions: LatLngTuple[] | null }>(() => {
    if (isAreaEditActive && areaEditProjectId) {
      const area = projectAreas.find((project) => project.id === areaEditProjectId);
      const positions = area ? geoJsonToPolygonPositions(area.areaGeojson).flat() : [];
      if (positions.length >= 2) return { key: `area:${areaEditProjectId}`, positions };
    }
    if (isPlacingProjectPin && pinPlacementProject) {
      const pin = projectPins.find((project) => project.id === pinPlacementProject.projectId);
      const coordinates = pin?.locationGeojson?.coordinates;
      if (coordinates) return { key: `pin:${pinPlacementProject.projectId}`, positions: [[coordinates[1], coordinates[0]]] };
    }
    return { key: '', positions: null };
  }, [isAreaEditActive, areaEditProjectId, isPlacingProjectPin, pinPlacementProject, projectAreas, projectPins]);
  const resizeWatchKey = [
    currentPropertyId,
    selectedProjectId ?? 'none',
    pinPlacementProject?.projectId ?? 'none',
    isPlacingPhotoPin ? 'placing-photo' : 'photo-viewing',
    areaEditProjectId ?? 'none',
    editMode ? 'editing' : 'viewing',
    className ?? 'default',
  ].join('|');
  const photoMarkerIcon = useMemo(
    () =>
      divIcon({
        className: '',
        html: [
          '<div style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9px;border:1px solid oklch(var(--brand-default));background:oklch(var(--surface-card));color:oklch(var(--brand-bright));box-shadow:0 10px 24px oklch(var(--surface-base) / 0.38);">',
          '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>',
          '</div>',
        ].join(''),
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -14],
      }),
    [],
  );
  const geoNoteMarkerIcon = useMemo(
    () =>
      divIcon({
        className: '',
        html: [
          '<div style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9999px;border:1px solid oklch(var(--status-pending) / 0.65);background:oklch(var(--surface-card));color:oklch(var(--status-pending));box-shadow:0 10px 24px oklch(var(--surface-base) / 0.38);">',
          '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
          '</div>',
        ].join(''),
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -14],
      }),
    [],
  );

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
        <FitToFocus positions={focusTarget.positions} targetKey={focusTarget.key} />
        <PlacementClickHandler
          projectPinActive={isPlacingProjectPin}
          photoPinActive={isPlacingPhotoPin}
          disabled={pinPlacementDisabled || photoPlacementDisabled}
          onPlaceProjectPin={onPlaceProjectPin}
          onPlacePhotoPin={onPlacePhotoPin}
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
                if (areaSelectionActive) return;
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
            {showPropertyLabels ? (
              <Tooltip permanent direction="center" className="gc-map-label">
                {property.name}
                {property.projects.length > 0 ? (
                  <span className="gc-map-label-sub"> · {property.projects.length}</span>
                ) : null}
              </Tooltip>
            ) : (
              <Tooltip sticky>
                <div className="space-y-1">
                  <div className="font-semibold">{property.name}</div>
                  <div>{property.calculatedAcreage?.toFixed(1) ?? property.acreage.toFixed(1)} acres</div>
                </div>
              </Tooltip>
            )}
          </Polygon>
        ))}
        {projectAreas.map((project: ProjectArea) => {
          const isAreaSelected = selectedAreaIdSet.has(project.id);
          const isSelected = selectedProjectId === project.id || isAreaSelected;
          const isEditingThisArea = isAreaEditActive && areaEditProjectId === project.id;
          const areaSqFt = acresToSquareFeet(project.areaAcres);
          const areaType = PROJECT_AREA_TYPE_META[project.areaType];
          return (
            <Polygon
              key={`${project.id}-area-${isEditingThisArea ? 'edit' : 'view'}-${isSelected ? 'selected' : 'normal'}`}
              positions={geoJsonToPolygonPositions(project.areaGeojson)}
              pathOptions={{
                color: isAreaSelected ? 'oklch(var(--brand-bright))' : isSelected ? 'oklch(var(--text-inverse))' : project.areaColor,
                fillColor: project.areaColor,
                fillOpacity: isAreaSelected ? 0.48 : isSelected ? 0.52 : 0.2,
                opacity: isSelected ? 1 : 0.85,
                pmIgnore: isAreaEditActive ? !isEditingThisArea : true,
                dashArray: isAreaSelected ? '8 4' : undefined,
                weight: isSelected ? 4 : 2,
              }}
              eventHandlers={{
                click: (event) => {
                  event.originalEvent.stopPropagation();
                  if (areaSelectionActive) {
                    onToggleAreaSelection?.(project);
                    return;
                  }
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
              {showProjectLabels ? (
                <Tooltip permanent direction="center" className="gc-map-label">
                  {project.name}
                  {areaSqFt !== null ? (
                    <span className="gc-map-label-sub"> · {formatSquareFeet(areaSqFt)}</span>
                  ) : null}
                </Tooltip>
              ) : (
                <Tooltip sticky>
                  <div className="space-y-1">
                    <div className="font-semibold">{project.name}</div>
                    <div>{areaType.label}</div>
                    <div>
                      {areaSqFt !== null ? `${formatSquareFeet(areaSqFt)} · ` : ''}
                      {project.areaAcres !== null ? `${formatAcres(project.areaAcres)} · ` : ''}
                      {project.propertyName}
                    </div>
                  </div>
                </Tooltip>
              )}
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
              {showProjectLabels ? (
                <Tooltip permanent direction="top" offset={[0, -6]} className="gc-map-label">{project.name}</Tooltip>
              ) : (
                <Tooltip sticky>
                  <div className="space-y-1">
                    <div className="font-semibold">{project.name}</div>
                    <div>{project.status}</div>
                  </div>
                </Tooltip>
              )}
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
        {!isMapInteractionActive ? photoPins.map((photo) => {
          const coordinates = photo.locationGeojson?.coordinates;
          if (!coordinates) return null;
          const markerCenter: LatLngTuple = [coordinates[1], coordinates[0]];
          return (
            <Marker
              key={`${photo.id}-photo-pin`}
              position={markerCenter}
              icon={photoMarkerIcon}
              eventHandlers={{
                click: (event) => {
                  event.originalEvent.stopPropagation();
                  onSelectPhoto?.(photo);
                },
              }}
            >
              <Popup>
                <div className="w-[200px] space-y-2">
                  <img
                    src={photo.signedUrl}
                    alt={photo.caption || 'Project progress photo'}
                    className="max-h-36 w-full rounded-md object-cover"
                    loading="lazy"
                  />
                  {photo.caption ? <div className="text-sm font-medium">{photo.caption}</div> : null}
                  {photo.projectName ? <div className="text-xs">{photo.projectName}</div> : null}
                </div>
              </Popup>
            </Marker>
          );
        }) : null}
        {!isMapInteractionActive ? geoNotePins.map((note) => {
          const coordinates = note.locationGeojson?.coordinates;
          if (!coordinates) return null;
          const markerCenter: LatLngTuple = [coordinates[1], coordinates[0]];
          return (
            <Marker
              key={`${note.id}-geo-note-pin`}
              position={markerCenter}
              icon={geoNoteMarkerIcon}
            >
              <Popup>
                <div className="w-[210px] space-y-2">
                  <div>
                    <div className="text-sm font-semibold">{note.title}</div>
                    <div className="text-xs">{note.propertyName}</div>
                  </div>
                  <div className="text-sm">{note.content}</div>
                  {note.showOnDisplayBoard ? <div className="text-xs">Visible on display board</div> : null}
                </div>
              </Popup>
            </Marker>
          );
        }) : null}
      </MapContainer>
      {isPlacingProjectPin && pinPlacementProject ? (
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
      {isPlacingPhotoPin ? (
        <div className="absolute left-4 top-4 z-[500] max-w-sm rounded-lg border border-surface-border bg-surface-card px-3 py-3 text-sm text-text-secondary shadow-md">
          <div className="font-semibold text-text-primary">
            {photoPlacementDisabled ? 'Saving photo pin...' : 'Click the map to place this progress photo.'}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={onCancelPhotoPlacement}
            disabled={photoPlacementDisabled}
          >
            Cancel
          </Button>
        </div>
      ) : null}
      {workSummary && !isMapInteractionActive ? (
        <div className="pointer-events-none absolute left-4 top-4 z-[500] max-w-[min(20rem,calc(100%-2rem))] rounded-lg border border-surface-border bg-surface-card/95 px-3 py-2.5 shadow-md backdrop-blur-sm">
          <div className="truncate text-sm font-semibold text-text-primary">{selectedProperty?.name}</div>
          <div className="mt-0.5 text-2xs text-text-muted">
            {workSummary.total} project{workSummary.total === 1 ? '' : 's'} · {workSummary.mapped} mapped
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {PROJECT_STATUS_LEGEND.filter((entry) => workSummary.counts[entry.key] > 0).map((entry) => (
              <div key={entry.key} className="flex items-center gap-1.5 text-xs text-text-secondary">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-inset ring-text-inverse/40"
                  style={{ backgroundColor: statusKeyColor(entry.key) }}
                />
                <span className="font-semibold text-text-primary">{workSummary.counts[entry.key]}</span>
                {entry.label}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {areaSelectionActive ? (
        <div className="absolute left-4 top-4 z-[500] max-w-[min(24rem,calc(100%-2rem))] rounded-lg border border-brand-default/40 bg-surface-card/95 px-3 py-3 shadow-md backdrop-blur-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-text-primary">Select areas</div>
              <div className="mt-0.5 text-2xs text-text-muted">
                Click mapped zones to build one scoped board job.
              </div>
            </div>
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={onCancelAreaSelection}>
              Close
            </Button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-md border border-surface-border bg-surface-elevated px-2 py-1.5">
              <div className="text-3xs font-semibold uppercase tracking-wide text-text-muted">Count</div>
              <div className="mt-0.5 font-semibold text-text-primary">{selectedAreaSummary.selected.length}</div>
            </div>
            <div className="rounded-md border border-surface-border bg-surface-elevated px-2 py-1.5">
              <div className="text-3xs font-semibold uppercase tracking-wide text-text-muted">Sq ft</div>
              <div className="mt-0.5 font-semibold text-text-primary">{formatSquareFeet(acresToSquareFeet(selectedAreaSummary.totalAcres))}</div>
            </div>
            <div className="rounded-md border border-surface-border bg-surface-elevated px-2 py-1.5">
              <div className="text-3xs font-semibold uppercase tracking-wide text-text-muted">Acres</div>
              <div className="mt-0.5 font-semibold text-text-primary">{formatAcres(selectedAreaSummary.totalAcres)}</div>
            </div>
          </div>
          {selectedAreaSummary.breakdown.length > 0 ? (
            <div className="mt-3 flex flex-col gap-1">
              {selectedAreaSummary.breakdown.map((entry) => {
                const meta = PROJECT_AREA_TYPE_META[entry.areaType];
                return (
                  <div key={entry.areaType} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-xs text-text-secondary">
                    <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: meta.color }} />
                    <span>{meta.label} · {entry.count}</span>
                    <span className="font-medium text-text-primary">{formatAcres(entry.acres)}</span>
                  </div>
                );
              })}
            </div>
          ) : null}
          <Button
            type="button"
            className="mt-3 w-full"
            disabled={selectedAreaSummary.selected.length === 0}
            onClick={onAssignSelectedAreas}
          >
            Assign to crew
          </Button>
        </div>
      ) : null}
      {(projectAreas.length > 0 || projectPins.length > 0) && !isMapInteractionActive ? (
        <div className="pointer-events-none absolute bottom-4 right-4 z-[500] max-w-[min(22rem,calc(100%-2rem))] rounded-lg border border-surface-border bg-surface-card/95 px-3 py-2.5 shadow-md backdrop-blur-sm">
          {projectAreaLegend.length > 0 ? (
            <div className="border-b border-surface-border pb-2">
              <div className="mb-1.5 text-3xs font-semibold uppercase tracking-[0.16em] text-text-muted">
                Areas
              </div>
              <div className="flex flex-col gap-1">
                {projectAreaLegend.map((entry) => {
                  const meta = PROJECT_AREA_TYPE_META[entry.areaType];
                  const sqFt = acresToSquareFeet(entry.acres);
                  return (
                    <div key={entry.areaType} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-xs text-text-secondary">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-[3px] ring-1 ring-inset ring-text-inverse/40"
                        style={{ backgroundColor: meta.color }}
                      />
                      <span>{meta.label}</span>
                      <span className="font-medium text-text-primary">
                        {formatAcres(entry.acres)}
                        {sqFt !== null ? <span className="ml-1 text-text-muted">({formatSquareFeet(sqFt)})</span> : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
          <div className={projectAreaLegend.length > 0 ? 'pt-2' : ''}>
            <div className="mb-1.5 text-3xs font-semibold uppercase tracking-[0.16em] text-text-muted">
              Project status
            </div>
            <div className="flex flex-col gap-1">
              {PROJECT_STATUS_LEGEND.map((entry) => (
                <div key={entry.key} className="flex items-center gap-2 text-xs text-text-secondary">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-[3px] ring-1 ring-inset ring-text-inverse/40"
                    style={{ backgroundColor: statusKeyColor(entry.key) }}
                  />
                  {entry.label}
                </div>
              ))}
            </div>
          </div>
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
