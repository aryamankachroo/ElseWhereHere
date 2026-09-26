/**
 * sessionStorage helpers for the flow.
 *
 * Only confirmed preferences, the active place id, the active story node id,
 * and the last match result are ever persisted here. Raw memory text is
 * intentionally never written to sessionStorage, localStorage, or the URL.
 */

const PREFIX = 'eh:'

const KEYS = {
  preferences: `${PREFIX}preferences`,
  placeId: `${PREFIX}placeId`,
  storyNodeId: `${PREFIX}storyNodeId`,
  matchResult: `${PREFIX}matchResult`,
  matchedPreferencesKey: `${PREFIX}matchedPreferencesKey`,
} as const

function readJson<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    // sessionStorage may be unavailable (private mode, quota); fail silently
    // since it is only used to smooth over reloads, not required for the
    // flow to function.
  }
}

function remove(key: string): void {
  try {
    sessionStorage.removeItem(key)
  } catch {
    // ignore
  }
}

export const flowSession = {
  keys: KEYS,
  readJson,
  writeJson,
  remove,
  clearAll(): void {
    Object.values(KEYS).forEach(remove)
  },
}
