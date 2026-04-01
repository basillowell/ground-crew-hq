import { useState } from 'react';
import { reportCategories } from '@/data/mockData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download, Printer, FileText, Play, Calendar } from 'lucide-react';

const barData = [
  { name: 'Mowing', hours: 42 },
  { name: 'Bunkers', hours: 18 },
  { name: 'Irrigation', hours: 12 },
  { name: 'Chemical', hours: 8 },
  { name: 'Landscape', hours: 15 },
  { name: 'Setup', hours: 6 },
];

const pieData = [
  { name: 'Greens', value: 35 },
  { name: 'Fairways', value: 25 },
  { name: 'Bunkers', value: 15 },
  { name: 'Landscape', value: 15 },
  { name: 'Other', value: 10 },
];

const COLORS = ['hsl(152,55%,38%)', 'hsl(210,80%,52%)', 'hsl(38,92%,50%)', 'hsl(270,60%,55%)', 'hsl(0,0%,55%)'];

const heatmapData = Array.from({ length: 31 }, (_, i) => ({
  day: i + 1,
  value: Math.floor(Math.random() * 10),
}));

export default function ReportsPage() {
  const [selectedCategory, setSelectedCategory] = useState(reportCategories[0]);
  const [selectedReport, setSelectedReport] = useState(reportCategories[0].reports[0]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Category nav */}
      <div className="w-64 border-r bg-card overflow-auto p-3">
        <h3 className="text-sm font-semibold mb-3">Report Categories</h3>
        {reportCategories.map(cat => (
          <div key={cat.id} className="mb-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{cat.name}</div>
            {cat.reports.map(r => (
              <div
                key={r}
                onClick={() => { setSelectedCategory(cat); setSelectedReport(r); }}
                className={`text-xs px-2 py-1.5 rounded cursor-pointer transition-colors ${
                  selectedReport === r ? 'bg-accent text-accent-foreground font-medium' : 'hover:bg-muted/50 text-muted-foreground'
                }`}
              >
                {r}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Report view */}
      <div className="flex-1 p-4 overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{selectedReport}</h2>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <Input type="date" defaultValue="2024-03-01" className="h-8 text-xs w-32" />
              <span className="text-xs text-muted-foreground">to</span>
              <Input type="date" defaultValue="2024-03-31" className="h-8 text-xs w-32" />
            </div>
            <Button size="sm" className="h-8 gap-1 text-xs"><Play className="h-3 w-3" /> Run</Button>
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs"><Download className="h-3 w-3" /> CSV</Button>
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs"><FileText className="h-3 w-3" /> PDF</Button>
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs"><Printer className="h-3 w-3" /> Print</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Bar chart */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Hours by Category</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,90%)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="hours" fill="hsl(152,55%,38%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Pie chart */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Task Distribution</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-2 mt-2 justify-center">
              {pieData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-1 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                  {d.name}
                </div>
              ))}
            </div>
          </Card>

          {/* Calendar heatmap */}
          <Card className="p-4 lg:col-span-2">
            <h3 className="text-sm font-semibold mb-3">Daily Activity - March 2024</h3>
            <div className="flex flex-wrap gap-1">
              {heatmapData.map(d => (
                <div
                  key={d.day}
                  className="w-8 h-8 rounded flex items-center justify-center text-[10px] font-medium border"
                  style={{
                    backgroundColor: `hsl(152, 55%, ${90 - d.value * 5}%)`,
                    color: d.value > 5 ? 'white' : 'hsl(220, 20%, 14%)',
                  }}
                  title={`Mar ${d.day}: ${d.value} tasks`}
                >
                  {d.day}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
