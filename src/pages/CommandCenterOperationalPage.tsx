import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle,
  CloudRain,
  Clock,
  MapPin,
  Shield,
  TrendingUp,
  Users,
  Wrench,
  Zap,
} from 'lucide-react';
import type { Assignment, Employee, Note, Property, ScheduleEntry, Task, WorkLocation } from '@/data/seedData';
import {
  DATA_STORE_UPDATED_EVENT,
  loadAssignments,
  loadEmployees,
  loadEquipmentUnits,
  loadNotes,
  loadProperties,
  loadScheduleEntries,
  loadTasks,
  loadWorkLocations,
  saveCurrentPropertyId,
} from '@/lib/dataStore';

type PropertyStats = {
  propertyId: string;
  crewScheduled: number;
  crewActive: number;
  tasksCompleted: number;
  tasksTotal: number;
  equipmentActive: number;
  equipmentDown: number;
  openWorkOrders: number;
  weatherAlert: boolean;
  complianceScore: number;
};

function PropertyCard({ property, stats, onClick }: { property: Property; stats: PropertyStats; onClick: () => void }) {
  const taskPct = stats.tasksTotal > 0 ? Math.round((stats.tasksCompleted / stats.tasksTotal) * 100) : 0;
  return (
    <Card className="group cursor-pointer overflow-hidden border transition-all hover:border-primary/30 hover:shadow-lg" onClick={onClick}>
      <div className="h-1.5" style={{ background: property.color }} />
      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ background: property.color }}>
              {property.logoInitials}
            </div>
            <div>
              <h3 className="font-semibold text-foreground transition-colors group-hover:text-primary">{property.name}</h3>
              <p className="text-xs text-muted-foreground">{property.city}, {property.state} · {property.acreage} acres</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {stats.weatherAlert ? (
              <Badge variant="destructive" className="px-1.5 py-0.5 text-[10px]">
                <CloudRain className="mr-0.5 h-3 w-3" /> Weather
              </Badge>
            ) : null}
            <Badge variant={property.status === 'active' ? 'default' : 'secondary'} className="px-1.5 py-0.5 text-[10px]">
              {property.status}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className="text-center">
            <div className="text-lg font-bold text-foreground">{stats.crewActive}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Crew</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-foreground">{taskPct}%</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Tasks</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-foreground">{stats.equipmentActive}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Equip</div>
          </div>
          <div className="text-center">
            <div
              className="text-lg font-bold"
              style={{
                color:
                  stats.complianceScore >= 95
                    ? 'hsl(var(--success))'
                    : stats.complianceScore >= 80
                      ? 'hsl(var(--warning))'
                      : 'hsl(var(--destructive))',
              }}
            >
              {stats.complianceScore}%
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Comply</div>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px]">
            <span className="text-muted-foreground">Task completion</span>
            <span className="font-medium">{stats.tasksCompleted}/{stats.tasksTotal}</span>
          </div>
          <Progress value={taskPct} className="h-1.5" />
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Wrench className="h-3 w-3" />
          <span>{stats.openWorkOrders} open issue{stats.openWorkOrders !== 1 ? 's' : ''}</span>
          {stats.equipmentDown > 0 ? <span className="text-destructive">· {stats.equipmentDown} down</span> : null}
        </div>
      </div>
    </Card>
  );
}

function AggregateMetric({ icon: Icon, label, value, subtext, color }: { icon: any; label: string; value: string | number; subtext?: string; color?: string }) {
  return (
    <Card className="flex items-center gap-3 border p-4 transition-colors hover:border-primary/20">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
        <Icon className="h-5 w-5" style={{ color: color || 'hsl(var(--primary))' }} />
      </div>
      <div>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        {subtext ? <div className="text-xs text-muted-foreground">{subtext}</div> : null}
      </div>
    </Card>
  );
}

