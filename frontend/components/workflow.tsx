'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { AssessmentForm } from './assessment-form'
import { MarketControls } from './market-controls'
import { EvidenceControls } from './evidence-controls'
import { GtmControls } from './gtm-controls'
import { ReportControls } from './report-controls'
import { useI18n } from '../lib/i18n'
import { BarChart3, ClipboardList, MapPinned, ShieldCheck } from 'lucide-react'
import { StepIndicator } from './watermelon/step-indicator'

export function Workflow() {
  const { t } = useI18n()
  const [assessmentId, setAssessmentId] = useState('')
  const [handoff, setHandoff] = useState('')
  const steps = [
    { id: 'profile', label: t('steps.profile'), icon: ClipboardList },
    { id: 'markets', label: t('steps.markets'), icon: MapPinned },
    { id: 'evidence', label: t('steps.evidence'), icon: ShieldCheck },
    { id: 'gtm', label: t('steps.gtm'), icon: BarChart3 },
  ]
  // Creating an assessment unlocks market ranking, the next step.
  const current = assessmentId ? 1 : 0
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="space-y-8"
    >
      <StepIndicator
        steps={steps}
        current={current}
        label={t('steps.label')}
        caption={t('steps.caption').replace('{n}', String(current + 1))}
      />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="glass-panel p-6 md:p-8"
      >
        <AssessmentForm onCreated={(id, href) => { setAssessmentId(id); setHandoff(href) }} />
      </motion.div>
      {assessmentId && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="glass-panel p-6 md:p-8 space-y-6"
        >
          <h2 className="jp-heading text-xl text-sumi">{t('workflow.created')}</h2>
          <p className="text-sumi/60">Assessment saved: {assessmentId}. HS code remains unresolved unless supplied.</p>
          {handoff && (
            <a href={handoff} className="inline-flex items-center gap-1.5 text-sm text-sumi underline decoration-hairline underline-offset-4 hover:decoration-akaneiro">
              <span className="rounded-[2px] bg-sumi px-1.5 py-0.5 font-mono text-[10px] text-white no-underline">OS</span>
              {t('workflow.handoff')} →
            </a>
          )}
          <div className="grid md:grid-cols-2 gap-6">
            <MarketControls assessmentId={assessmentId} />
            <EvidenceControls assessmentId={assessmentId} />
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <GtmControls assessmentId={assessmentId} />
            <ReportControls assessmentId={assessmentId} />
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
