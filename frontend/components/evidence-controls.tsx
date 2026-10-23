'use client'

import {useState} from 'react'
import {api} from '../lib/api'

export function EvidenceControls({assessmentId}:{assessmentId:string}) {
 const [partners,setPartners]=useState<any[]>([]); const [scorecard,setScorecard]=useState<any>(); const [compliance,setCompliance]=useState<any>(); const [source,setSource]=useState<any>()
 async function searchPartners(){setPartners((await api<any>('/partners?q=')).partners)}
 async function searchCompliance(){setCompliance(await api(`/compliance/search?assessment_id=${assessmentId}&q=certification`))}
 return <section><h2>Partners and compliance evidence</h2><button onClick={searchPartners}>Search fictional partners</button>{partners.map(p=><article key={p.id}><button onClick={async()=>setScorecard(await api(`/partners/${p.id}`))}>{p.name}</button><p>Fictional: {String(p.fictional)} · evidence coverage: {p.coverage} · verification: {p.verification_state}</p></article>)}{scorecard&&<aside><h3>{scorecard.name} scorecard</h3><p>{scorecard.disclosure}</p><p>Missing checks: {scorecard.missing_checks.join(', ')}</p></aside>}<button onClick={searchCompliance}>Search stored compliance passages</button>{compliance&&<>{compliance.items.map((item:any)=><article key={item.citation.source_id}><h3>{item.item}</h3><p>{item.applicability} — human review: {String(item.review_required)}</p><button onClick={async()=>setSource(await api(`/sources/${item.citation.source_id}`))}>Inspect {item.citation.source_id}</button></article>)}{source&&<aside><h3>{source.authority}</h3><a href={source.canonical_url}>{source.canonical_url}</a><p>{source.passage} (page {source.page})</p><p>Checked: {source.checked_at}; retrieved: {source.retrieved_at}</p></aside>}</>}</section>
}
