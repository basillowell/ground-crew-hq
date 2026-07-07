'use client'

import dynamic from 'next/dynamic'

const LaunchPortalPage = dynamic(() => import('./_legacy/LaunchPortalPage'), { ssr: false })

export default function Page() {
  return <LaunchPortalPage />
}
