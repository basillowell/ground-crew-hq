import { type ReactNode, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PageHeader } from '@/components/shared';
import { TimeSelect } from '@/components/TimeSelect';
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
  Calendar,
  ClipboardCopy,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  CloudSun,
  FileText,
  GanttChart,
  HelpCircle,
  LayoutList,
  ListChecks,
  Mail,
  MessageCircle,
  MonitorSmartphone,
  Pencil,
  Printer,
  Radio,
  Sparkles,
  StickyNote,
  Users,
  Wrench,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useAssignments, useDepartmentOptions, useEmployees, useEquipmentUnits, useProperties, useScheduleEntries, useTasks } from '@/lib/supabase-queries';
import { fetchNwsWeather } from '@/lib/weather/providers';
import {
  getOperationalTimezone,
  getNowHHMMInTimezone,
  storedIsoToWallClock,
  storedIsoToWallClockLabel,
  wallClockToStoredIso,
} from '@/lib/timeWorkflow';
import { formatTime } from '@/utils/formatTime';
import { PageSkeleton } from '@/components/PageSkeleton';
import { ErrorRetry } from '@/components/ErrorRetry';
import { EmptyState } from '@/components/EmptyState';
import { CardSkeleton } from '@/components/CardSkeleton';

const GanttTimeline = lazy(() =>
  import('@/components/workboard/GanttTimeline').then((module) => ({ default: module.GanttTimeline })),
);
const EmployeeRow = lazy(() =>
  import('@/components/workboard/EmployeeRow').then((module) => ({ default: module.EmployeeRow })),
);
function SafeSection({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  try {
    return <>{children}</>;
  } catch {
    return <>{fallback}</>;
  }
}

async function withWorkboardRequestTimeout<T>(request: PromiseLike<T>) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Workboard request timed out after 15 seconds.')), 15_000);
  });
  try {
    return await Promise.race([request, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function getShiftForEmployee(scheduleList: ScheduleEntry[], employeeId: string, date: string) {
  return scheduleList.find((entry) => entry.employeeId === employeeId && entry.date === date);
}

function getDefaultStartTimeForEmployee(scheduleList: ScheduleEntry[], employeeId: string, date: string) {
  return getShiftForEmployee(scheduleList, employeeId, date)?.shiftStart ?? '05:30';
}

function timeToMinutes(value?: string) {
  if (!value) return 0;
  const [hours, minutes] = value.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
  return hours * 60 + minutes;
}

function addDaysToDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (![year, month, day].every(Number.isFinite)) return dateKey;
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getIsoTimestampMs(value: string | null | undefined) {
  const timestamp = new Date(String(value ?? '')).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function formatMinutesAsHoursAndMinutes(totalMinutes: number) {
  const safe = Math.max(0, totalMinutes);
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function normalizeAssignmentStatus(status?: string) {
  const value = String(status ?? '').toLowerCase();
  if (value === 'in_progress' || value === 'in-progress') return 'in-progress';
  if (value === 'done' || value === 'complete' || value === 'completed') return 'done';
  return 'planned';
}

function toAssignmentWriteStatus(status?: string) {
  const value = String(status ?? '').toLowerCase();
  if (value === 'in-progress' || value === 'in_progress') return 'in_progress';
  if (value === 'done' || value === 'complete' || value === 'completed') return 'done';
  return 'planned';
}

function coverageBadgeClass(coveragePercent: number) {
  if (coveragePercent >= 80) return 'border-status-active/20 bg-status-active/10 text-status-active';
  if (coveragePercent >= 50) return 'border-status-pending/20 bg-status-pending/10 text-status-pending';
  return 'border-status-warning/20 bg-status-warning/10 text-status-warning';
}

function getEstimatedHoursForAssignment(assignment: Assignment) {
  const estimate = Number(assignment.estimatedHours ?? 0);
  if (Number.isFinite(estimate) && estimate > 0) return estimate;
  const durationHours = Number(assignment.duration ?? 0) / 60;
  return Number.isFinite(durationHours) ? Math.max(durationHours, 0) : 0;
}

function getActualHoursTone(actualHours: number, estimatedHours: number) {
  if (actualHours <= 0 || estimatedHours <= 0) return 'text-text-muted';
  const ratio = actualHours / estimatedHours;
  if (ratio <= 1) return 'text-status-active';
  if (ratio < 1.25) return 'text-status-pending';
  return 'text-status-warning';
}

type AssignmentTimelineMeta = {
  id: string;
  employeeId: string;
  date: string;
  orderIndex: number;
  status: string;
  actualStartAt: string | null;
  actualCompletedAt: string | null;
  actualHours: number | null;
};

type WorkboardClockEventRow = {
  id: string;
  employeeId: string;
  propertyId: string;
  eventType: string;
  timestamp: string;
};

type WorkboardBreakChip = {
  id: string;
  employeeId: string;
  startIso: string;
  endIso: string | null;
  startLabel: string;
  endLabel: string | null;
  durationLabel: string | null;
  sortMinutes: number;
};

type TaskRowDraft = {
  id: string;
  propertyId: string;
  taskId: string;
  equipmentId: string;
  startTime: string;
  status: 'planned' | 'in_progress' | 'done';
  hoursOverride: string;
};

function makeEmptyTaskRow(startTime = '05:30', propertyId = ''): TaskRowDraft {
  return {
    id: makeId(),
    propertyId,
    taskId: '',
    equipmentId: '',
    startTime,
    status: 'planned',
    hoursOverride: '',
  };
}

function toLocalTimeLabel(value: string | null | undefined, timezone: string) {
  if (!value) return '';
  // Workboard actual times are treated as property-local operational wall-clock times.
  return storedIsoToWallClockLabel(value, timezone);
}

function toTimeInputValue(value: string | null | undefined, timezone: string) {
  if (!value) return '';
  return storedIsoToWallClock(value, timezone);
}

function taskRowClass(status: string) {
  const normalized = normalizeAssignmentStatus(status);
  if (normalized === 'in-progress') return 'border-l-[3px] border-l-status-complete bg-status-complete/5';
  if (normalized === 'done') return 'border-l-[3px] border-l-status-active bg-status-active/5';
  return 'border-l-[3px] border-l-text-muted bg-surface-card';
}

function makeId() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2, 14)}`;
}

const VALID_ASSIGNMENT_STATUSES = new Set(['planned', 'in_progress', 'done']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidUuid(value: string | null | undefined) {
  return UUID_PATTERN.test(String(value ?? '').trim());
}

function isValidAssignmentDate(value: string | null | undefined) {
  return DATE_PATTERN.test(String(value ?? '').trim());
}

function validateAssignmentWritePayload(payload: {
  employee_id: string;
  task_id: string;
  org_id: string;
  date: string;
  status: string;
}) {
  if (!isValidUuid(payload.employee_id)) return 'Invalid employee ID. Please select a crew member.';
  if (!isValidUuid(payload.task_id)) return 'Invalid task ID. Please reselect a task.';
  if (!payload.org_id) return 'Missing organization context.';
  if (!isValidAssignmentDate(payload.date)) return 'Invalid assignment date.';
  if (!VALID_ASSIGNMENT_STATUSES.has(payload.status)) return 'Invalid assignment status.';
  return null;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeApplicationArea(row: Record<string, unknown>): ApplicationArea {
  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    property: String(row.property ?? row.propertyName ?? ''),
    weatherLocationId: String(row.weatherLocationId ?? row.weather_location_id ?? ''),
  };
}

type NeedsQueueRequest = {
  id: string;
  propertyId: string;
  date: string;
  title: string;
  taskId?: string;
  submittedBy?: string;
  requestedBy: string;
  requestedByType: 'client' | 'manager' | 'crew';
  priority: 'high' | 'medium' | 'low';
  status: 'new' | 'assigned' | 'dismissed' | string;
  preferredLocation?: string;
  location?: string;
  notes: string;
  createdAt?: string;
};

function normalizeTaskRequest(row: Record<string, unknown>): NeedsQueueRequest {
  const fallbackLocation = row.preferredLocation ? String(row.preferredLocation) : row.preferred_location ? String(row.preferred_location) : undefined;
  const location = row.location ? String(row.location) : row.preferred_location ? String(row.preferred_location) : row.preferredLocation ? String(row.preferredLocation) : undefined;
  return {
    id: String(row.id ?? ''),
    propertyId: String(row.propertyId ?? row.property_id ?? ''),
    date: String(row.date ?? ''),
    title: String(row.title ?? ''),
    taskId: row.taskId ? String(row.taskId) : row.task_id ? String(row.task_id) : undefined,
    submittedBy: row.submittedBy ? String(row.submittedBy) : row.submitted_by ? String(row.submitted_by) : row.employee_id ? String(row.employee_id) : undefined,
    requestedBy: String(row.requestedBy ?? row.requested_by ?? 'Client Request'),
    requestedByType: (row.requestedByType ?? row.requested_by_type ?? 'client') as TaskRequest['requestedByType'],
    priority: (row.priority ?? 'medium') as TaskRequest['priority'],
    status: (row.status ?? 'new') as NeedsQueueRequest['status'],
    preferredLocation: fallbackLocation,
    location,
    notes: String(row.notes ?? ''),
    createdAt: row.createdAt ? String(row.createdAt) : row.created_at ? String(row.created_at) : undefined,
  };
}

function formatRelativeTime(value?: string) {
  if (!value) return 'just now';
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 'just now';
  const deltaMs = Date.now() - timestamp;
  const deltaMinutes = Math.max(1, Math.floor(deltaMs / 60000));
  if (deltaMinutes < 60) return `${deltaMinutes} minute${deltaMinutes === 1 ? '' : 's'} ago`;
  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) return `${deltaHours} hour${deltaHours === 1 ? '' : 's'} ago`;
  const deltaDays = Math.floor(deltaHours / 24);
  return `${deltaDays} day${deltaDays === 1 ? '' : 's'} ago`;
}

function normalizeEscalationThresholds(value: unknown): EscalationThresholds {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return {
    equipmentServiceOverdueDays: Number(raw.equipment_service_overdue_days ?? DEFAULT_ESCALATION_THRESHOLDS.equipmentServiceOverdueDays),
    shiftCoverageWarningPct: Number(raw.shift_coverage_warning_pct ?? DEFAULT_ESCALATION_THRESHOLDS.shiftCoverageWarningPct),
    windSpeedSprayCutoffMph: Number(raw.wind_speed_spray_cutoff_mph ?? DEFAULT_ESCALATION_THRESHOLDS.windSpeedSprayCutoffMph),
    rainProbabilitySprayCutoffPct: Number(raw.rain_probability_spray_cutoff_pct ?? DEFAULT_ESCALATION_THRESHOLDS.rainProbabilitySprayCutoffPct),
    heatAdvisoryTempF: Number(raw.heat_advisory_temp_f ?? DEFAULT_ESCALATION_THRESHOLDS.heatAdvisoryTempF),
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

function normalizeWorkboardNote(row: Record<string, unknown>): WorkboardScopedNote {
  const createdAt = String(row.created_at ?? '');
  return {
    id: String(row.id ?? ''),
    type: (row.type ?? 'general') as Note['type'],
    title: String(row.title ?? 'Note'),
    content: String(row.content ?? ''),
    author: row.created_by ? String(row.created_by) : 'System',
    date: row.date ? String(row.date) : createdAt ? createdAt.slice(0, 10) : '',
    location: row.location ? String(row.location) : undefined,
    propertyId: row.property_id ? String(row.property_id) : null,
    employeeId: row.employee_id ? String(row.employee_id) : null,
    assignmentId: row.assignment_id ? String(row.assignment_id) : null,
    createdAt,
  };
}

function normalizeClockEvent(row: Record<string, unknown>): WorkboardClockEventRow {
  return {
    id: String(row.id ?? ''),
    employeeId: String(row.employee_id ?? row.employeeId ?? ''),
    propertyId: String(row.property_id ?? row.propertyId ?? ''),
    eventType: String(row.event_type ?? row.eventType ?? ''),
    timestamp: String(row.timestamp ?? ''),
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

type PendingTaskRequest = {
  id: string;
  org_id?: string | null;
  employee_id?: string | null;
  property_id?: string | null;
  date: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  created_at?: string | null;
};

type WorkOrderBoardItem = {
  id: string;
  title: string;
  status: string;
  priority: string;
  source: 'work_order' | 'schedule_fallback';
  employeeName?: string;
};

type NoteScope = 'org' | 'property' | 'employee' | 'task';

type WorkboardScopedNote = Note & {
  propertyId: string | null;
  employeeId: string | null;
  assignmentId: string | null;
  createdAt: string;
};

type TaskLibraryItem = {
  id: string;
  name: string;
  category: string | null;
  estimated_hours: number | null;
};

type AvailableEquipmentItem = {
  id: string;
  name: string | null;
  unit_name: string | null;
  type: string | null;
  status: string | null;
  active: boolean | null;
  org_id: string | null;
};

type RecurringTaskRuleRow = {
  id: string;
  task_id: string;
  employee_id: string | null;
  property_id: string | null;
  days_of_week: string[] | null;
  active: boolean | null;
};

type TaskWeatherWarning = {
  level: 'warning' | 'danger';
  message: string;
};

type DispatchWeatherConflict = {
  hasSprayConflict: boolean;
  sprayMessage: string | null;
  heatMessage: string | null;
};

type WorkboardWeatherSnapshot = {
  temperature: number;
  windSpeed: number;
  precipitationProbability: number;
  weatherCode: number;
};

type EscalationThresholds = {
  equipmentServiceOverdueDays: number;
  shiftCoverageWarningPct: number;
  windSpeedSprayCutoffMph: number;
  rainProbabilitySprayCutoffPct: number;
  heatAdvisoryTempF: number;
};

const DEFAULT_ESCALATION_THRESHOLDS: EscalationThresholds = {
  equipmentServiceOverdueDays: 90,
  shiftCoverageWarningPct: 50,
  windSpeedSprayCutoffMph: 10,
  rainProbabilitySprayCutoffPct: 40,
  heatAdvisoryTempF: 95,
};

type EscalationAlert = {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: string;
};

type QuickPlanSuggestion = {
  sourceId: string;
  employeeId: string;
  taskId: string | null;
  title: string;
  estimatedHours: number;
  status: string;
  propertyId: string | null;
};

type SuggestedTaskItem = {
  id: string;
  tone: 'opportunity' | 'warning' | 'urgent';
  title: string;
  detail: string;
  actionLabel?: string;
  onAction?: () => void;
};

type SopItem = {
  id: string;
  title: string;
  icon: React.ReactNode;
  checklist: string[];
};

const SOP_ITEMS: SopItem[] = [
  {
    id: 'mowing-greens',
    title: 'Mowing Greens',
    icon: <Wrench className="h-4 w-4 text-emerald-600" />,
    checklist: [
      'Verify mower height setting',
      'Check fuel',
      'Mow in alternating direction',
      'Clean mower after use',
      'Report any damage',
    ],
  },
  {
    id: 'spray-application',
    title: 'Spray Application',
    icon: <CloudSun className="h-4 w-4 text-amber-600" />,
    checklist: [
      'Check wind speed (<10mph)',
      'Verify product label',
      'Calibrate sprayer',
      'Wear required PPE',
      'Log application in Chemical Logs',
      'Record weather conditions',
    ],
  },
  {
    id: 'irrigation-check',
    title: 'Irrigation Check',
    icon: <Radio className="h-4 w-4 text-blue-600" />,
    checklist: [
      'Walk all zones',
      'Check for leaks/broken heads',
      'Verify run times',
      'Adjust for recent rainfall',
      'Report issues',
    ],
  },
  {
    id: 'bunker-maintenance',
    title: 'Bunker Maintenance',
    icon: <ListChecks className="h-4 w-4 text-text-muted" />,
    checklist: [
      'Rake all bunkers',
      'Check drainage',
      'Repair washouts',
      'Edge lips',
      'Report sand levels',
    ],
  },
];

export default function WorkboardContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentPropertyId, setCurrentPropertyId, currentUser, orgId: authOrgId, userRole } = useAuth();
  const isReadOnly = String(userRole ?? '') === 'viewer';
  const getLocalDateKey = useCallback(() => new Date().toLocaleDateString('en-CA'), []);
  const [boardDate, setBoardDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [department, setDepartment] = useState('All Departments');
  const [groupFilter, setGroupFilter] = useState('all');
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [isAssignmentModalDirty, setIsAssignmentModalDirty] = useState(false);
  const [quickPlanDialogOpen, setQuickPlanDialogOpen] = useState(false);
  const [taskTemplateDialogOpen, setTaskTemplateDialogOpen] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteScope, setNoteScope] = useState<NoteScope>('org');
  const [selectedNotePropertyId, setSelectedNotePropertyId] = useState('');
  const [selectedNoteEmployeeId, setSelectedNoteEmployeeId] = useState('');
  const [selectedNoteAssignmentId, setSelectedNoteAssignmentId] = useState('');
  const [linkedRequestId, setLinkedRequestId] = useState<string | null>(null);
  const [linkedRequestTitle, setLinkedRequestTitle] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [draggingEmployeeId, setDraggingEmployeeId] = useState<string | null>(null);
  const [dropTargetEmployeeId, setDropTargetEmployeeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');
  const [lastRealtimeRefreshAt, setLastRealtimeRefreshAt] = useState<number | null>(null);
  const [laneOrder, setLaneOrder] = useState<string[]>([]);
  const [needsFilter, setNeedsFilter] = useState<'all' | 'open' | 'done'>('all');
  const [weatherSnapshot, setWeatherSnapshot] = useState<WorkboardWeatherSnapshot | null>(null);
  const [dismissedEscalationIds, setDismissedEscalationIds] = useState<string[]>([]);
  const [assignmentFlashMap, setAssignmentFlashMap] = useState<Record<string, 'complete' | 'started'>>({});
  const [actualHoursMenuAssignmentId, setActualHoursMenuAssignmentId] = useState<string | null>(null);
  const [actualHoursCustomInputByAssignment, setActualHoursCustomInputByAssignment] = useState<Record<string, string>>({});
  const [savingTimelineAssignmentId, setSavingTimelineAssignmentId] = useState<string | null>(null);
  const [savingBreakEmployeeId, setSavingBreakEmployeeId] = useState<string | null>(null);
  const [timelineEditAssignmentId, setTimelineEditAssignmentId] = useState<string | null>(null);
  const [timelineEditStart, setTimelineEditStart] = useState('');
  const [timelineEditEnd, setTimelineEditEnd] = useState('');
  const timelineSaveGuardRef = useRef<Record<string, number>>({});
  const timelineSaveWarnedRef = useRef<Record<string, boolean>>({});
  const pendingDeleteTimeoutsRef = useRef<Record<string, number>>({});
  const assignmentFlashTimeoutsRef = useRef<Record<string, number>>({});
  const [draggingTask, setDraggingTask] = useState<{ employeeId: string; assignmentId: string } | null>(null);
  const [selectedTemplateTaskIds, setSelectedTemplateTaskIds] = useState<string[]>([]);
  const [selectedTemplateEmployeeIds, setSelectedTemplateEmployeeIds] = useState<string[]>([]);
  const [applyTemplateToAllCrew, setApplyTemplateToAllCrew] = useState(true);
  const [applyingTaskTemplate, setApplyingTaskTemplate] = useState(false);
  const [expandedMobileCrewIds, setExpandedMobileCrewIds] = useState<string[]>([]);
  const [expandedDesktopCrewId, setExpandedDesktopCrewId] = useState<string | null>(null);
  const [quickPlanLoading, setQuickPlanLoading] = useState(false);
  const [quickPlanApplying, setQuickPlanApplying] = useState(false);
  const [quickPlanError, setQuickPlanError] = useState<string | null>(null);
  const [quickPlanSuggestions, setQuickPlanSuggestions] = useState<QuickPlanSuggestion[]>([]);
  const [selectedQuickPlanIds, setSelectedQuickPlanIds] = useState<string[]>([]);
  const [quickPlanEmptyMessage, setQuickPlanEmptyMessage] = useState<string | null>(null);
  const [suggestedTasksCollapsed, setSuggestedTasksCollapsed] = useState(false);
  const [sopCollapsed, setSopCollapsed] = useState(true);
  const [expandedSopIds, setExpandedSopIds] = useState<string[]>([]);
  const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState<string[]>([]);
  const [taskRows, setTaskRows] = useState<TaskRowDraft[]>(() => [makeEmptyTaskRow()]);
  const [weatherConflictOverride, setWeatherConflictOverride] = useState(false);
  const [mobileSectionsOpen, setMobileSectionsOpen] = useState({
    scheduledCrew: false,
    weather: true,
    notes: false,
    escalations: false,
  });
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 640,
  );
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [workOrdersExpanded, setWorkOrdersExpanded] = useState(false);
  const [sendScheduleDialogOpen, setSendScheduleDialogOpen] = useState(false);
  const [selectedScheduleRecipientIds, setSelectedScheduleRecipientIds] = useState<string[]>([]);
  const [endOfDayDialogOpen, setEndOfDayDialogOpen] = useState(false);
  const [endOfDayReportText, setEndOfDayReportText] = useState('');
  const [endOfDayReportCondensed, setEndOfDayReportCondensed] = useState('');
  const [endOfDayReportSubject, setEndOfDayReportSubject] = useState('');
  const [endOfDayReportGenerating, setEndOfDayReportGenerating] = useState(false);
  const [isGeneratingTaskNotes, setIsGeneratingTaskNotes] = useState(false);
  const [showFirstVisitHint, setShowFirstVisitHint] = useState(false);
  const boardDateInputRef = useRef<HTMLInputElement>(null);
  const assignmentFirstFieldRef = useRef<HTMLSelectElement | null>(null);
  const lastAssignmentModalTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    document.title = 'Workflow — Ground Crew HQ';
  }, []);

  const triggerAssignmentFlash = useCallback((assignmentId: string, tone: 'complete' | 'started') => {
    if (!assignmentId) return;
    setAssignmentFlashMap((current) => ({ ...current, [assignmentId]: tone }));
    const activeTimeout = assignmentFlashTimeoutsRef.current[assignmentId];
    if (activeTimeout) {
      window.clearTimeout(activeTimeout);
    }
    assignmentFlashTimeoutsRef.current[assignmentId] = window.setTimeout(() => {
      setAssignmentFlashMap((current) => {
        const next = { ...current };
        delete next[assignmentId];
        return next;
      });
      delete assignmentFlashTimeoutsRef.current[assignmentId];
    }, 2200);
  }, []);

  const laneOrderStorageKey = useMemo(
    () => `workflow-lane-order:${boardDate}:${department}:${groupFilter}`,
    [boardDate, department, groupFilter],
  );

  const [assignmentDraft, setAssignmentDraft] = useState({
    employeeId: '',
    propertyId: '',
    taskId: '',
    equipmentId: '',
    startTime: '05:30',
    status: 'planned' as Assignment['status'],
    notes: '',
  });

  const [noteDraft, setNoteDraft] = useState({
    type: 'daily' as Note['type'],
    title: '',
    content: '',
    author: 'Operations Admin',
    location: '',
  });
  const [savingNote, setSavingNote] = useState(false);
  const workflowParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const focusedPropertyId = workflowParams.get('property') || '';
  const effectivePropertyId = currentPropertyId || (currentUser?.role === 'employee' ? currentUser.propertyId : 'all');

  const openNoteDialog = () => {
    setSelectedNotePropertyId((current) =>
      current || (effectivePropertyId && effectivePropertyId !== 'all' ? effectivePropertyId : (properties[0]?.id ?? '')),
    );
    setSelectedNoteEmployeeId((current) => current || (scheduledEmployees[0]?.id ?? ''));
    setSelectedNoteAssignmentId((current) => current || (dayAssignments[0]?.id ?? ''));
    setNoteDialogOpen(true);
  };

  const toggleScheduleRecipient = useCallback((employeeId: string) => {
    setSelectedScheduleRecipientIds((current) =>
      current.includes(employeeId) ? current.filter((id) => id !== employeeId) : [...current, employeeId],
    );
  }, []);

  const orgId = authOrgId ?? currentUser?.orgId;
  const safeOrgId = authOrgId ?? currentUser?.orgId ?? '';
  const { data: storeProperties = [], isLoading: propertiesLoading } = useProperties(orgId);
  const { data: storeEmployees = [], isLoading: employeesLoading } = useEmployees(
    effectivePropertyId === 'all' ? undefined : effectivePropertyId,
    orgId,
  );
  const assignmentsQuery = useAssignments(boardDate, effectivePropertyId, orgId);
  const scheduleQuery = useScheduleEntries(boardDate, effectivePropertyId, orgId);
  const {
    data: taskOptions = [],
    isLoading: isLoadingTasks,
    error: tasksError,
    refetch: refetchTasks,
  } = useTasks(undefined, authOrgId ?? undefined);
  const showTaskLoading = isLoadingTasks && taskOptions.length === 0;
  const equipmentQuery = useEquipmentUnits(effectivePropertyId, orgId);
  const notesQuery = useQuery({
    queryKey: ['notes', orgId ?? 'all-orgs'],
    enabled: Boolean(orgId),
    queryFn: async () => {
      if (!supabase || !orgId) return [] as WorkboardScopedNote[];
      const { data, error } = await withWorkboardRequestTimeout(
        supabase
          .from('notes')
          .select('*')
          .eq('org_id', orgId)
          .order('created_at', { ascending: false }),
      );
      if (error) throw error;
      return (data ?? []).map((row) => normalizeWorkboardNote(row as Record<string, unknown>));
    },
    staleTime: 1000 * 60 * 5,
    retry: 3,
    retryDelay: 1000,
  });
  const departmentsQuery = useDepartmentOptions(orgId);
  const taskLibraryError = (tasksError as { message?: string } | null)?.message ?? null;

  const availableEquipmentQuery = useQuery({
    queryKey: ['workboard-available-equipment', orgId ?? 'all-orgs'],
    enabled: Boolean(orgId),
    queryFn: async () => {
      if (!supabase || !orgId) return [] as AvailableEquipmentItem[];
      const { data, error } = await withWorkboardRequestTimeout(
        supabase
          .from('equipment_units')
          .select('id, name, unit_name, type, status, active, org_id')
          .eq('org_id', orgId)
          .eq('active', true)
          .eq('status', 'available')
          .order('unit_name', { ascending: true }),
      );
      if (error) throw error;
      return (data ?? []) as AvailableEquipmentItem[];
    },
    staleTime: 1000 * 60 * 2,
  });

  const taskRequestsQuery = useQuery({
    queryKey: ['task-requests', boardDate, effectivePropertyId ?? 'all', orgId ?? 'all-orgs'],
    enabled: Boolean(orgId),
    queryFn: async () => {
      if (!supabase) return [] as NeedsQueueRequest[];
      let query = supabase.from('task_requests').select('*').order('priority', { ascending: true }).order('created_at', { ascending: false });
      if (orgId) query = query.eq('org_id', orgId);
      if (effectivePropertyId && effectivePropertyId !== 'all') query = query.eq('property_id', effectivePropertyId);
      const { data, error } = await withWorkboardRequestTimeout(query);
      if (error) throw error;
      return (data ?? []).map((row) => normalizeTaskRequest(row as Record<string, unknown>));
    },
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 30,
  });

  const escalationThresholdsQuery = useQuery({
    queryKey: ['workboard-escalation-thresholds', orgId ?? 'all-orgs'],
    enabled: Boolean(orgId),
    queryFn: async () => {
      if (!supabase || !orgId) return DEFAULT_ESCALATION_THRESHOLDS;
      const { data, error } = await withWorkboardRequestTimeout(
        supabase
          .from('scheduler_settings')
          .select('escalation_config')
          .eq('org_id', orgId)
          .single(),
      );
      if (error) {
        return DEFAULT_ESCALATION_THRESHOLDS;
      }
      const config = (data as { escalation_config?: unknown } | null)?.escalation_config;
      return normalizeEscalationThresholds(config);
    },
    staleTime: 1000 * 60,
  });

  const pendingTaskRequestsQuery = useQuery({
    queryKey: ['task-requests-pending', boardDate, effectivePropertyId ?? 'all', orgId ?? 'all-orgs'],
    enabled: Boolean(orgId),
    queryFn: async () => {
      if (!supabase) return [] as PendingTaskRequest[];
      const today = getLocalDateKey();
      let query = supabase
        .from('task_requests')
        .select('*')
        .eq('status', 'pending')
        .eq('date', today)
        .order('created_at', { ascending: true });
      if (effectivePropertyId && effectivePropertyId !== 'all') query = query.eq('property_id', effectivePropertyId);
      if (orgId) query = query.eq('org_id', orgId);
      const { data, error } = await withWorkboardRequestTimeout(query);
      if (error) throw error;
      return (data ?? []) as PendingTaskRequest[];
    },
    staleTime: 1000 * 60,
    refetchInterval: 1000 * 30,
  });

  const weatherLogsQuery = useQuery({
    queryKey: ['weather-daily-logs', boardDate, orgId ?? 'all-orgs'],
    enabled: Boolean(orgId),
    queryFn: async () => {
      try {
        if (!supabase) return [] as WeatherDailyLog[];
        let locationQuery = supabase
          .from('weather_locations')
          .select('id, name, property, area, latitude, longitude, org_id, is_active')
          .eq('org_id', orgId ?? '');
        locationQuery = locationQuery.eq('is_active', true);
        if (effectivePropertyId && effectivePropertyId !== 'all') {
          locationQuery = locationQuery.eq('property', effectivePropertyId);
        }
        const { data: locationRows, error: locationError } = await withWorkboardRequestTimeout(locationQuery);
        if (locationError) return [] as WeatherDailyLog[];
        const locationIds = (locationRows ?? [])
          .map((row) => String((row as { id?: unknown }).id ?? ''))
          .filter(Boolean);
        if (locationIds.length === 0) return [] as WeatherDailyLog[];
        const query = supabase
          .from('weather_daily_logs')
          .select('*')
          .eq('date', boardDate)
          .in('location_id', locationIds);
        const { data, error } = await withWorkboardRequestTimeout(query);
        if (error) return [] as WeatherDailyLog[];
        return (data ?? []).map((row) => normalizeWeatherLog(row as Record<string, unknown>));
      } catch {
        return [] as WeatherDailyLog[];
      }
    },
    staleTime: 1000 * 60 * 5,
  });

  const weatherLocationsQuery = useQuery({
    queryKey: ['weather-locations', effectivePropertyId ?? 'all', orgId ?? 'all-orgs'],
    enabled: Boolean(orgId),
    queryFn: async () => {
      if (!supabase) return [] as WeatherLocation[];
      let query = supabase
        .from('weather_locations')
        .select('id, name, property, area, latitude, longitude, org_id, is_active')
        .eq('is_active', true);
      if (orgId) query = query.eq('org_id', orgId);
      if (effectivePropertyId && effectivePropertyId !== 'all') query = query.eq('property', effectivePropertyId);
      const { data, error } = await withWorkboardRequestTimeout(query);
      if (error) return [] as WeatherLocation[];
      return (data ?? []).map((row) => normalizeWeatherLocation(row as Record<string, unknown>));
    },
    staleTime: 1000 * 60 * 5,
  });
  const workOrdersQuery = useQuery({
    queryKey: ['work-orders', boardDate, effectivePropertyId ?? 'all', orgId ?? 'all-orgs'],
    enabled: Boolean(orgId && workOrdersExpanded),
    queryFn: async () => {
      if (!supabase) return [] as Array<Record<string, unknown>>;
      let query = supabase.from('work_orders').select('*').order('created_at', { ascending: false });
      if (orgId) query = query.eq('org_id', orgId);
      if (effectivePropertyId && effectivePropertyId !== 'all') query = query.eq('property_id', effectivePropertyId);
      const { data, error } = await withWorkboardRequestTimeout(query);
      if (error) throw error;
      return (data ?? []) as Array<Record<string, unknown>>;
    },
    staleTime: 1000 * 60 * 2,
  });

  const workLocationsQuery = useQuery({
    queryKey: ['work-locations', effectivePropertyId ?? 'all', orgId ?? 'all-orgs'],
    enabled: Boolean(orgId),
    queryFn: async () => {
      if (!supabase) return [] as WorkLocation[];
      let query = supabase.from('work_locations').select('*');
      if (orgId) query = query.eq('org_id', orgId);
      const { data, error } = await withWorkboardRequestTimeout(query);
      if (error) return [] as WorkLocation[];
      return (data ?? []).map((row) => normalizeWorkLocation(row as Record<string, unknown>));
    },
    staleTime: 1000 * 60 * 5,
  });

  const properties = storeProperties;
  const employeeList = useMemo(
    () =>
      storeEmployees
        .filter(
          (employee) =>
            !effectivePropertyId ||
            effectivePropertyId === 'all' ||
            employee.propertyId === effectivePropertyId,
        )
        .filter((employee) => String(employee.role ?? '').toLowerCase() !== 'viewer'),
    [effectivePropertyId, storeEmployees],
  );
  const employeeListRef = useRef(employeeList);

  useEffect(() => {
    employeeListRef.current = employeeList;
  }, [employeeList]);

  const assignmentList = assignmentsQuery.data ?? [];
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.info('[workboard:data]', {
      boardDate,
      orgId: currentUser?.orgId ?? null,
      propertyId: effectivePropertyId,
      scheduleEntries: scheduleQuery.data?.length ?? 0,
      assignments: assignmentList.length,
      scheduleStatus: scheduleQuery.status,
      assignmentStatus: assignmentsQuery.status,
    });
  }, [
    assignmentList.length,
    assignmentsQuery.status,
    boardDate,
    currentUser?.orgId,
    effectivePropertyId,
    scheduleQuery.data?.length,
    scheduleQuery.status,
  ]);
  const assignmentTimelineById = useMemo(() => {
    const map = new Map<string, AssignmentTimelineMeta>();
    for (const assignment of assignmentList) {
      if (!assignment.id) continue;
      map.set(assignment.id, {
        id: assignment.id,
        employeeId: assignment.employeeId,
        date: assignment.date,
        orderIndex: assignment.order ?? 0,
        status: String(assignment.status ?? 'planned'),
        actualStartAt: assignment.actualStartAt ?? assignment.actual_start_at ?? null,
        actualCompletedAt:
          assignment.actualCompletedAt ??
          assignment.actual_completed_at ??
          assignment.completedAt ??
          assignment.completed_at ??
          null,
        actualHours: assignment.actualHours ?? assignment.actual_hours ?? null,
      });
    }
    return map;
  }, [assignmentList]);
  const assignmentTimelineRecord = useMemo(() => {
    const record: Record<string, { actualStartAt: string | null; actualCompletedAt: string | null }> = {};
    for (const [id, row] of assignmentTimelineById.entries()) {
      record[id] = { actualStartAt: row.actualStartAt, actualCompletedAt: row.actualCompletedAt };
    }
    return record;
  }, [assignmentTimelineById]);
  const scheduleList = scheduleQuery.data ?? [];
  const taskList = useMemo(
    () =>
      taskOptions
        .filter((t) => String(t.status ?? 'active').toLowerCase() !== 'inactive')
        .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999) || a.name.localeCompare(b.name)),
    [taskOptions],
  );
  const taskLibrary = useMemo<TaskLibraryItem[]>(
    () =>
      taskList.map((task) => ({
        id: task.id,
        name: task.name,
        category: task.category,
        estimated_hours: Number(task.duration ?? 0) / 60,
      })),
    [taskList],
  );
  const groupedTaskLibrary = useMemo(() => {
    return taskLibrary.reduce<Record<string, TaskLibraryItem[]>>((acc, task) => {
      const key = task.category?.trim() || 'General';
      if (!acc[key]) acc[key] = [];
      acc[key].push(task);
      return acc;
    }, {});
  }, [taskLibrary]);
  const orderedTaskCategories = useMemo(
    () => Object.keys(groupedTaskLibrary).sort((a, b) => a.localeCompare(b)),
    [groupedTaskLibrary],
  );
  const equipmentList = equipmentQuery.data ?? [];
  const availableEquipmentList = availableEquipmentQuery.data ?? [];
  const dayAssignments = useMemo(() => {
    return assignmentList.filter((assignment) => assignment.date === boardDate);
  }, [assignmentList, boardDate]);
  const noteList = notesQuery.data ?? [];
  const taskRequests = taskRequestsQuery.data ?? [];
  const pendingTaskRequests = pendingTaskRequestsQuery.data ?? [];
  const weatherLogs = weatherLogsQuery.data ?? [];
  const weatherLocations = weatherLocationsQuery.data ?? [];
  const workLocations = workLocationsQuery.data ?? [];
  const workOrders = workOrdersQuery.data ?? [];
  const departmentOptions = useMemo(
    () => ['All Departments', ...(departmentsQuery.data?.map((entry) => entry.name) ?? [])],
    [departmentsQuery.data],
  );
  const weatherStripProperty = useMemo(
    () => properties.find((property) => property.id === effectivePropertyId) ?? properties[0] ?? null,
    [effectivePropertyId, properties],
  );
  const previousWeekDateKey = useMemo(() => {
    const selectedDate = new Date(`${boardDate}T00:00:00`);
    const previousDate = new Date(selectedDate);
    previousDate.setDate(previousDate.getDate() - 7);
    return previousDate.toISOString().slice(0, 10);
  }, [boardDate]);
  const previousWeekAssignmentsQuery = useAssignments(
    previousWeekDateKey,
    effectivePropertyId,
    orgId,
  );
  const previousWeekSummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const assignment of previousWeekAssignmentsQuery.data ?? []) {
      const title = assignment.title?.trim() ?? '';
      if (!title) continue;
      counts.set(title, (counts.get(title) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([title, count]) => ({ title, count }))
      .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))
      .slice(0, 5);
  }, [previousWeekAssignmentsQuery.data]);
  const hourlyWeatherStripQuery = useQuery({
    queryKey: ['workboard-hourly-strip', boardDate, weatherStripProperty?.id ?? 'no-property'],
    enabled: Boolean(orgId && weatherStripProperty?.latitude && weatherStripProperty?.longitude),
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      if (!weatherStripProperty?.latitude || !weatherStripProperty?.longitude) return [] as Array<{
        hour: number;
        temp: number;
        wind: number;
        precip: number;
        weatherCode: number;
      }>;
      const payload = await fetchNwsWeather({
        latitude: weatherStripProperty.latitude,
        longitude: weatherStripProperty.longitude,
        timezone: 'America/New_York',
      });
      const points = payload.hourly.filter((point) => point.time.slice(0, 10) === boardDate);
      if (points.length === 0) return [] as Array<{
        hour: number;
        temp: number;
        wind: number;
        precip: number;
        weatherCode: number;
      }>;
      const byHour = new Map(points.map((point) => [new Date(point.time).getHours(), point]));
      return Array.from({ length: 13 }, (_, index) => {
        const hour = index + 6;
        const point = byHour.get(hour);
        return {
          hour,
          temp: Number(point?.temperature ?? 0),
          wind: Number(point?.windSpeed ?? 0),
          precip: Number(point?.precipitationProbability ?? 0),
          weatherCode: Number(point?.weatherCode ?? -1),
        };
      }).filter((entry) => entry.weatherCode >= 0);
    },
  });

  const recurringRulesQuery = useQuery({
    queryKey: ['recurring-task-rules', currentUser?.orgId ?? 'all-orgs', effectivePropertyId ?? 'all'],
    enabled: false,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      if (!supabase || !currentUser?.orgId) return [] as RecurringTaskRuleRow[];
      let query = supabase
        .from('recurring_task_rules')
        .select('id, task_id, employee_id, property_id, days_of_week, active')
        .eq('org_id', currentUser.orgId)
        .eq('active', true);
      if (effectivePropertyId && effectivePropertyId !== 'all') {
        query = query.or(`property_id.is.null,property_id.eq.${effectivePropertyId}`);
      }
      const { data, error } = await withWorkboardRequestTimeout(query);
      if (error) throw error;
      return (data ?? []) as RecurringTaskRuleRow[];
    },
  });

  const suggestionDismissStorageKey = useMemo(
    () => `workboard-suggested-dismissed:${currentUser?.orgId ?? 'no-org'}:${effectivePropertyId ?? 'all'}:${boardDate}`,
    [boardDate, currentUser?.orgId, effectivePropertyId],
  );
  const sopExpandedStorageKey = useMemo(
    () => `workboard-sop-expanded:${currentUser?.orgId ?? 'no-org'}`,
    [currentUser?.orgId],
  );

  useEffect(() => {
    const stored = sessionStorage.getItem(suggestionDismissStorageKey);
    if (!stored) {
      setDismissedSuggestionIds([]);
      return;
    }
    try {
      const parsed = JSON.parse(stored) as unknown;
      setDismissedSuggestionIds(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []);
    } catch {
      setDismissedSuggestionIds([]);
    }
  }, [suggestionDismissStorageKey]);

  useEffect(() => {
    sessionStorage.setItem(suggestionDismissStorageKey, JSON.stringify(dismissedSuggestionIds));
  }, [dismissedSuggestionIds, suggestionDismissStorageKey]);

  useEffect(() => {
    const stored = sessionStorage.getItem(sopExpandedStorageKey);
    if (!stored) {
      setExpandedSopIds([]);
      return;
    }
    try {
      const parsed = JSON.parse(stored);
      setExpandedSopIds(Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : []);
    } catch {
      setExpandedSopIds([]);
    }
  }, [sopExpandedStorageKey]);

  useEffect(() => {
    sessionStorage.setItem(sopExpandedStorageKey, JSON.stringify(expandedSopIds));
  }, [expandedSopIds, sopExpandedStorageKey]);

  const toggleSopCard = useCallback((sopId: string) => {
    setExpandedSopIds((current) =>
      current.includes(sopId) ? current.filter((id) => id !== sopId) : [...current, sopId],
    );
  }, []);

  useEffect(() => {
    if (assignmentsQuery.dataUpdatedAt || taskRequestsQuery.dataUpdatedAt) {
      setLastRealtimeRefreshAt(Math.max(assignmentsQuery.dataUpdatedAt ?? 0, taskRequestsQuery.dataUpdatedAt ?? 0));
    }
  }, [assignmentsQuery.dataUpdatedAt, taskRequestsQuery.dataUpdatedAt]);

  const applyRecurringTasks = useCallback(async () => {
    if (!supabase || !currentUser?.orgId) return;
    if (scheduleQuery.isLoading || assignmentsQuery.isLoading) {
      toast.info('Crew assignments are still loading. Try again in a moment.');
      return;
    }
    if (dayAssignments.length > 0) {
      toast.info('Recurring tasks were not applied because this day already has assignments.');
      return;
    }
    const scheduledToday = scheduleList.filter((entry) => entry.date === boardDate && entry.status === 'scheduled');
    if (scheduledToday.length === 0) {
      toast.info('No scheduled crew found for this date.');
      return;
    }
    const dayCode = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(`${boardDate}T00:00:00`).getDay()];
    const recurringRulesResult = await recurringRulesQuery.refetch();
    if (recurringRulesResult.error) {
      toast.error(`Failed to load recurring tasks: ${recurringRulesResult.error.message}`);
      return;
    }
    const rules = (recurringRulesResult.data ?? []).filter((rule) => (rule.days_of_week ?? []).includes(dayCode));
    if (rules.length === 0) {
      toast.info('No recurring tasks are scheduled for this day.');
      return;
    }

    const sessionKey = `recurring-applied-${currentUser.orgId}-${effectivePropertyId ?? 'all'}-${boardDate}`;
    if (sessionStorage.getItem(sessionKey) === 'true') {
      toast.info('Recurring tasks have already been applied for this date.');
      return;
    }

    const tasksById = new Map(taskList.map((task) => [task.id, task]));
    const scheduledByEmployee = new Map(scheduledToday.map((entry) => [entry.employeeId, entry]));
    const inserts: Array<Record<string, unknown>> = [];
    let targetCrewCount = 0;

    for (const rule of rules) {
      const task = tasksById.get(rule.task_id);
      if (!task) continue;
      if (rule.employee_id) {
        const shift = scheduledByEmployee.get(rule.employee_id);
        if (!shift) continue;
        inserts.push({
          org_id: currentUser.orgId,
          property_id: shift.propertyId,
          employee_id: rule.employee_id,
          task_id: task.id,
          title: task.name,
          date: boardDate,
          status: 'planned',
          estimated_hours: Number(task.estimated_hours ?? 0),
        });
        targetCrewCount += 1;
      } else {
        for (const shift of scheduledToday) {
          inserts.push({
            org_id: currentUser.orgId,
            property_id: shift.propertyId,
            employee_id: shift.employeeId,
            task_id: task.id,
            title: task.name,
            date: boardDate,
            status: 'planned',
            estimated_hours: Number(task.estimated_hours ?? 0),
          });
        }
        targetCrewCount += scheduledToday.length;
      }
    }

    if (inserts.length === 0) {
      sessionStorage.setItem(sessionKey, 'true');
      toast.info('No recurring tasks matched today\'s scheduled crew.');
      return;
    }

    const { error } = await supabase.from('assignments').insert(inserts);
    if (error) {
      toast.error(`Failed to apply recurring tasks: ${error.message}`);
      return;
    }
    sessionStorage.setItem(sessionKey, 'true');
    toast.success(`Assigned ${inserts.length} recurring tasks to ${targetCrewCount} crew members`);
    await queryClient.invalidateQueries({ queryKey: ['assignments'] });
  }, [
    assignmentsQuery.isLoading,
    boardDate,
    currentUser?.orgId,
    dayAssignments.length,
    effectivePropertyId,
    queryClient,
    recurringRulesQuery,
    scheduleList,
    scheduleQuery.isLoading,
    supabase,
    taskList,
  ]);

  useEffect(() => {
    const firstScheduled =
      scheduleList.find((e) => e.date === boardDate && e.status === 'scheduled')?.employeeId ??
      employeeList.find((e) => e.status === 'active')?.id ?? '';
    if (firstScheduled) {
      setSelectedEmployeeId((cur) => (cur ? cur : firstScheduled));
    }
    setAssignmentDraft((cur) => {
      const nextEmployeeId = cur.employeeId || firstScheduled;
      const nextTaskId = cur.taskId || taskList[0]?.id || '';
      if (cur.employeeId === nextEmployeeId && cur.taskId === nextTaskId) {
        return cur;
      }
      return {
        ...cur,
        employeeId: nextEmployeeId,
        taskId: nextTaskId,
      };
    });
  }, [boardDate, employeeList, scheduleList, taskList]);

  useEffect(() => {
    if (!assignmentDialogOpen) return;
    void refetchTasks();
  }, [assignmentDialogOpen, refetchTasks]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== 'ground-crew-task-library-updated-at') return;
      void refetchTasks();
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [refetchTasks]);

  useEffect(() => {
    const authUserId = currentUser?.authUser?.id;
    if (!supabase || !authUserId || !orgId) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    const timer = window.setTimeout(() => {
      channel = supabase
        .channel(`workboard-live-${authUserId}-${orgId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'assignments',
            filter: `org_id=eq.${orgId}`,
          },
          (payload) => {
            setLastRealtimeRefreshAt(Date.now());
            const next = payload.new as { id?: string; status?: string; title?: string; employee_id?: string } | null;
            const previous = payload.old as { status?: string } | null;
            const nextStatus = (next?.status ?? '').toLowerCase();
            const previousStatus = (previous?.status ?? '').toLowerCase();
            const statusChanged = payload.eventType === 'UPDATE' && nextStatus && nextStatus !== previousStatus;
            if (statusChanged && next?.id) {
              const completed = nextStatus === 'done' || nextStatus === 'complete';
              const started = nextStatus === 'in_progress' || nextStatus === 'in-progress';
              if (completed || started) {
                triggerAssignmentFlash(next.id, completed ? 'complete' : 'started');
                const assignee = employeeListRef.current.find((employee) => employee.id === (next.employee_id ?? ''));
                const fullName = assignee ? `${assignee.firstName} ${assignee.lastName}` : 'Crew member';
                const actionLabel = completed ? 'completed' : 'started';
                const taskLabel = next.title || 'a task';
                toast.success(`${fullName} ${actionLabel} ${taskLabel}`);
              }
            }
            void queryClient.invalidateQueries({ queryKey: ['assignments'] });
          },
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'task_requests', filter: `org_id=eq.${orgId}` }, () => {
          setLastRealtimeRefreshAt(Date.now());
          void queryClient.invalidateQueries({ queryKey: ['task-requests'] });
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_entries', filter: `org_id=eq.${orgId}` }, () => {
          void queryClient.invalidateQueries({ queryKey: ['schedule-entries'] });
        })
        .subscribe();
    }, 5000);

    return () => {
      window.clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [currentUser?.authUser?.id, orgId, queryClient, triggerAssignmentFlash]);

  useEffect(
    () => () => {
      Object.values(pendingDeleteTimeoutsRef.current).forEach((timeoutId) => window.clearTimeout(timeoutId));
      pendingDeleteTimeoutsRef.current = {};
      Object.values(assignmentFlashTimeoutsRef.current).forEach((timeoutId) => window.clearTimeout(timeoutId));
      assignmentFlashTimeoutsRef.current = {};
    },
    [],
  );

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
  const operationalTimezone = useMemo(
    () => getOperationalTimezone(activeProperty),
    [activeProperty],
  );

  const breakClockEventsQuery = useQuery({
    queryKey: ['workboard-break-clock-events', orgId ?? 'all-orgs', boardDate, effectivePropertyId ?? 'all', operationalTimezone],
    enabled: Boolean(orgId),
    queryFn: async () => {
      if (!supabase || !orgId) return [] as WorkboardClockEventRow[];
      const startIso = wallClockToStoredIso(boardDate, '00:00', operationalTimezone);
      const endIso = wallClockToStoredIso(addDaysToDateKey(boardDate, 1), '00:00', operationalTimezone);
      if (!startIso || !endIso) return [] as WorkboardClockEventRow[];
      let query = supabase
        .from('clock_events')
        .select('id, employee_id, property_id, event_type, timestamp, org_id')
        .eq('org_id', orgId)
        .in('event_type', ['break', 'clock_in'])
        .gte('timestamp', startIso)
        .lt('timestamp', endIso)
        .order('timestamp', { ascending: true });
      if (effectivePropertyId && effectivePropertyId !== 'all') {
        query = query.eq('property_id', effectivePropertyId);
      }
      const { data, error } = await withWorkboardRequestTimeout(query);
      if (error) throw error;
      return (data ?? []).map((row) => normalizeClockEvent(row as Record<string, unknown>));
    },
    staleTime: 1000 * 30,
  });
  const breakClockEvents = breakClockEventsQuery.data ?? [];
  const breakChipsByEmployee = useMemo<Record<string, WorkboardBreakChip[]>>(() => {
    const eventsByEmployee = new Map<string, WorkboardClockEventRow[]>();
    for (const event of breakClockEvents) {
      if (!event.employeeId || !event.timestamp) continue;
      const current = eventsByEmployee.get(event.employeeId) ?? [];
      current.push(event);
      eventsByEmployee.set(event.employeeId, current);
    }

    const result: Record<string, WorkboardBreakChip[]> = {};
    for (const [employeeId, events] of eventsByEmployee.entries()) {
      const sortedEvents = [...events].sort((a, b) => (getIsoTimestampMs(a.timestamp) ?? 0) - (getIsoTimestampMs(b.timestamp) ?? 0));
      result[employeeId] = sortedEvents
        .filter((event) => event.eventType === 'break')
        .map((breakEvent) => {
          const startMs = getIsoTimestampMs(breakEvent.timestamp);
          const nextClockIn = sortedEvents.find((event) => {
            if (event.eventType !== 'clock_in') return false;
            const eventMs = getIsoTimestampMs(event.timestamp);
            return startMs !== null && eventMs !== null && eventMs > startMs;
          });
          const endMs = getIsoTimestampMs(nextClockIn?.timestamp ?? null);
          const durationMinutes =
            startMs !== null && endMs !== null
              ? Math.max(0, Math.round((endMs - startMs) / 60000))
              : null;
          const startWallClock = storedIsoToWallClock(breakEvent.timestamp, operationalTimezone);
          return {
            id: breakEvent.id,
            employeeId,
            startIso: breakEvent.timestamp,
            endIso: nextClockIn?.timestamp ?? null,
            startLabel: storedIsoToWallClockLabel(breakEvent.timestamp, operationalTimezone),
            endLabel: nextClockIn ? storedIsoToWallClockLabel(nextClockIn.timestamp, operationalTimezone) : null,
            durationLabel: durationMinutes !== null ? formatMinutesAsHoursAndMinutes(durationMinutes) : null,
            sortMinutes: startWallClock ? timeToMinutes(startWallClock) : 0,
          };
        });
    }
    return result;
  }, [breakClockEvents, operationalTimezone]);

  const fetchWorkboardWeather = useCallback(async () => {
    if (!activeProperty?.latitude || !activeProperty?.longitude) {
      setWeatherSnapshot(null);
      return;
    }

    try {
      const payload = await fetchNwsWeather({
        latitude: activeProperty.latitude,
        longitude: activeProperty.longitude,
        timezone: operationalTimezone,
      });
      const firstHourly = payload.hourly[0];
      setWeatherSnapshot({
        temperature: Number(payload.current.temperature ?? 0),
        windSpeed: Number(payload.current.windSpeed ?? 0),
        precipitationProbability: Number(firstHourly?.precipitationProbability ?? 0),
        weatherCode: Number(payload.current.weatherCode ?? firstHourly?.weatherCode ?? -1),
      });
    } catch {
      setWeatherSnapshot(null);
    }
  }, [activeProperty?.latitude, activeProperty?.longitude, operationalTimezone]);

  useEffect(() => {
    if (!orgId) return;
    void fetchWorkboardWeather();
  }, [fetchWorkboardWeather, boardDate, orgId]);

  const propertyRequests = useMemo(
    () =>
      taskRequests
        .filter((r) => !effectivePropertyId || effectivePropertyId === 'all' || r.propertyId === effectivePropertyId)
        .sort((a, b) => {
          const order = { high: 0, medium: 1, low: 2 } as const;
          const priorityDelta = order[a.priority] - order[b.priority];
          if (priorityDelta !== 0) return priorityDelta;
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        }),
    [effectivePropertyId, taskRequests],
  );

  const escalationThresholds = escalationThresholdsQuery.data ?? DEFAULT_ESCALATION_THRESHOLDS;

  const dispatchWeatherConflict = useMemo<DispatchWeatherConflict>(() => {
    if (!weatherSnapshot) {
      return { hasSprayConflict: false, sprayMessage: null, heatMessage: null };
    }

    const selectedTaskIds = editingAssignmentId
      ? [assignmentDraft.taskId]
      : taskRows.map((row) => row.taskId).filter(Boolean);
    const selectedTasks = selectedTaskIds
      .map((taskId) => taskLibrary.find((task) => task.id === taskId) ?? null)
      .filter((task): task is TaskLibraryItem => Boolean(task));
    const sprayCategory = selectedTasks.some((task) => {
      const categoryText = String(task.category ?? '').toLowerCase();
      return categoryText.includes('spray') || categoryText.includes('irrigation') || categoryText.includes('application');
    });

    const windOver = weatherSnapshot.windSpeed > escalationThresholds.windSpeedSprayCutoffMph;
    const rainOver = weatherSnapshot.precipitationProbability > escalationThresholds.rainProbabilitySprayCutoffPct;
    const hasSprayConflict = sprayCategory && (windOver || rainOver);

    const sprayMessage = hasSprayConflict
      ? `⚠️ Weather conflict: Wind is ${Math.round(weatherSnapshot.windSpeed)}mph (limit: ${Math.round(escalationThresholds.windSpeedSprayCutoffMph)}mph) — spraying may be unsafe. Dispatch anyway?`
      : null;

    const heatMessage =
      weatherSnapshot.temperature > escalationThresholds.heatAdvisoryTempF
        ? `🔴 Heat advisory: ${Math.round(weatherSnapshot.temperature)}°F — ensure crew has water breaks.`
        : null;

    return {
      hasSprayConflict,
      sprayMessage,
      heatMessage,
    };
  }, [
    assignmentDraft.taskId,
    editingAssignmentId,
    escalationThresholds.heatAdvisoryTempF,
    escalationThresholds.rainProbabilitySprayCutoffPct,
    escalationThresholds.windSpeedSprayCutoffMph,
    taskRows,
    taskLibrary,
    weatherSnapshot,
  ]);

  const selectedTaskForDraft = useMemo(
    () => {
      const taskId = editingAssignmentId ? assignmentDraft.taskId : taskRows.find((row) => row.taskId)?.taskId ?? '';
      return taskLibrary.find((task) => task.id === taskId) ?? null;
    },
    [assignmentDraft.taskId, editingAssignmentId, taskRows, taskLibrary],
  );

  const handleGenerateTaskNotes = useCallback(async () => {
    if (isGeneratingTaskNotes) return;
    if (!selectedTaskForDraft) return;

    setIsGeneratingTaskNotes(true);
    try {
      const taskName = selectedTaskForDraft.name || 'Task';
      const category = selectedTaskForDraft.category || 'General';
      const estimated = Number(selectedTaskForDraft.estimated_hours ?? 0);
      const weatherLine = weatherSnapshot
        ? `Weather is ${Math.round(weatherSnapshot.temperature)}°F with winds near ${Math.round(weatherSnapshot.windSpeed)} mph.`
        : '';

      // Keep the async flow so the button can show a spinner while generating.
      await new Promise((resolve) => window.setTimeout(resolve, 350));

      const generated = [
        `Complete ${taskName} using standard ${category.toLowerCase()} procedures.`,
        estimated > 0
          ? `Target completion in about ${estimated} hour${estimated === 1 ? '' : 's'} and report any hazards or delays immediately.`
          : 'Report any hazards or delays immediately and confirm completion once finished.',
        weatherLine,
      ]
        .filter(Boolean)
        .join(' ');

      setIsAssignmentModalDirty(true);
      setAssignmentDraft((current) => ({ ...current, notes: generated }));
    } catch {
      // Silent fail by design for convenience action.
    } finally {
      setIsGeneratingTaskNotes(false);
    }
  }, [isGeneratingTaskNotes, selectedTaskForDraft, weatherSnapshot]);

  useEffect(() => {
    setWeatherConflictOverride(false);
  }, [assignmentDraft.taskId, assignmentDraft.employeeId, assignmentDraft.startTime, boardDate, taskRows]);

  const isRequestOpen = useCallback(
    (status: string) => !['assigned', 'dismissed', 'done', 'closed'].includes(status.toLowerCase()),
    [],
  );

  const employeeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const employee of employeeList) {
      map.set(employee.id, `${employee.firstName} ${employee.lastName}`.trim());
    }
    return map;
  }, [employeeList]);

  const filteredRequests = useMemo(() => {
    if (needsFilter === 'all') return propertyRequests;
    if (needsFilter === 'open') return propertyRequests.filter((r) => isRequestOpen(String(r.status ?? '')));
    return propertyRequests.filter((r) => !isRequestOpen(String(r.status ?? '')));
  }, [propertyRequests, needsFilter, isRequestOpen]);

  const scheduledEmployees = useMemo(() => {
    const scheduledIds = new Set(
      scheduleList.filter((e) => e.date === boardDate && e.status === 'scheduled').map((e) => e.employeeId),
    );
    return employeeList
      .filter((e) => scheduledIds.has(e.id))
      .sort((a, b) => {
        const aShift = getShiftForEmployee(scheduleList, a.id, boardDate)?.shiftStart ?? '99:99';
        const bShift = getShiftForEmployee(scheduleList, b.id, boardDate)?.shiftStart ?? '99:99';
        return aShift.localeCompare(bShift);
      });
  }, [employeeList, boardDate, scheduleList]);

  const unscheduledEmployees = useMemo(() => {
    const scheduledIds = new Set(
      scheduleList.filter((e) => e.date === boardDate && e.status === 'scheduled').map((e) => e.employeeId),
    );
    return activeDepartmentEmployees.filter((e) => !scheduledIds.has(e.id));
  }, [activeDepartmentEmployees, boardDate, scheduleList]);

  const fallbackEligibleEmployees = useMemo(
    () => (scheduledEmployees.length > 0 ? scheduledEmployees : employeeList.filter((e) => e.status === 'active')),
    [scheduledEmployees, employeeList],
  );

  const selectedPropertyNoteId = effectivePropertyId && effectivePropertyId !== 'all'
    ? effectivePropertyId
    : selectedNotePropertyId;
  const selectedNoteEmployee = scheduledEmployees.find((employee) => employee.id === selectedNoteEmployeeId) ?? null;
  const selectedEmployeeNotePropertyId =
    selectedNoteEmployee
      ? getShiftForEmployee(scheduleList, selectedNoteEmployee.id, boardDate)?.propertyId ?? selectedNoteEmployee.propertyId ?? null
      : null;
  const selectedNoteAssignment = dayAssignments.find((assignment) => assignment.id === selectedNoteAssignmentId) ?? null;
  const selectedAssignmentNotePropertyId = selectedNoteAssignment?.propertyId ?? null;
  const orgWideNotes = useMemo(
    () => noteList.filter((note) => !note.propertyId && !note.employeeId && !note.assignmentId),
    [noteList],
  );
  const propertyScopedNotes = useMemo(
    () =>
      selectedPropertyNoteId
        ? noteList.filter(
            (note) =>
              note.propertyId === selectedPropertyNoteId &&
              !note.employeeId &&
              !note.assignmentId,
          )
        : [],
    [noteList, selectedPropertyNoteId],
  );
  const employeeScopedNotes = useMemo(
    () =>
      selectedEmployeeNotePropertyId && selectedNoteEmployeeId
        ? noteList.filter(
            (note) =>
              note.propertyId === selectedEmployeeNotePropertyId &&
              note.employeeId === selectedNoteEmployeeId &&
              !note.assignmentId,
          )
        : [],
    [noteList, selectedEmployeeNotePropertyId, selectedNoteEmployeeId],
  );
  const taskScopedNotes = useMemo(
    () =>
      selectedAssignmentNotePropertyId && selectedNoteAssignmentId
        ? noteList.filter(
            (note) =>
              note.propertyId === selectedAssignmentNotePropertyId &&
              note.assignmentId === selectedNoteAssignmentId,
          )
        : [],
    [noteList, selectedAssignmentNotePropertyId, selectedNoteAssignmentId],
  );
  const visibleScopedNotes = useMemo(() => {
    if (noteScope === 'property') return propertyScopedNotes;
    if (noteScope === 'employee') return employeeScopedNotes;
    if (noteScope === 'task') return taskScopedNotes;
    return orgWideNotes;
  }, [employeeScopedNotes, noteScope, orgWideNotes, propertyScopedNotes, taskScopedNotes]);
  const propertyNameById = useMemo(
    () => new Map(properties.map((property) => [property.id, property.name])),
    [properties],
  );
  const taskNameById = useMemo(
    () => new Map(taskList.map((task) => [task.id, task.name])),
    [taskList],
  );
  const noteScopeTabs: Array<{ id: NoteScope; label: string; count: number }> = [
    { id: 'org', label: 'Org-wide', count: orgWideNotes.length },
    { id: 'property', label: 'Property', count: propertyScopedNotes.length },
    { id: 'employee', label: 'Employee', count: employeeScopedNotes.length },
    { id: 'task', label: 'Task', count: taskScopedNotes.length },
  ];

  const upsertAssignmentInCache = useCallback(
    (nextAssignment: Assignment) => {
      queryClient.setQueryData<Assignment[]>(assignmentsQuery.queryKey, (current) => {
        const existing = current ?? [];
        const withoutExisting = existing.filter((assignment) => assignment.id !== nextAssignment.id);
        return [...withoutExisting, nextAssignment];
      });
    },
    [assignmentsQuery.queryKey, queryClient],
  );

  const removeAssignmentFromCache = useCallback(
    (assignmentId: string) => {
      queryClient.setQueryData<Assignment[]>(assignmentsQuery.queryKey, (current) => {
        const existing = current ?? [];
        return existing.filter((assignment) => assignment.id !== assignmentId);
      });
    },
    [assignmentsQuery.queryKey, queryClient],
  );

  const appendAssignmentToCaches = useCallback(
    (nextAssignment: Assignment) => {
      const scopedAssignmentsKey = ['assignments', boardDate, effectivePropertyId ?? 'all', currentUser?.orgId ?? 'all-orgs'];
      const dateAssignmentsKey = ['assignments', currentUser?.orgId ?? 'all-orgs', boardDate];

      queryClient.setQueryData<Assignment[]>(assignmentsQuery.queryKey, (current) => [...(current ?? []), nextAssignment]);
      queryClient.setQueryData<Assignment[]>(scopedAssignmentsKey, (current) => [...(current ?? []), nextAssignment]);
      queryClient.setQueryData<Assignment[]>(dateAssignmentsKey, (current) => [...(current ?? []), nextAssignment]);
    },
    [assignmentsQuery.queryKey, boardDate, currentUser?.orgId, effectivePropertyId, queryClient],
  );

  const setAssignmentActualHours = useCallback(
    async (assignment: Assignment, hours: number) => {
      if (!supabase || !currentUser?.orgId || !assignment.id) return;
      const nextHours = Math.max(0, Number(hours));
      const previousActualHours = Number(assignment.actualHours ?? 0);

      queryClient.setQueryData<Assignment[]>(assignmentsQuery.queryKey, (current) =>
        (current ?? []).map((row) =>
          row.id === assignment.id
            ? {
                ...row,
                actualHours: nextHours,
              }
            : row,
        ),
      );

      const { error } = await supabase
        .from('assignments')
        .update({ actual_hours: nextHours })
        .eq('id', assignment.id)
        .eq('org_id', currentUser.orgId);

      if (error) {
        queryClient.setQueryData<Assignment[]>(assignmentsQuery.queryKey, (current) =>
          (current ?? []).map((row) =>
            row.id === assignment.id
              ? {
                  ...row,
                  actualHours: previousActualHours,
                }
              : row,
          ),
        );
        toast.error(`Failed to update actual hours: ${error.message}`);
        return;
      }

      toast.success(`Logged ${nextHours.toFixed(1)}h for ${assignment.title || 'task'}`);
      void queryClient.invalidateQueries({ queryKey: ['assignments'] });
    },
    [assignmentsQuery.queryKey, currentUser?.orgId, queryClient],
  );

  const syncTimelineCaches = useCallback(
    (
      assignmentId: string,
      patch: {
        actualStartAt?: string | null;
        actualCompletedAt?: string | null;
        status?: string;
        actualHours?: number;
      },
    ) => {
      queryClient.setQueryData<Assignment[]>(assignmentsQuery.queryKey, (current) =>
        (current ?? []).map((row) => {
          if (row.id !== assignmentId) return row;
          const enriched = row as Assignment & Record<string, unknown>;
          if (patch.actualStartAt !== undefined) {
            enriched.actual_start_at = patch.actualStartAt;
            row.actualStartAt = patch.actualStartAt;
          }
          if (patch.actualCompletedAt !== undefined) {
            enriched.actual_completed_at = patch.actualCompletedAt;
            row.actualCompletedAt = patch.actualCompletedAt;
          }
          if (patch.status) {
            enriched.status = patch.status;
            row.status = normalizeAssignmentStatus(patch.status) as Assignment['status'];
          }
          if (typeof patch.actualHours === 'number' && Number.isFinite(patch.actualHours)) {
            enriched.actual_hours = patch.actualHours;
            row.actualHours = patch.actualHours;
          }
          return { ...row };
        }),
      );
    },
    [assignmentsQuery.queryKey, queryClient],
  );

  const getAssignmentTimelineMeta = useCallback(
    (assignment: Assignment) => {
      const timelineRow = assignment.id ? assignmentTimelineById.get(assignment.id) : undefined;
      const assignmentRecord = assignment as Assignment & Record<string, unknown>;
      return {
        actualStartAt:
          timelineRow?.actualStartAt ??
          (typeof assignmentRecord.actual_start_at === 'string' ? String(assignmentRecord.actual_start_at) : null),
        actualCompletedAt:
          timelineRow?.actualCompletedAt ??
          (typeof assignmentRecord.actual_completed_at === 'string'
            ? String(assignmentRecord.actual_completed_at)
            : typeof assignmentRecord.completed_at === 'string'
              ? String(assignmentRecord.completed_at)
              : null),
        orderIndex:
          timelineRow?.orderIndex ??
          (typeof assignmentRecord.order_index === 'number'
            ? Number(assignmentRecord.order_index)
            : typeof assignmentRecord.order === 'number'
              ? Number(assignmentRecord.order)
              : 0),
      };
    },
    [assignmentTimelineById],
  );

  const getCanonicalActualTimes = useCallback(
    (assignment: Assignment) => {
      const timelineMeta = getAssignmentTimelineMeta(assignment);
      const assignmentRecord = assignment as Assignment & Record<string, unknown>;
      const canonicalStartAt =
        timelineMeta.actualStartAt ??
        (typeof assignmentRecord.actual_start_at === 'string'
          ? String(assignmentRecord.actual_start_at)
          : null);
      const canonicalCompletedAt =
        timelineMeta.actualCompletedAt ??
        (typeof assignmentRecord.actual_completed_at === 'string'
          ? String(assignmentRecord.actual_completed_at)
          : typeof assignmentRecord.completed_at === 'string'
            ? String(assignmentRecord.completed_at)
            : null);
      return { canonicalStartAt, canonicalCompletedAt, timelineMeta };
    },
    [getAssignmentTimelineMeta],
  );

  const orderEmployeeAssignments = useCallback(
    (employeeAssignments: Assignment[]) =>
      [...employeeAssignments].sort((a, b) => {
        const orderA = getAssignmentTimelineMeta(a).orderIndex;
        const orderB = getAssignmentTimelineMeta(b).orderIndex;
        if (orderA !== orderB) return orderA - orderB;
        return String(a.startTime ?? '').localeCompare(String(b.startTime ?? ''));
      }),
    [getAssignmentTimelineMeta],
  );

  const startAssignmentTimeline = useCallback(
    async (assignment: Assignment) => {
      if (!supabase || !currentUser?.orgId || !assignment.id) return;
      setSavingTimelineAssignmentId(assignment.id);
      const nowHHMM = getNowHHMMInTimezone(operationalTimezone);
      const nowIso = wallClockToStoredIso(boardDate, nowHHMM, operationalTimezone);
      if (!nowIso) {
        toast.error('Could not determine current operational time.');
        setSavingTimelineAssignmentId(null);
        return;
      }
      const assignmentRecord = assignment as Assignment & Record<string, unknown>;
      const previousStatus = normalizeAssignmentStatus(assignment.status);
      const previousStartAt =
        typeof assignmentRecord.actual_start_at === 'string'
          ? String(assignmentRecord.actual_start_at)
          : assignment.id
            ? assignmentTimelineById.get(assignment.id)?.actualStartAt ?? null
            : null;
      syncTimelineCaches(assignment.id, { status: 'in_progress', actualStartAt: nowIso });
      const hasSpecificProperty = effectivePropertyId && effectivePropertyId !== 'all';
      const propertyForEvent = hasSpecificProperty ? effectivePropertyId : null;
      const employeeForEvent = assignment.employeeId || (typeof assignmentRecord.employee_id === 'string' ? assignmentRecord.employee_id : null);
      const { error: assignmentError } = await supabase
        .from('assignments')
        .update({ status: 'in_progress', actual_start_at: nowIso })
        .eq('id', assignment.id)
        .eq('org_id', currentUser.orgId);
      if (assignmentError) {
        syncTimelineCaches(assignment.id, { status: previousStatus, actualStartAt: previousStartAt });
        toast.error(`Failed to start task: ${assignmentError.message}`);
        setSavingTimelineAssignmentId(null);
        return;
      }
      if (propertyForEvent && employeeForEvent) {
        const { error: clockError } = await supabase.from('clock_events').insert({
          id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          org_id: currentUser.orgId,
          property_id: propertyForEvent,
          employee_id: employeeForEvent,
          event_type: 'clock_in',
          timestamp: nowIso,
          location_lat: null,
          location_lng: null,
        });
        if (clockError) {
          syncTimelineCaches(assignment.id, { status: previousStatus, actualStartAt: previousStartAt });
          const { error: rollbackError } = await supabase
            .from('assignments')
            .update({ status: previousStatus, actual_start_at: previousStartAt })
            .eq('id', assignment.id)
            .eq('org_id', currentUser.orgId);
          if (rollbackError) {
            toast.error(`Task start rollback failed: ${rollbackError.message}`);
          }
          toast.error(`Failed to start task: ${clockError.message}`);
          setSavingTimelineAssignmentId(null);
          return;
        }
      } else if (!propertyForEvent) {
        toast.info('Task updated. Select a specific property to also log a clock event.');
      }
      triggerAssignmentFlash(assignment.id, 'started');
      toast.success(`Started ${assignment.title || 'task'}`);
      setSavingTimelineAssignmentId(null);
    },
    [assignmentTimelineById, boardDate, currentUser?.orgId, effectivePropertyId, operationalTimezone, syncTimelineCaches, triggerAssignmentFlash],
  );

  const completeAssignmentTimeline = useCallback(
    async (assignment: Assignment, employeeAssignments: Assignment[]) => {
      if (!supabase || !currentUser?.orgId || !assignment.id) return;
      setSavingTimelineAssignmentId(assignment.id);
      const nowHHMM = getNowHHMMInTimezone(operationalTimezone);
      const nowIso = wallClockToStoredIso(boardDate, nowHHMM, operationalTimezone);
      if (!nowIso) {
        toast.error('Could not determine current operational time.');
        setSavingTimelineAssignmentId(null);
        return;
      }
      const timelineMeta = getAssignmentTimelineMeta(assignment);
      let calculatedHours: number | undefined;
      if (timelineMeta.actualStartAt) {
        const startHHMM = storedIsoToWallClock(timelineMeta.actualStartAt, operationalTimezone);
        if (startHHMM) {
          const nowMinutes = timeToMinutes(nowHHMM);
          const startMinutes = timeToMinutes(startHHMM);
          if (nowMinutes >= startMinutes) {
            calculatedHours = Math.max(0, (nowMinutes - startMinutes) / 60);
          }
        }
      }

      const updatePayload: Record<string, unknown> = {
        status: 'completed',
        actual_completed_at: nowIso,
      };
      if (typeof calculatedHours === 'number' && Number.isFinite(calculatedHours)) {
        updatePayload.actual_hours = Number(calculatedHours.toFixed(2));
      }

      const previousStatus = normalizeAssignmentStatus(assignment.status);
      const previousCompletedAt = timelineMeta.actualCompletedAt;
      const previousActualHours =
        typeof (assignment as Assignment & Record<string, unknown>).actual_hours === 'number'
          ? Number((assignment as Assignment & Record<string, unknown>).actual_hours)
          : typeof assignment.actualHours === 'number'
            ? Number(assignment.actualHours)
            : undefined;
      syncTimelineCaches(assignment.id, {
        status: 'completed',
        actualCompletedAt: nowIso,
        actualHours: typeof updatePayload.actual_hours === 'number' ? Number(updatePayload.actual_hours) : undefined,
      });

      const { error } = await supabase
        .from('assignments')
        .update(updatePayload)
        .eq('id', assignment.id)
        .eq('org_id', currentUser.orgId);
      if (error) {
        syncTimelineCaches(assignment.id, {
          status: previousStatus,
          actualCompletedAt: previousCompletedAt,
          actualHours: previousActualHours,
        });
        toast.error(`Failed to complete task: ${error.message}`);
        setSavingTimelineAssignmentId(null);
        return;
      }
      triggerAssignmentFlash(assignment.id, 'complete');
      toast.success(`Completed ${assignment.title || 'task'}`);
      setSavingTimelineAssignmentId(null);
      const hasSpecificProperty = effectivePropertyId && effectivePropertyId !== 'all';
      const propertyForEvent = hasSpecificProperty ? effectivePropertyId : null;
      const assignmentRecord = assignment as Assignment & Record<string, unknown>;
      const employeeForEvent = assignment.employeeId || (typeof assignmentRecord.employee_id === 'string' ? assignmentRecord.employee_id : null);
      if (propertyForEvent && employeeForEvent) {
        const { error: clockError } = await supabase.from('clock_events').insert({
          id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          org_id: currentUser.orgId,
          property_id: propertyForEvent,
          employee_id: employeeForEvent,
          event_type: 'clock_out',
          timestamp: nowIso,
          location_lat: null,
          location_lng: null,
        });
        if (clockError) {
          syncTimelineCaches(assignment.id, {
            status: previousStatus,
            actualCompletedAt: previousCompletedAt,
            actualHours: previousActualHours,
          });
          const { error: rollbackError } = await supabase
            .from('assignments')
            .update({
              status: previousStatus,
              actual_completed_at: previousCompletedAt,
              actual_hours: previousActualHours,
            })
            .eq('id', assignment.id)
            .eq('org_id', currentUser.orgId);
          if (rollbackError) {
            toast.error(`Task completion rollback failed: ${rollbackError.message}`);
          }
          toast.error(`Clock event could not be logged; task completion was rolled back: ${clockError.message}`);
          setSavingTimelineAssignmentId(null);
          return;
        }
      } else if (!propertyForEvent) {
        toast.info('Task updated. Select a specific property to also log a clock event.');
      }

      const ordered = orderEmployeeAssignments(employeeAssignments);
      const currentOrder = getCanonicalActualTimes(assignment).timelineMeta.orderIndex;
      const nextTask = ordered.find((row) => {
        const rowOrder = getCanonicalActualTimes(row).timelineMeta.orderIndex;
        return rowOrder > currentOrder && normalizeAssignmentStatus(row.status) === 'planned';
      });

      if (nextTask?.id) {
        const nextResult = await supabase
          .from('assignments')
          .update({ status: 'in_progress', actual_start_at: nowIso })
          .eq('id', nextTask.id)
          .eq('org_id', currentUser.orgId);
        if (!nextResult.error) {
          syncTimelineCaches(nextTask.id, { status: 'in_progress', actualStartAt: nowIso });
          triggerAssignmentFlash(nextTask.id, 'started');
        } else {
          toast.error(`Next task could not be started: ${nextResult.error.message}`);
        }
      }

    },
    [currentUser?.orgId, effectivePropertyId, getCanonicalActualTimes, operationalTimezone, orderEmployeeAssignments, syncTimelineCaches, triggerAssignmentFlash],
  );

  const saveAssignmentTimelineTimes = useCallback(
    async (assignment: Assignment, employeeAssignments: Assignment[], startInput: string, endInput: string) => {
      if (!supabase || !currentUser?.orgId || !assignment.id) return false;
      if (import.meta.env.DEV) {
        const now = Date.now();
        const lastRun = timelineSaveGuardRef.current[assignment.id] ?? 0;
        if (now - lastRun < 100 && !timelineSaveWarnedRef.current[assignment.id]) {
          timelineSaveWarnedRef.current[assignment.id] = true;
          console.warn('[workboard:timeline-save-loop-guard]', {
            assignmentId: assignment.id,
            startInput,
            endInput,
          });
        }
        timelineSaveGuardRef.current[assignment.id] = now;
      }
      const dateStr = assignment.date;
      // Convert local workflow time to UTC ISO once before persisting to timestamptz.
      const startTs = startInput ? wallClockToStoredIso(dateStr, startInput, operationalTimezone) : null;
      const endTs = endInput ? wallClockToStoredIso(dateStr, endInput, operationalTimezone) : null;
      const normalizedStatus = normalizeAssignmentStatus(assignment.status);
      if (startInput && endInput) {
        if (endInput < startInput) {
          toast.error('Completed time cannot be before start time.');
          return false;
        }
      }
      if (!startInput && !endInput) {
        toast.error('Enter a start or complete time before saving.');
        return false;
      }

      const payload: Record<string, unknown> = {};
      if (startInput) payload.actual_start_at = startTs;
      if (endInput) payload.actual_completed_at = endTs;
      if (startInput && endInput) {
        const startMinutes = timeToMinutes(startInput);
        const endMinutes = timeToMinutes(endInput);
        if (endMinutes >= startMinutes) {
          payload.actual_hours = Number(((endMinutes - startMinutes) / 60).toFixed(2));
        }
      }
      const previousTimes = getCanonicalActualTimes(assignment);
      const assignmentRecord = assignment as Assignment & Record<string, unknown>;
      const previousActualHours =
        typeof assignmentRecord.actual_hours === 'number'
          ? Number(assignmentRecord.actual_hours)
          : typeof assignment.actualHours === 'number'
            ? Number(assignment.actualHours)
            : undefined;
      const returnedStartAt = startInput ? startTs : previousTimes.canonicalStartAt;
      const returnedCompletedAt = endInput ? endTs : previousTimes.canonicalCompletedAt;
      const derivedHours = typeof payload.actual_hours === 'number' ? Number(payload.actual_hours) : undefined;

      setSavingTimelineAssignmentId(assignment.id);
      syncTimelineCaches(assignment.id, {
        actualStartAt: startInput ? returnedStartAt : undefined,
        actualCompletedAt: endInput ? returnedCompletedAt : undefined,
        actualHours: derivedHours,
      });
      const { error } = await supabase
        .from('assignments')
        .update(payload)
        .eq('id', assignment.id)
        .eq('org_id', currentUser.orgId);
      if (error) {
        syncTimelineCaches(assignment.id, {
          actualStartAt: previousTimes.canonicalStartAt,
          actualCompletedAt: previousTimes.canonicalCompletedAt,
          actualHours: previousActualHours,
        });
        toast.error(`Failed to save times: ${error.message}`);
        setSavingTimelineAssignmentId(null);
        return false;
      }
      if (import.meta.env.DEV) {
        console.debug('[workboard:actual-times-save]', {
          assignmentId: assignment.id,
          inputStart: startInput,
          inputComplete: endInput,
          payloadActualStartAt: startTs,
          payloadActualCompletedAt: endTs,
          returnedActualStartAt: returnedStartAt,
          returnedActualCompletedAt: returnedCompletedAt,
        });
      }

      if (endTs) {
        const ordered = orderEmployeeAssignments(employeeAssignments);
        const currentOrder = getCanonicalActualTimes(assignment).timelineMeta.orderIndex;
        const nextTask = ordered.find((row) => {
          const rowOrder = getCanonicalActualTimes(row).timelineMeta.orderIndex;
          return rowOrder > currentOrder && normalizeAssignmentStatus(row.status) !== 'done';
        });
        if (nextTask?.id) {
          const nextMeta = getCanonicalActualTimes(nextTask).timelineMeta;
          const nextStartHHMM = nextMeta.actualStartAt
            ? storedIsoToWallClock(nextMeta.actualStartAt, operationalTimezone)
            : '';
          const completionHHMM = returnedCompletedAt
            ? storedIsoToWallClock(returnedCompletedAt, operationalTimezone)
            : endInput;
          if (!nextStartHHMM || (completionHHMM && timeToMinutes(nextStartHHMM) < timeToMinutes(completionHHMM))) {
            const nextUpdate = await supabase
              .from('assignments')
              .update({ actual_start_at: returnedCompletedAt ?? endTs })
              .eq('id', nextTask.id)
              .eq('org_id', currentUser.orgId);
            if (!nextUpdate.error) {
              syncTimelineCaches(nextTask.id, { actualStartAt: returnedCompletedAt ?? endTs });
            } else {
              toast.error(`Next task start time could not be updated: ${nextUpdate.error.message}`);
            }
          }
        }
      }

      if (normalizedStatus === 'in-progress' && startInput && !endInput) {
        toast.success('Times saved');
      } else {
        toast.success('Times saved');
      }
      await queryClient.invalidateQueries({ queryKey: ['assignments'] });
      setSavingTimelineAssignmentId(null);
      return true;
    },
    [currentUser?.orgId, getCanonicalActualTimes, operationalTimezone, orderEmployeeAssignments, queryClient, syncTimelineCaches],
  );

  const logEmployeeBreak = useCallback(
    async (employeeId: string, breakStartInput: string, breakEndInput: string) => {
      if (!supabase || !currentUser?.orgId) return false;
      if (!employeeId) {
        toast.error('Select a crew member before logging a break.');
        return false;
      }
      if (!breakStartInput || !breakEndInput) {
        toast.error('Enter both break start and break end times.');
        return false;
      }
      const startMinutes = timeToMinutes(breakStartInput);
      const endMinutes = timeToMinutes(breakEndInput);
      if (endMinutes <= startMinutes) {
        toast.error('Break end must be after break start.');
        return false;
      }
      const employeeShift = getShiftForEmployee(scheduleList, employeeId, boardDate);
      const employee = employeeList.find((entry) => entry.id === employeeId) ?? null;
      const propertyForEvent =
        (effectivePropertyId && effectivePropertyId !== 'all' ? effectivePropertyId : null) ??
        employeeShift?.propertyId ??
        employee?.propertyId ??
        null;
      if (!propertyForEvent || propertyForEvent === 'all') {
        toast.error('Select a specific property before logging a break.');
        return false;
      }
      const breakStartIso = wallClockToStoredIso(boardDate, breakStartInput, operationalTimezone);
      const breakEndIso = wallClockToStoredIso(boardDate, breakEndInput, operationalTimezone);
      if (!breakStartIso || !breakEndIso) {
        toast.error('Could not save break times for this date.');
        return false;
      }

      setSavingBreakEmployeeId(employeeId);
      const { error } = await supabase.from('clock_events').insert([
        {
          employee_id: employeeId,
          property_id: propertyForEvent,
          org_id: currentUser.orgId,
          event_type: 'break',
          timestamp: breakStartIso,
          location_lat: null,
          location_lng: null,
        },
        {
          employee_id: employeeId,
          property_id: propertyForEvent,
          org_id: currentUser.orgId,
          event_type: 'clock_in',
          timestamp: breakEndIso,
          location_lat: null,
          location_lng: null,
        },
      ]);
      setSavingBreakEmployeeId(null);

      if (error) {
        toast.error(`Failed to log break: ${error.message}`);
        return false;
      }

      toast.success('Break logged');
      await queryClient.invalidateQueries({ queryKey: ['workboard-break-clock-events'] });
      return true;
    },
    [boardDate, currentUser?.orgId, effectivePropertyId, employeeList, operationalTimezone, queryClient, scheduleList],
  );

  const workOrderBoardItems = useMemo<WorkOrderBoardItem[]>(() => {
    if (workOrders.length > 0) {
      return workOrders.slice(0, 6).map((row) => ({
        id: String(row.id ?? ''),
        title: String(row.title ?? 'Untitled work order'),
        status: String(row.status ?? 'open'),
        priority: String(row.priority ?? 'medium'),
        source: 'work_order',
      }));
    }

    const byEmployeeId = new Map(employeeList.map((employee) => [employee.id, `${employee.firstName} ${employee.lastName}`]));
    return scheduleList
      .filter((entry) => entry.date === boardDate)
      .slice(0, 6)
      .map((entry) => ({
        id: `sched-${entry.id}`,
        title: `Crew shift coverage ${formatTime(entry.shiftStart)} - ${formatTime(entry.shiftEnd)}`,
        status: 'planned',
        priority: 'medium',
        source: 'schedule_fallback',
        employeeName: byEmployeeId.get(entry.employeeId) ?? 'Scheduled crew',
      }));
  }, [boardDate, employeeList, scheduleList, workOrders]);

  const assignedEmployeeIds = useMemo(
    () => new Set(dayAssignments.map((a) => a.employeeId)),
    [dayAssignments],
  );

  const dispatchBoard = useMemo(
    () =>
      scheduledEmployees.map((employee) => {
        const shift = getShiftForEmployee(scheduleList, employee.id, boardDate);
        const employeeAssignments = dayAssignments
          .filter((a) => {
            const assignmentRecord = a as Assignment & Record<string, unknown>;
            const snakeEmployeeId =
              typeof assignmentRecord.employee_id === 'string' ? String(assignmentRecord.employee_id) : '';
            return a.employeeId === employee.id || snakeEmployeeId === employee.id;
          })
          .sort((a, b) => a.startTime.localeCompare(b.startTime));
        const assignedMinutes = employeeAssignments.reduce((s, a) => s + a.duration, 0);
        const estimatedHours = employeeAssignments.reduce((sum, assignment) => sum + getEstimatedHoursForAssignment(assignment), 0);
        const actualHours = employeeAssignments.reduce((sum, assignment) => sum + Number(assignment.actualHours ?? 0), 0);
        const shiftMinutes = shift ? Math.max(timeToMinutes(shift.shiftEnd) - timeToMinutes(shift.shiftStart), 0) : 0;
        const coveragePercent = shiftMinutes > 0 ? (assignedMinutes / shiftMinutes) * 100 : 0;
        return {
          employee,
          shift,
          employeeAssignments,
          assignedMinutes,
          estimatedHours,
          actualHours,
          shiftMinutes,
          openMinutes: Math.max(shiftMinutes - assignedMinutes, 0),
          coveragePercent,
        };
      }),
    [boardDate, dayAssignments, scheduleList, scheduledEmployees],
  );

  const assignmentWeatherWarnings = useMemo<Record<string, TaskWeatherWarning[]>>(() => {
    if (!weatherSnapshot) return {};

    return dayAssignments.reduce<Record<string, TaskWeatherWarning[]>>((acc, assignment) => {
      const task = taskList.find((candidate) => candidate.id === assignment.taskId);
      if (!task?.id) return acc;

      const warnings: TaskWeatherWarning[] = [];
      const category = (task.category ?? '').toLowerCase();
      const isSprayingTask =
        category.includes('spray') || category.includes('irrigation') || category.includes('application');
      const isMowingTask = category === 'mowing';

      const windHighForSpray = weatherSnapshot.windSpeed > escalationThresholds.windSpeedSprayCutoffMph;
      const rainHighForSpray = weatherSnapshot.precipitationProbability > escalationThresholds.rainProbabilitySprayCutoffPct;
      if (isSprayingTask && windHighForSpray && rainHighForSpray) {
        warnings.push({ level: 'danger', message: '🛑 Unsafe spray conditions' });
      } else if (isSprayingTask) {
        if (windHighForSpray) {
          warnings.push({
            level: 'warning',
            message: `⚠️ Wind too high for spraying (${Math.round(weatherSnapshot.windSpeed)}mph)`,
          });
        }
        if (rainHighForSpray) {
          warnings.push({
            level: 'warning',
            message: '⚠️ Rain expected — spraying not recommended',
          });
        }
      }

      if (isMowingTask && weatherSnapshot.precipitationProbability > 60) {
        warnings.push({
          level: 'warning',
          message: '⚠️ Wet conditions — mowing quality affected',
        });
      }

      if (weatherSnapshot.temperature > escalationThresholds.heatAdvisoryTempF + 10) {
        warnings.push({
          level: 'danger',
          message: '🛑 Extreme heat — consider rescheduling',
        });
      } else if (weatherSnapshot.temperature > escalationThresholds.heatAdvisoryTempF) {
        warnings.push({
          level: 'warning',
          message: '🔴 Heat advisory — schedule water breaks',
        });
      }

      if (warnings.length > 0 && assignment.id) {
        acc[assignment.id] = warnings;
      }
      return acc;
    }, {});
  }, [dayAssignments, escalationThresholds.heatAdvisoryTempF, escalationThresholds.rainProbabilitySprayCutoffPct, escalationThresholds.windSpeedSprayCutoffMph, taskList, weatherSnapshot]);

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

  useEffect(() => {
    if (orderedDispatchBoard.length === 0) {
      setExpandedMobileCrewIds((current) => (current.length === 0 ? current : []));
      return;
    }

    setExpandedMobileCrewIds((current) => {
      const validIds = new Set(orderedDispatchBoard.map((lane) => lane.employee.id));
      const filtered = current.filter((id) => validIds.has(id));
      if (filtered.length > 0) {
        const unchanged =
          filtered.length === current.length &&
          filtered.every((id, index) => id === current[index]);
        return unchanged ? current : filtered;
      }
      const nextDefault = orderedDispatchBoard[0].employee.id;
      return current.length === 1 && current[0] === nextDefault ? current : [nextDefault];
    });
  }, [orderedDispatchBoard]);

  const escalationAlerts = useMemo<EscalationAlert[]>(() => {
    const alerts: EscalationAlert[] = [];
    const nowIso = new Date().toISOString();

    const scheduledForDay = scheduleList.filter((entry) => entry.date === boardDate && entry.status === 'scheduled');
    const assignedEmployeeIds = new Set(dayAssignments.map((assignment) => assignment.employeeId));
    const unassignedCount = scheduledForDay.filter((entry) => !assignedEmployeeIds.has(entry.employeeId)).length;
    if (unassignedCount > 0) {
      alerts.push({
        id: `unassigned-${boardDate}`,
        severity: unassignedCount >= 3 ? 'critical' : 'warning',
        message: `${unassignedCount} crew member${unassignedCount === 1 ? '' : 's'} scheduled but unassigned`,
        timestamp: nowIso,
      });
    }

    const overdueThresholdDays = Math.max(1, escalationThresholds.equipmentServiceOverdueDays);
    const overdueThresholdDate = new Date();
    overdueThresholdDate.setDate(overdueThresholdDate.getDate() - overdueThresholdDays);
    let overdueCount = 0;
    let maxOverdueDays = 0;
    for (const unit of equipmentList as Array<Record<string, unknown>>) {
      const lastServicedRaw = String(unit.lastService ?? unit.last_serviced ?? '');
      if (!lastServicedRaw) continue;
      const lastServicedDate = new Date(lastServicedRaw);
      if (Number.isNaN(lastServicedDate.getTime()) || lastServicedDate >= overdueThresholdDate) continue;
      const overdueDays = Math.max(
        0,
        Math.floor((Date.now() - lastServicedDate.getTime()) / (1000 * 60 * 60 * 24)) - overdueThresholdDays,
      );
      overdueCount += 1;
      if (overdueDays > maxOverdueDays) maxOverdueDays = overdueDays;
    }
    if (overdueCount > 0) {
      alerts.push({
        id: `equipment-overdue-${boardDate}`,
        severity: maxOverdueDays >= overdueThresholdDays ? 'critical' : 'warning',
        message: `${overdueCount} equipment unit${overdueCount === 1 ? '' : 's'} overdue for service`,
        timestamp: nowIso,
      });
    }

    const lowCoverageCount = orderedDispatchBoard.filter(
      (lane) => lane.shiftMinutes > 0 && lane.coveragePercent < escalationThresholds.shiftCoverageWarningPct,
    ).length;
    if (lowCoverageCount > 0) {
      alerts.push({
        id: `coverage-low-${boardDate}`,
        severity: 'warning',
        message: `Shift coverage below ${Math.round(escalationThresholds.shiftCoverageWarningPct)}% for ${lowCoverageCount} crew member${lowCoverageCount === 1 ? '' : 's'}`,
        timestamp: nowIso,
      });
    }

    if (
      weatherSnapshot &&
      (weatherSnapshot.windSpeed > escalationThresholds.windSpeedSprayCutoffMph ||
        weatherSnapshot.precipitationProbability > escalationThresholds.rainProbabilitySprayCutoffPct)
    ) {
      alerts.push({
        id: `weather-unsafe-${boardDate}`,
        severity: 'critical',
        message: `Weather alert: unsafe spray conditions (wind ${Math.round(weatherSnapshot.windSpeed)} mph, rain ${Math.round(weatherSnapshot.precipitationProbability)}%)`,
        timestamp: nowIso,
      });
    }

    const openTaskRequestCount = propertyRequests.filter((request) => isRequestOpen(String(request.status ?? ''))).length;
    if (openTaskRequestCount > 0) {
      alerts.push({
        id: `open-requests-${boardDate}`,
        severity: 'info',
        message: `${openTaskRequestCount} unread task request${openTaskRequestCount === 1 ? '' : 's'}`,
        timestamp: nowIso,
      });
    }

    return alerts.filter((alert) => !dismissedEscalationIds.includes(alert.id));
  }, [boardDate, dayAssignments, dismissedEscalationIds, equipmentList, escalationThresholds.equipmentServiceOverdueDays, escalationThresholds.rainProbabilitySprayCutoffPct, escalationThresholds.shiftCoverageWarningPct, escalationThresholds.windSpeedSprayCutoffMph, isRequestOpen, orderedDispatchBoard, propertyRequests, scheduleList, weatherSnapshot]);

  const dismissEscalation = useCallback((alertId: string) => {
    setDismissedEscalationIds((current) => (current.includes(alertId) ? current : [...current, alertId]));
  }, []);

  const toggleMobileCrew = useCallback((employeeId: string) => {
    setExpandedMobileCrewIds((current) =>
      current.includes(employeeId) ? current.filter((id) => id !== employeeId) : [...current, employeeId],
    );
  }, []);

  const toggleDesktopCrew = useCallback((employeeId: string) => {
    setExpandedDesktopCrewId((current) => (current === employeeId ? null : employeeId));
  }, []);

  const toggleMobileSection = useCallback((section: keyof typeof mobileSectionsOpen) => {
    setMobileSectionsOpen((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }, []);

  const formatRelativeTime = useCallback((isoValue: string) => {
    const date = new Date(isoValue);
    const diffMs = Date.now() - date.getTime();
    if (Number.isNaN(diffMs) || diffMs < 0) return 'just now';
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }, []);

  const toggleTemplateTask = useCallback((taskId: string) => {
    setSelectedTemplateTaskIds((current) =>
      current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId],
    );
  }, []);

  const toggleTemplateEmployee = useCallback((employeeId: string) => {
    setSelectedTemplateEmployeeIds((current) =>
      current.includes(employeeId) ? current.filter((id) => id !== employeeId) : [...current, employeeId],
    );
  }, []);

  const openTaskTemplateDialog = useCallback(() => {
    setApplyTemplateToAllCrew(true);
    setSelectedTemplateEmployeeIds(scheduledEmployees.map((employee) => employee.id));
    setSelectedTemplateTaskIds([]);
    setTaskTemplateDialogOpen(true);
    if (!showTaskLoading && taskLibrary.length === 0 && !taskLibraryError) {
      void refetchTasks();
    }
  }, [refetchTasks, scheduledEmployees, showTaskLoading, taskLibrary.length, taskLibraryError]);

  const quickPlanDayLabel = useMemo(
    () => new Date(`${boardDate}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' }),
    [boardDate],
  );

  const quickPlanSuggestionsByEmployee = useMemo(() => {
    const byEmployee = new Map<string, QuickPlanSuggestion[]>();
    quickPlanSuggestions.forEach((item) => {
      if (!byEmployee.has(item.employeeId)) byEmployee.set(item.employeeId, []);
      byEmployee.get(item.employeeId)!.push(item);
    });
    return byEmployee;
  }, [quickPlanSuggestions]);

  const toggleQuickPlanSuggestion = useCallback((sourceId: string) => {
    setSelectedQuickPlanIds((current) =>
      current.includes(sourceId) ? current.filter((id) => id !== sourceId) : [...current, sourceId],
    );
  }, []);

  const openQuickPlanDialog = useCallback(async () => {
    if (isReadOnly) {
      toast.info('Demo mode is read-only.');
      return;
    }
    if (!supabase || !currentUser?.orgId) return;

    setQuickPlanDialogOpen(true);
    setQuickPlanLoading(true);
    setQuickPlanError(null);
    setQuickPlanSuggestions([]);
    setSelectedQuickPlanIds([]);
    setQuickPlanEmptyMessage(null);

    const selectedDate = new Date(`${boardDate}T00:00:00`);
    const previousDate = new Date(selectedDate);
    previousDate.setDate(previousDate.getDate() - 7);
    const previousDateKey = previousDate.toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from('assignments')
      .select('id, employee_id, task_id, title, estimated_hours, status, property_id')
      .eq('org_id', currentUser.orgId)
      .eq('date', previousDateKey)
      .in('status', ['planned', 'in_progress', 'done']);

    setQuickPlanLoading(false);

    if (error) {
      setQuickPlanError(error.message);
      return;
    }

    const suggestions = (data ?? []).map((row) => ({
      sourceId: String(row.id),
      employeeId: String(row.employee_id ?? ''),
      taskId: row.task_id ? String(row.task_id) : null,
      title: String(row.title ?? 'Task'),
      estimatedHours: Number(row.estimated_hours ?? 0),
      status: String(row.status ?? 'planned'),
      propertyId: row.property_id ? String(row.property_id) : null,
    })).filter((item) => item.employeeId);

    if (suggestions.length === 0) {
      setQuickPlanEmptyMessage(`No plan found for last ${quickPlanDayLabel}. Use Add Task or Apply Template to build today's plan.`);
      return;
    }

    setQuickPlanSuggestions(suggestions);
    setSelectedQuickPlanIds(suggestions.map((item) => item.sourceId));
  }, [boardDate, currentUser?.orgId, isReadOnly, quickPlanDayLabel]);

  const applyQuickPlan = useCallback(async () => {
    if (isReadOnly) {
      toast.info('Demo mode is read-only.');
      return;
    }
    if (!supabase || !currentUser?.orgId) return;

    const selected = quickPlanSuggestions.filter((item) => selectedQuickPlanIds.includes(item.sourceId));
    if (selected.length === 0) {
      toast.error('Select at least one task to apply.');
      return;
    }

    const scheduledByEmployee = new Map(
      scheduleList
        .filter((entry) => entry.date === boardDate && entry.status === 'scheduled')
        .map((entry) => [entry.employeeId, entry]),
    );

    const skippedEmployeeIds = new Set<string>();
    const rowsToInsert: Array<Record<string, unknown>> = [];
    const assignmentCountByEmployee = dayAssignments.reduce<Record<string, number>>((acc, assignment) => {
      acc[assignment.employeeId] = (acc[assignment.employeeId] ?? 0) + 1;
      return acc;
    }, {});

    let hasValidationFailure = false;
    selected.forEach((item) => {
      const shift = scheduledByEmployee.get(item.employeeId);
      if (!shift) {
        skippedEmployeeIds.add(item.employeeId);
        return;
      }
      const nextOrder = (assignmentCountByEmployee[item.employeeId] ?? 0) + 1;
      assignmentCountByEmployee[item.employeeId] = nextOrder;
      const row = {
        id: makeId(),
        org_id: currentUser.orgId,
        employee_id: item.employeeId,
        property_id:
          (effectivePropertyId && effectivePropertyId !== 'all' ? effectivePropertyId : shift.propertyId) ??
          item.propertyId ??
          activeProperty?.id ??
          properties[0]?.id ??
          null,
        task_id: item.taskId,
        title: item.title,
        date: boardDate,
        status: 'planned',
        estimated_hours: item.estimatedHours,
        order_index: nextOrder,
        start_time: shift.shiftStart ?? null,
      };
      const validationError = validateAssignmentWritePayload({
        employee_id: String(row.employee_id ?? ''),
        task_id: String(row.task_id ?? ''),
        org_id: String(row.org_id ?? ''),
        date: String(row.date ?? ''),
        status: String(row.status ?? ''),
      });
      if (validationError) {
        toast.error(validationError);
        hasValidationFailure = true;
        return;
      }
      rowsToInsert.push(row);
    });
    if (hasValidationFailure) return;

    if (rowsToInsert.length === 0) {
      const skippedNames = Array.from(skippedEmployeeIds)
        .map((id) => employeeList.find((employee) => employee.id === id))
        .filter(Boolean)
        .map((employee) => `${employee!.firstName} ${employee!.lastName}`);
      toast.info(
        skippedNames.length > 0
          ? `${skippedNames.join(', ')} ${skippedNames.length > 1 ? 'are' : 'is'} not scheduled today — skipping their tasks.`
          : 'No scheduled crew matched last week plan.',
      );
      return;
    }

    setQuickPlanApplying(true);
    const { error } = await supabase.from('assignments').insert(rowsToInsert);
    setQuickPlanApplying(false);

    if (error) {
      console.error('[ASSIGNMENT ERROR]', { error, payload: rowsToInsert });
      toast.error(`Could not apply quick plan: ${error.message}`);
      return;
    }

    const skippedNames = Array.from(skippedEmployeeIds)
      .map((id) => employeeList.find((employee) => employee.id === id))
      .filter(Boolean)
      .map((employee) => `${employee!.firstName} ${employee!.lastName}`);

    if (skippedNames.length > 0) {
      toast.info(`${skippedNames.join(', ')} ${skippedNames.length > 1 ? 'are' : 'is'} not scheduled today — skipping their tasks.`);
    }

    toast.success(`Applied ${rowsToInsert.length} task${rowsToInsert.length === 1 ? '' : 's'} from last ${quickPlanDayLabel}.`);
    setQuickPlanDialogOpen(false);
    setQuickPlanSuggestions([]);
    setSelectedQuickPlanIds([]);
    setQuickPlanEmptyMessage(null);
    void queryClient.invalidateQueries({ queryKey: ['assignments'] });
  }, [
    activeProperty?.id,
    boardDate,
    currentUser?.orgId,
    dayAssignments,
    effectivePropertyId,
    employeeList,
    isReadOnly,
    properties,
    queryClient,
    quickPlanDayLabel,
    quickPlanSuggestions,
    scheduleList,
    selectedQuickPlanIds,
  ]);

  const applyDailyTaskTemplate = useCallback(async () => {
    if (isReadOnly) {
      toast.info('Demo mode is read-only.');
      return;
    }
    if (!supabase || !currentUser?.orgId) return;

    if (selectedTemplateTaskIds.length === 0) {
      toast.error('Select at least one task to apply.');
      return;
    }

    const targetEmployeeIds = applyTemplateToAllCrew
      ? scheduledEmployees.map((employee) => employee.id)
      : selectedTemplateEmployeeIds;

    if (targetEmployeeIds.length === 0) {
      toast.error('Select at least one crew member.');
      return;
    }

    const selectedTasks = taskLibrary.filter((task) => selectedTemplateTaskIds.includes(task.id));
    if (selectedTasks.length === 0) {
      toast.error('Selected tasks are unavailable. Please reload and try again.');
      return;
    }

    const scheduleByEmployee = new Map(
      scheduleList
        .filter((entry) => entry.date === boardDate)
        .map((entry) => [entry.employeeId, entry]),
    );

    const assignmentCountByEmployee = dayAssignments.reduce<Record<string, number>>((acc, assignment) => {
      acc[assignment.employeeId] = (acc[assignment.employeeId] ?? 0) + 1;
      return acc;
    }, {});

    const rowsToInsert = targetEmployeeIds.flatMap((employeeId) => {
      const employeeShift = scheduleByEmployee.get(employeeId);
      const propertyIdForEmployee =
        (effectivePropertyId && effectivePropertyId !== 'all' ? effectivePropertyId : employeeShift?.propertyId) ??
        activeProperty?.id ??
        properties[0]?.id ??
        '';
      if (!propertyIdForEmployee) return [];

      return selectedTasks.map((task, index) => {
        const nextOrder = (assignmentCountByEmployee[employeeId] ?? 0) + index + 1;
        return {
          id: makeId(),
          org_id: currentUser.orgId,
          employee_id: employeeId,
          property_id: propertyIdForEmployee,
          task_id: task.id,
          title: task.name,
          date: boardDate,
          status: 'planned',
          estimated_hours: task.estimated_hours ?? 0,
          order_index: nextOrder,
          start_time: employeeShift?.shiftStart ?? null,
        };
      });
    });

    if (rowsToInsert.length === 0) {
      toast.error('Unable to determine property for selected crew.');
      return;
    }

    setApplyingTaskTemplate(true);
    const validationError = rowsToInsert
      .map((row) =>
        validateAssignmentWritePayload({
          employee_id: String(row.employee_id ?? ''),
          task_id: String(row.task_id ?? ''),
          org_id: String(row.org_id ?? ''),
          date: String(row.date ?? ''),
          status: String(row.status ?? ''),
        }),
      )
      .find(Boolean);
    if (validationError) {
      toast.error(validationError);
      setApplyingTaskTemplate(false);
      return;
    }

    const { error } = await supabase.from('assignments').insert(rowsToInsert);
    setApplyingTaskTemplate(false);

    if (error) {
      console.error('[ASSIGNMENT ERROR]', { error, payload: rowsToInsert });
      toast.error(`Could not apply task template: ${error.message}`);
      return;
    }

    setTaskTemplateDialogOpen(false);
    setSelectedTemplateTaskIds([]);
    setSelectedTemplateEmployeeIds([]);
    setApplyTemplateToAllCrew(true);
    toast.success(`Applied ${selectedTasks.length} tasks to ${targetEmployeeIds.length} crew members.`);
    void queryClient.invalidateQueries({ queryKey: ['assignments'] });
  }, [
    activeProperty?.id,
    applyTemplateToAllCrew,
    boardDate,
    currentUser?.orgId,
    dayAssignments,
    effectivePropertyId,
    isReadOnly,
    properties,
    queryClient,
    scheduleList,
    scheduledEmployees,
    selectedTemplateEmployeeIds,
    selectedTemplateTaskIds,
    taskLibrary,
  ]);

  const totalOpenMinutes = useMemo(
    () => orderedDispatchBoard.reduce((s, l) => s + l.openMinutes, 0),
    [orderedDispatchBoard],
  );

  const availableEquipment = useMemo(
    () =>
      availableEquipmentList.filter((unit) => unit.active !== false && String(unit.status ?? '').toLowerCase() === 'available'),
    [availableEquipmentList],
  );

  const latestWeatherLog = useMemo(
    () => [...weatherLogs].sort((a, b) => b.date.localeCompare(a.date))[0],
    [weatherLogs],
  );

  const planningWeatherLocation = latestWeatherLog
    ? weatherLocations.find((l) => l.id === latestWeatherLog.locationId) ?? weatherLocations[0]
    : weatherLocations[0];
  const weatherCellIcon = useCallback((code: number) => {
    if (code === 0) return '☀️';
    if (code <= 2) return '🌤';
    if (code === 3) return '☁️';
    if (code <= 48) return '🌫️';
    if (code <= 82) return '🌧️';
    return '⛈️';
  }, []);
  const weatherCellTone = useCallback((precip: number, code: number) => {
    if (code >= 95 || precip >= 60 || (code >= 61 && code <= 82)) return 'bg-red-100 text-red-800 border-red-200';
    if (precip >= 25 || code === 3 || (code >= 45 && code <= 57)) return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  }, []);

  const showFreshUpdateBadge = lastRealtimeRefreshAt != null && Date.now() - lastRealtimeRefreshAt < 90_000;
  const [todayDateKey] = useState(() => new Date().toLocaleDateString('en-CA'));

  useEffect(() => {
    const dismissed = window.localStorage.getItem('ground-crew-first-visit-workboard-dismissed') === 'true';
    setShowFirstVisitHint(!dismissed);
  }, []);
  const showEndOfDayReportButton = useMemo(() => new Date().getHours() >= 14, []);

  const newRequestsCount = propertyRequests.filter((r) => isRequestOpen(String(r.status ?? ''))).length;

  const weatherSummaryLabel = weatherSnapshot
    ? `${Math.round(weatherSnapshot.temperature)}°F, wind ${Math.round(weatherSnapshot.windSpeed)} mph`
    : latestWeatherLog?.currentConditions || 'Weather unavailable';

  const buildScheduleShareText = useCallback(() => {
    const propertyLabel = activeProperty?.name || 'All Properties';
    const selectedEmployees =
      selectedScheduleRecipientIds.length > 0
        ? scheduledEmployees.filter((employee) => selectedScheduleRecipientIds.includes(employee.id))
        : scheduledEmployees;
    const lines = [
      `*Ground Crew HQ — ${new Date(`${boardDate}T00:00:00`).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      })}*`,
      `*${propertyLabel}*`,
      '',
    ];
    if (selectedEmployees.length === 0) {
      lines.push('No scheduled crew for this date.');
    } else {
      selectedEmployees.forEach((employee) => {
        const shift = getShiftForEmployee(scheduleList, employee.id, boardDate);
        const shiftLabel = shift ? `${formatTime(shift.shiftStart)} - ${formatTime(shift.shiftEnd)}` : 'No shift';
        const tasks = dayAssignments.filter((assignment) => assignment.employeeId === employee.id);
        lines.push(`👤 ${employee.firstName} ${employee.lastName}`);
        lines.push(`⏰ ${shiftLabel}`);
        lines.push('📋 Tasks:');
        if (tasks.length === 0) {
          lines.push('• No tasks assigned');
        } else {
          tasks.forEach((task) => {
            const est = Number(task.estimatedHours ?? 0);
            lines.push(`• ${task.title || 'Task'} (${est.toFixed(1)}h)`);
          });
        }
        lines.push('');
      });
    }
    lines.push(`🌤️ Weather: ${weatherSummaryLabel}`);
    return lines.join('\n');
  }, [activeProperty?.name, boardDate, dayAssignments, scheduleList, scheduledEmployees, selectedScheduleRecipientIds, weatherSummaryLabel]);

  const shareScheduleByEmail = useCallback(() => {
    const propertyLabel = activeProperty?.name || 'All Properties';
    const subject = `Ground Crew HQ — Your Schedule for ${new Date(`${boardDate}T00:00:00`).toLocaleDateString('en-US')}`;
    const body = buildScheduleShareText();
    window.location.href = `mailto:?subject=${encodeURIComponent(`${subject} — ${propertyLabel}`)}&body=${encodeURIComponent(body)}`;
  }, [activeProperty?.name, boardDate, buildScheduleShareText]);

  const shareScheduleByCopy = useCallback(async () => {
    const text = buildScheduleShareText();
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Schedule copied!');
    } catch {
      toast.error('Unable to copy schedule.');
    }
  }, [buildScheduleShareText]);

  const shareScheduleByWhatsApp = useCallback(() => {
    const text = buildScheduleShareText();
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  }, [buildScheduleShareText]);

  const suggestedTasks = useMemo(() => {
    const items: SuggestedTaskItem[] = [];
    const dayLabel = new Date(`${boardDate}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' });

    if (weatherSnapshot) {
      if (weatherSnapshot.precipitationProbability < 20 && weatherSnapshot.windSpeed < 10) {
        items.push({
          id: 'weather-good-spraying',
          tone: 'opportunity',
          title: 'Good conditions for spraying',
          detail: `Current wind is ${Math.round(weatherSnapshot.windSpeed)} mph with ${Math.round(weatherSnapshot.precipitationProbability)}% rain chance.`,
        });
      }

      const hasRecentRain = weatherLogs.some((log) => Number(log.rainfallTotal ?? 0) > 0) || (hourlyWeatherStripQuery.data ?? []).some((entry) => entry.precip >= 50);
      if (hasRecentRain) {
        items.push({
          id: 'weather-wet-course',
          tone: 'warning',
          title: 'Course may be wet',
          detail: 'Recent rain signals softer turf. Consider delaying mowing for better quality.',
        });
      }

      if (weatherSnapshot.temperature > 95) {
        items.push({
          id: 'weather-water-breaks',
          tone: 'urgent',
          title: 'Heat risk for crew',
          detail: `Temperature is ${Math.round(weatherSnapshot.temperature)}°F. Schedule water breaks every 90 minutes.`,
        });
      }

      if (weatherSnapshot.windSpeed > 15) {
        items.push({
          id: 'weather-postpone-spray',
          tone: 'urgent',
          title: 'Postpone spray applications',
          detail: `Wind is ${Math.round(weatherSnapshot.windSpeed)} mph, which is above safe spray conditions.`,
        });
      }
    }

    const historySummary = previousWeekSummary;
    if (historySummary.length > 0) {
      items.push({
        id: 'history-last-week-plan',
        tone: 'opportunity',
        title: `Last ${dayLabel}'s top tasks`,
        detail: `Your team did: ${historySummary.map((entry) => `${entry.title} (${entry.count}x)`).join(', ')}.`,
        actionLabel: "Apply Last Week's Plan",
        onAction: () => { void openQuickPlanDialog(); },
      });
    }

    for (const lane of orderedDispatchBoard) {
      if (lane.employeeAssignments.length === 0 && lane.shiftMinutes > 0) {
        items.push({
          id: `coverage-gap-${lane.employee.id}`,
          tone: 'warning',
          title: `${lane.employee.firstName} ${lane.employee.lastName} has no tasks assigned`,
          detail: `${formatMinutesAsHoursAndMinutes(lane.shiftMinutes)} of shift time is currently unplanned.`,
        });
      }
    }

    const now = Date.now();
    for (const unit of equipmentList as Array<Record<string, unknown>>) {
      const lastServiceRaw = unit.lastService ?? unit.last_serviced;
      if (!lastServiceRaw) continue;
      const lastServiceDate = new Date(String(lastServiceRaw));
      if (Number.isNaN(lastServiceDate.getTime())) continue;
      const overdueDays = Math.floor((now - lastServiceDate.getTime()) / (1000 * 60 * 60 * 24)) - escalationThresholds.equipmentServiceOverdueDays;
      if (overdueDays <= 0) continue;
      const unitName = String(unit.unit_name ?? unit.name ?? 'Equipment');
      items.push({
        id: `equipment-overdue-${String(unit.id ?? unitName)}`,
        tone: overdueDays >= 30 ? 'urgent' : 'warning',
        title: `${unitName} is overdue for service`,
        detail: `Overdue by ${overdueDays} day${overdueDays === 1 ? '' : 's'} — consider scheduling maintenance today.`,
      });
    }

    return items.filter((item) => !dismissedSuggestionIds.includes(item.id));
  }, [
    boardDate,
    dismissedSuggestionIds,
    equipmentList,
    escalationThresholds.equipmentServiceOverdueDays,
    hourlyWeatherStripQuery.data,
    openQuickPlanDialog,
    orderedDispatchBoard,
    previousWeekSummary,
    weatherLogs,
    weatherSnapshot,
  ]);

  const activeWorkflowIssueCount = useMemo(() => {
    const unscheduledCount = unscheduledEmployees.length;
    const suggestionsCount = suggestedTasks.length;
    const escalationCount = escalationAlerts.length;
    return unscheduledCount + suggestionsCount + escalationCount;
  }, [escalationAlerts.length, suggestedTasks.length, unscheduledEmployees.length]);

  useEffect(() => {
    if (typeof window === 'undefined' || !currentUser?.orgId) return;
    const key = `ground-crew-workflow-badge-count:${currentUser.orgId}`;
    if (activeWorkflowIssueCount > 0) {
      window.localStorage.setItem(key, String(activeWorkflowIssueCount));
    } else {
      window.localStorage.removeItem(key);
    }
  }, [activeWorkflowIssueCount, currentUser?.orgId]);

  const dismissSuggestedTask = useCallback((id: string) => {
    setDismissedSuggestionIds((current) => (current.includes(id) ? current : [...current, id]));
  }, []);

  const generateEndOfDayReport = useCallback(async () => {
    if (!currentUser?.orgId) return;
    setEndOfDayReportGenerating(true);
    const propertyLabel = activeProperty?.name || 'All Properties';
    const reportDate = new Date(`${boardDate}T00:00:00`);
    const reportDateLabel = reportDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    const crewLines = scheduledEmployees.map((employee) => {
      const shift = getShiftForEmployee(scheduleList, employee.id, boardDate);
      const employeeAssignments = dayAssignments.filter((assignment) => assignment.employeeId === employee.id);
      const completedCount = employeeAssignments.filter((assignment) => normalizeAssignmentStatus(assignment.status) === 'done').length;
      const actualHours = employeeAssignments.reduce((sum, assignment) => sum + Number(assignment.actualHours ?? 0), 0);
      const shiftLabel = shift ? `${formatTime(shift.shiftStart)} - ${formatTime(shift.shiftEnd)}` : 'No shift';
      return `${employee.firstName} ${employee.lastName} — ${shiftLabel} — ${completedCount} completed — ${actualHours.toFixed(1)}h actual`;
    });

    const totalTasks = dayAssignments.length;
    const completedTasks = dayAssignments.filter((assignment) => normalizeAssignmentStatus(assignment.status) === 'done').length;
    const completionPct = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
    const scheduledHours = dayAssignments.reduce((sum, assignment) => sum + Number(assignment.estimatedHours ?? 0), 0);
    const actualHours = dayAssignments.reduce((sum, assignment) => sum + Number(assignment.actualHours ?? 0), 0);
    const varianceHours = actualHours - scheduledHours;
    const variancePct = scheduledHours > 0 ? (varianceHours / scheduledHours) * 100 : 0;

    const weatherPoints = hourlyWeatherStripQuery.data ?? [];
    const highTemp = weatherPoints.length > 0 ? Math.max(...weatherPoints.map((point) => point.temp)) : Math.round(weatherSnapshot?.temperature ?? 0);
    const maxWind = weatherPoints.length > 0 ? Math.max(...weatherPoints.map((point) => point.wind)) : Math.round(weatherSnapshot?.windSpeed ?? 0);
    const rainTotal = Number(latestWeatherLog?.rainfallTotal ?? 0);

    const overdueThresholdDays = Math.max(1, escalationThresholds.equipmentServiceOverdueDays);
    const overdueThresholdDate = new Date();
    overdueThresholdDate.setDate(overdueThresholdDate.getDate() - overdueThresholdDays);
    const equipmentNotes = (equipmentList as Array<Record<string, unknown>>)
      .map((unit) => {
        const unitName = String(unit.unit_name ?? unit.name ?? 'Equipment');
        const status = String(unit.status ?? '').toLowerCase();
        const lastServiceRaw = unit.lastService ?? unit.last_serviced;
        if (status === 'in_use') return `${unitName} — currently in use`;
        if (lastServiceRaw) {
          const lastServiceDate = new Date(String(lastServiceRaw));
          if (!Number.isNaN(lastServiceDate.getTime()) && lastServiceDate < overdueThresholdDate) {
            const overdueByDays = Math.floor((Date.now() - lastServiceDate.getTime()) / (1000 * 60 * 60 * 24)) - overdueThresholdDays;
            return `${unitName} — overdue for service by ${Math.max(1, overdueByDays)} day${Math.max(1, overdueByDays) === 1 ? '' : 's'}`;
          }
        }
        return null;
      })
      .filter((note): note is string => Boolean(note));

    const openAssignmentItems = dayAssignments
      .filter((assignment) => {
        const status = normalizeAssignmentStatus(assignment.status);
        return status === 'planned' || status === 'in-progress';
      })
      .map((assignment) => `${assignment.title} (${normalizeAssignmentStatus(assignment.status).replace('-', ' ')})`);

    const openRequests = propertyRequests
      .filter((request) => isRequestOpen(String(request.status ?? '')))
      .map((request) => request.title);

    const reportLines = [
      'GROUND CREW HQ — DAILY OPERATIONS REPORT',
      `${propertyLabel} — ${reportDateLabel}`,
      '',
      'CREW SUMMARY:',
      `${scheduledEmployees.length} crew members worked today`,
      ...(crewLines.length > 0 ? crewLines.map((line) => `- ${line}`) : ['- No crew scheduled']),
      '',
      'TASK COMPLETION:',
      `${completedTasks}/${totalTasks} tasks completed (${completionPct}%)`,
      `Scheduled hours: ${scheduledHours.toFixed(1)}`,
      `Actual hours: ${actualHours.toFixed(1)}`,
      `Variance: ${varianceHours >= 0 ? '+' : ''}${varianceHours.toFixed(1)}h (${variancePct >= 0 ? '+' : ''}${variancePct.toFixed(1)}%)`,
      '',
      'WEATHER CONDITIONS:',
      `High: ${Math.round(highTemp)}°F | Wind: ${Math.round(maxWind)}mph | Rain: ${rainTotal.toFixed(1)}mm`,
      '',
      'EQUIPMENT NOTES:',
      ...(equipmentNotes.length > 0 ? equipmentNotes.map((note) => `- ${note}`) : ['- No equipment flags']),
      '',
      'OPEN ITEMS:',
      ...(openAssignmentItems.length > 0 ? openAssignmentItems.map((item) => `- ${item}`) : ['- No open assignments']),
      ...(openRequests.length > 0 ? openRequests.map((item) => `- Need: ${item}`) : ['- No open task requests']),
    ];

    const fullText = reportLines.join('\n');
    const condensed = [
      `*Ground Crew HQ — End of Day*`,
      `*${propertyLabel}*`,
      `${completedTasks}/${totalTasks} tasks done (${completionPct}%)`,
      `Crew: ${scheduledEmployees.length} | Hours: ${actualHours.toFixed(1)} actual / ${scheduledHours.toFixed(1)} scheduled`,
      `Weather: ${Math.round(highTemp)}°F high, ${Math.round(maxWind)}mph wind, ${rainTotal.toFixed(1)}mm rain`,
      `Open items: ${openAssignmentItems.length} tasks, ${openRequests.length} needs`,
    ].join('\n');

    setEndOfDayReportText(fullText);
    setEndOfDayReportCondensed(condensed);
    setEndOfDayReportSubject(`Ground Crew HQ — End of Day Report — ${propertyLabel} — ${reportDate.toLocaleDateString('en-US')}`);

    if (supabase && currentUser?.orgId && effectivePropertyId && effectivePropertyId !== 'all') {
      const notePayload = {
        id: makeId(),
        org_id: currentUser.orgId,
        property_id: effectivePropertyId,
        title: `Daily Operations Report — ${reportDate.toLocaleDateString('en-US')}`,
        content: fullText,
        type: 'daily',
        category: 'daily-report',
        date: todayDateKey,
        created_by: currentUser?.appUserId ?? null,
        author: 'Operations Assistant',
      };
      const { error } = await supabase.from('notes').insert(notePayload);
      if (error) {
        toast.error(`Failed to archive report: ${error.message}`);
      } else {
        void queryClient.invalidateQueries({ queryKey: ['notes'] });
      }
    }
    setEndOfDayReportGenerating(false);
  }, [
    activeProperty?.name,
    boardDate,
    currentUser?.appUserId,
    currentUser?.orgId,
    dayAssignments,
    effectivePropertyId,
    equipmentList,
    escalationThresholds.equipmentServiceOverdueDays,
    hourlyWeatherStripQuery.data,
    isRequestOpen,
    latestWeatherLog?.rainfallTotal,
    propertyRequests,
    queryClient,
    scheduleList,
    scheduledEmployees,
    supabase,
    todayDateKey,
    weatherSnapshot?.temperature,
    weatherSnapshot?.windSpeed,
  ]);

  const openEndOfDayReportDialog = useCallback(() => {
    setEndOfDayDialogOpen(true);
    void generateEndOfDayReport();
  }, [generateEndOfDayReport]);

  const copyEndOfDayReport = useCallback(async () => {
    if (!endOfDayReportText) return;
    try {
      await navigator.clipboard.writeText(endOfDayReportText);
      toast.success('End of day report copied to clipboard');
    } catch {
      toast.error('Unable to copy report');
    }
  }, [endOfDayReportText]);

  const emailEndOfDayReport = useCallback(() => {
    if (!endOfDayReportText) return;
    window.location.href = `mailto:?subject=${encodeURIComponent(endOfDayReportSubject)}&body=${encodeURIComponent(endOfDayReportText)}`;
  }, [endOfDayReportSubject, endOfDayReportText]);

  const shareEndOfDayReportWhatsApp = useCallback(() => {
    if (!endOfDayReportCondensed) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(endOfDayReportCondensed)}`, '_blank', 'noopener,noreferrer');
  }, [endOfDayReportCondensed]);

  const printEndOfDayReport = useCallback(() => {
    if (!endOfDayReportText) return;
    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!printWindow) {
      toast.error('Unable to open print dialog');
      return;
    }
    printWindow.document.write(`<pre style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; white-space: pre-wrap; padding: 20px;">${escapeHtml(endOfDayReportText)}</pre>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }, [endOfDayReportText]);

  const handlePrintDailyPlan = useCallback(() => {
    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!printWindow) {
      toast.error('Unable to open print preview');
      return;
    }

    const propertyLabel = activeProperty?.name || 'All Properties';
    const preparedBy = currentUser?.fullName || currentUser?.email || 'Ground Crew HQ';
    const weatherSummary = weatherSnapshot
      ? `${Math.round(weatherSnapshot.temperature)}°F · Wind ${Math.round(weatherSnapshot.windSpeed)} mph`
      : latestWeatherLog?.currentConditions || 'Weather unavailable';

    const rowsMarkup = orderedDispatchBoard
      .map((lane) => {
        const employeeName = `${lane.employee.firstName} ${lane.employee.lastName}`.trim();
        const shiftLabel = lane.shift
          ? `${formatTime(lane.shift.shiftStart)} - ${formatTime(lane.shift.shiftEnd)}`
          : 'No shift';

        const taskRows = lane.employeeAssignments
          .map((assignment, index) => {
            const task = taskList.find((candidate) => candidate.id === assignment.taskId);
            const equipment = equipmentList.find((unit) => unit.id === assignment.equipmentId);
            const estimatedHours = Math.max(0, Number(assignment.duration ?? 0) / 60);
            const estimatedLabel = Number.isInteger(estimatedHours)
              ? `${estimatedHours}h`
              : `${estimatedHours.toFixed(1)}h`;
            const equipmentLabel = equipment?.unitNumber || 'None';

            return `
              <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(task?.name || 'Task')}</td>
                <td>${escapeHtml(task?.category || 'General')}</td>
                <td>${escapeHtml(estimatedLabel)}</td>
                <td>${escapeHtml(equipmentLabel)}</td>
                <td>${escapeHtml(assignment.area || '—')}</td>
                <td>${escapeHtml(String(assignment.status || 'planned'))}</td>
              </tr>
            `;
          })
          .join('');

        return `
          <section class="employee-section">
            <h2>${escapeHtml(employeeName)} — Shift: ${escapeHtml(shiftLabel)}</h2>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Task</th>
                  <th>Category</th>
                  <th>Est. Hours</th>
                  <th>Equipment</th>
                  <th>Location</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${taskRows || '<tr><td colspan="7">No tasks assigned</td></tr>'}
              </tbody>
            </table>
          </section>
        `;
      })
      .join('');

    const totalScheduledHours = orderedDispatchBoard.reduce((sum, lane) => sum + lane.shiftMinutes / 60, 0);
    const totalTasks = dayAssignments.length;

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Daily Work Plan - ${escapeHtml(propertyLabel)}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
            h1 { margin: 0; font-size: 20px; }
            .subhead { margin-top: 6px; color: #4b5563; font-size: 13px; }
            .employee-section { margin-top: 22px; }
            .employee-section h2 { margin: 0 0 10px; font-size: 15px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
            thead { background: #f9fafb; }
            .footer { margin-top: 24px; font-size: 12px; color: #374151; }
            @media print {
              body { margin: 12mm; }
            }
          </style>
        </head>
        <body>
          <header>
            <h1>Ground Crew HQ · ${escapeHtml(propertyLabel)} · Daily Work Plan</h1>
            <div class="subhead">Date: ${escapeHtml(boardDate)} · Prepared by: ${escapeHtml(preparedBy)}</div>
          </header>
          ${rowsMarkup || '<p>No scheduled crew for this date.</p>'}
          <footer class="footer">
            <div>Total Scheduled Hours: ${totalScheduledHours.toFixed(1)}h · Total Tasks: ${totalTasks}</div>
            <div>Weather: ${escapeHtml(weatherSummary)}</div>
          </footer>
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
              }, 120);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }, [
    activeProperty?.name,
    boardDate,
    currentUser?.email,
    currentUser?.fullName,
    dayAssignments.length,
    equipmentList,
    latestWeatherLog?.currentConditions,
    orderedDispatchBoard,
    taskList,
    weatherSnapshot,
  ]);

  function openAssignmentDialog(employeeId: string) {
    lastAssignmentModalTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const targetEmployeeId = employeeId || fallbackEligibleEmployees[0]?.id || '';
    const defaultStartTime = getDefaultStartTimeForEmployee(scheduleList, targetEmployeeId, boardDate);
    const targetPropertyId =
      effectivePropertyId && effectivePropertyId !== 'all' ? effectivePropertyId : properties[0]?.id ?? '';
    setEditingAssignmentId(null);
    setSelectedEmployeeId(targetEmployeeId);
    setTaskRows([makeEmptyTaskRow(defaultStartTime, effectivePropertyId && effectivePropertyId !== 'all' ? effectivePropertyId : '')]);
    setAssignmentDraft({
      employeeId: targetEmployeeId,
      propertyId: targetPropertyId,
      taskId: '',
      equipmentId: '',
      startTime: defaultStartTime,
      status: 'planned',
      notes: '',
    });
    setIsAssignmentModalDirty(false);
    setAssignmentDialogOpen(true);
  }

  function openEditAssignmentDialog(assignment: Assignment) {
    lastAssignmentModalTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditingAssignmentId(assignment.id);
    setSelectedEmployeeId(assignment.employeeId);
    setAssignmentDraft({
      employeeId: assignment.employeeId,
      propertyId: assignment.propertyId ?? '',
      taskId: assignment.taskId,
      equipmentId: assignment.equipmentId ?? '',
      startTime: assignment.startTime,
      status: assignment.status,
      notes: '',
    });
    setTaskRows([makeEmptyTaskRow(assignment.startTime || '05:30')]);
    setIsAssignmentModalDirty(false);
    setAssignmentDialogOpen(true);
  }

  function applyRequestToAssignment(request: NeedsQueueRequest) {
    if (isReadOnly) {
      toast.info('Demo mode is read-only.');
      return;
    }
    lastAssignmentModalTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setLinkedRequestId(request.id);
    setLinkedRequestTitle(request.title);
    const targetTaskId = request.taskId || taskList[0]?.id || '';
    const targetEmployeeId = fallbackEligibleEmployees[0]?.id || '';
    const defaultStartTime = getDefaultStartTimeForEmployee(scheduleList, targetEmployeeId, boardDate);
    setEditingAssignmentId(null);
    setSelectedEmployeeId(targetEmployeeId);
    setTaskRows([{ ...makeEmptyTaskRow(defaultStartTime, (effectivePropertyId && effectivePropertyId !== 'all' ? effectivePropertyId : request.propertyId) ?? ''), taskId: targetTaskId }]);
    setAssignmentDraft({
      employeeId: targetEmployeeId,
      propertyId: (effectivePropertyId && effectivePropertyId !== 'all' ? effectivePropertyId : properties[0]?.id) ?? '',
      taskId: targetTaskId,
      equipmentId: '',
      startTime: defaultStartTime,
      status: 'planned',
      notes: request.description ?? '',
    });
    setIsAssignmentModalDirty(false);
    setAssignmentDialogOpen(true);
  }

  const closeAssignmentDialog = useCallback(
    (forceDiscard = false) => {
      if (!forceDiscard && isAssignmentModalDirty) {
        const shouldDiscard = window.confirm('You have unsaved changes. Discard?');
        if (!shouldDiscard) return false;
      }
      setAssignmentDialogOpen(false);
      setLinkedRequestId(null);
      setLinkedRequestTitle(null);
      setTaskRows([makeEmptyTaskRow(getDefaultStartTimeForEmployee(scheduleList, assignmentDraft.employeeId, boardDate), effectivePropertyId && effectivePropertyId !== 'all' ? effectivePropertyId : '')]);
      setWeatherConflictOverride(false);
      setIsAssignmentModalDirty(false);
      return true;
    },
    [assignmentDraft.employeeId, boardDate, effectivePropertyId, isAssignmentModalDirty, scheduleList],
  );

  useEffect(() => {
    if (!assignmentDialogOpen || !isAssignmentModalDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [assignmentDialogOpen, isAssignmentModalDirty]);

  useEffect(() => {
    if (!assignmentDialogOpen) return;
    const timerId = window.setTimeout(() => {
      assignmentFirstFieldRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timerId);
  }, [assignmentDialogOpen]);

  useEffect(() => {
    const handleOpenAddTask = () => {
      if (isReadOnly) return;
      const targetEmployeeId = selectedEmployeeId || fallbackEligibleEmployees[0]?.id || '';
      openAssignmentDialog(targetEmployeeId);
    };
    const handleCloseModals = () => {
      if (assignmentDialogOpen) closeAssignmentDialog();
      setQuickPlanDialogOpen(false);
      setTaskTemplateDialogOpen(false);
      setSendScheduleDialogOpen(false);
      setNoteDialogOpen(false);
    };
    window.addEventListener('ground-crew-open-add-task', handleOpenAddTask);
    window.addEventListener('ground-crew-close-modals', handleCloseModals);
    return () => {
      window.removeEventListener('ground-crew-open-add-task', handleOpenAddTask);
      window.removeEventListener('ground-crew-close-modals', handleCloseModals);
    };
  }, [assignmentDialogOpen, closeAssignmentDialog, fallbackEligibleEmployees, isReadOnly, openAssignmentDialog, selectedEmployeeId]);

  async function saveAssignment(ignoreWeatherConflict = false) {
    if (isReadOnly) {
      toast.info('Demo mode is read-only.');
      return;
    }
    if (!supabase) return;
    if (!currentUser?.orgId) {
      toast.error('Missing organization context.');
      return;
    }
    if (!isValidAssignmentDate(boardDate)) {
      toast.error('Invalid assignment date.');
      return;
    }
    const resolvedPropertyId = editingAssignmentId
      ? (effectivePropertyId && effectivePropertyId !== 'all' ? effectivePropertyId : null) ?? assignmentDraft.propertyId ?? null
      : null;
    if (editingAssignmentId && !resolvedPropertyId) {
      toast.error('No property available for assignment.');
      return;
    }

    if (dispatchWeatherConflict.hasSprayConflict && !weatherConflictOverride && !ignoreWeatherConflict) {
      toast.warning('Weather conflict detected. Review warning before dispatching.');
      return;
    }

    let linkedRequestTaskId: string | null = editingAssignmentId ? assignmentDraft.taskId || null : null;

    if (!editingAssignmentId) {
      if (!assignmentDraft.employeeId) {
        toast.error('Select a crew member.');
        return;
      }
      if (taskRows.every((row) => !row.taskId)) {
        toast.error('Add at least one task.');
        return;
      }
      const employee =
        scheduledEmployees.find((entry) => entry.id === assignmentDraft.employeeId) ??
        fallbackEligibleEmployees.find((entry) => entry.id === assignmentDraft.employeeId);
      if (!employee) {
        toast.error('Selected crew member not found.');
        return;
      }
      const shift = getShiftForEmployee(scheduleList, employee.id, boardDate);
      const shiftMinutes = shift ? Math.max(timeToMinutes(shift.shiftEnd) - timeToMinutes(shift.shiftStart), 0) : 0;
      const assignedMinutes = dayAssignments
        .filter((assignment) => assignment.employeeId === employee.id)
        .reduce((sum, assignment) => sum + Math.round((assignment.estimatedHours ?? 0) * 60), 0);
      const rowsToInsert: Array<Record<string, unknown>> = [];
      const optimisticAssignments: Assignment[] = [];
      let nextOrder = dayAssignments.filter((assignment) => assignment.employeeId === employee.id).length + 1;
      let pendingMinutes = 0;

      for (const taskRow of taskRows) {
        if (!taskRow.taskId) continue;
        const propertyIdForRow = taskRow.propertyId || activeProperty?.id || properties[0]?.id || null;
        if (!propertyIdForRow) {
          toast.warning('Skipped a task: no property selected.');
          continue;
        }
        const selectedTask = taskLibrary.find((task) => task.id === taskRow.taskId) ?? null;
        const selectedTaskName = selectedTask?.name ?? 'Task';
        const selectedTaskId = String(selectedTask?.id ?? '').trim();
        if (!isValidUuid(selectedTaskId)) {
          toast.warning(`Skipped ${selectedTaskName}: invalid task.`);
          continue;
        }
        if (taskRow.equipmentId) {
          const selectedEquipment = availableEquipment.find((unit) => unit.id === taskRow.equipmentId);
          const isReady = selectedEquipment && String(selectedEquipment.status ?? '').toLowerCase() === 'available' && selectedEquipment.active !== false;
          if (!isReady) {
            toast.warning(`Skipped ${selectedTaskName}: equipment is not ready.`);
            continue;
          }
        }
        const overrideValue = Number(taskRow.hoursOverride);
        const estimatedHours = taskRow.hoursOverride.trim() && Number.isFinite(overrideValue) && overrideValue > 0
          ? overrideValue
          : Number(selectedTask?.estimated_hours ?? 0);
        const estimatedMinutes = Math.round(estimatedHours * 60);
        if (shiftMinutes > 0 && assignedMinutes + pendingMinutes + estimatedMinutes > shiftMinutes) {
          toast('Assigned tasks exceed shift hours', {
            description: `Shift: ${shiftMinutes} min · Assigned: ${assignedMinutes + pendingMinutes + estimatedMinutes} min`,
          });
        }
        const assignmentId = makeId();
        const writeStatus = toAssignmentWriteStatus(taskRow.status);
        const row: Record<string, unknown> = {
          id: assignmentId,
          org_id: currentUser.orgId,
          employee_id: employee.id,
          property_id: propertyIdForRow,
          task_id: selectedTaskId,
          title: linkedRequestTitle ?? selectedTaskName,
          date: boardDate,
          status: writeStatus,
          estimated_hours: estimatedHours,
          order_index: nextOrder,
          equipment_unit_id: taskRow.equipmentId || null,
          start_time: taskRow.startTime || null,
          notes: assignmentDraft.notes.trim() || null,
        };
        const validationError = validateAssignmentWritePayload({
          employee_id: String(row.employee_id ?? ''),
          task_id: String(row.task_id ?? ''),
          org_id: String(row.org_id ?? ''),
          date: String(row.date ?? ''),
          status: String(row.status ?? ''),
        });
        if (validationError) {
          toast.warning(`Skipped ${selectedTaskName}: ${validationError}`);
          continue;
        }

        linkedRequestTaskId = linkedRequestTaskId ?? selectedTaskId;
        pendingMinutes += estimatedMinutes;
        nextOrder += 1;
        rowsToInsert.push(row);
        optimisticAssignments.push({
          id: assignmentId,
          employeeId: employee.id,
          taskId: selectedTaskId,
          equipmentId: taskRow.equipmentId || undefined,
          date: boardDate,
          startTime: taskRow.startTime || '06:00',
          estimatedHours: Number((estimatedMinutes / 60).toFixed(2)),
          duration: estimatedMinutes,
          area: properties.find((property) => property.id === propertyIdForRow)?.name ?? 'Assigned property',
          status: normalizeAssignmentStatus(writeStatus) as Assignment['status'],
        });
      }

      if (rowsToInsert.length === 0) {
        toast.error('No valid assignments to dispatch.');
        return;
      }

      const { data, error } = await supabase
        .from('assignments')
        .insert(rowsToInsert)
        .select();

      if (error) {
        console.error('[ASSIGNMENT ERROR]', { error, payload: rowsToInsert });
        toast.error(`Task assignment failed: ${error.message}`);
        return;
      }

      const insertedRows = (data ?? []) as Array<Record<string, unknown>>;
      if (insertedRows.length > 0) {
        insertedRows.forEach((row) => {
          appendAssignmentToCaches({
            id: String(row.id ?? ''),
            employeeId: String(row.employee_id ?? ''),
            taskId: String(row.task_id ?? ''),
            equipmentId: row.equipment_unit_id ? String(row.equipment_unit_id) : undefined,
            date: String(row.date ?? boardDate),
            startTime: String(row.start_time ?? '06:00'),
            estimatedHours: Number(row.estimated_hours ?? 0),
            duration: Math.round(Number(row.estimated_hours ?? 0) * 60),
            area: properties.find((property) => property.id === String(row.property_id ?? ''))?.name ?? 'Assigned property',
            status: normalizeAssignmentStatus(String(row.status ?? 'planned')) as Assignment['status'],
          });
        });
      } else {
        optimisticAssignments.forEach((assignment) => appendAssignmentToCaches(assignment));
      }
      const employeeName = `${employee.firstName} ${employee.lastName}`.trim() || 'crew member';
      toast.success(`${rowsToInsert.length} tasks assigned to ${employeeName}.`);
    } else {
      if (!assignmentDraft.taskId || !assignmentDraft.employeeId) return;
      if (assignmentDraft.equipmentId) {
        const selectedEquipment = availableEquipment.find((unit) => unit.id === assignmentDraft.equipmentId);
        const isReady = selectedEquipment && String(selectedEquipment.status ?? '').toLowerCase() === 'available' && selectedEquipment.active !== false;
        if (!isReady) {
          toast.error('Selected equipment is not ready for assignment.');
          return;
        }
      }
      const employeeShift = getShiftForEmployee(scheduleList, assignmentDraft.employeeId, boardDate);
      const shiftMinutes = employeeShift
        ? Math.max(timeToMinutes(employeeShift.shiftEnd) - timeToMinutes(employeeShift.shiftStart), 0)
        : 0;
      const existingEmployeeAssignments = dayAssignments.filter(
        (assignment) => assignment.employeeId === assignmentDraft.employeeId && assignment.id !== editingAssignmentId,
      );
      const assignedMinutes = existingEmployeeAssignments.reduce(
        (sum, assignment) => sum + Math.round((assignment.estimatedHours ?? 0) * 60),
        0,
      );
      const selectedTask = taskLibrary.find((task) => task.id === assignmentDraft.taskId) ?? null;
      const selectedTaskName = linkedRequestTitle ?? selectedTask?.name ?? 'Task';
      const selectedTaskId = String(selectedTask?.id ?? '').trim();
      if (!isValidUuid(selectedTaskId)) {
        toast.error('Selected task is invalid. Please reselect the task.');
        return;
      }
      const estimatedHours = Number(selectedTask?.estimated_hours ?? 0);
      const estimatedMinutes = Math.round(estimatedHours * 60);
      if (shiftMinutes > 0 && assignedMinutes + estimatedMinutes > shiftMinutes) {
        toast('Assigned tasks exceed shift hours', {
          description: `Shift: ${shiftMinutes} min · Assigned: ${assignedMinutes + estimatedMinutes} min`,
        });
      }
      const assignmentId = editingAssignmentId ?? makeId();
      const writeStatus = toAssignmentWriteStatus(assignmentDraft.status);
      const basePayload: Record<string, unknown> = {
        id: assignmentId,
        org_id: currentUser.orgId,
        employee_id: assignmentDraft.employeeId,
        property_id: resolvedPropertyId,
        task_id: selectedTaskId,
        title: selectedTaskName,
        date: boardDate,
        status: writeStatus,
        estimated_hours: estimatedHours,
        order_index: existingEmployeeAssignments.length,
        equipment_unit_id: assignmentDraft.equipmentId || null,
      };
      if (assignmentDraft.startTime) basePayload.start_time = assignmentDraft.startTime;
      if (assignmentDraft.notes.trim()) basePayload.notes = assignmentDraft.notes.trim();
      if (assignmentDraft.equipmentId) {
        basePayload.equipment_unit_id = assignmentDraft.equipmentId;
      }
      const validationError = validateAssignmentWritePayload({
        employee_id: String(basePayload.employee_id ?? ''),
        task_id: String(basePayload.task_id ?? ''),
        org_id: String(basePayload.org_id ?? ''),
        date: String(basePayload.date ?? ''),
        status: String(basePayload.status ?? ''),
      });
      if (validationError) {
        toast.error(validationError);
        return;
      }

      const { data, error } = await supabase
        .from('assignments')
        .upsert(basePayload)
        .select()
        .single();

      if (error) {
        console.error('[ASSIGNMENT ERROR]', { error, payload: basePayload });
        toast.error(`Task assignment failed: ${error.message}`);
        return;
      }

      const optimisticAssignment: Assignment = {
        id: assignmentId,
        employeeId: String(data?.employee_id ?? assignmentDraft.employeeId),
        taskId: String(data?.task_id ?? selectedTaskId),
        equipmentId: data?.equipment_unit_id ? String(data.equipment_unit_id) : assignmentDraft.equipmentId || undefined,
        date: String(data?.date ?? boardDate),
        startTime: String(data?.start_time ?? (assignmentDraft.startTime || '06:00')),
        duration: Math.round(Number(data?.estimated_hours ?? estimatedHours) * 60),
        area: String(data?.location ?? activeProperty?.name ?? 'Assigned property'),
        status: normalizeAssignmentStatus(String(data?.status ?? writeStatus)) as Assignment['status'],
      };
      appendAssignmentToCaches(optimisticAssignment);
      const selectedEmployee = employeeList.find((employee) => employee.id === optimisticAssignment.employeeId);
      const employeeName = selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}`.trim() : 'crew member';
      toast.success(`${selectedTaskName} assigned to ${employeeName}`);
    }

    if (linkedRequestId) {
      const { error: linkedRequestError } = await supabase
        .from('task_requests')
        .update({
          status: 'assigned',
          task_id: linkedRequestTaskId,
          org_id: currentUser?.orgId ?? null,
        })
        .eq('id', linkedRequestId);
      if (linkedRequestError) {
        toast.error(`Failed to update linked request: ${linkedRequestError.message}`);
      }
    }

    void queryClient.invalidateQueries({ queryKey: ['assignments'] });
    void queryClient.invalidateQueries({ queryKey: ['task-requests'] });
    setLinkedRequestId(null);
    setLinkedRequestTitle(null);
    setEditingAssignmentId(null);
    setTaskRows([makeEmptyTaskRow(getDefaultStartTimeForEmployee(scheduleList, assignmentDraft.employeeId, boardDate), effectivePropertyId && effectivePropertyId !== 'all' ? effectivePropertyId : '')]);
    setWeatherConflictOverride(false);
    setIsAssignmentModalDirty(false);
    closeAssignmentDialog(true);
  }

  async function removeAssignment(assignmentId: string) {
    if (isReadOnly) {
      toast.info('Demo mode is read-only.');
      return;
    }
    if (!supabase) return;
    const assignmentToRemove = dayAssignments.find((assignment) => assignment.id === assignmentId);
    if (!assignmentToRemove) return;
    const confirmed = window.confirm('Remove this task assignment?');
    if (!confirmed) return;

    removeAssignmentFromCache(assignmentId);

    const timeoutId = window.setTimeout(async () => {
      delete pendingDeleteTimeoutsRef.current[assignmentId];
      const { error } = await supabase.from('assignments').delete().eq('id', assignmentId).eq('org_id', currentUser.orgId);
      if (error) {
        console.error('[ASSIGNMENT ERROR]', { error, payload: { id: assignmentId } });
        upsertAssignmentInCache(assignmentToRemove);
        toast.error(`Failed to remove task: ${error.message}`);
        return;
      }
      toast.success('Task removed');
      void queryClient.invalidateQueries({ queryKey: ['assignments'] });
    }, 3000);

    pendingDeleteTimeoutsRef.current[assignmentId] = timeoutId;

    toast('Assignment removed', {
      description: 'Undo?',
      action: {
        label: 'Undo',
        onClick: () => {
          const activeTimeout = pendingDeleteTimeoutsRef.current[assignmentId];
          if (activeTimeout) {
            window.clearTimeout(activeTimeout);
            delete pendingDeleteTimeoutsRef.current[assignmentId];
          }
          upsertAssignmentInCache(assignmentToRemove);
        },
      },
    });
  }

  async function dismissRequest(requestId: string) {
    if (isReadOnly) {
      toast.info('Demo mode is read-only.');
      return;
    }
    if (!supabase) return;
    const confirmed = window.confirm('Dismiss this request?');
    if (!confirmed) return;
    const { error } = await supabase
      .from('task_requests')
      .update({ status: 'dismissed' })
      .eq('id', requestId)
      .eq('org_id', currentUser?.orgId ?? '');
    if (error) {
      toast.error(`Failed to dismiss request: ${error.message}`);
      return;
    }
    queryClient.setQueryData<NeedsQueueRequest[] | undefined>(taskRequestsQuery.queryKey, (current) =>
      (current ?? []).map((request) =>
        request.id === requestId ? { ...request, status: 'dismissed' } : request,
      ),
    );
    await queryClient.invalidateQueries({ queryKey: ['task-requests'] });
    toast.success('Request dismissed');
  }

  async function reorderEmployeeAssignments(
    sourceEmployeeId: string,
    targetEmployeeId: string,
    draggedAssignmentId: string,
    targetAssignmentId: string,
  ) {
    if (!supabase || draggedAssignmentId === targetAssignmentId) return;
    const sourceAssignments = dayAssignments.filter((assignment) => assignment.employeeId === sourceEmployeeId);
    const targetAssignments = dayAssignments.filter((assignment) => assignment.employeeId === targetEmployeeId);
    const fromIndex = sourceAssignments.findIndex((assignment) => assignment.id === draggedAssignmentId);
    const toIndex = targetAssignments.findIndex((assignment) => assignment.id === targetAssignmentId);
    if (fromIndex < 0 || toIndex < 0) return;

    const dragged = sourceAssignments[fromIndex];
    if (!dragged?.id) return;
    const nextSource = [...sourceAssignments];
    nextSource.splice(fromIndex, 1);
    const nextTarget = [...targetAssignments];
    const targetInsertIndex = sourceEmployeeId === targetEmployeeId ? toIndex : toIndex + 1;
    if (sourceEmployeeId === targetEmployeeId) {
      const [movedSame] = nextSource.splice(fromIndex, 1);
      if (!movedSame) return;
      nextSource.splice(toIndex, 0, movedSame);
    } else {
      nextTarget.splice(targetInsertIndex, 0, { ...dragged, employeeId: targetEmployeeId });
    }

    const orderUpdates =
      sourceEmployeeId === targetEmployeeId
        ? nextSource.map((assignment, index) => ({
            id: assignment.id,
            employee_id: assignment.employeeId,
            order_index: index,
          }))
        : [
            ...nextSource.map((assignment, index) => ({
              id: assignment.id,
              employee_id: sourceEmployeeId,
              order_index: index,
            })),
            ...nextTarget.map((assignment, index) => ({
              id: assignment.id,
              employee_id: targetEmployeeId,
              order_index: index,
            })),
          ];

    queryClient.setQueryData<Assignment[]>(assignmentsQuery.queryKey, (current) =>
      (current ?? []).map((assignment) => {
        const match = orderUpdates.find((update) => update.id === assignment.id);
        if (!match) return assignment;
        return { ...assignment, employeeId: match.employee_id, order: match.order_index };
      }),
    );

    const { error } = await supabase.from('assignments').upsert(orderUpdates, { onConflict: 'id' });

    if (error) {
      console.error('[ASSIGNMENT ERROR]', { error, payload: orderUpdates });
      toast.error(`Task order update failed: ${error.message}`);
      void queryClient.invalidateQueries({ queryKey: ['assignments'] });
      return;
    }

    if (sourceEmployeeId === targetEmployeeId) {
      toast.success('Task order updated');
    } else {
      toast.success('Task moved to a different crew member');
    }
    void queryClient.invalidateQueries({ queryKey: ['assignments'] });
  }

  async function moveTaskToEmployeeLane(sourceEmployeeId: string, targetEmployeeId: string, draggedAssignmentId: string) {
    if (!supabase || !draggedAssignmentId || sourceEmployeeId === targetEmployeeId) return;
    const sourceAssignments = dayAssignments.filter((assignment) => assignment.employeeId === sourceEmployeeId);
    const targetAssignments = dayAssignments.filter((assignment) => assignment.employeeId === targetEmployeeId);
    const dragged = sourceAssignments.find((assignment) => assignment.id === draggedAssignmentId);
    if (!dragged?.id) return;
    const nextSource = sourceAssignments.filter((assignment) => assignment.id !== draggedAssignmentId);
    const nextTarget = [...targetAssignments, { ...dragged, employeeId: targetEmployeeId }];

    const orderUpdates = [
      ...nextSource.map((assignment, index) => ({ id: assignment.id, employee_id: sourceEmployeeId, order_index: index })),
      ...nextTarget.map((assignment, index) => ({ id: assignment.id, employee_id: targetEmployeeId, order_index: index })),
    ];

    queryClient.setQueryData<Assignment[]>(assignmentsQuery.queryKey, (current) =>
      (current ?? []).map((assignment) => {
        const match = orderUpdates.find((update) => update.id === assignment.id);
        if (!match) return assignment;
        return { ...assignment, employeeId: match.employee_id, order: match.order_index };
      }),
    );

    const { error } = await supabase.from('assignments').upsert(orderUpdates, { onConflict: 'id' });
    if (error) {
      console.error('[ASSIGNMENT ERROR]', { error, payload: orderUpdates });
      toast.error(`Task move failed: ${error.message}`);
      void queryClient.invalidateQueries({ queryKey: ['assignments'] });
      return;
    }
    toast.success('Task moved to a different crew member');
    void queryClient.invalidateQueries({ queryKey: ['assignments'] });
  }

  async function approveRequestToAssignment(request: PendingTaskRequest) {
    if (isReadOnly) {
      toast.info('Demo mode is read-only.');
      return;
    }
    if (!supabase || !currentUser?.orgId || !request.employee_id) return;
    const resolvedPropertyId =
      (request.property_id && request.property_id !== 'all' ? request.property_id : null) ??
      (effectivePropertyId && effectivePropertyId !== 'all' ? effectivePropertyId : null);
    if (!resolvedPropertyId) {
      toast.error('Cannot approve request: missing property context.');
      return;
    }

    const orderIndex = dayAssignments.filter((a) => a.employeeId === request.employee_id).length + 1;
    const notes = [request.title, request.description].filter(Boolean).join(' — ');
    const fallbackTaskId = taskLibrary.find((task) => isValidUuid(task.id))?.id ?? '';
    if (!isValidUuid(fallbackTaskId)) {
      toast.error('Request approval requires a valid task in the task library.');
      return;
    }
    const payload = {
      id: makeId(),
      org_id: currentUser.orgId,
      employee_id: request.employee_id,
      property_id: resolvedPropertyId,
      task_id: fallbackTaskId,
      date: request.date,
      title: request.title || 'Requested task',
      status: 'planned',
      notes: notes || null,
      order_index: orderIndex,
      location: 'Requested',
      start_time: '05:30',
      estimated_hours: 0,
    };
    const validationError = validateAssignmentWritePayload({
      employee_id: payload.employee_id,
      task_id: payload.task_id,
      org_id: payload.org_id,
      date: payload.date,
      status: payload.status,
    });
    if (validationError) {
      toast.error(validationError);
      return;
    }
    const { data: assignmentRow, error: assignmentError } = await supabase.from('assignments').insert(payload).select().single();
    if (assignmentError) {
      console.error('[ASSIGNMENT ERROR]', { error: assignmentError, payload });
      toast.error(`Task assignment failed: ${assignmentError.message}`);
      return;
    }
    appendAssignmentToCaches({
      id: String(assignmentRow?.id ?? payload.id),
      employeeId: String(assignmentRow?.employee_id ?? payload.employee_id),
      taskId: String(assignmentRow?.task_id ?? payload.task_id),
      equipmentId: assignmentRow?.equipment_unit_id ? String(assignmentRow.equipment_unit_id) : undefined,
      date: String(assignmentRow?.date ?? payload.date),
      startTime: String(assignmentRow?.start_time ?? payload.start_time),
      estimatedHours: Number(assignmentRow?.estimated_hours ?? 0),
      duration: Math.round(Number(assignmentRow?.estimated_hours ?? 0) * 60),
      area: String(assignmentRow?.location ?? payload.location ?? 'Requested'),
      status: normalizeAssignmentStatus(String(assignmentRow?.status ?? payload.status)) as Assignment['status'],
    });

    const { error: requestError } = await supabase
      .from('task_requests')
      .update({ status: 'approved' })
      .eq('id', request.id)
      .eq('org_id', currentUser.orgId);
    if (requestError) {
      toast.error(`Assignment created but request update failed: ${requestError.message}`);
      return;
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['assignments'] }),
      queryClient.invalidateQueries({ queryKey: ['task-requests'] }),
      queryClient.invalidateQueries({ queryKey: ['task-requests-pending'] }),
    ]);
    toast.success('Request approved and assigned');
  }

  async function saveNote() {
    if (isReadOnly) {
      toast.info('Demo mode is read-only.');
      return;
    }
    if (savingNote) return;
    if (!supabase || !orgId || !noteDraft.content.trim()) {
      toast.error('Enter a note before saving.');
      return;
    }

    let scopePayload: { property_id: string | null; employee_id: string | null; assignment_id: string | null };
    if (noteScope === 'org') {
      scopePayload = {
        property_id: null,
        employee_id: null,
        assignment_id: null,
      };
    } else if (noteScope === 'property') {
      if (!selectedPropertyNoteId) {
        toast.error('Choose a property before saving this note.');
        return;
      }
      scopePayload = {
        property_id: selectedPropertyNoteId,
        employee_id: null,
        assignment_id: null,
      };
    } else if (noteScope === 'employee') {
      if (!selectedEmployeeNotePropertyId || !selectedNoteEmployeeId) {
        toast.error('Choose a scheduled employee before saving this note.');
        return;
      }
      scopePayload = {
        property_id: selectedEmployeeNotePropertyId,
        employee_id: selectedNoteEmployeeId,
        assignment_id: null,
      };
    } else {
      if (!selectedAssignmentNotePropertyId || !selectedNoteAssignmentId) {
        toast.error('Choose a task before saving this note.');
        return;
      }
      scopePayload = {
        property_id: selectedAssignmentNotePropertyId,
        employee_id: null,
        assignment_id: selectedNoteAssignmentId,
      };
    }

    setSavingNote(true);
    const noteLabel = noteDraft.type === 'alert' ? 'Alert' : `${noteDraft.type.charAt(0).toUpperCase()}${noteDraft.type.slice(1)}`;
    const noteTitle = noteDraft.title.trim() || `${noteLabel} note - ${boardDate}`;
    try {
      const { error } = await supabase.from('notes').insert({
        type: noteDraft.type,
        title: noteTitle,
        content: noteDraft.content.trim(),
        property_id: scopePayload.property_id,
        employee_id: scopePayload.employee_id,
        assignment_id: scopePayload.assignment_id,
        org_id: orgId,
        created_by: currentUser?.employeeId ?? null,
        location: noteDraft.location.trim() || null,
      });
      if (error) {
        toast.error(`Failed to save note: ${error.message}`);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['notes'] });
      setNoteDraft({ type: 'daily', title: '', content: '', author: 'Operations Admin', location: '' });
      toast.success('Note saved');
    } finally {
      setSavingNote(false);
    }
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

  const isLoadingBoard =
    assignmentsQuery.isLoading ||
    scheduleQuery.isLoading ||
    showTaskLoading ||
    propertiesLoading ||
    employeesLoading ||
    equipmentQuery.isLoading ||
    notesQuery.isLoading;
  const boardErrorMessage =
    (assignmentsQuery.error as { message?: string } | null)?.message ||
    (scheduleQuery.error as { message?: string } | null)?.message ||
    taskLibraryError ||
    (equipmentQuery.error as { message?: string } | null)?.message ||
    (notesQuery.error as { message?: string } | null)?.message ||
    (taskRequestsQuery.error as { message?: string } | null)?.message ||
    '';

  return (
    <>
      {isLoadingBoard ? (
        <div className="p-6">
          <CardSkeleton />
        </div>
      ) : boardErrorMessage ? (
        <div className="p-6">
          <ErrorRetry
            message={boardErrorMessage}
            onRetry={() => {
              void assignmentsQuery.refetch();
              void scheduleQuery.refetch();
              void refetchTasks();
              void equipmentQuery.refetch();
              void notesQuery.refetch();
              void taskRequestsQuery.refetch();
              void pendingTaskRequestsQuery.refetch();
              void weatherLogsQuery.refetch();
              void weatherLocationsQuery.refetch();
              void workLocationsQuery.refetch();
            }}
          />
        </div>
      ) : (
    <div className="relative flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {showFirstVisitHint ? (
        <div className="absolute left-3 right-3 top-3 z-20 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 md:left-5 md:right-5">
          <div className="flex items-start justify-between gap-2">
            <p>This is your daily operations board. Assign tasks to scheduled crew and track progress in real-time.</p>
            <button
              type="button"
              aria-label="Dismiss workflow help"
              className="rounded-full p-2 text-xs font-medium text-blue-700 hover:text-blue-900"
              onClick={() => {
                window.localStorage.setItem('ground-crew-first-visit-workboard-dismissed', 'true');
                setShowFirstVisitHint(false);
              }}
            >
              ×
            </button>
          </div>
        </div>
      ) : null}

      {/* ─── MAIN DISPATCH BOARD ─── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-3 pt-3 md:px-5">
          <PageHeader
            title="Workflow"
            subtitle="Assign tasks and manage daily operations."
            badge={showFreshUpdateBadge ? (
              <Badge variant="secondary" className="gap-1">
                <Radio className="h-3 w-3 animate-pulse" /> Live
              </Badge>
            ) : undefined}
          />
        </div>

        {/* Header bar */}
        <div className="border-b border-surface-border bg-surface-card px-3 py-3 md:px-5">
          <div className="flex items-center gap-3 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible">
            <div className="flex min-w-max items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-surface-border bg-surface-elevated px-3 py-1.5">
            <span className="text-[10px] uppercase tracking-wider text-text-muted">Board Date</span>
            <div className="relative flex items-center">
              <input
                ref={boardDateInputRef}
                type="date"
                value={boardDate}
                onChange={(e) => setBoardDate(e.target.value)}
                className="h-8 rounded-md border border-surface-border bg-surface-base px-2 pr-7 text-sm text-text-primary"
                data-testid="input-board-date"
              />
              <button
                type="button"
                onClick={() => {
                  const input = boardDateInputRef.current;
                  if (input && typeof input.showPicker === 'function') {
                    input.showPicker();
                  } else {
                    input?.focus();
                  }
                }}
                className="absolute right-2 flex items-center justify-center text-text-muted hover:text-text-primary"
                aria-label="Open date picker"
              >
                <Calendar className="h-3.5 w-3.5" />
              </button>
            </div>
            {boardDate !== todayDateKey ? (
              <Button variant="ghost" size="sm" className="h-8 text-xs px-2" onClick={() => setBoardDate(todayDateKey)}>
                Today
              </Button>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {activeProperty && (
              <Badge variant="outline" style={{ borderColor: activeProperty.color, color: activeProperty.color }}>
                {activeProperty.shortName}
              </Badge>
            )}
          </div>

          {/* Department */}
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            data-testid="select-department"
          >
            {departmentOptions.map((d) => (
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
            {!isReadOnly ? (
              <Button
                size="sm"
                className="h-9 shrink-0"
                onClick={() => openAssignmentDialog('')}
                data-testid="button-open-add-task"
              >
                Add Task
              </Button>
            ) : null}
            {!isReadOnly ? (
              <Button
                size="sm"
                variant="outline"
                className="h-9 shrink-0 gap-1.5"
                onClick={openNoteDialog}
                data-testid="button-open-notes"
              >
                <StickyNote className="h-3.5 w-3.5" />
                Notes
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{noteList.length}</Badge>
              </Button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-9 shrink-0 rounded-lg">
                  More <ChevronDown className="ml-1 h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {!isReadOnly ? (
                  <DropdownMenuItem onClick={() => void openQuickPlanDialog()} data-testid="button-open-quick-plan">
                    Quick Plan
                  </DropdownMenuItem>
                ) : null}
                {!isReadOnly ? (
                  <DropdownMenuItem
                    onClick={() => void applyRecurringTasks()}
                    disabled={recurringRulesQuery.isFetching}
                  >
                    {recurringRulesQuery.isFetching ? 'Loading Recurring Tasks...' : 'Apply Recurring Tasks'}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onClick={handlePrintDailyPlan} data-testid="button-export-workboard-plan">
                  Export / Print
                </DropdownMenuItem>
                {!isReadOnly ? (
                  <DropdownMenuItem
                    onClick={() => {
                      setSelectedScheduleRecipientIds(scheduledEmployees.map((employee) => employee.id));
                      setSendScheduleDialogOpen(true);
                    }}
                  >
                    Send Schedule
                  </DropdownMenuItem>
                ) : null}
                {!isReadOnly ? (
                  <DropdownMenuItem onClick={openTaskTemplateDialog} data-testid="button-open-task-template">
                    Apply Task Template
                  </DropdownMenuItem>
                ) : null}
                {showEndOfDayReportButton ? (
                  <DropdownMenuItem onClick={openEndOfDayReportDialog}>
                    End of Day Report
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>

            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label="Quick plan help" className="h-9 w-9 rounded-md border border-surface-border text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary">
                  <HelpCircle className="mx-auto h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Auto-suggests today&apos;s tasks based on what you did last week.</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="h-11 w-11 shrink-0 rounded-lg md:h-9 md:w-9" aria-label="Breakroom display info">
                  <MonitorSmartphone className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent align="end" className="max-w-xs text-xs leading-relaxed">
                Build the day here, then open Breakroom on a cast TV to display the live crew order and task sequence.
              </TooltipContent>
            </Tooltip>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="hidden shrink-0 border-b border-surface-border bg-surface-elevated px-5 py-2 text-xs md:flex md:flex-wrap md:items-center md:gap-4">
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
            <div className="ml-auto flex items-center gap-1.5 text-status-pending">
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

          <div className="mb-4 rounded-xl border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Standard Operating Procedures</h3>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[11px]"
                onClick={() => setSopCollapsed((current) => !current)}
              >
                {sopCollapsed ? (
                  <>
                    <ChevronDown className="mr-1 h-3.5 w-3.5" /> Show
                  </>
                ) : (
                  <>
                    <ChevronUp className="mr-1 h-3.5 w-3.5" /> Hide
                  </>
                )}
              </Button>
            </div>
            {sopCollapsed ? (
              <p className="text-xs text-muted-foreground">Collapsed. Click Show to view SOP checklists.</p>
            ) : (
              <div className="space-y-2">
                {SOP_ITEMS.map((sop) => {
                  const isExpanded = expandedSopIds.includes(sop.id);
                  return (
                    <div key={sop.id} className="rounded-xl border p-3">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-2 text-left"
                        onClick={() => toggleSopCard(sop.id)}
                      >
                        <span className="flex items-center gap-2 text-sm font-medium">
                          {sop.icon}
                          {sop.title}
                        </span>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </button>
                      {isExpanded ? (
                        <ul className="mt-2 space-y-1">
                          {sop.checklist.map((item) => (
                            <li key={`${sop.id}-${item}`} className="flex items-start gap-2 text-xs text-muted-foreground">
                              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-emerald-600" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {pendingTaskRequests.length > 0 && (
            <div className="mb-4 rounded-3xl border bg-card/80 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Requests</h3>
                  <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                    {pendingTaskRequests.length}
                  </Badge>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Today</span>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {pendingTaskRequests.map((request) => {
                  const requestEmployee = employeeList.find((e) => e.id === request.employee_id);
                  return (
                    <div key={request.id} className={`rounded-2xl border p-3 ${PRIORITY_COLOR[request.priority] ?? 'bg-muted/20 border-border'}`}>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{request.title}</span>
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px] capitalize">
                          {request.priority}
                        </Badge>
                      </div>
                      {request.description ? <p className="mb-2 text-xs text-muted-foreground">{request.description}</p> : null}
                      <div className="mb-2 text-[11px] text-muted-foreground">
                        {requestEmployee ? `${requestEmployee.firstName} ${requestEmployee.lastName}` : 'Unassigned crew'} · {request.date}
                      </div>
                      <Button
                        size="sm"
                        className="h-7 text-[11px]"
                        onClick={() => void approveRequestToAssignment(request)}
                        data-testid={`button-approve-request-${request.id}`}
                      >
                        Approve → Assign
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="mb-4 rounded-3xl border bg-card/80 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">
                  {workOrders.length > 0 ? 'Work Orders' : 'Work Orders (Schedule fallback)'}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{boardDate}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => setWorkOrdersExpanded((current) => !current)}
                >
                  {workOrdersExpanded ? 'Hide' : 'Show'}
                </Button>
              </div>
            </div>
            {!workOrdersExpanded ? (
              <p className="text-xs text-muted-foreground">Collapsed. Click Show to view work orders.</p>
            ) : workOrdersQuery.isLoading ? (
              <p className="text-xs text-muted-foreground">Loading work orders...</p>
            ) : workOrderBoardItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">No work orders or schedule entries found for this date.</p>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {workOrderBoardItems.map((item) => (
                  <div key={item.id} className={`min-w-[420px] rounded-xl border px-3 py-2 ${PRIORITY_COLOR[item.priority] ?? 'bg-muted/20 border-border'}`}>
                    <p className="truncate text-sm">
                      <span className="font-medium">{item.employeeName || 'Crew'}</span>
                      <span className="text-muted-foreground"> · </span>
                      <span>{item.title}</span>
                      <span className="text-muted-foreground"> · </span>
                      <span className="capitalize">{item.status || 'planned'}</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {orderedDispatchBoard.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No crew scheduled today"
              description="Add shifts in the Scheduler to see your crew here."
              actionLabel="Open Scheduler"
              onAction={() => navigate('/app/scheduler')}
            />
          ) : isMobile ? (
            <div className="space-y-3 px-4 pb-24">
              <div className="flex items-center justify-between py-3">
                <h2 className="text-lg font-bold">Today's Crew</h2>
                <span className="text-sm text-muted-foreground">{boardDate}</span>
              </div>
              {scheduledEmployees.length === 0 ? (
                <p className="text-sm text-muted-foreground">No crew scheduled for {boardDate}.</p>
              ) : (
                scheduledEmployees.map((employee) => {
                  const empAssignments = dayAssignments.filter((a) => a.employeeId === employee.id);
                  return (
                    <div key={employee.id} className="space-y-3 rounded-xl border bg-card p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                            {employee.firstName?.[0]}{employee.lastName?.[0]}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{employee.firstName} {employee.lastName}</p>
                            <p className="text-xs text-muted-foreground">{employee.department}</p>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {empAssignments.length} task{empAssignments.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {empAssignments.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No tasks assigned</p>
                      ) : (
                        <div className="space-y-2">
                          {empAssignments.map((a) => {
                            const ns = normalizeAssignmentStatus(a.status);
                            return (
                              <div key={a.id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                                <span className="text-sm">{a.title}</span>
                                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                  ns === 'done'
                                    ? 'bg-green-500/10 text-green-400'
                                    : ns === 'in-progress'
                                      ? 'bg-blue-500/10 text-blue-400'
                                      : 'bg-muted text-muted-foreground'
                                }`}>
                                  {ns}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : viewMode === 'timeline' ? (
            <SafeSection fallback={<div className="h-64 rounded-xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">Timeline view is temporarily unavailable.</div>}>
              <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
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
              </Suspense>
            </SafeSection>
          ) : (
            <>
            <div className="hidden space-y-2 md:block">
              <div className="rounded-xl border bg-card/70 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <div className="grid grid-cols-[minmax(0,1fr)_90px_60px_90px_80px_24px] items-center gap-3">
                  <span>Employee</span>
                  <span className="text-right">Shift</span>
                  <span className="text-right">Tasks</span>
                  <span className="text-right">Coverage</span>
                  <span className="text-right">Duration</span>
                  <span />
                </div>
              </div>
              {orderedDispatchBoard.map((lane, index) => {
                const laneFlashTone = lane.employeeAssignments.reduce<'complete' | 'started' | null>((tone, assignment) => {
                  const assignmentId = assignment.id ?? '';
                  const nextTone = assignmentFlashMap[assignmentId];
                  return nextTone ?? tone;
                }, null);
                const initials = `${lane.employee.firstName?.[0] ?? ''}${lane.employee.lastName?.[0] ?? ''}`.toUpperCase();
                const isExpanded = expandedDesktopCrewId === lane.employee.id;
                const coverageRounded = Math.round(lane.coveragePercent);
                const coverageToneClass =
                  coverageRounded > 80
                    ? 'bg-emerald-100 text-emerald-800'
                    : coverageRounded >= 50
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-red-100 text-red-800';
                const laneAccentClass =
                  coverageRounded > 80
                    ? 'border-l-2 border-l-green-500/60'
                    : coverageRounded >= 50
                      ? 'border-l-2 border-l-amber-500/60'
                      : 'border-l-2 border-l-red-500/60';
                return (
                  <div
                    key={lane.employee.id}
                    className={`rounded-xl border bg-card transition-all duration-500 ${laneAccentClass} ${
                      laneFlashTone === 'complete'
                        ? 'ring-2 ring-green-400/70 bg-green-50/40'
                        : laneFlashTone === 'started'
                          ? 'ring-2 ring-blue-400/70 bg-blue-50/40'
                          : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleDesktopCrew(lane.employee.id)}
                      className="flex h-[52px] min-h-[52px] max-h-[52px] w-full items-center gap-3 border-b bg-muted/40 px-3 text-left hover:bg-muted/60"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {initials}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {lane.employee.firstName} {lane.employee.lastName}
                      </span>
                      <span className="w-[90px] text-right font-mono text-xs text-muted-foreground">
                        {lane.shift ? `${formatTime(lane.shift.shiftStart)}-${formatTime(lane.shift.shiftEnd)}` : 'No shift'}
                      </span>
                      <span className="w-[60px] text-right">
                        <span className="inline-flex rounded-full bg-brand-bright/10 px-2 py-0.5 text-[11px] font-medium text-brand-bright">
                          {lane.employeeAssignments.length}
                        </span>
                      </span>
                      <span className="w-[90px] text-right">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${coverageToneClass}`}>
                          {coverageRounded}%
                        </span>
                      </span>
                      <span className="w-[80px] text-right text-xs text-muted-foreground">
                        {lane.assignedMinutes}min
                      </span>
                      <span className="w-6 text-muted-foreground">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </span>
                    </button>
                    {isExpanded ? (
                <SafeSection fallback={<div className="rounded-xl border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">This crew lane could not be rendered.</div>}>
                  <Suspense
                    fallback={
                      <div className="space-y-2 p-2">
                        <div className="h-[52px] animate-pulse rounded-lg bg-muted/40" />
                        <div className="h-[52px] animate-pulse rounded-lg bg-muted/40" />
                        <div className="h-[52px] animate-pulse rounded-lg bg-muted/40" />
                      </div>
                    }
                  >
                    <EmployeeRow
                      employee={lane.employee}
                      assignments={lane.employeeAssignments}
                      tasks={taskList}
                      properties={properties}
                      orderIndex={index}
                      isDragging={draggingEmployeeId === lane.employee.id}
                      isDropTarget={dropTargetEmployeeId === lane.employee.id}
                      shiftLabel={lane.shift ? `${formatTime(lane.shift.shiftStart)}–${formatTime(lane.shift.shiftEnd)}` : undefined}
                      shiftEndTime={lane.shift?.shiftEnd ?? null}
                      laneSummary={
                        lane.shift
                          ? `Est: ${lane.estimatedHours.toFixed(1)}h · Actual: ${lane.actualHours.toFixed(1)}h`
                          : `${lane.employeeAssignments.length} tasks assigned`
                      }
                      laneWarning={
                        lane.shiftMinutes > 0 && lane.assignedMinutes > lane.shiftMinutes
                          ? `Assigned hours exceed scheduled shift by ${Math.ceil((lane.assignedMinutes - lane.shiftMinutes) / 60)}h ${(lane.assignedMinutes - lane.shiftMinutes) % 60}m`
                          : undefined
                      }
                      coveragePercent={lane.coveragePercent}
                      onDragStart={setDraggingEmployeeId}
                      onDragEnter={setDropTargetEmployeeId}
                      onDragEnd={() => { setDraggingEmployeeId(null); setDropTargetEmployeeId(null); }}
                      onDropRow={(targetEmployeeId) => {
                        if (draggingTask) {
                          void moveTaskToEmployeeLane(draggingTask.employeeId, targetEmployeeId, draggingTask.assignmentId);
                          setDraggingTask(null);
                          return;
                        }
                        moveEmployeeLane(targetEmployeeId);
                      }}
                      onTaskDragStart={(employeeId, assignmentId) => setDraggingTask({ employeeId, assignmentId })}
                      onTaskDropOnTask={(employeeId, targetAssignmentId) => {
                        if (!draggingTask) return;
                        void reorderEmployeeAssignments(draggingTask.employeeId, employeeId, draggingTask.assignmentId, targetAssignmentId);
                        setDraggingTask(null);
                      }}
                      onAddTask={openAssignmentDialog}
                      onEditAssignment={openEditAssignmentDialog}
                      onRemoveAssignment={removeAssignment}
                      weatherWarningsByAssignment={assignmentWeatherWarnings}
                      assignmentTimelineById={assignmentTimelineRecord}
                      breakEvents={breakChipsByEmployee[lane.employee.id] ?? []}
                      operationalTimezone={operationalTimezone}
                      onStartAssignment={(assignment) => {
                        void startAssignmentTimeline(assignment);
                      }}
                      onCompleteAssignment={(assignment, employeeAssignments) => {
                        void completeAssignmentTimeline(assignment, employeeAssignments);
                      }}
                      onSaveAssignmentTimes={(assignment, employeeAssignments, startInput, endInput) => {
                        void saveAssignmentTimelineTimes(assignment, employeeAssignments, startInput, endInput);
                      }}
                      onLogBreak={logEmployeeBreak}
                      savingTimelineAssignmentId={savingTimelineAssignmentId}
                      savingBreakEmployeeId={savingBreakEmployeeId}
                    />
                  </Suspense>
                </SafeSection>
                    ) : null}
                  </div>
                );
              })}

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
            <div className="space-y-3 md:hidden">
              {orderedDispatchBoard.map((lane) => {
                const isExpanded = expandedMobileCrewIds.includes(lane.employee.id);
                const laneOrderedAssignments = orderEmployeeAssignments(lane.employeeAssignments);
                return (
                  <div key={`mobile-lane-${lane.employee.id}`} className="rounded-2xl border bg-card">
                    <button
                      type="button"
                      onClick={() => toggleMobileCrew(lane.employee.id)}
                      className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-3 text-left"
                    >
                      <div>
                        <p className="text-sm font-semibold">
                          {lane.employee.firstName} {lane.employee.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {lane.shift ? `${formatTime(lane.shift.shiftStart)}–${formatTime(lane.shift.shiftEnd)}` : 'No shift'} · Coverage {Math.round(lane.coveragePercent)}%
                        </p>
                      </div>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </button>
                    {isExpanded ? (
                      <div className="border-t px-3 py-3">
                        {lane.employeeAssignments.length === 0 ? (
                          <div className="rounded-xl border border-dashed p-4 text-center">
                            <p className="text-sm text-muted-foreground">No tasks assigned</p>
                            {!isReadOnly ? (
                              <Button size="sm" className="mt-3 min-h-11 w-full" onClick={() => openAssignmentDialog(lane.employee.id)}>
                                + Assign Task
                              </Button>
                            ) : null}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {laneOrderedAssignments.map((assignment) => {
                              const task = taskList.find((candidate) => candidate.id === assignment.taskId);
                              const estimatedHours = getEstimatedHoursForAssignment(assignment);
                              const { canonicalStartAt, canonicalCompletedAt } = getCanonicalActualTimes(assignment);
                              const canonicalStartHHMM = canonicalStartAt
                                ? storedIsoToWallClock(canonicalStartAt, operationalTimezone)
                                : '';
                              const canonicalCompletedHHMM = canonicalCompletedAt
                                ? storedIsoToWallClock(canonicalCompletedAt, operationalTimezone)
                                : '';
                              const timelineActualHours =
                                canonicalStartHHMM && canonicalCompletedHHMM
                                  ? Math.max(0, (timeToMinutes(canonicalCompletedHHMM) - timeToMinutes(canonicalStartHHMM)) / 60)
                                  : 0;
                              const actualHours = Math.max(0, Number(assignment.actualHours ?? timelineActualHours ?? 0));
                              const actualHoursTone = getActualHoursTone(actualHours, estimatedHours);
                              const statusNormalized = normalizeAssignmentStatus(assignment.status);
                              const canStartTask = statusNormalized === 'planned';
                              const timeSummary =
                                canonicalStartAt && canonicalCompletedAt
                                  ? `${toLocalTimeLabel(canonicalStartAt, operationalTimezone)} → ${toLocalTimeLabel(canonicalCompletedAt, operationalTimezone)} (${actualHours.toFixed(1)}h)`
                                  : canonicalStartAt
                                    ? `Started: ${toLocalTimeLabel(canonicalStartAt, operationalTimezone)}`
                                    : canonicalCompletedAt
                                      ? `Completed: ${toLocalTimeLabel(canonicalCompletedAt, operationalTimezone)}`
                                      : '';
                              return (
                                <div key={`mobile-assignment-${assignment.id}`} className="relative overflow-visible rounded-xl border bg-muted/20 p-2.5">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <p className="text-sm font-medium">{assignment.title || task?.name || 'Untitled task'}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {formatMinutesAsHoursAndMinutes(assignment.duration)} · {assignment.status}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      {canStartTask ? (
                                        <button
                                          type="button"
                                          aria-label="Start task"
                                          onClick={() => void startAssignmentTimeline(assignment)}
                                          disabled={savingTimelineAssignmentId === assignment.id}
                                          className="min-h-11 rounded-md border px-2 text-xs font-medium"
                                        >
                                          Start
                                        </button>
                                      ) : null}
                                      {statusNormalized === 'in-progress' ? (
                                        <button
                                          type="button"
                                          aria-label="Complete task"
                                          onClick={() => void completeAssignmentTimeline(assignment, laneOrderedAssignments)}
                                          disabled={savingTimelineAssignmentId === assignment.id}
                                          className="min-h-11 rounded-md border px-2 text-xs font-medium"
                                        >
                                          Complete
                                        </button>
                                      ) : null}
                                      <button
                                        type="button"
                                        aria-label="Set actual hours"
                                        onClick={() =>
                                          setActualHoursMenuAssignmentId((current) =>
                                            current === assignment.id ? null : assignment.id,
                                          )
                                        }
                                        className="min-h-11 min-w-11 rounded-md border px-2 text-xs font-medium"
                                      >
                                        <Clock className="h-4 w-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => openEditAssignmentDialog(assignment)}
                                        className="min-h-11 min-w-11 rounded-md border px-2 text-xs font-medium"
                                      >
                                        Edit
                                      </button>
                                    </div>
                                  </div>
                                  {timeSummary ? <p className={`mt-1 text-xs ${actualHoursTone}`}>{timeSummary}</p> : null}
                                  <button
                                    type="button"
                                    className="mt-1 inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
                                    onClick={() => {
                                      if (timelineEditAssignmentId === assignment.id) {
                                        setTimelineEditAssignmentId(null);
                                        return;
                                      }
                                      setTimelineEditAssignmentId(assignment.id ?? null);
                                      const startInputValue =
                                        toTimeInputValue(canonicalStartAt, operationalTimezone) ||
                                        toTimeInputValue(String(assignment.startTime ?? ''), operationalTimezone);
                                      const endInputValue = toTimeInputValue(canonicalCompletedAt, operationalTimezone);
                                      setTimelineEditStart(startInputValue);
                                      setTimelineEditEnd(endInputValue);
                                    }}
                                  >
                                    <Pencil className="h-3 w-3" /> Edit times
                                  </button>
                                  {timelineEditAssignmentId === assignment.id ? (
                                    <div className="relative z-20 mt-2 flex flex-wrap items-end gap-2 rounded-md border bg-background/70 p-2 pointer-events-auto">
                                      <label className="text-[10px] text-muted-foreground">
                                        Start
                                        <TimeSelect
                                          value={timelineEditStart}
                                          onChange={setTimelineEditStart}
                                          className="ml-1 w-36"
                                        />
                                      </label>
                                      <label className="text-[10px] text-muted-foreground">
                                        Complete
                                        <TimeSelect
                                          value={timelineEditEnd}
                                          onChange={setTimelineEditEnd}
                                          className="ml-1 w-36"
                                        />
                                      </label>
                                      <button
                                        type="button"
                                        className="h-10 rounded-lg bg-primary px-4 text-sm text-text-inverse hover:bg-primary/90"
                                        onClick={async () => {
                                          const saved = await saveAssignmentTimelineTimes(
                                            assignment,
                                            laneOrderedAssignments,
                                            timelineEditStart,
                                            timelineEditEnd,
                                          );
                                          if (saved) {
                                            setTimelineEditAssignmentId(null);
                                          }
                                        }}
                                        disabled={savingTimelineAssignmentId === assignment.id}
                                      >
                                        {savingTimelineAssignmentId === assignment.id ? 'Saving...' : 'Save'}
                                      </button>
                                    </div>
                                  ) : null}
                                  <div
                                    className="mt-2 cursor-pointer rounded-md p-1 hover:bg-muted/40"
                                    onClick={() =>
                                      setActualHoursMenuAssignmentId((current) =>
                                        current === assignment.id ? null : assignment.id,
                                      )
                                    }
                                  >
                                    {actualHours <= 0 ? (
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="text-xs text-muted-foreground">Log actual time:</span>
                                        {[0.5, 1, 1.5, 2, 3, 4].map((value) => (
                                          <button
                                            key={`actual-hours-${assignment.id}-${value}`}
                                            type="button"
                                            className="h-8 min-w-[40px] rounded-full border px-3 text-sm font-medium hover:bg-primary hover:text-text-inverse active:scale-95"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              void setAssignmentActualHours(assignment, value);
                                              setActualHoursMenuAssignmentId(null);
                                              setActualHoursCustomInputByAssignment((current) => {
                                                const next = { ...current };
                                                delete next[assignment.id];
                                                return next;
                                              });
                                            }}
                                          >
                                            {value}
                                          </button>
                                        ))}
                                        <button
                                          type="button"
                                          className="h-8 min-w-[40px] rounded-full border px-3 text-sm font-medium hover:bg-primary hover:text-text-inverse active:scale-95"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            setActualHoursMenuAssignmentId((current) =>
                                              current === assignment.id ? null : assignment.id,
                                            );
                                          }}
                                        >
                                          Other
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <p className={`text-xs ${actualHoursTone}`}>
                                          Est: {estimatedHours.toFixed(1)}h | Actual: {actualHours.toFixed(1)}h
                                        </p>
                                        <button
                                          type="button"
                                          className="text-xs text-primary underline-offset-2 hover:underline"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            setActualHoursMenuAssignmentId((current) =>
                                              current === assignment.id ? null : assignment.id,
                                            );
                                          }}
                                        >
                                          Edit
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  {actualHoursMenuAssignmentId === assignment.id ? (
                                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                      {[0.5, 1, 1.5, 2, 3, 4].map((value) => (
                                        <button
                                          key={`actual-hours-${assignment.id}-${value}`}
                                          type="button"
                                          className="h-8 min-w-[40px] rounded-full border px-3 text-sm font-medium hover:bg-primary hover:text-text-inverse active:scale-95"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            void setAssignmentActualHours(assignment, value);
                                            setActualHoursMenuAssignmentId(null);
                                            setActualHoursCustomInputByAssignment((current) => {
                                              const next = { ...current };
                                              delete next[assignment.id];
                                              return next;
                                            });
                                          }}
                                        >
                                          {value}
                                        </button>
                                      ))}
                                      <input
                                        type="number"
                                        min={0}
                                        step={0.25}
                                        value={actualHoursCustomInputByAssignment[assignment.id] ?? ''}
                                        onClick={(event) => event.stopPropagation()}
                                        onChange={(event) =>
                                          setActualHoursCustomInputByAssignment((current) => ({
                                            ...current,
                                            [assignment.id]: event.target.value,
                                          }))
                                        }
                                        placeholder="Other"
                                        className="h-8 w-24 rounded-md border border-input bg-background px-2 text-sm"
                                      />
                                      <button
                                        type="button"
                                        className="h-8 min-w-[40px] rounded-full border px-3 text-sm font-medium hover:bg-primary hover:text-text-inverse active:scale-95"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          const value = actualHoursCustomInputByAssignment[assignment.id] ?? '';
                                          const parsed = Number(value);
                                          if (!Number.isFinite(parsed) || parsed < 0) {
                                            toast.error('Enter a valid number of hours.');
                                            return;
                                          }
                                          void setAssignmentActualHours(assignment, parsed);
                                          setActualHoursMenuAssignmentId(null);
                                          setActualHoursCustomInputByAssignment((current) => {
                                            const next = { ...current };
                                            delete next[assignment.id];
                                            return next;
                                          });
                                        }}
                                      >
                                        Save
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {!isReadOnly ? (
                          <Button
                            size="sm"
                            className="mt-3 min-h-11 w-full"
                            onClick={() => openAssignmentDialog(lane.employee.id)}
                          >
                            + Add Task
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            </>
          )}
        </div>
      </div>

      {/* ─── RIGHT RAIL ─── */}
      <div className="border-t bg-card md:hidden">
        <div className="space-y-2 p-3">
          <div className="rounded-2xl border">
            <button
              type="button"
              className="flex min-h-11 w-full items-center justify-between px-3 py-2"
              onClick={() => toggleMobileSection('scheduledCrew')}
            >
              <span className="text-sm font-semibold">Scheduled Crew ({scheduledEmployees.length})</span>
              {mobileSectionsOpen.scheduledCrew ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {mobileSectionsOpen.scheduledCrew ? (
              <div className="space-y-2 border-t px-3 py-2">
                {orderedDispatchBoard.map((lane) => (
                  <div key={`mobile-summary-${lane.employee.id}`} className="rounded-xl bg-muted/30 px-3 py-2 text-xs">
                    <p className="font-medium">{lane.employee.firstName} {lane.employee.lastName}</p>
                    <p className="text-muted-foreground">
                      {lane.employeeAssignments.length} tasks · Est: {lane.estimatedHours.toFixed(1)}h · Actual: {lane.actualHours.toFixed(1)}h
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full justify-between"
            onClick={openNoteDialog}
          >
            <span className="inline-flex items-center gap-2">
              <StickyNote className="h-4 w-4" />
              Notes
            </span>
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{noteList.length}</Badge>
          </Button>

        </div>
      </div>

      {/* ─── ASSIGNMENT DIALOG ─── */}
      <Dialog
        open={quickPlanDialogOpen}
        onOpenChange={(nextOpen) => {
          setQuickPlanDialogOpen(nextOpen);
          if (!nextOpen) {
            setQuickPlanLoading(false);
            setQuickPlanError(null);
            setQuickPlanEmptyMessage(null);
            setQuickPlanSuggestions([]);
            setSelectedQuickPlanIds([]);
          }
        }}
      >
        <DialogContent role="dialog" aria-modal="true" className="max-w-2xl">
          <DialogDescription className="sr-only">
            Review suggested tasks from the previous operating day and choose which assignments to apply to today&apos;s plan.
          </DialogDescription>
          <DialogHeader>
            <DialogTitle>Last {quickPlanDayLabel}&apos;s Plan — Apply to today?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {quickPlanLoading ? (
              <div className="space-y-2">
                <div className="h-10 animate-pulse rounded-md bg-muted/40" />
                <div className="h-10 animate-pulse rounded-md bg-muted/40" />
                <div className="h-10 animate-pulse rounded-md bg-muted/40" />
              </div>
            ) : quickPlanError ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                Failed to load quick plan: {quickPlanError}
              </div>
            ) : quickPlanEmptyMessage ? (
              <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                {quickPlanEmptyMessage}
              </div>
            ) : (
              <div className="max-h-80 space-y-3 overflow-y-auto rounded-md border p-3">
                {Array.from(quickPlanSuggestionsByEmployee.entries()).map(([employeeId, items]) => {
                  const employee = employeeList.find((row) => row.id === employeeId);
                  const employeeName = employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown Employee';
                  return (
                    <div key={`quick-plan-employee-${employeeId}`}>
                      <p className="mb-1 text-sm font-semibold">{employeeName}</p>
                      <div className="space-y-1">
                        {items.map((item) => (
                          <label key={item.sourceId} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted/40">
                            <input
                              type="checkbox"
                              checked={selectedQuickPlanIds.includes(item.sourceId)}
                              onChange={() => toggleQuickPlanSuggestion(item.sourceId)}
                            />
                            <span className="flex-1">
                              {item.title} ({Number(item.estimatedHours || 0)}h)
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setQuickPlanDialogOpen(false)} disabled={quickPlanApplying}>
              Cancel
            </Button>
            <Button
              onClick={() => void applyQuickPlan()}
              disabled={
                quickPlanApplying ||
                quickPlanLoading ||
                Boolean(quickPlanError) ||
                Boolean(quickPlanEmptyMessage) ||
                selectedQuickPlanIds.length === 0
              }
            >
              {quickPlanApplying ? 'Applying...' : 'Apply'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={assignmentDialogOpen}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            setAssignmentDialogOpen(true);
            return;
          }
          closeAssignmentDialog();
        }}
      >
        <DialogContent
          role="dialog"
          aria-modal="true"
          className="sm:max-w-md max-h-[85vh] overflow-y-auto"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            assignmentFirstFieldRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            lastAssignmentModalTriggerRef.current?.focus();
          }}
        >
          <DialogDescription className="sr-only">
            Assign or edit crew work details, including property, task, equipment, timing, and dispatch notes.
          </DialogDescription>
          <div className="flex h-full flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              {editingAssignmentId ? 'Edit Assignment' : linkedRequestId ? 'Dispatch Need to Crew' : 'Assign Task to Crew'}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-3 md:px-0 md:pb-0">

          {linkedRequestId && (
            <div className="rounded-xl border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-300 mb-1">
              Dispatching from needs queue — assignment will mark the request as handled.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Crew member</label>
              <select
                ref={assignmentFirstFieldRef}
                value={assignmentDraft.employeeId}
                onChange={(e) => {
                  setIsAssignmentModalDirty(true);
                  setAssignmentDraft({ ...assignmentDraft, employeeId: e.target.value });
                  setTaskRows((current) => current.map((row) => ({
                    ...row,
                    startTime: getDefaultStartTimeForEmployee(scheduleList, e.target.value, boardDate),
                  })));
                }}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                data-testid="select-assignment-employee"
              >
                {fallbackEligibleEmployees.length === 0 && <option value="">No employees available</option>}
                {fallbackEligibleEmployees.map((e) => {
                  const shift = getShiftForEmployee(scheduleList, e.id, boardDate);
                  const shiftStr = shift ? ` (${formatTime(shift.shiftStart)}-${formatTime(shift.shiftEnd)})` : '';
                  return (
                    <option key={e.id} value={e.id}>
                      {e.firstName} {e.lastName}{shiftStr} · {e.department || e.group || 'General'}
                    </option>
                  );
                })}
              </select>
            </div>

            {editingAssignmentId ? (
              <>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Task</label>
              <select
                value={assignmentDraft.taskId}
                onChange={(e) => {
                  if (e.target.value === '__manage_task_library__') {
                    if (!closeAssignmentDialog()) return;
                    navigate('/app/settings?tab=Tasks');
                    return;
                  }
                  setIsAssignmentModalDirty(true);
                  setAssignmentDraft({
                    ...assignmentDraft,
                    taskId: e.target.value,
                  });
                }}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                data-testid="select-assignment-task"
              >
                {showTaskLoading ? <option value="" disabled>Loading tasks...</option> : null}
                {taskLibrary.length === 0 && !isLoadingTasks ? (
                  <option value="" disabled>No tasks in library — add tasks in Settings → Tasks</option>
                ) : null}
                {orderedTaskCategories.map((category) => (
                  <optgroup key={category} label={category}>
                    {groupedTaskLibrary[category].map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.name} ({Number(task.estimated_hours ?? 0)}h)
                      </option>
                    ))}
                  </optgroup>
                ))}
                <option value="__manage_task_library__">+ Manage task library</option>
              </select>
              {taskLibraryError ? (
                <button
                  type="button"
                  className="mt-2 text-xs font-medium text-primary hover:underline"
                  onClick={() => void refetchTasks()}
                >
                  Retry loading tasks →
                </button>
              ) : null}
              <button
                type="button"
                className="mt-2 block text-xs font-medium text-primary hover:underline"
                onClick={() => {
                  if (!closeAssignmentDialog()) return;
                  navigate('/app/settings?tab=Tasks');
                }}
              >
                + Manage task library
              </button>
            </div>

            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Equipment</label>
                <select
                  value={assignmentDraft.equipmentId}
                  onChange={(e) => {
                    setIsAssignmentModalDirty(true);
                    setAssignmentDraft({ ...assignmentDraft, equipmentId: e.target.value });
                  }}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                data-testid="select-assignment-equipment"
              >
                <option value="">No equipment</option>
                {availableEquipment.map((u) => (
                  <option key={u.id} value={u.id}>
                    {(u.unit_name || u.name || 'Equipment')} ({u.type || 'General'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Start time</label>
              <TimeSelect
                value={assignmentDraft.startTime}
                onChange={(value) => {
                  setIsAssignmentModalDirty(true);
                  setAssignmentDraft({ ...assignmentDraft, startTime: value });
                }}
              />
              <div className="mt-1 text-[11px] text-muted-foreground">{formatTime(assignmentDraft.startTime)}</div>
            </div>


            <div>
              <label className="text-xs text-muted-foreground">Status</label>
                <select
                  value={assignmentDraft.status}
                  onChange={(e) => {
                    setIsAssignmentModalDirty(true);
                    setAssignmentDraft({ ...assignmentDraft, status: e.target.value as Assignment['status'] });
                  }}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                data-testid="select-assignment-status"
              >
                <option value="planned">Planned</option>
                <option value="in-progress">In Progress</option>
                <option value="complete">Complete</option>
              </select>
            </div>
              </>
            ) : (
              <div className="col-span-2 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-muted-foreground">Tasks</label>
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={() => {
                      setIsAssignmentModalDirty(true);
                      setTaskRows((current) => [
                        ...current,
                        makeEmptyTaskRow(
                          getDefaultStartTimeForEmployee(scheduleList, assignmentDraft.employeeId, boardDate),
                          effectivePropertyId && effectivePropertyId !== 'all' ? effectivePropertyId : '',
                        ),
                      ]);
                    }}
                  >
                    + Add another task
                  </button>
                </div>
                {taskRows.map((row, index) => {
                  const selectedTask = taskLibrary.find((task) => task.id === row.taskId) ?? null;
                  return (
                  <div key={row.id} className="rounded-lg border bg-muted/20 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Task {index + 1}</span>
                      {taskRows.length > 1 ? (
                        <button
                          type="button"
                          aria-label={`Remove task ${index + 1}`}
                          className="rounded-full p-2 text-lg leading-none text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setIsAssignmentModalDirty(true);
                            setTaskRows((current) => current.filter((item) => item.id !== row.id));
                          }}
                        >
                          x
                        </button>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="text-xs text-muted-foreground">Property</label>
                        <select
                          value={row.propertyId}
                          onChange={(e) => {
                            setIsAssignmentModalDirty(true);
                            setTaskRows((current) => current.map((item) => (item.id === row.id ? { ...item, propertyId: e.target.value } : item)));
                          }}
                          className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          data-testid="select-assignment-row-property"
                        >
                          <option value="">Select property</option>
                          {properties.map((property) => (
                            <option key={property.id} value={property.id}>
                              {property.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Task</label>
                        <select
                          value={row.taskId}
                          onChange={(e) => {
                            if (e.target.value === '__manage_task_library__') {
                              if (!closeAssignmentDialog()) return;
                              navigate('/app/settings?tab=Tasks');
                              return;
                            }
                            setIsAssignmentModalDirty(true);
                            setTaskRows((current) => current.map((item) => (item.id === row.id ? { ...item, taskId: e.target.value } : item)));
                          }}
                          className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          data-testid="select-assignment-task"
                        >
                          <option value="">Select task</option>
                          {showTaskLoading ? <option value="" disabled>Loading tasks...</option> : null}
                          {taskLibrary.length === 0 && !isLoadingTasks ? (
                            <option value="" disabled>No tasks in library - add tasks in Settings to Tasks</option>
                          ) : null}
                          {orderedTaskCategories.map((category) => (
                            <optgroup key={category} label={category}>
                              {groupedTaskLibrary[category].map((task) => (
                                <option key={task.id} value={task.id}>
                                  {task.name} ({Number(task.estimated_hours ?? 0)}h)
                                </option>
                              ))}
                            </optgroup>
                          ))}
                          <option value="__manage_task_library__">+ Manage task library</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Hours (optional)</label>
                        <Input
                          type="number"
                          min={0}
                          step={0.25}
                          value={row.hoursOverride}
                          placeholder={`Default: ${selectedTask?.estimated_hours ?? 0}h`}
                          onChange={(e) => {
                            setIsAssignmentModalDirty(true);
                            setTaskRows((current) => current.map((item) => (item.id === row.id ? { ...item, hoursOverride: e.target.value } : item)));
                          }}
                          className="mt-1 h-10 border-border bg-background text-foreground"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-muted-foreground">Equipment</label>
                        <select
                          value={row.equipmentId}
                          onChange={(e) => {
                            setIsAssignmentModalDirty(true);
                            setTaskRows((current) => current.map((item) => (item.id === row.id ? { ...item, equipmentId: e.target.value } : item)));
                          }}
                          className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          data-testid="select-assignment-equipment"
                        >
                          <option value="">No equipment</option>
                          {availableEquipment.map((u) => (
                            <option key={u.id} value={u.id}>
                              {(u.unit_name || u.name || 'Equipment')} ({u.type || 'General'})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Start time</label>
                        <TimeSelect
                          value={row.startTime}
                          onChange={(value) => {
                            setIsAssignmentModalDirty(true);
                            setTaskRows((current) => current.map((item) => (item.id === row.id ? { ...item, startTime: value } : item)));
                          }}
                        />
                        <div className="mt-1 text-[11px] text-muted-foreground">{formatTime(row.startTime)}</div>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Status</label>
                        <select
                          value={row.status}
                          onChange={(e) => {
                            setIsAssignmentModalDirty(true);
                            setTaskRows((current) => current.map((item) => (item.id === row.id ? { ...item, status: e.target.value as TaskRowDraft['status'] } : item)));
                          }}
                          className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          data-testid="select-assignment-status"
                        >
                          <option value="planned">Planned</option>
                          <option value="in_progress">In Progress</option>
                          <option value="done">Complete</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  );
                })}
                {taskLibraryError ? (
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={() => void refetchTasks()}
                  >
                    Retry loading tasks
                  </button>
                ) : null}
              </div>
            )}

            <div className="col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground">Notes</label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 px-2 text-xs"
                  onClick={() => void handleGenerateTaskNotes()}
                  disabled={!selectedTaskForDraft || isGeneratingTaskNotes}
                >
                  <Sparkles className={`h-3.5 w-3.5 ${isGeneratingTaskNotes ? 'animate-pulse' : ''}`} />
                  {isGeneratingTaskNotes ? 'Generating…' : 'Generate notes'}
                </Button>
              </div>
              <textarea
                value={assignmentDraft.notes}
                onChange={(e) => {
                  setIsAssignmentModalDirty(true);
                  setAssignmentDraft({ ...assignmentDraft, notes: e.target.value });
                }}
                className="mt-1 min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                data-testid="input-assignment-notes"
              />
            </div>

            {dispatchWeatherConflict.sprayMessage ? (
              <div className="col-span-2 rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
                <p className="font-medium">{dispatchWeatherConflict.sprayMessage}</p>
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setWeatherConflictOverride(false);
                      closeAssignmentDialog();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-status-pending text-text-primary hover:bg-status-pending/90"
                    onClick={() => {
                      setWeatherConflictOverride(true);
                      void saveAssignment(true);
                    }}
                  >
                    Dispatch Anyway
                  </Button>
                </div>
              </div>
            ) : null}

            {dispatchWeatherConflict.heatMessage ? (
              <div className="col-span-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
                <p className="font-medium">{dispatchWeatherConflict.heatMessage}</p>
              </div>
            ) : null}
          </div>

          </div>

          <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-card px-4 py-3 md:static md:border-t-0 md:bg-transparent md:px-0 md:py-2">
            <Button className="min-h-11" variant="outline" onClick={() => closeAssignmentDialog()}>
              Cancel
            </Button>
            <Button
              className="min-h-11"
              onClick={saveAssignment}
              data-testid="button-save-assignment"
              disabled={dispatchWeatherConflict.hasSprayConflict && !weatherConflictOverride}
            >
              {editingAssignmentId ? 'Save Changes' : 'Dispatch'}
            </Button>
          </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={sendScheduleDialogOpen} onOpenChange={setSendScheduleDialogOpen}>
        <DialogContent role="dialog" aria-modal="true" className="max-w-lg">
          <DialogDescription className="sr-only">
            Select scheduled crew recipients and choose how to share today&apos;s work schedule.
          </DialogDescription>
          <DialogHeader>
            <DialogTitle>Send today's schedule to crew</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="max-h-64 space-y-2 overflow-auto rounded-md border p-3">
              {scheduledEmployees.length === 0 ? (
                <p className="text-sm text-muted-foreground">No scheduled crew for this date.</p>
              ) : (
                scheduledEmployees.map((employee) => {
                  const checked = selectedScheduleRecipientIds.includes(employee.id);
                  return (
                    <label key={`send-schedule-employee-${employee.id}`} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleScheduleRecipient(employee.id)}
                      />
                      <span>{employee.firstName} {employee.lastName}</span>
                      <span className="text-xs text-muted-foreground">{employee.email || ''}</span>
                    </label>
                  );
                })
              )}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Button variant="outline" onClick={shareScheduleByEmail}>Email</Button>
              <Button variant="outline" onClick={() => void shareScheduleByCopy()}>Copy to clipboard</Button>
              <Button variant="outline" onClick={shareScheduleByWhatsApp}>WhatsApp</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={taskTemplateDialogOpen} onOpenChange={setTaskTemplateDialogOpen}>
        <DialogContent role="dialog" aria-modal="true" className="max-w-2xl">
          <DialogDescription className="sr-only">
            Select task-library items and choose whether to apply the daily template to all scheduled crew or selected team members.
          </DialogDescription>
          <DialogHeader>
            <DialogTitle>Apply Daily Task Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-sm font-medium">Template Scope</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Select tasks from your task library, then apply to all scheduled crew or specific team members.
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Crew Selection</p>
              <div className="flex items-center gap-2 mb-2">
                <Button
                  type="button"
                  size="sm"
                  variant={applyTemplateToAllCrew ? 'default' : 'outline'}
                  onClick={() => {
                    setApplyTemplateToAllCrew(true);
                    setSelectedTemplateEmployeeIds(scheduledEmployees.map((employee) => employee.id));
                  }}
                >
                  Apply to All Crew
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={!applyTemplateToAllCrew ? 'default' : 'outline'}
                  onClick={() => {
                    setApplyTemplateToAllCrew(false);
                    setSelectedTemplateEmployeeIds((current) =>
                      current.length > 0 ? current : scheduledEmployees.slice(0, 1).map((employee) => employee.id),
                    );
                  }}
                >
                  Select Crew
                </Button>
              </div>
              {!applyTemplateToAllCrew ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {scheduledEmployees.map((employee) => {
                    const checked = selectedTemplateEmployeeIds.includes(employee.id);
                    return (
                      <label key={`template-employee-${employee.id}`} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTemplateEmployee(employee.id)}
                        />
                        <span>
                          {employee.firstName} {employee.lastName}
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {scheduledEmployees.length} scheduled crew member{scheduledEmployees.length === 1 ? '' : 's'} selected.
                </p>
              )}
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Tasks</p>
              {showTaskLoading ? (
                <div className="rounded-md border p-4 text-sm text-muted-foreground">Loading task library...</div>
              ) : taskLibraryError ? (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <p>Could not load tasks: {taskLibraryError}</p>
                  <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => void refetchTasks()}>
                    Retry
                  </Button>
                </div>
              ) : taskLibrary.length === 0 ? (
                <div className="rounded-md border p-4 text-sm text-muted-foreground">
                  No task library items found. Add tasks in Settings before applying a daily template.
                </div>
              ) : (
                <div className="max-h-72 space-y-3 overflow-auto rounded-md border p-3">
                  {orderedTaskCategories.map((category) => (
                    <div key={`template-category-${category}`}>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{category}</p>
                      <div className="space-y-1">
                        {groupedTaskLibrary[category].map((task) => {
                          const checked = selectedTemplateTaskIds.includes(task.id);
                          return (
                            <label key={`template-task-${task.id}`} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted/40">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleTemplateTask(task.id)}
                              />
                              <span className="flex-1">{task.name}</span>
                              <span className="text-xs text-muted-foreground">{Number(task.estimated_hours ?? 0)}h</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setTaskTemplateDialogOpen(false)}
              disabled={applyingTaskTemplate}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void applyDailyTaskTemplate()}
              disabled={
                applyingTaskTemplate ||
                showTaskLoading ||
                selectedTemplateTaskIds.length === 0 ||
                (!applyTemplateToAllCrew && selectedTemplateEmployeeIds.length === 0) ||
                scheduledEmployees.length === 0
              }
            >
              {applyingTaskTemplate ? 'Applying...' : 'Apply to Crew'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── NOTE DIALOG ─── */}
      <Dialog open={endOfDayDialogOpen} onOpenChange={setEndOfDayDialogOpen}>
        <DialogContent role="dialog" aria-modal="true" className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogDescription className="sr-only">
            Review the generated end-of-day operations report and share it by copy, email, WhatsApp, or print.
          </DialogDescription>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" /> End of Day Report
            </DialogTitle>
          </DialogHeader>
          {endOfDayReportGenerating ? (
            <div className="space-y-2 py-3">
              <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            </div>
          ) : (
            <>
              <div className="max-h-[55vh] overflow-auto rounded-md border bg-muted/20 p-3">
                <pre className="whitespace-pre-wrap text-xs leading-relaxed">{endOfDayReportText}</pre>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-4">
                <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={() => void copyEndOfDayReport()}>
                  <ClipboardCopy className="h-3.5 w-3.5" /> Copy
                </Button>
                <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={emailEndOfDayReport}>
                  <Mail className="h-3.5 w-3.5" /> Email
                </Button>
                <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={shareEndOfDayReportWhatsApp}>
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </Button>
                <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={printEndOfDayReport}>
                  <Printer className="h-3.5 w-3.5" /> Print
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent role="dialog" aria-modal="true" className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogDescription className="sr-only">
            Review and add scoped notes across organization-wide, property, employee, and task contexts.
          </DialogDescription>
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-3">
              <span>Notes</span>
              <Badge variant="secondary" className="h-6 px-2 text-xs">{noteList.length}</Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-1">
              {noteScopeTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setNoteScope(tab.id)}
                  className={`flex-1 rounded-lg py-1 text-[11px] font-medium transition-colors ${
                    noteScope === tab.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>

            {noteScope === 'property' ? (
              <div>
                <label className="text-xs text-muted-foreground">Property</label>
                {effectivePropertyId === 'all' ? (
                  <select
                    value={selectedNotePropertyId}
                    onChange={(e) => setSelectedNotePropertyId(e.target.value)}
                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Choose a property</option>
                    {properties.map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="mt-1 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                    {propertyNameById.get(selectedPropertyNoteId) ?? activeProperty?.name ?? 'Current property'}
                  </div>
                )}
              </div>
            ) : null}

            {noteScope === 'employee' ? (
              <div>
                <label className="text-xs text-muted-foreground">Scheduled employee</label>
                <select
                  value={selectedNoteEmployeeId}
                  onChange={(e) => setSelectedNoteEmployeeId(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Choose a scheduled employee</option>
                  {scheduledEmployees.map((employee) => {
                    const shift = getShiftForEmployee(scheduleList, employee.id, boardDate);
                    const propertyName = propertyNameById.get(shift?.propertyId ?? employee.propertyId ?? '') ?? 'Property';
                    return (
                      <option key={employee.id} value={employee.id}>
                        {employee.firstName} {employee.lastName} - {propertyName}
                      </option>
                    );
                  })}
                </select>
              </div>
            ) : null}

            {noteScope === 'task' ? (
              <div>
                <label className="text-xs text-muted-foreground">Today&apos;s assignment</label>
                <select
                  value={selectedNoteAssignmentId}
                  onChange={(e) => setSelectedNoteAssignmentId(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Choose a task</option>
                  {dayAssignments.map((assignment) => {
                    if (!assignment.id) return null;
                    const taskLabel = assignment.title || taskNameById.get(assignment.taskId) || 'Task';
                    const employeeLabel = employeeNameById.get(assignment.employeeId) ?? 'Unassigned';
                    return (
                      <option key={assignment.id} value={assignment.id}>
                        {taskLabel} - {employeeLabel}
                      </option>
                    );
                  })}
                </select>
              </div>
            ) : null}

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Visible notes</p>
              <div className="max-h-56 space-y-2 overflow-auto rounded-md border p-2">
                {visibleScopedNotes.length === 0 ? (
                  <div className="rounded-md border border-dashed bg-muted/20 p-4 text-center text-xs text-muted-foreground">
                    No notes in this scope yet.
                  </div>
                ) : (
                  visibleScopedNotes.map((note) => (
                    <div key={note.id} className="rounded-md border bg-card p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{note.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{note.date}</p>
                        </div>
                        <Badge variant={note.type === 'alert' ? 'destructive' : 'secondary'} className="shrink-0 text-[10px] capitalize">
                          {note.type}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{note.content}</p>
                      {note.location ? <p className="mt-2 text-xs text-muted-foreground">Location: {note.location}</p> : null}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t pt-4">
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
                    <option value="">No specific location</option>
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
              <Button variant="outline" onClick={() => setNoteDialogOpen(false)} disabled={savingNote}>Close</Button>
              <Button onClick={saveNote} disabled={savingNote || !noteDraft.content.trim()}>
                {savingNote ? 'Saving...' : 'Add Note'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
      )}
    </>
  );
}
