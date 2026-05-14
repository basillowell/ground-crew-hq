import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PageHeader } from '@/components/shared';
import { EmployeeRow } from '@/components/workboard/EmployeeRow';
import { GanttTimeline } from '@/components/workboard/GanttTimeline';
import { NotesPanel } from '@/components/workboard/NotesPanel';
import { WeatherSnapshotCard } from '@/components/weather/WeatherSnapshotCard';
import { toast } from '@/components/ui/sonner';
import {
  type ApplicationArea,
  type Assignment,
  type Employee,
  type EquipmentUnit,
  type Note,
  type Property,
  type ScheduleEntry,
  type Task,
  type TaskRequest,
  type WeatherDailyLog,
  type WeatherLocation,
  type WorkLocation,
} from '@/data/seedData';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  CloudSun,
  GanttChart,
  LayoutList,
  ListChecks,
  MonitorSmartphone,
  Radio,
  StickyNote,
  Users,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useAssignments, useEmployees, useEquipmentUnits, useNotes, useProperties, useScheduleEntries, useTasks } from '@/lib/supabase-queries';
import { fetchOpenMeteoWeather } from '@/lib/openMeteo';
import { formatTime } from '@/utils/formatTime';

function getShiftForEmployee(scheduleList: ScheduleEntry[], employeeId: string, date: string) {
  return scheduleList.find((entry) => entry.employeeId === employeeId && entry.date === date);
}

function timeToMinutes(value?: string) {
  if (!value) return 0;
  const [hours, minutes] = value.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
  return hours * 60 + minutes;
}

