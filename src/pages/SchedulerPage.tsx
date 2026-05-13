import { useEffect, useMemo, useState } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ScheduleEntry } from '@/data/seedData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Copy, Download, Search, CalendarDays, ChevronLeft, ChevronRight, Users, CheckCircle2, Coffee, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployees } from '@/lib/supabase-queries';
import { supabase } from '@/lib/supabase';
import { exportScheduleEntriesAsICS } from '@/lib/integrations';

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getWeekStart(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function buildWeekDays(weekStartDate: string) {
  const start = new Date(`${weekStartDate}T00:00:00`);
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
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60);
}

function formatShiftTime(value: string): string {
  if (!value) return '';
  const [hourRaw, minuteRaw] = value.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw ?? '0');
  const period = hour >= 12 ? 'pm' : 'am';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, '0')}${period}`;
}

const STATUS_STYLES: Record<string, { cell: string; label: string }> = {
  scheduled: { cell: 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/35 dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-950/50', label: 'Scheduled' },
  'day-off': { cell: 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/35 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-950/50', label: 'Day Off' },
  vacation: { cell: 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:border-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950/50', label: 'Vacation' },
  sick: { cell: 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/50', label: 'Sick' },
};

export default function SchedulerPage() {
  const queryClient = useQueryClient();
  const { currentPropertyId, currentUser } = useAuth();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const weekDays = useMemo(() => buildWeekDays(weekStart), [weekStart]);
  const today = useMemo(() => toDateKey(new Date()), []);
  const thisWeekStart = useMemo(() => getWeekStart(new Date()), []);

  const propertyScope = currentPropertyId === 'all' ? 'all' : currentPropertyId || undefined;
  const employeesQuery = useEmployees(propertyScope, currentUser?.orgId);
  const [schedulerDefaults, setSchedulerDefaults] = useState({ start: '05:00', end: '13:30' });
  const [shiftTemplates, setShiftTemplates] = useState<Array<{ id: string; name: string; start: string; end: string; days: string[]; active: boolean }>>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

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
          notes: typeof row.notes === 'string' ? row.notes : null,
        })) as (ScheduleEntry & { notes?: string | null })[];
      },
      staleTime: 1000 * 60 * 5,
    })),
  });

  const employeeList = employeesQuery.data ?? [];
  const scheduleList = useMemo(() => weekScheduleQueries.flatMap((q) => q.data ?? []), [weekScheduleQueries]);
  const isLoading = employeesQuery.isLoading || weekScheduleQueries.some((q) => q.isLoading);
  const queryErrorMessage =
    (employeesQuery.error as { message?: string } | null)?.message ||
    (weekScheduleQueries.find((query) => query.error)?.error as { message?: string } | null)?.message ||
    '';

  const [draft, setDraft] = useState({
    employeeId: '',
    date: weekStart,
    shiftStart: schedulerDefaults.start,
    shiftEnd: schedulerDefaults.end,
    status: 'scheduled' as ScheduleEntry['status'],
    notes: '',
  });

  useEffect(() => {
    const fetchSchedulerData = async () => {
      if (!supabase || !currentUser?.orgId) return;

      const [settingsResult, templatesResult] = await Promise.all([
        supabase
          .from('scheduler_settings')
          .select('default_shift_start, default_shift_end')
          .eq('org_id', currentUser.orgId)
          .single(),
        supabase
          .from('shift_templates')
          .select('id, name, start, end, days, active')
          .eq('org_id', currentUser.orgId)
          .eq('active', true)
          .order('name', { ascending: true }),
      ]);

      if (settingsResult.data) {
        setSchedulerDefaults({
          start: settingsResult.data.default_shift_start?.slice(0, 5) ?? '05:00',
          end: settingsResult.data.default_shift_end?.slice(0, 5) ?? '13:30',
        });
      }

      if (templatesResult.data) {
        setShiftTemplates(
          templatesResult.data.map((template) => ({
            id: String(template.id),
            name: String(template.name ?? ''),
            start: String(template.start ?? ''),
            end: String(template.end ?? ''),
            days: Array.isArray(template.days) ? (template.days as string[]) : [],
            active: Boolean(template.active),
          })),
        );
      }
    };

    void fetchSchedulerData();
  }, [currentUser?.orgId]);

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
    const scheduledHours = entries
      .filter((e) => e.status === 'scheduled')
      .reduce((sum, entry) => sum + shiftHours(entry.shiftStart, entry.shiftEnd), 0);
    return {
      scheduled: entries.filter((e) => e.status === 'scheduled').length,
      dayOff: entries.filter((e) => e.status !== 'scheduled').length,
      coverage: new Set(entries.filter((e) => e.status === 'scheduled').map((e) => e.employeeId)).size,
      scheduledHours,
    };
  }, [activeEmployees, scheduleList, weekDays]);

  function openAddShift(employeeId?: string, date?: string) {
    const targetEmp = employeeId ?? activeEmployees[0]?.id ?? '';
    setDraft({
      employeeId: targetEmp,
      date: date ?? weekDays[0]?.date ?? weekStart,
      shiftStart: schedulerDefaults.start,
      shiftEnd: schedulerDefaults.end,
      status: 'scheduled',
      notes: '',
    });
    setSelectedTemplateId('');
    setDialogOpen(true);
  }

  function openEditShift(employeeId: string, day: { date: string }, entry: ScheduleEntry) {
    const ext = entry as ScheduleEntry & { notes?: string | null };
    setDraft({
      employeeId,
      date: day.date,
      shiftStart: entry.shiftStart,
      shiftEnd: entry.shiftEnd,
      status: entry.status,
      notes: ext.notes ?? '',
    });
    setSelectedTemplateId('');
    setDialogOpen(true);
  }

  function handleCloseModal() {
    setDialogOpen(false);
    setSelectedTemplateId('');
    setDraft((cur) => ({
      ...cur,
      shiftStart: schedulerDefaults.start,
      shiftEnd: schedulerDefaults.end,
      notes: '',
    }));
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
    if (draft.status === 'scheduled') {
      const startMinutes = draft.shiftStart ? Number(draft.shiftStart.slice(0, 2)) * 60 + Number(draft.shiftStart.slice(3, 5)) : 0;
      const endMinutes = draft.shiftEnd ? Number(draft.shiftEnd.slice(0, 2)) * 60 + Number(draft.shiftEnd.slice(3, 5)) : 0;
      if (!draft.shiftStart || !draft.shiftEnd || endMinutes <= startMinutes) {
        toast.error('Shift end must be after shift start.');
        return;
      }
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
      shift_start: draft.status === 'scheduled' ? draft.shiftStart : '00:00',
      shift_end: draft.status === 'scheduled' ? draft.shiftEnd : '00:00',
      status: draft.status,
      is_day_off: draft.status !== 'scheduled',
      notes: draft.notes.trim() || null,
    };
    if (propertyId) payload.property_id = propertyId;
    if (currentUser?.orgId) payload.org_id = currentUser.orgId;

    let response = existing
      ? await supabase
          .from('schedule_entries')
          .update(payload)
          .eq('id', existing.id)
          .eq('org_id', currentUser?.orgId ?? '')
      : await supabase.from('schedule_entries').insert(payload);

    if (response.error && /column/i.test(response.error.message)) {
      const legacyPayload = { ...payload };
      delete legacyPayload.is_day_off;
      delete legacyPayload.notes;
      response = existing
        ? await supabase
            .from('schedule_entries')
            .update(legacyPayload)
            .eq('id', existing.id)
            .eq('org_id', currentUser?.orgId ?? '')
        : await supabase.from('schedule_entries').insert(legacyPayload);
    }

    setIsSaving(false);

    if (response.error) {
      toast.error('Shift save failed', { description: response.error.message });
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ['schedule-entries'] });
    handleCloseModal();
    toast.success(existing ? 'Shift updated' : 'Shift added');
  }

  async function handleDeleteShift() {
    if (!supabase) return;
    const existing = scheduleList.find((e) => e.employeeId === draft.employeeId && e.date === draft.date);
    if (!existing) { handleCloseModal(); return; }
    const { error } = await supabase
      .from('schedule_entries')
      .delete()
      .eq('id', existing.id)
      .eq('org_id', currentUser?.orgId ?? '');
    if (error) { toast.error('Delete failed', { description: error.message }); return; }
    await queryClient.invalidateQueries({ queryKey: ['schedule-entries'] });
    handleCloseModal();
    toast.success('Shift removed');
  }

  async function copyWeek() {
    if (!supabase) { toast.error('Database not available.'); return; }
    const weekStartDate = weekDays[0]?.date;
    const weekEndDate = weekDays[6]?.date;
    if (!weekStartDate || !weekEndDate) return;
    const source = new Date(`${weekStartDate}T00:00:00`);
    const target = new Date(source);
    target.setDate(target.getDate() + 7);
    const confirmed = window.confirm(
      `Copy week of ${source.toLocaleDateString()} to ${target.toLocaleDateString()}?`,
    );
    if (!confirmed) return;

    const weekEntries = scheduleList.filter((entry) => entry.date >= weekStartDate && entry.date <= weekEndDate);
    if (weekEntries.length === 0) {
      toast.message('Nothing to copy', { description: 'No entries found in the current week.' });
      return;
    }

    const inserts: Record<string, unknown>[] = [];
    for (const entry of weekEntries) {
      const copiedDate = new Date(`${entry.date}T00:00:00`);
      copiedDate.setDate(copiedDate.getDate() + 7);
      const employee = employeeList.find((person) => person.id === entry.employeeId);
      const row: Record<string, unknown> = {
        employee_id: entry.employeeId,
        date: toDateKey(copiedDate),
        shift_start: entry.shiftStart,
        shift_end: entry.shiftEnd,
        status: entry.status,
        notes: (entry as ScheduleEntry & { notes?: string | null }).notes ?? null,
      };
      if (employee?.propertyId) row.property_id = employee.propertyId;
      if (currentUser?.orgId) row.org_id = currentUser.orgId;
      inserts.push(row);
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
    setWeekStart((prev) => {
      const next = new Date(`${prev}T00:00:00`);
      next.setDate(next.getDate() + direction * 7);
      return getWeekStart(next);
    });
  }

  const isEditing = !!scheduleList.find((e) => e.employeeId === draft.employeeId && e.date === draft.date);
  const dailyTotals = useMemo(() => {
    return weekDays.map((day) => {
      const dayEntries = scheduleList.filter((entry) => entry.date === day.date);
      const totalHours = scheduleList
        .filter((entry) => entry.date === day.date && entry.status === 'scheduled')
        .reduce((sum, entry) => sum + shiftHours(entry.shiftStart, entry.shiftEnd), 0);
      const shiftCount = dayEntries.filter((entry) => entry.status === 'scheduled').length;
      return { date: day.date, totalHours, shiftCount };
    });
  }, [scheduleList, weekDays]);
  const weeklyShiftTotal = useMemo(
    () => dailyTotals.reduce((sum, day) => sum + day.shiftCount, 0),
    [dailyTotals],
  );
  const weeklyTotalHours = useMemo(
    () => dailyTotals.reduce((sum, day) => sum + day.totalHours, 0),
    [dailyTotals],
  );

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
          {weekStart !== thisWeekStart ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs ml-1"
              onClick={() => setWeekStart(thisWeekStart)}
            >
              Today
            </Button>
          ) : null}
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
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          <span><span className="font-semibold text-foreground">{summary.scheduledHours.toFixed(1)}h</span> scheduled hours</span>
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
            <div className="rounded-xl border border-dashed bg-muted/25 px-4 py-3 text-xs text-muted-foreground">
              Loading weekly schedule and crew coverage...
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl border bg-muted/50" />
            ))}
          </div>
        ) : queryErrorMessage ? (
          <div className="p-4">
            <div className="mx-auto max-w-xl rounded-xl border border-dashed p-5 text-center">
              <p className="text-sm font-medium text-foreground">Scheduler data is temporarily unavailable.</p>
              <p className="mt-1 text-xs text-muted-foreground">{queryErrorMessage}</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => {
                  void employeesQuery.refetch();
                  weekScheduleQueries.forEach((query) => {
                    void query.refetch();
                  });
                }}
              >
                Retry
              </Button>
            </div>
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
                  <th className="text-center px-3 py-3 font-medium text-muted-foreground text-xs min-w-[80px]">Weekly Total</th>
                </tr>
              </thead>
              <tbody>
                {activeEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10">
                      <div className="mx-auto max-w-lg rounded-2xl border border-dashed bg-muted/20 px-5 py-6 text-center text-sm text-muted-foreground space-y-3">
                        <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-background border">
                          <AlertTriangle className="h-4 w-4" />
                        </div>
                        <p className="font-medium text-foreground">
                          {search ? `No crew matches "${search}"` : 'No active crew members found.'}
                        </p>
                        <p className="text-xs">
                          {search ? 'Try a different search term or clear filters.' : 'Add employees or activate crew members to begin weekly scheduling.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  activeEmployees.map((emp) => {
                    let weekHours = 0;
                    let weekDaysScheduled = 0;
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
                            weekDaysScheduled += 1;
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
                          const entryNotes = (entry as ScheduleEntry & { notes?: string | null }).notes;
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
                                    <div className="font-semibold text-[11px] text-emerald-700 dark:text-emerald-300">
                                      {formatShiftTime(entry.shiftStart)} - {formatShiftTime(entry.shiftEnd)}
                                    </div>
                                    <Badge
                                      variant="outline"
                                      className="mt-1 h-5 border-emerald-300 bg-emerald-100 px-1.5 text-[9px] uppercase tracking-wide text-emerald-700"
                                    >
                                      Scheduled
                                    </Badge>
                                    {entryNotes ? <div className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">{entryNotes}</div> : null}
                                  </>
                                ) : entry.status === 'day-off' ? (
                                  <>
                                    <div className="font-semibold text-[11px] text-amber-700 dark:text-amber-300">DAY OFF</div>
                                    <Badge
                                      variant="outline"
                                      className="mt-1 h-5 border-amber-300 bg-amber-100 px-1.5 text-[9px] uppercase tracking-wide text-amber-700"
                                    >
                                      Day Off
                                    </Badge>
                                  </>
                                ) : (
                                  <>
                                    <div className="font-medium capitalize">{style.label}</div>
                                    <Badge variant="outline" className="mt-1 h-5 px-1.5 text-[9px] uppercase tracking-wide">
                                      {style.label}
                                    </Badge>
                                  </>
                                )}
                              </button>
                            </td>
                          );
                        })}

                        {/* Weekly total */}
                        <td className="px-3 py-2 text-center">
                          <div className="space-y-0.5">
                            <div className="text-[11px] font-semibold text-foreground">{weekDaysScheduled} days</div>
                            <span className={`font-mono text-xs font-semibold ${weekHours >= 40 ? 'text-emerald-700 dark:text-emerald-300' : weekHours > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {weekHours > 0 ? `${weekHours.toFixed(1)}h` : '—'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/20">
                  <td className="px-4 py-2.5 text-xs font-semibold text-muted-foreground sticky left-0 bg-muted/20 z-10">
                    Day Summary
                  </td>
                  {dailyTotals.map((day) => (
                    <td key={day.date} className="px-2 py-2 text-center">
                      <div className="space-y-0.5">
                        <div className="text-[11px] font-semibold text-foreground">{day.shiftCount} shifts</div>
                        <span className={`font-mono text-xs font-semibold ${day.totalHours >= 24 ? 'text-amber-700 dark:text-amber-300' : 'text-foreground'}`}>
                          {day.totalHours > 0 ? `${day.totalHours.toFixed(1)}h` : '0.0h'}
                        </span>
                      </div>
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center">
                    <div className="space-y-0.5">
                      <div className="text-[11px] font-semibold text-foreground">{weeklyShiftTotal} shifts total</div>
                      <span className="font-mono text-xs font-semibold text-primary">
                        {weeklyTotalHours.toFixed(1)}h total
                      </span>
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </Card>
        )}
      </div>

      {/* ── Add / Edit Shift dialog ── */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (open) {
            setDialogOpen(true);
            return;
          }
          handleCloseModal();
        }}
      >
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
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground">Use template (optional)</label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setSelectedTemplateId(nextId);
                      const template = shiftTemplates.find((item) => item.id === nextId);
                      if (template) {
                        setDraft((current) => ({
                          ...current,
                          shiftStart: template.start.slice(0, 5),
                          shiftEnd: template.end.slice(0, 5),
                        }));
                      }
                    }}
                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Select a template (optional)</option>
                    {shiftTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} ({template.start.slice(0, 5)}–{template.end.slice(0, 5)})
                      </option>
                    ))}
                  </select>
                </div>
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
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Notes</label>
              <Textarea
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                placeholder="Optional shift note"
                className="mt-1 min-h-20 resize-y"
                data-testid="input-shift-notes"
              />
            </div>
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
              <Button variant="outline" onClick={handleCloseModal}>Cancel</Button>
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
