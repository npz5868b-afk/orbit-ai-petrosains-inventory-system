import type { CSSProperties } from 'react'

// Deterministic ambient details (no Math.random at render -> no hydration drift)
const PARTICLES = Array.from({ length: 13 }, (_, i) => {
  const seed = (i * 9301 + 49297) % 233280
  const rand = seed / 233280
  const rand2 = ((i * 4021 + 7919) % 6151) / 6151
  const rand3 = ((i * 1427 + 3593) % 9733) / 9733
  return {
    left: Math.round(rand * 96 + 2),
    top: Math.round(rand3 * 88 + 4),
    size: 1.4 + rand2 * 2.5,
    delay: `-${(rand * 14).toFixed(2)}s`,
    duration: `${14 + rand2 * 13}s`,
    driftX: `${(rand2 - 0.5) * 86}px`,
    driftY: `${-30 - rand3 * 82}px`,
    hue: i % 3,
  }
})

const STREAKS = [
  { top: '14%', left: '76%', width: '12rem', delay: '-5s', duration: '18s' },
  { top: '44%', left: '92%', width: '10rem', delay: '-14s', duration: '24s' },
  { top: '68%', left: '84%', width: '8rem', delay: '-27s', duration: '31s' },
]

const HUES = [
  'oklch(0.82 0.13 205 / 0.82)', // cyan
  'oklch(0.72 0.1 250 / 0.72)', // cool white-blue
  'oklch(0.68 0.15 292 / 0.66)', // violet
]

type AmbientStyle = CSSProperties & Record<string, string>

export function AnimatedBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background"
    >
      <div className="absolute inset-0 bg-[radial-gradient(125%_90%_at_50%_-10%,oklch(0.24_0.052_264)_0%,oklch(0.145_0.03_264)_52%,oklch(0.09_0.025_264)_100%)]" />
      <div className="ambient-aurora ambient-aurora-a" />
      <div className="ambient-aurora ambient-aurora-b" />
      <div className="ambient-aurora ambient-aurora-c" />
      <div className="ambient-depth-grid" />
      <div className="ambient-depth-lines" />
      <div className="ambient-hero-glow" />

      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="ambient-particle"
          style={{
            '--drift-x': p.driftX,
            '--drift-y': p.driftY,
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: HUES[p.hue],
            boxShadow: `0 0 ${p.size * 4.5}px ${HUES[p.hue]}`,
            animationDelay: p.delay,
            animationDuration: p.duration,
          } as AmbientStyle}
        />
      ))}

      {STREAKS.map((s, i) => (
        <span
          key={i}
          className="ambient-streak"
          style={{
            top: s.top,
            left: s.left,
            width: s.width,
            animationDelay: s.delay,
            animationDuration: s.duration,
          }}
        />
      ))}

      <div className="absolute inset-0 bg-[radial-gradient(100%_100%_at_50%_50%,transparent_48%,oklch(0.075_0.022_264/0.7)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,oklch(0.08_0.018_264/0.32)_72%,oklch(0.06_0.014_264/0.78)_100%)]" />
    </div>
  )
}
