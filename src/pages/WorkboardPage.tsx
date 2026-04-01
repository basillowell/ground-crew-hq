import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { StatusChip } from '@/components/StatusChip';
import { employees, tasks, assignments, notes, turfData, equipmentUnits } from '@/data/mockData';
import { Plus, GripVertical, Clock, StickyNote, Droplets, Scissors, FlaskConical } from 'lucide-react';

function TaskBlock({ task, assignment }: { task: typeof tasks[0]; assignment: typeof assignments[0] }) {
  const equipment = assignment.equipmentId ? equipmentUnits.find(u => u.id === assignment.equipmentId) : null;
  return (
    <div
      className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium border"
      style={{ backgroundColor: task.color + '18', borderColor: task.color + '40', color: task.color }}
    >
      <span>{task.icon}</span>
      <span className="truncate">{task.name}</span>
      <span className="text-muted-foreground ml-auto shrink-0">{assignment.duration}m</span>
      {equipment && <Badge variant="outline" className="text-[10px] px-1 py-0">{equipment.unitNumber}</Badge>}
    </div>
  );
}

function EmployeeRow({ employee }: { employee: typeof employees[0] }) {
  const empAssignments = assignments.filter(a => a.employeeId === employee.id);
  const totalMinutes = empAssignments.reduce((s, a) => s + a.duration, 0);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  return (
    <Card className="p-3 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="cursor-grab text-muted-foreground/40 mt-1">
          <GripVertical className="h-4 w-4" />
        </div>
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
          {employee.firstName[0]}{employee.lastName[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">{employee.firstName} {employee.lastName}</span>
            <StatusChip variant="success">{employee.group}</StatusChip>
            <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {hours}h {mins}m
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {empAssignments.map((a, i) => {
              const task = tasks.find(t => t.id === a.taskId);
              return task ? <TaskBlock key={i} task={task} assignment={a} /> : null;
            })}
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground border border-dashed border-border px-2">
              <Plus className="h-3 w-3 mr-1" /> Add Task
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function NotesPanel() {
  return (
    <Tabs defaultValue="daily" className="w-full">
      <TabsList className="w-full grid grid-cols-4 h-8">
        <TabsTrigger value="daily" className="text-xs">Daily</TabsTrigger>
        <TabsTrigger value="general" className="text-xs">General</TabsTrigger>
        <TabsTrigger value="geo" className="text-xs">Geo</TabsTrigger>
        <TabsTrigger value="alerts" className="text-xs">Alerts</TabsTrigger>
      </TabsList>
      {(['daily', 'general', 'geo', 'alerts'] as const).map(tab => (
        <TabsContent key={tab} value={tab === 'alerts' ? 'alerts' : tab} className="mt-2 space-y-2">
          {notes
            .filter(n => tab === 'alerts' ? n.type === 'alert' : n.type === tab)
            .map(note => (
              <div key={note.id} className="p-2 rounded-md bg-muted/50 border text-xs">
                <div className="font-medium text-foreground mb-0.5">{note.title}</div>
                <p className="text-muted-foreground leading-relaxed">{note.content}</p>
                <div className="text-muted-foreground/70 mt-1 text-[10px]">{note.author} • {note.date}</div>
              </div>
            ))}
          <Button variant="ghost" size="sm" className="w-full text-xs border border-dashed">
            <Plus className="h-3 w-3 mr-1" /> Add Note
          </Button>
        </TabsContent>
      ))}
    </Tabs>
  );
}

function TurfPanel() {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
          <Scissors className="h-3.5 w-3.5 text-primary" /> Height of Cut
        </h4>
        <div className="space-y-1.5">
          {turfData.heightOfCut.map(h => (
            <div key={h.area} className="flex items-center justify-between text-xs p-1.5 rounded bg-muted/50">
              <span className="font-medium">{h.area}</span>
              <span className="text-primary font-mono">{h.height}</span>
              <span className="text-muted-foreground">{h.frequency}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
          <FlaskConical className="h-3.5 w-3.5 text-primary" /> Chemicals
        </h4>
        <div className="space-y-1.5">
          {turfData.chemicals.map(c => (
            <div key={c.name} className="p-1.5 rounded bg-muted/50 text-xs">
              <div className="flex justify-between">
                <span className="font-medium">{c.name}</span>
                <StatusChip variant="info">{c.type}</StatusChip>
              </div>
              <div className="text-muted-foreground mt-0.5">
                Applied: {c.lastApplied} • Next: {c.nextDue}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
          <Droplets className="h-3.5 w-3.5 text-primary" /> Mow Patterns
        </h4>
        <div className="flex flex-wrap gap-1">
          {turfData.mowPatterns.map(p => (
            <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function WorkboardPage() {
  const activeEmployees = employees.filter(e => e.status === 'active');
  const [view, setView] = useState<'employee' | 'task'>('employee');

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Main workboard */}
      <div className="flex-1 p-4 overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Workboard</h2>
            <Badge variant="secondary">{activeEmployees.length} on duty</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={view === 'employee' ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setView('employee')}
            >
              Employee View
            </Button>
            <Button
              variant={view === 'task' ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setView('task')}
            >
              Task View
            </Button>
            <Button size="sm" className="h-7 text-xs gap-1">
              <Plus className="h-3 w-3" /> Add Employee
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {activeEmployees.map(emp => (
            <EmployeeRow key={emp.id} employee={emp} />
          ))}
        </div>
      </div>

      {/* Right rail */}
      <div className="w-80 border-l bg-card overflow-auto p-4 hidden lg:block">
        <Tabs defaultValue="notes">
          <TabsList className="w-full grid grid-cols-2 h-8 mb-3">
            <TabsTrigger value="notes" className="text-xs gap-1">
              <StickyNote className="h-3 w-3" /> Notes
            </TabsTrigger>
            <TabsTrigger value="turf" className="text-xs gap-1">
              <Droplets className="h-3 w-3" /> Turf
            </TabsTrigger>
          </TabsList>
          <TabsContent value="notes">
            <NotesPanel />
          </TabsContent>
          <TabsContent value="turf">
            <TurfPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
