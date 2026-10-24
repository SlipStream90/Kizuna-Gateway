'use client'

import { useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { AlertTriangle, BookOpenCheck, CircleSlash, Loader2, Search, ShieldCheck, WifiOff } from 'lucide-react'
import { askStatutes, FAILURE_TEXT, StatuteError, type StatuteAnswer, type StatuteFailure } from '../../lib/jig/statutes'
import { useL } from '../../lib/jig/useL'
import { cn } from '../../lib/utils'
import { CitationBadge } from './CitationBadge'

const SUGGESTIONS = [
  { en: 'What is the deadline to report a share issue to a foreign investor on Form FC-GPR?', ja: '外国投資家への株式発行は、様式FC-GPRでいつまでに報告する必要がありますか？' },
  { en: 'Does the company need a director resident in India?', ja: 'インドに居住する取締役は必要ですか？' },
  { en: 'Is FDI in auto-component manufacturing on the automatic route?', ja: '自動車部品製造への外国直接投資は自動承認ルートですか？' },
  { en: 'What incentives does the PLI scheme offer for auto components?', ja: '自動車部品向けPLIスキームにはどのような奨励措置がありますか？' },
]

const STATUS = {
  answered: { icon: ShieldCheck, cls: 'border-bamboo/40 bg-bamboo/10 text-bamboo', en: 'Grounded answer', ja: '根拠付き回答' },
  insufficient_evidence: { icon: CircleSlash, cls: 'border-gold/50 bg-gold/10 text-[#7a6230]', en: 'Insufficient evidence', ja: '根拠不十分' },
  generation_unavailable: { icon: AlertTriangle, cls: 'border-gold/50 bg-gold/10 text-[#7a6230]', en: 'Retrieval only', ja: '検索結果のみ' },
  refused: { icon: CircleSlash, cls: 'border-akaneiro/40 bg-akaneiro/10 text-akaneiro', en: 'Declined', ja: '回答保留' },
} as const

export function StatuteAsk() {
  const { L, lang } = useL()
  const reduce = useReducedMotion()
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<StatuteAnswer | null>(null)
  const [failure, setFailure] = useState<{ kind: StatuteFailure; detail: string } | null>(null)
  const controller = useRef<AbortController | null>(null)

  async function ask(q: string) {
    const text = q.trim()
    if (!text) return
    controller.current?.abort()
    const ctrl = new AbortController()
    controller.current = ctrl
    setQuery(text)
    setBusy(true)
    setFailure(null)
    try {
      setResult(await askStatutes({ query: text, lang, k: 6 }, ctrl.signal))
    } catch (error) {
      if ((error as Error).name === 'AbortError') return
      setResult(null)
      setFailure(error instanceof StatuteError ? { kind: error.kind, detail: error.message } : { kind: 'offline', detail: String(error) })
    } finally {
      if (controller.current === ctrl) setBusy(false)
    }
  }

  const status = result ? STATUS[result.status] : null

  return (
    <section aria-labelledby="ask-title" className="space-y-4">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-sumi/50">
          {lang === 'ja' ? '画面04 · 法令RAG' : 'Screen 04 · Statutory RAG'}
        </p>
        <h1 id="ask-title" className="jp-heading mt-1 text-2xl text-sumi md:text-3xl">
          {lang === 'ja' ? '法令照会' : 'Ask the Statutes'}
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-sumi/65">
          {lang === 'ja'
            ? '取り込んだ公式法令から関連条項を検索し、その条項だけを根拠に回答します。各段落には条項番号付きの出典が付きます。'
            : 'Retrieves the closest clauses from the ingested official statutes and answers only from them. Every paragraph cites its clauses.'}
        </p>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); ask(query) }}
        className="border border-hairline bg-white p-4"
      >
        <label htmlFor="ask-q" className="sr-only">{lang === 'ja' ? '質問' : 'Question'}</label>
        <div className="flex gap-2">
          <textarea
            id="ask-q"
            rows={2}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(query) } }}
            placeholder={lang === 'ja' ? '例：FC-GPRの提出期限は？（日本語・英語どちらでも可）' : 'e.g. What is the FC-GPR filing deadline? (English or Japanese)'}
            className="min-h-[52px] flex-1 resize-y border border-hairline px-3 py-2 text-sm focus:border-sumi focus:outline-none"
          />
          <button type="submit" disabled={busy || !query.trim()} className="glass-button self-stretch px-5 text-sm disabled:opacity-50">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Search className="size-4" aria-hidden />}
            {lang === 'ja' ? '照会' : 'Ask'}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.en}
              type="button"
              onClick={() => ask(L(s))}
              className="border border-hairline px-2.5 py-1 text-left text-xs text-sumi/70 transition-colors hover:border-sumi hover:text-sumi"
            >
              {L(s)}
            </button>
          ))}
        </div>
      </form>

      <div aria-live="polite" className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {/* Answer */}
        <div className="min-w-0 border border-hairline bg-[#fdfcf9]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-2.5">
            <h2 className="text-sm font-medium text-sumi">{lang === 'ja' ? '回答' : 'Answer'}</h2>
            {status && (
              <span className={cn('inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[10px]', status.cls)}>
                <status.icon className="size-3" aria-hidden />
                {L(status)}
              </span>
            )}
          </div>

          <div className="p-5">
            {busy && (
              <div className="space-y-3" aria-label={lang === 'ja' ? '検索中' : 'Searching'}>
                <p className="flex items-center gap-2 text-xs text-sumi/55">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  {lang === 'ja' ? '関連条項を検索し、根拠付きの回答を作成しています…' : 'Retrieving clauses and drafting a grounded answer…'}
                </p>
                {[92, 80, 66].map((w) => <div key={w} className="h-3 animate-pulse bg-hairline" style={{ width: `${w}%` }} />)}
              </div>
            )}

            {!busy && failure && (
              <div className="flex items-start gap-3 text-sm">
                <WifiOff className="mt-0.5 size-4 shrink-0 text-sumi/50" aria-hidden />
                <div className="space-y-2">
                  <p className="text-sumi">{L(FAILURE_TEXT[failure.kind])}</p>
                  {failure.kind === 'offline' && (
                    <p className="text-xs text-sumi/55">
                      {lang === 'ja'
                        ? 'バックエンドを起動し（uvicorn）、マイグレーション003の適用と法令の取込（python -m app.rag.ingest）を行ってください。'
                        : 'Start the API (uvicorn) with migration 003 applied and statutes ingested (python -m app.rag.ingest).'}
                    </p>
                  )}
                  <p className="font-mono text-[10px] text-sumi/40">{failure.detail}</p>
                </div>
              </div>
            )}

            {!busy && !failure && !result && (
              <div className="flex items-start gap-3 text-sm text-sumi/60">
                <BookOpenCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
                <p>{lang === 'ja' ? '質問を入力するか、上の例を選んでください。' : 'Ask a question, or pick one of the examples above.'}</p>
              </div>
            )}

            {!busy && result && (
              <AnimatePresence mode="wait">
                <motion.div
                  key={result.query + result.status}
                  initial={{ opacity: 0, y: reduce ? 0 : 8, filter: 'blur(3px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  {result.answer.map((p, i) => (
                    <div key={i}>
                      <p lang={result.lang} className="text-[14px] leading-[1.85] text-sumi">{p.text}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                        {p.badges.map((b) => (
                          <span key={b.id} className="inline-flex items-center gap-1">
                            <CitationBadge live={b} />
                            <span className="font-mono text-[10px] text-sumi/55">{L(b.clause)}</span>
                          </span>
                        ))}
                      </div>
                      {!p.figures_verified && (
                        <p className="mt-1 flex items-center gap-1 text-[11px] text-[#7a6230]">
                          <AlertTriangle className="size-3" aria-hidden />
                          {lang === 'ja' ? 'この段落の数値は引用条項の本文に見当たりません。必ず原文で確認してください。' : 'A figure in this paragraph does not appear in the cited text. Check the original.'}
                        </p>
                      )}
                    </div>
                  ))}
                  {result.notice && <p className="text-sm text-sumi/70">{result.notice}</p>}
                  {result.removed_paragraphs > 0 && (
                    <p className="text-[11px] text-sumi/50">
                      {lang === 'ja'
                        ? `取得条項を引用していない段落 ${result.removed_paragraphs} 件を除外しました。`
                        : `${result.removed_paragraphs} paragraph(s) citing no retrieved clause were removed.`}
                    </p>
                  )}
                  <p className="border-t border-hairline pt-3 font-mono text-[10px] text-sumi/45">
                    {result.generation_model ? `${result.generation_model} · ` : ''}
                    {lang === 'ja' ? `取得条項 ${result.sources.length} 件` : `${result.sources.length} retrieved clauses`}
                    {` · ${result.embedding_model}${result.semantic ? '' : lang === 'ja' ? '（語彙一致・非意味検索）' : ' (lexical, not semantic)'}`}
                    {lang === 'ja' ? ' · 要人的確認' : ' · human review required'}
                  </p>
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* Retrieved clauses */}
        <div className="min-w-0 border border-hairline bg-white">
          <h2 className="border-b border-hairline px-4 py-2.5 text-sm font-medium text-sumi">
            {lang === 'ja' ? '取得した条項' : 'Retrieved clauses'}
            {result && <span className="ml-2 font-mono text-xs text-sumi/45">({result.sources.length})</span>}
          </h2>
          {!result || result.sources.length === 0 ? (
            <p className="px-4 py-6 text-xs text-sumi/50">
              {result
                ? lang === 'ja' ? '該当する条項は取り込まれていません。' : 'No matching clauses are ingested.'
                : lang === 'ja' ? '回答の根拠として使われた条項がここに表示されます。' : 'The clauses an answer is restricted to appear here.'}
            </p>
          ) : (
            <ol className="divide-y divide-hairline">
              {result.sources.map((s, i) => {
                const cited = result.answer.some((p) => p.citations.includes(s.citation_id))
                return (
                  <li key={s.id} className={cn('px-4 py-3', !cited && result.status === 'answered' && 'opacity-60')}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="font-mono text-[10px] text-sumi/40">S{i + 1}</span>
                        <CitationBadge live={s.badge} />
                        <span className="truncate text-xs text-sumi">{L(s.badge.clause)}</span>
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-sumi/55">{s.similarity.toFixed(2)}</span>
                    </div>
                    <div className="mt-1.5 h-0.5 bg-hairline" aria-hidden>
                      <motion.div className="h-0.5 bg-bamboo" initial={{ width: 0 }} animate={{ width: `${Math.max(0, s.similarity) * 100}%` }} transition={{ duration: 0.6 }} />
                    </div>
                    <details className="group mt-1.5">
                      <summary className="cursor-pointer list-none text-[11px] text-sumi/55 hover:text-sumi">
                        {s.document_title}
                        {s.page_start ? ` · p.${s.page_start}${s.page_end && s.page_end !== s.page_start ? `–${s.page_end}` : ''}` : ''}
                        {cited && <span className="ml-1 text-bamboo">· {lang === 'ja' ? '引用' : 'cited'}</span>}
                      </summary>
                      <p className="mt-1.5 whitespace-pre-wrap border-l-2 border-hairline pl-2 text-[11px] leading-relaxed text-sumi/70">{s.content}</p>
                    </details>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </div>
    </section>
  )
}
