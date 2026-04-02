import { useEffect, useMemo, useState } from 'react';
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
import { turfData, type ApplicationArea, type Assignment, type Employee, type EquipmentUnit, type Note, type ScheduleEntry, type Task, type WeatherDailyLog, type WeatherLocation, type WorkLocation } from '@/data/seedData';
import { StickyNote, Droplets, CloudSun, MonitorSmartphone, LayoutList, GanttChart } from 'lucide-react';
import {
  loadApplicationAreas,
  loadAssignments,
  loadChemicalApplicationLogs,
  loadEmployees,
  loadEquipmentUnits,
  loadNotes,
  loadScheduleEntries,
  loadTasks,
  loadWeatherDailyLogs,
  loadWeatherLocations,
  loadWorkLocations,
  saveAssignments,
  saveNotes,
} from '@/lib/dataStore';

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

export default function WorkboardPage() {
  const [boardDate, setBoardDate] = useState(defaultBoardDate());
  const [department, setDepartment] = useState('Maintenance');
  const [groupFilter, setGroupFilter] = useState('all');
  const [employeeList, setEmployeeList] = useState<Employee[]>([]);
  const [taskList, setTaskList] = useState<Task[]>([]);
  const [assignmentList, setAssignmentList] = useState<Assignment[]>([]);
  const [applicationAreas, setApplicationAreas] = useState<ApplicationArea[]>([]);
  const [noteList, setNoteList] = useState<Note[]>([]);
  const [scheduleList, setScheduleList] = useState<ScheduleEntry[]>([]);
  const [equipmentList, setEquipmentList] = useState<EquipmentUnit[]>([]);
  const [weatherLogs, setWeatherLogs] = useState<WeatherDailyLog[]>([]);
  const [weatherLocations, setWeatherLocations] = useState<WeatherLocation[]>([]);
  const [workLocations, setWorkLocations] = useState<WorkLocation[]>([]);
  const [applicationLogs, setApplicationLogs] = useState(loadChemicalApplicationLogs());
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [draggingEmployeeId, setDraggingEmployeeId] = useState<string | null>(null);
  const [dropTargetEmployeeId, setDropTargetEmployeeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');
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

  useEffect(() => {
    const handleOperationsContext = (event: Event) => {
      const detail = (event as CustomEvent<{ department?: string; date?: string }>).detail;
      if (detail?.department) setDepartment(detail.department);
      if (detail?.date) setBoardDate(detail.date);
    };

    const storedEmployees = loadEmployees();
    const storedSchedules = loadScheduleEntries();
    const storedTasks = loadTasks()
      .filter((task) => task.status === 'active')
      .sort((left, right) => (left.priority ?? 999) - (right.priority ?? 999) || left.name.localeCompare(right.name));
    setEmployeeList(storedEmployees);
    setTaskList(storedTasks);
    setAssignmentList(loadAssignments());
    setApplicationAreas(loadApplicationAreas());
    setNoteList(loadNotes());
    setScheduleList(storedSchedules);
    setEquipmentList(loadEquipmentUnits());
    setWeatherLogs(loadWeatherDailyLogs());
    setWeatherLocations(loadWeatherLocations());
    setWorkLocations(loadWorkLocations());
    setApplicationLogs(loadChemicalApplicationLogs());
    const firstScheduled =
      storedSchedules.find((entry) => entry.date === boardDate && entry.status === 'scheduled')?.employeeId ??
      storedEmployees.find((employee) => employee.status === 'active')?.id ??
      '';
    setSelectedEmployeeId(firstScheduled);
    setAssignmentDraft((current) => ({ ...current, employeeId: firstScheduled, taskId: storedTasks[0]?.id ?? '' }));
    window.addEventListener('operations-context-updated', handleOperationsContext as EventListener);
    return () => window.removeEventListener('operations-context-updated', handleOperationsContext as EventListener);
  }, [boardDate]);

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
          (!department || department === 'All Departments' || employee.department === department) &&
          (groupFilter === 'all' || employee.group === groupFilter),
      ),
    [allActiveEmployees, department, groupFilter],
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

  function persistAssignments(nextAssignments: Assignment[]) {
    setAssignmentList(nextAssignments);
    saveAssignments(nextAssignments);
  }

  function persistNotes(nextNotes: Note[]) {
    setNoteList(nextNotes);
    saveNotes(nextNotes);
  }

  function openAssignmentDialog(employeeId: string) {
    const defaultLocation = workLocations[0]?.name ?? 'Primary zone';
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

  function saveAssignment() {
    if (!assignmentDraft.employeeId || !assignmentDraft.taskId) return;

    const nextAssignment: Assignment = {
      id: editingAssignmentId ?? makeId('assign'),
      employeeId: assignmentDraft.employeeId,
      taskId: assignmentDraft.taskId,
      equipmentId: assignmentDraft.equipmentId || undefined,
      date: boardDate,
      area: assignmentDraft.area,
      startTime: assignmentDraft.startTime,
      duration: Number(assignmentDraft.duration || 0),
    };

    const nextAssignments = editingAssignmentId
      ? assignmentList.map((assignment) => (assignment.id === editingAssignmentId ? nextAssignment : assignment))
      : [...assignmentList, nextAssignment];
    persistAssignments(nextAssignments);
    setEditingAssignmentId(null);
    setAssignmentDialogOpen(false);
    toast(editingAssignmentId ? 'Assignment updated' : 'Assignment added', {
      description: editingAssignmentId
        ? 'The workflow board, breakroom, and reports now reflect the updated task plan.'
        : 'The workflow board, breakroom, and reports now reflect this planned task.',
    });
  }

  function removeAssignment(assignmentId: string) {
    const nextAssignments = assignmentList.filter((assignment) => assignment.id !== assignmentId);
    persistAssignments(nextAssignments);
  }

  function saveNote() {
    if (!noteDraft.title.trim() || !noteDraft.content.trim()) return;
    const nextNotes = [
      {
        id: `n${Date.now()}`,
        type: noteDraft.type,
        title: noteDraft.title.trim(),
        content: noteDraft.content.trim(),
        author: noteDraft.author.trim() || 'Operations Admin',
        date: boardDate,
        location: noteDraft.location.trim() || undefined,
      },
      ...noteList,
    ];
    persistNotes(nextNotes);
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
          title="Workflow"
          subtitle="Pull the scheduled crew for the selected day, assign tasks from Task Management, and send the finished plan straight to the breakroom screen."
          badge={<Badge variant="secondary">{department} / {boardDate}</Badge>}
          action={{ label: 'Add Assignment', onClick: () => openAssignmentDialog(selectedEmployeeId || fallbackEligibleEmployees[0]?.id || '') }}
        >
          <Badge variant="outline" className="h-7 px-3 text-xs">
            Scheduled Crew Only
          </Badge>
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
            <p className="text-xs text-muted-foreground mt-1">Assignments pull from Task Management and Program Setup locations, while employee rows inherit role, department, group, and worker type from Employee Management.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="outline">{taskList.length} active tasks</Badge>
              <Badge variant="outline">{workLocations.length} locations</Badge>
              <Badge variant="outline">{activeDepartmentEmployees.length} active employees</Badge>
            </div>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <Badge variant="outline">{orderedDispatchBoard.length} scheduled crew</Badge>
          <Badge variant="outline">{assignedEmployeeIds.size} with tasks</Badge>
          <Badge variant="outline">{Math.max(orderedDispatchBoard.length - assignedEmployeeIds.size, 0)} waiting assignment</Badge>
          <Badge variant="outline">{dayAssignments.length} task rows</Badge>
          <Badge variant="outline">{totalOpenMinutes} open mins</Badge>
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
              {workLocations.length > 0 ? (
                <select
                  value={assignmentDraft.area}
                  onChange={(event) => setAssignmentDraft({ ...assignmentDraft, area: event.target.value })}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {workLocations.map((location) => (
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
              {workLocations.length > 0 ? (
                <select
                  value={noteDraft.location}
                  onChange={(event) => setNoteDraft({ ...noteDraft, location: event.target.value })}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">General board note</option>
                  {workLocations.map((location) => (
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
