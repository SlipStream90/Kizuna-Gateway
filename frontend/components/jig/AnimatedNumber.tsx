'use client'

import { useEffect, useRef } from 'react'
import { animate, useReducedMotion } from 'motion/react'

/** Counts from 0 to `value` (same easing as Watermelon landing-01 stat counters). */
export function AnimatedNumber({ value, suffix = '', delay = 0 }: { value: number; suffix?: string; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduce = useReducedMotion()
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduce) { el.textContent = String(value); return }
    const controls = animate(0, value, {
      duration: 1.4,
      delay,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => { el.textContent = String(Math.round(v)) },
    })
    return () => controls.stop()
  }, [value, delay, reduce])
  return (
    <span className="tabular-nums">
      <span ref={ref}>0</span>
      {suffix}
    </span>
  )
}
