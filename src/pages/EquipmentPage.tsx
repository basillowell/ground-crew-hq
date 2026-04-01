import { useState } from 'react';
import { equipmentTypes, equipmentUnits, workOrders, employees } from '@/data/mockData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusChip } from '@/components/StatusChip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Wrench, Plus, ChevronRight, AlertTriangle, CheckCircle, Clock, BarChart3 } from 'lucide-react';

const statusMap = { available: 'success', 'in-use': 'info', maintenance: 'warning', 'out-of-service': 'danger' } as const;
const woStatusMap = { open: 'warning', 'in-progress': 'info', completed: 'success' } as const;
const prioMap = { low: 'neutral', medium: 'warning', high: 'danger' } as const;

export default function EquipmentPage() {
  const [selectedType, setSelectedType] = useState(equipmentTypes[0]);
  const typeUnits = equipmentUnits.filter(u => u.typeId === selectedType.id);
  const typeOrders = workOrders.filter(wo => typeUnits.some(u => u.id === wo.unitId));

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Equipment list */}
      <div className="w-72 border-r bg-card overflow-auto p-3 space-y-1.5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Equipment Types</h3>
          <Button variant="ghost" size="icon" className="h-7 w-7"><Plus className="h-3.5 w-3.5" /></Button>
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
              <span className="text-[10px] text-muted-foreground">{eq.activeUnits}/{eq.totalUnits} active</span>
              {eq.inRepair > 0 && (
                <StatusChip variant="warning">{eq.inRepair} repair</StatusChip>
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
            <p className="text-sm text-muted-foreground">{selectedType.category} • {selectedType.totalUnits} units</p>
          </div>
          <Button size="sm" className="gap-1"><Plus className="h-3.5 w-3.5" /> Add Unit</Button>
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
                const assignee = unit.assignedTo ? employees.find(e => e.id === unit.assignedTo) : null;
                return (
                  <Card key={unit.id} className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm">{unit.unitNumber}</span>
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
            <Card>
              <div className="divide-y">
                {typeOrders.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">No work orders</div>
                ) : typeOrders.map(wo => {
                  const unit = equipmentUnits.find(u => u.id === wo.unitId);
                  return (
                    <div key={wo.id} className="p-3 flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{wo.title}</span>
                          <StatusChip variant={woStatusMap[wo.status]}>{wo.status}</StatusChip>
                          <StatusChip variant={prioMap[wo.priority]}>{wo.priority}</StatusChip>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{wo.description}</p>
                        <div className="text-xs text-muted-foreground mt-1">
                          Unit: {unit?.unitNumber} • Created: {wo.createdDate} • Cost: ${wo.cost}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="stats" className="mt-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4">
                <div className="text-xs text-muted-foreground mb-1">Uptime Rate</div>
                <div className="text-2xl font-bold text-primary">
                  {Math.round((selectedType.activeUnits / selectedType.totalUnits) * 100)}%
                </div>
                <Progress value={(selectedType.activeUnits / selectedType.totalUnits) * 100} className="mt-2 h-2" />
              </Card>
              <Card className="p-4">
                <div className="text-xs text-muted-foreground mb-1">Total Repair Cost (YTD)</div>
                <div className="text-2xl font-bold">${typeOrders.reduce((s, o) => s + o.cost, 0).toLocaleString()}</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs text-muted-foreground mb-1">Open Work Orders</div>
                <div className="text-2xl font-bold text-warning">{typeOrders.filter(o => o.status !== 'completed').length}</div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
