import type {
  AskResponse,
  ElsewhereHereApi,
  InterpretResponse,
  MatchContext,
  MatchResponse,
  PlaceProfile,
  PlaceSummary,
  Preference,
} from '@/types/api'
import { ApiError, NotFoundError } from '@/types/api'

/**
 * Live adapter — talks to the future FastAPI backend. Not exercised during
 * the mock-first UI build, but kept shape-compatible with `mockApi.ts` so
 * swapping `VITE_USE_MOCK_API` is the only change required later.
 *
 * Uses relative URLs unless `VITE_API_BASE_URL` supplies a public backend
 * origin. Never falls back to mock data on failure — a failed live call
 * surfaces as an error to the caller.
 */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

function url(path: string): string {
  return `${BASE_URL}${path}`
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(url(path), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    })
  } catch (error) {
    throw new ApiError(
      `Network error while calling ${path}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  if (response.status === 404) {
    let message = `Resource not found: ${path}`
    try {
      const body = (await response.json()) as { detail?: unknown }
      if (typeof body.detail === 'string' && body.detail) message = body.detail
    } catch {
      // keep the path message
    }
    throw new NotFoundError(message)
  }

  if (!response.ok) {
    let detail = ''
    try {
      detail = await response.text()
    } catch {
      // ignore
    }
    throw new ApiError(`Request to ${path} failed with status ${response.status}. ${detail}`, response.status)
  }

  return (await response.json()) as T
}

async function interpret(text: string): Promise<InterpretResponse> {
  return request<InterpretResponse>('/api/v1/interpret', {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
}

async function match(preferences: Preference[], context: MatchContext): Promise<MatchResponse> {
  return request<MatchResponse>('/api/v1/match', {
    method: 'POST',
    body: JSON.stringify({
      preferences,
      droppedTags: context.droppedTags,
      text: context.text,
      lat: context.lat,
      lng: context.lng,
    }),
  })
}

async function listPlaces(): Promise<PlaceSummary[]> {
  return request<PlaceSummary[]>('/api/v1/places', { method: 'GET' })
}

async function getPlace(placeId: string): Promise<PlaceProfile> {
  return request<PlaceProfile>(`/api/v1/places/${encodeURIComponent(placeId)}`, { method: 'GET' })
}

async function ask(
  placeId: string,
  storyNodeId: string,
  question: string,
  previousQuestion?: string,
): Promise<AskResponse> {
  return request<AskResponse>('/api/v1/ask', {
    method: 'POST',
    body: JSON.stringify({ placeId, storyNodeId, question, previousQuestion }),
  })
}

export const liveApi: ElsewhereHereApi = {
  interpret,
  match,
  listPlaces,
  getPlace,
  ask,
}
