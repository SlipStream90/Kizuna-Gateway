// Client for the Partner Trust & Verification Engine (backend app/api/partners.py), via the BFF proxy.
// Decimals arrive as strings (exact); convert with num() only for display.

import { StatuteError, type StatuteFailure } from './statutes'

export type PartnerSector = 'auto' | 'electronics' | 'fmcg' | 'robotics' | 'chemicals'
export type Tier = 'japan_ready' | 'conditional' | 'high_friction' | 'not_recommended' | 'blocked'
export type RecordSource = 'simulated_fixture' | 'registry_mock' | 'registry_verified'

export type DirectoryItem = {
  id: string
  partner_name: string
  record_source: RecordSource
  simulated: boolean
  sector: PartnerSector
  state: string
  city: string | null
  partner_type: 'distributor' | 'supplier' | 'jv_partner' | 'contract_manufacturer'
  score: string
  tier: Tier
  otd_trailing_pct: string
  litigation_flag: boolean
  credit_band: 'low' | 'moderate' | 'high' | 'unrated'
  iso_verified: string[]
  block_flags: number
  warn_flags: number
}

export type Directory = {
  partners: DirectoryItem[]
  total: number
  scoring_version: string
  disclosure: string
}

export type PartnerRecord = {
  id: string
  partner_name: string
  record_source: RecordSource
  sector: PartnerSector
  state: string
  city: string | null
  partner_type: DirectoryItem['partner_type']
  mca_registration_no: string
  gstin: string
  registered_address: string
  incorporated_on: string | null
  mca_compliance: { status: string; annual_filings_on_time_last3: number; last_annual_return_fy: string | null }
  gst_compliance: { status: string; returns_on_time_last12: number; last_return_period: string | null }
  director_history: { name: string; din: string; role: string; appointed_on: string; ceased_on: string | null }[]
  litigation: { forum: string; case_type: string; status: string; severity: string; summary: string; reference: string }[]
  financial_solvency_score: string | null
  credit_rating: { agency: string; band: DirectoryItem['credit_band']; as_of: string | null }
  iso_certifications: { standard: string; status: 'verified' | 'claimed_unverified' | 'expired'; certificate_no: string | null; certification_body: string | null; valid_until: string | null }[]
  operations: {
    otd_monthly_pct: string[]
    fulfillment_accuracy_pct: string
    client_retention_pct: string
    foreign_principal_satisfaction_pct: string
    sla_compliance_pct: string
  }
  cross_border: { contracts_total: number; contracts_fulfilled: number; japanese_principals: number }
  data_as_of: string
}

export type TrustAudit = {
  partner_id: string
  partner_name: string
  record_source: RecordSource
  simulated: boolean
  score: string
  uncapped_score: string
  tier: Tier
  components: { key: string; label: string; points: string; max_points: string; reasons: string[] }[]
  flags: { level: 'block' | 'warn' | 'info'; code: string; message: string }[]
  otd_trailing_pct: string
  evidence: { label: string; url: string; note: string }[]
  scoring_version: string
  inputs_hash: string
  computed_at: string
  disclosure: string
  record: PartnerRecord
}

export type DirectoryFilters = { sector?: PartnerSector; state?: string; min_otd?: number; min_trust_score?: number }

export const num = (v: string | null | undefined) => (v == null ? NaN : Number(v))

async function call<T>(path: string, init?: RequestInit, signal?: AbortSignal): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api/v1${path}`, { ...init, signal, headers: { 'Content-Type': 'application/json', ...init?.headers } })
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error
    throw new StatuteError('offline', 'Network error')
  }
  if (res.status === 401) throw new StatuteError('signed_out', 'Not signed in')
  if (res.status === 404) throw new StatuteError('unavailable', 'Partner not found')
  if (!res.ok) throw new StatuteError('offline', `HTTP ${res.status}`)
  return (await res.json()) as T
}

export function listPartners(filters: DirectoryFilters, signal?: AbortSignal) {
  const q = new URLSearchParams()
  if (filters.sector) q.set('sector', filters.sector)
  if (filters.state) q.set('state', filters.state)
  if (filters.min_otd) q.set('min_otd', String(filters.min_otd))
  if (filters.min_trust_score) q.set('min_trust_score', String(filters.min_trust_score))
  const s = q.toString()
  return call<Directory>(`/partners${s ? `?${s}` : ''}`, undefined, signal)
}

export function auditPartner(id: string, signal?: AbortSignal) {
  return call<TrustAudit>(`/partners/${id}/audit-score`, { method: 'POST' }, signal)
}

export type { StatuteFailure as PartnerFailure }
