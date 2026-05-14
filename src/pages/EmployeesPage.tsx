import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, UserCog } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

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

type AddEmployeeDraft = {
  first_name: string;
  last_name: string;
  role: string;
  department: string;
  property_id: string;
  status: 'active' | 'inactive';
  hourly_rate: string;
};

type EditEmployeeDraft = {
  first_name: string;
  last_name: string;
  role: string;
  department: string;
  property_id: string;
  status: 'active' | 'inactive';
  hourly_rate: string;
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
  };
}

function statusBadge(status: string | null) {
  if (String(status).toLowerCase() === 'active') {
    return <Badge className="bg-emerald-100 text-emerald-700">Active</Badge>;
  }
  return <Badge className="bg-slate-100 text-slate-700">Inactive</Badge>;
}

function formatHourlyRate(value: number | null) {
  return `$${Number(value ?? 0).toFixed(2)}/hr`;
}

export default function EmployeesPage() {
  const { orgId } = useAuth();
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addDraft, setAddDraft] = useState<AddEmployeeDraft>(emptyAddDraft);
  const [addSaving, setAddSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditEmployeeDraft | null>(null);
  const [rowSavingId, setRowSavingId] = useState<string | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  const fetchPageData = useCallback(async () => {
    if (!supabase || !orgId) {
      setLoading(true);
      return;
    }

    setLoading(true);
    setError(null);

    const employeesQuery = supabase
      .from('employees')
      .select('id, first_name, last_name, role, department, property_id, org_id, status, active, email, phone, employment_type, language, hourly_rate')
      .eq('org_id', orgId)
      .order('last_name', { ascending: true });

    const propertiesQuery = supabase
      .from('properties')
      .select('id, name')
      .eq('org_id', orgId)
      .order('name', { ascending: true });

    const [{ data: employeeRows, error: employeesError }, { data: propertyRows, error: propertiesError }] = await Promise.all([
      employeesQuery,
      propertiesQuery,
    ]);

    if (employeesError || propertiesError) {
      setError(employeesError?.message ?? propertiesError?.message ?? 'Unable to load employee roster.');
      setEmployees([]);
      setProperties([]);
      setLoading(false);
      return;
    }

    setEmployees((employeeRows ?? []) as EmployeeRow[]);
    setProperties((propertyRows ?? []) as PropertyRow[]);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    void fetchPageData();
  }, [fetchPageData]);

  const propertyNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const property of properties) {
      if (property.id) map.set(property.id, property.name ?? 'Unnamed Property');
    }
    return map;
  }, [properties]);

  const openAddModal = useCallback(() => {
    setAddDraft(emptyAddDraft());
    setAddOpen(true);
  }, []);

  const closeAddModal = useCallback(() => {
    setAddOpen(false);
    setAddDraft(emptyAddDraft());
  }, []);

  const saveNewEmployee = useCallback(async () => {
    if (!supabase || !orgId) return;
    if (!addDraft.first_name.trim() || !addDraft.last_name.trim()) return;

    setAddSaving(true);
    const { error: insertError } = await supabase.from('employees').insert({
      id: crypto.randomUUID(),
      org_id: orgId,
      first_name: addDraft.first_name.trim(),
      last_name: addDraft.last_name.trim(),
      role: addDraft.role.trim() || null,
      department: addDraft.department.trim() || null,
      property_id: addDraft.property_id || null,
      status: addDraft.status,
      active: addDraft.status === 'active',
      hourly_rate: Math.max(0, Number(addDraft.hourly_rate || 0)),
    });
    setAddSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    closeAddModal();
    await fetchPageData();
  }, [addDraft, closeAddModal, fetchPageData, orgId]);

  const startEdit = useCallback((employee: EmployeeRow) => {
    setEditingId(employee.id);
    setEditDraft({
      first_name: employee.first_name ?? '',
      last_name: employee.last_name ?? '',
      role: employee.role ?? '',
      department: employee.department ?? '',
      property_id: employee.property_id ?? '',
      status: String(employee.status).toLowerCase() === 'inactive' ? 'inactive' : 'active',
      hourly_rate: String(Number(employee.hourly_rate ?? 0)),
    });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditDraft(null);
  }, []);

  const saveEdit = useCallback(async (employeeId: string) => {
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
      })
      .eq('id', employeeId)
      .eq('org_id', orgId);
    setRowSavingId(null);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    cancelEdit();
    await fetchPageData();
  }, [cancelEdit, editDraft, fetchPageData, orgId]);

  const deactivateEmployee = useCallback(async (employee: EmployeeRow) => {
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
      return;
    }

    await fetchPageData();
  }, [fetchPageData, orgId]);

  if (!orgId || loading) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Loading crew roster...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Crew Roster</h1>
          <p className="text-sm text-muted-foreground">Manage employees for scheduling and daily task assignments.</p>
        </div>
        <Button onClick={openAddModal}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add Employee
        </Button>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p>{error}</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => void fetchPageData()}>
            Retry
          </Button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/30">
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
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  No employees yet. Add your first crew member.
                </td>
              </tr>
            ) : (
              employees.map((employee) => {
                const isEditing = editingId === employee.id && editDraft;
                const fullName = `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim() || 'Unnamed Employee';
                return (
                  <tr key={employee.id} className="border-t align-top">
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <div className="grid grid-cols-2 gap-2">
                          <Input value={editDraft.first_name} onChange={(event) => setEditDraft({ ...editDraft, first_name: event.target.value })} placeholder="First name" />
                          <Input value={editDraft.last_name} onChange={(event) => setEditDraft({ ...editDraft, last_name: event.target.value })} placeholder="Last name" />
                        </div>
                      ) : (
                        <div className="font-medium">{fullName}</div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <Input value={editDraft.role} onChange={(event) => setEditDraft({ ...editDraft, role: event.target.value })} placeholder="Role" />
                      ) : (
                        employee.role || '-'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <Input value={editDraft.department} onChange={(event) => setEditDraft({ ...editDraft, department: event.target.value })} placeholder="Department" />
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
                      ) : (
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => startEdit(employee)}>
                            <UserCog className="mr-1 h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void deactivateEmployee(employee)}
                            disabled={String(employee.status).toLowerCase() === 'inactive' || deactivatingId === employee.id}
                          >
                            Deactivate
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Employee</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">First Name</label>
                <Input className="mt-1" value={addDraft.first_name} onChange={(event) => setAddDraft({ ...addDraft, first_name: event.target.value })} required />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Last Name</label>
                <Input className="mt-1" value={addDraft.last_name} onChange={(event) => setAddDraft({ ...addDraft, last_name: event.target.value })} required />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Role</label>
              <Input className="mt-1" value={addDraft.role} onChange={(event) => setAddDraft({ ...addDraft, role: event.target.value })} placeholder="Field Staff" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Department</label>
              <Input className="mt-1" value={addDraft.department} onChange={(event) => setAddDraft({ ...addDraft, department: event.target.value })} placeholder="Maintenance" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Property</label>
              <select value={addDraft.property_id} onChange={(event) => setAddDraft({ ...addDraft, property_id: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
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
                onChange={(event) => setAddDraft({ ...addDraft, status: event.target.value as 'active' | 'inactive' })}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
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
                onChange={(event) => setAddDraft({ ...addDraft, hourly_rate: event.target.value })}
                placeholder="0.00"
              />
            </div>
            <p className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
              To give this employee login access, contact your administrator.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={closeAddModal}>
              Cancel
            </Button>
            <Button onClick={() => void saveNewEmployee()} disabled={addSaving || !addDraft.first_name.trim() || !addDraft.last_name.trim()}>
              {addSaving ? 'Saving...' : 'Save Employee'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
