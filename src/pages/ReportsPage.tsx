import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useOrgProfile } from '@/hooks/useOrgProfile';
import { createClient } from '@/lib/supabase';
import { useSearchParams } from 'next/navigation';
import { toast } from '@/components/ui/sonner';
import { PageSkeleton } from '@/components/PageSkeleton';
import { ErrorRetry } from '@/components/ErrorRetry';
import { EmptyState } from '@/components/EmptyState';
import { TableSkeleton } from '@/components/TableSkeleton';
import { BarChart3 } from 'lucide-react';
import { useEmployees, useProperties } from '@/lib/supabase-queries';

const supabase = createClient();

const RechartsResponsiveContainer = lazy(() =>
  import('recharts').then((m) => ({ default: m.ResponsiveContainer })),
);
const RechartsBarChart = lazy(() =>
  import('recharts').then((m) => ({ default: m.BarChart })),
);
const RechartsLineChart = lazy(() =>
  import('recharts').then((m) => ({ default: m.LineChart })),
);
const RechartsAreaChart = lazy(() =>
  import('recharts').then((m) => ({ default: m.AreaChart })),
);
const RechartsBar = lazy(() =>
  import('recharts').then((m) => ({ default: m.Bar })),
);
const RechartsLine = lazy(() =>
  import('recharts').then((m) => ({ default: m.Line })),
);
const RechartsArea = lazy(() =>
  import('recharts').then((m) => ({ default: m.Area })),
);
const RechartsCartesianGrid = lazy(() =>
  import('recharts').then((m) => ({ default: m.CartesianGrid })),
);
const RechartsCell = lazy(() =>
  import('recharts').then((m) => ({ default: m.Cell })),
);
const RechartsTooltip = lazy(() =>
  import('recharts').then((m) => ({ default: m.Tooltip })),
);
const RechartsXAxis = lazy(() =>
  import('recharts').then((m) => ({ default: m.XAxis })),
);
const RechartsYAxis = lazy(() =>
  import('recharts').then((m) => ({ default: m.YAxis })),
);

type PropertyRow = {
  id: string;
  name: string;
};

type EmployeeRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  hourly_rate: number | null;
};

type AssignmentRow = {
  id: string;
  employee_id: string;
  task_id: string | null;
  property_id: string | null;
  date: string;
  status: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
};

type ScheduleEntryTrendRow = {
  id: string;
  employee_id: string;
  property_id: string | null;
  date: string;
  shift_start: string | null;
  shift_end: string | null;
  status: string | null;
};

type EquipmentRow = {
  id: string;
  name: string | null;
  unit_name: string | null;
  status: string | null;
  last_serviced: string | null;
};

type TaskRow = {
  id: string;
  name: string | null;
  category: string | null;
};


type ClockEventRow = {
  id: string;
  employee_id: string;
  property_id: string | null;
  event_type: string | null;
  timestamp: string | null;
};

type TimesheetScheduleRow = {
  id: string;
  employee_id: string;
  property_id: string | null;
  date: string;
  shift_start: string | null;
  shift_end: string | null;
};

type LaborSummaryRow = {
  employeeId: string;
  employeeName: string;
  daysWorked: number;
  scheduledHours: number;
  actualHours: number;
  tasksCompleted: number;
  variance: number;
  scheduledCost: number;
  actualCost: number;
  varianceCost: number;
};

