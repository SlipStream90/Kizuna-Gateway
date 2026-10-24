'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '../lib/api'

export function MarketControls({ assessmentId }: { assessmentId: string }) {
  const [result, setResult] = useState<any>()
  const [weights, setWeights] = useState({ market: '0.4', operations: '0.3', readiness: '0.3' })
  const [loading, setLoading] = useState(false)

  async function save() {
    setLoading(true)
    try {
      await api(`/assessments/${assessmentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ weights }),
      })
      setResult(await api(`/assessments/${assessmentId}/market-ranking`))
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
      <h2 className="text-lg font-bold text-sumi">Market Ranking</h2>
      <div className="glass-panel p-5 rounded-xl space-y-4">
        <p className="text-sm text-sumi/60">Adjust regional weights to rank Indian markets.</p>
        <div className="space-y-3">
          {Object.entries(weights).map(([key, value]) => (
            <label key={key} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-washi/50 border border-white/40">
              <span className="text-sm font-medium text-sumi">{key.charAt(0).toUpperCase() + key.slice(1)}</span>
              <input
                aria-label={`${key} weight`}
                value={value}
                onChange={(e) => setWeights({ ...weights, [key]: e.target.value })}
                className="glass-input px-3 py-1.5 w-24 text-right"
              />
            </label>
          ))}
        </div>
        <button
          disabled={loading}
          onClick={save}
          className="glass-button w-full py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {loading ? 'Ranking…' : 'Save weights and rank regions'}
        </button>
      </div>
        {result?.rows?.map((row: any) => (
          <motion.div
            key={row.region_id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="p-3 rounded-lg bg-washi/40 border border-white/30 card-lift"
          >
            <h3 className="font-bold text-sumi">#{row.rank} {row.name}: {row.score}</h3>
            <p className="text-xs text-sumi/60">
              Sources: {row.source_ids.join(', ')}. {row.warnings.join(' ')}
            </p>
          </motion.div>
        ))}
    </motion.div>
  )
}
