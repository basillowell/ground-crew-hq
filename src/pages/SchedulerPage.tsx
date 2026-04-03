import { useEffect, useMemo, useState } from 'react';
import type { Employee, ScheduleEntry } from '@/data/seedData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Copy, Download, Search, Filter, CalendarDays, CloudSun, FlaskConical } from 'lucide-react';
import { ScheduleTemplates } from '@/components/scheduler/ScheduleTemplates';
import { Input } from '@/components/ui/input';
import { WeatherSnapshotCard } from '@/components/weather/WeatherSnapshotCard';
import { type ApplicationArea, type ChemicalApplicationLog, type WeatherDailyLog, type WeatherLocation } from '@/data/seedData';
import { DATA_STORE_UPDATED_EVENT, loadApplicationAreas, loadChemicalApplicationLogs, loadEmployees, loadScheduleEntries, loadWeatherDailyLogs, loadWeatherLocations, saveScheduleEntries } from '@/lib/dataStore';
import { exportScheduleEntriesAsICS } from '@/lib/integrations';
import { toast } from '@/components/ui/sonner';

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

function buildWeekDays(anchorDate: Date) {
  const start = startOfWeek(anchorDate);
  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(start);
    next.setDate(start.getDate() + index);
    return {
      label: next.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'numeric',
        day: 'numeric',
      }),
      date: toDateKey(next),
    };
  });
}

const statusColors: Record<string, string> = {
  scheduled: 'bg-primary/10 border-primary/30 text-primary',
  'day-off': 'bg-muted border-border text-muted-foreground',
  vacation: 'bg-info/10 border-info/30 text-info',
  sick: 'bg-destructive/10 border-destructive/30 text-destructive',
};

