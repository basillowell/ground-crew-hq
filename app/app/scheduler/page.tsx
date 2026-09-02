'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SchedulerRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/app/workboard?mode=week')
  }, [router])

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6 text-sm text-text-muted">
      Opening Crew Job Board...
    </div>
  )
}
