'use client'

const noopAsync = async () => {}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export function useAuth() {
  return {
    user: null,
    currentUser: null,
    userRole: null,
    currentRole: 'employee',
    currentPropertyId: null,
    setCurrentPropertyId: () => {},
    orgId: null,
    isReady: true,
    isOrgReady: false,
    isLoading: false,
    hasSession: false,
    authState: 'no-session',
    authDebugMessage: '',
    retryAuthHydration: noopAsync,
    signOut: noopAsync,
    isPlanActive: () => true,
  }
}
