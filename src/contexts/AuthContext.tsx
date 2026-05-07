import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
  isPlanActive: () => boolean;
  isAdmin: boolean;
  isManager: boolean;
  isEmployee: boolean;
  isLoading: boolean;
  hasProfileIssue: boolean;
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
const isDev = import.meta.env.DEV;

function getSupabaseProjectLabel() {
  try {
    const url = new URL(import.meta.env.VITE_SUPABASE_URL ?? '');
    return url.hostname;
  } catch {
    return 'unknown-supabase-project';
  }
}

function timeoutResult<T>(ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    setTimeout(() => resolve(fallback), ms);
  });
}

async function loadAuthProfile(user: User | null): Promise<{
  profile: AuthProfile | null;
  debugMessage: string;
  reason: 'ok' | 'missing-app-user' | 'missing-employee' | 'missing-organization' | 'error';
}> {
  if (!supabase || !user) return { profile: null, debugMessage: '', reason: 'error' };
  if (isDev) {
    console.info('[Auth] Loading app profile for auth user', {
      userId: user.id,
      email: user.email ?? null,
    });
  }
  try {
    const { data, error } = await supabase
      .from('app_users')
      .select('id, employee_id, org_id, role, department, status')
      .eq('id', user.id)
      .maybeSingle();

    if (error || !data) {
      if (isDev) {
        console.warn('[Auth] app_users row missing for auth user', {
          userId: user.id,
          email: user.email ?? null,
          error: error?.message ?? null,
        });
      }
      return {
        profile: null,
        debugMessage: `Signed in to ${getSupabaseProjectLabel()}, but no app user profile was found for ${user.email ?? user.id}.`,
        reason: 'missing-app-user',
      };
    }

    const row = data as AppUserRow;
    if (isDev) {
      console.info('[Auth] app_users loaded', {
        appUserId: row.id,
        employeeId: row.employee_id,
        orgId: row.org_id,
      });
    }
    const { data: employeeData } = await supabase
      .from('employees')
      .select('id, property_id, first_name, last_name, role, email, phone, department')
      .eq('id', row.employee_id)
      .maybeSingle();
    const employee = (employeeData as EmployeeRow | null) ?? null;
    if (!employee) {
      if (isDev) {
        console.warn('[Auth] linked employee row missing', {
          authUserId: user.id,
          employeeId: row.employee_id,
        });
      }
      return {
        profile: null,
        debugMessage: `Signed in to ${getSupabaseProjectLabel()}, but the linked employee record ${row.employee_id} is missing.`,
        reason: 'missing-employee',
      };
    }
    if (isDev) {
      console.info('[Auth] employee loaded', {
        employeeId: employee.id,
        propertyId: employee.property_id,
      });
    }

    const { data: organizationData } = await supabase
      .from('organizations')
      .select('id, subscription_status')
      .eq('id', row.org_id)
      .maybeSingle();
    const organization = (organizationData as OrganizationRow | null) ?? null;
    if (!organization) {
      if (isDev) {
        console.warn('[Auth] linked organization row missing', {
          authUserId: user.id,
          orgId: row.org_id,
        });
      }
      return {
        profile: null,
        debugMessage: `Signed in to ${getSupabaseProjectLabel()}, but the linked organization ${row.org_id} is missing.`,
        reason: 'missing-organization',
      };
    }
    if (isDev) {
      console.info('[Auth] organization loaded', {
        orgId: organization.id,
        subscriptionStatus: organization.subscription_status ?? null,
      });
    }

    if (isDev) {
      console.info('[Auth] Profile hydration complete', {
        authUserId: user.id,
        appUserId: row.id,
        employeeId: row.employee_id,
        orgId: row.org_id,
        role: row.role,
      });
    }
    return {
      profile: {
        authUser: user,
        appUserId: row.id,
        employeeId: row.employee_id,
        orgId: row.org_id,
        role: row.role,
        status: row.status,
        subscriptionStatus: organization.subscription_status ?? 'trialing',
        department: row.department ?? employee.department ?? 'Maintenance',
        propertyId: employee.property_id ?? '',
        fullName: `${employee.first_name} ${employee.last_name}`.trim() || (user.email ?? 'WorkForce User'),
        title: employee.role ?? row.role,
        email: employee.email ?? user.email ?? '',
        phone: employee.phone ?? '',
      },
      debugMessage: '',
      reason: 'ok',
    };
  } catch (error) {
    if (isDev) {
      console.error('[Auth] Unexpected profile hydration error', error);
    }
    return {
      profile: null,
      debugMessage: `Could not load profile data from ${getSupabaseProjectLabel()}. Please refresh and try again.`,
      reason: 'error',
    };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthProfile | null>(null);
  const [currentPropertyId, setCurrentPropertyIdState] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [authDebugMessage, setAuthDebugMessage] = useState('');
  const [hasSession, setHasSession] = useState(false);
  const [authState, setAuthState] = useState<AuthContextValue['authState']>('checking-session');
  const retryHydrationRef = useRef<() => Promise<void>>(async () => {});
  const currentAuthUserIdRef = useRef<string | null>(null);
  const currentUserRef = useRef<AuthProfile | null>(null);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      setAuthState('profile-error');
      setAuthDebugMessage(`Missing Supabase configuration for ${getSupabaseProjectLabel()}.`);
      return;
    }

    let mounted = true;

    async function hydrateAuth(userOverride?: User | null, options?: { blockUi?: boolean }) {
      const shouldBlockUi = options?.blockUi ?? !currentUserRef.current;
      if (isDev) {
        console.info('[Auth] Starting initial auth hydration');
      }
      if (shouldBlockUi) {
        setIsLoading(true);
        setAuthState('checking-session');
      }
      try {
        const sessionUser =
          typeof userOverride === 'undefined'
            ? (await supabase.auth.getSession()).data.session?.user ?? null
            : userOverride;
        if (isDev) {
          console.info('[Auth] Initial session lookup finished', {
            hasSessionUser: Boolean(sessionUser),
            sessionUserId: sessionUser?.id ?? null,
          });
        }
        if (!sessionUser) {
          if (!mounted) return;
          setHasSession(false);
          setCurrentUser(null);
          setCurrentPropertyIdState('');
          setAuthDebugMessage('');
          setAuthState('no-session');
          return;
        }

        if (!mounted) return;
        setHasSession(true);
        if (shouldBlockUi) {
          setAuthState('loading-profile');
        }

        const profileResult = await Promise.race([
          loadAuthProfile(sessionUser),
          timeoutResult(20000, {
            profile: null,
            debugMessage: `Authentication timed out while connecting to ${getSupabaseProjectLabel()}. Please try again.`,
            reason: 'error' as const,
          }),
        ]);
        if (!mounted) return;
        if (!profileResult.profile && profileResult.debugMessage.includes('timed out')) {
          if (!currentUserRef.current) {
            setCurrentUser(null);
          }
          setAuthDebugMessage(profileResult.debugMessage);
          setAuthState('network-timeout');
          return;
        }

        if (profileResult.profile) {
          setCurrentUser(profileResult.profile);
          currentAuthUserIdRef.current = profileResult.profile.authUser.id;
        } else if (!currentUserRef.current) {
          setCurrentUser(null);
          currentAuthUserIdRef.current = null;
        }
        setAuthDebugMessage(profileResult.debugMessage);
        if (profileResult.profile || currentUserRef.current) setAuthState('authenticated');
        else if (profileResult.reason === 'missing-app-user' || profileResult.reason === 'missing-employee' || profileResult.reason === 'missing-organization') setAuthState('profile-missing');
        else setAuthState('profile-error');
        setCurrentPropertyIdState((current) => {
          if (!profileResult.profile) return '';
          if (current) return current;
          return profileResult.profile.role === 'admin' || profileResult.profile.role === 'manager' ? 'all' : profileResult.profile.propertyId;
        });
      } catch (error) {
        if (isDev) {
          console.error('[Auth] Initial auth hydration failed', error);
        }
        if (!mounted) return;
        if (!currentUserRef.current) {
          setCurrentUser(null);
          setCurrentPropertyIdState('');
          currentAuthUserIdRef.current = null;
        }
        setAuthDebugMessage(`Could not connect to ${getSupabaseProjectLabel()}. Please try again.`);
        setAuthState('profile-error');
      } finally {
        if (mounted && shouldBlockUi) {
          setIsLoading(false);
          if (isDev) {
            console.info('[Auth] Initial auth hydration finished');
          }
        }
      }
    }

    void hydrateAuth(undefined, { blockUi: true });
    retryHydrationRef.current = async () => {
      await hydrateAuth(undefined, { blockUi: true });
    };

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (isDev) {
        console.info('[Auth] Supabase auth state changed', {
          event: _event,
          hasSessionUser: Boolean(session?.user),
          sessionUserId: session?.user?.id ?? null,
        });
      }
      if (
        _event === 'TOKEN_REFRESHED' &&
        session?.user?.id &&
        currentAuthUserIdRef.current === session.user.id
      ) {
        if (isDev) {
          console.info('[Auth] Skipping profile re-hydration on token refresh for active user');
        }
        return;
      }
      await hydrateAuth(session?.user ?? null, { blockUi: !currentUserRef.current });
      if (isDev) {
        console.info('[Auth] Auth state processing finished');
      }
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
        setAuthDebugMessage('');
        setHasSession(false);
        setAuthState('no-session');
      },
      retryAuthHydration: async () => {
        await retryHydrationRef.current();
      },
      authDebugMessage,
      authState,
      hasSession,
      isPlanActive: () => ['active', 'trialing'].includes(currentUser?.subscriptionStatus ?? ''),
      isAdmin: currentRole === 'admin',
      isManager: currentRole === 'manager',
      isEmployee: currentRole === 'employee',
      isLoading,
      hasProfileIssue: !isLoading && !currentUser && Boolean(authDebugMessage),
    };
  }, [authDebugMessage, authState, currentPropertyId, currentUser, hasSession, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
