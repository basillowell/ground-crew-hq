import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageSkeleton } from '@/components/PageSkeleton';
import { ErrorRetry } from '@/components/ErrorRetry';
import { EmptyState } from '@/components/EmptyState';
import { TableSkeleton } from '@/components/TableSkeleton';
import { BarChart3 } from 'lucide-react';

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
  const { orgId, currentPropertyId, currentUser } = useAuth();
  const [startDate, setStartDate] = useState<string>(() => toIsoDate(startOfWeek(new Date())));
  const [endDate, setEndDate] = useState<string>(() => toIsoDate(endOfWeek(new Date())));
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(
    currentPropertyId && currentPropertyId !== 'all' ? currentPropertyId : 'all',
  );
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

    const [assignmentsResult, employeesResult, propertiesResult, tasksResult] = await Promise.all([
      assignmentsQuery,
      supabase.from('employees').select('id, first_name, last_name, hourly_rate').eq('org_id', orgId),
      supabase.from('properties').select('id, name').eq('org_id', orgId).order('name', { ascending: true }),
      supabase.from('tasks').select('id, category').eq('org_id', orgId),
    ]);

    if (assignmentsResult.error || employeesResult.error || propertiesResult.error || tasksResult.error) {
      setError(
        assignmentsResult.error?.message ??
          employeesResult.error?.message ??
          propertiesResult.error?.message ??
          tasksResult.error?.message ??
          'Unable to load report data',
      );
      setLoading(false);
      return;
    }

    setAssignments((assignmentsResult.data ?? []) as AssignmentRow[]);
    setEmployees((employeesResult.data ?? []) as EmployeeRow[]);
    setProperties((propertiesResult.data ?? []) as PropertyRow[]);
    setTasks((tasksResult.data ?? []) as TaskRow[]);
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
        <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 600 }}>Reports</h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}>Labor summary by employee for the selected period.</p>
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

      <div className="print-footer hidden print:block">
        Ground Crew HQ - ground-crew-hq.vercel.app - Confidential
      </div>
    </div>
  );
}
