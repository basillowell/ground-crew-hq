import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Clock, Loader2, Save, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from '@/components/ui/sonner';
import { EmptyState } from '@/components/EmptyState';
import { ErrorRetry } from '@/components/ErrorRetry';
import { PageSkeleton } from '@/components/PageSkeleton';
import { TableSkeleton } from '@/components/TableSkeleton';
import { AvatarInitials } from '@/components/shared';
import {
  DayCloseOutReviewRows,
  getChainedAssignmentRows,
  getChainedAssignmentStartTime,
} from '@/components/workboard/DayCloseOut';
import type { Assignment, Employee, Task } from '@/data/seedData';
import { useOrgProfile } from '@/hooks/useOrgProfile';
import { useProperties } from '@/lib/supabase-queries';
import { createClient } from '@/lib/supabase';
import { getOperationalTimezone, wallClockToStoredIso } from '@/lib/timeWorkflow';

const supabase = createClient();
const REVIEW_TIMEOUT_MS = 15000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EMPLOYEE_ACCENT_SWATCHES = [
  { solid: 'oklch(0.76 0.16 142)', soft: 'oklch(0.76 0.16 142 / 0.14)' },
  { solid: 'oklch(0.78 0.15 85)', soft: 'oklch(0.78 0.15 85 / 0.14)' },
  { solid: 'oklch(0.72 0.15 230)', soft: 'oklch(0.72 0.15 230 / 0.14)' },
  { solid: 'oklch(0.76 0.14 25)', soft: 'oklch(0.76 0.14 25 / 0.14)' },
  { solid: 'oklch(0.74 0.14 300)', soft: 'oklch(0.74 0.14 300 / 0.14)' },
  { solid: 'oklch(0.78 0.12 190)', soft: 'oklch(0.78 0.12 190 / 0.14)' },
];

type AssignmentReviewRow = {
  id: string;
  employee_id: string;
  property_id: string | null;
  task_id: string | null;
  date: string;
  location: string | null;
  status: string | null;
  order_index: number | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  actual_start_at: string | null;
  actual_completed_at: string | null;
  completed_at: string | null;
  start_time: string | null;
  title: string | null;
  approved_by: string | null;
  approved_at: string | null;
};

type ScheduleReviewRow = {
  id: string;
  employee_id: string;
  property_id: string;
  date: string;
  shift_start: string;
  shift_end: string;
  status: string | null;
};

type EmployeeReviewRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  property_id: string | null;
};

type TaskReviewRow = {
  id: string;
  name: string | null;
  category: string | null;
  estimated_hours: number | null;
  is_unpaid: boolean | null;
};

type SchedulerSettingsReviewRow = {
  default_break_minutes: number | null;
  default_break_paid: boolean | null;
  default_break_start_time: string | null;
};

type BreakPolicy = {
  defaultBreakMinutes: number;
  defaultBreakPaid: boolean;
  defaultBreakStartTime: string;
};

type ReviewData = {
  assignments: Array<Assignment & { approvedBy?: string | null; approvedAt?: string | null }>;
  schedules: ScheduleReviewRow[];
  employees: Employee[];
  tasks: Task[];
  breakPolicy: BreakPolicy;
};

type SupabaseResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

function withReviewTimeout<T>(promise: PromiseLike<T>, label: string, timeoutMs = REVIEW_TIMEOUT_MS): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out. Try again.`)), timeoutMs);
  });
  return Promise.race([Promise.resolve(promise), timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

function isUuid(value: string | null) {
  return Boolean(value && value !== 'all' && UUID_PATTERN.test(value));
}

function isDateKey(value: string | null) {
  return Boolean(value && DATE_PATTERN.test(value));
}

function formatDisplayDate(dateKey: string) {
  const value = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(value.getTime())) return dateKey;
  return value.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(value?: string | null) {
  const hhmm = String(value ?? '').slice(0, 5);
  if (!hhmm.includes(':')) return 'Not scheduled';
  const [hoursRaw, minutesRaw] = hhmm.split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 'Not scheduled';
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function formatEmployeeName(employee?: Employee | null) {
  if (!employee) return 'Unknown Employee';
  return `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim() || 'Unnamed Employee';
}

function getEmployeeAccent(employeeId?: string | null) {
  const key = employeeId || 'unknown-employee';
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }
  return EMPLOYEE_ACCENT_SWATCHES[hash % EMPLOYEE_ACCENT_SWATCHES.length];
}

