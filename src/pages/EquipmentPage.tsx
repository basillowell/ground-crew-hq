import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Pencil, Plus, Trash2, Wrench } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PageHeaderSkeleton, TableSkeleton } from '@/components/PageSkeleton';
import { ErrorRetry } from '@/components/ErrorRetry';
import { EmptyState } from '@/components/EmptyState';
import { toast } from '@/components/ui/sonner';
import { Link } from 'react-router-dom';
import { useAppStore } from '@/store/appStore';
import { PageHeader } from '@/components/shared';

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

type EquipmentStatus = 'available' | 'in_use' | 'maintenance' | 'retired';

type AddDraft = {
  name: string;
  equipmentTypeId: string;
  status: EquipmentStatus;
  location: string;
  notes: string;
  lastServiced: string;
};

type EditDraft = {
  name: string;
  equipmentTypeId: string;
  status: EquipmentStatus;
  location: string;
  lastServiced: string;
  notes: string;
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

function isServiceOverdue(lastServiced: string | null | undefined) {
  if (!lastServiced) return false;
  const servicedAt = new Date(lastServiced);
  if (Number.isNaN(servicedAt.getTime())) return false;
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
  return Date.now() - servicedAt.getTime() > ninetyDaysMs;
}

function emptyAddDraft(): AddDraft {
  return {
    name: '',
    equipmentTypeId: '',
    status: 'available',
    location: '',
    notes: '',
    lastServiced: '',
  };
}

export default function EquipmentPage() {
  const { currentUser, currentPropertyId, userRole } = useAuth();
  const isHydrated = useAppStore((state) => state.isHydrated);
  const isReadOnly = String(userRole ?? '') === 'viewer';
  const orgId = currentUser?.orgId ?? '';
  const propertyId = currentPropertyId && currentPropertyId !== 'all' ? currentPropertyId : null;

  const [units, setUnits] = useState<EquipmentUnitRow[]>([]);
  const [types, setTypes] = useState<EquipmentTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [addDraft, setAddDraft] = useState<AddDraft>(emptyAddDraft);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [rowSavingId, setRowSavingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'readiness'>('list');

  useEffect(() => {
    document.title = 'Equipment — Ground Crew HQ';
  }, []);

  const fetchEquipment = useCallback(async () => {
    if (!supabase || !orgId) {
      setLoading(true);
      return;
    }

    setLoading(true);
    setError(null);

    const unitsQuery = supabase
      .from('equipment_units')
      .select('id, property_id, name, type, status, location, last_serviced, org_id, equipment_type_id, unit_name, notes, active')
      .eq('org_id', orgId)
      .order('unit_name', { ascending: true });

    const typesQuery = supabase
      .from('equipment_types')
      .select('id, org_id, property_id, name, short_name, category, active')
      .eq('org_id', orgId)
      .order('name', { ascending: true });

    if (propertyId) {
      unitsQuery.eq('property_id', propertyId);
    }

    const [{ data: unitsData, error: unitsError }, { data: typesData, error: typesError }] = await Promise.all([
      unitsQuery,
      typesQuery,
    ]);

    if (unitsError || typesError) {
      setError(unitsError?.message ?? typesError?.message ?? 'Could not load equipment data.');
      setUnits([]);
      setTypes([]);
      setLoading(false);
      return;
    }

    setUnits((unitsData ?? []) as EquipmentUnitRow[]);
    setTypes((typesData ?? []) as EquipmentTypeRow[]);
    setLoading(false);
  }, [orgId, propertyId]);

  useEffect(() => {
    if (!isHydrated) return;
    void fetchEquipment();
  }, [fetchEquipment, isHydrated]);

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

  const rows = useMemo(() => {
    return units.map((unit) => {
      const resolvedName = unit.unit_name || unit.name || 'Unnamed equipment';
      const resolvedType = unit.equipment_type_id
        ? typeNameById.get(unit.equipment_type_id) || unit.type || 'Unassigned'
        : unit.type || 'Unassigned';
      return {
        ...unit,
        displayName: resolvedName,
        displayType: resolvedType,
        normalizedStatus: normalizeStatus(unit.status),
      };
    });
  }, [typeNameById, units]);

  const scopedRows = useMemo(() => {
    if (!propertyId) return rows;
    return rows.filter((row) => row.property_id === propertyId);
  }, [propertyId, rows]);

  const readinessRows = useMemo(() => {
    const now = Date.now();
    const dueSoonWindowDays = 14;
    const serviceThresholdDays = 90;
    const msPerDay = 24 * 60 * 60 * 1000;

    return scopedRows
      .map((row) => {
        const servicedAt = row.last_serviced ? new Date(row.last_serviced) : null;
        const servicedTime = servicedAt && !Number.isNaN(servicedAt.getTime()) ? servicedAt.getTime() : null;
        const dueAtTime = servicedTime !== null ? servicedTime + serviceThresholdDays * msPerDay : null;
        const daysUntilDue = dueAtTime !== null ? Math.ceil((dueAtTime - now) / msPerDay) : null;
        const daysOverdue = dueAtTime !== null ? Math.max(0, Math.floor((now - dueAtTime) / msPerDay)) : null;

        let readinessLevel: 'green' | 'yellow' | 'red' = 'green';
        let readinessLabel = 'Ready';
        let sortWeight = 2;
        let dueText = `Due in ${daysUntilDue ?? 0} day${Math.abs(daysUntilDue ?? 0) === 1 ? '' : 's'}`;

        if (dueAtTime === null || (daysOverdue !== null && daysOverdue > 0)) {
          readinessLevel = 'red';
          sortWeight = 0;
          readinessLabel = dueAtTime === null ? 'Overdue' : `Overdue ${daysOverdue} day${daysOverdue === 1 ? '' : 's'}`;
          dueText = dueAtTime === null ? 'Service date missing' : `${daysOverdue} day${daysOverdue === 1 ? '' : 's'} overdue`;
        } else if (daysUntilDue !== null && daysUntilDue <= dueSoonWindowDays) {
          readinessLevel = 'yellow';
          sortWeight = 1;
          readinessLabel = 'Service Due Soon';
          dueText = `Due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`;
        }

        return {
          ...row,
          readinessLevel,
          readinessLabel,
          dueText,
          sortWeight,
        };
      })
      .sort((a, b) => {
        if (a.sortWeight !== b.sortWeight) return a.sortWeight - b.sortWeight;
        return a.displayName.localeCompare(b.displayName);
      });
  }, [scopedRows]);

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

    setAddSaving(true);
    const selectedTypeName = typeNameById.get(addDraft.equipmentTypeId) ?? null;
    const payload = {
      id: crypto.randomUUID(),
      org_id: orgId,
      property_id: propertyId,
      unit_name: addDraft.name.trim(),
      name: addDraft.name.trim(),
      equipment_type_id: addDraft.equipmentTypeId || null,
      type: selectedTypeName,
      status: addDraft.status,
      location: addDraft.location.trim() || null,
      notes: addDraft.notes.trim() || null,
      active: addDraft.status !== 'retired',
      last_serviced: addDraft.lastServiced || null,
    };

    const { error: insertError } = await supabase.from('equipment_units').insert(payload);
    setAddSaving(false);
    if (insertError) {
      setError(insertError.message);
      toast.error(`Failed to add equipment: ${insertError.message}`);
      return;
    }

    cancelAdd();
    await fetchEquipment();
    toast.success(`Added equipment: ${addDraft.name.trim()}`);
  }, [addDraft, cancelAdd, fetchEquipment, isReadOnly, orgId, propertyId, typeNameById]);

  const startEdit = useCallback((row: EquipmentUnitRow & { displayName: string; displayType: string; normalizedStatus: EquipmentStatus }) => {
    setEditingId(row.id);
    setEditDraft({
      name: row.displayName,
      equipmentTypeId: row.equipment_type_id ?? '',
      status: row.normalizedStatus,
      location: row.location ?? '',
      lastServiced: toDateInput(row.last_serviced),
      notes: row.notes ?? '',
    });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditDraft(null);
  }, []);

  const saveEdit = useCallback(async (id: string) => {
    if (isReadOnly) return;
    if (!supabase || !editDraft || !orgId || !editDraft.name.trim()) return;
    setRowSavingId(id);

    const selectedTypeName = typeNameById.get(editDraft.equipmentTypeId) ?? null;
    const payload = {
      unit_name: editDraft.name.trim(),
      name: editDraft.name.trim(),
      equipment_type_id: editDraft.equipmentTypeId || null,
      type: selectedTypeName,
      status: editDraft.status,
      location: editDraft.location.trim() || null,
      notes: editDraft.notes.trim() || null,
      active: editDraft.status !== 'retired',
      last_serviced: editDraft.lastServiced || null,
      org_id: orgId,
    };

    const { error: updateError } = await supabase.from('equipment_units').update(payload).eq('id', id).eq('org_id', orgId);
    setRowSavingId(null);
    if (updateError) {
      setError(updateError.message);
      toast.error(`Failed to update equipment: ${updateError.message}`);
      return;
    }
    cancelEdit();
    await fetchEquipment();
    toast.success(`Updated equipment: ${editDraft.name.trim()}`);
  }, [cancelEdit, editDraft, fetchEquipment, isReadOnly, orgId, typeNameById]);

  const removeRow = useCallback(async (id: string) => {
    if (isReadOnly) return;
    if (!supabase || !orgId) return;
    setDeleteId(id);
    const { error: deleteError } = await supabase.from('equipment_units').delete().eq('id', id).eq('org_id', orgId);
    setDeleteId(null);
    if (deleteError) {
      setError(deleteError.message);
      toast.error(`Failed to delete equipment: ${deleteError.message}`);
      return;
    }
    await fetchEquipment();
    toast.success('Equipment deleted');
  }, [fetchEquipment, isReadOnly, orgId]);

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
      <PageHeader title="Equipment" subtitle="Track maintenance and availability.">
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
            <Button size="sm" className="h-9 gap-1.5" onClick={startAdd}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add Equipment
            </Button>
          ) : null}
        </div>
      </PageHeader>

      {error ? <ErrorRetry message={error} onRetry={() => void fetchEquipment()} /> : null}

      {viewMode === 'list' ? (
      <>
      <div className="hidden overflow-x-auto rounded-xl border border-surface-border bg-surface-card md:block">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-elevated text-xs uppercase tracking-wider text-text-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium">Type</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-left font-medium">Location</th>
              <th className="px-3 py-2 text-left font-medium">Last Serviced</th>
              <th className="px-3 py-2 text-right font-medium">Actions</th>
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
                    onAction={!isReadOnly ? startAdd : undefined}
                  />
                </td>
              </tr>
            ) : (
              scopedRows.map((row) => {
                const isEditing = editingId === row.id && editDraft;
                const overdue = isServiceOverdue(row.last_serviced);
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
                        <Input
                          value={editDraft.location}
                          onChange={(event) => setEditDraft({ ...editDraft, location: event.target.value })}
                        />
                      ) : (
                        row.location || '—'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <div className="space-y-2">
                          <Input
                            type="date"
                            value={editDraft.lastServiced}
                            onChange={(event) => setEditDraft({ ...editDraft, lastServiced: event.target.value })}
                          />
                          <Textarea
                            value={editDraft.notes}
                            onChange={(event) => setEditDraft({ ...editDraft, notes: event.target.value })}
                            placeholder="Notes"
                            className="min-h-16"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span>{row.last_serviced ? new Date(row.last_serviced).toLocaleDateString() : '—'}</span>
                          {overdue ? <AlertTriangle className="h-4 w-4 text-status-pending" aria-label="Service overdue" /> : null}
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
            onAction={!isReadOnly ? startAdd : undefined}
          />
        ) : (
          scopedRows.map((row) => {
            const isEditing = editingId === row.id && editDraft;
            const overdue = isServiceOverdue(row.last_serviced);
            return (
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
                    <Input value={editDraft.location} onChange={(event) => setEditDraft({ ...editDraft, location: event.target.value })} placeholder="Location" />
                    <Input type="date" value={editDraft.lastServiced} onChange={(event) => setEditDraft({ ...editDraft, lastServiced: event.target.value })} />
                    <Textarea value={editDraft.notes} onChange={(event) => setEditDraft({ ...editDraft, notes: event.target.value })} className="min-h-16" />
                  </div>
                ) : (
                  <div className="space-y-1 text-sm text-text-muted">
                    <p>Type: {row.displayType}</p>
                    <p>Location: {row.location || '—'}</p>
                    <p className="flex items-center gap-1">Last Serviced: {row.last_serviced ? new Date(row.last_serviced).toLocaleDateString() : '—'}{overdue ? <AlertTriangle className="h-4 w-4 text-status-pending" /> : null}</p>
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
                onAction={!isReadOnly ? startAdd : undefined}
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
                <Link to="/app/settings?tab=Workspace" className="font-medium underline">
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
              <Input
                type="date"
                value={addDraft.lastServiced}
                onChange={(event) => setAddDraft({ ...addDraft, lastServiced: event.target.value })}
                className="mt-1"
              />
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
    </div>
  );
}
