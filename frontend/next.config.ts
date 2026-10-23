import type { NextConfig } from 'next'

// Type checking is run explicitly by the build script before Next builds.
const nextConfig: NextConfig = {
  experimental: { workerThreads: true },
}

export default nextConfig
