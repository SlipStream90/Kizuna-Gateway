'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { BookMarked, ExternalLink, TriangleAlert } from 'lucide-react'
import { SOURCE_BY_ID } from '../../lib/jig/retrieve'
import type { LiveBadge } from '../../lib/jig/statutes'
import type { Bilingual } from '../../lib/jig/types'
import { useL } from '../../lib/jig/useL'
import { cn } from '../../lib/utils'

const PANEL_W = 288

type View = {
  authority: string
  title: Bilingual
  clause: Bilingual
  clauseVerified: boolean
  summary: Bilingual
  url: string | null
  file: string | null
  live: boolean
  similarity: number | null
}

function view(id: string | undefined, live: LiveBadge | undefined): View | null {
  if (live) return { ...live, live: true }
  const s = id ? SOURCE_BY_ID.get(id) : undefined
  return s ? { ...s, file: null, live: false, similarity: null } : null
}

/**
 * Hover / Enter disclosure for a statutory source. The panel is portalled to
 * <body> with fixed positioning so scrolling tables don't clip it; it closes on
 * Escape, blur, mouse-leave or page scroll.
 *
 * Pass `id` for a curated source (data/policies.json) or `live` for a clause
 * retrieved from the ingested statutes by the backend RAG engine.
 */
export function CitationBadge({ id, live, index }: { id?: string; live?: LiveBadge; index?: number; align?: 'left' | 'right' }) {
  const src = view(id, live)
  const { L, lang } = useL()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btn = useRef<HTMLButtonElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const panelId = useId()

  const show = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    const r = btn.current?.getBoundingClientRect()
    if (r) {
      const left = Math.max(8, Math.min(r.left, window.innerWidth - PANEL_W - 8))
      setPos({ top: r.bottom + 6, left })
    }
    setOpen(true)
  }
  // Small delay lets the pointer travel from the badge into the panel.
  const hide = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 120)
  }

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  if (!src) return null

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onMouseEnter={show}
        onMouseLeave={hide}
        onBlur={(e) => {
          if (!document.getElementById(panelId)?.contains(e.relatedTarget as Node)) hide()
        }}
        onClick={show}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false)
          // The panel is portalled, so move focus into it explicitly.
          if (e.key === 'Tab' && !e.shiftKey && open) {
            const link = document.getElementById(panelId)?.querySelector('a')
            if (link) { e.preventDefault(); link.focus() }
          }
        }}
        className={cn(
          'inline-flex items-center gap-1 rounded-[2px] border px-1.5 py-0.5 font-mono text-[10px] leading-none transition-colors',
          src.clauseVerified
            ? 'border-aijiro/30 bg-aijiro/5 text-aijiro hover:border-aijiro'
            : 'border-gold/50 bg-gold/10 text-[#7a6230] hover:border-gold',
        )}
      >
        {src.live ? <span className="size-1.5 rounded-full bg-bamboo" aria-hidden /> : <BookMarked className="size-3" aria-hidden />}
        {index !== undefined ? `[${index}] ` : ''}{src.authority}
        {src.live && <span className="sr-only">{lang === 'ja' ? '（取込済み法令）' : ' (ingested statute)'}</span>}
      </button>
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                id={panelId}
                onMouseEnter={show}
                onMouseLeave={hide}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); setOpen(false); btn.current?.focus() }
                }}
                onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node) && e.relatedTarget !== btn.current) hide() }}
                initial={{ opacity: 0, y: 4, filter: 'blur(3px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15 }}
                style={{ top: pos.top, left: pos.left, width: PANEL_W }}
                className="fixed z-[100] rounded-[3px] border border-hairline bg-white p-3 text-left text-xs text-sumi shadow-[0_12px_32px_-12px_rgba(0,0,0,0.35)]"
              >
                <span className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-sumi/50">
                  {src.authority}
                  {src.live && (
                    <span className="normal-case tracking-normal text-bamboo">
                      {lang === 'ja' ? '取込済み法令' : 'ingested statute'}
                      {src.similarity !== null && ` · ${src.similarity.toFixed(2)}`}
                    </span>
                  )}
                </span>
                <span className="mt-1 block font-medium leading-snug">{L(src.title)}</span>
                <span className="mt-1 block text-sumi/70">{L(src.clause)}</span>
                {!src.clauseVerified && (
                  <span className="mt-1.5 flex items-center gap-1 text-[#7a6230]">
                    <TriangleAlert className="size-3" aria-hidden />
                    {src.live
                      ? lang === 'ja' ? '文書の版は未確認（最新の公式版か要確認）' : 'Document version not yet verified as current'
                      : lang === 'ja' ? '条項は最新の公式条文で要確認' : 'Verify clause against current official text'}
                  </span>
                )}
                <span className="mt-2 block leading-relaxed text-sumi/80">{L(src.summary)}</span>
                {src.url ? (
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-aijiro underline-offset-2 hover:underline"
                  >
                    {new URL(src.url).hostname}
                    <ExternalLink className="size-3" aria-hidden />
                  </a>
                ) : src.file ? (
                  <span className="mt-2 block font-mono text-[10px] text-sumi/50">{src.file}</span>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  )
}
