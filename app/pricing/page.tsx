'use client'

import dynamic from 'next/dynamic'

const PricingPage = dynamic(() => import('../_legacy/PricingPage'), { ssr: false })

export default function Page() {
  return <PricingPage />
}
