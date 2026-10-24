'use client'

// Adapted from Watermelon UI "Scroll Island"
// (https://ui.watermelon.sh/animated-components/scroll-island): the morphing
// pill, conic progress ring, chevron and topic list are kept; it tracks window
// scroll (not an inner container), appears once the hero is passed, and uses
// layout animation instead of react-use-measure.

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from 'motion/react'
import { ChevronDown } from 'lucide-react'

export interface Topic {
  id: string
  title: string
}

export function ScrollIsland({ topics, label }: { topics: Topic[]; label: string }) {
  const reduceMotion = useReducedMotion()
  const [isOpen, setIsOpen] = useState(false)
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      setProgress(max > 0 ? Math.min(100, Math.max(0, (window.scrollY / max) * 100)) : 0)
      setVisible(window.scrollY > window.innerHeight * 0.7)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen])

  return (
    <MotionConfig transition={reduceMotion ? { duration: 0 } : { type: 'spring', bounce: 0.2, duration: 0.6 }}>
      <AnimatePresence>
        {visible && (
          <motion.div
            className="pointer-events-none fixed inset-x-0 top-4 z-40 flex justify-center px-4"
            initial={{ opacity: 0, y: -24, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -24, filter: 'blur(4px)' }}
          >
            <motion.nav
              layout
              aria-label={label}
              className="pointer-events-auto overflow-hidden bg-sumi text-white shadow-[0_12px_40px_-12px_rgba(0,0,0,0.45)]"
              style={{ borderRadius: isOpen ? 14 : 28 }}
              animate={{ width: isOpen ? 'min(360px, calc(100vw - 2rem))' : 220 }}
            >
              <motion.button
                layout="position"
                type="button"
                aria-expanded={isOpen}
                onClick={() => setIsOpen((o) => !o)}
                className="group flex h-12 w-full items-center justify-between gap-6 px-4"
              >
                <span className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="relative h-6 w-6 shrink-0 rounded-full"
                    style={{ background: `conic-gradient(var(--color-akaneiro) ${progress}%, #3a3a3a 0)` }}
                  >
                    <span className="absolute inset-[2.5px] rounded-full bg-sumi" />
                  </span>
                  <span className="text-sm font-medium">{label}</span>
                  <motion.span animate={{ rotate: isOpen ? 180 : 0 }} aria-hidden>
                    <ChevronDown size={16} className="text-white/50 group-hover:text-white" />
                  </motion.span>
                </span>
                <span className="rounded-full bg-white/10 px-2 text-xs tabular-nums text-white/80">
                  {Math.round(progress)}%
                </span>
              </motion.button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.ul
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-2 pb-3"
                  >
                    <li aria-hidden className="mx-2 mb-2 h-px bg-white/10" />
                    {topics.map((topic, i) => (
                      <li key={topic.id}>
                        <a
                          href={`#${topic.id}`}
                          onClick={() => setIsOpen(false)}
                          className="flex items-baseline gap-3 rounded-[4px] px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white"
                        >
                          <span className="text-xs tabular-nums text-white/40">0{i + 1}</span>
                          {topic.title}
                        </a>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-sumi/30 backdrop-blur-[2px]"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>
    </MotionConfig>
  )
}
