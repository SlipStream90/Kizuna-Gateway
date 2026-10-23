import type { NextConfig } from 'next'

// Type checking is run explicitly by the build script before Next builds.
const nextConfig: NextConfig = {
  // The Windows sandbox blocks child-process creation (spawn EPERM). Keep the
  // production compiler in-process; CI and local builds remain deterministic.
  experimental: { webpackBuildWorker: false },
}

export default nextConfig
