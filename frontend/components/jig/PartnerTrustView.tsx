'use client'

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import {
  AlertTriangle, BadgeCheck, Ban, ExternalLink, FileSignature, Gavel, Info, Loader2, ShieldAlert, Users,
} from 'lucide-react'
import { jigHref } from '../../lib/jig/handoff'
import {
  auditPartner, listPartners, num, type Directory, type DirectoryItem, type PartnerSector, type Tier, type TrustAudit,
} from '../../lib/jig/partners'
import { FAILURE_TEXT, StatuteError, type StatuteFailure } from '../../lib/jig/statutes'
import type { StateId } from '../../lib/jig/types'
import { useL } from '../../lib/jig/useL'
import { cn } from '../../lib/utils'

const SECTORS: { id: PartnerSector; en: string; ja: string }[] = [
  { id: 'auto', en: 'Auto components', ja: '自動車部品' },
  { id: 'electronics', en: 'Electronics', ja: '電子機器' },
  { id: 'fmcg', en: 'FMCG', ja: '日用消費財' },
  { id: 'robotics', en: 'Robotics', ja: 'ロボティクス' },
  { id: 'chemicals', en: 'Chemicals', ja: '化学' },
]

const TIER: Record<Tier, { en: string; ja: string; color: string; cls: string }> = {
  japan_ready: { en: 'Japan-ready', ja: '日本基準適合', color: 'var(--color-bamboo)', cls: 'border-bamboo/40 bg-bamboo/10 text-bamboo' },
  conditional: { en: 'Conditional', ja: '条件付', color: 'var(--color-gold)', cls: 'border-gold/50 bg-gold/10 text-[#7a6230]' },
  high_friction: { en: 'High friction', ja: '摩擦大', color: '#c2702d', cls: 'border-[#c2702d]/40 bg-[#c2702d]/10 text-[#9a5420]' },
  not_recommended: { en: 'Not recommended', ja: '非推奨', color: 'var(--color-akaneiro)', cls: 'border-akaneiro/40 bg-akaneiro/10 text-akaneiro' },
  blocked: { en: 'Blocked', ja: '取引不可', color: 'var(--color-akaneiro)', cls: 'border-akaneiro bg-akaneiro text-white' },
}

const TYPE = {
  distributor: { en: 'Distributor', ja: '販売代理店' },
  supplier: { en: 'Supplier', ja: 'サプライヤー' },
  jv_partner: { en: 'JV partner', ja: '合弁パートナー' },
  contract_manufacturer: { en: 'Contract manufacturer', ja: '受託製造' },
}

const CREDIT = {
  low: { en: 'Low risk', ja: '低リスク', idx: 0 },
  moderate: { en: 'Moderate risk', ja: '中リスク', idx: 1 },
  high: { en: 'High risk', ja: '高リスク', idx: 2 },
  unrated: { en: 'Unrated', ja: '格付なし', idx: -1 },
}

const COMPONENT_JA: Record<string, string> = {
  mca: 'MCA登記・届出状況', gst: 'GST申告の定期性', litigation: '訴訟リスク', iso: 'ISO品質・環境認証',
  credit: '信用力', delivery: '納期遵守・受注精度', cross_border: '越境取引実績・委託元満足度',
}

function flagJa(code: string, r: TrustAudit['record']): string | null {
  const otd = r.operations.otd_monthly_pct.map(num)
  const mean = (otd.reduce((a, b) => a + b, 0) / otd.length).toFixed(1)
  const pending = r.litigation.filter((c) => c.status === 'pending')
  const table: Record<string, string> = {
    mca_not_active: 'MCA上で登記抹消または清算中の会社です。',
    mca_dormant: 'MCA上で休眠会社として登録されています。',
    mca_non_compliant: '存続中ですが、MCAの年次届出を遵守していません。',
    gst_cancelled: 'GST登録が取り消されています。',
    gst_suspended: 'GST登録が停止されています。',
    gst_irregular: `期限内のGST申告は過去12か月中${r.gst_compliance.returns_on_time_last12}回のみです。`,
    litigation_major: '係属中の重大な税務・会社法関連の訴訟があります。',
    litigation_pending: `係属中の軽微な訴訟が${pending.length}件あります。`,
    credit_high_risk: '信用リスクが高いと評価されています。',
    credit_unrated: '信用格付がありません。',
    otd_low: `直近12か月の納期遵守率は${mean}%（90%未満）です。`,
    no_cross_border: '確認済みの越境取引実績がありません。',
    simulated_record: '架空データです。識別番号と指標は例示であり、登録情報ではありません。',
  }
  return table[code] ?? null
}

