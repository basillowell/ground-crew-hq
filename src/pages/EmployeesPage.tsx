import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusChip } from '@/components/StatusChip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { PageHeader, SearchFilter, DataTable, AvatarInitials, EmptyState } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Phone, Mail, Plus, Shield, Smartphone, Monitor, Users, UserPlus, Trash2 } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import type { Employee } from '@/data/seedData';
import {
  loadAssignments,
  loadChemicalApplicationLogs,
  loadEmployees,
  loadEquipmentUnits,
  loadScheduleEntries,
  saveAssignments,
  saveChemicalApplicationLogs,
  saveEmployees,
  saveEquipmentUnits,
  saveScheduleEntries,
} from '@/lib/dataStore';

function EmployeeDetail({
  employee,
  onClose,
  onStatusToggle,
  onDelete,
  dependencySummary,
}: {
  employee: Employee;
  onClose: () => void;
  onStatusToggle: (employeeId: string) => void;
  onDelete: (employeeId: string) => void;
  dependencySummary: {
    schedules: number;
    assignments: number;
    equipment: number;
    applications: number;
  };
}) {
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
              <Button variant="outline" size="sm" className="text-xs" onClick={() => onStatusToggle(employee.id)}>
                {employee.status === 'active' ? 'Deactivate' : 'Activate'}
              </Button>
              <Button variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive" onClick={() => onDelete(employee.id)}>
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                Remove Employee
              </Button>
            </div>
            <div className="rounded-xl border bg-muted/20 p-3">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Linked records</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div><span className="font-semibold">{dependencySummary.schedules}</span> schedules</div>
                <div><span className="font-semibold">{dependencySummary.assignments}</span> tasks</div>
                <div><span className="font-semibold">{dependencySummary.equipment}</span> units</div>
                <div><span className="font-semibold">{dependencySummary.applications}</span> application logs</div>
              </div>
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
  const [employeeList, setEmployeeList] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Employee['status']>('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [selected, setSelected] = useState<Employee | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState({
    firstName: '',
    lastName: '',
    group: 'Greens',
    role: 'Operator',
    wage: '18',
    phone: '',
    email: '',
    language: 'English',
    workerType: 'full-time' as Employee['workerType'],
    department: 'Maintenance',
  });

  useEffect(() => {
    setEmployeeList(loadEmployees());
  }, []);

  const departments = useMemo(
    () => [...new Set(employeeList.map((employee) => employee.department))].sort((left, right) => left.localeCompare(right)),
    [employeeList],
  );

  const groups = useMemo(
    () => [...new Set(employeeList.map((employee) => employee.group))].sort((left, right) => left.localeCompare(right)),
    [employeeList],
  );

  const filtered = useMemo(
    () =>
      employeeList.filter((employee) =>
        `${employee.firstName} ${employee.lastName} ${employee.group} ${employee.role} ${employee.department}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (statusFilter === 'all' || employee.status === statusFilter) &&
        (departmentFilter === 'all' || employee.department === departmentFilter) &&
        (groupFilter === 'all' || employee.group === groupFilter),
      ),
    [departmentFilter, employeeList, groupFilter, search, statusFilter],
  );

  const stats = {
    total: employeeList.length,
    active: employeeList.filter((employee) => employee.status === 'active').length,
    departments: new Set(employeeList.map((employee) => employee.department)).size,
  };

  const selectedDependencySummary = useMemo(() => {
    if (!selected) {
      return { schedules: 0, assignments: 0, equipment: 0, applications: 0 };
    }

    return {
      schedules: loadScheduleEntries().filter((entry) => entry.employeeId === selected.id).length,
      assignments: loadAssignments().filter((assignment) => assignment.employeeId === selected.id).length,
      equipment: loadEquipmentUnits().filter((unit) => unit.assignedTo === selected.id).length,
      applications: loadChemicalApplicationLogs().filter((log) => log.applicatorId === selected.id).length,
    };
  }, [selected, employeeList]);

  function persist(nextEmployees: Employee[]) {
    setEmployeeList(nextEmployees);
    saveEmployees(nextEmployees);
  }

  function handleAddEmployee() {
    if (!draft.firstName.trim() || !draft.lastName.trim()) return;

    const nextEmployee: Employee = {
      id: `e${Date.now()}`,
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      group: draft.group.trim(),
      role: draft.role.trim(),
      wage: Number(draft.wage || 0),
      phone: draft.phone.trim() || 'Pending',
      email: draft.email.trim() || `${draft.firstName.toLowerCase()}.${draft.lastName.toLowerCase()}@groundcrew.local`,
      photo: '',
      status: 'active',
      department: draft.department.trim(),
      language: draft.language.trim(),
      workerType: draft.workerType,
      hireDate: new Date().toISOString().slice(0, 10),
    };

    persist([nextEmployee, ...employeeList]);
    setDialogOpen(false);
    setDraft({
      firstName: '',
      lastName: '',
      group: 'Greens',
      role: 'Operator',
      wage: '18',
      phone: '',
      email: '',
      language: 'English',
      workerType: 'full-time',
      department: 'Maintenance',
    });
  }

  function handleStatusToggle(employeeId: string) {
    const nextEmployees = employeeList.map((employee) =>
      employee.id === employeeId
        ? { ...employee, status: employee.status === 'active' ? 'inactive' : 'active' }
        : employee,
    );
    persist(nextEmployees);
    setSelected(nextEmployees.find((employee) => employee.id === employeeId) ?? null);
  }

  function handleDeleteEmployee(employeeId: string) {
    const employee = employeeList.find((entry) => entry.id === employeeId);
    if (!employee) return;

    const schedules = loadScheduleEntries();
    const assignments = loadAssignments();
    const equipmentUnits = loadEquipmentUnits();
    const applicationLogs = loadChemicalApplicationLogs();

    const scheduleCount = schedules.filter((entry) => entry.employeeId === employeeId).length;
    const assignmentCount = assignments.filter((entry) => entry.employeeId === employeeId).length;
    const equipmentCount = equipmentUnits.filter((entry) => entry.assignedTo === employeeId).length;
    const applicationCount = applicationLogs.filter((entry) => entry.applicatorId === employeeId).length;

    const confirmed = window.confirm(
      `Remove ${employee.firstName} ${employee.lastName} from the roster? This also removes ${scheduleCount} schedules, ${assignmentCount} assignments, unassigns ${equipmentCount} equipment records, and deletes ${applicationCount} application logs tied to this employee.`,
    );
    if (!confirmed) return;

    const nextEmployees = employeeList.filter((entry) => entry.id !== employeeId);
    persist(nextEmployees);
    saveScheduleEntries(schedules.filter((entry) => entry.employeeId !== employeeId));
    saveAssignments(assignments.filter((entry) => entry.employeeId !== employeeId));
    saveEquipmentUnits(
      equipmentUnits.map((unit) => (unit.assignedTo === employeeId ? { ...unit, assignedTo: undefined, status: unit.status === 'in-use' ? 'available' : unit.status } : unit)),
    );
    saveChemicalApplicationLogs(applicationLogs.filter((entry) => entry.applicatorId !== employeeId));
    setSelected((current) => (current?.id === employeeId ? null : current));

    toast('Employee removed', {
      description: `${employee.firstName} ${employee.lastName} and linked operational records were removed from the system.`,
    });
  }

  const tableColumns = useMemo<Column<Employee>[]>(
    () => [
      ...columns,
      {
        key: 'actions',
        header: 'Actions',
        className: 'w-[170px]',
        render: (employee) => (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={(event) => {
                event.stopPropagation();
                setSelected(employee);
              }}
            >
              Review
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={(event) => {
                event.stopPropagation();
                handleDeleteEmployee(employee.id);
              }}
            >
              Remove
            </Button>
          </div>
        ),
      },
    ],
    [employeeList],
  );

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <PageHeader title="Employee Management" action={{ label: 'Add Employee', onClick: () => setDialogOpen(true) }} />
      <div className="grid gap-4 md:grid-cols-3 mb-4">
        <div className="rounded-3xl border bg-card/90 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Total crew</span>
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div className="text-3xl font-semibold">{stats.total}</div>
          <p className="text-xs text-muted-foreground mt-1">All employee records in the workforce roster.</p>
        </div>
        <div className="rounded-3xl border bg-card/90 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Active now</span>
            <UserPlus className="h-4 w-4 text-chart-blue" />
          </div>
          <div className="text-3xl font-semibold">{stats.active}</div>
          <p className="text-xs text-muted-foreground mt-1">Employees available to schedule and assign work.</p>
        </div>
        <div className="rounded-3xl border bg-card/90 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Departments</span>
            <Badge variant="secondary" className="rounded-full px-3 py-1">Dynamic</Badge>
          </div>
          <div className="text-3xl font-semibold">{stats.departments}</div>
          <p className="text-xs text-muted-foreground mt-1">Use this roster as the source for Scheduler and Workboard.</p>
        </div>
      </div>
      <div className="rounded-3xl border bg-card/90 p-4 shadow-sm mb-4">
        <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
          <SearchFilter value={search} onChange={setSearch} placeholder="Search employees..." />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | Employee['status'])}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            value={departmentFilter}
            onChange={(event) => setDepartmentFilter(event.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All departments</option>
            {departments.map((department) => (
              <option key={department} value={department}>{department}</option>
            ))}
          </select>
          <select
            value={groupFilter}
            onChange={(event) => setGroupFilter(event.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All groups</option>
            {groups.map((group) => (
              <option key={group} value={group}>{group}</option>
            ))}
          </select>
        </div>
      </div>
      <DataTable<Employee>
        columns={tableColumns}
        data={filtered}
        keyExtractor={(e) => e.id}
        onRowClick={(e) => setSelected(e)}
        emptyMessage="No employees found"
      />
      {selected && (
        <EmployeeDetail
          employee={selected}
          onClose={() => setSelected(null)}
          onStatusToggle={handleStatusToggle}
          onDelete={handleDeleteEmployee}
          dependencySummary={selectedDependencySummary}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Add Employee</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">First Name</label>
              <Input value={draft.firstName} onChange={(event) => setDraft({ ...draft, firstName: event.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Last Name</label>
              <Input value={draft.lastName} onChange={(event) => setDraft({ ...draft, lastName: event.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Group</label>
              <Input value={draft.group} onChange={(event) => setDraft({ ...draft, group: event.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Role</label>
              <Input value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Hourly Wage</label>
              <Input value={draft.wage} onChange={(event) => setDraft({ ...draft, wage: event.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Department</label>
              <Input value={draft.department} onChange={(event) => setDraft({ ...draft, department: event.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Phone</label>
              <Input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Email</label>
              <Input value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Language</label>
              <Input value={draft.language} onChange={(event) => setDraft({ ...draft, language: event.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Worker Type</label>
              <select
                value={draft.workerType}
                onChange={(event) => setDraft({ ...draft, workerType: event.target.value as Employee['workerType'] })}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="seasonal">Seasonal</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddEmployee}>Save Employee</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
