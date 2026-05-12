import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { initOrgSettings } from '@/lib/initOrgSettings';

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
  user: User | null;
  orgId: string | null;
  userRole: AuthRole | null;
  isReady: boolean;
  currentUser: AuthProfile | null;
  currentRole: AuthRole;
  currentPropertyId: string;
  setCurrentPropertyId: (propertyId: string) => void;
  signOut: () => Promise<void>;
  retryAuthHydration: () => Promise<void>;
  authDebugMessage: string;
  authState:
    | 'checking-session'
    | 'loading-profile'
    | 'authenticated'
    | 'no-session'
    | 'profile-missing'
    | 'network-timeout'
    | 'profile-error';
  hasSession: boolean;
  isOrgReady: boolean;
  isPlanActive: () => boolean;
  isAdmin: boolean;
  isManager: boolean;
  isEmployee: boolean;
  isLoading: boolean;
  hasProfileIssue: boolean;
};

type AppUserRow = {
  org_id: string;
  role: AuthRole;
  employee_id: string | null;
};

type EmployeeRow = {
  id: string;
  property_id: string | null;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  department: string | null;
};

type OrganizationRow = {
  id: string;
  subscription_status: string | null;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const isDev = import.meta.env.DEV;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<AuthRole | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthProfile | null>(null);
  const [currentPropertyId, setCurrentPropertyId] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [authDebugMessage, setAuthDebugMessage] = useState('');
  const [authState, setAuthState] = useState<AuthContextValue['authState']>('checking-session');
  const [hasSession, setHasSession] = useState(false);

  async function buildProfile(authUser: User, appUser: AppUserRow): Promise<AuthProfile> {
    let employee: EmployeeRow | null = null;
    let organization: OrganizationRow | null = null;

    if (supabase && appUser.employee_id) {
      const employeeResult = await supabase
        .from('employees')
        .select('id, property_id, first_name, last_name, role, email, phone, department')
        .eq('id', appUser.employee_id)
        .maybeSingle();
      employee = (employeeResult.data as EmployeeRow | null) ?? null;
    }

    if (supabase) {
      const organizationResult = await supabase
        .from('organizations')
        .select('id, subscription_status')
        .eq('id', appUser.org_id)
        .maybeSingle();
      organization = (organizationResult.data as OrganizationRow | null) ?? null;
    }

    const fullName = `${employee?.first_name ?? ''} ${employee?.last_name ?? ''}`.trim() || authUser.email || 'Ground Crew User';
    return {
      authUser,
      appUserId: authUser.id,
      employeeId: appUser.employee_id ?? '',
      orgId: appUser.org_id,
      role: appUser.role,
      status: 'active',
      subscriptionStatus: organization?.subscription_status ?? 'trialing',
      department: employee?.department ?? 'Maintenance',
      propertyId: employee?.property_id ?? '',
      fullName,
      title: employee?.role ?? appUser.role,
      email: employee?.email ?? authUser.email ?? '',
      phone: employee?.phone ?? '',
    };
  }

  async function loadAppUser(userId: string, authUser: User) {
    if (!supabase) {
      setOrgId(null);
      setUserRole(null);
      setCurrentUser(null);
      setHasSession(false);
      setAuthState('profile-error');
      setAuthDebugMessage('Missing Supabase configuration. Contact support.');
      setIsReady(true);
      return;
    }

    setAuthState('loading-profile');
    setAuthDebugMessage('');

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setHasSession(false);
        setAuthState('no-session');
        setIsReady(true);
        return;
      }

      const { data, error } = await supabase
        .from('app_users')
        .select('org_id, role, employee_id')
        .eq('id', userId)
        .single();

      if (data) {
        const appUser = data as AppUserRow;
        setOrgId(appUser.org_id);
        setUserRole(appUser.role);
        setHasSession(true);
        setAuthState('authenticated');
        if (isDev) {
          console.log('[Auth] app_users loaded', { orgId: appUser.org_id, role: appUser.role });
        }

        try {
          await initOrgSettings({ orgId: appUser.org_id });
        } catch (initError) {
          if (isDev) {
            console.warn('[Auth] initOrgSettings skipped', initError);
          }
        }

        try {
          const profile = await buildProfile(authUser, appUser);
          setCurrentUser(profile);
          setCurrentPropertyId((current) => current || (profile.role === 'admin' || profile.role === 'manager' ? 'all' : profile.propertyId));
        } catch (profileError) {
          if (isDev) {
            console.warn('[Auth] profile hydration fallback', profileError);
          }
          setCurrentUser({
            authUser,
            appUserId: authUser.id,
            employeeId: appUser.employee_id ?? '',
            orgId: appUser.org_id,
            role: appUser.role,
            status: 'active',
            subscriptionStatus: 'trialing',
            department: 'Maintenance',
            propertyId: '',
            fullName: authUser.email ?? 'Ground Crew User',
            title: appUser.role,
            email: authUser.email ?? '',
            phone: '',
          });
        }

        setIsReady(true);
        return;
      }

      console.warn(`[Auth] attempt ${attempt} failed:`, error?.message ?? null);

      if (attempt < 3) {
        const backoffMs = attempt === 1 ? 200 : 500;
        await delay(backoffMs);
      }
    }

    setOrgId(null);
    setUserRole(null);
    setCurrentUser(null);
    setAuthState('profile-missing');
    setAuthDebugMessage('Account not found — contact support.');
    setIsReady(true);
    console.error('app_users not found after 3 attempts for userId:', userId);
  }

  useEffect(() => {
    if (!supabase) {
      setIsReady(true);
      setAuthState('profile-error');
      setAuthDebugMessage('Missing Supabase configuration. Contact support.');
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        setCurrentUser(null);
        setOrgId(null);
        setUserRole(null);
        setCurrentPropertyId('');
        setHasSession(false);
        setAuthState('no-session');
        setAuthDebugMessage('');
        setIsReady(true);
        return;
      }

      if (session.user) {
        setIsReady(false);
        setUser(session.user);
        await loadAppUser(session.user.id, session.user);
      }
    });

    let mounted = true;
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;

      if (!session?.user) {
        setHasSession(false);
        setAuthState('no-session');
        setIsReady(true);
        return;
      }

      setIsReady(false);
      setUser(session.user);
      await delay(100);
      if (mounted) {
        await loadAppUser(session.user.id, session.user);
      }
    }

    void init();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isReady) return;
    const timeoutId = window.setTimeout(() => {
      setAuthDebugMessage((current) => current || 'Auth initialization timed out. You can refresh or sign in again.');
      setAuthState((state) => (state === 'authenticated' ? state : 'network-timeout'));
      setIsReady(true);
      console.error('[Auth] isReady timeout — forcing ready state');
    }, 15000);
    return () => window.clearTimeout(timeoutId);
  }, [isReady]);

  const currentRole: AuthRole = currentUser?.role ?? userRole ?? 'employee';
  const isLoading = !isReady;
  const isOrgReady = isReady && Boolean(orgId);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      orgId,
      userRole,
      isReady,
      currentUser,
      currentRole,
      currentPropertyId,
      setCurrentPropertyId,
      signOut: async () => {
        if (!supabase) return;
        await supabase.auth.signOut();
      },
      retryAuthHydration: async () => {
        if (!supabase) return;
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          setIsReady(false);
          setUser(data.session.user);
          await loadAppUser(data.session.user.id, data.session.user);
        } else {
          setIsReady(true);
          setAuthState('no-session');
        }
      },
      authDebugMessage,
      authState,
      hasSession,
      isOrgReady,
      isPlanActive: () => ['active', 'trialing'].includes(currentUser?.subscriptionStatus ?? 'trialing'),
      isAdmin: currentRole === 'admin',
      isManager: currentRole === 'manager',
      isEmployee: currentRole === 'employee',
      isLoading,
      hasProfileIssue: isReady && !orgId,
    }),
    [authDebugMessage, authState, currentPropertyId, currentRole, currentUser, hasSession, isLoading, isOrgReady, isReady, orgId, user, userRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
