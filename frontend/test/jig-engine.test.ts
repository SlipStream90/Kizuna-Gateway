import { describe, expect, it } from 'vitest'
import { analyse } from '../lib/jig/engine'
import { SOURCE_BY_ID } from '../lib/jig/retrieve'
import { ringiMeta, ringiSections } from '../lib/ringiTemplates'
import type { RingiInput } from '../lib/jig/types'

const base: RingiInput = { stateId: 'mandal', amountUsd: 25_000_000, sector: 'auto', partner: 'Arya Precision Works (fictional)' }

describe('JIG-OS engine', () => {
  it('is deterministic', () => {
    expect(analyse(base)).toEqual(analyse(base))
  })

  it('keeps scores and friction within 0–100', () => {
    for (const sector of ['auto', 'fmcg', 'robotics'] as const) {
      for (const stateId of ['neemrana', 'mandal', 'sricity'] as const) {
        const a = analyse({ ...base, sector, stateId, partner: '', amountUsd: 120_000_000 })
        for (const d of a.readiness) expect(d.score).toBeGreaterThanOrEqual(0), expect(d.score).toBeLessThanOrEqual(100)
        for (const v of Object.values(a.friction)) expect(v).toBeGreaterThanOrEqual(0), expect(v).toBeLessThanOrEqual(100)
      }
    }
  })

  it('lists every source an answer pack cites in the citation index, and only known sources', () => {
    const a = analyse(base)
    for (const o of a.objections) for (const c of o.citations) expect(a.citationIds).toContain(c)
    for (const id of a.citationIds) expect(SOURCE_BY_ID.has(id)).toBe(true)
  })

  it('lowers legal and India Desk readiness when no partner is named', () => {
    const named = analyse(base)
    const blank = analyse({ ...base, partner: '' })
    const score = (a: typeof named, d: string) => a.readiness.find((r) => r.dept === d)!.score
    expect(score(blank, 'legal')).toBeLessThan(score(named, 'legal'))
    expect(score(blank, 'indiaDesk')).toBeLessThan(score(named, 'indiaDesk'))
    expect(blank.objections.find((o) => o.id === 'india-partner')!.severity).toBe('high')
  })
})

describe('Ringi templates', () => {
  it('renders all four sections in keigo with the subject line', () => {
    const a = analyse(base)
    const ja = ringiSections(a, 'ja')
    const meta = ringiMeta(a, 'ja', new Date('2026-10-24T00:00:00Z'))
    expect(meta.subject).toContain('製造拠点設立の件')
    expect(meta.opening).toContain('ご承認を賜りますようお願い申し上げます')
    expect(ja.overview).toContain('Arya Precision Works (fictional)社')
    expect(ja.capital).toContain('US$25,000,000')
    expect(ja.exitGates).toContain('1.33')
    expect(ja.citations.split('\n').length).toBe(a.citationIds.length)
  })

  it('splits capital into tranches that sum to the total', () => {
    const en = ringiSections(analyse(base), 'en')
    const tranches = [...en.capital.matchAll(/US\$([\d,]+) \((\d+)%\)/g)].map((m) => Number(m[1].replace(/,/g, '')))
    expect(tranches).toHaveLength(3)
    expect(tranches.reduce((a, b) => a + b, 0)).toBe(25_000_000)
  })
})
