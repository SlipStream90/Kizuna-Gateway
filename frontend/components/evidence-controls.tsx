'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '../lib/api'

export function EvidenceControls({ assessmentId }: { assessmentId: string }) {
  const [partners, setPartners] = useState<any[]>([])
  const [scorecard, setScorecard] = useState<any>()
  const [compliance, setCompliance] = useState<any>()
  const [source, setSource] = useState<any>()
  const [loading, setLoading] = useState(false)

  async function searchPartners() {
    setLoading(true)
    try {
      setPartners((await api<any>('/partners?q=')).partners)
    } finally {
      setLoading(false)
    }
  }
  async function searchCompliance() {
    setLoading(true)
    try {
      setCompliance(await api(`/compliance/search?assessment_id=${assessmentId}&q=certification`))
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      <h2 className="jp-heading text-lg text-sumi">Partners and Compliance</h2>
      <div className="glass-panel p-5 space-y-4">
        <div className="flex gap-2">
          <button
            disabled={loading}
            onClick={searchPartners}
            className="glass-button flex-1 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {loading ? 'Searching…' : 'Search fictional partners'}
          </button>
          <button
            disabled={loading}
            onClick={searchCompliance}
            className="glass-button secondary flex-1 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {loading ? 'Searching…' : 'Search stored compliance passages'}
          </button>
        </div>

        {partners.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-hairline">
            <p className="text-xs font-medium text-sumi/70 uppercase tracking-wider">Fictional Partners</p>
            {partners.map((p) => (
                <motion.div
                  key={p.id}
                  whileHover={{ backgroundColor: 'rgba(244, 241, 222, 0.5)' }}
                  role="button"
                  aria-label={p.name}
                  className="p-3 rounded-lg bg-washi/30 border border-hairline cursor-pointer transition-colors"
                  onClick={async () => setScorecard(await api(`/partners/${p.id}`))}
                >
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-bold text-sumi">{p.name}</h3>
                  <span className="text-[10px] uppercase tracking-wider text-akaneiro font-bold">Fictional</span>
                </div>
                <p className="text-xs text-sumi/60">
                  Evidence coverage: {p.coverage} · Verification: {p.verification_state}
                </p>
              </motion.div>
            ))}
          </div>
        )}

        {scorecard && (
          <aside className="pt-4 border-t border-hairline">
            <h3 className="text-sm font-bold text-sumi mb-2">{scorecard.name} Scorecard</h3>
            <p className="text-xs text-sumi/60 mb-2">{scorecard.disclosure}</p>
            <p className="text-xs text-sumi/60">Missing checks: {scorecard.missing_checks.join(', ')}</p>
          </aside>
        )}

        {compliance && (
          <div className="pt-4 border-t border-hairline">
            <p className="text-xs font-medium text-sumi/70 uppercase tracking-wider">Compliance Passages</p>
            {compliance.items?.map((item: any) => (
              <article key={item.citation.source_id} className="p-3 rounded-lg bg-washi/30 border border-hairline mb-3">
                <h4 className="text-sm font-bold text-sumi">{item.item}</h4>
                <p className="text-xs text-sumi/60">{item.applicability} — human review: {String(item.review_required)}</p>
                <button
                  onClick={async () => setSource(await api(`/sources/${item.citation.source_id}`))}
                  className="text-xs text-aijiro font-medium underline hover:text-indigo-deep mt-1 block"
                >
                  Inspect {item.citation.source_id}
                </button>
              </article>
            ))}
            {source && (
              <aside className="pt-3 border-t border-hairline mt-3">
                <h4 className="text-sm font-bold text-sumi">{source.authority}</h4>
                <a href={source.canonical_url} className="text-xs text-aijiro underline break-all">{source.canonical_url}</a>
                <p className="text-xs text-sumi/60">{source.passage} (page {source.page})</p>
                <p className="text-[10px] text-sumi/50">Checked: {source.checked_at}; Retrieved: {source.retrieved_at}</p>
              </aside>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}
