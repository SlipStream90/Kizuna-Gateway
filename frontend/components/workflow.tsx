'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { AssessmentForm } from './assessment-form'
import { MarketControls } from './market-controls'
import { EvidenceControls } from './evidence-controls'
import { GtmControls } from './gtm-controls'
import { ReportControls } from './report-controls'

export function Workflow() {
  const [assessmentId, setAssessmentId] = useState('')
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="space-y-8"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="glass-panel p-8 rounded-2xl"
      >
        <AssessmentForm onCreated={setAssessmentId} />
      </motion.div>
      {assessmentId && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="glass-panel p-8 rounded-2xl space-y-6"
        >
          <h2 className="text-xl font-bold text-sumi">Assessment Created</h2>
          <p className="text-sumi/60">Assessment saved: {assessmentId}. HS code remains unresolved unless supplied.</p>
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
