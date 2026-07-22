import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Pencil, Plus, QrCode, Trash2, Wrench } from 'lucide-react';
import { useOrgProfile } from '@/hooks/useOrgProfile';
import { createClient } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { PropertySelector } from '@/components/shared/PropertySelector';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { DateInput } from '@/components/ui/date-input';
import { Textarea } from '@/components/ui/textarea';
import { PageHeaderSkeleton, TableSkeleton } from '@/components/PageSkeleton';
import { ErrorRetry } from '@/components/ErrorRetry';
import { EmptyState } from '@/components/EmptyState';
import { toast } from '@/components/ui/sonner';
import Link from 'next/link';
import { EquipmentMaintenanceBadge, getEquipmentMaintenanceState } from '@/components/equipment/EquipmentMaintenanceBadge';
import { EquipmentQrCard } from '@/components/equipment/EquipmentQrCard';

const supabase = createClient();

type EquipmentUnitRow = {
  id: string;
  property_id: string | null;
  name: string | null;
  type: string | null;
  status: string | null;
  location: string | null;
  last_serviced: string | null;
  org_id: string | null;
  equipment_type_id: string | null;
  unit_name: string | null;
  notes: string | null;
  active: boolean | null;
  estimated_hours: number | null;
  qr_token: string | null;
  maintenance_interval_hours: number | null;
  hours_at_last_service: number | null;
};

type EquipmentTypeRow = {
  id: string;
  org_id: string | null;
  property_id: string | null;
  name: string | null;
  short_name: string | null;
  category: string | null;
  active: boolean | null;
};

type PropertyRow = {
  id: string;
  name: string | null;
  short_name: string | null;
  status: string | null;
  org_id: string | null;
};

type EquipmentStatus = 'available' | 'in_use' | 'maintenance' | 'retired';

type EquipmentPageData = {
  units: EquipmentUnitRow[];
  types: EquipmentTypeRow[];
  properties: PropertyRow[];
};

type AddDraft = {
  name: string;
  equipmentTypeId: string;
  propertyId: string;
  status: EquipmentStatus;
  location: string;
  notes: string;
  lastServiced: string;
  maintenanceIntervalHours: string;
};

type EditDraft = {
  name: string;
  equipmentTypeId: string;
  propertyId: string;
  status: EquipmentStatus;
  location: string;
  lastServiced: string;
  notes: string;
  maintenanceIntervalHours: string;
};

const STATUS_OPTIONS: EquipmentStatus[] = ['available', 'in_use', 'maintenance', 'retired'];

function normalizeStatus(raw: string | null | undefined): EquipmentStatus {
  const value = String(raw ?? '').toLowerCase();
  if (value === 'available') return 'available';
  if (value === 'in_use' || value === 'in-use') return 'in_use';
  if (value === 'maintenance') return 'maintenance';
  return 'retired';
}

function statusBadgeClass(status: EquipmentStatus) {
  if (status === 'available') return 'border-status-active/20 bg-status-active/10 text-status-active';
  if (status === 'in_use') return 'border-status-complete/20 bg-status-complete/10 text-status-complete';
  if (status === 'maintenance') return 'border-status-pending/20 bg-status-pending/10 text-status-pending';
  return 'border-surface-border bg-surface-elevated text-text-muted';
}

function statusLaneClass(status: EquipmentStatus) {
  if (status === 'available') return 'border-l-status-active';
  if (status === 'in_use') return 'border-l-status-complete';
  if (status === 'maintenance') return 'border-l-status-pending';
  return 'border-l-text-muted';
}

function statusLabel(status: EquipmentStatus) {
  if (status === 'in_use') return 'In Use';
  if (status === 'available') return 'Available';
  if (status === 'maintenance') return 'Maintenance';
  return 'Retired';
}

function toDateInput(value: string | null | undefined) {
  if (!value) return '';
  return value.slice(0, 10);
}

function parseOptionalNumberInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : Number.NaN;
}

function emptyAddDraft(): AddDraft {
  return {
    name: '',
    equipmentTypeId: '',
    propertyId: 'shared',
    status: 'available',
    location: '',
    notes: '',
    lastServiced: '',
    maintenanceIntervalHours: '',
  };
}

type AbortableSupabaseRequest<T> = {
  abortSignal: (signal: AbortSignal) => PromiseLike<T>;
};

