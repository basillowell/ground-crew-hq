import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared';
import { EmployeeRow } from '@/components/workboard/EmployeeRow';
import { NotesPanel } from '@/components/workboard/NotesPanel';
import { TurfPanel } from '@/components/workboard/TurfPanel';
import { WeatherSnapshotCard } from '@/components/weather/WeatherSnapshotCard';
import { turfData, type ApplicationArea, type Assignment, type Employee, type EquipmentUnit, type Note, type ScheduleEntry, type Task, type WeatherDailyLog, type WeatherLocation } from '@/data/seedData';
import { StickyNote, Droplets, ClipboardList, CloudSun } from 'lucide-react';
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
  saveAssignments,
  saveNotes,
} from '@/lib/dataStore';

export default function WorkboardPage() {
  const boardDate = '2024-03-25';
  const [employeeList, setEmployeeList] = useState<Employee[]>([]);
  const [taskList, setTaskList] = useState<Task[]>([]);
  const [assignmentList, setAssignmentList] = useState<Assignment[]>([]);
  const [applicationAreas, setApplicationAreas] = useState<ApplicationArea[]>([]);
  const [noteList, setNoteList] = useState<Note[]>([]);
  const [scheduleList, setScheduleList] = useState<ScheduleEntry[]>([]);
  const [equipmentList, setEquipmentList] = useState<EquipmentUnit[]>([]);
  const [weatherLogs, setWeatherLogs] = useState<WeatherDailyLog[]>([]);
  const [weatherLocations, setWeatherLocations] = useState<WeatherLocation[]>([]);
  const [applicationLogs, setApplicationLogs] = useState(loadChemicalApplicationLogs());
  const [view, setView] = useState<'employee' | 'task'>('employee');
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
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
    setApplicationLogs(loadChemicalApplicationLogs());
    const firstScheduled =
      storedSchedules.find((entry) => entry.date === boardDate && entry.status === 'scheduled')?.employeeId ??
      storedEmployees.find((employee) => employee.status === 'active')?.id ??
      '';
    setSelectedEmployeeId(firstScheduled);
    setAssignmentDraft((current) => ({ ...current, employeeId: firstScheduled, taskId: storedTasks[0]?.id ?? '' }));
  }, [boardDate]);

  const scheduledEmployees = useMemo(() => {
    const scheduledIds = new Set(
      scheduleList
        .filter((entry) => entry.date === boardDate && entry.status === 'scheduled')
        .map((entry) => entry.employeeId),
    );
    return employeeList.filter((employee) => employee.status === 'active' && scheduledIds.has(employee.id));
  }, [boardDate, employeeList, scheduleList]);

  const dayAssignments = useMemo(
    () => assignmentList.filter((assignment) => assignment.date === boardDate),
    [assignmentList, boardDate],
  );

  const taskView = useMemo(() => {
    return taskList
      .map((task) => ({
        task,
        assignees: dayAssignments.filter((assignment) => assignment.taskId === task.id),
      }))
      .filter((entry) => entry.assignees.length > 0);
  }, [dayAssignments, taskList]);

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
    setSelectedEmployeeId(employeeId);
    setAssignmentDraft({
      employeeId,
      taskId: taskList[0]?.id ?? '',
      equipmentId: '',
      area: 'Primary zone',
      startTime: '05:30',
      duration: '60',
    });
    setAssignmentDialogOpen(true);
  }

  function saveAssignment() {
    if (!assignmentDraft.employeeId || !assignmentDraft.taskId) return;

    const nextAssignments = [
      ...assignmentList,
      {
        id: `a${Date.now()}`,
        employeeId: assignmentDraft.employeeId,
        taskId: assignmentDraft.taskId,
        equipmentId: assignmentDraft.equipmentId || undefined,
        date: boardDate,
        area: assignmentDraft.area,
        startTime: assignmentDraft.startTime,
        duration: Number(assignmentDraft.duration || 0),
      },
    ];
    persistAssignments(nextAssignments);
    setAssignmentDialogOpen(false);
  }

  function removeAssignment(employeeId: string, assignmentIndex: number) {
    let seen = -1;
    const nextAssignments = assignmentList.filter((assignment) => {
      if (assignment.employeeId !== employeeId || assignment.date !== boardDate) return true;
      seen += 1;
      return seen !== assignmentIndex;
    });
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
        date: new Date().toISOString().slice(0, 10),
        location: noteDraft.location.trim() || undefined,
      },
      ...noteList,
    ];
    persistNotes(nextNotes);
    setNoteDialogOpen(false);
    setNoteDraft({ type: 'daily', title: '', content: '', author: 'Operations Admin', location: '' });
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Main workboard */}
      <div className="flex-1 p-4 overflow-auto">
        <PageHeader
          title="Workboard"
          badge={<Badge variant="secondary">{scheduledEmployees.length} scheduled on {boardDate}</Badge>}
          action={{ label: 'Add Assignment', onClick: () => openAssignmentDialog(selectedEmployeeId || scheduledEmployees[0]?.id || '') }}
        >
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
        </PageHeader>

        <div className="grid gap-4 md:grid-cols-3 mb-4">
          <div className="rounded-3xl border bg-card/90 p-4 shadow-sm">
            <div className="text-sm text-muted-foreground mb-1">Assignments</div>
            <div className="text-3xl font-semibold">{dayAssignments.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Persistent task rows tied to scheduled employees.</p>
          </div>
          <div className="rounded-3xl border bg-card/90 p-4 shadow-sm">
            <div className="text-sm text-muted-foreground mb-1">Task catalog</div>
            <div className="text-3xl font-semibold">{taskList.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Workboard pulls from the same task source used across operations.</p>
          </div>
          <div className="rounded-3xl border bg-card/90 p-4 shadow-sm">
            <div className="text-sm text-muted-foreground mb-1">Notes in play</div>
            <div className="text-3xl font-semibold">{noteList.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Daily, general, geo, and alert notes stay available on the rail.</p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr] mb-4">
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

        {view === 'employee' ? (
          <div className="space-y-2">
            {scheduledEmployees.map((employee) => (
              <EmployeeRow
                key={employee.id}
                employee={employee}
                assignments={dayAssignments.filter((assignment) => assignment.employeeId === employee.id)}
                tasks={taskList}
                onAddTask={openAssignmentDialog}
                onRemoveAssignment={(assignmentIndex) => removeAssignment(employee.id, assignmentIndex)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {taskView.map(({ task, assignees }) => (
              <div key={task.id} className="rounded-3xl border bg-card/90 p-4 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-lg">{task.icon}</div>
                  <div>
                    <div className="font-semibold">{task.name}</div>
                    <div className="text-xs text-muted-foreground">{task.category} · {assignees.length} assignments</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {assignees.map((assignment, index) => {
                    const employee = employeeList.find((entry) => entry.id === assignment.employeeId);
                    return (
                      <div key={`${assignment.employeeId}-${index}`} className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-xs">
                        <ClipboardList className="h-3 w-3 text-primary" />
                        <span>{employee ? `${employee.firstName} ${employee.lastName}` : assignment.employeeId}</span>
                        <span className="text-muted-foreground">{assignment.area}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
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
            <NotesPanel notes={noteList} onAddNote={() => setNoteDialogOpen(true)} />
          </TabsContent>
          <TabsContent value="turf">
            <TurfPanel data={turfData} />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={assignmentDialogOpen} onOpenChange={setAssignmentDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Workboard Assignment</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Employee</label>
              <select
                value={assignmentDraft.employeeId}
                onChange={(event) => setAssignmentDraft({ ...assignmentDraft, employeeId: event.target.value })}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {scheduledEmployees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.firstName} {employee.lastName}
                  </option>
                ))}
              </select>
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
              <Input value={assignmentDraft.area} onChange={(event) => setAssignmentDraft({ ...assignmentDraft, area: event.target.value })} className="mt-1" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAssignmentDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveAssignment}>Save Assignment</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Workboard Note</DialogTitle>
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
              <Input value={noteDraft.location} onChange={(event) => setNoteDraft({ ...noteDraft, location: event.target.value })} className="mt-1" />
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
