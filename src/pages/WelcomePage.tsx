import { ArrowRight } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const EXIT_MS = 500

/**
 * The app's landing screen, at `/`. A real route (not an overlay) so it's
 * reachable via the logo, the browser back/forward buttons, and a direct
 * link — it just sits ahead of the "what do you miss" screen in the flow.
 * Waits for an explicit action (click the button, click anywhere, or press
 * a key) before moving on; there is no auto-advance timer.
 */
export function WelcomePage() {
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
  const [exiting, setExiting] = useState(false)

  function enter() {
    if (exiting) return
    setExiting(true)
    window.setTimeout(() => navigate('/start'), EXIT_MS)
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Tab') return // don't hijack keyboard focus navigation
      enter()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exiting])

  return (
    <section
      className="relative flex min-h-[75vh] flex-col items-center justify-center overflow-hidden px-4 py-8 transition-opacity sm:px-6"
      style={{ opacity: exiting ? 0 : 1, transitionDuration: `${EXIT_MS}ms` }}
      onClick={enter}
    >
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
          className="glass-button mt-8 inline-flex items-center gap-2 rounded-full border border-white/40 px-6 py-3 text-sm font-semibold transition"
        >
          Enter
          <ArrowRight size={16} aria-hidden="true" />
        </motion.button>
      </div>
    </section>
  )
}
