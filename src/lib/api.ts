import { getFixtureById } from '@/data/fixtures'
import { liveApi } from '@/lib/liveApi'
import { mockApi } from '@/lib/mockApi'
import type { ElsewhereHereApi } from '@/types/api'

/**
 * Selects the mock or live service adapter via `VITE_USE_MOCK_API`.
 * Defaults to the mock adapter when the flag is unset. Set
 * VITE_USE_MOCK_API=false to score matches through FastAPI.
 * Sample stories stay local until real place content exists.
 * `VITE_ENABLE_GROK=true` sends questions and source lookups to FastAPI,
 * which calls Grok, even when matching runs in the browser.
 */
const useMock = import.meta.env.VITE_USE_MOCK_API !== 'false'
const useGrok = import.meta.env.VITE_ENABLE_GROK === 'true'

const liveApiWithSampleStories: ElsewhereHereApi = {
  ...liveApi,
  getPlace: async (placeId) => getFixtureById(placeId) ?? liveApi.getPlace(placeId),
  ask: mockApi.ask,
  findSources: mockApi.findSources,
}

const base = useMock ? mockApi : liveApiWithSampleStories

export const api: ElsewhereHereApi = useGrok
  ? { ...base, ask: liveApi.ask, findSources: liveApi.findSources }
  : base

export const isMockMode = useMock
export const isGrokEnabled = useGrok

export type { ElsewhereHereApi } from '@/types/api'
