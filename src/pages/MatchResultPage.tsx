import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import { PlaceIllustration } from '@/components/PlaceIllustration'
import { SourceDrawer } from '@/components/SourceDrawer'
import { useFlow } from '@/context/FlowContext'
import { api } from '@/lib/api'
import { NotFoundError, type PlaceProfile } from '@/types/api'

type LoadState = 'loading' | 'ready' | 'not-found' | 'error'

export function MatchResultPage() {
  const flow = useFlow()
  const navigate = useNavigate()

  const [place, setPlace] = useState<PlaceProfile | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const requestIdRef = useRef(0)

  const matchResult = flow.matchResult
  const placeId = matchResult?.placeId

  useEffect(() => {
    if (!placeId) return
    const requestId = ++requestIdRef.current
    setLoadState('loading')
    api
      .getPlace(placeId)
      .then((profile) => {
        if (requestIdRef.current !== requestId) return
        setPlace(profile)
        setLoadState('ready')
      })
      .catch((err: unknown) => {
        if (requestIdRef.current !== requestId) return
        setLoadState(err instanceof NotFoundError ? 'not-found' : 'error')
      })
  }, [placeId])

  if (!matchResult || flow.isMatchStale) {
    return <Navigate to="/confirm" replace />
  }

  if (loadState === 'loading') {
    return (
      <section className="content-max px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-[var(--color-text-muted)]">Loading your match…</p>
      </section>
    )
  }

  if (loadState === 'not-found' || loadState === 'error') {
    return (
      <section className="content-max px-4 py-16 text-center sm:px-6">
        <p className="text-base text-[var(--color-text-secondary)]">
          {loadState === 'not-found'
            ? "We couldn't find that place profile."
            : 'Something went wrong loading this place.'}
        </p>
        <button
          type="button"
          onClick={() => navigate('/confirm')}
          className="mt-5 rounded-full border border-[var(--color-border-strong)] px-5 py-2.5 text-sm text-[var(--color-text-secondary)] transition hover:border-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
        >
          Back to qualities
        </button>
      </section>
    )
  }

  if (!place) return null

  const isPartial = matchResult.matchLabel === 'partial connection'

  return (
    <section className="content-max px-4 py-8 sm:px-6 lg:py-12">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start lg:gap-12">
        <div>
          <PlaceIllustration
            variant={place.illustration}
            className="aspect-[4/3] w-full rounded-2xl lg:aspect-square"
            label={`Sample illustration representing ${place.name}`}
          />
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">{place.imageAttribution}</p>
        </div>

        <div>
          {isPartial && (
            <p className="mb-3 inline-flex items-center rounded-full border border-[var(--color-rose)]/40 bg-[var(--color-rose)]/10 px-3 py-1 text-xs font-medium text-[var(--color-rose)]">
              Partial connection
            </p>
          )}

          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text)] sm:text-3xl">
            {place.name}
          </h1>
          {(place.neighborhood || place.borough) && (
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {[place.neighborhood, place.borough].filter(Boolean).join(' · ')}
            </p>
          )}

          <h2 className="mt-5 text-lg font-medium text-[var(--color-text)]">
            A familiar feeling. A new story.
          </h2>

          <ul className="mt-3 space-y-2">
            {matchResult.reasons.map((reason, i) => (
              <li key={i} className="flex gap-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                <span aria-hidden="true" className="mt-1 text-[var(--color-lavender)]">
                  ·
                </span>
                {reason}
              </li>
            ))}
          </ul>

          <div className="glass mt-5 rounded-xl border border-[var(--color-border)] p-4">
            <p className="text-sm font-medium text-[var(--color-text)]">What&rsquo;s different here</p>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-text-secondary)]">
              {place.differenceNote}
            </p>
          </div>

          {isPartial && (
            <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-muted)]">
              {matchResult.limitations}
            </p>
          )}

          <div className="mt-5">
            <SourceDrawer citations={place.citations} triggerLabel="Sources & photo attribution" />
          </div>

          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => navigate('/confirm')}
              className="rounded-full border border-[var(--color-border-strong)] px-5 py-2.5 text-sm text-[var(--color-text-secondary)] transition hover:border-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            >
              Adjust my qualities
            </button>
            <button
              type="button"
              onClick={() => navigate(`/story/${place.id}`)}
              className="glass-button rounded-full border border-white/40 px-6 py-2.5 text-sm font-semibold transition"
            >
              Meet this place
            </button>
          </div>

          <p className="mt-6 text-xs text-[var(--color-text-muted)]">
            Exploring three featured NYC places in this prototype.
          </p>
        </div>
      </div>
    </section>
  )
}
