import { useEffect, useMemo, useRef, useState } from 'react'

import { MapFallbackCard } from '@/components/map/MapFallbackCard'
import type { Coordinates, StoryNode } from '@/types/api'

type MapboxModule = typeof import('mapbox-gl')
type MapboxMap = import('mapbox-gl').Map
type MapboxMarker = import('mapbox-gl').Marker

interface MapViewProps {
  placeName: string
  neighborhood?: string
  borough?: string
  coordinates: Coordinates | null
  storyNodes: StoryNode[]
  activeStoryNodeId: string
  onSelectStoryNode: (nodeId: string) => void
  heightClassName: string
}

const NYC_WIDE_VIEW: [number, number] = [-73.97, 40.72]
const NYC_WIDE_ZOOM = 10.3
const PLACE_ZOOM = 15.5

function useWebGLSupported(): boolean {
  return useMemo(() => {
    if (typeof document === 'undefined') return false
    try {
      const canvas = document.createElement('canvas')
      return Boolean(
        window.WebGLRenderingContext &&
          (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')),
      )
    } catch {
      return false
    }
  }, [])
}

function usePrefersReducedMotion(): boolean {
  return useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])
}

export function MapView({
  placeName,
  neighborhood,
  borough,
  coordinates,
  storyNodes,
  activeStoryNodeId,
  onSelectStoryNode,
  heightClassName,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const placeMarkerRef = useRef<MapboxMarker | null>(null)
  const nodeMarkersRef = useRef<Map<string, MapboxMarker>>(new Map())
  const lastFlownNodeIdRef = useRef<string | null>(null)
  const onSelectStoryNodeRef = useRef(onSelectStoryNode)
  onSelectStoryNodeRef.current = onSelectStoryNode

  const [status, setStatus] = useState<'checking' | 'ready' | 'failed'>('checking')

  const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN
  const webglSupported = useWebGLSupported()
  const prefersReducedMotion = usePrefersReducedMotion()

  const canAttemptLiveMap = Boolean(token) && coordinates !== null && webglSupported

  const verifiedNodeLocations = useMemo(
    () =>
      storyNodes.filter(
        (node): node is StoryNode & { location: { coordinates: Coordinates; verified: true } } =>
          Boolean(node.location?.verified && node.location.coordinates),
      ),
    [storyNodes],
  )

  // Initialize exactly one map instance per mount. Never recreated on story
  // node changes — see the separate effect below for camera sync.
  useEffect(() => {
    if (!canAttemptLiveMap || !containerRef.current) {
      setStatus(canAttemptLiveMap ? 'checking' : 'failed')
      return
    }

    let cancelled = false
    let resizeObserver: ResizeObserver | null = null

    async function init() {
      try {
        const [mapboxModule] = await Promise.all([
          import('mapbox-gl') as Promise<MapboxModule>,
          import('mapbox-gl/dist/mapbox-gl.css'),
        ])
        if (cancelled || !containerRef.current) return

        const mapboxgl = mapboxModule.default
        mapboxgl.accessToken = token as string

        const map = new mapboxgl.Map({
          container: containerRef.current,
          style: 'mapbox://styles/mapbox/dark-v11',
          center: NYC_WIDE_VIEW,
          zoom: NYC_WIDE_ZOOM,
          cooperativeGestures: true,
          attributionControl: true,
        })
        mapRef.current = map

        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')

        map.on('load', () => {
          if (cancelled || !coordinates) return
          const target: [number, number] = [coordinates.lng, coordinates.lat]

          if (prefersReducedMotion) {
            map.jumpTo({ center: target, zoom: PLACE_ZOOM })
          } else {
            map.flyTo({ center: target, zoom: PLACE_ZOOM, essential: true, duration: 2200 })
          }

          const marker = new mapboxgl.Marker({ color: '#f5f5f7' }).setLngLat(target).addTo(map)
          placeMarkerRef.current = marker

          for (const node of verifiedNodeLocations) {
            const nodeMarker = new mapboxgl.Marker({ color: '#8fb4e0', scale: 0.8 })
              .setLngLat([node.location.coordinates.lng, node.location.coordinates.lat])
              .addTo(map)
            nodeMarker.getElement().style.cursor = 'pointer'
            nodeMarker.getElement().setAttribute('role', 'button')
            nodeMarker.getElement().setAttribute('aria-label', `Show story step near ${node.id}`)
            nodeMarker.getElement().addEventListener('click', () => {
              onSelectStoryNodeRef.current(node.id)
            })
            nodeMarkersRef.current.set(node.id, nodeMarker)
          }

          setStatus('ready')
        })

        resizeObserver = new ResizeObserver(() => map.resize())
        resizeObserver.observe(containerRef.current)
      } catch {
        if (!cancelled) setStatus('failed')
      }
    }

    init()

    return () => {
      cancelled = true
      resizeObserver?.disconnect()

      const markers = nodeMarkersRef.current
      markers.forEach((marker) => marker.remove())
      markers.clear()

      const placeMarker = placeMarkerRef.current
      placeMarker?.remove()
      placeMarkerRef.current = null

      const mapInstance = mapRef.current
      mapInstance?.remove()
      mapRef.current = null
    }
    // Intentionally run once per mount (a new place mounts a fresh MapView
    // via React `key`); story-node changes are handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAttemptLiveMap])

  // Sync the camera (and which marker reads as "active") to the current
  // story node, without recreating the map or looping back into React state.
  useEffect(() => {
    const map = mapRef.current
    if (status !== 'ready' || !map) return
    if (lastFlownNodeIdRef.current === activeStoryNodeId) return

    const node = verifiedNodeLocations.find((n) => n.id === activeStoryNodeId)
    if (node) {
      const target: [number, number] = [node.location.coordinates.lng, node.location.coordinates.lat]
      if (prefersReducedMotion) {
        map.jumpTo({ center: target, zoom: PLACE_ZOOM })
      } else {
        map.flyTo({ center: target, zoom: PLACE_ZOOM, essential: true, duration: 1400 })
      }
    }
    // If the active node has no verified location, preserve the current map view.
    lastFlownNodeIdRef.current = activeStoryNodeId
  }, [activeStoryNodeId, status, verifiedNodeLocations, prefersReducedMotion])

  function handleRecenter() {
    const map = mapRef.current
    if (!map || !coordinates) return
    const target: [number, number] = [coordinates.lng, coordinates.lat]
    if (prefersReducedMotion) {
      map.jumpTo({ center: target, zoom: PLACE_ZOOM })
    } else {
      map.flyTo({ center: target, zoom: PLACE_ZOOM, essential: true, duration: 1200 })
    }
  }

  if (!canAttemptLiveMap || status === 'failed') {
    const reason =
      status === 'failed'
        ? 'The live map failed to load — this can happen offline or without WebGL support.'
        : !token
          ? 'A live map isn\u2019t configured for this build yet (no Mapbox token supplied).'
          : coordinates === null
            ? 'This sample profile doesn\u2019t have a verified location yet, so no map is shown.'
            : 'A live map isn\u2019t available in this browser.'

    return (
      <MapFallbackCard
        placeName={placeName}
        neighborhood={neighborhood}
        borough={borough}
        reason={reason}
        heightClassName={heightClassName}
      />
    )
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-[var(--color-border)] ${heightClassName}`}>
      <div ref={containerRef} className="h-full w-full" />
      <button
        type="button"
        onClick={handleRecenter}
        className="absolute bottom-3 left-3 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface)]/90 px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] backdrop-blur transition hover:text-[var(--color-text)]"
      >
        Recenter
      </button>
    </div>
  )
}
