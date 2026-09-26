interface RingSpec {
  className: string
  animation: string
}

const LAVENDER_RING =
  'bg-[radial-gradient(circle_at_32%_30%,rgba(187,160,237,0.32),rgba(187,160,237,0.04)_60%,transparent_75%)] border-[rgba(187,160,237,0.45)] shadow-[0_0_90px_-8px_rgba(187,160,237,0.5)]'
const ROSE_RING =
  'bg-[radial-gradient(circle_at_65%_60%,rgba(227,169,184,0.28),rgba(227,169,184,0.03)_60%,transparent_75%)] border-[rgba(227,169,184,0.4)] shadow-[0_0_80px_-10px_rgba(227,169,184,0.4)]'
const BLUE_RING =
  'bg-[radial-gradient(circle_at_40%_65%,rgba(143,180,224,0.26),rgba(143,180,224,0.03)_60%,transparent_75%)] border-[rgba(143,180,224,0.38)] shadow-[0_0_80px_-10px_rgba(143,180,224,0.4)]'

export function HomeRingsDesktop() {
  const rings: RingSpec[] = [
    { className: `absolute left-4 top-6 h-64 w-64 ${LAVENDER_RING}`, animation: 'animate-ring-drift-1' },
    { className: `absolute right-6 top-16 h-52 w-52 ${ROSE_RING}`, animation: 'animate-ring-drift-2' },
    { className: `absolute bottom-4 left-16 h-56 w-56 ${BLUE_RING}`, animation: 'animate-ring-drift-3' },
  ]
  return (
    <div aria-hidden="true" className="pointer-events-none relative hidden h-[420px] w-full select-none lg:block">
      {rings.map((ring, i) => (
        <div key={i} className={`rounded-full border ${ring.className} ${ring.animation}`} />
      ))}
    </div>
  )
}

export function HomeRingsMobile() {
  const rings: RingSpec[] = [
    { className: `absolute left-2 top-2 h-32 w-32 ${LAVENDER_RING}`, animation: 'animate-ring-drift-1' },
    { className: `absolute right-4 top-6 h-24 w-24 ${ROSE_RING}`, animation: 'animate-ring-drift-2' },
    { className: `absolute left-20 top-16 h-20 w-20 ${BLUE_RING}`, animation: 'animate-ring-drift-3' },
  ]
  return (
    <div aria-hidden="true" className="pointer-events-none relative h-40 w-full select-none lg:hidden">
      {rings.map((ring, i) => (
        <div key={i} className={`rounded-full border ${ring.className} ${ring.animation}`} />
      ))}
    </div>
  )
}

// Purely decorative ambient rings for the homepage hero. Drift is driven by
// CSS keyframes (see index.css) rather than a graphics engine, and is
// neutralized globally under `prefers-reduced-motion: reduce`. Exported as
// two placement-specific components so the mobile composition can sit above
// the hero copy while the desktop composition sits beside it.
