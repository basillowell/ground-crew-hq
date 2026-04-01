import { employees } from '@/data/mockData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusChip } from '@/components/StatusChip';
import { Plus, Copy, Download, Search, AlertTriangle, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';

const days = ['Mon 3/25', 'Tue 3/26', 'Wed 3/27', 'Thu 3/28', 'Fri 3/29', 'Sat 3/30', 'Sun 3/31'];

const scheduleData: Record<string, Record<string, { start: string; end: string; status: string }>> = {
  e1: {
    'Mon 3/25': { start: '5:00', end: '1:30', status: 'scheduled' },
    'Tue 3/26': { start: '5:00', end: '1:30', status: 'scheduled' },
    'Wed 3/27': { start: '5:00', end: '1:30', status: 'scheduled' },
    'Thu 3/28': { start: '5:00', end: '1:30', status: 'scheduled' },
    'Fri 3/29': { start: '5:00', end: '1:30', status: 'scheduled' },
    'Sat 3/30': { start: '', end: '', status: 'day-off' },
    'Sun 3/31': { start: '', end: '', status: 'day-off' },
  },
  e2: {
    'Mon 3/25': { start: '5:30', end: '2:00', status: 'scheduled' },
    'Tue 3/26': { start: '', end: '', status: 'day-off' },
    'Wed 3/27': { start: '5:30', end: '2:00', status: 'scheduled' },
    'Thu 3/28': { start: '5:30', end: '2:00', status: 'scheduled' },
    'Fri 3/29': { start: '5:30', end: '2:00', status: 'scheduled' },
    'Sat 3/30': { start: '6:00', end: '12:00', status: 'scheduled' },
    'Sun 3/31': { start: '', end: '', status: 'day-off' },
  },
  e3: {
    'Mon 3/25': { start: '6:00', end: '2:30', status: 'scheduled' },
    'Tue 3/26': { start: '6:00', end: '2:30', status: 'scheduled' },
    'Wed 3/27': { start: '6:00', end: '2:30', status: 'scheduled' },
    'Thu 3/28': { start: '', end: '', status: 'vacation' },
    'Fri 3/29': { start: '', end: '', status: 'vacation' },
    'Sat 3/30': { start: '', end: '', status: 'day-off' },
    'Sun 3/31': { start: '', end: '', status: 'day-off' },
  },
};

const statusColors: Record<string, string> = {
  scheduled: 'bg-primary/10 border-primary/30 text-primary',
  'day-off': 'bg-muted border-border text-muted-foreground',
  vacation: 'bg-info/10 border-info/30 text-info',
  sick: 'bg-destructive/10 border-destructive/30 text-destructive',
};

export default function SchedulerPage() {
  const activeEmployees = employees.filter(e => e.status === 'active');

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Weekly Schedule</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1"><Plus className="h-3 w-3" /> Add Shift</Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1"><Copy className="h-3 w-3" /> Copy Week</Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1"><Download className="h-3 w-3" /> Export PDF</Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1"><Filter className="h-3 w-3" /> Filter</Button>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search..." className="h-7 pl-7 w-36 text-xs" />
          </div>
        </div>
      </div>

      <Card className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium text-muted-foreground text-xs sticky left-0 bg-muted/50 min-w-[180px]">Employee</th>
              {days.map(d => (
                <th key={d} className="text-center p-3 font-medium text-muted-foreground text-xs min-w-[110px]">{d}</th>
              ))}
              <th className="text-center p-3 font-medium text-muted-foreground text-xs min-w-[80px]">Total</th>
            </tr>
          </thead>
          <tbody>
            {activeEmployees.map(emp => {
              const schedule = scheduleData[emp.id] || {};
              let totalHours = 0;
              return (
                <tr key={emp.id} className="border-b hover:bg-muted/20">
                  <td className="p-3 sticky left-0 bg-card">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                        {emp.firstName[0]}{emp.lastName[0]}
                      </div>
                      <div>
                        <div className="font-medium text-xs">{emp.firstName} {emp.lastName}</div>
                        <div className="text-[10px] text-muted-foreground">{emp.group}</div>
                      </div>
                    </div>
                  </td>
                  {days.map(d => {
                    const entry = schedule[d];
                    if (!entry) return <td key={d} className="p-2 text-center"><div className="h-10 rounded border border-dashed border-border" /></td>;
                    if (entry.status === 'scheduled') totalHours += 8;
                    return (
                      <td key={d} className="p-2">
                        <div className={`rounded border px-2 py-1.5 text-center text-xs ${statusColors[entry.status] || statusColors.scheduled}`}>
                          {entry.status === 'scheduled' ? (
                            <><div className="font-medium">{entry.start} - {entry.end}</div></>
                          ) : (
                            <div className="capitalize font-medium">{entry.status.replace('-', ' ')}</div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="p-3 text-center font-mono text-xs font-medium">{totalHours}h</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
