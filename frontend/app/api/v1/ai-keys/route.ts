import { NextResponse } from 'next/server'

import { PROVIDER_IDS, PROVIDERS } from '../../../../lib/server/ai/providers'
import { requireCaller } from '../../../../lib/server/session'

/** GET /api/v1/ai-keys — which providers have a key in this workspace (hints only, never the key). */
export async function GET() {
  const caller = await requireCaller()
  if (caller instanceof NextResponse) return caller
  const { supabase, membership } = caller

  const { data, error } = await supabase
    .from('ai_credentials')
    .select('provider, label, key_hint, updated_at')
    .eq('org_id', membership.orgId)
  if (error) return NextResponse.json({ detail: 'Key store unavailable' }, { status: 503 })

  return NextResponse.json({
    workspace: { name: membership.orgName, role: membership.role, can_manage: membership.role === 'admin' },
    providers: PROVIDER_IDS.map((id) => {
      const row = data.find((r) => r.provider === id)
      const { label, defaultModel, keyPrefix, consoleUrl } = PROVIDERS[id]
      return {
        id, label, default_model: defaultModel, key_prefix: keyPrefix, console_url: consoleUrl,
        configured: Boolean(row),
        key_hint: row?.key_hint ?? null,
        key_label: row?.label ?? null,
        updated_at: row?.updated_at ?? null,
      }
    }),
  })
}
