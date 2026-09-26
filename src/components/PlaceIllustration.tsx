import type { IllustrationVariant } from '@/types/api'

interface PlaceIllustrationProps {
  variant: IllustrationVariant
  className?: string
  label?: string
}

/**
 * Original, locally-authored SVG illustrations standing in for reviewed
 * place photography. These are intentionally abstract so they are never
 * mistaken for a real photograph of a real location.
 */
export function PlaceIllustration({ variant, className, label }: PlaceIllustrationProps) {
  return (
    <div
      className={`relative isolate overflow-hidden ${className ?? ''}`}
      role="img"
      aria-label={label ?? 'Sample illustration for this prototype profile'}
    >
      <svg
        viewBox="0 0 400 300"
        className="h-full w-full"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`grad-${variant}`} x1="0%" y1="0%" x2="100%" y2="100%">
            {variant === 'garden' && (
              <>
                <stop offset="0%" stopColor="#1d1724" />
                <stop offset="55%" stopColor="#274436" />
                <stop offset="100%" stopColor="#3a5a45" />
              </>
            )}
            {variant === 'street' && (
              <>
                <stop offset="0%" stopColor="#1d1724" />
                <stop offset="55%" stopColor="#4a2d3a" />
                <stop offset="100%" stopColor="#e3a9b8" stopOpacity="0.55" />
              </>
            )}
            {variant === 'gallery' && (
              <>
                <stop offset="0%" stopColor="#1d1724" />
                <stop offset="55%" stopColor="#2c3a52" />
                <stop offset="100%" stopColor="#8fb4e0" stopOpacity="0.5" />
              </>
            )}
          </linearGradient>
          <radialGradient id={`glow-${variant}`} cx="50%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#bba0ed" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#bba0ed" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="400" height="300" fill={`url(#grad-${variant})`} />
        <rect width="400" height="300" fill={`url(#glow-${variant})`} />

        {variant === 'garden' && (
          <g opacity="0.85">
            <circle cx="90" cy="220" r="70" fill="#bba0ed" opacity="0.12" />
            <circle cx="300" cy="90" r="90" fill="#e3a9b8" opacity="0.1" />
            <path
              d="M0 260 C 80 220, 140 240, 200 220 S 340 190, 400 210 V300 H0 Z"
              fill="#0f1a13"
              opacity="0.5"
            />
          </g>
        )}
        {variant === 'street' && (
          <g opacity="0.85">
            <rect x="20" y="120" width="60" height="140" fill="#0f0b16" opacity="0.55" />
            <rect x="100" y="80" width="50" height="180" fill="#0f0b16" opacity="0.45" />
            <rect x="170" y="140" width="70" height="120" fill="#0f0b16" opacity="0.55" />
            <rect x="260" y="100" width="55" height="160" fill="#0f0b16" opacity="0.4" />
            <circle cx="330" cy="70" r="10" fill="#e3a9b8" opacity="0.7" />
            <circle cx="60" cy="60" r="6" fill="#f4f1f7" opacity="0.4" />
          </g>
        )}
        {variant === 'gallery' && (
          <g opacity="0.85">
            <rect x="60" y="70" width="80" height="60" rx="4" fill="#f4f1f7" opacity="0.08" />
            <rect x="170" y="60" width="60" height="90" rx="4" fill="#f4f1f7" opacity="0.1" />
            <rect x="260" y="90" width="90" height="50" rx="4" fill="#f4f1f7" opacity="0.08" />
            <circle cx="200" cy="230" r="120" fill="#8fb4e0" opacity="0.08" />
          </g>
        )}
      </svg>
      <span className="absolute bottom-2 left-2 rounded-full bg-[var(--color-bg)]/70 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)] backdrop-blur">
        Sample illustration
      </span>
    </div>
  )
}
