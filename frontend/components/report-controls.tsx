'use client'

import {useState} from 'react'
import {api} from '../lib/api'
import {ReportView} from './report-view'

export function ReportControls({assessmentId}:{assessmentId:string}) { const [report,setReport]=useState<any>(); return <section><h2>Consolidated report</h2><button onClick={async()=>setReport(await api(`/assessments/${assessmentId}/report`,{method:'POST'}))}>Render report</button>{report&&<ReportView report={report}/>}</section> }
