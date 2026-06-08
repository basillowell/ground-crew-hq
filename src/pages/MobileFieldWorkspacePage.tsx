import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatTime } from '@/utils/formatTime';
import { PageSkeleton } from '@/components/PageSkeleton';
import { ErrorRetry } from '@/components/ErrorRetry';
import { fieldTranslations, type FieldLanguage } from '@/i18n/field-translations';
import { createEvents, type EventAttributes } from 'ics';
import { Loader2 } from 'lucide-react';
import { useAppStore } from '@/store/appStore';

type AssignmentStatus = 'planned' | 'in_progress' | 'done' | 'in-progress' | 'completed';

type FieldAssignment = {
  id: string;
  taskId: string | null;
  title: string;
  location: string | null;
  notes: string | null;
  status: AssignmentStatus;
  orderIndex: number;
  estimatedHours: number;
  actualHours: number | null;
  startTime: string | null;
  completedAt: string | null;
  actualStartAt?: string | null;
  actualCompletedAt?: string | null;
  employeeId?: string;
};

type ShiftEntry = {
  propertyId: string | null;
  shiftStart: string;
  shiftEnd: string;
};

type EmployeeRecord = {
  id: string;
  firstName: string;
  lastName: string;
  language: string | null;
};

type TaskMeta = {
  id: string;
  category: string | null;
};

type PropertyRecord = {
  id: string;
  name: string;
};

type ClockEventRecord = {
  id: string;
  eventType: string;
  timestamp: string;
};

type TeammateCard = {
  employeeId: string;
  firstName: string;
  lastName: string;
  role: string | null;
  shiftStart: string | null;
  shiftEnd: string | null;
  tasks: FieldAssignment[];
};

type DeferredInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type FieldCachePayload = {
  schedule: ShiftEntry | null;
  assignments: FieldAssignment[];
  clockEvents: ClockEventRecord[];
  employee: EmployeeRecord | null;
  propertyName: string;
  taskMetaById: Record<string, TaskMeta>;
};

