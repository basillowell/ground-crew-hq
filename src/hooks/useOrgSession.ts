import { useMemo } from 'react';
import { useOrgProfile } from '@/hooks/useOrgProfile';

export function useOrgSession() {
  const { currentUser, hasSession, isLoading, isOrgReady, orgId, authState } = useOrgProfile();

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


