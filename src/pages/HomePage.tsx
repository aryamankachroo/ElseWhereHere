import { Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useFlow } from '@/context/FlowContext'
import { api } from '@/lib/api'

const CHAR_LIMIT = 1000

const EXAMPLE_PROMPTS = [
  'Quiet gardens and places to read.',
  'Evening streets and small food shops.',
  'Art, independent shops, and unexpected corners.',
]

const PLACEHOLDER =
  'I miss lively evening streets, little food shops, and places where nobody seems in a hurry…'

export function HomePage() {
  const navigate = useNavigate()
  const flow = useFlow()
  const [text, setText] = useState(flow.rawMemoryText)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) {
      setError('Tell us a bit about what you miss before continuing — even a sentence is enough.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const result = await api.interpret(trimmed)
      flow.setRawMemoryText(trimmed)
      flow.setInterpretResult(result)
      navigate('/confirm')
    } catch {
      setError('Something went wrong understanding that. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="relative overflow-hidden px-4 pb-8 pt-28 sm:px-6 sm:pt-36 lg:pb-14 lg:pt-44">
      <div className="content-max relative">
        <div className="animate-fade-up">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-[var(--color-text)] sm:text-4xl lg:text-[2.75rem]">
            What do you miss about a place you love?
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-[var(--color-text-secondary)] sm:text-lg">
            A street, a ritual, a feeling. Find a connection in New York—and discover what makes it its
            own.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-3">
            <div>
              <label htmlFor="memory-input" className="sr-only">
                Describe what you miss
              </label>
              <textarea
                id="memory-input"
                value={text}
                maxLength={CHAR_LIMIT}
                onChange={(e) => {
                  setText(e.target.value)
                  if (error) setError(null)
                }}
                placeholder={PLACEHOLDER}
                rows={4}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'memory-input-error' : 'memory-input-count'}
                className="glass w-full resize-none rounded-3xl border border-white/25 px-4 py-3 text-base leading-relaxed text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] transition focus-visible:border-white"
              />
              <div className="mt-1.5 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                <span id="memory-input-count">
                  {text.length}/{CHAR_LIMIT}
                </span>
              </div>
            </div>

            {error && (
              <p id="memory-input-error" role="alert" className="text-sm text-[var(--color-rose)]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="glass-button inline-flex items-center gap-2 rounded-full border border-white/40 px-6 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Sparkles size={16} aria-hidden="true" />
              {submitting ? 'Understanding…' : 'Find my connection'}
            </button>
          </form>

          <div className="mt-6">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              Or try one of these
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => {
                    setText(prompt)
                    setError(null)
                  }}
                  className="glass rounded-full border border-white/25 px-3.5 py-1.5 text-xs text-[var(--color-text-secondary)] transition hover:border-white hover:text-[var(--color-text)]"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
