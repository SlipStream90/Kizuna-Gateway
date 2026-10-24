'use client'

// Hero inspired by Watermelon UI template "landing-01" (rotating headline word,
// framed-photo collage, technical frame lines with crosshairs) — re-expressed in
// Japanese idiom: shoji frame lines with kumiko joints, a tategaki side label,
// seigaiha texture, and the photo collage opening like a folding fan (扇),
// Japan on the left leaf, India on the right.

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react'
import { ArrowRight, AudioLines, Globe2, ShieldCheck } from 'lucide-react'
import { LanguageToggle, useI18n, type MessageKey } from '../../lib/i18n'
import { SessionControls } from '../session-controls'

const navLinks: { key: MessageKey; href: string }[] = [
  { key: 'nav.engines', href: '#features' },
  { key: 'nav.preview', href: '#preview' },
  { key: 'nav.assessment', href: '#workflow' },
  { key: 'nav.translation', href: '#translation' },
]

// Japan → bridge → India, left to right across the fan.
const LEAVES = [
  { src: '/media/torii-path.webp', place: { en: 'Fushimi Inari, Kyoto', ja: '伏見稲荷・京都' } },
  { src: '/media/gion-street.webp', place: { en: 'Gion, Kyoto', ja: '祇園・京都' } },
  { src: '/media/shinkansen-fuji.webp', place: { en: 'Shinkansen & Fuji', ja: '新幹線と富士山' } },
  { src: '/media/tokyo-tower.webp', place: { en: 'Tokyo', ja: '東京' } },
  { src: '/media/howrah-bridge.webp', place: { en: 'Howrah Bridge, Kolkata', ja: 'ハウラー橋・コルカタ' } },
  { src: '/media/gateway-of-india.webp', place: { en: 'Gateway of India, Mumbai', ja: 'インド門・ムンバイ' } },
  { src: '/media/hawa-mahal.webp', place: { en: 'Hawa Mahal, Jaipur', ja: '風の宮殿・ジャイプール' } },
  { src: '/media/delhi-spice-market.webp', place: { en: 'Spice market, Delhi', ja: 'スパイス市場・デリー' } },
  { src: '/media/delhi-metro.webp', place: { en: 'Delhi Metro', ja: 'デリーメトロ' } },
]

const chips = [
  { title: 'hero.chip1.title', desc: 'hero.chip1.desc', icon: ShieldCheck },
  { title: 'hero.chip2.title', desc: 'hero.chip2.desc', icon: AudioLines },
  { title: 'hero.chip3.title', desc: 'hero.chip3.desc', icon: Globe2 },
] as const

const ROTATE: MessageKey[] = ['hero.rotate1', 'hero.rotate2', 'hero.rotate3']

