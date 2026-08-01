'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { AlertTriangle, Edit3, Map as MapIcon, RefreshCw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/sonner';
import { PropertyDetailPanel } from '@/components/map/PropertyDetailPanel';
import { PropertySelector } from '@/components/shared/PropertySelector';
import { useOrgProfile } from '@/hooks/useOrgProfile';
import { usePagePropertySelection } from '@/hooks/usePagePropertySelection';
import {
  usePropertyBoundaries,
  useSavePropertyBoundary,
  useSetProjectArea,
  useSetProjectLocation,
  type PropertyBoundaryGeoJson,
  type PropertyProject,
} from '@/lib/supabase-queries';

const PropertyMap = dynamic(
  () => import('@/components/map/PropertyMap').then((module) => module.PropertyMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[min(68vh,720px)] min-h-[520px] rounded-xl border border-surface-border bg-surface-card p-4">
        <Skeleton className="h-full w-full rounded-lg" />
      </div>
    ),
  },
);

function formatAcres(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)} ac` : 'not set';
}

export default function PropertiesMapPage() {
  const { currentRole, currentUser, isOrgReady, orgId } = useOrgProfile();
  const boundariesQuery = usePropertyBoundaries(orgId ?? undefined);
  const saveBoundaryMutation = useSavePropertyBoundary(orgId ?? undefined);
  const setProjectLocationMutation = useSetProjectLocation(orgId ?? undefined);
  const setProjectAreaMutation = useSetProjectArea(orgId ?? undefined);
  const pinSaveInFlightRef = useRef(false);
  const [editMode, setEditMode] = useState(false);
  const [pendingBoundaryGeojson, setPendingBoundaryGeojson] = useState<PropertyBoundaryGeoJson | null | undefined>(undefined);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [pinPlacementProject, setPinPlacementProject] = useState<{ propertyId: string; projectId: string; projectName: string } | null>(null);
  const [pinSavingProjectId, setPinSavingProjectId] = useState<string | null>(null);
  const [areaEditProject, setAreaEditProject] = useState<{ propertyId: string; projectId: string; projectName: string } | null>(null);
  const [pendingAreaGeojson, setPendingAreaGeojson] = useState<PropertyBoundaryGeoJson | null | undefined>(undefined);
  const [areaSavingProjectId, setAreaSavingProjectId] = useState<string | null>(null);
  const properties = boundariesQuery.data ?? [];
  const [selectedPropertyId, setSelectedPropertyId] = usePagePropertySelection({
    currentUser,
    properties,
  });
  const mappedCount = properties.filter((property) => property.boundaryGeojson).length;
  const selectedProperty = selectedPropertyId === 'all'
    ? null
    : properties.find((property) => property.id === selectedPropertyId) ?? null;
  const canViewMap = currentRole === 'admin' || currentRole === 'manager';
  const hasConcretePropertySelected = selectedPropertyId !== 'all' && Boolean(selectedProperty);
  const hasPendingBoundaryChange = pendingBoundaryGeojson !== undefined;
  const hasPendingAreaChange = pendingAreaGeojson !== undefined;

  const handleSelectProperty = (propertyId: string) => {
    if (propertyId !== selectedPropertyId) setSelectedProjectId(null);
    setSelectedPropertyId(propertyId);
  };

  const handleSelectWorkspaceProject = (projectId: string | null) => {
    setEditMode(false);
    setPinPlacementProject(null);
    setAreaEditProject(null);
    setPendingAreaGeojson(undefined);
    setSelectedProjectId(projectId);
  };

  useEffect(() => {
    setEditMode(false);
    setPendingBoundaryGeojson(undefined);
    setPinPlacementProject(null);
    setAreaEditProject(null);
    setPendingAreaGeojson(undefined);
  }, [selectedPropertyId]);

  const handleSaveBoundary = async () => {
    if (!orgId || selectedPropertyId === 'all' || !hasPendingBoundaryChange) return;
    try {
      await saveBoundaryMutation.mutateAsync({
        propertyId: selectedPropertyId,
        boundaryGeojson: pendingBoundaryGeojson ?? null,
      });
      setPendingBoundaryGeojson(undefined);
      toast.success('Property boundary saved.');
    } catch (error) {
      console.error('Failed to save property boundary:', error);
      toast.error(error instanceof Error ? error.message : 'Property boundary could not be saved.');
    }
  };

  const handleStartPlacePin = (project: PropertyProject) => {
    if (!canViewMap || pinSaveInFlightRef.current) return;
    if (!project.propertyId || project.propertyId === 'all') {
      toast.error('Select a property before placing a pin.');
      return;
    }
    setEditMode(false);
    setPendingBoundaryGeojson(undefined);
    setAreaEditProject(null);
    setPendingAreaGeojson(undefined);
    setSelectedProjectId(project.id);
    setSelectedPropertyId(project.propertyId);
    setPinPlacementProject({ propertyId: project.propertyId, projectId: project.id, projectName: project.name });
  };

  const handleSelectProject = (propertyId: string, projectId: string) => {
    setEditMode(false);
    setPinPlacementProject(null);
    setAreaEditProject(null);
    setPendingAreaGeojson(undefined);
    setSelectedProjectId(projectId);
    if (propertyId && propertyId !== selectedPropertyId) setSelectedPropertyId(propertyId);
  };

  const handleCancelPinPlacement = () => {
    if (pinSaveInFlightRef.current) return;
    setPinPlacementProject(null);
  };

  const handleStartEditArea = (project: PropertyProject) => {
    if (!canViewMap || areaSavingProjectId) return;
    if (!project.propertyId || project.propertyId === 'all') {
      toast.error('Select a property before editing an area.');
      return;
    }
    setEditMode(false);
    setPendingBoundaryGeojson(undefined);
    setPinPlacementProject(null);
    setSelectedProjectId(project.id);
    setSelectedPropertyId(project.propertyId);
    setAreaEditProject({ propertyId: project.propertyId, projectId: project.id, projectName: project.name });
    setPendingAreaGeojson(undefined);
  };

  const handleCancelEditArea = () => {
    if (areaSavingProjectId) return;
    setAreaEditProject(null);
    setPendingAreaGeojson(undefined);
  };

  const saveProjectArea = async (areaGeojson: PropertyBoundaryGeoJson | null) => {
    if (!orgId || !areaEditProject || areaSavingProjectId) return;
    setAreaSavingProjectId(areaEditProject.projectId);
    try {
      await setProjectAreaMutation.mutateAsync({
        propertyId: areaEditProject.propertyId,
        projectId: areaEditProject.projectId,
        areaGeojson,
      });
      setSelectedProjectId(areaEditProject.projectId);
      setPendingAreaGeojson(undefined);
      setAreaEditProject(null);
      toast.success('Project area saved.');
    } catch (error) {
      console.error('Project area save failed:', error);
      toast.error(error instanceof Error ? error.message : 'Project area could not be saved.');
    } finally {
      setAreaSavingProjectId(null);
    }
  };

  const handleSaveArea = async () => {
    if (!hasPendingAreaChange) return;
    await saveProjectArea(pendingAreaGeojson ?? null);
  };

  const handleFinishArea = async (geojson: PropertyBoundaryGeoJson) => {
    setPendingAreaGeojson(geojson);
    await saveProjectArea(geojson);
  };

  const handleClearArea = async (project: PropertyProject) => {
    if (!canViewMap || !orgId || areaSavingProjectId) return;
    const confirmed = window.confirm(`Clear the mapped area for "${project.name}"?`);
    if (!confirmed) return;
    setAreaSavingProjectId(project.id);
    try {
      await setProjectAreaMutation.mutateAsync({
        propertyId: project.propertyId,
        projectId: project.id,
        areaGeojson: null,
      });
      if (areaEditProject?.projectId === project.id) {
        setAreaEditProject(null);
        setPendingAreaGeojson(undefined);
      }
      toast.success('Project area cleared.');
    } catch (error) {
      console.error('Project area clear failed:', error);
      toast.error(error instanceof Error ? error.message : 'Project area could not be cleared.');
    } finally {
      setAreaSavingProjectId(null);
    }
  };

  const handlePlaceProjectPin = async (latitude: number, longitude: number) => {
    if (!pinPlacementProject || !orgId || pinSaveInFlightRef.current) return;
    pinSaveInFlightRef.current = true;
    setPinSavingProjectId(pinPlacementProject.projectId);
    try {
      await setProjectLocationMutation.mutateAsync({
        propertyId: pinPlacementProject.propertyId,
        projectId: pinPlacementProject.projectId,
        latitude,
        longitude,
      });
      setSelectedProjectId(pinPlacementProject.projectId);
      setPinPlacementProject(null);
      toast.success('Project pin saved.');
    } catch (error) {
      console.error('Project pin save failed:', error);
      toast.error(error instanceof Error ? error.message : 'Project pin could not be saved.');
    } finally {
      pinSaveInFlightRef.current = false;
      setPinSavingProjectId(null);
    }
  };

  if (!isOrgReady) {
    return (
      <section className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <Skeleton className="h-10 w-72 rounded-lg" />
        <Skeleton className="h-[min(68vh,720px)] min-h-[520px] rounded-xl" />
      </section>
    );
  }

  if (!canViewMap) {
    return (
      <section className="flex flex-1 items-center justify-center p-4 md:p-6">
        <Card className="max-w-md border-surface-border bg-surface-card p-6 text-center shadow-md">
          <AlertTriangle className="mx-auto h-8 w-8 text-status-warning" />
          <h2 className="mt-4 text-lg font-bold text-text-primary">Properties map is restricted</h2>
          <p className="mt-2 text-sm text-text-secondary">
            Admin or manager access is required to view property boundaries.
          </p>
        </Card>
      </section>
    );
  }

  return (
    <section className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-col gap-3 rounded-xl border border-surface-border bg-surface-card p-4 shadow-sm md:flex-row md:flex-wrap md:items-end md:justify-between">
        <div className="min-w-[16rem] flex-1">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
            <MapIcon className="h-3.5 w-3.5" />
            Boundaries
          </div>
          <div className="mt-2 text-sm text-text-secondary">
            {mappedCount} of {properties.length} properties have mapped boundaries.
          </div>
          {selectedProperty ? (
            <div className="mt-1 text-xs text-text-muted">
              Selected: {selectedProperty.name} - drawn {formatAcres(selectedProperty.calculatedAcreage)} / on file {formatAcres(selectedProperty.acreage)}
            </div>
          ) : null}
          {selectedPropertyId === 'all' ? (
            <div className="mt-2 text-xs text-status-warning">
              Select a specific property before drawing or editing a boundary.
            </div>
          ) : null}
          {hasPendingBoundaryChange ? (
            <div className="mt-2 text-xs font-medium text-brand-bright">
              Unsaved boundary changes are ready to save.
            </div>
          ) : null}
          {areaEditProject ? (
            <div className="mt-2 text-xs font-medium text-brand-bright">
              Editing area for {areaEditProject.projectName}{hasPendingAreaChange ? ' - unsaved changes are ready to save.' : '.'}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <PropertySelector
            className="sm:w-72"
            allowAllProperties
            orgId={orgId}
            value={selectedPropertyId}
            onChange={handleSelectProperty}
          />
          <Button
            type="button"
            variant={editMode ? 'default' : 'outline'}
            className="h-10 rounded-xl"
            onClick={() => {
              setPinPlacementProject(null);
              setAreaEditProject(null);
              setPendingAreaGeojson(undefined);
              setEditMode((current) => !current);
            }}
            disabled={!hasConcretePropertySelected || saveBoundaryMutation.isPending || Boolean(pinSavingProjectId) || Boolean(areaSavingProjectId)}
          >
            <Edit3 className="mr-2 h-4 w-4" />
            {editMode ? 'Editing' : 'Edit boundary'}
          </Button>
          <Button
            type="button"
            className="h-10 rounded-xl"
            onClick={() => void handleSaveBoundary()}
            disabled={!hasPendingBoundaryChange || !hasConcretePropertySelected || saveBoundaryMutation.isPending || Boolean(pinPlacementProject) || Boolean(areaEditProject)}
          >
            <Save className="mr-2 h-4 w-4" />
            {saveBoundaryMutation.isPending ? 'Saving...' : 'Save boundary'}
          </Button>
          {areaEditProject ? (
            <>
              <Button
                type="button"
                className="h-10 rounded-xl"
                onClick={() => void handleSaveArea()}
                disabled={!hasPendingAreaChange || Boolean(areaSavingProjectId)}
              >
                <Save className="mr-2 h-4 w-4" />
                {areaSavingProjectId === areaEditProject.projectId ? 'Saving...' : 'Save area'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl"
                onClick={handleCancelEditArea}
                disabled={Boolean(areaSavingProjectId)}
              >
                Cancel area
              </Button>
            </>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-xl border-surface-border bg-surface-card/80"
            onClick={() => void boundariesQuery.refetch()}
            disabled={boundariesQuery.isFetching || saveBoundaryMutation.isPending || Boolean(areaSavingProjectId)}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${boundariesQuery.isFetching ? 'animate-spin' : ''}`} />
            Retry
          </Button>
        </div>
      </div>

      {boundariesQuery.isLoading && !boundariesQuery.data ? (
        <Skeleton className="h-[min(68vh,720px)] min-h-[520px] rounded-xl" />
      ) : boundariesQuery.isError ? (
        <Card className="border-status-warning/50 bg-surface-card p-6 shadow-md">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-text-primary">Property boundaries could not load</h2>
              <p className="mt-1 text-sm text-text-secondary">
                {(boundariesQuery.error as Error).message || 'The map request timed out or failed.'}
              </p>
            </div>
            <Button type="button" onClick={() => void boundariesQuery.refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        </Card>
      ) : (
        <PropertyMap
          properties={properties}
          currentPropertyId={selectedPropertyId || 'all'}
          className={areaEditProject || pinPlacementProject ? 'h-[min(78vh,780px)] min-h-[620px] max-h-[820px]' : hasConcretePropertySelected ? 'h-[380px] min-h-[320px] max-h-[420px]' : undefined}
          editMode={editMode}
          canEditBoundary={canViewMap}
          selectedProjectId={selectedProjectId}
          pinPlacementProject={pinPlacementProject}
          pinPlacementDisabled={Boolean(pinSavingProjectId)}
          areaEditProjectId={areaEditProject?.projectId ?? null}
          onBoundaryChange={setPendingBoundaryGeojson}
          onAreaChange={setPendingAreaGeojson}
          onAreaCreate={handleFinishArea}
          onSelectProperty={handleSelectProperty}
          onSelectProject={handleSelectProject}
          onPlaceProjectPin={handlePlaceProjectPin}
          onCancelPinPlacement={handleCancelPinPlacement}
        />
      )}
      {hasConcretePropertySelected && selectedProperty ? (
        <PropertyDetailPanel
          property={selectedProperty}
          orgId={orgId}
          canManage={canViewMap}
          createdBy={currentUser?.employeeId ?? null}
          selectedProjectId={selectedProjectId}
          pinPlacementProjectId={pinPlacementProject?.projectId ?? null}
          pinPlacementSaving={Boolean(pinSavingProjectId)}
          areaEditProjectId={areaEditProject?.projectId ?? null}
          areaSaving={Boolean(areaSavingProjectId)}
          onStartPlacePin={handleStartPlacePin}
          onCancelPlacePin={handleCancelPinPlacement}
          onStartEditArea={handleStartEditArea}
          onCancelEditArea={handleCancelEditArea}
          onClearArea={(project) => void handleClearArea(project)}
          onProjectSelect={handleSelectWorkspaceProject}
          onClose={() => {
            setSelectedProjectId(null);
            setPinPlacementProject(null);
            setAreaEditProject(null);
            setPendingAreaGeojson(undefined);
            setSelectedPropertyId('all');
          }}
        />
      ) : null}
    </section>
  );
}
