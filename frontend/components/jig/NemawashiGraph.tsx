'use client'

import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { ChevronRight, MessageSquareWarning } from 'lucide-react'
import { useL } from '../../lib/jig/useL'
import type { DeptId, DeptReadiness, Objection } from '../../lib/jig/types'
import { cn } from '../../lib/utils'
import { AnimatedNumber } from './AnimatedNumber'
import { CitationBadge } from './CitationBadge'

export const DEPTS: Record<DeptId, { name: { en: string; ja: string }; sub: { en: string; ja: string }; seal: string; x: number; y: number }> = {
  legal: { name: { en: 'Legal', ja: '法務部' }, sub: { en: 'Legal / FEMA', ja: '法務・FEMA' }, seal: '法', x: 70, y: 58 },
  finance: { name: { en: 'Finance', ja: '財務部' }, sub: { en: 'Tax / FX', ja: '税務・為替' }, seal: '財', x: 290, y: 58 },
  plant: { name: { en: 'Plant Engineering', ja: '生産技術部' }, sub: { en: 'JIS / Kaizen', ja: 'JIS・改善' }, seal: '技', x: 70, y: 202 },
  indiaDesk: { name: { en: 'India Desk', ja: 'インドデスク' }, sub: { en: 'Market / Partner', ja: '市場・パートナー' }, seal: '印', x: 290, y: 202 },
}

export function status(score: number) {
  if (score >= 80) return { key: 'ready', en: 'Ready', ja: '承認見込', cls: 'text-bamboo', stroke: 'var(--color-bamboo)' }
  if (score >= 65) return { key: 'conditional', en: 'Conditional', ja: '条件付', cls: 'text-[#8a6d2f]', stroke: 'var(--color-gold)' }
  return { key: 'blocked', en: 'Needs nemawashi', ja: '要根回し', cls: 'text-akaneiro', stroke: 'var(--color-akaneiro)' }
}

const SEVERITY = {
  high: { en: 'High', ja: '高', cls: 'border-akaneiro/40 bg-akaneiro/10 text-akaneiro' },
  medium: { en: 'Medium', ja: '中', cls: 'border-gold/50 bg-gold/10 text-[#7a6230]' },
  low: { en: 'Low', ja: '低', cls: 'border-sumi/20 bg-sumi/5 text-sumi/60' },
}

const CX = 180
const CY = 130
const R = 27
const CIRC = 2 * Math.PI * R