const copy: Variants = {
  hidden: { opacity: 0, y: 20, filter: 'blur(6px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] } },
}

function KumikoJoint({ className }: { className: string }) {
  return (
    <span aria-hidden className={`absolute hidden h-3 w-3 lg:block ${className}`}>
      <span className="absolute inset-x-0 top-1/2 h-px bg-akaneiro/70" />
      <span className="absolute inset-y-0 left-1/2 w-px bg-akaneiro/70" />
    </span>
  )
}

export function FanHero() {
  const { lang, t } = useI18n()
  const reduce = useReducedMotion()
  const [word, setWord] = useState(0)

  useEffect(() => {
    if (reduce) return
    const id = setInterval(() => setWord((w) => (w + 1) % ROTATE.length), 2800)
    return () => clearInterval(id)
  }, [reduce])

  const mid = (LEAVES.length - 1) / 2

  return (
    <section className="relative isolate overflow-hidden bg-washi text-sumi">
      {/* Shoji frame lines + kumiko joints */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-[76px] hidden h-px bg-hairline lg:block" />
        <div className="absolute inset-y-0 left-[max(1.25rem,calc(50%-36rem))] hidden w-px bg-hairline lg:block" />
        <div className="absolute inset-y-0 right-[max(1.25rem,calc(50%-36rem))] hidden w-px bg-hairline lg:block" />
        <KumikoJoint className="left-[max(1.25rem,calc(50%-36rem))] top-[76px] -translate-x-1/2 -translate-y-1/2" />
        <KumikoJoint className="right-[max(1.25rem,calc(50%-36rem))] top-[76px] translate-x-1/2 -translate-y-1/2" />
        <div className="seigaiha absolute inset-x-0 bottom-0 h-[55%] opacity-70 [mask-image:linear-gradient(to_top,black,transparent)]" />
      </div>

      <div className="mx-auto w-full max-w-6xl px-5 md:px-10">
        <header className="relative z-20 flex h-[76px] items-center justify-between gap-6">
          <a href="#" aria-label="Nishi Link" className="flex shrink-0 items-center gap-3 transition-opacity hover:opacity-75">
            <span className="hanko h-8 w-8 text-lg" aria-hidden>西</span>
            <span className="jp-heading hidden whitespace-nowrap text-lg sm:inline">Nishi Link</span>
          </a>
          <nav aria-label="Primary" className="hidden items-center gap-7 lg:flex">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} className="text-sm text-sumi/75 transition-colors hover:text-sumi">{t(l.key)}</a>
            ))}
            <a href="/jig-os" className="inline-flex items-center gap-1.5 text-sm text-sumi transition-colors hover:text-akaneiro">
              <span className="rounded-[2px] bg-sumi px-1.5 py-0.5 font-mono text-[10px] text-white">OS</span>
              {t('nav.jigos')}
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <SessionControls />
          </div>
        </header>
      </div>

      {/* Tategaki side label */}
      <p aria-hidden className="tategaki absolute left-[max(0.5rem,calc(50%-38.5rem))] top-28 hidden font-serif text-xs tracking-[0.5em] text-sumi/45 xl:block">
        日本から西へ　インドとつなぐ
      </p>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } } }}
        className="mx-auto flex max-w-3xl flex-col items-center px-5 pt-14 text-center md:pt-20"
      >
        <motion.p variants={copy} className="eyebrow mb-7">
          「{t('hero.eyebrow')}」
        </motion.p>
        <motion.h1 variants={copy} className="jp-heading text-balance text-[clamp(2.6rem,6vw,5.2rem)] leading-[1.06] tracking-[-0.03em]">
          <span className="block">{t('hero.line1')}</span>
          <span className="block">
            {t('hero.line2Prefix')}
            <span className="relative inline-grid align-baseline">
              {/* Reserve the widest word's width so the line doesn't jump. */}
              <span aria-hidden className="invisible col-start-1 row-start-1">
                {ROTATE.map((k) => t(k)).reduce((a, b) => (a.length >= b.length ? a : b))}
              </span>
              <AnimatePresence mode="wait">
                <motion.span
                  key={`${lang}-${word}`}
                  className={`col-start-1 row-start-1 text-akaneiro ${lang === 'en' ? 'italic' : ''}`}
                  initial={reduce ? false : { y: 14, opacity: 0, filter: 'blur(4px)' }}
                  animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                  exit={{ y: -14, opacity: 0, filter: 'blur(4px)', transition: { duration: 0.15 } }}
                  transition={{ duration: 0.3 }}
                >
                  {t(ROTATE[word])}
                </motion.span>
              </AnimatePresence>
            </span>
            {lang === 'en' ? '.' : '。'}
          </span>
        </motion.h1>
        <motion.p variants={copy} className="jp-body mt-7 max-w-xl text-pretty text-lg text-sumi/70">
          {t('hero.body')}
        </motion.p>
        <motion.div variants={copy} className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <a href="#workflow" className="glass-button group min-h-11 px-6 active:scale-[0.97]">
            {t('hero.primary')}
            <ArrowRight className="size-4 -rotate-45 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
          </a>
          <a href="/jig-os" className="glass-button secondary min-h-11 bg-white/60 px-6 active:scale-[0.97]">
            <span className="rounded-[2px] bg-sumi px-1.5 py-0.5 font-mono text-[10px] text-white">OS</span>
            {t('hero.jigos')}
          </a>
        </motion.div>
        <motion.ul variants={copy} className="mt-10 flex flex-wrap justify-center gap-x-8 gap-y-3">
          {chips.map(({ title, desc, icon: Icon }) => (
            <li key={title} className="flex items-center gap-2.5 text-left">
              <span className="inline-flex size-8 items-center justify-center rounded-full border border-hairline bg-white/70">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="leading-tight">
                <span className="block text-sm font-medium">{t(title)}</span>
                <span className="block text-xs text-sumi/55">{t(desc)}</span>
              </span>
            </li>
          ))}
        </motion.ul>
      </motion.div>

      {/* The fan */}
      <div
        role="img"
        aria-label={`${t('hero.fanLabel')}: ${LEAVES.map((l) => l.place[lang]).join(', ')}`}
        className="relative mx-auto mt-10 h-[300px] max-w-6xl sm:h-[400px] md:mt-14 md:h-[470px]"
      >
        {LEAVES.map((leaf, i) => {
          const offset = i - mid
          const outer = Math.abs(offset) > 2
          return (
            <motion.figure
              key={leaf.src}
              className={`absolute bottom-[-40px] left-1/2 w-[118px] origin-[50%_175%] sm:w-[170px] md:w-[205px] ${outer ? 'hidden sm:block' : ''}`}
              style={{ x: '-50%', zIndex: 10 + i }}
              initial={reduce ? false : { rotate: 0, opacity: 0, y: 40 }}
              animate={{ rotate: offset * 12.5, opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 70, damping: 16, delay: 0.5 + Math.abs(offset) * 0.09 }}
              whileHover={reduce ? undefined : { y: -16, zIndex: 40, transition: { duration: 0.25 } }}
            >
              <div className="border border-hairline bg-white p-1.5 shadow-[0_18px_40px_-18px_rgba(28,28,28,0.45)]">
                <img src={leaf.src} alt="" loading={Math.abs(offset) <= 2 ? 'eager' : 'lazy'} className="aspect-[3/4] w-full object-cover" />
                <figcaption className="flex items-center justify-between gap-1 px-0.5 pb-0.5 pt-1.5 text-[10px] leading-tight text-sumi/70">
                  <span className="truncate">{leaf.place[lang]}</span>
                  <span className={`font-serif ${i < 4 ? 'text-akaneiro' : i > 4 ? 'text-aijiro' : 'text-sumi'}`} aria-hidden>
                    {i < 4 ? '日' : i > 4 ? '印' : '橋'}
                  </span>
                </figcaption>
              </div>
            </motion.figure>
          )
        })}
        <span aria-hidden className="absolute bottom-6 left-[6%] z-30 hidden font-mono text-[10px] uppercase tracking-[0.3em] text-sumi/50 md:block">
          ← {t('hero.fanJapan')}
        </span>
        <span aria-hidden className="absolute bottom-6 right-[6%] z-30 hidden font-mono text-[10px] uppercase tracking-[0.3em] text-sumi/50 md:block">
          {t('hero.fanIndia')} →
        </span>
        <div aria-hidden className="absolute inset-x-0 bottom-0 z-30 h-16 bg-gradient-to-t from-washi to-transparent" />
      </div>
    </section>
  )
}
