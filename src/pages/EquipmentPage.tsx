import { useEffect, useMemo, useState } from 'react';
import { equipmentTypes, workOrders, type Employee, type EquipmentUnit } from '@/data/seedData';
import { WorkOrderKanban } from '@/components/equipment/WorkOrderKanban';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusChip } from '@/components/StatusChip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ChevronRight, Plus, Tractor } from 'lucide-react';
import { loadEmployees, loadEquipmentUnits, loadWorkLocations, saveEquipmentUnits } from '@/lib/dataStore';

const statusMap = { available: 'success', 'in-use': 'info', maintenance: 'warning', 'out-of-service': 'danger' } as const;
const woStatusMap = { open: 'warning', 'in-progress': 'info', completed: 'success' } as const;
const prioMap = { low: 'neutral', medium: 'warning', high: 'danger' } as const;

export default function EquipmentPage() {
  const [employeeList, setEmployeeList] = useState<Employee[]>([]);
  const [unitList, setUnitList] = useState<EquipmentUnit[]>([]);
  const [workLocations, setWorkLocations] = useState<{ id: string; name: string }[]>([]);
  const [selectedType, setSelectedType] = useState(equipmentTypes[0]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    typeId: equipmentTypes[0]?.id ?? '',
    unitNumber: '',
    status: 'available' as EquipmentUnit['status'],
    assignedTo: '',
    location: 'Shop',
    hours: '0',
    lastService: '2024-03-01',
    nextService: '2024-04-01',
  });

  useEffect(() => {
    setEmployeeList(loadEmployees());
    setUnitList(loadEquipmentUnits());
    setWorkLocations(loadWorkLocations());
  }, []);

  const typeUnits = useMemo(() => unitList.filter((unit) => unit.typeId === selectedType.id), [selectedType.id, unitList]);
  const typeOrders = workOrders.filter((wo) => typeUnits.some((u) => u.id === wo.unitId));
  const activeCount = typeUnits.filter((unit) => unit.status === 'available' || unit.status === 'in-use').length;
  const repairCount = typeUnits.filter((unit) => unit.status === 'maintenance' || unit.status === 'out-of-service').length;

  function persistUnits(nextUnits: EquipmentUnit[]) {
    setUnitList(nextUnits);
    saveEquipmentUnits(nextUnits);
  }

  function openAddUnit() {
    setEditingUnitId(null);
    setDraft({
      typeId: selectedType.id,
      unitNumber: '',
      status: 'available',
      assignedTo: '',
      location: loadWorkLocations()[0]?.name ?? 'Shop',
      hours: '0',
      lastService: '2024-03-01',
      nextService: '2024-04-01',
    });
    setDialogOpen(true);
  }

  function openEditUnit(unit: EquipmentUnit) {
    setEditingUnitId(unit.id);
    setDraft({
      typeId: unit.typeId,
      unitNumber: unit.unitNumber,
      status: unit.status,
      assignedTo: unit.assignedTo ?? '',
      location: unit.location,
      hours: String(unit.hours),
      lastService: unit.lastService,
      nextService: unit.nextService,
    });
    setDialogOpen(true);
  }

  function handleSaveUnit() {
    if (!draft.unitNumber.trim()) return;

    const nextUnit: EquipmentUnit = {
      id: editingUnitId ?? `u${Date.now()}`,
      typeId: draft.typeId,
      unitNumber: draft.unitNumber.trim(),
      status: draft.status,
      assignedTo: draft.assignedTo || undefined,
      location: draft.location.trim(),
      hours: Number(draft.hours || 0),
      lastService: draft.lastService,
      nextService: draft.nextService,
    };

    const nextUnits = editingUnitId
      ? unitList.map((unit) => (unit.id === editingUnitId ? nextUnit : unit))
      : [...unitList, nextUnit];

    persistUnits(nextUnits);
    setDialogOpen(false);
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Equipment list */}
      <div className="w-72 border-r bg-card overflow-auto p-3 space-y-1.5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Equipment Types</h3>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={openAddUnit}><Plus className="h-3.5 w-3.5" /></Button>
        </div>
        {equipmentTypes.map(eq => (
          <div
            key={eq.id}
            onClick={() => setSelectedType(eq)}
            className={`p-2.5 rounded-lg cursor-pointer transition-colors ${
              selectedType.id === eq.id ? 'bg-accent border border-primary/20' : 'hover:bg-muted/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{eq.name}</span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-[10px]">{eq.category}</Badge>
              <span className="text-[10px] text-muted-foreground">
                {unitList.filter((unit) => unit.typeId === eq.id && (unit.status === 'available' || unit.status === 'in-use')).length}
                /
                {unitList.filter((unit) => unit.typeId === eq.id).length} active
              </span>
              {unitList.filter((unit) => unit.typeId === eq.id && (unit.status === 'maintenance' || unit.status === 'out-of-service')).length > 0 && (
                <StatusChip variant="warning">
                  {unitList.filter((unit) => unit.typeId === eq.id && (unit.status === 'maintenance' || unit.status === 'out-of-service')).length} repair
                </StatusChip>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Detail panel */}
      <div className="flex-1 p-4 overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">{selectedType.name}</h2>
            <p className="text-sm text-muted-foreground">{selectedType.category} · {typeUnits.length} managed units</p>
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
              {typeUnits.map(unit => {
                const assignee = unit.assignedTo ? employeeList.find(e => e.id === unit.assignedTo) : null;
                return (
                  <Card key={unit.id} className="p-3 cursor-pointer hover:shadow-md transition-shadow" onClick={() => openEditUnit(unit)}>
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
                      {assignee && (
                        <div className="flex justify-between">
                          <span>Assigned To</span>
                          <span className="font-medium text-foreground">{assignee.firstName} {assignee.lastName}</span>
                        </div>
                      )}
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
                <div className="text-2xl font-bold">${typeOrders.reduce((s, o) => s + o.cost, 0).toLocaleString()}</div>
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
                {equipmentTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Unit Number</label>
              <Input value={draft.unitNumber} onChange={(event) => setDraft({ ...draft, unitNumber: event.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <select
                value={draft.status}
                onChange={(event) => setDraft({ ...draft, status: event.target.value as EquipmentUnit['status'] })}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="available">Available</option>
                <option value="in-use">In Use</option>
                <option value="maintenance">Maintenance</option>
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
              <label className="text-xs text-muted-foreground">Location</label>
              {workLocations.length > 0 ? (
                <select
                  value={draft.location}
                  onChange={(event) => setDraft({ ...draft, location: event.target.value })}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {workLocations.map((location) => (
                    <option key={location.id} value={location.name}>{location.name}</option>
                  ))}
                </select>
              ) : (
                <Input value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} className="mt-1" />
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Hours</label>
              <Input value={draft.hours} onChange={(event) => setDraft({ ...draft, hours: event.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Last Service</label>
              <Input type="date" value={draft.lastService} onChange={(event) => setDraft({ ...draft, lastService: event.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Next Service</label>
              <Input type="date" value={draft.nextService} onChange={(event) => setDraft({ ...draft, nextService: event.target.value })} className="mt-1" />
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