// JIT state → JIG-OS Ringi-sho township, for the hand-off.
const STATE_TO_JIT: Record<string, StateId> = { Rajasthan: 'neemrana', Gujarat: 'mandal', 'Andhra Pradesh': 'sricity' }

function ScoreRing({ score, tier, size = 44, stroke = 4 }: { score: number; tier: Tier; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const reduce = useReducedMotion()
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-hairline)" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={TIER[tier].color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c} transform={`rotate(-90 ${size / 2} ${size / 2})`}
        initial={{ strokeDashoffset: reduce ? c * (1 - score / 100) : c }}
        animate={{ strokeDashoffset: c * (1 - score / 100) }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      />
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.3} fontFamily="ui-monospace, monospace" fill="var(--color-sumi)">
        {Math.round(score)}
      </text>
    </svg>
  )
}

function Sparkline({ values, threshold = 90 }: { values: number[]; threshold?: number }) {
  const w = 220, h = 48, min = 80, max = 100
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * (w - 8) + 4
  const y = (v: number) => h - 4 - ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * (h - 8)
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-12 w-full" role="img" aria-label={`OTD by month: ${values.join(', ')}%`}>
      <line x1={0} x2={w} y1={y(threshold)} y2={y(threshold)} stroke="var(--color-akaneiro)" strokeDasharray="3 3" strokeOpacity={0.5} />
      <path d={d} fill="none" stroke="var(--color-sumi)" strokeWidth={1.5} />
      {values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={2} fill={v < threshold ? 'var(--color-akaneiro)' : 'var(--color-sumi)'} />)}
    </svg>
  )
}

function CreditGauge({ band }: { band: keyof typeof CREDIT }) {
  const { L } = useL()
  const idx = CREDIT[band].idx
  const colors = ['var(--color-bamboo)', 'var(--color-gold)', 'var(--color-akaneiro)']
  return (
    <div>
      <div className="flex gap-0.5" aria-hidden>
        {colors.map((c, i) => <span key={i} className="h-1.5 flex-1" style={{ background: c, opacity: i === idx ? 1 : 0.18 }} />)}
      </div>
      <p className="mt-1 font-mono text-[11px] text-sumi/70">{L(CREDIT[band])}</p>
    </div>
  )
}

