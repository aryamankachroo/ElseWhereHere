import { MapPinOff } from 'lucide-react'

interface MapFallbackCardProps {
  placeName: string
  neighborhood?: string
  borough?: string
  reason: string
  heightClassName?: string
}

/**
 * Graceful stand-in shown whenever a live map cannot be rendered — missing
 * token, missing verified coordinates, no WebGL, or a failed load. The story
 * remains fully usable without it.
 */
export function MapFallbackCard({
  placeName,
  neighborhood,
  borough,
  reason,
  heightClassName,
}: MapFallbackCardProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-6 text-center ${heightClassName ?? 'h-full'}`}
    >
      <MapPinOff size={22} aria-hidden="true" className="text-[var(--color-text-muted)]" />
      <p className="mt-3 text-sm font-medium text-[var(--color-text)]">{placeName}</p>
      {(neighborhood || borough) && (
        <p className="text-xs text-[var(--color-text-muted)]">
          {[neighborhood, borough].filter(Boolean).join(' · ')}
        </p>
      )}
      <p className="mt-3 max-w-xs text-xs leading-relaxed text-[var(--color-text-muted)]">{reason}</p>
    </div>
  )
}
