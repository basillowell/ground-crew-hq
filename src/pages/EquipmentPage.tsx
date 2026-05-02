import { useMemo, useState } from 'react';
import { workOrders, type Employee, type EquipmentUnit } from '@/data/seedData';
import { WorkOrderKanban } from '@/components/equipment/WorkOrderKanban';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusChip } from '@/components/StatusChip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { ChevronRight, Plus, Tractor } from 'lucide-react';
import { useEmployees, useEquipmentUnits, useWorkLocations } from '@/lib/supabase-queries';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

const statusMap = { available: 'success', 'in-use': 'info', maintenance: 'warning', 'out-of-service': 'danger' } as const;
const currentStatusToUnitStatus = {
  active: 'available',
  'in-service': 'in-use',
  'out-of-service': 'out-of-service',
} as const;

type CurrentStatus = keyof typeof currentStatusToUnitStatus;

function makeDefaultNextService() {
  const defaultNextService = new Date();
  defaultNextService.setDate(defaultNextService.getDate() + 90);
  return defaultNextService.toISOString().slice(0, 10);
}

export default function EquipmentPage() {
  const { currentUser, currentPropertyId } = useAuth();
  const queryClient = useQueryClient();
  const propertyScope = currentPropertyId === 'all' ? undefined : currentPropertyId;
  const equipmentQuery = useEquipmentUnits(propertyScope, currentUser?.orgId);
  const employeesQuery = useEmployees(propertyScope, currentUser?.orgId);
  const workLocationsQuery = useWorkLocations();

  const unitList = equipmentQuery.data ?? [];
  const employeeList: Employee[] = employeesQuery.data ?? [];
  const workLocations = workLocationsQuery.data ?? [];
  const equipmentTypes = useMemo(
    () => [...new Set(unitList.map((u) => ((u as unknown as { type?: string }).type ?? u.typeId)).filter(Boolean))],
    [unitList],
  );
  const [selectedType, setSelectedType] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    typeId: '',
    unitNumber: '',
    serialNumber: '',
    currentStatus: 'active' as CurrentStatus,
    assignedTo: '',
    location: 'Shop',
    hours: '0',
    lastService: new Date().toISOString().slice(0, 10),
    nextService: makeDefaultNextService(),
    notes: '',
    propertyId: '',
  });

  const activeType = selectedType || equipmentTypes[0] || '';
  const typeUnits = useMemo(() => unitList.filter((unit) => unit.typeId === activeType), [activeType, unitList]);
  const typeOrders = workOrders.filter((wo) => typeUnits.some((u) => u.id === wo.unitId));
  const activeCount = typeUnits.filter((unit) => unit.status === 'available' || unit.status === 'in-use').length;
  const repairCount = typeUnits.filter((unit) => unit.status === 'maintenance' || unit.status === 'out-of-service').length;

  async function persistUnit(unit: EquipmentUnit) {
    if (!supabase) return;

    const basePayload = {
      id: unit.id,
      name: unit.unitNumber,
      type: unit.typeId,
      status: unit.status,
      location: unit.location ?? null,
      last_serviced: unit.lastService ?? null,
      property_id: unit.propertyId ?? currentPropertyId ?? null,
      org_id: currentUser?.orgId ?? null,
    };

    const payloadWithOptional = {
      ...basePayload,
      serial_number: draft.serialNumber.trim() || null,
      notes: draft.notes.trim() || null,
    };

    let response = await supabase.from('equipment_units').upsert(payloadWithOptional);
    if (response.error && response.error.message.toLowerCase().includes('column')) {
      response = await supabase.from('equipment_units').upsert(basePayload);
    }
    if (response.error) throw response.error;
    await queryClient.invalidateQueries({ queryKey: ['equipment-units'] });
  }

  function openAddUnit() {
    setEditingUnitId(null);
    setDraft({
      typeId: activeType,
      unitNumber: '',
      serialNumber: '',
      currentStatus: 'active',
      assignedTo: '',
      location: workLocations[0]?.name ?? 'Shop',
      hours: '0',
      lastService: new Date().toISOString().slice(0, 10),
      nextService: makeDefaultNextService(),
      notes: '',
      propertyId: currentPropertyId ?? '',
    });
    setDialogOpen(true);
  }

  function openEditUnit(unit: EquipmentUnit) {
    setEditingUnitId(unit.id);
    setDraft({
      typeId: unit.typeId,
      unitNumber: unit.unitNumber,
      serialNumber: '',
      currentStatus:
        unit.status === 'in-use'
          ? 'in-service'
          : unit.status === 'out-of-service'
            ? 'out-of-service'
            : 'active',
      assignedTo: unit.assignedTo ?? '',
      location: unit.location,
      hours: String(unit.hours),
      lastService: unit.lastService,
      nextService: unit.nextService || makeDefaultNextService(),
      notes: '',
      propertyId: unit.propertyId ?? '',
    });
    setDialogOpen(true);
  }

  async function handleSaveUnit() {
    if (!draft.unitNumber.trim()) return;
    const mappedStatus = currentStatusToUnitStatus[draft.currentStatus];
    const nextUnit: EquipmentUnit = {
      id: editingUnitId ?? `u${Date.now()}`,
      typeId: draft.typeId || activeType || 'General',
      unitNumber: draft.unitNumber.trim(),
      status: mappedStatus as EquipmentUnit['status'],
      assignedTo: draft.assignedTo || undefined,
      location: draft.location.trim(),
      hours: Number(draft.hours || 0),
      lastService: draft.lastService,
      nextService: draft.nextService,
      propertyId: (currentPropertyId === 'all' ? draft.propertyId : currentPropertyId) || undefined,
    };
    await persistUnit(nextUnit);
    setDialogOpen(false);
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <div className="w-72 border-r bg-card overflow-auto p-3 space-y-1.5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Equipment Types</h3>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={openAddUnit}><Plus className="h-3.5 w-3.5" /></Button>
        </div>
        {equipmentTypes.length === 0 ? (
          <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            No equipment added yet. Add your first unit.
          </div>
        ) : equipmentTypes.map((type) => (
          <div
            key={type}
            onClick={() => setSelectedType(type)}
            className={`p-2.5 rounded-lg cursor-pointer transition-colors ${
              activeType === type ? 'bg-accent border border-primary/20' : 'hover:bg-muted/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{type}</span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-muted-foreground">
                {unitList.filter((unit) => unit.typeId === type && (unit.status === 'available' || unit.status === 'in-use')).length}
                /
                {unitList.filter((unit) => unit.typeId === type).length} active
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex-1 p-4 overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">{activeType || 'Equipment'}</h2>
            <p className="text-sm text-muted-foreground">{typeUnits.length} managed units</p>
          </div>
          <Button size="sm" className="gap-1" onClick={openAddUnit}><Plus className="h-3.5 w-3.5" /> Add Unit</Button>
        </div>

        <Tabs defaultValue="units">
          <TabsList className="h-8">
            <TabsTrigger value="units" className="text-xs">Units</TabsTrigger>
            <TabsTrigger value="orders" className="text-xs">Work Orders</TabsTrigger>
            <TabsTrigger value="stats" className="text-xs">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="units" className="mt-3">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {typeUnits.map((unit) => {
                const assignee = unit.assignedTo ? employeeList.find((e) => e.id === unit.assignedTo) : null;
                return (
                  <Card key={unit.id} className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm flex items-center gap-2">
                        <Tractor className="h-4 w-4 text-primary" />
                        {unit.unitNumber}
                      </span>
                      <StatusChip variant={statusMap[unit.status]}>{unit.status}</StatusChip>
                    </div>
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex justify-between"><span>Location</span><span className="font-medium text-foreground">{unit.location}</span></div>
                      <div className="flex justify-between"><span>Hours</span><span className="font-mono text-foreground">{unit.hours.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span>Last Service</span><span>{unit.lastService}</span></div>
                      <div className="flex justify-between"><span>Next Service</span><span>{unit.nextService}</span></div>
                      {assignee ? (
                        <div className="flex justify-between">
                          <span>Assigned To</span>
                          <span className="font-medium text-foreground">{assignee.firstName} {assignee.lastName}</span>
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button size="sm" variant="outline" onClick={() => openEditUnit(unit)}>Edit</Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="orders" className="mt-3">
            <WorkOrderKanban />
          </TabsContent>

          <TabsContent value="stats" className="mt-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4">
                <div className="text-xs text-muted-foreground mb-1">Uptime Rate</div>
                <div className="text-2xl font-bold text-primary">
                  {typeUnits.length ? Math.round((activeCount / typeUnits.length) * 100) : 0}%
                </div>
                <Progress value={typeUnits.length ? (activeCount / typeUnits.length) * 100 : 0} className="mt-2 h-2" />
              </Card>
              <Card className="p-4">
                <div className="text-xs text-muted-foreground mb-1">Total Repair Cost (YTD)</div>
                <div className="text-2xl font-bold">${typeOrders.reduce((sum, order) => sum + order.cost, 0).toLocaleString()}</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs text-muted-foreground mb-1">Open Work Orders</div>
                <div className="text-2xl font-bold text-warning">{repairCount}</div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingUnitId ? 'Edit Equipment Unit' : 'Add Equipment Unit'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Type</label>
              <select
                value={draft.typeId}
                onChange={(event) => setDraft({ ...draft, typeId: event.target.value })}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {equipmentTypes.length === 0 ? (
                  <option value="">General</option>
                ) : equipmentTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Unit Number</label>
              <Input value={draft.unitNumber} onChange={(event) => setDraft({ ...draft, unitNumber: event.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Serial Number</label>
              <Input value={draft.serialNumber} onChange={(event) => setDraft({ ...draft, serialNumber: event.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Current Status</label>
              <select
                value={draft.currentStatus}
                onChange={(event) => setDraft({ ...draft, currentStatus: event.target.value as CurrentStatus })}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="active">Active</option>
                <option value="in-service">In Service</option>
                <option value="out-of-service">Out of Service</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Assigned To</label>
              <select
                value={draft.assignedTo}
                onChange={(event) => setDraft({ ...draft, assignedTo: event.target.value })}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Unassigned</option>
                {employeeList.filter((employee) => employee.status === 'active').map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.firstName} {employee.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Location / Assigned Area</label>
              <Input value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Hours</label>
              <Input value={draft.hours} onChange={(event) => setDraft({ ...draft, hours: event.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Last Serviced</label>
              <Input type="date" value={draft.lastService} onChange={(event) => setDraft({ ...draft, lastService: event.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Next Service</label>
              <Input type="date" value={draft.nextService} onChange={(event) => setDraft({ ...draft, nextService: event.target.value })} className="mt-1" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Notes</label>
              <Textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} className="mt-1 min-h-20" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveUnit}>Save Unit</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
