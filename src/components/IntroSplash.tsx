import { ArrowRight } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'

import { NYCSkylineBackdrop } from '@/components/NYCSkylineBackdrop'

const SESSION_KEY = 'eh:introShown'
const EXIT_MS = 500

type Phase = 'visible' | 'exiting' | 'hidden'

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function alreadyShownThisSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1'
  } catch {
    return false
  }
}

function markShown(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, '1')
  } catch {
    // ignore — worst case it plays again next time
  }
}

/**
 * A once-per-tab-session entrance that waits for the person to act — there
 * is no auto-advance timer. It renders on top of the already-mounted
 * homepage, respects `prefers-reduced-motion` by never appearing at all,
 * and never replays after it's been dismissed once in a given tab.
 */
export function IntroSplash() {
  const reduceMotion = useReducedMotion()
  const [phase, setPhase] = useState<Phase>(() => {
    if (prefersReducedMotion() || alreadyShownThisSession()) return 'hidden'
    return 'visible'
  })

  function enter() {
    setPhase((current) => (current === 'visible' ? 'exiting' : current))
  }

  useEffect(() => {
    if (phase !== 'exiting') return
    const timer = setTimeout(() => {
      setPhase('hidden')
      markShown()
    }, EXIT_MS)
    return () => clearTimeout(timer)
  }, [phase])

  useEffect(() => {
    if (phase !== 'visible') return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Tab') return // don't hijack keyboard focus navigation
      enter()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [phase])

  if (phase === 'hidden') return null

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[var(--color-bg)] transition-opacity"
      style={{ opacity: phase === 'exiting' ? 0 : 1, transitionDuration: `${EXIT_MS}ms` }}
      onClick={enter}
    >
      <motion.div
        className="absolute inset-x-0 bottom-0 h-[58%] w-full opacity-80 sm:h-1/2"
        initial={reduceMotion ? undefined : { opacity: 0, y: 36, scale: 1.04 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
      >
        <NYCSkylineBackdrop className="h-full w-full" />
      </motion.div>

      <div className="relative z-10 flex flex-col items-center px-6 text-center">
        <motion.p
          className="text-2xl font-semibold tracking-tight text-[var(--color-text)] sm:text-3xl"
          initial={reduceMotion ? undefined : { opacity: 0, y: 14, letterSpacing: '0.06em' }}
          animate={{ opacity: 1, y: 0, letterSpacing: '0em' }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.15 }}
        >
          Elsewhere Here
        </motion.p>
        <motion.p
          className="mt-2 text-sm text-[var(--color-text-muted)]"
          initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.5 }}
        >
          Find a familiar feeling in New York.
        </motion.p>

        <motion.button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            enter()
          }}
          initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.85 }}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--color-lavender)] px-6 py-3 text-sm font-semibold text-[#100c16] transition hover:bg-[var(--color-lavender-strong)]"
        >
          Enter
          <ArrowRight size={16} aria-hidden="true" />
        </motion.button>
      </div>
    </div>
  )
}
