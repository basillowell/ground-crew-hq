import { useEffect, useMemo, useState } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ScheduleEntry } from '@/data/seedData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Copy, Download, Search, CalendarDays, ChevronLeft, ChevronRight, Users, CheckCircle2, Coffee, AlertTriangle, Cloud, CloudRain, Sun } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployees, useProperties } from '@/lib/supabase-queries';
import { supabase } from '@/lib/supabase';
import { exportScheduleEntriesAsICS } from '@/lib/integrations';
import { formatTime } from '@/utils/formatTime';
import { fetchOpenMeteoWeather } from '@/lib/openMeteo';
import { EmptyState } from '@/components/EmptyState';
import { TableSkeleton } from '@/components/TableSkeleton';

type WeekTemplateItem = {
  id: string;
  name: string;
  template_data: Array<{
    day: string;
    employee_id: string;
    shift_start: string;
    shift_end: string;
    property_id?: string | null;
    status?: string;
  }>;
};

type AssignmentSummary = {
  employeeId: string;
  date: string;
  title: string;
  estimatedHours: number;
};

type DayWeather = {
  temp: number;
  weatherCode: number;
};

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

function toCoveragePercent(assignedHours: number, scheduledHours: number): number {
  if (scheduledHours <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((assignedHours / scheduledHours) * 100)));
}

function weatherIconForCode(code: number) {
  if (code >= 51) return CloudRain;
  if (code >= 1) return Cloud;
  return Sun;
}

