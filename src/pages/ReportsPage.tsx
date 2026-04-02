import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from 'recharts';
import { Calendar, Download, Droplets, FileText, FlaskConical, MapPin, Play, Printer, Wind } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  reportCategories,
  type ApplicationArea,
  type Assignment,
  type ChemicalApplicationLog,
  type ChemicalApplicationTankMixItem,
  type ChemicalProduct,
  type Employee,
  type ScheduleEntry,
  type Task,
  type WeatherDailyLog,
  type WeatherLocation,
} from '@/data/seedData';
import {
  loadApplicationAreas,
  loadAssignments,
  loadChemicalApplicationLogs,
  loadChemicalApplicationTankMixItems,
  loadChemicalProducts,
  loadEmployees,
  loadScheduleEntries,
  loadTasks,
  loadWeatherDailyLogs,
  loadWeatherLocations,
} from '@/lib/dataStore';

const COLORS = ['hsl(152,55%,38%)', 'hsl(210,80%,52%)', 'hsl(38,92%,50%)', 'hsl(270,60%,55%)', 'hsl(0,0%,55%)'];

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
  const [weatherLogs, setWeatherLogs] = useState<WeatherDailyLog[]>([]);
  const [weatherLocations, setWeatherLocations] = useState<WeatherLocation[]>([]);
  const [applicationLogs, setApplicationLogs] = useState<ChemicalApplicationLog[]>([]);
  const [applicationAreas, setApplicationAreas] = useState<ApplicationArea[]>([]);
  const [chemicalProducts, setChemicalProducts] = useState<ChemicalProduct[]>([]);
  const [tankMixItems, setTankMixItems] = useState<ChemicalApplicationTankMixItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    setWeatherLogs(loadWeatherDailyLogs());
    setWeatherLocations(loadWeatherLocations());
    setApplicationLogs(loadChemicalApplicationLogs());
    setApplicationAreas(loadApplicationAreas());
    setChemicalProducts(loadChemicalProducts());
    setTankMixItems(loadChemicalApplicationTankMixItems());
    setEmployees(loadEmployees());
    setScheduleEntries(loadScheduleEntries());
    setAssignments(loadAssignments());
    setTasks(loadTasks());
  }, []);

  const filteredWeather = useMemo(
    () => weatherLogs.filter((log) => inRange(log.date, startDate, endDate)),
    [endDate, startDate, weatherLogs],
  );

  const filteredApplications = useMemo(
    () =>
      applicationLogs.filter((log) => {
        const matchesDate = inRange(log.applicationDate, startDate, endDate);
        const matchesEmployee = employeeFilter === 'all' || log.applicatorId === employeeFilter;
        const matchesArea = areaFilter === 'all' || areaFilter === `app:${log.areaId}`;
        return matchesDate && matchesEmployee && matchesArea;
      }),
    [applicationLogs, areaFilter, employeeFilter, endDate, startDate],
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
      const applicator = employees.find((employee) => employee.id === log.applicatorId);
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
  }, [filteredApplications, tankMixItems, weatherLogs]);

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
          inRange(entry.date, startDate, endDate) &&
          (employeeFilter === 'all' || entry.employeeId === employeeFilter),
      ),
    [employeeFilter, endDate, scheduleEntries, startDate],
  );

  const filteredAssignments = useMemo(
    () =>
      assignments.filter((assignment) => {
        const matchesDate = inRange(assignment.date, startDate, endDate);
        const matchesEmployee = employeeFilter === 'all' || assignment.employeeId === employeeFilter;
        const matchesTask = taskFilter === 'all' || assignment.taskId === taskFilter;
        const matchesArea = areaFilter === 'all' || areaFilter === `work:${assignment.area}`;
        return matchesDate && matchesEmployee && matchesTask && matchesArea;
      }),
    [areaFilter, assignments, employeeFilter, endDate, startDate, taskFilter],
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
        return {
          taskId: task.id,
          task: task.name,
          category: task.category,
          occurrences: taskAssignments.length,
          plannedMinutes,
          assignedMinutes,
          varianceMinutes,
          areas: areas.join(', '),
        };
      })
      .filter((entry) => entry.occurrences > 0)
      .sort((left, right) => right.assignedMinutes - left.assignedMinutes);
  }, [filteredAssignments, tasks]);

  const employeeHoursRows = useMemo(() => {
    return employees
      .map((employee) => {
        const shifts = filteredSchedules.filter((entry) => entry.employeeId === employee.id && entry.status === 'scheduled');
        const employeeAssignments = filteredAssignments.filter((assignment) => assignment.employeeId === employee.id);
        const employeeApplications = filteredApplications.filter((log) => log.applicatorId === employee.id);
        const scheduledHours = shifts.reduce((sum, entry) => sum + shiftHours(entry), 0);
        const assignedHours = employeeAssignments.reduce((sum, assignment) => sum + assignment.duration, 0) / 60;
        const applicationHoursTotal = employeeApplications.reduce((sum, log) => sum + applicationHours(log), 0);
        const utilization = scheduledHours > 0 ? (assignedHours / scheduledHours) * 100 : 0;
        return {
          employeeId: employee.id,
          employee: `${employee.firstName} ${employee.lastName}`,
          department: employee.department,
          group: employee.group,
          wage: employee.wage,
          scheduledHours: Number(scheduledHours.toFixed(2)),
          assignedHours: Number(assignedHours.toFixed(2)),
          applicationHours: Number(applicationHoursTotal.toFixed(2)),
          assignmentCount: employeeAssignments.length,
          applicationCount: employeeApplications.length,
          utilization: Number(utilization.toFixed(1)),
          laborCost: Number((assignedHours * employee.wage).toFixed(2)),
        };
      })
      .filter((entry) => entry.scheduledHours > 0 || entry.assignmentCount > 0 || entry.applicationCount > 0)
      .sort((left, right) => right.scheduledHours - left.scheduledHours);
  }, [employees, filteredApplications, filteredAssignments, filteredSchedules]);

  const applicationsToHoursRows = useMemo(() => {
    return filteredApplications
      .map((log) => {
        const applicator = employees.find((employee) => employee.id === log.applicatorId);
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
  }, [applicationAreas, employees, filteredApplications, filteredAssignments, filteredSchedules, tankMixItems]);

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
    activeEmployees: employees.filter((employee) => employee.status === 'active').length,
  };

  const summaryMetrics = {
    totalApplicationHours: Number(applicationsToHoursRows.reduce((sum, row) => sum + row.appliedHours, 0).toFixed(2)),
    totalAssignedHours: Number((filteredAssignments.reduce((sum, assignment) => sum + assignment.duration, 0) / 60).toFixed(2)),
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

  function handleExportCsv() {
    const rows = [
      'date,area,applicator,products,total_quantity,rainfall',
      ...applicationRows.map((row) =>
        [row.date, row.area, row.applicator, `"${row.products}"`, row.quantity, row.rainfall].join(','),
      ),
    ];
    downloadCsv('applications-and-weather-report.csv', rows);
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
              <Button size="sm" className="gap-1 text-xs rounded-xl">
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
                {employees.map((employee) => (
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
              </div>
            </div>
          </div>
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
              {summaryMetrics.totalScheduledHours > 0
                ? `${((summaryMetrics.totalApplicationHours / summaryMetrics.totalScheduledHours) * 100).toFixed(1)}%`
                : '0%'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Application hours compared to scheduled labor hours in the same report window.</p>
          </Card>
          <Card className="rounded-3xl border-0 bg-card/90 backdrop-blur p-5 shadow-sm">
            <div className="text-sm text-muted-foreground mb-1">Task Time Logged</div>
            <div className="text-3xl font-semibold">{summaryMetrics.totalAssignedHours.toFixed(1)}h</div>
            <p className="text-xs text-muted-foreground mt-1">Total workboard task time taken from assignment rows, not generic placeholders.</p>
          </Card>
          <Card className="rounded-3xl border-0 bg-card/90 backdrop-blur p-5 shadow-sm">
            <div className="text-sm text-muted-foreground mb-1">Task Minutes Tracked</div>
            <div className="text-3xl font-semibold">{summaryMetrics.totalTaskMinutes}</div>
            <p className="text-xs text-muted-foreground mt-1">Used for task time analysis and labor-vs-plan comparisons.</p>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr] mb-5">
          <Card className="rounded-3xl border-0 bg-card/90 backdrop-blur p-5 shadow-sm">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">Rainfall vs Application Window</h3>
              <p className="text-xs text-muted-foreground">Compare daily rain, ET, and the number of application logs recorded.</p>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={dailyOperations}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,90%)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar yAxisId="left" dataKey="applications" fill="hsl(38,92%,50%)" radius={[6, 6, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="rainfall" stroke="hsl(210,80%,52%)" strokeWidth={3} dot={{ r: 3 }} />
                <Area yAxisId="right" type="monotone" dataKey="et" fill="hsla(152,55%,38%,0.18)" stroke="hsl(152,55%,38%)" />
              </ComposedChart>
            </ResponsiveContainer>
          </Card>

          <Card className="rounded-3xl border-0 bg-card/90 backdrop-blur p-5 shadow-sm">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">Product Usage Mix</h3>
              <p className="text-xs text-muted-foreground">Tank mix quantities rolled up from application records.</p>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={productUsage} dataKey="quantity" nameKey="product" innerRadius={65} outerRadius={105} paddingAngle={3}>
                  {productUsage.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-2 mt-2">
              {productUsage.map((entry, index) => (
                <div key={entry.product} className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  {entry.product}
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_1fr] mb-5">
          <Card className="rounded-3xl border-0 bg-card/90 backdrop-blur p-5 shadow-sm">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">Labor and Assignment Throughput</h3>
              <p className="text-xs text-muted-foreground">Tie scheduled labor hours directly to completed planning activity.</p>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={dailyLabor}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,90%)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar yAxisId="left" dataKey="assignments" fill="hsl(152,55%,38%)" radius={[6, 6, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="laborHours" stroke="hsl(210,80%,52%)" strokeWidth={3} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </Card>

          <Card className="rounded-3xl border-0 bg-card/90 backdrop-blur p-5 shadow-sm">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">Weather by Location</h3>
              <p className="text-xs text-muted-foreground">Primary-station and manual entries summarized by property area.</p>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={weatherByLocation}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,90%)" />
                <XAxis dataKey="location" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="rainfall" fill="hsl(210,80%,52%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className="rounded-3xl border-0 bg-card/90 backdrop-blur p-5 shadow-sm">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">Task Distribution</h3>
              <p className="text-xs text-muted-foreground">See where the current workboard load is concentrated.</p>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={taskDistribution} dataKey="value" nameKey="name" innerRadius={65} outerRadius={105} paddingAngle={3}>
                  {taskDistribution.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          <Card className="rounded-3xl border-0 bg-card/90 backdrop-blur p-5 shadow-sm">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">Temperature and Humidity Trend</h3>
              <p className="text-xs text-muted-foreground">Read field conditions next to rainfall before reviewing application timing.</p>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={weatherByLocation}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,90%)" />
                <XAxis dataKey="location" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="avgTemp" fill="hsla(25,90%,55%,0.22)" stroke="hsl(25,90%,55%)" />
                <Area type="monotone" dataKey="avgHumidity" fill="hsla(152,55%,38%,0.18)" stroke="hsl(152,55%,38%)" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </div>

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
                      <div className="text-muted-foreground">Assigned</div>
                      <div className="mt-1 font-semibold">{row.assignedMinutes} min</div>
                    </div>
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
                  <th className="px-3 py-3 font-medium">Task Hrs</th>
                  <th className="px-3 py-3 font-medium">App Hrs</th>
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
                    <td className="px-3 py-3">{row.assignedHours}</td>
                    <td className="px-3 py-3">{row.applicationHours}</td>
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
