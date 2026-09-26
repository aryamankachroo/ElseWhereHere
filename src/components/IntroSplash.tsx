import { useEffect, useState } from 'react'

import { NYCSkylineBackdrop } from '@/components/NYCSkylineBackdrop'

const SESSION_KEY = 'eh:introShown'
const VISIBLE_MS = 1050
const EXIT_MS = 450

type Phase = 'hidden' | 'visible' | 'exiting'

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
 * A short, skippable, once-per-tab-session entrance. Deliberately not a
 * blocking route or a required step: it renders on top of the already-
 * mounted homepage, respects `prefers-reduced-motion` by never appearing at
 * all, and never replays after the first time in a given tab.
 */
export function IntroSplash() {
  const [phase, setPhase] = useState<Phase>(() => {
    if (prefersReducedMotion() || alreadyShownThisSession()) return 'hidden'
    return 'visible'
  })

  useEffect(() => {
    if (phase !== 'visible') return
    const timer = setTimeout(() => setPhase('exiting'), VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [phase])

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
    function skip() {
      setPhase('exiting')
    }
    window.addEventListener('keydown', skip)
    return () => window.removeEventListener('keydown', skip)
  }, [phase])

  if (phase === 'hidden') return null

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[var(--color-bg)] transition-opacity"
      style={{ opacity: phase === 'exiting' ? 0 : 1, transitionDuration: `${EXIT_MS}ms` }}
      onClick={() => setPhase('exiting')}
    >
      <NYCSkylineBackdrop className="absolute inset-x-0 bottom-0 h-1/2 w-full opacity-70" />

      <div className="relative z-10 flex flex-col items-center px-6 text-center">
        <p className="animate-[splash-scale-in_0.6s_ease-out_both] text-2xl font-semibold tracking-tight text-[var(--color-text)] sm:text-3xl">
          Elsewhere Here
        </p>
        <p className="mt-2 animate-[fade-up_0.6s_ease-out_0.3s_both] text-sm text-[var(--color-text-muted)]">
          Find a familiar feeling in New York.
        </p>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setPhase('exiting')
        }}
        className="absolute bottom-6 right-6 z-10 text-xs text-[var(--color-text-muted)] underline underline-offset-2 transition hover:text-[var(--color-text-secondary)]"
      >
        Skip
      </button>
    </div>
  )
}
