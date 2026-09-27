import { ChevronDown, ChevronUp, Search } from 'lucide-react'
import { useId, useState } from 'react'

import type { Citation } from '@/types/api'

interface SourceDrawerProps {
  citations: Citation[]
  triggerLabel?: string
  /** When set, an empty drawer offers a button to look sources up. */
  onFindSources?: () => void
  finding?: boolean
  /** Short note shown above the list, e.g. a summary or where the sources came from. */
  note?: string | null
}

export function SourceDrawer({ citations, triggerLabel = 'Sources', onFindSources, finding, note }: SourceDrawerProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="glass-chip flex items-center gap-1.5 rounded-full border border-white/30 px-3.5 py-1.5 text-xs text-[var(--color-text-secondary)] transition hover:border-white/60 hover:text-[var(--color-text)]"
      >
        {triggerLabel}
        {open ? <ChevronUp size={13} aria-hidden="true" /> : <ChevronDown size={13} aria-hidden="true" />}
      </button>
      {open && (
        <div
          id={panelId}
          className="glass mt-2 rounded-xl border border-white/20 p-3.5"
        >
          {note && <p className="mb-3 text-xs italic text-[var(--color-text-muted)]">{note}</p>}
          {citations.length === 0 ? (
            <div>
              <p className="text-sm text-[var(--color-text-muted)]">
                {finding
                  ? 'Grok is searching the web for sources…'
                  : 'Sources pending — this sample profile doesn\u2019t have verified sources attached yet.'}
              </p>
              {onFindSources && !finding && (
                <button
                  type="button"
                  onClick={onFindSources}
                  className="glass-chip mt-2.5 flex items-center gap-1.5 rounded-full border border-white/30 px-3.5 py-1.5 text-xs text-[var(--color-text)] transition hover:border-white/60"
                >
                  <Search size={13} aria-hidden="true" />
                  Find sources with Grok
                </button>
              )}
            </div>
          ) : (
            <ul className="space-y-3">
              {citations.map((citation) => (
                <li key={citation.id} className="text-sm">
                  <p className="font-medium text-[var(--color-text)]">{citation.title}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{citation.publisher}</p>
                  <p className="mt-1 text-[var(--color-text-secondary)]">{citation.detail}</p>
                  {citation.url && (
                    <a
                      href={citation.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-[var(--color-lavender-strong)] underline underline-offset-2"
                    >
                      Open source
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
