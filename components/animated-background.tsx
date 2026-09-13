import type { CSSProperties } from 'react'

// Deterministic ambient details (no Math.random at render -> no hydration drift)
const TWINKLE_PARTICLES = new Set([1, 3, 6, 8, 11, 14, 16, 19, 21])
const HIGHLIGHT_PARTICLES = new Set([3, 11, 16, 21])

const PARTICLES = Array.from({ length: 22 }, (_, i) => {
  const seed = (i * 9301 + 49297) % 233280
  const rand = seed / 233280
  const rand2 = ((i * 4021 + 7919) % 6151) / 6151
  const rand3 = ((i * 1427 + 3593) % 9733) / 9733
  const depth = HIGHLIGHT_PARTICLES.has(i) ? 'highlight' : i % 3 === 0 ? 'distant' : 'normal'
  const size =
    depth === 'highlight'
      ? 3.2 + rand2 * 0.7
      : depth === 'distant'
        ? 1.5 + rand2 * 0.5
        : 2 + rand2 * 1
  const glow = depth === 'highlight' ? 11 : depth === 'distant' ? 4.8 : 7.6
  return {
    left: Math.round(rand * 96 + 2),
    top: Math.round(rand3 * 88 + 4),
    size,
    glow,
    delay: `-${(rand * 11).toFixed(2)}s`,
    duration: `${13 + rand2 * 11}s`,
    driftX: `${(rand2 - 0.5) * 96}px`,
    driftY: `${-34 - rand3 * 94}px`,
    midDriftX: `${(rand2 - 0.5) * 27}px`,
    midDriftY: `${(-34 - rand3 * 94) * 0.28}px`,
    peak:
      depth === 'highlight'
        ? (0.92 + rand * 0.06).toFixed(2)
        : depth === 'distant'
          ? (0.48 + rand * 0.1).toFixed(2)
          : (0.76 + rand * 0.14).toFixed(2),
    mid:
      depth === 'highlight'
        ? (0.64 + rand2 * 0.14).toFixed(2)
        : depth === 'distant'
          ? (0.28 + rand2 * 0.1).toFixed(2)
          : (0.48 + rand2 * 0.18).toFixed(2),
    twinkle:
      depth === 'highlight'
        ? (0.5 + rand3 * 0.18).toFixed(2)
        : (0.3 + rand3 * 0.18).toFixed(2),
    twinkleDuration: `${3.6 + rand3 * 3.2}s`,
    twinkleDelay: `-${(rand2 * 6.4).toFixed(2)}s`,
    depth,
    twinkles: TWINKLE_PARTICLES.has(i),
    hue: i % 3,
  }
})

const STREAKS = [
  {
    top: '12%',
    left: '82%',
    width: '18rem',
    delay: '-2.5s',
    duration: '12s',
    angle: '-19deg',
    travelX: '-72vw',
    travelY: '36vh',
    peak: '0.96',
  },
  {
    top: '30%',
    left: '96%',
    width: '16rem',
    delay: '-9.2s',
    duration: '16s',
    angle: '-24deg',
    travelX: '-64vw',
    travelY: '42vh',
    peak: '0.9',
  },
  {
    top: '48%',
    left: '88%',
    width: '17rem',
    delay: '-15.4s',
    duration: '19s',
    angle: '-15deg',
    travelX: '-68vw',
    travelY: '28vh',
    peak: '0.84',
  },
  {
    top: '67%',
    left: '94%',
    width: '12rem',
    delay: '-22.1s',
    duration: '22s',
    angle: '-28deg',
    travelX: '-52vw',
    travelY: '36vh',
    peak: '0.72',
    soft: true,
  },
  {
    top: '22%',
    left: '76%',
    width: '18rem',
    delay: '-27.8s',
    duration: '24s',
    angle: '-12deg',
    travelX: '-70vw',
    travelY: '24vh',
    peak: '0.86',
  },
  {
    top: '56%',
    left: '101%',
    width: '12rem',
    delay: '-6.4s',
    duration: '18s',
    angle: '-33deg',
    travelX: '-46vw',
    travelY: '32vh',
    peak: '0.74',
    soft: true,
  },
]

const HUES = [
  'oklch(0.86 0.13 205 / 0.96)', // cyan
  'oklch(0.78 0.08 245 / 0.9)', // cool white-blue
  'oklch(0.72 0.15 292 / 0.84)', // violet
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
      <div className="ambient-command-bloom" />
      <div className="ambient-starfield" />

      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className={`ambient-particle ambient-particle-${p.depth}${
            p.twinkles ? ' ambient-particle-twinkle' : ''
          }`}
          style={{
            '--drift-x': p.driftX,
            '--drift-y': p.driftY,
            '--drift-mid-x': p.midDriftX,
            '--drift-mid-y': p.midDriftY,
            '--particle-peak': p.peak,
            '--particle-mid': p.mid,
            '--particle-twinkle': p.twinkle,
            '--twinkle-duration': p.twinkleDuration,
            '--twinkle-delay': p.twinkleDelay,
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: HUES[p.hue],
            boxShadow: `0 0 ${p.size * p.glow}px ${HUES[p.hue]}`,
            animationDelay: p.delay,
            animationDuration: p.duration,
          } as AmbientStyle}
        />
      ))}

      {STREAKS.map((s, i) => (
        <span
          key={i}
          className={`ambient-streak${s.soft ? ' ambient-streak-soft' : ''}`}
          style={{
            '--streak-angle': s.angle,
            '--streak-x': s.travelX,
            '--streak-y': s.travelY,
            '--streak-peak': s.peak,
            top: s.top,
            left: s.left,
            width: s.width,
            animationDelay: s.delay,
            animationDuration: s.duration,
          } as AmbientStyle}
        />
      ))}

      <div className="absolute inset-0 bg-[radial-gradient(100%_100%_at_50%_48%,transparent_42%,oklch(0.075_0.022_264/0.78)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,oklch(0.08_0.018_264/0.36)_72%,oklch(0.06_0.014_264/0.84)_100%)]" />
    </div>
  )
}
