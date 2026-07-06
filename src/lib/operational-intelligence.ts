import type { Assignment, Employee, Property, ScheduleEntry } from '@/data/seedData';

type CompletionStatus = {
  key: string;
  label: string;
  complete: boolean;
  detail: string;
};

export type WorkforceReadinessSummary = {
  score: number;
  activeCrew: number;
  configuredDepartments: number;
  configuredRoles: number;
  statuses: CompletionStatus[];
};

export type ScheduleCoverageSummary = {
  score: number;
  scheduledEmployees: number;
  totalActiveEmployees: number;
  coveragePct: number;
  uncoveredEmployees: number;
};

export type LaborAllocationSummary = {
  scheduledHours: number;
  assignedHours: number;
  utilizationPct: number;
  overAllocatedEmployees: number;
};

export type PropertyStaffingSummary = {
  propertyId: string;
  propertyName: string;
  activeCrew: number;
  scheduledCrew: number;
  assignedCrew: number;
};


function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function computeWorkforceReadiness(input: {
  activeCrewCount: number;
  departmentsCount: number;
  rolesCount: number;
  workerTypesCount: number;
  shiftTemplatesCount: number;
}): WorkforceReadinessSummary {
  const statuses: CompletionStatus[] = [
    {
      key: 'workforce',
      label: 'Workforce configured',
      complete: input.rolesCount > 0 && input.workerTypesCount > 0,
      detail: `${input.rolesCount} roles · ${input.workerTypesCount} worker types`,
    },
    {
      key: 'scheduling',
      label: 'Scheduling configured',
      complete: input.shiftTemplatesCount > 0,
      detail: `${input.shiftTemplatesCount} shift templates`,
    },
    {
      key: 'organization',
      label: 'Departments configured',
      complete: input.departmentsCount > 0,
      detail: `${input.departmentsCount} departments`,
    },
    {
      key: 'crew',
      label: 'Active crew available',
      complete: input.activeCrewCount > 0,
      detail: `${input.activeCrewCount} active employees`,
    },
  ];
  const completed = statuses.filter((entry) => entry.complete).length;
  return {
    score: clampScore((completed / statuses.length) * 100),
    activeCrew: input.activeCrewCount,
    configuredDepartments: input.departmentsCount,
    configuredRoles: input.rolesCount,
    statuses,
  };
}

export function computeScheduleCoverage(params: {
  employees: Employee[];
  scheduleEntries: ScheduleEntry[];
  date: string;
}): ScheduleCoverageSummary {
  const activeEmployees = params.employees.filter((entry) => entry.status === 'active');
  const scheduled = new Set(
    params.scheduleEntries
      .filter((entry) => entry.date === params.date && entry.status === 'scheduled')
      .map((entry) => entry.employeeId),
  );
  const scheduledEmployees = activeEmployees.filter((entry) => scheduled.has(entry.id)).length;
  const totalActiveEmployees = activeEmployees.length;
  const coveragePct = totalActiveEmployees > 0 ? (scheduledEmployees / totalActiveEmployees) * 100 : 0;
  return {
    score: clampScore(coveragePct),
    scheduledEmployees,
    totalActiveEmployees,
    coveragePct: Math.round(coveragePct),
    uncoveredEmployees: Math.max(totalActiveEmployees - scheduledEmployees, 0),
  };
}

function shiftHours(entry: ScheduleEntry) {
  const [startHour, startMinute] = entry.shiftStart.split(':').map(Number);
  const [endHour, endMinute] = entry.shiftEnd.split(':').map(Number);
  return Math.max(((endHour * 60 + endMinute) - (startHour * 60 + startMinute)) / 60, 0);
}

export function computeLaborAllocation(params: {
  scheduleEntries: ScheduleEntry[];
  assignments: Assignment[];
  date: string;
}): LaborAllocationSummary {
  const shiftByEmployee = new Map<string, number>();
  params.scheduleEntries
    .filter((entry) => entry.date === params.date && entry.status === 'scheduled')
    .forEach((entry) => {
      shiftByEmployee.set(entry.employeeId, shiftHours(entry));
    });

  const assignmentByEmployee = new Map<string, number>();
  params.assignments
    .filter((entry) => entry.date === params.date)
    .forEach((entry) => {
      assignmentByEmployee.set(entry.employeeId, (assignmentByEmployee.get(entry.employeeId) ?? 0) + entry.duration / 60);
    });

  const scheduledHours = [...shiftByEmployee.values()].reduce((sum, value) => sum + value, 0);
  const assignedHours = [...assignmentByEmployee.values()].reduce((sum, value) => sum + value, 0);
  const overAllocatedEmployees = [...assignmentByEmployee.entries()].filter(
    ([employeeId, assigned]) => assigned > (shiftByEmployee.get(employeeId) ?? 0),
  ).length;

  return {
    scheduledHours: Number(scheduledHours.toFixed(1)),
    assignedHours: Number(assignedHours.toFixed(1)),
    utilizationPct: scheduledHours > 0 ? Math.round((assignedHours / scheduledHours) * 100) : 0,
    overAllocatedEmployees,
  };
}

export function computePropertyStaffingSummary(params: {
  properties: Property[];
  employees: Employee[];
  scheduleEntries: ScheduleEntry[];
  assignments: Assignment[];
  date: string;
}): PropertyStaffingSummary[] {
  return params.properties.map((property) => {
    const propertyEmployees = params.employees.filter((entry) => entry.propertyId === property.id && entry.status === 'active');
    const employeeIds = new Set(propertyEmployees.map((entry) => entry.id));
    const scheduledCrew = new Set(
      params.scheduleEntries
        .filter((entry) => entry.date === params.date && entry.status === 'scheduled' && employeeIds.has(entry.employeeId))
        .map((entry) => entry.employeeId),
    ).size;
    const assignedCrew = new Set(
      params.assignments
        .filter((entry) => entry.date === params.date && employeeIds.has(entry.employeeId))
        .map((entry) => entry.employeeId),
    ).size;
    return {
      propertyId: property.id,
      propertyName: property.name,
      activeCrew: propertyEmployees.length,
      scheduledCrew,
      assignedCrew,
    };
  });
}

