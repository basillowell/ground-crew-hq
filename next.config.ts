import type { NextConfig } from 'next'
import pkg from './package.json'

const nextConfig: NextConfig = {
  experimental: { typedRoutes: false },
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
}

export default nextConfig
