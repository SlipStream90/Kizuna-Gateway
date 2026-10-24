import { redirect } from 'next/navigation'

import { AiKeysPanel } from '../../../components/settings/AiKeysPanel'
import { createClient, currentUserId } from '../../../lib/supabase/server'

export const metadata = { title: 'AI keys — Nishi Link' }

export default async function AiKeysPage() {
  const supabase = await createClient()
  if (!(await currentUserId(supabase))) redirect(`/login?next=${encodeURIComponent('/settings/ai-keys')}`)
  return <AiKeysPanel />
}
