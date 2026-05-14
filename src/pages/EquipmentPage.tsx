import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock3, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

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
  if (status === 'available') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'in_use') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (status === 'maintenance') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-slate-100 text-slate-700 border-slate-300';
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
  }, [orgId]);

  useEffect(() => {
    void fetchEquipment();
  }, [fetchEquipment]);

  const typeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const type of types) {
      if (type.id && type.name) map.set(type.id, type.name);
    }
    return map;
  }, [types]);

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
      return;
    }

    cancelAdd();
    await fetchEquipment();
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
      return;
    }
    cancelEdit();
    await fetchEquipment();
  }, [cancelEdit, editDraft, fetchEquipment, isReadOnly, orgId, typeNameById]);

  const removeRow = useCallback(async (id: string) => {
    if (isReadOnly) return;
    if (!supabase || !orgId) return;
    setDeleteId(id);
    const { error: deleteError } = await supabase.from('equipment_units').delete().eq('id', id).eq('org_id', orgId);
    setDeleteId(null);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    await fetchEquipment();
  }, [fetchEquipment, isReadOnly, orgId]);

  if (!orgId || loading) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          <Clock3 className="mx-auto mb-2 h-5 w-5 animate-spin" />
          Loading equipment...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Equipment</h1>
          <p className="text-sm text-muted-foreground">Manage units, status, and service readiness.</p>
        </div>
        {!isReadOnly ? (
        <Button onClick={startAdd}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add Equipment
        </Button>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p>{error}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => void fetchEquipment()}>
            Retry
          </Button>
        </div>
      ) : null}

      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40">
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
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  No equipment found. Add your first unit.
                </td>
              </tr>
            ) : (
              scopedRows.map((row) => {
                const isEditing = editingId === row.id && editDraft;
                const overdue = isServiceOverdue(row.last_serviced);
                return (
                  <tr key={row.id} className="border-t align-top">
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <Input
                          value={editDraft.name}
                          onChange={(event) => setEditDraft({ ...editDraft, name: event.target.value })}
                        />
                      ) : (
                        <span className="font-medium">{row.displayName}</span>
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
                          {types
                            .filter((type) => type.active !== false)
                            .map((type) => (
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
                          {overdue ? <AlertTriangle className="h-4 w-4 text-amber-500" aria-label="Service overdue" /> : null}
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
          <div className="rounded-lg border p-4 text-sm text-muted-foreground">No equipment found. Add your first unit.</div>
        ) : (
          scopedRows.map((row) => {
            const isEditing = editingId === row.id && editDraft;
            const overdue = isServiceOverdue(row.last_serviced);
            return (
              <div key={`mobile-eq-${row.id}`} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-medium">{row.displayName}</p>
                  {isEditing ? null : (
                    <Badge variant="outline" className={statusBadgeClass(row.normalizedStatus)}>{statusLabel(row.normalizedStatus)}</Badge>
                  )}
                </div>
                {isEditing ? (
                  <div className="space-y-2">
                    <Input value={editDraft.name} onChange={(event) => setEditDraft({ ...editDraft, name: event.target.value })} />
                    <Input value={editDraft.location} onChange={(event) => setEditDraft({ ...editDraft, location: event.target.value })} placeholder="Location" />
                    <Input type="date" value={editDraft.lastServiced} onChange={(event) => setEditDraft({ ...editDraft, lastServiced: event.target.value })} />
                    <Textarea value={editDraft.notes} onChange={(event) => setEditDraft({ ...editDraft, notes: event.target.value })} className="min-h-16" />
                  </div>
                ) : (
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>Type: {row.displayType}</p>
                    <p>Location: {row.location || '—'}</p>
                    <p className="flex items-center gap-1">Last Serviced: {row.last_serviced ? new Date(row.last_serviced).toLocaleDateString() : '—'}{overdue ? <AlertTriangle className="h-4 w-4 text-amber-500" /> : null}</p>
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

      <Dialog open={addOpen && !isReadOnly} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Equipment</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3">
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
                {types
                  .filter((type) => type.active !== false)
                  .map((type) => (
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
            <Button onClick={() => void saveAdd()} disabled={addSaving || !addDraft.name.trim()}>
              {addSaving ? 'Saving...' : 'Save Equipment'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