type CostByTaskRow = {
  category: string;
  tasksCompleted: number;
  totalHours: number;
  totalCost: number;
  avgCostPerTask: number;
};

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function startOfWeek(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfWeek(date: Date) {
  const copy = startOfWeek(date);
  copy.setDate(copy.getDate() + 6);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function formatHours(value: number) {
  return value.toFixed(1);
}

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`;
}

function quoteCsv(value: string | number) {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function calculateShiftHours(shiftStart?: string | null, shiftEnd?: string | null) {
  const start = String(shiftStart ?? '').slice(0, 5);
  const end = String(shiftEnd ?? '').slice(0, 5);
  if (!start || !end || !start.includes(':') || !end.includes(':')) return 0;
  const [startHour, startMinute] = start.split(':').map((part) => Number(part));
  const [endHour, endMinute] = end.split(':').map((part) => Number(part));
  if ([startHour, startMinute, endHour, endMinute].some((value) => Number.isNaN(value))) return 0;
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;
  const raw = endMinutes - startMinutes;
  if (raw <= 0) return 0;
  return raw / 60;
}

export default function ReportsPage() {
  const searchParams = useSearchParams();
  const isFullReportView = searchParams.get('fullReport') === '1';
  const queryStartDate = searchParams.get('start');
  const queryEndDate = searchParams.get('end');
  const queryPropertyId = searchParams.get('property');
  const { orgId, currentPropertyId, currentUser } = useOrgProfile();
  const [startDate, setStartDate] = useState<string>(() => queryStartDate || toIsoDate(startOfWeek(new Date())));
  const [endDate, setEndDate] = useState<string>(() => queryEndDate || toIsoDate(endOfWeek(new Date())));
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(
    queryPropertyId || (currentPropertyId && currentPropertyId !== 'all' ? currentPropertyId : 'all'),
  );
  const propertiesQuery = useProperties(orgId ?? undefined);
  const employeesQuery = useEmployees(
    selectedPropertyId === 'all' ? undefined : selectedPropertyId,
    orgId ?? undefined,
  );
  const properties = useMemo(
    () => (propertiesQuery.data ?? []).map((property) => ({ id: property.id, name: property.name })),
    [propertiesQuery.data],
  );
  const employees = useMemo(
    () =>
      (employeesQuery.data ?? [])
        .filter((employee) => selectedPropertyId === 'all' || employee.propertyId === selectedPropertyId)
        .map((employee) => ({
          id: employee.id,
          first_name: employee.firstName,
          last_name: employee.lastName,
          hourly_rate: employee.wage,
        })),
    [employeesQuery.data, selectedPropertyId],
  );
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [clockEvents, setClockEvents] = useState<ClockEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTimeout, setShowTimeout] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'trends' | 'gm' | 'timesheets'>('summary');
  const [trendAssignments, setTrendAssignments] = useState<AssignmentRow[]>([]);
  const [trendScheduleEntries, setTrendScheduleEntries] = useState<ScheduleEntryTrendRow[]>([]);
  const [equipmentRows, setEquipmentRows] = useState<EquipmentRow[]>([]);
  const [openNeedsCount, setOpenNeedsCount] = useState(0);
  const organizationName = 'Ground Crew HQ';
  const [timesheetWeekStart, setTimesheetWeekStart] = useState<string>(() => toIsoDate(startOfWeek(new Date())));
  const [timesheetSchedules, setTimesheetSchedules] = useState<TimesheetScheduleRow[]>([]);
  const [timesheetAssignments, setTimesheetAssignments] = useState<AssignmentRow[]>([]);
  const [timesheetLoading, setTimesheetLoading] = useState(false);
  const [timesheetError, setTimesheetError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Reports — Ground Crew HQ';
  }, []);

  const applyPreset = (preset: 'this-week' | 'last-week' | 'this-month' | 'last-month') => {
    const now = new Date();
    if (preset === 'this-week') {
      setStartDate(toIsoDate(startOfWeek(now)));
      setEndDate(toIsoDate(endOfWeek(now)));
      return;
    }
    if (preset === 'last-week') {
      const base = startOfWeek(now);
      base.setDate(base.getDate() - 7);
      setStartDate(toIsoDate(startOfWeek(base)));
      setEndDate(toIsoDate(endOfWeek(base)));
      return;
    }
    if (preset === 'this-month') {
      setStartDate(toIsoDate(startOfMonth(now)));
      setEndDate(toIsoDate(endOfMonth(now)));
      return;
    }
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    setStartDate(toIsoDate(startOfMonth(lastMonth)));
    setEndDate(toIsoDate(endOfMonth(lastMonth)));
  };

  const fetchReportData = useCallback(async () => {
    if (!supabase || !orgId) return;
    setLoading(true);
    setError(null);

    let assignmentsQuery = supabase
      .from('assignments')
      .select('id, employee_id, task_id, property_id, date, status, estimated_hours, actual_hours')
      .eq('org_id', orgId)
      .gte('date', startDate)
      .lte('date', endDate);

    if (selectedPropertyId !== 'all') {
      assignmentsQuery = assignmentsQuery.eq('property_id', selectedPropertyId);
    }

    const clockStart = `${startDate}T00:00:00.000Z`;
    const clockEnd = `${endDate}T23:59:59.999Z`;
    let clockEventsQuery = supabase
      .from('clock_events')
      .select('id, employee_id, property_id, event_type, timestamp')
      .eq('org_id', orgId)
      .gte('timestamp', clockStart)
      .lte('timestamp', clockEnd)
      .order('timestamp', { ascending: true });

    if (selectedPropertyId !== 'all') {
      clockEventsQuery = clockEventsQuery.eq('property_id', selectedPropertyId);
    }

    const now = new Date();
    const trendStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const trendStartDate = toIsoDate(trendStart);
    const scheduleTrendStart = startOfWeek(new Date(now));
    scheduleTrendStart.setDate(scheduleTrendStart.getDate() - 7 * 3);
    const scheduleTrendStartDate = toIsoDate(scheduleTrendStart);

    let trendAssignmentsQuery = supabase
      .from('assignments')
      .select('id, employee_id, task_id, property_id, date, status, estimated_hours, actual_hours')
      .eq('org_id', orgId)
      .gte('date', trendStartDate)
      .lte('date', toIsoDate(endOfWeek(now)));

    let trendScheduleEntriesQuery = supabase
      .from('schedule_entries')
      .select('id, employee_id, property_id, date, shift_start, shift_end, status')
      .eq('org_id', orgId)
      .gte('date', scheduleTrendStartDate)
      .lte('date', toIsoDate(endOfWeek(now)))
      .eq('status', 'scheduled');

    if (selectedPropertyId !== 'all') {
      trendAssignmentsQuery = trendAssignmentsQuery.eq('property_id', selectedPropertyId);
      trendScheduleEntriesQuery = trendScheduleEntriesQuery.eq('property_id', selectedPropertyId);
    }

    let tasksQuery = supabase
      .from('tasks')
      .select('id, name, category')
      .eq('org_id', orgId);

    if (selectedPropertyId !== 'all') {
      tasksQuery = tasksQuery.eq('property_id', selectedPropertyId);
    }

    const [assignmentsResult, clockEventsResult, tasksResult, trendAssignmentsResult, trendScheduleEntriesResult] = await Promise.all([
      assignmentsQuery,
      clockEventsQuery,
      tasksQuery,
      trendAssignmentsQuery,
      trendScheduleEntriesQuery,
    ]);

    let equipmentQuery = supabase
      .from('equipment_units')
      .select('id, name, unit_name, status, last_serviced')
      .eq('org_id', orgId);
    if (selectedPropertyId !== 'all') {
      equipmentQuery = equipmentQuery.eq('property_id', selectedPropertyId);
    }

    let openNeedsQuery = supabase
      .from('task_requests')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'open');
    if (selectedPropertyId !== 'all') {
      openNeedsQuery = openNeedsQuery.eq('property_id', selectedPropertyId);
    }

    const [equipmentResult, openNeedsResult] = await Promise.all([
      equipmentQuery,
      openNeedsQuery,
    ]);


    if (
      assignmentsResult.error ||
      clockEventsResult.error ||
      tasksResult.error ||
      trendAssignmentsResult.error ||
      trendScheduleEntriesResult.error ||
      equipmentResult.error ||
      openNeedsResult.error
    ) {
      setError(
        assignmentsResult.error?.message ??
          clockEventsResult.error?.message ??
          tasksResult.error?.message ??
          trendAssignmentsResult.error?.message ??
          trendScheduleEntriesResult.error?.message ??
          equipmentResult.error?.message ??
          openNeedsResult.error?.message ??
          'Unable to load report data',
      );
      setLoading(false);
      return;
    }

    setAssignments((assignmentsResult.data ?? []) as AssignmentRow[]);
    setClockEvents((clockEventsResult.data ?? []) as ClockEventRow[]);
    setTasks((tasksResult.data ?? []) as TaskRow[]);
    setTrendAssignments((trendAssignmentsResult.data ?? []) as AssignmentRow[]);
    setTrendScheduleEntries((trendScheduleEntriesResult.data ?? []) as ScheduleEntryTrendRow[]);
    setEquipmentRows((equipmentResult.data ?? []) as EquipmentRow[]);
    setOpenNeedsCount(openNeedsResult.count ?? 0);

    setLoading(false);
  }, [endDate, orgId, selectedPropertyId, startDate]);

  useEffect(() => {
    if (!orgId) return;
    void fetchReportData();
  }, [fetchReportData, orgId]);

  const fetchTimesheetData = useCallback(async () => {
    if (!supabase || !orgId) return;
    setTimesheetLoading(true);
    setTimesheetError(null);

    const weekStartDate = new Date(`${timesheetWeekStart}T00:00:00`);
    const weekEndDate = addDays(weekStartDate, 6);
    const weekEnd = toIsoDate(weekEndDate);

    let schedulesQuery = supabase
      .from('schedule_entries')
      .select('id, employee_id, property_id, date, shift_start, shift_end')
      .eq('org_id', orgId)
      .gte('date', timesheetWeekStart)
      .lte('date', weekEnd);

    let assignmentsQuery = supabase
      .from('assignments')
      .select('id, employee_id, property_id, date, actual_hours')
      .eq('org_id', orgId)
      .gte('date', timesheetWeekStart)
      .lte('date', weekEnd);

    if (selectedPropertyId !== 'all') {
      schedulesQuery = schedulesQuery.eq('property_id', selectedPropertyId);
      assignmentsQuery = assignmentsQuery.eq('property_id', selectedPropertyId);
    }

    const [schedulesResult, assignmentsResult] = await Promise.all([schedulesQuery, assignmentsQuery]);
    if (schedulesResult.error || assignmentsResult.error) {
      setTimesheetError(schedulesResult.error?.message ?? assignmentsResult.error?.message ?? 'Failed to load timesheet data');
      setTimesheetLoading(false);
      return;
    }

    setTimesheetSchedules((schedulesResult.data ?? []) as TimesheetScheduleRow[]);
    setTimesheetAssignments((assignmentsResult.data ?? []) as AssignmentRow[]);
    setTimesheetLoading(false);
  }, [orgId, selectedPropertyId, timesheetWeekStart]);

  useEffect(() => {
    if (!orgId) return;
    void fetchTimesheetData();
  }, [fetchTimesheetData, orgId]);

  const laborRows = useMemo<LaborSummaryRow[]>(() => {
    const byEmployee = new Map<string, LaborSummaryRow>();
    const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
    const clockHoursByEmployee = new Map<string, { hours: number; days: Set<string> }>();
    const openClockInByEmployee = new Map<string, Date>();

    [...clockEvents]
      .filter((event) => event.timestamp)
      .sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)))
      .forEach((event) => {
        const eventType = String(event.event_type ?? '').toLowerCase();
        const eventTime = new Date(event.timestamp ?? '');
        if (Number.isNaN(eventTime.getTime())) return;

        if (eventType === 'clock_in' || eventType === 'in') {
          openClockInByEmployee.set(event.employee_id, eventTime);
          return;
        }

        if (eventType !== 'clock_out' && eventType !== 'out') return;

        const start = openClockInByEmployee.get(event.employee_id);
        if (!start) return;

        const hours = Math.max(0, (eventTime.getTime() - start.getTime()) / (1000 * 60 * 60));
        const existing = clockHoursByEmployee.get(event.employee_id) ?? { hours: 0, days: new Set<string>() };
        existing.hours += hours;
        existing.days.add(String(event.timestamp).slice(0, 10));
        clockHoursByEmployee.set(event.employee_id, existing);
        openClockInByEmployee.delete(event.employee_id);
      });

    assignments.forEach((assignment) => {
      const employeeId = assignment.employee_id;
      const employee = employeeById.get(employeeId);
      const hourlyRate = Number(employee?.hourly_rate ?? 0);
      const existing = byEmployee.get(employeeId) ?? {
        employeeId,
        employeeName: employee ? `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim() || 'Unnamed Employee' : 'Unknown Employee',
        daysWorked: 0,
        scheduledHours: 0,
        actualHours: 0,
        tasksCompleted: 0,
        variance: 0,
        scheduledCost: 0,
        actualCost: 0,
        varianceCost: 0,
      };

      const scheduledHours = Number(assignment.estimated_hours ?? 0);
      const actualHours = Number(assignment.actual_hours ?? 0);
      existing.scheduledHours += scheduledHours;
      existing.actualHours += actualHours;
      existing.scheduledCost += scheduledHours * hourlyRate;
      existing.actualCost += actualHours * hourlyRate;
      if (assignment.status === 'done') existing.tasksCompleted += 1;
      byEmployee.set(employeeId, existing);
    });

    clockHoursByEmployee.forEach((clockSummary, employeeId) => {
      const employee = employeeById.get(employeeId);
      const hourlyRate = Number(employee?.hourly_rate ?? 0);
      const existing = byEmployee.get(employeeId) ?? {
        employeeId,
        employeeName: employee ? `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim() || 'Unnamed Employee' : 'Unknown Employee',
        daysWorked: 0,
        scheduledHours: 0,
        actualHours: 0,
        tasksCompleted: 0,
        variance: 0,
        scheduledCost: 0,
        actualCost: 0,
        varianceCost: 0,
      };

      if (clockSummary.hours > existing.actualHours) {
        existing.actualHours = clockSummary.hours;
        existing.actualCost = clockSummary.hours * hourlyRate;
      }
      byEmployee.set(employeeId, existing);
    });

    byEmployee.forEach((row) => {
      const workedDays = new Set(
        assignments.filter((assignment) => assignment.employee_id === row.employeeId).map((assignment) => assignment.date),
      );
      clockHoursByEmployee.get(row.employeeId)?.days.forEach((date) => workedDays.add(date));
      row.daysWorked = workedDays.size;
      row.variance = row.actualHours - row.scheduledHours;
      row.varianceCost = row.actualCost - row.scheduledCost;
    });

    return Array.from(byEmployee.values()).sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }, [assignments, clockEvents, employees]);

  const hasLaborResult = !loading || Boolean(error) || laborRows.length > 0;

  useEffect(() => {
    if (hasLaborResult) {
      setShowTimeout(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setShowTimeout(true);
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [hasLaborResult]);

  const totals = useMemo(() => {
    return laborRows.reduce(
      (sum, row) => {
        sum.daysWorked += row.daysWorked;
        sum.scheduledHours += row.scheduledHours;
        sum.actualHours += row.actualHours;
        sum.tasksCompleted += row.tasksCompleted;
        sum.variance += row.variance;
        sum.scheduledCost += row.scheduledCost;
        sum.actualCost += row.actualCost;
        sum.varianceCost += row.varianceCost;
        return sum;
      },
      {
        daysWorked: 0,
        scheduledHours: 0,
        actualHours: 0,
        tasksCompleted: 0,
        variance: 0,
        scheduledCost: 0,
        actualCost: 0,
        varianceCost: 0,
      },
    );
  }, [laborRows]);

  const costByTaskRows = useMemo<CostByTaskRow[]>(() => {
    const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
    const taskCategoryById = new Map(tasks.map((task) => [task.id, task.category?.trim() || 'General']));
    const byCategory = new Map<string, CostByTaskRow>();

    assignments.forEach((assignment) => {
      const category = taskCategoryById.get(assignment.task_id ?? '') ?? 'General';
      const employee = employeeById.get(assignment.employee_id);
      const hourlyRate = Number(employee?.hourly_rate ?? 0);
      const actualHours = Number(assignment.actual_hours ?? 0);
      const cost = actualHours * hourlyRate;
      const existing = byCategory.get(category) ?? {
        category,
        tasksCompleted: 0,
        totalHours: 0,
        totalCost: 0,
        avgCostPerTask: 0,
      };
      existing.totalHours += actualHours;
      existing.totalCost += cost;
      if (assignment.status === 'done') {
        existing.tasksCompleted += 1;
      }
      byCategory.set(category, existing);
    });

    const rows = Array.from(byCategory.values()).map((row) => ({
      ...row,
      avgCostPerTask: row.tasksCompleted > 0 ? row.totalCost / row.tasksCompleted : 0,
    }));

    return rows.sort((a, b) => a.category.localeCompare(b.category));
  }, [assignments, employees, tasks]);

  const costByTaskTotals = useMemo(() => {
    return costByTaskRows.reduce(
      (sum, row) => {
        sum.tasksCompleted += row.tasksCompleted;
        sum.totalHours += row.totalHours;
        sum.totalCost += row.totalCost;
        return sum;
      },
      {
        tasksCompleted: 0,
        totalHours: 0,
        totalCost: 0,
      },
    );
  }, [costByTaskRows]);

  const trendChartData = useMemo(() => {
    const now = new Date();
    const monthKeys = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      return toIsoDate(date).slice(0, 7);
    });
    const byMonth = new Map(
      monthKeys.map((monthKey) => [
        monthKey,
        {
          month: monthKey,
          label: new Date(`${monthKey}-01T00:00:00`).toLocaleDateString('en-US', { month: 'short' }),
          totalTasks: 0,
          doneTasks: 0,
          completionRate: 0,
          scheduledHours: 0,
          actualHours: 0,
          laborCost: 0,
        },
      ]),
    );
    const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
    trendAssignments.forEach((assignment) => {
      const month = String(assignment.date).slice(0, 7);
      const bucket = byMonth.get(month);
      if (!bucket) return;
      const estimated = Number(assignment.estimated_hours ?? 0);
      const actual = Number(assignment.actual_hours ?? 0);
      bucket.totalTasks += 1;
      if ((assignment.status ?? '').toLowerCase() === 'done') bucket.doneTasks += 1;
      bucket.scheduledHours += estimated;
      bucket.actualHours += actual;
      const rate = Number(employeeById.get(assignment.employee_id)?.hourly_rate ?? 0);
      bucket.laborCost += actual * rate;
    });
    return Array.from(byMonth.values()).map((row) => ({
      ...row,
      completionRate: row.totalTasks > 0 ? Number(((row.doneTasks / row.totalTasks) * 100).toFixed(1)) : 0,
      scheduledHours: Number(row.scheduledHours.toFixed(1)),
      actualHours: Number(row.actualHours.toFixed(1)),
      laborCost: Number(row.laborCost.toFixed(2)),
    }));
  }, [employees, trendAssignments]);

  const ytdCost = useMemo(
    () => trendChartData.reduce((sum, row) => sum + Number(row.laborCost ?? 0), 0),
    [trendChartData],
  );

  const monthOverMonthDeltas = useMemo(() => {
    return trendChartData.map((row, index) => {
      if (index === 0) {
        return { ...row, deltaScheduled: 0, deltaActual: 0, deltaCost: 0 };
      }
      const previous = trendChartData[index - 1];
      return {
        ...row,
        deltaScheduled: Number((row.scheduledHours - previous.scheduledHours).toFixed(1)),
        deltaActual: Number((row.actualHours - previous.actualHours).toFixed(1)),
        deltaCost: Number((row.laborCost - previous.laborCost).toFixed(2)),
      };
    });
  }, [trendChartData]);

  const crewUtilizationData = useMemo(() => {
    const last4Start = startOfWeek(new Date());
    last4Start.setDate(last4Start.getDate() - 7 * 3);
    const last4StartKey = toIsoDate(last4Start);
    const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
    const byEmployee = new Map<string, { name: string; actualHours: number; shiftHours: number }>();

    const shiftHoursForEntry = (entry: ScheduleEntryTrendRow) => {
      const startValue = entry.shift_start?.slice(0, 5);
      const endValue = entry.shift_end?.slice(0, 5);
      if (!startValue || !endValue) return 0;
      const [startHour, startMinute] = startValue.split(':').map((value) => Number(value));
      const [endHour, endMinute] = endValue.split(':').map((value) => Number(value));
      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;
      const durationMinutes = endMinutes - startMinutes;
      return durationMinutes > 0 ? durationMinutes / 60 : 0;
    };

    trendScheduleEntries
      .filter((entry) => entry.date >= last4StartKey)
      .forEach((entry) => {
        const employee = employeeById.get(entry.employee_id);
        const name = employee ? `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim() || 'Unnamed Employee' : 'Unknown Employee';
        const existing = byEmployee.get(entry.employee_id) ?? { name, actualHours: 0, shiftHours: 0 };
        existing.shiftHours += shiftHoursForEntry(entry);
        byEmployee.set(entry.employee_id, existing);
      });

    trendAssignments
      .filter((assignment) => assignment.date >= last4StartKey)
      .forEach((assignment) => {
        const employee = employeeById.get(assignment.employee_id);
        const name = employee ? `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim() || 'Unnamed Employee' : 'Unknown Employee';
        const existing = byEmployee.get(assignment.employee_id) ?? { name, actualHours: 0, shiftHours: 0 };
        existing.actualHours += Number(assignment.actual_hours ?? assignment.estimated_hours ?? 0);
        byEmployee.set(assignment.employee_id, existing);
      });

    return Array.from(byEmployee.values())
      .map((row) => {
        const averageActual = row.actualHours / 4;
        const averageShift = row.shiftHours / 4;
        const utilizationPercent = averageShift > 0 ? Math.min(100, Math.round((averageActual / averageShift) * 100)) : 0;
        return {
          name: row.name,
          averageHours: Number(averageActual.toFixed(1)),
          utilizationPercent,
          fill:
            utilizationPercent >= 80
              ? '#16a34a'
              : utilizationPercent >= 50
                ? '#f59e0b'
                : '#ef4444',
        };
      })
      .sort((a, b) => b.averageHours - a.averageHours)
      .slice(0, 12);
  }, [employees, trendAssignments, trendScheduleEntries]);

  const exportCsv = useCallback(() => {
    const headers = ['Employee', 'Days Worked', 'Scheduled Hours', 'Actual Hours', 'Tasks Completed', 'Variance', 'Scheduled Cost', 'Actual Cost', 'Variance ($)'];
    const dataRows = laborRows.map((row) => [
      row.employeeName,
      row.daysWorked,
      formatHours(row.scheduledHours),
      formatHours(row.actualHours),
      row.tasksCompleted,
      formatHours(row.variance),
      formatCurrency(row.scheduledCost),
      formatCurrency(row.actualCost),
      formatCurrency(row.varianceCost),
    ]);
    const totalsRow = [
      'Totals',
      totals.daysWorked,
      formatHours(totals.scheduledHours),
      formatHours(totals.actualHours),
      totals.tasksCompleted,
      formatHours(totals.variance),
      formatCurrency(totals.scheduledCost),
      formatCurrency(totals.actualCost),
      formatCurrency(totals.varianceCost),
    ];
    const costHeaders = ['Task Category', 'Tasks Completed', 'Total Hours', 'Total Cost', 'Avg Cost/Task'];
    const costRows = costByTaskRows.map((row) => [
      row.category,
      row.tasksCompleted,
      formatHours(row.totalHours),
      formatCurrency(row.totalCost),
      formatCurrency(row.avgCostPerTask),
    ]);
    const costTotalsRow = [
      'Totals',
      costByTaskTotals.tasksCompleted,
      formatHours(costByTaskTotals.totalHours),
      formatCurrency(costByTaskTotals.totalCost),
      formatCurrency(costByTaskTotals.tasksCompleted > 0 ? costByTaskTotals.totalCost / costByTaskTotals.tasksCompleted : 0),
    ];
    const csvString = [headers, ...dataRows, totalsRow, [], costHeaders, ...costRows, costTotalsRow]
      .map((cells) => cells.map((cell) => quoteCsv(cell)).join(','))
      .join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `labor-report-${toIsoDate(new Date())}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, [costByTaskRows, costByTaskTotals, laborRows, totals]);

  const selectedPropertyName = useMemo(() => {
    if (selectedPropertyId === 'all') return 'All Properties';
    return properties.find((property) => property.id === selectedPropertyId)?.name ?? 'Selected Property';
  }, [properties, selectedPropertyId]);

  const generatedAt = useMemo(
    () =>
      new Date().toLocaleString([], {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [],
  );

  const completionRate = useMemo(() => {
    const totalTasks = assignments.length;
    if (totalTasks === 0) return 0;
    const doneTasks = assignments.filter((row) => (row.status ?? '').toLowerCase() === 'done').length;
    return Math.round((doneTasks / totalTasks) * 100);
  }, [assignments]);

  const overdueEquipmentRows = useMemo(() => {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - 90);
    const thresholdKey = toIsoDate(threshold);
    return equipmentRows.filter((row) => (row.last_serviced ?? '') < thresholdKey);
  }, [equipmentRows]);

  const efficiencyScore = useMemo(() => {
    const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
    const now = new Date();
    const todayKey = toIsoDate(now);
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const start7Key = toIsoDate(sevenDaysAgo);

    const last7Assignments = trendAssignments.filter((row) => row.date >= start7Key && row.date <= todayKey);
    const totalTasks7 = last7Assignments.length;
    const doneTasks7 = last7Assignments.filter((row) => (row.status ?? '').toLowerCase() === 'done').length;
    const completionScore = totalTasks7 > 0 ? (doneTasks7 / totalTasks7) * 30 : 0;

    const todayAssignments = trendAssignments.filter((row) => row.date === todayKey);
    const assignedHours = todayAssignments.reduce((sum, row) => sum + Number(row.estimated_hours ?? 0), 0);
    const parseHours = (value: string | null) => {
      if (!value) return 0;
      const [hour, minute] = value.slice(0, 5).split(':').map((item) => Number(item));
      return hour + minute / 60;
    };
    const shiftHours = trendScheduleEntries
      .filter((row) => row.date === todayKey)
      .reduce((sum, row) => sum + Math.max(0, parseHours(row.shift_end) - parseHours(row.shift_start)), 0);
    const coverageScore = shiftHours > 0 ? Math.min(25, (assignedHours / shiftHours) * 25) : 0;

    const scheduledHours7 = last7Assignments.reduce((sum, row) => sum + Number(row.estimated_hours ?? 0), 0);
    const actualHours7 = last7Assignments.reduce((sum, row) => sum + Number(row.actual_hours ?? 0), 0);
    const varianceScore = scheduledHours7 > 0 ? clamp(20 - (Math.abs(actualHours7 - scheduledHours7) / scheduledHours7) * 20, 0, 20) : 0;

    const overdueCount = overdueEquipmentRows.length;
    const equipmentScore = overdueCount === 0 ? 15 : overdueCount <= 2 ? 10 : overdueCount >= 5 ? 0 : 5;

    const needsScore = openNeedsCount === 0 ? 10 : openNeedsCount <= 3 ? 5 : 0;

    return Math.round(clamp(completionScore + coverageScore + varianceScore + equipmentScore + needsScore, 0, 100));
  }, [openNeedsCount, overdueEquipmentRows.length, trendAssignments, trendScheduleEntries]);

  const efficiencyLabel = useMemo(() => {
    if (efficiencyScore >= 90) return 'Excellent';
    if (efficiencyScore >= 70) return 'Good';
    if (efficiencyScore >= 50) return 'Needs Attention';
    return 'Critical';
  }, [efficiencyScore]);

  const fullReportUrl = useMemo(() => {
    const params = new URLSearchParams({
      fullReport: '1',
      start: startDate,
      end: endDate,
      property: selectedPropertyId,
    });
    return `/app/reports?${params.toString()}`;
  }, [endDate, selectedPropertyId, startDate]);

  const gmSummary = useMemo(() => {
    const totalLaborHours = `${formatHours(totals.scheduledHours)} scheduled / ${formatHours(totals.actualHours)} actual`;
    const totalLaborCost = formatCurrency(totals.actualCost);
    const avgCrewCoverage = totals.scheduledHours > 0 ? Math.round((totals.actualHours / totals.scheduledHours) * 100) : 0;
    const equipmentUptime = equipmentRows.length > 0 ? Math.round((equipmentRows.filter((row) => row.status === 'available').length / equipmentRows.length) * 100) : 0;
    const categoryByTaskId = new Map(tasks.map((task) => [task.id, task]));
    const topTasks = new Map<string, number>();
    assignments.forEach((assignment) => {
      const task = categoryByTaskId.get(assignment.task_id ?? '');
      const taskName = task?.name?.trim() || 'Uncategorized Task';
      topTasks.set(taskName, (topTasks.get(taskName) ?? 0) + Number(assignment.actual_hours ?? assignment.estimated_hours ?? 0));
    });
    const topFive = Array.from(topTasks.entries())
      .map(([name, hours]) => ({ name, hours }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5);
    const laborVariancePct =
      totals.scheduledHours > 0 ? Math.round((Math.abs(totals.actualHours - totals.scheduledHours) / totals.scheduledHours) * 100) : 0;
    const recommendations: string[] = [];
    if (completionRate < 80) recommendations.push('Consider adjusting task estimates or adding crew.');
    if (laborVariancePct > 15) recommendations.push('Review actual hours tracking for accuracy.');
    if (equipmentUptime < 90) recommendations.push('Schedule preventive maintenance.');
    if (recommendations.length === 0) recommendations.push('Current operations are within healthy ranges. Maintain this cadence.');
    return {
      totalLaborHours,
      totalLaborCost,
      completionRate,
      avgCrewCoverage,
      equipmentUptime,
      topFive,
      recommendations,
    };
  }, [assignments, completionRate, equipmentRows, tasks, totals]);

  const exportTrendsCsv = useCallback(() => {
    const headers = ['Month', 'Scheduled Hours', 'Actual Hours', 'Completion Rate (%)', 'Labor Cost'];
    const rows = trendChartData.map((row) => [
      row.label,
      row.scheduledHours,
      row.actualHours,
      row.completionRate,
      row.laborCost,
    ]);
    const csv = [headers, ...rows].map((cells) => cells.map((cell) => quoteCsv(cell)).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `trends-report-${toIsoDate(new Date())}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, [trendChartData]);

  useEffect(() => {
    if (!isFullReportView || loading || error) return;
    const timeoutId = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(timeoutId);
  }, [error, isFullReportView, loading]);

  const timesheetWeekDays = useMemo(() => {
    const start = new Date(`${timesheetWeekStart}T00:00:00`);
    return Array.from({ length: 7 }, (_, index) => {
      const value = addDays(start, index);
      return {
        key: toIsoDate(value),
        label: value.toLocaleDateString('en-US', { weekday: 'short' }),
      };
    });
  }, [timesheetWeekStart]);

  const timesheetRows = useMemo(() => {
    const employeeMap = new Map(employees.map((employee) => [employee.id, employee]));
    const scheduledByEmployeeDay = new Map<string, number>();
    const actualByEmployeeDay = new Map<string, number>();

    timesheetSchedules.forEach((entry) => {
      const key = `${entry.employee_id}|${entry.date}`;
      const hours = calculateShiftHours(entry.shift_start, entry.shift_end);
      scheduledByEmployeeDay.set(key, (scheduledByEmployeeDay.get(key) ?? 0) + hours);
    });

    timesheetAssignments.forEach((entry) => {
      const key = `${entry.employee_id}|${entry.date}`;
      const hours = Number(entry.actual_hours ?? 0);
      actualByEmployeeDay.set(key, (actualByEmployeeDay.get(key) ?? 0) + (Number.isFinite(hours) ? hours : 0));
    });

    const employeeIds = new Set<string>([
      ...timesheetSchedules.map((entry) => entry.employee_id),
      ...timesheetAssignments.map((entry) => entry.employee_id),
    ]);

    return Array.from(employeeIds)
      .map((employeeId) => {
        const employee = employeeMap.get(employeeId);
        const employeeName = employee
          ? `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim() || 'Unnamed Employee'
          : 'Unknown Employee';
        const hourlyRate = Number(employee?.hourly_rate ?? 0);

        const days = timesheetWeekDays.map((day) => {
          const key = `${employeeId}|${day.key}`;
          const scheduled = Number((scheduledByEmployeeDay.get(key) ?? 0).toFixed(2));
          const actual = Number((actualByEmployeeDay.get(key) ?? 0).toFixed(2));
          return { date: day.key, scheduled, actual };
        });

        const totalScheduled = Number(days.reduce((sum, day) => sum + day.scheduled, 0).toFixed(2));
        const totalActual = Number(days.reduce((sum, day) => sum + day.actual, 0).toFixed(2));
        const cost = Number((totalActual * hourlyRate).toFixed(2));

        return { employeeId, employeeName, hourlyRate, days, totalScheduled, totalActual, cost };
      })
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }, [employees, timesheetAssignments, timesheetSchedules, timesheetWeekDays]);

  const timesheetTotals = useMemo(() => {
    return timesheetRows.reduce(
      (sum, row) => {
        sum.totalScheduled += row.totalScheduled;
        sum.totalActual += row.totalActual;
        sum.totalCost += row.cost;
        return sum;
      },
      { totalScheduled: 0, totalActual: 0, totalCost: 0 },
    );
  }, [timesheetRows]);

  const exportPayrollCsv = useCallback(() => {
    if (timesheetRows.length === 0) return;
    const headers = ['Employee Name', 'Employee ID', 'Date', 'Scheduled Hours', 'Actual Hours', 'Hourly Rate', 'Daily Cost', 'Weekly Total'];
    const lines = [headers.map(quoteCsv).join(',')];
    timesheetRows.forEach((row) => {
      row.days.forEach((day) => {
        const actualHours = day.actual;
        const dailyCost = actualHours * row.hourlyRate;
        lines.push(
          [
            quoteCsv(row.employeeName),
            quoteCsv(row.employeeId),
            quoteCsv(day.date),
            quoteCsv(day.scheduled.toFixed(2)),
            quoteCsv(actualHours.toFixed(2)),
            quoteCsv(row.hourlyRate.toFixed(2)),
            quoteCsv(dailyCost.toFixed(2)),
            quoteCsv(row.totalActual.toFixed(2)),
          ].join(','),
        );
      });
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `payroll-timesheets-${timesheetWeekStart}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [timesheetRows, timesheetWeekStart]);

  const handleApproveAndLock = useCallback(() => {
    toast.success('Timesheet approval coming soon');
  }, []);

  if (!orgId || propertiesQuery.isLoading || employeesQuery.isLoading) {
    return <PageSkeleton />;
  }

  return (
    <div className="main-content p-4 md:p-6 space-y-6">
      <div className="print-header hidden print:block" style={{ marginBottom: '12px' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>Ground Crew HQ - Labor Report</h1>
        <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#4b5563' }}>
          {selectedPropertyName} - {startDate} to {endDate}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b7280' }}>
          Generated: {generatedAt} - Prepared by: {currentUser?.fullName ?? currentUser?.email ?? 'Ground Crew User'}
        </p>
      </div>

      <div className="no-print space-y-3 rounded-xl border border-surface-border bg-surface-card p-4">
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary" onClick={() => applyPreset('this-week')}>This Week</button>
          <button className="rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary" onClick={() => applyPreset('last-week')}>Last Week</button>
          <button className="rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary" onClick={() => applyPreset('this-month')}>This Month</button>
          <button className="rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary" onClick={() => applyPreset('last-month')}>Last Month</button>
        </div>
        <div className="grid gap-[10px] md:grid-cols-3">
          <div style={{ display: 'grid', gap: '4px' }}>
            <label className="text-xs text-text-muted">Start Date</label>
            <input className="h-10 rounded-md border border-surface-border bg-surface-elevated px-3 text-sm text-text-primary" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </div>
          <div style={{ display: 'grid', gap: '4px' }}>
            <label className="text-xs text-text-muted">End Date</label>
            <input className="h-10 rounded-md border border-surface-border bg-surface-elevated px-3 text-sm text-text-primary" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </div>
          <div style={{ display: 'grid', gap: '4px' }}>
            <label className="text-xs text-text-muted">Property</label>
            <select className="h-10 rounded-md border border-surface-border bg-surface-elevated px-3 text-sm text-text-primary" value={selectedPropertyId} onChange={(event) => setSelectedPropertyId(event.target.value)}>
              <option value="all">All Properties</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="no-print flex flex-wrap gap-2 border-b border-surface-border pb-1">
        <button className={`h-9 rounded-lg px-3 text-sm transition-colors ${activeTab === 'summary' ? 'bg-brand-muted font-medium text-brand-primary' : 'text-text-muted hover:bg-surface-hover hover:text-text-primary'}`} onClick={() => setActiveTab('summary')} aria-pressed={activeTab === 'summary'}>
          Summary
        </button>
        <button className={`h-9 rounded-lg px-3 text-sm transition-colors ${activeTab === 'trends' ? 'bg-brand-muted font-medium text-brand-primary' : 'text-text-muted hover:bg-surface-hover hover:text-text-primary'}`} onClick={() => setActiveTab('trends')} aria-pressed={activeTab === 'trends'}>
          Trends
        </button>
        <button className={`h-9 rounded-lg px-3 text-sm transition-colors ${activeTab === 'gm' ? 'bg-brand-muted font-medium text-brand-primary' : 'text-text-muted hover:bg-surface-hover hover:text-text-primary'}`} onClick={() => setActiveTab('gm')} aria-pressed={activeTab === 'gm'}>
          GM Summary
        </button>
        <button className={`h-9 rounded-lg px-3 text-sm transition-colors ${activeTab === 'timesheets' ? 'bg-brand-muted font-medium text-brand-primary' : 'text-text-muted hover:bg-surface-hover hover:text-text-primary'}`} onClick={() => setActiveTab('timesheets')} aria-pressed={activeTab === 'timesheets'}>
          Timesheets
        </button>
        <button
          className="ml-auto h-9 rounded-lg bg-brand-primary px-3 text-sm font-medium text-text-inverse transition-colors hover:bg-brand-hover"
          onClick={() => {
            const printWindow = window.open(fullReportUrl, '_blank', 'noopener,noreferrer');
            if (!printWindow) {
              window.alert('Please allow popups to open the full report.');
            }
          }}
        >
          Generate Full Report
        </button>
      </div>

      {activeTab === 'timesheets' ? (
        <div style={{ display: 'grid', gap: '16px' }}>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Weekly Timesheet Review</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => {
                    const next = addDays(new Date(`${timesheetWeekStart}T00:00:00`), -7);
                    setTimesheetWeekStart(toIsoDate(startOfWeek(next)));
                  }}
                >
                  ‹
                </button>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>
                  {timesheetWeekDays[0]?.key} to {timesheetWeekDays[6]?.key}
                </span>
                <button
                  onClick={() => {
                    const next = addDays(new Date(`${timesheetWeekStart}T00:00:00`), 7);
                    setTimesheetWeekStart(toIsoDate(startOfWeek(next)));
                  }}
                >
                  ›
                </button>
              </div>
            </div>

            {timesheetLoading ? (
              <TableSkeleton />
            ) : timesheetError ? (
              <ErrorRetry message={timesheetError} onRetry={() => void fetchTimesheetData()} />
            ) : timesheetRows.length === 0 ? (
              <EmptyState icon={BarChart3} title="No timesheet data for this week" description="Schedule crew and track actual hours to review payroll." />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: '1180px', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left', color: '#6b7280' }}>
                      <th style={{ padding: '8px' }}>Employee</th>
                      {timesheetWeekDays.map((day) => (
                        <th key={`timesheet-day-${day.key}`} style={{ padding: '8px' }}>{day.label}</th>
                      ))}
                      <th style={{ padding: '8px' }}>Total Scheduled</th>
                      <th style={{ padding: '8px' }}>Total Actual</th>
                      <th style={{ padding: '8px' }}>Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timesheetRows.map((row) => (
                      <tr key={`timesheet-row-${row.employeeId}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px' }}>{row.employeeName}</td>
                        {row.days.map((day) => {
                          const hasActual = day.actual > 0;
                          return (
                            <td key={`timesheet-cell-${row.employeeId}-${day.date}`} style={{ padding: '8px' }}>
                              {hasActual ? (
                                <span>{day.scheduled.toFixed(1)} / {day.actual.toFixed(1)}</span>
                              ) : (
                                <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>{day.scheduled.toFixed(1)}</span>
                              )}
                            </td>
                          );
                        })}
                        <td style={{ padding: '8px' }}>{row.totalScheduled.toFixed(1)}h</td>
                        <td style={{ padding: '8px' }}>{row.totalActual.toFixed(1)}h</td>
                        <td style={{ padding: '8px' }}>{formatCurrency(row.cost)}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: '2px solid #e5e7eb', fontWeight: 700 }}>
                      <td style={{ padding: '8px' }}>Totals</td>
                      {timesheetWeekDays.map((day) => {
                        const dayTotal = timesheetRows.reduce((sum, row) => {
                          const cell = row.days.find((entry) => entry.date === day.key);
                          if (!cell) return sum;
                          return sum + cell.actual;
                        }, 0);
                        return (
                          <td key={`timesheet-total-${day.key}`} style={{ padding: '8px' }}>{dayTotal.toFixed(1)}h</td>
                        );
                      })}
                      <td style={{ padding: '8px' }}>{timesheetTotals.totalScheduled.toFixed(1)}h</td>
                      <td style={{ padding: '8px' }}>{timesheetTotals.totalActual.toFixed(1)}h</td>
                      <td style={{ padding: '8px' }}>{formatCurrency(timesheetTotals.totalCost)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="no-print" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button onClick={exportPayrollCsv} disabled={timesheetLoading || Boolean(timesheetError) || timesheetRows.length === 0}>
              Export for Payroll
            </button>
            <button onClick={handleApproveAndLock}>Approve &amp; Lock</button>
          </div>
        </div>
      ) : (activeTab === 'summary' || isFullReportView) ? (
      <>
      {isFullReportView ? (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#22c55e', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700 }}>GC</div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>{organizationName} - Operations Report</h2>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b7280' }}>
                {startDate} to {endDate} · Prepared by {currentUser?.fullName ?? currentUser?.email ?? 'Ground Crew User'} · Generated {generatedAt}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {isFullReportView ? (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 600 }}>Executive Summary</h3>
          <div className="grid gap-[8px] md:grid-cols-3">
            <div>Total scheduled hours: <strong>{formatHours(totals.scheduledHours)}</strong></div>
            <div>Total actual hours: <strong>{formatHours(totals.actualHours)}</strong></div>
            <div>Variance: <strong>{formatHours(totals.variance)}</strong></div>
            <div>Total labor cost: <strong>{formatCurrency(totals.actualCost)}</strong></div>
            <div>Tasks completed: <strong>{totals.tasksCompleted}</strong></div>
            <div>Completion rate: <strong>{completionRate}%</strong></div>
            <div>Efficiency score: <strong>{efficiencyScore}</strong> ({efficiencyLabel})</div>
          </div>
        </div>
      ) : null}

      <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Labor Summary</h3>
          <div className="no-print" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={exportCsv} disabled={loading || Boolean(error) || laborRows.length === 0}>
              Export CSV
            </button>
            <button onClick={() => window.print()} disabled={loading || Boolean(error)}>
              Print
            </button>
          </div>
        </div>

        {showTimeout && !hasLaborResult ? (
          <div className="flex flex-col items-center justify-center p-12 text-center gap-3">
            <p className="text-sm font-medium">
              Data is taking longer than expected
            </p>
            <p className="text-xs text-muted-foreground">
              Try refreshing the page or selecting a shorter date range.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 rounded-lg border px-4 py-2 text-sm hover:bg-muted transition-colors"
            >
              Refresh page
            </button>
          </div>
        ) : loading ? (
          <TableSkeleton />
        ) : error ? (
          <ErrorRetry message={error} onRetry={() => void fetchReportData()} />
        ) : laborRows.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <p className="text-sm font-medium">No labor data for this period</p>
            <p className="text-xs text-muted-foreground mt-1">
              Reports populate once crew members clock in using the Field page.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: '920px', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left', color: '#6b7280' }}>
                  <th style={{ padding: '8px' }}>Employee</th>
                  <th style={{ padding: '8px' }}>Days Worked</th>
                  <th style={{ padding: '8px' }}>Scheduled Hours</th>
                  <th style={{ padding: '8px' }}>Actual Hours</th>
                  <th style={{ padding: '8px' }}>Tasks Completed</th>
                  <th style={{ padding: '8px' }}>Variance</th>
                  <th style={{ padding: '8px' }}>Scheduled Cost</th>
                  <th style={{ padding: '8px' }}>Actual Cost</th>
                  <th style={{ padding: '8px' }}>Variance ($)</th>
                </tr>
              </thead>
              <tbody>
                {laborRows.map((row) => (
                  <tr key={row.employeeId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px' }}>{row.employeeName}</td>
                    <td style={{ padding: '8px' }}>{row.daysWorked}</td>
                    <td style={{ padding: '8px' }}>{formatHours(row.scheduledHours)}</td>
                    <td style={{ padding: '8px' }}>{formatHours(row.actualHours)}</td>
                    <td style={{ padding: '8px' }}>{row.tasksCompleted}</td>
                    <td style={{ padding: '8px', color: row.variance <= 0 ? '#166534' : '#dc2626', fontWeight: 600 }}>
                      {row.variance >= 0 ? '+' : ''}
                      {formatHours(row.variance)}
                    </td>
                    <td style={{ padding: '8px' }}>{formatCurrency(row.scheduledCost)}</td>
                    <td style={{ padding: '8px' }}>{formatCurrency(row.actualCost)}</td>
                    <td style={{ padding: '8px', color: row.varianceCost <= 0 ? '#166534' : '#dc2626', fontWeight: 600 }}>
                      {row.varianceCost >= 0 ? '+' : ''}
                      {formatCurrency(row.varianceCost)}
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid #e5e7eb', fontWeight: 700 }}>
                  <td style={{ padding: '8px' }}>Totals</td>
                  <td style={{ padding: '8px' }}>{totals.daysWorked}</td>
                  <td style={{ padding: '8px' }}>{formatHours(totals.scheduledHours)}</td>
                  <td style={{ padding: '8px' }}>{formatHours(totals.actualHours)}</td>
                  <td style={{ padding: '8px' }}>{totals.tasksCompleted}</td>
                  <td style={{ padding: '8px', color: totals.variance <= 0 ? '#166534' : '#dc2626' }}>
                    {totals.variance >= 0 ? '+' : ''}
                    {formatHours(totals.variance)}
                  </td>
                  <td style={{ padding: '8px' }}>{formatCurrency(totals.scheduledCost)}</td>
                  <td style={{ padding: '8px' }}>{formatCurrency(totals.actualCost)}</td>
                  <td style={{ padding: '8px', color: totals.varianceCost <= 0 ? '#166534' : '#dc2626' }}>
                    {totals.varianceCost >= 0 ? '+' : ''}
                    {formatCurrency(totals.varianceCost)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 600 }}>Cost by Task</h3>
        {loading ? (
          <TableSkeleton />
        ) : error ? (
          <ErrorRetry message={error} onRetry={() => void fetchReportData()} />
        ) : costByTaskRows.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="No report data available"
            description="Schedule shifts and assign tasks to generate labor reports."
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: '720px', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left', color: '#6b7280' }}>
                  <th style={{ padding: '8px' }}>Task Category</th>
                  <th style={{ padding: '8px' }}>Tasks Completed</th>
                  <th style={{ padding: '8px' }}>Total Hours</th>
                  <th style={{ padding: '8px' }}>Total Cost</th>
                  <th style={{ padding: '8px' }}>Avg Cost/Task</th>
                </tr>
              </thead>
              <tbody>
                {costByTaskRows.map((row) => (
                  <tr key={row.category} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px' }}>{row.category}</td>
                    <td style={{ padding: '8px' }}>{row.tasksCompleted}</td>
                    <td style={{ padding: '8px' }}>{formatHours(row.totalHours)}</td>
                    <td style={{ padding: '8px' }}>{formatCurrency(row.totalCost)}</td>
                    <td style={{ padding: '8px' }}>{formatCurrency(row.avgCostPerTask)}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid #e5e7eb', fontWeight: 700 }}>
                  <td style={{ padding: '8px' }}>Totals</td>
                  <td style={{ padding: '8px' }}>{costByTaskTotals.tasksCompleted}</td>
                  <td style={{ padding: '8px' }}>{formatHours(costByTaskTotals.totalHours)}</td>
                  <td style={{ padding: '8px' }}>{formatCurrency(costByTaskTotals.totalCost)}</td>
                  <td style={{ padding: '8px' }}>
                    {formatCurrency(costByTaskTotals.tasksCompleted > 0 ? costByTaskTotals.totalCost / costByTaskTotals.tasksCompleted : 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      ) : activeTab === 'gm' ? (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', display: 'grid', gap: '14px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>GROUND CREW HQ — EXECUTIVE SUMMARY</h3>
            <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '13px' }}>{selectedPropertyName} · {startDate} to {endDate}</p>
          </div>
          <div className="grid gap-[8px] md:grid-cols-2">
            <div>Total Labor Hours: <strong>{gmSummary.totalLaborHours}</strong></div>
            <div>Total Labor Cost: <strong>{gmSummary.totalLaborCost}</strong></div>
            <div>Task Completion Rate: <strong>{gmSummary.completionRate}%</strong></div>
            <div>Average Crew Coverage: <strong>{gmSummary.avgCrewCoverage}%</strong></div>
            <div>Equipment Health: <strong>{gmSummary.equipmentUptime}% uptime</strong></div>
          </div>
          <div>
            <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 600 }}>Top 5 Tasks by Hours</h4>
            <ol style={{ margin: 0, paddingLeft: '20px' }}>
              {gmSummary.topFive.map((row) => (
                <li key={`top-task-${row.name}`} style={{ marginBottom: '4px' }}>
                  {row.name} — {formatHours(row.hours)}h total
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 600 }}>Recommendations</h4>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              {gmSummary.recommendations.map((recommendation) => (
                <li key={recommendation} style={{ marginBottom: '4px' }}>{recommendation}</li>
              ))}
            </ul>
          </div>
          <div className="no-print">
            <button onClick={() => window.print()}>Print GM Summary</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
            <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Monthly Comparison (Last 6 Months)</h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>YTD Cost: <strong>{formatCurrency(ytdCost)}</strong></span>
                <button onClick={exportTrendsCsv} disabled={loading || Boolean(error) || trendChartData.length === 0}>
                  Export Trends
                </button>
              </div>
            </div>
            {loading ? (
              <TableSkeleton />
            ) : error ? (
              <ErrorRetry message={error} onRetry={() => void fetchReportData()} />
            ) : trendChartData.every((row) => row.totalTasks === 0) ? (
              <EmptyState
                icon={BarChart3}
                title="No trend data available"
                description="Complete tasks over multiple months to view comparison trends."
              />
            ) : (
              <div style={{ width: '100%', height: '320px' }}>
                <Suspense fallback={<TableSkeleton />}>
                  <RechartsResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={trendChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <RechartsCartesianGrid strokeDasharray="3 3" />
                      <RechartsXAxis dataKey="label" />
                      <RechartsYAxis yAxisId="hours" />
                      <RechartsYAxis yAxisId="rate" orientation="right" domain={[0, 100]} />
                      <RechartsTooltip />
                      <RechartsBar yAxisId="hours" dataKey="scheduledHours" fill="#3b82f6" name="Scheduled Hours" />
                      <RechartsBar yAxisId="hours" dataKey="actualHours" fill="#16a34a" name="Actual Hours" />
                      <RechartsLine yAxisId="rate" type="monotone" dataKey="completionRate" stroke="#0f172a" strokeWidth={2} name="Completion %" />
                    </RechartsBarChart>
                  </RechartsResponsiveContainer>
                </Suspense>
              </div>
            )}
          </div>

          <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 600 }}>Monthly Labor Cost Trend</h3>
            {loading ? (
              <TableSkeleton />
            ) : error ? (
              <ErrorRetry message={error} onRetry={() => void fetchReportData()} />
            ) : trendChartData.every((row) => row.laborCost === 0) ? (
              <EmptyState
                icon={BarChart3}
                title="No cost trend data"
                description="Set hourly rates and track actual hours to populate labor cost trends."
              />
            ) : (
              <div style={{ width: '100%', height: '300px' }}>
                <Suspense fallback={<TableSkeleton />}>
                  <RechartsResponsiveContainer width="100%" height="100%">
                    <RechartsLineChart data={trendChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <RechartsCartesianGrid strokeDasharray="3 3" />
                      <RechartsXAxis dataKey="label" />
                      <RechartsYAxis />
                      <RechartsTooltip formatter={(value: number) => formatCurrency(Number(value))} />
                      <RechartsLine type="monotone" dataKey="laborCost" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 3 }} />
                    </RechartsLineChart>
                  </RechartsResponsiveContainer>
                </Suspense>
              </div>
            )}
          </div>

          <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 600 }}>Crew Utilization (Avg Weekly Hours - Last 4 Weeks)</h3>
            {loading ? (
              <TableSkeleton />
            ) : error ? (
              <ErrorRetry message={error} onRetry={() => void fetchReportData()} />
            ) : crewUtilizationData.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="No utilization data available"
                description="Schedule shifts and record task hours to visualize crew utilization."
              />
            ) : (
              <div style={{ width: '100%', height: '320px' }}>
                <Suspense fallback={<TableSkeleton />}>
                  <RechartsResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={crewUtilizationData} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
                      <RechartsCartesianGrid strokeDasharray="3 3" />
                      <RechartsXAxis dataKey="name" interval={0} angle={-28} textAnchor="end" height={70} />
                      <RechartsYAxis />
                      <RechartsTooltip formatter={(value: number) => `${value}h`} />
                      <RechartsBar dataKey="averageHours">
                        {crewUtilizationData.map((row) => (
                          <RechartsCell key={`util-${row.name}`} fill={row.fill} />
                        ))}
                      </RechartsBar>
                    </RechartsBarChart>
                  </RechartsResponsiveContainer>
                </Suspense>
              </div>
            )}
          </div>

          <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 600 }}>Month-over-Month Deltas</h3>
            {loading ? (
              <TableSkeleton />
            ) : error ? (
              <ErrorRetry message={error} onRetry={() => void fetchReportData()} />
            ) : monthOverMonthDeltas.length === 0 ? (
              <EmptyState icon={BarChart3} title="No monthly comparison data" description="Track assignments over multiple months to compare deltas." />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: '620px', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left', color: '#6b7280' }}>
                      <th style={{ padding: '8px' }}>Month</th>
                      <th style={{ padding: '8px' }}>Δ Scheduled Hrs</th>
                      <th style={{ padding: '8px' }}>Δ Actual Hrs</th>
                      <th style={{ padding: '8px' }}>Δ Cost</th>
                      <th style={{ padding: '8px' }}>Completion %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthOverMonthDeltas.map((row) => (
                      <tr key={`delta-${row.month}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px' }}>{row.label}</td>
                        <td style={{ padding: '8px' }}>{row.deltaScheduled >= 0 ? '+' : ''}{row.deltaScheduled}</td>
                        <td style={{ padding: '8px' }}>{row.deltaActual >= 0 ? '+' : ''}{row.deltaActual}</td>
                        <td style={{ padding: '8px' }}>{row.deltaCost >= 0 ? '+' : ''}{formatCurrency(row.deltaCost)}</td>
                        <td style={{ padding: '8px' }}>{row.completionRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {isFullReportView ? (
        <div style={{ display: 'grid', gap: '16px' }}>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 600 }}>Trend Charts</h3>
            {loading ? (
              <TableSkeleton />
            ) : error ? (
              <ErrorRetry message={error} onRetry={() => void fetchReportData()} />
            ) : (
              <div style={{ display: 'grid', gap: '18px' }}>
                <div style={{ width: '100%', height: '250px' }}>
                  <Suspense fallback={<TableSkeleton />}>
                    <RechartsResponsiveContainer width="100%" height="100%">
                      <RechartsLineChart data={trendChartData}>
                        <RechartsCartesianGrid strokeDasharray="3 3" />
                        <RechartsXAxis dataKey="label" />
                        <RechartsYAxis domain={[0, 100]} />
                        <RechartsTooltip formatter={(value: number) => `${value}%`} />
                        <RechartsLine type="monotone" dataKey="completionRate" stroke="#16a34a" strokeWidth={2.5} dot={{ r: 3 }} />
                      </RechartsLineChart>
                    </RechartsResponsiveContainer>
                  </Suspense>
                </div>
                <div style={{ width: '100%', height: '250px' }}>
                  <Suspense fallback={<TableSkeleton />}>
                    <RechartsResponsiveContainer width="100%" height="100%">
                      <RechartsAreaChart data={trendChartData}>
                        <RechartsCartesianGrid strokeDasharray="3 3" />
                        <RechartsXAxis dataKey="label" />
                        <RechartsYAxis />
                        <RechartsTooltip formatter={(value: number) => `${value}h`} />
                        <RechartsArea type="monotone" dataKey="scheduledHours" stroke="#3b82f6" fill="#bfdbfe" />
                        <RechartsArea type="monotone" dataKey="actualHours" stroke="#16a34a" fill="#bbf7d0" />
                      </RechartsAreaChart>
                    </RechartsResponsiveContainer>
                  </Suspense>
                </div>
                <div style={{ width: '100%', height: '260px' }}>
                  <Suspense fallback={<TableSkeleton />}>
                    <RechartsResponsiveContainer width="100%" height="100%">
                      <RechartsBarChart data={crewUtilizationData} margin={{ bottom: 60 }}>
                        <RechartsCartesianGrid strokeDasharray="3 3" />
                        <RechartsXAxis dataKey="name" interval={0} angle={-24} textAnchor="end" height={70} />
                        <RechartsYAxis />
                        <RechartsTooltip formatter={(value: number) => `${value}h`} />
                        <RechartsBar dataKey="averageHours">
                          {crewUtilizationData.map((row) => (
                            <RechartsCell key={`util-full-${row.name}`} fill={row.fill} />
                          ))}
                        </RechartsBar>
                      </RechartsBarChart>
                    </RechartsResponsiveContainer>
                  </Suspense>
                </div>
              </div>
            )}
          </div>

          <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 600 }}>Equipment Status Summary</h3>
            {loading ? (
              <TableSkeleton />
            ) : equipmentRows.length === 0 ? (
              <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>No equipment records found for this scope.</p>
            ) : (
              <div style={{ display: 'grid', gap: '8px' }}>
                <p style={{ margin: 0, fontSize: '13px' }}>
                  Total units: <strong>{equipmentRows.length}</strong> · Overdue for service: <strong>{overdueEquipmentRows.length}</strong>
                </p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left', color: '#6b7280' }}>
                      <th style={{ padding: '8px' }}>Equipment</th>
                      <th style={{ padding: '8px' }}>Status</th>
                      <th style={{ padding: '8px' }}>Last Serviced</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipmentRows.slice(0, 15).map((row) => (
                      <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px' }}>{row.unit_name || row.name || 'Equipment'}</td>
                        <td style={{ padding: '8px' }}>{row.status ?? 'unknown'}</td>
                        <td style={{ padding: '8px' }}>{row.last_serviced ?? 'Not set'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}

      <div className="print-footer hidden print:block">
        Ground Crew HQ - ground-crew-hq.vercel.app - Confidential
      </div>
    </div>
  );
}


