import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared';
import { EmployeeRow } from '@/components/workboard/EmployeeRow';
import { NotesPanel } from '@/components/workboard/NotesPanel';
import { TurfPanel } from '@/components/workboard/TurfPanel';
import { employees, tasks, assignments, notes, turfData } from '@/data/mockData';
import { StickyNote, Droplets } from 'lucide-react';

export default function WorkboardPage() {
  const activeEmployees = employees.filter(e => e.status === 'active');
  const [view, setView] = useState<'employee' | 'task'>('employee');

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Main workboard */}
      <div className="flex-1 p-4 overflow-auto">
        <PageHeader title="Workboard" badge={<Badge variant="secondary">{activeEmployees.length} on duty</Badge>} action={{ label: 'Add Employee' }}>
          <Button
            variant={view === 'employee' ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setView('employee')}
          >
            Employee View
          </Button>
          <Button
            variant={view === 'task' ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setView('task')}
          >
            Task View
          </Button>
        </PageHeader>

        <div className="space-y-2">
          {activeEmployees.map(emp => (
            <EmployeeRow
              key={emp.id}
              employee={emp}
              assignments={assignments.filter(a => a.employeeId === emp.id)}
              tasks={tasks}
            />
          ))}
        </div>
      </div>

      {/* Right rail */}
      <div className="w-80 border-l bg-card overflow-auto p-4 hidden lg:block">
        <Tabs defaultValue="notes">
          <TabsList className="w-full grid grid-cols-2 h-8 mb-3">
            <TabsTrigger value="notes" className="text-xs gap-1">
              <StickyNote className="h-3 w-3" /> Notes
            </TabsTrigger>
            <TabsTrigger value="turf" className="text-xs gap-1">
              <Droplets className="h-3 w-3" /> Turf
            </TabsTrigger>
          </TabsList>
          <TabsContent value="notes">
            <NotesPanel notes={notes} />
          </TabsContent>
          <TabsContent value="turf">
            <TurfPanel data={turfData} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