const STATUS_STYLES: Record<string, { cell: string; label: string }> = {
  scheduled: { cell: 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/35 dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-950/50', label: 'Scheduled' },
  'day-off': { cell: 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/35 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-950/50', label: 'Day Off' },
  vacation: { cell: 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:border-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950/50', label: 'Vacation' },
  sick: { cell: 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/50', label: 'Sick' },
};

export default function SchedulerPage() {
  const queryClient = useQueryClient();
  const { currentPropertyId, currentUser, userRole } = useAuth();
  const isReadOnly = String(userRole ?? '') === 'viewer';
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isShiftModalDirty, setIsShiftModalDirty] = useState(false);
  const [copyWeekDialogOpen, setCopyWeekDialogOpen] = useState(false);
  const [copyAssignmentsChecked, setCopyAssignmentsChecked] = useState(false);
  const [copyWeekSaving, setCopyWeekSaving] = useState(false);
  const [saveTemplateDialogOpen, setSaveTemplateDialogOpen] = useState(false);
  const [applyTemplateDialogOpen, setApplyTemplateDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [selectedWeekTemplateId, setSelectedWeekTemplateId] = useState('');
  const [templateActionSaving, setTemplateActionSaving] = useState(false);
  const [weekTemplates, setWeekTemplates] = useState<WeekTemplateItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const weekDays = useMemo(() => buildWeekDays(weekStart), [weekStart]);
  const [mobileDayIndex, setMobileDayIndex] = useState(0);
  const selectedMobileDay = weekDays[mobileDayIndex] ?? weekDays[0];
  const today = useMemo(() => toDateKey(new Date()), []);
  const thisWeekStart = useMemo(() => getWeekStart(new Date()), []);

  const propertyScope = currentPropertyId === 'all' ? 'all' : currentPropertyId || undefined;
  const employeesQuery = useEmployees(propertyScope, currentUser?.orgId);
  const propertiesQuery = useProperties(currentUser?.orgId);
  const [schedulerDefaults, setSchedulerDefaults] = useState({ start: '07:30', end: '16:00' });
  const [schedulerDefaultsLoading, setSchedulerDefaultsLoading] = useState(true);
  const [shiftTemplates, setShiftTemplates] = useState<Array<{ id: string; name: string; start: string; end: string; days: string[]; active: boolean }>>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [loadTimeoutReached, setLoadTimeoutReached] = useState(false);
  const [activeDetailCell, setActiveDetailCell] = useState<string | null>(null);

  const assignmentsWeekQuery = useQuery({
    queryKey: ['scheduler-week-assignments', weekStart, propertyScope ?? 'all', currentUser?.orgId ?? 'all-orgs'],
    enabled: Boolean(currentUser?.orgId),
    staleTime: 1000 * 60,
    queryFn: async () => {
      if (!supabase || !currentUser?.orgId) return [] as AssignmentSummary[];
      const weekStartDate = weekDays[0]?.date;
      const weekEndDate = weekDays[6]?.date;
      if (!weekStartDate || !weekEndDate) return [] as AssignmentSummary[];
      let query = supabase
        .from('assignments')
        .select('employee_id, date, title, estimated_hours, org_id, property_id')
        .eq('org_id', currentUser.orgId)
        .gte('date', weekStartDate)
        .lte('date', weekEndDate);
      if (propertyScope && propertyScope !== 'all') query = query.eq('property_id', propertyScope);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((row) => ({
        employeeId: String(row.employee_id ?? ''),
        date: String(row.date ?? ''),
        title: String(row.title ?? ''),
        estimatedHours: Number(row.estimated_hours ?? 0),
      }));
    },
  });

  const selectedProperty = useMemo(() => {
    const properties = propertiesQuery.data ?? [];
    if (propertyScope && propertyScope !== 'all') {
      return properties.find((property) => property.id === propertyScope) ?? null;
    }
    return properties.find((property) => typeof property.latitude === 'number' && typeof property.longitude === 'number') ?? null;
  }, [propertiesQuery.data, propertyScope]);

  const weekWeatherQuery = useQuery({
    queryKey: ['scheduler-week-weather', weekStart, selectedProperty?.id ?? 'none'],
    enabled: Boolean(selectedProperty?.latitude && selectedProperty?.longitude),
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      if (!selectedProperty?.latitude || !selectedProperty?.longitude) return {} as Record<string, DayWeather>;
      const payload = await fetchOpenMeteoWeather({
        latitude: selectedProperty.latitude,
        longitude: selectedProperty.longitude,
        timezone: 'America/New_York',
      });
      const byDate = new Map<string, DayWeather>();
      payload.hourly.forEach((point) => {
        const dateKey = point.time.slice(0, 10);
        const hour = new Date(point.time).getHours();
        if (hour === 12 || !byDate.has(dateKey)) {
          byDate.set(dateKey, { temp: Number(point.temperature ?? 0), weatherCode: Number(point.weatherCode ?? 0) });
        }
      });
      return Object.fromEntries(byDate.entries());
    },
  });

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

  const employeeList = useMemo(
    () => (employeesQuery.data ?? []).filter((employee) => String(employee.role ?? '').toLowerCase() !== 'viewer'),
    [employeesQuery.data],
  );
  const scheduleList = useMemo(() => weekScheduleQueries.flatMap((q) => q.data ?? []), [weekScheduleQueries]);
  const isLoading = employeesQuery.isLoading || weekScheduleQueries.some((q) => q.isLoading);
  const queryErrorMessage =
    (employeesQuery.error as { message?: string } | null)?.message ||
    (weekScheduleQueries.find((query) => query.error)?.error as { message?: string } | null)?.message ||
    '';

  useEffect(() => {
    if (!isLoading) {
      setLoadTimeoutReached(false);
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setLoadTimeoutReached(true);
    }, 8000);
    return () => window.clearTimeout(timeoutId);
  }, [isLoading]);

  useEffect(() => {
    setMobileDayIndex(0);
    setActiveDetailCell(null);
  }, [weekStart]);

  const [draft, setDraft] = useState({
    employeeId: '',
    date: weekStart,
    shiftStart: schedulerDefaults.start,
    shiftEnd: schedulerDefaults.end,
    status: 'scheduled' as ScheduleEntry['status'],
    notes: '',
  });

  const sourceWeekRangeLabel = useMemo(
    () => `${weekDays[0]?.label ?? ''} - ${weekDays[6]?.label ?? ''}`,
    [weekDays],
  );
  const targetWeekRangeLabel = useMemo(() => {
    if (!weekDays[0]?.date || !weekDays[6]?.date) return '';
    const targetStart = new Date(`${weekDays[0].date}T00:00:00`);
    const targetEnd = new Date(`${weekDays[6].date}T00:00:00`);
    targetStart.setDate(targetStart.getDate() + 7);
    targetEnd.setDate(targetEnd.getDate() + 7);
    const startLabel = targetStart.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
    const endLabel = targetEnd.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
    return `${startLabel} - ${endLabel}`;
  }, [weekDays]);

  useEffect(() => {
    const fetchSchedulerData = async () => {
      if (!supabase || !currentUser?.orgId) {
        setSchedulerDefaultsLoading(false);
        return;
      }

      const [settingsResult, templatesResult, weekTemplatesResult] = await Promise.all([
        supabase
          .from('scheduler_settings')
          .select('operational_day_start, operational_day_end')
          .eq('org_id', currentUser.orgId)
          .single(),
        supabase
          .from('shift_templates')
          .select('id, name, start, end, days, active')
          .eq('org_id', currentUser.orgId)
          .eq('active', true)
          .order('name', { ascending: true }),
        supabase
          .from('schedule_week_templates')
          .select('id, name, template_data')
          .eq('org_id', currentUser.orgId)
          .order('created_at', { ascending: false }),
      ]);

      if (settingsResult.data) {
        setSchedulerDefaults({
          start: settingsResult.data.operational_day_start?.slice(0, 5) ?? '07:30',
          end: settingsResult.data.operational_day_end?.slice(0, 5) ?? '16:00',
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
      if (weekTemplatesResult.data) {
        setWeekTemplates(
          weekTemplatesResult.data.map((template) => ({
            id: String(template.id),
            name: String(template.name ?? 'Untitled template'),
            template_data: Array.isArray(template.template_data)
              ? (template.template_data as WeekTemplateItem['template_data'])
              : [],
          })),
        );
      }
      setSchedulerDefaultsLoading(false);
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

  const assignmentsByCell = useMemo(() => {
    const map = new Map<string, AssignmentSummary[]>();
    (assignmentsWeekQuery.data ?? []).forEach((assignment) => {
      const key = `${assignment.employeeId}-${assignment.date}`;
      const current = map.get(key) ?? [];
      current.push(assignment);
      map.set(key, current);
    });
    return map;
  }, [assignmentsWeekQuery.data]);

  const departmentStyleForEmployee = (employee: (typeof employeeList)[number]) => {
    const role = String(employee.role ?? '').toLowerCase();
    const department = String(employee.department ?? '').toLowerCase();
    if (role.includes('field staff') || department.includes('field staff')) {
      return {
        cell: 'border-amber-500 bg-amber-100 text-amber-900 hover:bg-amber-200',
        badge: 'border-amber-400 bg-amber-200 text-amber-900',
        label: 'Field Staff',
      };
    }
    if (department.includes('maintenance')) {
      return {
        cell: 'border-emerald-500 bg-emerald-100 text-emerald-900 hover:bg-emerald-200',
        badge: 'border-emerald-400 bg-emerald-200 text-emerald-900',
        label: 'Maintenance',
      };
    }
    if (department.includes('irrigation')) {
      return {
        cell: 'border-blue-500 bg-blue-100 text-blue-900 hover:bg-blue-200',
        badge: 'border-blue-400 bg-blue-200 text-blue-900',
        label: 'Irrigation',
      };
    }
    return {
      cell: 'border-gray-400 bg-gray-100 text-gray-900 hover:bg-gray-200',
      badge: 'border-gray-300 bg-gray-200 text-gray-800',
      label: employee.department?.trim() || 'General',
    };
  };

  function openAddShift(employeeId?: string, date?: string) {
    if (isReadOnly) return;
    const targetEmp = employeeId ?? activeEmployees[0]?.id ?? '';
    setDraft({
      employeeId: targetEmp,
      date: date ?? weekDays[0]?.date ?? weekStart,
      shiftStart: schedulerDefaults.start || '07:30',
      shiftEnd: schedulerDefaults.end || '16:00',
      status: 'scheduled',
      notes: '',
    });
    setSelectedTemplateId('');
    setIsShiftModalDirty(false);
    setDialogOpen(true);
  }

  function openEditShift(employeeId: string, day: { date: string }, entry: ScheduleEntry) {
    if (isReadOnly) return;
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
    setIsShiftModalDirty(false);
    setDialogOpen(true);
  }

  function handleCloseModal(forceDiscard = false) {
    if (!forceDiscard && isShiftModalDirty) {
      const shouldDiscard = window.confirm('You have unsaved changes. Discard?');
      if (!shouldDiscard) return;
    }
    setDialogOpen(false);
    setIsShiftModalDirty(false);
    setSelectedTemplateId('');
    setDraft((cur) => ({
      ...cur,
      shiftStart: schedulerDefaults.start || '07:30',
      shiftEnd: schedulerDefaults.end || '16:00',
      notes: '',
    }));
  }

  useEffect(() => {
    if (!dialogOpen || !isShiftModalDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dialogOpen, isShiftModalDirty]);

  async function handleSaveShift() {
    if (isReadOnly) return;
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
      toast.error(`Failed to save shift: ${response.error.message}`);
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ['schedule-entries'] });
    handleCloseModal(true);
    const employeeName = employee ? `${employee.firstName} ${employee.lastName}` : 'crew member';
    toast.success(existing ? `Shift updated for ${employeeName}` : `Shift added for ${employeeName}`);
  }

  async function handleDeleteShift() {
    if (isReadOnly) return;
    if (!supabase) return;
    const existing = scheduleList.find((e) => e.employeeId === draft.employeeId && e.date === draft.date);
    if (!existing) { handleCloseModal(); return; }
    const { error } = await supabase
      .from('schedule_entries')
      .delete()
      .eq('id', existing.id)
      .eq('org_id', currentUser?.orgId ?? '');
    if (error) { toast.error(`Failed to delete shift: ${error.message}`); return; }
    await queryClient.invalidateQueries({ queryKey: ['schedule-entries'] });
    handleCloseModal(true);
    const removedEmployee = employeeList.find((e) => e.id === draft.employeeId);
    const removedName = removedEmployee ? `${removedEmployee.firstName} ${removedEmployee.lastName}` : 'crew member';
    toast.success(`Shift removed for ${removedName}`);
  }

  function openCopyWeekDialog() {
    setCopyAssignmentsChecked(false);
    setCopyWeekDialogOpen(true);
  }

  function openSaveTemplateDialog() {
    setTemplateName('');
    setSaveTemplateDialogOpen(true);
  }

  function openApplyTemplateDialog() {
    setSelectedWeekTemplateId(weekTemplates[0]?.id ?? '');
    setApplyTemplateDialogOpen(true);
  }

  function generateUuid() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2, 14)}`;
  }

  function toDayName(dateKey: string) {
    const day = new Date(`${dateKey}T00:00:00`).getDay();
    const map = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    return map[day] ?? 'mon';
  }

  async function saveWeekAsTemplate() {
    if (isReadOnly) return;
    if (!supabase || !currentUser?.orgId) return;
    const name = templateName.trim();
    if (!name) {
      toast.error('Template name is required.');
      return;
    }
    const weekStartDate = weekDays[0]?.date;
    const weekEndDate = weekDays[6]?.date;
    if (!weekStartDate || !weekEndDate) return;

    const weekEntries = scheduleList.filter((entry) => entry.date >= weekStartDate && entry.date <= weekEndDate);
    if (weekEntries.length === 0) {
      toast.message('Nothing to save', { description: 'No entries found in the current week.' });
      return;
    }

    const templateData = weekEntries.map((entry) => {
      const employee = employeeList.find((item) => item.id === entry.employeeId);
      return {
        day: toDayName(entry.date),
        employee_id: entry.employeeId,
        shift_start: entry.shiftStart,
        shift_end: entry.shiftEnd,
        property_id: employee?.propertyId ?? null,
        status: entry.status,
      };
    });

    setTemplateActionSaving(true);
    const { data, error } = await supabase
      .from('schedule_week_templates')
      .insert({
        org_id: currentUser.orgId,
        name,
        template_data: templateData,
      })
      .select('id, name, template_data')
      .single();
    setTemplateActionSaving(false);

    if (error) {
      toast.error(`Failed to save week template: ${error.message}`);
      return;
    }

    setWeekTemplates((current) => [
      {
        id: String(data.id),
        name: String(data.name ?? name),
        template_data: Array.isArray(data.template_data)
          ? (data.template_data as WeekTemplateItem['template_data'])
          : [],
      },
      ...current,
    ]);
    setSaveTemplateDialogOpen(false);
    toast.success(`Week template saved: ${name}`);
  }

  async function applyWeekTemplate() {
    if (isReadOnly) return;
    if (!supabase || !currentUser?.orgId || !selectedWeekTemplateId) return;
    const selectedTemplate = weekTemplates.find((template) => template.id === selectedWeekTemplateId);
    if (!selectedTemplate) return;

    const weekStartDate = weekDays[0]?.date;
    const weekEndDate = weekDays[6]?.date;
    if (!weekStartDate || !weekEndDate) return;

    const { data: existingWeekEntries, error: existingError } = await supabase
      .from('schedule_entries')
      .select('date')
      .eq('org_id', currentUser.orgId)
      .gte('date', weekStartDate)
      .lte('date', weekEndDate);
    if (existingError) {
      toast.error(`Failed to apply week template: ${existingError.message}`);
      return;
    }

    const daysWithEntries = new Set((existingWeekEntries ?? []).map((entry) => String(entry.date)));
    const dayOffsets: Record<string, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };
    const start = new Date(`${weekStartDate}T00:00:00`);
    const inserts: Record<string, unknown>[] = [];

    selectedTemplate.template_data.forEach((item) => {
      const offset = dayOffsets[item.day?.toLowerCase?.() ?? ''];
      if (offset == null) return;
      const date = new Date(start);
      date.setDate(start.getDate() + offset);
      const targetDate = toDateKey(date);
      if (daysWithEntries.has(targetDate)) return;
      inserts.push({
        id: generateUuid(),
        org_id: currentUser.orgId,
        employee_id: item.employee_id,
        property_id: item.property_id ?? null,
        date: targetDate,
        shift_start: item.shift_start,
        shift_end: item.shift_end,
        status: 'scheduled',
      });
    });

    if (inserts.length === 0) {
      toast.message('Nothing to apply', { description: 'All target days already have entries.' });
      setApplyTemplateDialogOpen(false);
      return;
    }

    setTemplateActionSaving(true);
    const { error } = await supabase.from('schedule_entries').insert(inserts);
    setTemplateActionSaving(false);
    if (error) {
      toast.error(`Failed to apply week template: ${error.message}`);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['schedule-entries'] });
    setApplyTemplateDialogOpen(false);
    toast.success('Week template applied', { description: `${inserts.length} shifts added.` });
  }

  async function copyWeek() {
    if (isReadOnly) return;
    if (!supabase) {
      toast.error('Database not available.');
      return;
    }
    if (!currentUser?.orgId) {
      toast.error('Organization context unavailable.');
      return;
    }
    const weekStartDate = weekDays[0]?.date;
    const weekEndDate = weekDays[6]?.date;
    if (!weekStartDate || !weekEndDate) return;

    setCopyWeekSaving(true);

    const weekEntries = scheduleList.filter((entry) => entry.date >= weekStartDate && entry.date <= weekEndDate);
    if (weekEntries.length === 0) {
      setCopyWeekSaving(false);
      toast.message('Nothing to copy', { description: 'No entries found in the current week.' });
      return;
    }

    const targetWeekStartDate = new Date(`${weekStartDate}T00:00:00`);
    targetWeekStartDate.setDate(targetWeekStartDate.getDate() + 7);
    const targetWeekEndDate = new Date(`${weekEndDate}T00:00:00`);
    targetWeekEndDate.setDate(targetWeekEndDate.getDate() + 7);
    const targetStartKey = toDateKey(targetWeekStartDate);
    const targetEndKey = toDateKey(targetWeekEndDate);

    const { data: existingTargetWeekEntries, error: existingEntriesError } = await supabase
      .from('schedule_entries')
      .select('id, date')
      .eq('org_id', currentUser.orgId)
      .gte('date', targetStartKey)
      .lte('date', targetEndKey);

    if (existingEntriesError) {
      setCopyWeekSaving(false);
      toast.error(`Failed to copy week: ${existingEntriesError.message}`);
      return;
    }

    const targetDaysWithEntries = new Set((existingTargetWeekEntries ?? []).map((entry) => String(entry.date)));
    const sourceToTargetDateMap = new Map<string, string>();
    const inserts: Record<string, unknown>[] = [];

    for (const entry of weekEntries) {
      const copiedDate = new Date(`${entry.date}T00:00:00`);
      copiedDate.setDate(copiedDate.getDate() + 7);
      const targetDate = toDateKey(copiedDate);
      sourceToTargetDateMap.set(entry.date, targetDate);
      if (targetDaysWithEntries.has(targetDate)) continue;

      const employee = employeeList.find((person) => person.id === entry.employeeId);
      const row: Record<string, unknown> = {
        id: generateUuid(),
        employee_id: entry.employeeId,
        date: targetDate,
        shift_start: entry.shiftStart,
        shift_end: entry.shiftEnd,
        status: 'scheduled',
        notes: (entry as ScheduleEntry & { notes?: string | null }).notes ?? null,
        org_id: currentUser.orgId,
      };
      if (employee?.propertyId) row.property_id = employee.propertyId;
      inserts.push(row);
    }

    if (inserts.length > 0) {
      const { error } = await supabase.from('schedule_entries').insert(inserts);
      if (error) {
        setCopyWeekSaving(false);
        toast.error(`Failed to copy week: ${error.message}`);
        return;
      }
    }

    if (copyAssignmentsChecked) {
      const { data: sourceAssignments, error: sourceAssignmentsError } = await supabase
        .from('assignments')
        .select('employee_id, property_id, task_id, date, title, location, status, notes, order_index, estimated_hours, actual_hours, start_time')
        .eq('org_id', currentUser.orgId)
        .gte('date', weekStartDate)
        .lte('date', weekEndDate);

      if (sourceAssignmentsError) {
        setCopyWeekSaving(false);
        toast.error(`Failed to copy assignments: ${sourceAssignmentsError.message}`);
        return;
      }

      const { data: existingTargetAssignments, error: existingTargetAssignmentsError } = await supabase
        .from('assignments')
        .select('date')
        .eq('org_id', currentUser.orgId)
        .gte('date', targetStartKey)
        .lte('date', targetEndKey);

      if (existingTargetAssignmentsError) {
        setCopyWeekSaving(false);
        toast.error(`Failed to copy assignments: ${existingTargetAssignmentsError.message}`);
        return;
      }

      const targetDaysWithAssignments = new Set((existingTargetAssignments ?? []).map((assignment) => String(assignment.date)));
      const assignmentInserts: Record<string, unknown>[] = [];

      for (const assignment of sourceAssignments ?? []) {
        const sourceDate = String(assignment.date ?? '');
        const targetDate = sourceToTargetDateMap.get(sourceDate);
        if (!targetDate || targetDaysWithEntries.has(targetDate) || targetDaysWithAssignments.has(targetDate)) continue;
        assignmentInserts.push({
          id: generateUuid(),
          org_id: currentUser.orgId,
          employee_id: assignment.employee_id,
          property_id: assignment.property_id,
          task_id: assignment.task_id,
          date: targetDate,
          title: assignment.title,
          location: assignment.location,
          status: 'planned',
          notes: assignment.notes,
          order_index: assignment.order_index,
          estimated_hours: assignment.estimated_hours,
          actual_hours: null,
          start_time: assignment.start_time,
          completed_at: null,
        });
      }

      if (assignmentInserts.length > 0) {
        const { error: assignmentInsertError } = await supabase.from('assignments').insert(assignmentInserts);
        if (assignmentInsertError) {
          setCopyWeekSaving(false);
          toast.error(`Failed to copy assignments: ${assignmentInsertError.message}`);
          return;
        }
      }
    }

    await queryClient.invalidateQueries({ queryKey: ['schedule-entries'] });
    await queryClient.invalidateQueries({ queryKey: ['assignments'] });
    setCopyWeekSaving(false);
    setCopyWeekDialogOpen(false);
    setWeekStart(targetStartKey);
    toast.success('Week copied to next week', {
      description: `${inserts.length} shift${inserts.length === 1 ? '' : 's'} added to next week.`,
    });
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

  function shiftMobileDay(direction: -1 | 1) {
    setMobileDayIndex((current) => {
      const next = current + direction;
      if (next < 0) return 0;
      if (next > 6) return 6;
      return next;
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
      <div className="border-b bg-card px-3 py-3 md:px-5 flex items-center gap-2 md:gap-3 flex-wrap shrink-0">
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
        <div className="relative w-full md:w-auto">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search crew..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 md:h-8 pl-7 w-full md:w-40 text-xs"
            data-testid="input-search-crew"
          />
        </div>

        {!isReadOnly ? (
          <>
            <Button size="sm" className="h-11 w-full md:h-8 md:w-auto gap-1.5" onClick={() => openAddShift()} data-testid="button-add-shift">
              <Plus className="h-3.5 w-3.5" /> Add Shift
            </Button>
            <Button variant="outline" size="sm" className="h-11 w-full md:h-8 md:w-auto gap-1.5" onClick={openSaveTemplateDialog}>
              Save as Template
            </Button>
            <Button variant="outline" size="sm" className="h-11 w-full md:h-8 md:w-auto gap-1.5" onClick={openApplyTemplateDialog}>
              Apply Template
            </Button>
            <Button variant="outline" size="sm" className="h-11 w-full md:h-8 md:w-auto gap-1.5" onClick={openCopyWeekDialog} data-testid="button-copy-week">
              <Copy className="h-3.5 w-3.5" /> Copy Week
            </Button>
          </>
        ) : null}
        <Button variant="outline" size="sm" className="h-11 w-full md:h-8 md:w-auto gap-1.5" onClick={exportWeekToCalendar}>
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
        {isLoading && !loadTimeoutReached ? (
          <div className="p-4">
            <TableSkeleton />
          </div>
        ) : queryErrorMessage || loadTimeoutReached ? (
          <div className="p-4">
            <div className="mx-auto max-w-xl rounded-xl border border-dashed p-5 text-center">
              <p className="text-sm font-medium text-foreground">Scheduler data is temporarily unavailable.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {loadTimeoutReached ? 'Loading took longer than expected. Try refreshing the schedule.' : queryErrorMessage}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => {
                  setLoadTimeoutReached(false);
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
        ) : summary.scheduled === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={CalendarDays}
              title="No shifts this week"
              description="Click + Add Shift to schedule your crew."
              actionLabel="Add Shift"
              onAction={() => openAddShift()}
            />
          </div>
        ) : (
          <>
          <div className="md:hidden p-3 space-y-3">
            <div className="flex items-center justify-between rounded-xl border bg-card px-3 py-2">
              <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => shiftMobileDay(-1)} disabled={mobileDayIndex === 0}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-center">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Day View</div>
                <div className="text-sm font-semibold">{selectedMobileDay?.label}</div>
              </div>
              <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => shiftMobileDay(1)} disabled={mobileDayIndex === 6}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {!isReadOnly ? (
              <Button className="h-11 w-full" onClick={() => openAddShift(undefined, selectedMobileDay?.date)} data-testid="button-add-shift-mobile">
              <Plus className="mr-1.5 h-4 w-4" /> Add Shift
              </Button>
            ) : null}
            <div className="space-y-2">
              {activeEmployees.map((emp) => {
                const entry = selectedMobileDay ? scheduleList.find((s) => s.employeeId === emp.id && s.date === selectedMobileDay.date) : undefined;
                return (
                  <div key={`mobile-day-${emp.id}`} className="rounded-xl border bg-card p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{emp.firstName} {emp.lastName}</p>
                        <p className="text-xs text-muted-foreground">{emp.group || emp.department}</p>
                      </div>
                      {entry ? (
                        <Badge variant="outline" className="text-[11px]">{entry.status}</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[11px]">No Shift</Badge>
                      )}
                    </div>
                    <div className="mt-2">
                      {entry ? (
                        <button
                          type="button"
                          className="min-h-11 w-full rounded-lg border bg-muted/20 px-3 py-2 text-left text-sm"
                          onClick={() => selectedMobileDay && openEditShift(emp.id, selectedMobileDay, entry)}
                        >
                          {entry.status === 'scheduled' ? `${formatTime(entry.shiftStart)} - ${formatTime(entry.shiftEnd)}` : 'Day Off / Unavailable'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="min-h-11 w-full rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground"
                          onClick={() => selectedMobileDay && openAddShift(emp.id, selectedMobileDay.date)}
                        >
                          + Add Shift
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <Card className="hidden md:block rounded-none border-0 border-b">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b bg-muted/40 sticky top-0 z-10">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs sticky left-0 bg-muted/40 min-w-[200px] z-20">
                    Crew Member
                  </th>
                  {weekDays.map((day) => {
                    const isToday = day.date === today;
                    const dayWeather = (weekWeatherQuery.data ?? {})[day.date];
                    const WeatherIcon = dayWeather ? weatherIconForCode(dayWeather.weatherCode) : null;
                    return (
                      <th
                        key={day.date}
                        className={`text-center px-2 py-3 font-medium text-xs min-w-[110px] ${isToday ? 'bg-primary/10 ring-1 ring-primary/40 text-primary' : 'text-muted-foreground'}`}
                      >
                        <div className={`text-[10px] uppercase tracking-wider ${isToday ? 'text-primary' : ''}`}>{day.short}</div>
                        <div className={`text-base font-bold mt-0.5 ${isToday ? 'text-primary' : 'text-foreground'}`}>{day.dayNum}</div>
                        {dayWeather && WeatherIcon ? (
                          <div className="mt-1 flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
                            <WeatherIcon className="h-3 w-3" />
                            <span>{Math.round(dayWeather.temp)}°</span>
                          </div>
                        ) : null}
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
                          const cellKey = `${emp.id}-${day.date}`;

                          if (entry?.status === 'scheduled') {
                            weekHours += shiftHours(entry.shiftStart, entry.shiftEnd);
                            weekDaysScheduled += 1;
                          }

                          if (!entry) {
                            return (
                              <td key={day.date} className={`px-2 py-2 text-center ${isToday ? 'bg-primary/5' : ''}`}>
                                <button
                                  type="button"
                                  disabled={isReadOnly}
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
                          const departmentStyle = departmentStyleForEmployee(emp);
                          const cellAssignments = assignmentsByCell.get(cellKey) ?? [];
                          const scheduledHours = shiftHours(entry.shiftStart, entry.shiftEnd);
                          const assignedHours = cellAssignments.reduce((sum, assignment) => sum + Number(assignment.estimatedHours ?? 0), 0);
                          const coverage = toCoveragePercent(assignedHours, scheduledHours);
                          const detailOpen = activeDetailCell === cellKey;
                          return (
                            <td
                              key={day.date}
                              className={`relative px-2 py-2 ${isToday ? 'bg-primary/5' : ''}`}
                              onMouseEnter={() => setActiveDetailCell(cellKey)}
                              onMouseLeave={() => setActiveDetailCell((current) => (current === cellKey ? null : current))}
                            >
                              <button
                                type="button"
                                disabled={isReadOnly}
                                className={`w-full rounded-lg border px-2 py-1.5 text-center text-xs transition-colors ${entry.status === 'scheduled' ? departmentStyle.cell : style.cell}`}
                                onClick={() => {
                                  if (window.matchMedia('(max-width: 767px)').matches && activeDetailCell !== cellKey) {
                                    setActiveDetailCell(cellKey);
                                    return;
                                  }
                                  openEditShift(emp.id, day, entry);
                                }}
                                data-testid={`button-edit-shift-${emp.id}-${day.date}`}
                              >
                                {entry.status === 'scheduled' ? (
                                  <>
                                    <div className="font-semibold text-[11px]">
                                      {formatTime(entry.shiftStart)} - {formatTime(entry.shiftEnd)}
                                    </div>
                                    <Badge
                                      variant="outline"
                                      className={`mt-1 h-5 px-1.5 text-[9px] uppercase tracking-wide ${departmentStyle.badge}`}
                                    >
                                      {departmentStyle.label}
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
                              {detailOpen ? (
                                <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-60 -translate-x-1/2 rounded-lg border bg-popover p-3 text-left shadow-lg">
                                  <div className="text-xs font-semibold text-foreground">{emp.firstName} {emp.lastName} · {emp.role}</div>
                                  <div className="mt-1 text-[11px] text-muted-foreground">
                                    Shift: {formatTime(entry.shiftStart)} - {formatTime(entry.shiftEnd)} ({scheduledHours.toFixed(1)}h)
                                  </div>
                                  <div className="mt-1 text-[11px] text-muted-foreground">
                                    Assigned tasks: {cellAssignments.length}
                                  </div>
                                  {cellAssignments.length > 0 ? (
                                    <ul className="mt-1 list-disc pl-4 text-[11px] text-muted-foreground">
                                      {cellAssignments.slice(0, 3).map((assignment, idx) => (
                                        <li key={`${cellKey}-assignment-${idx}`}>{assignment.title || 'Task'}</li>
                                      ))}
                                    </ul>
                                  ) : null}
                                  <div className="mt-1 text-[11px] text-muted-foreground">Coverage: {coverage}% of shift covered</div>
                                  {entryNotes ? <div className="mt-1 text-[11px] text-muted-foreground">Notes: {entryNotes}</div> : null}
                                </div>
                              ) : null}
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
          </>
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
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
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
                onChange={(e) => {
                  setIsShiftModalDirty(true);
                  setDraft({ ...draft, employeeId: e.target.value });
                }}
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
                onChange={(e) => {
                  setIsShiftModalDirty(true);
                  setDraft({ ...draft, date: e.target.value });
                }}
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
                onChange={(e) => {
                  setIsShiftModalDirty(true);
                  setDraft({ ...draft, status: e.target.value as ScheduleEntry['status'] });
                }}
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
                        setIsShiftModalDirty(true);
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
                        {template.name} ({formatTime(template.start)}–{formatTime(template.end)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Shift start</label>
                  <Input
                    type="time"
                    value={draft.shiftStart}
                    onChange={(e) => {
                      setIsShiftModalDirty(true);
                      setDraft({ ...draft, shiftStart: e.target.value });
                    }}
                    className="mt-1"
                    disabled={schedulerDefaultsLoading && !schedulerDefaults.start}
                    data-testid="input-shift-start"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Shift end</label>
                  <Input
                    type="time"
                    value={draft.shiftEnd}
                    onChange={(e) => {
                      setIsShiftModalDirty(true);
                      setDraft({ ...draft, shiftEnd: e.target.value });
                    }}
                    className="mt-1"
                    disabled={schedulerDefaultsLoading && !schedulerDefaults.start}
                    data-testid="input-shift-end"
                  />
                </div>
                {schedulerDefaultsLoading && !schedulerDefaults.start && (
                  <div className="col-span-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-block h-3 w-10 animate-pulse rounded bg-muted" />
                    Loading operational hours…
                  </div>
                )}
                {draft.shiftStart && draft.shiftEnd && (
                  <div className="col-span-2">
                    <div className="rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                      Scheduled: <span className="font-semibold text-foreground">{formatTime(draft.shiftStart)} - {formatTime(draft.shiftEnd)}</span>
                      <br />
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
                onChange={(e) => {
                  setIsShiftModalDirty(true);
                  setDraft({ ...draft, notes: e.target.value });
                }}
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
              <Button variant="outline" onClick={() => handleCloseModal()}>Cancel</Button>
              <Button onClick={() => void handleSaveShift()} disabled={isSaving} data-testid="button-save-shift">
                {isSaving ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Shift'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={copyWeekDialogOpen} onOpenChange={setCopyWeekDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Copy this week&apos;s schedule to next week?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Source week</p>
              <p className="font-medium">{sourceWeekRangeLabel}</p>
            </div>
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Target week</p>
              <p className="font-medium">{targetWeekRangeLabel}</p>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={copyAssignmentsChecked}
                onChange={(event) => setCopyAssignmentsChecked(event.target.checked)}
              />
              <span>Also copy task assignments</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCopyWeekDialogOpen(false)} disabled={copyWeekSaving}>
                Cancel
              </Button>
              <Button onClick={() => void copyWeek()} disabled={copyWeekSaving}>
                {copyWeekSaving ? 'Copying...' : 'Confirm Copy'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={saveTemplateDialogOpen} onOpenChange={setSaveTemplateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Save this week as template</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-xs text-muted-foreground">Template name</label>
            <Input
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              placeholder="e.g. Standard Week"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setSaveTemplateDialogOpen(false)} disabled={templateActionSaving}>
                Cancel
              </Button>
              <Button onClick={() => void saveWeekAsTemplate()} disabled={templateActionSaving}>
                {templateActionSaving ? 'Saving...' : 'Save Template'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={applyTemplateDialogOpen} onOpenChange={setApplyTemplateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Apply saved template</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-xs text-muted-foreground">Template</label>
            <select
              value={selectedWeekTemplateId}
              onChange={(event) => setSelectedWeekTemplateId(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {weekTemplates.length === 0 ? <option value="">No templates saved</option> : null}
              {weekTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setApplyTemplateDialogOpen(false)} disabled={templateActionSaving}>
                Cancel
              </Button>
              <Button
                onClick={() => void applyWeekTemplate()}
                disabled={templateActionSaving || !selectedWeekTemplateId}
              >
                {templateActionSaving ? 'Applying...' : 'Apply Template'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
