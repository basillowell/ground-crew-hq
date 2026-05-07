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
import type { AppUser, Employee, Property } from '@/data/seedData';
import {
  useAppUsers,
  useAssignments,
  useChemicalApplicationLogsAll,
  useDepartmentOptions,
  useEmployees,
  useEquipmentUnits,
  useGroupOptions,
  useLanguageOptions,
  useProperties,
  useRoleOptions,
  useScheduleEntries,
  useShiftTemplates,
  useWorkerTypes,
  useWorkLocations,
} from '@/lib/supabase-queries';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

function EmployeeDetail({
  employee,
  onClose,
  onStatusToggle,
  onDelete,
  onSavePortalAccess,
  properties,
  dependencySummary,
}: {
  employee: Employee;
  onClose: () => void;
  onStatusToggle: (employeeId: string) => void;
  onDelete: (employeeId: string) => void;
  onSavePortalAccess: (employeeId: string, updates: Partial<Employee>) => void;
  properties: Property[];
  dependencySummary: {
    schedules: number;
    assignments: number;
    equipment: number;
    applications: number;
  };
}) {
  const [portalDraft, setPortalDraft] = useState({
    propertyId: employee.propertyId ?? '',
    portalEnabled: employee.portalEnabled ?? false,
    loginEmail: employee.loginEmail ?? employee.email,
    loginPassword: employee.loginPassword ?? '',
    appRole: employee.appRole ?? 'crew',
  });
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
          <TabsList className="grid grid-cols-7 h-8">
            <TabsTrigger value="profile" className="text-xs">Profile</TabsTrigger>
            <TabsTrigger value="contact" className="text-xs">Contact</TabsTrigger>
            <TabsTrigger value="access" className="text-xs">Access</TabsTrigger>
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

          <TabsContent value="access" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Property</label>
                <select
                  value={portalDraft.propertyId}
                  onChange={(event) => setPortalDraft((current) => ({ ...current, propertyId: event.target.value }))}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">No property</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>{property.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Portal Role</label>
                <select
                  value={portalDraft.appRole}
                  onChange={(event) => setPortalDraft((current) => ({ ...current, appRole: event.target.value as AppUser['role'] }))}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="crew">Crew</option>
                </select>
              </div>
              <div className="col-span-2 flex items-center justify-between rounded-lg bg-muted/50 p-3">
                <div>
                  <div className="text-sm font-medium">Portal Access</div>
                  <div className="text-xs text-muted-foreground">Enable this employee to appear in launch/login profiles.</div>
                </div>
                <Switch checked={portalDraft.portalEnabled} onCheckedChange={(checked) => setPortalDraft((current) => ({ ...current, portalEnabled: checked }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Login Email</label>
                <Input value={portalDraft.loginEmail} onChange={(event) => setPortalDraft((current) => ({ ...current, loginEmail: event.target.value }))} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Password</label>
                <Input type="password" value={portalDraft.loginPassword} onChange={(event) => setPortalDraft((current) => ({ ...current, loginPassword: event.target.value }))} className="mt-1" />
              </div>
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={() => onSavePortalAccess(employee.id, portalDraft)}>Save Portal Access</Button>
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
  const { currentUser, currentPropertyId } = useAuth();
  const queryClient = useQueryClient();
  const todayKey = new Date().toISOString().slice(0, 10);
  const propertyScope = currentPropertyId === 'all' ? undefined : currentPropertyId;

  const employeesQuery = useEmployees(propertyScope, currentUser?.orgId);
  const appUsersQuery = useAppUsers(currentUser?.orgId);
  const departmentOptionsQuery = useDepartmentOptions(currentUser?.orgId);
  const groupOptionsQuery = useGroupOptions(currentUser?.orgId);
  const roleOptionsQuery = useRoleOptions(currentUser?.orgId);
  const workerTypesQuery = useWorkerTypes(currentUser?.orgId);
  const languageOptionsQuery = useLanguageOptions();
  const propertiesQuery = useProperties(currentUser?.orgId);
  const workLocationsQuery = useWorkLocations(propertyScope, currentUser?.orgId);
  const shiftTemplatesQuery = useShiftTemplates(currentUser?.orgId);
  const scheduleEntriesQuery = useScheduleEntries(todayKey, propertyScope, currentUser?.orgId);
  const assignmentsQuery = useAssignments(todayKey, propertyScope, currentUser?.orgId);
  const equipmentUnitsQuery = useEquipmentUnits(propertyScope, currentUser?.orgId);
  const applicationLogsQuery = useChemicalApplicationLogsAll();

  const employeeList = employeesQuery.data ?? [];
  const appUsers = appUsersQuery.data ?? [];
  const departmentOptions = departmentOptionsQuery.data ?? [];
  const groupOptions = groupOptionsQuery.data ?? [];
  const departmentOptionsForDropdown = useMemo(() => {
    if (departmentOptions.length > 0) return departmentOptions;
    const derived = [...new Set(employeeList.map((employee) => employee.department).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
      .map((name, index) => ({ id: `derived-department-${index}`, name }));
    if (derived.length > 0) return derived;
    return [{ id: 'fallback-department-default', name: 'Maintenance' }];
  }, [departmentOptions, employeeList]);
  const groupOptionsForDropdown = useMemo(() => {
    if (groupOptions.length > 0) return groupOptions;
    const derived = [...new Set(employeeList.map((employee) => employee.group).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
      .map((name, index) => ({ id: `derived-group-${index}`, name, color: 'hsl(var(--primary))' }));
    if (derived.length > 0) return derived;
    return [{ id: 'fallback-group-default', name: 'General', color: 'hsl(var(--primary))' }];
  }, [employeeList, groupOptions]);
  const roleOptions = roleOptionsQuery.data ?? [];
  const roleOptionsForDropdown = useMemo(() => {
    const configured = roleOptions
      .map((role) => ({ id: role.id, name: role.name?.trim() ?? '' }))
      .filter((role) => role.name.length > 0);
    if (configured.length > 0) return configured;
    const derived = [...new Set(employeeList.map((employee) => employee.role).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
      .map((name, index) => ({ id: `derived-role-${index}`, name }));
    if (derived.length > 0) return derived;
    return [{ id: 'fallback-role-operator', name: 'Operator' }];
  }, [employeeList, roleOptions]);
  const workerTypeOptionsForDropdown = useMemo(() => {
    const configured = (workerTypesQuery.data ?? [])
      .map((workerType) => workerType.name?.trim() ?? '')
      .filter((name) => name.length > 0);
    if (configured.length > 0) return configured;
    const derived = [...new Set(employeeList.map((employee) => String(employee.workerType)).filter(Boolean))];
    if (derived.length > 0) return derived;
    return ['full-time'];
  }, [employeeList, workerTypesQuery.data]);
  const languageOptions = languageOptionsQuery.data ?? [];
  const properties = propertiesQuery.data ?? [];
  const workLocations = workLocationsQuery.data ?? [];
  const shiftTemplates = shiftTemplatesQuery.data ?? [];
  const scheduleEntries = scheduleEntriesQuery.data ?? [];
  const assignments = assignmentsQuery.data ?? [];
  const equipmentUnits = equipmentUnitsQuery.data ?? [];
  const applicationLogs = applicationLogsQuery.data ?? [];
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Employee['status']>('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [selected, setSelected] = useState<Employee | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState({
    firstName: '',
    lastName: '',
    propertyId: '',
    group: 'Greens',
    role: 'Operator',
    wage: '18',
    phone: '',
    email: '',
    language: 'English',
    workerType: 'full-time' as Employee['workerType'],
    department: 'Maintenance',
    defaultLocationId: '',
    shiftTemplateId: '',
    portalEnabled: false,
    loginEmail: '',
    loginPassword: '',
    appRole: 'crew' as AppUser['role'],
  });

  const departmentIdByName = useMemo(
    () => new Map(departmentOptionsForDropdown.map((department) => [department.name, department.id])),
    [departmentOptionsForDropdown],
  );
  const groupIdByName = useMemo(
    () => new Map(groupOptionsForDropdown.map((group) => [group.name, group.id])),
    [groupOptionsForDropdown],
  );
  const roleIdByName = useMemo(
    () => new Map(roleOptionsForDropdown.map((role) => [role.name, role.id])),
    [roleOptionsForDropdown],
  );
  const workerTypeIdByName = useMemo(
    () => new Map((workerTypesQuery.data ?? []).map((workerType) => [workerType.name, workerType.id])),
    [workerTypesQuery.data],
  );

  useEffect(() => {
    setDraft((current) => ({
      ...current,
      department: current.department || departmentOptionsForDropdown[0]?.name || '',
      group: current.group || groupOptionsForDropdown[0]?.name || '',
      role: current.role || roleOptionsForDropdown[0]?.name || '',
      language: current.language || languageOptions[0]?.name || '',
      workerType: current.workerType || (workerTypeOptionsForDropdown[0] as Employee['workerType']) || 'full-time',
      propertyId: current.propertyId || properties[0]?.id || '',
      defaultLocationId: current.defaultLocationId || workLocations[0]?.id || '',
      shiftTemplateId: current.shiftTemplateId || shiftTemplates[0]?.id || '',
    }));
  }, [departmentOptionsForDropdown, groupOptionsForDropdown, roleOptionsForDropdown, workerTypeOptionsForDropdown, languageOptions, properties, workLocations, shiftTemplates]);

  const departments = useMemo(
    () => {
      const optionNames = departmentOptions.map((department) => department.name);
      const employeeNames = employeeList.map((employee) => employee.department);
      return [...new Set([...optionNames, ...employeeNames])].sort((left, right) => left.localeCompare(right));
    },
    [departmentOptions, employeeList],
  );

  const groups = useMemo(
    () => {
      const optionNames = groupOptions.map((group) => group.name);
      const employeeNames = employeeList.map((employee) => employee.group);
      return [...new Set([...optionNames, ...employeeNames])].sort((left, right) => left.localeCompare(right));
    },
    [employeeList, groupOptions],
  );

  const filtered = useMemo(
    () =>
      employeeList.filter((employee) =>
        `${employee.firstName} ${employee.lastName} ${employee.group} ${employee.role} ${employee.department} ${employee.language}`
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
      schedules: scheduleEntries.filter((entry) => entry.employeeId === selected.id).length,
      assignments: assignments.filter((assignment) => assignment.employeeId === selected.id).length,
      equipment: equipmentUnits.filter((unit) => unit.assignedTo === selected.id).length,
      applications: applicationLogs.filter((log) => log.applicatorId === selected.id).length,
    };
  }, [selected, scheduleEntries, assignments, equipmentUnits, applicationLogs]);

  function nullableUuid(value?: string) {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  async function persist(nextEmployees: Employee[]) {
    for (const emp of nextEmployees) {
      const payload = {
        id: emp.id,
        first_name: emp.firstName.trim(),
        last_name: emp.lastName.trim(),
        property_id: nullableUuid(emp.propertyId ?? (currentPropertyId === 'all' ? properties[0]?.id : currentPropertyId)),
        group_id: nullableUuid(groupIdByName.get(emp.group)),
        group_name: emp.group.trim() || null,
        role_id: nullableUuid(roleIdByName.get(emp.role)),
        role: emp.role.trim() || 'Operator',
        hourly_rate: Number.isFinite(emp.wage) ? Number(emp.wage) : 0,
        department_id: nullableUuid(departmentIdByName.get(emp.department)),
        department: emp.department.trim() || 'Maintenance',
        phone: emp.phone?.trim() ? emp.phone.trim() : null,
        email: emp.email?.trim() ? emp.email.trim() : null,
        language: emp.language?.trim() ? emp.language.trim() : null,
        worker_type_id: nullableUuid(workerTypeIdByName.get(String(emp.workerType))),
        worker_type: String(emp.workerType || '').trim() || null,
        default_location_id: nullableUuid(emp.defaultLocationId),
        preferred_shift_template_id: nullableUuid(emp.shiftTemplateId),
        portal_enabled: Boolean(emp.portalEnabled),
        login_email: emp.loginEmail?.trim() ? emp.loginEmail.trim() : null,
        status: emp.status,
        org_id: currentUser?.orgId,
      };
      const { error } = await supabase.from('employees').upsert(payload);
      if (error) throw error;
    }
    await queryClient.invalidateQueries({ queryKey: ['employees'] });
    await employeesQuery.refetch();
  }

  function buildDefaultDraft() {
    return {
      firstName: '',
      lastName: '',
      propertyId: properties[0]?.id ?? '',
      group: groupOptionsForDropdown[0]?.name ?? '',
      role: roleOptionsForDropdown[0]?.name ?? '',
      wage: '18',
      phone: '',
      email: '',
      language: languageOptions[0]?.name ?? '',
      workerType: (workerTypeOptionsForDropdown[0] as Employee['workerType']) ?? 'full-time',
      department: departmentOptionsForDropdown[0]?.name ?? '',
      defaultLocationId: workLocations[0]?.id ?? '',
      shiftTemplateId: shiftTemplates[0]?.id ?? '',
      portalEnabled: false,
      loginEmail: '',
      loginPassword: '',
      appRole: 'crew' as AppUser['role'],
    };
  }

  function openAddEmployeeDialog() {
    setDraft(buildDefaultDraft());
    setDialogOpen(true);
  }

  async function handleAddEmployee() {
    if (!draft.firstName.trim() || !draft.lastName.trim()) return;

    const nextEmployee: Employee = {
      id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `emp-${Date.now()}`,
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      propertyId: draft.propertyId || undefined,
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
      defaultLocationId: draft.defaultLocationId || undefined,
      shiftTemplateId: draft.shiftTemplateId || undefined,
      portalEnabled: draft.portalEnabled,
      loginEmail: draft.loginEmail || undefined,
      loginPassword: draft.loginPassword || undefined,
      appRole: draft.appRole,
    };

    try {
      await persist([nextEmployee, ...employeeList]);
      setDialogOpen(false);
      setDraft(buildDefaultDraft());
      toast('Employee saved', {
        description: `${nextEmployee.firstName} ${nextEmployee.lastName} was added and is now available in the roster.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Could not save employee', { description: message });
    }
  }

  async function handleStatusToggle(employeeId: string) {
    const nextEmployees = employeeList.map((employee) =>
      employee.id === employeeId
        ? { ...employee, status: (employee.status === 'active' ? 'inactive' : 'active') as 'active' | 'inactive' }
        : employee,
    );
    try {
      await persist(nextEmployees);
      setSelected(nextEmployees.find((employee) => employee.id === employeeId) ?? null);
      toast('Employee updated', { description: 'Status change saved.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Could not update employee', { description: message });
    }
  }

  async function handleDeleteEmployee(employeeId: string) {
    const employee = employeeList.find((entry) => entry.id === employeeId);
    if (!employee) return;

    const scheduleCount = scheduleEntries.filter((entry) => entry.employeeId === employeeId).length;
    const assignmentCount = assignments.filter((entry) => entry.employeeId === employeeId).length;
    const equipmentCount = equipmentUnits.filter((entry) => entry.assignedTo === employeeId).length;
    const applicationCount = applicationLogs.filter((entry) => entry.applicatorId === employeeId).length;

    const confirmed = window.confirm(
      `Remove ${employee.firstName} ${employee.lastName} from the roster? This also removes ${scheduleCount} schedules, ${assignmentCount} assignments, unassigns ${equipmentCount} equipment records, and deletes ${applicationCount} application logs tied to this employee.`,
    );
    if (!confirmed) return;

    await supabase.from('employees').delete().eq('id', employeeId);

    await Promise.allSettled([
      supabase.from('schedule_entries').delete().eq('employee_id', employeeId),
      supabase.from('assignments').delete().eq('employee_id', employeeId),
      supabase.from('chemical_application_logs').delete().eq('applicator_id', employeeId),
    ]);

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['employees'] }),
      queryClient.invalidateQueries({ queryKey: ['schedule-entries'] }),
      queryClient.invalidateQueries({ queryKey: ['assignments'] }),
      queryClient.invalidateQueries({ queryKey: ['chemical-application-logs-all'] }),
      queryClient.invalidateQueries({ queryKey: ['equipment-units'] }),
    ]);

    setSelected((current) => (current?.id === employeeId ? null : current));

    toast('Employee removed', {
      description: `${employee.firstName} ${employee.lastName} and linked operational records were removed from the system.`,
    });
  }

  async function handleSavePortalAccess(employeeId: string, updates: Partial<Employee>) {
    const nextEmployees = employeeList.map((employee) => (employee.id === employeeId ? { ...employee, ...updates } : employee));
    try {
      await persist(nextEmployees);
      setSelected(nextEmployees.find((employee) => employee.id === employeeId) ?? null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Could not save portal access', { description: message });
      return;
    }

    const employee = nextEmployees.find((entry) => entry.id === employeeId);
    if (!employee) return;

    const mappedRole: 'admin' | 'manager' | 'employee' =
      employee.appRole === 'admin'
        ? 'admin'
        : employee.appRole === 'manager' || employee.appRole === 'supervisor'
          ? 'manager'
          : 'employee';

    await supabase
      .from('app_users')
      .update({
        role: mappedRole,
        department: employee.department,
        status: employee.portalEnabled ? 'active' : 'inactive',
      })
      .eq('employee_id', employeeId);

    await queryClient.invalidateQueries({ queryKey: ['app-users'] });

    toast('Portal access saved', {
      description: `${employee.firstName} ${employee.lastName} now has updated login and property access settings.`,
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
      <PageHeader title="Employee Management" action={{ label: 'Add Employee', onClick: openAddEmployeeDialog }} />
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
          <p className="text-xs text-muted-foreground mt-1">Use this roster as the source for Scheduler and Workflow.</p>
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
          onSavePortalAccess={handleSavePortalAccess}
          properties={properties}
          dependencySummary={selectedDependencySummary}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[88vh] max-w-3xl overflow-hidden p-0">
          <DialogHeader className="border-b bg-muted/20 px-6 py-4">
            <DialogTitle className="text-lg">Add Employee</DialogTitle>
            <p className="text-xs text-muted-foreground">
              Create a crew profile with settings-driven structure for scheduling and daily execution.
            </p>
          </DialogHeader>
          <div className="max-h-[calc(88vh-150px)] space-y-5 overflow-y-auto px-6 py-5">
            <section className="rounded-xl border bg-background p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Identity</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">First Name</label>
                  <Input value={draft.firstName} onChange={(event) => setDraft({ ...draft, firstName: event.target.value })} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Last Name</label>
                  <Input value={draft.lastName} onChange={(event) => setDraft({ ...draft, lastName: event.target.value })} className="mt-1" />
                </div>
              </div>
            </section>

            <section className="rounded-xl border bg-background p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Work Details</div>
                <span className="text-[11px] text-muted-foreground">Settings-driven options</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Property</label>
                  <select
                    value={draft.propertyId}
                    onChange={(event) => setDraft({ ...draft, propertyId: event.target.value })}
                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">No property</option>
                    {properties.map((property) => (
                      <option key={property.id} value={property.id}>{property.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Department</label>
                  <select
                    value={draft.department}
                    onChange={(event) => setDraft({ ...draft, department: event.target.value })}
                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {departmentOptionsForDropdown.map((department) => (
                      <option key={department.id} value={department.name}>{department.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Group</label>
                  <select
                    value={draft.group}
                    onChange={(event) => setDraft({ ...draft, group: event.target.value })}
                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {groupOptionsForDropdown.map((group) => (
                      <option key={group.id} value={group.name}>{group.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Role</label>
                  <select
                    value={draft.role}
                    onChange={(event) => setDraft({ ...draft, role: event.target.value })}
                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {roleOptionsForDropdown.map((role) => (
                      <option key={role.id} value={role.name}>{role.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Worker Type</label>
                  <select
                    value={draft.workerType}
                    onChange={(event) => setDraft({ ...draft, workerType: event.target.value as Employee['workerType'] })}
                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {workerTypeOptionsForDropdown.map((workerType) => (
                      <option key={workerType} value={workerType}>{workerType}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Hourly Wage</label>
                  <Input value={draft.wage} onChange={(event) => setDraft({ ...draft, wage: event.target.value })} className="mt-1" />
                </div>
              </div>
            </section>

            <section className="rounded-xl border bg-background p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Contact</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Phone</label>
                  <Input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Email</label>
                  <Input value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} className="mt-1" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs text-muted-foreground">Language</label>
                  <select
                    value={draft.language}
                    onChange={(event) => setDraft({ ...draft, language: event.target.value })}
                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {languageOptions.map((language) => (
                      <option key={language.id} value={language.name}>{language.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section className="rounded-xl border bg-background p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Defaults</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Default Location</label>
                  <select
                    value={draft.defaultLocationId}
                    onChange={(event) => setDraft({ ...draft, defaultLocationId: event.target.value })}
                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">No default location</option>
                    {workLocations.map((location) => (
                      <option key={location.id} value={location.id}>{location.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Preferred Shift Template</label>
                  <select
                    value={draft.shiftTemplateId}
                    onChange={(event) => setDraft({ ...draft, shiftTemplateId: event.target.value })}
                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">No preferred shift</option>
                    {shiftTemplates.map((template) => (
                      <option key={template.id} value={template.id}>{template.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section className="rounded-xl border bg-muted/20 p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Access</div>
              <div className="flex items-center justify-between rounded-lg border bg-background p-3">
                <div>
                  <div className="text-sm font-medium">Portal Login</div>
                  <div className="text-xs text-muted-foreground">Enable this employee to log into the client workspace.</div>
                </div>
                <Switch checked={draft.portalEnabled} onCheckedChange={(checked) => setDraft({ ...draft, portalEnabled: checked })} />
              </div>
              {draft.portalEnabled ? (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Input placeholder="Login email" value={draft.loginEmail} onChange={(event) => setDraft({ ...draft, loginEmail: event.target.value })} />
                  <Input type="password" placeholder="Password" value={draft.loginPassword} onChange={(event) => setDraft({ ...draft, loginPassword: event.target.value })} />
                </div>
              ) : null}
            </section>
          </div>
          <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-background/95 px-6 py-4 backdrop-blur">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button className="min-w-[150px]" onClick={handleAddEmployee}>Save Employee</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
