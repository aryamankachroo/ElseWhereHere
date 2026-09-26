import { getFixtureById } from '@/data/fixtures'
import { liveApi } from '@/lib/liveApi'
import { mockApi } from '@/lib/mockApi'
import type { ElsewhereHereApi } from '@/types/api'

/**
 * Selects the mock or live service adapter via `VITE_USE_MOCK_API`.
 * Defaults to the mock adapter when the flag is unset. Set
 * VITE_USE_MOCK_API=false to score matches through FastAPI.
 * Sample stories and sample answers stay local until real place content exists.
 */
const useMock = import.meta.env.VITE_USE_MOCK_API !== 'false'

const liveApiWithSampleStories: ElsewhereHereApi = {
  ...liveApi,
  getPlace: async (placeId) => getFixtureById(placeId) ?? liveApi.getPlace(placeId),
  ask: mockApi.ask,
}

export const api: ElsewhereHereApi = useMock ? mockApi : liveApiWithSampleStories

export const isMockMode = useMock

export type { ElsewhereHereApi } from '@/types/api'
