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
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const requestIdRef = useRef(0)
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runMatch = useCallback(() => {
    if (flow.preferences.length === 0) return
    const requestId = ++requestIdRef.current
    setPhase('pending')
    setErrorMessage(null)

    const pin = new Promise<{ lat: number; lng: number }>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('This browser cannot read a location, so nearby places cannot be scored.'))
        return
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
        () =>
          reject(
            new Error(
              'Location access is needed to score walking distance. Allow it for this site, then try again.',
            ),
          ),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 20000 },
      )
    })

    pin
      .then((location) =>
        api.match(flow.preferences, {
          text: flow.rawMemoryText,
          lat: location.lat,
          lng: location.lng,
          droppedTags: (flow.interpretResult?.preferences ?? [])
            .map((pref) => pref.tag)
            .filter((tag) => !flow.preferences.some((pref) => pref.tag === tag)),
        }),
      )
      .then((result) => {
        if (requestIdRef.current !== requestId) return
        setPhase('settled')
        flow.setMatchResult(result, flow.preferences)
        settleTimeoutRef.current = setTimeout(() => {
          if (requestIdRef.current === requestId) {
            navigate('/result')
          }
        }, SETTLE_DELAY_MS)
      })
      .catch((error: unknown) => {
        if (requestIdRef.current !== requestId) return
        setErrorMessage(error instanceof Error ? error.message : 'The match could not be completed.')
        setPhase('error')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.preferences, flow.rawMemoryText, flow.interpretResult])

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
          ? (errorMessage ?? 'Your qualities are still saved. You can try again or go back to adjust them.')
          : 'Scoring nearby places from your location and what you wrote.'}
      </p>

      <div className="mt-10 w-full">
        <CircleCluster preferences={flow.preferences} phase={phase} />
      </div>

      {phase === 'error' && (
        <div className="mt-8 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/confirm')}
            className="glass-chip rounded-full border border-white/30 px-5 py-2.5 text-sm text-[var(--color-text-secondary)] transition hover:border-white/60 hover:text-[var(--color-text)]"
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
