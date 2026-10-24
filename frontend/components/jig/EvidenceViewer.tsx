'use client'

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Info, Link2, MessageCircle, ScanLine, ShieldCheck } from 'lucide-react'
import evidence from '../../data/evidence.json'
import { useL } from '../../lib/jig/useL'
import { cn } from '../../lib/utils'

type Stream = (typeof evidence.streams)[number]
type Claim = (typeof evidence.claims)[number]

/** FNV-1a (32-bit) — enough to show a tamper-evident chain in a demo. */
function fnv1a(s: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return (h >>> 0).toString(16).padStart(8, '0')
}

const SECTION = {
  overview: { en: 'Project Overview', ja: '案件概要' },
  capital: { en: 'Capital Commitment', ja: '投資金額' },
  exitGates: { en: 'Exit Gate Criteria', ja: '撤退基準' },
} as Record<string, { en: string; ja: string }>

export function EvidenceViewer() {
  const { L, lang } = useL()
  const reduce = useReducedMotion()
  const [hover, setHover] = useState<{ kind: 'claim' | 'stream'; id: string } | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const nodes = useRef(new Map<string, HTMLElement>())
  const [paths, setPaths] = useState<{ key: string; d: string; stream: string; claim: string; module: number }[]>([])

  const links = useMemo(() => evidence.streams.flatMap((s) => s.claims.map((c) => ({ stream: s.id, claim: c, module: s.module }))), [])

  const measure = useCallback(() => {
    const root = box.current
    if (!root || window.innerWidth < 1024) { setPaths([]); return }
    const rb = root.getBoundingClientRect()
    setPaths(links.map((l) => {
      const s = nodes.current.get(l.stream)!.getBoundingClientRect()
      const c = nodes.current.get(l.claim)!.getBoundingClientRect()
      const fromLeft = l.module === 1
      const x1 = (fromLeft ? s.right : s.left) - rb.left
      const y1 = s.top + s.height / 2 - rb.top
      const x2 = (fromLeft ? c.left : c.right) - rb.left
      const y2 = c.top + c.height / 2 - rb.top
      const mx = (x1 + x2) / 2
      return { key: `${l.stream}-${l.claim}`, d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`, ...l }
    }))
  }, [links])

  useLayoutEffect(() => {
    measure()
    const ro = new ResizeObserver(measure)
    if (box.current) ro.observe(box.current)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [measure, lang])

  const isLit = (stream: string, claim: string) =>
    !hover || (hover.kind === 'claim' ? hover.id === claim : hover.id === stream)

  const chain = useMemo(() => {
    let prev = '00000000'
    return links
      .map((l) => ({ ...l, at: evidence.streams.find((s) => s.id === l.stream)!.at }))
      .sort((a, b) => a.at.localeCompare(b.at))
      .map((l, i) => {
        const hash = fnv1a(`${prev}|${l.stream}|${l.claim}|${l.at}`)
        const row = { seq: i + 1, ...l, prev, hash }
        prev = hash
        return row
      })
  }, [links])

  const reg = (id: string) => (el: HTMLElement | null) => { if (el) nodes.current.set(id, el); else nodes.current.delete(id) }

  // Plain render functions (not nested components) so hover re-renders don't remount and drop focus.
  const renderStream = (s: Stream) => {
    const Icon = s.module === 1 ? MessageCircle : ScanLine
    const lit = !hover || (hover.kind === 'stream' ? hover.id === s.id : s.claims.includes(hover.id))
    return (
      <li
        key={s.id}
        ref={reg(s.id)}
        tabIndex={0}
        onMouseEnter={() => setHover({ kind: 'stream', id: s.id })}
        onMouseLeave={() => setHover(null)}
        onFocus={() => setHover({ kind: 'stream', id: s.id })}
        onBlur={() => setHover(null)}
        className={cn('border bg-white p-3 outline-none transition-opacity focus-visible:border-akaneiro', lit ? 'border-hairline opacity-100' : 'border-hairline opacity-35')}
      >
        <div className="flex items-center justify-between gap-2 font-mono text-[10px] text-sumi/50">
          <span className="flex items-center gap-1"><Icon className="size-3" aria-hidden />{s.id}</span>
          <time dateTime={s.at}>{s.at.slice(0, 16).replace('T', ' ')}</time>
        </div>
        <p className="mt-1 text-xs font-medium text-sumi">{L(s.site)}</p>
        <p className="mt-0.5 text-xs text-sumi/70">{L(s.metric)}</p>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1 flex-1 bg-hairline" aria-hidden>
            <div className="h-1" style={{ width: `${s.sentiment * 100}%`, background: s.sentiment >= 0.7 ? 'var(--color-bamboo)' : s.sentiment >= 0.5 ? 'var(--color-gold)' : 'var(--color-akaneiro)' }} />
          </div>
          <span className="font-mono text-[10px] text-sumi/55">{s.module === 1 ? (lang === 'ja' ? '心証' : 'sentiment') : (lang === 'ja' ? '適合' : 'conformance')} {s.sentiment.toFixed(2)}</span>
        </div>
        <p className="mt-1.5 flex flex-wrap gap-1 lg:hidden">
          {s.claims.map((c) => <span key={c} className="border border-hairline px-1 font-mono text-[10px] text-sumi/60">→ {c}</span>)}
        </p>
      </li>
    )
  }

  const renderClaim = (c: Claim) => {
    const lit = !hover || (hover.kind === 'claim' ? hover.id === c.id : evidence.streams.find((s) => s.id === hover.id)?.claims.includes(c.id))
    const count = links.filter((l) => l.claim === c.id).length
    return (
      <li
        key={c.id}
        ref={reg(c.id)}
        tabIndex={0}
        onMouseEnter={() => setHover({ kind: 'claim', id: c.id })}
        onMouseLeave={() => setHover(null)}
        onFocus={() => setHover({ kind: 'claim', id: c.id })}
        onBlur={() => setHover(null)}
        className={cn('border-2 bg-[#fdfcf9] p-3 outline-none transition-opacity focus-visible:border-akaneiro', lit ? 'border-sumi opacity-100' : 'border-sumi/30 opacity-40')}
      >
        <div className="flex items-center justify-between font-mono text-[10px]">
          <span className="text-akaneiro">{c.id} · {L(SECTION[c.section])}</span>
          <span className="flex items-center gap-1 text-sumi/50"><Link2 className="size-3" aria-hidden />{count}</span>
        </div>
        <p className="jp-heading mt-1 text-sm leading-snug text-sumi">{L(c.text)}</p>
      </li>
    )
  }

  return (
    <section aria-labelledby="evidence-title" className="space-y-4">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-sumi/50">
          {lang === 'ja' ? '画面03 · 証拠の紐づけ' : 'Screen 03 · Evidence linkage'}
        </p>
        <h1 id="evidence-title" className="jp-heading mt-1 text-2xl text-sumi md:text-3xl">
          {lang === 'ja' ? '証拠・監査証跡ビュー' : 'Evidence & Audit Trail View'}
        </h1>
      </div>
      <p className="flex items-start gap-2 border border-dashed border-gold/60 bg-gold/5 px-3 py-2 text-xs text-[#6b5628]">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {L(evidence.notice)}
      </p>

      <div ref={box} className="relative grid gap-4 lg:grid-cols-[1fr_1.1fr_1fr] lg:gap-16">
        <svg aria-hidden className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block">
          {paths.map((p, i) => {
            const lit = isLit(p.stream, p.claim)
            return (
              <motion.path
                key={p.key} d={p.d} fill="none"
                stroke={p.module === 1 ? 'var(--color-aijiro)' : 'var(--color-bamboo)'}
                strokeWidth={lit && hover ? 2.25 : 1.5}
                strokeOpacity={lit ? 0.85 : 0.12}
                initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }}
                transition={{ duration: 0.9, delay: reduce ? 0 : i * 0.05 }}
              />
            )
          })}
        </svg>

        <div>
          <h2 className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-aijiro">
            <MessageCircle className="size-3.5" aria-hidden />
            {lang === 'ja' ? 'モジュール1 · PoCキオスク心証' : 'Module 1 · PoC kiosk sentiment'}
          </h2>
          <ul className="relative space-y-2">{evidence.streams.filter((s) => s.module === 1).map(renderStream)}</ul>
        </div>
        <div>
          <h2 className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-sumi">
            <ShieldCheck className="size-3.5" aria-hidden />
            {lang === 'ja' ? '稟議書の主張' : 'Ringi-sho claims'}
          </h2>
          <ul className="relative space-y-3">{evidence.claims.map(renderClaim)}</ul>
        </div>
        <div>
          <h2 className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-bamboo">
            <ScanLine className="size-3.5" aria-hidden />
            {lang === 'ja' ? 'モジュール3 · AR現場監査ログ' : 'Module 3 · AR shop-floor audit'}
          </h2>
          <ul className="relative space-y-2">{evidence.streams.filter((s) => s.module === 3).map(renderStream)}</ul>
        </div>
      </div>

      <div className="border border-hairline bg-white">
        <h2 className="border-b border-hairline px-4 py-2.5 text-sm font-medium text-sumi">
          {lang === 'ja' ? '監査証跡（ハッシュチェーン）' : 'Audit trail (hash-chained)'}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left font-mono text-[11px]">
            <thead className="border-b border-hairline bg-washi/60 text-sumi/50">
              <tr>
                <th scope="col" className="px-4 py-2 font-normal">#</th>
                <th scope="col" className="px-4 py-2 font-normal">{lang === 'ja' ? '日時（IST）' : 'Time (IST)'}</th>
                <th scope="col" className="px-4 py-2 font-normal">{lang === 'ja' ? 'イベント' : 'Event'}</th>
                <th scope="col" className="px-4 py-2 font-normal">prev</th>
                <th scope="col" className="px-4 py-2 font-normal">hash</th>
              </tr>
            </thead>
            <tbody>
              {chain.map((r) => (
                <tr
                  key={r.hash}
                  onMouseEnter={() => setHover({ kind: 'stream', id: r.stream })}
                  onMouseLeave={() => setHover(null)}
                  className={cn('border-b border-hairline last:border-b-0', hover && !isLit(r.stream, r.claim) && 'opacity-40')}
                >
                  <td className="px-4 py-1.5 text-sumi/45">{String(r.seq).padStart(3, '0')}</td>
                  <td className="px-4 py-1.5 text-sumi/70">{r.at.slice(0, 16).replace('T', ' ')}</td>
                  <td className="px-4 py-1.5 text-sumi">LINK {r.stream} → {r.claim}</td>
                  <td className="px-4 py-1.5 text-sumi/40">{r.prev}</td>
                  <td className="px-4 py-1.5 text-aijiro">{r.hash}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-hairline px-4 py-2 text-[10px] text-sumi/50">
          {lang === 'ja'
            ? '各リンクは直前のハッシュを含めて算出されるため、途中の改ざんは以降のハッシュ不一致として検出されます（デモ用FNV-1a）。'
            : 'Each link hashes the previous entry, so any edit breaks every later hash (demo FNV-1a; use SHA-256 in production).'}
        </p>
      </div>
    </section>
  )
}
