import { liveApi } from '@/lib/liveApi'
import { mockApi } from '@/lib/mockApi'
import type { ElsewhereHereApi } from '@/types/api'

/**
 * Selects the mock or live service adapter via `VITE_USE_MOCK_API`.
 * Defaults to the mock adapter when the flag is unset. Set
 * VITE_USE_MOCK_API=false to use the FastAPI service on /api.
 */
const useMock = import.meta.env.VITE_USE_MOCK_API !== 'false'

export const api: ElsewhereHereApi = useMock ? mockApi : liveApi

export const isMockMode = useMock

export type { ElsewhereHereApi } from '@/types/api'
