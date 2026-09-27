/**
 * Shared types for the Elsewhere Here service boundary.
 *
 * These mirror the backend contracts in section 7 of the rebuild brief so the
 * mock and future live adapters can be swapped without touching UI code.
 */

/** How strongly a confirmed quality should count toward matching. */
export type Importance = 1 | 2

/** A confirmed quality, ready to send to the matching service. */
export interface Preference {
  /** Stable tag id (never the display label). */
  tag: string
  /** Target strength of this quality, 0 to 1. */
  target: number
  importance: Importance
}

/** A quality a user can add during confirmation, independent of display copy. */
export interface QualityTagDef {
  id: string
  label: string
  category: string
}

export type InterpretMode = 'mock' | 'live'

export interface InterpretResponse {
  preferences: Preference[]
  needsClarification: boolean
  clarificationQuestion?: string
  mode: InterpretMode
}

export interface Citation {
  id: string
  title: string
  publisher: string
  detail: string
  url?: string
}

export type MatchLabel = 'strong connection' | 'partial connection'

/** One scored place. The note explains the score and does not choose the order. */
export interface MatchSuggestion {
  placeId: string
  name: string
  neighborhood?: string
  borough?: string
  score: number
  note: string
}

export interface MatchResponse {
  placeId: string
  reasons: string[]
  limitations: string
  matchLabel: MatchLabel
  alternatives: string[]
  suggestions: MatchSuggestion[]
  citations: Citation[]
}

/**
 * Illustrative art keys used to render an original, locally-drawn SVG
 * illustration for a place. Prototype fixtures never hotlink to third-party
 * photographs whose reuse rights haven't been reviewed.
 */
export type IllustrationVariant = 'garden' | 'street' | 'gallery'

export interface PlaceSummary {
  id: string
  name: string
  neighborhood?: string
  borough?: string
  illustration: IllustrationVariant
  imageAttribution: string
  isSample: true
}

export interface Coordinates {
  lng: number
  lat: number
}

export interface StoryLocation {
  coordinates: Coordinates | null
  label?: string
  verified: boolean
}

export interface StoryChoice {
  id: string
  label: string
  nextNodeId: string
}

export type StoryNodeKind = 'intro' | 'branch' | 'closing'

export interface StoryNode {
  id: string
  kind: StoryNodeKind
  text: string
  illustration?: IllustrationVariant
  photoAttribution?: string
  question?: string
  choices?: StoryChoice[]
  location?: StoryLocation
  citationIds: string[]
  /** Present only on closing nodes when a verified external map link exists. */
  externalMapUrl?: string
}

export interface PlaceProfile {
  id: string
  name: string
  neighborhood?: string
  borough?: string
  coordinates: Coordinates | null
  illustration: IllustrationVariant
  imageAttribution: string
  description: string
  differenceNote: string
  entryNodeId: string
  storyNodes: StoryNode[]
  citations: Citation[]
  contentVersion: string
  isSample: true
  suggestedQuestions: string[]
}

export type AskStatus = 'pending' | 'answered' | 'insufficient-evidence' | 'error'

export interface AskClaim {
  text: string
  citationIds: string[]
}

export interface AskResponse {
  status: AskStatus
  claims: AskClaim[]
  citationIds: string[]
  /** Sources found for this answer that aren't part of the place profile (e.g. Grok web search). */
  citations?: Citation[]
  message?: string
}

/** One earlier turn of the place chat, sent so follow-up questions keep context. */
export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

/** Name and area of the place, so the answer service can work for places it doesn't store. */
export interface PlaceContext {
  name: string
  neighborhood?: string
  borough?: string
}

export interface AskOptions {
  history?: ChatTurn[]
  place?: PlaceContext
}

export interface SourcesResponse {
  summary: string
  citations: Citation[]
  message?: string
}

/** Pin and sentence used by the similarity score. */
export interface MatchContext {
  text: string
  lat: number
  lng: number
  /** Qualities the user removed on the confirm screen. */
  droppedTags: string[]
}

/** The typed service boundary implemented by both the mock and live adapters. */
export interface ElsewhereHereApi {
  interpret(text: string): Promise<InterpretResponse>
  match(preferences: Preference[], context: MatchContext): Promise<MatchResponse>
  listPlaces(): Promise<PlaceSummary[]>
  getPlace(placeId: string): Promise<PlaceProfile>
  ask(
    placeId: string,
    storyNodeId: string,
    question: string,
    previousQuestion?: string,
    options?: AskOptions,
  ): Promise<AskResponse>
  findSources(placeId: string, place?: PlaceContext): Promise<SourcesResponse>
}

export class ApiError extends Error {
  status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Not found') {
    super(message, 404)
    this.name = 'NotFoundError'
  }
}
