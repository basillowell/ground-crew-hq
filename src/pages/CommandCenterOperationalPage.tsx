import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { PropertySelector } from '@/components/shared/PropertySelector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Activity, AlertTriangle, ArrowRight, BarChart3,
  Building2, CheckCircle, Clock, Loader2,
  MapPin, Shield, TrendingUp, Users, Wrench, Zap,
} from 'lucide-react';
import { useOrgProfile } from '@/hooks/useOrgProfile';
import {
  useAssignments, useEmployees, useEquipmentUnits,
  useNotes, useProperties, useScheduleEntries,
  useTasks, useWorkLocations,
} from '@/lib/supabase-queries';

export default function CommandCenterOperationalPage() {
  const router = useRouter();
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const { currentPropertyId, orgId } = useOrgProfile();
  const todayKey = new Date().toISOString().slice(0, 10);

  const { data: properties = [], isLoading: propsLoading } = useProperties(orgId ?? undefined);
  const { data: employees = [] } = useEmployees(currentPropertyId ?? undefined, orgId ?? undefined);
  const { data: assignments = [] } = useAssignments(todayKey, currentPropertyId ?? undefined, orgId ?? undefined);
  const { data: scheduleEntries = [] } = useScheduleEntries(todayKey, currentPropertyId ?? undefined, orgId ?? undefined);
  const { data: tasks = [] } = useTasks(currentPropertyId ?? undefined, orgId ?? undefined);
  const { data: notes = [] } = useNotes(currentPropertyId ?? undefined, orgId ?? undefined);
  const { data: workLocations = [] } = useWorkLocations(undefined, orgId ?? undefined);
  const { data: equipmentUnits = [] } = useEquipmentUnits(currentPropertyId ?? undefined, orgId ?? undefined);

  const propertyStats = useMemo(() => {
    return properties.map((property) => {
      const propEmployees = employees.filter(e => e.propertyId === property.id && e.status === 'active');
      const propEmpIds = new Set(propEmployees.map(e => e.id));
      const propLocationNames = new Set(workLocations.filter(l => l.propertyId === property.id).map(l => l.name));
      const scheduledToday = scheduleEntries.filter(e => e.employeeId && propEmpIds.has(e.employeeId));
      const propAssignments = assignments.filter(a => a.employeeId && propEmpIds.has(a.employeeId));
      const equipAtProp = equipmentUnits.filter(u => propLocationNames.has(u.location ?? ''));
      const propAlerts = notes.filter(n => n.type === 'alert');
      const equipDown = equipAtProp.filter(u => u.status === 'maintenance' || u.status === 'out-of-service').length;
      return {
        propertyId: property.id,
        crewScheduled: scheduledToday.length,
        crewActive: new Set(propAssignments.map(a => a.employeeId)).size,
        tasksCompleted: propAssignments.filter(a => a.status === 'completed').length,
        tasksTotal: Math.max(tasks.filter(t => t.status === 'active').length, propAssignments.length),
        equipmentActive: equipAtProp.filter(u => u.status === 'available' || u.status === 'in-use').length,
        equipmentDown: equipDown,
        openWorkOrders: propAlerts.length,
        complianceScore: Math.max(74, 100 - equipDown * 8 - propAlerts.length * 3),
      };
    });
  }, [assignments, employees, notes, properties, scheduleEntries, tasks, workLocations, equipmentUnits]);

  const totals = useMemo(() => propertyStats.reduce(
    (acc, s) => ({
      crew: acc.crew + s.crewActive,
      tasks: acc.tasks + s.tasksCompleted,
      tasksTotal: acc.tasksTotal + s.tasksTotal,
      equipment: acc.equipment + s.equipmentActive,
      equipmentDown: acc.equipmentDown + s.equipmentDown,
      workOrders: acc.workOrders + s.openWorkOrders,
      alerts: acc.alerts,
    }),
    { crew: 0, tasks: 0, tasksTotal: 0, equipment: 0, equipmentDown: 0, workOrders: 0, alerts: 0 }
  ), [propertyStats]);

  const liveCrew = useMemo(() => employees
    .filter(e => e.status === 'active')
    .slice(0, 6)
    .map(e => {
      const assignment = assignments.find(a => a.employeeId === e.id);
      const isScheduled = scheduleEntries.some(s => s.employeeId === e.id);
      const property = properties.find(p => p.id === e.propertyId);
      return {
        id: e.id,
        name: `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim(),
        role: e.role ?? '',
        propertyShortName: property?.shortName ?? property?.name ?? 'Property',
        status: assignment ? 'active' : isScheduled ? 'scheduled' : 'unassigned',
        currentTask: assignment ? tasks.find(t => t.id === assignment.taskId)?.name ?? 'Assigned' : '',
      };
    }), [assignments, employees, properties, scheduleEntries, tasks]);

  if (propsLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Loading command center...</span>
      </div>
    </div>
  );

  const metrics = [
    { icon: Users, label: 'Total Crew', value: totals.crew, subtext: 'active today' },
    { icon: CheckCircle, label: 'Tasks Done', value: totals.tasks, subtext: `of ${totals.tasksTotal}`, color: 'hsl(var(--success))' },
    { icon: Wrench, label: 'Equipment', value: totals.equipment, subtext: `${totals.equipmentDown} down`, color: 'hsl(var(--warning))' },
    { icon: AlertTriangle, label: 'Issues', value: totals.workOrders, subtext: 'open alerts', color: 'hsl(var(--destructive))' },
    { icon: Shield, label: 'Compliance', value: `${propertyStats.length ? Math.round(propertyStats.reduce((s, p) => s + p.complianceScore, 0) / propertyStats.length) : 0}%`, color: 'hsl(var(--info))' },
    { icon: Building2, label: 'Properties', value: properties.length, subtext: `${totals.alerts} alerts` },
  ];

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <PropertySelector className="w-full md:w-64" />
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1.5 text-xs">
            <MapPin className="mr-1.5 h-3 w-3" />
            {properties.filter(p => p.status === 'active').length} Active Properties
          </Badge>
          <Button size="sm" variant="outline" onClick={() => router.push('/app/workboard')}>
            <ArrowRight className="mr-1.5 h-3.5 w-3.5" /> Go to Workflow
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        {metrics.map(m => (
          <Card key={m.label} className="flex items-center gap-3 border p-4 hover:border-primary/20 transition-colors">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
              <m.icon className="h-5 w-5" style={{ color: m.color || 'hsl(var(--primary))' }} />
            </div>
            <div>
              <div className="text-2xl font-bold">{m.value}</div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{m.label}</div>
              {m.subtext && <div className="text-xs text-muted-foreground">{m.subtext}</div>}
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Properties</h2>
            <Tabs value={view} onValueChange={v => setView(v as 'grid' | 'list')}>
              <TabsList className="h-8">
                <TabsTrigger value="grid" className="px-3 text-xs">Grid</TabsTrigger>
                <TabsTrigger value="list" className="px-3 text-xs">List</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          {properties.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-sm font-medium">No properties configured</p>
              <p className="text-xs text-muted-foreground mt-1">Add your first property in Settings.</p>
              <Button variant="outline" className="mt-4" onClick={() => router.push('/app/settings')}>
                Open Settings
              </Button>
            </Card>
          ) : view === 'grid' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {properties.map(property => {
                const stats = propertyStats.find(s => s.propertyId === property.id);
                if (!stats) return null;
                const taskPct = stats.tasksTotal > 0 ? Math.round((stats.tasksCompleted / stats.tasksTotal) * 100) : 0;
                return (
                  <Card key={property.id} className="group cursor-pointer overflow-hidden border transition-all hover:border-primary/30 hover:shadow-lg"
                    onClick={() => router.push(`/app/workboard?property=${encodeURIComponent(property.id)}`)}>
                    <div className="h-1.5" style={{ background: property.color ?? '#16a34a' }} />
                    <div className="space-y-4 p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold text-white"
                            style={{ background: property.color ?? '#16a34a' }}>
                            {property.logoInitials ?? property.name?.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-semibold group-hover:text-primary transition-colors">{property.name}</h3>
                            <p className="text-xs text-muted-foreground">{property.city}, {property.state}</p>
                          </div>
                        </div>
                        <Badge variant={property.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
                          {property.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-4 gap-3 text-center">
                        {[
                          { label: 'Crew', value: stats.crewActive },
                          { label: 'Tasks', value: `${taskPct}%` },
                          { label: 'Equip', value: stats.equipmentActive },
                          { label: 'Issues', value: stats.openWorkOrders },
                        ].map(item => (
                          <div key={item.label}>
                            <div className="text-lg font-bold">{item.value}</div>
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{item.label}</div>
                          </div>
                        ))}
                      </div>
                      <Progress value={taskPct} className="h-1.5" />
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="divide-y">
              {properties.map(property => {
                const stats = propertyStats.find(s => s.propertyId === property.id);
                if (!stats) return null;
                return (
                  <div key={property.id} className="flex cursor-pointer items-center gap-4 p-4 hover:bg-muted/30 transition-colors"
                    onClick={() => router.push(`/app/workboard?property=${encodeURIComponent(property.id)}`)}>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold text-white"
                      style={{ background: property.color ?? '#16a34a' }}>
                      {property.logoInitials ?? property.name?.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm">{property.name}</div>
                      <div className="text-xs text-muted-foreground">{property.city}, {property.state}</div>
                    </div>
                    <div className="flex items-center gap-6 text-xs text-muted-foreground">
                      <span><strong className="text-foreground">{stats.crewActive}</strong> crew</span>
                      <span><strong className="text-foreground">{stats.equipmentActive}</strong> equip</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                );
              })}
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Activity className="h-4 w-4 text-primary" /> Live Crew Activity
              </h3>
              <Badge variant="outline" className="text-[10px]">
                <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                Live
              </Badge>
            </div>
            {liveCrew.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No crew activity today</p>
            ) : liveCrew.map(member => (
              <div key={member.id} className="flex items-center gap-2.5 rounded-lg p-2 hover:bg-muted/50 transition-colors">
                <span className={`h-2 w-2 rounded-full ${member.status === 'active' ? 'bg-green-500' : member.status === 'scheduled' ? 'bg-amber-500' : 'bg-slate-400'}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{member.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{member.currentTask || member.status} · {member.propertyShortName}</div>
                </div>
                <Badge variant="outline" className="shrink-0 text-[10px]">{member.role}</Badge>
              </div>
            ))}
          </Card>

          <Card className="space-y-3 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Zap className="h-4 w-4" /> Quick Actions
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: Clock, label: 'Schedule', route: '/app/scheduler' },
                { icon: BarChart3, label: 'Workflow', route: '/app/workboard' },
                { icon: Wrench, label: 'Equipment', route: '/app/equipment' },
                { icon: TrendingUp, label: 'Reports', route: '/app/reports' },
              ].map(action => (
                <Button key={action.label} variant="outline" size="sm"
                  className="h-9 justify-start text-xs"
                  onClick={() => router.push(action.route)}>
                  <action.icon className="mr-1.5 h-3.5 w-3.5" /> {action.label}
                </Button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}


