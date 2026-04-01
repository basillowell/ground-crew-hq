import { useState } from 'react';
import { employees, groups } from '@/data/mockData';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusChip } from '@/components/StatusChip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Plus, User, Phone, Mail, Calendar, DollarSign, X } from 'lucide-react';
import type { Employee } from '@/data/mockData';

function EmployeeDetail({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
              {employee.firstName[0]}{employee.lastName[0]}
            </div>
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
              <div>
                <label className="text-xs font-medium text-muted-foreground">First Name</label>
                <Input defaultValue={employee.firstName} className="h-8 mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Last Name</label>
                <Input defaultValue={employee.lastName} className="h-8 mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Group</label>
                <Input defaultValue={employee.group} className="h-8 mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Worker Type</label>
                <Input defaultValue={employee.workerType} className="h-8 mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Hourly Wage</label>
                <Input defaultValue={`$${employee.wage}`} className="h-8 mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Language</label>
                <Input defaultValue={employee.language} className="h-8 mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Hire Date</label>
                <Input defaultValue={employee.hireDate} className="h-8 mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Department</label>
                <Input defaultValue={employee.department} className="h-8 mt-1" />
              </div>
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

          <TabsContent value="contact" className="space-y-4 mt-4">
            <div className="space-y-3">
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
            </div>
          </TabsContent>

          {['notes', 'mobile', 'kiosk', 'safety'].map(tab => (
            <TabsContent key={tab} value={tab} className="mt-4">
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No {tab} data yet</p>
                <Button variant="outline" size="sm" className="mt-2 text-xs">
                  <Plus className="h-3 w-3 mr-1" /> Add {tab}
                </Button>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default function EmployeesPage() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Employee | null>(null);

  const filtered = employees.filter(e =>
    `${e.firstName} ${e.lastName} ${e.group} ${e.role}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Employee Management</h2>
        <Button size="sm" className="gap-1">
          <Plus className="h-3.5 w-3.5" /> Add Employee
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search employees..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      <Card>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground text-xs">Employee</th>
                <th className="text-left p-3 font-medium text-muted-foreground text-xs">Group</th>
                <th className="text-left p-3 font-medium text-muted-foreground text-xs">Role</th>
                <th className="text-left p-3 font-medium text-muted-foreground text-xs">Type</th>
                <th className="text-left p-3 font-medium text-muted-foreground text-xs">Wage</th>
                <th className="text-left p-3 font-medium text-muted-foreground text-xs">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(emp => (
                <tr
                  key={emp.id}
                  className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => setSelected(emp)}
                >
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                        {emp.firstName[0]}{emp.lastName[0]}
                      </div>
                      <span className="font-medium">{emp.firstName} {emp.lastName}</span>
                    </div>
                  </td>
                  <td className="p-3"><Badge variant="outline">{emp.group}</Badge></td>
                  <td className="p-3 text-muted-foreground">{emp.role}</td>
                  <td className="p-3 text-muted-foreground capitalize">{emp.workerType}</td>
                  <td className="p-3 font-mono">${emp.wage}/hr</td>
                  <td className="p-3">
                    <StatusChip variant={emp.status === 'active' ? 'success' : 'danger'}>
                      {emp.status}
                    </StatusChip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {selected && <EmployeeDetail employee={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
