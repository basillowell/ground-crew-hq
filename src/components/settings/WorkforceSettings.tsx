import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type AuthRole = 'admin' | 'manager' | 'employee';

type WorkforceSettingsProps = {
  orgId: string;
  user: User;
  userRole: AuthRole | null;
};

type WorkforceRoleRow = {
  id: string;
  name: string;
  active: boolean | null;
};

export function WorkforceSettings({ orgId }: WorkforceSettingsProps) {
  const [newRoleName, setNewRoleName] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const rolesQuery = useQuery({
    queryKey: ['settings-workforce-roles', orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase client is not configured.');
      const { data, error } = await supabase
        .from('workforce_roles')
        .select('id, name, active')
        .eq('org_id', orgId)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as WorkforceRoleRow[];
    },
  });

  const addRole = async () => {
    if (!supabase || !newRoleName.trim()) return;
    setSaving(true);
    setErrorMessage('');
    const { error } = await supabase.from('workforce_roles').insert({
      org_id: orgId,
      name: newRoleName.trim(),
      active: true,
    });
    setSaving(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setNewRoleName('');
    await rolesQuery.refetch();
  };

  const deleteRole = async (id: string) => {
    if (!supabase) return;
    setSaving(true);
    setErrorMessage('');
    const { error } = await supabase.from('workforce_roles').delete().eq('id', id).eq('org_id', orgId);
    setSaving(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    await rolesQuery.refetch();
  };

  if (rolesQuery.isLoading) {
    return <div className="h-32 animate-pulse rounded-xl border bg-muted/40" />;
  }

  if (rolesQuery.error) {
    return (
      <div className="space-y-3 rounded-xl border p-4">
        <p className="text-sm text-destructive">Unable to load workforce roles.</p>
        <Button variant="outline" size="sm" onClick={() => void rolesQuery.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Link to="/app/employees" className="rounded-xl border p-4 hover:bg-muted/40">
          <p className="font-medium">Employees</p>
          <p className="text-sm text-muted-foreground">Set up your crew and assignments.</p>
        </Link>
        <Link to="/app/equipment" className="rounded-xl border p-4 hover:bg-muted/40">
          <p className="font-medium">Equipment</p>
          <p className="text-sm text-muted-foreground">Manage equipment readiness and availability.</p>
        </Link>
      </div>

      <div className="space-y-3 rounded-xl border p-4">
        <div>
          <h3 className="text-base font-semibold">Workforce roles</h3>
          <p className="text-sm text-muted-foreground">These options power Employees, Scheduler, and Workboard.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {rolesQuery.data?.length ? (
            rolesQuery.data.map((role) => (
              <span key={role.id} className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
                {role.name}
                <button
                  type="button"
                  onClick={() => void deleteRole(role.id)}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  ×
                </button>
              </span>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No roles configured yet.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            value={newRoleName}
            onChange={(event) => setNewRoleName(event.target.value)}
            placeholder="Add role"
            className="max-w-xs"
          />
          <Button onClick={() => void addRole()} disabled={saving || !newRoleName.trim()}>
            {saving ? 'Saving...' : 'Add role'}
          </Button>
        </div>
        {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
      </div>
    </div>
  );
}
