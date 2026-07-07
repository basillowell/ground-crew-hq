'use client'

import { BrowserRouter } from 'react-router-dom'
import LaunchPortalPage from '@/src/pages/LaunchPortalPage'

export default function LegacyLaunchPortalPage() {
  return (
    <BrowserRouter>
      <LaunchPortalPage />
    </BrowserRouter>
  )
}
