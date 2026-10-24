import { NextResponse } from 'next/server'

import { audit, toRecord } from '../../../../../../lib/server/partnerTrust'
import { createClient, currentUserId } from '../../../../../../lib/supabase/server'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** POST /api/v1/partners/{id}/audit-score — the full Japan-Readiness & Trust breakdown. */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const supabase = await createClient()
  if (!(await currentUserId(supabase))) return NextResponse.json({ detail: 'Not signed in' }, { status: 401 })
  if (!UUID.test(id)) return NextResponse.json({ detail: 'partner id must be a UUID' }, { status: 422 })

  const { data, error } = await supabase.from('partner_registry').select('*').eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ detail: 'Partner registry unavailable' }, { status: 503 })
  if (!data) return NextResponse.json({ detail: 'Partner not found' }, { status: 404 })
  return NextResponse.json(audit(toRecord(data)))
}
