import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusChip } from '@/components/StatusChip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Wrench, CheckCircle2, AlertTriangle, Clock, ChevronRight } from 'lucide-react';
import { useEquipmentUnits } from '@/lib/supabase-queries';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

type EquipmentTypeRow = {
  id: string;
  name: string;
  short_name: string | null;
  category: string | null;
  active: boolean | null;
  org_id: string | null;
  property_id: string | null;
};

type WorkOrderRow = {
  id: string;
  equipment_unit_id: string;
  title: string;
  description: string | null;
  status: 'open' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  cost: number | null;
  created_at: string;
  completed_at: string | null;
  org_id: string | null;
  property_id: string | null;
};

type CanonicalStatus = 'ready' | 'issue' | 'maintenance' | 'disabled';

const statusChipMap: Record<CanonicalStatus, 'success' | 'warning' | 'info' | 'danger'> = {
  ready: 'success',
  issue: 'warning',
  maintenance: 'info',
  disabled: 'danger',
};

function normalizeStatus(raw?: string): CanonicalStatus {
  const v = String(raw ?? '').toLowerCase();
  if (v === 'ready' || v === 'available' || v === 'in-use') return 'ready';
  if (v === 'issue') return 'issue';
  if (v === 'maintenance') return 'maintenance';
  return 'disabled';
}

