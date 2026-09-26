interface NYCSkylineBackdropProps {
  className?: string
  /** Show the water band + reflection + shimmer beneath the skyline. */
  withWater?: boolean
}

/**
 * A purely decorative, originally-drawn skyline silhouette — loosely evoking
 * a Lower-Manhattan-style waterfront view (one tall spired tower rising
 * above a dense cluster of buildings, seen across water) without depicting
 * any specific real photograph or building. Used prominently behind the
 * intro splash wordmark, and very faintly as an ambient backdrop behind the
 * homepage hero.
 *
 * Motion (parallax drift, window twinkle, water shimmer, beacon blink) is
 * pure CSS so it's automatically neutralized by the app-wide
 * `prefers-reduced-motion` override in index.css.
 */
const FRONT_BUILDINGS: Array<{ x: number; y: number; w: number; h: number }> = [
  { x: 0, y: 255, w: 50, h: 45 },
  { x: 55, y: 225, w: 32, h: 75 },
  { x: 92, y: 265, w: 58, h: 35 },
  { x: 155, y: 200, w: 34, h: 100 },
  { x: 194, y: 248, w: 46, h: 52 },
  { x: 245, y: 215, w: 36, h: 85 },
  { x: 286, y: 260, w: 60, h: 40 },
  // The tall spired tower — the focal point, echoing a single dominant
  // landmark rising above the rest of the skyline.
  { x: 352, y: 95, w: 30, h: 205 },
  { x: 388, y: 242, w: 48, h: 58 },
  { x: 441, y: 210, w: 38, h: 90 },
  { x: 484, y: 258, w: 56, h: 42 },
  { x: 545, y: 198, w: 32, h: 102 },
  { x: 582, y: 238, w: 50, h: 62 },
  { x: 637, y: 220, w: 36, h: 80 },
  { x: 678, y: 262, w: 60, h: 38 },
  { x: 743, y: 205, w: 34, h: 95 },
  { x: 782, y: 250, w: 52, h: 50 },
  { x: 840, y: 222, w: 40, h: 78 },
  { x: 884, y: 258, w: 56, h: 42 },
  { x: 945, y: 212, w: 28, h: 88 },
  { x: 978, y: 238, w: 22, h: 62 },
]

const BACK_BUILDINGS: Array<{ x: number; y: number; w: number; h: number }> = [
  { x: 15, y: 235, w: 40, h: 65 },
  { x: 68, y: 205, w: 28, h: 95 },
  { x: 106, y: 250, w: 52, h: 50 },
  { x: 172, y: 190, w: 32, h: 110 },
  { x: 216, y: 225, w: 44, h: 75 },
  { x: 270, y: 175, w: 26, h: 125 },
  { x: 310, y: 240, w: 56, h: 60 },
  { x: 420, y: 215, w: 30, h: 85 },
  { x: 460, y: 245, w: 48, h: 55 },
  { x: 518, y: 195, w: 34, h: 105 },
  { x: 562, y: 235, w: 46, h: 65 },
  { x: 618, y: 205, w: 30, h: 95 },
  { x: 660, y: 245, w: 50, h: 55 },
  { x: 720, y: 210, w: 32, h: 90 },
  { x: 812, y: 230, w: 44, h: 70 },
  { x: 866, y: 200, w: 30, h: 100 },
  { x: 912, y: 240, w: 46, h: 60 },
  { x: 966, y: 220, w: 26, h: 80 },
]

