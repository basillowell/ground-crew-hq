import { useState } from 'react';
import { employees } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusChip } from '@/components/StatusChip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { PageHeader, SearchFilter, DataTable, AvatarInitials, EmptyState } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Phone, Mail, Plus, Shield, Smartphone, Monitor } from 'lucide-react';
import type { Employee } from '@/data/mockData';

function EmployeeDetail({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <AvatarInitials firstName={employee.firstName} lastName={employee.lastName} size="lg" />
            <div>
              <div>{employee.firstName} {employee.lastName}</div>
              <div className="text-sm font-normal text-muted-foreground">{employee.role} • {employee.group}</div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="profile" className="mt-2">
          <TabsList className="grid grid-cols-6 h-8">
            <TabsTrigger value="profile" className="text-xs">Profile</TabsTrigger>
            <TabsTrigger value="contact" className="text-xs">Contact</TabsTrigger>
            <TabsTrigger value="notes" className="text-xs">Notes</TabsTrigger>
            <TabsTrigger value="mobile" className="text-xs">Mobile</TabsTrigger>
            <TabsTrigger value="kiosk" className="text-xs">Kiosk</TabsTrigger>
            <TabsTrigger value="safety" className="text-xs">Safety</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'First Name', value: employee.firstName },
                { label: 'Last Name', value: employee.lastName },
                { label: 'Group', value: employee.group },
                { label: 'Worker Type', value: employee.workerType },
                { label: 'Hourly Wage', value: `$${employee.wage}` },
                { label: 'Language', value: employee.language },
                { label: 'Hire Date', value: employee.hireDate },
                { label: 'Department', value: employee.department },
              ].map(field => (
                <div key={field.label}>
                  <label className="text-xs font-medium text-muted-foreground">{field.label}</label>
                  <Input defaultValue={field.value} className="h-8 mt-1" />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 pt-2">
              <StatusChip variant={employee.status === 'active' ? 'success' : 'danger'}>
                {employee.status}
              </StatusChip>
              <Button variant="outline" size="sm" className="text-xs">
                {employee.status === 'active' ? 'Deactivate' : 'Activate'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="contact" className="space-y-3 mt-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">Phone</div>
                <div className="text-sm font-medium">{employee.phone}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">Email</div>
                <div className="text-sm font-medium">{employee.email}</div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="mobile" className="mt-4 space-y-3">
            <div className="p-3 rounded-lg bg-muted/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Mobile App Access</div>
                  <div className="text-xs text-muted-foreground">Allow employee to use mobile app</div>
                </div>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="p-3 rounded-lg bg-muted/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Push Notifications</div>
                  <div className="text-xs text-muted-foreground">Send task and schedule alerts</div>
                </div>
              </div>
              <Switch defaultChecked />
            </div>
          </TabsContent>

          <TabsContent value="kiosk" className="mt-4 space-y-3">
            <div className="p-3 rounded-lg bg-muted/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Kiosk Clock-In</div>
                  <div className="text-xs text-muted-foreground">Allow clock-in via kiosk terminal</div>
                </div>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="p-3 rounded-lg bg-muted/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Display on Board</div>
                  <div className="text-xs text-muted-foreground">Show on lobby display board</div>
                </div>
              </div>
              <Switch />
            </div>
          </TabsContent>

          <TabsContent value="safety" className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {[
                { name: 'Chemical Handling', completed: true, date: '2024-03-01' },
                { name: 'Equipment Safety', completed: true, date: '2024-02-15' },
                { name: 'Heat Stress Prevention', completed: false, date: null },
                { name: 'First Aid', completed: true, date: '2024-01-20' },
              ].map(cert => (
                <div key={cert.name} className="p-3 rounded-lg border">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium">{cert.name}</span>
                  </div>
                  <StatusChip variant={cert.completed ? 'success' : 'warning'}>
                    {cert.completed ? `Completed ${cert.date}` : 'Pending'}
                  </StatusChip>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="notes" className="mt-4">
            <EmptyState
              title="No notes yet"
              description="Add notes about this employee's performance, preferences, or other details."
              action={{ label: 'Add Note' }}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

const columns: Column<Employee>[] = [
  {
    key: 'employee',
    header: 'Employee',
    render: (emp) => (
      <div className="flex items-center gap-2">
        <AvatarInitials firstName={emp.firstName} lastName={emp.lastName} />
        <span className="font-medium">{emp.firstName} {emp.lastName}</span>
      </div>
    ),
  },
  {
    key: 'group',
    header: 'Group',
    render: (emp) => <Badge variant="outline">{emp.group}</Badge>,
    className: 'hidden sm:table-cell',
  },
  {
    key: 'role',
    header: 'Role',
    render: (emp) => <span className="text-muted-foreground">{emp.role}</span>,
    className: 'hidden md:table-cell',
  },
  {
    key: 'type',
    header: 'Type',
    render: (emp) => <span className="text-muted-foreground capitalize">{emp.workerType}</span>,
    className: 'hidden lg:table-cell',
  },
  {
    key: 'wage',
    header: 'Wage',
    render: (emp) => <span className="font-mono">${emp.wage}/hr</span>,
    className: 'hidden md:table-cell',
  },
  {
    key: 'status',
    header: 'Status',
    render: (emp) => (
      <StatusChip variant={emp.status === 'active' ? 'success' : 'danger'}>
        {emp.status}
      </StatusChip>
    ),
  },
];

export default function EmployeesPage() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Employee | null>(null);

  const filtered = employees.filter(e =>
    `${e.firstName} ${e.lastName} ${e.group} ${e.role}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <PageHeader title="Employee Management" action={{ label: 'Add Employee' }} />
      <SearchFilter value={search} onChange={setSearch} placeholder="Search employees..." className="mb-4" />
      <DataTable<Employee>
        columns={columns}
        data={filtered}
        keyExtractor={(e) => e.id}
        onRowClick={(e) => setSelected(e)}
        emptyMessage="No employees found"
      />
      {selected && <EmployeeDetail employee={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
