import * as Toggle from '@radix-ui/react-toggle'
import { Plus, Star, X } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import { useFlow } from '@/context/FlowContext'
import { QUALITY_TAG_CATALOG, getTagLabel } from '@/data/qualityTags'
import type { Preference } from '@/types/api'

export function ConfirmQualitiesPage() {
  const flow = useFlow()
  const navigate = useNavigate()

  const [selected, setSelected] = useState<Preference[]>(() =>
    flow.preferences.length > 0 ? flow.preferences : flow.interpretResult?.preferences ?? [],
  )
  const [error, setError] = useState<string | null>(null)

  const hasEntryContext = flow.interpretResult !== null || flow.preferences.length > 0
  if (!hasEntryContext) {
    return <Navigate to="/" replace />
  }

  const needsClarification = flow.interpretResult?.needsClarification ?? false
  const selectedIds = new Set(selected.map((p) => p.tag))
  const availableTags = QUALITY_TAG_CATALOG.filter((tag) => !selectedIds.has(tag.id))

  function addTag(tagId: string) {
    setSelected((prev) => [...prev, { tag: tagId, target: 0.8, importance: 1 }])
    setError(null)
  }

  function removeTag(tagId: string) {
    setSelected((prev) => prev.filter((p) => p.tag !== tagId))
  }

  function toggleImportance(tagId: string) {
    setSelected((prev) =>
      prev.map((p) => (p.tag === tagId ? { ...p, importance: p.importance === 2 ? 1 : 2 } : p)),
    )
  }

  function handleContinue() {
    if (selected.length === 0) {
      setError('Choose at least one quality to continue — even one is enough.')
      return
    }
    flow.setPreferences(selected)
    navigate('/matching')
  }

  return (
    <section className="content-max px-4 py-8 sm:px-6 lg:py-14">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text)] sm:text-3xl">
          Here&rsquo;s what we picked up.
        </h1>
        <p className="mt-3 text-base leading-relaxed text-[var(--color-text-secondary)]">
          Remove anything that doesn&rsquo;t fit, add what&rsquo;s missing, and star what matters most.
        </p>

        {needsClarification && (
          <div className="mt-5 rounded-xl border border-[var(--color-lavender)]/40 bg-[var(--color-lavender)]/[0.07] px-4 py-3.5">
            <p className="text-sm font-medium text-[var(--color-text)]">
              {flow.interpretResult?.clarificationQuestion ?? 'What do you love about it?'}
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              We couldn&rsquo;t pick up specific qualities from that description. Select the ones that fit
              below.
            </p>
          </div>
        )}

        <div className="mt-7">
          <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
            Your qualities
          </h2>
          {selected.length === 0 ? (
            <p className="mt-2.5 text-sm text-[var(--color-text-muted)]">
              Nothing selected yet — add a quality below.
            </p>
          ) : (
            <ul className="mt-2.5 flex flex-wrap gap-2">
              {selected.map((pref) => {
                const starred = pref.importance === 2
                return (
                  <li
                    key={pref.tag}
                    className={`flex items-center gap-1 rounded-full border py-1.5 pl-3.5 pr-1.5 text-sm transition ${
                      starred
                        ? 'border-[var(--color-lavender)] bg-[var(--color-lavender)]/15 text-[var(--color-text)]'
                        : 'border-[var(--color-border-strong)] bg-white/[0.03] text-[var(--color-text)]'
                    }`}
                  >
                    <span>{getTagLabel(pref.tag)}</span>
                    <Toggle.Root
                      pressed={starred}
                      onPressedChange={() => toggleImportance(pref.tag)}
                      aria-label={
                        starred
                          ? `${getTagLabel(pref.tag)} marked as most important — click to unmark`
                          : `Mark ${getTagLabel(pref.tag)} as most important`
                      }
                      className={`ml-0.5 flex h-6 w-6 items-center justify-center rounded-full transition ${
                        starred ? 'text-[var(--color-lavender-strong)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                      }`}
                    >
                      <Star size={14} aria-hidden="true" fill={starred ? 'currentColor' : 'none'} />
                    </Toggle.Root>
                    <button
                      type="button"
                      onClick={() => removeTag(pref.tag)}
                      aria-label={`Remove ${getTagLabel(pref.tag)}`}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--color-text-muted)] transition hover:bg-white/10 hover:text-[var(--color-text)]"
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {availableTags.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              Add a quality
            </h2>
            <ul className="mt-2.5 flex flex-wrap gap-2">
              {availableTags.map((tag) => (
                <li key={tag.id}>
                  <button
                    type="button"
                    onClick={() => addTag(tag.id)}
                    className="flex items-center gap-1 rounded-full border border-dashed border-[var(--color-border-strong)] px-3.5 py-1.5 text-sm text-[var(--color-text-muted)] transition hover:border-[var(--color-lavender)] hover:text-[var(--color-text-secondary)]"
                  >
                    <Plus size={13} aria-hidden="true" />
                    {tag.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 text-sm text-[var(--color-rose)]">
            {error}
          </p>
        )}

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-full border border-[var(--color-border-strong)] px-5 py-2.5 text-sm text-[var(--color-text-secondary)] transition hover:border-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
          >
            Edit my description
          </button>
          <button
            type="button"
            onClick={handleContinue}
            className="rounded-full bg-[var(--color-lavender)] px-6 py-2.5 text-sm font-semibold text-[#100c16] transition hover:bg-[var(--color-lavender-strong)]"
          >
            Find my NYC connection
          </button>
        </div>
      </div>
    </section>
  )
}
