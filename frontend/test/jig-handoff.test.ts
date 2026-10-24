import { describe, expect, it } from 'vitest'
import { inferSector, jigHref, parseJigQuery } from '../lib/jig/handoff'

describe('Nishi Link ⇄ JIG-OS hand-off', () => {
  it('round-trips inputs through the URL', () => {
    const href = jigHref({ screen: 'ringi', input: { stateId: 'sricity', sector: 'fmcg', amountUsd: 12_500_000, partner: 'A & B Co.' }, autogen: true })
    const q = parseJigQuery(href.split('?')[1])
    expect(q).toEqual({ screen: 'ringi', input: { stateId: 'sricity', sector: 'fmcg', amountUsd: 12_500_000, partner: 'A & B Co.' }, autogen: true })
  })

  it('ignores unknown or malformed values', () => {
    const q = parseJigQuery('screen=admin&state=goa&sector=steel&amount=-5&autogen=yes')
    expect(q).toEqual({ screen: null, input: {}, autogen: false })
  })

  it('maps free-text sectors from the assessment form', () => {
    expect(inferSector('Precision components')).toBe('auto')
    expect(inferSector('Packaged food & beverage')).toBe('fmcg')
    expect(inferSector('Industrial robotics / cobots')).toBe('robotics')
  })
})
