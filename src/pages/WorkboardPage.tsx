import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
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
import { EscalationCenter } from '@/components/notifications/EscalationCenter';
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

function defaultBoardDate() {
  return new Date().toISOString().slice(0, 10);
}

function getShiftForEmployee(scheduleList: ScheduleEntry[], employeeId: string, date: string) {
  return scheduleList.find((entry) => entry.employeeId === employeeId && entry.date === date);
}

function timeToMinutes(value?: string) {
  if (!value) return 0;
  const [hours, minutes] = value.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
  return hours * 60 + minutes;
}

function makeId(prefix: string) {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeApplicationArea(row: Record<string, unknown>): ApplicationArea {
  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    property: String(row.property ?? row.propertyName ?? ''),
    weatherLocationId: String(row.weatherLocationId ?? row.weather_location_id ?? ''),
  };
}

function normalizeTaskRequest(row: Record<string, unknown>): TaskRequest {
  return {
    id: String(row.id ?? ''),
    propertyId: String(row.propertyId ?? row.property_id ?? ''),
    date: String(row.date ?? ''),
    title: String(row.title ?? ''),
    taskId: row.taskId ? String(row.taskId) : row.task_id ? String(row.task_id) : undefined,
    requestedBy: String(row.requestedBy ?? row.requested_by ?? 'Client Request'),
    requestedByType: (row.requestedByType ?? row.requested_by_type ?? 'client') as TaskRequest['requestedByType'],
    priority: (row.priority ?? 'medium') as TaskRequest['priority'],
    status: (row.status ?? 'new') as TaskRequest['status'],
    preferredLocation: row.preferredLocation ? String(row.preferredLocation) : row.preferred_location ? String(row.preferred_location) : undefined,
    notes: String(row.notes ?? ''),
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

export default function WorkboardPage() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const { currentPropertyId, setCurrentPropertyId, currentUser } = useAuth();
  const [boardDate, setBoardDate] = useState(defaultBoardDate());
  const [department, setDepartment] = useState('Maintenance');
  const [groupFilter, setGroupFilter] = useState('all');
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [linkedRequestId, setLinkedRequestId] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [draggingEmployeeId, setDraggingEmployeeId] = useState<string | null>(null);
  const [dropTargetEmployeeId, setDropTargetEmployeeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');
  const [lastRealtimeRefreshAt, setLastRealtimeRefreshAt] = useState<number | null>(null);
  const [laneOrder, setLaneOrder] = useState<string[]>([]);
  const [needsFilter, setNeedsFilter] = useState<'all' | 'new' | 'assigned'>('all');

  const laneOrderStorageKey = useMemo(
    () => `workflow-lane-order:${boardDate}:${department}:${groupFilter}`,
    [boardDate, department, groupFilter],
  );

  const [assignmentDraft, setAssignmentDraft] = useState({
    employeeId: '',
    taskId: '',
    equipmentId: '',
    area: 'Primary zone',
    startTime: '05:30',
    duration: '60',
  });

  const [noteDraft, setNoteDraft] = useState({
    type: 'daily' as Note['type'],
    title: '',
    content: '',
    author: 'Operations Admin',
    location: '',
  });

  const workflowParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const focusedPropertyId = workflowParams.get('property') || '';
  const effectivePropertyId = currentPropertyId || (currentUser?.role === 'employee' ? currentUser.propertyId : 'all');

  const propertiesQuery = useProperties();
  const employeesQuery = useEmployees(effectivePropertyId);
  const assignmentsQuery = useAssignments(boardDate, effectivePropertyId);
  const scheduleQuery = useScheduleEntries(boardDate, effectivePropertyId);
  const tasksQuery = useTasks(effectivePropertyId, currentUser?.orgId);
  const equipmentQuery = useEquipmentUnits(effectivePropertyId);
  const notesQuery = useNotes(effectivePropertyId);

  const taskRequestsQuery = useQuery({
    queryKey: ['task-requests', boardDate, effectivePropertyId ?? 'all'],
    queryFn: async () => {
      if (!supabase) return [] as TaskRequest[];
      const { data, error } = await supabase.from('task_requests').select('*').eq('date', boardDate);
      if (error) throw error;
      const normalized = (data ?? []).map((row) => normalizeTaskRequest(row as Record<string, unknown>));
      return effectivePropertyId && effectivePropertyId !== 'all'
        ? normalized.filter((r) => r.propertyId === effectivePropertyId)
        : normalized;
    },
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 30,
  });

  const weatherLogsQuery = useQuery({
    queryKey: ['weather-daily-logs', boardDate],
    queryFn: async () => {
      if (!supabase) return [] as WeatherDailyLog[];
      const { data, error } = await supabase.from('weather_daily_logs').select('*').eq('date', boardDate);
      if (error) return [] as WeatherDailyLog[];
      return (data ?? []).map((row) => normalizeWeatherLog(row as Record<string, unknown>));
    },
    staleTime: 1000 * 60 * 5,
  });

  const weatherLocationsQuery = useQuery({
    queryKey: ['weather-locations', effectivePropertyId ?? 'all'],
    queryFn: async () => {
      if (!supabase) return [] as WeatherLocation[];
      const { data, error } = await supabase.from('weather_locations').select('*');
      if (error) return [] as WeatherLocation[];
      return (data ?? []).map((row) => normalizeWeatherLocation(row as Record<string, unknown>));
    },
    staleTime: 1000 * 60 * 5,
  });

  const workLocationsQuery = useQuery({
    queryKey: ['work-locations', effectivePropertyId ?? 'all'],
    queryFn: async () => {
      if (!supabase) return [] as WorkLocation[];
      const { data, error } = await supabase.from('work_locations').select('*');
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
  const equipmentList = equipmentQuery.data ?? [];
  const noteList = notesQuery.data ?? [];
  const taskRequests = taskRequestsQuery.data ?? [];
  const weatherLogs = weatherLogsQuery.data ?? [];
  const weatherLocations = weatherLocationsQuery.data ?? [];
  const workLocations = workLocationsQuery.data ?? [];

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
    return propertyRequests.filter((r) => r.status === needsFilter);
  }, [propertyRequests, needsFilter]);

  const scheduledEmployees = useMemo(() => {
    const scheduledIds = new Set(
      scheduleList.filter((e) => e.date === boardDate && e.status === 'scheduled').map((e) => e.employeeId),
    );
    return activeDepartmentEmployees
      .filter((e) => scheduledIds.has(e.id))
      .sort((a, b) => {
        const aShift = getShiftForEmployee(scheduleList, a.id, boardDate)?.shiftStart ?? '99:99';
        const bShift = getShiftForEmployee(scheduleList, b.id, boardDate)?.shiftStart ?? '99:99';
        return aShift !== bShift ? aShift.localeCompare(bShift) : `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      });
  }, [activeDepartmentEmployees, boardDate, scheduleList]);

  const unscheduledEmployees = useMemo(() => {
    const scheduledIds = new Set(
      scheduleList.filter((e) => e.date === boardDate && e.status === 'scheduled').map((e) => e.employeeId),
    );
    return activeDepartmentEmployees.filter((e) => !scheduledIds.has(e.id));
  }, [activeDepartmentEmployees, boardDate, scheduleList]);

  const fallbackEligibleEmployees = useMemo(
    () => (scheduledEmployees.length > 0 ? scheduledEmployees : activeDepartmentEmployees),
    [scheduledEmployees, activeDepartmentEmployees],
  );

  const dayAssignments = useMemo(
    () => assignmentList.filter((a) => a.date === boardDate),
    [assignmentList, boardDate],
  );

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
        return { employee, shift, employeeAssignments, assignedMinutes, shiftMinutes, openMinutes: Math.max(shiftMinutes - assignedMinutes, 0) };
      }),
    [boardDate, dayAssignments, scheduleList, scheduledEmployees],
  );

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

  const totalOpenMinutes = useMemo(
    () => orderedDispatchBoard.reduce((s, l) => s + l.openMinutes, 0),
    [orderedDispatchBoard],
  );

  const availableEquipment = useMemo(
    () => equipmentList.filter((u) => u.status === 'available' || u.status === 'in-use'),
    [equipmentList],
  );

  const latestWeatherLog = useMemo(
    () => [...weatherLogs].sort((a, b) => b.date.localeCompare(a.date))[0],
    [weatherLogs],
  );

  const planningWeatherLocation = latestWeatherLog
    ? weatherLocations.find((l) => l.id === latestWeatherLog.locationId) ?? weatherLocations[0]
    : weatherLocations[0];

  const showFreshUpdateBadge = lastRealtimeRefreshAt != null && Date.now() - lastRealtimeRefreshAt < 90_000;

  const newRequestsCount = propertyRequests.filter((r) => r.status === 'new').length;

  function openAssignmentDialog(employeeId: string) {
    const defaultLocation = propertyWorkLocations[0]?.name ?? 'Primary zone';
    const targetEmployeeId = employeeId || fallbackEligibleEmployees[0]?.id || '';
    setEditingAssignmentId(null);
    setSelectedEmployeeId(targetEmployeeId);
    setAssignmentDraft({
      employeeId: targetEmployeeId,
      taskId: taskList[0]?.id ?? '',
      equipmentId: '',
      area: defaultLocation,
      startTime: '05:30',
      duration: '60',
    });
    setAssignmentDialogOpen(true);
  }

  function openEditAssignmentDialog(assignment: Assignment) {
    setEditingAssignmentId(assignment.id);
    setSelectedEmployeeId(assignment.employeeId);
    setAssignmentDraft({
      employeeId: assignment.employeeId,
      taskId: assignment.taskId,
      equipmentId: assignment.equipmentId ?? '',
      area: assignment.area,
      startTime: assignment.startTime,
      duration: String(assignment.duration),
    });
    setAssignmentDialogOpen(true);
  }

  function applyRequestToAssignment(request: TaskRequest) {
    setLinkedRequestId(request.id);
    const targetTaskId = request.taskId || taskList[0]?.id || '';
    const targetEmployeeId = fallbackEligibleEmployees[0]?.id || '';
    setEditingAssignmentId(null);
    setSelectedEmployeeId(targetEmployeeId);
    setAssignmentDraft({
      employeeId: targetEmployeeId,
      taskId: targetTaskId,
      equipmentId: '',
      area: request.preferredLocation || propertyWorkLocations[0]?.name || 'Primary zone',
      startTime: '05:30',
      duration: String(taskList.find((t) => t.id === targetTaskId)?.duration ?? 60),
    });
    setAssignmentDialogOpen(true);
  }

  async function saveAssignment() {
    if (!supabase || !effectivePropertyId || effectivePropertyId === 'all' || !assignmentDraft.employeeId || !assignmentDraft.taskId) return;

    const assignmentId = editingAssignmentId ?? makeId('assign');
    const { error } = await supabase.from('assignments').upsert({
      id: assignmentId,
      employee_id: assignmentDraft.employeeId,
      property_id: effectivePropertyId,
      task_id: assignmentDraft.taskId,
      date: boardDate,
      location: assignmentDraft.area,
      status: 'planned',
      start_time: assignmentDraft.startTime,
      duration: Number(assignmentDraft.duration || 0),
      equipment_id: assignmentDraft.equipmentId || null,
    });

    if (error) {
      toast('Unable to save assignment', { description: error.message });
      return;
    }

    if (linkedRequestId) {
      await supabase
        .from('task_requests')
        .update({ status: 'assigned', task_id: assignmentDraft.taskId, preferred_location: assignmentDraft.area })
        .eq('id', linkedRequestId);
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['assignments'] }),
      queryClient.invalidateQueries({ queryKey: ['task-requests'] }),
    ]);
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
    const { error } = await supabase.from('assignments').delete().eq('id', assignmentId);
    if (error) { toast('Unable to remove assignment', { description: error.message }); return; }
    await queryClient.invalidateQueries({ queryKey: ['assignments'] });
  }

  async function dismissRequest(requestId: string) {
    if (!supabase) return;
    await supabase.from('task_requests').update({ status: 'assigned' }).eq('id', requestId);
    await queryClient.invalidateQueries({ queryKey: ['task-requests'] });
  }

  async function saveNote() {
    if (!supabase || !effectivePropertyId || effectivePropertyId === 'all' || !noteDraft.title.trim() || !noteDraft.content.trim()) return;
    const { error } = await supabase.from('notes').insert({
      id: makeId('note'),
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

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">

      {/* ─── MAIN DISPATCH BOARD ─── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header bar */}
        <div className="border-b bg-card px-5 py-3 flex items-center gap-3 flex-wrap shrink-0">
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

          {/* Date picker */}
          <input
            type="date"
            value={boardDate}
            onChange={(e) => setBoardDate(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            data-testid="input-board-date"
          />

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
              {orderedDispatchBoard.map((lane, index) => (
                <EmployeeRow
                  key={lane.employee.id}
                  employee={lane.employee}
                  assignments={lane.employeeAssignments}
                  tasks={taskList}
                  orderIndex={index}
                  isDragging={draggingEmployeeId === lane.employee.id}
                  isDropTarget={dropTargetEmployeeId === lane.employee.id}
                  shiftLabel={lane.shift ? `${lane.shift.shiftStart}–${lane.shift.shiftEnd}` : undefined}
                  laneSummary={
                    lane.shift
                      ? `${lane.assignedMinutes} min assigned · ${lane.openMinutes} min open`
                      : `${lane.employeeAssignments.length} tasks assigned`
                  }
                  onDragStart={setDraggingEmployeeId}
                  onDragEnter={setDropTargetEmployeeId}
                  onDragEnd={() => { setDraggingEmployeeId(null); setDropTargetEmployeeId(null); }}
                  onDropRow={moveEmployeeLane}
                  onAddTask={openAssignmentDialog}
                  onEditAssignment={openEditAssignmentDialog}
                  onRemoveAssignment={removeAssignment}
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
            {(['all', 'new', 'assigned'] as const).map((f) => (
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
                {f === 'all' ? `All (${propertyRequests.length})` : f === 'new' ? `Open (${propertyRequests.filter((r) => r.status === 'new').length})` : `Done (${propertyRequests.filter((r) => r.status === 'assigned').length})`}
              </button>
            ))}
          </div>

          {filteredRequests.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-muted/20 p-4 text-center">
              <p className="text-xs text-muted-foreground">
                {needsFilter === 'new' ? 'All needs have been handled.' : needsFilter === 'assigned' ? 'No needs dispatched yet.' : 'No needs logged for this date.'}
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
                  {request.status !== 'assigned' && (
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        className="h-7 text-[11px] flex-1"
                        onClick={() => applyRequestToAssignment(request)}
                        disabled={fallbackEligibleEmployees.length === 0}
                        data-testid={`button-assign-request-${request.id}`}
                      >
                        Dispatch
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[11px] px-2"
                        onClick={() => dismissRequest(request.id)}
                        data-testid={`button-dismiss-request-${request.id}`}
                      >
                        Done
                      </Button>
                    </div>
                  )}
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
                        {lane.shift ? `${lane.shift.shiftStart}–${lane.shift.shiftEnd}` : 'No shift'} · {tasksCount} task{tasksCount !== 1 ? 's' : ''}
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
          {planningWeatherLocation && latestWeatherLog ? (
            <WeatherSnapshotCard location={planningWeatherLocation} log={latestWeatherLog} compact title="Daily Weather" />
          ) : (
            <p className="text-xs text-muted-foreground">No weather data for this date.</p>
          )}
        </div>

        {/* Escalations */}
        <div className="border-b p-4 flex-shrink-0">
          <EscalationCenter />
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
                  const shiftStr = shift ? ` (${shift.shiftStart}–${shift.shiftEnd})` : '';
                  return (
                    <option key={e.id} value={e.id}>
                      {e.firstName} {e.lastName}{shiftStr} · {e.group}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Task</label>
              <select
                value={assignmentDraft.taskId}
                onChange={(e) => {
                  const task = taskList.find((t) => t.id === e.target.value);
                  setAssignmentDraft({ ...assignmentDraft, taskId: e.target.value, duration: String(task?.duration ?? assignmentDraft.duration) });
                }}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                data-testid="select-assignment-task"
              >
                {taskList.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
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
                  <option key={u.id} value={u.id}>{u.unitNumber} · {u.location} · {u.status}</option>
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
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Duration (minutes)</label>
              <Input
                value={assignmentDraft.duration}
                onChange={(e) => setAssignmentDraft({ ...assignmentDraft, duration: e.target.value })}
                className="mt-1"
                data-testid="input-assignment-duration"
              />
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
