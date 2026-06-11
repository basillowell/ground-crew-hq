import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, MoreHorizontal, Plus, UserCog, Users } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PageHeaderSkeleton, TableSkeleton } from '@/components/PageSkeleton';
import { ErrorRetry } from '@/components/ErrorRetry';
import { toast } from '@/components/ui/sonner';
import { useAppStore } from '@/store/appStore';
import { useEmployees, type EmployeeStatusFilter } from '@/lib/supabase-queries';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const EMPLOYEES_PER_PAGE = 20;
const FALLBACK_ROLES = [
  'Superintendent',
  'Assistant Superintendent',
  'Field Manager',
  'Field Staff',
  'Crew Leader',
  'Irrigation Technician',
  'Equipment Operator',
].map((name) => ({ id: name.toLowerCase().replace(/\s+/g, '-'), name }));

type EmployeeRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  department: string | null;
  property_id: string | null;
  org_id: string | null;
  status: string | null;
  active: boolean | null;
  email: string | null;
  phone: string | null;
  employment_type: string | null;
  language: string | null;
  hourly_rate: number | null;
};

type PropertyRow = {
  id: string;
  name: string | null;
};

type ScheduleEntryRow = {
  id: string;
  employee_id: string;
  property_id: string;
  date: string;
  shift_start: string;
  shift_end: string;
  status: string;
  notes: string | null;
};

type AddEmployeeDraft = {
  first_name: string;
  last_name: string;
  role: string;
  department: string;
  property_id: string;
  status: 'active' | 'inactive';
  hourly_rate: string;
  role_other: string;
  department_other: string;
  employment_type: string;
  language: string;
};

type EditEmployeeDraft = {
  first_name: string;
  last_name: string;
  role: string;
  department: string;
  property_id: string;
  status: 'active' | 'inactive';
  hourly_rate: string;
  employment_type: string;
  language: string;
};

function emptyAddDraft(): AddEmployeeDraft {
  return {
    first_name: '',
    last_name: '',
    role: 'Field Staff',
    department: 'Maintenance',
    property_id: '',
    status: 'active',
    hourly_rate: '0',
    role_other: '',
    department_other: '',
    employment_type: 'Full-time',
    language: 'English',
  };
}

function statusBadge(status: string | null) {
  const normalized = String(status).toLowerCase();
  if (normalized === 'active') {
    return <Badge className="rounded-full border border-status-active/20 bg-status-active/10 px-2 py-0.5 text-xs text-status-active">Active</Badge>;
  }
  if (normalized === 'archived') {
    return <Badge className="rounded-full border border-surface-border bg-surface-elevated px-2 py-0.5 text-xs text-text-muted">Archived</Badge>;
  }
  return <Badge className="rounded-full border border-status-warning/20 bg-status-warning/10 px-2 py-0.5 text-xs text-status-warning">Inactive</Badge>;
}

function formatHourlyRate(value: number | null) {
  return `$${Number(value ?? 0).toFixed(2)}/hr`;
}

