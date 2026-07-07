'use client'

import { BrowserRouter } from 'react-router-dom'
import PricingPage from '@/src/pages/PricingPage'

export default function LegacyPricingPage() {
  return (
    <BrowserRouter>
      <PricingPage />
    </BrowserRouter>
  )
}
