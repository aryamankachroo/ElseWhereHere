import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import { MapView } from '@/components/map/MapView'
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
  const [selectedId, setSelectedId] = useState(matchResult?.placeId ?? '')

  useEffect(() => {
    if (matchResult?.placeId) setSelectedId(matchResult.placeId)
  }, [matchResult?.placeId])

  useEffect(() => {
    if (!selectedId) return
    const requestId = ++requestIdRef.current
    setLoadState('loading')
    api
      .getPlace(selectedId)
      .then((profile) => {
        if (requestIdRef.current !== requestId) return
        setPlace(profile)
        setLoadState('ready')
      })
      .catch((err: unknown) => {
        if (requestIdRef.current !== requestId) return
        setLoadState(err instanceof NotFoundError ? 'not-found' : 'error')
      })
  }, [selectedId])

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
          className="glass-chip mt-5 rounded-full border border-white/30 px-5 py-2.5 text-sm text-[var(--color-text-secondary)] transition hover:border-white/60 hover:text-[var(--color-text)]"
        >
          Back to qualities
        </button>
      </section>
    )
  }

  if (!place) return null

  const suggestions = matchResult.suggestions ?? []
  const selectedSuggestion = suggestions.find((item) => item.placeId === place.id)
  const reasons = selectedSuggestion
    ? [selectedSuggestion.note, `Similarity score ${selectedSuggestion.score} out of 100.`]
    : matchResult.reasons
  const isPartial = selectedSuggestion ? selectedSuggestion.score < 70 : matchResult.matchLabel === 'partial connection'
  const otherSuggestions = suggestions.filter((item) => item.placeId !== place.id)

  return (
    <section className="content-max px-4 py-8 sm:px-6 lg:py-12">
      <MapView
        key={place.id}
        placeName={place.name}
        neighborhood={place.neighborhood}
        borough={place.borough}
        coordinates={place.coordinates}
        storyNodes={place.storyNodes}
        activeStoryNodeId={place.entryNodeId}
        onSelectStoryNode={() => {}}
        heightClassName="h-[320px] lg:h-[420px]"
      />
      <div className="mt-8 max-w-2xl">
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
            {reasons.map((reason, i) => (
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
              className="glass-chip rounded-full border border-white/30 px-5 py-2.5 text-sm text-[var(--color-text-secondary)] transition hover:border-white/60 hover:text-[var(--color-text)]"
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

          {otherSuggestions.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-medium text-[var(--color-text)]">Other nearby places</h2>
              <ul className="mt-3 space-y-3">
                {otherSuggestions.map((item) => (
                  <li key={item.placeId}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.placeId)}
                      className="glass w-full rounded-2xl border border-white/15 px-4 py-3 text-left transition hover:border-white/40"
                    >
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="font-medium text-[var(--color-text)]">{item.name}</span>
                        <span className="text-sm text-[var(--color-text-muted)]">{item.score}</span>
                      </span>
                      <span className="mt-1 block text-sm leading-relaxed text-[var(--color-text-secondary)]">
                        {item.note}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
