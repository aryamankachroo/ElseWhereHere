import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from 'react'

import { flowSession } from '@/lib/session'
import type { InterpretResponse, MatchResponse, Preference } from '@/types/api'

interface FlowState {
  /** Never persisted to sessionStorage, localStorage, or the URL. */
  rawMemoryText: string
  interpretResult: InterpretResponse | null
  preferences: Preference[]
  matchResult: MatchResponse | null
  /** Snapshot of the preferences a matchResult was produced for, used to detect staleness. */
  matchedPreferencesKey: string | null
  activePlaceId: string | null
  activeStoryNodeId: string | null
}

type FlowAction =
  | { type: 'SET_RAW_TEXT'; text: string }
  | { type: 'SET_INTERPRET_RESULT'; result: InterpretResponse }
  | { type: 'SET_PREFERENCES'; preferences: Preference[] }
  | { type: 'SET_MATCH_RESULT'; result: MatchResponse; preferencesUsed: Preference[] }
  | { type: 'SET_ACTIVE_PLACE'; placeId: string }
  | { type: 'SET_ACTIVE_STORY_NODE'; nodeId: string }
  | { type: 'START_OVER' }

function preferencesKey(preferences: Preference[]): string {
  return JSON.stringify(
    [...preferences]
      .map((p) => ({ tag: p.tag, target: p.target, importance: p.importance }))
      .sort((a, b) => a.tag.localeCompare(b.tag)),
  )
}

function initialState(): FlowState {
  return {
    rawMemoryText: '',
    interpretResult: null,
    preferences: flowSession.readJson<Preference[]>(flowSession.keys.preferences) ?? [],
    matchResult: flowSession.readJson<MatchResponse>(flowSession.keys.matchResult) ?? null,
    matchedPreferencesKey: flowSession.readJson<string>(flowSession.keys.matchedPreferencesKey) ?? null,
    activePlaceId: flowSession.readJson<string>(flowSession.keys.placeId) ?? null,
    activeStoryNodeId: flowSession.readJson<string>(flowSession.keys.storyNodeId) ?? null,
  }
}

function reducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case 'SET_RAW_TEXT':
      return { ...state, rawMemoryText: action.text }
    case 'SET_INTERPRET_RESULT':
      return { ...state, interpretResult: action.result }
    case 'SET_PREFERENCES': {
      flowSession.writeJson(flowSession.keys.preferences, action.preferences)
      return { ...state, preferences: action.preferences }
    }
    case 'SET_MATCH_RESULT': {
      const key = preferencesKey(action.preferencesUsed)
      flowSession.writeJson(flowSession.keys.matchResult, action.result)
      flowSession.writeJson(flowSession.keys.matchedPreferencesKey, key)
      flowSession.writeJson(flowSession.keys.placeId, action.result.placeId)
      return {
        ...state,
        matchResult: action.result,
        matchedPreferencesKey: key,
        activePlaceId: action.result.placeId,
      }
    }
    case 'SET_ACTIVE_PLACE': {
      flowSession.writeJson(flowSession.keys.placeId, action.placeId)
      return { ...state, activePlaceId: action.placeId }
    }
    case 'SET_ACTIVE_STORY_NODE': {
      flowSession.writeJson(flowSession.keys.storyNodeId, action.nodeId)
      return { ...state, activeStoryNodeId: action.nodeId }
    }
    case 'START_OVER':
      return { ...EMPTY_STATE }
    default:
      return state
  }
}

const EMPTY_STATE: FlowState = {
  rawMemoryText: '',
  interpretResult: null,
  preferences: [],
  matchResult: null,
  matchedPreferencesKey: null,
  activePlaceId: null,
  activeStoryNodeId: null,
}

interface FlowContextValue extends FlowState {
  isMatchStale: boolean
  setRawMemoryText: (text: string) => void
  setInterpretResult: (result: InterpretResponse) => void
  setPreferences: (preferences: Preference[]) => void
  setMatchResult: (result: MatchResponse, preferencesUsed: Preference[]) => void
  setActivePlace: (placeId: string) => void
  setActiveStoryNode: (nodeId: string) => void
  startOver: () => void
}

const FlowContext = createContext<FlowContextValue | null>(null)

export function FlowProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)

  const setRawMemoryText = useCallback((text: string) => dispatch({ type: 'SET_RAW_TEXT', text }), [])
  const setInterpretResult = useCallback(
    (result: InterpretResponse) => dispatch({ type: 'SET_INTERPRET_RESULT', result }),
    [],
  )
  const setPreferences = useCallback(
    (preferences: Preference[]) => dispatch({ type: 'SET_PREFERENCES', preferences }),
    [],
  )
  const setMatchResult = useCallback(
    (result: MatchResponse, preferencesUsed: Preference[]) =>
      dispatch({ type: 'SET_MATCH_RESULT', result, preferencesUsed }),
    [],
  )
  const setActivePlace = useCallback((placeId: string) => dispatch({ type: 'SET_ACTIVE_PLACE', placeId }), [])
  const setActiveStoryNode = useCallback(
    (nodeId: string) => dispatch({ type: 'SET_ACTIVE_STORY_NODE', nodeId }),
    [],
  )
  const startOver = useCallback(() => {
    flowSession.clearAll()
    dispatch({ type: 'START_OVER' })
  }, [])

  const isMatchStale = useMemo(() => {
    if (!state.matchResult) return false
    return state.matchedPreferencesKey !== preferencesKey(state.preferences)
  }, [state.matchResult, state.matchedPreferencesKey, state.preferences])

  const value = useMemo<FlowContextValue>(
    () => ({
      ...state,
      isMatchStale,
      setRawMemoryText,
      setInterpretResult,
      setPreferences,
      setMatchResult,
      setActivePlace,
      setActiveStoryNode,
      startOver,
    }),
    [
      state,
      isMatchStale,
      setRawMemoryText,
      setInterpretResult,
      setPreferences,
      setMatchResult,
      setActivePlace,
      setActiveStoryNode,
      startOver,
    ],
  )

  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>
}

export function useFlow(): FlowContextValue {
  const ctx = useContext(FlowContext)
  if (!ctx) {
    throw new Error('useFlow must be used within a FlowProvider')
  }
  return ctx
}