function EmployeePagination({
  page,
  pageCount,
  total,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        Showing {(page - 1) * EMPLOYEES_PER_PAGE + 1}-
        {Math.min(page * EMPLOYEES_PER_PAGE, total)} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          Previous
        </Button>
        <span className="min-w-16 text-center text-sm">
          {page} / {pageCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page === pageCount}
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export default function EmployeesPage() {
  const { orgId, userRole, currentPropertyId } = useAuth();
  const queryClient = useQueryClient();
  const isHydrated = useAppStore((state) => state.isHydrated);
  const storeProperties = useAppStore((state) => state.properties);
  const storeDepartments = useAppStore((state) => state.departments);
  const hydrateStore = useAppStore((state) => state.hydrate);
  const isReadOnly = String(userRole ?? '') === 'viewer';
  const isAdmin = userRole === 'admin';
  const [statusFilter, setStatusFilter] = useState<EmployeeStatusFilter>('active');
  const employeesQuery = useEmployees(currentPropertyId || undefined, orgId ?? undefined, statusFilter);
  const employees = useMemo<EmployeeRow[]>(
    () =>
      (employeesQuery.data ?? []).map((employee) => ({
        id: employee.id,
        first_name: employee.firstName,
        last_name: employee.lastName,
        role: employee.role,
        department: employee.department,
        property_id: employee.propertyId ?? null,
        org_id: orgId,
        status: employee.status,
        active: employee.active ?? employee.status === 'active',
        email: employee.email,
        phone: employee.phone,
        employment_type: employee.employmentType ?? employee.workerType,
        language: employee.language,
        hourly_rate: employee.wage,
      })),
    [employeesQuery.data, orgId],
  );
  const properties = useMemo(
    () => storeProperties.map((property) => ({ id: property.id, name: property.name })),
    [storeProperties],
  );
  const departments = useMemo(
    () =>
      storeDepartments
        .filter((department) => department.active)
        .map((department) => ({ id: department.id, name: department.name })),
    [storeDepartments],
  );
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addDraft, setAddDraft] = useState<AddEmployeeDraft>(emptyAddDraft);
  const [addSaving, setAddSaving] = useState(false);
  const [isAddModalDirty, setIsAddModalDirty] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditEmployeeDraft | null>(null);
  const [rowSavingId, setRowSavingId] = useState<string | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<EmployeeRow | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'roster' | 'availability'>('roster');
  const [employeePage, setEmployeePage] = useState(1);
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const availabilityMonthLabel = monthCursor.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  const availabilityStartKey = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const availabilityEndKey = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);
  const monthEntriesQuery = useQuery({
    queryKey: ['team-availability', orgId ?? 'no-org', availabilityStartKey, availabilityEndKey],
    enabled: Boolean(orgId && isHydrated && viewMode === 'availability'),
    retry: false,
    queryFn: async () => {
      if (!orgId) return [] as ScheduleEntryRow[];
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Availability request timed out after 10 seconds.')), 10_000);
      });
      try {
        const result = await Promise.race([
          supabase
            .from('schedule_entries')
            .select('id, employee_id, property_id, date, shift_start, shift_end, status, notes')
            .eq('org_id', orgId)
            .gte('date', availabilityStartKey)
            .lte('date', availabilityEndKey)
            .order('date', { ascending: true }),
          timeout,
        ]);
        if (result.error) throw result.error;
        return (result.data ?? []) as ScheduleEntryRow[];
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    },
  });
  const monthEntries = monthEntriesQuery.data ?? [];
  const refetchMonthEntries = monthEntriesQuery.refetch;
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [shiftDraft, setShiftDraft] = useState({
    employee_id: '',
    property_id: '',
    date: '',
    shift_start: '07:30',
    shift_end: '16:00',
    status: 'scheduled',
    notes: '',
  });
  const [shiftSaving, setShiftSaving] = useState(false);

  useEffect(() => {
    document.title = 'Team — Ground Crew HQ';
  }, []);

  const employeePageCount = Math.max(1, Math.ceil(employees.length / EMPLOYEES_PER_PAGE));
  const visibleEmployees = useMemo(() => {
    const start = (employeePage - 1) * EMPLOYEES_PER_PAGE;
    return employees.slice(start, start + EMPLOYEES_PER_PAGE);
  }, [employeePage, employees]);

  useEffect(() => {
    setEmployeePage((current) => Math.min(current, employeePageCount));
  }, [employeePageCount]);

  const changeEmployeePage = useCallback((page: number) => {
    setEditingId(null);
    setEditDraft(null);
    setEmployeePage(page);
  }, []);

  const propertyNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const property of properties) {
      if (property.id) map.set(property.id, property.name ?? 'Unnamed Property');
    }
    return map;
  }, [properties]);

  const fetchRoles = useCallback(async () => {
    if (roles.length > 0) return;
    if (!supabase || !orgId) {
      setRoles(FALLBACK_ROLES);
      return;
    }

    const { data, error: rolesError } = await supabase
      .from('workforce_roles')
      .select('id, name')
      .eq('org_id', orgId)
      .eq('active', true)
      .order('name', { ascending: true });

    if (rolesError) {
      console.error('Failed to load workforce roles', rolesError);
      setRoles(FALLBACK_ROLES);
      return;
    }

    const roleOptions = ((data ?? []) as Array<{ id: string; name: string }>).filter((row) => row.name?.trim());
    setRoles(roleOptions.length > 0 ? roleOptions : FALLBACK_ROLES);
  }, [orgId, roles.length]);

  const openAddModal = useCallback(() => {
    void fetchRoles();
    setAddDraft(emptyAddDraft());
    setIsAddModalDirty(false);
    setAddOpen(true);
  }, [fetchRoles]);

  const monthDays = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: days }, (_, index) => {
      const date = new Date(year, month, index + 1);
      return {
        day: index + 1,
        key: date.toISOString().slice(0, 10),
      };
    });
  }, [monthCursor]);

  const entryByEmployeeDay = useMemo(() => {
    const map = new Map<string, ScheduleEntryRow>();
    for (const entry of monthEntries) {
      map.set(`${entry.employee_id}:${entry.date}`, entry);
    }
    return map;
  }, [monthEntries]);

  const openAvailabilityCell = useCallback((employee: EmployeeRow, dayKey: string) => {
    const existing = entryByEmployeeDay.get(`${employee.id}:${dayKey}`);
    if (existing) {
      setEditingShiftId(existing.id);
      setShiftDraft({
        employee_id: employee.id,
        property_id: existing.property_id || employee.property_id || properties[0]?.id || '',
        date: existing.date,
        shift_start: String(existing.shift_start ?? '07:30').slice(0, 5),
        shift_end: String(existing.shift_end ?? '16:00').slice(0, 5),
        status: existing.status || 'scheduled',
        notes: existing.notes ?? '',
      });
      setShiftDialogOpen(true);
      return;
    }
    setEditingShiftId(null);
    setShiftDraft({
      employee_id: employee.id,
      property_id: employee.property_id || properties[0]?.id || '',
      date: dayKey,
      shift_start: '07:30',
      shift_end: '16:00',
      status: 'scheduled',
      notes: '',
    });
    setShiftDialogOpen(true);
  }, [entryByEmployeeDay, properties]);

  const statusCellClass = (status: string | null) => {
    const normalized = String(status ?? '').toLowerCase();
    if (normalized === 'scheduled') return 'bg-status-active/10 text-status-active border-status-active/20';
    if (normalized === 'vacation') return 'bg-status-pending/10 text-status-pending border-status-pending/20';
    if (normalized === 'sick') return 'bg-status-warning/10 text-status-warning border-status-warning/20';
    if (normalized === 'off' || normalized === 'day_off') return 'bg-surface-elevated text-text-muted border-surface-border';
    return 'bg-surface-card text-text-muted border-surface-border';
  };

  const saveAvailabilityEntry = useCallback(async () => {
    if (isReadOnly) return;
    if (!supabase || !orgId) return;
    if (!shiftDraft.employee_id || !shiftDraft.property_id || !shiftDraft.date) {
      toast.error('Employee, property, and date are required.');
      return;
    }
    setShiftSaving(true);
    if (editingShiftId) {
      const { error: updateError } = await supabase
        .from('schedule_entries')
        .update({
          property_id: shiftDraft.property_id,
          shift_start: shiftDraft.shift_start,
          shift_end: shiftDraft.shift_end,
          status: shiftDraft.status,
          notes: shiftDraft.notes || null,
        })
        .eq('id', editingShiftId)
        .eq('org_id', orgId);
      setShiftSaving(false);
      if (updateError) {
        toast.error(`Failed to update shift: ${updateError.message}`);
        return;
      }
      toast.success('Shift updated');
    } else {
      const { error: insertError } = await supabase.from('schedule_entries').insert({
        org_id: orgId,
        employee_id: shiftDraft.employee_id,
        property_id: shiftDraft.property_id,
        date: shiftDraft.date,
        shift_start: shiftDraft.shift_start,
        shift_end: shiftDraft.shift_end,
        status: shiftDraft.status,
        notes: shiftDraft.notes || null,
      });
      setShiftSaving(false);
      if (insertError) {
        toast.error(`Failed to add shift: ${insertError.message}`);
        return;
      }
      toast.success('Shift added');
    }
    setShiftDialogOpen(false);
    setEditingShiftId(null);
    await refetchMonthEntries();
  }, [editingShiftId, isReadOnly, orgId, refetchMonthEntries, shiftDraft]);

  const monthlyEmployeeStats = useMemo(() => {
    const byEmployee = new Map<string, { scheduled: number; off: number; sick: number; vacation: number }>();
    for (const employee of employees) {
      byEmployee.set(employee.id, { scheduled: 0, off: 0, sick: 0, vacation: 0 });
    }
    for (const entry of monthEntries) {
      const bucket = byEmployee.get(entry.employee_id);
      if (!bucket) continue;
      const status = String(entry.status ?? '').toLowerCase();
      if (status === 'scheduled') bucket.scheduled += 1;
      else if (status === 'sick') bucket.sick += 1;
      else if (status === 'vacation') bucket.vacation += 1;
      else bucket.off += 1;
    }
    return byEmployee;
  }, [employees, monthEntries]);

  const closeAddModal = useCallback((forceDiscard = false) => {
    if (!forceDiscard && isAddModalDirty) {
      const shouldDiscard = window.confirm('You have unsaved changes. Discard?');
      if (!shouldDiscard) return;
    }
    setAddOpen(false);
    setAddDraft(emptyAddDraft());
    setIsAddModalDirty(false);
  }, [isAddModalDirty]);

  useEffect(() => {
    if (!addOpen || !isAddModalDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [addOpen, isAddModalDirty]);

  const saveNewEmployee = useCallback(async () => {
    if (isReadOnly) return;
    if (!supabase || !orgId) return;
    if (!addDraft.first_name.trim() || !addDraft.last_name.trim()) return;

    setAddSaving(true);
    const { error: insertError } = await supabase.from('employees').insert({
      id: crypto.randomUUID(),
      org_id: orgId,
      first_name: addDraft.first_name.trim(),
      last_name: addDraft.last_name.trim(),
      role: (addDraft.role === '__other__' ? addDraft.role_other : addDraft.role).trim() || null,
      department: (addDraft.department === '__other__' ? addDraft.department_other : addDraft.department).trim() || null,
      property_id: addDraft.property_id || null,
      status: addDraft.status,
      active: addDraft.status === 'active',
      hourly_rate: Math.max(0, Number(addDraft.hourly_rate || 0)),
      employment_type: addDraft.employment_type || null,
      language: addDraft.language || null,
    });
    setAddSaving(false);

    if (insertError) {
      setError(insertError.message);
      toast.error(`Failed to add employee: ${insertError.message}`);
      return;
    }

    closeAddModal(true);
    await Promise.all([
      hydrateStore(orgId),
      queryClient.invalidateQueries({ queryKey: ['employees'] }),
    ]);
    toast.success(`Added employee: ${addDraft.first_name.trim()} ${addDraft.last_name.trim()}`);
  }, [addDraft, closeAddModal, hydrateStore, isReadOnly, orgId, queryClient]);

  const startEdit = useCallback((employee: EmployeeRow) => {
    void fetchRoles();
    setEditingId(employee.id);
    setEditDraft({
      first_name: employee.first_name ?? '',
      last_name: employee.last_name ?? '',
      role: employee.role ?? '',
      department: employee.department ?? '',
      property_id: employee.property_id ?? '',
      status: String(employee.status).toLowerCase() === 'inactive' ? 'inactive' : 'active',
      hourly_rate: String(Number(employee.hourly_rate ?? 0)),
      employment_type: employee.employment_type ?? 'Full-time',
      language: employee.language ?? 'English',
    });
  }, [fetchRoles]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditDraft(null);
  }, []);

  const saveEdit = useCallback(async (employeeId: string) => {
    if (isReadOnly) return;
    if (!supabase || !orgId || !editDraft) return;
    if (!editDraft.first_name.trim() || !editDraft.last_name.trim()) return;

    setRowSavingId(employeeId);
    const { error: updateError } = await supabase
      .from('employees')
      .update({
        first_name: editDraft.first_name.trim(),
        last_name: editDraft.last_name.trim(),
        role: editDraft.role.trim() || null,
        department: editDraft.department.trim() || null,
        property_id: editDraft.property_id || null,
        status: editDraft.status,
        active: editDraft.status === 'active',
        hourly_rate: Math.max(0, Number(editDraft.hourly_rate || 0)),
        employment_type: editDraft.employment_type || null,
        language: editDraft.language || null,
      })
      .eq('id', employeeId)
      .eq('org_id', orgId);
    setRowSavingId(null);

    if (updateError) {
      setError(updateError.message);
      toast.error(`Failed to update employee: ${updateError.message}`);
      return;
    }

    cancelEdit();
    await Promise.all([
      hydrateStore(orgId),
      queryClient.invalidateQueries({ queryKey: ['employees'] }),
    ]);
    toast.success(`Updated employee: ${editDraft.first_name.trim()} ${editDraft.last_name.trim()}`);
  }, [cancelEdit, editDraft, hydrateStore, isReadOnly, orgId, queryClient]);

  const deactivateEmployee = useCallback(async (employee: EmployeeRow) => {
    if (isReadOnly) return;
    if (!supabase || !orgId) return;
    const name = `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim() || 'this employee';
    const confirmed = window.confirm(`Deactivate ${name}? They won't appear in scheduling.`);
    if (!confirmed) return;

    setDeactivatingId(employee.id);
    const { error: updateError } = await supabase
      .from('employees')
      .update({ status: 'inactive', active: false })
      .eq('id', employee.id)
      .eq('org_id', orgId);
    setDeactivatingId(null);

    if (updateError) {
      setError(updateError.message);
      toast.error(`Failed to deactivate employee: ${updateError.message}`);
      return;
    }

    await Promise.all([
      hydrateStore(orgId),
      queryClient.invalidateQueries({ queryKey: ['employees'] }),
    ]);
    toast.success(`Deactivated employee: ${name}`);
  }, [hydrateStore, isReadOnly, orgId, queryClient]);

  const updateEmployeeStatus = useCallback(async (
    employee: EmployeeRow,
    status: 'active' | 'inactive' | 'archived',
    successMessage: string,
  ) => {
    if (isReadOnly || !supabase || !orgId) return;
    setDeactivatingId(employee.id);
    const { error: updateError } = await supabase
      .from('employees')
      .update({ status, active: status === 'active' })
      .eq('id', employee.id)
      .eq('org_id', orgId);
    setDeactivatingId(null);

    if (updateError) {
      setError(updateError.message);
      toast.error(`Failed to update employee: ${updateError.message}`);
      return;
    }

    await Promise.all([
      hydrateStore(orgId),
      queryClient.invalidateQueries({ queryKey: ['employees'] }),
    ]);
    toast.success(successMessage);
  }, [hydrateStore, isReadOnly, orgId, queryClient]);

  const removeEmployee = useCallback(async () => {
    if (!pendingRemoval || !isAdmin || !supabase || !orgId) return;
    const employee = pendingRemoval;
    const name = `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim() || 'Employee';
    setRemovingId(employee.id);

    const { error: accessError } = await supabase
      .from('app_users')
      .delete()
      .eq('employee_id', employee.id)
      .eq('org_id', orgId);
    if (accessError) {
      setRemovingId(null);
      setError(accessError.message);
      toast.error(`Failed to revoke login access: ${accessError.message}`);
      return;
    }

    const { error: employeeError } = await supabase
      .from('employees')
      .update({ status: 'removed', active: false })
      .eq('id', employee.id)
      .eq('org_id', orgId);
    setRemovingId(null);

    if (employeeError) {
      setError(employeeError.message);
      toast.error(`Failed to remove employee: ${employeeError.message}`);
      return;
    }

    setPendingRemoval(null);
    await Promise.all([
      hydrateStore(orgId),
      queryClient.invalidateQueries({ queryKey: ['employees'] }),
    ]);
    toast.success(`${name} has been removed. Historical data is preserved.`);
  }, [hydrateStore, isAdmin, orgId, pendingRemoval, queryClient]);

  const renderStatusActions = (employee: EmployeeRow) => {
    const status = String(employee.status ?? 'active').toLowerCase();
    const name = `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim() || 'Employee';

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${name}`} disabled={deactivatingId === employee.id}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {status === 'active' ? (
            <DropdownMenuItem onSelect={() => void deactivateEmployee(employee)}>
              Deactivate
            </DropdownMenuItem>
          ) : null}
          {status === 'inactive' ? (
            <>
              <DropdownMenuItem onSelect={() => void updateEmployeeStatus(employee, 'active', `Reactivated employee: ${name}`)}>
                Reactivate
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void updateEmployeeStatus(employee, 'archived', `Archived employee: ${name}`)}>
                Archive
              </DropdownMenuItem>
            </>
          ) : null}
          {status === 'archived' ? (
            <>
              <DropdownMenuItem onSelect={() => void updateEmployeeStatus(employee, 'inactive', `Unarchived employee: ${name}`)}>
                Unarchive
              </DropdownMenuItem>
              {isAdmin ? (
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setPendingRemoval(employee)}>
                  Remove from platform
                </DropdownMenuItem>
              ) : null}
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  useEffect(() => {
    setEmployeePage(1);
    setEditingId(null);
    setEditDraft(null);
  }, [statusFilter]);

  if (!orgId || !isHydrated || employeesQuery.isLoading) {
    return (
      <div className="space-y-6 p-6">
        <PageHeaderSkeleton />
        <TableSkeleton rows={6} />
      </div>
    );
  }

  return (
    <div className="animate-fade-up mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <PageHeader
        title="Team"
        subtitle="Manage your crew roster."
        action={!isReadOnly ? { label: 'Add Employee', onClick: openAddModal } : undefined}
      />

      <div className="flex items-center gap-2">
        <Button variant={viewMode === 'roster' ? 'default' : 'outline'} size="sm" className="h-9 rounded-lg" onClick={() => setViewMode('roster')}>
          Roster
        </Button>
        <Button
          variant={viewMode === 'availability' ? 'default' : 'outline'}
          size="sm"
          className="h-9 rounded-lg"
          onClick={() => {
            setStatusFilter('active');
            setViewMode('availability');
          }}
        >
          Availability
        </Button>
      </div>

      {viewMode === 'roster' ? (
        <div className="flex flex-wrap gap-2" aria-label="Employee status filter">
          {(['active', 'inactive', 'archived'] as const).map((status) => (
            <Button
              key={status}
              type="button"
              size="sm"
              variant={statusFilter === status ? 'default' : 'outline'}
              onClick={() => setStatusFilter(status)}
              className="capitalize"
            >
              {status}
            </Button>
          ))}
        </div>
      ) : null}

      {error || employeesQuery.error ? (
        <ErrorRetry
          message={error ?? employeesQuery.error?.message ?? 'Failed to load employees'}
          onRetry={() => {
            setError(null);
            void employeesQuery.refetch();
          }}
        />
      ) : null}

      {viewMode === 'availability' ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-surface-border bg-surface-card p-3">
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
            >
              Previous
            </Button>
            <div className="font-medium">
              {availabilityMonthLabel}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
            >
              Next
            </Button>
          </div>

          {monthEntriesQuery.isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : monthEntriesQuery.error ? (
            <ErrorRetry
              message={`Failed to load availability: ${monthEntriesQuery.error.message}`}
              onRetry={() => void monthEntriesQuery.refetch()}
            />
          ) : monthEntries.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <p className="text-sm font-medium">No availability set for {availabilityMonthLabel}</p>
              <p className="mt-1 text-xs text-muted-foreground">Availability tracking coming soon.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-surface-border bg-surface-card">
              <table className="min-w-full text-xs">
                <thead className="bg-surface-elevated text-text-muted">
                  <tr>
                    <th className="sticky left-0 bg-muted/30 px-2 py-2 text-left font-medium">Employee</th>
                    {monthDays.map((day) => (
                      <th key={`head-${day.key}`} className="px-2 py-2 text-center font-medium">{day.day}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleEmployees.map((employee) => {
                    const name = `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim() || 'Unnamed';
                    return (
                      <tr key={`cal-${employee.id}`} className="border-t border-surface-border transition-colors hover:bg-surface-hover">
                        <td className="sticky left-0 bg-surface-card px-2 py-2 font-medium text-text-primary">{name}</td>
                        {monthDays.map((day) => {
                          const entry = entryByEmployeeDay.get(`${employee.id}:${day.key}`);
                          return (
                            <td key={`${employee.id}-${day.key}`} className="px-1 py-1">
                              <button
                                type="button"
                                onClick={() => openAvailabilityCell(employee, day.key)}
                                className={`h-7 w-9 rounded border text-[11px] ${statusCellClass(entry?.status ?? null)}`}
                              >
                                {entry ? (String(entry.status).slice(0, 1).toUpperCase()) : '—'}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!monthEntriesQuery.isLoading && !monthEntriesQuery.error && monthEntries.length > 0 ? (
          <div className="rounded-xl border border-surface-border bg-surface-card p-3">
            <h3 className="mb-2 text-sm font-semibold text-text-primary">Quick stats</h3>
            <div className="space-y-1 text-sm text-text-muted">
              {visibleEmployees.map((employee) => {
                const stats = monthlyEmployeeStats.get(employee.id) ?? { scheduled: 0, off: 0, sick: 0, vacation: 0 };
                const name = `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim() || 'Unnamed';
                return (
                  <p key={`stats-${employee.id}`}>
                    This month: {name} — {stats.scheduled} days scheduled, {stats.off} days off, {stats.sick} sick, {stats.vacation} vacation
                  </p>
                );
              })}
            </div>
          </div>
          ) : null}
        </div>
      ) : null}

      {viewMode === 'roster' ? (
      <div className="hidden overflow-x-auto rounded-xl border border-surface-border bg-surface-card md:block">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-elevated text-xs uppercase tracking-wider text-text-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium">Role</th>
              <th className="px-3 py-2 text-left font-medium">Department</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-left font-medium">Property</th>
              <th className="px-3 py-2 text-left font-medium">Hourly Rate</th>
              <th className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6">
                  <EmptyState
                    icon={Users}
                    title="No crew members yet"
                    description="Add your first employee to start scheduling shifts and assigning work."
                    actionLabel="Add employee"
                    onAction={() => setAddOpen(true)}
                  />
                </td>
              </tr>
            ) : (
              visibleEmployees.map((employee) => {
                const isEditing = editingId === employee.id && editDraft;
                const fullName = `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim() || 'Unnamed Employee';
                return (
                  <tr key={employee.id} className="border-t border-surface-border align-top transition-colors hover:bg-surface-hover">
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <div className="grid grid-cols-2 gap-2">
                          <Input value={editDraft.first_name} onChange={(event) => setEditDraft({ ...editDraft, first_name: event.target.value })} placeholder="First name" />
                          <Input value={editDraft.last_name} onChange={(event) => setEditDraft({ ...editDraft, last_name: event.target.value })} placeholder="Last name" />
                        </div>
                      ) : (
                        <div className="font-medium text-text-primary">{fullName}</div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <select
                          value={editDraft.role}
                          onChange={(event) => setEditDraft({ ...editDraft, role: event.target.value })}
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          {editDraft.role && !roles.some((role) => role.name === editDraft.role) ? (
                            <option value={editDraft.role}>{editDraft.role}</option>
                          ) : null}
                          {roles.map((role) => (
                            <option key={`edit-role-${role.id}`} value={role.name}>
                              {role.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        employee.role || '-'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <select
                          value={editDraft.department}
                          onChange={(event) => setEditDraft({ ...editDraft, department: event.target.value })}
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          {editDraft.department && !departments.some((department) => department.name === editDraft.department) ? (
                            <option value={editDraft.department}>{editDraft.department}</option>
                          ) : null}
                          {departments.map((department) => (
                            <option key={`edit-dept-${department.id}`} value={department.name}>
                              {department.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        employee.department || '-'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <select
                          value={editDraft.status}
                          onChange={(event) => setEditDraft({ ...editDraft, status: event.target.value as 'active' | 'inactive' })}
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      ) : (
                        statusBadge(employee.status)
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <select
                          value={editDraft.property_id}
                          onChange={(event) => setEditDraft({ ...editDraft, property_id: event.target.value })}
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="">No property</option>
                          {properties.map((property) => (
                            <option key={property.id} value={property.id}>
                              {property.name ?? 'Unnamed Property'}
                            </option>
                          ))}
                        </select>
                      ) : (
                        (employee.property_id ? propertyNameById.get(employee.property_id) : null) ?? '-'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editDraft.hourly_rate}
                          onChange={(event) => setEditDraft({ ...editDraft, hourly_rate: event.target.value })}
                          placeholder="0.00"
                        />
                      ) : (
                        formatHourlyRate(employee.hourly_rate)
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={cancelEdit}>
                            Cancel
                          </Button>
                          <Button size="sm" onClick={() => void saveEdit(employee.id)} disabled={rowSavingId === employee.id}>
                            {rowSavingId === employee.id ? 'Saving...' : 'Save'}
                          </Button>
                        </div>
                      ) : !isReadOnly ? (
                        <div className="flex justify-end gap-2">
                          {String(employee.status).toLowerCase() !== 'archived' ? (
                            <Button variant="outline" size="sm" onClick={() => startEdit(employee)}>
                              <UserCog className="mr-1 h-4 w-4" />
                              Edit
                            </Button>
                          ) : null}
                          {renderStatusActions(employee)}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      ) : null}

      {viewMode === 'roster' ? (
      <div className="space-y-3 md:hidden">
        {employees.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No crew members yet"
            description="Add your first employee to start scheduling shifts and assigning work."
            actionLabel="Add employee"
            onAction={() => setAddOpen(true)}
          />
        ) : (
          visibleEmployees.map((employee) => {
            const fullName = `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim() || 'Unnamed Employee';
            const isEditing = editingId === employee.id && editDraft;
            return (
              <div key={`mobile-${employee.id}`} className="rounded-xl border border-surface-border bg-surface-card p-3 transition-colors hover:bg-surface-hover">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="font-medium text-text-primary">{fullName}</div>
                  {isEditing ? null : statusBadge(employee.status)}
                </div>
                {isEditing ? (
                  <div className="space-y-2">
                    <Input value={editDraft.first_name} onChange={(event) => setEditDraft({ ...editDraft, first_name: event.target.value })} placeholder="First name" />
                    <Input value={editDraft.last_name} onChange={(event) => setEditDraft({ ...editDraft, last_name: event.target.value })} placeholder="Last name" />
                    <select
                      value={editDraft.role}
                      onChange={(event) => setEditDraft({ ...editDraft, role: event.target.value })}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {editDraft.role && !roles.some((role) => role.name === editDraft.role) ? (
                        <option value={editDraft.role}>{editDraft.role}</option>
                      ) : null}
                      {roles.map((role) => (
                        <option key={`mobile-edit-role-${role.id}`} value={role.name}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={editDraft.department}
                      onChange={(event) => setEditDraft({ ...editDraft, department: event.target.value })}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {editDraft.department && !departments.some((department) => department.name === editDraft.department) ? (
                        <option value={editDraft.department}>{editDraft.department}</option>
                      ) : null}
                      {departments.map((department) => (
                        <option key={`mobile-edit-dept-${department.id}`} value={department.name}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                    <Input type="number" min="0" step="0.01" value={editDraft.hourly_rate} onChange={(event) => setEditDraft({ ...editDraft, hourly_rate: event.target.value })} placeholder="Hourly rate" />
                  </div>
                ) : (
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>Role: {employee.role || '-'}</p>
                    <p>Department: {employee.department || '-'}</p>
                    <p>Property: {(employee.property_id ? propertyNameById.get(employee.property_id) : null) ?? '-'}</p>
                    <p>Hourly Rate: {formatHourlyRate(employee.hourly_rate)}</p>
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  {isEditing ? (
                    <>
                      <Button variant="outline" className="min-h-11 flex-1" onClick={cancelEdit}>Cancel</Button>
                      <Button className="min-h-11 flex-1" onClick={() => void saveEdit(employee.id)} disabled={rowSavingId === employee.id}>
                        {rowSavingId === employee.id ? 'Saving...' : 'Save'}
                      </Button>
                    </>
                  ) : !isReadOnly ? (
                    <>
                      {String(employee.status).toLowerCase() !== 'archived' ? (
                        <Button variant="outline" className="min-h-11 flex-1" onClick={() => startEdit(employee)}>Edit</Button>
                      ) : null}
                      {renderStatusActions(employee)}
                    </>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
      ) : null}

      <EmployeePagination
        page={employeePage}
        pageCount={employeePageCount}
        total={employees.length}
        onPageChange={changeEmployeePage}
      />

      <AlertDialog open={Boolean(pendingRemoval)} onOpenChange={(open) => !open && !removingId && setPendingRemoval(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from platform?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{' '}
              {`${pendingRemoval?.first_name ?? ''} ${pendingRemoval?.last_name ?? ''}`.trim() || 'this employee'} from your roster.
              All historical labor data, clock events, and assignments will be preserved for reporting purposes.
              Their login access will be revoked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(removingId)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void removeEmployee();
              }}
              disabled={Boolean(removingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removingId ? 'Removing...' : 'Remove from platform'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={addOpen && !isReadOnly}
        onOpenChange={(open) => {
          if (open) {
            setAddOpen(true);
            return;
          }
          closeAddModal();
        }}
      >
        <DialogContent aria-describedby="dialog-desc" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Employee</DialogTitle>
            <DialogDescription id="dialog-desc" className="sr-only">
              Enter employee details and save them to the team roster.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">First Name</label>
                <Input className="mt-1" value={addDraft.first_name} onChange={(event) => { setIsAddModalDirty(true); setAddDraft({ ...addDraft, first_name: event.target.value }); }} required />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Last Name</label>
                <Input className="mt-1" value={addDraft.last_name} onChange={(event) => { setIsAddModalDirty(true); setAddDraft({ ...addDraft, last_name: event.target.value }); }} required />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Role</label>
              <select
                value={addDraft.role}
                onChange={(event) => {
                  setIsAddModalDirty(true);
                  setAddDraft({ ...addDraft, role: event.target.value, role_other: '' });
                }}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.name}>
                    {role.name}
                  </option>
                ))}
                <option value="__other__">Other...</option>
              </select>
              {addDraft.role === '__other__' ? (
                <Input
                  className="mt-2"
                  value={addDraft.role_other}
                  onChange={(event) => {
                    setIsAddModalDirty(true);
                    setAddDraft({ ...addDraft, role_other: event.target.value });
                  }}
                  placeholder="Custom role"
                />
              ) : null}
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Department</label>
              <select
                value={addDraft.department}
                onChange={(event) => {
                  setIsAddModalDirty(true);
                  setAddDraft({ ...addDraft, department: event.target.value, department_other: '' });
                }}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {departments.map((department) => (
                  <option key={department.id} value={department.name}>
                    {department.name}
                  </option>
                ))}
                <option value="__other__">Other...</option>
              </select>
              {addDraft.department === '__other__' ? (
                <Input
                  className="mt-2"
                  value={addDraft.department_other}
                  onChange={(event) => {
                    setIsAddModalDirty(true);
                    setAddDraft({ ...addDraft, department_other: event.target.value });
                  }}
                  placeholder="Custom department"
                />
              ) : null}
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Property (all org properties)</label>
              <select value={addDraft.property_id} onChange={(event) => { setIsAddModalDirty(true); setAddDraft({ ...addDraft, property_id: event.target.value }); }} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">No property</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name ?? 'Unnamed Property'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <select
                value={addDraft.status}
                onChange={(event) => { setIsAddModalDirty(true); setAddDraft({ ...addDraft, status: event.target.value as 'active' | 'inactive' }); }}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Employment Type</label>
              <select
                value={addDraft.employment_type}
                onChange={(event) => {
                  setIsAddModalDirty(true);
                  setAddDraft({ ...addDraft, employment_type: event.target.value });
                }}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {['Full-time', 'Part-time', 'Seasonal', 'Contract', 'Intern'].map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Language</label>
              <select
                value={addDraft.language}
                onChange={(event) => {
                  setIsAddModalDirty(true);
                  setAddDraft({ ...addDraft, language: event.target.value });
                }}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {['English', 'Spanish', 'Portuguese', 'Creole', 'Other'].map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Hourly Rate</label>
              <Input
                className="mt-1"
                type="number"
                min="0"
                step="0.01"
                value={addDraft.hourly_rate}
                onChange={(event) => { setIsAddModalDirty(true); setAddDraft({ ...addDraft, hourly_rate: event.target.value }); }}
                placeholder="0.00"
              />
            </div>
            <p className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
              To give this employee login access, contact your administrator.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => closeAddModal()}>
              Cancel
            </Button>
            <Button
              onClick={() => void saveNewEmployee()}
              disabled={
                addSaving ||
                !addDraft.first_name.trim() ||
                !addDraft.last_name.trim() ||
                (addDraft.role === '__other__' && !addDraft.role_other.trim()) ||
                (addDraft.department === '__other__' && !addDraft.department_other.trim())
              }
            >
              {addSaving ? 'Saving...' : 'Save Employee'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={shiftDialogOpen && !isReadOnly} onOpenChange={(open) => { if (!open) { setShiftDialogOpen(false); setEditingShiftId(null); } }}>
        <DialogContent aria-describedby="dialog-desc" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingShiftId ? 'Edit Shift' : 'Add Shift'}</DialogTitle>
            <DialogDescription id="dialog-desc" className="sr-only">
              Update a team member shift assignment for the selected day.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Employee</label>
              <select
                value={shiftDraft.employee_id}
                onChange={(event) => setShiftDraft((current) => ({ ...current, employee_id: event.target.value }))}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select employee</option>
                {employees.map((employee) => (
                  <option key={`shift-emp-${employee.id}`} value={employee.id}>
                    {`${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim()}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Date</label>
                <Input type="date" className="mt-1" value={shiftDraft.date} onChange={(event) => setShiftDraft((current) => ({ ...current, date: event.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Property</label>
                <select
                  value={shiftDraft.property_id}
                  onChange={(event) => setShiftDraft((current) => ({ ...current, property_id: event.target.value }))}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select property</option>
                  {properties.map((property) => (
                    <option key={`shift-property-${property.id}`} value={property.id}>
                      {property.name ?? 'Unnamed Property'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Shift Start</label>
                <Input type="time" className="mt-1" value={shiftDraft.shift_start} onChange={(event) => setShiftDraft((current) => ({ ...current, shift_start: event.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Shift End</label>
                <Input type="time" className="mt-1" value={shiftDraft.shift_end} onChange={(event) => setShiftDraft((current) => ({ ...current, shift_end: event.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <select
                value={shiftDraft.status}
                onChange={(event) => setShiftDraft((current) => ({ ...current, status: event.target.value }))}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="scheduled">Scheduled</option>
                <option value="off">Day Off</option>
                <option value="vacation">Vacation</option>
                <option value="sick">Sick</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Notes</label>
              <Input className="mt-1" value={shiftDraft.notes} onChange={(event) => setShiftDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional notes" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setShiftDialogOpen(false); setEditingShiftId(null); }}>
              Cancel
            </Button>
            <Button onClick={() => void saveAvailabilityEntry()} disabled={shiftSaving}>
              {shiftSaving ? 'Saving...' : editingShiftId ? 'Save Shift' : 'Add Shift'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
