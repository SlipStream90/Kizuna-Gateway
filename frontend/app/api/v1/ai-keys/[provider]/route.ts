import { NextResponse } from 'next/server'

import { isProviderId, keyShapeError, PROVIDERS, verifyKey } from '../../../../../lib/server/ai/providers'
import { requireCaller } from '../../../../../lib/server/session'

type Context = { params: Promise<{ provider: string }> }

/**
 * PUT /api/v1/ai-keys/{provider} {key, label?} — checks the key with the provider, then
 * stores it in Vault (set_ai_credential enforces admin). The key is never echoed back.
 */
export async function PUT(request: Request, context: Context) {
  const { provider } = await context.params
  if (!isProviderId(provider)) return NextResponse.json({ detail: 'Unknown provider' }, { status: 404 })
  const caller = await requireCaller()
  if (caller instanceof NextResponse) return caller
  if (caller.membership.role !== 'admin') {
    return NextResponse.json({ detail: 'Only workspace admins can manage AI keys' }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as { key?: unknown; label?: unknown } | null
  const shape = keyShapeError(body?.key)
  if (shape) return NextResponse.json({ detail: shape }, { status: 422 })
  const key = (body!.key as string).trim()
  const label = typeof body?.label === 'string' && body.label.trim() ? body.label.trim().slice(0, 80) : null

  const check = await verifyKey(provider, key)
  if (!check.ok) {
    return check.reason === 'rejected'
      ? NextResponse.json({ detail: `${PROVIDERS[provider].label} rejected this key.`, code: 'rejected' }, { status: 422 })
      : NextResponse.json({ detail: `Could not reach ${PROVIDERS[provider].label} to check the key. Try again.`, code: 'unreachable' }, { status: 502 })
  }

  const { data, error } = await caller.supabase.rpc('set_ai_credential', {
    p_org: caller.membership.orgId, p_provider: provider, p_key: key, p_label: label,
  })
  if (error) {
    const status = error.code === '42501' ? 403 : error.code === '22023' ? 422 : 503
    return NextResponse.json({ detail: status === 503 ? 'Key store unavailable' : error.message }, { status })
  }
  const row = data as { key_hint: string; label: string | null; updated_at: string }
  return NextResponse.json({ provider, configured: true, key_hint: row.key_hint, key_label: row.label, updated_at: row.updated_at })
}

/** DELETE /api/v1/ai-keys/{provider} — removes the key and its Vault secret. */
export async function DELETE(_request: Request, context: Context) {
  const { provider } = await context.params
  if (!isProviderId(provider)) return NextResponse.json({ detail: 'Unknown provider' }, { status: 404 })
  const caller = await requireCaller()
  if (caller instanceof NextResponse) return caller

  const { error } = await caller.supabase.rpc('delete_ai_credential', { p_org: caller.membership.orgId, p_provider: provider })
  if (error) {
    const status = error.code === '42501' ? 403 : 503
    return NextResponse.json({ detail: status === 403 ? 'Only workspace admins can manage AI keys' : 'Key store unavailable' }, { status })
  }
  return new NextResponse(null, { status: 204 })
}
