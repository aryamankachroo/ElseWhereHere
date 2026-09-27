import { AlertCircle, Send } from 'lucide-react'
import { useRef, useState } from 'react'

import { SourceDrawer } from '@/components/SourceDrawer'
import { api } from '@/lib/api'
import type { AskClaim, AskStatus, Citation } from '@/types/api'

interface QAEntry {
  id: string
  question: string
  status: AskStatus | 'error'
  claims: AskClaim[]
  citationIds: string[]
  message?: string
}

interface QAPanelProps {
  placeId: string
  activeStoryNodeId: string
  suggestedQuestions: string[]
  citations: Citation[]
}

export function QAPanel({ placeId, activeStoryNodeId, suggestedQuestions, citations }: QAPanelProps) {
  const [entries, setEntries] = useState<QAEntry[]>([])
  const [inputValue, setInputValue] = useState('')
  const requestCounterRef = useRef(0)
  const entryRequestIdsRef = useRef(new Map<string, number>())

  function resolveCitations(ids: string[]): Citation[] {
    return citations.filter((c) => ids.includes(c.id))
  }

  function submitQuestion(question: string, existingEntryId?: string) {
    const trimmed = question.trim()
    if (!trimmed) return

    const requestId = ++requestCounterRef.current
    const entryId = existingEntryId ?? `qa-${requestId}`
    const previousQuestion = entries.length > 0 ? entries[entries.length - 1].question : undefined

    setEntries((prev) => {
      const pendingEntry: QAEntry = { id: entryId, question: trimmed, status: 'pending', claims: [], citationIds: [] }
      if (existingEntryId) {
        return prev.map((e) => (e.id === existingEntryId ? pendingEntry : e))
      }
      return [...prev, pendingEntry]
    })
    entryRequestIdsRef.current.set(entryId, requestId)
    if (!existingEntryId) setInputValue('')

    api
      .ask(placeId, activeStoryNodeId, trimmed, previousQuestion)
      .then((res) => {
        if (entryRequestIdsRef.current.get(entryId) !== requestId) return // superseded
        setEntries((prev) =>
          prev.map((e) =>
            e.id === entryId
              ? { ...e, status: res.status, claims: res.claims, citationIds: res.citationIds, message: res.message }
              : e,
          ),
        )
      })
      .catch(() => {
        if (entryRequestIdsRef.current.get(entryId) !== requestId) return
        setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, status: 'error' } : e)))
      })
  }

  const askedQuestions = new Set(entries.map((e) => e.question.toLowerCase()))
  const remainingSuggestions = suggestedQuestions.filter((q) => !askedQuestions.has(q.toLowerCase()))

  return (
    <div className="glass rounded-3xl border border-white/20 p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-[var(--color-text)]">Ask one question deeper</h3>

      {entries.length > 0 && (
        <ul className="mt-3 space-y-4">
          {entries.map((entry) => (
            <li key={entry.id} className="text-sm">
              <p className="font-medium text-[var(--color-text)]">{entry.question}</p>

              {entry.status === 'pending' && (
                <p className="mt-1 text-[var(--color-text-muted)]">Thinking…</p>
              )}

              {entry.status === 'answered' && (
                <div className="mt-1.5">
                  <ul className="space-y-1.5">
                    {entry.claims.map((claim, i) => (
                      <li key={i} className="leading-relaxed text-[var(--color-text-secondary)]">
                        {claim.text}
                      </li>
                    ))}
                  </ul>
                  {entry.message && (
                    <p className="mt-1.5 text-xs italic text-[var(--color-text-muted)]">{entry.message}</p>
                  )}
                  <div className="mt-2">
                    <SourceDrawer citations={resolveCitations(entry.citationIds)} triggerLabel="Citations" />
                  </div>
                </div>
              )}

              {entry.status === 'insufficient-evidence' && (
                <p className="mt-1.5 flex items-start gap-1.5 text-[var(--color-text-muted)]">
                  <AlertCircle size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
                  {entry.message ?? "Our current sources don't answer that yet."}
                </p>
              )}

              {entry.status === 'error' && (
                <div className="mt-1.5 flex items-center gap-2">
                  <p className="text-[var(--color-rose)]">Something went wrong answering that.</p>
                  <button
                    type="button"
                    onClick={() => submitQuestion(entry.question, entry.id)}
                    className="glass-chip rounded-full border border-white/30 px-2.5 py-0.5 text-xs text-[var(--color-text-secondary)] transition hover:text-[var(--color-text)]"
                  >
                    Retry
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {remainingSuggestions.length > 0 && (
        <div className="mt-3.5 flex flex-wrap gap-2">
          {remainingSuggestions.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => submitQuestion(q)}
              className="glass-chip rounded-full border border-dashed border-white/30 px-3 py-1.5 text-xs text-[var(--color-text-muted)] transition hover:border-white/60 hover:text-[var(--color-text-secondary)]"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          submitQuestion(inputValue)
        }}
        className="mt-3.5 flex items-center gap-2"
      >
        <label htmlFor="qa-input" className="sr-only">
          What would you like to understand about this place?
        </label>
        <input
          id="qa-input"
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="What would you like to understand about this place?"
          className="glass-chip flex-1 rounded-full border border-white/30 bg-transparent px-4 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus-visible:border-white"
        />
        <button
          type="submit"
          aria-label="Ask this question"
          className="glass-button flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/40 transition"
        >
          <Send size={15} aria-hidden="true" />
        </button>
      </form>
    </div>
  )
}