export function PartnerTrustView() {
  const { L, lang } = useL()
  const [sector, setSector] = useState<PartnerSector | ''>('')
  const [state, setState] = useState('')
  const [minOtd, setMinOtd] = useState(0)
  const [minScore, setMinScore] = useState(0)
  const deferredOtd = useDeferredValue(minOtd)
  const deferredScore = useDeferredValue(minScore)
  const [dir, setDir] = useState<Directory | null>(null)
  const [failure, setFailure] = useState<StatuteFailure | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [auditState, setAuditState] = useState<{ id: string; data?: TrustAudit; error?: StatuteFailure } | null>(null)
  const seenStates = useRef(new Set<string>())

  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true)
    const timer = setTimeout(() => {
      listPartners({ sector: sector || undefined, state: state || undefined, min_otd: deferredOtd || undefined, min_trust_score: deferredScore || undefined }, ctrl.signal)
        .then((d) => {
          d.partners.forEach((p) => seenStates.current.add(p.state))
          setDir(d)
          setFailure(null)
          setSelected((cur) => (cur && d.partners.some((p) => p.id === cur) ? cur : d.partners[0]?.id ?? null))
        })
        .catch((e: Error) => { if (e.name !== 'AbortError') setFailure(e instanceof StatuteError ? e.kind : 'offline') })
        .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    }, 150)
    return () => { clearTimeout(timer); ctrl.abort() }
  }, [sector, state, deferredOtd, deferredScore])

  useEffect(() => {
    if (!selected) return
    const ctrl = new AbortController()
    setAuditState({ id: selected })
    auditPartner(selected, ctrl.signal)
      .then((data) => setAuditState({ id: selected, data }))
      .catch((e: Error) => { if (e.name !== 'AbortError') setAuditState({ id: selected, error: e instanceof StatuteError ? e.kind : 'offline' }) })
    return () => ctrl.abort()
  }, [selected])

  const states = useMemo(() => [...seenStates.current].sort(), [dir])
  const chip = (active: boolean) =>
    cn('border px-2.5 py-1 text-xs transition-colors', active ? 'border-sumi bg-sumi text-white' : 'border-hairline bg-white text-sumi/70 hover:border-sumi')

  return (
    <section aria-labelledby="partners-title" className="space-y-4">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-sumi/50">
          {lang === 'ja' ? '画面05 · パートナー審査' : 'Screen 05 · Partner due diligence'}
        </p>
        <h1 id="partners-title" className="jp-heading mt-1 text-2xl text-sumi md:text-3xl">
          {lang === 'ja' ? 'パートナー信頼性・検証エンジン' : 'Partner Trust & Verification'}
        </h1>
      </div>

      <p className="flex items-start gap-2 border border-dashed border-gold/60 bg-gold/5 px-3 py-2 text-xs text-[#6b5628]">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {lang === 'ja'
          ? 'すべての記録はシミュレーション用の架空データです（CIN・GSTINは実在し得ない形式）。MCA・GSTN等の公的登録との連携は行っていません。スコアは助言的なスクリーニングであり、取引前に一次資料で確認してください。'
          : 'All records are simulated fixtures (CIN/GSTIN use formats no real entity can hold); no MCA or GSTN registry is integrated. Scores are advisory screening — confirm against primary sources before any commitment.'}
      </p>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 border border-hairline bg-white px-4 py-3">
        <div role="group" aria-label={lang === 'ja' ? '業種' : 'Sector'} className="flex flex-wrap gap-1.5">
          <button type="button" aria-pressed={!sector} onClick={() => setSector('')} className={chip(!sector)}>{lang === 'ja' ? 'すべて' : 'All'}</button>
          {SECTORS.map((s) => (
            <button key={s.id} type="button" aria-pressed={sector === s.id} onClick={() => setSector(s.id)} className={chip(sector === s.id)}>{L(s)}</button>
          ))}
        </div>
        <label className="text-xs text-sumi/70">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-sumi/50">{lang === 'ja' ? '州' : 'State'}</span>
          <select value={state} onChange={(e) => setState(e.target.value)} className="border border-hairline bg-white px-2 py-1 text-xs">
            <option value="">{lang === 'ja' ? 'すべての州' : 'All states'}</option>
            {states.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="min-w-[150px] flex-1 text-xs text-sumi/70">
          <span className="mb-1 flex justify-between font-mono text-[10px] uppercase tracking-wider text-sumi/50">
            {lang === 'ja' ? '最低納期遵守率' : 'Min OTD'} <span className="text-sumi">{minOtd ? `${minOtd}%` : '—'}</span>
          </span>
          <input type="range" min={0} max={98} step={1} value={minOtd} onChange={(e) => setMinOtd(Number(e.target.value))} className="w-full accent-[var(--color-sumi)]" />
        </label>
        <label className="min-w-[150px] flex-1 text-xs text-sumi/70">
          <span className="mb-1 flex justify-between font-mono text-[10px] uppercase tracking-wider text-sumi/50">
            {lang === 'ja' ? '最低信頼スコア' : 'Min trust score'} <span className="text-sumi">{minScore || '—'}</span>
          </span>
          <input type="range" min={0} max={95} step={5} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className="w-full accent-[var(--color-sumi)]" />
        </label>
      </div>

      {failure ? (
        <div className="flex items-start gap-3 border border-hairline bg-white p-5 text-sm">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-sumi/50" aria-hidden />
          <div>
            <p className="text-sumi">{failure === 'unavailable' ? (lang === 'ja' ? 'パートナー情報を取得できませんでした。' : 'Partner data could not be loaded.') : L(FAILURE_TEXT[failure])}</p>
            {failure === 'offline' && (
              <p className="mt-1 text-xs text-sumi/55">
                {lang === 'ja'
                  ? 'APIを起動し、マイグレーション004の適用とフィクスチャの投入（python -m app.seed.load_partner_registry）を行ってください。'
                  : 'Start the API with migration 004 applied and fixtures loaded (python -m app.seed.load_partner_registry).'}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
          {/* Directory */}
          <div className="min-w-0 border border-hairline bg-white">
            <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
              <h2 className="text-sm font-medium text-sumi">{lang === 'ja' ? '審査済みパートナー' : 'Screened partners'}</h2>
              <span className="flex items-center gap-2 font-mono text-[11px] text-sumi/50">
                {loading && <Loader2 className="size-3 animate-spin" aria-hidden />}
                {dir ? `${dir.total}` : ''}
              </span>
            </div>
            {dir && dir.partners.length === 0 && (
              <p className="px-4 py-8 text-center text-xs text-sumi/50">{lang === 'ja' ? '条件に合うパートナーはありません。' : 'No partners match these filters.'}</p>
            )}
            <ul className="divide-y divide-hairline">
              {dir?.partners.map((p) => <DirectoryRow key={p.id} p={p} active={p.id === selected} onSelect={() => setSelected(p.id)} />)}
            </ul>
          </div>

          {/* Scorecard */}
          <div className="min-w-0">
            {!auditState ? null : auditState.error ? (
              <p className="border border-hairline bg-white p-5 text-sm text-sumi/60">{L(FAILURE_TEXT[auditState.error === 'unavailable' ? 'offline' : auditState.error])}</p>
            ) : !auditState.data ? (
              <div className="flex min-h-[300px] items-center justify-center border border-hairline bg-white text-xs text-sumi/50">
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />{lang === 'ja' ? '審査中…' : 'Auditing…'}
              </div>
            ) : (
              <Scorecard a={auditState.data} />
            )}
          </div>
        </div>
      )}
      {dir && <p className="font-mono text-[10px] text-sumi/45">{dir.scoring_version} · {dir.disclosure}</p>}
    </section>
  )
}

function DirectoryRow({ p, active, onSelect }: { p: DirectoryItem; active: boolean; onSelect: () => void }) {
  const { L, lang } = useL()
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? 'true' : undefined}
        className={cn('flex w-full items-center gap-3 px-4 py-3 text-left transition-colors', active ? 'bg-washi' : 'hover:bg-washi/50')}
      >
        <ScoreRing score={num(p.score)} tier={p.tier} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-sumi">{p.partner_name}</span>
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-sumi/55">
            {p.city ? `${p.city}, ` : ''}{p.state} · {L(SECTORS.find((s) => s.id === p.sector)!)} · {L(TYPE[p.partner_type])}
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className={cn('border px-1 font-mono text-[10px]', TIER[p.tier].cls)}>{L(TIER[p.tier])}</span>
            <span className="font-mono text-[10px] text-sumi/60">OTD {num(p.otd_trailing_pct).toFixed(1)}%</span>
            {p.iso_verified.map((iso) => <span key={iso} className="border border-aijiro/30 px-1 font-mono text-[10px] text-aijiro">{iso.replace('ISO ', 'ISO')}</span>)}
            {p.litigation_flag && <span className="inline-flex items-center gap-0.5 font-mono text-[10px] text-akaneiro"><Gavel className="size-3" aria-hidden />{lang === 'ja' ? '訴訟' : 'litigation'}</span>}
            {p.block_flags > 0 && !p.litigation_flag && <span className="inline-flex items-center gap-0.5 font-mono text-[10px] text-akaneiro"><Ban className="size-3" aria-hidden />{p.block_flags}</span>}
            {p.warn_flags > 0 && <span className="inline-flex items-center gap-0.5 font-mono text-[10px] text-[#7a6230]"><AlertTriangle className="size-3" aria-hidden />{p.warn_flags}</span>}
          </span>
        </span>
      </button>
    </li>
  )
}

