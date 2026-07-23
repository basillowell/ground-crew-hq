'use client';

import dynamic from 'next/dynamic';
import { AlertTriangle, Map, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PropertySelector } from '@/components/shared/PropertySelector';
import { useOrgProfile } from '@/hooks/useOrgProfile';
import { usePropertyBoundaries } from '@/lib/supabase-queries';

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

export default function PropertiesMapPage() {
  const { currentPropertyId, currentRole, isOrgReady, orgId, setCurrentPropertyId } = useOrgProfile();
  const boundariesQuery = usePropertyBoundaries(orgId ?? undefined);
  const properties = boundariesQuery.data ?? [];
  const mappedCount = properties.filter((property) => property.boundaryGeojson).length;
  const selectedProperty = currentPropertyId === 'all'
    ? null
    : properties.find((property) => property.id === currentPropertyId) ?? null;
  const canViewMap = currentRole === 'admin' || currentRole === 'manager';

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
    <section className="flex flex-1 flex-col gap-4 p-4 md:p-6">
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
              Selected: {selectedProperty.name}
              {selectedProperty.calculatedAcreage !== null
                ? ` - ${selectedProperty.calculatedAcreage.toFixed(1)} calculated acres`
                : ''}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <PropertySelector className="sm:w-72" allowAllProperties />
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-xl border-surface-border bg-surface-card/80"
            onClick={() => void boundariesQuery.refetch()}
            disabled={boundariesQuery.isFetching}
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
          onSelectProperty={setCurrentPropertyId}
        />
      )}
    </section>
  );
}