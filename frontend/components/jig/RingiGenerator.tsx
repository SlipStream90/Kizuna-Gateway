'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Check, Copy, FileSignature, Loader2, RotateCcw, Sparkles } from 'lucide-react'
import { analyse, SECTOR_LABEL, STATES } from '../../lib/jig/engine'
import { SOURCE_BY_ID } from '../../lib/jig/retrieve'
import { useL } from '../../lib/jig/useL'
import type { Lang, RingiAnalysis, RingiInput, RingiSections, Sector, StateId } from '../../lib/jig/types'
import { ringiMeta, ringiSections, SECTION_TITLES } from '../../lib/ringiTemplates'
import { cn } from '../../lib/utils'
import { askStatutes, FAILURE_TEXT, ringiQuestion, StatuteError, type StatuteAnswer, type StatuteFailure } from '../../lib/jig/statutes'
import { CitationBadge } from './CitationBadge'
import { FrictionIndex } from './FrictionIndex'
import { DEPTS, NemawashiGraph, status } from './NemawashiGraph'

/** Live statutory analysis from the backend RAG engine (POST /api/v1/compliance/answer). */
type Live = { state: 'loading' } | { state: 'ok'; data: StatuteAnswer } | { state: 'failed'; kind: StatuteFailure }

const LIVE_TITLE = { en: '4. Regulatory Analysis (from ingested statutes)', ja: '四、法令に基づく検討（取込済み法令）' }
const CITATIONS_TITLE_WITH_LIVE = { en: '5. Regulatory Citation Index', ja: '五、規制根拠一覧' }

function LiveStatus({ live, lang }: { live: Live; lang: Lang }) {
  let text: string
  let tone = 'text-sumi/55'
  if (live.state === 'loading') {
    text = lang === 'ja' ? '取込済み法令を照会中…' : 'Checking ingested statutes…'
  } else if (live.state === 'failed') {
    text = FAILURE_TEXT[live.kind][lang]
  } else if (live.data.status === 'answered') {
    const n = new Set(live.data.answer.flatMap((p) => p.citations)).size
    text = lang === 'ja' ? `取込済み法令から ${n} 条項を引用して検討を追加しました。` : `Added a regulatory analysis citing ${n} clause(s) from ingested statutes.`
    tone = 'text-bamboo'
  } else {
    text = live.data.notice ?? (lang === 'ja' ? '取込済み法令から根拠を得られませんでした。' : 'No grounded analysis from ingested statutes.')
    tone = 'text-[#7a6230]'
  }
  return (
    <p className={cn('flex items-center gap-1.5 border-b border-hairline px-4 py-1.5 font-mono text-[10px]', tone)}>
      <span className={cn('size-1.5 rounded-full', live.state === 'loading' ? 'animate-pulse bg-sumi/40' : tone === 'text-bamboo' ? 'bg-bamboo' : 'bg-gold')} aria-hidden />
      {text}
    </p>
  )
}

const DEFAULT_INPUT: RingiInput = {
  stateId: 'mandal',
  amountUsd: 25_000_000,
  sector: 'auto',
  partner: 'Arya Precision Works (fictional)',
}

type Refined = { lang: Lang; sections: Pick<RingiSections, 'overview' | 'capital' | 'exitGates'> }

