'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '../lib/api'

export function AssessmentForm({ onCreated }: { onCreated: (id: string) => void }) {
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    const f = new FormData(e.currentTarget)
    try {
      const a = await api<{ id: string }>('/assessments', {
        method: 'POST',
        body: JSON.stringify({
          product: f.get('product'),
          sector: f.get('sector'),
          target_customer: f.get('customer'),
          budget: String(f.get('budget')),
          horizon_months: Number(f.get('horizon')),
          preferred_modes: ['direct_export', 'distributor'],
          hs_code: f.get('hs_code') || null,
          unit_value: f.get('unit_value') ? String(f.get('unit_value')) : null,
          volume: f.get('volume') ? Number(f.get('volume')) : null,
          weights: { market: '0.4', operations: '0.3', readiness: '0.3' },
        }),
      })
      onCreated(a.id)
    } catch (e) {
      setError(String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <h2 className="text-xl font-bold text-sumi">Create India Assessment</h2>
      <form onSubmit={submit} className="grid gap-3">
        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-sumi/70">Product</label>
            <input required name="product" placeholder="Product" defaultValue="Industrial sensor" className="glass-input px-4 py-2.5 w-full" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-sumi/70">Sector</label>
            <input required name="sector" placeholder="Sector" defaultValue="Precision components" className="glass-input px-4 py-2.5 w-full" />
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-sumi/70">Target Customer</label>
            <input required name="customer" placeholder="Target customer" defaultValue="OEM" className="glass-input px-4 py-2.5 w-full" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-sumi/70">Budget (USD)</label>
            <input required name="budget" type="number" placeholder="1000.00" defaultValue="1000.00" className="glass-input px-4 py-2.5 w-full" />
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-sumi/70">Horizon (Months)</label>
            <input required name="horizon" type="number" placeholder="Months" defaultValue="12" className="glass-input px-4 py-2.5 w-full" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-sumi/70">HS Code (optional)</label>
            <input name="hs_code" placeholder="e.g. 9026" className="glass-input px-4 py-2.5 w-full" />
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-sumi/70">Unit Value (optional)</label>
            <input name="unit_value" type="number" placeholder="Unit value" className="glass-input px-4 py-2.5 w-full" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-sumi/70">Volume (optional)</label>
            <input name="volume" type="number" placeholder="Volume" className="glass-input px-4 py-2.5 w-full" />
          </div>
        </div>
        <button
          disabled={submitting}
          className="glass-button w-full py-3 text-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? 'Creating…' : 'Create assessment'}
        </button>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-lg bg-akaneiro/10 border border-akaneiro/30 text-akaneiro text-sm"
            role="alert"
          >
            {error}
          </motion.div>
        )}
      </form>
    </motion.div>
  )
}
