import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card } from '@/components/ui/card';

type DailyOperationPoint = {
  date: string;
  rainfall: number;
  et: number;
  applications: number;
  areaTreated: number;
};

type ProductUsagePoint = {
  product: string;
  quantity: number;
};

type DailyLaborPoint = {
  date: string;
  shifts: number;
  laborHours: number;
  assignments: number;
};

type WeatherByLocationPoint = {
  location: string;
  rainfall: number;
  avgTemp: number;
  avgHumidity: number;
};

type TaskDistributionPoint = {
  name: string;
  value: number;
};

interface ReportsChartsProps {
  colors: string[];
  dailyOperations: DailyOperationPoint[];
  productUsage: ProductUsagePoint[];
  dailyLabor: DailyLaborPoint[];
  weatherByLocation: WeatherByLocationPoint[];
  taskDistribution: TaskDistributionPoint[];
}

export function ReportsCharts({
  colors,
  dailyOperations,
  productUsage,
  dailyLabor,
  weatherByLocation,
  taskDistribution,
}: ReportsChartsProps) {
  return (
    <>
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
                  <Cell key={index} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-2">
            {productUsage.map((entry, index) => (
              <div key={entry.product} className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
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
                  <Cell key={index} fill={colors[index % colors.length]} />
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
    </>
  );
}