function makeId() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2, 14)}`;
}

function normalizeApplicationArea(row: Record<string, unknown>): ApplicationArea {
  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    property: String(row.property ?? row.propertyName ?? ''),
    weatherLocationId: String(row.weatherLocationId ?? row.weather_location_id ?? ''),
  };
}

type NeedsQueueRequest = {
  id: string;
  propertyId: string;
  date: string;
  title: string;
  taskId?: string;
  requestedBy: string;
  requestedByType: 'client' | 'manager' | 'crew';
  priority: 'high' | 'medium' | 'low';
  status: 'new' | 'assigned' | 'dismissed' | string;
  preferredLocation?: string;
  notes: string;
  createdAt?: string;
};

function normalizeTaskRequest(row: Record<string, unknown>): NeedsQueueRequest {
  return {
    id: String(row.id ?? ''),
    propertyId: String(row.propertyId ?? row.property_id ?? ''),
    date: String(row.date ?? ''),
    title: String(row.title ?? ''),
    taskId: row.taskId ? String(row.taskId) : row.task_id ? String(row.task_id) : undefined,
    requestedBy: String(row.requestedBy ?? row.requested_by ?? 'Client Request'),
    requestedByType: (row.requestedByType ?? row.requested_by_type ?? 'client') as TaskRequest['requestedByType'],
    priority: (row.priority ?? 'medium') as TaskRequest['priority'],
    status: (row.status ?? 'new') as NeedsQueueRequest['status'],
    preferredLocation: row.preferredLocation ? String(row.preferredLocation) : row.preferred_location ? String(row.preferred_location) : undefined,
    notes: String(row.notes ?? ''),
    createdAt: row.createdAt ? String(row.createdAt) : row.created_at ? String(row.created_at) : undefined,
  };
}

function normalizeWeatherLocation(row: Record<string, unknown>): WeatherLocation {
  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    property: String(row.property ?? row.propertyName ?? ''),
    propertyId: row.propertyId ? String(row.propertyId) : row.property_id ? String(row.property_id) : undefined,
    area: String(row.area ?? ''),
    address: row.address ? String(row.address) : undefined,
    latitude: typeof row.latitude === 'number' ? row.latitude : undefined,
    longitude: typeof row.longitude === 'number' ? row.longitude : undefined,
  };
}

function normalizeWeatherLog(row: Record<string, unknown>): WeatherDailyLog {
  return {
    id: String(row.id ?? ''),
    locationId: String(row.locationId ?? row.location_id ?? ''),
    stationId: row.stationId ? String(row.stationId) : row.station_id ? String(row.station_id) : undefined,
    date: String(row.date ?? ''),
    capturedAt: row.capturedAt ? String(row.capturedAt) : row.captured_at ? String(row.captured_at) : undefined,
    currentConditions: String(row.currentConditions ?? row.current_conditions ?? 'Unknown'),
    forecast: String(row.forecast ?? ''),
    rainfallTotal: Number(row.rainfallTotal ?? row.rainfall_total ?? 0),
    temperature: Number(row.temperature ?? 0),
    humidity: Number(row.humidity ?? 0),
    wind: Number(row.wind ?? 0),
    windGust: row.windGust != null ? Number(row.windGust) : row.wind_gust != null ? Number(row.wind_gust) : undefined,
    et: Number(row.et ?? 0),
    source: (row.source ?? 'station') as WeatherDailyLog['source'],
    alerts: Array.isArray(row.alerts) ? row.alerts.map(String) : [],
    notes: row.notes ? String(row.notes) : undefined,
  };
}

function normalizeWorkLocation(row: Record<string, unknown>): WorkLocation {
  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    propertyId: row.propertyId ? String(row.propertyId) : row.property_id ? String(row.property_id) : undefined,
    propertyName: row.propertyName ? String(row.propertyName) : row.property_name ? String(row.property_name) : undefined,
  };
}

const PRIORITY_LABEL: Record<string, string> = { high: 'High', medium: 'Med', low: 'Low' };
const PRIORITY_COLOR: Record<string, string> = {
  high: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800',
  medium: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800',
  low: 'bg-muted/40 border-border',
};
const STATUS_ICON: Record<string, React.ReactNode> = {
  new: <AlertCircle className="h-3.5 w-3.5 text-amber-500" />,
  assigned: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  'in-progress': <Radio className="h-3.5 w-3.5 text-blue-500 animate-pulse" />,
};

type PendingTaskRequest = {
  id: string;
  org_id?: string | null;
  employee_id?: string | null;
  property_id?: string | null;
  date: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  created_at?: string | null;
};

type WorkOrderBoardItem = {
  id: string;
  title: string;
  status: string;
  priority: string;
  source: 'work_order' | 'schedule_fallback';
  employeeName?: string;
};

type TaskLibraryItem = {
  id: string;
  name: string;
  category: string | null;
  estimated_hours: number | null;
};

type AvailableEquipmentItem = {
  id: string;
  name: string | null;
  unit_name: string | null;
  type: string | null;
  status: string | null;
  active: boolean | null;
  org_id: string | null;
};

type TaskWeatherWarning = {
  level: 'warning' | 'danger';
  message: string;
};

type WorkboardWeatherSnapshot = {
  temperature: number;
  windSpeed: number;
  precipitationProbability: number;
  weatherCode: number;
};

export default function WorkboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentPropertyId, setCurrentPropertyId, currentUser } = useAuth();
  const [boardDate, setBoardDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [department, setDepartment] = useState('Maintenance');
  const [groupFilter, setGroupFilter] = useState('all');
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [quickTaskDialogOpen, setQuickTaskDialogOpen] = useState(false);
  const [taskTemplateDialogOpen, setTaskTemplateDialogOpen] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [linkedRequestId, setLinkedRequestId] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [draggingEmployeeId, setDraggingEmployeeId] = useState<string | null>(null);
  const [dropTargetEmployeeId, setDropTargetEmployeeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');
  const [lastRealtimeRefreshAt, setLastRealtimeRefreshAt] = useState<number | null>(null);
  const [laneOrder, setLaneOrder] = useState<string[]>([]);
  const [needsFilter, setNeedsFilter] = useState<'all' | 'open' | 'done'>('all');
  const [taskLibrary, setTaskLibrary] = useState<TaskLibraryItem[]>([]);
  const [taskLibraryLoading, setTaskLibraryLoading] = useState(false);
  const [taskLibraryError, setTaskLibraryError] = useState<string | null>(null);
  const [weatherSnapshot, setWeatherSnapshot] = useState<WorkboardWeatherSnapshot | null>(null);
  const pendingDeleteTimeoutsRef = useRef<Record<string, number>>({});
  const [draggingTask, setDraggingTask] = useState<{ employeeId: string; assignmentId: string } | null>(null);
  const [selectedTemplateTaskIds, setSelectedTemplateTaskIds] = useState<string[]>([]);
  const [selectedTemplateEmployeeIds, setSelectedTemplateEmployeeIds] = useState<string[]>([]);
  const [applyTemplateToAllCrew, setApplyTemplateToAllCrew] = useState(true);
  const [applyingTaskTemplate, setApplyingTaskTemplate] = useState(false);

  const laneOrderStorageKey = useMemo(
    () => `workflow-lane-order:${boardDate}:${department}:${groupFilter}`,
    [boardDate, department, groupFilter],
  );

  const [assignmentDraft, setAssignmentDraft] = useState({
    employeeId: '',
    propertyId: '',
    taskId: '',
    equipmentId: '',
    area: 'Primary zone',
    startTime: '05:30',
    status: 'planned' as Assignment['status'],
    notes: '',
  });

  const [noteDraft, setNoteDraft] = useState({
    type: 'daily' as Note['type'],
    title: '',
    content: '',
    author: 'Operations Admin',
    location: '',
  });
  const [quickTaskDraft, setQuickTaskDraft] = useState({
    employeeId: '',
    date: new Date().toISOString().slice(0, 10),
    location: 'Primary zone',
    notes: '',
  });

  const workflowParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const focusedPropertyId = workflowParams.get('property') || '';
  const effectivePropertyId = currentPropertyId || (currentUser?.role === 'employee' ? currentUser.propertyId : 'all');

  const propertiesQuery = useProperties(currentUser?.orgId);
  const employeesQuery = useEmployees(effectivePropertyId, currentUser?.orgId);
  const assignmentsQuery = useAssignments(boardDate, effectivePropertyId, currentUser?.orgId);
  const scheduleQuery = useScheduleEntries(boardDate, effectivePropertyId, currentUser?.orgId);
  const tasksQuery = useTasks(effectivePropertyId, currentUser?.orgId);
  const equipmentQuery = useEquipmentUnits(effectivePropertyId, currentUser?.orgId);
  const notesQuery = useNotes(effectivePropertyId);
  const tasksLoading = tasksQuery.isLoading || taskLibraryLoading;

  const availableEquipmentQuery = useQuery({
    queryKey: ['workboard-available-equipment', currentUser?.orgId ?? 'all-orgs'],
    enabled: Boolean(currentUser?.orgId),
    queryFn: async () => {
      if (!supabase || !currentUser?.orgId) return [] as AvailableEquipmentItem[];
      const { data, error } = await supabase
        .from('equipment_units')
        .select('id, name, unit_name, type, status, active, org_id')
        .eq('org_id', currentUser.orgId)
        .eq('active', true)
        .eq('status', 'available')
        .order('unit_name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as AvailableEquipmentItem[];
    },
    staleTime: 1000 * 60 * 2,
  });

  const assignmentEquipmentQuery = useQuery({
    queryKey: ['workboard-assignment-equipment', boardDate, effectivePropertyId ?? 'all', currentUser?.orgId ?? 'all-orgs'],
    enabled: Boolean(currentUser?.orgId),
    queryFn: async () => {
      if (!supabase || !currentUser?.orgId) return [] as Array<{ id: string; equipment_unit_id: string | null }>;
      let query = supabase
        .from('assignments')
        .select('id, equipment_unit_id')
        .eq('org_id', currentUser.orgId)
        .eq('date', boardDate);
      if (effectivePropertyId && effectivePropertyId !== 'all') query = query.eq('property_id', effectivePropertyId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; equipment_unit_id: string | null }>;
    },
    staleTime: 1000 * 30,
  });

  const taskRequestsQuery = useQuery({
    queryKey: ['task-requests', boardDate, effectivePropertyId ?? 'all'],
    queryFn: async () => {
      if (!supabase) return [] as NeedsQueueRequest[];
      let query = supabase.from('task_requests').select('*').eq('date', boardDate);
      if (currentUser?.orgId) query = query.eq('org_id', currentUser.orgId);
      const { data, error } = await query;
      if (error) throw error;
      const normalized = (data ?? []).map((row) => normalizeTaskRequest(row as Record<string, unknown>));
      return effectivePropertyId && effectivePropertyId !== 'all'
        ? normalized.filter((r) => r.propertyId === effectivePropertyId)
        : normalized;
    },
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 30,
  });

  const pendingTaskRequestsQuery = useQuery({
    queryKey: ['task-requests-pending', new Date().toISOString().slice(0, 10), effectivePropertyId ?? 'all', currentUser?.orgId ?? 'all-orgs'],
    queryFn: async () => {
      if (!supabase) return [] as PendingTaskRequest[];
      const today = new Date().toISOString().slice(0, 10);
      let query = supabase
        .from('task_requests')
        .select('*')
        .eq('status', 'pending')
        .eq('date', today)
        .order('created_at', { ascending: true });
      if (effectivePropertyId && effectivePropertyId !== 'all') query = query.eq('property_id', effectivePropertyId);
      if (currentUser?.orgId) query = query.eq('org_id', currentUser.orgId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as PendingTaskRequest[];
    },
    staleTime: 1000 * 60,
    refetchInterval: 1000 * 30,
  });

  const weatherLogsQuery = useQuery({
    queryKey: ['weather-daily-logs', boardDate],
    queryFn: async () => {
      if (!supabase) return [] as WeatherDailyLog[];
      let query = supabase.from('weather_daily_logs').select('*').eq('date', boardDate);
      if (currentUser?.orgId) query = query.eq('org_id', currentUser.orgId);
      const { data, error } = await query;
      if (error) return [] as WeatherDailyLog[];
      return (data ?? []).map((row) => normalizeWeatherLog(row as Record<string, unknown>));
    },
    staleTime: 1000 * 60 * 5,
  });

  const weatherLocationsQuery = useQuery({
    queryKey: ['weather-locations', effectivePropertyId ?? 'all'],
    queryFn: async () => {
      if (!supabase) return [] as WeatherLocation[];
      let query = supabase.from('weather_locations').select('*');
      if (currentUser?.orgId) query = query.eq('org_id', currentUser.orgId);
      const { data, error } = await query;
      if (error) return [] as WeatherLocation[];
      return (data ?? []).map((row) => normalizeWeatherLocation(row as Record<string, unknown>));
    },
    staleTime: 1000 * 60 * 5,
  });
  const workOrdersQuery = useQuery({
    queryKey: ['work-orders', boardDate, effectivePropertyId ?? 'all', currentUser?.orgId ?? 'all-orgs'],
    queryFn: async () => {
      if (!supabase) return [] as Array<Record<string, unknown>>;
      let query = supabase.from('work_orders').select('*').order('created_at', { ascending: false });
      if (currentUser?.orgId) query = query.eq('org_id', currentUser.orgId);
      if (effectivePropertyId && effectivePropertyId !== 'all') query = query.eq('property_id', effectivePropertyId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Array<Record<string, unknown>>;
    },
    staleTime: 1000 * 60 * 2,
  });

  const workLocationsQuery = useQuery({
    queryKey: ['work-locations', effectivePropertyId ?? 'all'],
    queryFn: async () => {
      if (!supabase) return [] as WorkLocation[];
      let query = supabase.from('work_locations').select('*');
      if (currentUser?.orgId) query = query.eq('org_id', currentUser.orgId);
      const { data, error } = await query;
      if (error) return [] as WorkLocation[];
      return (data ?? []).map((row) => normalizeWorkLocation(row as Record<string, unknown>));
    },
    staleTime: 1000 * 60 * 5,
  });

  const properties = propertiesQuery.data ?? [];
  const employeeList = employeesQuery.data ?? [];
  const assignmentList = assignmentsQuery.data ?? [];
  const scheduleList = scheduleQuery.data ?? [];
  const taskList = useMemo(
    () =>
      (tasksQuery.data ?? [])
        .filter((t) => t.status === 'active')
        .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999) || a.name.localeCompare(b.name)),
    [tasksQuery.data],
  );
  const groupedTaskLibrary = useMemo(() => {
    return taskLibrary.reduce<Record<string, TaskLibraryItem[]>>((acc, task) => {
      const key = task.category?.trim() || 'General';
      if (!acc[key]) acc[key] = [];
      acc[key].push(task);
      return acc;
    }, {});
  }, [taskLibrary]);
  const orderedTaskCategories = useMemo(
    () => Object.keys(groupedTaskLibrary).sort((a, b) => a.localeCompare(b)),
    [groupedTaskLibrary],
  );
  const equipmentList = equipmentQuery.data ?? [];
  const availableEquipmentList = availableEquipmentQuery.data ?? [];
  const assignmentEquipmentMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of assignmentEquipmentQuery.data ?? []) {
      if (row.id && row.equipment_unit_id) map.set(row.id, row.equipment_unit_id);
    }
    return map;
  }, [assignmentEquipmentQuery.data]);
  const noteList = notesQuery.data ?? [];
  const taskRequests = taskRequestsQuery.data ?? [];
  const pendingTaskRequests = pendingTaskRequestsQuery.data ?? [];
  const weatherLogs = weatherLogsQuery.data ?? [];
  const weatherLocations = weatherLocationsQuery.data ?? [];
  const workLocations = workLocationsQuery.data ?? [];
  const workOrders = workOrdersQuery.data ?? [];
  const weatherStripProperty = useMemo(
    () => properties.find((property) => property.id === effectivePropertyId) ?? properties[0] ?? null,
    [effectivePropertyId, properties],
  );
  const hourlyWeatherStripQuery = useQuery({
    queryKey: ['workboard-hourly-strip', boardDate, weatherStripProperty?.id ?? 'no-property'],
    enabled: Boolean(weatherStripProperty?.latitude && weatherStripProperty?.longitude),
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      if (!weatherStripProperty?.latitude || !weatherStripProperty?.longitude) return [] as Array<{
        hour: number;
        temp: number;
        wind: number;
        precip: number;
        weatherCode: number;
      }>;
      const payload = await fetchOpenMeteoWeather({
        latitude: weatherStripProperty.latitude,
        longitude: weatherStripProperty.longitude,
        timezone: 'America/New_York',
      });
      const points = payload.hourly.filter((point) => point.time.slice(0, 10) === boardDate);
      if (points.length === 0) return [] as Array<{
        hour: number;
        temp: number;
        wind: number;
        precip: number;
        weatherCode: number;
      }>;
      const byHour = new Map(points.map((point) => [new Date(point.time).getHours(), point]));
      return Array.from({ length: 13 }, (_, index) => {
        const hour = index + 6;
        const point = byHour.get(hour);
        return {
          hour,
          temp: Number(point?.temperature ?? 0),
          wind: Number(point?.windSpeed ?? 0),
          precip: Number(point?.precipitationProbability ?? 0),
          weatherCode: Number(point?.weatherCode ?? -1),
        };
      }).filter((entry) => entry.weatherCode >= 0);
    },
  });

  useEffect(() => {
    if (assignmentsQuery.dataUpdatedAt || taskRequestsQuery.dataUpdatedAt) {
      setLastRealtimeRefreshAt(Math.max(assignmentsQuery.dataUpdatedAt ?? 0, taskRequestsQuery.dataUpdatedAt ?? 0));
    }
  }, [assignmentsQuery.dataUpdatedAt, taskRequestsQuery.dataUpdatedAt]);

  useEffect(() => {
    const firstScheduled =
      scheduleList.find((e) => e.date === boardDate && e.status === 'scheduled')?.employeeId ??
      employeeList.find((e) => e.status === 'active')?.id ?? '';
    setSelectedEmployeeId((cur) => cur || firstScheduled);
    setAssignmentDraft((cur) => ({
      ...cur,
      employeeId: cur.employeeId || firstScheduled,
      taskId: cur.taskId || taskList[0]?.id || '',
    }));
  }, [boardDate, employeeList, scheduleList, taskList]);

  const fetchTaskLibrary = useCallback(async () => {
    if (!supabase || !currentUser?.orgId) return;
    setTaskLibraryLoading(true);
    setTaskLibraryError(null);
    const { data, error } = await supabase
      .from('tasks')
      .select('id, name, category, estimated_hours')
      .eq('org_id', currentUser.orgId)
      .eq('status', 'active')
      .order('category', { ascending: true })
      .order('name', { ascending: true });
    if (error) {
      setTaskLibraryError(error.message);
      setTaskLibrary([]);
    } else {
      setTaskLibrary((data ?? []) as TaskLibraryItem[]);
    }
    setTaskLibraryLoading(false);
  }, [currentUser?.orgId]);

  useEffect(() => {
    void fetchTaskLibrary();
  }, [fetchTaskLibrary]);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('workflow-live-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, () => {
        setLastRealtimeRefreshAt(Date.now());
        void queryClient.invalidateQueries({ queryKey: ['assignments'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_requests' }, () => {
        setLastRealtimeRefreshAt(Date.now());
        void queryClient.invalidateQueries({ queryKey: ['task-requests'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_entries' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['schedule-entries'] });
      })
      .subscribe();
    return () => { void channel.unsubscribe(); };
  }, [queryClient]);

  useEffect(
    () => () => {
      Object.values(pendingDeleteTimeoutsRef.current).forEach((timeoutId) => window.clearTimeout(timeoutId));
      pendingDeleteTimeoutsRef.current = {};
    },
    [],
  );

  useEffect(() => {
    if (focusedPropertyId && focusedPropertyId !== currentPropertyId) {
      setCurrentPropertyId(focusedPropertyId);
    }
  }, [currentPropertyId, focusedPropertyId, setCurrentPropertyId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const parsed = JSON.parse(window.localStorage.getItem(laneOrderStorageKey) ?? '[]');
      setLaneOrder(Array.isArray(parsed) ? parsed : []);
    } catch {
      setLaneOrder([]);
    }
  }, [laneOrderStorageKey]);

  const groups = useMemo(
    () => [...new Set(employeeList.filter((e) => e.status === 'active').map((e) => e.group))].sort(),
    [employeeList],
  );

  const activeDepartmentEmployees = useMemo(
    () =>
      employeeList.filter(
        (e) =>
          e.status === 'active' &&
          (!effectivePropertyId || effectivePropertyId === 'all' || e.propertyId === effectivePropertyId) &&
          (!department || department === 'All Departments' || e.department === department) &&
          (groupFilter === 'all' || e.group === groupFilter),
      ),
    [employeeList, department, effectivePropertyId, groupFilter],
  );

  const propertyWorkLocations = useMemo(
    () => workLocations.filter((l) => !effectivePropertyId || effectivePropertyId === 'all' || l.propertyId === effectivePropertyId),
    [effectivePropertyId, workLocations],
  );

  const activeProperty = useMemo(
    () => properties.find((p) => p.id === effectivePropertyId) ?? null,
    [effectivePropertyId, properties],
  );

  const fetchWorkboardWeather = useCallback(async () => {
    if (!activeProperty?.latitude || !activeProperty?.longitude) {
      setWeatherSnapshot(null);
      return;
    }

    try {
      const payload = await fetchOpenMeteoWeather({
        latitude: activeProperty.latitude,
        longitude: activeProperty.longitude,
        timezone: 'America/New_York',
      });
      const firstHourly = payload.hourly[0];
      setWeatherSnapshot({
        temperature: Number(payload.current.temperature ?? 0),
        windSpeed: Number(payload.current.windSpeed ?? 0),
        precipitationProbability: Number(firstHourly?.precipitationProbability ?? 0),
        weatherCode: Number(payload.current.weatherCode ?? firstHourly?.weatherCode ?? -1),
      });
    } catch {
      setWeatherSnapshot(null);
    }
  }, [activeProperty?.latitude, activeProperty?.longitude]);

  useEffect(() => {
    void fetchWorkboardWeather();
  }, [fetchWorkboardWeather, boardDate]);

  const propertyRequests = useMemo(
    () =>
      taskRequests
        .filter((r) => (!effectivePropertyId || effectivePropertyId === 'all' || r.propertyId === effectivePropertyId) && r.date === boardDate)
        .sort((a, b) => {
          const order = { high: 0, medium: 1, low: 2 } as const;
          return order[a.priority] - order[b.priority];
        }),
    [boardDate, effectivePropertyId, taskRequests],
  );

  const filteredRequests = useMemo(() => {
    if (needsFilter === 'all') return propertyRequests;
    if (needsFilter === 'open') return propertyRequests.filter((r) => r.status !== 'dismissed' && r.status !== 'assigned');
    return propertyRequests.filter((r) => r.status === 'dismissed' || r.status === 'assigned');
  }, [propertyRequests, needsFilter]);

  const scheduledEmployees = useMemo(() => {
    const scheduledIds = new Set(
      scheduleList.filter((e) => e.date === boardDate && e.status === 'scheduled').map((e) => e.employeeId),
    );
    return employeeList
      .filter((e) => scheduledIds.has(e.id))
      .sort((a, b) => {
        const aShift = getShiftForEmployee(scheduleList, a.id, boardDate)?.shiftStart ?? '99:99';
        const bShift = getShiftForEmployee(scheduleList, b.id, boardDate)?.shiftStart ?? '99:99';
        return aShift.localeCompare(bShift);
      });
  }, [employeeList, boardDate, scheduleList]);

  const unscheduledEmployees = useMemo(() => {
    const scheduledIds = new Set(
      scheduleList.filter((e) => e.date === boardDate && e.status === 'scheduled').map((e) => e.employeeId),
    );
    return activeDepartmentEmployees.filter((e) => !scheduledIds.has(e.id));
  }, [activeDepartmentEmployees, boardDate, scheduleList]);

  const fallbackEligibleEmployees = useMemo(
    () => (scheduledEmployees.length > 0 ? scheduledEmployees : employeeList.filter((e) => e.status === 'active')),
    [scheduledEmployees, employeeList],
  );

  const dayAssignments = useMemo(() => {
    return assignmentList
      .filter((a) => a.date === boardDate)
      .map((assignment) => ({
        ...assignment,
        equipmentId: assignment.equipmentId ?? assignmentEquipmentMap.get(assignment.id) ?? assignment.equipmentId,
      }));
  }, [assignmentEquipmentMap, assignmentList, boardDate]);

  const upsertAssignmentInCache = useCallback(
    (nextAssignment: Assignment) => {
      queryClient.setQueryData<Assignment[]>(assignmentsQuery.queryKey, (current) => {
        const existing = current ?? [];
        const withoutExisting = existing.filter((assignment) => assignment.id !== nextAssignment.id);
        return [...withoutExisting, nextAssignment];
      });
    },
    [assignmentsQuery.queryKey, queryClient],
  );

  const removeAssignmentFromCache = useCallback(
    (assignmentId: string) => {
      queryClient.setQueryData<Assignment[]>(assignmentsQuery.queryKey, (current) => {
        const existing = current ?? [];
        return existing.filter((assignment) => assignment.id !== assignmentId);
      });
    },
    [assignmentsQuery.queryKey, queryClient],
  );
  const workOrderBoardItems = useMemo<WorkOrderBoardItem[]>(() => {
    if (workOrders.length > 0) {
      return workOrders.slice(0, 6).map((row) => ({
        id: String(row.id ?? ''),
        title: String(row.title ?? 'Untitled work order'),
        status: String(row.status ?? 'open'),
        priority: String(row.priority ?? 'medium'),
        source: 'work_order',
      }));
    }

    const byEmployeeId = new Map(employeeList.map((employee) => [employee.id, `${employee.firstName} ${employee.lastName}`]));
    return scheduleList
      .filter((entry) => entry.date === boardDate)
      .slice(0, 6)
      .map((entry) => ({
        id: `sched-${entry.id}`,
        title: `Crew shift coverage ${formatTime(entry.shiftStart)} - ${formatTime(entry.shiftEnd)}`,
        status: 'planned',
        priority: 'medium',
        source: 'schedule_fallback',
        employeeName: byEmployeeId.get(entry.employeeId) ?? 'Scheduled crew',
      }));
  }, [boardDate, employeeList, scheduleList, workOrders]);

  const assignedEmployeeIds = useMemo(
    () => new Set(dayAssignments.map((a) => a.employeeId)),
    [dayAssignments],
  );

  const dispatchBoard = useMemo(
    () =>
      scheduledEmployees.map((employee) => {
        const shift = getShiftForEmployee(scheduleList, employee.id, boardDate);
        const employeeAssignments = dayAssignments
          .filter((a) => a.employeeId === employee.id)
          .sort((a, b) => a.startTime.localeCompare(b.startTime));
        const assignedMinutes = employeeAssignments.reduce((s, a) => s + a.duration, 0);
        const shiftMinutes = shift ? Math.max(timeToMinutes(shift.shiftEnd) - timeToMinutes(shift.shiftStart), 0) : 0;
        const coveragePercent = shiftMinutes > 0 ? (assignedMinutes / shiftMinutes) * 100 : 0;
        return { employee, shift, employeeAssignments, assignedMinutes, shiftMinutes, openMinutes: Math.max(shiftMinutes - assignedMinutes, 0), coveragePercent };
      }),
    [boardDate, dayAssignments, scheduleList, scheduledEmployees],
  );

  const assignmentWeatherWarnings = useMemo<Record<string, TaskWeatherWarning[]>>(() => {
    if (!weatherSnapshot) return {};

    return dayAssignments.reduce<Record<string, TaskWeatherWarning[]>>((acc, assignment) => {
      const task = taskList.find((candidate) => candidate.id === assignment.taskId);
      if (!task?.id) return acc;

      const warnings: TaskWeatherWarning[] = [];
      const category = (task.category ?? '').toLowerCase();
      const isSprayingTask =
        category.includes('spray') || category.includes('irrigation') || category.includes('application');
      const isMowingTask = category === 'mowing';

      const windHighForSpray = weatherSnapshot.windSpeed > 10;
      const rainHighForSpray = weatherSnapshot.precipitationProbability > 40;
      if (isSprayingTask && windHighForSpray && rainHighForSpray) {
        warnings.push({ level: 'danger', message: '🛑 Unsafe spray conditions' });
      } else if (isSprayingTask) {
        if (windHighForSpray) {
          warnings.push({
            level: 'warning',
            message: `⚠️ Wind too high for spraying (${Math.round(weatherSnapshot.windSpeed)}mph)`,
          });
        }
        if (rainHighForSpray) {
          warnings.push({
            level: 'warning',
            message: '⚠️ Rain expected — spraying not recommended',
          });
        }
      }

      if (isMowingTask && weatherSnapshot.precipitationProbability > 60) {
        warnings.push({
          level: 'warning',
          message: '⚠️ Wet conditions — mowing quality affected',
        });
      }

      if (weatherSnapshot.temperature > 105) {
        warnings.push({
          level: 'danger',
          message: '🛑 Extreme heat — consider rescheduling',
        });
      } else if (weatherSnapshot.temperature > 95) {
        warnings.push({
          level: 'warning',
          message: '🔴 Heat advisory — schedule water breaks',
        });
      }

      if (warnings.length > 0 && assignment.id) {
        acc[assignment.id] = warnings;
      }
      return acc;
    }, {});
  }, [dayAssignments, taskList, weatherSnapshot]);

  const orderedDispatchBoard = useMemo(() => {
    const ranking = new Map(laneOrder.map((id, i) => [id, i]));
    return [...dispatchBoard].sort((a, b) => {
      const ra = ranking.get(a.employee.id);
      const rb = ranking.get(b.employee.id);
      if (ra != null && rb != null) return ra - rb;
      if (ra != null) return -1;
      if (rb != null) return 1;
      return 0;
    });
  }, [dispatchBoard, laneOrder]);

  const toggleTemplateTask = useCallback((taskId: string) => {
    setSelectedTemplateTaskIds((current) =>
      current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId],
    );
  }, []);

  const toggleTemplateEmployee = useCallback((employeeId: string) => {
    setSelectedTemplateEmployeeIds((current) =>
      current.includes(employeeId) ? current.filter((id) => id !== employeeId) : [...current, employeeId],
    );
  }, []);

  const openTaskTemplateDialog = useCallback(() => {
    setApplyTemplateToAllCrew(true);
    setSelectedTemplateEmployeeIds(scheduledEmployees.map((employee) => employee.id));
    setSelectedTemplateTaskIds([]);
    setTaskTemplateDialogOpen(true);
    if (!taskLibraryLoading && taskLibrary.length === 0 && !taskLibraryError) {
      void fetchTaskLibrary();
    }
  }, [fetchTaskLibrary, scheduledEmployees, taskLibrary.length, taskLibraryError, taskLibraryLoading]);

  const applyDailyTaskTemplate = useCallback(async () => {
    if (!supabase || !currentUser?.orgId) return;

    if (selectedTemplateTaskIds.length === 0) {
      toast.error('Select at least one task to apply.');
      return;
    }

    const targetEmployeeIds = applyTemplateToAllCrew
      ? scheduledEmployees.map((employee) => employee.id)
      : selectedTemplateEmployeeIds;

    if (targetEmployeeIds.length === 0) {
      toast.error('Select at least one crew member.');
      return;
    }

    const selectedTasks = taskLibrary.filter((task) => selectedTemplateTaskIds.includes(task.id));
    if (selectedTasks.length === 0) {
      toast.error('Selected tasks are unavailable. Please reload and try again.');
      return;
    }

    const scheduleByEmployee = new Map(
      scheduleList
        .filter((entry) => entry.date === boardDate)
        .map((entry) => [entry.employeeId, entry]),
    );

    const assignmentCountByEmployee = dayAssignments.reduce<Record<string, number>>((acc, assignment) => {
      acc[assignment.employeeId] = (acc[assignment.employeeId] ?? 0) + 1;
      return acc;
    }, {});

    const rowsToInsert = targetEmployeeIds.flatMap((employeeId) => {
      const employeeShift = scheduleByEmployee.get(employeeId);
      const propertyIdForEmployee =
        (effectivePropertyId && effectivePropertyId !== 'all' ? effectivePropertyId : employeeShift?.propertyId) ??
        activeProperty?.id ??
        properties[0]?.id ??
        '';
      if (!propertyIdForEmployee) return [];

      return selectedTasks.map((task, index) => {
        const nextOrder = (assignmentCountByEmployee[employeeId] ?? 0) + index + 1;
        return {
          id: makeId(),
          org_id: currentUser.orgId,
          employee_id: employeeId,
          property_id: propertyIdForEmployee,
          task_id: task.id,
          title: task.name,
          date: boardDate,
          status: 'planned',
          estimated_hours: task.estimated_hours ?? 0,
          order_index: nextOrder,
          start_time: employeeShift?.shiftStart ?? null,
        };
      });
    });

    if (rowsToInsert.length === 0) {
      toast.error('Unable to determine property for selected crew.');
      return;
    }

    setApplyingTaskTemplate(true);
    const { error } = await supabase.from('assignments').insert(rowsToInsert);
    setApplyingTaskTemplate(false);

    if (error) {
      toast.error(`Could not apply task template: ${error.message}`);
      return;
    }

    setTaskTemplateDialogOpen(false);
    setSelectedTemplateTaskIds([]);
    setSelectedTemplateEmployeeIds([]);
    setApplyTemplateToAllCrew(true);
    toast.success(`Applied ${selectedTasks.length} tasks to ${targetEmployeeIds.length} crew members.`);
    void queryClient.invalidateQueries({ queryKey: ['assignments'] });
  }, [
    activeProperty?.id,
    applyTemplateToAllCrew,
    boardDate,
    currentUser?.orgId,
    dayAssignments,
    effectivePropertyId,
    properties,
    queryClient,
    scheduleList,
    scheduledEmployees,
    selectedTemplateEmployeeIds,
    selectedTemplateTaskIds,
    taskLibrary,
  ]);

  const totalOpenMinutes = useMemo(
    () => orderedDispatchBoard.reduce((s, l) => s + l.openMinutes, 0),
    [orderedDispatchBoard],
  );

  const availableEquipment = useMemo(
    () =>
      availableEquipmentList.filter((unit) => unit.active !== false && String(unit.status ?? '').toLowerCase() === 'available'),
    [availableEquipmentList],
  );

  const latestWeatherLog = useMemo(
    () => [...weatherLogs].sort((a, b) => b.date.localeCompare(a.date))[0],
    [weatherLogs],
  );

  const planningWeatherLocation = latestWeatherLog
    ? weatherLocations.find((l) => l.id === latestWeatherLog.locationId) ?? weatherLocations[0]
    : weatherLocations[0];
  const weatherCellIcon = useCallback((code: number) => {
    if (code === 0) return '☀️';
    if (code <= 2) return '🌤';
    if (code === 3) return '☁️';
    if (code <= 48) return '🌫️';
    if (code <= 82) return '🌧️';
    return '⛈️';
  }, []);
  const weatherCellTone = useCallback((precip: number, code: number) => {
    if (code >= 95 || precip >= 60 || (code >= 61 && code <= 82)) return 'bg-red-100 text-red-800 border-red-200';
    if (precip >= 25 || code === 3 || (code >= 45 && code <= 57)) return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  }, []);

  const showFreshUpdateBadge = lastRealtimeRefreshAt != null && Date.now() - lastRealtimeRefreshAt < 90_000;
  const [todayDateKey] = useState(() => new Date().toISOString().slice(0, 10));

  const newRequestsCount = propertyRequests.filter((r) => r.status !== 'dismissed' && r.status !== 'assigned').length;

  function openAssignmentDialog(employeeId: string) {
    const defaultLocation = propertyWorkLocations[0]?.name ?? 'Primary zone';
    const targetEmployeeId = employeeId || fallbackEligibleEmployees[0]?.id || '';
    const targetPropertyId =
      effectivePropertyId && effectivePropertyId !== 'all' ? effectivePropertyId : properties[0]?.id ?? '';
    setEditingAssignmentId(null);
    setSelectedEmployeeId(targetEmployeeId);
    setAssignmentDraft({
      employeeId: targetEmployeeId,
      propertyId: targetPropertyId,
      taskId: taskList[0]?.id ?? '',
      equipmentId: '',
      area: defaultLocation,
      startTime: '05:30',
      status: 'planned',
      notes: '',
    });
    setAssignmentDialogOpen(true);
  }

  function openQuickTaskDialog() {
    const defaultEmployeeId = selectedEmployeeId || fallbackEligibleEmployees[0]?.id || '';
    const defaultLocation = propertyWorkLocations[0]?.name ?? 'Primary zone';
    setQuickTaskDraft({
      employeeId: defaultEmployeeId,
      date: boardDate,
      location: defaultLocation,
      notes: '',
    });
    setQuickTaskDialogOpen(true);
  }

  function openEditAssignmentDialog(assignment: Assignment) {
    setEditingAssignmentId(assignment.id);
    setSelectedEmployeeId(assignment.employeeId);
    setAssignmentDraft({
      employeeId: assignment.employeeId,
      propertyId: assignment.propertyId ?? '',
      taskId: assignment.taskId,
      equipmentId: assignment.equipmentId ?? '',
      area: assignment.area,
      startTime: assignment.startTime,
      status: assignment.status,
      notes: '',
    });
    setAssignmentDialogOpen(true);
  }

  function applyRequestToAssignment(request: NeedsQueueRequest) {
    setLinkedRequestId(request.id);
    const targetTaskId = request.taskId || taskList[0]?.id || '';
    const targetEmployeeId = fallbackEligibleEmployees[0]?.id || '';
    setEditingAssignmentId(null);
    setSelectedEmployeeId(targetEmployeeId);
    setAssignmentDraft({
      employeeId: targetEmployeeId,
      propertyId: (effectivePropertyId && effectivePropertyId !== 'all' ? effectivePropertyId : properties[0]?.id) ?? '',
      taskId: targetTaskId,
      equipmentId: '',
      area: request.preferredLocation || propertyWorkLocations[0]?.name || 'Primary zone',
      startTime: '05:30',
      status: 'planned',
      notes: request.notes ?? '',
    });
    setAssignmentDialogOpen(true);
  }

  async function saveAssignment() {
    if (!supabase || !assignmentDraft.employeeId || !assignmentDraft.taskId) return;
    const resolvedPropertyId =
      (effectivePropertyId && effectivePropertyId !== 'all' ? effectivePropertyId : null) ??
      assignmentDraft.propertyId ??
      null;
    if (!resolvedPropertyId) {
      toast.error('No property available for assignment.');
      return;
    }
    if (assignmentDraft.equipmentId) {
      const selectedEquipment = availableEquipment.find((unit) => unit.id === assignmentDraft.equipmentId);
      const isReady = selectedEquipment && String(selectedEquipment.status ?? '').toLowerCase() === 'available' && selectedEquipment.active !== false;
      if (!isReady) {
        toast.error('Selected equipment is not ready for assignment.');
        return;
      }
    }

    const employeeShift = getShiftForEmployee(scheduleList, assignmentDraft.employeeId, boardDate);
    const shiftMinutes = employeeShift
      ? Math.max(timeToMinutes(employeeShift.shiftEnd) - timeToMinutes(employeeShift.shiftStart), 0)
      : 0;
    const existingEmployeeAssignments = dayAssignments.filter(
      (assignment) => assignment.employeeId === assignmentDraft.employeeId && assignment.id !== editingAssignmentId,
    );
    const assignedMinutes = existingEmployeeAssignments.reduce(
      (sum, assignment) => sum + Math.round((assignment.estimatedHours ?? 0) * 60),
      0,
    );
    const selectedTask = taskLibrary.find((task) => task.id === assignmentDraft.taskId) ?? null;
    const selectedTaskName = selectedTask?.name ?? 'Task';
    const selectedTaskId = String(selectedTask?.id ?? '').trim();
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(selectedTaskId)) {
      console.error('[Workboard] Invalid task UUID selected', {
        selectedTaskId,
        draftTaskId: assignmentDraft.taskId,
        selectedTask,
      });
      toast.error('Selected task is invalid. Please reselect the task.');
      return;
    }
    const estimatedHours = Number(selectedTask?.estimated_hours ?? 0);
    const estimatedMinutes = Math.round(estimatedHours * 60);
    if (shiftMinutes > 0 && assignedMinutes + estimatedMinutes > shiftMinutes) {
      toast('Assigned tasks exceed shift hours', {
        description: `Shift: ${shiftMinutes} min · Assigned: ${assignedMinutes + estimatedMinutes} min`,
      });
    }


    const assignmentId = editingAssignmentId ?? makeId();
    const basePayload: Record<string, unknown> = {
      id: assignmentId,
      org_id: currentUser?.orgId ?? null,
      employee_id: assignmentDraft.employeeId,
      property_id: resolvedPropertyId,
      task_id: selectedTaskId,
      title: selectedTaskName,
      date: boardDate,
      status: 'planned',
      estimated_hours: estimatedHours,
      order_index: existingEmployeeAssignments.length,
    };
    if (assignmentDraft.startTime) basePayload.start_time = assignmentDraft.startTime;
    if (assignmentDraft.area.trim()) basePayload.location = assignmentDraft.area.trim();
    if (assignmentDraft.notes.trim()) basePayload.notes = assignmentDraft.notes.trim();
    if (assignmentDraft.equipmentId) {
      basePayload.equipment_unit_id = assignmentDraft.equipmentId;
      basePayload.equipment_id = assignmentDraft.equipmentId;
    }
    let { error } = await supabase.from('assignments').upsert(basePayload);
    if (error) {
      const fallbackPayload: Record<string, unknown> = {
        id: assignmentId,
        org_id: currentUser?.orgId ?? null,
        employee_id: assignmentDraft.employeeId,
        property_id: resolvedPropertyId,
        task_id: selectedTaskId,
        title: selectedTaskName,
        date: boardDate,
        status: 'planned',
        estimated_hours: estimatedHours,
      };
      if (assignmentDraft.startTime) fallbackPayload.start_time = assignmentDraft.startTime;
      if (assignmentDraft.area.trim()) fallbackPayload.location = assignmentDraft.area.trim();
      if (assignmentDraft.notes.trim()) fallbackPayload.notes = assignmentDraft.notes.trim();
      if (assignmentDraft.equipmentId) {
        fallbackPayload.equipment_unit_id = assignmentDraft.equipmentId;
        fallbackPayload.equipment_id = assignmentDraft.equipmentId;
      }
      const fallback = await supabase.from('assignments').upsert(fallbackPayload);
      error = fallback.error;
    }

    if (error) {
      console.error('[Workboard] Assignment upsert failed', { message: error.message, code: error.code, employeeId: assignmentDraft.employeeId, taskId: assignmentDraft.taskId });
      toast('Unable to save assignment', { description: error.message });
      return;
    }

    const optimisticAssignment: Assignment = {
      id: assignmentId,
      employeeId: assignmentDraft.employeeId,
      taskId: selectedTaskId,
      equipmentId: assignmentDraft.equipmentId || undefined,
      date: boardDate,
      startTime: assignmentDraft.startTime || '06:00',
      duration: estimatedMinutes,
      area: assignmentDraft.area.trim() || 'Primary zone',
      status: assignmentDraft.status ?? 'planned',
    };
    upsertAssignmentInCache(optimisticAssignment);

    if (linkedRequestId) {
      await supabase
        .from('task_requests')
        .update({
          status: 'assigned',
          task_id: assignmentDraft.taskId,
          preferred_location: assignmentDraft.area,
          org_id: currentUser?.orgId ?? null,
        })
        .eq('id', linkedRequestId);
    }

    void queryClient.invalidateQueries({ queryKey: ['assignments'] });
    void queryClient.invalidateQueries({ queryKey: ['workboard-assignment-equipment'] });
    void queryClient.invalidateQueries({ queryKey: ['task-requests'] });
    setLinkedRequestId(null);
    setEditingAssignmentId(null);
    setAssignmentDialogOpen(false);
    toast(editingAssignmentId ? 'Assignment updated' : 'Assignment dispatched', {
      description: editingAssignmentId
        ? 'The crew board has been updated.'
        : 'Task has been dispatched to the crew member.',
    });
  }

  async function removeAssignment(assignmentId: string) {
    if (!supabase) return;
    const assignmentToRemove = dayAssignments.find((assignment) => assignment.id === assignmentId);
    if (!assignmentToRemove) return;

    removeAssignmentFromCache(assignmentId);

    const timeoutId = window.setTimeout(async () => {
      delete pendingDeleteTimeoutsRef.current[assignmentId];
      const { error } = await supabase.from('assignments').delete().eq('id', assignmentId);
      if (error) {
        upsertAssignmentInCache(assignmentToRemove);
        toast('Unable to remove assignment', { description: error.message });
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ['assignments'] });
    }, 3000);

    pendingDeleteTimeoutsRef.current[assignmentId] = timeoutId;

    toast('Assignment removed', {
      description: 'Undo?',
      action: {
        label: 'Undo',
        onClick: () => {
          const activeTimeout = pendingDeleteTimeoutsRef.current[assignmentId];
          if (activeTimeout) {
            window.clearTimeout(activeTimeout);
            delete pendingDeleteTimeoutsRef.current[assignmentId];
          }
          upsertAssignmentInCache(assignmentToRemove);
        },
      },
    });
  }

  async function dismissRequest(requestId: string) {
    if (!supabase) return;
    await supabase.from('task_requests').update({ status: 'dismissed' }).eq('id', requestId);
    await queryClient.invalidateQueries({ queryKey: ['task-requests'] });
  }

  async function reorderEmployeeAssignments(
    employeeId: string,
    draggedAssignmentId: string,
    targetAssignmentId: string,
  ) {
    if (!supabase || draggedAssignmentId === targetAssignmentId) return;

    const employeeAssignments = dayAssignments.filter((assignment) => assignment.employeeId === employeeId);
    const fromIndex = employeeAssignments.findIndex((assignment) => assignment.id === draggedAssignmentId);
    const toIndex = employeeAssignments.findIndex((assignment) => assignment.id === targetAssignmentId);
    if (fromIndex < 0 || toIndex < 0) return;

    const reordered = [...employeeAssignments];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    queryClient.setQueryData<Assignment[]>(assignmentsQuery.queryKey, (current) => {
      const existing = current ?? [];
      const byId = new Map(reordered.map((assignment) => [assignment.id, assignment]));
      let reorderedCursor = 0;
      return existing.map((assignment) => {
        if (assignment.employeeId !== employeeId) return assignment;
        const next = reordered[reorderedCursor];
        reorderedCursor += 1;
        if (!next) return assignment;
        return byId.get(next.id!) ?? assignment;
      });
    });

    const orderUpdates = reordered.map((assignment, index) => ({
      id: assignment.id,
      order_index: index,
    }));

    const { error } = await supabase
      .from('assignments')
      .upsert(orderUpdates, { onConflict: 'id' });

    if (error) {
      toast.error('Unable to save task order', { description: error.message });
      void queryClient.invalidateQueries({ queryKey: ['assignments'] });
      return;
    }

    void queryClient.invalidateQueries({ queryKey: ['assignments'] });
  }

  async function saveQuickTaskAssignment() {
    if (!supabase || !currentUser?.orgId || !quickTaskDraft.employeeId || !quickTaskDraft.notes.trim()) {
      return;
    }
    const resolvedPropertyId =
      (effectivePropertyId && effectivePropertyId !== 'all' ? effectivePropertyId : null) ??
      activeProperty?.id ??
      'b50b42cd-903e-4280-9373-1d9cae97b2b3';
    const orderIndex = assignmentList.filter(
      (assignment) => assignment.employeeId === quickTaskDraft.employeeId && assignment.date === quickTaskDraft.date,
    ).length;
    const { error } = await supabase.from('assignments').insert({
      id: makeId(),
      org_id: currentUser.orgId,
      employee_id: quickTaskDraft.employeeId,
      property_id: resolvedPropertyId,
      task_id: null,
      date: quickTaskDraft.date,
      notes: quickTaskDraft.notes.trim(),
      location: quickTaskDraft.location.trim() || null,
      status: 'planned',
      order_index: orderIndex,
      start_time: '05:30',
    });
    if (error) {
      toast.error('Unable to add task', { description: error.message });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['assignments'] });
    setQuickTaskDialogOpen(false);
    toast.success('Task added to workflow', {
      description: 'The new assignment is now visible on the workboard.',
    });
  }

  async function approveRequestToAssignment(request: PendingTaskRequest) {
    if (!supabase || !currentUser?.orgId || !request.employee_id) return;
    const resolvedPropertyId =
      (request.property_id && request.property_id !== 'all' ? request.property_id : null) ??
      (effectivePropertyId && effectivePropertyId !== 'all' ? effectivePropertyId : null);
    if (!resolvedPropertyId) {
      toast.error('Cannot approve request', { description: 'Missing property context.' });
      return;
    }

    const orderIndex = dayAssignments.filter((a) => a.employeeId === request.employee_id).length + 1;
    const notes = [request.title, request.description].filter(Boolean).join(' — ');
    const { error: assignmentError } = await supabase.from('assignments').insert({
      id: makeId(),
      org_id: currentUser.orgId,
      employee_id: request.employee_id,
      property_id: resolvedPropertyId,
      task_id: null,
      date: request.date,
      status: 'planned',
      notes: notes || null,
      order_index: orderIndex,
      location: 'Requested',
      start_time: '05:30',
    });
    if (assignmentError) {
      toast.error('Approve failed', { description: assignmentError.message });
      return;
    }

    const { error: requestError } = await supabase
      .from('task_requests')
      .update({ status: 'approved' })
      .eq('id', request.id)
      .eq('org_id', currentUser.orgId);
    if (requestError) {
      toast.error('Assignment created, request update failed', { description: requestError.message });
      return;
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['assignments'] }),
      queryClient.invalidateQueries({ queryKey: ['task-requests'] }),
      queryClient.invalidateQueries({ queryKey: ['task-requests-pending'] }),
    ]);
    toast.success('Request approved and assigned');
  }

  async function saveNote() {
    if (!supabase || !effectivePropertyId || effectivePropertyId === 'all' || !noteDraft.title.trim() || !noteDraft.content.trim()) return;
    const { error } = await supabase.from('notes').insert({
      id: makeId(),
      property_id: effectivePropertyId,
      type: noteDraft.type,
      title: noteDraft.title.trim(),
      content: noteDraft.content.trim(),
      location: noteDraft.location.trim() || null,
      created_by: currentUser?.appUserId ?? null,
      author: noteDraft.author.trim() || 'Operations Admin',
      date: boardDate,
    });
    if (error) { toast('Unable to save note', { description: error.message }); return; }
    await queryClient.invalidateQueries({ queryKey: ['notes'] });
    setNoteDialogOpen(false);
    setNoteDraft({ type: 'daily', title: '', content: '', author: 'Operations Admin', location: '' });
  }

  function persistLaneOrder(nextOrder: string[]) {
    setLaneOrder(nextOrder);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(laneOrderStorageKey, JSON.stringify(nextOrder));
    }
  }

  function moveEmployeeLane(targetEmployeeId: string) {
    if (!draggingEmployeeId || draggingEmployeeId === targetEmployeeId) {
      setDraggingEmployeeId(null); setDropTargetEmployeeId(null); return;
    }
    const ids = orderedDispatchBoard.map((l) => l.employee.id);
    const base = ids.filter((id) => id !== draggingEmployeeId);
    const idx = base.indexOf(targetEmployeeId);
    if (idx === -1) { setDraggingEmployeeId(null); setDropTargetEmployeeId(null); return; }
    base.splice(idx, 0, draggingEmployeeId);
    persistLaneOrder(base);
    setDraggingEmployeeId(null);
    setDropTargetEmployeeId(null);
  }

  const isLoadingBoard =
    propertiesQuery.isLoading ||
    employeesQuery.isLoading ||
    assignmentsQuery.isLoading ||
    scheduleQuery.isLoading ||
    tasksQuery.isLoading ||
    equipmentQuery.isLoading ||
    notesQuery.isLoading ||
    workOrdersQuery.isLoading;
  const boardErrorMessage =
    (propertiesQuery.error as { message?: string } | null)?.message ||
    (employeesQuery.error as { message?: string } | null)?.message ||
    (assignmentsQuery.error as { message?: string } | null)?.message ||
    (scheduleQuery.error as { message?: string } | null)?.message ||
    (tasksQuery.error as { message?: string } | null)?.message ||
    (equipmentQuery.error as { message?: string } | null)?.message ||
    (notesQuery.error as { message?: string } | null)?.message ||
    (taskRequestsQuery.error as { message?: string } | null)?.message ||
    '';

  if (isLoadingBoard) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Loading workflow board and labor context...
        </div>
      </div>
    );
  }

  if (boardErrorMessage) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="max-w-xl rounded-xl border border-dashed p-6 text-center">
          <p className="text-sm font-medium text-foreground">Workflow data is temporarily unavailable.</p>
          <p className="mt-1 text-xs text-muted-foreground">{boardErrorMessage}</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={() => {
              void propertiesQuery.refetch();
              void employeesQuery.refetch();
              void assignmentsQuery.refetch();
              void scheduleQuery.refetch();
              void tasksQuery.refetch();
              void equipmentQuery.refetch();
              void notesQuery.refetch();
              void taskRequestsQuery.refetch();
              void pendingTaskRequestsQuery.refetch();
              void weatherLogsQuery.refetch();
              void weatherLocationsQuery.refetch();
              void workLocationsQuery.refetch();
            }}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">

      {/* ─── MAIN DISPATCH BOARD ─── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header bar */}
        <div className="border-b bg-card px-5 py-3 flex items-center gap-3 flex-wrap shrink-0">
          <div className="flex items-center gap-2 rounded-xl border bg-muted/20 px-3 py-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Board Date</span>
            <input
              type="date"
              value={boardDate}
              onChange={(e) => setBoardDate(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              data-testid="input-board-date"
            />
            {boardDate !== todayDateKey ? (
              <Button variant="ghost" size="sm" className="h-8 text-xs px-2" onClick={() => setBoardDate(todayDateKey)}>
                Today
              </Button>
            ) : null}
          </div>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h1 className="text-lg font-semibold tracking-tight">Workflow</h1>
            {activeProperty && (
              <Badge variant="outline" style={{ borderColor: activeProperty.color, color: activeProperty.color }}>
                {activeProperty.shortName}
              </Badge>
            )}
            {showFreshUpdateBadge && (
              <Badge variant="secondary" className="gap-1">
                <Radio className="h-3 w-3 animate-pulse" /> Live
              </Badge>
            )}
          </div>

          {/* Department */}
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            data-testid="select-department"
          >
            {['Maintenance', 'Irrigation', 'Chemicals', 'All Departments'].map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {/* Group filter */}
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            data-testid="select-group"
          >
            <option value="all">All groups</option>
            {groups.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>

          {/* View toggle */}
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'list' | 'timeline')}>
            <TabsList className="h-9">
              <TabsTrigger value="list" className="text-xs gap-1 px-3">
                <LayoutList className="h-3.5 w-3.5" /> List
              </TabsTrigger>
              <TabsTrigger value="timeline" className="text-xs gap-1 px-3">
                <GanttChart className="h-3.5 w-3.5" /> Timeline
              </TabsTrigger>
            </TabsList>
            </Tabs>
            <Button
              size="sm"
              className="h-9 shrink-0"
              onClick={openQuickTaskDialog}
              data-testid="button-open-add-task"
            >
              Add Task
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 shrink-0"
              onClick={openTaskTemplateDialog}
              data-testid="button-open-task-template"
            >
              Apply Task Template
            </Button>

            <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" aria-label="Breakroom display info">
                <MonitorSmartphone className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent align="end" className="max-w-xs text-xs leading-relaxed">
              Build the day here, then open Breakroom on a cast TV to display the live crew order and task sequence.
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Stats strip */}
        <div className="border-b bg-muted/30 px-5 py-2 flex items-center gap-4 flex-wrap text-xs shrink-0">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span><span className="font-semibold text-foreground">{scheduledEmployees.length}</span> scheduled</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span><span className="font-semibold text-foreground">{assignedEmployeeIds.size}</span> with tasks</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span><span className="font-semibold text-foreground">{totalOpenMinutes}</span> open mins</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <ListChecks className="h-3.5 w-3.5" />
            <span><span className="font-semibold text-foreground">{dayAssignments.length}</span> tasks assigned</span>
          </div>
          {newRequestsCount > 0 && (
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 ml-auto">
              <AlertCircle className="h-3.5 w-3.5" />
              <span><span className="font-semibold">{newRequestsCount}</span> unhandled {newRequestsCount === 1 ? 'need' : 'needs'}</span>
            </div>
          )}
          {unscheduledEmployees.length > 0 && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span className="text-orange-500 font-semibold">{unscheduledEmployees.length}</span>
              <span>unscheduled</span>
            </div>
          )}
        </div>

        {/* Crew board */}
        <div className="flex-1 overflow-auto p-4">
          {pendingTaskRequests.length > 0 && (
            <div className="mb-4 rounded-3xl border bg-card/80 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Requests</h3>
                  <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                    {pendingTaskRequests.length}
                  </Badge>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Today</span>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {pendingTaskRequests.map((request) => {
                  const requestEmployee = employeeList.find((e) => e.id === request.employee_id);
                  return (
                    <div key={request.id} className={`rounded-2xl border p-3 ${PRIORITY_COLOR[request.priority] ?? 'bg-muted/20 border-border'}`}>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{request.title}</span>
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px] capitalize">
                          {request.priority}
                        </Badge>
                      </div>
                      {request.description ? <p className="mb-2 text-xs text-muted-foreground">{request.description}</p> : null}
                      <div className="mb-2 text-[11px] text-muted-foreground">
                        {requestEmployee ? `${requestEmployee.firstName} ${requestEmployee.lastName}` : 'Unassigned crew'} · {request.date}
                      </div>
                      <Button
                        size="sm"
                        className="h-7 text-[11px]"
                        onClick={() => void approveRequestToAssignment(request)}
                        data-testid={`button-approve-request-${request.id}`}
                      >
                        Approve → Assign
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="mb-4 rounded-3xl border bg-card/80 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">
                  {workOrders.length > 0 ? 'Work Orders' : 'Work Orders (Schedule fallback)'}
                </h3>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{boardDate}</span>
            </div>
            {workOrderBoardItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">No work orders or schedule entries found for this date.</p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {workOrderBoardItems.map((item) => (
                  <div key={item.id} className={`rounded-2xl border p-3 ${PRIORITY_COLOR[item.priority] ?? 'bg-muted/20 border-border'}`}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{item.title}</span>
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px] capitalize">
                        {item.priority}
                      </Badge>
                    </div>
                    {item.employeeName ? <p className="mb-1 text-xs text-muted-foreground">{item.employeeName}</p> : null}
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Badge variant="secondary" className="h-5 px-1.5 text-[10px] capitalize">
                        {item.status}
                      </Badge>
                      {item.source === 'schedule_fallback' ? <span>Derived from schedule entries</span> : <span>From work_orders</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {orderedDispatchBoard.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
              <Users className="h-10 w-10 text-muted-foreground/40" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">No crew scheduled for {boardDate}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Build shifts in the Scheduler, then return here to dispatch tasks.
                </p>
              </div>
            </div>
          ) : viewMode === 'timeline' ? (
            <GanttTimeline
              employees={orderedDispatchBoard.map((l) => l.employee)}
              assignments={dayAssignments}
              tasks={taskList}
              equipment={equipmentList}
              scheduleEntries={scheduleList}
              date={boardDate}
              onAssignmentClick={(a) => openEditAssignmentDialog(a)}
              onDropTask={(employeeId) => openAssignmentDialog(employeeId)}
            />
          ) : (
            <div className="space-y-2">
              <div className="rounded-2xl border bg-card/70 px-4 py-2 text-[11px] text-muted-foreground">
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3">
                  <span className="font-medium text-foreground/90">Employee / Assignments</span>
                  <span className="text-right">Duration</span>
                  <span className="text-right">Equipment</span>
                  <span className="text-right">Status</span>
                </div>
              </div>
              {orderedDispatchBoard.map((lane, index) => (
                <EmployeeRow
                  key={lane.employee.id}
                  employee={lane.employee}
                  assignments={lane.employeeAssignments}
                  tasks={taskList}
                  orderIndex={index}
                  isDragging={draggingEmployeeId === lane.employee.id}
                  isDropTarget={dropTargetEmployeeId === lane.employee.id}
                  shiftLabel={lane.shift ? `${formatTime(lane.shift.shiftStart)}–${formatTime(lane.shift.shiftEnd)}` : undefined}
                  laneSummary={
                    lane.shift
                      ? `${lane.assignedMinutes} min assigned · ${lane.openMinutes} min open`
                      : `${lane.employeeAssignments.length} tasks assigned`
                  }
                  laneWarning={
                    lane.shiftMinutes > 0 && lane.assignedMinutes > lane.shiftMinutes
                      ? `Assigned hours exceed scheduled shift by ${Math.ceil((lane.assignedMinutes - lane.shiftMinutes) / 60)}h ${(lane.assignedMinutes - lane.shiftMinutes) % 60}m`
                      : undefined
                  }
                  coveragePercent={lane.coveragePercent}
                  onDragStart={setDraggingEmployeeId}
                  onDragEnter={setDropTargetEmployeeId}
                  onDragEnd={() => { setDraggingEmployeeId(null); setDropTargetEmployeeId(null); }}
                  onDropRow={moveEmployeeLane}
                  onTaskDragStart={(employeeId, assignmentId) => setDraggingTask({ employeeId, assignmentId })}
                  onTaskDropOnTask={(employeeId, targetAssignmentId) => {
                    if (!draggingTask || draggingTask.employeeId !== employeeId) return;
                    void reorderEmployeeAssignments(employeeId, draggingTask.assignmentId, targetAssignmentId);
                    setDraggingTask(null);
                  }}
                  onAddTask={openAssignmentDialog}
                  onEditAssignment={openEditAssignmentDialog}
                  onRemoveAssignment={removeAssignment}
                  weatherWarningsByAssignment={assignmentWeatherWarnings}
                />
              ))}

              {/* Unscheduled crew notice */}
              {unscheduledEmployees.length > 0 && (
                <div className="rounded-3xl border border-dashed bg-card/60 p-4 mt-4">
                  <p className="text-xs font-medium text-muted-foreground mb-3">
                    Not yet scheduled for {boardDate} — {unscheduledEmployees.length} crew member{unscheduledEmployees.length !== 1 ? 's' : ''}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {unscheduledEmployees.map((e) => (
                      <div key={e.id} className="rounded-xl border bg-muted/30 px-3 py-2 text-xs">
                        <span className="font-medium">{e.firstName} {e.lastName}</span>
                        <span className="text-muted-foreground ml-1">· {e.role} · {e.group}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── RIGHT RAIL ─── */}
      <div className="w-80 border-l bg-card overflow-auto flex flex-col hidden lg:flex">

        {/* Needs Queue */}
        <div className="border-b p-4 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Needs Queue</h3>
              {newRequestsCount > 0 && (
                <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">{newRequestsCount}</Badge>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{boardDate}</span>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 mb-3">
            {(['all', 'open', 'done'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setNeedsFilter(f)}
                className={`flex-1 rounded-lg py-1 text-[11px] font-medium transition-colors ${
                  needsFilter === f
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
                data-testid={`filter-needs-${f}`}
              >
                {f === 'all'
                  ? `All (${propertyRequests.length})`
                  : f === 'open'
                    ? `Open (${propertyRequests.filter((r) => r.status !== 'dismissed' && r.status !== 'assigned').length})`
                    : `Done (${propertyRequests.filter((r) => r.status === 'dismissed' || r.status === 'assigned').length})`}
              </button>
            ))}
          </div>

          {filteredRequests.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-muted/20 p-4 text-center">
              <p className="text-xs text-muted-foreground">
                {needsFilter === 'open' ? 'All needs have been handled.' : needsFilter === 'done' ? 'No completed needs yet.' : 'No needs logged for this date.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-auto pr-0.5">
              {filteredRequests.map((request) => (
                <div
                  key={request.id}
                  className={`rounded-2xl border p-3 ${PRIORITY_COLOR[request.priority] ?? 'bg-muted/20 border-border'}`}
                  data-testid={`card-request-${request.id}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {STATUS_ICON[request.status]}
                      <span className="text-sm font-medium truncate">{request.title}</span>
                    </div>
                    <Badge
                      variant={request.priority === 'high' ? 'destructive' : request.priority === 'medium' ? 'secondary' : 'outline'}
                      className="h-5 px-1.5 text-[10px] shrink-0"
                    >
                      {PRIORITY_LABEL[request.priority]}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground mb-2">
                    {request.requestedBy}
                    {request.preferredLocation ? ` · ${request.preferredLocation}` : ''}
                  </div>
                  {request.notes && (
                    <div className="text-[11px] text-muted-foreground italic mb-2 line-clamp-2">{request.notes}</div>
                  )}
                  <div className="text-[10px] text-muted-foreground mb-2">
                    Created {request.createdAt ? new Date(request.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—'}
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      className="h-7 text-[11px] flex-1"
                      onClick={() => applyRequestToAssignment(request)}
                      disabled={fallbackEligibleEmployees.length === 0}
                      data-testid={`button-view-request-${request.id}`}
                    >
                      View
                    </Button>
                    {request.status !== 'dismissed' ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[11px] px-2"
                        onClick={() => dismissRequest(request.id)}
                        data-testid={`button-dismiss-request-${request.id}`}
                      >
                        Dismiss
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Scheduled crew summary */}
        <div className="border-b p-4 flex-shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Scheduled Crew</h3>
            <Badge variant="outline" className="ml-auto text-[10px]">{scheduledEmployees.length}</Badge>
          </div>
          {scheduledEmployees.length === 0 ? (
            <p className="text-xs text-muted-foreground">No shifts entered for this date.</p>
          ) : (
            <div className="space-y-1.5 max-h-52 overflow-auto">
              {orderedDispatchBoard.map((lane) => {
                const tasksCount = lane.employeeAssignments.length;
                const coverPct = lane.shiftMinutes > 0 ? Math.round((lane.assignedMinutes / lane.shiftMinutes) * 100) : 0;
                return (
                  <div
                    key={lane.employee.id}
                    className="flex items-center gap-2 rounded-xl bg-muted/30 px-3 py-2 cursor-pointer hover:bg-muted/60 transition-colors"
                    onClick={() => openAssignmentDialog(lane.employee.id)}
                    data-testid={`row-crew-${lane.employee.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">
                        {lane.employee.firstName} {lane.employee.lastName}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {lane.shift ? `${formatTime(lane.shift.shiftStart)}–${formatTime(lane.shift.shiftEnd)}` : 'No shift'} · {tasksCount} task{tasksCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-[10px] font-semibold ${coverPct >= 80 ? 'text-green-600' : coverPct >= 40 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                        {lane.shiftMinutes > 0 ? `${coverPct}%` : '—'}
                      </div>
                      <div className="text-[10px] text-muted-foreground">covered</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Weather */}
        <div className="border-b p-4 flex-shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <CloudSun className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Weather</h3>
          </div>
          {hourlyWeatherStripQuery.isLoading ? (
            <div className="space-y-2">
              <div className="h-16 rounded-lg bg-muted/30 animate-pulse" />
            </div>
          ) : hourlyWeatherStripQuery.data && hourlyWeatherStripQuery.data.length > 0 ? (
            <div className="space-y-2">
              {planningWeatherLocation && latestWeatherLog ? (
                <WeatherSnapshotCard location={planningWeatherLocation} log={latestWeatherLog} compact title="Daily Weather" />
              ) : null}
              <div className="overflow-x-auto">
                <div className="flex min-w-max gap-1 pr-1">
                  {hourlyWeatherStripQuery.data.map((entry) => {
                    const hourLabel = formatTime(`${entry.hour.toString().padStart(2, '0')}:00`);
                    const isCurrentHour = boardDate === new Date().toISOString().slice(0, 10) && entry.hour === new Date().getHours();
                    return (
                      <div
                        key={`weather-hour-${entry.hour}`}
                        className={`w-16 rounded-md border px-1 py-1 text-center text-[12px] ${weatherCellTone(entry.precip, entry.weatherCode)} ${isCurrentHour ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                        title={`${hourLabel} · ${Math.round(entry.temp)}°F · Wind ${Math.round(entry.wind)} mph`}
                      >
                        <div className="text-[11px] leading-tight">{hourLabel.replace(':00', '')}</div>
                        <div className="text-base leading-tight">{weatherCellIcon(entry.weatherCode)}</div>
                        <div className="font-semibold leading-tight">{Math.round(entry.temp)}°</div>
                        <div className="leading-tight">{Math.round(entry.wind)}mph</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Forecast unavailable for this date.</p>
          )}
        </div>

        {/* Escalations */}
        <div className="border-b p-4 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Escalation Center</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Escalation feed is unavailable in this build.
          </p>
        </div>

        {/* Notes */}
        <div className="p-4 flex-1">
          <div className="flex items-center gap-2 mb-3">
            <StickyNote className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Notes</h3>
          </div>
          <NotesPanel
            notes={noteList.filter((n) => n.date === boardDate || n.type === 'general')}
            onAddNote={() => setNoteDialogOpen(true)}
          />
        </div>
      </div>

      {/* ─── ASSIGNMENT DIALOG ─── */}
      <Dialog open={assignmentDialogOpen} onOpenChange={setAssignmentDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingAssignmentId ? 'Edit Assignment' : linkedRequestId ? 'Dispatch Need to Crew' : 'Assign Task to Crew'}
            </DialogTitle>
          </DialogHeader>

          {linkedRequestId && (
            <div className="rounded-xl border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-300 mb-1">
              Dispatching from needs queue — assignment will mark the request as handled.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Crew member</label>
              <select
                value={assignmentDraft.employeeId}
                onChange={(e) => setAssignmentDraft({ ...assignmentDraft, employeeId: e.target.value })}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                data-testid="select-assignment-employee"
              >
                {fallbackEligibleEmployees.length === 0 && <option value="">No employees available</option>}
                {fallbackEligibleEmployees.map((e) => {
                  const shift = getShiftForEmployee(scheduleList, e.id, boardDate);
                  const shiftStr = shift ? ` (${formatTime(shift.shiftStart)}–${formatTime(shift.shiftEnd)})` : '';
                  return (
                    <option key={e.id} value={e.id}>
                      {e.firstName} {e.lastName}{shiftStr} · {e.group}
                    </option>
                  );
                })}
              </select>
            </div>
            {effectivePropertyId === 'all' ? (
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Property</label>
                <select
                  value={assignmentDraft.propertyId}
                  onChange={(e) => setAssignmentDraft({ ...assignmentDraft, propertyId: e.target.value })}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select property</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Task</label>
              <select
                value={assignmentDraft.taskId}
                onChange={(e) => {
                  if (e.target.value === '__manage_task_library__') {
                    setAssignmentDialogOpen(false);
                    setLinkedRequestId(null);
                    navigate('/app/settings?tab=Tasks');
                    return;
                  }
                  setAssignmentDraft({
                    ...assignmentDraft,
                    taskId: e.target.value,
                  });
                }}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                data-testid="select-assignment-task"
              >
                {tasksLoading || taskLibrary.length === 0 ? (
                  <option value="" disabled>No tasks yet - manage task library in Settings</option>
                ) : null}
                {orderedTaskCategories.map((category) => (
                  <optgroup key={category} label={category}>
                    {groupedTaskLibrary[category].map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.name} ({Number(task.estimated_hours ?? 0)}h)
                      </option>
                    ))}
                  </optgroup>
                ))}
                <option value="__manage_task_library__">+ Manage task library</option>
              </select>
              {taskLibraryError ? (
                <button
                  type="button"
                  className="mt-2 text-xs font-medium text-primary hover:underline"
                  onClick={() => void fetchTaskLibrary()}
                >
                  Retry loading tasks →
                </button>
              ) : null}
              <button
                type="button"
                className="mt-2 block text-xs font-medium text-primary hover:underline"
                onClick={() => {
                  setAssignmentDialogOpen(false);
                  setLinkedRequestId(null);
                  navigate('/app/settings?tab=Tasks');
                }}
              >
                + Manage task library
              </button>
            </div>

            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Equipment</label>
              <select
                value={assignmentDraft.equipmentId}
                onChange={(e) => setAssignmentDraft({ ...assignmentDraft, equipmentId: e.target.value })}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                data-testid="select-assignment-equipment"
              >
                <option value="">No equipment</option>
                {availableEquipment.map((u) => (
                  <option key={u.id} value={u.id}>
                    {(u.unit_name || u.name || 'Equipment')} ({u.type || 'General'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Start time</label>
              <Input
                type="time"
                value={assignmentDraft.startTime}
                onChange={(e) => setAssignmentDraft({ ...assignmentDraft, startTime: e.target.value })}
                className="mt-1"
                data-testid="input-assignment-start"
              />
              <div className="mt-1 text-[11px] text-muted-foreground">{formatTime(assignmentDraft.startTime)}</div>
            </div>


            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <select
                value={assignmentDraft.status}
                onChange={(e) => setAssignmentDraft({ ...assignmentDraft, status: e.target.value as Assignment['status'] })}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                data-testid="select-assignment-status"
              >
                <option value="planned">Planned</option>
                <option value="in-progress">In Progress</option>
                <option value="complete">Complete</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Location / Area</label>
              {propertyWorkLocations.length > 0 ? (
                <select
                  value={assignmentDraft.area}
                  onChange={(e) => setAssignmentDraft({ ...assignmentDraft, area: e.target.value })}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  data-testid="select-assignment-area"
                >
                  {propertyWorkLocations.map((l) => (
                    <option key={l.id} value={l.name}>{l.name}</option>
                  ))}
                </select>
              ) : (
                <Input
                  value={assignmentDraft.area}
                  onChange={(e) => setAssignmentDraft({ ...assignmentDraft, area: e.target.value })}
                  className="mt-1"
                  data-testid="input-assignment-area"
                />
              )}
            </div>

            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Notes</label>
              <textarea
                value={assignmentDraft.notes}
                onChange={(e) => setAssignmentDraft({ ...assignmentDraft, notes: e.target.value })}
                className="mt-1 min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                data-testid="input-assignment-notes"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setAssignmentDialogOpen(false); setLinkedRequestId(null); }}>
              Cancel
            </Button>
            <Button onClick={saveAssignment} data-testid="button-save-assignment">
              {editingAssignmentId ? 'Save Changes' : 'Dispatch'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={quickTaskDialogOpen} onOpenChange={setQuickTaskDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Task</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Employee</label>
              <select
                value={quickTaskDraft.employeeId}
                onChange={(event) => setQuickTaskDraft((current) => ({ ...current, employeeId: event.target.value }))}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select employee</option>
                {fallbackEligibleEmployees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.firstName} {employee.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Date</label>
              <Input
                type="date"
                value={quickTaskDraft.date}
                onChange={(event) => setQuickTaskDraft((current) => ({ ...current, date: event.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Location</label>
              <Input
                value={quickTaskDraft.location}
                onChange={(event) => setQuickTaskDraft((current) => ({ ...current, location: event.target.value }))}
                className="mt-1"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Notes</label>
              <textarea
                value={quickTaskDraft.notes}
                onChange={(event) => setQuickTaskDraft((current) => ({ ...current, notes: event.target.value }))}
                className="mt-1 min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setQuickTaskDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveQuickTaskAssignment} data-testid="button-save-quick-task">
              Save Task
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={taskTemplateDialogOpen} onOpenChange={setTaskTemplateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Apply Daily Task Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-sm font-medium">Template Scope</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Select tasks from your task library, then apply to all scheduled crew or specific team members.
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Crew Selection</p>
              <div className="flex items-center gap-2 mb-2">
                <Button
                  type="button"
                  size="sm"
                  variant={applyTemplateToAllCrew ? 'default' : 'outline'}
                  onClick={() => {
                    setApplyTemplateToAllCrew(true);
                    setSelectedTemplateEmployeeIds(scheduledEmployees.map((employee) => employee.id));
                  }}
                >
                  Apply to All Crew
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={!applyTemplateToAllCrew ? 'default' : 'outline'}
                  onClick={() => {
                    setApplyTemplateToAllCrew(false);
                    setSelectedTemplateEmployeeIds((current) =>
                      current.length > 0 ? current : scheduledEmployees.slice(0, 1).map((employee) => employee.id),
                    );
                  }}
                >
                  Select Crew
                </Button>
              </div>
              {!applyTemplateToAllCrew ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {scheduledEmployees.map((employee) => {
                    const checked = selectedTemplateEmployeeIds.includes(employee.id);
                    return (
                      <label key={`template-employee-${employee.id}`} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTemplateEmployee(employee.id)}
                        />
                        <span>
                          {employee.firstName} {employee.lastName}
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {scheduledEmployees.length} scheduled crew member{scheduledEmployees.length === 1 ? '' : 's'} selected.
                </p>
              )}
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Tasks</p>
              {taskLibraryLoading ? (
                <div className="rounded-md border p-4 text-sm text-muted-foreground">Loading task library...</div>
              ) : taskLibraryError ? (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <p>Could not load tasks: {taskLibraryError}</p>
                  <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => void fetchTaskLibrary()}>
                    Retry
                  </Button>
                </div>
              ) : taskLibrary.length === 0 ? (
                <div className="rounded-md border p-4 text-sm text-muted-foreground">
                  No task library items found. Add tasks in Settings before applying a daily template.
                </div>
              ) : (
                <div className="max-h-72 space-y-3 overflow-auto rounded-md border p-3">
                  {orderedTaskCategories.map((category) => (
                    <div key={`template-category-${category}`}>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{category}</p>
                      <div className="space-y-1">
                        {groupedTaskLibrary[category].map((task) => {
                          const checked = selectedTemplateTaskIds.includes(task.id);
                          return (
                            <label key={`template-task-${task.id}`} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted/40">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleTemplateTask(task.id)}
                              />
                              <span className="flex-1">{task.name}</span>
                              <span className="text-xs text-muted-foreground">{Number(task.estimated_hours ?? 0)}h</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setTaskTemplateDialogOpen(false)}
              disabled={applyingTaskTemplate}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void applyDailyTaskTemplate()}
              disabled={
                applyingTaskTemplate ||
                taskLibraryLoading ||
                selectedTemplateTaskIds.length === 0 ||
                (!applyTemplateToAllCrew && selectedTemplateEmployeeIds.length === 0) ||
                scheduledEmployees.length === 0
              }
            >
              {applyingTaskTemplate ? 'Applying...' : 'Apply to Crew'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── NOTE DIALOG ─── */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Board Note</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Type</label>
              <select
                value={noteDraft.type}
                onChange={(e) => setNoteDraft({ ...noteDraft, type: e.target.value as Note['type'] })}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="daily">Daily</option>
                <option value="general">General</option>
                <option value="geo">Geo</option>
                <option value="alert">Alert</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Author</label>
              <Input value={noteDraft.author} onChange={(e) => setNoteDraft({ ...noteDraft, author: e.target.value })} className="mt-1" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Title</label>
              <Input value={noteDraft.title} onChange={(e) => setNoteDraft({ ...noteDraft, title: e.target.value })} className="mt-1" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Location</label>
              {propertyWorkLocations.length > 0 ? (
                <select
                  value={noteDraft.location}
                  onChange={(e) => setNoteDraft({ ...noteDraft, location: e.target.value })}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">General board note</option>
                  {propertyWorkLocations.map((l) => (
                    <option key={l.id} value={l.name}>{l.name}</option>
                  ))}
                </select>
              ) : (
                <Input value={noteDraft.location} onChange={(e) => setNoteDraft({ ...noteDraft, location: e.target.value })} className="mt-1" />
              )}
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Content</label>
              <textarea
                value={noteDraft.content}
                onChange={(e) => setNoteDraft({ ...noteDraft, content: e.target.value })}
                className="mt-1 min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveNote}>Save Note</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
