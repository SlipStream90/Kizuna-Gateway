// Shared types for JIG-OS Module 2 (Ringi-Flow & Citation Engine).

export type Lang = 'en' | 'ja'
export type Bilingual = { en: string; ja: string }

export type PolicySource = {
  id: string
  authority: string
  title: Bilingual
  /** Section/paragraph reference. `clauseVerified: false` means "check the current text". */
  clause: Bilingual
  clauseVerified: boolean
  url: string
  summary: Bilingual
  /** Retrieval keywords (lower-case). */
  tags: string[]
}

export type MetricKey = 'pli' | 'stateIncentive' | 'land' | 'power' | 'water' | 'customs'

export type Metric = {
  value: number | null
  display: Bilingual
  /** True when the number is a demo figure, not taken from the cited source. */
  illustrative: boolean
  citations: string[]
}

export type StateProfile = {
  id: StateId
  jit: Bilingual
  state: Bilingual
  gateway: Bilingual
  metrics: Record<MetricKey, Metric>
}

export type StateId = 'neemrana' | 'mandal' | 'sricity'
export type Sector = 'auto' | 'fmcg' | 'robotics'
export type DeptId = 'legal' | 'finance' | 'plant' | 'indiaDesk'

export type RingiInput = {
  stateId: StateId
  amountUsd: number
  sector: Sector
  partner: string
}

export type Objection = {
  id: string
  dept: DeptId
  severity: 'high' | 'medium' | 'low'
  question: Bilingual
  answer: Bilingual
  citations: string[]
}

export type DeptReadiness = { dept: DeptId; score: number; drivers: Bilingual[] }

export type FrictionIndex = {
  complianceGap: number
  consensusHorizonGap: number
  qualityVariance: number
}

export type RingiSections = {
  overview: string
  capital: string
  exitGates: string
  citations: string
}

export type RingiAnalysis = {
  input: RingiInput
  readiness: DeptReadiness[]
  objections: Objection[]
  friction: FrictionIndex
  citationIds: string[]
}
