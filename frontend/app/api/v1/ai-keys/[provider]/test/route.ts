import { NextResponse } from 'next/server'

import { revealKey } from '../../../../../../lib/server/ai/credentials'
import { isProviderId, PROVIDERS, verifyKey } from '../../../../../../lib/server/ai/providers'
import { requireCaller } from '../../../../../../lib/server/session'

/** POST /api/v1/ai-keys/{provider}/test — checks the stored key still works (lists models; spends no tokens). */
export async function POST(_request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params
  if (!isProviderId(provider)) return NextResponse.json({ detail: 'Unknown provider' }, { status: 404 })
  const caller = await requireCaller()
  if (caller instanceof NextResponse) return caller

  const key = await revealKey(caller.membership, provider).catch(() => undefined)
  if (key === undefined) return NextResponse.json({ detail: 'Key store unavailable' }, { status: 503 })
  if (key === null) return NextResponse.json({ detail: `No ${PROVIDERS[provider].label} key is set.` }, { status: 404 })

  const check = await verifyKey(provider, key)
  return NextResponse.json(
    check.ok
      ? { ok: true }
      : { ok: false, reason: check.reason, detail: check.reason === 'rejected' ? `${PROVIDERS[provider].label} rejected the stored key.` : `Could not reach ${PROVIDERS[provider].label}.` },
  )
}
