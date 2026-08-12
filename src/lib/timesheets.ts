export type TimesheetEmployeeInput = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  hourly_rate?: number | null;
  wage?: number | null;
};

export type TimesheetAssignmentInput = {
  id?: string;
  employee_id?: string | null;
  employeeId?: string | null;
  task_id?: string | null;
  taskId?: string | null;
  property_id?: string | null;
  propertyId?: string | null;
  date: string;
  actual_hours?: number | null;
  actualHours?: number | null;
};

export type TimesheetClockEventInput = {
  id?: string;
  employee_id?: string | null;
  employeeId?: string | null;
  property_id?: string | null;
  propertyId?: string | null;
  event_type?: string | null;
  eventType?: string | null;
  timestamp?: string | null;
};

export type TimesheetScheduleInput = {
  id?: string;
  employee_id?: string | null;
  employeeId?: string | null;
  property_id?: string | null;
  propertyId?: string | null;
  date: string;
  shift_start?: string | null;
  shiftStart?: string | null;
  shift_end?: string | null;
  shiftEnd?: string | null;
};

export type TimesheetTaskInput = {
  id: string;
  is_unpaid?: boolean | null;
  isUnpaid?: boolean | null;
};

export type TimesheetDayInput = string | { key?: string; date?: string };

export type TimesheetDayCell = {
  date: string;
  scheduled: number;
  actual: number;
};

export type TimesheetRow = {
  employeeId: string;
  employeeName: string;
  hourlyRate: number;
  days: TimesheetDayCell[];
  totalScheduled: number;
  totalActual: number;
  unpaidHours: number;
  clockHours: number;
  paidClockHours: number;
  paidHours: number;
  workedDays: number;
  totalHours: number;
  cost: number;
};

export type TimesheetTotals = {
  totalScheduled: number;
  totalActual: number;
  totalCost: number;
  paidHours: number;
  unpaidHours: number;
  workedDays: number;
  totalHours: number;
};

export type ComputedTimesheet = {
  rows: TimesheetRow[];
  totals: TimesheetTotals;
};

type ComputeTimesheetInput = {
  assignments: TimesheetAssignmentInput[];
  clockEvents?: TimesheetClockEventInput[];
  employees: TimesheetEmployeeInput[];
  tasks: TimesheetTaskInput[];
  days: TimesheetDayInput[];
  scheduleEntries?: TimesheetScheduleInput[];
};

function getEmployeeId(value: TimesheetAssignmentInput | TimesheetClockEventInput | TimesheetScheduleInput) {
  return value.employee_id ?? value.employeeId ?? '';
}

function getTaskId(value: TimesheetAssignmentInput) {
  return value.task_id ?? value.taskId ?? '';
}

export function calculateShiftHours(shiftStart?: string | null, shiftEnd?: string | null) {
  const start = String(shiftStart ?? '').slice(0, 5);
  const end = String(shiftEnd ?? '').slice(0, 5);
  if (!start || !end || !start.includes(':') || !end.includes(':')) return 0;
  const [startHour, startMinute] = start.split(':').map((part) => Number(part));
  const [endHour, endMinute] = end.split(':').map((part) => Number(part));
  if ([startHour, startMinute, endHour, endMinute].some((value) => Number.isNaN(value))) return 0;
  const raw = endHour * 60 + endMinute - (startHour * 60 + startMinute);
  return raw > 0 ? raw / 60 : 0;
}

export function isTaskUnpaid(task?: TimesheetTaskInput | null) {
  return Boolean(task?.is_unpaid ?? task?.isUnpaid);
}

export function getAssignmentActualHours(assignment: TimesheetAssignmentInput) {
  const hours = Number(assignment.actual_hours ?? assignment.actualHours ?? 0);
  return Number.isFinite(hours) ? hours : 0;
}

export function getPaidActualHours(assignment: TimesheetAssignmentInput, taskById: Map<string, TimesheetTaskInput>) {
  return isTaskUnpaid(taskById.get(getTaskId(assignment))) ? 0 : getAssignmentActualHours(assignment);
}

function getEmployeeName(employee?: TimesheetEmployeeInput) {
  if (!employee) return 'Unknown Employee';
  return `${employee.first_name ?? employee.firstName ?? ''} ${employee.last_name ?? employee.lastName ?? ''}`.trim() || 'Unnamed Employee';
}

function getEmployeeHourlyRate(employee?: TimesheetEmployeeInput) {
  const rate = Number(employee?.hourly_rate ?? employee?.wage ?? 0);
  return Number.isFinite(rate) ? rate : 0;
}

function getClockHoursByEmployee(clockEvents: TimesheetClockEventInput[]) {
  const clockHoursByEmployee = new Map<string, { hours: number; days: Set<string> }>();
  const openClockInByEmployee = new Map<string, Date>();

  [...clockEvents]
    .filter((event) => event.timestamp)
    .sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)))
    .forEach((event) => {
      const employeeId = getEmployeeId(event);
      if (!employeeId) return;
      const eventType = String(event.event_type ?? event.eventType ?? '').toLowerCase();
      const eventTime = new Date(event.timestamp ?? '');
      if (Number.isNaN(eventTime.getTime())) return;

      if (eventType === 'clock_in' || eventType === 'in') {
        openClockInByEmployee.set(employeeId, eventTime);
        return;
      }

      if (eventType !== 'clock_out' && eventType !== 'out') return;

      const start = openClockInByEmployee.get(employeeId);
      if (!start) return;

      const hours = Math.max(0, (eventTime.getTime() - start.getTime()) / (1000 * 60 * 60));
      const existing = clockHoursByEmployee.get(employeeId) ?? { hours: 0, days: new Set<string>() };
      existing.hours += hours;
      existing.days.add(String(event.timestamp).slice(0, 10));
      clockHoursByEmployee.set(employeeId, existing);
      openClockInByEmployee.delete(employeeId);
    });

  return clockHoursByEmployee;
}

