import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useSearchParams } from 'react-router-dom';
import { PageSkeleton } from '@/components/PageSkeleton';
import { ErrorRetry } from '@/components/ErrorRetry';
import { EmptyState } from '@/components/EmptyState';
import { TableSkeleton } from '@/components/TableSkeleton';
import { BarChart3 } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

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
  category: string | null;
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

export default function ReportsPage() {
  const [searchParams] = useSearchParams();
  const isFullReportView = searchParams.get('fullReport') === '1';
  const queryStartDate = searchParams.get('start');
  const queryEndDate = searchParams.get('end');
  const queryPropertyId = searchParams.get('property');
  const { orgId, currentPropertyId, currentUser } = useAuth();
  const [startDate, setStartDate] = useState<string>(() => queryStartDate || toIsoDate(startOfWeek(new Date())));
  const [endDate, setEndDate] = useState<string>(() => queryEndDate || toIsoDate(endOfWeek(new Date())));
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(
    queryPropertyId || (currentPropertyId && currentPropertyId !== 'all' ? currentPropertyId : 'all'),
  );
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'trends'>('summary');
  const [trendAssignments, setTrendAssignments] = useState<AssignmentRow[]>([]);
  const [trendScheduleEntries, setTrendScheduleEntries] = useState<ScheduleEntryTrendRow[]>([]);
  const [equipmentRows, setEquipmentRows] = useState<EquipmentRow[]>([]);
  const [openNeedsCount, setOpenNeedsCount] = useState(0);
  const [organizationName, setOrganizationName] = useState('Ground Crew HQ');

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

    const now = new Date();
    const trendStart = startOfWeek(new Date(now));
    trendStart.setDate(trendStart.getDate() - 7 * 7);
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

    const [assignmentsResult, employeesResult, propertiesResult, tasksResult, trendAssignmentsResult, trendScheduleEntriesResult] = await Promise.all([
      assignmentsQuery,
      supabase.from('employees').select('id, first_name, last_name, hourly_rate').eq('org_id', orgId),
      supabase.from('properties').select('id, name').eq('org_id', orgId).order('name', { ascending: true }),
      supabase.from('tasks').select('id, category').eq('org_id', orgId),
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

    const [equipmentResult, openNeedsResult, organizationResult] = await Promise.all([
      equipmentQuery,
      openNeedsQuery,
      supabase.from('organizations').select('name').eq('id', orgId).maybeSingle(),
    ]);

    if (
      assignmentsResult.error ||
      employeesResult.error ||
      propertiesResult.error ||
      tasksResult.error ||
      trendAssignmentsResult.error ||
      trendScheduleEntriesResult.error ||
      equipmentResult.error ||
      openNeedsResult.error ||
      organizationResult.error
    ) {
      setError(
        assignmentsResult.error?.message ??
          employeesResult.error?.message ??
          propertiesResult.error?.message ??
          tasksResult.error?.message ??
          trendAssignmentsResult.error?.message ??
          trendScheduleEntriesResult.error?.message ??
          equipmentResult.error?.message ??
          openNeedsResult.error?.message ??
          organizationResult.error?.message ??
          'Unable to load report data',
      );
      setLoading(false);
      return;
    }

    setAssignments((assignmentsResult.data ?? []) as AssignmentRow[]);
    setEmployees((employeesResult.data ?? []) as EmployeeRow[]);
    setProperties((propertiesResult.data ?? []) as PropertyRow[]);
    setTasks((tasksResult.data ?? []) as TaskRow[]);
    setTrendAssignments((trendAssignmentsResult.data ?? []) as AssignmentRow[]);
    setTrendScheduleEntries((trendScheduleEntriesResult.data ?? []) as ScheduleEntryTrendRow[]);
    setEquipmentRows((equipmentResult.data ?? []) as EquipmentRow[]);
    setOpenNeedsCount(openNeedsResult.count ?? 0);
    setOrganizationName(organizationResult.data?.name ?? 'Ground Crew HQ');
    setLoading(false);
  }, [endDate, orgId, selectedPropertyId, startDate]);

  useEffect(() => {
    if (!orgId) return;
    void fetchReportData();
  }, [fetchReportData, orgId]);

  const laborRows = useMemo<LaborSummaryRow[]>(() => {
    const byEmployee = new Map<string, LaborSummaryRow>();
    const employeeById = new Map(employees.map((employee) => [employee.id, employee]));

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

    byEmployee.forEach((row) => {
      const workedDays = new Set(
        assignments.filter((assignment) => assignment.employee_id === row.employeeId).map((assignment) => assignment.date),
      );
      row.daysWorked = workedDays.size;
      row.variance = row.actualHours - row.scheduledHours;
      row.varianceCost = row.actualCost - row.scheduledCost;
    });

    return Array.from(byEmployee.values()).sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }, [assignments, employees]);

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
    const start = startOfWeek(new Date());
    start.setDate(start.getDate() - 7 * 7);
    const weekKeys = Array.from({ length: 8 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index * 7);
      return toIsoDate(date);
    });

    const byWeek = new Map(
      weekKeys.map((week) => [
        week,
        {
          week,
          label: new Date(`${week}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          totalTasks: 0,
          doneTasks: 0,
          completionRate: 0,
          scheduledHours: 0,
          actualHours: 0,
        },
      ]),
    );

    const weekForDate = (dateText: string) => {
      const date = new Date(`${dateText}T00:00:00`);
      const weekStart = startOfWeek(date);
      return toIsoDate(weekStart);
    };

    trendAssignments.forEach((assignment) => {
      const week = weekForDate(assignment.date);
      const bucket = byWeek.get(week);
      if (!bucket) return;
      bucket.totalTasks += 1;
      if ((assignment.status ?? '').toLowerCase() === 'done') bucket.doneTasks += 1;
      bucket.scheduledHours += Number(assignment.estimated_hours ?? 0);
      bucket.actualHours += Number(assignment.actual_hours ?? 0);
    });

    return Array.from(byWeek.values()).map((row) => ({
      ...row,
      completionRate: row.totalTasks > 0 ? Number(((row.doneTasks / row.totalTasks) * 100).toFixed(1)) : 0,
      scheduledHours: Number(row.scheduledHours.toFixed(1)),
      actualHours: Number(row.actualHours.toFixed(1)),
    }));
  }, [trendAssignments]);

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

  useEffect(() => {
    if (!isFullReportView || loading || error) return;
    const timeoutId = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(timeoutId);
  }, [error, isFullReportView, loading]);

  if (!orgId) {
    return <PageSkeleton />;
  }

  return (
    <div className="main-content" style={{ padding: '1rem', display: 'grid', gap: '16px' }}>
      <div className="print-header hidden print:block" style={{ marginBottom: '12px' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>Ground Crew HQ - Labor Report</h1>
        <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#4b5563' }}>
          {selectedPropertyName} - {startDate} to {endDate}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b7280' }}>
          Generated: {generatedAt} - Prepared by: {currentUser?.fullName ?? currentUser?.email ?? 'Ground Crew User'}
        </p>
      </div>

      <div>
        <h1 className="text-lg font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Labor summaries and cost analysis.</p>
      </div>

      <div className="no-print" style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', display: 'grid', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => applyPreset('this-week')}>This Week</button>
          <button onClick={() => applyPreset('last-week')}>Last Week</button>
          <button onClick={() => applyPreset('this-month')}>This Month</button>
          <button onClick={() => applyPreset('last-month')}>Last Month</button>
        </div>
        <div className="grid gap-[10px] md:grid-cols-3">
          <div style={{ display: 'grid', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: '#6b7280' }}>Start Date</label>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </div>
          <div style={{ display: 'grid', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: '#6b7280' }}>End Date</label>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </div>
          <div style={{ display: 'grid', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: '#6b7280' }}>Property</label>
            <select value={selectedPropertyId} onChange={(event) => setSelectedPropertyId(event.target.value)}>
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

      <div className="no-print" style={{ display: 'flex', gap: '8px' }}>
        <button onClick={() => setActiveTab('summary')} aria-pressed={activeTab === 'summary'}>
          Summary
        </button>
        <button onClick={() => setActiveTab('trends')} aria-pressed={activeTab === 'trends'}>
          Trends
        </button>
        <button
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

      {(activeTab === 'summary' || isFullReportView) ? (
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

        {loading ? (
          <TableSkeleton />
        ) : error ? (
          <ErrorRetry message={error} onRetry={() => void fetchReportData()} />
        ) : laborRows.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="No report data available"
            description="Schedule shifts and assign tasks to generate labor reports."
          />
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
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 600 }}>Task Completion Rate (Last 8 Weeks)</h3>
            {loading ? (
              <TableSkeleton />
            ) : error ? (
              <ErrorRetry message={error} onRetry={() => void fetchReportData()} />
            ) : trendChartData.every((row) => row.totalTasks === 0) ? (
              <EmptyState
                icon={BarChart3}
                title="No trend data available"
                description="Complete tasks over multiple weeks to view completion trends."
              />
            ) : (
              <div style={{ width: '100%', height: '280px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip formatter={(value: number) => `${value}%`} />
                    <Line type="monotone" dataKey="completionRate" stroke="#16a34a" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 600 }}>Labor Hours Trend (Last 8 Weeks)</h3>
            {loading ? (
              <TableSkeleton />
            ) : error ? (
              <ErrorRetry message={error} onRetry={() => void fetchReportData()} />
            ) : trendChartData.every((row) => row.scheduledHours === 0 && row.actualHours === 0) ? (
              <EmptyState
                icon={BarChart3}
                title="No labor trend data"
                description="Assign tasks with estimated and actual hours to populate labor trends."
              />
            ) : (
              <div style={{ width: '100%', height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="scheduledFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#16a34a" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="#16a34a" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => `${value}h`} />
                    <Area type="monotone" dataKey="scheduledHours" stroke="#3b82f6" fill="url(#scheduledFill)" />
                    <Area type="monotone" dataKey="actualHours" stroke="#16a34a" fill="url(#actualFill)" />
                  </AreaChart>
                </ResponsiveContainer>
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
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={crewUtilizationData} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" interval={0} angle={-28} textAnchor="end" height={70} />
                    <YAxis />
                    <Tooltip formatter={(value: number) => `${value}h`} />
                    <Bar dataKey="averageHours">
                      {crewUtilizationData.map((row) => (
                        <Cell key={`util-${row.name}`} fill={row.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
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
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip formatter={(value: number) => `${value}%`} />
                      <Line type="monotone" dataKey="completionRate" stroke="#16a34a" strokeWidth={2.5} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ width: '100%', height: '250px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis />
                      <Tooltip formatter={(value: number) => `${value}h`} />
                      <Area type="monotone" dataKey="scheduledHours" stroke="#3b82f6" fill="#bfdbfe" />
                      <Area type="monotone" dataKey="actualHours" stroke="#16a34a" fill="#bbf7d0" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ width: '100%', height: '260px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={crewUtilizationData} margin={{ bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" interval={0} angle={-24} textAnchor="end" height={70} />
                      <YAxis />
                      <Tooltip formatter={(value: number) => `${value}h`} />
                      <Bar dataKey="averageHours">
                        {crewUtilizationData.map((row) => (
                          <Cell key={`util-full-${row.name}`} fill={row.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
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
