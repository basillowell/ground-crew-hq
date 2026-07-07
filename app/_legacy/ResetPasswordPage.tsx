'use client'

import { BrowserRouter } from 'react-router-dom'
import ResetPasswordPage from '@/src/pages/ResetPasswordPage'

export default function LegacyResetPasswordPage() {
  return (
    <BrowserRouter>
      <ResetPasswordPage />
    </BrowserRouter>
  )
}
