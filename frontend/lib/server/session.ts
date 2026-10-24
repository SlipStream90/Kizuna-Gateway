import 'server-only'

import { NextResponse } from 'next/server'

import { createClient, currentUserId } from '../supabase/server'
import { currentMembership, type Membership } from './ai/credentials'

export type Caller = { supabase: Awaited<ReturnType<typeof createClient>>; userId: string; membership: Membership }

/** The signed-in caller and their workspace, or the 401/403 response to return instead. */
export async function requireCaller(): Promise<Caller | NextResponse> {
  const supabase = await createClient()
  const userId = await currentUserId(supabase)
  if (!userId) return NextResponse.json({ detail: 'Not signed in' }, { status: 401 })
  const membership = await currentMembership(supabase, userId)
  if (!membership) return NextResponse.json({ detail: 'No workspace for this account' }, { status: 403 })
  return { supabase, userId, membership }
}
