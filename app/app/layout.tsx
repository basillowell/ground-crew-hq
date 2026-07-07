import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { AppShellClient } from './AppShellClient'

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  return <AppShellClient>{children}</AppShellClient>
}