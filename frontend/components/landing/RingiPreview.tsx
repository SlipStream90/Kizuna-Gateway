'use client'

// A working slice of JIG-OS on the Nishi Link landing page: the same engine,
// seals and citation badges, so visitors see real output before signing in.

import { useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowUpRight, Info } from 'lucide-react'
import { useI18n } from '../../lib/i18n'
import { analyse, SECTOR_LABEL, STATES } from '../../lib/jig/engine'
import { jigHref } from '../../lib/jig/handoff'
import type { Sector, StateId } from '../../lib/jig/types'
import { cn } from '../../lib/utils'
import { CitationBadge } from '../jig/CitationBadge'
import { DEPTS, status } from '../jig/NemawashiGraph'

const AMOUNT = 25_000_000
const PARTNER = 'Arya Precision Works (fictional)'

export function RingiPreview() {
  const { lang, t } = useI18n()
  const reduce = useReducedMotion()
  const [stateId, setStateId] = useState<StateId>('mandal')
  const [sector, setSector] = useState<Sector>('auto')
  const a = useMemo(() => analyse({ stateId, sector, amountUsd: AMOUNT, partner: PARTNER }), [stateId, sector])
  const friction = Math.round((a.friction.complianceGap + a.friction.consensusHorizonGap + a.friction.qualityVariance) / 3)
  const top = a.objections.slice(0, 2)
  const chip = (active: boolean) =>
    cn('border px-3 py-1.5 text-xs transition-colors', active ? 'border-sumi bg-sumi text-white' : 'border-hairline bg-white text-sumi/70 hover:border-sumi hover:text-sumi')

  return (
    <div className="border border-hairline bg-white">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-hairline px-5 py-4">
        <div role="group" aria-label={t('preview.state')} className="flex flex-wrap items-center gap-2">
          <span className="eyebrow mr-1">{t('preview.state')}</span>
          {STATES.map((s) => (
            <button key={s.id} type="button" aria-pressed={stateId === s.id} onClick={() => setStateId(s.id)} className={chip(stateId === s.id)}>
              {s.jit[lang]}
            </button>
          ))}
        </div>
        <div role="group" aria-label={t('preview.sector')} className="flex flex-wrap items-center gap-2">
          <span className="eyebrow mr-1">{t('preview.sector')}</span>
          {(Object.keys(SECTOR_LABEL) as Sector[]).map((s) => (
            <button key={s} type="button" aria-pressed={sector === s} onClick={() => setSector(s)} className={chip(sector === s)}>
              {SECTOR_LABEL[s][lang]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* Readiness with hanko seals */}
        <div className="border-b border-hairline p-5 md:border-b-0 md:border-r">
          <div className="flex items-baseline justify-between">
            <h3 className="eyebrow">{t('preview.readiness')}</h3>
            <p className="font-mono text-xs text-sumi/60">
              {t('preview.friction')} <span className="text-sm text-sumi">{friction}</span>
              <span className="ml-1 text-[10px] text-sumi/45">({t('preview.frictionHint')})</span>
            </p>
          </div>
          <ul className="mt-4 space-y-4">
            {a.readiness.map((d, i) => {
              const st = status(d.score)
              return (
                <li key={d.dept} className="flex items-center gap-3">
                  <motion.span
                    key={`${stateId}-${sector}-${d.dept}`}
                    aria-hidden
                    initial={reduce ? false : { scale: 1.6, opacity: 0, rotate: -14 }}
                    animate={{ scale: 1, opacity: st.key === 'blocked' ? 0.5 : 1, rotate: -6 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 18, delay: i * 0.08 }}
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-full font-serif text-sm',
                      st.key === 'ready' && 'border-2 border-akaneiro text-akaneiro',
                      st.key === 'conditional' && 'border-2 border-dashed border-akaneiro/70 text-akaneiro/80',
                      st.key === 'blocked' && 'border border-dashed border-sumi/40 text-sumi/50',
                    )}
                  >
                    {DEPTS[d.dept].seal}
                  </motion.span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate">{DEPTS[d.dept].name[lang]}</span>
                      <span className="font-mono tabular-nums">{d.score}%</span>
                    </div>
                    <div className="mt-1 h-1 bg-hairline" aria-hidden>
                      <motion.div className="h-1" style={{ background: st.stroke }} initial={false} animate={{ width: `${d.score}%` }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
                    </div>
                    <p className={cn('mt-0.5 font-mono text-[10px]', st.cls)}>{st[lang]}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        {/* First objections with their answer packs */}
        <div className="p-5">
          <h3 className="eyebrow">{t('preview.objections')}</h3>
          <ul className="mt-4 space-y-5">
            {top.map((o) => (
              <motion.li
                key={`${stateId}-${sector}-${o.id}`}
                initial={reduce ? false : { opacity: 0, y: 8, filter: 'blur(3px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.35 }}
              >
                <p className="flex items-start gap-2 text-sm text-sumi">
                  <span className="font-serif text-akaneiro" aria-hidden>{DEPTS[o.dept].seal}</span>
                  {o.question[lang]}
                </p>
                <p className="jp-body mt-1.5 border-l-2 border-bamboo/50 pl-3 text-[13px] text-sumi/70">{o.answer[lang]}</p>
                <div className="mt-2 flex flex-wrap gap-1 pl-3">
                  {o.citations.map((c) => <CitationBadge key={c} id={c} />)}
                </div>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-hairline bg-washi/50 px-5 py-4">
        <p className="flex items-start gap-2 text-xs text-sumi/55">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t('preview.note')}
        </p>
        <a
          href={jigHref({ screen: 'ringi', input: { stateId, sector, amountUsd: AMOUNT, partner: PARTNER }, autogen: true })}
          className="glass-button group px-5 py-2.5 text-sm"
        >
          {t('preview.cta')}
          <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
        </a>
      </div>
    </div>
  )
}
