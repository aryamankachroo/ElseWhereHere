import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useState } from 'react'

export function AboutDialog() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="rounded-full px-3 py-1.5 text-sm text-[var(--color-text-secondary)] transition hover:text-[var(--color-text)] hover:bg-white/5"
        >
          About
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className="glass fixed left-1/2 top-1/2 z-50 w-[min(92vw,480px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--color-border-strong)] p-6 shadow-2xl focus:outline-none"
          aria-describedby="about-description"
        >
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title className="text-lg font-semibold text-[var(--color-text)]">
              About Elsewhere Here
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close about dialog"
                className="rounded-full p-1.5 text-[var(--color-text-secondary)] transition hover:bg-white/5 hover:text-[var(--color-text)]"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description id="about-description" className="mt-4 space-y-3 text-sm leading-6 text-[var(--color-text-secondary)]">
            <p>
              Elsewhere Here helps someone new to New York describe an everyday experience they miss, and
              turns that memory into a starting point for exploring a curated NYC neighborhood pocket — its
              own story, geography, and character.
            </p>
            <p>
              This build is a <strong className="text-[var(--color-text)]">three-place prototype</strong>{' '}
              made for a DivHacks demo. All three profiles, their stories, images, and cited answers are{' '}
              <strong className="text-[var(--color-text)]">sample content</strong>, not reviewed factual
              reporting. A future backend will handle real matching, reviewed place content, and
              source-grounded answers.
            </p>
            <p>
              This experience does not claim to objectively measure belonging, and avoids stereotyped
              city-to-city equivalents or invented local voices.
            </p>
          </Dialog.Description>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
