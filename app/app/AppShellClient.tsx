'use client'

import { AppLayout } from '@/src/components/AppLayout'

export function AppShellClient({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>
}
