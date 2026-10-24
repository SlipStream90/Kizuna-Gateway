import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

/**
 * Supabase client acting as the signed-in user (their session cookie), so every query
 * is subject to row-level security. Create one per request.
 */
export async function createClient() {
  const store = await cookies()
  return createServerClient(URL, PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(toSet) {
        try {
          toSet.forEach(({ name, value, options }) => store.set(name, value, options))
        } catch {
          // Called from a Server Component, where cookies are read-only; proxy.ts refreshes them.
        }
      },
    },
  })
}

/** The verified user id (JWT signature checked), or null when signed out. */
export async function currentUserId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims?.sub) return null
  return data.claims.sub
}

/**
 * Bypasses row-level security. Server-only, and only after the caller's own access has
 * been checked: used to read Vault secrets and to write simulation progress.
 */
export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY
  if (!secret) throw new Error('SUPABASE_SECRET_KEY is not configured')
  return createSupabaseClient(URL, secret, { auth: { persistSession: false, autoRefreshToken: false } })
}
