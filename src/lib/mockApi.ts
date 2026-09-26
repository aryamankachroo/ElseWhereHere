import { FIXTURE_MATCH_TAGS, PLACE_FIXTURES, getFixtureById, toPlaceSummary } from '@/data/fixtures'
import { getTagLabel } from '@/data/qualityTags'
import type {
  AskResponse,
  ElsewhereHereApi,
  InterpretResponse,
  MatchResponse,
  PlaceProfile,
  PlaceSummary,
  Preference,
} from '@/types/api'
import { NotFoundError } from '@/types/api'

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

const STRONG_MATCH_THRESHOLD = 0.55

function importanceMultiplier(importance: 1 | 2): number {
  return importance === 2 ? 1.5 : 1
}

function scoreFixture(preferences: Preference[], placeId: string): number {
  const weights = FIXTURE_MATCH_TAGS[placeId] ?? []
  const weightByTag = new Map(weights.map((w) => [w.tag, w.weight]))
  return preferences.reduce((sum, pref) => {
    const weight = weightByTag.get(pref.tag) ?? 0
    return sum + weight * pref.target * importanceMultiplier(pref.importance)
  }, 0)
}

function maxPossibleScore(preferences: Preference[]): number {
  return preferences.reduce((sum, pref) => sum + 1 * pref.target * importanceMultiplier(pref.importance), 0)
}

async function match(preferences: Preference[]): Promise<MatchResponse> {
  await delay(900)
  if (shouldSimulateError()) {
    throw new Error('Simulated match failure for testing.')
  }
  if (preferences.length === 0) {
    throw new Error('At least one confirmed quality is required to find a connection.')
  }

  const scored = PLACE_FIXTURES.map((fixture) => ({
    fixture,
    score: scoreFixture(preferences, fixture.id),
  })).sort((a, b) => b.score - a.score)

  const winner = scored[0]
  const alternatives = scored.slice(1).map((s) => s.fixture.id)

  const possible = maxPossibleScore(preferences)
  const ratio = possible > 0 ? winner.score / possible : 0
  const matchLabel = ratio >= STRONG_MATCH_THRESHOLD ? 'strong connection' : 'partial connection'

  const winnerWeights = new Map((FIXTURE_MATCH_TAGS[winner.fixture.id] ?? []).map((w) => [w.tag, w.weight]))

  const contributingTags = [...preferences]
    .map((pref) => ({ pref, weight: winnerWeights.get(pref.tag) ?? 0 }))
    .filter((entry) => entry.weight >= 0.4)
    .sort((a, b) => b.weight * b.pref.target - a.weight * a.pref.target)
    .slice(0, 3)

  const reasons =
    contributingTags.length > 0
      ? contributingTags.map((entry) => {
          const label = getTagLabel(entry.pref.tag).toLowerCase()
          return `You mentioned ${label}, and this pocket leans into that too.`
        })
      : [`This is the closest available match among three sample pockets in this prototype.`]

  const weakTags = preferences
    .map((pref) => ({ pref, weight: winnerWeights.get(pref.tag) ?? 0 }))
    .filter((entry) => entry.weight < 0.3)
    .map((entry) => getTagLabel(entry.pref.tag).toLowerCase())

  const limitations =
    weakTags.length > 0
      ? `This pocket doesn't strongly reflect ${weakTags.join(', ')} — treat this as a partial starting point, not a complete match.`
      : 'Every confirmed quality shows up here to some degree in this sample profile.'

  return {
    placeId: winner.fixture.id,
    reasons,
    limitations,
    matchLabel,
    alternatives,
    citations: [],
  }
}

// ---------------------------------------------------------------------------
// listPlaces / getPlace
// ---------------------------------------------------------------------------

async function listPlaces(): Promise<PlaceSummary[]> {
  await delay(300)
  if (shouldSimulateError()) {
    throw new Error('Simulated listPlaces failure for testing.')
  }
  return PLACE_FIXTURES.map(toPlaceSummary)
}

async function getPlace(placeId: string): Promise<PlaceProfile> {
  await delay(400)
  if (shouldSimulateError()) {
    throw new Error('Simulated getPlace failure for testing.')
  }
  const fixture = getFixtureById(placeId)
  if (!fixture) {
    throw new NotFoundError(`No sample place found for id "${placeId}".`)
  }
  return fixture
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
