import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import { CircleCluster, type ClusterPhase } from '@/components/CircleCluster'
import { useFlow } from '@/context/FlowContext'
import { api } from '@/lib/api'

const SETTLE_DELAY_MS = 650

export function MatchingPage() {
  const flow = useFlow()
  const navigate = useNavigate()

  const [phase, setPhase] = useState<ClusterPhase>('pending')
  const requestIdRef = useRef(0)
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runMatch = useCallback(() => {
    if (flow.preferences.length === 0) return
    const requestId = ++requestIdRef.current
    setPhase('pending')

    api
      .match(flow.preferences)
      .then((result) => {
        if (requestIdRef.current !== requestId) return // superseded by a newer request
        setPhase('settled')
        flow.setMatchResult(result, flow.preferences)
        settleTimeoutRef.current = setTimeout(() => {
          if (requestIdRef.current === requestId) {
            navigate('/result')
          }
        }, SETTLE_DELAY_MS)
      })
      .catch(() => {
        if (requestIdRef.current !== requestId) return
        setPhase('error')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.preferences])

  useEffect(() => {
    runMatch()
    return () => {
      if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (flow.preferences.length === 0) {
    return <Navigate to="/confirm" replace />
  }

  return (
    <section className="content-max flex flex-col items-center px-4 py-10 text-center sm:px-6 lg:py-16">
      <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text)] sm:text-3xl">
        {phase === 'error' ? "We couldn't complete the match." : 'Finding your connection…'}
      </h1>
      <p className="mt-3 max-w-md text-base text-[var(--color-text-secondary)]">
        {phase === 'error'
          ? 'Your qualities are still saved. You can try again or go back to adjust them.'
          : 'Bringing together the qualities you chose.'}
      </p>

      <div className="mt-10 w-full">
        <CircleCluster preferences={flow.preferences} phase={phase} />
      </div>

      {phase === 'error' && (
        <div className="mt-8 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/confirm')}
            className="rounded-full border border-[var(--color-border-strong)] px-5 py-2.5 text-sm text-[var(--color-text-secondary)] transition hover:border-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
          >
            Back
          </button>
          <button
            type="button"
            onClick={runMatch}
            className="glass-button rounded-full border border-white/40 px-6 py-2.5 text-sm font-semibold transition"
          >
            Retry
          </button>
        </div>
      )}
    </section>
  )
}
