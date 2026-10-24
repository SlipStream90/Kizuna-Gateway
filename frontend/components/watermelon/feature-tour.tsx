'use client'

// Adapted from Watermelon UI "Feature Tour"
// (https://ui.watermelon.sh/animated-components/feature-tour): the shared-layout
// icon morph, blur/slide content transitions and dot tabs are kept; it renders
// inline instead of as a dialog, auto-advances (paused on hover/focus or reduced
// motion), scopes arrow keys to the component, and pairs each step with imagery.

import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion, type Transition } from 'motion/react'
import { cn } from '../../lib/utils'

export interface TourStep {
  id: string
  kanji: string
  title: string
  description: string
  icon: React.ReactNode
  image: string
  /** Optional deep link into JIG-OS for this engine. */
  href?: string
  hrefLabel?: string
}

const EASE_OUT = [0.16, 1, 0.3, 1] as const
const FAST_OUT = [0.22, 1, 0.36, 1] as const
const SPRING_ICON: Transition = { type: 'spring', stiffness: 420, damping: 34, mass: 0.7 }
const SPRING_BG: Transition = { type: 'spring', stiffness: 340, damping: 30, mass: 0.8 }
const AUTO_ADVANCE_MS = 6000

export function FeatureTour({ steps, label }: { steps: TourStep[]; label: string }) {
  const reduceMotion = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  const go = useCallback((delta: number) => setIndex((i) => (i + delta + steps.length) % steps.length), [steps.length])

  useEffect(() => {
    if (paused || reduceMotion) return
    const timer = setTimeout(() => go(1), AUTO_ADVANCE_MS)
    return () => clearTimeout(timer)
  }, [index, paused, reduceMotion, go])

  const step = steps[index]

  return (
    <div
      className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-14"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); go(1) }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); go(-1) }
      }}
    >
      {/* Step list: every engine stays visible as a heading wrapping its control. */}
      <ul aria-label={label} className="border-t border-hairline">
        {steps.map((s, i) => {
          const active = i === index
          return (
            <li key={s.id} className="relative border-b border-hairline">
              {active && (
                <motion.span
                  layoutId="tour-active-rule"
                  transition={SPRING_BG}
                  className="absolute left-0 top-0 h-full w-[2px] bg-akaneiro"
                />
              )}
              <h3>
                <button
                  type="button"
                  aria-current={active ? 'step' : undefined}
                  aria-controls="tour-panel"
                  onClick={() => setIndex(i)}
                  className="group flex w-full items-baseline gap-4 py-5 pl-5 text-left"
                >
                  <span aria-hidden className={cn('font-serif text-xl transition-colors', active ? 'text-akaneiro' : 'text-sumi/35')}>
                    {s.kanji}
                  </span>
                  <span className="flex-1">
                    <span className={cn('block text-lg font-medium transition-colors', active ? 'text-sumi' : 'text-sumi/55 group-hover:text-sumi')}>
                      {s.title}
                    </span>
                    {/* Progress hairline for the auto-advance. */}
                    <span aria-hidden className="mt-3 block h-px w-full max-w-56 bg-hairline">
                      {active && !reduceMotion && (
                        <motion.span
                          key={`${s.id}-${paused}`}
                          className="block h-px origin-left bg-sumi"
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: paused ? 0 : 1 }}
                          transition={{ duration: paused ? 0.2 : AUTO_ADVANCE_MS / 1000, ease: 'linear' }}
                        />
                      )}
                    </span>
                  </span>
                </button>
              </h3>
            </li>
          )
        })}
      </ul>

      {/* Tour card */}
      <div
        id="tour-panel"
        className="relative overflow-hidden rounded-[4px] border border-hairline bg-[#fcfbf8]"
      >
        <div className="relative aspect-[16/10] overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.img
              key={step.image}
              src={step.image}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              initial={{ opacity: 0, scale: 1.06, filter: 'blur(6px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7, ease: EASE_OUT }}
            />
          </AnimatePresence>
          <div className="absolute inset-0 bg-gradient-to-t from-[#fcfbf8] via-transparent to-transparent" />
        </div>

        <div className="relative -mt-14 flex flex-col items-start px-7 pb-7 md:px-9 md:pb-9">
          <AnimatePresence mode="wait">
            <motion.div
              key={step.id}
              initial={{ opacity: 0, scale: 0.92, y: 8, filter: 'blur(3px)' }}
              animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.92, y: -6, filter: 'blur(3px)' }}
              transition={{ duration: 0.16, ease: FAST_OUT }}
              className="relative flex h-16 w-16 items-center justify-center"
            >
              <motion.div layoutId="tour-icon-bg" transition={SPRING_BG} className="absolute inset-0 rounded-[4px] border border-hairline bg-washi" />
              <motion.div layoutId="tour-icon" transition={SPRING_ICON} className="relative text-sumi">
                {step.icon}
              </motion.div>
            </motion.div>
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.div
              key={`content-${step.id}`}
              initial={{ opacity: 0, y: reduceMotion ? 0 : 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduceMotion ? 0 : -14 }}
              transition={{ duration: 0.16, ease: EASE_OUT }}
              className="mt-6 min-h-[9.5rem]"
            >
              <p className="eyebrow">0{index + 1} / 0{steps.length}</p>
              <p className="jp-heading mt-2 text-2xl text-sumi">{step.title}</p>
              <p className="jp-body mt-3 max-w-md text-sumi/70">{step.description}</p>
              {step.href && (
                <a href={step.href} className="mt-4 inline-flex items-center gap-1.5 text-sm text-sumi underline decoration-hairline underline-offset-4 transition-colors hover:decoration-akaneiro">
                  <span className="rounded-[2px] bg-sumi px-1.5 py-0.5 font-mono text-[10px] text-white no-underline">OS</span>
                  {step.hrefLabel}
                  <span aria-hidden>→</span>
                </a>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-4 flex items-center gap-3" aria-hidden>
            {steps.map((s, i) => (
              <motion.span
                key={s.id}
                animate={{ scale: i === index ? 1.2 : 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className={cn('h-2 w-2 rounded-full', i === index ? 'bg-sumi' : 'bg-hairline')}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
