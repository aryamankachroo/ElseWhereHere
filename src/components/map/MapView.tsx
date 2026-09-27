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
const REROUTE_METERS = 75

function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}

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
  const userMarkerRef = useRef<MapboxMarker | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const lastRoutedRef = useRef<{ lat: number; lng: number } | null>(null)
  const onSelectStoryNodeRef = useRef(onSelectStoryNode)
  const activeStoryNodeIdRef = useRef(activeStoryNodeId)
  onSelectStoryNodeRef.current = onSelectStoryNode
  activeStoryNodeIdRef.current = activeStoryNodeId

  const [status, setStatus] = useState<'checking' | 'ready' | 'failed'>('checking')
  const [locationAsk, setLocationAsk] = useState<'prompt' | 'requesting' | 'failed' | 'hidden'>('prompt')
  const [locationError, setLocationError] = useState<string | null>(null)
  const [routeNote, setRouteNote] = useState<string | null>(null)

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
          lastFlownNodeIdRef.current = activeStoryNodeIdRef.current

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
      userMarkerRef.current?.remove()
      userMarkerRef.current = null
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }

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

  async function allowLocation() {
    if (!coordinates || !token || !mapRef.current) return
    if (!navigator.geolocation) {
      setLocationAsk('hidden')
      setRouteNote('Directions need location access, and this browser cannot share a location.')
      return
    }
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    lastRoutedRef.current = null
    setLocationAsk('requesting')

    const mapboxglPromise = import('mapbox-gl')
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const origin = { lat: position.coords.latitude, lng: position.coords.longitude }
        const map = mapRef.current
        if (!map) return
        try {
          const mapboxgl = (await mapboxglPromise).default
          if (!userMarkerRef.current) {
            const you = new mapboxgl.Marker({ color: '#111111' }).setLngLat([origin.lng, origin.lat]).addTo(map)
            you.getElement().setAttribute('aria-label', 'Your location')
            userMarkerRef.current = you
          } else {
            userMarkerRef.current.setLngLat([origin.lng, origin.lat])
          }

          const last = lastRoutedRef.current
          const shouldReroute = !last || metersBetween(last, origin) >= REROUTE_METERS
          if (shouldReroute) {
            const url =
              `https://api.mapbox.com/directions/v5/mapbox/walking/` +
              `${origin.lng},${origin.lat};${coordinates.lng},${coordinates.lat}` +
              `?geometries=geojson&overview=full&access_token=${encodeURIComponent(token)}`
            const response = await fetch(url)
            if (!response.ok) throw new Error('directions failed')
            const body = (await response.json()) as {
              routes?: Array<{
                duration: number
                distance: number
                geometry: { type: 'LineString'; coordinates: [number, number][] }
              }>
            }
            const route = body.routes?.[0]
            if (!route) throw new Error('no route')

            const existing = map.getSource('eh-route') as import('mapbox-gl').GeoJSONSource | undefined
            const data = {
              type: 'Feature' as const,
              properties: {},
              geometry: route.geometry,
            }
            if (existing) {
              existing.setData(data)
            } else {
              map.addSource('eh-route', { type: 'geojson', data })
              map.addLayer({
                id: 'eh-route',
                type: 'line',
                source: 'eh-route',
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: { 'line-color': '#f5f5f7', 'line-width': 4, 'line-opacity': 0.9 },
              })
            }

            if (!last) {
              const bounds = new mapboxgl.LngLatBounds()
              bounds.extend([origin.lng, origin.lat])
              bounds.extend([coordinates.lng, coordinates.lat])
              map.fitBounds(bounds, { padding: 56, duration: prefersReducedMotion ? 0 : 900 })
            }
            lastRoutedRef.current = origin

            const minutes = Math.max(1, Math.round(route.duration / 60))
            const miles = route.distance / 1609.34
            const distanceLabel = miles < 0.1 ? `${Math.round(route.distance * 3.28084)} ft` : `${miles.toFixed(1)} mi`
            setRouteNote(`${minutes} min walk · ${distanceLabel}`)
          } else {
            const view = map.getBounds()
            if (view && !view.contains([origin.lng, origin.lat])) {
              map.panTo([origin.lng, origin.lat], { duration: prefersReducedMotion ? 0 : 600 })
            }
          }

          setLocationAsk('hidden')
        } catch {
          setLocationAsk('hidden')
          setRouteNote('Directions could not be loaded. Your location is still updating on the map.')
        }
      },
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? 'The browser blocked location. Click the lock icon in the address bar, set Location to Allow, then try again.'
            : error.code === error.TIMEOUT
              ? 'Finding your location timed out. Try again. On a Mac, Location Services also has to be on for this browser.'
              : 'This browser could not find your location. On a Mac, turn on Location Services for this browser in System Settings, then try again.'
        setLocationError(message)
        setLocationAsk('failed')
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 },
    )
  }

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
    <div>
      <div className={`relative overflow-hidden rounded-3xl border border-white/20 ${heightClassName}`}>
        <div ref={containerRef} className="h-full w-full" />
        {status === 'ready' && locationAsk !== 'hidden' && (
          <div
            role="dialog"
            aria-labelledby="location-prompt-title"
            className="glass absolute inset-x-3 bottom-3 z-10 rounded-2xl border border-white/25 p-4 sm:inset-x-auto sm:right-3 sm:w-80"
          >
            <p id="location-prompt-title" className="text-sm font-medium text-[var(--color-text)]">
              {locationAsk === 'failed'
                ? locationError
                : 'Use your location to show walking directions to this place?'}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={allowLocation}
                disabled={locationAsk === 'requesting'}
                className="glass-button rounded-full border border-white/40 px-4 py-1.5 text-xs font-semibold transition disabled:opacity-60"
              >
                {locationAsk === 'requesting' ? 'Asking…' : locationAsk === 'failed' ? 'Try again' : 'Allow'}
              </button>
              <button
                type="button"
                onClick={() => setLocationAsk('hidden')}
                className="glass-chip rounded-full border border-white/30 px-4 py-1.5 text-xs text-[var(--color-text-secondary)] transition hover:text-[var(--color-text)]"
              >
                Not now
              </button>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={handleRecenter}
          className="glass-chip absolute left-3 top-3 rounded-full border border-white/30 px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition hover:text-[var(--color-text)]"
        >
          Recenter
        </button>
      </div>
      {routeNote && <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{routeNote}</p>}
    </div>
  )
}
