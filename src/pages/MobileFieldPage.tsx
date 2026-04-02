import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  CheckCircle2, Clock, QrCode, Camera, MapPin,
  Wrench, StickyNote, ChevronRight, Play, Pause,
  ArrowLeft, User, CloudSun
} from 'lucide-react';
import { loadAssignments, loadEmployees, loadEquipmentUnits, loadTasks } from '@/lib/dataStore';
import { equipmentTypes, type Assignment, type Employee, type Task, type EquipmentUnit } from '@/data/seedData';
import { toast } from '@/components/ui/sonner';
import { useNavigate } from 'react-router-dom';

function QuickNote({ onSubmit }: { onSubmit: (note: string) => void }) {
  const [text, setText] = useState('');
  return (
    <div className="space-y-2">
      <Textarea
        placeholder="Quick note — what's happening on-site?"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="text-sm"
      />
      <div className="flex gap-2">
        <Button size="sm" className="flex-1" onClick={() => { onSubmit(text); setText(''); }}>
          <StickyNote className="h-3.5 w-3.5 mr-1.5" /> Save Note
        </Button>
        <Button size="sm" variant="outline">
          <Camera className="h-3.5 w-3.5 mr-1.5" /> Photo
        </Button>
        <Button size="sm" variant="outline">
          <MapPin className="h-3.5 w-3.5 mr-1.5" /> Pin
        </Button>
      </div>
    </div>
  );
}

function TaskCard({ assignment, task, onComplete }: { assignment: Assignment; task?: Task; onComplete: () => void }) {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="p-4 space-y-3 border-l-4" style={{ borderLeftColor: task?.color || 'hsl(var(--primary))' }}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-sm">{task?.name || 'Task'}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{assignment.area} · {assignment.duration}min planned</p>
        </div>
        <Badge variant="outline" className="text-[10px]">{assignment.startTime}</Badge>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant={isRunning ? 'destructive' : 'default'}
          size="sm"
          className="flex-1"
          onClick={() => setIsRunning(!isRunning)}
        >
          {isRunning ? <Pause className="h-3.5 w-3.5 mr-1.5" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
          {isRunning ? `Running ${formatTime(elapsed)}` : 'Start Timer'}
        </Button>
        <Button variant="outline" size="sm" onClick={() => { onComplete(); toast.success('Task completed!'); }}>
          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Done
        </Button>
      </div>
    </Card>
  );
}

function EquipmentScanner() {
  const [scanResult, setScanResult] = useState<EquipmentUnit | null>(null);
  const [units] = useState(loadEquipmentUnits);
  const [searchCode, setSearchCode] = useState('');

  function simulateScan() {
    const unit = units[Math.floor(Math.random() * units.length)];
    setScanResult(unit);
    toast.success(`Scanned: ${unit.unitNumber}`);
  }

  function searchUnit() {
    const found = units.find((u) => u.unitNumber.toLowerCase().includes(searchCode.toLowerCase()));
    if (found) {
      setScanResult(found);
    } else {
      toast.error('Equipment not found');
    }
  }

  const eqType = scanResult ? equipmentTypes.find((t) => t.id === scanResult.typeId) : null;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button className="flex-1" onClick={simulateScan}>
          <QrCode className="h-4 w-4 mr-2" /> Scan QR Code
        </Button>
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Or search by unit #"
          value={searchCode}
          onChange={(e) => setSearchCode(e.target.value)}
          className="text-sm"
        />
        <Button variant="outline" onClick={searchUnit}>Search</Button>
      </div>

      {scanResult && (
        <Card className="p-4 space-y-2 border-primary/20">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">{eqType?.name} #{scanResult.unitNumber}</h3>
            <Badge
              variant={scanResult.status === 'available' ? 'default' : scanResult.status === 'in-use' ? 'secondary' : 'destructive'}
              className="text-[10px]"
            >
              {scanResult.status}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div><strong>Hours:</strong> {scanResult.hours}</div>
            <div><strong>Location:</strong> {scanResult.location}</div>
            <div><strong>Last Service:</strong> {scanResult.lastService}</div>
            <div><strong>Next Service:</strong> {scanResult.nextService}</div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" className="flex-1 text-xs">Check Out</Button>
            <Button size="sm" variant="outline" className="flex-1 text-xs">Report Issue</Button>
          </div>
        </Card>
      )}
    </div>
  );
}

export default function MobileFieldPage() {
  const navigate = useNavigate();
  const [assignments] = useState(() => loadAssignments().filter((a) => a.date === new Date().toISOString().slice(0, 10)));
  const [tasks] = useState(loadTasks);
  const [employees] = useState(loadEmployees);
  const currentEmployee = employees.find((e) => e.status === 'active');

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/app/workboard')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Badge variant="outline" className="text-xs">
          <User className="h-3 w-3 mr-1" />
          {currentEmployee ? `${currentEmployee.firstName} ${currentEmployee.lastName}` : 'Field View'}
        </Badge>
      </div>

      <div className="text-center space-y-1">
        <h1 className="text-xl font-bold">Field Companion</h1>
        <p className="text-xs text-muted-foreground">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <Tabs defaultValue="tasks" className="w-full">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="tasks" className="text-xs">My Tasks</TabsTrigger>
          <TabsTrigger value="equipment" className="text-xs">Equipment</TabsTrigger>
          <TabsTrigger value="notes" className="text-xs">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="space-y-3 mt-3">
          {assignments.length === 0 ? (
            <Card className="p-8 text-center">
              <CheckCircle2 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No assignments for today</p>
            </Card>
          ) : (
            assignments.map((a) => (
              <TaskCard
                key={a.id || `${a.employeeId}-${a.startTime}`}
                assignment={a}
                task={tasks.find((t) => t.id === a.taskId)}
                onComplete={() => {}}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="equipment" className="mt-3">
          <EquipmentScanner />
        </TabsContent>

        <TabsContent value="notes" className="mt-3">
          <QuickNote onSubmit={(note) => { if (note) toast.success('Note saved'); }} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
