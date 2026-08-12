import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/EmptyState';
import { TableSkeleton } from '@/components/PageSkeleton';
import { ErrorRetry } from '@/components/ErrorRetry';
import { useOrgProfile } from '@/hooks/useOrgProfile';
import { createClient } from '@/lib/supabase';
import { computeTimesheet, type TimesheetAssignmentInput, type TimesheetClockEventInput } from '@/lib/timesheets';
import { useEmployees, useProgramSettings, useTasks } from '@/lib/supabase-queries';

const supabase = createClient();
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type PayrollTimesheetData = {
  assignments: TimesheetAssignmentInput[];
  clockEvents: TimesheetClockEventInput[];
};

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function toLocalDateKey(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function utcDayFromDateKey(value: string) {
  const [year, month, day] = value.split('-').map((part) => Number(part));
  if ([year, month, day].some((part) => !Number.isFinite(part))) {
    return Date.UTC(2024, 0, 1) / MS_PER_DAY;
  }
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

function dateKeyFromUtcDay(day: number) {
  const date = new Date(day * MS_PER_DAY);
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function addDaysToKey(value: string, days: number) {
  return dateKeyFromUtcDay(utcDayFromDateKey(value) + days);
}

function formatDateRange(start: string, endExclusive: string) {
  const endInclusive = addDaysToKey(endExclusive, -1);
  const format = (value: string) =>
    new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  return `${format(start)} - ${format(endInclusive)}`;
}

function computePayPeriod(cursorDate: string, anchorDate: string, lengthDays: number) {
  const length = Math.max(1, Math.round(Number(lengthDays || 14)));
  const anchorDay = utcDayFromDateKey(anchorDate || '2024-01-01');
  const cursorDay = utcDayFromDateKey(cursorDate);
  const periodIndex = Math.floor((cursorDay - anchorDay) / length);
  const startDay = anchorDay + periodIndex * length;
  const endDay = startDay + length;
  return {
    start: dateKeyFromUtcDay(startDay),
    endExclusive: dateKeyFromUtcDay(endDay),
    lengthDays: length,
  };
}

async function withPayrollTimeout<T>(promise: PromiseLike<T>, label: string, timeoutMs = 15000): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out. Try again.`)), timeoutMs);
  });
  return Promise.race([Promise.resolve(promise), timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

function buildPeriodDays(start: string, endExclusive: string) {
  const length = Math.max(0, utcDayFromDateKey(endExclusive) - utcDayFromDateKey(start));
  return Array.from({ length }, (_, index) => addDaysToKey(start, index));
}

function formatHours(value: number) {
  return value.toFixed(2);
}

export default function PayrollPage() {
  const { orgId, currentRole } = useOrgProfile();
  const canManage = currentRole === 'admin' || currentRole === 'manager';
  const queryOrgId = canManage ? orgId ?? undefined : undefined;
  const programSettingsQuery = useProgramSettings(queryOrgId);
  const employeesQuery = useEmployees(undefined, queryOrgId, 'all');
  const tasksQuery = useTasks(undefined, queryOrgId);
  const [periodCursorDate, setPeriodCursorDate] = useState(() => toLocalDateKey(new Date()));

  useEffect(() => {
    document.title = 'Payroll - Ground Crew HQ';
  }, []);

  const payPeriod = useMemo(() => {
    return computePayPeriod(
      periodCursorDate,
      programSettingsQuery.data?.payPeriodAnchorDate ?? '2024-01-01',
      programSettingsQuery.data?.payPeriodLengthDays ?? 14,
    );
  }, [periodCursorDate, programSettingsQuery.data?.payPeriodAnchorDate, programSettingsQuery.data?.payPeriodLengthDays]);

  const periodDays = useMemo(() => buildPeriodDays(payPeriod.start, payPeriod.endExclusive), [payPeriod.endExclusive, payPeriod.start]);

  const payrollQuery = useQuery<PayrollTimesheetData>({
    queryKey: ['payroll-timesheet', queryOrgId ?? 'no-org', payPeriod.start, payPeriod.endExclusive],
    enabled: Boolean(queryOrgId),
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      if (!supabase || !queryOrgId) return { assignments: [], clockEvents: [] };
      const assignmentsQuery = supabase
        .from('assignments')
        .select('id, employee_id, task_id, property_id, date, actual_hours')
        .eq('org_id', queryOrgId)
        .gte('date', payPeriod.start)
        .lt('date', payPeriod.endExclusive)
        .is('deleted_at', null);

      const clockEventsQuery = supabase
        .from('clock_events')
        .select('id, employee_id, property_id, event_type, timestamp')
        .eq('org_id', queryOrgId)
        .gte('timestamp', `${payPeriod.start}T00:00:00.000Z`)
        .lt('timestamp', `${payPeriod.endExclusive}T00:00:00.000Z`)
        .order('timestamp', { ascending: true });

      const [assignmentsResult, clockEventsResult] = await withPayrollTimeout(
        Promise.all([assignmentsQuery, clockEventsQuery]),
        'Payroll timesheet data',
      );

      if (assignmentsResult.error || clockEventsResult.error) {
        throw assignmentsResult.error ?? clockEventsResult.error;
      }

      return {
        assignments: (assignmentsResult.data ?? []) as TimesheetAssignmentInput[],
        clockEvents: (clockEventsResult.data ?? []) as TimesheetClockEventInput[],
      };
    },
  });

  const employees = useMemo(
    () =>
      (employeesQuery.data ?? []).map((employee) => ({
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        wage: employee.wage,
      })),
    [employeesQuery.data],
  );

  const tasks = useMemo(
    () =>
      (tasksQuery.data ?? []).map((task) => ({
        id: task.id,
        isUnpaid: Boolean(task.isUnpaid ?? task.is_unpaid),
      })),
    [tasksQuery.data],
  );

  const computedTimesheet = useMemo(
    () =>
      computeTimesheet({
        assignments: payrollQuery.data?.assignments ?? [],
        clockEvents: payrollQuery.data?.clockEvents ?? [],
        employees,
        tasks,
        days: periodDays,
      }),
    [employees, payrollQuery.data?.assignments, payrollQuery.data?.clockEvents, periodDays, tasks],
  );

  const loading = programSettingsQuery.isLoading || employeesQuery.isLoading || tasksQuery.isLoading || payrollQuery.isLoading;
  const error = programSettingsQuery.error ?? employeesQuery.error ?? tasksQuery.error ?? payrollQuery.error;

  if (!canManage) {
    return (
      <div className="mx-auto max-w-4xl p-4 md:p-6">
        <div className="rounded-lg border border-surface-border bg-surface-card p-6">
          <p className="text-sm font-semibold text-text-primary">Supervisors only</p>
          <p className="mt-1 text-sm text-text-secondary">Payroll review is available to admins and managers.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
      <PageHeader compact title="Payroll">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPeriodCursorDate(addDaysToKey(payPeriod.start, -1))}
          >
            Previous
          </Button>
          <Badge variant="outline" className="rounded-full border-surface-border text-text-secondary">
            {formatDateRange(payPeriod.start, payPeriod.endExclusive)}
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPeriodCursorDate(payPeriod.endExclusive)}
          >
            Next
          </Button>
        </div>
      </PageHeader>

      <section className="rounded-xl border border-surface-border bg-surface-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Pay-period timesheet</h2>
            <p className="mt-1 text-sm text-text-muted">
              {payPeriod.lengthDays}-day period aligned to {programSettingsQuery.data?.payPeriodAnchorDate ?? '2024-01-01'}.
            </p>
          </div>
          <Badge variant="pending" className="rounded-full">
            Read only
          </Badge>
        </div>

        {loading ? (
          <TableSkeleton rows={6} />
        ) : error ? (
          <ErrorRetry
            message={error instanceof Error ? error.message : 'Unable to load payroll timesheets.'}
            onRetry={() => {
              void Promise.all([
                programSettingsQuery.refetch(),
                employeesQuery.refetch(),
                tasksQuery.refetch(),
                payrollQuery.refetch(),
              ]);
            }}
          />
        ) : computedTimesheet.rows.length === 0 ? (
          <EmptyState icon={CalendarClock} title="No payroll rows for this period" description="Clock events or reviewed assignment hours will appear here once crew activity is logged." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-surface-border">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-surface-border bg-surface-elevated text-left text-xs uppercase tracking-widest text-text-muted">
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 text-right font-medium">Paid hours</th>
                  <th className="px-4 py-3 text-right font-medium">Unpaid/breaks</th>
                  <th className="px-4 py-3 text-right font-medium">Worked days</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {computedTimesheet.rows.map((row) => (
                  <tr key={row.employeeId} className="border-b border-surface-border last:border-0 hover:bg-surface-hover">
                    <td className="px-4 py-3 font-medium text-text-primary">{row.employeeName}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-text-primary">{formatHours(row.paidHours)}h</td>
                    <td className="px-4 py-3 text-right tabular-nums text-text-secondary">{formatHours(row.unpaidHours)}h</td>
                    <td className="px-4 py-3 text-right tabular-nums text-text-secondary">{row.workedDays}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-text-primary">{formatHours(row.totalHours)}h</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-surface-border bg-surface-elevated font-semibold text-text-primary">
                  <td className="px-4 py-3">Totals</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatHours(computedTimesheet.totals.paidHours)}h</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatHours(computedTimesheet.totals.unpaidHours)}h</td>
                  <td className="px-4 py-3 text-right tabular-nums">{computedTimesheet.totals.workedDays}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatHours(computedTimesheet.totals.totalHours)}h</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
