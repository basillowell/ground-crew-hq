import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
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
import { initializeDataStore, loadAssignments, loadEmployees, loadEquipmentUnits, loadTasks } from '@/lib/dataStore';
import { equipmentTypes, type Assignment, type Employee, type Task, type EquipmentUnit } from '@/data/seedData';
import { toast } from '@/components/ui/sonner';
import { useNavigate } from 'react-router-dom';
import { LEAFLET_ATTRIBUTION, OPEN_STREET_MAP_TILE_URL, getBrowserLocation } from '@/lib/integrations';
import { supabase } from '@/lib/supabase';
import { useClockEvents, useProperties } from '@/lib/supabase-queries';
import { useAuth } from '@/contexts/AuthContext';

const crewMarkerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

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
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const { currentUser, currentPropertyId } = useAuth();
  const fieldDataQuery = useQuery<{
    assignments: Assignment[];
    tasks: Task[];
    employees: Employee[];
  }>({
    queryKey: ['mobile-field-data', today],
    queryFn: async () => {
      await initializeDataStore();
      return {
        assignments: loadAssignments().filter((assignment) => assignment.date === today),
        tasks: loadTasks(),
        employees: loadEmployees(),
      };
    },
    staleTime: 1000 * 60 * 5,
  });
  const assignments = fieldDataQuery.data?.assignments ?? [];
  const tasks = fieldDataQuery.data?.tasks ?? [];
  const employees = fieldDataQuery.data?.employees ?? [];
  const currentEmployee = employees.find((employee) => employee.id === currentUser?.employeeId) ?? employees.find((e) => e.status === 'active');
  const propertiesQuery = useProperties();
  const clockEventsQuery = useClockEvents(today, currentPropertyId || currentEmployee?.propertyId);
  const locationQuery = useQuery({
    queryKey: ['mobile-field-location'],
    staleTime: 1000 * 60 * 10,
    queryFn: getBrowserLocation,
  });
  const properties = propertiesQuery.data ?? [];
  const activeProperty = properties.find((property) => property.id === (currentPropertyId || currentEmployee?.propertyId));
  const mapCenter = activeProperty?.latitude && activeProperty?.longitude
    ? [activeProperty.latitude, activeProperty.longitude] as [number, number]
    : locationQuery.data?.ok && locationQuery.data.data
      ? [locationQuery.data.data.latitude, locationQuery.data.data.longitude] as [number, number]
      : null;
  const latestClockEvent = (clockEventsQuery.data ?? []).find((event) => event.employeeId === currentEmployee?.id);
  const activeCrewMarkers = employees
    .filter((employee) => employee.status === 'active' && (!activeProperty?.id || employee.propertyId === activeProperty.id))
    .map((employee) => {
      const latestEvent = (clockEventsQuery.data ?? []).find((event) => event.employeeId === employee.id && event.eventType === 'in');
      if (!latestEvent?.locationLat || !latestEvent?.locationLng) return null;
      return {
        id: employee.id,
        name: `${employee.firstName} ${employee.lastName}`,
        latitude: latestEvent.locationLat,
        longitude: latestEvent.locationLng,
        eventType: latestEvent.eventType,
      };
    })
    .filter((entry): entry is { id: string; name: string; latitude: number; longitude: number; eventType: 'in' | 'out' | 'break' } => Boolean(entry));
  const clockStatusLabel = latestClockEvent?.eventType === 'in'
    ? 'Clocked In'
    : latestClockEvent?.eventType === 'break'
      ? 'On Break'
      : latestClockEvent?.eventType === 'out'
        ? 'Clocked Out'
        : 'Not Clocked';

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('mobile-field-live-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_entries' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['mobile-field-data', today] });
        void queryClient.invalidateQueries({ queryKey: ['schedule-entries'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['mobile-field-data', today] });
        void queryClient.invalidateQueries({ queryKey: ['assignments'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clock_events' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['clock-events'] });
        void queryClient.invalidateQueries({ queryKey: ['assignments'] });
      })
      .subscribe();

    return () => {
      void channel.unsubscribe();
    };
  }, [queryClient, today]);

  async function recordClockEvent(eventType: 'in' | 'out' | 'break') {
    if (!supabase || !currentEmployee?.id || !currentEmployee.propertyId) {
      toast.error('No employee profile is available for clock events yet.');
      return;
    }
    const coordinates = locationQuery.data?.ok ? locationQuery.data.data : null;
    const { error } = await supabase.from('clock_events').insert({
      employee_id: currentEmployee.id,
      property_id: currentEmployee.propertyId,
      event_type: eventType,
      timestamp: new Date().toISOString(),
      location_lat: coordinates?.latitude ?? null,
      location_lng: coordinates?.longitude ?? null,
    });
    if (error) {
      toast.error('Clock event could not be saved.');
      return;
    }
    toast.success(eventType === 'in' ? 'Clocked in' : eventType === 'out' ? 'Clocked out' : 'Break started');
    await queryClient.invalidateQueries({ queryKey: ['clock-events'] });
    await queryClient.invalidateQueries({ queryKey: ['assignments'] });
  }

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

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Clock Status</div>
            <div className="text-xs text-muted-foreground">{clockStatusLabel}</div>
          </div>
          <Badge variant="outline" className="text-[10px]">
            <Clock className="mr-1 h-3 w-3" />
            {latestClockEvent ? new Date(latestClockEvent.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'No event'}
          </Badge>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button size="sm" onClick={() => void recordClockEvent('in')}>Clock In</Button>
          <Button size="sm" variant="outline" onClick={() => void recordClockEvent('break')}>Break</Button>
          <Button size="sm" variant="outline" onClick={() => void recordClockEvent('out')}>Clock Out</Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <MapPin className="h-4 w-4 text-primary" />
            Crew Location
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Native device geolocation with OpenStreetMap for live field awareness.
          </p>
        </div>
        {mapCenter ? (
          <>
            <MapContainer center={mapCenter} zoom={14} scrollWheelZoom={false} className="h-52 w-full">
              <TileLayer attribution={LEAFLET_ATTRIBUTION} url={OPEN_STREET_MAP_TILE_URL} />
              {activeCrewMarkers.map((marker) => (
                <Marker key={marker.id} position={[marker.latitude, marker.longitude]} icon={crewMarkerIcon}>
                  <Popup>
                    <div className="text-sm font-medium">{marker.name}</div>
                    <div className="text-xs text-muted-foreground">Status: {marker.eventType}</div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
            <div className="flex items-center justify-between px-4 py-3 text-xs text-muted-foreground">
              <span>
                {activeProperty?.name ?? 'Current property'} · {activeCrewMarkers.length} crew marker{activeCrewMarkers.length !== 1 ? 's' : ''}
              </span>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => locationQuery.refetch()}>
                Refresh
              </Button>
            </div>
          </>
        ) : (
          <div className="px-4 py-6 text-sm text-muted-foreground">
            {locationQuery.isLoading
              ? 'Checking device location...'
              : locationQuery.data?.error || 'Allow location access to enable field tracking.'}
          </div>
        )}
      </Card>

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