function formatApprovedAt(value?: string | null) {
  if (!value) return 'unknown time';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function timeToMinutes(value?: string | null) {
  const hhmm = String(value ?? '').slice(0, 5);
  const [hours, minutes] = hhmm.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes: number) {
  const normalized = ((Math.round(totalMinutes) % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function addMinutesToTime(value: string, minutes: number) {
  return minutesToTime(timeToMinutes(value) + minutes);
}

function normalizeClockTime(value?: string | null, fallback = '11:00') {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value ?? '').trim());
  if (!match) return fallback;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return fallback;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function getTaskIsUnpaid(task?: Task | null) {
  return Boolean(task?.isUnpaid ?? task?.is_unpaid);
}

function getAssignmentIsUnpaid(assignment: Assignment, tasks: Task[]) {
  return getTaskIsUnpaid(tasks.find((task) => task.id === assignment.taskId));
}

function toEmployee(row: EmployeeReviewRow): Employee {
  return {
    id: row.id,
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    propertyId: row.property_id ?? undefined,
    group: 'General',
    role: 'Crew',
    wage: 0,
    phone: '',
    email: '',
    photo: '',
    status: 'active',
    department: 'Operations',
    language: 'English',
    workerType: 'full-time',
    hireDate: '',
  };
}

function toTask(row: TaskReviewRow): Task {
  return {
    id: row.id,
    name: row.name ?? 'Task',
    category: row.category ?? 'General',
    duration: Math.round(Number(row.estimated_hours ?? 0) * 60),
    estimatedHours: Number(row.estimated_hours ?? 0),
    estimated_hours: Number(row.estimated_hours ?? 0),
    color: 'oklch(var(--primary))',
    icon: 'list-checks',
    status: 'active',
    priority: 0,
    isUnpaid: Boolean(row.is_unpaid),
    is_unpaid: Boolean(row.is_unpaid),
  };
}

function toAssignment(row: AssignmentReviewRow): Assignment & { approvedBy?: string | null; approvedAt?: string | null } {
  const estimatedHours = Number(row.estimated_hours ?? 0);
  const safeEstimatedHours = Number.isFinite(estimatedHours) ? Math.max(estimatedHours, 0) : 0;
  return {
    id: row.id,
    employeeId: row.employee_id,
    propertyId: row.property_id ?? undefined,
    taskId: row.task_id ?? '',
    date: row.date,
    location: row.location ?? undefined,
    startTime: String(row.start_time ?? '06:00').slice(0, 5),
    duration: Math.round(safeEstimatedHours * 60),
    estimatedHours: safeEstimatedHours,
    actualHours: Number(row.actual_hours ?? 0),
    actual_hours: Number(row.actual_hours ?? 0),
    title: row.title ?? undefined,
    area: row.location ?? 'Unassigned area',
    order: row.order_index ?? undefined,
    actualStartAt: row.actual_start_at,
    actualCompletedAt: row.actual_completed_at,
    completedAt: row.completed_at,
    actual_start_at: row.actual_start_at,
    actual_completed_at: row.actual_completed_at,
    completed_at: row.completed_at,
    status: (String(row.status ?? 'planned').replace('_', '-') as Assignment['status']) ?? 'planned',
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
  };
}

async function fetchReviewData(orgId: string, employeeId: string, date: string): Promise<ReviewData> {
  const assignmentsPromise = withReviewTimeout(
    supabase
      .from('assignments')
      .select('id, employee_id, property_id, task_id, date, location, status, order_index, estimated_hours, actual_hours, actual_start_at, actual_completed_at, completed_at, start_time, title, approved_by, approved_at')
      .eq('org_id', orgId)
      .eq('employee_id', employeeId)
      .eq('date', date)
      .is('deleted_at', null)
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true }),
    'Assignments review fetch',
  );
  const schedulesPromise = withReviewTimeout(
    supabase
      .from('schedule_entries')
      .select('id, employee_id, property_id, date, shift_start, shift_end, status')
      .eq('org_id', orgId)
      .eq('employee_id', employeeId)
      .eq('date', date)
      .order('shift_start', { ascending: true }),
    'Schedule review fetch',
  );
  const employeesPromise = withReviewTimeout(
    supabase
      .from('employees')
      .select('id, first_name, last_name, property_id')
      .eq('org_id', orgId),
    'Employee review fetch',
  );
  const tasksPromise = withReviewTimeout(
    supabase
      .from('tasks')
      .select('id, name, category, estimated_hours, is_unpaid')
      .eq('org_id', orgId)
      .order('category', { ascending: true })
      .order('name', { ascending: true }),
    'Task review fetch',
  );
  const settingsPromise = withReviewTimeout(
    supabase
      .from('scheduler_settings')
      .select('default_break_minutes, default_break_paid, default_break_start_time')
      .eq('org_id', orgId)
      .maybeSingle(),
    'Break policy fetch',
  );

  const [assignmentsResult, schedulesResult, employeesResult, tasksResult, settingsResult] = await Promise.all([
    assignmentsPromise,
    schedulesPromise,
    employeesPromise,
    tasksPromise,
    settingsPromise,
  ]) as [
    SupabaseResult<AssignmentReviewRow[]>,
    SupabaseResult<ScheduleReviewRow[]>,
    SupabaseResult<EmployeeReviewRow[]>,
    SupabaseResult<TaskReviewRow[]>,
    SupabaseResult<SchedulerSettingsReviewRow>,
  ];

  if (assignmentsResult.error) throw assignmentsResult.error;
  if (schedulesResult.error) throw schedulesResult.error;
  if (employeesResult.error) throw employeesResult.error;
  if (tasksResult.error) throw tasksResult.error;
  if (settingsResult.error) throw settingsResult.error;
  const settings = settingsResult.data as SchedulerSettingsReviewRow | null;
  const configuredMinutes = Number(settings?.default_break_minutes ?? 30);
  const configuredBreakStartTime = normalizeClockTime(settings?.default_break_start_time, '11:00');

  return {
    assignments: ((assignmentsResult.data ?? []) as AssignmentReviewRow[]).map(toAssignment),
    schedules: (schedulesResult.data ?? []) as ScheduleReviewRow[],
    employees: ((employeesResult.data ?? []) as EmployeeReviewRow[]).map(toEmployee),
    tasks: ((tasksResult.data ?? []) as TaskReviewRow[]).map(toTask),
    breakPolicy: {
      defaultBreakMinutes: Number.isFinite(configuredMinutes) ? Math.max(0, Math.round(configuredMinutes)) : 30,
      defaultBreakPaid: Boolean(settings?.default_break_paid ?? false),
      defaultBreakStartTime: configuredBreakStartTime,
    },
  };
}

async function ensureBreakTask({
  orgId,
  propertyId,
  durationHours,
  isUnpaid,
}: {
  orgId: string;
  propertyId: string;
  durationHours: number;
  isUnpaid: boolean;
}): Promise<Task> {
  const taskSelect = 'id, name, category, estimated_hours, is_unpaid';
  const existingResult = await withReviewTimeout(
    supabase
      .from('tasks')
      .select(taskSelect)
      .eq('org_id', orgId)
      .eq('name', 'Lunch Break')
      .limit(1)
      .maybeSingle(),
    'Break task lookup',
  ) as SupabaseResult<TaskReviewRow>;
  if (existingResult.error) throw existingResult.error;

  const updatePayload = {
    category: 'Break',
    estimated_hours: durationHours,
    is_unpaid: isUnpaid,
    status: 'active',
  };
  if (existingResult.data) {
    const updateResult = await withReviewTimeout(
      supabase
        .from('tasks')
        .update(updatePayload)
        .eq('id', existingResult.data.id)
        .eq('org_id', orgId)
        .select(taskSelect)
        .single(),
      'Break task update',
    ) as SupabaseResult<TaskReviewRow>;
    if (updateResult.error) throw updateResult.error;
    if (!updateResult.data) throw new Error('Break task could not be loaded after update.');
    return toTask(updateResult.data);
  }

  const insertResult = await withReviewTimeout(
    supabase
      .from('tasks')
      .insert({
        org_id: orgId,
        property_id: propertyId,
        name: 'Lunch Break',
        category: 'Break',
        estimated_hours: durationHours,
        is_unpaid: isUnpaid,
        status: 'active',
        priority: 5,
      })
      .select(taskSelect)
      .single(),
    'Break task create',
  ) as SupabaseResult<TaskReviewRow>;
  if (insertResult.error) throw insertResult.error;
  if (!insertResult.data) throw new Error('Break task could not be created.');
  return toTask(insertResult.data);
}

async function insertBreakAssignment({
  orgId,
  employeeId,
  date,
  rows,
  insertIndex,
  timezone,
  breakPolicy,
}: {
  orgId: string;
  employeeId: string;
  date: string;
  rows: ReturnType<typeof getChainedAssignmentRows>;
  insertIndex: number;
  timezone: string;
  breakPolicy: BreakPolicy;
}) {
  if (insertIndex < 0 || insertIndex > rows.length) throw new Error('Choose a valid place for the break.');
  const breakMinutes = Math.max(0, Math.round(Number(breakPolicy.defaultBreakMinutes ?? 30)));
  if (breakMinutes <= 0) throw new Error('Set a break duration greater than 0 minutes before inserting a break.');
  const durationHours = Number((breakMinutes / 60).toFixed(2));
  const isUnpaid = !breakPolicy.defaultBreakPaid;
  const previousRow = rows[insertIndex - 1] ?? null;
  const nextRow = rows[insertIndex] ?? null;
  const propertyId = nextRow?.assignment.propertyId ?? previousRow?.assignment.propertyId ?? null;
  if (!propertyId || !isUuid(propertyId)) throw new Error('Could not identify the property for this break. Refresh the review and try again.');
  const breakStart = normalizeClockTime(breakPolicy.defaultBreakStartTime, '11:00');
  const breakEnd = addMinutesToTime(breakStart, breakMinutes);
  const breakTask = await ensureBreakTask({
    orgId,
    propertyId,
    durationHours,
    isUnpaid,
  });

  const insertResult = await withReviewTimeout(
    supabase
      .from('assignments')
      .insert({
        org_id: orgId,
        employee_id: employeeId,
        property_id: propertyId,
        task_id: breakTask.id,
        date,
        location: 'Break',
        status: 'completed',
        order_index: insertIndex + 1,
        estimated_hours: durationHours,
        actual_hours: durationHours,
        actual_start_at: wallClockToStoredIso(date, breakStart, timezone),
        actual_completed_at: wallClockToStoredIso(date, breakEnd, timezone),
        start_time: breakStart,
        title: breakTask.name,
      }),
    'Break assignment create',
  ) as SupabaseResult<null>;
  if (insertResult.error) throw insertResult.error;

  for (const [index, row] of rows.entries()) {
    if (!row.assignment.id) continue;
    const nextOrder = index >= insertIndex ? index + 2 : index + 1;
    const updateResult = await withReviewTimeout(
      supabase
        .from('assignments')
        .update({ order_index: nextOrder })
        .eq('id', row.assignment.id)
        .eq('org_id', orgId)
        .eq('employee_id', employeeId)
        .eq('date', date),
      'Break chain update',
    ) as SupabaseResult<null>;
    if (updateResult.error) throw updateResult.error;
  }
}

async function insertTaskAssignment({
  orgId,
  employeeId,
  date,
  rows,
  insertIndex,
  timezone,
  shiftStart,
  task,
}: {
  orgId: string;
  employeeId: string;
  date: string;
  rows: ReturnType<typeof getChainedAssignmentRows>;
  insertIndex: number;
  timezone: string;
  shiftStart: string;
  task: Task;
}) {
  if (insertIndex < 0 || insertIndex > rows.length) throw new Error('Choose a valid place for the task.');
  if (!isUuid(task.id)) throw new Error('Invalid task ID. Please reselect a task.');
  const previousRow = rows[insertIndex - 1] ?? null;
  const nextRow = rows[insertIndex] ?? null;
  const propertyId = nextRow?.assignment.propertyId ?? previousRow?.assignment.propertyId ?? null;
  if (!propertyId || !isUuid(propertyId)) throw new Error('Could not identify the property for this task. Refresh the review and try again.');
  const taskDurationHours = Number(task.estimatedHours ?? task.estimated_hours ?? 0);
  const durationHours = Number.isFinite(taskDurationHours) ? Math.max(0, taskDurationHours) : 0;
  const durationMinutes = Math.max(0, Math.round(durationHours * 60));
  const start = previousRow?.end || nextRow?.start || normalizeClockTime(shiftStart, '06:00');
  const end = addMinutesToTime(start, durationMinutes);

  const insertResult = await withReviewTimeout(
    supabase
      .from('assignments')
      .insert({
        org_id: orgId,
        employee_id: employeeId,
        property_id: propertyId,
        task_id: task.id,
        date,
        location: task.category ?? 'General',
        status: 'completed',
        order_index: insertIndex + 1,
        estimated_hours: durationHours,
        actual_hours: durationHours,
        actual_start_at: wallClockToStoredIso(date, start, timezone),
        actual_completed_at: wallClockToStoredIso(date, end, timezone),
        start_time: start,
        title: task.name,
      }),
    'Task assignment create',
  ) as SupabaseResult<null>;
  if (insertResult.error) throw insertResult.error;

  for (const [index, row] of rows.entries()) {
    if (!row.assignment.id) continue;
    const nextOrder = index >= insertIndex ? index + 2 : index + 1;
    const updateResult = await withReviewTimeout(
      supabase
        .from('assignments')
        .update({ order_index: nextOrder })
        .eq('id', row.assignment.id)
        .eq('org_id', orgId)
        .eq('employee_id', employeeId)
        .eq('date', date),
      'Task chain update',
    ) as SupabaseResult<null>;
    if (updateResult.error) throw updateResult.error;
  }
}

async function saveReviewedTimes({
  orgId,
  employeeId,
  date,
  rows,
  timezone,
  taskOverrides,
  tasks,
}: {
  orgId: string;
  employeeId: string;
  date: string;
  rows: ReturnType<typeof getChainedAssignmentRows>;
  timezone: string;
  taskOverrides: Record<string, string>;
  tasks: Task[];
}) {
  for (const row of rows) {
    if (!row.assignment.id) continue;
    const startIso = row.start ? wallClockToStoredIso(date, row.start, timezone) : null;
    const endIso = row.end ? wallClockToStoredIso(date, row.end, timezone) : null;
    const payload: Record<string, unknown> = {
      actual_start_at: startIso,
      actual_completed_at: endIso,
      actual_hours: Number(row.hours.toFixed(2)),
    };
    if (Object.prototype.hasOwnProperty.call(taskOverrides, row.assignment.id)) {
      const nextTaskId = taskOverrides[row.assignment.id] ?? '';
      if (nextTaskId && !isUuid(nextTaskId)) throw new Error('Invalid task ID. Please reselect a task.');
      const nextTask = nextTaskId ? tasks.find((task) => task.id === nextTaskId) : null;
      payload.task_id = nextTaskId || null;
      payload.title = nextTask?.name ?? null;
    }
    const updateResult = await withReviewTimeout(
      supabase
        .from('assignments')
        .update(payload)
        .eq('id', row.assignment.id)
        .eq('org_id', orgId)
        .eq('employee_id', employeeId)
        .eq('date', date),
      'Reviewed time save',
    ) as SupabaseResult<null>;
    if (updateResult.error) throw updateResult.error;
  }
}

export async function approveReviewedDay({ orgId, employeeId, date, assignmentIds }: { orgId: string; employeeId: string; date: string; assignmentIds: string[] }) {
  const reviewerResult = await withReviewTimeout(supabase.rpc('current_employee_id'), 'Reviewer lookup') as SupabaseResult<string>;
  if (reviewerResult.error) throw reviewerResult.error;
  const reviewerEmployeeId = reviewerResult.data ? String(reviewerResult.data) : '';
  if (!isUuid(reviewerEmployeeId)) throw new Error('Could not identify the approving employee. Try again after reconnecting.');

  const approvalResult = await withReviewTimeout(
    supabase
      .from('assignments')
      .update({ approved_by: reviewerEmployeeId, approved_at: new Date().toISOString() })
      .in('id', assignmentIds)
      .eq('org_id', orgId)
      .eq('employee_id', employeeId)
      .eq('date', date),
    'Day approval save',
  ) as SupabaseResult<null>;
  if (approvalResult.error) throw approvalResult.error;
}

async function softDeleteReviewedAssignment({ orgId, employeeId, date, assignmentId }: { orgId: string; employeeId: string; date: string; assignmentId: string }) {
  if (!isUuid(assignmentId)) throw new Error('Invalid assignment ID. Refresh and try again.');
  const reviewerResult = await withReviewTimeout(supabase.rpc('current_employee_id'), 'Reviewer lookup') as SupabaseResult<string>;
  if (reviewerResult.error) throw reviewerResult.error;
  const reviewerEmployeeId = reviewerResult.data ? String(reviewerResult.data) : '';
  if (!isUuid(reviewerEmployeeId)) throw new Error('Could not identify the deleting employee. Try again after reconnecting.');

  const deleteResult = await withReviewTimeout(
    supabase
      .from('assignments')
      .update({ deleted_at: 'now', deleted_by: reviewerEmployeeId })
      .eq('id', assignmentId)
      .eq('org_id', orgId)
      .eq('employee_id', employeeId)
      .eq('date', date)
      .is('deleted_at', null),
    'Assignment delete save',
  ) as SupabaseResult<null>;
  if (deleteResult.error) throw deleteResult.error;
}

type OpenTaskDayReviewPanelProps = {
  employeeId: string | null;
  date: string | null;
  className?: string;
  showBackButton?: boolean;
  onBack?: () => void;
  onApproved?: () => void;
};

export function OpenTaskDayReviewPanel({
  employeeId,
  date,
  className = 'main-content space-y-6 p-4 md:p-6',
  showBackButton = false,
  onBack,
  onApproved,
}: OpenTaskDayReviewPanelProps) {
  const { currentUser, orgId, userRole } = useOrgProfile();
  const role = String(userRole ?? currentUser?.role ?? '').toLowerCase();
  const canReview = role === 'admin' || role === 'manager';
  const validEmployeeId = isUuid(employeeId) ? employeeId ?? '' : '';
  const validDate = isDateKey(date) ? date ?? '' : '';
  const queryOrgId = canReview && orgId ? orgId : '';
  const queryClient = useQueryClient();
  const propertiesQuery = useProperties(queryOrgId || undefined);
  const [startOverrides, setStartOverrides] = useState<Record<string, string>>({});
  const [endOverrides, setEndOverrides] = useState<Record<string, string>>({});
  const [taskOverrides, setTaskOverrides] = useState<Record<string, string>>({});
  const [deletingAssignmentId, setDeletingAssignmentId] = useState<string | null>(null);
  const [insertingBreakIndex, setInsertingBreakIndex] = useState<number | null>(null);
  const [insertingTaskIndex, setInsertingTaskIndex] = useState<number | null>(null);

  useEffect(() => {
    setStartOverrides({});
    setEndOverrides({});
    setTaskOverrides({});
    setInsertingBreakIndex(null);
    setInsertingTaskIndex(null);
  }, [validEmployeeId, validDate]);

  const reviewQuery = useQuery({
    queryKey: ['open-tasks-day-review', queryOrgId, validEmployeeId, validDate],
    queryFn: () => fetchReviewData(queryOrgId, validEmployeeId, validDate),
    enabled: Boolean(queryOrgId && validEmployeeId && validDate),
    staleTime: 1000 * 60,
    retry: 2,
    retryDelay: 1000,
  });

  const reviewData = reviewQuery.data;
  const employee = reviewData?.employees.find((row) => row.id === validEmployeeId) ?? null;
  const employeeAccent = getEmployeeAccent(validEmployeeId);
  const schedules = reviewData?.schedules ?? [];
  const firstSchedule = schedules[0] ?? null;
  const latestSchedule = schedules.reduce<ScheduleReviewRow | null>((latest, schedule) => {
    if (!latest) return schedule;
    return timeToMinutes(schedule.shift_end) > timeToMinutes(latest.shift_end) ? schedule : latest;
  }, null);
  const propertyById = useMemo(
    () => new Map((propertiesQuery.data ?? []).map((property) => [property.id, property])),
    [propertiesQuery.data],
  );
  const reviewProperty = firstSchedule?.property_id
    ? propertyById.get(firstSchedule.property_id)
    : reviewData?.assignments[0]?.propertyId
      ? propertyById.get(reviewData.assignments[0].propertyId ?? '')
      : null;
  const operationalTimezone = getOperationalTimezone(reviewProperty);
  const shiftStart = firstSchedule?.shift_start?.slice(0, 5) ?? reviewData?.assignments[0]?.startTime ?? '06:00';
  const shiftEnd = latestSchedule?.shift_end?.slice(0, 5) ?? '17:00';
  const taskById = useMemo(() => new Map((reviewData?.tasks ?? []).map((task) => [task.id, task])), [reviewData?.tasks]);
  const reviewAssignments = useMemo(
    () => (reviewData?.assignments ?? []).map((assignment) => {
      const assignmentId = assignment.id ?? '';
      if (!Object.prototype.hasOwnProperty.call(taskOverrides, assignmentId)) return assignment;
      const taskId = taskOverrides[assignmentId] ?? '';
      const selectedTask = taskId ? taskById.get(taskId) : null;
      return {
        ...assignment,
        taskId,
        title: selectedTask?.name ?? undefined,
      };
    }),
    [reviewData?.assignments, taskById, taskOverrides],
  );

  const rows = useMemo(
    () => getChainedAssignmentRows({
      assignments: reviewAssignments,
      shiftStart,
      nowTime: shiftEnd,
      timezone: operationalTimezone,
      startOverrides,
      endOverrides,
    }),
    [endOverrides, operationalTimezone, reviewAssignments, shiftEnd, shiftStart, startOverrides],
  );
  const firstDerivedStart = reviewAssignments[0]
    ? getChainedAssignmentStartTime({
        assignment: reviewAssignments[0],
        assignments: reviewAssignments,
        shiftStart,
        nowTime: shiftEnd,
        timezone: operationalTimezone,
      })
    : shiftStart;
  const reviewTasks = reviewData?.tasks ?? [];
  const totalScheduled = rows.reduce((sum, row) => sum + Number(row.assignment.estimatedHours ?? 0), 0);
  const totalLogged = rows.reduce((sum, row) => sum + row.hours, 0);
  const totalUnpaid = rows.reduce((sum, row) => sum + (getAssignmentIsUnpaid(row.assignment, reviewTasks) ? row.hours : 0), 0);
  const totalActual = Math.max(0, totalLogged - totalUnpaid);
  const paidAssignmentCount = rows.filter((row) => !getAssignmentIsUnpaid(row.assignment, reviewTasks)).length;
  const assignmentIds = rows.map((row) => row.assignment.id).filter((id): id is string => Boolean(id));
  const approvedRows = (reviewData?.assignments ?? []).filter((assignment) => assignment.approvedBy || assignment.approvedAt);
  const isApproved = approvedRows.length > 0;
  const firstApproval = approvedRows[0] ?? null;
  const approver = firstApproval?.approvedBy ? reviewData?.employees.find((row) => row.id === firstApproval.approvedBy) : null;
  const hasUnsavedEdits = Object.keys(startOverrides).length > 0 || Object.keys(endOverrides).length > 0 || Object.keys(taskOverrides).length > 0;
  const saveMutation = useMutation({
    mutationFn: () => saveReviewedTimes({ orgId: queryOrgId, employeeId: validEmployeeId, date: validDate, rows, timezone: operationalTimezone, taskOverrides, tasks: reviewData?.tasks ?? [] }),
    onSuccess: async () => {
      setStartOverrides({});
      setEndOverrides({});
      setTaskOverrides({});
      await Promise.all([
        reviewQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: ['assignments'] }),
        queryClient.invalidateQueries({ queryKey: ['open-assignments-backlog'], refetchType: 'all' }),
      ]);
      toast.success('Reviewed times saved.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Reviewed times could not be saved.');
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (assignmentId: string) => softDeleteReviewedAssignment({ orgId: queryOrgId, employeeId: validEmployeeId, date: validDate, assignmentId }),
    onMutate: (assignmentId) => {
      setDeletingAssignmentId(assignmentId);
    },
    onSuccess: async () => {
      setStartOverrides({});
      setEndOverrides({});
      setTaskOverrides({});
      await Promise.all([
        reviewQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: ['assignments'] }),
        queryClient.invalidateQueries({ queryKey: ['open-assignments-backlog'], refetchType: 'all' }),
      ]);
      toast.success('Assignment removed from review.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Assignment could not be removed.');
    },
    onSettled: () => {
      setDeletingAssignmentId(null);
    },
  });
  const insertBreakMutation = useMutation({
    mutationFn: async (insertIndex: number) => {
      if (hasUnsavedEdits) {
        await saveReviewedTimes({ orgId: queryOrgId, employeeId: validEmployeeId, date: validDate, rows, timezone: operationalTimezone, taskOverrides, tasks: reviewData?.tasks ?? [] });
      }
      return insertBreakAssignment({
      orgId: queryOrgId,
      employeeId: validEmployeeId,
      date: validDate,
      rows,
      insertIndex,
      timezone: operationalTimezone,
      breakPolicy: reviewData?.breakPolicy ?? { defaultBreakMinutes: 30, defaultBreakPaid: false, defaultBreakStartTime: '11:00' },
      });
    },
    onMutate: (insertIndex) => {
      setInsertingBreakIndex(insertIndex);
    },
    onSuccess: async () => {
      setStartOverrides({});
      setEndOverrides({});
      setTaskOverrides({});
      await Promise.all([
        reviewQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: ['assignments'] }),
        queryClient.invalidateQueries({ queryKey: ['open-assignments-backlog'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['tasks', queryOrgId] }),
      ]);
      toast.success('Break inserted.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Break could not be inserted.');
    },
    onSettled: () => {
      setInsertingBreakIndex(null);
    },
  });
  const insertTaskMutation = useMutation({
    mutationFn: async ({ insertIndex, task }: { insertIndex: number; task: Task }) => {
      if (hasUnsavedEdits) {
        await saveReviewedTimes({ orgId: queryOrgId, employeeId: validEmployeeId, date: validDate, rows, timezone: operationalTimezone, taskOverrides, tasks: reviewData?.tasks ?? [] });
      }
      return insertTaskAssignment({
        orgId: queryOrgId,
        employeeId: validEmployeeId,
        date: validDate,
        rows,
        insertIndex,
        timezone: operationalTimezone,
        shiftStart,
        task,
      });
    },
    onMutate: ({ insertIndex }) => {
      setInsertingTaskIndex(insertIndex);
    },
    onSuccess: async () => {
      setStartOverrides({});
      setEndOverrides({});
      setTaskOverrides({});
      await Promise.all([
        reviewQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: ['assignments'] }),
        queryClient.invalidateQueries({ queryKey: ['open-assignments-backlog'], refetchType: 'all' }),
      ]);
      toast.success('Task inserted.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Task could not be inserted.');
    },
    onSettled: () => {
      setInsertingTaskIndex(null);
    },
  });
  const approveMutation = useMutation({
    mutationFn: () => approveReviewedDay({ orgId: queryOrgId, employeeId: validEmployeeId, date: validDate, assignmentIds }),
    onSuccess: async () => {
      await Promise.all([
        reviewQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: ['assignments'] }),
        queryClient.invalidateQueries({ queryKey: ['open-assignments-backlog'], refetchType: 'all' }),
      ]);
      onApproved?.();
      toast.success('Day approved.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Day could not be approved.');
    },
  });
  const saveAndApproveMutation = useMutation({
    mutationFn: async () => {
      await saveReviewedTimes({ orgId: queryOrgId, employeeId: validEmployeeId, date: validDate, rows, timezone: operationalTimezone, taskOverrides, tasks: reviewData?.tasks ?? [] });
      await approveReviewedDay({ orgId: queryOrgId, employeeId: validEmployeeId, date: validDate, assignmentIds });
    },
    onSuccess: async () => {
      setStartOverrides({});
      setEndOverrides({});
      setTaskOverrides({});
      await Promise.all([
        reviewQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: ['assignments'] }),
        queryClient.invalidateQueries({ queryKey: ['open-assignments-backlog'], refetchType: 'all' }),
      ]);
      onApproved?.();
      toast.success('Reviewed times saved and day approved.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Day could not be saved and approved.');
    },
  });

  const handleTaskChange = (assignmentId: string, taskId: string) => {
    if (isApproved) return;
    if (taskId && !isUuid(taskId)) {
      toast.error('Invalid task ID. Please reselect a task.');
      return;
    }
    setTaskOverrides((current) => ({ ...current, [assignmentId]: taskId }));
  };

  const handleStartChange = (assignmentId: string, startTime: string) => {
    if (isApproved) return;
    setStartOverrides((current) => ({ ...current, [assignmentId]: startTime }));
  };

  const handleEndChange = (assignmentId: string, endTime: string) => {
    if (isApproved) return;
    setEndOverrides((current) => ({ ...current, [assignmentId]: endTime }));
  };

  const handleDeleteAssignment = (assignmentId: string) => {
    if (deleteMutation.isPending || saveMutation.isPending || saveAndApproveMutation.isPending || approveMutation.isPending || insertBreakMutation.isPending || insertTaskMutation.isPending) return;
    const row = rows.find((item) => item.assignment.id === assignmentId);
    const taskLabel = row?.assignment.title || reviewData?.tasks.find((task) => task.id === row?.assignment.taskId)?.name || 'this assignment';
    const confirmed = window.confirm(`Remove ${taskLabel} from this day review? This soft-deletes the assignment and removes it from Open Tasks.`);
    if (!confirmed) return;
    deleteMutation.mutate(assignmentId);
  };

  const handleInsertBreak = (insertIndex: number) => {
    if (isApproved || insertBreakMutation.isPending || insertTaskMutation.isPending || saveMutation.isPending || saveAndApproveMutation.isPending || deleteMutation.isPending || approveMutation.isPending) return;
    insertBreakMutation.mutate(insertIndex);
  };

  const handleInsertTask = (insertIndex: number, taskId: string) => {
    if (isApproved || insertTaskMutation.isPending || insertBreakMutation.isPending || saveMutation.isPending || saveAndApproveMutation.isPending || deleteMutation.isPending || approveMutation.isPending) return;
    if (!isUuid(taskId)) {
      toast.error('Invalid task ID. Please reselect a task.');
      return;
    }
    const task = taskById.get(taskId);
    if (!task) {
      toast.error('Could not find that task. Refresh and try again.');
      return;
    }
    insertTaskMutation.mutate({ insertIndex, task });
  };

  const handleApprove = () => {
    if (isApproved || approveMutation.isPending || saveMutation.isPending || saveAndApproveMutation.isPending || insertBreakMutation.isPending || insertTaskMutation.isPending) return;
    if (hasUnsavedEdits) {
      toast.info('Save reviewed times before approving the day.');
      return;
    }
    if (assignmentIds.length === 0) {
      toast.info('No assignments are available to approve.');
      return;
    }
    const confirmed = window.confirm(`Approve ${assignmentIds.length} assignment${assignmentIds.length === 1 ? '' : 's'} for ${formatEmployeeName(employee)} on ${formatDisplayDate(validDate)}?`);
    if (!confirmed) return;
    approveMutation.mutate();
  };

  const handleSaveAndApprove = () => {
    if (isApproved || saveAndApproveMutation.isPending || approveMutation.isPending || saveMutation.isPending || insertBreakMutation.isPending || insertTaskMutation.isPending) return;
    if (assignmentIds.length === 0) {
      toast.info('No assignments are available to approve.');
      return;
    }
    const confirmed = window.confirm(`Save reviewed times and approve ${assignmentIds.length} assignment${assignmentIds.length === 1 ? '' : 's'} for ${formatEmployeeName(employee)} on ${formatDisplayDate(validDate)}?`);
    if (!confirmed) return;
    saveAndApproveMutation.mutate();
  };

  if (!canReview) {
    return (
      <div className={className}>
        <Card className="border-surface-border bg-surface-card p-8 text-center shadow-sm">
          <ShieldCheck className="mx-auto h-8 w-8 text-status-pending" />
          <h2 className="mt-3 text-lg font-semibold text-text-primary">Supervisor access required</h2>
          <p className="mt-1 text-sm text-text-muted">Day reviews are available to admins and managers.</p>
        </Card>
      </div>
    );
  }

  if (!validEmployeeId || !validDate) {
    return (
      <div className={className}>
        {showBackButton && onBack ? (
          <Button type="button" variant="ghost" className="gap-2" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            Back to Open Tasks
          </Button>
        ) : null}
        <ErrorRetry message="Choose a valid employee and date from Open Tasks before reviewing a day." onRetry={onBack ?? (() => undefined)} />
      </div>
    );
  }

  return (
    <div className={className}>
      <div
        className="space-y-4 rounded-xl border border-l-4 bg-surface-card/35 p-4 shadow-sm"
        style={{
          borderColor: employeeAccent.soft,
          borderLeftColor: employeeAccent.solid,
          boxShadow: `inset 1px 0 0 ${employeeAccent.soft}`,
        }}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            {showBackButton && onBack ? (
              <Button type="button" variant="ghost" className="mb-3 gap-2 px-0" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
                Back to Open Tasks
              </Button>
            ) : null}
            <div className="flex items-center gap-2 text-sm font-medium text-status-pending">
              <Clock className="h-4 w-4" />
              Daily closeout review
            </div>
            <div
              className="mt-3 flex max-w-2xl items-center gap-3 rounded-xl border border-surface-border border-l-4 bg-surface-card/80 px-3 py-3 shadow-sm"
              style={{
                borderLeftColor: employeeAccent.solid,
                backgroundImage: `linear-gradient(90deg, ${employeeAccent.soft}, transparent 68%)`,
              }}
            >
              <AvatarInitials
                firstName={employee?.firstName ?? ''}
                lastName={employee?.lastName ?? ''}
                size="lg"
                className="border-2"
                style={{
                  backgroundColor: employeeAccent.soft,
                  borderColor: employeeAccent.solid,
                  color: employeeAccent.solid,
                }}
              />
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-semibold text-text-primary">
                  {formatEmployeeName(employee)}
                </h1>
                <p className="mt-0.5 text-sm font-medium text-text-muted">{formatDisplayDate(validDate)}</p>
              </div>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-text-muted">
              Review logged task times against the scheduled shift before approval.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              className="min-h-10 gap-2"
              onClick={() => saveMutation.mutate()}
              disabled={isApproved || rows.length === 0 || saveMutation.isPending || saveAndApproveMutation.isPending || deleteMutation.isPending || insertBreakMutation.isPending || insertTaskMutation.isPending || reviewQuery.isLoading}
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save reviewed times
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-10 gap-2"
              onClick={handleApprove}
              disabled={isApproved || rows.length === 0 || approveMutation.isPending || saveMutation.isPending || saveAndApproveMutation.isPending || deleteMutation.isPending || insertBreakMutation.isPending || insertTaskMutation.isPending}
            >
              {approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Approve day
            </Button>
            <Button
              type="button"
              className="min-h-10 gap-2"
              onClick={handleSaveAndApprove}
              disabled={isApproved || rows.length === 0 || saveAndApproveMutation.isPending || approveMutation.isPending || saveMutation.isPending || deleteMutation.isPending || insertBreakMutation.isPending || insertTaskMutation.isPending || reviewQuery.isLoading}
            >
              {saveAndApproveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Save & Approve
            </Button>
          </div>
        </div>

        {reviewQuery.isLoading ? (
          <PageSkeleton />
        ) : reviewQuery.error ? (
          <ErrorRetry
            message={reviewQuery.error instanceof Error ? reviewQuery.error.message : 'Could not load the day review.'}
            onRetry={() => void reviewQuery.refetch()}
          />
        ) : !reviewData ? (
          <TableSkeleton />
        ) : (
          <>
            <div className="grid gap-3 lg:grid-cols-4">
              <Card className="border-surface-border bg-surface-card p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Scheduled shift</p>
                <p className="mt-2 text-lg font-semibold text-text-primary">{formatTime(firstSchedule?.shift_start)}-{formatTime(firstSchedule?.shift_end)}</p>
                <p className="mt-1 text-xs text-text-muted">{schedules.length > 1 ? `${schedules.length} shift entries found` : reviewProperty?.name ?? 'Schedule entry'}</p>
              </Card>
              <Card className="border-surface-border bg-surface-card p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Assignments</p>
                <p className="mt-2 text-2xl font-semibold text-text-primary">{paidAssignmentCount}</p>
                <p className="mt-1 text-xs text-text-muted">Full day context</p>
              </Card>
              <Card className="border-surface-border bg-surface-card p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Hours</p>
                <p className="mt-2 text-2xl font-semibold text-text-primary">{totalActual.toFixed(2)}</p>
                <p className="mt-1 text-xs text-text-muted">Logged {totalLogged.toFixed(2)}h - unpaid {totalUnpaid.toFixed(2)}h</p>
                <p className="mt-1 text-xs text-text-muted">Scheduled {totalScheduled.toFixed(1)}h - first start {firstDerivedStart}</p>
              </Card>
              <Card className="border-surface-border bg-surface-card p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Approval</p>
                {isApproved ? (
                  <>
                    <p className="mt-2 text-sm font-semibold text-status-success">Approved</p>
                    <p className="mt-1 text-xs text-text-muted">
                      By {formatEmployeeName(approver)} at {formatApprovedAt(firstApproval?.approvedAt)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-sm font-semibold text-status-pending">Not approved</p>
                    <p className="mt-1 text-xs text-text-muted">Save reviewed times, then approve.</p>
                  </>
                )}
              </Card>
            </div>

            {isApproved ? (
              <div className="rounded-lg border border-status-success/30 bg-status-success/10 px-4 py-3 text-sm text-status-success">
                This day is already approved and is shown read-only. Re-opening approved time is a separate supervisor action.
              </div>
            ) : hasUnsavedEdits ? (
              <div className="rounded-lg border border-status-pending/30 bg-status-pending/10 px-4 py-3 text-sm text-status-pending">
                You have unsaved time edits. Save reviewed times or use Save & Approve when the day is ready.
              </div>
            ) : null}

            {rows.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No assignments for this day"
                description="The selected employee has no assignments on this date."
              />
            ) : (
              <Card className="border-surface-border bg-surface-card p-4 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-text-primary">Assignments reviewed</h2>
                    <p className="mt-1 text-xs text-text-muted">Start time is prefilled from the shift and previous task end. Edit task, start, or end time before saving.</p>
                  </div>
                  <Badge variant="outline" className="border-surface-border text-text-secondary">
                    {formatTime(shiftStart)}-{formatTime(shiftEnd)} shift window
                  </Badge>
                </div>
                <DayCloseOutReviewRows
                  rows={rows}
                  tasks={reviewData.tasks}
                  disabled={isApproved || saveMutation.isPending || saveAndApproveMutation.isPending || approveMutation.isPending || deleteMutation.isPending || insertBreakMutation.isPending || insertTaskMutation.isPending}
                  showScheduledHours
                  onTaskChange={handleTaskChange}
                  onStartChange={handleStartChange}
                  onEndChange={handleEndChange}
                  onDelete={handleDeleteAssignment}
                  deletingAssignmentId={deletingAssignmentId}
                  deleteDisabled={saveMutation.isPending || saveAndApproveMutation.isPending || approveMutation.isPending || deleteMutation.isPending || insertBreakMutation.isPending || insertTaskMutation.isPending}
                  onInsertBreak={handleInsertBreak}
                  insertBreakDisabled={isApproved || saveMutation.isPending || saveAndApproveMutation.isPending || approveMutation.isPending || deleteMutation.isPending || insertBreakMutation.isPending || insertTaskMutation.isPending}
                  insertingBreakIndex={insertingBreakIndex}
                  onInsertTask={handleInsertTask}
                  insertTaskDisabled={isApproved || saveMutation.isPending || saveAndApproveMutation.isPending || approveMutation.isPending || deleteMutation.isPending || insertBreakMutation.isPending || insertTaskMutation.isPending}
                  insertingTaskIndex={insertingTaskIndex}
                />
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
