'use client'

// Sumi-ink band after landing-01's "stats" section: corner-accented counters
// over a darkened torii walk. Every number is a property of the product itself,
// not a market claim.

import { useEffect, useRef } from 'react'
import { motion, useInView, useReducedMotion, type Variants } from 'motion/react'
import { ArrowUpRight, Boxes, Languages, Route, ScrollText } from 'lucide-react'
import { useI18n, type MessageKey } from '../../lib/i18n'
import { jigHref } from '../../lib/jig/handoff'
import { AnimatedNumber } from '../jig/AnimatedNumber'

const STATS: { value: number; suffix?: string; label: MessageKey; icon: typeof Boxes }[] = [
  { value: 4, label: 'band.engines', icon: Boxes },
  { value: 2, label: 'band.languages', icon: Languages },
  { value: 2, label: 'band.routes', icon: Route },
  { value: 100, suffix: '%', label: 'band.assumptions', icon: ScrollText },
]

const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.2, 0, 0, 1] } },
}

export function EvidenceBand() {
  const { t } = useI18n()
  const reduce = useReducedMotion()
  const root = useRef<HTMLElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const inView = useInView(root, { margin: '-80px' })
  const seen = useInView(root, { once: true, margin: '-80px' })

  // Play the footage only while the band is on screen.
  useEffect(() => {
    const v = video.current
    if (!v || reduce) return
    if (inView) v.play().catch(() => undefined)
    else v.pause()
  }, [inView, reduce])

  return (
    <section ref={root} className="relative isolate overflow-hidden bg-sumi text-white">
      <video
        ref={video}
        aria-hidden
        className="absolute inset-0 -z-10 h-full w-full object-cover opacity-40"
        poster="/media/torii-walk-video-poster.webp"
        muted
        loop
        playsInline
        preload="none"
      >
        <source src="/media/torii-walk-video.webm" type="video/webm" />
        <source src="/media/torii-walk-video.mp4" type="video/mp4" />
      </video>
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(28,28,28,0.55),rgba(28,28,28,0.92))]" />

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-100px' }}
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
        className="mx-auto max-w-6xl px-5 py-24 md:px-10 md:py-32"
      >
        <motion.p variants={item} className="font-mono text-xs uppercase tracking-[0.25em] text-akaneiro">
          「{t('band.eyebrow')}」
        </motion.p>
        <motion.h2 variants={item} className="jp-heading mt-6 text-balance text-4xl leading-tight md:text-6xl">
          {t('band.title')}
          <br />
          <span className="text-white/55">{t('band.titleAccent')}</span>
        </motion.h2>
        <motion.p variants={item} className="mt-6 max-w-xl text-white/65 jp-body">{t('band.body')}</motion.p>

        <ul className="mt-14 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {STATS.map(({ value, suffix, label, icon: Icon }, i) => (
            <motion.li key={label} variants={item} className="group relative border border-white/10 bg-black/30 p-6 backdrop-blur-[2px] md:p-8">
              {/* Kumiko corner joints */}
              <span aria-hidden className="absolute left-0 top-0 h-2 w-2 border-l border-t border-akaneiro/80" />
              <span aria-hidden className="absolute right-0 top-0 h-2 w-2 border-r border-t border-white/40" />
              <span aria-hidden className="absolute bottom-0 left-0 h-2 w-2 border-b border-l border-white/40" />
              <span aria-hidden className="absolute bottom-0 right-0 h-2 w-2 border-b border-r border-akaneiro/80" />
              <Icon className="size-5 text-white/60 transition-colors group-hover:text-akaneiro" aria-hidden />
              <p className="mt-5 font-mono text-4xl tabular-nums md:text-5xl">
                <AnimatedNumber value={seen ? value : 0} suffix={suffix} delay={i * 0.1} />
              </p>
              <p className="mt-2 text-xs uppercase tracking-widest text-white/50">{t(label)}</p>
            </motion.li>
          ))}
        </ul>

        <motion.a
          variants={item}
          href={jigHref({ screen: 'matrix' })}
          className="mt-12 inline-flex items-center gap-2 border border-white/25 px-5 py-3 text-sm transition-colors hover:border-white hover:bg-white/5"
        >
          {t('band.cta')}
          <ArrowUpRight className="size-4" aria-hidden />
        </motion.a>
      </motion.div>
    </section>
  )
}
