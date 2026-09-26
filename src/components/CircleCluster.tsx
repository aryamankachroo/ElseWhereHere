import { motion, useReducedMotion } from 'framer-motion'
import { useMemo, type CSSProperties } from 'react'

import { getTagLabel } from '@/data/qualityTags'
import type { Preference } from '@/types/api'

export type ClusterPhase = 'pending' | 'settled' | 'error'

interface CircleClusterProps {
  preferences: Preference[]
  phase: ClusterPhase
}

const ACCENT_COLORS = ['#bba0ed', '#e3a9b8', '#8fb4e0', '#cbb8f2']

const SIZE_BY_RANK = [168, 144, 124, 108]

type Offset = { x: number; y: number }

// Final resting offsets (px, relative to the shared center) so the shown
// circles read as an overlapping cluster once the match settles.
const FINAL_OFFSETS: Record<number, Offset[]> = {
  1: [{ x: 0, y: 0 }],
  2: [
    { x: -34, y: 0 },
    { x: 34, y: 0 },
  ],
  3: [
    { x: 0, y: -34 },
    { x: -36, y: 22 },
    { x: 36, y: 22 },
  ],
  4: [
    { x: -32, y: -28 },
    { x: 32, y: -28 },
    { x: -32, y: 28 },
    { x: 32, y: 28 },
  ],
}

// Gentle looping orbit keyframes, one per rank, tuned to feel organic
// without ever perfectly repeating in phase with one another.
const ORBIT_KEYFRAMES: { x: number[]; y: number[]; duration: number }[] = [
  { x: [0, 16, -10, 0], y: [0, -12, 14, 0], duration: 7.5 },
  { x: [0, -18, 12, 0], y: [0, 14, -16, 0], duration: 8.6 },
  { x: [0, 12, -16, 0], y: [0, -18, 8, 0], duration: 6.8 },
  { x: [0, -14, 18, -6, 0], y: [0, 16, -12, 6, 0], duration: 9.4 },
]

export function CircleCluster({ preferences, phase }: CircleClusterProps) {
  const prefersReducedMotion = useReducedMotion()

  const ranked = useMemo(
    () => [...preferences].sort((a, b) => b.importance - a.importance),
    [preferences],
  )
  const shown = ranked.slice(0, 4)
  const extra = ranked.slice(4)
  const count = shown.length
  const finalOffsets = FINAL_OFFSETS[count] ?? FINAL_OFFSETS[4]

  const isSettled = phase === 'settled' || phase === 'error' || prefersReducedMotion

  if (count === 0) {
    return null
  }

  return (
    <div>
      <div
        className="relative mx-auto h-[280px] w-[280px] sm:h-[340px] sm:w-[340px]"
        role="img"
        aria-label={`${count} confirmed ${count === 1 ? 'quality' : 'qualities'} shown as overlapping circles: ${shown
          .map((p) => getTagLabel(p.tag))
          .join(', ')}`}
      >
        {shown.map((pref, index) => {
          const size = SIZE_BY_RANK[index] ?? 100
          const color = ACCENT_COLORS[index] ?? ACCENT_COLORS[0]
          const target = finalOffsets[index] ?? { x: 0, y: 0 }
          const orbit = ORBIT_KEYFRAMES[index]

          const wrapperStyle: CSSProperties = {
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: size,
            height: size,
            marginTop: -size / 2,
            marginLeft: -size / 2,
          }

          const circleStyle: CSSProperties = {
            width: '100%',
            height: '100%',
            borderRadius: '9999px',
            border: `1.5px solid ${color}`,
            backgroundColor: color,
            opacity: 0.9,
            mixBlendMode: 'plus-lighter',
          }

          const animateTarget = isSettled
            ? { opacity: 1, scale: 1, x: target.x, y: target.y }
            : {
                opacity: 1,
                scale: 1,
                x: orbit.x.map((v) => v + target.x * 0.35),
                y: orbit.y.map((v) => v + target.y * 0.35),
              }

          return (
            <motion.div
              key={pref.tag}
              style={wrapperStyle}
              initial={{ opacity: 0, scale: 0.82, x: target.x * 0.35, y: target.y * 0.35 }}
              animate={animateTarget}
              transition={
                isSettled
                  ? { type: 'spring', stiffness: 120, damping: 16, delay: index * 0.05 }
                  : {
                      opacity: { duration: 0.5, delay: index * 0.15 },
                      scale: { duration: 0.5, delay: index * 0.15 },
                      x: { duration: orbit.duration, repeat: Infinity, ease: 'easeInOut', delay: index * 0.15 },
                      y: { duration: orbit.duration, repeat: Infinity, ease: 'easeInOut', delay: index * 0.15 },
                    }
              }
            >
              <div style={circleStyle} className="flex items-center justify-center text-center">
                <span
                  className="px-3 text-xs font-medium leading-snug text-[var(--color-text)] sm:text-sm"
                  style={{ mixBlendMode: 'normal' }}
                >
                  {getTagLabel(pref.tag)}
                </span>
              </div>
            </motion.div>
          )
        })}
      </div>

      <ul className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-sm text-[var(--color-text-secondary)] sm:hidden">
        {shown.map((pref, index) => (
          <li key={pref.tag} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: ACCENT_COLORS[index] }}
            />
            {getTagLabel(pref.tag)}
          </li>
        ))}
      </ul>

      {extra.length > 0 && (
        <div className="mt-5 text-center">
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Also considered</p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {extra.map((p) => getTagLabel(p.tag)).join(' · ')}
          </p>
        </div>
      )}
    </div>
  )
}
