import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Briefcase, DollarSign, TrendingUp } from 'lucide-react';
import { ErrorRetry } from '@/components/ErrorRetry';
import { PageSkeleton } from '@/components/PageSkeleton';
import { useOrgProfile } from '@/hooks/useOrgProfile';
import {
  type JobCostingAssignment,
  useEmployees,
  useInvoices,
  useJobCostingAssignments,
  usePayments,
  useProperties,
  useRevenueWorkOrders,
  useTasks,
} from '@/lib/supabase-queries';

type SortKey = 'period' | 'property' | 'labor_cost' | 'billed_revenue' | 'collected_revenue' | 'margin';

type PropertyPeriodRow = {
  id: string;
  period: string;
  propertyName: string;
  laborCost: number;
  actualHours: number;
  billedRevenue: number;
  collectedRevenue: number;
  unlinkedRevenue: number;
  margin: number | null;
};

type WorkOrderCostRow = {
  id: string;
  workOrderLabel: string;
  propertyName: string;
  laborCost: number;
  actualHours: number;
  assignmentCount: number;
};

function fmt(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function formatPeriod(period: string) {
  const [year, month] = period.split('-');
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

function assignmentCost(assignment: JobCostingAssignment, employeeWages: Map<string, number>) {
  const hourlyRate = employeeWages.get(assignment.employeeId);
  if (hourlyRate === undefined) return 0;
  return assignment.actualHours * hourlyRate;
}

export default function JobCostingPage() {
  const { orgId } = useOrgProfile();
  const employeesQuery = useEmployees(undefined, orgId ?? undefined, 'all');
  const propertiesQuery = useProperties(orgId ?? undefined);
  const tasksQuery = useTasks(undefined, orgId ?? undefined);
  const assignmentsQuery = useJobCostingAssignments(orgId ?? undefined);
  const invoicesQuery = useInvoices(orgId ?? undefined);
  const paymentsQuery = usePayments(undefined, orgId ?? undefined);
  const workOrdersQuery = useRevenueWorkOrders(undefined, orgId ?? undefined);
  const [sortKey, setSortKey] = useState<SortKey>('period');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    document.title = 'Performance - Ground Crew HQ';
  }, []);

  const employees = employeesQuery.data ?? [];
  const properties = propertiesQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const assignments = assignmentsQuery.data ?? [];
  const invoices = invoicesQuery.data ?? [];
  const payments = paymentsQuery.data ?? [];
  const workOrders = workOrdersQuery.data ?? [];

  const loading =
    (employeesQuery.isLoading && !employeesQuery.data) ||
    (propertiesQuery.isLoading && !propertiesQuery.data) ||
    (tasksQuery.isLoading && !tasksQuery.data) ||
    (assignmentsQuery.isLoading && !assignmentsQuery.data) ||
    (invoicesQuery.isLoading && !invoicesQuery.data) ||
    (paymentsQuery.isLoading && !paymentsQuery.data) ||
    (workOrdersQuery.isLoading && !workOrdersQuery.data);
  const queryError =
    employeesQuery.error ??
    propertiesQuery.error ??
    tasksQuery.error ??
    assignmentsQuery.error ??
    invoicesQuery.error ??
    paymentsQuery.error ??
    workOrdersQuery.error;
  const error = queryError instanceof Error ? queryError.message : null;

  const handleRetry = useCallback(() => {
    void employeesQuery.refetch();
    void propertiesQuery.refetch();
    void tasksQuery.refetch();
    void assignmentsQuery.refetch();
    void invoicesQuery.refetch();
    void paymentsQuery.refetch();
    void workOrdersQuery.refetch();
  }, [assignmentsQuery, employeesQuery, invoicesQuery, paymentsQuery, propertiesQuery, tasksQuery, workOrdersQuery]);

  const employeeWages = useMemo(() => new Map(employees.map((employee) => [employee.id, Number(employee.wage ?? 0)])), [employees]);
  const propertyNames = useMemo(() => new Map(properties.map((property) => [property.id, property.name])), [properties]);
  const taskNames = useMemo(() => new Map(tasks.map((task) => [task.id, task.name])), [tasks]);
  const invoicesById = useMemo(() => new Map(invoices.map((invoice) => [invoice.id, invoice])), [invoices]);
  const workOrdersById = useMemo(() => new Map(workOrders.map((workOrder) => [workOrder.id, workOrder])), [workOrders]);

  const propertyPeriodRows = useMemo<PropertyPeriodRow[]>(() => {
    const rows = new Map<string, PropertyPeriodRow>();
    const ensureRow = (propertyId: string | null, period: string) => {
      const id = `${propertyId ?? 'no-property'}-${period}`;
      const existing = rows.get(id);
      if (existing) return existing;
      const next: PropertyPeriodRow = {
        id,
        period,
        propertyName: propertyId ? propertyNames.get(propertyId) ?? 'Unknown property' : 'No property',
        laborCost: 0,
        actualHours: 0,
        billedRevenue: 0,
        collectedRevenue: 0,
        unlinkedRevenue: 0,
        margin: null,
      };
      rows.set(id, next);
      return next;
    };

    assignments.forEach((assignment) => {
      const period = assignment.date.slice(0, 7);
      const row = ensureRow(assignment.propertyId, period);
      row.actualHours += assignment.actualHours;
      row.laborCost += assignmentCost(assignment, employeeWages);
    });

    invoices.forEach((invoice) => {
      if (invoice.status === 'void') return;
      const period = invoice.createdAt.slice(0, 7);
      const row = ensureRow(invoice.propertyId, period);
      row.billedRevenue += invoice.total;
      row.unlinkedRevenue += invoice.total;
    });

    payments.forEach((payment) => {
      const invoice = invoicesById.get(payment.invoiceId);
      if (!invoice || invoice.status === 'void') return;
      const period = payment.paidAt.slice(0, 7);
      const row = ensureRow(invoice.propertyId, period);
      row.collectedRevenue += payment.amount;
    });

    return Array.from(rows.values()).map((row) => ({
      ...row,
      actualHours: Math.round(row.actualHours * 10) / 10,
      laborCost: Math.round(row.laborCost * 100) / 100,
      billedRevenue: Math.round(row.billedRevenue * 100) / 100,
      collectedRevenue: Math.round(row.collectedRevenue * 100) / 100,
      unlinkedRevenue: Math.round(row.unlinkedRevenue * 100) / 100,
      margin: row.billedRevenue > 0 ? ((row.billedRevenue - row.laborCost) / row.billedRevenue) * 100 : null,
    }));
  }, [assignments, employeeWages, invoices, invoicesById, payments, propertyNames]);

  const workOrderRows = useMemo<WorkOrderCostRow[]>(() => {
    const rows = new Map<string, WorkOrderCostRow>();
    assignments.forEach((assignment) => {
      if (!assignment.workOrderId) return;
      const workOrder = workOrdersById.get(assignment.workOrderId);
      const taskName = assignment.taskId ? taskNames.get(assignment.taskId) : null;
      const row = rows.get(assignment.workOrderId) ?? {
        id: assignment.workOrderId,
        workOrderLabel: workOrder
          ? `#${workOrder.woNumber} ${workOrder.title}`
          : taskName ?? 'Linked work order',
        propertyName: propertyNames.get(assignment.propertyId) ?? 'Unknown property',
        laborCost: 0,
        actualHours: 0,
        assignmentCount: 0,
      };
      row.laborCost += assignmentCost(assignment, employeeWages);
      row.actualHours += assignment.actualHours;
      row.assignmentCount += 1;
      rows.set(assignment.workOrderId, row);
    });
    return Array.from(rows.values()).map((row) => ({
      ...row,
      laborCost: Math.round(row.laborCost * 100) / 100,
      actualHours: Math.round(row.actualHours * 10) / 10,
    }));
  }, [assignments, employeeWages, propertyNames, taskNames, workOrdersById]);

  const sortedPropertyRows = useMemo(() => {
    return [...propertyPeriodRows].sort((first, second) => {
      let firstValue: string | number;
      let secondValue: string | number;
      if (sortKey === 'period') {
        firstValue = first.period;
        secondValue = second.period;
      } else if (sortKey === 'property') {
        firstValue = first.propertyName;
        secondValue = second.propertyName;
      } else if (sortKey === 'labor_cost') {
        firstValue = first.laborCost;
        secondValue = second.laborCost;
      } else if (sortKey === 'billed_revenue') {
        firstValue = first.billedRevenue;
        secondValue = second.billedRevenue;
      } else if (sortKey === 'collected_revenue') {
        firstValue = first.collectedRevenue;
        secondValue = second.collectedRevenue;
      } else {
        firstValue = first.margin ?? -999;
        secondValue = second.margin ?? -999;
      }

      if (typeof firstValue === 'string' && typeof secondValue === 'string') {
        return sortDir === 'asc' ? firstValue.localeCompare(secondValue) : secondValue.localeCompare(firstValue);
      }
      return sortDir === 'asc'
        ? (firstValue as number) - (secondValue as number)
        : (secondValue as number) - (firstValue as number);
    });
  }, [propertyPeriodRows, sortDir, sortKey]);

  const summary = useMemo(() => {
    const totals = propertyPeriodRows.reduce(
      (acc, row) => ({
        laborCost: acc.laborCost + row.laborCost,
        billedRevenue: acc.billedRevenue + row.billedRevenue,
        collectedRevenue: acc.collectedRevenue + row.collectedRevenue,
        unlinkedRevenue: acc.unlinkedRevenue + row.unlinkedRevenue,
      }),
      { laborCost: 0, billedRevenue: 0, collectedRevenue: 0, unlinkedRevenue: 0 },
    );
    const margin = totals.billedRevenue > 0 ? ((totals.billedRevenue - totals.laborCost) / totals.billedRevenue) * 100 : null;
    const linkedAssignmentCount = assignments.filter((assignment) => assignment.workOrderId).length;
    return { ...totals, margin, linkedAssignmentCount, unlinkedAssignmentCount: assignments.length - linkedAssignmentCount };
  }, [assignments, propertyPeriodRows]);

  const monthlyTrend = useMemo(() => {
    const byPeriod = new Map<string, { period: string; laborCost: number; billedRevenue: number }>();
    propertyPeriodRows.forEach((row) => {
      const current = byPeriod.get(row.period) ?? { period: row.period, laborCost: 0, billedRevenue: 0 };
      current.laborCost += row.laborCost;
      current.billedRevenue += row.billedRevenue;
      byPeriod.set(row.period, current);
    });
    return Array.from(byPeriod.values())
      .sort((first, second) => first.period.localeCompare(second.period))
      .slice(-6)
      .map((row) => ({
        month: formatPeriod(row.period),
        laborCost: Math.round(row.laborCost),
        billedRevenue: Math.round(row.billedRevenue),
      }));
  }, [propertyPeriodRows]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir('desc');
  };

  const marginClass = (margin: number | null) => {
    if (margin === null) return 'text-text-muted';
    if (margin > 40) return 'text-status-active';
    if (margin > 20) return 'text-status-pending';
    return 'text-status-warning';
  };

  if (!orgId || loading) return <PageSkeleton />;
  if (error) {
    return (
      <div className="p-6">
        <ErrorRetry message={error} onRetry={handleRetry} />
      </div>
    );
  }

  const propertyColumns: [SortKey, string][] = [
    ['period', 'Period'],
    ['property', 'Property'],
    ['labor_cost', 'Labor Cost'],
    ['billed_revenue', 'Billed'],
    ['collected_revenue', 'Collected'],
    ['margin', 'Margin'],
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Performance</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Compare delivered labor, work volume, and optional billed revenue by property.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-surface-border bg-surface-card p-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-status-active" />
            <span className="text-xs font-medium uppercase tracking-widest text-text-muted">Billed Revenue</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-text-primary">{fmt(summary.billedRevenue)}</div>
        </div>
        <div className="rounded-lg border border-surface-border bg-surface-card p-4">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-status-pending" />
            <span className="text-xs font-medium uppercase tracking-widest text-text-muted">Labor Cost</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-text-primary">{fmt(summary.laborCost)}</div>
        </div>
        <div className="rounded-lg border border-surface-border bg-surface-card p-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-brand" />
            <span className="text-xs font-medium uppercase tracking-widest text-text-muted">Gross Margin</span>
          </div>
          <div className={`mt-2 text-2xl font-bold ${marginClass(summary.margin)}`}>
            {summary.margin === null ? '--' : `${summary.margin.toFixed(1)}%`}
          </div>
        </div>
        <div className="rounded-lg border border-surface-border bg-surface-card p-4">
          <div className="text-xs font-medium uppercase tracking-widest text-text-muted">Work Order Links</div>
          <div className="mt-2 text-2xl font-bold text-text-primary">{summary.linkedAssignmentCount}</div>
          <div className="mt-1 text-xs text-text-secondary">{summary.unlinkedAssignmentCount} assignments not linked</div>
        </div>
      </div>

      {monthlyTrend.length > 0 ? (
        <div className="rounded-lg border border-surface-border bg-surface-card p-4">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-brand" />
            <h2 className="text-sm font-semibold text-text-primary">Revenue vs Labor Cost</h2>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyTrend} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--surface-border))" />
              <XAxis dataKey="month" tick={{ fill: 'oklch(var(--text-muted))', fontSize: 11 }} />
              <YAxis tick={{ fill: 'oklch(var(--text-muted))', fontSize: 11 }} />
              <Tooltip
                formatter={(value) => fmt(Number(value))}
                contentStyle={{
                  background: 'oklch(var(--surface-card))',
                  border: '1px solid oklch(var(--surface-border))',
                  borderRadius: 8,
                }}
                labelStyle={{ color: 'oklch(var(--text-primary))' }}
              />
              <Bar dataKey="billedRevenue" name="Billed" fill="oklch(var(--brand-default))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="laborCost" name="Labor Cost" fill="oklch(var(--status-warning))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      <div className="rounded-lg border border-surface-border bg-surface-card">
        <div className="border-b border-surface-border p-4">
          <h2 className="text-sm font-semibold text-text-primary">Property Performance by Period</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Delivery cost and optional billed revenue stay grouped by property and period until work orders carry direct revenue links.
          </p>
        </div>
        {sortedPropertyRows.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-text-secondary">
            Completed assignments and invoices will appear here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-surface-border bg-surface-elevated">
                <tr>
                  {propertyColumns.map(([key, label]) => (
                    <th
                      key={key}
                      onClick={() => handleSort(key)}
                      className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-text-muted hover:text-text-primary"
                    >
                      {label}
                      {sortKey === key ? (sortDir === 'asc' ? ' up' : ' down') : ''}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-text-muted">Not Linked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {sortedPropertyRows.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-surface-hover">
                    <td className="px-4 py-3 text-text-primary">{formatPeriod(row.period)}</td>
                    <td className="px-4 py-3 text-text-primary">{row.propertyName}</td>
                    <td className="px-4 py-3 text-text-secondary">{fmt(row.laborCost)}</td>
                    <td className="px-4 py-3 font-medium text-text-primary">{fmt(row.billedRevenue)}</td>
                    <td className="px-4 py-3 text-status-active">{fmt(row.collectedRevenue)}</td>
                    <td className={`px-4 py-3 font-medium ${marginClass(row.margin)}`}>
                      {row.margin === null ? '--' : `${row.margin.toFixed(1)}%`}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{fmt(row.unlinkedRevenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-surface-border bg-surface-card">
        <div className="border-b border-surface-border p-4">
          <h2 className="text-sm font-semibold text-text-primary">Work Order Labor Cost</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Optional revenue appears once invoices can be linked directly to work orders.
          </p>
        </div>
        {workOrderRows.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-text-secondary">
            Link assignments to work orders from the Workboard to start building this view.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-surface-border bg-surface-elevated">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-text-muted">Work Order</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-text-muted">Property</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-text-muted">Assignments</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-text-muted">Hours</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-widest text-text-muted">Labor Cost</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-text-muted">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {workOrderRows.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-surface-hover">
                    <td className="px-4 py-3 font-medium text-text-primary">{row.workOrderLabel}</td>
                    <td className="px-4 py-3 text-text-secondary">{row.propertyName}</td>
                    <td className="px-4 py-3 text-right text-text-secondary">{row.assignmentCount}</td>
                    <td className="px-4 py-3 text-right text-text-secondary">{row.actualHours.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right font-medium text-text-primary">{fmt(row.laborCost)}</td>
                    <td className="px-4 py-3 text-text-muted">Not linked</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
