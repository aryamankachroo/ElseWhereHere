import { PLACE_FIXTURES, getFixtureById, toPlaceSummary } from '@/data/fixtures'
import type {
  AskResponse,
  ElsewhereHereApi,
  InterpretResponse,
  MatchContext,
  MatchResponse,
  MatchSuggestion,
  PlaceProfile,
  PlaceSummary,
  Preference,
} from '@/types/api'
import { NotFoundError } from '@/types/api'
import { SCORE_PLACES, explainScore, rankPlaces, type ScorePlace } from '@/lib/rankPlaces'

/**
 * Mock adapter — fully local, deterministic, and clearly labeled as sample
 * behavior. This is a stand-in for a future FastAPI backend; it deliberately
 * never fabricates citations, invented history, or resident testimony.
 */

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Debug-only affordance so failure/retry UI can be verified deterministically. */
function shouldSimulateError(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('simulateError') === '1'
}

// ---------------------------------------------------------------------------
// interpret
// ---------------------------------------------------------------------------

interface KeywordRule {
  tag: string
  keywords: string[]
}

const KEYWORD_RULES: KeywordRule[] = [
  { tag: 'calm', keywords: ['quiet', 'calm', 'peaceful', 'still', 'tranquil'] },
  { tag: 'greenery', keywords: ['garden', 'green', 'plant', 'park', 'tree', 'nature'] },
  { tag: 'reading', keywords: ['read', 'book', 'browse', 'library'] },
  {
    tag: 'linger',
    keywords: ['linger', 'no rush', 'in a hurry', 'slow pace', 'unhurried'],
  },
  { tag: 'lively', keywords: ['lively', 'busy', 'bustling', 'buzzing', 'vibrant', 'street'] },
  {
    tag: 'small-food-shops',
    keywords: ['food shop', 'food shops', 'little food', 'small food', 'snack', 'market', 'deli', 'bakery'],
  },
  { tag: 'evening-activity', keywords: ['evening', 'night', 'after dark', 'dusk'] },
  { tag: 'art', keywords: ['art', 'mural', 'gallery', 'paint', 'sculpture'] },
  {
    tag: 'independent-shops',
    keywords: ['independent shop', 'indie shop', 'small shop', 'boutique', 'shops', 'corner store'],
  },
  { tag: 'waterfront', keywords: ['water', 'river', 'waterfront', 'harbor', 'pier', 'sea', 'canal'] },
]

function interpretKeywords(text: string): string[] {
  const normalized = text.toLowerCase()
  const matchedTags: string[] = []
  for (const rule of KEYWORD_RULES) {
    const hit = rule.keywords.some((kw) => normalized.includes(kw))
    if (hit && !matchedTags.includes(rule.tag)) {
      matchedTags.push(rule.tag)
    }
  }
  return matchedTags
}

async function interpret(text: string): Promise<InterpretResponse> {
  await delay(500)
  if (shouldSimulateError()) {
    throw new Error('Simulated interpret failure for testing.')
  }

  const trimmed = text.trim()
  const matchedTagIds = interpretKeywords(trimmed)

  if (matchedTagIds.length === 0) {
    return {
      preferences: [],
      needsClarification: true,
      clarificationQuestion: 'What do you love about it?',
      mode: 'mock',
    }
  }

  const preferences: Preference[] = matchedTagIds.map((tag, index) => ({
    tag,
    target: 0.8,
    importance: index < 2 ? 2 : 1,
  }))

  return {
    preferences,
    needsClarification: false,
    mode: 'mock',
  }
}

// ---------------------------------------------------------------------------
// match
// ---------------------------------------------------------------------------

async function match(preferences: Preference[], context: MatchContext): Promise<MatchResponse> {
  await delay(900)
  if (shouldSimulateError()) {
    throw new Error('Simulated match failure for testing.')
  }
  if (preferences.length === 0) {
    throw new Error('At least one confirmed quality is required to find a connection.')
  }

  const ranked = rankPlaces({ lat: context.lat, lng: context.lng }, context.text, SCORE_PLACES, {
    preferences,
    droppedTags: context.droppedTags,
  })
  const winner = ranked[0]
  if (!winner) {
    throw new Error('Nothing free in the current list is within a 15-minute walk of you. Mention cheap or paid if a ticket is fine.')
  }

  const suggestions: MatchSuggestion[] = ranked.map((row) => ({
    placeId: row.place.id,
    name: row.place.name,
    neighborhood: row.place.neighborhood,
    borough: row.place.borough,
    score: row.score,
    note: explainScore(row.user, row.place),
  }))

  return {
    placeId: winner.place.id,
    reasons: [suggestions[0].note, `Similarity score ${winner.score} out of 100.`],
    limitations:
      winner.score >= 70
        ? 'Distance, cost, and localness all counted. A miss on a requested quality lowers the score and still leaves the place on the list.'
        : 'This is the closest place within a 15-minute walk. The request did not line up fully, so the score stays partial.',
    matchLabel: winner.score >= 70 ? 'strong connection' : 'partial connection',
    alternatives: suggestions.slice(1).map((row) => row.placeId),
    suggestions,
    citations: [],
  }
}