export function NemawashiGraph({ readiness, objections, runKey }: { readiness: DeptReadiness[]; objections: Objection[]; runKey: number }) {
  const { L, lang } = useL()
  const reduce = useReducedMotion()
  const [focus, setFocus] = useState<DeptId | null>(null)
  const avg = Math.round(readiness.reduce((a, d) => a + d.score, 0) / readiness.length)
  const shown = focus ? objections.filter((o) => o.dept === focus) : objections

  return (
    <section aria-labelledby="nemawashi-title" className="border border-hairline bg-white">
      <header className="flex items-baseline justify-between border-b border-hairline px-4 py-3">
        <h2 id="nemawashi-title" className="text-sm font-medium text-sumi">
          {lang === 'ja' ? '根回しグラフ・部門準備度' : 'Nemawashi Graph & Department Readiness'}
        </h2>
        <span className="font-mono text-[11px] text-sumi/55">
          {lang === 'ja' ? '合意度 平均' : 'Avg. consensus'} <AnimatedNumber key={runKey} value={avg} suffix="%" />
        </span>
      </header>

      {/* Consensus network */}
      <svg key={runKey} viewBox="0 0 360 260" className="block w-full" role="img" aria-label={lang === 'ja' ? '部門間の合意形成ネットワーク' : 'Consensus network between departments'}>
        {/* Lateral nemawashi between neighbouring departments */}
        {[['legal', 'finance'], ['finance', 'indiaDesk'], ['indiaDesk', 'plant'], ['plant', 'legal']].map(([a, b], i) => (
          <motion.line
            key={a + b}
            x1={DEPTS[a as DeptId].x} y1={DEPTS[a as DeptId].y} x2={DEPTS[b as DeptId].x} y2={DEPTS[b as DeptId].y}
            stroke="var(--color-hairline)" strokeWidth={1} strokeDasharray="3 4"
            initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, delay: 0.2 + i * 0.08 }}
          />
        ))}
        {readiness.map((d, i) => {
          const p = DEPTS[d.dept]
          const st = status(d.score)
          return (
            <g key={d.dept}>
              <motion.line
                x1={CX} y1={CY} x2={p.x} y2={p.y}
                stroke={st.stroke} strokeWidth={1 + d.score / 40} strokeOpacity={0.55}
                initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }}
                transition={{ duration: 0.9, delay: 0.1 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
              />
              {!reduce && (
                <motion.circle
                  r={2.5} fill={st.stroke}
                  initial={{ cx: CX, cy: CY, opacity: 0 }}
                  animate={{ cx: [CX, p.x], cy: [CY, p.y], opacity: [0, 1, 0] }}
                  transition={{ duration: 2.4, delay: 1 + i * 0.3, repeat: Infinity, repeatDelay: 1.2, ease: 'easeInOut' }}
                />
              )}
            </g>
          )
        })}
        {/* Centre: the Ringi-sho */}
        <rect x={CX - 26} y={CY - 26} width={52} height={52} rx={3} fill="var(--color-sumi)" />
        <text x={CX} y={CY + 2} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontFamily="var(--font-serif)" fontSize={18}>稟議</text>
        {readiness.map((d, i) => {
          const p = DEPTS[d.dept]
          const st = status(d.score)
          const active = focus === d.dept
          return (
            <g
              key={d.dept}
              role="button"
              tabIndex={0}
              aria-pressed={active}
              aria-label={`${L(p.name)} ${d.score}% — ${L(st)}`}
              onClick={() => setFocus(active ? null : d.dept)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFocus(active ? null : d.dept) } }}
              className="cursor-pointer outline-none [&:focus-visible>circle:first-child]:stroke-akaneiro"
            >
              <circle cx={p.x} cy={p.y} r={R + 6} fill="#fff" stroke={active ? 'var(--color-sumi)' : 'var(--color-hairline)'} />
              <circle cx={p.x} cy={p.y} r={R} fill="none" stroke="var(--color-hairline)" strokeWidth={4} />
              <motion.circle
                cx={p.x} cy={p.y} r={R} fill="none" stroke={st.stroke} strokeWidth={4} strokeLinecap="round"
                transform={`rotate(-90 ${p.x} ${p.y})`} strokeDasharray={CIRC}
                initial={{ strokeDashoffset: reduce ? CIRC * (1 - d.score / 100) : CIRC }}
                animate={{ strokeDashoffset: CIRC * (1 - d.score / 100) }}
                transition={{ duration: 1.4, delay: 0.3 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
              />
              <text x={p.x} y={p.y + 1} textAnchor="middle" dominantBaseline="middle" fontFamily="var(--font-serif)" fontSize={17} fill="var(--color-sumi)">
                {p.seal}
              </text>
              <text x={p.x} y={p.y + R + 20} textAnchor="middle" fontSize={10} fill="var(--color-sumi)" opacity={0.75}>
                {L(p.name)} · {d.score}%
              </text>
            </g>
          )
        })}
      </svg>

      {/* Scorecard */}
      <ul className="grid grid-cols-1 border-t border-hairline sm:grid-cols-2">
        {readiness.map((d, i) => {
          const p = DEPTS[d.dept]
          const st = status(d.score)
          return (
            <li key={d.dept} className={cn('border-hairline p-3', i % 2 === 0 && 'sm:border-r', i < 2 && 'border-b')}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-sumi">
                  {L(p.name)} <span className="text-sumi/45">· {L(p.sub)}</span>
                </span>
                <span className="font-mono text-sm text-sumi"><AnimatedNumber key={runKey} value={d.score} suffix="%" delay={0.2 + i * 0.1} /></span>
              </div>
              <div className="mt-1.5 h-1 bg-hairline" aria-hidden>
                <motion.div
                  key={runKey}
                  className="h-1"
                  style={{ background: st.stroke }}
                  initial={{ width: reduce ? `${d.score}%` : 0 }}
                  animate={{ width: `${d.score}%` }}
                  transition={{ duration: 1.2, delay: 0.2 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <p className={cn('mt-1 font-mono text-[10px]', st.cls)}>{L(st)}</p>
              <ul className="mt-1.5 space-y-0.5 text-[11px] leading-snug text-sumi/65">
                {d.drivers.slice(0, 3).map((dr, j) => <li key={j}>· {L(dr)}</li>)}
              </ul>
            </li>
          )
        })}
      </ul>

      {/* Predicted objections & answer packs */}
      <div className="border-t border-hairline">
        <div className="flex items-center justify-between px-4 py-2.5">
          <h3 className="flex items-center gap-2 text-xs font-medium text-sumi">
            <MessageSquareWarning className="size-3.5 text-akaneiro" aria-hidden />
            {lang === 'ja' ? '想定される指摘と回答パック' : 'Predicted objections & answer packs'}
            <span className="font-mono text-sumi/45">({shown.length})</span>
          </h3>
          {focus && (
            <button type="button" onClick={() => setFocus(null)} className="font-mono text-[10px] text-aijiro hover:underline">
              {lang === 'ja' ? 'すべて表示' : 'Show all'}
            </button>
          )}
        </div>
        <ul className="divide-y divide-hairline border-t border-hairline">
          {shown.map((o, i) => (
            <motion.li
              key={`${runKey}-${o.id}`}
              initial={{ opacity: 0, y: reduce ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: reduce ? 0 : 0.6 + i * 0.05 }}
            >
              <details className="group px-4 py-2.5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-start gap-2 text-xs">
                  <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-sumi/40 transition-transform group-open:rotate-90" aria-hidden />
                  <span className={cn('shrink-0 rounded-[2px] border px-1 font-mono text-[10px]', SEVERITY[o.severity].cls)}>
                    {L(SEVERITY[o.severity])}
                  </span>
                  <span className="shrink-0 font-serif text-akaneiro" aria-hidden>{DEPTS[o.dept].seal}</span>
                  <span className="text-sumi">{L(o.question)}</span>
                </summary>
                <div className="ml-[22px] mt-2 border-l-2 border-bamboo/50 pl-3">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-bamboo">
                    {lang === 'ja' ? '回答パック' : 'Answer pack'}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-sumi/80">{L(o.answer)}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {o.citations.map((c) => <CitationBadge key={c} id={c} />)}
                  </div>
                </div>
              </details>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  )
}