export default function CommandCenterOperationalPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [properties, setProperties] = useState<Property[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [workLocations, setWorkLocations] = useState<WorkLocation[]>([]);

  useEffect(() => {
    const refresh = () => {
      setProperties(loadProperties());
      setEmployees(loadEmployees());
      setAssignments(loadAssignments());
      setScheduleEntries(loadScheduleEntries());
      setTasks(loadTasks());
      setNotes(loadNotes());
      setWorkLocations(loadWorkLocations());
    };
    refresh();
    window.addEventListener(DATA_STORE_UPDATED_EVENT, refresh as EventListener);
    return () => window.removeEventListener(DATA_STORE_UPDATED_EVENT, refresh as EventListener);
  }, []);

  const propertyStats = useMemo<PropertyStats[]>(() => {
    const today = new Date().toISOString().slice(0, 10);
    const equipmentUnits = loadEquipmentUnits();

    return properties.map((property) => {
      const propertyEmployees = employees.filter((employee) => employee.propertyId === property.id && employee.status === 'active');
      const propertyEmployeeIds = new Set(propertyEmployees.map((employee) => employee.id));
      const propertyLocationNames = new Set(workLocations.filter((location) => location.propertyId === property.id).map((location) => location.name));
      const scheduledToday = scheduleEntries.filter((entry) => entry.date === today && entry.status === 'scheduled' && propertyEmployeeIds.has(entry.employeeId));
      const propertyAssignments = assignments.filter((assignment) => assignment.date === today && propertyEmployeeIds.has(assignment.employeeId));
      const equipmentAtProperty = equipmentUnits.filter((unit) => propertyLocationNames.has(unit.location));
      const propertyAlerts = notes.filter((note) => note.type === 'alert' && (!note.location || note.location.includes(property.name)));
      const weatherAlert = propertyAlerts.some((note) => /weather|storm|rain/i.test(`${note.title} ${note.content}`));
      const equipmentDown = equipmentAtProperty.filter((unit) => unit.status === 'maintenance' || unit.status === 'out-of-service').length;
      const openWorkOrders = propertyAlerts.length;
      const taskBacklog = tasks.filter((task) => (task.status ?? 'active') === 'active').length;
      return {
        propertyId: property.id,
        crewScheduled: scheduledToday.length,
        crewActive: new Set(propertyAssignments.map((assignment) => assignment.employeeId)).size,
        tasksCompleted: propertyAssignments.length,
        tasksTotal: Math.max(taskBacklog, propertyAssignments.length),
        equipmentActive: equipmentAtProperty.filter((unit) => unit.status === 'available' || unit.status === 'in-use').length,
        equipmentDown,
        openWorkOrders,
        weatherAlert,
        complianceScore: Math.max(74, 100 - equipmentDown * 8 - openWorkOrders * 3),
      };
    });
  }, [assignments, employees, notes, properties, scheduleEntries, tasks, workLocations]);

  const totals = useMemo(() => {
    return propertyStats.reduce(
      (acc, stats) => ({
        crew: acc.crew + stats.crewActive,
        tasks: acc.tasks + stats.tasksCompleted,
        tasksTotal: acc.tasksTotal + stats.tasksTotal,
        equipment: acc.equipment + stats.equipmentActive,
        equipmentDown: acc.equipmentDown + stats.equipmentDown,
        workOrders: acc.workOrders + stats.openWorkOrders,
        alerts: acc.alerts + (stats.weatherAlert ? 1 : 0),
      }),
      { crew: 0, tasks: 0, tasksTotal: 0, equipment: 0, equipmentDown: 0, workOrders: 0, alerts: 0 },
    );
  }, [propertyStats]);

  const aggregateMetrics = useMemo(
    () => [
      { icon: Users, label: 'Total Crew', value: totals.crew, subtext: 'across active properties' },
      { icon: CheckCircle, label: 'Tasks Done', value: totals.tasks, subtext: `of ${totals.tasksTotal} today`, color: 'hsl(var(--success))' },
      { icon: Wrench, label: 'Equipment', value: totals.equipment, subtext: `${totals.equipmentDown} down`, color: 'hsl(var(--warning))' },
      { icon: AlertTriangle, label: 'Issues', value: totals.workOrders, subtext: 'alerts + work orders', color: 'hsl(var(--destructive))' },
      {
        icon: Shield,
        label: 'Avg Compliance',
        value: `${propertyStats.length ? Math.round(propertyStats.reduce((sum, stats) => sum + stats.complianceScore, 0) / propertyStats.length) : 0}%`,
        color: 'hsl(var(--info))',
      },
      { icon: Building2, label: 'Properties', value: properties.length, subtext: `${totals.alerts} weather alert${totals.alerts !== 1 ? 's' : ''}` },
    ],
    [properties.length, propertyStats, totals],
  );

  const liveCrew = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return employees
      .filter((employee) => employee.status === 'active')
      .slice(0, 6)
      .map((employee) => {
        const assignment = assignments.find((entry) => entry.employeeId === employee.id && entry.date === today);
        const isScheduled = scheduleEntries.some((entry) => entry.employeeId === employee.id && entry.date === today && entry.status === 'scheduled');
        const property = properties.find((entry) => entry.id === employee.propertyId);
        return {
          id: employee.id,
          name: `${employee.firstName} ${employee.lastName}`,
          role: employee.role,
          propertyShortName: property?.shortName || 'Property',
          status: assignment ? 'active' : isScheduled ? 'on-break' : 'traveling',
          currentTask: assignment ? tasks.find((task) => task.id === assignment.taskId)?.name || 'Assigned' : '',
        };
      });
  }, [assignments, employees, properties, scheduleEntries, tasks]);

  const openPropertyWorkflow = (propertyId: string) => {
    saveCurrentPropertyId(propertyId);
    window.dispatchEvent(new CustomEvent('operations-context-updated', { detail: { propertyId } }));
    navigate(`/app/workboard?property=${encodeURIComponent(propertyId)}&focus=requests`);
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="brand-heading text-2xl font-bold text-foreground">Command Center</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Cross-property operations at a glance</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1.5 text-xs">
            <MapPin className="mr-1.5 h-3 w-3" />
            {properties.filter((property) => property.status === 'active').length} Active Properties
          </Badge>
          <Button size="sm" variant="outline" onClick={() => navigate('/app/workboard')}>
            <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
            Go to Workflow
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        {aggregateMetrics.map((metric) => (
          <AggregateMetric
            key={metric.label}
            icon={metric.icon}
            label={metric.label}
            value={metric.value}
            subtext={metric.subtext}
            color={metric.color}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Properties</h2>
            <Tabs value={view} onValueChange={(value) => setView(value as 'grid' | 'list')}>
              <TabsList className="h-8">
                <TabsTrigger value="grid" className="px-3 text-xs">Grid</TabsTrigger>
                <TabsTrigger value="list" className="px-3 text-xs">List</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {view === 'grid' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {properties.map((property) => {
                const stats = propertyStats.find((entry) => entry.propertyId === property.id);
                if (!stats) return null;
                return <PropertyCard key={property.id} property={property} stats={stats} onClick={() => openPropertyWorkflow(property.id)} />;
              })}
            </div>
          ) : (
            <Card className="divide-y">
              {properties.map((property) => {
                const stats = propertyStats.find((entry) => entry.propertyId === property.id);
                if (!stats) return null;
                const taskPct = stats.tasksTotal > 0 ? Math.round((stats.tasksCompleted / stats.tasksTotal) * 100) : 0;
                return (
                  <div key={property.id} className="flex cursor-pointer items-center gap-4 p-4 transition-colors hover:bg-muted/30" onClick={() => openPropertyWorkflow(property.id)}>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ background: property.color }}>
                      {property.logoInitials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm">{property.name}</div>
                      <div className="text-xs text-muted-foreground">{property.city}, {property.state}</div>
                    </div>
                    <div className="flex items-center gap-6 text-xs text-muted-foreground">
                      <span><strong className="text-foreground">{stats.crewActive}</strong> crew</span>
                      <span><strong className="text-foreground">{taskPct}%</strong> tasks</span>
                      <span><strong className="text-foreground">{stats.equipmentActive}</strong> equip</span>
                      {stats.weatherAlert ? <CloudRain className="h-4 w-4 text-destructive" /> : null}
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
                <Activity className="h-4 w-4 text-primary" />
                Live Crew Activity
              </h3>
              <Badge variant="outline" className="text-[10px]">
                <span className="mr-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                Shared store
              </Badge>
            </div>
            <div className="space-y-2">
              {liveCrew.map((member) => {
                const statusColor = member.status === 'active' ? 'bg-green-500' : member.status === 'on-break' ? 'bg-amber-500' : 'bg-blue-500';
                return (
                  <div key={member.id} className="flex items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-muted/50">
                    <span className={`h-2 w-2 rounded-full ${statusColor}`} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{member.name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{member.currentTask || member.status.replace('-', ' ')} · {member.propertyShortName}</div>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[10px]">{member.role}</Badge>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="space-y-3 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Zap className="h-4 w-4 text-warning" />
              Quick Actions
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="h-9 justify-start text-xs" onClick={() => navigate('/app/scheduler')}>
                <Clock className="mr-1.5 h-3.5 w-3.5" /> Schedule
              </Button>
              <Button variant="outline" size="sm" className="h-9 justify-start text-xs" onClick={() => navigate('/app/workboard')}>
                <BarChart3 className="mr-1.5 h-3.5 w-3.5" /> Dispatch
              </Button>
              <Button variant="outline" size="sm" className="h-9 justify-start text-xs" onClick={() => navigate('/app/equipment')}>
                <Wrench className="mr-1.5 h-3.5 w-3.5" /> Equipment
              </Button>
              <Button variant="outline" size="sm" className="h-9 justify-start text-xs" onClick={() => navigate('/app/reports')}>
                <TrendingUp className="mr-1.5 h-3.5 w-3.5" /> Reports
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