// ---------------------------------------------------------------------------
// listPlaces / getPlace
// ---------------------------------------------------------------------------

function illustrationFor(place: ScorePlace): PlaceProfile['illustration'] {
  if (place.tags.includes('food')) return 'street'
  if (place.tags.includes('culture') || place.tags.includes('history')) return 'gallery'
  return 'garden'
}

function profileFromScorePlace(place: ScorePlace): PlaceProfile {
  return {
    id: place.id,
    name: place.name,
    neighborhood: place.neighborhood ?? 'New York',
    borough: place.borough ?? 'New York',
    coordinates: { lat: place.lat, lng: place.lng },
    illustration: illustrationFor(place),
    imageAttribution: 'Map location for this prototype. Not a reviewed photograph.',
    description: place.blurb,
    differenceNote: place.blurb,
    entryNodeId: `${place.id}-intro`,
    storyNodes: [
      {
        id: `${place.id}-intro`,
        kind: 'intro',
        text: place.blurb,
        location: {
          coordinates: { lat: place.lat, lng: place.lng },
          label: place.name,
          verified: true,
        },
        citationIds: [],
      },
    ],
    citations: [],
    contentVersion: 'score-v1',
    isSample: true,
    suggestedQuestions: [],
  }
}

function summaryFromScorePlace(place: ScorePlace): PlaceSummary {
  return {
    id: place.id,
    name: place.name,
    neighborhood: place.neighborhood,
    borough: place.borough,
    illustration: illustrationFor(place),
    imageAttribution: 'Map location for this prototype. Not a reviewed photograph.',
    isSample: true,
  }
}

async function listPlaces(): Promise<PlaceSummary[]> {
  await delay(300)
  if (shouldSimulateError()) {
    throw new Error('Simulated listPlaces failure for testing.')
  }
  const known = new Set(PLACE_FIXTURES.map((fixture) => fixture.id))
  return [
    ...PLACE_FIXTURES.map(toPlaceSummary),
    ...SCORE_PLACES.filter((place) => !known.has(place.id)).map(summaryFromScorePlace),
  ]
}

async function getPlace(placeId: string): Promise<PlaceProfile> {
  await delay(400)
  if (shouldSimulateError()) {
    throw new Error('Simulated getPlace failure for testing.')
  }
  const fixture = getFixtureById(placeId)
  if (fixture) return fixture
  const scored = SCORE_PLACES.find((place) => place.id === placeId)
  if (!scored) {
    throw new NotFoundError(`No sample place found for id "${placeId}".`)
  }
  return profileFromScorePlace(scored)
}

// ---------------------------------------------------------------------------
// ask
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'is',
  'are',
  'was',
  'were',
  'this',
  'that',
  'of',
  'to',
  'in',
  'on',
  'for',
  'and',
  'or',
  'it',
  'do',
  'does',
  'did',
  'what',
  'who',
  'how',
  'why',
  'when',
  'where',
  'like',
  'ever',
  'up',
])

function significantWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word)),
  )
}

function overlapRatio(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let shared = 0
  for (const word of a) {
    if (b.has(word)) shared += 1
  }
  return shared / Math.min(a.size, b.size)
}

async function ask(
  placeId: string,
  _storyNodeId: string,
  question: string,
  _previousQuestion?: string,
): Promise<AskResponse> {
  await delay(700)
  if (shouldSimulateError()) {
    throw new Error('Simulated ask failure for testing.')
  }

  const fixture = getFixtureById(placeId)
  if (!fixture) {
    throw new NotFoundError(`No sample place found for id "${placeId}".`)
  }

  const questionWords = significantWords(question)
  let best: { answer: string; ratio: number } | null = null
  for (const sample of fixture.sampleAnswers) {
    const ratio = overlapRatio(questionWords, significantWords(sample.question))
    if (ratio > 0 && (!best || ratio > best.ratio)) {
      best = { answer: sample.answer, ratio }
    }
  }

  if (best && best.ratio >= 0.34) {
    return {
      status: 'answered',
      claims: [{ text: best.answer, citationIds: [] }],
      citationIds: [],
      message: 'Sample answer for this prototype — not a verified source.',
    }
  }

  return {
    status: 'insufficient-evidence',
    claims: [],
    citationIds: [],
    message: "Our current sources don't answer that yet.",
  }
}

export const mockApi: ElsewhereHereApi = {
  interpret,
  match,
  listPlaces,
  getPlace,
  ask,
}
