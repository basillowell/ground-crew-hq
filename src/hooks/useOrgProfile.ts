'use client'

import { createClient } from '@/utils/supabase/browser'
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { useUser } from './useUser'

type AuthRole = 'admin' | 'manager' | 'employee' | 'viewer' | string

type OrgProfileUser = {
  authUser: User
  appUserId: string
  id: string
  employeeId: string
  orgId: string
  role: AuthRole
  status: string
  subscriptionStatus: string
  department: string
  propertyId: string
  fullName: string
  title: string
  email: string
  phone: string
  themePresetOverride: string | null
}

type AppUserRow = {
  org_id: string
  role: AuthRole
  employee_id: string | null
  theme_preset_override: string | null
}

type EmployeeRow = {
  id: string
  property_id: string | null
  first_name: string | null
  last_name: string | null
  role: string | null
  email: string | null
  phone: string | null
  department: string | null
}

type OrganizationRow = {
  id: string
  subscription_status: string | null
}

type AuthState =
  | 'checking-session'
  | 'loading-profile'
  | 'authenticated'
  | 'no-session'
  | 'profile-missing'
  | 'network-timeout'
  | 'profile-error'

let currentPropertyIdSnapshot = ''
const currentPropertyIdListeners = new Set<() => void>()

function subscribeToCurrentPropertyId(listener: () => void) {
  currentPropertyIdListeners.add(listener)
  return () => currentPropertyIdListeners.delete(listener)
}

function getCurrentPropertyIdSnapshot() {
  return currentPropertyIdSnapshot
}

function setSharedCurrentPropertyId(nextPropertyId: string | null) {
  currentPropertyIdSnapshot = nextPropertyId ?? ''
  currentPropertyIdListeners.forEach((listener) => listener())
}

function buildProfile(authUser: User, appUser: AppUserRow, employee: EmployeeRow | null, organization: OrganizationRow | null): OrgProfileUser {
  const fullName = `${employee?.first_name ?? ''} ${employee?.last_name ?? ''}`.trim() || authUser.email || 'Ground Crew User'

  return {
    authUser,
    appUserId: authUser.id,
    id: authUser.id,
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
    themePresetOverride: appUser.theme_preset_override ?? null,
  }
}