export function RingiGenerator({ preset }: { preset?: { input: Partial<RingiInput>; autogen: boolean } | null }) {
  const { L, lang } = useL()
  const reduce = useReducedMotion()
  const [input, setInput] = useState<RingiInput>(DEFAULT_INPUT)
  const [analysis, setAnalysis] = useState<RingiAnalysis | null>(null)
  const [runKey, setRunKey] = useState(0)
  const [docLang, setDocLang] = useState<Lang>(lang)
  const [refined, setRefined] = useState<Refined | null>(null)
  const [llm, setLlm] = useState<{ configured: boolean; busy: boolean; error: string | null }>({ configured: false, busy: false, error: null })
  const [copied, setCopied] = useState(false)

  // Inputs handed over from Nishi Link (via /jig-os?state=…&autogen=1).
  useEffect(() => {
    if (!preset) return
    const next = { ...DEFAULT_INPUT, ...preset.input }
    setInput(next)
    if (preset.autogen) {
      setAnalysis(analyse(next))
      setRefined(null)
      setRunKey((k) => k + 1)
    }
  }, [preset])

  // The interface toggle also flips the document; the document toggle can then diverge.
  useEffect(() => setDocLang(lang), [lang])

  // Ask the ingested statutes the proposal's regulatory question, in the document's language.
  const [live, setLive] = useState<Live | null>(null)
  useEffect(() => {
    if (!analysis) return
    const ctrl = new AbortController()
    const st = STATES.find((x) => x.id === analysis.input.stateId)!
    setLive({ state: 'loading' })
    askStatutes(
      { query: ringiQuestion(docLang, SECTOR_LABEL[analysis.input.sector][docLang], `${st.jit[docLang]}, ${st.state[docLang]}`), lang: docLang, k: 8 },
      ctrl.signal,
    )
      .then((data) => setLive({ state: 'ok', data }))
      .catch((e: Error) => {
        if (e.name !== 'AbortError') setLive({ state: 'failed', kind: e instanceof StatuteError ? e.kind : 'offline' })
      })
    return () => ctrl.abort()
  }, [analysis, docLang])
  const liveAnswer = live?.state === 'ok' && live.data.status === 'answered' && live.data.lang === docLang ? live.data : null
  const liveCited = liveAnswer ? liveAnswer.sources.filter((x) => liveAnswer.answer.some((p) => p.citations.includes(x.citation_id))) : []

  useEffect(() => {
    fetch('/api/ringi/refine')
      .then((r) => r.json())
      .then((b: { configured: boolean }) => setLlm((s) => ({ ...s, configured: b.configured })))
      .catch(() => undefined)
  }, [])

  const generate = (e?: React.FormEvent) => {
    e?.preventDefault()
    setAnalysis(analyse(input))
    setRefined(null)
    setLlm((s) => ({ ...s, error: null }))
    setRunKey((k) => k + 1)
  }

  const meta = useMemo(() => (analysis ? ringiMeta(analysis, docLang) : null), [analysis, docLang])
  const templ = useMemo(() => (analysis ? ringiSections(analysis, docLang) : null), [analysis, docLang])
  const sections = templ && refined?.lang === docLang ? { ...templ, ...refined.sections } : templ

  async function refine() {
    if (!analysis || !templ) return
    setLlm((s) => ({ ...s, busy: true, error: null }))
    try {
      const res = await fetch('/api/ringi/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang: docLang, sections: { overview: templ.overview, capital: templ.capital, exitGates: templ.exitGates } }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
      setRefined({ lang: docLang, sections: body.sections })
    } catch (err) {
      setLlm((s) => ({ ...s, error: err instanceof Error ? err.message : String(err) }))
    } finally {
      setLlm((s) => ({ ...s, busy: false }))
    }
  }

  async function copyDoc() {
    if (!meta || !sections) return
    const curatedCount = analysis?.citationIds.length ?? 0
    const liveBlock = liveAnswer
      ? [LIVE_TITLE[docLang], ...liveAnswer.answer.map((p) => `${p.text} ${p.badges.map((b) => b.label[docLang]).join(' ')}`), '']
      : []
    const liveIndex = liveCited.map((x, j) => `[${curatedCount + j + 1}] ${x.authority} — ${x.document_title}, ${x.badge.clause[docLang]}`)
    const text = [meta.subject, `${meta.docNo} · ${meta.date}`, meta.opening, '',
      ...(['overview', 'capital', 'exitGates'] as const).flatMap((k) => [SECTION_TITLES[k][docLang], sections[k], '']),
      ...liveBlock,
      (liveAnswer ? CITATIONS_TITLE_WITH_LIVE : SECTION_TITLES.citations)[docLang], sections.citations, ...liveIndex, '',
      meta.closing].join('\n')
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* clipboard blocked */ }
  }

  const field = 'w-full border border-hairline bg-white px-2.5 py-2 text-sm text-sumi focus:border-sumi focus:outline-none'
  const label = 'mb-1 block font-mono text-[10px] uppercase tracking-wider text-sumi/55'

  return (
    <section aria-labelledby="ringi-title" className="space-y-4">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-sumi/50">
          {lang === 'ja' ? '画面02 · 本社決裁' : 'Screen 02 · Honsha approval'}
        </p>
        <h1 id="ringi-title" className="jp-heading mt-1 text-2xl text-sumi md:text-3xl">
          {lang === 'ja' ? '本社稟議書ジェネレーター・根回しグラフ' : 'Honsha Ringi-sho Generator & Nemawashi Graph'}
        </h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Left rail: inputs + friction */}
        <div className="space-y-4">
          <form onSubmit={generate} className="space-y-3 border border-hairline bg-white p-4">
            <div>
              <label htmlFor="rg-state" className={label}>{lang === 'ja' ? '対象州・JIT' : 'Target state / JIT'}</label>
              <select id="rg-state" className={field} value={input.stateId} onChange={(e) => setInput({ ...input, stateId: e.target.value as StateId })}>
                {STATES.map((s) => <option key={s.id} value={s.id}>{L(s.jit)} — {L(s.state)}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="rg-amount" className={label}>{lang === 'ja' ? '投資額（米ドル）' : 'Investment amount (US$)'}</label>
              <input
                id="rg-amount" type="number" min={100000} step={100000} required className={cn(field, 'font-mono')}
                value={input.amountUsd} onChange={(e) => setInput({ ...input, amountUsd: Number(e.target.value) })}
              />
              <p className="mt-1 font-mono text-[10px] text-sumi/45">US${input.amountUsd.toLocaleString('en-US')}</p>
            </div>
            <div>
              <label htmlFor="rg-sector" className={label}>{lang === 'ja' ? '業種' : 'Industry sector'}</label>
              <select id="rg-sector" className={field} value={input.sector} onChange={(e) => setInput({ ...input, sector: e.target.value as Sector })}>
                {(Object.keys(SECTOR_LABEL) as Sector[]).map((s) => <option key={s} value={s}>{L(SECTOR_LABEL[s])}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="rg-partner" className={label}>{lang === 'ja' ? '現地パートナー名' : 'Local partner name'}</label>
              <input id="rg-partner" className={field} value={input.partner} placeholder={lang === 'ja' ? '未定の場合は空欄' : 'Leave blank if not yet chosen'} onChange={(e) => setInput({ ...input, partner: e.target.value })} />
            </div>
            <button type="submit" className="glass-button w-full py-2.5 text-sm">
              <FileSignature className="size-4" aria-hidden />
              {lang === 'ja' ? '本社決裁用 稟議書を生成' : 'Generate Honsha-Ready Ringi-sho'}
            </button>
          </form>

          {analysis && <FrictionIndex friction={analysis.friction} runKey={runKey} />}
        </div>

        {/* Document + nemawashi */}
        <div className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="min-w-0 border border-hairline bg-[#fdfcf9]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-2.5">
              <div role="group" aria-label={lang === 'ja' ? '文書の言語' : 'Document language'} className="flex border border-hairline text-xs">
                {(['en', 'ja'] as Lang[]).map((l) => (
                  <button key={l} type="button" aria-pressed={docLang === l} onClick={() => setDocLang(l)}
                    className={cn('px-3 py-1.5', docLang === l ? 'bg-sumi text-white' : 'text-sumi/65 hover:text-sumi')}>
                    {l === 'en' ? 'EN' : '日本語（敬語）'}
                  </button>
                ))}
              </div>
              {analysis && (
                <div className="flex flex-wrap items-center gap-2">
                  {refined?.lang === docLang ? (
                    <button type="button" onClick={() => setRefined(null)} className="inline-flex items-center gap-1.5 border border-hairline px-2.5 py-1.5 text-xs text-sumi/70 hover:border-sumi">
                      <RotateCcw className="size-3.5" aria-hidden />
                      {lang === 'ja' ? 'テンプレートに戻す' : 'Revert to template'}
                    </button>
                  ) : (
                    <button
                      type="button" onClick={refine} disabled={!llm.configured || llm.busy}
                      title={llm.configured ? undefined : lang === 'ja' ? 'ANTHROPIC_API_KEY を設定すると有効になります' : 'Set ANTHROPIC_API_KEY to enable'}
                      className="inline-flex items-center gap-1.5 border border-hairline px-2.5 py-1.5 text-xs text-sumi/80 hover:border-sumi disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {llm.busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Sparkles className="size-3.5" aria-hidden />}
                      {lang === 'ja' ? 'Claudeで文章を推敲' : 'Refine wording with Claude'}
                    </button>
                  )}
                  <button type="button" onClick={copyDoc} className="inline-flex items-center gap-1.5 border border-hairline px-2.5 py-1.5 text-xs text-sumi/80 hover:border-sumi">
                    {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
                    {lang === 'ja' ? 'コピー' : 'Copy'}
                  </button>
                </div>
              )}
            </div>
            {analysis && live && <LiveStatus live={live} lang={docLang} />}
            {llm.error && <p role="alert" className="border-b border-hairline bg-akaneiro/5 px-4 py-2 text-xs text-akaneiro">{llm.error}</p>}

            {!analysis || !meta || !sections ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 px-6 text-center">
                <span className="hanko h-12 w-12 text-2xl opacity-80" aria-hidden>稟</span>
                <p className="max-w-sm text-sm text-sumi/60">
                  {lang === 'ja'
                    ? '条件を入力し「本社決裁用 稟議書を生成」を押すと、稟議書・根回しグラフ・摩擦指数が即座に作成されます。'
                    : 'Set the inputs and press “Generate Honsha-Ready Ringi-sho” to draft the proposal, nemawashi graph and friction index instantly.'}
                </p>
              </div>
            ) : (
              <article lang={docLang} className="grid gap-6 p-5 md:grid-cols-[minmax(0,1fr)_92px] md:p-7">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-sumi pb-2">
                    <p className="jp-heading text-2xl tracking-[0.3em] text-sumi">{docLang === 'ja' ? '稟議書' : 'RINGI-SHO'}</p>
                    <p className="font-mono text-[10px] text-sumi/55">{meta.docNo} · {meta.date}</p>
                  </div>
                  <p className="jp-heading mt-4 text-lg leading-snug text-sumi">
                    {docLang === 'ja' ? '件名：' : 'Subject: '}{meta.subject}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-sumi/55">{meta.originator} · {meta.route}</p>
                  {refined?.lang === docLang && (
                    <p className="mt-2 inline-flex items-center gap-1 border border-aijiro/30 bg-aijiro/5 px-1.5 py-0.5 font-mono text-[10px] text-aijiro">
                      <Sparkles className="size-3" aria-hidden />
                      {lang === 'ja' ? 'Claudeにより推敲（数値・根拠は変更なし）' : 'Wording refined by Claude (figures & citations unchanged)'}
                    </p>
                  )}
                  <p className="mt-4 text-sm leading-relaxed text-sumi/85">{meta.opening}</p>
                  {docLang === 'ja' && <p className="mt-3 text-center font-serif text-sm text-sumi">記</p>}

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${runKey}-${docLang}-${refined?.lang ?? ''}`}
                      initial={{ opacity: 0, y: reduce ? 0 : 8, filter: 'blur(4px)' }}
                      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.35 }}
                      className="mt-4 space-y-5"
                    >
                      {(['overview', 'capital', 'exitGates'] as const).map((k) => (
                        <section key={k}>
                          <h3 className="jp-heading border-b border-hairline pb-1 text-[15px] text-sumi">{SECTION_TITLES[k][docLang]}</h3>
                          <p className="mt-2 whitespace-pre-wrap text-[13px] leading-[1.9] text-sumi/90">{sections[k]}</p>
                        </section>
                      ))}
                      {liveAnswer && (
                        <section>
                          <h3 className="jp-heading flex items-center gap-2 border-b border-hairline pb-1 text-[15px] text-sumi">
                            {LIVE_TITLE[docLang]}
                            <span className="size-1.5 rounded-full bg-bamboo" aria-hidden />
                          </h3>
                          <div className="mt-2 space-y-3">
                            {liveAnswer.answer.map((p, i) => (
                              <div key={i}>
                                <p className="whitespace-pre-wrap text-[13px] leading-[1.9] text-sumi/90">{p.text}</p>
                                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                                  {p.badges.map((b) => (
                                    <span key={b.id} className="inline-flex items-center gap-1">
                                      <CitationBadge live={b} />
                                      <span className="font-mono text-[10px] text-sumi/55">{b.clause[docLang]}</span>
                                    </span>
                                  ))}
                                </div>
                                {!p.figures_verified && (
                                  <p className="mt-1 text-[11px] text-[#7a6230]">
                                    {docLang === 'ja' ? '※ この段落の数値は引用条項の本文で確認できません。原文で確認してください。' : '* A figure here does not appear in the cited text; check the original.'}
                                  </p>
                                )}
                              </div>
                            ))}
                            <p className="font-mono text-[10px] text-sumi/45">
                              {liveAnswer.generation_model} · {docLang === 'ja' ? '取込済み法令のみを根拠に生成 · 要人的確認' : 'generated only from ingested statutes · human review required'}
                            </p>
                          </div>
                        </section>
                      )}
                      <section>
                        <h3 className="jp-heading border-b border-hairline pb-1 text-[15px] text-sumi">{(liveAnswer ? CITATIONS_TITLE_WITH_LIVE : SECTION_TITLES.citations)[docLang]}</h3>
                        <ol className="mt-2 space-y-1.5">
                          {analysis.citationIds.map((id, i) => {
                            const s = SOURCE_BY_ID.get(id)
                            if (!s) return null
                            return (
                              <li key={id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12px] leading-snug text-sumi/85">
                                <CitationBadge id={id} index={i + 1} />
                                <span>{s.title[docLang]}</span>
                                <span className="text-sumi/50">— {s.clause[docLang]}</span>
                              </li>
                            )
                          })}
                          {liveCited.map((x, j) => (
                            <li key={x.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12px] leading-snug text-sumi/85">
                              <CitationBadge live={x.badge} index={analysis.citationIds.length + j + 1} />
                              <span>{x.document_title}</span>
                              <span className="text-sumi/50">— {x.badge.clause[docLang]}</span>
                            </li>
                          ))}
                        </ol>
                      </section>
                    </motion.div>
                  </AnimatePresence>
                  <p className="mt-6 text-right font-serif text-sm text-sumi">{meta.closing}</p>
                </div>

                {/* 合議 seal column */}
                <aside aria-label={docLang === 'ja' ? '合議欄' : 'Consultation seals'} className="flex flex-row flex-wrap gap-2 md:flex-col md:items-center">
                  <p className="w-full text-center font-serif text-xs tracking-[0.4em] text-sumi/60 md:[writing-mode:vertical-rl]">
                    {docLang === 'ja' ? '合議' : 'SEALS'}
                  </p>
                  {analysis.readiness.map((d, i) => {
                    const st = status(d.score)
                    const stamped = st.key !== 'blocked'
                    return (
                      <div key={d.dept} className="flex flex-col items-center gap-1">
                        <div className="relative flex h-16 w-16 items-center justify-center border border-hairline bg-white">
                          <motion.span
                            key={`${runKey}-${d.dept}`}
                            initial={reduce ? false : { scale: 1.8, opacity: 0, rotate: -18 }}
                            animate={{ scale: 1, opacity: stamped ? 1 : 0.55, rotate: st.key === 'ready' ? -6 : 4 }}
                            transition={{ type: 'spring', stiffness: 420, damping: 18, delay: 0.5 + i * 0.22 }}
                            className={cn(
                              'flex h-12 w-12 flex-col items-center justify-center rounded-full font-serif leading-none',
                              st.key === 'ready' && 'border-2 border-akaneiro text-akaneiro',
                              st.key === 'conditional' && 'border-2 border-dashed border-akaneiro/70 text-akaneiro/80',
                              st.key === 'blocked' && 'border border-dashed border-sumi/40 text-sumi/50',
                            )}
                          >
                            <span className="text-base">{DEPTS[d.dept].seal}</span>
                            <span className="mt-0.5 text-[8px]">{st.ja}</span>
                          </motion.span>
                        </div>
                        <span className="text-center text-[9px] leading-tight text-sumi/60">{DEPTS[d.dept].name[docLang]}</span>
                      </div>
                    )
                  })}
                </aside>
              </article>
            )}
          </div>

          {analysis ? (
            <NemawashiGraph readiness={analysis.readiness} objections={analysis.objections} runKey={runKey} />
          ) : (
            <div className="hidden min-h-[200px] items-center justify-center border border-dashed border-hairline text-xs text-sumi/45 2xl:flex">
              {lang === 'ja' ? '生成後に根回しグラフを表示します' : 'Nemawashi graph appears after generation'}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
