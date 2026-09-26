interface NYCSkylineBackdropProps {
  className?: string
}

/**
 * Purely decorative, originally-drawn abstract skyline silhouette. Not a
 * depiction of any specific real building — a generic city-at-night motif
 * used behind the wordmark and (faintly) behind the homepage hero.
 */
export function NYCSkylineBackdrop({ className }: NYCSkylineBackdropProps) {
  return (
    <svg
      viewBox="0 0 800 260"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      className={`pointer-events-none select-none ${className ?? ''}`}
    >
      <defs>
        <radialGradient id="skyline-glow" cx="50%" cy="15%" r="55%">
          <stop offset="0%" stopColor="#bba0ed" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#bba0ed" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="skyline-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#100c16" stopOpacity="0" />
          <stop offset="100%" stopColor="#100c16" stopOpacity="0.9" />
        </linearGradient>
      </defs>

      <rect width="800" height="260" fill="url(#skyline-glow)" />

      <g fill="#241c2e">
        <rect x="0" y="160" width="48" height="100" />
        <rect x="52" y="120" width="38" height="140" />
        <rect x="94" y="175" width="58" height="85" />
        <rect x="156" y="95" width="32" height="165" />
        <rect x="192" y="140" width="52" height="120" />
        <rect x="248" y="70" width="26" height="190" />
        <rect x="278" y="130" width="66" height="130" />
        <rect x="350" y="50" width="22" height="210" />
        <rect x="376" y="150" width="46" height="110" />
        <rect x="426" y="105" width="36" height="155" />
        <rect x="466" y="170" width="60" height="90" />
        <rect x="530" y="88" width="30" height="172" />
        <rect x="564" y="140" width="50" height="120" />
        <rect x="618" y="75" width="26" height="185" />
        <rect x="648" y="155" width="42" height="105" />
        <rect x="694" y="115" width="34" height="145" />
        <rect x="732" y="165" width="40" height="95" />
        <rect x="776" y="128" width="24" height="132" />
      </g>

      <g fill="#f4f1f7" opacity="0.55">
        <rect x="10" y="185" width="3" height="4" />
        <rect x="20" y="200" width="3" height="4" />
        <rect x="62" y="150" width="3" height="4" />
        <rect x="72" y="175" width="3" height="4" />
        <rect x="165" y="120" width="3" height="4" />
        <rect x="200" y="165" width="3" height="4" />
        <rect x="256" y="100" width="3" height="4" />
        <rect x="290" y="155" width="3" height="4" />
        <rect x="358" y="80" width="3" height="4" />
        <rect x="384" y="175" width="3" height="4" />
        <rect x="434" y="130" width="3" height="4" />
        <rect x="478" y="195" width="3" height="4" />
        <rect x="538" y="115" width="3" height="4" />
        <rect x="576" y="165" width="3" height="4" />
        <rect x="626" y="100" width="3" height="4" />
        <rect x="658" y="180" width="3" height="4" />
        <rect x="702" y="140" width="3" height="4" />
        <rect x="742" y="190" width="3" height="4" />
        <rect x="782" y="150" width="3" height="4" />
      </g>

      <rect width="800" height="260" fill="url(#skyline-fade)" />
    </svg>
  )
}
