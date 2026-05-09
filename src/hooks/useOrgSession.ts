import { useMemo } from 'react';
import { useAuth } from '@/lib/auth/authContext';

export function useOrgSession() {
  const { currentUser, hasSession, isLoading, isOrgReady, orgId, authState } = useAuth();

  return useMemo(
    () => ({
      userId: currentUser?.authUser.id ?? null,
      orgId: orgId ?? currentUser?.orgId ?? null,
      hasSession,
      isLoading,
      isOrgReady: Boolean(isOrgReady && (orgId ?? currentUser?.orgId)),
      authState,
    }),
    [authState, currentUser?.authUser.id, currentUser?.orgId, hasSession, isLoading, isOrgReady, orgId],
  );
}

