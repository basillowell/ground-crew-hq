'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster as Sonner } from 'sonner'
import { Toaster } from '@/components/ui/toaster'
import { TooltipProvider } from '@/components/ui/tooltip'
import { OrgProfileProvider } from '@/hooks/useOrgProfile'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 1000 * 60 * 30,
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: 3,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <OrgProfileProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          {children}
        </TooltipProvider>
      </OrgProfileProvider>
    </QueryClientProvider>
  )
}
