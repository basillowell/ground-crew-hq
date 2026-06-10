import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/appStore';
import { PageSkeleton } from '@/components/PageSkeleton';
import { ErrorRetry } from '@/components/ErrorRetry';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';

// columns from docs/dev/live-db-state.md — assignments
interface CompletedAssignment {
  id: string;
  employee_id: string;
  property_id: string;
  task_id: string | null;
  actual_hours: number | null;
  estimated_hours: number | null;
  date: string;
}

interface TaskRow {
  id: string;
  name: string;
  category: string;
  estimated_hours: number | null;
}

type SortKey = 'property' | 'task' | 'employee' | 'estimated_hours' | 'actual_hours' | 'margin';

export default function JobCostingPage() {
  const { orgId } = useAuth();
  const isHydrated = useAppStore((s) => s.isHydrated);
  const employees = useAppStore((s) => s.employees);
  const properties = useAppStore((s) => s.properties);

  const [assignments, setAssignments] = useState<CompletedAssignment[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('actual_hours');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    document.title = 'Job Costing — Ground Crew HQ';
  }, []);

  const fetchData = useCallback(async () => {
    if (!orgId || !isHydrated) return;
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(() => setError('Request timed out after 8 seconds.'), 8000);
    try {
      // Rule 5: two separate queries, joined in TypeScript
      const [aResult, tResult] = await Promise.all([
        supabase
          .from('assignments')
          .select('id, employee_id, property_id, task_id, actual_hours, estimated_hours, date')
          .eq('org_id', orgId)
          .eq('status', 'completed'),
        supabase
          .from('tasks')
          .select('id, name, category, estimated_hours')
          .eq('org_id', orgId),
      ]);
      if (aResult.error) throw aResult.error;
      if (tResult.error) throw tResult.error;
      setAssignments(aResult.data ?? []);
      setTasks(tResult.data ?? []);
    } catch (e) {
      setError((e as Error).message || 'Failed to load job costing data');
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }, [orgId, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    void fetchData();
  }, [fetchData, isHydrated]);

  const rows = useMemo(() => {
    return assignments.map((a) => {
      const task = tasks.find((t) => t.id === a.task_id);
      const employee = employees.find((e) => e.id === a.employee_id);
      const property = properties.find((p) => p.id === a.property_id);
      const actualHours = a.actual_hours ?? 0;
      const estimatedHours = a.estimated_hours ?? task?.estimated_hours ?? 0;
      const hourlyRate = employee?.hourly_rate ?? null;
      const laborCost = hourlyRate !== null ? actualHours * hourlyRate : null;
      const revenue = hourlyRate !== null && estimatedHours > 0 ? estimatedHours * hourlyRate : null;
      const grossMargin =
        laborCost !== null && revenue !== null && revenue > 0
          ? ((revenue - laborCost) / revenue) * 100
          : null;

      return {
        id: a.id,
        date: a.date,
        propertyName: property?.name ?? 'Unknown',
        taskName: task?.name ?? 'Unknown',
        taskCategory: task?.category ?? 'General',
        employeeName: employee
          ? `${employee.first_name} ${employee.last_name}`
          : 'Unknown',
        estimatedHours,
        actualHours,
        laborCost,
        grossMargin,
      };
    });
  }, [assignments, tasks, employees, properties]);

  const monthlyTrend = useMemo(() => {
    const byMonth: Record<string, number> = {};
    assignments.forEach((a) => {
      const month = a.date?.slice(0, 7);
      if (!month) return;
      byMonth[month] = (byMonth[month] ?? 0) + (a.actual_hours ?? 0);
    });
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, hours]) => ({ month, hours: Math.round(hours * 10) / 10 }));
  }, [assignments]);

  const summary = useMemo(() => {
    const withMargin = rows.filter((r) => r.grossMargin !== null);
    if (withMargin.length === 0) return null;
    const avgMargin =
      withMargin.reduce((sum, r) => sum + (r.grossMargin ?? 0), 0) / withMargin.length;
    const best = withMargin.reduce(
      (b, r) => ((r.grossMargin ?? -Infinity) > (b.grossMargin ?? -Infinity) ? r : b),
      withMargin[0],
    );
    const worst = withMargin.reduce(
      (w, r) => ((r.grossMargin ?? Infinity) < (w.grossMargin ?? Infinity) ? r : w),
      withMargin[0],
    );
    return { avgMargin, bestTask: best.taskName, worstTask: worst.taskName };
  }, [rows]);

  const marginClass = (margin: number | null) => {
    if (margin === null) return 'text-text-muted';
    if (margin > 40) return 'text-status-active';
    if (margin > 20) return 'text-status-pending';
    return 'text-status-warning';
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;
      if (sortKey === 'property') { aVal = a.propertyName; bVal = b.propertyName; }
      else if (sortKey === 'task') { aVal = a.taskName; bVal = b.taskName; }
      else if (sortKey === 'employee') { aVal = a.employeeName; bVal = b.employeeName; }
      else if (sortKey === 'estimated_hours') { aVal = a.estimatedHours; bVal = b.estimatedHours; }
      else if (sortKey === 'actual_hours') { aVal = a.actualHours; bVal = b.actualHours; }
      else { aVal = a.grossMargin ?? -999; bVal = b.grossMargin ?? -999; }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [rows, sortKey, sortDir]);

  if (!isHydrated || loading) return <PageSkeleton />;
  if (error) {
    return (
      <div className="p-6">
        <ErrorRetry message={error} onRetry={() => void fetchData()} />
      </div>
    );
  }

  const COLUMNS: [SortKey, string][] = [
    ['property', 'Property'],
    ['task', 'Task'],
    ['employee', 'Employee'],
    ['estimated_hours', 'Est. Hrs'],
    ['actual_hours', 'Actual Hrs'],
    ['margin', 'Margin %'],
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">Job Costing</h1>
        <p className="mt-0.5 text-sm text-text-secondary">
          Labor cost and margin analysis for completed assignments.
        </p>
      </div>

      {summary && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-surface-border bg-surface-card p-4">
            <div className="text-xs font-medium uppercase tracking-widest text-text-muted">
              Avg Gross Margin
            </div>
            <div className={`mt-2 text-2xl font-bold ${marginClass(summary.avgMargin)}`}>
              {summary.avgMargin.toFixed(1)}%
            </div>
          </div>
          <div className="rounded-xl border border-surface-border bg-surface-card p-4">
            <div className="text-xs font-medium uppercase tracking-widest text-text-muted">
              Best Margin Task
            </div>
            <div className="mt-2 truncate text-base font-semibold text-text-primary">
              {summary.bestTask}
            </div>
          </div>
          <div className="rounded-xl border border-surface-border bg-surface-card p-4">
            <div className="text-xs font-medium uppercase tracking-widest text-text-muted">
              Lowest Margin Task
            </div>
            <div className="mt-2 truncate text-base font-semibold text-text-primary">
              {summary.worstTask}
            </div>
          </div>
        </div>
      )}

      {monthlyTrend.length > 0 && (
        <div className="rounded-xl border border-surface-border bg-surface-card p-4">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-brand" />
            <h2 className="text-sm font-semibold text-text-primary">
              Monthly Actual Hours Trend
            </h2>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyTrend} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#263d2d" />
              <XAxis dataKey="month" tick={{ fill: '#556b55', fontSize: 11 }} />
              <YAxis tick={{ fill: '#556b55', fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: '#141f18',
                  border: '1px solid #263d2d',
                  borderRadius: 8,
                }}
                labelStyle={{ color: '#f0f4f0' }}
                itemStyle={{ color: '#84cc16' }}
              />
              <Bar dataKey="hours" fill="#84cc16" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-elevated">
            <TrendingUp className="h-6 w-6 text-text-muted" />
          </div>
          <p className="mb-1 text-sm font-semibold text-text-primary">
            No completed assignments yet
          </p>
          <p className="max-w-xs text-sm text-text-secondary">
            Completed assignments with actual hours will appear here with cost and margin analysis.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-surface-border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-surface-border bg-surface-elevated">
                <tr>
                  {COLUMNS.map(([key, label]) => (
                    <th
                      key={key}
                      onClick={() => handleSort(key)}
                      className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-text-muted hover:text-text-primary"
                    >
                      {label}
                      {sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {sortedRows.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-surface-hover">
                    <td className="px-4 py-3 text-text-primary">{row.propertyName}</td>
                    <td className="px-4 py-3 text-text-primary">{row.taskName}</td>
                    <td className="px-4 py-3 text-text-secondary">{row.employeeName}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {row.estimatedHours.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {row.actualHours.toFixed(1)}
                    </td>
                    <td className={`px-4 py-3 font-medium ${marginClass(row.grossMargin)}`}>
                      {row.grossMargin !== null ? `${row.grossMargin.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
