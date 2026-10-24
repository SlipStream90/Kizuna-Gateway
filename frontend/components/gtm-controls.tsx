'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '../lib/api'

const base = { unit_value: '100.00', volume: 10, shipping_cost: '5.00', insurance_rate: '0.01', channel_margin_rate: '0', local_setup_cost: '0.00', other_cost: '0.00' }

export function GtmControls({ assessmentId }: { assessmentId: string }) {
  const [r, setR] = useState<any>()
  const [loading, setLoading] = useState(false)

  async function compare() {
    setLoading(true)
    try {
      setR(await api(`/assessments/${assessmentId}/gtm-scenarios`, {
        method: 'POST',
        body: JSON.stringify({
          direct: base,
          distributor: { ...base, channel_margin_rate: '0.15', local_setup_cost: '200.00' },
          sensitivity_field: 'shipping_cost',
          sensitivity_delta: '1.00',
        }),
      }))
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
      <h2 className="text-lg font-bold text-sumi">GTM Scenario Comparison</h2>
      <div className="glass-panel p-5 rounded-xl space-y-4">
        <p className="text-sm text-sumi/60">Compare direct export vs distributor entry modes for India.</p>
        <button
          disabled={loading}
          onClick={compare}
          className="glass-button w-full py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {loading ? 'Calculating…' : 'Compare direct and distributor'}
        </button>
      </div>
      {r && (
        <>
          <div className="grid gap-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-washi/40 border border-white/30 card-lift"
            >
            <h3 className="text-sm font-bold text-sumi mb-2">Direct: {r.direct.total}</h3>
              <ul className="text-xs text-sumi/60 space-y-1 mt-2">
                {r.direct.line_items.map((x: any) => (
                  <li key={x.label}>{x.label}: {x.amount}</li>
                ))}
              </ul>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-4 rounded-xl bg-washi/40 border border-white/30 card-lift"
            >
            <h3 className="text-sm font-bold text-sumi mb-2">Distributor: {r.distributor.total}</h3>
              <ul className="text-xs text-sumi/60 space-y-1 mt-2">
                {r.distributor.line_items.map((x: any) => (
                  <li key={x.label}>{x.label}: {x.amount}</li>
                ))}
              </ul>
            </motion.div>
          </div>
          <div className="p-4 rounded-xl bg-washi/30 border border-white/30">
            <p className="text-xs font-medium text-sumi/70 uppercase tracking-wider mb-2">Comparison & Sensitivity</p>
            <p className="text-xs text-sumi/60 break-all">{JSON.stringify(r.comparison)}</p>
            <p className="text-xs text-sumi/60 break-all">Sensitivity ({r.sensitivity_field}): {JSON.stringify(r.sensitivity)}</p>
          </div>
        </>
      )}
    </motion.div>
  )
}
