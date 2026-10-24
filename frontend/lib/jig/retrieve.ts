// Embedded citation retrieval: BM25 over the policy corpus (titles, clauses,
// summaries, tags). Runs in-process so the demo needs no vector database.

import policies from '../../data/policies.json'
import type { PolicySource, RingiInput } from './types'

export const SOURCES = policies.sources as PolicySource[]
export const SOURCE_BY_ID = new Map(SOURCES.map((s) => [s.id, s]))

const tokenize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1)

const docs = SOURCES.map((s) => {
  const terms = [...tokenize(`${s.title.en} ${s.clause.en} ${s.summary.en}`), ...s.tags, ...s.tags] // tags weighted x2
  const tf = new Map<string, number>()
  for (const t of terms) tf.set(t, (tf.get(t) ?? 0) + 1)
  return { id: s.id, len: terms.length, tf }
})
const avgLen = docs.reduce((a, d) => a + d.len, 0) / docs.length
const df = new Map<string, number>()
for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1)

export function bm25(query: string[], k1 = 1.4, b = 0.75) {
  const N = docs.length
  return docs
    .map((d) => {
      let score = 0
      for (const q of query) {
        const f = d.tf.get(q)
        if (!f) continue
        const n = df.get(q) ?? 0
        const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5))
        score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.len) / avgLen)))
      }
      return { id: d.id, score }
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
}

const SECTOR_TERMS: Record<RingiInput['sector'], string[]> = {
  auto: ['auto', 'components', 'pli', 'jis', 'tariff'],
  fmcg: ['fmcg', 'food', 'pli', 'quality', 'bis'],
  robotics: ['robotics', 'quality', 'bis', 'tariff', 'certification'],
}

/** Builds the Regulatory Citation Index for a proposal. */
export function retrieveCitations(input: RingiInput, k = 9) {
  const query = [
    ...SECTOR_TERMS[input.sector],
    input.stateId,
    'fdi', 'fema', 'reporting', 'director', 'dividend', 'customs', 'jit',
    ...(input.amountUsd > 50_000_000 ? ['csr', 'large'] : []),
    ...(input.partner.trim() ? ['partner', 'beneficial'] : []),
  ]
  return bm25(query).slice(0, k)
}