export default function SchedulerPage() {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [propertyId, setPropertyId] = useState('');
  const [employeeList, setEmployeeList] = useState<Employee[]>([]);
  const [scheduleList, setScheduleList] = useState<ScheduleEntry[]>([]);
  const [applicationAreas, setApplicationAreas] = useState<ApplicationArea[]>([]);
  const [search, setSearch] = useState('');
  const [weatherLogs, setWeatherLogs] = useState<WeatherDailyLog[]>([]);
  const [weatherLocations, setWeatherLocations] = useState<WeatherLocation[]>([]);
  const [applicationLogs, setApplicationLogs] = useState<ChemicalApplicationLog[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const weekDays = useMemo(() => buildWeekDays(currentDate), [currentDate]);
  const [draft, setDraft] = useState({
    employeeId: '',
    date: toDateKey(startOfWeek(new Date())),
    shiftStart: '05:00',
    shiftEnd: '13:30',
    status: 'scheduled' as ScheduleEntry['status'],
  });

  useEffect(() => {
    const refresh = () => {
      const storedEmployees = loadEmployees();
      setEmployeeList(storedEmployees);
      setApplicationAreas(loadApplicationAreas());
      setScheduleList(loadScheduleEntries());
      setWeatherLogs(loadWeatherDailyLogs());
      setWeatherLocations(loadWeatherLocations());
      setApplicationLogs(loadChemicalApplicationLogs());
      setSelectedEmployeeId(storedEmployees.find((employee) => employee.status === 'active')?.id ?? '');
      setDraft((current) => ({
        ...current,
        employeeId: storedEmployees.find((employee) => employee.status === 'active')?.id ?? current.employeeId,
      }));
    };

    const handleOperationsContext = (event: Event) => {
      const detail = (event as CustomEvent<{ date?: string; propertyId?: string }>).detail;
      if (detail?.date) {
        setCurrentDate(new Date(`${detail.date}T12:00:00`));
      }
      if (detail?.propertyId !== undefined) {
        setPropertyId(detail.propertyId);
      }
    };

    refresh();
    window.addEventListener(DATA_STORE_UPDATED_EVENT, refresh as EventListener);
    window.addEventListener('operations-context-updated', handleOperationsContext as EventListener);
    return () => {
      window.removeEventListener(DATA_STORE_UPDATED_EVENT, refresh as EventListener);
      window.removeEventListener('operations-context-updated', handleOperationsContext as EventListener);
    };
  }, []);

  const activeEmployees = useMemo(
    () =>
      employeeList.filter(
        (employee) =>
          employee.status === 'active' &&
          (!propertyId || employee.propertyId === propertyId) &&
          `${employee.firstName} ${employee.lastName} ${employee.group}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [employeeList, propertyId, search],
  );

  const summary = useMemo(
    () => {
      const activeEmployeeIds = new Set(activeEmployees.map((employee) => employee.id));
      const weekEntries = scheduleList.filter(
        (entry) => activeEmployeeIds.has(entry.employeeId) && weekDays.some((day) => day.date === entry.date),
      );
      return {
        scheduledShifts: weekEntries.filter((entry) => entry.status === 'scheduled').length,
        dayOffs: weekEntries.filter((entry) => entry.status === 'day-off').length,
        coverage: new Set(weekEntries.filter((entry) => entry.status === 'scheduled').map((entry) => entry.employeeId)).size,
      };
    },
    [activeEmployees, scheduleList, weekDays],
  );

  const latestWeatherLog = useMemo(
    () => [...weatherLogs].sort((left, right) => right.date.localeCompare(left.date))[0],
    [weatherLogs],
  );

  const weatherLocation = latestWeatherLog
    ? weatherLocations.find((location) => location.id === latestWeatherLog.locationId) ?? weatherLocations[0]
    : weatherLocations[0];

  const weeklyApplications = useMemo(
    () => applicationLogs.filter((log) => weekDays.some((day) => day.date === log.applicationDate)),
    [applicationLogs, weekDays],
  );

  function persist(nextEntries: ScheduleEntry[]) {
    setScheduleList(nextEntries);
    saveScheduleEntries(nextEntries);
  }

  function openAddShift(employeeId?: string, date?: string) {
    const targetEmployeeId = employeeId ?? selectedEmployeeId ?? activeEmployees[0]?.id ?? '';
    setDraft({
      employeeId: targetEmployeeId,
      date: date ?? weekDays[0]?.date ?? toDateKey(currentDate),
      shiftStart: '05:00',
      shiftEnd: '13:30',
      status: 'scheduled',
    });
    setDialogOpen(true);
  }

  function handleSaveShift() {
    if (!draft.employeeId || !draft.date) return;

    const existing = scheduleList.find((entry) => entry.employeeId === draft.employeeId && entry.date === draft.date);
    let nextEntries: ScheduleEntry[];

    if (existing) {
      nextEntries = scheduleList.map((entry) =>
        entry.id === existing.id ? { ...entry, ...draft } : entry,
      );
    } else {
      nextEntries = [
        ...scheduleList,
        {
          id: `s${Date.now()}`,
          employeeId: draft.employeeId,
          date: draft.date,
          shiftStart: draft.shiftStart,
          shiftEnd: draft.shiftEnd,
          status: draft.status,
        },
      ];
    }

    persist(nextEntries);
    setDialogOpen(false);
  }

  function copyWeek() {
    const sourceDate = weekDays[0]?.date;
    if (!sourceDate) return;
    const nextEntries = [...scheduleList];

    for (const employee of activeEmployees) {
      const base = scheduleList.find((entry) => entry.employeeId === employee.id && entry.date === sourceDate);
      if (!base) continue;

      for (const date of weekDays.slice(1).map((day) => day.date)) {
        const exists = nextEntries.find((entry) => entry.employeeId === employee.id && entry.date === date);
        if (!exists) {
          nextEntries.push({ ...base, id: `s${Date.now()}-${employee.id}-${date}`, date });
        }
      }
    }

    persist(nextEntries);
  }

  function exportWeekToCalendar() {
    const targetEmployeeId = selectedEmployeeId || activeEmployees[0]?.id;
    const upcomingEntries = scheduleList
      .filter((entry) => entry.employeeId === targetEmployeeId && entry.date >= today && entry.status === 'scheduled')
      .sort((left, right) => left.date.localeCompare(right.date));

    const result = exportScheduleEntriesAsICS({
      filename: 'schedule.ics',
      scheduleEntries: upcomingEntries,
      employees: employeeList,
      title: 'Ground Crew HQ Schedule',
    });

    if (result.ok) {
      toast.success(`Calendar export ready`, {
        description: `${result.data?.eventCount ?? 0} upcoming shifts exported to ${result.data?.filename}.`,
      });
    } else {
      toast.error('Calendar export failed', {
        description: result.error,
      });
    }
  }

  return (
    <div className="p-4">
      <div className="grid gap-4 md:grid-cols-3 mb-4">
        <div className="rounded-3xl border bg-card/90 p-4 shadow-sm">
          <div className="text-sm text-muted-foreground mb-1">Scheduled shifts</div>
          <div className="text-3xl font-semibold">{summary.scheduledShifts}</div>
          <p className="text-xs text-muted-foreground mt-1">Persistent weekly coverage entries across your active roster.</p>
        </div>
        <div className="rounded-3xl border bg-card/90 p-4 shadow-sm">
          <div className="text-sm text-muted-foreground mb-1">Crew covered</div>
          <div className="text-3xl font-semibold">{summary.coverage}</div>
          <p className="text-xs text-muted-foreground mt-1">Employees ready to flow into Workboard assignment.</p>
        </div>
        <div className="rounded-3xl border bg-card/90 p-4 shadow-sm">
          <div className="text-sm text-muted-foreground mb-1">Day off entries</div>
          <div className="text-3xl font-semibold">{summary.dayOffs}</div>
          <p className="text-xs text-muted-foreground mt-1">Track off days, vacation, and exceptions in the same planner.</p>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr] mb-4">
        <div className="rounded-3xl border bg-card/90 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <CloudSun className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Weather Planning Snapshot</h3>
          </div>
          {weatherLocation && latestWeatherLog ? (
            <WeatherSnapshotCard location={weatherLocation} log={latestWeatherLog} compact />
          ) : (
            <p className="text-sm text-muted-foreground">No weather log is available for this planning window yet.</p>
          )}
        </div>
        <div className="rounded-3xl border bg-card/90 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <FlaskConical className="h-4 w-4 text-chart-orange" />
            <h3 className="text-sm font-semibold">Application Conflicts and Cues</h3>
          </div>
          <div className="space-y-3">
            <div className="rounded-2xl bg-muted/50 p-3">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Applications this week</div>
              <div className="mt-1 text-2xl font-semibold">{weeklyApplications.length}</div>
            </div>
            {weeklyApplications.slice(0, 2).map((log) => {
              const area = applicationAreas.find((entry) => entry.id === log.areaId);
              return (
                <div key={log.id} className="rounded-2xl border p-3">
                  <div className="text-sm font-medium">{area?.name ?? 'Unknown area'}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {log.applicationDate} · {log.startTime} - {log.endTime}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{log.agronomicPurpose}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mb-6">
        <ScheduleTemplates />
      </div>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Weekly Schedule</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Week of {weekDays[0]?.label} through {weekDays[6]?.label}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => openAddShift()}>
            <Plus className="h-3 w-3" /> Add Shift
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={copyWeek}>
            <Copy className="h-3 w-3" /> Copy Week
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={exportWeekToCalendar}>
            <Download className="h-3 w-3" /> Export to Calendar
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => window.print()}>
            <Download className="h-3 w-3" /> Export PDF
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1"><Filter className="h-3 w-3" /> Filter</Button>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={(event) => setSearch(event.target.value)} className="h-7 pl-7 w-36 text-xs" />
          </div>
        </div>
      </div>

      <Card className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium text-muted-foreground text-xs sticky left-0 bg-muted/50 min-w-[180px]">Employee</th>
              {weekDays.map((day) => (
                <th key={day.date} className="text-center p-3 font-medium text-muted-foreground text-xs min-w-[110px]">{day.label}</th>
              ))}
              <th className="text-center p-3 font-medium text-muted-foreground text-xs min-w-[80px]">Total</th>
            </tr>
          </thead>
          <tbody>
            {activeEmployees.map(emp => {
              let totalHours = 0;
              return (
                <tr key={emp.id} className="border-b hover:bg-muted/20">
                  <td className="p-3 sticky left-0 bg-card">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                        {emp.firstName[0]}{emp.lastName[0]}
                      </div>
                      <div>
                        <div className="font-medium text-xs">{emp.firstName} {emp.lastName}</div>
                        <div className="text-[10px] text-muted-foreground">{emp.group}</div>
                      </div>
                    </div>
                  </td>
                  {weekDays.map((day) => {
                    const entry = scheduleList.find((scheduleEntry) => scheduleEntry.employeeId === emp.id && scheduleEntry.date === day.date);
                    if (!entry) {
                      return (
                        <td key={day.date} className="p-2 text-center">
                          <button
                            type="button"
                            className="h-10 w-full rounded border border-dashed border-border text-[10px] text-muted-foreground"
                            onClick={() => openAddShift(emp.id, day.date)}
                          >
                            Add
                          </button>
                        </td>
                      );
                    }
                    if (entry.status === 'scheduled') {
                      const [startHour, startMinute] = entry.shiftStart.split(':').map(Number);
                      const [endHour, endMinute] = entry.shiftEnd.split(':').map(Number);
                      totalHours += (endHour * 60 + endMinute - (startHour * 60 + startMinute)) / 60;
                    }
                    return (
                      <td key={day.date} className="p-2">
                        <button
                          type="button"
                          className={`w-full rounded border px-2 py-1.5 text-center text-xs ${statusColors[entry.status] || statusColors.scheduled}`}
                          onClick={() => {
                            setDraft({
                              employeeId: emp.id,
                              date: day.date,
                              shiftStart: entry.shiftStart,
                              shiftEnd: entry.shiftEnd,
                              status: entry.status,
                            });
                            setDialogOpen(true);
                          }}
                        >
                          {entry.status === 'scheduled' ? (
                            <div className="font-medium">{entry.shiftStart} - {entry.shiftEnd}</div>
                          ) : (
                            <div className="capitalize font-medium">{entry.status.replace('-', ' ')}</div>
                          )}
                        </button>
                      </td>
                    );
                  })}
                  <td className="p-3 text-center font-mono text-xs font-medium">{totalHours.toFixed(1)}h</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              Add or Edit Shift
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Employee</label>
              <select
                value={draft.employeeId}
                onChange={(event) => setDraft({ ...draft, employeeId: event.target.value })}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {activeEmployees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.firstName} {employee.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Date</label>
              <select
                value={draft.date}
                onChange={(event) => setDraft({ ...draft, date: event.target.value })}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {weekDays.map((day) => (
                  <option key={day.date} value={day.date}>
                    {day.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <select
                value={draft.status}
                onChange={(event) => setDraft({ ...draft, status: event.target.value as ScheduleEntry['status'] })}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="scheduled">Scheduled</option>
                <option value="day-off">Day off</option>
                <option value="vacation">Vacation</option>
                <option value="sick">Sick</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Shift Start</label>
              <Input type="time" value={draft.shiftStart} onChange={(event) => setDraft({ ...draft, shiftStart: event.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Shift End</label>
              <Input type="time" value={draft.shiftEnd} onChange={(event) => setDraft({ ...draft, shiftEnd: event.target.value })} className="mt-1" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveShift}>Save Shift</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
