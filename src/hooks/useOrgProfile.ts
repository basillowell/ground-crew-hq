'use client'

import { createClient } from '@/utils/supabase/browser'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { useUser } from './useUser'

type OrgProfileUser = User & {
  orgId: string | null
  role: string | null
  employeeId: string | null
}

export function useOrgProfile() {
  const { user, loading: userLoading } = useUser()
  const [orgId, setOrgId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<OrgProfileUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    if (userLoading) return

    if (!user) {
      setOrgId(null)
      setUserRole(null)
      setCurrentUser(null)
      setLoading(false)
      return
    }

    setLoading(true)
    const supabase = createClient()

    supabase
      .from('app_users')
      .select('org_id, role, employee_id')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (!mounted) return
        if (data) {
          setOrgId(data.org_id)
          setUserRole(data.role)
          setCurrentUser({
            ...user,
            orgId: data.org_id,
            role: data.role,
            employeeId: data.employee_id,
          })
        } else {
          setOrgId(null)
          setUserRole(null)
          setCurrentUser(null)
        }
        setLoading(false)
      })
      .catch(() => {
        if (!mounted) return
        setOrgId(null)
        setUserRole(null)
        setCurrentUser(null)
        setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [user, userLoading])

  return { orgId, userRole, currentUser, loading }
}