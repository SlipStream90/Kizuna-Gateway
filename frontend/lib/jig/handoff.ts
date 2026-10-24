// Deep links between Nishi Link (/) and JIG-OS (/jig-os). Both sides use this
// module so the URL contract lives in one place.

import type { RingiInput, Sector, StateId } from './types'

export type JigScreen = 'matrix' | 'ringi' | 'evidence'

const STATES: StateId[] = ['neemrana', 'mandal', 'sricity']
const SECTORS: Sector[] = ['auto', 'fmcg', 'robotics']
const SCREENS: JigScreen[] = ['matrix', 'ringi', 'evidence']

/** Maps free-text sector descriptions (from the Nishi Link assessment form) onto JIG-OS sectors. */
export function inferSector(text: string): Sector {
  const t = text.toLowerCase()
  if (/robot|automation|cobot|actuator/.test(t)) return 'robotics'
  if (/food|fmcg|consumer|beverage|cosmetic|personal care|household/.test(t)) return 'fmcg'
  return 'auto'
}

export function jigHref(opts: { screen?: JigScreen; input?: Partial<RingiInput>; autogen?: boolean } = {}) {
  const q = new URLSearchParams()
  if (opts.screen) q.set('screen', opts.screen)
  const i = opts.input ?? {}
  if (i.stateId) q.set('state', i.stateId)
  if (i.sector) q.set('sector', i.sector)
  if (i.amountUsd && Number.isFinite(i.amountUsd)) q.set('amount', String(Math.round(i.amountUsd)))
  if (i.partner) q.set('partner', i.partner)
  if (opts.autogen) q.set('autogen', '1')
  const s = q.toString()
  return `/jig-os${s ? `?${s}` : ''}`
}

/** Parses a JIG-OS query string; unknown or malformed values are ignored. */
export function parseJigQuery(search: string) {
  const q = new URLSearchParams(search)
  const screen = q.get('screen') as JigScreen | null
  const state = q.get('state') as StateId | null
  const sector = q.get('sector') as Sector | null
  const amount = Number(q.get('amount'))
  const partner = q.get('partner')
  const input: Partial<RingiInput> = {}
  if (state && STATES.includes(state)) input.stateId = state
  if (sector && SECTORS.includes(sector)) input.sector = sector
  if (Number.isFinite(amount) && amount > 0) input.amountUsd = Math.round(amount)
  if (partner !== null) input.partner = partner.slice(0, 120)
  return {
    screen: screen && SCREENS.includes(screen) ? screen : null,
    input,
    autogen: q.get('autogen') === '1',
  }
}
