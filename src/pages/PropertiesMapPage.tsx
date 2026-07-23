'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { AlertTriangle, Edit3, Map, RefreshCw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/sonner';
import { PropertyDetailPanel } from '@/components/map/PropertyDetailPanel';
import { PropertySelector } from '@/components/shared/PropertySelector';
import { useOrgProfile } from '@/hooks/useOrgProfile';
import { usePropertyBoundaries, useSavePropertyBoundary, type PropertyBoundaryGeoJson } from '@/lib/supabase-queries';

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
  const { currentPropertyId, currentRole, currentUser, isOrgReady, orgId, setCurrentPropertyId } = useOrgProfile();
  const boundariesQuery = usePropertyBoundaries(orgId ?? undefined);
  const saveBoundaryMutation = useSavePropertyBoundary(orgId ?? undefined);
  const [editMode, setEditMode] = useState(false);
  const [pendingBoundaryGeojson, setPendingBoundaryGeojson] = useState<PropertyBoundaryGeoJson | null | undefined>(undefined);
  const properties = boundariesQuery.data ?? [];
  const mappedCount = properties.filter((property) => property.boundaryGeojson).length;
  const selectedProperty = currentPropertyId === 'all'
    ? null
    : properties.find((property) => property.id === currentPropertyId) ?? null;
  const canViewMap = currentRole === 'admin' || currentRole === 'manager';
  const hasConcretePropertySelected = currentPropertyId !== 'all' && Boolean(selectedProperty);
  const hasPendingBoundaryChange = pendingBoundaryGeojson !== undefined;

  useEffect(() => {
    setEditMode(false);
    setPendingBoundaryGeojson(undefined);
  }, [currentPropertyId]);

  const handleSaveBoundary = async () => {
    if (!orgId || currentPropertyId === 'all' || !hasPendingBoundaryChange) return;
    try {
      await saveBoundaryMutation.mutateAsync({
        propertyId: currentPropertyId,
        boundaryGeojson: pendingBoundaryGeojson ?? null,
      });
      setPendingBoundaryGeojson(undefined);
      toast.success('Property boundary saved.');
    } catch (error) {
      console.error('Failed to save property boundary:', error);
      toast.error(error instanceof Error ? error.message : 'Property boundary could not be saved.');
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
    <section className={`flex flex-1 flex-col gap-4 p-4 md:p-6 ${hasConcretePropertySelected ? 'xl:pr-[38rem]' : ''}`}>
      <div className="flex flex-col gap-3 rounded-xl border border-surface-border bg-surface-card p-4 shadow-sm md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
            <Map className="h-3.5 w-3.5" />
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
          {currentPropertyId === 'all' ? (
            <div className="mt-2 text-xs text-status-warning">
              Select a specific property before drawing or editing a boundary.
            </div>
          ) : null}
          {hasPendingBoundaryChange ? (
            <div className="mt-2 text-xs font-medium text-brand-bright">
              Unsaved boundary changes are ready to save.
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <PropertySelector className="sm:w-72" allowAllProperties />
          <Button
            type="button"
            variant={editMode ? 'default' : 'outline'}
            className="h-10 rounded-xl"
            onClick={() => setEditMode((current) => !current)}
            disabled={!hasConcretePropertySelected || saveBoundaryMutation.isPending}
          >
            <Edit3 className="mr-2 h-4 w-4" />
            {editMode ? 'Editing' : 'Edit boundary'}
          </Button>
          <Button
            type="button"
            className="h-10 rounded-xl"
            onClick={() => void handleSaveBoundary()}
            disabled={!hasPendingBoundaryChange || !hasConcretePropertySelected || saveBoundaryMutation.isPending}
          >
            <Save className="mr-2 h-4 w-4" />
            {saveBoundaryMutation.isPending ? 'Saving...' : 'Save boundary'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-xl border-surface-border bg-surface-card/80"
            onClick={() => void boundariesQuery.refetch()}
            disabled={boundariesQuery.isFetching || saveBoundaryMutation.isPending}
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
          currentPropertyId={currentPropertyId || 'all'}
          editMode={editMode}
          canEditBoundary={canViewMap}
          onBoundaryChange={setPendingBoundaryGeojson}
          onSelectProperty={setCurrentPropertyId}
        />
      )}
      {hasConcretePropertySelected && selectedProperty ? (
        <PropertyDetailPanel
          property={selectedProperty}
          orgId={orgId}
          canManage={canViewMap}
          createdBy={currentUser?.employeeId ?? null}
          onClose={() => setCurrentPropertyId('all')}
        />
      ) : null}
    </section>
  );
}