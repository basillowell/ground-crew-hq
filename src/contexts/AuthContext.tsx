import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type AuthRole = 'admin' | 'manager' | 'employee';

type AuthProfile = {
  authUser: User;
  appUserId: string;
  employeeId: string;
  orgId: string;
  role: AuthRole;
  status: string;
  subscriptionStatus: string;
  department: string;
  propertyId: string;
  fullName: string;
  title: string;
  email: string;
  phone: string;
};

type AuthContextValue = {
  currentUser: AuthProfile | null;
  currentRole: AuthRole;
  currentPropertyId: string;
  setCurrentPropertyId: (propertyId: string) => void;
  signOut: () => Promise<void>;
  isPlanActive: () => boolean;
  isAdmin: boolean;
  isManager: boolean;
  isEmployee: boolean;
  isLoading: boolean;
};

type AppUserRow = {
  id: string;
  employee_id: string;
  org_id: string;
  role: AuthRole;
  department: string | null;
  status: string;
};

type EmployeeRow = {
  id: string;
  property_id: string;
  first_name: string;
  last_name: string;
  role: string;
  email: string | null;
  phone: string | null;
  department: string;
};

type OrganizationRow = {
  id: string;
  subscription_status: string;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function loadAuthProfile(user: User | null): Promise<AuthProfile | null> {
  if (!supabase || !user) return null;

  const { data, error } = await supabase
    .from('app_users')
    .select('id, employee_id, org_id, role, department, status')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as AppUserRow;
  const { data: employeeData } = await supabase
    .from('employees')
    .select('id, property_id, first_name, last_name, role, email, phone, department')
    .eq('id', row.employee_id)
    .maybeSingle();
  const employee = (employeeData as EmployeeRow | null) ?? null;

  const { data: organizationData } = await supabase
    .from('organizations')
    .select('id, subscription_status')
    .eq('id', row.org_id)
    .maybeSingle();
  const organization = (organizationData as OrganizationRow | null) ?? null;

  return {
    authUser: user,
    appUserId: row.id,
    employeeId: row.employee_id,
    orgId: row.org_id,
    role: row.role,
    status: row.status,
    subscriptionStatus: organization?.subscription_status ?? 'trialing',
    department: row.department ?? employee?.department ?? 'Maintenance',
    propertyId: employee?.property_id ?? '',
    fullName: employee ? `${employee.first_name} ${employee.last_name}`.trim() : (user.email ?? 'WorkForce User'),
    title: employee?.role ?? row.role,
    email: employee?.email ?? user.email ?? '',
    phone: employee?.phone ?? '',
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthProfile | null>(null);
  const [currentPropertyId, setCurrentPropertyIdState] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let mounted = true;

    async function hydrateAuth() {
      setIsLoading(true);
      const { data } = await supabase.auth.getUser();
      const profile = await loadAuthProfile(data.user);
      if (!mounted) return;
      setCurrentUser(profile);
      setCurrentPropertyIdState((current) => {
        if (!profile) return '';
        if (current) return current;
        return profile.role === 'admin' || profile.role === 'manager' ? 'all' : profile.propertyId;
      });
      setIsLoading(false);
    }

    void hydrateAuth();

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (mounted) {
        setIsLoading(true);
      }
      const profile = await loadAuthProfile(session?.user ?? null);
      if (!mounted) return;
      setCurrentUser(profile);
      setCurrentPropertyIdState((current) => {
        if (!profile) return '';
        if (current) return current;
        return profile.role === 'admin' || profile.role === 'manager' ? 'all' : profile.propertyId;
      });
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const currentRole = currentUser?.role ?? 'employee';
    return {
      currentUser,
      currentRole,
      currentPropertyId,
      setCurrentPropertyId: setCurrentPropertyIdState,
      signOut: async () => {
        if (!supabase) return;
        await supabase.auth.signOut();
        setCurrentUser(null);
        setCurrentPropertyIdState('');
      },
      isPlanActive: () => ['active', 'trialing'].includes(currentUser?.subscriptionStatus ?? ''),
      isAdmin: currentRole === 'admin',
      isManager: currentRole === 'manager',
      isEmployee: currentRole === 'employee',
      isLoading,
    };
  }, [currentPropertyId, currentUser, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
