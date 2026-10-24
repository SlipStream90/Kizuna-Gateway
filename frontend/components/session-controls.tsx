'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

type Session = { authenticated: boolean; user?: string; roles?: string[] }

/**
 * Sign-in / sign-out controls. The access token never appears here — only the
 * labels published by app/api/auth/session.
 */

export function SessionControls() {
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    let active = true
    fetch('/api/auth/session')
      .then(response => (response.ok ? response.json() : null))
      .then(body => { if (active) setSession(body) })
      .catch(() => { if (active) setSession({ authenticated: false }) })
    return () => { active = false }
  }, [])

  if (session === null) {
    return <span className="text-xs text-sumi/40">Checking session…</span>
  }

  if (!session.authenticated) {
    return (
      <motion.a
        href="/api/auth/login"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="glass-button px-4 py-2 text-sm font-semibold"
      >
        Sign in
      </motion.a>
    )
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-sumi/70">{session.user}</span>
      <a href="/api/auth/logout" className="text-sumi/60 hover:text-aijiro transition-colors">
        Sign out
      </a>
    </div>

  )
}
