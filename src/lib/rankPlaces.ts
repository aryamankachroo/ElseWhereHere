import catalog from '@/data/places.json'

export interface ScorePlace {
  id: string
  name: string
  neighborhood?: string
  borough?: string
  lat: number
  lng: number
  tags: string[]
  free: boolean
  allDay: boolean
  start?: string
  end?: string
  clean: number
  shade: number
  local: number
  blurb: string
}

export interface ParsedPrompt {
  tags: string[]
  cost: 'free' | 'cheap' | 'either'
  local: number
  care: number | null
  window: [Date, Date] | null
  maxMinutes: number
}

const TAG_WORDS: Record<string, string[]> = {
  outdoors: ['outdoor', 'park', 'garden', 'outside', 'walk'],
  food: ['food', 'market', 'eat', 'lunch', 'farmers'],
  culture: ['music', 'event', 'show', 'culture', 'concert'],
  history: ['history', 'historic', 'old'],
  quiet: ['quiet', 'calm', 'sit', 'peaceful'],
  family: ['kid', 'kids', 'family', 'children', 'playground'],
}

export const SCORE_PLACES = catalog as ScorePlace[]

export function parsePrompt(text: string): ParsedPrompt {
  const q = (text || '').toLowerCase()
  const tags = Object.entries(TAG_WORDS)
    .filter(([, words]) => words.some((word) => q.includes(word)))
    .map(([tag]) => tag)

  let cost: ParsedPrompt['cost'] = 'free'
  if (q.includes('cheap')) cost = 'cheap'
  if (/\b(paid|ticket|either)\b/.test(q)) cost = 'either'

  let local = 1
  if (/\b(famous|tourist|landmark)\b/.test(q)) local = 0

  const care = /\b(shade|shady|air|hot)\b/.test(q) ? 1 : null
  const window = parseWindow(q)

  return { tags, cost, local, care, window, maxMinutes: 15 }
}

function parseWindow(q: string): [Date, Date] | null {
  const now = new Date()
  if (q.includes('now')) return [now, new Date(now.getTime() + 3 * 60 * 60 * 1000)]
  if (q.includes('tonight')) {
    const start = new Date(now)
    start.setHours(17, 0, 0, 0)
    const end = new Date(now)
    end.setHours(22, 0, 0, 0)
    return [start, end]
  }
  if (/\b(weekend|saturday|sunday)\b/.test(q)) {
    const start = new Date(now)
    const daysUntilSat = (6 - start.getDay() + 7) % 7
    start.setDate(start.getDate() + daysUntilSat)
    start.setHours(10, 0, 0, 0)
    const end = new Date(start)
    end.setDate(start.getDate() + 1)
    end.setHours(18, 0, 0, 0)
    return [start, end]
  }
  return null
}

export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

function timeFit(window: [Date, Date] | null, place: ScorePlace): number | null {
  if (!window) return null
  if (place.allDay) return 1
  if (!place.start || !place.end) return 0
  const [ws, we] = window.map((t) => new Date(t).getTime())
  const ps = new Date(place.start).getTime()
  const pe = new Date(place.end).getTime()
  if (ps < we && pe > ws) return 1
  const sameDay = new Date(ws).toDateString() === new Date(ps).toDateString()
  return sameDay ? 0.5 : 0
}

type PinUser = { lat: number; lng: number } & ParsedPrompt

export function scorePlace(user: PinUser, place: ScorePlace): number | null {
  const terms: Array<[number, number]> = []

  const walk = distanceMeters(user, place) / 80
  // Closer places score higher. Distance never removes a place from the list.
  const D = 1 / (1 + walk / user.maxMinutes)
  terms.push([D, 3])

  if (user.cost === 'free' && !place.free) return null
  const C = place.free || user.cost === 'either' ? 1 : 0.6
  terms.push([C, 2])

  const L = 1 - Math.abs(user.local - place.local)
  terms.push([L, 2])

  if (user.tags.length) {
    const hit = user.tags.filter((tag) => place.tags.includes(tag)).length
    terms.push([hit / user.tags.length, 3])
  }

  const T = timeFit(user.window, place)
  if (T != null) terms.push([T, 2])

  if (user.care != null) {
    terms.push([1 - user.care * (1 - place.clean), 1.5])
    terms.push([1 - user.care * (1 - place.shade), 1])
  }

  const weightSum = terms.reduce((sum, [, weight]) => sum + weight, 0)
  const raw = terms.reduce((sum, [value, weight]) => sum + value * weight, 0)
  return Math.round((raw / weightSum) * 100)
}

/** Confirm-screen qualities, mapped onto the score tags the sentence already uses. */
const QUALITY_TO_TAGS: Record<string, string[]> = {
  calm: ['quiet'],
  linger: ['quiet'],
  reading: ['quiet'],
  greenery: ['outdoors'],
  waterfront: ['outdoors'],
  'small-food-shops': ['food'],
  art: ['culture'],
  'evening-activity': [],
}

export function applyQualities(
  parsed: ParsedPrompt,
  preferences: Array<{ tag: string }>,
  droppedTags: string[],
): ParsedPrompt {
  const tags = new Set(parsed.tags)
  for (const tag of droppedTags) {
    for (const scoreTag of QUALITY_TO_TAGS[tag] ?? []) tags.delete(scoreTag)
  }
  for (const pref of preferences) {
    for (const scoreTag of QUALITY_TO_TAGS[pref.tag] ?? []) tags.add(scoreTag)
  }

  let window = parsed.window
  if (!window && preferences.some((pref) => pref.tag === 'evening-activity')) {
    const now = new Date()
    const start = new Date(now)
    start.setHours(17, 0, 0, 0)
    const end = new Date(now)
    end.setHours(22, 0, 0, 0)
    window = [start, end]
  }

  return { ...parsed, tags: [...tags], window }
}

export function explainScore(user: PinUser, place: ScorePlace): string {
  const minutes = Math.max(1, Math.round(distanceMeters(user, place) / 80))
  const parts = [`About a ${minutes}-minute walk.`]
  parts.push(place.free ? 'Free to enter.' : 'Not free, so it only stays in the list when cost is flexible.')
  if (place.local >= 0.75) parts.push('Neighbors use it more than visitors do.')
  if (user.tags.length) {
    const hit = user.tags.filter((tag) => place.tags.includes(tag))
    if (hit.length === 0) parts.push(`Asked for ${user.tags.join(' and ')}, and this place misses that, so the score drops.`)
    else parts.push(`Matches ${hit.join(' and ')}.`)
  }
  return parts.join(' ')
}

export function rankPlaces(
  pin: { lat: number; lng: number },
  prompt: string,
  places: ScorePlace[] = SCORE_PLACES,
  qualities?: { preferences?: Array<{ tag: string }>; droppedTags?: string[] },
) {
  const parsed = applyQualities(parsePrompt(prompt), qualities?.preferences ?? [], qualities?.droppedTags ?? [])
  const user: PinUser = { lat: pin.lat, lng: pin.lng, ...parsed }
  return places
    .map((place) => ({ place, score: scorePlace(user, place), user }))
    .filter((row): row is { place: ScorePlace; score: number; user: PinUser } => row.score != null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
}
