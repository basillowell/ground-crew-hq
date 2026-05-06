import { lazy, Suspense, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Download, Droplets, FileText, FlaskConical, MapPin, Play, Printer, Wind } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  reportCategories,
  type ChemicalApplicationLog,
  type ScheduleEntry,
  type WeatherDailyLog,
} from '@/data/seedData';
import { useAuth } from '@/contexts/AuthContext';
import {
  useApplicationAreas,
  useAssignmentsRange,
  useChemicalApplicationLogsRange,
  useChemicalApplicationTankMixItems,
  useChemicalProducts,
  useClockEventsRange,
  useEmployees,
  useScheduleEntriesRange,
  useTasks,
  useWeatherDailyLogsByIds,
  useWeatherDailyLogsRange,
  useWeatherLocations,
} from '@/lib/supabase-queries';
import { computeTimecardSummary } from '@/lib/laborMetrics';
import { supabase } from '@/lib/supabase';

const COLORS = ['hsl(152,55%,38%)', 'hsl(210,80%,52%)', 'hsl(38,92%,50%)', 'hsl(270,60%,55%)', 'hsl(0,0%,55%)'];
const LazyReportsCharts = lazy(() =>
  import('@/components/reports/ReportsCharts').then((module) => ({
    default: module.ReportsCharts,
  })),
);

function inRange(date: string, start: string, end: string) {
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
}

function downloadCsv(filename: string, rows: string[]) {
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  link.click();
}

function currentDateIso() {
  return new Date().toISOString().slice(0, 10);
}

function shiftHours(entry: ScheduleEntry) {
  const [startHour, startMinute] = entry.shiftStart.split(':').map(Number);
  const [endHour, endMinute] = entry.shiftEnd.split(':').map(Number);
  return Math.max(endHour * 60 + endMinute - (startHour * 60 + startMinute), 0) / 60;
}

function applicationHours(log: ChemicalApplicationLog) {
  const [startHour, startMinute] = log.startTime.split(':').map(Number);
  const [endHour, endMinute] = log.endTime.split(':').map(Number);
  return Math.max(endHour * 60 + endMinute - (startHour * 60 + startMinute), 0) / 60;
}

function reportDescription(report: string) {
  const map: Record<string, string> = {
    'Daily Labor Summary': 'See who was scheduled, how many hours were planned, and how much workboard activity was actually dispatched.',
    'Weekly Hours by Employee': 'Roll labor hours up by employee so the manager can review utilization instead of guessing from the board.',
    'Overtime Report': 'Flag long shift windows and crew members trending toward overloaded days.',
    'Labor Cost by Task': 'Tie assignment time to employee wage so labor planning reflects real task cost.',
    'Task Completion Rate': 'Compare planned task durations to assigned task time so recurring work can be tightened.',
    'Task Distribution': 'See which task categories are dominating the workboard in the selected date range.',
    'Area Coverage': 'Understand where the crew is working and how assignment minutes are spread by area.',
    'Chemical Application Log': 'Review chemical application records with weather context and applicator accountability.',
    'Rainfall History': 'Track rainfall totals by day and location for agronomic planning.',
    'Weather By Location': 'Compare weather conditions by property area rather than reading one generic station.',
    'ET Trend Summary': 'Surface evapotranspiration trends next to rainfall so irrigation and spray timing make sense together.',
    'Application Log Register': 'Generate a printable compliance-ready register of applications with tank mix detail and weather context.',
    'Product Usage Summary': 'Aggregate product usage across all logged applications to support inventory and reporting.',
    'Rainfall vs Application Window': 'See whether rainfall and ET lined up with application timing and treatment volume.',
  };
  return map[report] ?? 'Run operational reports that are driven by the real roster, schedule, workboard, weather, and application data inside the app.';
}

