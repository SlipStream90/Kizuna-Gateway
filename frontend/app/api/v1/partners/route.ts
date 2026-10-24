import { NextResponse } from 'next/server'

import { forward } from '../../../../lib/server/bff'
import { directory, SECTORS, toRecord, type Sector } from '../../../../lib/server/partnerTrust'
import { createClient, currentUserId } from '../../../../lib/supabase/server'

const DECIMAL = /^\d{1,3}(\.\d+)?$/

function percent(value: string | null, name: string): string | undefined | Response {
  if (value === null || value === '') return undefined
  if (!DECIMAL.test(value) || Number(value) > 100) {
    return NextResponse.json({ detail: `${name} must be a number between 0 and 100` }, { status: 422 })
  }
  return value
}

/**
 * GET /api/v1/partners — the screened partner directory, scored on request.
 * With `assessment_id` it is the tenant's shortlist, still served by the FastAPI backend.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  if (url.searchParams.has('assessment_id')) return forward(request, ['partners'], url.search)

  const supabase = await createClient()
  if (!(await currentUserId(supabase))) return NextResponse.json({ detail: 'Not signed in' }, { status: 401 })

  const sector = url.searchParams.get('sector') || undefined
  if (sector && !SECTORS.includes(sector as Sector)) {
    return NextResponse.json({ detail: `sector must be one of ${SECTORS.join(', ')}` }, { status: 422 })
  }
  const state = url.searchParams.get('state') || undefined
  if (state && state.length > 60) return NextResponse.json({ detail: 'state is too long' }, { status: 422 })
  const minOtd = percent(url.searchParams.get('min_otd'), 'min_otd')
  if (minOtd instanceof Response) return minOtd
  const minTrustScore = percent(url.searchParams.get('min_trust_score'), 'min_trust_score')
  if (minTrustScore instanceof Response) return minTrustScore

  let query = supabase.from('partner_registry').select('*')
  if (sector) query = query.eq('sector', sector)
  const { data, error } = await query
  if (error) return NextResponse.json({ detail: 'Partner registry unavailable' }, { status: 503 })

  return NextResponse.json(directory(data.map(toRecord), { sector: sector as Sector | undefined, state, minOtd, minTrustScore }))
}
