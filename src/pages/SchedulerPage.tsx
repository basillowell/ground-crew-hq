import { useEffect, useMemo, useState } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import type { ScheduleEntry } from '@/data/seedData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Copy, Download, Search, CalendarDays, ChevronLeft, ChevronRight, Users, CheckCircle2, Coffee } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useOperations } from '@/contexts/OperationsContext';
import { useEmployees } from '@/lib/supabase-queries';
import { supabase } from '@/lib/supabase';
import { exportScheduleEntriesAsICS } from '@/lib/integrations';

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
  return Array.from({ length: 7 }, (_, i) => {
    const next = new Date(start);
    next.setDate(start.getDate() + i);
    return {
      label: next.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' }),
      short: next.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNum: next.getDate(),
      date: toDateKey(next),
    };
  });
}

function shiftHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60);
}

const STATUS_STYLES: Record<string, { cell: string; label: string }> = {
  scheduled: { cell: 'bg-primary/10 border-primary/40 text-primary hover:bg-primary/20', label: 'Scheduled' },
  'day-off': { cell: 'bg-muted border-border text-muted-foreground hover:bg-muted/80', label: 'Day Off' },
  vacation: { cell: 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:border-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950/50', label: 'Vacation' },
  sick: { cell: 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/50', label: 'Sick' },
};

export default function SchedulerPage() {
  const queryClient = useQueryClient();
  const { currentPropertyId, currentUser } = useAuth();
  const { currentDate } = useOperations();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(currentDate));

  const weekDays = useMemo(() => buildWeekDays(weekAnchor), [weekAnchor]);
  const today = useMemo(() => toDateKey(new Date()), []);

  const propertyScope = currentPropertyId === 'all' ? 'all' : currentPropertyId || undefined;
  const employeesQuery = useEmployees(propertyScope, currentUser?.orgId);

  const weekScheduleQueries = useQueries({
    queries: weekDays.map((day) => ({
      queryKey: ['schedule-entries', day.date, propertyScope ?? 'all', currentUser?.orgId ?? 'all-orgs'],
      queryFn: async () => {
        if (!supabase) return [] as ScheduleEntry[];
        let query = supabase.from('schedule_entries').select('*').eq('date', day.date).order('shift_start');
        if (propertyScope && propertyScope !== 'all') query = query.eq('property_id', propertyScope);
        if (currentUser?.orgId) query = query.eq('org_id', currentUser.orgId);
        const { data, error } = await query;
        if (error) throw error;
        return (data ?? []).map((row) => ({
          id: String(row.id),
          employeeId: String(row.employee_id),
          date: String(row.date),
          shiftStart: String(row.shift_start ?? '').slice(0, 5),
          shiftEnd: String(row.shift_end ?? '').slice(0, 5),
          status: (row.status ?? 'scheduled') as ScheduleEntry['status'],
        }));
      },
      staleTime: 1000 * 60 * 5,
    })),
  });

  const employeeList = employeesQuery.data ?? [];
  const scheduleList = useMemo(() => weekScheduleQueries.flatMap((q) => q.data ?? []), [weekScheduleQueries]);
  const isLoading = employeesQuery.isLoading || weekScheduleQueries.some((q) => q.isLoading);

  const [draft, setDraft] = useState({
    employeeId: '',
    date: toDateKey(weekAnchor),
    shiftStart: '05:00',
    shiftEnd: '13:30',
    status: 'scheduled' as ScheduleEntry['status'],
  });

  useEffect(() => {
    const firstId = employeeList.find((e) => e.status === 'active')?.id ?? '';
    setDraft((cur) => ({
      ...cur,
      employeeId: cur.employeeId && employeeList.some((e) => e.id === cur.employeeId) ? cur.employeeId : firstId,
    }));
  }, [employeeList]);

  const activeEmployees = useMemo(
    () =>
      employeeList.filter(
        (e) =>
          e.status === 'active' &&
          (!propertyScope || propertyScope === 'all' || e.propertyId === propertyScope) &&
          `${e.firstName} ${e.lastName} ${e.group} ${e.department}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [employeeList, propertyScope, search],
  );

  const summary = useMemo(() => {
    const ids = new Set(activeEmployees.map((e) => e.id));
    const entries = scheduleList.filter((e) => ids.has(e.employeeId) && weekDays.some((d) => d.date === e.date));
    return {
      scheduled: entries.filter((e) => e.status === 'scheduled').length,
      dayOff: entries.filter((e) => e.status !== 'scheduled').length,
      coverage: new Set(entries.filter((e) => e.status === 'scheduled').map((e) => e.employeeId)).size,
    };
  }, [activeEmployees, scheduleList, weekDays]);

  function openAddShift(employeeId?: string, date?: string) {
    const targetEmp = employeeId ?? activeEmployees[0]?.id ?? '';
    setDraft({
      employeeId: targetEmp,
      date: date ?? weekDays[0]?.date ?? toDateKey(weekAnchor),
      shiftStart: '05:00',
      shiftEnd: '13:30',
      status: 'scheduled',
    });
    setDialogOpen(true);
  }

  function openEditShift(employeeId: string, day: { date: string }, entry: ScheduleEntry) {
    setDraft({
      employeeId,
      date: day.date,
      shiftStart: entry.shiftStart,
      shiftEnd: entry.shiftEnd,
      status: entry.status,
    });
    setDialogOpen(true);
  }

  async function handleSaveShift() {
    if (!draft.employeeId || !draft.date) {
      toast.error('Select an employee and date before saving.');
      return;
    }
    if (!supabase) {
      toast.error('Database connection not available.');
      return;
    }

    const employee = employeeList.find((e) => e.id === draft.employeeId);
    // Resolve propertyId — try employee first, then current filter, then user's property
    const propertyId =
      employee?.propertyId ||
      (propertyScope && propertyScope !== 'all' ? propertyScope : '') ||
      currentUser?.propertyId ||
      null;

    const existing = scheduleList.find(
      (e) => e.employeeId === draft.employeeId && e.date === draft.date,
    );

    setIsSaving(true);

    const payload: Record<string, unknown> = {
      employee_id: draft.employeeId,
      date: draft.date,
      shift_start: draft.shiftStart,
      shift_end: draft.shiftEnd,
      status: draft.status,
    };
    if (propertyId) payload.property_id = propertyId;
    if (currentUser?.orgId) payload.org_id = currentUser.orgId;

    const response = existing
      ? await supabase.from('schedule_entries').update(payload).eq('id', existing.id)
      : await supabase.from('schedule_entries').insert(payload);

    setIsSaving(false);

    if (response.error) {
      toast.error('Shift save failed', { description: response.error.message });
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ['schedule-entries'] });
    setDialogOpen(false);
    toast.success(existing ? 'Shift updated' : 'Shift added');
  }

  async function handleDeleteShift() {
    if (!supabase) return;
    const existing = scheduleList.find((e) => e.employeeId === draft.employeeId && e.date === draft.date);
    if (!existing) { setDialogOpen(false); return; }
    const { error } = await supabase.from('schedule_entries').delete().eq('id', existing.id);
    if (error) { toast.error('Delete failed', { description: error.message }); return; }
    await queryClient.invalidateQueries({ queryKey: ['schedule-entries'] });
    setDialogOpen(false);
    toast.success('Shift removed');
  }

  async function copyWeek() {
    if (!supabase) { toast.error('Database not available.'); return; }
    const sourceDate = weekDays[0]?.date;
    if (!sourceDate) return;
    const inserts: Record<string, unknown>[] = [];
    for (const emp of activeEmployees) {
      const base = scheduleList.find((e) => e.employeeId === emp.id && e.date === sourceDate);
      if (!base) continue;
      for (const day of weekDays.slice(1)) {
        const exists = scheduleList.find((e) => e.employeeId === emp.id && e.date === day.date);
        if (!exists) {
          const row: Record<string, unknown> = {
            employee_id: emp.id,
            date: day.date,
            shift_start: base.shiftStart,
            shift_end: base.shiftEnd,
            status: base.status,
          };
          if (emp.propertyId) row.property_id = emp.propertyId;
          if (currentUser?.orgId) row.org_id = currentUser.orgId;
          inserts.push(row);
        }
      }
    }
    if (inserts.length === 0) {
      toast.message('Nothing to copy', { description: 'All days already have entries.' });
      return;
    }
    const { error } = await supabase.from('schedule_entries').insert(inserts);
    if (error) { toast.error('Copy failed', { description: error.message }); return; }
    await queryClient.invalidateQueries({ queryKey: ['schedule-entries'] });
    toast.success('Week copied', { description: `${inserts.length} shifts added.` });
  }

  function exportWeekToCalendar() {
    const emp = activeEmployees[0];
    if (!emp) return;
    const entries = scheduleList.filter((e) => e.employeeId === emp.id && e.date >= today && e.status === 'scheduled');
    const result = exportScheduleEntriesAsICS({ filename: 'schedule.ics', scheduleEntries: entries, employees: employeeList, title: 'Ground Crew HQ Schedule' });
    if (result.ok) toast.success(`Calendar export ready`, { description: `${result.data?.eventCount ?? 0} shifts exported.` });
    else toast.error('Export failed', { description: result.error });
  }

  function shiftWeek(direction: -1 | 1) {
    setWeekAnchor((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + direction * 7);
      return next;
    });
  }

  const isEditing = !!scheduleList.find((e) => e.employeeId === draft.employeeId && e.date === draft.date);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">

      {/* ── Top bar ── */}
      <div className="border-b bg-card px-5 py-3 flex items-center gap-3 flex-wrap shrink-0">
        <h1 className="text-lg font-semibold tracking-tight flex-1 min-w-0">Scheduler</h1>

        {/* Week nav */}
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftWeek(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium px-2 whitespace-nowrap">
            {weekDays[0]?.label} – {weekDays[6]?.label}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftWeek(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs ml-1"
            onClick={() => setWeekAnchor(startOfWeek(new Date()))}
          >
            Today
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search crew..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-7 w-40 text-xs"
            data-testid="input-search-crew"
          />
        </div>

        <Button size="sm" className="h-8 gap-1.5" onClick={() => openAddShift()} data-testid="button-add-shift">
          <Plus className="h-3.5 w-3.5" /> Add Shift
        </Button>
        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={copyWeek} data-testid="button-copy-week">
          <Copy className="h-3.5 w-3.5" /> Copy Week
        </Button>
        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={exportWeekToCalendar}>
          <Download className="h-3.5 w-3.5" /> Export
        </Button>
      </div>

      {/* ── Stats strip ── */}
      <div className="border-b bg-muted/30 px-5 py-2 flex items-center gap-5 text-xs shrink-0 flex-wrap">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          <span><span className="font-semibold text-foreground">{summary.coverage}</span> crew covered this week</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span><span className="font-semibold text-foreground">{summary.scheduled}</span> scheduled shifts</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Coffee className="h-3.5 w-3.5" />
          <span><span className="font-semibold text-foreground">{summary.dayOff}</span> off/vacation/sick entries</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground ml-auto">
          <span className="text-[10px] uppercase tracking-wider">
            {activeEmployees.length} crew{search ? ' (filtered)' : ''}
          </span>
        </div>
      </div>

      {/* ── Weekly schedule grid ── */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-4 grid gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl border bg-muted/50" />
            ))}
          </div>
        ) : (
          <Card className="rounded-none border-0 border-b">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b bg-muted/40 sticky top-0 z-10">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs sticky left-0 bg-muted/40 min-w-[200px] z-20">
                    Crew Member
                  </th>
                  {weekDays.map((day) => {
                    const isToday = day.date === today;
                    return (
                      <th
                        key={day.date}
                        className={`text-center px-2 py-3 font-medium text-xs min-w-[110px] ${isToday ? 'text-primary' : 'text-muted-foreground'}`}
                      >
                        <div className={`text-[10px] uppercase tracking-wider ${isToday ? 'text-primary' : ''}`}>{day.short}</div>
                        <div className={`text-base font-bold mt-0.5 ${isToday ? 'text-primary' : 'text-foreground'}`}>{day.dayNum}</div>
                        {isToday && <div className="h-1 w-1 rounded-full bg-primary mx-auto mt-1" />}
                      </th>
                    );
                  })}
                  <th className="text-center px-3 py-3 font-medium text-muted-foreground text-xs min-w-[64px]">Total</th>
                </tr>
              </thead>
              <tbody>
                {activeEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      {search ? `No crew matches "${search}"` : 'No active crew members found.'}
                    </td>
                  </tr>
                ) : (
                  activeEmployees.map((emp) => {
                    let weekHours = 0;
                    return (
                      <tr key={emp.id} className="border-b hover:bg-muted/20 transition-colors group">
                        {/* Employee cell */}
                        <td className="px-4 py-2.5 sticky left-0 bg-card group-hover:bg-muted/20 transition-colors z-10">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                              {emp.firstName[0]}{emp.lastName[0]}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-xs truncate">{emp.firstName} {emp.lastName}</div>
                              <div className="text-[10px] text-muted-foreground truncate">{emp.group || emp.department}</div>
                            </div>
                          </div>
                        </td>

                        {/* Day cells */}
                        {weekDays.map((day) => {
                          const entry = scheduleList.find((s) => s.employeeId === emp.id && s.date === day.date);
                          const isToday = day.date === today;

                          if (entry?.status === 'scheduled') {
                            weekHours += shiftHours(entry.shiftStart, entry.shiftEnd);
                          }

                          if (!entry) {
                            return (
                              <td key={day.date} className={`px-2 py-2 text-center ${isToday ? 'bg-primary/5' : ''}`}>
                                <button
                                  type="button"
                                  className="h-11 w-full rounded-lg border border-dashed border-border text-[10px] text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-colors"
                                  onClick={() => openAddShift(emp.id, day.date)}
                                  data-testid={`button-add-shift-${emp.id}-${day.date}`}
                                >
                                  + Add
                                </button>
                              </td>
                            );
                          }

                          const style = STATUS_STYLES[entry.status] ?? STATUS_STYLES.scheduled;
                          return (
                            <td key={day.date} className={`px-2 py-2 ${isToday ? 'bg-primary/5' : ''}`}>
                              <button
                                type="button"
                                className={`w-full rounded-lg border px-2 py-1.5 text-center text-xs transition-colors ${style.cell}`}
                                onClick={() => openEditShift(emp.id, day, entry)}
                                data-testid={`button-edit-shift-${emp.id}-${day.date}`}
                              >
                                {entry.status === 'scheduled' ? (
                                  <>
                                    <div className="font-semibold text-[11px]">{entry.shiftStart}–{entry.shiftEnd}</div>
                                    <div className="text-[10px] opacity-70">{shiftHours(entry.shiftStart, entry.shiftEnd).toFixed(1)}h</div>
                                  </>
                                ) : (
                                  <div className="font-medium capitalize">{style.label}</div>
                                )}
                              </button>
                            </td>
                          );
                        })}

                        {/* Weekly total */}
                        <td className="px-3 py-2 text-center">
                          <span className={`font-mono text-xs font-semibold ${weekHours >= 40 ? 'text-primary' : weekHours > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {weekHours > 0 ? `${weekHours.toFixed(1)}h` : '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      {/* ── Add / Edit Shift dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              {isEditing ? 'Edit Shift' : 'Add Shift'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            {/* Employee */}
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Crew member</label>
              <select
                value={draft.employeeId}
                onChange={(e) => setDraft({ ...draft, employeeId: e.target.value })}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                data-testid="select-shift-employee"
              >
                {activeEmployees.length === 0 && <option value="">No active crew</option>}
                {activeEmployees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.firstName} {e.lastName} — {e.group || e.department}
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="text-xs text-muted-foreground">Date</label>
              <select
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                data-testid="select-shift-date"
              >
                {weekDays.map((day) => (
                  <option key={day.date} value={day.date}>{day.label}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <select
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value as ScheduleEntry['status'] })}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                data-testid="select-shift-status"
              >
                <option value="scheduled">Scheduled</option>
                <option value="day-off">Day Off</option>
                <option value="vacation">Vacation</option>
                <option value="sick">Sick</option>
              </select>
            </div>

            {/* Times — only show when scheduled */}
            {draft.status === 'scheduled' && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground">Shift start</label>
                  <Input
                    type="time"
                    value={draft.shiftStart}
                    onChange={(e) => setDraft({ ...draft, shiftStart: e.target.value })}
                    className="mt-1"
                    data-testid="input-shift-start"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Shift end</label>
                  <Input
                    type="time"
                    value={draft.shiftEnd}
                    onChange={(e) => setDraft({ ...draft, shiftEnd: e.target.value })}
                    className="mt-1"
                    data-testid="input-shift-end"
                  />
                </div>
                {draft.shiftStart && draft.shiftEnd && (
                  <div className="col-span-2">
                    <div className="rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                      Shift length: <span className="font-semibold text-foreground">{shiftHours(draft.shiftStart, draft.shiftEnd).toFixed(1)} hours</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            {isEditing ? (
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => void handleDeleteShift()}>
                Remove shift
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => void handleSaveShift()} disabled={isSaving} data-testid="button-save-shift">
                {isSaving ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Shift'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
