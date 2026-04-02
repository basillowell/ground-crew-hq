import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Clock, Wrench, CheckCircle2, AlertTriangle, DollarSign, ChevronRight } from 'lucide-react';
import type { WorkOrder, EquipmentUnit } from '@/data/seedData';
import { workOrders as seedWorkOrders, equipmentTypes } from '@/data/seedData';
import { loadEquipmentUnits } from '@/lib/dataStore';

const columns: { key: WorkOrder['status']; label: string; icon: any; color: string }[] = [
  { key: 'open', label: 'Reported', icon: AlertTriangle, color: 'hsl(var(--warning))' },
  { key: 'in-progress', label: 'In Progress', icon: Wrench, color: 'hsl(var(--info))' },
  { key: 'completed', label: 'Completed', icon: CheckCircle2, color: 'hsl(var(--success))' },
];

const priorityColors = { low: 'secondary', medium: 'outline', high: 'destructive' } as const;

function WorkOrderCard({ wo, units, onMoveForward }: { wo: WorkOrder; units: EquipmentUnit[]; onMoveForward?: () => void }) {
  const unit = units.find((u) => u.id === wo.unitId);
  const eqType = equipmentTypes.find((t) => t.id === unit?.typeId);

  return (
    <Card className="p-3 space-y-2 border hover:border-primary/20 transition-all hover:shadow-sm cursor-grab active:cursor-grabbing">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium leading-tight">{wo.title}</h4>
        <Badge variant={priorityColors[wo.priority]} className="text-[10px] shrink-0 px-1.5">
          {wo.priority}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2">{wo.description}</p>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Wrench className="h-3 w-3" />
          {eqType?.name || 'Unknown'} #{unit?.unitNumber || '?'}
        </span>
        {wo.cost > 0 && (
          <span className="flex items-center gap-0.5">
            <DollarSign className="h-3 w-3" />{wo.cost}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />{wo.createdDate}
        </span>
        {wo.status !== 'completed' && onMoveForward && (
          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={onMoveForward}>
            Move <ChevronRight className="h-3 w-3 ml-0.5" />
          </Button>
        )}
      </div>
    </Card>
  );
}

export function WorkOrderKanban() {
  const [orders, setOrders] = useState<WorkOrder[]>(seedWorkOrders);
  const [units] = useState(loadEquipmentUnits);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState({ title: '', description: '', unitId: '', priority: 'medium' as WorkOrder['priority'] });

  function moveForward(woId: string) {
    setOrders((prev) =>
      prev.map((wo) => {
        if (wo.id !== woId) return wo;
        if (wo.status === 'open') return { ...wo, status: 'in-progress' as const };
        if (wo.status === 'in-progress') return { ...wo, status: 'completed' as const, completedDate: new Date().toISOString().slice(0, 10) };
        return wo;
      })
    );
  }

  function addWorkOrder() {
    if (!draft.title || !draft.unitId) return;
    const newWo: WorkOrder = {
      id: `wo-${Date.now()}`,
      unitId: draft.unitId,
      title: draft.title,
      description: draft.description,
      status: 'open',
      priority: draft.priority,
      createdDate: new Date().toISOString().slice(0, 10),
      cost: 0,
    };
    setOrders((prev) => [newWo, ...prev]);
    setDialogOpen(false);
    setDraft({ title: '', description: '', unitId: '', priority: 'medium' });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground">Work Order Pipeline</h2>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> New Work Order
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columns.map((col) => {
          const colOrders = orders.filter((wo) => wo.status === col.key);
          return (
            <div key={col.key} className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <col.icon className="h-4 w-4" style={{ color: col.color }} />
                <span className="text-sm font-medium">{col.label}</span>
                <Badge variant="secondary" className="text-[10px] h-5 min-w-5 flex items-center justify-center">
                  {colOrders.length}
                </Badge>
              </div>
              <div className="space-y-2 min-h-[120px] p-2 rounded-xl border border-dashed border-border/60 bg-muted/20">
                {colOrders.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-8">No items</div>
                ) : (
                  colOrders.map((wo) => (
                    <WorkOrderCard
                      key={wo.id}
                      wo={wo}
                      units={units}
                      onMoveForward={wo.status !== 'completed' ? () => moveForward(wo.id) : undefined}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Work Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Title" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
            <Textarea placeholder="Description" value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} rows={3} />
            <Select value={draft.unitId} onValueChange={(v) => setDraft((d) => ({ ...d, unitId: v }))}>
              <SelectTrigger><SelectValue placeholder="Select equipment unit" /></SelectTrigger>
              <SelectContent>
                {units.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {equipmentTypes.find((t) => t.id === u.typeId)?.name} #{u.unitNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={draft.priority} onValueChange={(v) => setDraft((d) => ({ ...d, priority: v as WorkOrder['priority'] }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low Priority</SelectItem>
                <SelectItem value="medium">Medium Priority</SelectItem>
                <SelectItem value="high">High Priority</SelectItem>
              </SelectContent>
            </Select>
            <Button className="w-full" onClick={addWorkOrder}>Create Work Order</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
