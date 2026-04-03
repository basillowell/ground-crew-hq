import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Building2, Users, Wrench, CheckCircle, AlertTriangle,
  CloudRain, TrendingUp, ArrowRight, Activity, MapPin,
  BarChart3, Clock, Shield, Zap
} from 'lucide-react';
import { properties, propertyStats, crewMembers, type Property, type PropertyStats } from '@/data/multiPropertyData';

function PropertyCard({ property, stats, onClick }: { property: Property; stats: PropertyStats; onClick: () => void }) {
  const taskPct = stats.tasksTotal > 0 ? Math.round((stats.tasksCompleted / stats.tasksTotal) * 100) : 0;
  return (
    <Card
      className="group cursor-pointer overflow-hidden border transition-all hover:shadow-lg hover:border-primary/30"
      onClick={onClick}
    >
      <div className="h-1.5" style={{ background: property.color }} />
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold text-white"
              style={{ background: property.color }}
            >
              {property.logoInitials}
            </div>
            <div>
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{property.name}</h3>
              <p className="text-xs text-muted-foreground">{property.city}, {property.state} · {property.acreage} acres</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {stats.weatherAlert && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5">
                <CloudRain className="h-3 w-3 mr-0.5" /> Weather
              </Badge>
            )}
            <Badge
              variant={property.status === 'active' ? 'default' : 'secondary'}
              className="text-[10px] px-1.5 py-0.5"
            >
              {property.status}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className="text-center">
            <div className="text-lg font-bold text-foreground">{stats.crewActive}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Crew</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-foreground">{taskPct}%</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Tasks</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-foreground">{stats.equipmentActive}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Equip</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold" style={{ color: stats.complianceScore >= 95 ? 'hsl(var(--success))' : stats.complianceScore >= 80 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))' }}>
              {stats.complianceScore}%
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Comply</div>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px]">
            <span className="text-muted-foreground">Task completion</span>
            <span className="font-medium">{stats.tasksCompleted}/{stats.tasksTotal}</span>
          </div>
          <Progress value={taskPct} className="h-1.5" />
        </div>

        {stats.openWorkOrders > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Wrench className="h-3 w-3" />
            <span>{stats.openWorkOrders} open work order{stats.openWorkOrders > 1 ? 's' : ''}</span>
            {stats.equipmentDown > 0 && (
              <span className="text-destructive">· {stats.equipmentDown} down</span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function AggregateMetric({ icon: Icon, label, value, subtext, color }: { icon: any; label: string; value: string | number; subtext?: string; color?: string }) {
  return (
    <Card className="p-4 flex items-center gap-3 border hover:border-primary/20 transition-colors">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
        <Icon className="h-5 w-5" style={{ color: color || 'hsl(var(--primary))' }} />
      </div>
      <div>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <div className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</div>
        {subtext && <div className="text-xs text-muted-foreground">{subtext}</div>}
      </div>
    </Card>
  );
}

function LiveCrewFeed() {
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Live Crew Activity
        </h3>
        <Badge variant="outline" className="text-[10px]">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />
          Real-time
        </Badge>
      </div>
      <div className="space-y-2">
        {crewMembers.slice(0, 6).map((member) => {
          const prop = properties.find((p) => p.id === member.propertyId);
          const statusColor = member.status === 'active' ? 'bg-green-500' : member.status === 'on-break' ? 'bg-amber-500' : member.status === 'traveling' ? 'bg-blue-500' : 'bg-muted';
          return (
            <div key={member.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/50 transition-colors">
              <span className={`h-2 w-2 rounded-full ${statusColor}`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{member.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {member.currentTask || member.status.replace('-', ' ')} · {prop?.shortName}
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">{member.role}</Badge>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function CommandCenterPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const totals = useMemo(() => {
    return propertyStats.reduce(
      (acc, s) => ({
        crew: acc.crew + s.crewActive,
        tasks: acc.tasks + s.tasksCompleted,
        tasksTotal: acc.tasksTotal + s.tasksTotal,
        equipment: acc.equipment + s.equipmentActive,
        equipmentDown: acc.equipmentDown + s.equipmentDown,
        workOrders: acc.workOrders + s.openWorkOrders,
        alerts: acc.alerts + (s.weatherAlert ? 1 : 0),
      }),
      { crew: 0, tasks: 0, tasksTotal: 0, equipment: 0, equipmentDown: 0, workOrders: 0, alerts: 0 }
    );
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="brand-heading text-2xl font-bold text-foreground">Command Center</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Cross-property operations at a glance</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1.5 text-xs">
            <MapPin className="h-3 w-3 mr-1.5" />
            {properties.filter((p) => p.status === 'active').length} Active Properties
          </Badge>
          <Button size="sm" variant="outline" onClick={() => navigate('/app/workboard')}>
            <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
            Go to Workflow
          </Button>
        </div>
      </div>

      {/* Aggregate metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <AggregateMetric icon={Users} label="Total Crew" value={totals.crew} subtext="across all sites" />
        <AggregateMetric icon={CheckCircle} label="Tasks Done" value={totals.tasks} subtext={`of ${totals.tasksTotal} today`} color="hsl(var(--success))" />
        <AggregateMetric icon={Wrench} label="Equipment" value={totals.equipment} subtext={`${totals.equipmentDown} down`} color="hsl(var(--warning))" />
        <AggregateMetric icon={AlertTriangle} label="Work Orders" value={totals.workOrders} subtext="open" color="hsl(var(--destructive))" />
        <AggregateMetric icon={Shield} label="Avg Compliance" value={`${Math.round(propertyStats.reduce((a, s) => a + s.complianceScore, 0) / propertyStats.length)}%`} color="hsl(var(--info))" />
        <AggregateMetric icon={Building2} label="Properties" value={properties.length} subtext={`${totals.alerts} weather alert${totals.alerts !== 1 ? 's' : ''}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Property cards */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Properties</h2>
            <Tabs value={view} onValueChange={(v) => setView(v as 'grid' | 'list')}>
              <TabsList className="h-8">
                <TabsTrigger value="grid" className="text-xs px-3">Grid</TabsTrigger>
                <TabsTrigger value="list" className="text-xs px-3">List</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {view === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {properties.map((prop) => {
                const stats = propertyStats.find((s) => s.propertyId === prop.id)!;
                return (
                  <PropertyCard
                    key={prop.id}
                    property={prop}
                    stats={stats}
                    onClick={() => navigate('/app/workboard')}
                  />
                );
              })}
            </div>
          ) : (
            <Card className="divide-y">
              {properties.map((prop) => {
                const stats = propertyStats.find((s) => s.propertyId === prop.id)!;
                const taskPct = stats.tasksTotal > 0 ? Math.round((stats.tasksCompleted / stats.tasksTotal) * 100) : 0;
                return (
                  <div
                    key={prop.id}
                    className="flex items-center gap-4 p-4 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => navigate('/app/workboard')}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ background: prop.color }}>
                      {prop.logoInitials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{prop.name}</div>
                      <div className="text-xs text-muted-foreground">{prop.city}, {prop.state}</div>
                    </div>
                    <div className="flex items-center gap-6 text-xs text-muted-foreground">
                      <span><strong className="text-foreground">{stats.crewActive}</strong> crew</span>
                      <span><strong className="text-foreground">{taskPct}%</strong> tasks</span>
                      <span><strong className="text-foreground">{stats.equipmentActive}</strong> equip</span>
                      {stats.weatherAlert && <CloudRain className="h-4 w-4 text-destructive" />}
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                );
              })}
            </Card>
          )}
        </div>

        {/* Live crew feed */}
        <div className="space-y-4">
          <LiveCrewFeed />

          <Card className="p-4 space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-warning" />
              Quick Actions
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="justify-start text-xs h-9" onClick={() => navigate('/app/scheduler')}>
                <Clock className="h-3.5 w-3.5 mr-1.5" /> Schedule
              </Button>
              <Button variant="outline" size="sm" className="justify-start text-xs h-9" onClick={() => navigate('/app/workboard')}>
                <BarChart3 className="h-3.5 w-3.5 mr-1.5" /> Dispatch
              </Button>
              <Button variant="outline" size="sm" className="justify-start text-xs h-9" onClick={() => navigate('/app/equipment')}>
                <Wrench className="h-3.5 w-3.5 mr-1.5" /> Equipment
              </Button>
              <Button variant="outline" size="sm" className="justify-start text-xs h-9" onClick={() => navigate('/app/reports')}>
                <TrendingUp className="h-3.5 w-3.5 mr-1.5" /> Reports
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
