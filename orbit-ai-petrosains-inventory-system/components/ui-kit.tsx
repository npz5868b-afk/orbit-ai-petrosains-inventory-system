'use client'

import { cn } from '@/lib/utils'
import { useEffect, useRef, useState } from 'react'

type Tone = 'cyan' | 'violet' | 'teal' | 'success' | 'warning' | 'danger'

const toneText: Record<Tone, string> = {
  cyan: 'text-cyan',
  violet: 'text-violet',
  teal: 'text-teal',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
}

const toneDot: Record<Tone, string> = {
  cyan: 'bg-cyan',
  violet: 'bg-violet',
  teal: 'bg-teal',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
}

export function StatusPill({
  label,
  tone,
  pulse = false,
  className,
}: {
  label: string
  tone: Tone
  pulse?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        'border-current/25 bg-current/10',
        toneText[tone],
        className,
      )}
    >
      <span className="relative flex h-1.5 w-1.5">
        {pulse && (
          <span
            className={cn(
              'absolute inline-flex h-full w-full rounded-full opacity-75',
              toneDot[tone],
            )}
            style={{ animation: 'pulse-ring 1.6s ease-out infinite' }}
          />
        )}
        <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', toneDot[tone])} />
      </span>
      {label}
    </span>
  )
}

export function GlassCard({
  className,
  children,
  strong = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { strong?: boolean }) {
  return (
    <div
      className={cn(
        strong ? 'glass-strong' : 'glass',
        'rounded-2xl',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function SectionHeading({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
      </div>
      {action}
    </div>
  )
}

export function CountUp({
  value,
  className,
  duration = 1100,
}: {
  value: number
  className?: string
  duration?: number
}) {
  const [display, setDisplay] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !started.current) {
          started.current = true
          const start = performance.now()
          const tick = (now: number) => {
            const p = Math.min((now - start) / duration, 1)
            const eased = 1 - Math.pow(1 - p, 3)
            setDisplay(Math.round(eased * value))
            if (p < 1) requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        }
      },
      { threshold: 0.4 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [value, duration])

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  )
}