function normalizeDays(days: TimesheetDayInput[]) {
  return days
    .map((day) => (typeof day === 'string' ? day : day.key ?? day.date ?? ''))
    .filter((day) => day.length > 0);
}

export function computeTimesheet({
  assignments,
  clockEvents = [],
  employees,
  tasks,
  days,
  scheduleEntries = [],
}: ComputeTimesheetInput): ComputedTimesheet {
  const dayKeys = normalizeDays(days);
  const employeeMap = new Map(employees.map((employee) => [employee.id, employee]));
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const scheduledByEmployeeDay = new Map<string, number>();
  const actualByEmployeeDay = new Map<string, number>();
  const unpaidHoursByEmployee = new Map<string, number>();
  const workedDaysByEmployee = new Map<string, Set<string>>();
  const clockHoursByEmployee = getClockHoursByEmployee(clockEvents);

  scheduleEntries.forEach((entry) => {
    const employeeId = getEmployeeId(entry);
    if (!employeeId) return;
    const key = `${employeeId}|${entry.date}`;
    const hours = calculateShiftHours(entry.shift_start ?? entry.shiftStart, entry.shift_end ?? entry.shiftEnd);
    scheduledByEmployeeDay.set(key, (scheduledByEmployeeDay.get(key) ?? 0) + hours);
  });

  assignments.forEach((assignment) => {
    const employeeId = getEmployeeId(assignment);
    if (!employeeId) return;
    const daySet = workedDaysByEmployee.get(employeeId) ?? new Set<string>();
    daySet.add(assignment.date);
    workedDaysByEmployee.set(employeeId, daySet);

    const key = `${employeeId}|${assignment.date}`;
    const rawActualHours = getAssignmentActualHours(assignment);
    const actualHours = getPaidActualHours(assignment, taskById);
    actualByEmployeeDay.set(key, (actualByEmployeeDay.get(key) ?? 0) + actualHours);
    if (rawActualHours > 0 && isTaskUnpaid(taskById.get(getTaskId(assignment)))) {
      unpaidHoursByEmployee.set(employeeId, (unpaidHoursByEmployee.get(employeeId) ?? 0) + rawActualHours);
    }
  });

  const employeeIds = new Set<string>([
    ...scheduleEntries.map(getEmployeeId).filter(Boolean),
    ...assignments.map(getEmployeeId).filter(Boolean),
    ...clockHoursByEmployee.keys(),
  ]);

  const rows = Array.from(employeeIds)
    .map((employeeId) => {
      const employee = employeeMap.get(employeeId);
      const hourlyRate = getEmployeeHourlyRate(employee);
      const employeeName = getEmployeeName(employee);
      const days = dayKeys.map((day) => {
        const key = `${employeeId}|${day}`;
        return {
          date: day,
          scheduled: Number((scheduledByEmployeeDay.get(key) ?? 0).toFixed(2)),
          actual: Number((actualByEmployeeDay.get(key) ?? 0).toFixed(2)),
        };
      });
      const totalScheduled = Number(days.reduce((sum, day) => sum + day.scheduled, 0).toFixed(2));
      const totalActual = Number(days.reduce((sum, day) => sum + day.actual, 0).toFixed(2));
      const unpaidHours = Number((unpaidHoursByEmployee.get(employeeId) ?? 0).toFixed(2));
      const clockSummary = clockHoursByEmployee.get(employeeId);
      const clockHours = Number((clockSummary?.hours ?? 0).toFixed(2));
      const paidClockHours = Number(Math.max(0, clockHours - unpaidHours).toFixed(2));
      const paidHours = Number(Math.max(totalActual, paidClockHours).toFixed(2));
      const workedDays = new Set(workedDaysByEmployee.get(employeeId) ?? []);
      clockSummary?.days.forEach((day) => workedDays.add(day));
      const totalHours = Number((paidHours + unpaidHours).toFixed(2));
      const cost = Number((totalActual * hourlyRate).toFixed(2));

      return {
        employeeId,
        employeeName,
        hourlyRate,
        days,
        totalScheduled,
        totalActual,
        unpaidHours,
        clockHours,
        paidClockHours,
        paidHours,
        workedDays: workedDays.size,
        totalHours,
        cost,
      };
    })
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName));

  const totals = rows.reduce<TimesheetTotals>(
    (sum, row) => {
      sum.totalScheduled += row.totalScheduled;
      sum.totalActual += row.totalActual;
      sum.totalCost += row.cost;
      sum.paidHours += row.paidHours;
      sum.unpaidHours += row.unpaidHours;
      sum.workedDays += row.workedDays;
      sum.totalHours += row.totalHours;
      return sum;
    },
    { totalScheduled: 0, totalActual: 0, totalCost: 0, paidHours: 0, unpaidHours: 0, workedDays: 0, totalHours: 0 },
  );

  return {
    rows,
    totals: {
      totalScheduled: Number(totals.totalScheduled.toFixed(2)),
      totalActual: Number(totals.totalActual.toFixed(2)),
      totalCost: Number(totals.totalCost.toFixed(2)),
      paidHours: Number(totals.paidHours.toFixed(2)),
      unpaidHours: Number(totals.unpaidHours.toFixed(2)),
      workedDays: totals.workedDays,
      totalHours: Number(totals.totalHours.toFixed(2)),
    },
  };
}