type FieldSyncQueueItem =
  | {
      type: 'assignment_status';
      assignmentId: string;
      payload: Record<string, unknown>;
    }
  | {
      type: 'clock_event';
      payload: {
        employee_id: string;
        property_id: string;
        org_id: string;
        event_type: 'clock_in' | 'clock_out';
        timestamp: string;
        location_lat: null;
        location_lng: null;
      };
    };

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function isUuid(value: string | null | undefined): value is string {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function downloadTextFile(filename: string, contents: string, mimeType: string) {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function toIcsDateParts(date: string, time: string): [number, number, number, number, number] {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return [year, month, day, hour, minute];
}

function displayStatus(status: AssignmentStatus) {
  if (status === 'in_progress' || status === 'in-progress') return 'in_progress';
  if (status === 'completed') return 'done';
  if (status === 'done') return 'done';
  return 'planned';
}

function statusBadgeLabel(status: AssignmentStatus) {
  const normalized = displayStatus(status);
  if (normalized === 'in_progress') return 'In Progress';
  if (normalized === 'done') return 'Done';
  return 'Planned';
}

function statusBadgeClass(status: AssignmentStatus) {
  const normalized = displayStatus(status);
  if (normalized === 'done') return 'bg-lime-400/10 text-lime-400';
  if (normalized === 'in_progress') return 'bg-sky-400/10 text-sky-400';
  return 'bg-white/[0.06] text-slate-400';
}

const QUICK_HOURS_OPTIONS = ['1', '1.5', '2', '2.5', '3', '4'];

export default function MobileFieldWorkspacePage() {
  const LANG_STORAGE_KEY = 'ground-crew-field-lang';
  const { currentUser } = useAuth();
  const isHydrated = useAppStore((state) => state.isHydrated);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [employee, setEmployee] = useState<EmployeeRecord | null>(null);
  const [shift, setShift] = useState<ShiftEntry | null>(null);
  const [assignments, setAssignments] = useState<FieldAssignment[]>([]);
  const [taskMetaById, setTaskMetaById] = useState<Record<string, TaskMeta>>({});
  const [propertyName, setPropertyName] = useState<string>('Assigned Property');
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [actualHoursDraft, setActualHoursDraft] = useState<Record<string, string>>({});
  const [activeDonePromptId, setActiveDonePromptId] = useState<string | null>(null);
  const [showOtherActualInputId, setShowOtherActualInputId] = useState<string | null>(null);
  const [clockEvents, setClockEvents] = useState<ClockEventRecord[]>([]);
  const [clockActionSaving, setClockActionSaving] = useState(false);
  const [liveNow, setLiveNow] = useState<Date>(new Date());
  const [needsOpen, setNeedsOpen] = useState(false);
  const [needsSaving, setNeedsSaving] = useState(false);
  const [needsTitle, setNeedsTitle] = useState('');
  const [needsPriority, setNeedsPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [needsLocation, setNeedsLocation] = useState('');
  const [needsNotes, setNeedsNotes] = useState('');
  const [needsPhotoBase64, setNeedsPhotoBase64] = useState<string | null>(null);
  const [language, setLanguage] = useState<FieldLanguage>('en');
  const [isOfflineData, setIsOfflineData] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<DeferredInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(false);
  const [teammates, setTeammates] = useState<TeammateCard[]>([]);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  useEffect(() => {
    document.title = 'Field — Ground Crew HQ';
  }, []);

  const employeeId = currentUser?.employeeId ?? null;
  const orgId = currentUser?.orgId ?? null;
  const boardDate = todayKey();
  const t = fieldTranslations[language];
  const cacheKey = `field-cache-${boardDate}`;
  const syncQueueKey = 'field-sync-queue';
  const installDismissKey = 'ground-crew-install-dismissed-at';
  const onboardedKey = 'ground-crew-field-onboarded';

  useEffect(() => {
    const onboarded = window.localStorage.getItem(onboardedKey) === 'true';
    setShowWelcomeBanner(!onboarded);
  }, [onboardedKey]);

  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)');
    const checkStandalone = () => {
      const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
      setIsStandalone(media.matches || iosStandalone);
    };
    checkStandalone();
    media.addEventListener('change', checkStandalone);
    return () => media.removeEventListener('change', checkStandalone);
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      const dismissedAtRaw = window.localStorage.getItem(installDismissKey);
      const dismissedAt = dismissedAtRaw ? Number(dismissedAtRaw) : 0;
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const dismissActive = Number.isFinite(dismissedAt) && dismissedAt > 0 && Date.now() - dismissedAt < sevenDaysMs;
      if (dismissActive || isStandalone) {
        setShowInstallBanner(false);
        return;
      }
      setDeferredInstallPrompt(event as DeferredInstallPromptEvent);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, [isStandalone, installDismissKey]);

  const loadSyncQueue = useCallback((): FieldSyncQueueItem[] => {
    try {
      const raw = window.localStorage.getItem(syncQueueKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as FieldSyncQueueItem[]) : [];
    } catch {
      return [];
    }
  }, [syncQueueKey]);

  const saveSyncQueue = useCallback((items: FieldSyncQueueItem[]) => {
    window.localStorage.setItem(syncQueueKey, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('ground-crew-sync-queue-changed', { detail: { count: items.length } }));
  }, [syncQueueKey]);

  const enqueueSyncAction = useCallback((item: FieldSyncQueueItem) => {
    const queue = loadSyncQueue();
    queue.push(item);
    saveSyncQueue(queue);
  }, [loadSyncQueue, saveSyncQueue]);

  const loadFieldCache = useCallback((): FieldCachePayload | null => {
    try {
      const raw = window.localStorage.getItem(cacheKey);
      if (!raw) return null;
      return JSON.parse(raw) as FieldCachePayload;
    } catch {
      return null;
    }
  }, [cacheKey]);

  const saveFieldCache = useCallback((payload: FieldCachePayload) => {
    window.localStorage.setItem(cacheKey, JSON.stringify(payload));
  }, [cacheKey]);

  const applyFieldCache = useCallback((cache: FieldCachePayload) => {
    setEmployee(cache.employee);
    setShift(cache.schedule);
    setAssignments(cache.assignments);
    setClockEvents(cache.clockEvents);
    setTaskMetaById(cache.taskMetaById ?? {});
    setPropertyName(cache.propertyName || 'Assigned Property');

    const nextActualDraft: Record<string, string> = {};
    cache.assignments.forEach((assignment) => {
      nextActualDraft[assignment.id] = String(assignment.actualHours ?? assignment.estimatedHours ?? 0);
    });
    setActualHoursDraft(nextActualDraft);
  }, []);

  const syncQueue = useCallback(async () => {
    if (!supabase || !navigator.onLine) return;
    const queue = loadSyncQueue();
    if (queue.length === 0) return;

    const remaining: FieldSyncQueueItem[] = [];
    let synced = 0;

    for (const item of queue) {
      if (item.type === 'assignment_status') {
        const { error } = await supabase.from('assignments').update(item.payload).eq('id', item.assignmentId);
        if (error) {
          remaining.push(item);
        } else {
          synced += 1;
        }
      } else if (item.type === 'clock_event') {
        const { error } = await supabase.from('clock_events').insert(item.payload);
        if (error) {
          remaining.push(item);
        } else {
          synced += 1;
        }
      }
    }

    saveSyncQueue(remaining);
    if (synced > 0) {
      window.dispatchEvent(new CustomEvent('ground-crew-sync-complete', { detail: { synced } }));
      toast.success(`Synced ${synced} offline change${synced === 1 ? '' : 's'}`);
      setIsOfflineData(false);
    }
  }, [loadSyncQueue, saveSyncQueue]);

  useEffect(() => {
    const timerId = window.setInterval(() => setLiveNow(new Date()), 60_000);
    return () => window.clearInterval(timerId);
  }, []);

  const fetchFieldData = useCallback(async () => {
    if (!supabase || !employeeId || !orgId) {
      setLoading(false);
      setError('Field profile is not available for this account.');
      return;
    }

    setLoading(true);
    setError(null);
    if (!navigator.onLine) {
      const cached = loadFieldCache();
      if (cached) {
        applyFieldCache(cached);
        setIsOfflineData(true);
        setLoading(false);
        return;
      }
      setError('You are offline and no cached field data is available yet.');
      setLoading(false);
      return;
    }

    const startOfDayIso = new Date(`${boardDate}T00:00:00`).toISOString();
    const endOfDayIso = new Date(`${boardDate}T23:59:59`).toISOString();

    const [{ data: employeeRow, error: employeeError }, { data: shiftRows, error: shiftError }, { data: assignmentRows, error: assignmentsError }, { data: taskRows, error: tasksError }, { data: propertyRows, error: propertyError }, { data: clockRows, error: clockError }] = await Promise.all([
      supabase.from('employees').select('id, first_name, last_name, language').eq('org_id', orgId).eq('id', employeeId).maybeSingle(),
      supabase
        .from('schedule_entries')
        .select('property_id, shift_start, shift_end')
        .eq('org_id', orgId)
        .eq('employee_id', employeeId)
        .eq('date', boardDate)
        .limit(1),
      supabase
        .from('assignments')
        .select('id, task_id, title, location, notes, status, order_index, estimated_hours, actual_hours, start_time, completed_at, actual_start_at, actual_completed_at')
        .eq('org_id', orgId)
        .eq('employee_id', employeeId)
        .eq('date', boardDate)
        .order('order_index', { ascending: true }),
      supabase
        .from('tasks')
        .select('id, category')
        .eq('org_id', orgId),
      supabase
        .from('properties')
        .select('id, name')
        .eq('org_id', orgId),
      supabase
        .from('clock_events')
        .select('id, event_type, timestamp')
        .eq('org_id', orgId)
        .eq('employee_id', employeeId)
        .gte('timestamp', startOfDayIso)
        .lte('timestamp', endOfDayIso)
        .order('timestamp', { ascending: true }),
    ]);

    if (employeeError || shiftError || assignmentsError || tasksError || propertyError || clockError) {
      const cached = loadFieldCache();
      if (cached) {
        applyFieldCache(cached);
        setIsOfflineData(true);
        setLoading(false);
        return;
      }
      setError(
        employeeError?.message ||
          shiftError?.message ||
          assignmentsError?.message ||
          tasksError?.message ||
          propertyError?.message ||
          clockError?.message ||
          'Unable to load field data.',
      );
      setLoading(false);
      return;
    }

    setEmployee(
      employeeRow
        ? {
            id: String(employeeRow.id),
            firstName: String(employeeRow.first_name ?? ''),
            lastName: String(employeeRow.last_name ?? ''),
            language: employeeRow.language ? String(employeeRow.language) : null,
          }
        : null,
    );

    if (employeeRow) {
      const localPref = window.localStorage.getItem(LANG_STORAGE_KEY);
      const employeeLang = String(employeeRow.language ?? '').toLowerCase();
      const nextLang: FieldLanguage =
        localPref === 'en' || localPref === 'es'
          ? localPref
          : employeeLang.startsWith('es')
            ? 'es'
            : 'en';
      setLanguage(nextLang);
    }

    const shiftRow = shiftRows?.[0];
    setShift(
      shiftRow
        ? {
            propertyId: shiftRow.property_id ? String(shiftRow.property_id) : null,
            shiftStart: String(shiftRow.shift_start ?? '').slice(0, 5),
            shiftEnd: String(shiftRow.shift_end ?? '').slice(0, 5),
          }
        : null,
    );

    const normalizedAssignments: FieldAssignment[] = (assignmentRows ?? []).map((row) => ({
      id: String(row.id),
      employeeId: row.employee_id ? String(row.employee_id) : employeeId,
      taskId: row.task_id ? String(row.task_id) : null,
      title: String(row.title ?? 'Task'),
      location: row.location ? String(row.location) : null,
      notes: row.notes ? String(row.notes) : null,
      status: (String(row.status ?? 'planned') as AssignmentStatus),
      orderIndex: Number(row.order_index ?? 0),
      estimatedHours: Number(row.estimated_hours ?? 0),
      actualHours: row.actual_hours == null ? null : Number(row.actual_hours),
      startTime: row.start_time ? String(row.start_time).slice(0, 5) : null,
      completedAt: row.completed_at ? String(row.completed_at) : null,
      actualStartAt: row.actual_start_at ? String(row.actual_start_at) : null,
      actualCompletedAt: row.actual_completed_at ? String(row.actual_completed_at) : null,
    }));
    setAssignments(normalizedAssignments);

    const teammateScheduleQuery = supabase
      .from('schedule_entries')
      .select('employee_id, shift_start, shift_end, status')
      .eq('org_id', orgId)
      .eq('date', boardDate);
    const teammateAssignmentsQuery = supabase
      .from('assignments')
      .select('id, employee_id, task_id, title, location, notes, status, order_index, estimated_hours, actual_hours, start_time, completed_at')
      .eq('org_id', orgId)
      .eq('date', boardDate)
      .order('order_index', { ascending: true });
    if (currentUser?.propertyId) {
      void teammateScheduleQuery.eq('property_id', currentUser.propertyId);
      void teammateAssignmentsQuery.eq('property_id', currentUser.propertyId);
    }
    const [{ data: teammateScheduleRows }, { data: teammateAssignmentRows }] = await Promise.all([
      teammateScheduleQuery,
      teammateAssignmentsQuery,
    ]);
    const teammateRows = (teammateScheduleRows ?? []).filter((row) => {
      if (!row.employee_id) return false;
      if (String(row.employee_id) === employeeId) return false;
      return String(row.status ?? 'scheduled').toLowerCase() === 'scheduled';
    });
    const teammateIds = Array.from(new Set(teammateRows.map((row) => String(row.employee_id))));
    let teammateEmployeeMap = new Map<string, { firstName: string; lastName: string; role: string | null }>();
    if (teammateIds.length > 0) {
      const { data: teammateEmployees } = await supabase
        .from('employees')
        .select('id, first_name, last_name, role')
        .eq('org_id', orgId)
        .in('id', teammateIds);
      teammateEmployeeMap = new Map(
        (teammateEmployees ?? []).map((row) => [
          String(row.id),
          {
            firstName: String(row.first_name ?? ''),
            lastName: String(row.last_name ?? ''),
            role: row.role ? String(row.role) : null,
          },
        ]),
      );
    }
    const groupedTeammateTasks = new Map<string, FieldAssignment[]>();
    (teammateAssignmentRows ?? []).forEach((row) => {
      const teammateId = row.employee_id ? String(row.employee_id) : '';
      if (!teammateId || teammateId === employeeId) return;
      const list = groupedTeammateTasks.get(teammateId) ?? [];
      list.push({
        id: String(row.id),
        employeeId: teammateId,
        taskId: row.task_id ? String(row.task_id) : null,
        title: String(row.title ?? 'Task'),
        location: row.location ? String(row.location) : null,
        notes: row.notes ? String(row.notes) : null,
        status: String(row.status ?? 'planned') as AssignmentStatus,
        orderIndex: Number(row.order_index ?? 0),
        estimatedHours: Number(row.estimated_hours ?? 0),
        actualHours: row.actual_hours == null ? null : Number(row.actual_hours),
        startTime: row.start_time ? String(row.start_time).slice(0, 5) : null,
        completedAt: row.completed_at ? String(row.completed_at) : null,
      });
      groupedTeammateTasks.set(teammateId, list);
    });
    setTeammates(
      teammateRows
        .map((row) => {
          const teammateId = String(row.employee_id);
          const profile = teammateEmployeeMap.get(teammateId);
          return {
            employeeId: teammateId,
            firstName: profile?.firstName ?? 'Crew',
            lastName: profile?.lastName ?? '',
            role: profile?.role ?? null,
            shiftStart: row.shift_start ? String(row.shift_start).slice(0, 5) : null,
            shiftEnd: row.shift_end ? String(row.shift_end).slice(0, 5) : null,
            tasks: (groupedTeammateTasks.get(teammateId) ?? []).sort((a, b) => a.orderIndex - b.orderIndex),
          };
        })
        .sort((a, b) => String(a.shiftStart ?? '').localeCompare(String(b.shiftStart ?? ''))),
    );

    const normalizedClockEvents: ClockEventRecord[] = (clockRows ?? []).map((row) => ({
      id: String(row.id),
      eventType: String(row.event_type ?? ''),
      timestamp: String(row.timestamp),
    }));
    setClockEvents(normalizedClockEvents);

    const nextActualDraft: Record<string, string> = {};
    normalizedAssignments.forEach((assignment) => {
      nextActualDraft[assignment.id] = String(assignment.actualHours ?? assignment.estimatedHours ?? 0);
    });
    setActualHoursDraft(nextActualDraft);

    const taskMap: Record<string, TaskMeta> = {};
    (taskRows ?? []).forEach((row) => {
      const id = String(row.id);
      taskMap[id] = {
        id,
        category: row.category ? String(row.category) : null,
      };
    });
    setTaskMetaById(taskMap);

    const propertiesById = new Map<string, string>();
    (propertyRows ?? []).forEach((property: PropertyRecord) => {
      propertiesById.set(String(property.id), String(property.name));
    });

    if (shiftRow?.property_id && propertiesById.has(String(shiftRow.property_id))) {
      setPropertyName(propertiesById.get(String(shiftRow.property_id)) ?? 'Assigned Property');
    } else if (currentUser?.propertyId && propertiesById.has(String(currentUser.propertyId))) {
      setPropertyName(propertiesById.get(String(currentUser.propertyId)) ?? 'Assigned Property');
    } else {
      setPropertyName('Assigned Property');
    }

    const resolvedPropertyName =
      shiftRow?.property_id && propertiesById.has(String(shiftRow.property_id))
        ? propertiesById.get(String(shiftRow.property_id)) ?? 'Assigned Property'
        : currentUser?.propertyId && propertiesById.has(String(currentUser.propertyId))
          ? propertiesById.get(String(currentUser.propertyId)) ?? 'Assigned Property'
          : 'Assigned Property';
    saveFieldCache({
      schedule: shiftRow
        ? {
            propertyId: shiftRow.property_id ? String(shiftRow.property_id) : null,
            shiftStart: String(shiftRow.shift_start ?? '').slice(0, 5),
            shiftEnd: String(shiftRow.shift_end ?? '').slice(0, 5),
          }
        : null,
      assignments: normalizedAssignments,
      clockEvents: normalizedClockEvents,
      employee: employeeRow
        ? {
            id: String(employeeRow.id),
            firstName: String(employeeRow.first_name ?? ''),
            lastName: String(employeeRow.last_name ?? ''),
            language: employeeRow.language ? String(employeeRow.language) : null,
          }
        : null,
      propertyName: resolvedPropertyName,
      taskMetaById: taskMap,
    });
    setIsOfflineData(false);
    setLoading(false);
  }, [LANG_STORAGE_KEY, applyFieldCache, boardDate, currentUser?.propertyId, employeeId, loadFieldCache, orgId, saveFieldCache]);

  useEffect(() => {
    if (!isHydrated) return;
    void fetchFieldData();
  }, [fetchFieldData, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    const handleOnline = () => {
      void syncQueue();
      void fetchFieldData();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [fetchFieldData, isHydrated, syncQueue]);

  useEffect(() => {
    if (!isHydrated) return;
    if (navigator.onLine) {
      void syncQueue();
    }
  }, [isHydrated, syncQueue]);

  const setSaving = (assignmentId: string, isSaving: boolean) => {
    setSavingIds((current) => ({ ...current, [assignmentId]: isSaving }));
  };

  const updateTaskStatus = async (
    assignment: FieldAssignment,
    nextStatus: 'in_progress' | 'done',
    actualHours?: number,
  ) => {
    if (!supabase) return;
    const nextCompletedAt = nextStatus === 'done' ? new Date().toISOString() : null;
    const nextActualHours = nextStatus === 'done' ? actualHours ?? assignment.estimatedHours : assignment.actualHours;

    setSaving(assignment.id, true);
    setAssignments((current) =>
      current.map((item) =>
        item.id === assignment.id
          ? { ...item, status: nextStatus, completedAt: nextCompletedAt, actualHours: nextActualHours }
          : item,
      ),
    );

    const payload: Record<string, unknown> = {
      status: nextStatus,
      completed_at: nextCompletedAt,
    };
    if (nextStatus === 'done') {
      payload.actual_hours = nextActualHours;
    }

    if (!navigator.onLine) {
      enqueueSyncAction({
        type: 'assignment_status',
        assignmentId: assignment.id,
        payload,
      });
      setSaving(assignment.id, false);
      setIsOfflineData(true);
      return;
    }

    const { error: updateError } = await supabase.from('assignments').update(payload).eq('id', assignment.id);
    setSaving(assignment.id, false);

    if (updateError) {
      enqueueSyncAction({
        type: 'assignment_status',
        assignmentId: assignment.id,
        payload,
      });
      setIsOfflineData(true);
      return;
    }

    if (nextStatus === 'done') {
      toast.success(`Task completed: ${assignment.title}`);
    } else if (nextStatus === 'in_progress') {
      toast.success(`Task started: ${assignment.title}`);
    }
  };

  const completeTaskWithHours = async (assignment: FieldAssignment) => {
    const assignmentId = assignment.id;
    const rawValue = actualHoursDraft[assignmentId] ?? '0';
    const parsed = Number(rawValue);
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 24) {
      toast.error('Enter actual hours between 0 and 24');
      return;
    }
    await updateTaskStatus(assignment, 'done', parsed);
    setActiveDonePromptId(null);
    setShowOtherActualInputId(null);
  };

  const doneCount = useMemo(
    () => assignments.filter((assignment) => displayStatus(assignment.status) === 'done').length,
    [assignments],
  );
  const actualHoursTotal = useMemo(
    () => assignments.reduce((sum, assignment) => sum + Number(assignment.actualHours ?? 0), 0),
    [assignments],
  );
  const scheduledHoursTotal = useMemo(
    () => assignments.reduce((sum, assignment) => sum + Number(assignment.estimatedHours ?? 0), 0),
    [assignments],
  );
  const completionPct = assignments.length > 0 ? Math.round((doneCount / assignments.length) * 100) : 0;

  const employeeName = employee ? `${employee.firstName} ${employee.lastName}`.trim() : 'Crew Member';
  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const latestClockIn = useMemo(
    () => [...clockEvents].reverse().find((event) => event.eventType === 'clock_in') ?? null,
    [clockEvents],
  );
  const latestClockOut = useMemo(
    () => [...clockEvents].reverse().find((event) => event.eventType === 'clock_out') ?? null,
    [clockEvents],
  );

  const isShiftComplete = Boolean(
    latestClockIn &&
      latestClockOut &&
      new Date(latestClockOut.timestamp).getTime() >= new Date(latestClockIn.timestamp).getTime(),
  );

  const isClockedIn = Boolean(latestClockIn && !isShiftComplete);

  const elapsedMinutes = useMemo(() => {
    if (!latestClockIn || !isClockedIn) return 0;
    const start = new Date(latestClockIn.timestamp).getTime();
    const now = liveNow.getTime();
    return Math.max(Math.round((now - start) / 60000), 0);
  }, [isClockedIn, latestClockIn, liveNow]);

  const elapsedLabel = useMemo(() => {
    const hours = Math.floor(elapsedMinutes / 60);
    const minutes = elapsedMinutes % 60;
    return `${hours}h ${minutes}m`;
  }, [elapsedMinutes]);

  const shiftCompleteLabel = useMemo(() => {
    if (!latestClockIn || !latestClockOut) return '';
    const start = new Date(latestClockIn.timestamp).getTime();
    const end = new Date(latestClockOut.timestamp).getTime();
    const totalMinutes = Math.max(Math.round((end - start) / 60000), 0);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const startTime = formatTime(new Date(latestClockIn.timestamp).toISOString().slice(11, 16));
    const endTime = formatTime(new Date(latestClockOut.timestamp).toISOString().slice(11, 16));
    return `${t.shiftComplete}: ${startTime} – ${endTime} (${hours}h ${minutes}m)`;
  }, [latestClockIn, latestClockOut, t.shiftComplete]);

  const handleClockEvent = useCallback(
    async (eventType: 'clock_in' | 'clock_out') => {
      if (!supabase || !employeeId || !orgId) return;
      const propertyId = shift?.propertyId ?? currentUser?.propertyId ?? null;
      if (!propertyId) {
        toast.error('Property is not available for clock event.');
        return;
      }
      // employee?.id is fetched directly from the employees table during page load
      // and is the authoritative employees.id that satisfies the RLS policy.
      // employeeId (from currentUser) is the same FK but using employee?.id avoids
      // any stale-cache mismatch between appUser.employee_id and the live employees row.
      const resolvedEmployeeId = employee?.id ?? employeeId;

      console.log('[CLOCK_EVENT_PAYLOAD]', {
        'employee?.id': employee?.id,
        employeeId,
        resolvedEmployeeId,
        propertyId,
        orgId,
      });

      setClockActionSaving(true);
      const optimisticEvent: ClockEventRecord = {
        id: `optimistic-${Date.now()}`,
        eventType,
        timestamp: new Date().toISOString(),
      };
      setClockEvents((current) => [...current, optimisticEvent]);

      if (!navigator.onLine) {
        enqueueSyncAction({
          type: 'clock_event',
          payload: {
            employee_id: resolvedEmployeeId,
            property_id: propertyId,
            org_id: orgId,
            event_type: eventType,
            timestamp: optimisticEvent.timestamp,
            location_lat: null,
            location_lng: null,
          },
        });
        setClockActionSaving(false);
        setIsOfflineData(true);
        toast.success(eventType === 'clock_in' ? 'Clock in saved offline' : 'Clock out saved offline');
        return;
      }

      const { data, error: insertError } = await supabase
        .from('clock_events')
        .insert({
          employee_id: resolvedEmployeeId,
          property_id: propertyId,
          org_id: orgId,
          event_type: eventType,
        })
        .select('id, event_type, timestamp')
        .single();

      setClockActionSaving(false);
      if (insertError) {
        console.error('[CLOCK_EVENT_ERROR]', {
          error: insertError,
          payload: {
            employee_id: resolvedEmployeeId,
            property_id: propertyId,
            org_id: orgId,
            event_type: eventType,
          },
        });
        enqueueSyncAction({
          type: 'clock_event',
          payload: {
            employee_id: resolvedEmployeeId,
            property_id: propertyId,
            org_id: orgId,
            event_type: eventType,
            timestamp: optimisticEvent.timestamp,
            location_lat: null,
            location_lng: null,
          },
        });
        setIsOfflineData(true);
        toast.success(eventType === 'clock_in' ? 'Clock in queued for sync' : 'Clock out queued for sync');
        return;
      }

      setClockEvents((current) =>
        current.map((event) =>
          event.id === optimisticEvent.id
            ? {
                id: String(data.id),
                eventType: String(data.event_type),
                timestamp: String(data.timestamp),
              }
            : event,
        ),
      );

      const successTime = formatTime(String(data?.timestamp ?? optimisticEvent.timestamp).slice(11, 16));
      toast.success(eventType === 'clock_in' ? `Clocked in at ${successTime}` : `Clocked out at ${successTime}`);
    },
    [currentUser?.propertyId, employee, employeeId, enqueueSyncAction, orgId, shift?.propertyId],
  );

  const resetNeedsForm = () => {
    setNeedsTitle('');
    setNeedsPriority('medium');
    setNeedsLocation('');
    setNeedsNotes('');
    setNeedsPhotoBase64(null);
  };

  const handleNeedsPhotoChange = async (file: File | null) => {
    if (!file) {
      setNeedsPhotoBase64(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setNeedsPhotoBase64(result || null);
    };
    reader.readAsDataURL(file);
  };

  const submitNeed = async () => {
    if (!supabase || !employeeId || !orgId) return;
    if (!needsTitle.trim()) {
      toast.error('Title is required');
      return;
    }
    const propertyId = shift?.propertyId ?? currentUser?.propertyId ?? null;
    if (!propertyId) {
      toast.error('Property is not available for this request.');
      return;
    }

    const composedNotes = [needsNotes.trim(), needsPhotoBase64 ? `Photo (base64): ${needsPhotoBase64}` : '']
      .filter(Boolean)
      .join('\n\n');

    setNeedsSaving(true);
    const { error: insertError } = await supabase.from('task_requests').insert({
      org_id: orgId,
      property_id: propertyId,
      submitted_by: employeeId,
      status: 'open',
      date: boardDate,
      title: needsTitle.trim(),
      priority: needsPriority,
      location: needsLocation.trim() || null,
      notes: composedNotes || null,
      created_at: new Date().toISOString(),
    });
    setNeedsSaving(false);

    if (insertError) {
      toast.error(`Failed to submit request: ${insertError.message}`);
      return;
    }

    toast.success('Request submitted! Your supervisor will review it.');
    resetNeedsForm();
    setNeedsOpen(false);
  };

  const handleAddToCalendar = useCallback(() => {
    if (!shift) {
      toast.error('No scheduled shift available for calendar export.');
      return;
    }
    const events: EventAttributes[] = [
      {
        title: `${employeeName} Shift`,
        description: `${employeeName} scheduled shift at ${propertyName}`,
        start: toIcsDateParts(boardDate, shift.shiftStart),
        end: toIcsDateParts(boardDate, shift.shiftEnd),
        status: 'CONFIRMED',
        organizer: { name: 'Ground Crew HQ', email: 'no-reply@groundcrewhq.local' },
      },
    ];
    const { error: icsError, value } = createEvents(events);
    if (icsError || !value) {
      toast.error('Failed to generate calendar event.');
      return;
    }
    downloadTextFile(`shift-${boardDate}.ics`, value, 'text/calendar;charset=utf-8');
    toast.success('Calendar event downloaded');
  }, [boardDate, employeeName, propertyName, shift]);

  const dismissInstallBanner = useCallback(() => {
    window.localStorage.setItem(installDismissKey, String(Date.now()));
    setShowInstallBanner(false);
  }, [installDismissKey]);

  const triggerInstallPrompt = useCallback(async () => {
    if (!deferredInstallPrompt) return;
    await deferredInstallPrompt.prompt();
    const result = await deferredInstallPrompt.userChoice;
    if (result.outcome === 'accepted') {
      toast.success('Ground Crew HQ install started');
      setShowInstallBanner(false);
    } else {
      dismissInstallBanner();
    }
    setDeferredInstallPrompt(null);
  }, [deferredInstallPrompt, dismissInstallBanner]);

  if (error && !loading) {
    return (
      <div className="mx-auto w-full max-w-[520px] px-4 py-4 font-sans">
        <ErrorRetry message={error} onRetry={() => void fetchFieldData()} />
      </div>
    );
  }

  const handlePullRefreshStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (window.scrollY > 0 || refreshing) return;
    setTouchStartY(event.touches[0]?.clientY ?? null);
  };

  const handlePullRefreshMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartY == null || refreshing) return;
    const currentY = event.touches[0]?.clientY ?? touchStartY;
    const nextDistance = Math.max(0, currentY - touchStartY);
    setPullDistance(Math.min(nextDistance, 84));
  };

  const handlePullRefreshEnd = async () => {
    if (pullDistance >= 64 && !refreshing) {
      setRefreshing(true);
      await fetchFieldData();
      setRefreshing(false);
    }
    setPullDistance(0);
    setTouchStartY(null);
  };

  const handleMyTaskStatusAction = useCallback(
    async (assignment: FieldAssignment, action: 'start' | 'complete') => {
      if (!supabase || !orgId || !employeeId || !assignment.id) return;
      const propertyIdRaw = shift?.propertyId ?? currentUser?.propertyId ?? null;
      const actingEmployeeId = employee?.id ?? assignment.employeeId ?? employeeId;
      if (!isUuid(propertyIdRaw) || !isUuid(actingEmployeeId)) {
        toast.error('Property is not available for this action.');
        return;
      }
      const propertyId = propertyIdRaw;

      const previous = { ...assignment };
      const nowIso = new Date().toISOString();
      const optimisticPatch: Partial<FieldAssignment> =
        action === 'start'
          ? {
              status: 'in_progress',
              actualStartAt: nowIso,
            }
          : (() => {
              const startIso = assignment.actualStartAt ?? nowIso;
              const startMs = Date.parse(startIso);
              const endMs = Date.parse(nowIso);
              const nextActualHours =
                Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs
                  ? Number(((endMs - startMs) / 3_600_000).toFixed(2))
                  : assignment.actualHours ?? 0;
              return {
                status: 'completed',
                actualCompletedAt: nowIso,
                actualHours: nextActualHours,
                completedAt: nowIso,
              };
            })();

      setSavingIds((current) => ({ ...current, [assignment.id]: true }));
      setAssignments((current) =>
        current.map((row) =>
          row.id === assignment.id
            ? { ...row, ...optimisticPatch }
            : row,
        ),
      );

      const assignmentPayload: Record<string, unknown> =
        action === 'start'
          ? { status: 'in_progress', actual_start_at: nowIso }
          : {
              status: 'completed',
              actual_completed_at: nowIso,
              actual_hours: optimisticPatch.actualHours ?? 0,
            };

      const { error: assignmentError } = await supabase
        .from('assignments')
        .update(assignmentPayload)
        .eq('id', assignment.id)
        .eq('org_id', orgId);
      if (assignmentError) {
        setAssignments((current) => current.map((row) => (row.id === previous.id ? previous : row)));
        setSavingIds((current) => ({ ...current, [assignment.id]: false }));
        toast.error(`${action === 'start' ? 'Start' : 'Complete'} failed: ${assignmentError.message}`);
        return;
      }

      const { error: clockError } = await supabase.from('clock_events').insert({
        employee_id: actingEmployeeId,
        property_id: propertyId,
        org_id: orgId,
        event_type: action === 'start' ? 'clock_in' : 'clock_out',
      });
      if (clockError) {
        await supabase
          .from('assignments')
          .update({
            status: previous.status,
            actual_start_at: previous.actualStartAt ?? null,
            actual_completed_at: previous.actualCompletedAt ?? null,
            actual_hours: previous.actualHours,
          })
          .eq('id', assignment.id)
          .eq('org_id', orgId);
        setAssignments((current) => current.map((row) => (row.id === previous.id ? previous : row)));
        setSavingIds((current) => ({ ...current, [assignment.id]: false }));
        toast.error(`${action === 'start' ? 'Start' : 'Complete'} failed: ${clockError.message}`);
        return;
      }

      setSavingIds((current) => ({ ...current, [assignment.id]: false }));
      toast.success(action === 'start' ? `Started ${assignment.title}` : `Completed ${assignment.title}`);
    },
    [currentUser?.propertyId, employee, employeeId, orgId, shift?.propertyId],
  );

  const displayOnlyLayout = (
    <div
      className="relative mx-auto w-full max-w-[520px] bg-[#0f1a14] px-4 pb-28 pt-4 font-sans"
      onTouchStart={handlePullRefreshStart}
      onTouchMove={handlePullRefreshMove}
      onTouchEnd={() => void handlePullRefreshEnd()}
    >
      {pullDistance > 0 ? (
        <div className="mb-2 flex h-8 items-center justify-center text-xs text-slate-500">
          {refreshing ? 'Refreshing…' : pullDistance >= 64 ? 'Release to refresh' : 'Pull to refresh'}
        </div>
      ) : null}

      <div className="mb-4 rounded-2xl border border-white/[0.06] bg-[#1a2d1f] p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">My Tasks</p>
          <p className="text-xs text-slate-500">{new Date().toLocaleDateString()}</p>
        </div>
        <div className="space-y-2">
          {loading
            ? Array.from({ length: 4 }).map((_, idx) => (
                <div key={`my-task-skeleton-${idx}`} className="h-[48px] animate-pulse rounded-xl bg-white/[0.04]" />
              ))
            : assignments.length === 0
              ? <p className="text-sm text-slate-500">No tasks assigned for today.</p>
              : assignments
                  .sort((a, b) => a.orderIndex - b.orderIndex)
                  .map((assignment) => (
                    <div key={assignment.id} className="flex min-h-[48px] items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3">
                      <span className="truncate text-sm font-medium text-slate-200">{assignment.title}</span>
                      <span className="shrink-0 rounded-full border border-white/[0.08] px-1.5 py-0.5 text-[10px] text-slate-400">{assignment.location || 'Area'}</span>
                      <span className="shrink-0 text-xs text-slate-500">{assignment.estimatedHours.toFixed(1)}h</span>
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statusBadgeClass(assignment.status)}`}>{statusBadgeLabel(assignment.status)}</span>
                      {displayStatus(assignment.status) === 'done' ? (
                        <button type="button" disabled className="ml-auto rounded-full border border-white/[0.06] px-3 py-1 text-xs text-slate-600">
                          Done
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="ml-auto flex items-center gap-1 rounded-full border border-white/[0.10] px-3 py-1 text-xs text-slate-300 transition-colors hover:border-lime-400/40 hover:text-lime-400 disabled:opacity-50"
                          disabled={Boolean(savingIds[assignment.id])}
                          onClick={() => void handleMyTaskStatusAction(assignment, displayStatus(assignment.status) === 'planned' ? 'start' : 'complete')}
                        >
                          {savingIds[assignment.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                          {displayStatus(assignment.status) === 'planned' ? 'Start' : 'Complete'}
                        </button>
                      )}
                    </div>
                  ))}
        </div>
      </div>

      <div className="my-4 border-t border-white/[0.06]" />

      <div className="mb-4 rounded-2xl border border-white/[0.06] bg-[#1a2d1f] p-4">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Teammates</p>
        <div className="space-y-3">
          {loading
            ? Array.from({ length: 3 }).map((_, idx) => (
                <div key={`teammate-skeleton-${idx}`} className="rounded-xl border border-white/[0.06] p-3">
                  <div className="h-6 w-40 animate-pulse rounded bg-white/[0.04]" />
                  <div className="mt-2 h-[48px] animate-pulse rounded-xl bg-white/[0.04]" />
                </div>
              ))
            : teammates.length === 0
              ? <p className="text-sm text-slate-500">No teammates scheduled today.</p>
              : teammates.map((teammate) => (
                  <div key={teammate.employeeId} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <p className="text-base font-semibold text-slate-100">{`${teammate.firstName} ${teammate.lastName}`.trim()}</p>
                        <p className="text-xs text-slate-500">{teammate.role || 'Crew'}</p>
                      </div>
                      <p className="text-xs text-slate-500">
                        {teammate.shiftStart && teammate.shiftEnd ? `${formatTime(teammate.shiftStart)}–${formatTime(teammate.shiftEnd)}` : 'No shift'}
                      </p>
                    </div>
                    <div className="space-y-2">
                      {teammate.tasks.length === 0 ? (
                        <p className="text-xs text-slate-500">No tasks assigned.</p>
                      ) : (
                        teammate.tasks.map((task) => (
                          <div key={task.id} className="flex min-h-[48px] items-center gap-2 rounded-xl border border-white/[0.06] px-3">
                            <span className="truncate text-sm font-medium text-slate-300">{task.title}</span>
                            <span className="shrink-0 rounded-full border border-white/[0.08] px-1.5 py-0.5 text-[10px] text-slate-400">{task.location || 'Area'}</span>
                            <span className="shrink-0 text-xs text-slate-500">{task.estimatedHours.toFixed(1)}h</span>
                            <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statusBadgeClass(task.status)}`}>{statusBadgeLabel(task.status)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
        </div>
      </div>

      {/* Clock-in/out FAB */}
      <button
        type="button"
        disabled={clockActionSaving}
        onClick={() => void handleClockEvent(isClockedIn ? 'clock_out' : 'clock_in')}
        className={`fixed bottom-6 right-6 z-50 flex h-16 w-16 flex-col items-center justify-center rounded-full shadow-[0_0_24px_rgba(163,230,53,0.35)] transition-all duration-200 active:scale-95 disabled:opacity-60 ${
          isClockedIn
            ? 'bg-slate-700 text-white shadow-none ring-1 ring-white/20'
            : 'animate-pulse-glow bg-lime-400 text-black'
        }`}
        aria-label={isClockedIn ? 'Clock out' : 'Clock in'}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {clockActionSaving ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <>
            <span className="text-[10px] font-bold leading-tight">{isClockedIn ? 'CLOCK' : 'CLOCK'}</span>
            <span className="text-[10px] font-bold leading-tight">{isClockedIn ? 'OUT' : 'IN'}</span>
          </>
        )}
      </button>
    </div>
  );

  return displayOnlyLayout;

  return (
    <div className="mx-auto w-full max-w-[520px] bg-background px-4 pb-24 pt-4 font-sans">
      {showWelcomeBanner ? (
        <div className="mb-3 rounded-xl border border-primary/20 bg-primary/10 p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-foreground">Welcome to Ground Crew HQ — your tasks for today are below.</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => {
                window.localStorage.setItem(onboardedKey, 'true');
                setShowWelcomeBanner(false);
              }}
            >
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}
      {isStandalone ? (
        <div className="mb-3 -mx-4 bg-emerald-600 px-4 py-2 text-sm font-medium text-white">
          <div className="mx-auto flex w-full max-w-[520px] items-center justify-between">
            <span>{employeeName}</span>
            <span>{new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
          </div>
        </div>
      ) : null}
      {isOfflineData ? (
        <div className="mb-3 rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm text-yellow-900">
          You're offline — showing cached data
        </div>
      ) : null}
      <header className="mb-4 rounded-2xl border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold leading-tight">{employeeName}</p>
            <p className="mt-1 text-base text-muted-foreground">{todayLabel}</p>
            <p className="mt-1 text-base text-muted-foreground">{propertyName}</p>
          </div>
          <div className="flex items-center rounded-md border bg-background p-1 text-xs font-medium">
            <button
              type="button"
              className={`rounded px-2 py-1 ${language === 'en' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              onClick={() => {
                setLanguage('en');
                window.localStorage.setItem(LANG_STORAGE_KEY, 'en');
              }}
            >
              EN
            </button>
            <span className="px-1 text-muted-foreground">|</span>
            <button
              type="button"
              className={`rounded px-2 py-1 ${language === 'es' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              onClick={() => {
                setLanguage('es');
                window.localStorage.setItem(LANG_STORAGE_KEY, 'es');
              }}
            >
              ES
            </button>
          </div>
        </div>
      </header>

      {!shift ? (
        <Card className="rounded-2xl p-5">
          <p className="text-base font-medium">{t.notScheduled}</p>
        </Card>
      ) : (
        <>
          <Card className="mb-4 rounded-2xl p-5">
            {!latestClockIn ? (
              <Button
                className="h-12 min-h-12 w-full bg-green-600 text-base hover:bg-green-700"
                disabled={clockActionSaving}
                onClick={() => void handleClockEvent('clock_in')}
              >
                {t.clockIn}
              </Button>
            ) : isClockedIn ? (
              <div className="space-y-3">
                <p className="text-base font-medium">Elapsed time: {elapsedLabel}</p>
                <Button
                  className="h-12 min-h-12 w-full bg-red-600 text-base hover:bg-red-700"
                  disabled={clockActionSaving}
                  onClick={() => void handleClockEvent('clock_out')}
                >
                  {t.clockOut}
                </Button>
              </div>
            ) : (
              <p className="text-base font-medium">{shiftCompleteLabel}</p>
            )}
          </Card>

          <Card className="mb-4 rounded-2xl p-5">
            <p className="text-base font-medium">{t.yourShift}: {formatTime(shift.shiftStart)} – {formatTime(shift.shiftEnd)}</p>
          </Card>

          <Button
            className="mb-4 h-12 min-h-12 w-full text-base"
            variant="outline"
            onClick={handleAddToCalendar}
          >
            Add to Calendar
          </Button>

          <Card className="mb-4 rounded-2xl p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-base font-semibold">Task Progress</p>
              <p className="text-base font-medium">{doneCount}/{assignments.length} {t.tasksDone}</p>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-green-600 transition-all duration-300"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </Card>

          {assignments.length === 0 ? (
            <Card className="rounded-2xl p-5">
              <p className="text-base font-medium">{t.noTasks}. Check with your supervisor.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {assignments.map((assignment) => {
                const normalizedStatus = displayStatus(assignment.status);
                const isSaving = Boolean(savingIds[assignment.id]);
                const category = assignment.taskId ? taskMetaById[assignment.taskId]?.category : null;
                return (
                  <Card key={assignment.id} className="rounded-2xl p-4">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold">{assignment.title}</h2>
                      <Badge className="text-sm">{category || 'General'}</Badge>
                    </div>
                    <div className="mb-2 flex flex-wrap gap-2">
                      <Badge variant="outline" className="text-sm">
                        {assignment.estimatedHours.toFixed(1)} hrs est.
                      </Badge>
                      <Badge className={`text-sm ${statusBadgeClass(assignment.status)}`}>
                        {statusBadgeLabel(assignment.status)}
                      </Badge>
                    </div>
                    {assignment.startTime ? <p className="text-base">Start: {formatTime(assignment.startTime)}</p> : null}
                    {assignment.location ? <p className="mt-1 text-base">Location: {assignment.location}</p> : null}
                    {assignment.notes ? <p className="mt-1 text-base">Notes: {assignment.notes}</p> : null}

                    {normalizedStatus === 'planned' ? (
                      <Button
                        className="mt-3 h-14 min-h-14 w-full bg-green-600 text-base font-semibold hover:bg-green-700"
                        disabled={isSaving}
                        onClick={() => void updateTaskStatus(assignment, 'in_progress')}
                      >
                        {t.start}
                      </Button>
                    ) : null}

                    {normalizedStatus === 'in_progress' ? (
                      <div className="mt-3 space-y-3">
                        <Button
                          className="h-14 min-h-14 w-full bg-blue-600 text-base font-semibold hover:bg-blue-700"
                          disabled={isSaving}
                          onClick={() => {
                            setActiveDonePromptId(assignment.id);
                            setActualHoursDraft((current) => ({
                              ...current,
                              [assignment.id]: current[assignment.id] ?? String(assignment.estimatedHours || 0),
                            }));
                          }}
                        >
                          {t.done}
                        </Button>

                        {activeDonePromptId === assignment.id ? (
                          <div className="rounded-xl border p-3">
                            <p className="mb-2 text-base font-medium">{t.howLong}</p>
                            <div className="grid grid-cols-4 gap-2">
                              {QUICK_HOURS_OPTIONS.map((option) => {
                                const selected = actualHoursDraft[assignment.id] === option;
                                return (
                                  <button
                                    key={option}
                                    type="button"
                                    className={`h-11 rounded-md border text-sm font-medium ${selected ? 'border-green-700 bg-green-100 text-green-900' : 'border-input bg-background text-foreground'}`}
                                    onClick={() => {
                                      setActualHoursDraft((current) => ({ ...current, [assignment.id]: option }));
                                      setShowOtherActualInputId(null);
                                    }}
                                  >
                                    {option}h
                                  </button>
                                );
                              })}
                              <button
                                type="button"
                                className={`h-11 rounded-md border text-sm font-medium ${showOtherActualInputId === assignment.id ? 'border-green-700 bg-green-100 text-green-900' : 'border-input bg-background text-foreground'}`}
                                onClick={() => setShowOtherActualInputId(assignment.id)}
                              >
                                Other
                              </button>
                            </div>

                            {showOtherActualInputId === assignment.id ? (
                              <Input
                                type="number"
                                min={0}
                                max={24}
                                step={0.5}
                                className="mt-2 h-11 text-base"
                                value={actualHoursDraft[assignment.id] ?? ''}
                                onChange={(event) =>
                                  setActualHoursDraft((current) => ({
                                    ...current,
                                    [assignment.id]: event.target.value,
                                  }))
                                }
                              />
                            ) : null}

                            <div className="mt-3 flex gap-2">
                              <Button
                                className="h-11 min-h-11 flex-1 text-base"
                                disabled={isSaving}
                                onClick={() => void completeTaskWithHours(assignment)}
                              >
                                Confirm Done
                              </Button>
                              <Button
                                className="h-11 min-h-11 px-4 text-base"
                                variant="outline"
                                onClick={() => {
                                  setActiveDonePromptId(null);
                                  setShowOtherActualInputId(null);
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {normalizedStatus === 'done' ? (
                      <div className="mt-3 flex h-14 min-h-14 items-center justify-center rounded-md bg-green-100 text-base font-semibold text-green-900">
                        {t.completed} ✓ · {(assignment.actualHours ?? assignment.estimatedHours ?? 0).toFixed(1)}h
                      </div>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      <footer className="fixed bottom-0 left-0 right-0 border-t bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto w-full max-w-[520px]">
          <p className="text-base font-semibold">
            {doneCount}/{assignments.length} {t.tasksDone} · {actualHoursTotal.toFixed(1)}h actual / {scheduledHoursTotal.toFixed(1)}h scheduled
          </p>
          <Button className="mt-2 h-12 min-h-12 w-full text-base" variant="outline" onClick={() => setNeedsOpen(true)}>
            {t.reportNeed}
          </Button>
        </div>
      </footer>

      {showInstallBanner && deferredInstallPrompt ? (
        <div className="fixed bottom-24 left-0 right-0 z-40 px-4">
          <div className="mx-auto flex w-full max-w-[520px] items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
            <p className="text-sm text-emerald-900">Install Ground Crew HQ for faster access</p>
            <div className="flex items-center gap-2">
              <Button size="sm" className="h-8" onClick={() => void triggerInstallPrompt()}>
                Install
              </Button>
              <Button size="sm" variant="outline" className="h-8" onClick={dismissInstallBanner}>
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {needsOpen ? (
        <div className="fixed inset-0 z-50 bg-background">
          <div className="mx-auto flex h-full w-full max-w-[520px] flex-col px-4 pb-4 pt-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t.reportNeed}</h2>
              <button
                type="button"
                className="rounded-md border px-3 py-1.5 text-sm"
                onClick={() => {
                  setNeedsOpen(false);
                  resetNeedsForm();
                }}
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Title</label>
                <Input
                  value={needsTitle}
                  onChange={(event) => setNeedsTitle(event.target.value)}
                  placeholder="Sprinkler head broken on hole 7"
                  className="h-12 text-base"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Priority</label>
                <select
                  value={needsPriority}
                  onChange={(event) => setNeedsPriority(event.target.value as 'low' | 'medium' | 'high')}
                  className="h-12 w-full rounded-md border border-input bg-background px-3 text-base"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Location</label>
                <Input
                  value={needsLocation}
                  onChange={(event) => setNeedsLocation(event.target.value)}
                  placeholder="Hole 7 fairway"
                  className="h-12 text-base"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Notes</label>
                <Textarea
                  value={needsNotes}
                  onChange={(event) => setNeedsNotes(event.target.value)}
                  placeholder="Add extra details"
                  className="min-h-24 text-base"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Photo (optional)</label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(event) => void handleNeedsPhotoChange(event.target.files?.[0] ?? null)}
                  className="h-12 text-base"
                />
                {needsPhotoBase64 ? <p className="mt-1 text-xs text-muted-foreground">Photo attached</p> : null}
              </div>
            </div>

            <div className="mt-4">
              <Button className="h-12 min-h-12 w-full text-base" onClick={() => void submitNeed()} disabled={needsSaving || !needsTitle.trim()}>
                {needsSaving ? 'Submitting...' : 'Submit Request'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