const WINDOWS: Array<{ x: number; y: number; delay: number; dur: number }> = [
  { x: 362, y: 115, delay: 0, dur: 3.1 },
  { x: 362, y: 135, delay: 0.6, dur: 2.8 },
  { x: 362, y: 158, delay: 1.2, dur: 3.4 },
  { x: 371, y: 125, delay: 1.8, dur: 3.0 },
  { x: 371, y: 148, delay: 0.3, dur: 2.6 },
  { x: 371, y: 172, delay: 2.1, dur: 3.6 },
  { x: 362, y: 190, delay: 0.9, dur: 2.9 },
  { x: 371, y: 205, delay: 1.5, dur: 3.2 },
  { x: 199, y: 260, delay: 0.4, dur: 2.7 },
  { x: 210, y: 275, delay: 1.6, dur: 3.3 },
  { x: 250, y: 230, delay: 0.8, dur: 3.0 },
  { x: 261, y: 250, delay: 2.0, dur: 2.8 },
  { x: 393, y: 255, delay: 0.5, dur: 3.1 },
  { x: 404, y: 270, delay: 1.3, dur: 2.6 },
  { x: 446, y: 225, delay: 0.2, dur: 2.9 },
  { x: 456, y: 245, delay: 1.9, dur: 3.4 },
  { x: 550, y: 212, delay: 0.7, dur: 3.0 },
  { x: 560, y: 232, delay: 1.7, dur: 2.7 },
  { x: 587, y: 250, delay: 0.1, dur: 3.3 },
  { x: 642, y: 235, delay: 1.1, dur: 2.9 },
  { x: 748, y: 220, delay: 1.4, dur: 3.2 },
  { x: 758, y: 240, delay: 0.6, dur: 2.8 },
  { x: 787, y: 262, delay: 2.2, dur: 3.0 },
  { x: 845, y: 238, delay: 0.9, dur: 2.6 },
  { x: 889, y: 270, delay: 1.8, dur: 3.1 },
  { x: 950, y: 228, delay: 0.3, dur: 2.9 },
]

export function NYCSkylineBackdrop({ className, withWater = true }: NYCSkylineBackdropProps) {
  return (
    <svg
      viewBox="0 0 1000 420"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      className={`pointer-events-none select-none ${className ?? ''}`}
    >
      <defs>
        <radialGradient id="skyline-glow" cx="36%" cy="18%" r="45%">
          <stop offset="0%" stopColor="#bba0ed" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#bba0ed" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="skyline-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#100c16" stopOpacity="0" />
          <stop offset="100%" stopColor="#100c16" stopOpacity="0.92" />
        </linearGradient>
        <linearGradient id="water-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a2138" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#100c16" stopOpacity="1" />
        </linearGradient>
        <linearGradient id="water-shimmer-gradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#e8def7" stopOpacity="0" />
          <stop offset="50%" stopColor="#e8def7" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#e8def7" stopOpacity="0" />
        </linearGradient>
        <filter id="water-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
        <clipPath id="water-clip">
          <rect x="0" y="300" width="1000" height="120" />
        </clipPath>
      </defs>

      <rect width="1000" height="300" fill="url(#skyline-glow)" className="animate-glow-pulse" />

      <g fill="#1c1624" opacity="0.55" className="animate-skyline-drift-back">
        {BACK_BUILDINGS.map((r) => (
          <rect key={`back-${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={r.h} />
        ))}
      </g>

      <g fill="#241c2e" className="animate-skyline-drift-front">
        <g id="eh-skyline-front">
          {FRONT_BUILDINGS.map((r) => (
            <rect key={`front-${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={r.h} />
          ))}
        </g>

        {/* Antenna/spire above the tall focal tower */}
        <rect x="365" y="55" width="4" height="42" fill="#241c2e" />
        <circle cx="367" cy="53" r="3.2" fill="#f4f1f7" opacity="0.85" className="animate-beacon-blink" />

        <g fill="#f4f1f7" opacity="0.6">
          {WINDOWS.map((win) => (
            <rect
              key={`${win.x}-${win.y}`}
              x={win.x}
              y={win.y}
              width="3"
              height="4"
              className="animate-window-twinkle"
              style={{ animationDelay: `${win.delay}s`, animationDuration: `${win.dur}s` }}
            />
          ))}
        </g>
      </g>

      {withWater && (
        <>
          <rect x="0" y="300" width="1000" height="120" fill="url(#water-fill)" />
          <g
            clipPath="url(#water-clip)"
            opacity="0.22"
            filter="url(#water-blur)"
            transform="translate(0,420) scale(1,-0.4)"
          >
            <use href="#eh-skyline-front" fill="#241c2e" />
          </g>
          <rect
            y="300"
            width="260"
            height="120"
            fill="url(#water-shimmer-gradient)"
            clipPath="url(#water-clip)"
            className="animate-water-shimmer"
          />
        </>
      )}

      <rect width="1000" height="420" fill="url(#skyline-fade)" />
    </svg>
  )
}
