'use client'

import { BrowserRouter } from 'react-router-dom'
import { AppLayout } from '@/src/components/AppLayout'

export function AppShellClient({ children }: { children: React.ReactNode }) {
  return (
    <BrowserRouter>
      <AppLayout>{children}</AppLayout>
    </BrowserRouter>
  )
}