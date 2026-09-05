'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { AlertTriangle, Edit3, Map as MapIcon, MousePointer2, RefreshCw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/sonner';
import { Textarea } from '@/components/ui/textarea';
import { PropertyDetailPanel } from '@/components/map/PropertyDetailPanel';
import { PropertySelector } from '@/components/shared/PropertySelector';
import type { EquipmentUnit, Task } from '@/data/seedData';
import { useOrgProfile } from '@/hooks/useOrgProfile';
import { usePagePropertySelection } from '@/hooks/usePagePropertySelection';
import { acresToSquareFeet, formatSquareFeet, geojsonPolygonAcres } from '@/lib/geo';
import {
  PROJECT_AREA_TYPES,
  useCreateAreaScopedAssignment,
  useCompleteNote,
  useEmployees,
  useEquipmentUnits,
  usePropertyBoundaries,
  useLocatedProjectPhotos,
  useNotes,
  useSavePropertyBoundary,
  useSetPhotoLocation,
  useSetProjectArea,
  useSetProjectLocation,
  useTasks,
  type ProjectAreaType,
  type ProjectPhoto,
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

const NO_EQUIPMENT_VALUE = 'no-equipment';

const PROJECT_AREA_TYPE_LABELS: Record<ProjectAreaType, string> = {
  green: 'Green',
  tee: 'Tee',
  fairway: 'Fairway',
  rough: 'Rough',
  lake: 'Lake',
  practice: 'Practice',
  other: 'Other',
};

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTaskEstimatedHours(task: Task | null | undefined) {
  return Number(task?.estimated_hours ?? task?.estimatedHours ?? 0);
}

function getEquipmentLabel(unit: EquipmentUnit) {
  return unit.unit_name || unit.name || unit.unitNumber || 'Equipment';
}

export default function PropertiesMapPage() {
  const { currentRole, currentUser, isOrgReady, orgId } = useOrgProfile();
  const boundariesQuery = usePropertyBoundaries(orgId ?? undefined);
  const saveBoundaryMutation = useSavePropertyBoundary(orgId ?? undefined);
  const setProjectLocationMutation = useSetProjectLocation(orgId ?? undefined);
  const setPhotoLocationMutation = useSetPhotoLocation(orgId ?? undefined);
  const setProjectAreaMutation = useSetProjectArea(orgId ?? undefined);
  const createAreaScopedAssignmentMutation = useCreateAreaScopedAssignment(orgId ?? undefined);
  const pinSaveInFlightRef = useRef(false);
  const photoSaveInFlightRef = useRef(false);
  const [editMode, setEditMode] = useState(false);
  const [pendingBoundaryGeojson, setPendingBoundaryGeojson] = useState<PropertyBoundaryGeoJson | null | undefined>(undefined);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [pinPlacementProject, setPinPlacementProject] = useState<{ propertyId: string; projectId: string; projectName: string } | null>(null);
  const [pinSavingProjectId, setPinSavingProjectId] = useState<string | null>(null);
  const [photoPlacement, setPhotoPlacement] = useState<{ photoId: string; propertyId: string; projectId: string; label: string } | null>(null);
  const [photoSavingId, setPhotoSavingId] = useState<string | null>(null);
  const [areaEditProject, setAreaEditProject] = useState<{ propertyId: string; projectId: string; projectName: string } | null>(null);
  const [pendingAreaGeojson, setPendingAreaGeojson] = useState<PropertyBoundaryGeoJson | null | undefined>(undefined);
  const [areaSavingProjectId, setAreaSavingProjectId] = useState<string | null>(null);
  const [areaSelectionActive, setAreaSelectionActive] = useState(false);
  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>([]);
  const [areaAssignmentOpen, setAreaAssignmentOpen] = useState(false);
  const [areaAssignmentDraft, setAreaAssignmentDraft] = useState({
    employeeId: '',
    taskId: '',
    date: localDateKey(),
    startTime: '07:00',
    estimatedHours: '',
    notes: '',
    equipmentId: NO_EQUIPMENT_VALUE,
  });
  const properties = boundariesQuery.data ?? [];
  const [selectedPropertyId, setSelectedPropertyId] = usePagePropertySelection({
    currentUser,
    properties,
  });
  const locatedPhotosQuery = useLocatedProjectPhotos(orgId ?? undefined, selectedPropertyId);
  const mappedCount = properties.filter((property) => property.boundaryGeojson).length;
  const selectedProperty = selectedPropertyId === 'all'
    ? null
    : properties.find((property) => property.id === selectedPropertyId) ?? null;
  const canViewMap = currentRole === 'admin' || currentRole === 'manager';
  const hasConcretePropertySelected = selectedPropertyId !== 'all' && Boolean(selectedProperty);
  const assignmentEmployeesQuery = useEmployees(undefined, orgId ?? undefined, 'active');
  const tasksQuery = useTasks(undefined, orgId ?? undefined);
  const equipmentQuery = useEquipmentUnits(hasConcretePropertySelected ? selectedPropertyId : undefined, orgId ?? undefined);
  const hasPendingBoundaryChange = pendingBoundaryGeojson !== undefined;
  const hasPendingAreaChange = pendingAreaGeojson !== undefined;
  const geoNotesQuery = useNotes(selectedPropertyId, orgId ?? undefined);
  const completeNoteMutation = useCompleteNote(orgId ?? undefined);
  const editingAreaProject = areaEditProject
    ? selectedProperty?.projects.find((project) => project.id === areaEditProject.projectId) ?? null
    : null;
  const editingAreaAcres = geojsonPolygonAcres(
    hasPendingAreaChange ? pendingAreaGeojson : editingAreaProject?.areaGeojson,
  );
  const photoPins = useMemo(
    () => {
      const projectNameById = new Map<string, string>();
      properties.forEach((property) => {
        property.projects.forEach((project) => projectNameById.set(project.id, project.name));
      });
      return (locatedPhotosQuery.data ?? []).map((photo) => ({
        ...photo,
        projectName: projectNameById.get(photo.projectId),
      }));
    },
    [locatedPhotosQuery.data, properties],
  );
  const geoNotePins = useMemo(
    () =>
      (geoNotesQuery.data ?? []).filter(
        (note) => (note.type === 'geo' || (note.type === 'todo' && !note.completedAt)) && note.locationGeojson,
      ),
    [geoNotesQuery.data],
  );
  const mappedAreasForSelectedProperty = useMemo(
    () => (selectedProperty?.projects ?? []).filter((project) => project.areaGeojson),
    [selectedProperty],
  );
  const selectedAreaSet = useMemo(() => new Set(selectedAreaIds), [selectedAreaIds]);
  const selectedAreas = useMemo(
    () => mappedAreasForSelectedProperty.filter((project) => selectedAreaSet.has(project.id)),
    [mappedAreasForSelectedProperty, selectedAreaSet],
  );
  const selectedAreaTotalAcres = useMemo(
    () => selectedAreas.reduce((sum, project) => sum + (project.calculatedAreaAcres ?? geojsonPolygonAcres(project.areaGeojson) ?? 0), 0),
    [selectedAreas],
  );
  const handleCompleteNote = async (note: (typeof geoNotePins)[number]) => {
    if (note.type !== 'todo' || note.completedAt) return;
    if (!note.propertyId) {
      toast.error('To-do notes need a property before they can be completed.');
      return;
    }
    if (!currentUser?.employeeId) {
      toast.error('Employee profile is required to complete a to-do.');
      return;
    }
    try {
      await completeNoteMutation.mutateAsync({
        noteId: note.id,
        propertyId: note.propertyId,
        completedBy: currentUser.employeeId,
      });
      toast.success('To-do completed.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to complete to-do.');
    }
  };
  const selectedAreaBreakdown = useMemo(
    () => PROJECT_AREA_TYPES.flatMap((areaType) => {
      const matching = selectedAreas.filter((project) => project.areaType === areaType);
      if (matching.length === 0) return [];
      const acres = matching.reduce((sum, project) => sum + (project.calculatedAreaAcres ?? geojsonPolygonAcres(project.areaGeojson) ?? 0), 0);
      return [{ areaType, count: matching.length, acres }];
    }),
    [selectedAreas],
  );
  const selectedAssignmentTask = useMemo(
    () => (tasksQuery.data ?? []).find((task) => task.id === areaAssignmentDraft.taskId) ?? null,
    [areaAssignmentDraft.taskId, tasksQuery.data],
  );

  const handleSelectProperty = (propertyId: string) => {
    if (propertyId !== selectedPropertyId) setSelectedProjectId(null);
    setAreaSelectionActive(false);
    setSelectedAreaIds([]);
    setSelectedPropertyId(propertyId);
  };

  const handleSelectWorkspaceProject = (projectId: string | null) => {
    setEditMode(false);
    setPinPlacementProject(null);
    setPhotoPlacement(null);
    setAreaEditProject(null);
    setPendingAreaGeojson(undefined);
    setAreaSelectionActive(false);
    setSelectedAreaIds([]);
    setSelectedProjectId(projectId);
  };

  useEffect(() => {
    setEditMode(false);
    setPendingBoundaryGeojson(undefined);
    setPinPlacementProject(null);
    setPhotoPlacement(null);
    setAreaEditProject(null);
    setPendingAreaGeojson(undefined);
    setAreaSelectionActive(false);
    setSelectedAreaIds([]);
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
    setPhotoPlacement(null);
    setAreaSelectionActive(false);
    setSelectedAreaIds([]);
    setSelectedProjectId(project.id);
    setSelectedPropertyId(project.propertyId);
    setPinPlacementProject({ propertyId: project.propertyId, projectId: project.id, projectName: project.name });
  };

  const handleSelectProject = (propertyId: string, projectId: string) => {
    setEditMode(false);
    setPinPlacementProject(null);
    setPhotoPlacement(null);
    setAreaEditProject(null);
    setPendingAreaGeojson(undefined);
    setAreaSelectionActive(false);
    setSelectedAreaIds([]);
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
    setPhotoPlacement(null);
    setSelectedProjectId(project.id);
    setSelectedPropertyId(project.propertyId);
    setAreaEditProject({ propertyId: project.propertyId, projectId: project.id, projectName: project.name });
    setAreaSelectionActive(false);
    setSelectedAreaIds([]);
    setPendingAreaGeojson(undefined);
  };

  const handleCancelEditArea = () => {
    if (areaSavingProjectId) return;
    setAreaEditProject(null);
    setPendingAreaGeojson(undefined);
  };

  const handleStartPlacePhoto = (photo: ProjectPhoto) => {
    if (!canViewMap || photoSaveInFlightRef.current) return;
    if (!photo.propertyId || photo.propertyId === 'all') {
      toast.error('Select a property before placing a photo.');
      return;
    }
    if (!photo.projectId || photo.projectId === 'all') {
      toast.error('Choose a project before placing a photo.');
      return;
    }
    setEditMode(false);
    setPendingBoundaryGeojson(undefined);
    setPinPlacementProject(null);
    setAreaEditProject(null);
    setPendingAreaGeojson(undefined);
    setAreaSelectionActive(false);
    setSelectedAreaIds([]);
    setSelectedProjectId(photo.projectId);
    setSelectedPropertyId(photo.propertyId);
    setPhotoPlacement({
      photoId: photo.id,
      propertyId: photo.propertyId,
      projectId: photo.projectId,
      label: photo.caption || 'progress photo',
    });
  };

  const handleCancelPhotoPlacement = () => {
    if (photoSaveInFlightRef.current) return;
    setPhotoPlacement(null);
  };

  const handleClearPhotoPin = async (photo: ProjectPhoto) => {
    if (!canViewMap || !orgId || photoSaveInFlightRef.current) return;
    const confirmed = window.confirm('Clear this photo pin from the map?');
    if (!confirmed) return;
    photoSaveInFlightRef.current = true;
    setPhotoSavingId(photo.id);
    try {
      await setPhotoLocationMutation.mutateAsync({
        propertyId: photo.propertyId,
        projectId: photo.projectId,
        photoId: photo.id,
        latitude: null,
        longitude: null,
      });
      if (photoPlacement?.photoId === photo.id) setPhotoPlacement(null);
      toast.success('Photo pin cleared.');
    } catch (error) {
      console.error('Photo pin clear failed:', error);
      toast.error(error instanceof Error ? error.message : 'Photo pin could not be cleared.');
    } finally {
      photoSaveInFlightRef.current = false;
      setPhotoSavingId(null);
    }
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

  const handlePlacePhotoPin = async (latitude: number, longitude: number) => {
    if (!photoPlacement || !orgId || photoSaveInFlightRef.current) return;
    photoSaveInFlightRef.current = true;
    setPhotoSavingId(photoPlacement.photoId);
    try {
      await setPhotoLocationMutation.mutateAsync({
        propertyId: photoPlacement.propertyId,
        projectId: photoPlacement.projectId,
        photoId: photoPlacement.photoId,
        latitude,
        longitude,
      });
      setSelectedProjectId(photoPlacement.projectId);
      setPhotoPlacement(null);
      toast.success('Photo pin saved.');
    } catch (error) {
      console.error('Photo pin save failed:', error);
      toast.error(error instanceof Error ? error.message : 'Photo pin could not be saved.');
    } finally {
      photoSaveInFlightRef.current = false;
      setPhotoSavingId(null);
    }
  };

  const handleToggleAreaSelectionMode = () => {
    if (!hasConcretePropertySelected) {
      toast.error('Select one property before selecting areas.');
      return;
    }
    if (editMode || pinPlacementProject || photoPlacement || areaEditProject) {
      toast.error('Finish the current map edit before selecting areas.');
      return;
    }
    setAreaSelectionActive((current) => !current);
  };

  const handleToggleSelectedArea = (project: PropertyProject) => {
    if (!hasConcretePropertySelected || project.propertyId !== selectedPropertyId) {
      toast.error('Area selection is limited to one property at a time.');
      return;
    }
    setSelectedAreaIds((current) =>
      current.includes(project.id)
        ? current.filter((id) => id !== project.id)
        : [...current, project.id],
    );
  };

  const handleOpenAreaAssignment = () => {
    if (selectedAreas.length === 0) {
      toast.error('Select at least one area before assigning crew.');
      return;
    }
    setAreaAssignmentDraft((current) => ({
      ...current,
      date: current.date || localDateKey(),
      estimatedHours: current.estimatedHours || (selectedAssignmentTask ? String(getTaskEstimatedHours(selectedAssignmentTask)) : ''),
    }));
    setAreaAssignmentOpen(true);
  };

  const handleSaveAreaAssignment = async () => {
    if (!orgId || !selectedProperty || selectedPropertyId === 'all') return;
    if (selectedAreas.length === 0) {
      toast.error('Select at least one area before assigning crew.');
      return;
    }
    const task = (tasksQuery.data ?? []).find((candidate) => candidate.id === areaAssignmentDraft.taskId);
    if (!task) {
      toast.error('Choose a task.');
      return;
    }
    const estimatedHours = Number(areaAssignmentDraft.estimatedHours);
    if (!Number.isFinite(estimatedHours) || estimatedHours < 0) {
      toast.error('Enter valid estimated hours.');
      return;
    }
    try {
      await createAreaScopedAssignmentMutation.mutateAsync({
        propertyId: selectedProperty.id,
        employeeId: areaAssignmentDraft.employeeId,
        taskId: task.id,
        taskTitle: task.name,
        projectIds: selectedAreas.map((project) => project.id),
        date: areaAssignmentDraft.date,
        startTime: areaAssignmentDraft.startTime,
        estimatedHours,
        notes: areaAssignmentDraft.notes,
        equipmentUnitId: areaAssignmentDraft.equipmentId === NO_EQUIPMENT_VALUE ? null : areaAssignmentDraft.equipmentId,
      });
      toast.success(`Assigned ${selectedAreas.length} area${selectedAreas.length === 1 ? '' : 's'} to crew.`);
      setAreaAssignmentOpen(false);
      setAreaSelectionActive(false);
      setSelectedAreaIds([]);
      setAreaAssignmentDraft({
        employeeId: '',
        taskId: '',
        date: localDateKey(),
        startTime: '07:00',
        estimatedHours: '',
        notes: '',
        equipmentId: NO_EQUIPMENT_VALUE,
      });
    } catch (error) {
      console.error('Area assignment save failed:', error);
      toast.error(error instanceof Error ? error.message : 'Selected areas could not be assigned.');
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
          <div className="flex items-center gap-2 text-3xs font-semibold uppercase tracking-[0.18em] text-text-muted">
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
              Editing area for {areaEditProject.projectName}
              {editingAreaAcres !== null ? ` — ${formatAcres(editingAreaAcres)}` : ''}
              {hasPendingAreaChange ? ' · unsaved changes are ready to save.' : '.'}
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
              setPhotoPlacement(null);
              setAreaEditProject(null);
              setPendingAreaGeojson(undefined);
              setAreaSelectionActive(false);
              setSelectedAreaIds([]);
              setEditMode((current) => !current);
            }}
            disabled={!hasConcretePropertySelected || saveBoundaryMutation.isPending || Boolean(pinSavingProjectId) || Boolean(photoSavingId) || Boolean(areaSavingProjectId) || areaSelectionActive}
          >
            <Edit3 className="mr-2 h-4 w-4" />
            {editMode ? 'Editing' : 'Edit boundary'}
          </Button>
          <Button
            type="button"
            className="h-10 rounded-xl"
            onClick={() => void handleSaveBoundary()}
            disabled={!hasPendingBoundaryChange || !hasConcretePropertySelected || saveBoundaryMutation.isPending || Boolean(pinPlacementProject) || Boolean(photoPlacement) || Boolean(areaEditProject)}
          >
            <Save className="mr-2 h-4 w-4" />
            {saveBoundaryMutation.isPending ? 'Saving...' : 'Save boundary'}
          </Button>
          <Button
            type="button"
            variant={areaSelectionActive ? 'default' : 'outline'}
            className="h-10 rounded-xl border-surface-border bg-surface-card/80"
            onClick={handleToggleAreaSelectionMode}
            disabled={!hasConcretePropertySelected || editMode || Boolean(pinPlacementProject) || Boolean(photoPlacement) || Boolean(areaEditProject)}
          >
            <MousePointer2 className="mr-2 h-4 w-4" />
            {areaSelectionActive ? 'Selecting areas' : 'Select areas'}
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
            disabled={boundariesQuery.isFetching || saveBoundaryMutation.isPending || Boolean(areaSavingProjectId) || Boolean(photoSavingId)}
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
          className={areaEditProject || pinPlacementProject || photoPlacement ? 'h-[min(78vh,780px)] min-h-[620px] max-h-[820px]' : hasConcretePropertySelected ? 'h-[380px] min-h-[320px] max-h-[420px]' : undefined}
          editMode={editMode}
          canEditBoundary={canViewMap}
          selectedProjectId={selectedProjectId}
          pinPlacementProject={pinPlacementProject}
          pinPlacementDisabled={Boolean(pinSavingProjectId)}
          photoPins={photoPins}
          geoNotes={geoNotePins}
          completingNoteId={completeNoteMutation.isPending ? completeNoteMutation.variables?.noteId ?? null : null}
          photoPlacementActive={Boolean(photoPlacement)}
          photoPlacementDisabled={Boolean(photoSavingId)}
          areaEditProjectId={areaEditProject?.projectId ?? null}
          areaSelectionActive={areaSelectionActive}
          selectedAreaIds={selectedAreaIds}
          onBoundaryChange={setPendingBoundaryGeojson}
          onAreaChange={setPendingAreaGeojson}
          onAreaCreate={handleFinishArea}
          onSelectProperty={handleSelectProperty}
          onSelectProject={handleSelectProject}
          onToggleAreaSelection={handleToggleSelectedArea}
          onAssignSelectedAreas={handleOpenAreaAssignment}
          onCancelAreaSelection={() => {
            setAreaSelectionActive(false);
            setSelectedAreaIds([]);
          }}
          onPlaceProjectPin={handlePlaceProjectPin}
          onPlacePhotoPin={handlePlacePhotoPin}
          onSelectPhoto={(photo) => {
            setSelectedProjectId(photo.projectId);
            if (photo.propertyId && photo.propertyId !== selectedPropertyId) setSelectedPropertyId(photo.propertyId);
          }}
          onCompleteNote={(note) => void handleCompleteNote(note)}
          onCancelPinPlacement={handleCancelPinPlacement}
          onCancelPhotoPlacement={handleCancelPhotoPlacement}
        />
      )}
      <Dialog open={areaAssignmentOpen} onOpenChange={setAreaAssignmentOpen}>
        <DialogContent className="max-w-xl border-surface-border bg-surface-card">
          <DialogHeader>
            <DialogTitle>Assign selected areas</DialogTitle>
            <DialogDescription>
              Create one planned board assignment and scope it to the selected mapped zones.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-surface-border bg-surface-elevated p-3">
              <div className="text-3xs font-semibold uppercase tracking-wide text-text-muted">Selection</div>
              <div className="mt-1 text-sm font-semibold text-text-primary">
                {selectedAreas.length} area{selectedAreas.length === 1 ? '' : 's'} · {formatSquareFeet(acresToSquareFeet(selectedAreaTotalAcres))} · {formatAcres(selectedAreaTotalAcres)}
              </div>
              {selectedAreaBreakdown.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-text-secondary">
                  {selectedAreaBreakdown.map((entry) => (
                    <span key={entry.areaType} className="rounded-full border border-surface-border bg-surface-card px-2 py-1">
                      {PROJECT_AREA_TYPE_LABELS[entry.areaType]}: {entry.count}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm font-medium text-text-secondary">
                Crew member
                <Select
                  value={areaAssignmentDraft.employeeId}
                  onValueChange={(employeeId) => setAreaAssignmentDraft((current) => ({ ...current, employeeId }))}
                >
                  <SelectTrigger className="border-surface-border bg-surface-elevated text-text-primary">
                    <SelectValue placeholder={assignmentEmployeesQuery.isLoading ? 'Loading crew...' : 'Choose crew'} />
                  </SelectTrigger>
                  <SelectContent>
                    {(assignmentEmployeesQuery.data ?? []).map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.firstName} {employee.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="space-y-1.5 text-sm font-medium text-text-secondary">
                Task
                <Select
                  value={areaAssignmentDraft.taskId}
                  onValueChange={(taskId) => {
                    const nextTask = (tasksQuery.data ?? []).find((task) => task.id === taskId) ?? null;
                    setAreaAssignmentDraft((current) => ({
                      ...current,
                      taskId,
                      estimatedHours: current.estimatedHours || String(getTaskEstimatedHours(nextTask)),
                    }));
                  }}
                >
                  <SelectTrigger className="border-surface-border bg-surface-elevated text-text-primary">
                    <SelectValue placeholder={tasksQuery.isLoading ? 'Loading tasks...' : 'Choose task'} />
                  </SelectTrigger>
                  <SelectContent>
                    {(tasksQuery.data ?? []).map((task) => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.category} · {task.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="space-y-1.5 text-sm font-medium text-text-secondary">
                Date
                <Input
                  type="date"
                  value={areaAssignmentDraft.date}
                  onChange={(event) => setAreaAssignmentDraft((current) => ({ ...current, date: event.target.value }))}
                  className="border-surface-border bg-surface-elevated text-text-primary"
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium text-text-secondary">
                Start time
                <Input
                  type="time"
                  value={areaAssignmentDraft.startTime}
                  onChange={(event) => setAreaAssignmentDraft((current) => ({ ...current, startTime: event.target.value }))}
                  className="border-surface-border bg-surface-elevated text-text-primary"
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium text-text-secondary">
                Estimated hours
                <Input
                  type="number"
                  min="0"
                  step="0.25"
                  value={areaAssignmentDraft.estimatedHours}
                  placeholder={selectedAssignmentTask ? String(getTaskEstimatedHours(selectedAssignmentTask)) : '0'}
                  onChange={(event) => setAreaAssignmentDraft((current) => ({ ...current, estimatedHours: event.target.value }))}
                  className="border-surface-border bg-surface-elevated text-text-primary"
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium text-text-secondary">
                Equipment
                <Select
                  value={areaAssignmentDraft.equipmentId}
                  onValueChange={(equipmentId) => setAreaAssignmentDraft((current) => ({ ...current, equipmentId }))}
                >
                  <SelectTrigger className="border-surface-border bg-surface-elevated text-text-primary">
                    <SelectValue placeholder={equipmentQuery.isLoading ? 'Loading equipment...' : 'Optional'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_EQUIPMENT_VALUE}>No equipment</SelectItem>
                    {(equipmentQuery.data ?? []).map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {getEquipmentLabel(unit)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>
            <label className="space-y-1.5 text-sm font-medium text-text-secondary">
              Notes
              <Textarea
                value={areaAssignmentDraft.notes}
                onChange={(event) => setAreaAssignmentDraft((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Optional assignment notes"
                className="border-surface-border bg-surface-elevated text-text-primary"
              />
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAreaAssignmentOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSaveAreaAssignment()}
              disabled={createAreaScopedAssignmentMutation.isPending || !areaAssignmentDraft.employeeId || !areaAssignmentDraft.taskId || !areaAssignmentDraft.date}
            >
              {createAreaScopedAssignmentMutation.isPending ? 'Assigning...' : 'Create board job'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {hasConcretePropertySelected && selectedProperty ? (
        <PropertyDetailPanel
          property={selectedProperty}
          orgId={orgId}
          canManage={canViewMap}
          createdBy={currentUser?.employeeId ?? null}
          selectedProjectId={selectedProjectId}
          pinPlacementProjectId={pinPlacementProject?.projectId ?? null}
          pinPlacementSaving={Boolean(pinSavingProjectId)}
          photoPlacementPhotoId={photoPlacement?.photoId ?? null}
          photoPlacementSaving={Boolean(photoSavingId)}
          areaEditProjectId={areaEditProject?.projectId ?? null}
          areaSaving={Boolean(areaSavingProjectId)}
          onStartPlacePin={handleStartPlacePin}
          onCancelPlacePin={handleCancelPinPlacement}
          onStartPlacePhoto={handleStartPlacePhoto}
          onCancelPlacePhoto={handleCancelPhotoPlacement}
          onClearPhotoPin={(photo) => void handleClearPhotoPin(photo)}
          onStartEditArea={handleStartEditArea}
          onCancelEditArea={handleCancelEditArea}
          onClearArea={(project) => void handleClearArea(project)}
          onProjectSelect={handleSelectWorkspaceProject}
          onClose={() => {
            setSelectedProjectId(null);
            setPinPlacementProject(null);
            setPhotoPlacement(null);
            setAreaEditProject(null);
            setPendingAreaGeojson(undefined);
            setSelectedPropertyId('all');
          }}
        />
      ) : null}
    </section>
  );
}
