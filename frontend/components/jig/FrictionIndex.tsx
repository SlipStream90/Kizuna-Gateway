'use client'

import { motion, useReducedMotion } from 'motion/react'
import { Gauge } from 'lucide-react'
import { useL } from '../../lib/jig/useL'
import type { FrictionIndex as Friction } from '../../lib/jig/types'
import { AnimatedNumber } from './AnimatedNumber'

const GAUGES: { key: keyof Friction; label: { en: string; ja: string }; hint: { en: string; ja: string } }[] = [
  {
    key: 'complianceGap',
    label: { en: 'Compliance Gap', ja: 'コンプライアンス乖離' },
    hint: { en: 'Open legal/regulatory items vs HQ expectations', ja: '本社の想定に対する未解決の法務・規制事項' },
  },
  {
    key: 'consensusHorizonGap',
    label: { en: 'Consensus Horizon Gap', ja: '合意形成期間の乖離' },
    hint: { en: 'Spread between departments × deal size', ja: '部門間の準備度の差 × 案件規模' },
  },
  {
    key: 'qualityVariance',
    label: { en: 'Quality Variance', ja: '品質ばらつき' },
    hint: { en: 'Distance from JIS-equivalent capability', ja: 'JIS相当の工程能力との差' },
  },
]

const band = (v: number) =>
  v < 30 ? { c: 'var(--color-bamboo)', en: 'Low', ja: '低' } : v < 55 ? { c: 'var(--color-gold)', en: 'Moderate', ja: '中' } : { c: 'var(--color-akaneiro)', en: 'High', ja: '高' }

// Semicircle from (10,60) to (110,60), radius 50.
const ARC = 'M10 60 A50 50 0 0 1 110 60'

export function FrictionIndex({ friction, runKey }: { friction: Friction; runKey: number }) {
  const { L, lang } = useL()
  const reduce = useReducedMotion()
  const overall = Math.round((friction.complianceGap + friction.consensusHorizonGap + friction.qualityVariance) / 3)

  return (
    <section aria-labelledby="friction-title" className="border border-hairline bg-white">
      <header className="flex items-baseline justify-between border-b border-hairline px-4 py-3">
        <h2 id="friction-title" className="flex items-center gap-2 text-sm font-medium text-sumi">
          <Gauge className="size-4 text-sumi/60" aria-hidden />
          {lang === 'ja' ? '直算 摩擦指数' : 'Chokusan (直算) Friction Index'}
        </h2>
        <span className="font-mono text-[11px] text-sumi/55">
          {lang === 'ja' ? '総合' : 'Overall'} <AnimatedNumber key={runKey} value={overall} />
        </span>
      </header>
      <ul className="grid grid-cols-3 divide-x divide-hairline">
        {GAUGES.map((g, i) => {
          const v = friction[g.key]
          const b = band(v)
          return (
            <li key={g.key} className="px-2 pb-3 pt-2 text-center">
              <svg viewBox="0 0 120 70" className="mx-auto block w-full max-w-[140px]" aria-hidden>
                <path d={ARC} fill="none" stroke="var(--color-hairline)" strokeWidth={9} strokeLinecap="round" />
                <motion.path
                  key={runKey}
                  d={ARC} fill="none" stroke={b.c} strokeWidth={9} strokeLinecap="round"
                  initial={{ pathLength: reduce ? v / 100 : 0 }}
                  animate={{ pathLength: Math.max(0.01, v / 100) }}
                  transition={{ duration: 1.3, delay: 0.2 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                />
                <text x={60} y={58} textAnchor="middle" fontSize={20} fontFamily="ui-monospace, monospace" fill="var(--color-sumi)">
                  {v}
                </text>
              </svg>
              <p className="mt-1 text-[11px] font-medium leading-tight text-sumi">{L(g.label)}</p>
              <p className="mt-0.5 font-mono text-[10px]" style={{ color: b.c }}>{L(b)}</p>
              <p className="mt-1 text-[10px] leading-snug text-sumi/50">{L(g.hint)}</p>
              <span className="sr-only">{`${L(g.label)}: ${v} / 100`}</span>
            </li>
          )
        })}
      </ul>
      <p className="border-t border-hairline px-4 py-2 text-[10px] text-sumi/50">
        {lang === 'ja'
          ? '0〜100の非対称性スコア（低いほど本社・現地間の摩擦が小さい）。部門準備度から決定的に算出。'
          : 'Asymmetry score 0–100 (lower = less HQ–India friction), derived deterministically from department readiness.'}
      </p>
    </section>
  )
}