function Scorecard({ a }: { a: TrustAudit }) {
  const { L, lang } = useL()
  const r = a.record
  const capped = num(a.uncapped_score) > num(a.score)
  const otd = r.operations.otd_monthly_pct.map(num)
  const ringiHref = jigHref({ screen: 'ringi', input: { partner: r.partner_name, ...(STATE_TO_JIT[r.state] ? { stateId: STATE_TO_JIT[r.state] } : {}) } })
  const flagIcon = { block: Ban, warn: AlertTriangle, info: Info }
  const flagCls = { block: 'text-akaneiro', warn: 'text-[#7a6230]', info: 'text-sumi/55' }

  return (
    <motion.article key={a.partner_id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="border border-hairline bg-[#fdfcf9]">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-hairline p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {a.simulated && <span className="border border-dashed border-gold/70 bg-gold/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[#7a6230]">{lang === 'ja' ? '架空データ' : 'Simulated fixture'}</span>}
            <span className="font-mono text-[10px] text-sumi/45">{L(TYPE[r.partner_type])} · {lang === 'ja' ? 'データ時点' : 'data as of'} {r.data_as_of}</span>
          </div>
          <h2 className="jp-heading mt-1.5 text-xl text-sumi">{r.partner_name}</h2>
          <p className="mt-0.5 text-xs text-sumi/60">{r.registered_address}</p>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[11px]">
            <dt className="text-sumi/45">CIN</dt><dd className="text-sumi">{r.mca_registration_no}</dd>
            <dt className="text-sumi/45">GSTIN</dt><dd className="text-sumi">{r.gstin}</dd>
          </dl>
        </div>
        <div className="flex items-center gap-3">
          <ScoreRing score={num(a.score)} tier={a.tier} size={84} stroke={6} />
          <div>
            <p className={cn('inline-block border px-1.5 py-0.5 font-mono text-[11px]', TIER[a.tier].cls)}>{L(TIER[a.tier])}</p>
            <p className="mt-1 font-mono text-[10px] text-sumi/50">{lang === 'ja' ? '日本適合・信頼スコア' : 'Japan-Readiness & Trust'}</p>
            {capped && (
              <p className="mt-0.5 font-mono text-[10px] text-akaneiro">
                {lang === 'ja' ? `上限適用（制約前 ${a.uncapped_score}）` : `capped by gate (uncapped ${a.uncapped_score})`}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* Flags */}
      {a.flags.some((f) => f.level !== 'info') && (
        <ul className="space-y-1 border-b border-hairline px-5 py-3">
          {a.flags.filter((f) => f.level !== 'info').map((f) => {
            const Icon = flagIcon[f.level]
            return <li key={f.code + f.message} className={cn('flex items-start gap-2 text-xs', flagCls[f.level])}><Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden />{(lang === 'ja' && flagJa(f.code, r)) || f.message}</li>
          })}
        </ul>
      )}

      <div className="grid gap-5 p-5 xl:grid-cols-2">
        {/* Component breakdown */}
        <section>
          <h3 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-sumi/50">{lang === 'ja' ? 'スコア内訳' : 'Score breakdown'}</h3>
          <ul className="space-y-2.5">
            {a.components.map((c, i) => {
              const pct = (num(c.points) / num(c.max_points)) * 100
              return (
                <li key={c.key}>
                  <details className="group">
                    <summary className="cursor-pointer list-none">
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="text-sumi">{lang === 'ja' ? COMPONENT_JA[c.key] ?? c.label : c.label}</span>
                        <span className="font-mono text-sumi/70">{num(c.points).toFixed(1)} / {num(c.max_points)}</span>
                      </div>
                      <div className="mt-1 h-1 bg-hairline" aria-hidden>
                        <motion.div className="h-1" style={{ background: pct >= 80 ? 'var(--color-bamboo)' : pct >= 50 ? 'var(--color-gold)' : 'var(--color-akaneiro)' }}
                          initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, delay: i * 0.05 }} />
                      </div>
                    </summary>
                    <ul className="mt-1.5 space-y-0.5 border-l-2 border-hairline pl-2 text-[11px] text-sumi/65">
                      {c.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                    </ul>
                  </details>
                </li>
              )
            })}
          </ul>
        </section>

        {/* Quality, credit, operations */}
        <section className="space-y-4">
          <div>
            <h3 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-sumi/50">{lang === 'ja' ? 'ISO認証' : 'ISO certification'}</h3>
            <div className="flex flex-wrap gap-2">
              {(['ISO 9001', 'ISO 14001'] as const).map((std) => {
                const cert = r.iso_certifications.find((c) => c.standard === std)
                const ok = cert?.status === 'verified'
                return (
                  <span key={std} className={cn('inline-flex items-center gap-1.5 border px-2 py-1 text-[11px]', ok ? 'border-bamboo/40 bg-bamboo/10 text-bamboo' : cert ? 'border-gold/50 bg-gold/10 text-[#7a6230]' : 'border-dashed border-sumi/25 text-sumi/45')}>
                    {ok ? <BadgeCheck className="size-3.5" aria-hidden /> : <Info className="size-3.5" aria-hidden />}
                    {std}
                    <span className="font-mono text-[10px]">
                      {cert ? (cert.status === 'verified' ? (lang === 'ja' ? '確認済' : 'verified') : cert.status === 'expired' ? (lang === 'ja' ? '失効' : 'expired') : (lang === 'ja' ? '未確認' : 'unverified')) : (lang === 'ja' ? 'なし' : 'none')}
                    </span>
                  </span>
                )
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-sumi/50">{lang === 'ja' ? '信用リスク' : 'Credit risk'}</h3>
              <CreditGauge band={r.credit_rating.band} />
              <p className="mt-0.5 text-[10px] text-sumi/45">{r.credit_rating.agency}</p>
            </div>
            <div>
              <h3 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-sumi/50">{lang === 'ja' ? '財務健全性' : 'Solvency'}</h3>
              <p className="font-mono text-lg text-sumi">{r.financial_solvency_score ? num(r.financial_solvency_score).toFixed(0) : '—'}<span className="text-xs text-sumi/45"> /100</span></p>
            </div>
          </div>
          <div>
            <h3 className="mb-1 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-wider text-sumi/50">
              {lang === 'ja' ? '納期遵守率（直近12か月）' : 'On-time delivery, trailing 12 months'}
              <span className="text-sm normal-case tracking-normal text-sumi">{num(a.otd_trailing_pct).toFixed(1)}%</span>
            </h3>
            <Sparkline values={otd} />
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
              {([
                [lang === 'ja' ? '受注精度' : 'Fulfilment accuracy', r.operations.fulfillment_accuracy_pct],
                [lang === 'ja' ? '顧客維持率' : 'Client retention', r.operations.client_retention_pct],
                [lang === 'ja' ? '海外委託元満足度' : 'Foreign principal satisfaction', r.operations.foreign_principal_satisfaction_pct],
                [lang === 'ja' ? '応答SLA遵守' : 'Communication SLA', r.operations.sla_compliance_pct],
              ] as const).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2"><dt className="text-sumi/55">{k}</dt><dd className="font-mono text-sumi">{num(v).toFixed(1)}%</dd></div>
              ))}
              <div className="col-span-2 flex justify-between gap-2">
                <dt className="text-sumi/55">{lang === 'ja' ? '越境契約の履行' : 'Cross-border contracts fulfilled'}</dt>
                <dd className="font-mono text-sumi">{r.cross_border.contracts_fulfilled}/{r.cross_border.contracts_total} · {lang === 'ja' ? '日本企業' : 'Japanese'} {r.cross_border.japanese_principals}</dd>
              </div>
            </dl>
          </div>
        </section>
      </div>

      {/* Directors & litigation */}
      <div className="grid gap-5 border-t border-hairline p-5 xl:grid-cols-2">
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-sumi/50"><Users className="size-3" aria-hidden />{lang === 'ja' ? '取締役の履歴' : 'Director history'}</h3>
          <ul className="space-y-1 text-[11px]">
            {r.director_history.map((d) => (
              <li key={d.din} className={cn('flex justify-between gap-2', d.ceased_on && 'text-sumi/45')}>
                <span>{d.name} · {d.role}</span>
                <span className="font-mono">{d.appointed_on.slice(0, 4)}–{d.ceased_on ? d.ceased_on.slice(0, 4) : (lang === 'ja' ? '現在' : 'now')}</span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-sumi/50"><Gavel className="size-3" aria-hidden />{lang === 'ja' ? '訴訟' : 'Litigation'}</h3>
          {r.litigation.length === 0 ? (
            <p className="text-[11px] text-bamboo">{lang === 'ja' ? '記録された訴訟はありません。' : 'No recorded litigation.'}</p>
          ) : (
            <ul className="space-y-1.5 text-[11px]">
              {r.litigation.map((c) => (
                <li key={c.reference} className={cn(c.status === 'pending' && c.severity === 'major' ? 'text-akaneiro' : 'text-sumi/75')}>
                  <span className="font-mono">[{c.status} · {c.severity} · {c.case_type}]</span> {c.summary}
                  <span className="block font-mono text-[10px] text-sumi/45">{c.forum} · {c.reference}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Evidence & actions */}
      <footer className="flex flex-wrap items-end justify-between gap-4 border-t border-hairline bg-washi/50 px-5 py-4">
        <ul className="space-y-1.5">
          {a.evidence.map((e) => (
            <li key={e.label} className="text-[11px]">
              <a href={e.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-aijiro hover:underline">
                {e.label}<ExternalLink className="size-3" aria-hidden />
              </a>
              <span className="block font-mono text-[10px] text-sumi/45">{e.note}</span>
            </li>
          ))}
        </ul>
        <div className="text-right">
          <a href={ringiHref} className="glass-button px-4 py-2 text-xs">
            <FileSignature className="size-3.5" aria-hidden />
            {lang === 'ja' ? '稟議書のパートナーに設定' : 'Use in Ringi-sho'}
          </a>
          <p className="mt-1.5 font-mono text-[9px] text-sumi/40" title={a.inputs_hash}>{a.scoring_version} · inputs {a.inputs_hash.slice(0, 12)}</p>
        </div>
      </footer>
    </motion.article>
  )
}
