import { ChevronDown, ChevronUp } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { QAPanel } from '@/components/QAPanel'
import { SourceDrawer } from '@/components/SourceDrawer'
import { MapView } from '@/components/map/MapView'
import { useFlow } from '@/context/FlowContext'
import { api, isGrokEnabled } from '@/lib/api'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { NotFoundError, type Citation, type PlaceProfile, type StoryChoice } from '@/types/api'

type LoadState = 'loading' | 'ready' | 'not-found' | 'error'

function resolveCitations(all: Citation[], ids: string[]): Citation[] {
  return all.filter((c) => ids.includes(c.id))
}

export function StoryMapPage() {
  const { placeId } = useParams<{ placeId: string }>()
  const flow = useFlow()
  const navigate = useNavigate()
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const [place, setPlace] = useState<PlaceProfile | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const [mapExpanded, setMapExpanded] = useState(false)
  const [foundSources, setFoundSources] = useState<Citation[]>([])
  const [sourceNote, setSourceNote] = useState<string | null>(null)
  const [findingSources, setFindingSources] = useState(false)
  const requestIdRef = useRef(0)

  useEffect(() => {
    if (!placeId) return
    const requestId = ++requestIdRef.current
    setLoadState('loading')
    setFoundSources([])
    setSourceNote(null)
    setFindingSources(false)

    api
      .getPlace(placeId)
      .then((profile) => {
        if (requestIdRef.current !== requestId) return
        setPlace(profile)
        flow.setActivePlace(profile.id)

        const canResume =
          flow.activePlaceId === profile.id &&
          flow.activeStoryNodeId !== null &&
          profile.storyNodes.some((n) => n.id === flow.activeStoryNodeId)
        const startNodeId = canResume ? (flow.activeStoryNodeId as string) : profile.entryNodeId

        setActiveNodeId(startNodeId)
        setHistory([])
        setLoadState('ready')
      })
      .catch((err: unknown) => {
        if (requestIdRef.current !== requestId) return
        setLoadState(err instanceof NotFoundError ? 'not-found' : 'error')
      })
    // Only re-run when the URL's placeId actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeId])

  const activeNode = useMemo(
    () => place?.storyNodes.find((n) => n.id === activeNodeId) ?? null,
    [place, activeNodeId],
  )

  const entryNode = useMemo(() => {
    if (!place) return null
    return place.storyNodes.find((n) => n.id === place.entryNodeId) ?? null
  }, [place])

  const siblingBranchChoice: StoryChoice | null = useMemo(() => {
    if (!activeNode || activeNode.kind !== 'branch' || !entryNode?.choices) return null
    return entryNode.choices.find((c) => c.nextNodeId !== activeNode.id) ?? null
  }, [activeNode, entryNode])

  function goToNode(nodeId: string) {
    if (!activeNodeId || nodeId === activeNodeId) return
    setHistory((prev) => [...prev, activeNodeId])
    setActiveNodeId(nodeId)
    flow.setActiveStoryNode(nodeId)
  }

  function findSources() {
    if (!place) return
    const requestId = requestIdRef.current
    setFindingSources(true)
    setSourceNote(null)
    api
      .findSources(place.id, { name: place.name, neighborhood: place.neighborhood, borough: place.borough })
      .then((res) => {
        if (requestIdRef.current !== requestId) return
        setFoundSources(res.citations)
        setSourceNote([res.summary, res.message].filter(Boolean).join(' ') || null)
      })
      .catch(() => {
        if (requestIdRef.current !== requestId) return
        setSourceNote("Couldn't reach Grok. Check that the API server is running, then try again.")
      })
      .finally(() => {
        if (requestIdRef.current === requestId) setFindingSources(false)
      })
  }

  function handleBack() {
    setHistory((prev) => {
      if (prev.length === 0) return prev
      const prevNodeId = prev[prev.length - 1]
      setActiveNodeId(prevNodeId)
      flow.setActiveStoryNode(prevNodeId)
      return prev.slice(0, -1)
    })
  }

  if (loadState === 'loading') {
    return (
      <section className="content-max px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-[var(--color-text-muted)]">Loading this place…</p>
      </section>
    )
  }

  if (loadState === 'not-found' || loadState === 'error' || !place || !activeNode) {
    return (
      <section className="content-max px-4 py-16 text-center sm:px-6">
        <p className="text-base text-[var(--color-text-secondary)]">
          {loadState === 'not-found'
            ? "We couldn't find that place profile."
            : 'Something went wrong loading this story.'}
        </p>
        <button
          type="button"
          onClick={() => navigate('/start')}
          className="glass-chip mt-5 rounded-full border border-white/30 px-5 py-2.5 text-sm text-[var(--color-text-secondary)] transition hover:border-white/60 hover:text-[var(--color-text)]"
        >
          Start over
        </button>
      </section>
    )
  }

  const titleBlock: ReactNode = (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text)] sm:text-3xl">
        {place.name}
      </h1>
      {(place.neighborhood || place.borough) && (
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {[place.neighborhood, place.borough].filter(Boolean).join(' · ')}
        </p>
      )}
      <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">{place.description}</p>
    </div>
  )

  const nodeCitations = resolveCitations(place.citations, activeNode.citationIds)

  const storyBlock: ReactNode = (
    <div className="glass rounded-3xl border border-white/20 p-5 sm:p-6">
      <p className="text-sm leading-relaxed text-[var(--color-text-secondary)] sm:text-base">
        {activeNode.text}
      </p>

      <div className="mt-3">
        <SourceDrawer
          citations={nodeCitations.length > 0 ? nodeCitations : foundSources}
          triggerLabel="Sources for this part"
          onFindSources={isGrokEnabled && nodeCitations.length === 0 ? findSources : undefined}
          finding={findingSources}
          note={nodeCitations.length > 0 ? null : sourceNote}
        />
      </div>

      {activeNode.choices && activeNode.choices.length >= 2 && (
        <div className="mt-5">
          <p className="text-sm font-medium text-[var(--color-text)]">
            {activeNode.question ?? 'What catches your eye?'}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {activeNode.choices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                onClick={() => goToNode(choice.nextNodeId)}
                className="glass-chip rounded-full border border-white/30 px-4 py-2 text-sm text-[var(--color-text)] transition hover:border-white/60"
              >
                {choice.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {activeNode.choices && activeNode.choices.length === 1 && (
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => goToNode(activeNode.choices![0].nextNodeId)}
            className="glass-button rounded-full border border-white/40 px-5 py-2 text-sm font-semibold transition"
          >
            {activeNode.choices[0].label}
          </button>
          {siblingBranchChoice && (
            <button
              type="button"
              onClick={() => goToNode(siblingBranchChoice.nextNodeId)}
              className="text-sm text-[var(--color-text-secondary)] underline underline-offset-2 transition hover:text-[var(--color-text)]"
            >
              Explore the other branch instead
            </button>
          )}
        </div>
      )}

      {activeNode.kind === 'closing' && activeNode.externalMapUrl && (
        <a
          href={activeNode.externalMapUrl}
          target="_blank"
          rel="noreferrer"
          className="glass-chip mt-5 inline-block rounded-full border border-white/30 px-4 py-2 text-sm text-[var(--color-text)] transition hover:border-white/60"
        >
          Open this place in an external map
        </a>
      )}

      {history.length > 0 && (
        <button
          type="button"
          onClick={handleBack}
          className="mt-5 block text-sm text-[var(--color-text-muted)] underline underline-offset-2 transition hover:text-[var(--color-text-secondary)]"
        >
          Back to previous story step
        </button>
      )}
    </div>
  )

  const qaBlock: ReactNode = (
    <QAPanel
      placeId={place.id}
      activeStoryNodeId={activeNode.id}
      suggestedQuestions={place.suggestedQuestions}
      citations={place.citations}
      place={{ name: place.name, neighborhood: place.neighborhood, borough: place.borough }}
    />
  )

  const mapEl = (
    <MapView
      key={place.id}
      placeName={place.name}
      neighborhood={place.neighborhood}
      borough={place.borough}
      coordinates={place.coordinates}
      storyNodes={place.storyNodes}
      activeStoryNodeId={activeNode.id}
      onSelectStoryNode={goToNode}
      heightClassName={isDesktop ? 'h-[560px]' : mapExpanded ? 'h-[420px]' : 'h-[240px]'}
    />
  )

  return (
    <section className="content-max px-4 py-6 sm:px-6 lg:py-10">
      {isDesktop ? (
        <div className="grid grid-cols-[1.15fr_0.85fr] items-start gap-8">
          <div className="space-y-6">
            {titleBlock}
            {storyBlock}
            {qaBlock}
          </div>
          <div className="sticky top-[calc(5rem+env(safe-area-inset-top))]">{mapEl}</div>
        </div>
      ) : (
        <div className="space-y-5">
          {titleBlock}

          <div>
            {mapEl}
            <button
              type="button"
              aria-expanded={mapExpanded}
              onClick={() => setMapExpanded((v) => !v)}
              className="mt-2 flex items-center gap-1 text-xs text-[var(--color-text-muted)] transition hover:text-[var(--color-text-secondary)]"
            >
              {mapExpanded ? 'Show less map' : 'Show more map'}
              {mapExpanded ? (
                <ChevronUp size={13} aria-hidden="true" />
              ) : (
                <ChevronDown size={13} aria-hidden="true" />
              )}
            </button>
          </div>

          {storyBlock}
          {qaBlock}
        </div>
      )}
    </section>
  )
}
