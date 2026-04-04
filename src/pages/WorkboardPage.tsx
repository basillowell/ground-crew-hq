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
import { TurfPanel } from '@/components/workboard/TurfPanel';
import { EscalationCenter } from '@/components/notifications/EscalationCenter';
import { WeatherSnapshotCard } from '@/components/weather/WeatherSnapshotCard';
import { toast } from '@/components/ui/sonner';
import { turfData, type ApplicationArea, type Assignment, type Employee, type EquipmentUnit, type Note, type Property, type ScheduleEntry, type Task, type TaskRequest, type WeatherDailyLog, type WeatherLocation, type WorkLocation } from '@/data/seedData';
import { StickyNote, Droplets, CloudSun, MonitorSmartphone, LayoutList, GanttChart } from 'lucide-react';
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

function normalizeApplicationLog(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ''),
    applicationDate: String(row.applicationDate ?? row.application_date ?? ''),
    startTime: String(row.startTime ?? row.start_time ?? ''),
    endTime: String(row.endTime ?? row.end_time ?? ''),
    areaId: String(row.areaId ?? row.area_id ?? ''),
    agronomicPurpose: String(row.agronomicPurpose ?? row.agronomic_purpose ?? ''),
    areaTreated: Number(row.areaTreated ?? row.area_treated ?? 0),
    areaUnit: String(row.areaUnit ?? row.area_unit ?? ''),
  };
}

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
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [linkedRequestId, setLinkedRequestId] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [draggingEmployeeId, setDraggingEmployeeId] = useState<string | null>(null);
  const [dropTargetEmployeeId, setDropTargetEmployeeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');
  const [lastRealtimeRefreshAt, setLastRealtimeRefreshAt] = useState<number | null>(null);
  const [laneOrder, setLaneOrder] = useState<string[]>([]);
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
  const [requestDraft, setRequestDraft] = useState({
    title: '',
    taskId: '',
    requestedBy: 'Client Request',
    requestedByType: 'client' as TaskRequest['requestedByType'],
    priority: 'medium' as TaskRequest['priority'],
    preferredLocation: '',
    notes: '',
  });

  const workflowParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const focusedPropertyId = workflowParams.get('property') || '';
  const focusMode = workflowParams.get('focus') || '';
  const effectivePropertyId = currentPropertyId || (currentUser?.role === 'employee' ? currentUser.propertyId : 'all');

  const propertiesQuery = useProperties();
  const employeesQuery = useEmployees(effectivePropertyId);
  const assignmentsQuery = useAssignments(boardDate, effectivePropertyId);
  const scheduleQuery = useScheduleEntries(boardDate, effectivePropertyId);
  const tasksQuery = useTasks(effectivePropertyId);
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
        ? normalized.filter((request) => request.propertyId === effectivePropertyId)
        : normalized;
    },
    staleTime: 1000 * 60 * 5,
  });
  const applicationAreasQuery = useQuery({
    queryKey: ['application-areas', effectivePropertyId ?? 'all'],
    queryFn: async () => {
      if (!supabase) return [] as ApplicationArea[];
      const { data, error } = await supabase.from('application_areas').select('*');
      if (error) return [] as ApplicationArea[];
      return (data ?? []).map((row) => normalizeApplicationArea(row as Record<string, unknown>));
    },
    staleTime: 1000 * 60 * 5,
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
  const applicationLogsQuery = useQuery({
    queryKey: ['chemical-application-logs-board', boardDate],
    queryFn: async () => {
      if (!supabase) return [] as Array<ReturnType<typeof normalizeApplicationLog>>;
      const { data, error } = await supabase.from('chemical_application_logs').select('*').eq('applicationDate', boardDate);
      if (error) return [] as Array<ReturnType<typeof normalizeApplicationLog>>;
      return (data ?? []).map((row) => normalizeApplicationLog(row as Record<string, unknown>));
    },
    staleTime: 1000 * 60 * 5,
  });

  const properties = propertiesQuery.data ?? [];
  const employeeList = employeesQuery.data ?? [];
  const assignmentList = assignmentsQuery.data ?? [];
  const scheduleList = scheduleQuery.data ?? [];
  const taskList = useMemo(
    () => (tasksQuery.data ?? []).filter((task) => task.status === 'active').sort((left, right) => (left.priority ?? 999) - (right.priority ?? 999) || left.name.localeCompare(right.name)),
    [tasksQuery.data],
  );
  const equipmentList = equipmentQuery.data ?? [];
  const noteList = notesQuery.data ?? [];
  const taskRequests = taskRequestsQuery.data ?? [];
  const applicationAreas = applicationAreasQuery.data ?? [];
  const weatherLogs = weatherLogsQuery.data ?? [];
  const weatherLocations = weatherLocationsQuery.data ?? [];
  const workLocations = workLocationsQuery.data ?? [];
  const applicationLogs = applicationLogsQuery.data ?? [];

  useEffect(() => {
    if (assignmentsQuery.dataUpdatedAt || taskRequestsQuery.dataUpdatedAt || tasksQuery.dataUpdatedAt) {
      setLastRealtimeRefreshAt(Math.max(assignmentsQuery.dataUpdatedAt ?? 0, taskRequestsQuery.dataUpdatedAt ?? 0, tasksQuery.dataUpdatedAt ?? 0));
    }
  }, [assignmentsQuery.dataUpdatedAt, taskRequestsQuery.dataUpdatedAt, tasksQuery.dataUpdatedAt]);

  useEffect(() => {
    const firstScheduled =
      scheduleList.find((entry) => entry.date === boardDate && entry.status === 'scheduled')?.employeeId ??
      employeeList.find((employee) => employee.status === 'active')?.id ??
      '';
    setSelectedEmployeeId((current) => current || firstScheduled);
    setAssignmentDraft((current) => ({
      ...current,
      employeeId: current.employeeId || firstScheduled,
      taskId: current.taskId || taskList[0]?.id || '',
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        setLastRealtimeRefreshAt(Date.now());
        void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      })
      .subscribe();

    return () => {
      void channel.unsubscribe();
    };
  }, [queryClient]);

  useEffect(() => {
    if (focusedPropertyId && focusedPropertyId !== currentPropertyId) {
      setCurrentPropertyId(focusedPropertyId);
    }
  }, [currentPropertyId, focusedPropertyId, setCurrentPropertyId]);

  const groups = useMemo(
    () => [...new Set(employeeList.filter((employee) => employee.status === 'active').map((employee) => employee.group))].sort((left, right) => left.localeCompare(right)),
    [employeeList],
  );

  const allActiveEmployees = useMemo(
    () => employeeList.filter((employee) => employee.status === 'active'),
    [employeeList],
  );

  const activeDepartmentEmployees = useMemo(
    () =>
      allActiveEmployees.filter(
        (employee) =>
          (!effectivePropertyId || effectivePropertyId === 'all' || employee.propertyId === effectivePropertyId) &&
          (!department || department === 'All Departments' || employee.department === department) &&
          (groupFilter === 'all' || employee.group === groupFilter),
      ),
    [allActiveEmployees, department, effectivePropertyId, groupFilter],
  );

  const propertyWorkLocations = useMemo(
    () => workLocations.filter((location) => !effectivePropertyId || effectivePropertyId === 'all' || location.propertyId === effectivePropertyId),
    [effectivePropertyId, workLocations],
  );

  const activeProperty = useMemo(
    () => properties.find((property) => property.id === effectivePropertyId) ?? null,
    [effectivePropertyId, properties],
  );

  const propertyRequests = useMemo(
    () =>
      taskRequests
        .filter((request) => (!effectivePropertyId || effectivePropertyId === 'all' || request.propertyId === effectivePropertyId) && request.date === boardDate)
        .sort((left, right) => {
          const priorityOrder = { high: 0, medium: 1, low: 2 } as const;
          return priorityOrder[left.priority] - priorityOrder[right.priority];
        }),
    [boardDate, effectivePropertyId, taskRequests],
  );

  const scheduledEmployees = useMemo(() => {
    const scheduledIds = new Set(
      scheduleList
        .filter((entry) => entry.date === boardDate && entry.status === 'scheduled')
        .map((entry) => entry.employeeId),
    );
    return activeDepartmentEmployees
      .filter((employee) => scheduledIds.has(employee.id))
      .sort((left, right) => {
        const leftShift = getShiftForEmployee(scheduleList, left.id, boardDate)?.shiftStart ?? '99:99';
        const rightShift = getShiftForEmployee(scheduleList, right.id, boardDate)?.shiftStart ?? '99:99';
        if (leftShift !== rightShift) return leftShift.localeCompare(rightShift);
        return `${left.firstName} ${left.lastName}`.localeCompare(`${right.firstName} ${right.lastName}`);
      });
  }, [activeDepartmentEmployees, boardDate, scheduleList]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedOrder = window.localStorage.getItem(laneOrderStorageKey);
    if (!storedOrder) {
      setLaneOrder([]);
      return;
    }
    try {
      const parsed = JSON.parse(storedOrder);
      setLaneOrder(Array.isArray(parsed) ? parsed : []);
    } catch {
      setLaneOrder([]);
    }
  }, [laneOrderStorageKey]);

  const unscheduledEmployees = useMemo(() => {
    const scheduledIds = new Set(
      scheduleList
        .filter((entry) => entry.date === boardDate && entry.status === 'scheduled')
        .map((entry) => entry.employeeId),
    );
    return activeDepartmentEmployees.filter((employee) => !scheduledIds.has(employee.id));
  }, [activeDepartmentEmployees, boardDate, scheduleList]);

  const fallbackEligibleEmployees = useMemo(
    () => (scheduledEmployees.length > 0 ? scheduledEmployees : activeDepartmentEmployees),
    [scheduledEmployees, activeDepartmentEmployees],
  );

  const dayAssignments = useMemo(
    () => assignmentList.filter((assignment) => assignment.date === boardDate),
    [assignmentList, boardDate],
  );

  const assignedEmployeeIds = useMemo(
    () => new Set(dayAssignments.map((assignment) => assignment.employeeId)),
    [dayAssignments],
  );

  const dispatchBoard = useMemo(
    () =>
      scheduledEmployees.map((employee) => {
        const shift = getShiftForEmployee(scheduleList, employee.id, boardDate);
        const employeeAssignments = dayAssignments
          .filter((assignment) => assignment.employeeId === employee.id)
          .sort((left, right) => left.startTime.localeCompare(right.startTime));
        const assignedMinutes = employeeAssignments.reduce((total, assignment) => total + assignment.duration, 0);
        const shiftMinutes = shift ? Math.max(timeToMinutes(shift.shiftEnd) - timeToMinutes(shift.shiftStart), 0) : 0;
        return {
          employee,
          shift,
          employeeAssignments,
          assignedMinutes,
          shiftMinutes,
          openMinutes: Math.max(shiftMinutes - assignedMinutes, 0),
        };
      }),
    [boardDate, dayAssignments, scheduleList, scheduledEmployees],
  );

  const orderedDispatchBoard = useMemo(() => {
    const ranking = new Map(laneOrder.map((employeeId, index) => [employeeId, index]));
    return [...dispatchBoard].sort((left, right) => {
      const leftRank = ranking.get(left.employee.id);
      const rightRank = ranking.get(right.employee.id);
      if (leftRank != null && rightRank != null) return leftRank - rightRank;
      if (leftRank != null) return -1;
      if (rightRank != null) return 1;
      return 0;
    });
  }, [dispatchBoard, laneOrder]);

  const totalOpenMinutes = useMemo(
    () => orderedDispatchBoard.reduce((total, lane) => total + lane.openMinutes, 0),
    [orderedDispatchBoard],
  );

  const availableEquipment = useMemo(
    () => equipmentList.filter((unit) => unit.status === 'available' || unit.status === 'in-use'),
    [equipmentList],
  );

  const latestWeatherLog = useMemo(
    () => [...weatherLogs].sort((left, right) => right.date.localeCompare(left.date))[0],
    [weatherLogs],
  );

  const planningWeatherLocation = latestWeatherLog
    ? weatherLocations.find((location) => location.id === latestWeatherLog.locationId) ?? weatherLocations[0]
    : weatherLocations[0];

  const todayApplications = useMemo(
    () => applicationLogs.filter((log) => log.applicationDate === boardDate),
    [applicationLogs, boardDate],
  );
  const showFreshUpdateBadge = lastRealtimeRefreshAt != null && Date.now() - lastRealtimeRefreshAt < 90_000;

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

  function openRequestDialog() {
    setRequestDraft({
      title: '',
      taskId: taskList[0]?.id ?? '',
      requestedBy: activeProperty?.name ? `${activeProperty.name} Client` : 'Client Request',
      requestedByType: 'client',
      priority: 'medium',
      preferredLocation: propertyWorkLocations[0]?.name ?? '',
      notes: '',
    });
    setRequestDialogOpen(true);
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
      const { error: requestError } = await supabase
        .from('task_requests')
        .update({
          status: 'assigned',
          task_id: assignmentDraft.taskId,
          preferred_location: assignmentDraft.area,
        })
        .eq('id', linkedRequestId);

      if (requestError) {
        toast('Assignment saved, but request link was not updated', { description: requestError.message });
      }
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['assignments'] }),
      queryClient.invalidateQueries({ queryKey: ['task-requests'] }),
    ]);
    setLinkedRequestId(null);
    setEditingAssignmentId(null);
    setAssignmentDialogOpen(false);
    toast(editingAssignmentId ? 'Assignment updated' : 'Assignment added', {
      description: editingAssignmentId
        ? 'The workflow board, breakroom, and reports now reflect the updated task plan.'
        : 'The workflow board, breakroom, and reports now reflect this planned task.',
    });
  }

  async function removeAssignment(assignmentId: string) {
    if (!supabase) return;
    const { error } = await supabase.from('assignments').delete().eq('id', assignmentId);
    if (error) {
      toast('Unable to remove assignment', { description: error.message });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['assignments'] });
  }

  async function saveTaskRequest() {
    if (!supabase || !effectivePropertyId || effectivePropertyId === 'all' || !requestDraft.title.trim()) return;
    const { error } = await supabase.from('task_requests').insert({
      id: makeId('treq'),
      property_id: effectivePropertyId,
      date: boardDate,
      title: requestDraft.title.trim(),
      task_id: requestDraft.taskId || null,
      requested_by: requestDraft.requestedBy.trim() || 'Client Request',
      requested_by_type: requestDraft.requestedByType,
      priority: requestDraft.priority,
      status: 'new',
      preferred_location: requestDraft.preferredLocation.trim() || null,
      notes: requestDraft.notes.trim(),
    });

    if (error) {
      toast('Unable to save property request', { description: error.message });
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ['task-requests'] });
    setRequestDialogOpen(false);
    toast('Property request added', {
      description: 'This request is now ready for admin review and assignment on the selected workflow board.',
    });
  }

  function useRequestForAssignment(request: TaskRequest) {
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
      duration: String(taskList.find((task) => task.id === targetTaskId)?.duration ?? 60),
    });
    setAssignmentDialogOpen(true);
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

    if (error) {
      toast('Unable to save note', { description: error.message });
      return;
    }

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
      setDraggingEmployeeId(null);
      setDropTargetEmployeeId(null);
      return;
    }

    const employeeIds = orderedDispatchBoard.map((lane) => lane.employee.id);
    const baseOrder = employeeIds.filter((employeeId) => employeeId !== draggingEmployeeId);
    const targetIndex = baseOrder.indexOf(targetEmployeeId);
    if (targetIndex === -1) {
      setDraggingEmployeeId(null);
      setDropTargetEmployeeId(null);
      return;
    }

    baseOrder.splice(targetIndex, 0, draggingEmployeeId);
    persistLaneOrder(baseOrder);
    setDraggingEmployeeId(null);
    setDropTargetEmployeeId(null);
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Main workflow board */}
      <div className="flex-1 p-4 overflow-auto">
        <PageHeader
          title={activeProperty ? `${activeProperty.name} Workflow` : 'Workflow'}
          subtitle={activeProperty ? `Dispatch board for ${activeProperty.name}. Collect property work needs, match them to scheduled crew, and hand the finished plan off to Breakroom.` : 'Pull the scheduled crew for the selected day, assign tasks from Task Management, and send the finished plan straight to the breakroom screen.'}
          badge={<Badge variant="secondary">{activeProperty ? `${activeProperty.name} / ${department} / ${boardDate}` : `${department} / ${boardDate}`}</Badge>}
          action={{ label: activeProperty ? 'Add Property Need' : 'Add Assignment', onClick: () => (activeProperty ? openRequestDialog() : openAssignmentDialog(selectedEmployeeId || fallbackEligibleEmployees[0]?.id || '')) }}
        >
           {activeProperty ? (
             <Badge variant="outline" className="h-7 px-3 text-xs" style={{ borderColor: activeProperty.color, color: activeProperty.color }}>
               {activeProperty.shortName}
             </Badge>
           ) : null}
           <Badge variant="outline" className="h-7 px-3 text-xs">
             Scheduled Crew Only
           </Badge>
           <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'list' | 'timeline')}>
             <TabsList className="h-8">
               <TabsTrigger value="list" className="text-xs gap-1"><LayoutList className="h-3.5 w-3.5" /> List</TabsTrigger>
               <TabsTrigger value="timeline" className="text-xs gap-1"><GanttChart className="h-3.5 w-3.5" /> Timeline</TabsTrigger>
             </TabsList>
           </Tabs>
           <Tooltip>
             <TooltipTrigger asChild>
               <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" aria-label="Breakroom cast help">
                 <MonitorSmartphone className="h-4 w-4" />
               </Button>
             </TooltipTrigger>
             <TooltipContent align="end" className="max-w-xs text-xs leading-relaxed">
               Use Breakroom as the passive cast screen for a Wi-Fi connected TV on the existing network. Build the plan here, then refresh Breakroom to display the live crew order and task sequence.
             </TooltipContent>
           </Tooltip>
         </PageHeader>

        {activeProperty ? (
          <div
            className="mb-4 overflow-hidden rounded-3xl border bg-card/95 shadow-sm"
            style={{ borderColor: `${activeProperty.color}55` }}
          >
            <div className="h-1.5" style={{ background: activeProperty.color }} />
            <div className="grid gap-4 p-5 lg:grid-cols-[1.15fr_0.85fr]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" style={{ borderColor: activeProperty.color, color: activeProperty.color }}>
                    {activeProperty.shortName}
                  </Badge>
                  <Badge variant="secondary">{activeProperty.city}, {activeProperty.state}</Badge>
                  {activeProperty.propertyClassId ? <Badge variant="outline">Property class assigned</Badge> : null}
                </div>
                <h3 className="mt-3 text-lg font-semibold">Property Task Needs</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Start here for {activeProperty.name}. Collect what the property needs done on {boardDate}, then convert those needs into assignments for the scheduled crew.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="outline">{propertyRequests.length} needs collected</Badge>
                  <Badge variant="outline">{propertyWorkLocations.length} property locations</Badge>
                  <Badge variant="outline">{fallbackEligibleEmployees.length} employees available to assign</Badge>
                </div>
              </div>
              <div className="rounded-2xl border bg-muted/20 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">Today&apos;s needs queue</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Client-submitted and admin-entered needs waiting to be assigned.
                    </div>
                  </div>
                  <Button size="sm" onClick={openRequestDialog}>Add Need</Button>
                </div>
                <div className="mt-4 space-y-3">
                  {propertyRequests.length === 0 ? (
                    <div className="rounded-2xl border border-dashed bg-background/70 p-4 text-sm text-muted-foreground">
                      No task needs have been collected for this property yet.
                    </div>
                  ) : (
                    propertyRequests.map((request) => (
                      <div key={request.id} className="rounded-2xl border bg-background/80 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium">{request.title}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {request.requestedBy} · {request.requestedByType} · {request.preferredLocation || 'No location set'}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge variant={request.priority === 'high' ? 'destructive' : request.priority === 'medium' ? 'secondary' : 'outline'}>
                              {request.priority}
                            </Badge>
                            <Badge variant="outline">{request.status}</Badge>
                          </div>
                        </div>
                        {request.notes ? <div className="mt-2 text-xs text-muted-foreground">{request.notes}</div> : null}
                        <div className="mt-3 flex justify-end">
                          <Button size="sm" onClick={() => useRequestForAssignment(request)} disabled={request.status === 'assigned' || fallbackEligibleEmployees.length === 0}>
                            Assign Need
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr] mb-4">
          <div className="rounded-3xl border bg-card/90 p-4 shadow-sm">
            <div className="text-sm font-medium">Crew filter</div>
            <p className="text-xs text-muted-foreground mt-1">This board follows the top-bar department and date. The assignment flow stays focused on the scheduled crew for that day so dispatching is faster and cleaner.</p>
            <div className="mt-3">
              <label className="text-xs text-muted-foreground">Group</label>
              <select
                value={groupFilter}
                onChange={(event) => setGroupFilter(event.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">All groups</option>
                {groups.map((group) => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="rounded-3xl border bg-card/90 p-4 shadow-sm">
            <div className="text-sm font-medium">Program setup tie-in</div>
            <p className="text-xs text-muted-foreground mt-1">Assignments pull from Task Management and property locations, while employee rows inherit role, department, group, worker type, and property from Employee Management.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="outline">{taskList.length} active tasks</Badge>
              <Badge variant="outline">{propertyWorkLocations.length} locations</Badge>
              <Badge variant="outline">{activeDepartmentEmployees.length} active employees</Badge>
              <Badge variant="outline">{propertyRequests.length} property requests</Badge>
              {focusMode === 'requests' ? <Badge variant="secondary">Command Center drill-in</Badge> : null}
            </div>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <Badge variant="outline">{orderedDispatchBoard.length} scheduled crew</Badge>
          <Badge variant="outline">{assignedEmployeeIds.size} with tasks</Badge>
          <Badge variant="outline">{Math.max(orderedDispatchBoard.length - assignedEmployeeIds.size, 0)} waiting assignment</Badge>
          <Badge variant="outline">{dayAssignments.length} task rows</Badge>
          <Badge variant="outline">{totalOpenMinutes} open mins</Badge>
          {showFreshUpdateBadge ? <Badge variant="secondary">Updated just now</Badge> : null}
        </div>

        <div className="hidden grid gap-4 xl:grid-cols-[1.15fr_0.85fr] mb-4">
          <div className="rounded-3xl border bg-card/90 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <CloudSun className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Weather Planning Snapshot</h3>
            </div>
            {planningWeatherLocation && latestWeatherLog ? (
              <WeatherSnapshotCard location={planningWeatherLocation} log={latestWeatherLog} compact />
            ) : (
              <p className="text-sm text-muted-foreground">No weather snapshot available for today yet.</p>
            )}
          </div>
          <div className="rounded-3xl border bg-card/90 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Droplets className="h-4 w-4 text-chart-blue" />
              <h3 className="text-sm font-semibold">Application Planning Cues</h3>
            </div>
            <div className="space-y-3">
              <div className="rounded-2xl bg-muted/50 p-3">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Today's applications</div>
                <div className="mt-1 text-2xl font-semibold">{todayApplications.length}</div>
              </div>
              {todayApplications.slice(0, 2).map((log) => {
                const area = applicationAreas.find((entry) => entry.id === log.areaId);
                return (
                  <div key={log.id} className="rounded-2xl border p-3">
                    <div className="text-sm font-medium">{area?.name ?? 'Unknown area'}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {log.startTime} - {log.endTime} · {log.areaTreated} {log.areaUnit}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{log.agronomicPurpose}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border bg-card/90 p-4 shadow-sm mb-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="text-sm font-semibold">Crew Needing Setup Attention</h3>
              <p className="text-xs text-muted-foreground">These employees are active in the selected department but do not have a scheduled shift for this operating date.</p>
            </div>
            <Badge variant="outline">{unscheduledEmployees.length} unscheduled</Badge>
          </div>
          {unscheduledEmployees.length === 0 ? (
            <p className="text-sm text-muted-foreground">Everyone in this filtered department has a scheduled shift for {boardDate}.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {unscheduledEmployees.map((employee) => (
                <div key={employee.id} className="rounded-2xl border bg-muted/30 p-4">
                  <div className="font-medium">{employee.firstName} {employee.lastName}</div>
                  <div className="text-xs text-muted-foreground mt-1">{employee.role} · {employee.group} · {employee.workerType}</div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Badge variant="outline">{employee.department}</Badge>
                    <Badge variant="secondary">{employee.language}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {orderedDispatchBoard.length === 0 ? (
          <div className="rounded-3xl border border-dashed bg-card/80 p-6 text-sm text-muted-foreground shadow-sm">
            No scheduled employees are available for {boardDate}. Build the day in Scheduler first, then return here to assign tasks from Task Management.
          </div>
        ) : viewMode === 'timeline' ? (
          <GanttTimeline
            employees={orderedDispatchBoard.map((lane) => lane.employee)}
            assignments={dayAssignments}
            tasks={taskList}
            equipment={equipmentList}
            scheduleEntries={scheduleList}
            date={boardDate}
            onAssignmentClick={(a) => openEditAssignmentDialog(a)}
            onDropTask={(employeeId, startMinute) => {
              const hours = Math.floor(startMinute / 60);
              const mins = startMinute % 60;
              openAssignmentDialog(employeeId);
            }}
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
                shiftLabel={lane.shift ? `${lane.shift.shiftStart}-${lane.shift.shiftEnd}` : undefined}
                laneSummary={lane.shift ? `${lane.assignedMinutes} assigned mins / ${lane.openMinutes} open mins` : `${lane.employeeAssignments.length} tasks assigned`}
                onDragStart={setDraggingEmployeeId}
                onDragEnter={setDropTargetEmployeeId}
                onDragEnd={() => {
                  setDraggingEmployeeId(null);
                  setDropTargetEmployeeId(null);
                }}
                onDropRow={moveEmployeeLane}
                onAddTask={openAssignmentDialog}
                onEditAssignment={openEditAssignmentDialog}
                onRemoveAssignment={removeAssignment}
              />
            ))}
          </div>
        )}
      </div>

      {/* Right rail */}
      <div className="w-80 border-l bg-card overflow-auto p-4 hidden lg:block">
        <div className="space-y-4">
          <div className="rounded-3xl border bg-card/90 p-4 shadow-sm">
            <EscalationCenter />
          </div>

          <div className="rounded-3xl border bg-card/90 p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <CloudSun className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Daily Weather</h3>
            </div>
            {planningWeatherLocation && latestWeatherLog ? (
              <WeatherSnapshotCard
                location={planningWeatherLocation}
                log={latestWeatherLog}
                compact
                title="Daily Weather"
              />
            ) : (
              <p className="text-sm text-muted-foreground">No weather snapshot is available for the selected day yet.</p>
            )}
          </div>

          <div className="rounded-3xl border bg-card/90 p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Droplets className="h-4 w-4 text-chart-blue" />
              <h3 className="text-sm font-semibold">Daily Applications</h3>
            </div>
            <div className="space-y-3">
              <div className="rounded-2xl bg-muted/50 p-3">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Applications scheduled today</div>
                <div className="mt-1 text-2xl font-semibold">{todayApplications.length}</div>
              </div>
              {todayApplications.length === 0 ? (
                <p className="text-sm text-muted-foreground">No chemical applications are logged for this day.</p>
              ) : (
                todayApplications.slice(0, 3).map((log) => {
                  const area = applicationAreas.find((entry) => entry.id === log.areaId);
                  return (
                    <div key={log.id} className="rounded-2xl border p-3">
                      <div className="text-sm font-medium">{area?.name ?? 'Unknown area'}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {log.startTime} - {log.endTime} · {log.areaTreated} {log.areaUnit}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{log.agronomicPurpose}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-3xl border bg-card/90 p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Notes</h3>
            </div>
            <NotesPanel notes={noteList.filter((note) => note.date === boardDate || note.type === 'general')} onAddNote={() => setNoteDialogOpen(true)} />
          </div>

          <div className="rounded-3xl border bg-card/90 p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Droplets className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Turf</h3>
            </div>
            <TurfPanel data={turfData} />
          </div>
        </div>
      </div>

      <Dialog open={assignmentDialogOpen} onOpenChange={setAssignmentDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingAssignmentId ? 'Edit Workflow Assignment' : 'Add Workflow Assignment'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Employee</label>
              <select
                value={assignmentDraft.employeeId}
                onChange={(event) => setAssignmentDraft({ ...assignmentDraft, employeeId: event.target.value })}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {fallbackEligibleEmployees.length === 0 && <option value="">No employees available</option>}
                {fallbackEligibleEmployees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.firstName} {employee.lastName} · {employee.department} · {employee.group}{employee.status !== 'active' ? ' · inactive' : ''}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Scheduled employees appear first. If no one is scheduled yet, the active filtered roster is available so you can keep building the day.
              </p>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Task</label>
              <select
                value={assignmentDraft.taskId}
                onChange={(event) => setAssignmentDraft({ ...assignmentDraft, taskId: event.target.value })}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {taskList.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Equipment</label>
              <select
                value={assignmentDraft.equipmentId}
                onChange={(event) => setAssignmentDraft({ ...assignmentDraft, equipmentId: event.target.value })}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">No equipment assigned</option>
                {availableEquipment.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.unitNumber} · {unit.location} · {unit.status}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Start Time</label>
              <Input type="time" value={assignmentDraft.startTime} onChange={(event) => setAssignmentDraft({ ...assignmentDraft, startTime: event.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Duration (minutes)</label>
              <Input value={assignmentDraft.duration} onChange={(event) => setAssignmentDraft({ ...assignmentDraft, duration: event.target.value })} className="mt-1" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Area</label>
              {propertyWorkLocations.length > 0 ? (
                <select
                  value={assignmentDraft.area}
                  onChange={(event) => setAssignmentDraft({ ...assignmentDraft, area: event.target.value })}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {propertyWorkLocations.map((location) => (
                    <option key={location.id} value={location.name}>
                      {location.name}
                    </option>
                  ))}
                </select>
              ) : (
                <Input value={assignmentDraft.area} onChange={(event) => setAssignmentDraft({ ...assignmentDraft, area: event.target.value })} className="mt-1" />
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAssignmentDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveAssignment}>{editingAssignmentId ? 'Save Changes' : 'Save Assignment'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Property Request</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Request title</label>
              <Input value={requestDraft.title} onChange={(event) => setRequestDraft({ ...requestDraft, title: event.target.value })} className="mt-1" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Suggested task</label>
              <select
                value={requestDraft.taskId}
                onChange={(event) => setRequestDraft({ ...requestDraft, taskId: event.target.value })}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">No task linked yet</option>
                {taskList.map((task) => (
                  <option key={task.id} value={task.id}>{task.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Requested by</label>
              <Input value={requestDraft.requestedBy} onChange={(event) => setRequestDraft({ ...requestDraft, requestedBy: event.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Request type</label>
              <select
                value={requestDraft.requestedByType}
                onChange={(event) => setRequestDraft({ ...requestDraft, requestedByType: event.target.value as TaskRequest['requestedByType'] })}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="client">Client</option>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Priority</label>
              <select
                value={requestDraft.priority}
                onChange={(event) => setRequestDraft({ ...requestDraft, priority: event.target.value as TaskRequest['priority'] })}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Preferred location</label>
              <select
                value={requestDraft.preferredLocation}
                onChange={(event) => setRequestDraft({ ...requestDraft, preferredLocation: event.target.value })}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">No location preference</option>
                {propertyWorkLocations.map((location) => (
                  <option key={location.id} value={location.name}>{location.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Notes</label>
              <textarea
                value={requestDraft.notes}
                onChange={(event) => setRequestDraft({ ...requestDraft, notes: event.target.value })}
                className="mt-1 min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRequestDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveTaskRequest}>Save Request</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Workflow Note</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Type</label>
              <select
                value={noteDraft.type}
                onChange={(event) => setNoteDraft({ ...noteDraft, type: event.target.value as Note['type'] })}
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
              <Input value={noteDraft.author} onChange={(event) => setNoteDraft({ ...noteDraft, author: event.target.value })} className="mt-1" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Title</label>
              <Input value={noteDraft.title} onChange={(event) => setNoteDraft({ ...noteDraft, title: event.target.value })} className="mt-1" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Location</label>
              {propertyWorkLocations.length > 0 ? (
                <select
                  value={noteDraft.location}
                  onChange={(event) => setNoteDraft({ ...noteDraft, location: event.target.value })}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">General board note</option>
                  {propertyWorkLocations.map((location) => (
                    <option key={location.id} value={location.name}>
                      {location.name}
                    </option>
                  ))}
                </select>
              ) : (
                <Input value={noteDraft.location} onChange={(event) => setNoteDraft({ ...noteDraft, location: event.target.value })} className="mt-1" />
              )}
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Content</label>
              <textarea
                value={noteDraft.content}
                onChange={(event) => setNoteDraft({ ...noteDraft, content: event.target.value })}
                className="mt-1 min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveNote}>Save Note</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
