// Client for the backend's statutory RAG endpoint (POST /api/v1/compliance/answer),
// reached through the same-origin BFF proxy that attaches the bearer token.

import type { Bilingual, Lang } from './types'

/** Citation badge payload produced by backend app/rag/citations.py `to_badge`. */
export type LiveBadge = {
  id: string
  authority: string
  title: Bilingual
  clause: Bilingual
  clauseVerified: boolean
  label: Bilingual
  url: string | null
  file: string | null
  summary: Bilingual
  similarity: number | null
}

export type LiveSource = {
  id: string
  document_code: string
  document_title: string
  authority: string
  clause_reference: string
  citation_id: string
  citation: string
  similarity: number
  content: string
  page_start: number | null
  page_end: number | null
  source_url_or_file: string
  last_verified_date: string | null
  badge: LiveBadge
}

export type AnswerStatus = 'answered' | 'insufficient_evidence' | 'generation_unavailable' | 'refused'

export type StatuteAnswer = {
  query: string
  lang: Lang
  status: AnswerStatus
  answer: { text: string; citations: string[]; badges: LiveBadge[]; figures_verified: boolean }[]
  removed_paragraphs: number
  notice: string | null
  generation_model: string | null
  embedding_model: string
  semantic: boolean
  review_required: boolean
  sources: LiveSource[]
  citation_index: string[]
}

/** Why live statutes could not be reached at all (as opposed to a valid "no answer"). */
export type StatuteFailure = 'signed_out' | 'unavailable' | 'offline'

export class StatuteError extends Error {
  constructor(readonly kind: StatuteFailure, detail: string) {
    super(detail)
  }
}

export async function askStatutes(
  body: { query: string; lang: Lang; k?: number; document_codes?: string[] },
  signal?: AbortSignal,
): Promise<StatuteAnswer> {
  let response: Response
  try {
    response = await fetch('/api/v1/compliance/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error
    throw new StatuteError('offline', 'Network error')
  }
  if (response.status === 401) throw new StatuteError('signed_out', 'Not signed in')
  if (response.status === 503) {
    const detail = await response.json().then((b) => b.detail as string, () => 'Service unavailable')
    throw new StatuteError('unavailable', detail)
  }
  // The BFF answers 5xx when the API itself is down.
  if (!response.ok) throw new StatuteError('offline', `HTTP ${response.status}`)
  return (await response.json()) as StatuteAnswer
}

/** Builds the Ringi-sho's statutory question from the proposal inputs. */
export function ringiQuestion(lang: Lang, sector: string, state: string): string {
  return lang === 'ja'
    ? `日本企業が${state}で${sector}の製造子会社を設立する場合、外国直接投資のルート、株式発行の報告（FC-GPR）期限、居住取締役の要件、適用され得る奨励制度について、法令は何を定めていますか。`
    : `For a Japanese company setting up a ${sector} manufacturing subsidiary in ${state}, what do the statutes require on the FDI route, reporting of share issuance (FC-GPR) and its deadline, the resident director requirement, and applicable incentive schemes?`
}

export const FAILURE_TEXT: Record<StatuteFailure, Bilingual> = {
  signed_out: {
    en: 'Sign in to query the ingested statutes.',
    ja: '取込済み法令を照会するにはログインしてください。',
  },
  unavailable: {
    en: 'Statutory search is not ready on the API (embedding model not installed).',
    ja: 'APIの法令検索が準備できていません（埋め込みモデル未導入）。',
  },
  offline: {
    en: 'The Kizuna API is not reachable, so live statutes are unavailable. Curated citations are shown.',
    ja: 'Kizuna APIに接続できないため、取込済み法令を利用できません。精選した引用を表示しています。',
  },
}