export default function EquipmentPage() {
  const { currentUser, currentPropertyId } = useAuth();
  const queryClient = useQueryClient();
  const propertyScope = currentPropertyId === 'all' ? undefined : currentPropertyId;
  const orgId = currentUser?.orgId;

  const unitsQuery = useEquipmentUnits(propertyScope, orgId);
  const units = unitsQuery.data ?? [];

  const equipmentTypesQuery = useQuery({
    queryKey: ['equipment-types', propertyScope ?? 'all', orgId ?? 'all-orgs'],
    queryFn: async () => {
      if (!supabase) return [] as EquipmentTypeRow[];
      let query = supabase.from('equipment_types').select('*').order('name');
      if (orgId) query = query.eq('org_id', orgId);
      if (propertyScope) query = query.eq('property_id', propertyScope);
      const { data, error } = await query;
      if (error) return [] as EquipmentTypeRow[];
      return (data ?? []) as EquipmentTypeRow[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const workOrdersQuery = useQuery({
    queryKey: ['work-orders', propertyScope ?? 'all', orgId ?? 'all-orgs'],
    queryFn: async () => {
      if (!supabase) return [] as WorkOrderRow[];
      let query = supabase.from('work_orders').select('*').order('created_at', { ascending: false });
      if (orgId) query = query.eq('org_id', orgId);
      if (propertyScope) query = query.eq('property_id', propertyScope);
      const { data, error } = await query;
      if (error) return [] as WorkOrderRow[];
      return (data ?? []) as WorkOrderRow[];
    },
    staleTime: 1000 * 60 * 2,
  });

  const derivedTypes = useMemo(
    () =>
      [...new Set(units.map((u) => (u.typeId || '').trim()).filter(Boolean))].map((name) => ({
        id: name,
        name,
        short_name: name.slice(0, 12).toUpperCase(),
        category: 'General',
        active: true,
        org_id: orgId ?? null,
        property_id: propertyScope ?? null,
      })),
    [units, orgId, propertyScope],
  );

  const equipmentTypes = equipmentTypesQuery.data && equipmentTypesQuery.data.length > 0
    ? equipmentTypesQuery.data
    : derivedTypes;

  const [selectedTypeId, setSelectedTypeId] = useState<string>('');
  const activeTypeId = selectedTypeId || equipmentTypes[0]?.id || '';

  const filteredUnits = useMemo(() => {
    if (!activeTypeId) return units;
    const activeType = equipmentTypes.find((t) => t.id === activeTypeId);
    if (!activeType) return units;
    return units.filter((u) => {
      const unitType = (u.typeId || '').trim();
      return unitType === activeType.id || unitType === activeType.name;
    });
  }, [activeTypeId, equipmentTypes, units]);

  const statusCounts = useMemo(() => {
    const counts: Record<CanonicalStatus, number> = { ready: 0, issue: 0, maintenance: 0, disabled: 0 };
    filteredUnits.forEach((unit) => {
      counts[normalizeStatus(unit.status)] += 1;
    });
    return counts;
  }, [filteredUnits]);

  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [unitDraft, setUnitDraft] = useState({
    equipment_type_id: '',
    unit_name: '',
    status: 'ready' as CanonicalStatus,
    notes: '',
    active: true,
  });

  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [typeDraft, setTypeDraft] = useState({
    name: '',
    short_name: '',
    category: 'General',
    active: true,
  });

  const [workOrderDialogOpen, setWorkOrderDialogOpen] = useState(false);
  const [workOrderDraft, setWorkOrderDraft] = useState({
    equipment_unit_id: '',
    title: '',
    description: '',
    priority: 'medium' as WorkOrderRow['priority'],
  });

  function openAddType() {
    setEditingTypeId(null);
    setTypeDraft({ name: '', short_name: '', category: 'General', active: true });
    setTypeDialogOpen(true);
  }

  function openEditType(type: EquipmentTypeRow) {
    setEditingTypeId(type.id);
    setTypeDraft({
      name: type.name,
      short_name: type.short_name ?? '',
      category: type.category ?? 'General',
      active: type.active ?? true,
    });
    setTypeDialogOpen(true);
  }

  function openAddUnit() {
    setEditingUnitId(null);
    setUnitDraft({
      equipment_type_id: activeTypeId || equipmentTypes[0]?.id || '',
      unit_name: '',
      status: 'ready',
      notes: '',
      active: true,
    });
    setUnitDialogOpen(true);
  }

  function openEditUnit(unitId: string) {
    const unit = units.find((u) => u.id === unitId);
    if (!unit) return;
    const type = equipmentTypes.find((t) => t.name === unit.typeId || t.id === unit.typeId);
    const ext = unit as unknown as { notes?: string; active?: boolean };
    setEditingUnitId(unit.id);
    setUnitDraft({
      equipment_type_id: type?.id ?? unit.typeId,
      unit_name: unit.unitNumber,
      status: normalizeStatus(unit.status),
      notes: ext.notes ?? '',
      active: ext.active ?? normalizeStatus(unit.status) !== 'disabled',
    });
    setUnitDialogOpen(true);
  }

  async function saveType() {
    if (!supabase || !typeDraft.name.trim()) return;
    const payload = {
      id: editingTypeId ?? crypto.randomUUID(),
      name: typeDraft.name.trim(),
      short_name: typeDraft.short_name.trim() || null,
      category: typeDraft.category.trim() || 'General',
      active: typeDraft.active,
      org_id: orgId ?? null,
      property_id: propertyScope ?? null,
    };
    const { error } = await supabase.from('equipment_types').upsert(payload);
    if (error) return;
    await queryClient.invalidateQueries({ queryKey: ['equipment-types'] });
    setTypeDialogOpen(false);
  }

  async function saveUnit() {
    if (!supabase || !unitDraft.unit_name.trim() || !currentPropertyId || currentPropertyId === 'all') return;
    const resolvedType = equipmentTypes.find((t) => t.id === unitDraft.equipment_type_id);
    const canonical = unitDraft.active ? unitDraft.status : 'disabled';
    const payload = {
      id: editingUnitId ?? crypto.randomUUID(),
      property_id: currentPropertyId,
      org_id: orgId ?? null,
      equipment_type_id: unitDraft.equipment_type_id || null,
      unit_name: unitDraft.unit_name.trim(),
      name: unitDraft.unit_name.trim(),
      type: resolvedType?.name ?? unitDraft.equipment_type_id ?? 'General',
      status: canonical,
      notes: unitDraft.notes.trim() || null,
      active: unitDraft.active,
    };
    let { error } = await supabase.from('equipment_units').upsert(payload);
    if (error) {
      const fallback = await supabase.from('equipment_units').upsert({
        id: payload.id,
        property_id: payload.property_id,
        org_id: payload.org_id,
        name: payload.name,
        type: payload.type,
        status: payload.status,
      });
      error = fallback.error;
    }
    if (error) return;
    await queryClient.invalidateQueries({ queryKey: ['equipment-units'] });
    setUnitDialogOpen(false);
  }

  async function saveWorkOrder() {
    if (!supabase || !workOrderDraft.equipment_unit_id || !workOrderDraft.title.trim() || !currentPropertyId || currentPropertyId === 'all') return;
    const payload = {
      id: crypto.randomUUID(),
      equipment_unit_id: workOrderDraft.equipment_unit_id,
      title: workOrderDraft.title.trim(),
      description: workOrderDraft.description.trim() || null,
      status: 'open' as WorkOrderRow['status'],
      priority: workOrderDraft.priority,
      cost: 0,
      org_id: orgId ?? null,
      property_id: currentPropertyId,
    };
    const { error } = await supabase.from('work_orders').insert(payload);
    if (error) return;
    await queryClient.invalidateQueries({ queryKey: ['work-orders'] });
    setWorkOrderDialogOpen(false);
    setWorkOrderDraft({ equipment_unit_id: '', title: '', description: '', priority: 'medium' });
  }

  const typeCounts = useMemo(() => {
    return equipmentTypes.map((type) => {
      const forType = units.filter((u) => u.typeId === type.name || u.typeId === type.id);
      const status = { ready: 0, issue: 0, maintenance: 0, disabled: 0 } as Record<CanonicalStatus, number>;
      forType.forEach((u) => { status[normalizeStatus(u.status)] += 1; });
      return { type, total: forType.length, status };
    });
  }, [equipmentTypes, units]);

  const hasWorkOrderTable = (workOrdersQuery.data ?? []).length > 0 || !workOrdersQuery.error;
  const loading = unitsQuery.isLoading || equipmentTypesQuery.isLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Clock className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <div className="w-80 border-r bg-card overflow-auto p-3 space-y-2">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Equipment Types</h3>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={openAddType}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        {typeCounts.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
            No equipment added yet. Add your first unit.
          </div>
        ) : (
          typeCounts.map(({ type, total, status }) => (
            <button
              key={type.id}
              type="button"
              onClick={() => setSelectedTypeId(type.id)}
              className={`w-full rounded-lg border p-3 text-left transition-colors ${
                activeTypeId === type.id ? 'bg-accent border-primary/30' : 'hover:bg-muted/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{type.name}</span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                <Badge variant="outline" className="text-[10px]">Ready {status.ready}</Badge>
                <Badge variant="outline" className="text-[10px]">Issue {status.issue}</Badge>
                <Badge variant="outline" className="text-[10px]">Maint {status.maintenance}</Badge>
                <Badge variant="outline" className="text-[10px]">Disabled {status.disabled}</Badge>
                <Badge variant="secondary" className="text-[10px] ml-auto">{total} total</Badge>
              </div>
              <div className="mt-2">
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={(event) => {
                  event.stopPropagation();
                  openEditType(type);
                }}>
                  Edit Type
                </Button>
              </div>
            </button>
          ))
        )}
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{equipmentTypes.find((type) => type.id === activeTypeId)?.name ?? 'Equipment Units'}</h2>
            <p className="text-sm text-muted-foreground">
              Ready {statusCounts.ready} · Issue {statusCounts.issue} · Maintenance {statusCounts.maintenance} · Disabled {statusCounts.disabled}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setWorkOrderDialogOpen(true)}>
              <Wrench className="mr-1.5 h-3.5 w-3.5" /> Add Work Order
            </Button>
            <Button size="sm" onClick={openAddUnit}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Unit
            </Button>
          </div>
        </div>

        {filteredUnits.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No units for this type yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredUnits.map((unit) => {
              const canonical = normalizeStatus(unit.status);
              const ext = unit as unknown as { notes?: string; active?: boolean };
              return (
                <Card key={unit.id} className="p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold">{unit.unitNumber}</span>
                    <StatusChip variant={statusChipMap[canonical]}>{canonical}</StatusChip>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Type</span>
                      <span className="text-foreground">{unit.typeId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Active</span>
                      <span className="text-foreground">{ext.active === false || canonical === 'disabled' ? 'No' : 'Yes'}</span>
                    </div>
                    {ext.notes ? (
                      <p className="pt-1 text-[11px]">{ext.notes}</p>
                    ) : null}
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button size="sm" variant="outline" onClick={() => openEditUnit(unit.id)}>
                      Edit
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <div className="mt-6 rounded-xl border p-4">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Work Orders</h3>
          </div>
          {!hasWorkOrderTable ? (
            <p className="text-xs text-muted-foreground">
              Work order table not available yet. Run migration `006_equipment_management.sql`.
            </p>
          ) : (workOrdersQuery.data ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">No work orders yet.</p>
          ) : (
            <div className="space-y-2">
              {(workOrdersQuery.data ?? []).slice(0, 12).map((wo) => (
                <div key={wo.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{wo.title}</span>
                    <Badge variant={wo.status === 'completed' ? 'secondary' : wo.status === 'in-progress' ? 'outline' : 'destructive'}>
                      {wo.status}
                    </Badge>
                  </div>
                  {wo.description ? <p className="mt-1 text-xs text-muted-foreground">{wo.description}</p> : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={typeDialogOpen} onOpenChange={setTypeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingTypeId ? 'Edit Equipment Type' : 'Add Equipment Type'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Name</label>
              <Input value={typeDraft.name} onChange={(event) => setTypeDraft({ ...typeDraft, name: event.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Short Name</label>
              <Input value={typeDraft.short_name} onChange={(event) => setTypeDraft({ ...typeDraft, short_name: event.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Category</label>
              <Input value={typeDraft.category} onChange={(event) => setTypeDraft({ ...typeDraft, category: event.target.value })} className="mt-1" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Active</label>
              <select
                value={typeDraft.active ? 'true' : 'false'}
                onChange={(event) => setTypeDraft({ ...typeDraft, active: event.target.value === 'true' })}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setTypeDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveType}>Save Type</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={unitDialogOpen} onOpenChange={setUnitDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingUnitId ? 'Edit Equipment Unit' : 'Add Equipment Unit'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Equipment Type</label>
              <select
                value={unitDraft.equipment_type_id}
                onChange={(event) => setUnitDraft({ ...unitDraft, equipment_type_id: event.target.value })}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select type</option>
                {equipmentTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Unit Name</label>
              <Input value={unitDraft.unit_name} onChange={(event) => setUnitDraft({ ...unitDraft, unit_name: event.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <select
                value={unitDraft.status}
                onChange={(event) => setUnitDraft({ ...unitDraft, status: event.target.value as CanonicalStatus })}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="ready">Ready</option>
                <option value="issue">Issue</option>
                <option value="maintenance">Maintenance</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Active</label>
              <select
                value={unitDraft.active ? 'true' : 'false'}
                onChange={(event) => setUnitDraft({ ...unitDraft, active: event.target.value === 'true' })}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Notes</label>
              <Textarea value={unitDraft.notes} onChange={(event) => setUnitDraft({ ...unitDraft, notes: event.target.value })} className="mt-1 min-h-20" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setUnitDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveUnit}>Save Unit</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={workOrderDialogOpen} onOpenChange={setWorkOrderDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create Work Order</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <select
              value={workOrderDraft.equipment_unit_id}
              onChange={(event) => setWorkOrderDraft({ ...workOrderDraft, equipment_unit_id: event.target.value })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Select equipment unit</option>
              {filteredUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>{unit.unitNumber}</option>
              ))}
            </select>
            <Input
              placeholder="Work order title"
              value={workOrderDraft.title}
              onChange={(event) => setWorkOrderDraft({ ...workOrderDraft, title: event.target.value })}
            />
            <Textarea
              placeholder="Description"
              value={workOrderDraft.description}
              onChange={(event) => setWorkOrderDraft({ ...workOrderDraft, description: event.target.value })}
            />
            <select
              value={workOrderDraft.priority}
              onChange={(event) => setWorkOrderDraft({ ...workOrderDraft, priority: event.target.value as WorkOrderRow['priority'] })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setWorkOrderDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveWorkOrder}>Create Work Order</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
