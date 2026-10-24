'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '../lib/api'
import { useI18n } from '../lib/i18n'
import { inferSector, jigHref } from '../lib/jig/handoff'

/** Builds the JIG-OS hand-off from the form. Budget is a GTM budget, so it only seeds the
 *  investment amount when it is plausibly a capital figure. */
function handoffFrom(f: FormData) {
  const budget = Number(f.get('budget'))
  return jigHref({
    screen: 'ringi',
    input: { sector: inferSector(`${f.get('sector') ?? ''} ${f.get('product') ?? ''}`), ...(budget >= 100_000 ? { amountUsd: budget } : {}) },
    autogen: true,
  })
}

export function AssessmentForm({ onCreated }: { onCreated: (id: string, handoff: string) => void }) {
  const { t } = useI18n()
  const [error, setError] = useState('')
  const [handoff, setHandoff] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    const f = new FormData(e.currentTarget)
    setHandoff(handoffFrom(f))
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
      onCreated(a.id, handoffFrom(f))
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
      <h2 className="jp-heading text-xl text-sumi">{t('form.title')}</h2>
      <form onSubmit={submit} className="grid gap-5">
        <div className="grid md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label htmlFor="af-product" className="text-xs tracking-wide text-sumi/70">{t('form.product')}</label>
            <input id="af-product" required name="product" placeholder="Product" defaultValue="Industrial sensor" className="glass-input px-4 py-2.5 w-full" />
          </div>
          <div className="space-y-2">
            <label htmlFor="af-sector" className="text-xs tracking-wide text-sumi/70">{t('form.sector')}</label>
            <input id="af-sector" required name="sector" placeholder="Sector" defaultValue="Precision components" className="glass-input px-4 py-2.5 w-full" />
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label htmlFor="af-customer" className="text-xs tracking-wide text-sumi/70">{t('form.customer')}</label>
            <input id="af-customer" required name="customer" placeholder="Target customer" defaultValue="OEM" className="glass-input px-4 py-2.5 w-full" />
          </div>
          <div className="space-y-2">
            <label htmlFor="af-budget" className="text-xs tracking-wide text-sumi/70">{t('form.budget')}</label>
            <input id="af-budget" required name="budget" type="number" placeholder="1000.00" defaultValue="1000.00" className="glass-input px-4 py-2.5 w-full" />
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label htmlFor="af-horizon" className="text-xs tracking-wide text-sumi/70">{t('form.horizon')}</label>
            <input id="af-horizon" required name="horizon" type="number" placeholder="Months" defaultValue="12" className="glass-input px-4 py-2.5 w-full" />
          </div>
          <div className="space-y-2">
            <label htmlFor="af-hs_code" className="text-xs tracking-wide text-sumi/70">{t('form.hsCode')}</label>
            <input id="af-hs_code" name="hs_code" placeholder="e.g. 9026" className="glass-input px-4 py-2.5 w-full" />
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label htmlFor="af-unit_value" className="text-xs tracking-wide text-sumi/70">{t('form.unitValue')}</label>
            <input id="af-unit_value" name="unit_value" type="number" className="glass-input px-4 py-2.5 w-full" />
          </div>
          <div className="space-y-2">
            <label htmlFor="af-volume" className="text-xs tracking-wide text-sumi/70">{t('form.volume')}</label>
            <input id="af-volume" name="volume" type="number" className="glass-input px-4 py-2.5 w-full" />
          </div>
        </div>
        <button
          disabled={submitting}
          className="glass-button mt-2 w-full py-3 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? t('form.submitting') : t('form.submit')}
        </button>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2 border border-akaneiro/40 p-3 text-sm"
            role="alert"
          >
            <p className="text-sumi">{t('form.offline')}</p>
            {handoff && (
              <a href={handoff} className="inline-flex items-center gap-1.5 text-sm text-sumi underline decoration-akaneiro/50 underline-offset-4 hover:decoration-akaneiro">
                <span className="rounded-[2px] bg-sumi px-1.5 py-0.5 font-mono text-[10px] text-white no-underline">OS</span>
                {t('form.offlineCta')} →
              </a>
            )}
            <p className="font-mono text-[10px] text-sumi/45">{error}</p>
          </motion.div>
        )}
      </form>
    </motion.div>
  )
}
