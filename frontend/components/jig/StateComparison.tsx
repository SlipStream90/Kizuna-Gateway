'use client'

import { useState } from 'react'
import { motion } from 'motion/react'
import { Award, Info } from 'lucide-react'
import policies from '../../data/policies.json'
import { STATES, SECTOR_LABEL } from '../../lib/jig/engine'
import { useL } from '../../lib/jig/useL'
import type { MetricKey, Sector } from '../../lib/jig/types'
import { cn } from '../../lib/utils'
import { CitationBadge } from './CitationBadge'

type Row = {
  key: MetricKey
  label: { en: string; ja: string }
  unit?: { en: string; ja: string }
  better?: 'low' | 'high'
  max?: number
}

const ROWS: Row[] = [
  { key: 'pli', label: { en: 'PLI Scheme Incentive', ja: 'PLIスキーム奨励金' } },
  { key: 'stateIncentive', label: { en: 'State incentive policy', ja: '州の優遇政策' } },
  { key: 'land', label: { en: 'Land cost', ja: '用地コスト' }, unit: { en: 'US$ / m²', ja: '米ドル／㎡' }, better: 'low', max: 60 },
  { key: 'power', label: { en: 'Power SLA reliability', ja: '電力SLA信頼度' }, unit: { en: '% uptime', ja: '稼働率％' }, better: 'high', max: 100 },
  { key: 'water', label: { en: 'Water SLA reliability', ja: '用水SLA信頼度' }, unit: { en: '% uptime', ja: '稼働率％' }, better: 'high', max: 100 },
  { key: 'customs', label: { en: 'Avg. customs clearance', ja: '平均通関日数' }, unit: { en: 'days', ja: '日' }, better: 'low', max: 5 },
]

const PLI_BY_SECTOR: Record<Sector, { text: { en: string; ja: string }; cite: string[] }> = {
  auto: { text: { en: 'Component Champion incentive on Determined Sales Value', ja: '部品チャンピオン奨励金（判定売上高ベース）' }, cite: ['pli-auto-2021'] },
  fmcg: { text: { en: 'Food-processing PLI — category-specific rates', ja: '食品加工PLI — カテゴリー別の率' }, cite: ['pli-food-2021'] },
  robotics: { text: { en: 'No dedicated PLI — CEPA tariff preference applies', ja: '専用PLIなし — CEPA特恵関税を適用' }, cite: ['ijcepa-2011'] },
}

function bestIndex(row: Row) {
  if (!row.better) return -1
  const values = STATES.map((s) => s.metrics[row.key].value ?? NaN)
  const target = row.better === 'low' ? Math.min(...values) : Math.max(...values)
  return values.indexOf(target)
}

export function StateComparison() {
  const { L, lang } = useL()
  const [sector, setSector] = useState<Sector>('auto')

  return (
    <section aria-labelledby="matrix-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-sumi/50">
            {lang === 'ja' ? '画面01 · 州・JIT比較' : 'Screen 01 · States & JITs'}
          </p>
          <h1 id="matrix-title" className="jp-heading mt-1 text-2xl text-sumi md:text-3xl">
            {lang === 'ja' ? '州・政策比較マトリクス' : 'State & Policy Comparison Matrix'}
          </h1>
        </div>
        <div role="group" aria-label={lang === 'ja' ? '業種' : 'Sector'} className="flex border border-hairline bg-white text-xs">
          {(Object.keys(SECTOR_LABEL) as Sector[]).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={sector === s}
              onClick={() => setSector(s)}
              className={cn('px-3 py-2 transition-colors', sector === s ? 'bg-sumi text-white' : 'text-sumi/70 hover:text-sumi')}
            >
              {L(SECTOR_LABEL[s])}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto border border-hairline bg-white">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <caption className="sr-only">{lang === 'ja' ? '州・JITの比較' : 'Comparison of states and JITs'}</caption>
          <thead>
            <tr className="border-b border-hairline bg-washi/60 text-left align-bottom">
              <th scope="col" className="w-[22%] px-4 py-3 font-mono text-[10px] font-normal uppercase tracking-wider text-sumi/50">
                {lang === 'ja' ? '指標' : 'Metric'}
              </th>
              {STATES.map((s) => (
                <th key={s.id} scope="col" className="border-l border-hairline px-4 py-3 font-normal">
                  <span className="block text-[15px] font-medium text-sumi">{L(s.jit)}</span>
                  <span className="block text-xs text-sumi/60">{L(s.state)}</span>
                  <span className="mt-1 block font-mono text-[10px] text-sumi/45">{L(s.gateway)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, r) => {
              const best = bestIndex(row)
              return (
                <tr key={row.key} className="border-b border-hairline last:border-b-0">
                  <th scope="row" className="px-4 py-3 text-left align-top font-normal">
                    <span className="block font-medium text-sumi">{L(row.label)}</span>
                    {row.unit && <span className="block font-mono text-[10px] text-sumi/45">{L(row.unit)}</span>}
                    {row.key === 'pli' && (
                      <span className="mt-1 block text-[11px] text-sumi/55">
                        {lang === 'ja' ? '国の制度 — 全州共通' : 'National scheme — same in every state'}
                      </span>
                    )}
                  </th>
                  {STATES.map((s, i) => {
                    const m = s.metrics[row.key]
                    const isPli = row.key === 'pli'
                    const text = isPli ? L(PLI_BY_SECTOR[sector].text) : L(m.display)
                    const cites = isPli ? PLI_BY_SECTOR[sector].cite : m.citations
                    const pct = row.max && m.value !== null ? Math.min(100, (m.value / row.max) * 100) : null
                    return (
                      <td key={s.id} className={cn('border-l border-hairline px-4 py-3 align-top', best === i && 'bg-bamboo/[0.06]')}>
                        <div className="flex items-start justify-between gap-2">
                          <span className={cn('tabular-nums', pct !== null ? 'font-mono text-base text-sumi' : 'text-[13px] leading-snug text-sumi/85')}>
                            {text}
                          </span>
                          {best === i && (
                            <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] text-bamboo">
                              <Award className="size-3" aria-hidden />
                              {lang === 'ja' ? '最良' : 'best'}
                            </span>
                          )}
                        </div>
                        {pct !== null && (
                          <div className="mt-2 h-1 w-full bg-hairline" aria-hidden>
                            <motion.div
                              className={cn('h-1', best === i ? 'bg-bamboo' : 'bg-sumi/60')}
                              initial={{ width: 0 }}
                              animate={{ width: `${row.key === 'power' || row.key === 'water' ? (pct - 90) * 10 : pct}%` }}
                              transition={{ duration: 0.8, delay: r * 0.06 + i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                            />
                          </div>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-1">
                          {cites.map((c) => (
                            <CitationBadge key={c} id={c} align={i === STATES.length - 1 ? 'right' : 'left'} />
                          ))}
                          {m.illustrative && !isPli && (
                            <span className="rounded-[2px] border border-dashed border-sumi/25 px-1.5 py-0.5 font-mono text-[10px] text-sumi/50">
                              {lang === 'ja' ? '例示値' : 'illustrative'}
                            </span>
                          )}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="flex items-start gap-2 text-xs text-sumi/60">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          {L(policies.disclaimer)}{' '}
          {lang === 'ja'
            ? '電力・用水のバーは90〜100％の範囲を拡大表示しています。'
            : 'Power and water bars are zoomed to the 90–100% range.'}
        </span>
      </p>
    </section>
  )
}