function useOrgProfileState() {
  const { user, loading: userLoading } = useUser()
  const [orgId, setOrgId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<AuthRole | null>(null)
  const [currentUser, setCurrentUser] = useState<OrgProfileUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileAttempted, setProfileAttempted] = useState(false)
  const [profileError, setProfileError] = useState(false)
  const attemptedForUserIdRef = useRef<string | null>(null)
  const currentPropertyId = useSyncExternalStore(
    subscribeToCurrentPropertyId,
    getCurrentPropertyIdSnapshot,
    getCurrentPropertyIdSnapshot,
  )

  useEffect(() => {
    let mounted = true

    if (userLoading) return

    if (!user) {
      attemptedForUserIdRef.current = null
      setOrgId(null)
      setUserRole(null)
      setCurrentUser(null)
      setProfileAttempted(true)
      setProfileError(false)
      setLoading(false)
      return
    }

    async function loadProfile() {
      setLoading(true)
      setProfileAttempted(false)
      setProfileError(false)
      const supabase = createClient()

      try {
        const fetchAppUser = async () => {
          const { data } = await supabase
            .from('app_users')
            .select('org_id, role, employee_id, theme_preset_override')
            .eq('id', user.id)
            .single()

          return data
        }

        let appUser = await fetchAppUser()

        if (!mounted) return

        if (!appUser) {
          await new Promise((resolve) => setTimeout(resolve, 500))
          if (!mounted) return
          appUser = await fetchAppUser()
          if (!mounted) return
        }

        if (!appUser) {
          attemptedForUserIdRef.current = user.id
          setOrgId(null)
          setUserRole(null)
          setCurrentUser(null)
          setProfileAttempted(true)
          setProfileError(false)
          setLoading(false)
          return
        }

        const typedAppUser = appUser as AppUserRow
        const [employeeResult, organizationResult] = await Promise.all([
          typedAppUser.employee_id
            ? supabase
                .from('employees')
                .select('id, property_id, first_name, last_name, role, email, phone, department')
                .eq('id', typedAppUser.employee_id)
                .maybeSingle()
            : Promise.resolve({ data: null }),
          supabase
            .from('organizations')
            .select('id, subscription_status')
            .eq('id', typedAppUser.org_id)
            .maybeSingle(),
        ])

        if (!mounted) return

        const profile = buildProfile(
          user,
          typedAppUser,
          (employeeResult.data as EmployeeRow | null) ?? null,
          (organizationResult.data as OrganizationRow | null) ?? null,
        )

        attemptedForUserIdRef.current = user.id
        setOrgId(profile.orgId)
        setUserRole(profile.role)
        setCurrentUser(profile)
        setProfileAttempted(true)
        setProfileError(false)
        setLoading(false)
      } catch {
        if (!mounted) return
        attemptedForUserIdRef.current = user.id
        setOrgId(null)
        setUserRole(null)
        setCurrentUser(null)
        setProfileAttempted(true)
        setProfileError(true)
        setLoading(false)
      }
    }

    void loadProfile()

    return () => {
      mounted = false
    }
  }, [user?.id, userLoading])

  const signOut = useCallback(async () => {
    setSharedCurrentPropertyId(null)
    const supabase = createClient()
    await supabase.auth.signOut()
  }, [])

  const retryAuthHydration = useCallback(async () => {
    setProfileAttempted(false)
    setProfileError(false)
    setLoading(true)
  }, [])

  const isPlanActive = useCallback(() => ['active', 'trialing'].includes(currentUser?.subscriptionStatus ?? 'trialing'), [currentUser?.subscriptionStatus])

  return useMemo(() => {
    const attemptedForCurrentUser = attemptedForUserIdRef.current === (user?.id ?? null)
    const authState: AuthState = userLoading
      ? 'checking-session'
      : loading
        ? 'loading-profile'
        : !user
          ? 'no-session'
          : currentUser && attemptedForCurrentUser
            ? 'authenticated'
            : profileError && attemptedForCurrentUser
              ? 'profile-error'
              : profileAttempted && attemptedForCurrentUser
                ? 'profile-missing'
                : 'loading-profile'
    const currentRole = currentUser?.role ?? userRole ?? 'employee'
    const isLoading = userLoading || loading

    return {
      user,
      currentUser,
      userRole,
      currentRole,
      currentPropertyId,
      setCurrentPropertyId: setSharedCurrentPropertyId,
      orgId,
      isReady: !isLoading,
      isOrgReady: Boolean(orgId) && !isLoading,
      isLoading,
      loading: isLoading,
      hasSession: Boolean(user),
      authState,
      authDebugMessage: profileError
        ? 'Unable to load your app profile. Please try again.'
        : authState === 'profile-missing'
          ? 'Signed in, but no app user profile was found.'
          : '',
      retryAuthHydration,
      signOut,
      isPlanActive,
      isAdmin: currentRole === 'admin',
      isManager: currentRole === 'manager',
      isEmployee: currentRole === 'employee',
      hasProfileIssue: authState === 'profile-missing' || authState === 'profile-error',
    }
  }, [
    currentPropertyId,
    currentUser,
    isPlanActive,
    loading,
    orgId,
    profileAttempted,
    profileError,
    retryAuthHydration,
    signOut,
    user,
    userLoading,
    userRole,
  ])
}
type OrgProfileContextValue = ReturnType<typeof useOrgProfileState>

const OrgProfileContext = createContext<OrgProfileContextValue | null>(null)

export function OrgProfileProvider({ children }: { children: ReactNode }) {
  const value = useOrgProfileState()

  return createElement(OrgProfileContext.Provider, { value }, children)
}

export function useOrgProfile() {
  const context = useContext(OrgProfileContext)
  if (!context) {
    throw new Error('useOrgProfile must be used within OrgProfileProvider')
  }

  return context
}