export default function ReportsPage() {
  const { currentPropertyId, orgId } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState(reportCategories[4] ?? reportCategories[0]);
  const [selectedReport, setSelectedReport] = useState((reportCategories[4] ?? reportCategories[0]).reports[0]);
  const [endDate, setEndDate] = useState(currentDateIso());
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 13);
    return date.toISOString().slice(0, 10);
  });
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [taskFilter, setTaskFilter] = useState('all');
  const [areaFilter, setAreaFilter] = useState('all');
  const [appliedStartDate, setAppliedStartDate] = useState(startDate);
  const [appliedEndDate, setAppliedEndDate] = useState(endDate);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const propertyId = currentPropertyId || 'all';
  const employeesQuery = useEmployees(propertyId);
  const scheduleEntriesQuery = useScheduleEntriesRange(appliedStartDate, appliedEndDate, propertyId);
  const assignmentsQuery = useAssignmentsRange(appliedStartDate, appliedEndDate, propertyId);
  const tasksQuery = useTasks(propertyId);
  const clockEventsRangeQuery = useClockEventsRange(appliedStartDate, appliedEndDate, propertyId);
  const applicationLogsQuery = useChemicalApplicationLogsRange(appliedStartDate, appliedEndDate, propertyId);
  const applicationLogs = applicationLogsQuery.data ?? [];
  const refWeatherLogIds = useMemo(
    () => [...new Set(applicationLogs.map((log) => log.weatherLogId).filter(Boolean) as string[])],
    [applicationLogs],
  );
  const weatherRangeQuery = useWeatherDailyLogsRange(appliedStartDate, appliedEndDate, propertyId);
  const weatherByIdQuery = useWeatherDailyLogsByIds(refWeatherLogIds);
  const weatherLogs = useMemo(() => {
    const map = new Map<string, WeatherDailyLog>();
    for (const log of weatherRangeQuery.data ?? []) map.set(log.id, log);
    for (const log of weatherByIdQuery.data ?? []) map.set(log.id, log);
    return [...map.values()];
  }, [weatherByIdQuery.data, weatherRangeQuery.data]);
  const weatherLocations = useWeatherLocations(propertyId).data ?? [];
  const applicationAreas = useApplicationAreas(propertyId).data ?? [];
  const chemicalProducts = useChemicalProducts().data ?? [];
  const tankMixItems = useChemicalApplicationTankMixItems().data ?? [];
  const employees = employeesQuery.data ?? [];
  const scheduleEntries = scheduleEntriesQuery.data ?? [];
  const assignments = assignmentsQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const hourlyRatesQuery = useQuery({
    queryKey: ['employee-hourly-rates', propertyId, orgId ?? 'all-orgs'],
    queryFn: async () => {
      if (!supabase) return new Map<string, number>();
      let query = supabase.from('employees').select('id, hourly_rate, wage, org_id, property_id');
      if (orgId) query = query.eq('org_id', orgId);
      if (propertyId && propertyId !== 'all') query = query.eq('property_id', propertyId);
      const { data, error } = await query;
      if (error) throw error;
      const rates = new Map<string, number>();
      for (const row of data ?? []) {
        const raw = row as { id: string; hourly_rate?: number | null; wage?: number | null };
        const value = Number(raw.hourly_rate ?? raw.wage ?? 0);
        rates.set(raw.id, Number.isFinite(value) ? value : 0);
      }
      return rates;
    },
    staleTime: 1000 * 60 * 5,
  });

  const filteredEmployees = useMemo(
    () => employees.filter((employee) => propertyId === 'all' || !propertyId || employee.propertyId === propertyId),
    [employees, propertyId],
  );

  const filteredEmployeeIds = useMemo(
    () => new Set(filteredEmployees.map((employee) => employee.id)),
    [filteredEmployees],
  );

  const filteredWeather = useMemo(
    () => weatherLogs.filter((log) => inRange(log.date, appliedStartDate, appliedEndDate)),
    [appliedEndDate, appliedStartDate, weatherLogs],
  );

  const filteredApplications = useMemo(
    () =>
      applicationLogs.filter((log) => {
        const matchesDate = inRange(log.applicationDate, appliedStartDate, appliedEndDate);
        const matchesProperty = filteredEmployeeIds.has(log.applicatorId);
        const matchesEmployee = employeeFilter === 'all' || log.applicatorId === employeeFilter;
        const matchesArea = areaFilter === 'all' || areaFilter === `app:${log.areaId}`;
        return matchesDate && matchesProperty && matchesEmployee && matchesArea;
      }),
    [appliedEndDate, appliedStartDate, applicationLogs, areaFilter, employeeFilter, filteredEmployeeIds],
  );

  const filteredClockEvents = useMemo(
    () => (clockEventsRangeQuery.data ?? []).filter((event) => filteredEmployeeIds.has(event.employeeId)),
    [clockEventsRangeQuery.data, filteredEmployeeIds],
  );

  const weatherByLocation = useMemo(() => {
    return weatherLocations.map((location) => {
      const logs = filteredWeather.filter((log) => log.locationId === location.id);
      const totalRainfall = logs.reduce((sum, log) => sum + log.rainfallTotal, 0);
      const avgTemp = logs.length ? logs.reduce((sum, log) => sum + log.temperature, 0) / logs.length : 0;
      const avgHumidity = logs.length ? logs.reduce((sum, log) => sum + log.humidity, 0) / logs.length : 0;
      return {
        location: location.name,
        rainfall: Number(totalRainfall.toFixed(2)),
        avgTemp: Number(avgTemp.toFixed(1)),
        avgHumidity: Number(avgHumidity.toFixed(1)),
      };
    });
  }, [filteredWeather]);

  const dailyOperations = useMemo(() => {
    const dateSet = new Set<string>([
      ...filteredWeather.map((log) => log.date),
      ...filteredApplications.map((log) => log.applicationDate),
    ]);

    return [...dateSet]
      .sort()
      .map((date) => {
        const weatherForDay = filteredWeather.filter((log) => log.date === date);
        const applicationsForDay = filteredApplications.filter((log) => log.applicationDate === date);
        const rainfall = weatherForDay.length
          ? weatherForDay.reduce((sum, log) => sum + log.rainfallTotal, 0) / weatherForDay.length
          : 0;
        const et = weatherForDay.length
          ? weatherForDay.reduce((sum, log) => sum + log.et, 0) / weatherForDay.length
          : 0;

        return {
          date: date.slice(5),
          rainfall: Number(rainfall.toFixed(2)),
          et: Number(et.toFixed(2)),
          applications: applicationsForDay.length,
          areaTreated: Number(applicationsForDay.reduce((sum, log) => sum + log.areaTreated, 0).toFixed(2)),
        };
      });
  }, [filteredApplications, filteredWeather]);

  const productUsage = useMemo(() => {
    const usage = new Map<string, number>();

    for (const item of tankMixItems) {
      const log = filteredApplications.find((entry) => entry.id === item.applicationLogId);
      if (!log) continue;
      usage.set(item.productId, (usage.get(item.productId) ?? 0) + item.totalQuantityUsed);
    }

    return chemicalProducts
      .map((product) => ({
        product: product.name,
        quantity: Number((usage.get(product.id) ?? 0).toFixed(2)),
      }))
      .filter((entry) => entry.quantity > 0);
  }, [filteredApplications, tankMixItems]);

  const applicationRows = useMemo(() => {
    return filteredApplications.map((log) => {
      const area = applicationAreas.find((entry) => entry.id === log.areaId);
      const applicator = filteredEmployees.find((employee) => employee.id === log.applicatorId);
      const relatedWeather = weatherLogs.find((entry) => entry.id === log.weatherLogId);
      const logMixItems = tankMixItems.filter((item) => item.applicationLogId === log.id);

      return {
        id: log.id,
        date: log.applicationDate,
        area: area?.name ?? 'Unknown area',
        applicator: applicator ? `${applicator.firstName} ${applicator.lastName}` : 'Unassigned',
        products: logMixItems
          .map((item) => chemicalProducts.find((product) => product.id === item.productId)?.name ?? 'Unknown')
          .join(', '),
        quantity: Number(logMixItems.reduce((sum, item) => sum + item.totalQuantityUsed, 0).toFixed(2)),
        rainfall: relatedWeather?.rainfallTotal ?? 0,
      };
    });
  }, [filteredApplications, filteredEmployees, tankMixItems, weatherLogs]);

  const totals = {
    rainfall: Number(filteredWeather.reduce((sum, log) => sum + log.rainfallTotal, 0).toFixed(2)),
    applications: filteredApplications.length,
    areaTreated: Number(filteredApplications.reduce((sum, log) => sum + log.areaTreated, 0).toFixed(2)),
    avgWind: filteredWeather.length
      ? Number((filteredWeather.reduce((sum, log) => sum + log.wind, 0) / filteredWeather.length).toFixed(1))
      : 0,
  };

  const filteredSchedules = useMemo(
    () =>
      scheduleEntries.filter(
        (entry) =>
          filteredEmployeeIds.has(entry.employeeId) &&
          inRange(entry.date, appliedStartDate, appliedEndDate) &&
          (employeeFilter === 'all' || entry.employeeId === employeeFilter),
      ),
    [appliedEndDate, appliedStartDate, employeeFilter, filteredEmployeeIds, scheduleEntries],
  );

  const filteredAssignments = useMemo(
    () =>
      assignments.filter((assignment) => {
        const matchesDate = inRange(assignment.date, appliedStartDate, appliedEndDate);
        const matchesProperty = filteredEmployeeIds.has(assignment.employeeId);
        const matchesEmployee = employeeFilter === 'all' || assignment.employeeId === employeeFilter;
        const matchesTask = taskFilter === 'all' || assignment.taskId === taskFilter;
        const matchesArea = areaFilter === 'all' || areaFilter === `work:${assignment.area}`;
        return matchesDate && matchesProperty && matchesEmployee && matchesTask && matchesArea;
      }),
    [appliedEndDate, appliedStartDate, areaFilter, assignments, employeeFilter, filteredEmployeeIds, taskFilter],
  );

  const dailyLabor = useMemo(() => {
    const dateSet = new Set<string>([
      ...filteredSchedules.map((entry) => entry.date),
      ...filteredAssignments.map((entry) => entry.date),
    ]);

    return [...dateSet].sort().map((date) => {
      const shifts = filteredSchedules.filter((entry) => entry.date === date && entry.status === 'scheduled');
      const todaysAssignments = filteredAssignments.filter((entry) => entry.date === date);
      const plannedHours = shifts.reduce((sum, entry) => {
        const [startHour, startMinute] = entry.shiftStart.split(':').map(Number);
        const [endHour, endMinute] = entry.shiftEnd.split(':').map(Number);
        return sum + (endHour * 60 + endMinute - (startHour * 60 + startMinute)) / 60;
      }, 0);

      return {
        date: date.slice(5),
        shifts: shifts.length,
        laborHours: Number(plannedHours.toFixed(1)),
        assignments: todaysAssignments.length,
      };
    });
  }, [filteredAssignments, filteredSchedules]);

  const taskTimeRows = useMemo(() => {
    return tasks
      .map((task) => {
        const taskAssignments = filteredAssignments.filter((assignment) => assignment.taskId === task.id);
        const assignedMinutes = taskAssignments.reduce((sum, assignment) => sum + assignment.duration, 0);
        const plannedMinutes = taskAssignments.length * task.duration;
        const varianceMinutes = assignedMinutes - plannedMinutes;
        const areas = [...new Set(taskAssignments.map((assignment) => assignment.area))];
        const completedCount = taskAssignments.filter((assignment) => assignment.status === 'completed').length;
        const inProgressCount = taskAssignments.filter((assignment) => assignment.status === 'in-progress').length;
        return {
          taskId: task.id,
          task: task.name,
          category: task.category,
          occurrences: taskAssignments.length,
          plannedMinutes,
          assignedMinutes,
          varianceMinutes,
          areas: areas.join(', '),
          completedCount,
          inProgressCount,
        };
      })
      .filter((entry) => entry.occurrences > 0)
      .sort((left, right) => right.assignedMinutes - left.assignedMinutes);
  }, [filteredAssignments, tasks]);

  const employeeHoursRows = useMemo(() => {
    return filteredEmployees
      .map((employee) => {
        const shifts = filteredSchedules.filter((entry) => entry.employeeId === employee.id && entry.status === 'scheduled');
        const employeeAssignments = filteredAssignments.filter((assignment) => assignment.employeeId === employee.id);
        const employeeApplications = filteredApplications.filter((log) => log.applicatorId === employee.id);
        const employeeClockEvents = filteredClockEvents.filter((event) => event.employeeId === employee.id);
        const timecard = computeTimecardSummary(employeeClockEvents, `${appliedEndDate}T23:59:59.999Z`);
        const hourlyRate = hourlyRatesQuery.data?.get(employee.id) ?? employee.wage;
        const scheduledHours = shifts.reduce((sum, entry) => sum + shiftHours(entry), 0);
        const assignedHours = employeeAssignments.reduce((sum, assignment) => sum + assignment.duration, 0) / 60;
        const applicationHoursTotal = employeeApplications.reduce((sum, log) => sum + applicationHours(log), 0);
        const actualWorkedHours = timecard.workedHours;
        const breakMinutes = timecard.breakMinutes;
        const utilizationBase = actualWorkedHours || scheduledHours;
        const utilization = utilizationBase > 0 ? (assignedHours / utilizationBase) * 100 : 0;
        return {
          employeeId: employee.id,
          employee: `${employee.firstName} ${employee.lastName}`,
          department: employee.department,
          group: employee.group,
          wage: hourlyRate,
          scheduledHours: Number(scheduledHours.toFixed(2)),
          assignedHours: Number(assignedHours.toFixed(2)),
          actualWorkedHours: Number(actualWorkedHours.toFixed(2)),
          applicationHours: Number(applicationHoursTotal.toFixed(2)),
          breakMinutes,
          assignmentCount: employeeAssignments.length,
          applicationCount: employeeApplications.length,
          utilization: Number(utilization.toFixed(1)),
          laborCost: Number(((actualWorkedHours || assignedHours) * hourlyRate).toFixed(2)),
        };
      })
      .filter((entry) => entry.scheduledHours > 0 || entry.assignmentCount > 0 || entry.applicationCount > 0 || entry.actualWorkedHours > 0)
      .sort((left, right) => (right.actualWorkedHours || right.scheduledHours) - (left.actualWorkedHours || left.scheduledHours));
  }, [appliedEndDate, filteredApplications, filteredAssignments, filteredClockEvents, filteredEmployees, filteredSchedules, hourlyRatesQuery.data]);

  const dollarsAndHoursRows = useMemo(() => {
    return filteredAssignments.map((assignment) => {
      const employee = filteredEmployees.find((entry) => entry.id === assignment.employeeId);
      const task = tasks.find((entry) => entry.id === assignment.taskId);
      const hourlyRate = hourlyRatesQuery.data?.get(assignment.employeeId) ?? employee?.wage ?? 0;
      const hours = assignment.duration / 60;
      return {
        id: assignment.id,
        date: assignment.date,
        employee: employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown employee',
        task: task?.name ?? 'Unknown task',
        taskGroup: task?.category ?? 'Uncategorized',
        hours: Number(hours.toFixed(2)),
        hourlyRate: Number(hourlyRate.toFixed(2)),
        laborCost: Number((hours * hourlyRate).toFixed(2)),
      };
    });
  }, [filteredAssignments, filteredEmployees, hourlyRatesQuery.data, tasks]);

  const taskTotalsByDateAndGroup = useMemo(() => {
    const grouped = new Map<string, { date: string; taskGroup: string; task: string; hours: number; assignments: number }>();
    for (const assignment of filteredAssignments) {
      const task = tasks.find((entry) => entry.id === assignment.taskId);
      const date = assignment.date;
      const taskGroup = task?.category ?? 'Uncategorized';
      const taskName = task?.name ?? 'Unknown task';
      const key = `${date}__${taskGroup}__${taskName}`;
      const existing = grouped.get(key) ?? { date, taskGroup, task: taskName, hours: 0, assignments: 0 };
      existing.hours += assignment.duration / 60;
      existing.assignments += 1;
      grouped.set(key, existing);
    }
    return [...grouped.values()]
      .map((row) => ({ ...row, hours: Number(row.hours.toFixed(2)) }))
      .sort((a, b) => `${a.date}${a.taskGroup}${a.task}`.localeCompare(`${b.date}${b.taskGroup}${b.task}`));
  }, [filteredAssignments, tasks]);

  const applicationsToHoursRows = useMemo(() => {
    return filteredApplications
      .map((log) => {
        const applicator = filteredEmployees.find((employee) => employee.id === log.applicatorId);
        const area = applicationAreas.find((entry) => entry.id === log.areaId);
        const relatedAssignments = filteredAssignments.filter(
          (assignment) =>
            assignment.date === log.applicationDate &&
            assignment.employeeId === log.applicatorId,
        );
        const applicatorShiftHours = filteredSchedules
          .filter(
            (entry) =>
              entry.date === log.applicationDate &&
              entry.employeeId === log.applicatorId &&
              entry.status === 'scheduled',
          )
          .reduce((sum, entry) => sum + shiftHours(entry), 0);
        const totalQuantity = tankMixItems
          .filter((item) => item.applicationLogId === log.id)
          .reduce((sum, item) => sum + item.totalQuantityUsed, 0);
        const appliedHours = applicationHours(log);
        return {
          id: log.id,
          date: log.applicationDate,
          applicator: applicator ? `${applicator.firstName} ${applicator.lastName}` : 'Unassigned',
          area: area?.name ?? 'Unknown area',
          appliedHours: Number(appliedHours.toFixed(2)),
          scheduledHours: Number(applicatorShiftHours.toFixed(2)),
          assignmentHoursSameDay: Number((relatedAssignments.reduce((sum, assignment) => sum + assignment.duration, 0) / 60).toFixed(2)),
          totalQuantity: Number(totalQuantity.toFixed(2)),
          areaTreated: `${log.areaTreated} ${log.areaUnit}`,
        };
      })
      .sort((left, right) => `${right.date}${right.applicator}`.localeCompare(`${left.date}${left.applicator}`));
  }, [applicationAreas, filteredApplications, filteredAssignments, filteredEmployees, filteredSchedules, tankMixItems]);

  const taskDistribution = useMemo(() => {
    return tasks
      .map((task) => ({
        name: task.name,
        value: filteredAssignments.filter((assignment) => assignment.taskId === task.id).length,
      }))
      .filter((entry) => entry.value > 0)
      .slice(0, 6);
  }, [filteredAssignments, tasks]);

  const workforceTotals = {
    scheduledCrew: new Set(filteredSchedules.filter((entry) => entry.status === 'scheduled').map((entry) => entry.employeeId)).size,
    assignments: filteredAssignments.length,
    activeEmployees: filteredEmployees.filter((employee) => employee.status === 'active').length,
  };

  const summaryMetrics = {
    totalApplicationHours: Number(applicationsToHoursRows.reduce((sum, row) => sum + row.appliedHours, 0).toFixed(2)),
    totalAssignedHours: Number((filteredAssignments.reduce((sum, assignment) => sum + assignment.duration, 0) / 60).toFixed(2)),
    totalWorkedHours: Number(employeeHoursRows.reduce((sum, row) => sum + row.actualWorkedHours, 0).toFixed(2)),
    totalBreakMinutes: employeeHoursRows.reduce((sum, row) => sum + row.breakMinutes, 0),
    totalScheduledHours: Number(filteredSchedules.reduce((sum, entry) => sum + shiftHours(entry), 0).toFixed(2)),
    totalTaskMinutes: taskTimeRows.reduce((sum, row) => sum + row.assignedMinutes, 0),
  };

  const reportAreaOptions = useMemo(() => {
    const workAreas = [...new Set(assignments.map((assignment) => assignment.area).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right))
      .map((area) => ({ value: `work:${area}`, label: `${area} (workboard)` }));
    const appAreas = applicationAreas
      .map((area) => ({ value: `app:${area.id}`, label: `${area.name} (applications)` }))
      .sort((left, right) => left.label.localeCompare(right.label));
    return [...workAreas, ...appAreas];
  }, [applicationAreas, assignments]);

  const requiredReportsLoading =
    employeesQuery.isLoading ||
    scheduleEntriesQuery.isLoading ||
    assignmentsQuery.isLoading ||
    tasksQuery.isLoading ||
    hourlyRatesQuery.isLoading;
  const requiredReportsError =
    employeesQuery.error ||
    scheduleEntriesQuery.error ||
    assignmentsQuery.error ||
    tasksQuery.error ||
    hourlyRatesQuery.error;
  const hasRequiredRows =
    dollarsAndHoursRows.length > 0 ||
    taskTotalsByDateAndGroup.length > 0 ||
    employeeHoursRows.length > 0;

  function handleExportCsv() {
    if (selectedReport === 'Labor Cost by Task' || selectedReport === 'Dollars and Hours') {
      const rows = [
        'date,employee,task,task_group,hours,hourly_rate,labor_cost',
        ...dollarsAndHoursRows.map((row) =>
          [row.date, row.employee, row.task, row.taskGroup, row.hours, row.hourlyRate, row.laborCost].join(','),
        ),
      ];
      downloadCsv(`dollars-hours-${appliedStartDate}-${appliedEndDate}.csv`, rows);
      return;
    }
    if (selectedReport === 'Task Distribution' || selectedReport === 'Task Totals by Date and Group') {
      const rows = [
        'date,task_group,task,hours,assignments',
        ...taskTotalsByDateAndGroup.map((row) =>
          [row.date, row.taskGroup, row.task, row.hours, row.assignments].join(','),
        ),
      ];
      downloadCsv(`task-totals-${appliedStartDate}-${appliedEndDate}.csv`, rows);
      return;
    }
    if (selectedReport === 'Weekly Hours by Employee' || selectedReport === 'Employee Hours Summary') {
      const rows = [
        'employee,department,group,scheduled_hours,worked_hours,assigned_hours,labor_cost',
        ...employeeHoursRows.map((row) =>
          [row.employee, row.department, row.group, row.scheduledHours, row.actualWorkedHours, row.assignedHours, row.laborCost].join(','),
        ),
      ];
      downloadCsv(`employee-hours-${appliedStartDate}-${appliedEndDate}.csv`, rows);
      return;
    }
    const rows = [
      'date,area,applicator,products,total_quantity,rainfall',
      ...applicationRows.map((row) =>
        [row.date, row.area, row.applicator, `"${row.products}"`, row.quantity, row.rainfall].join(','),
      ),
    ];
    downloadCsv(`applications-and-weather-${appliedStartDate}-${appliedEndDate}.csv`, rows);
  }

  function handlePdfAction() {
    window.print();
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.08),_transparent_30%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(244,247,245,1))]">
      <div className="w-72 border-r bg-card/90 backdrop-blur overflow-auto p-4">
        <h3 className="text-sm font-semibold mb-3">Report Categories</h3>
        {reportCategories.map((category) => (
          <div key={category.id} className="mb-4">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.18em] mb-1.5">
              {category.name}
            </div>
            {category.reports.map((report) => (
              <div
                key={report}
                onClick={() => {
                  setSelectedCategory(category);
                  setSelectedReport(report);
                }}
                className={`rounded-xl px-3 py-2 text-xs cursor-pointer transition-all ${
                  selectedReport === report
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {report}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-5">
        <div className="mb-5 rounded-3xl border bg-card/90 backdrop-blur p-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {selectedCategory.name}
                </Badge>
                <Badge className="rounded-full px-3 py-1 bg-primary/10 text-primary hover:bg-primary/10">
                  Cross-module reporting
                </Badge>
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">{selectedReport}</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
                {reportDescription(selectedReport)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-2xl border bg-background px-3 py-2">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-7 w-32 border-0 bg-transparent px-1 text-xs shadow-none" />
                <span className="text-xs text-muted-foreground">to</span>
                <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="h-7 w-32 border-0 bg-transparent px-1 text-xs shadow-none" />
              </div>
              <Button
                size="sm"
                className="gap-1 text-xs rounded-xl"
                onClick={() => {
                  if (!startDate || !endDate || startDate > endDate) return;
                  setAppliedStartDate(startDate);
                  setAppliedEndDate(endDate);
                  setGeneratedAt(new Date().toISOString());
                }}
                disabled={!startDate || !endDate || startDate > endDate}
              >
                <Play className="h-3 w-3" />
                Run
              </Button>
              <Button variant="outline" size="sm" className="gap-1 text-xs rounded-xl" onClick={handleExportCsv}>
                <Download className="h-3 w-3" />
                CSV
              </Button>
              <Button variant="outline" size="sm" className="gap-1 text-xs rounded-xl" onClick={handlePdfAction}>
                <FileText className="h-3 w-3" />
                PDF
              </Button>
              <Button variant="outline" size="sm" className="gap-1 text-xs rounded-xl" onClick={() => window.print()}>
                <Printer className="h-3 w-3" />
                Print
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-4">
            <div className="rounded-2xl border bg-background/80 p-3">
              <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Employee</label>
              <select
                value={employeeFilter}
                onChange={(event) => setEmployeeFilter(event.target.value)}
                className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">All employees</option>
                {filteredEmployees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.firstName} {employee.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-2xl border bg-background/80 p-3">
              <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Task</label>
              <select
                value={taskFilter}
                onChange={(event) => setTaskFilter(event.target.value)}
                className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">All tasks</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-2xl border bg-background/80 p-3">
              <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Application area</label>
              <select
                value={areaFilter}
                onChange={(event) => setAreaFilter(event.target.value)}
                className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">All areas</option>
                {reportAreaOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-2xl border bg-background/80 p-3">
              <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Report focus</label>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline">{selectedCategory.name}</Badge>
                <Badge variant="outline">{filteredAssignments.length} assignments</Badge>
                <Badge variant="outline">{filteredApplications.length} applications</Badge>
                {generatedAt ? <Badge variant="outline">Generated {new Date(generatedAt).toLocaleString()}</Badge> : null}
              </div>
            </div>
          </div>
        </div>

        <div className="mb-5 rounded-3xl border bg-card/90 backdrop-blur p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Core Labor Reports</h3>
            <Badge variant="secondary">{appliedStartDate} to {appliedEndDate}</Badge>
          </div>
          {requiredReportsLoading ? (
            <div className="flex items-center justify-center p-8">
              <Skeleton className="h-12 w-full max-w-sm rounded-xl" />
            </div>
          ) : requiredReportsError ? (
            <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
              Report query failed. Check Supabase connectivity and click Run again.
            </div>
          ) : !hasRequiredRows ? (
            <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
              No labor data found in this date range yet.
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-3">
              <Card className="rounded-2xl p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Dollars and Hours</div>
                <div className="mt-2 text-2xl font-semibold">
                  ${dollarsAndHoursRows.reduce((sum, row) => sum + row.laborCost, 0).toFixed(2)}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {dollarsAndHoursRows.reduce((sum, row) => sum + row.hours, 0).toFixed(2)} total labor hours
                </p>
              </Card>
              <Card className="rounded-2xl p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Task Totals by Date and Group</div>
                <div className="mt-2 text-2xl font-semibold">{taskTotalsByDateAndGroup.length}</div>
                <p className="mt-1 text-xs text-muted-foreground">Grouped rows across date / task group / task</p>
              </Card>
              <Card className="rounded-2xl p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Employee Hours Summary</div>
                <div className="mt-2 text-2xl font-semibold">{employeeHoursRows.length}</div>
                <p className="mt-1 text-xs text-muted-foreground">Employees with scheduled, assigned, or worked hours</p>
              </Card>
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mb-5">
          <Card className="rounded-3xl border-0 bg-card/90 backdrop-blur p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Rainfall Total</span>
              <Droplets className="h-4 w-4 text-primary" />
            </div>
            <div className="text-3xl font-semibold">{totals.rainfall}"</div>
            <p className="text-xs text-muted-foreground mt-1">Across all logged weather locations in this date range.</p>
          </Card>
          <Card className="rounded-3xl border-0 bg-card/90 backdrop-blur p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Applications Logged</span>
              <FlaskConical className="h-4 w-4 text-chart-orange" />
            </div>
            <div className="text-3xl font-semibold">{totals.applications}</div>
            <p className="text-xs text-muted-foreground mt-1">Includes tank mix records and linked weather snapshots.</p>
          </Card>
          <Card className="rounded-3xl border-0 bg-card/90 backdrop-blur p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Area Treated</span>
              <MapPin className="h-4 w-4 text-chart-blue" />
            </div>
            <div className="text-3xl font-semibold">{totals.areaTreated}</div>
            <p className="text-xs text-muted-foreground mt-1">Total acres or mapped units treated in selected range.</p>
          </Card>
          <Card className="rounded-3xl border-0 bg-card/90 backdrop-blur p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Average Wind</span>
              <Wind className="h-4 w-4 text-chart-purple" />
            </div>
            <div className="text-3xl font-semibold">{totals.avgWind} mph</div>
            <p className="text-xs text-muted-foreground mt-1">Quick spray-window context pulled from linked weather logs.</p>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-5">
          <Card className="rounded-3xl border-0 bg-card/90 backdrop-blur p-5 shadow-sm">
            <div className="text-sm text-muted-foreground mb-1">Scheduled crew</div>
            <div className="text-3xl font-semibold">{workforceTotals.scheduledCrew}</div>
            <p className="text-xs text-muted-foreground mt-1">Employees with scheduled shifts in the selected date window.</p>
          </Card>
          <Card className="rounded-3xl border-0 bg-card/90 backdrop-blur p-5 shadow-sm">
            <div className="text-sm text-muted-foreground mb-1">Task assignments</div>
            <div className="text-3xl font-semibold">{workforceTotals.assignments}</div>
            <p className="text-xs text-muted-foreground mt-1">Workboard assignments now feed into operational reporting.</p>
          </Card>
          <Card className="rounded-3xl border-0 bg-card/90 backdrop-blur p-5 shadow-sm">
            <div className="text-sm text-muted-foreground mb-1">Active roster</div>
            <div className="text-3xl font-semibold">{workforceTotals.activeEmployees}</div>
            <p className="text-xs text-muted-foreground mt-1">Live employee roster count from the shared workforce store.</p>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-5">
          <Card className="rounded-3xl border-0 bg-card/90 backdrop-blur p-5 shadow-sm">
            <div className="text-sm text-muted-foreground mb-1">Applications to Hours</div>
            <div className="text-3xl font-semibold">
              {(summaryMetrics.totalWorkedHours || summaryMetrics.totalScheduledHours) > 0
                ? `${((summaryMetrics.totalApplicationHours / (summaryMetrics.totalWorkedHours || summaryMetrics.totalScheduledHours)) * 100).toFixed(1)}%`
                : '0%'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Application hours compared to actual worked hours when clock data exists.</p>
          </Card>
          <Card className="rounded-3xl border-0 bg-card/90 backdrop-blur p-5 shadow-sm">
            <div className="text-sm text-muted-foreground mb-1">Task Time Logged</div>
            <div className="text-3xl font-semibold">{summaryMetrics.totalAssignedHours.toFixed(1)}h</div>
            <p className="text-xs text-muted-foreground mt-1">Total workboard task time taken from assignment rows, not generic placeholders.</p>
          </Card>
          <Card className="rounded-3xl border-0 bg-card/90 backdrop-blur p-5 shadow-sm">
            <div className="text-sm text-muted-foreground mb-1">Worked / Break</div>
            <div className="text-3xl font-semibold">{summaryMetrics.totalWorkedHours.toFixed(1)}h</div>
            <p className="text-xs text-muted-foreground mt-1">{summaryMetrics.totalBreakMinutes} logged break minutes across the selected labor window.</p>
          </Card>
        </div>

        <Suspense
          fallback={
            <div className="grid gap-4 xl:grid-cols-2 mb-5">
              {Array.from({ length: 4 }).map((_, index) => (
                <Card key={index} className="rounded-3xl border-0 bg-card/90 backdrop-blur p-5 shadow-sm">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="mt-3 h-3 w-64" />
                  <Skeleton className="mt-6 h-[260px] w-full rounded-2xl" />
                </Card>
              ))}
            </div>
          }
        >
          <LazyReportsCharts
            colors={COLORS}
            dailyOperations={dailyOperations}
            productUsage={productUsage}
            dailyLabor={dailyLabor}
            weatherByLocation={weatherByLocation}
            taskDistribution={taskDistribution}
          />
        </Suspense>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr] mb-5">
          <Card className="rounded-3xl border-0 bg-card/90 backdrop-blur p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-sm font-semibold">Applications to Hours</h3>
                <p className="text-xs text-muted-foreground">Tie chemical applications back to applicator shifts and same-day task load.</p>
              </div>
              <Badge variant="secondary" className="rounded-full px-3 py-1">
                {applicationsToHoursRows.length} application rows
              </Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    <th className="px-3 py-3 font-medium">Date</th>
                    <th className="px-3 py-3 font-medium">Applicator</th>
                    <th className="px-3 py-3 font-medium">Area</th>
                    <th className="px-3 py-3 font-medium">App Hrs</th>
                    <th className="px-3 py-3 font-medium">Shift Hrs</th>
                    <th className="px-3 py-3 font-medium">Task Hrs</th>
                    <th className="px-3 py-3 font-medium">Qty Used</th>
                  </tr>
                </thead>
                <tbody>
                  {applicationsToHoursRows.map((row) => (
                    <tr key={row.id} className="border-b last:border-b-0">
                      <td className="px-3 py-3">{row.date}</td>
                      <td className="px-3 py-3">{row.applicator}</td>
                      <td className="px-3 py-3">{row.area}</td>
                      <td className="px-3 py-3">{row.appliedHours}</td>
                      <td className="px-3 py-3">{row.scheduledHours}</td>
                      <td className="px-3 py-3">{row.assignmentHoursSameDay}</td>
                      <td className="px-3 py-3">{row.totalQuantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="rounded-3xl border-0 bg-card/90 backdrop-blur p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-sm font-semibold">Task Time Taken</h3>
                <p className="text-xs text-muted-foreground">Compare expected task duration to actual assignment time from the live workboard.</p>
              </div>
              <Badge variant="secondary" className="rounded-full px-3 py-1">
                {taskTimeRows.length} tracked tasks
              </Badge>
            </div>
            <div className="space-y-3">
              {taskTimeRows.slice(0, 8).map((row) => (
                <div key={row.taskId} className="rounded-2xl border bg-background/70 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{row.task}</div>
                      <div className="text-xs text-muted-foreground">{row.category} {row.areas ? `· ${row.areas}` : ''}</div>
                    </div>
                    <Badge variant={row.varianceMinutes > 0 ? 'destructive' : 'outline'}>
                      {row.varianceMinutes > 0 ? `+${row.varianceMinutes}` : row.varianceMinutes} min
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-xl bg-muted/50 px-3 py-2">
                      <div className="text-muted-foreground">Occurrences</div>
                      <div className="mt-1 font-semibold">{row.occurrences}</div>
                    </div>
                    <div className="rounded-xl bg-muted/50 px-3 py-2">
                      <div className="text-muted-foreground">Planned</div>
                      <div className="mt-1 font-semibold">{row.plannedMinutes} min</div>
                    </div>
                    <div className="rounded-xl bg-muted/50 px-3 py-2">
                      <div className="text-muted-foreground">Assigned / Done</div>
                      <div className="mt-1 font-semibold">{row.assignedMinutes} min / {row.completedCount}</div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {row.inProgressCount} in progress right now
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card className="rounded-3xl border-0 bg-card/90 backdrop-blur p-5 shadow-sm mb-5">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-sm font-semibold">Hours by Employee</h3>
              <p className="text-xs text-muted-foreground">This is the workforce-specific layer the app was missing: scheduled hours, task hours, application hours, utilization, and labor cost together.</p>
            </div>
            <Badge variant="secondary" className="rounded-full px-3 py-1">
              {employeeHoursRows.length} employees
            </Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  <th className="px-3 py-3 font-medium">Employee</th>
                  <th className="px-3 py-3 font-medium">Dept / Group</th>
                  <th className="px-3 py-3 font-medium">Scheduled Hrs</th>
                  <th className="px-3 py-3 font-medium">Worked Hrs</th>
                  <th className="px-3 py-3 font-medium">Task Hrs</th>
                  <th className="px-3 py-3 font-medium">App Hrs</th>
                  <th className="px-3 py-3 font-medium">Break Min</th>
                  <th className="px-3 py-3 font-medium">Utilization</th>
                  <th className="px-3 py-3 font-medium">Labor Cost</th>
                </tr>
              </thead>
              <tbody>
                {employeeHoursRows.map((row) => (
                  <tr key={row.employeeId} className="border-b last:border-b-0">
                    <td className="px-3 py-3">{row.employee}</td>
                    <td className="px-3 py-3 text-muted-foreground">{row.department} / {row.group}</td>
                    <td className="px-3 py-3">{row.scheduledHours}</td>
                    <td className="px-3 py-3">{row.actualWorkedHours}</td>
                    <td className="px-3 py-3">{row.assignedHours}</td>
                    <td className="px-3 py-3">{row.applicationHours}</td>
                    <td className="px-3 py-3">{row.breakMinutes}</td>
                    <td className="px-3 py-3">
                      <Badge variant={row.utilization >= 85 ? 'default' : 'outline'}>{row.utilization}%</Badge>
                    </td>
                    <td className="px-3 py-3">${row.laborCost.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="rounded-3xl border-0 bg-card/90 backdrop-blur p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-sm font-semibold">Application Register with Weather Context</h3>
              <p className="text-xs text-muted-foreground">Printable layout for compliance reviews, superintendent sign-off, and audits.</p>
            </div>
            <Badge variant="secondary" className="rounded-full px-3 py-1">
              {applicationRows.length} rows
            </Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  <th className="px-3 py-3 font-medium">Date</th>
                  <th className="px-3 py-3 font-medium">Area</th>
                  <th className="px-3 py-3 font-medium">Applicator</th>
                  <th className="px-3 py-3 font-medium">Products</th>
                  <th className="px-3 py-3 font-medium">Quantity</th>
                  <th className="px-3 py-3 font-medium">Rainfall</th>
                </tr>
              </thead>
              <tbody>
                {applicationRows.map((row) => (
                  <tr key={row.id} className="border-b last:border-b-0">
                    <td className="px-3 py-3">{row.date}</td>
                    <td className="px-3 py-3">{row.area}</td>
                    <td className="px-3 py-3">{row.applicator}</td>
                    <td className="px-3 py-3 text-muted-foreground">{row.products}</td>
                    <td className="px-3 py-3">{row.quantity}</td>
                    <td className="px-3 py-3">
                      <Badge variant="outline" className="rounded-full">
                        {row.rainfall}"
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
