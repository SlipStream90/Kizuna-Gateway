'use client'

// Adapted from Watermelon UI "Step Indicator"
// (https://ui.watermelon.sh/animated-components/step-indicator): the
// clip-path tooltip that glides between segments is kept; segments also show
// real progress (completed / current / upcoming) and use lucide icons.

import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

export type Step = { id: string; label: string; icon: LucideIcon }

export function StepIndicator({ steps, current, label, caption }: { steps: Step[]; current: number; label: string; caption: string }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [coords, setCoords] = useState({ clipPath: '', translateX: 0 })
  const [isEntering, setIsEntering] = useState(true)
  const measureRefs = useRef<(HTMLDivElement | null)[]>([])
  const segmentRefs = useRef<(HTMLLIElement | null)[]>([])

  const show = (index: number) => {
    const labelEl = measureRefs.current[index]
    const segment = segmentRefs.current[index]
    if (!labelEl || !segment) return
    const total = measureRefs.current.reduce((acc, el) => acc + (el?.offsetWidth || 0), 0)
    const cLeft = (labelEl.offsetLeft / total) * 100
    const cRight = 100 - ((labelEl.offsetLeft + labelEl.offsetWidth) / total) * 100
    setIsEntering(activeIndex === null)
    setCoords({
      clipPath: `inset(0 ${cRight}% 0 ${cLeft}% round 4px)`,
      translateX: segment.offsetLeft + segment.offsetWidth / 2 - (labelEl.offsetLeft + labelEl.offsetWidth / 2),
    })
    setActiveIndex(index)
  }

  const hide = () => {
    setActiveIndex(null)
    setCoords({ clipPath: '', translateX: 0 })
  }

  return (
    <div className="relative">
      <div className="mb-3 flex items-baseline justify-between text-xs">
        <span className="eyebrow">{label}</span>
        <span className="text-sumi/60">
          {caption} · {steps[current].label}
        </span>
      </div>
      <ol className="relative flex h-2 w-full items-center gap-2" onMouseLeave={hide}>
        <AnimatePresence>
          {activeIndex !== null && coords.clipPath !== '' && (
            <motion.div
              aria-hidden
              className="pointer-events-none absolute left-0 top-5 z-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <motion.div
                className="flex bg-sumi"
                initial={{ clipPath: coords.clipPath, x: coords.translateX }}
                animate={{ clipPath: coords.clipPath, x: coords.translateX }}
                transition={{ type: 'spring', bounce: 0, duration: isEntering ? 0 : 0.4 }}
                onUpdate={() => isEntering && setIsEntering(false)}
              >
                {steps.map((step, i) => (
                  <motion.div
                    key={step.id}
                    animate={{ opacity: activeIndex === i ? 1 : 0, filter: activeIndex === i ? 'blur(0px)' : 'blur(4px)' }}
                    transition={{ duration: 0.4 }}
                    className="flex items-center gap-2 whitespace-nowrap px-3 py-1.5 text-white"
                  >
                    <step.icon className="size-4" />
                    <span className="text-sm">{step.label}</span>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {steps.map((step, i) => (
          <li
            key={step.id}
            ref={(el) => { segmentRefs.current[i] = el }}
            className="relative h-2 flex-1"
            aria-current={i === current ? 'step' : undefined}
            aria-label={step.label}
          >
            <div
              tabIndex={0}
              onMouseEnter={() => show(i)}
              onFocus={() => show(i)}
              onBlur={hide}
              className="absolute inset-0 cursor-default rounded-full bg-hairline outline-none focus-visible:ring-2 focus-visible:ring-akaneiro focus-visible:ring-offset-2"
            >
              <motion.div
                className={cn('h-full origin-left rounded-full', i === current ? 'bg-akaneiro' : 'bg-sumi')}
                initial={false}
                animate={{ scaleX: i <= current ? 1 : 0 }}
                transition={{ type: 'spring', bounce: 0, duration: 0.6, delay: i === current ? 0.15 : 0 }}
              />
            </div>
          </li>
        ))}
      </ol>

      {/* Off-screen measuring row for tooltip widths. */}
      <div aria-hidden className="pointer-events-none absolute left-0 top-0 flex h-0 overflow-hidden whitespace-nowrap opacity-0">
        {steps.map((step, i) => (
          <div key={step.id} ref={(el) => { measureRefs.current[i] = el }} className="flex items-center gap-2 px-3 py-1.5">
            <step.icon className="size-4" />
            <span className="text-sm">{step.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
