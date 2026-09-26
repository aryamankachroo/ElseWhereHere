import { liveApi } from '@/lib/liveApi'
import { mockApi } from '@/lib/mockApi'
import type { ElsewhereHereApi } from '@/types/api'

/**
 * Selects the mock or live service adapter via `VITE_USE_MOCK_API`.
 * Defaults to the mock adapter when the flag is unset, since this build
 * phase ships mock-first with no backend to talk to yet.
 */
const useMock = import.meta.env.VITE_USE_MOCK_API !== 'false'

export const api: ElsewhereHereApi = useMock ? mockApi : liveApi

export const isMockMode = useMock

export type { ElsewhereHereApi } from '@/types/api'
