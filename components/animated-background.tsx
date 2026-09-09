// Deterministic particle field (no Math.random at render -> no hydration drift)
const PARTICLES = Array.from({ length: 22 }, (_, i) => {
  const seed = (i * 9301 + 49297) % 233280
  const rand = seed / 233280
  const rand2 = ((i * 4021 + 7919) % 6151) / 6151
  return {
    left: Math.round(rand * 100),
    size: 1.5 + rand2 * 3.5,
    delay: -(rand * 18).toFixed(2),
    duration: 16 + rand2 * 16,
    hue: i % 3,
  }
})

const HUES = [
  'oklch(0.8 0.14 205 / 0.9)', // cyan
  'oklch(0.66 0.19 292 / 0.85)', // violet
  'oklch(0.78 0.12 185 / 0.85)', // teal
]

export function AnimatedBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background"
    >
      {/* base vertical depth wash */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_-10%,oklch(0.24_0.05_264)_0%,oklch(0.16_0.028_264)_55%,oklch(0.12_0.02_264)_100%)]" />

      {/* aurora blob 1 (cyan) */}
      <div
        className="absolute -left-[10%] top-[-15%] h-[60vmax] w-[60vmax] rounded-full opacity-50 blur-[90px]"
        style={{
          background:
            'radial-gradient(circle, oklch(0.7 0.16 205 / 0.55), transparent 62%)',
          animation: 'aurora-drift 22s ease-in-out infinite',
        }}
      />
      {/* aurora blob 2 (violet) */}
      <div
        className="absolute right-[-15%] top-[10%] h-[55vmax] w-[55vmax] rounded-full opacity-45 blur-[100px]"
        style={{
          background:
            'radial-gradient(circle, oklch(0.6 0.2 292 / 0.5), transparent 62%)',
          animation: 'aurora-drift-2 26s ease-in-out infinite',
        }}
      />
      {/* aurora blob 3 (teal, lower) */}
      <div
        className="absolute bottom-[-20%] left-[25%] h-[50vmax] w-[50vmax] rounded-full opacity-35 blur-[110px]"
        style={{
          background:
            'radial-gradient(circle, oklch(0.72 0.13 185 / 0.45), transparent 60%)',
          animation: 'aurora-drift 30s ease-in-out infinite reverse',
        }}
      />

      {/* moving digital grid */}
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'linear-gradient(oklch(0.8 0.14 205 / 0.5) 1px, transparent 1px), linear-gradient(90deg, oklch(0.8 0.14 205 / 0.5) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          maskImage:
            'radial-gradient(120% 80% at 50% 30%, black 25%, transparent 78%)',
          WebkitMaskImage:
            'radial-gradient(120% 80% at 50% 30%, black 25%, transparent 78%)',
          animation: 'grid-pan 7s linear infinite',
        }}
      />

      {/* floating energy particles */}
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="absolute bottom-[-6vh] rounded-full"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: HUES[p.hue],
            boxShadow: `0 0 ${p.size * 4}px ${HUES[p.hue]}`,
            animation: `float-up ${p.duration}s linear ${p.delay}s infinite`,
          }}
        />
      ))}

      {/* soft vignette so content stays readable */}
      <div className="absolute inset-0 bg-[radial-gradient(100%_100%_at_50%_50%,transparent_55%,oklch(0.1_0.02_264/0.55)_100%)]" />
    </div>
  )
}