async function withEquipmentRequestTimeout<T>(request: AbortableSupabaseRequest<T>): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);
  try {
    return await request.abortSignal(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('Equipment request timed out after 15 seconds.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
async function withEquipmentMutationTimeout<T extends { error: unknown }>(request: AbortableSupabaseRequest<T>): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);
  try {
    return await request.abortSignal(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      return { data: null, error: new Error('Save timed out — please try again') } as T;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
export default function EquipmentPage() {
  const { currentUser, currentPropertyId, userRole } = useOrgProfile();
  const isReadOnly = String(userRole ?? '') === 'viewer';
  const orgId = currentUser?.orgId ?? '';
  const propertyId = currentPropertyId && currentPropertyId !== 'all' ? currentPropertyId : null;

  const queryClient = useQueryClient();
  const equipmentQueryKey = useMemo(
    () => ['equipment-page-data', orgId || 'no-org', propertyId ?? 'all-properties'] as const,
    [orgId, propertyId],
  );
  const equipmentQuery = useQuery<EquipmentPageData>({
    queryKey: equipmentQueryKey,
    enabled: Boolean(orgId),
    queryFn: async () => {
      if (!supabase || !orgId) return { units: [], types: [], properties: [] };

      const unitsQuery = supabase
        .from('equipment_units')
        .select('id, property_id, name, type, status, location, last_serviced, org_id, equipment_type_id, unit_name, notes, active, estimated_hours, qr_token, maintenance_interval_hours, hours_at_last_service')
        .eq('org_id', orgId)
        .order('unit_name', { ascending: true });

      const typesQuery = supabase
        .from('equipment_types')
        .select('id, org_id, property_id, name, short_name, category, active')
        .eq('org_id', orgId)
        .order('name', { ascending: true });

      const propertiesQuery = supabase
        .from('properties')
        .select('id, name, short_name, status, org_id')
        .eq('org_id', orgId)
        .order('sort_order', { ascending: true });

      if (propertyId) {
        unitsQuery.or(`property_id.is.null,property_id.eq.${propertyId}`);
      }

      const [unitsResult, typesResult, propertiesResult] = await Promise.all([
        withEquipmentRequestTimeout(unitsQuery),
        withEquipmentRequestTimeout(typesQuery),
        withEquipmentRequestTimeout(propertiesQuery),
      ]);
      if (unitsResult.error || typesResult.error || propertiesResult.error) {
        throw new Error(
          unitsResult.error?.message
          ?? typesResult.error?.message
          ?? propertiesResult.error?.message
          ?? 'Could not load equipment data.',
        );
      }

      return {
        units: (unitsResult.data ?? []) as EquipmentUnitRow[],
        types: (typesResult.data ?? []) as EquipmentTypeRow[],
        properties: (propertiesResult.data ?? []) as PropertyRow[],
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  const units = equipmentQuery.data?.units ?? [];
  const types = equipmentQuery.data?.types ?? [];
  const properties = equipmentQuery.data?.properties ?? [];
  const loading = equipmentQuery.isLoading && !equipmentQuery.data;
  const loadError = equipmentQuery.error instanceof Error ? equipmentQuery.error.message : null;
  const [error, setError] = useState<string | null>(null);
  const displayError = error ?? loadError;
  const [addOpen, setAddOpen] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [addDraft, setAddDraft] = useState<AddDraft>(emptyAddDraft);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [rowSavingId, setRowSavingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'readiness'>('list');
  const [detailRowId, setDetailRowId] = useState<string | null>(null);
  const [serviceSavingId, setServiceSavingId] = useState<string | null>(null);
  const canAddEquipment = !isReadOnly;

  useEffect(() => {
    document.title = 'Equipment — Ground Crew HQ';
  }, []);

  const typeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const type of types) {
      if (type.id && type.name) map.set(type.id, type.name);
    }
    return map;
  }, [types]);
  const activeEquipmentTypes = useMemo(
    () => types.filter((type) => type.active !== false),
    [types],
  );
  const activeProperties = useMemo(
    () => properties.filter((property) => property.status !== 'inactive'),
    [properties],
  );
  const propertyNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const property of properties) {
      map.set(property.id, property.name ?? property.short_name ?? 'Unnamed property');
    }
    return map;
  }, [properties]);

  const rows = useMemo(() => {
    return units.map((unit) => {
      const resolvedName = unit.unit_name || unit.name || 'Unnamed equipment';
      const resolvedType = unit.equipment_type_id
        ? typeNameById.get(unit.equipment_type_id) || unit.type || 'Unassigned'
        : unit.type || 'Unassigned';
      const displayPropertyName = unit.property_id
        ? propertyNameById.get(unit.property_id) ?? 'Unknown property'
        : 'Shared';
      return {
        ...unit,
        displayName: resolvedName,
        displayType: resolvedType,
        displayPropertyName,
        normalizedStatus: normalizeStatus(unit.status),
        maintenanceState: getEquipmentMaintenanceState(unit),
      };
    });
  }, [propertyNameById, typeNameById, units]);

  const scopedRows = useMemo(() => {
    if (!propertyId) return rows;
    return rows.filter((row) => row.property_id === propertyId || row.property_id === null);
  }, [propertyId, rows]);

  const readinessRows = useMemo(() => {
    return scopedRows
      .map((row) => {
        const state = row.maintenanceState;
        const readinessLevel: 'green' | 'yellow' | 'red' = state.due ? 'red' : state.dueSoon ? 'yellow' : 'green';
        const sortWeight = state.due ? 0 : state.dueSoon ? 1 : 2;
        return {
          ...row,
          readinessLevel,
          readinessLabel: state.label,
          dueText: state.description,
          sortWeight,
        };
      })
      .sort((a, b) => {
        if (a.sortWeight !== b.sortWeight) return a.sortWeight - b.sortWeight;
        return a.displayName.localeCompare(b.displayName);
      });
  }, [scopedRows]);

  const selectedDetailRow = useMemo(() => scopedRows.find((row) => row.id === detailRowId) ?? null, [detailRowId, scopedRows]);

  const selectedDetailScanUrl = useMemo(() => {
    if (!selectedDetailRow?.qr_token || typeof window === 'undefined') return '';
    return `${window.location.origin}/app/equipment/scan/${selectedDetailRow.qr_token}`;
  }, [selectedDetailRow?.qr_token]);

  const startAdd = useCallback(() => {
    setAddDraft(emptyAddDraft());
    setAddOpen(true);
  }, []);

  const cancelAdd = useCallback(() => {
    setAddOpen(false);
    setAddDraft(emptyAddDraft());
  }, []);

  const saveAdd = useCallback(async () => {
    if (isReadOnly) return;
    if (!supabase || !orgId || !addDraft.name.trim()) return;
    if (addDraft.propertyId !== 'shared' && !addDraft.propertyId) {
      toast.error('Choose Shared or select a specific property.');
      return;
    }

    setAddSaving(true);
    const selectedTypeName = typeNameById.get(addDraft.equipmentTypeId) ?? null;
    const selectedPropertyId = addDraft.propertyId === 'shared' ? null : addDraft.propertyId;
    const maintenanceIntervalHours = parseOptionalNumberInput(addDraft.maintenanceIntervalHours);
    if (Number.isNaN(maintenanceIntervalHours)) {
      toast.error('Maintenance interval must be a positive number of hours.');
      setAddSaving(false);
      return;
    }
    const payload = {
      id: crypto.randomUUID(),
      org_id: orgId,
      property_id: selectedPropertyId,
      unit_name: addDraft.name.trim(),
      name: addDraft.name.trim(),
      equipment_type_id: addDraft.equipmentTypeId || null,
      type: selectedTypeName,
      status: addDraft.status,
      location: addDraft.location.trim() || null,
      notes: addDraft.notes.trim() || null,
      active: addDraft.status !== 'retired',
      last_serviced: addDraft.lastServiced || null,
      maintenance_interval_hours: maintenanceIntervalHours,
      hours_at_last_service: addDraft.lastServiced ? 0 : null,
    };

    const { error: insertError } = await withEquipmentMutationTimeout(supabase.from('equipment_units').insert(payload));
    setAddSaving(false);
    if (insertError) {
      setError(insertError.message);
      toast.error(`Failed to add equipment: ${insertError.message}`);
      return;
    }

    cancelAdd();
    setError(null);
    await queryClient.invalidateQueries({ queryKey: equipmentQueryKey });
    toast.success(`Added equipment: ${addDraft.name.trim()}`);
  }, [addDraft, cancelAdd, equipmentQueryKey, isReadOnly, orgId, queryClient, typeNameById]);

  const startEdit = useCallback((row: EquipmentUnitRow & { displayName: string; displayType: string; normalizedStatus: EquipmentStatus }) => {
    setEditingId(row.id);
    setEditDraft({
      name: row.displayName,
      equipmentTypeId: row.equipment_type_id ?? '',
      propertyId: row.property_id ?? 'shared',
      status: row.normalizedStatus,
      location: row.location ?? '',
      lastServiced: toDateInput(row.last_serviced),
      notes: row.notes ?? '',
      maintenanceIntervalHours: row.maintenance_interval_hours == null ? '' : String(row.maintenance_interval_hours),
    });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditDraft(null);
  }, []);

  const saveEdit = useCallback(async (id: string) => {
    if (isReadOnly) return;
    if (!supabase || !editDraft || !orgId || !editDraft.name.trim()) return;
    if (editDraft.propertyId !== 'shared' && !editDraft.propertyId) {
      toast.error('Choose Shared or select a specific property.');
      return;
    }
    setRowSavingId(id);

    const selectedTypeName = typeNameById.get(editDraft.equipmentTypeId) ?? null;
    const selectedPropertyId = editDraft.propertyId === 'shared' ? null : editDraft.propertyId;
    const maintenanceIntervalHours = parseOptionalNumberInput(editDraft.maintenanceIntervalHours);
    if (Number.isNaN(maintenanceIntervalHours)) {
      toast.error('Maintenance interval must be a positive number of hours.');
      setRowSavingId(null);
      return;
    }
    const payload = {
      unit_name: editDraft.name.trim(),
      name: editDraft.name.trim(),
      equipment_type_id: editDraft.equipmentTypeId || null,
      property_id: selectedPropertyId,
      type: selectedTypeName,
      status: editDraft.status,
      location: editDraft.location.trim() || null,
      notes: editDraft.notes.trim() || null,
      active: editDraft.status !== 'retired',
      last_serviced: editDraft.lastServiced || null,
      maintenance_interval_hours: maintenanceIntervalHours,
      org_id: orgId,
    };

    const { error: updateError } = await withEquipmentMutationTimeout(
      supabase.from('equipment_units').update(payload).eq('id', id).eq('org_id', orgId),
    );
    setRowSavingId(null);
    if (updateError) {
      setError(updateError.message);
      toast.error(`Failed to update equipment: ${updateError.message}`);
      return;
    }
    cancelEdit();
    setError(null);
    await queryClient.invalidateQueries({ queryKey: equipmentQueryKey });
    toast.success(`Updated equipment: ${editDraft.name.trim()}`);
  }, [cancelEdit, editDraft, equipmentQueryKey, isReadOnly, orgId, queryClient, typeNameById]);

  const logServiceForRow = useCallback(async (row: EquipmentUnitRow & { displayName: string }) => {
    if (isReadOnly) return;
    if (!supabase || !orgId) return;
    setServiceSavingId(row.id);
    const estimatedHours = Number(row.estimated_hours ?? 0);
    const today = new Date().toISOString().slice(0, 10);
    const { error: updateError } = await withEquipmentMutationTimeout(
      supabase
        .from('equipment_units')
        .update({ hours_at_last_service: estimatedHours, last_serviced: today, status: 'available', active: true, org_id: orgId })
        .eq('id', row.id)
        .eq('org_id', orgId),
    );
    setServiceSavingId(null);
    if (updateError) {
      setError(updateError.message);
      toast.error(`Failed to log service: ${updateError.message}`);
      return;
    }
    setError(null);
    await queryClient.invalidateQueries({ queryKey: equipmentQueryKey });
    toast.success(`Service logged for ${row.displayName}`);
  }, [equipmentQueryKey, isReadOnly, orgId, queryClient]);

  const removeRow = useCallback(async (id: string) => {
    if (isReadOnly) return;
    if (!supabase || !orgId) return;
    setDeleteId(id);
    const { error: deleteError } = await withEquipmentMutationTimeout(
      supabase.from('equipment_units').delete().eq('id', id).eq('org_id', orgId),
    );
    setDeleteId(null);
    if (deleteError) {
      setError(deleteError.message);
      toast.error(`Failed to delete equipment: ${deleteError.message}`);
      return;
    }
    setError(null);
    await queryClient.invalidateQueries({ queryKey: equipmentQueryKey });
    toast.success('Equipment deleted');
  }, [equipmentQueryKey, isReadOnly, orgId, queryClient]);

  if (!orgId || loading) {
    return (
      <div className="space-y-6 p-6">
        <PageHeaderSkeleton />
        <TableSkeleton rows={6} />
      </div>
    );
  }

  return (
    <div className="animate-fade-up space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <PropertySelector className="w-full md:w-64" />
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-surface-border bg-surface-card p-0.5">
            <Button
              type="button"
              size="sm"
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              className="h-8 px-3"
              onClick={() => setViewMode('list')}
            >
              List
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === 'readiness' ? 'default' : 'ghost'}
              className="h-8 px-3"
              onClick={() => setViewMode('readiness')}
            >
              Readiness
            </Button>
          </div>
          {!isReadOnly ? (
            <Button size="sm" className="h-9 gap-1.5" onClick={startAdd} disabled={!canAddEquipment}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add Equipment
            </Button>
          ) : null}
        </div>
      </div>

      {displayError ? <ErrorRetry message={displayError} onRetry={() => { setError(null); void equipmentQuery.refetch(); }} /> : null}

      {viewMode === 'list' ? (
      <>
      <div className="hidden overflow-x-auto rounded-xl border border-surface-border bg-surface-card md:block">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-elevated text-xs uppercase tracking-wider text-text-muted">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-widest text-text-muted">Name</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-widest text-text-muted">Type</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-widest text-text-muted">Status</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-widest text-text-muted">Location</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-widest text-text-muted">Maintenance</th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-widest text-text-muted">Actions</th>
            </tr>
          </thead>
          <tbody>
            {scopedRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8">
                  <EmptyState
                    icon={Wrench}
                    title="No equipment tracked yet"
                    description="Add your first piece of equipment to start tracking maintenance."
                    actionLabel="Add Equipment"
                    onAction={canAddEquipment ? startAdd : undefined}
                  />
                </td>
              </tr>
            ) : (
              scopedRows.map((row) => {
                const isEditing = editingId === row.id && editDraft;
                return (
                  <tr key={row.id} className="border-t border-surface-border align-top transition-colors hover:bg-surface-hover">
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <Input
                          value={editDraft.name}
                          onChange={(event) => setEditDraft({ ...editDraft, name: event.target.value })}
                        />
                      ) : (
                        <span className="font-medium text-text-primary">{row.displayName}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <select
                          value={editDraft.equipmentTypeId}
                          onChange={(event) => setEditDraft({ ...editDraft, equipmentTypeId: event.target.value })}
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="">Select type</option>
                          {activeEquipmentTypes.map((type) => (
                              <option key={type.id} value={type.id}>
                                {type.name ?? 'Unnamed Type'}
                              </option>
                            ))}
                        </select>
                      ) : (
                        row.displayType
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <select
                          value={editDraft.status}
                          onChange={(event) => setEditDraft({ ...editDraft, status: event.target.value as EquipmentStatus })}
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {statusLabel(status)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Badge variant="outline" className={statusBadgeClass(row.normalizedStatus)}>
                          {statusLabel(row.normalizedStatus)}
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <div className="space-y-2">
                          <select
                            value={editDraft.propertyId}
                            onChange={(event) => setEditDraft({ ...editDraft, propertyId: event.target.value })}
                            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          >
                            <option value="shared">Shared (all properties)</option>
                            {activeProperties.map((property) => (
                              <option key={property.id} value={property.id}>
                                {property.name ?? property.short_name ?? 'Unnamed property'}
                              </option>
                            ))}
                          </select>
                          <Input
                            value={editDraft.location}
                            onChange={(event) => setEditDraft({ ...editDraft, location: event.target.value })}
                            placeholder="Location"
                          />
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {row.property_id === null ? (
                            <Badge variant="outline" className="border-brand-dim bg-brand-ghost text-brand">Shared</Badge>
                          ) : (
                            <span className="font-medium text-text-primary">{row.displayPropertyName}</span>
                          )}
                          {row.location ? <p className="text-xs text-text-muted">{row.location}</p> : null}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <div className="space-y-2">
                          <DateInput
                            value={editDraft.lastServiced}
                            onChange={(event) => setEditDraft({ ...editDraft, lastServiced: event.target.value })}
                          />
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={editDraft.maintenanceIntervalHours}
                            onChange={(event) => setEditDraft({ ...editDraft, maintenanceIntervalHours: event.target.value })}
                            placeholder="Interval hours"
                          />
                          <Textarea
                            value={editDraft.notes}
                            onChange={(event) => setEditDraft({ ...editDraft, notes: event.target.value })}
                            placeholder="Notes"
                            className="min-h-16"
                          />
                        </div>
                      ) : (                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <EquipmentMaintenanceBadge unit={row} />
                            {row.maintenanceState.due ? <AlertTriangle className="h-4 w-4 text-status-warning" aria-label="Service due" /> : null}
                          </div>
                          <p className="text-xs text-text-muted">{Number(row.estimated_hours ?? 0).toFixed(1)}h current</p>
                          <p className="text-xs text-text-muted">Last serviced: {row.last_serviced ? new Date(row.last_serviced).toLocaleDateString() : '—'}</p>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={cancelEdit}>
                            Cancel
                          </Button>
                          <Button size="sm" onClick={() => void saveEdit(row.id)} disabled={rowSavingId === row.id}>
                            {rowSavingId === row.id ? 'Saving...' : 'Save'}
                          </Button>
                        </div>
                      ) : !isReadOnly ? (
                        <div className="flex justify-end gap-1">
                          <Button variant="outline" size="icon" onClick={() => setDetailRowId(row.id)} aria-label="View equipment details">
                            <QrCode className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="icon" onClick={() => startEdit(row)} aria-label="Edit equipment">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              const ok = window.confirm('Delete this equipment unit?');
                              if (ok) void removeRow(row.id);
                            }}
                            disabled={deleteId === row.id}
                            aria-label="Delete equipment"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {scopedRows.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="No equipment tracked yet"
            description="Add your first piece of equipment to start tracking maintenance."
            actionLabel="Add Equipment"
            onAction={canAddEquipment ? startAdd : undefined}
          />
        ) : (
          scopedRows.map((row) => {
            const isEditing = editingId === row.id && editDraft;            return (
              <div key={`mobile-eq-${row.id}`} className={`rounded-xl border border-surface-border border-l-4 bg-surface-card p-3 transition-colors hover:bg-surface-hover ${statusLaneClass(row.normalizedStatus)}`}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-medium text-text-primary">{row.displayName}</p>
                  {isEditing ? null : (
                    <Badge variant="outline" className={statusBadgeClass(row.normalizedStatus)}>{statusLabel(row.normalizedStatus)}</Badge>
                  )}
                </div>
                {isEditing ? (
                  <div className="space-y-2">
                    <Input value={editDraft.name} onChange={(event) => setEditDraft({ ...editDraft, name: event.target.value })} />
                    <select
                      value={editDraft.equipmentTypeId}
                      onChange={(event) => setEditDraft({ ...editDraft, equipmentTypeId: event.target.value })}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Select type</option>
                      {activeEquipmentTypes.map((type) => (
                        <option key={`mobile-type-${type.id}`} value={type.id}>
                          {type.name ?? 'Unnamed Type'}
                        </option>
                      ))}
                    </select>
                    <select
                      value={editDraft.propertyId}
                      onChange={(event) => setEditDraft({ ...editDraft, propertyId: event.target.value })}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="shared">Shared (all properties)</option>
                      {activeProperties.map((property) => (
                        <option key={`mobile-property-${property.id}`} value={property.id}>
                          {property.name ?? property.short_name ?? 'Unnamed property'}
                        </option>
                      ))}
                    </select>
                    <Input value={editDraft.location} onChange={(event) => setEditDraft({ ...editDraft, location: event.target.value })} placeholder="Location" />
                    <DateInput value={editDraft.lastServiced} onChange={(event) => setEditDraft({ ...editDraft, lastServiced: event.target.value })} />
                    <Input type="number" min="0" step="1" value={editDraft.maintenanceIntervalHours} onChange={(event) => setEditDraft({ ...editDraft, maintenanceIntervalHours: event.target.value })} placeholder="Interval hours" />
                    <Textarea value={editDraft.notes} onChange={(event) => setEditDraft({ ...editDraft, notes: event.target.value })} className="min-h-16" />
                  </div>
                ) : (
                  <div className="space-y-1 text-sm text-text-muted">
                    <p>Type: {row.displayType}</p>
                    <div className="flex items-center gap-2">
                      <span>Property:</span>
                      {row.property_id === null ? (
                        <Badge variant="outline" className="border-brand-dim bg-brand-ghost text-brand">Shared</Badge>
                      ) : (
                        <span>{row.displayPropertyName}</span>
                      )}
                    </div>
                    {row.location ? <p>Location: {row.location}</p> : null}
                    <div className="flex flex-wrap items-center gap-2">
                      <span>Maintenance:</span>
                      <EquipmentMaintenanceBadge unit={row} />
                    </div>
                    <p>Hours: {Number(row.estimated_hours ?? 0).toFixed(1)}h</p>
                    <p>Last serviced: {row.last_serviced ? new Date(row.last_serviced).toLocaleDateString() : '—'}</p>
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  {isEditing ? (
                    <>
                      <Button variant="outline" className="min-h-11 flex-1" onClick={cancelEdit}>Cancel</Button>
                      <Button className="min-h-11 flex-1" onClick={() => void saveEdit(row.id)} disabled={rowSavingId === row.id}>
                        {rowSavingId === row.id ? 'Saving...' : 'Save'}
                      </Button>
                    </>
                  ) : !isReadOnly ? (
                    <>
                      <Button variant="outline" className="min-h-11 flex-1" onClick={() => setDetailRowId(row.id)}>Details</Button>
                      <Button variant="outline" className="min-h-11 flex-1" onClick={() => startEdit(row)}>Edit</Button>
                      <Button
                        variant="outline"
                        className="min-h-11 flex-1"
                        onClick={() => { const ok = window.confirm('Delete this equipment unit?'); if (ok) void removeRow(row.id); }}
                        disabled={deleteId === row.id}
                      >
                        Delete
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
      </>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {readinessRows.length === 0 ? (
            <div className="md:col-span-2 xl:col-span-3">
              <EmptyState
                icon={Wrench}
                title="No equipment tracked yet"
                description="Add your first piece of equipment to start tracking maintenance."
                actionLabel="Add Equipment"
                onAction={canAddEquipment ? startAdd : undefined}
              />
            </div>
          ) : (
            readinessRows.map((row) => {
              const toneClasses =
                row.readinessLevel === 'green'
                  ? 'border-l-4 border-l-status-active'
                  : row.readinessLevel === 'yellow'
                    ? 'border-l-4 border-l-status-pending'
                    : 'border-l-4 border-l-status-warning';
              const badgeClasses =
                row.readinessLevel === 'green'
                  ? 'bg-status-active/10 text-status-active border-status-active/20'
                  : row.readinessLevel === 'yellow'
                    ? 'bg-status-pending/10 text-status-pending border-status-pending/20'
                    : 'bg-status-warning/10 text-status-warning border-status-warning/20';
              return (
                <div key={`readiness-${row.id}`} className={`rounded-xl border border-surface-border bg-surface-card p-4 transition-colors hover:bg-surface-hover ${toneClasses}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{row.displayName}</p>
                      <p className="mt-0.5 text-xs text-text-muted">{row.displayType}</p>
                    </div>
                    <Badge variant="outline" className={badgeClasses}>
                      {row.readinessLabel}
                    </Badge>
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-text-muted">
                    <p>Last serviced: {row.last_serviced ? new Date(row.last_serviced).toLocaleDateString() : '—'}</p>
                    <p>{row.dueText}</p>
                    <p>Property: {row.displayPropertyName}</p>
                    <p>Status: {statusLabel(row.normalizedStatus)}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      <Dialog open={addOpen && !isReadOnly} onOpenChange={setAddOpen}>
        <DialogContent aria-describedby="dialog-desc" className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Equipment</DialogTitle>
            <DialogDescription id="dialog-desc" className="sr-only">
              Add an equipment unit with type, status, and service details.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3">
            {activeEquipmentTypes.length === 0 ? (
              <div className="rounded-md border border-status-pending/20 bg-status-pending/10 p-3 text-sm text-status-pending">
                No equipment types defined. Add types in Settings → Equipment first.{" "}
                <Link href="/app/settings?tab=Workspace" className="font-medium underline">
                  Open Settings
                </Link>
              </div>
            ) : null}
            <div>
              <label className="text-xs text-muted-foreground">Name</label>
              <Input
                value={addDraft.name}
                onChange={(event) => setAddDraft({ ...addDraft, name: event.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Type</label>
              <select
                value={addDraft.equipmentTypeId}
                onChange={(event) => setAddDraft({ ...addDraft, equipmentTypeId: event.target.value })}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select type</option>
                {activeEquipmentTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name ?? 'Unnamed Type'}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Property assignment</label>
              <select
                value={addDraft.propertyId}
                onChange={(event) => setAddDraft({ ...addDraft, propertyId: event.target.value })}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="shared">Shared (all properties)</option>
                {activeProperties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name ?? property.short_name ?? 'Unnamed property'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <select
                value={addDraft.status}
                onChange={(event) => setAddDraft({ ...addDraft, status: event.target.value as EquipmentStatus })}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {statusLabel(status)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Location</label>
              <Input
                value={addDraft.location}
                onChange={(event) => setAddDraft({ ...addDraft, location: event.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Last Serviced</label>
              <DateInput
                value={addDraft.lastServiced}
                onChange={(event) => setAddDraft({ ...addDraft, lastServiced: event.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Maintenance interval hours</label>
              <Input
                type="number"
                min="0"
                step="1"
                value={addDraft.maintenanceIntervalHours}
                onChange={(event) => setAddDraft({ ...addDraft, maintenanceIntervalHours: event.target.value })}
                className="mt-1"
                placeholder="Optional"
              />
              <p className="mt-1 text-xs text-text-muted">Leave blank to disable usage-hour service tracking.</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Notes</label>
              <Textarea
                value={addDraft.notes}
                onChange={(event) => setAddDraft({ ...addDraft, notes: event.target.value })}
                className="mt-1 min-h-20"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={cancelAdd}>
              Cancel
            </Button>
            <Button onClick={() => void saveAdd()} disabled={addSaving || !addDraft.name.trim() || activeEquipmentTypes.length === 0}>
              {addSaving ? 'Saving...' : 'Save Equipment'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(selectedDetailRow)} onOpenChange={(open) => { if (!open) setDetailRowId(null); }}>
        <DialogContent aria-describedby="equipment-detail-desc" className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedDetailRow ? (
            <>
              <DialogHeader>
                <DialogTitle>{selectedDetailRow.displayName}</DialogTitle>
                <DialogDescription id="equipment-detail-desc">
                  QR field access and usage-hour maintenance tracking.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-surface-border bg-surface-elevated p-3">
                    <p className="text-xs uppercase tracking-[0.14em] text-text-muted">Status</p>
                    <Badge variant="outline" className={statusBadgeClass(selectedDetailRow.normalizedStatus)}>
                      {statusLabel(selectedDetailRow.normalizedStatus)}
                    </Badge>
                  </div>
                  <div className="rounded-lg border border-surface-border bg-surface-elevated p-3">
                    <p className="text-xs uppercase tracking-[0.14em] text-text-muted">Hours</p>
                    <p className="mt-1 text-lg font-semibold text-text-primary">{Number(selectedDetailRow.estimated_hours ?? 0).toFixed(1)}h</p>
                  </div>
                  <div className="rounded-lg border border-surface-border bg-surface-elevated p-3">
                    <p className="text-xs uppercase tracking-[0.14em] text-text-muted">Property</p>
                    <p className="mt-1 text-sm font-medium text-text-primary">{selectedDetailRow.displayPropertyName}</p>
                  </div>
                </div>

                <div className="rounded-lg border border-surface-border bg-surface-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">Maintenance interval</p>
                      <p className="mt-1 text-xs text-text-muted">{selectedDetailRow.maintenanceState.description}</p>
                    </div>
                    <EquipmentMaintenanceBadge unit={selectedDetailRow} />
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-text-muted sm:grid-cols-3">
                    <p>Interval: {selectedDetailRow.maintenance_interval_hours == null ? 'Off' : `${Number(selectedDetailRow.maintenance_interval_hours).toFixed(1)}h`}</p>
                    <p>Last service hours: {selectedDetailRow.hours_at_last_service == null ? '—' : `${Number(selectedDetailRow.hours_at_last_service).toFixed(1)}h`}</p>
                    <p>Last serviced: {selectedDetailRow.last_serviced ? new Date(selectedDetailRow.last_serviced).toLocaleDateString() : '—'}</p>
                  </div>
                  {!isReadOnly ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3 gap-1.5"
                      onClick={() => void logServiceForRow(selectedDetailRow)}
                      disabled={serviceSavingId === selectedDetailRow.id}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {serviceSavingId === selectedDetailRow.id ? 'Logging...' : 'Log service at current hours'}
                    </Button>
                  ) : null}
                </div>

                <EquipmentQrCard qrToken={selectedDetailRow.qr_token} scanUrl={selectedDetailScanUrl} />
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}



