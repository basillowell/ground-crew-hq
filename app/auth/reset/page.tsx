'use client'

import dynamic from 'next/dynamic'

const ResetPasswordPage = dynamic(() => import('../../_legacy/ResetPasswordPage'), { ssr: false })

export default function Page() {
  return <ResetPasswordPage />
}
