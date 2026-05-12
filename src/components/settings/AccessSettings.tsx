import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type AuthRole = 'admin' | 'manager' | 'employee';

type AccessSettingsProps = {
  orgId: string;
  user: User;
  userRole: AuthRole | null;
};

type AppUserRow = {
  id: string;
  employee_id: string | null;
  role: AuthRole | null;
};

type EmployeeRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

export function AccessSettings({ orgId, user, userRole }: AccessSettingsProps) {
  const navigate = useNavigate();

  const appUserQuery = useQuery({
    queryKey: ['settings-access-app-user', orgId, user.id],
    enabled: Boolean(orgId && user.id),
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase client is not configured.');
      const { data, error } = await supabase
        .from('app_users')
        .select('id, employee_id, role')
        .eq('id', user.id)
        .eq('org_id', orgId)
        .maybeSingle();
      if (error) throw error;
      return (data as AppUserRow | null) ?? null;
    },
  });

  const employeeQuery = useQuery({
    queryKey: ['settings-access-employee', orgId, appUserQuery.data?.employee_id ?? 'none'],
    enabled: Boolean(orgId && appUserQuery.data?.employee_id),
    queryFn: async () => {
      if (!supabase || !appUserQuery.data?.employee_id) return null;
      const { data, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name')
        .eq('id', appUserQuery.data.employee_id)
        .eq('org_id', orgId)
        .maybeSingle();
      if (error) throw error;
      return (data as EmployeeRow | null) ?? null;
    },
  });

  const displayName = useMemo(() => {
    const employee = employeeQuery.data;
    if (employee) {
      const fullName = `${employee.first_name ?? ''} ${employee.last_name ?? ''}`.trim();
      if (fullName) return fullName;
    }
    return user.email ?? 'User';
  }, [employeeQuery.data, user.email]);

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    navigate('/');
  };

  if (appUserQuery.isLoading || employeeQuery.isLoading) {
    return <div className="h-24 animate-pulse rounded-xl border bg-muted/40" />;
  }

  if (appUserQuery.error || employeeQuery.error) {
    return (
      <div className="space-y-3 rounded-xl border p-4">
        <p className="text-sm text-destructive">Unable to load access settings.</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void appUserQuery.refetch();
            void employeeQuery.refetch();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border p-4">
      <h3 className="text-base font-semibold">Access</h3>
      <div className="rounded-lg border bg-muted/30 p-3 text-sm">
        <p className="font-medium">{displayName}</p>
        <p className="text-muted-foreground">{user.email}</p>
        <div className="mt-2">
          <Badge variant="secondary">{appUserQuery.data?.role ?? userRole ?? 'employee'}</Badge>
        </div>
      </div>
      <Button variant="outline" onClick={() => void signOut()}>
        Sign out
      </Button>
    </div>
  );
}
