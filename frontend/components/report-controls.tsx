'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '../lib/api'
import { ReportView } from './report-view'

export function ReportControls({ assessmentId }: { assessmentId: string }) {
  const [report, setReport] = useState<any>()
  const [loading, setLoading] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      <h2 className="jp-heading text-lg text-sumi">Consolidated Report</h2>
      <div className="glass-panel p-5 space-y-3">
        <p className="text-sm text-sumi/60">Generate a cached illustrative report for this assessment.</p>
        <button
          disabled={loading}
          onClick={async () => {
            setLoading(true)
            try {
              setReport(await api(`/assessments/${assessmentId}/report`, { method: 'POST' }))
            } finally {
              setLoading(false)
            }
          }}
          className="glass-button w-full py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {loading ? 'Rendering…' : 'Render report'}
        </button>
      </div>
      {report && <ReportView report={report} />}
    </motion.div>
  )
}
