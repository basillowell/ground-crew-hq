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
  applicationAreas,
  chemicalProducts,
  reportCategories,
  weatherLocations,
  type Assignment,
  type ChemicalApplicationLog,
  type ChemicalApplicationTankMixItem,
  type Employee,
  type ScheduleEntry,
  type Task,
  type WeatherDailyLog,
} from '@/data/seedData';
import {
  loadAssignments,
  loadChemicalApplicationLogs,
  loadChemicalApplicationTankMixItems,
  loadEmployees,
  loadScheduleEntries,
  loadTasks,
  loadWeatherDailyLogs,
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

export default function ReportsPage() {
  const [selectedCategory, setSelectedCategory] = useState(reportCategories[4] ?? reportCategories[0]);
  const [selectedReport, setSelectedReport] = useState((reportCategories[4] ?? reportCategories[0]).reports[0]);
  const [startDate, setStartDate] = useState('2024-03-20');
  const [endDate, setEndDate] = useState('2024-03-31');
  const [weatherLogs, setWeatherLogs] = useState<WeatherDailyLog[]>([]);
  const [applicationLogs, setApplicationLogs] = useState<ChemicalApplicationLog[]>([]);
  const [tankMixItems, setTankMixItems] = useState<ChemicalApplicationTankMixItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    setWeatherLogs(loadWeatherDailyLogs());
    setApplicationLogs(loadChemicalApplicationLogs());
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
    () => applicationLogs.filter((log) => inRange(log.applicationDate, startDate, endDate)),
    [applicationLogs, endDate, startDate],
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
    () => scheduleEntries.filter((entry) => inRange(entry.date, startDate, endDate)),
    [endDate, scheduleEntries, startDate],
  );

  const filteredAssignments = useMemo(
    () => assignments.filter((assignment) => inRange(assignment.date, startDate, endDate)),
    [assignments, endDate, startDate],
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
                Analyze weather, rainfall, ET, and chemical application activity together so admins can make better
                scheduling, agronomic, and compliance decisions from one report surface.
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
