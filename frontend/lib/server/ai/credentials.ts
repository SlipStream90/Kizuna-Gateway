import 'server-only'

import type { createClient } from '../../supabase/server'
import { createAdminClient } from '../../supabase/server'
import type { ProviderId } from './providers'

type UserClient = Awaited<ReturnType<typeof createClient>>

export type Membership = { orgId: string; orgName: string; role: 'member' | 'advisor' | 'reviewer' | 'admin' }

/** The caller's workspace (oldest membership), read under RLS. */
export async function currentMembership(supabase: UserClient, userId: string): Promise<Membership | null> {
  const { data, error } = await supabase
    .from('memberships')
    .select('org_id, role, created_at, organizations(name)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  const org = data.organizations as unknown as { name: string } | null
  return { orgId: data.org_id, orgName: org?.name ?? '', role: data.role }
}

/**
 * The decrypted key for a provider, or null. Only call after `currentMembership` has
 * confirmed the caller belongs to `orgId`: this uses the service role and bypasses RLS.
 */
export async function revealKey(membership: Membership, provider: ProviderId): Promise<string | null> {
  const { data, error } = await createAdminClient().rpc('reveal_ai_credential', { p_org: membership.orgId, p_provider: provider })
  if (error) throw new Error('Could not read the stored key')
  return (data as string | null) ?? null
}
