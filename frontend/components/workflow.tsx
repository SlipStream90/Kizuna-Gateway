'use client'

import {useState} from 'react'
import {AssessmentForm} from './assessment-form'
import {MarketControls} from './market-controls'
import {EvidenceControls} from './evidence-controls'
import {GtmControls} from './gtm-controls'
import {ReportControls} from './report-controls'

export function Workflow(){const [assessmentId,setAssessmentId]=useState('');return <main><AssessmentForm onCreated={setAssessmentId}/>{assessmentId&&<><p>Assessment saved: {assessmentId}. HS code remains unresolved unless supplied.</p><MarketControls assessmentId={assessmentId}/><EvidenceControls assessmentId={assessmentId}/><GtmControls assessmentId={assessmentId}/><ReportControls assessmentId={assessmentId}/></>}</main>}
