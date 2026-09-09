'use client'

import { cn } from '@/lib/utils'
import { Camera, Radio } from 'lucide-react'

export type DetectBox = {
  top: string
  left: string
  width: string
  height: string
  label: string
  confidence: number
  review?: boolean
}

export const DETECT_BOXES: DetectBox[] = [
  { top: '14%', left: '8%', width: '32%', height: '26%', label: 'Arduino Uno', confidence: 98 },
  { top: '22%', left: '56%', width: '30%', height: '32%', label: 'Ultrasonic Sensor', confidence: 95 },
  { top: '58%', left: '14%', width: '26%', height: '28%', label: 'Screwdriver', confidence: 91 },
  { top: '56%', left: '58%', width: '28%', height: '30%', label: 'Uncertain item', confidence: 54, review: true },
]

export function CameraView({
  active,
  revealed,
  count,
  frozen = false,
}: {
  active: boolean
  revealed: number
  count: number
  frozen?: boolean
}) {
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-cyan/25 bg-[oklch(0.12_0.02_264)]">
      {/* simulated depth camera feed */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_100%_at_30%_20%,oklch(0.26_0.05_240),oklch(0.13_0.02_264)_70%)]" />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'linear-gradient(oklch(0.8 0.14 205 / 0.25) 1px, transparent 1px), linear-gradient(90deg, oklch(0.8 0.14 205 / 0.25) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* corner brackets */}
      {[
        'left-4 top-4 border-l-2 border-t-2',
        'right-4 top-4 border-r-2 border-t-2',
        'left-4 bottom-4 border-l-2 border-b-2',
        'right-4 bottom-4 border-r-2 border-b-2',
      ].map((pos) => (
        <span key={pos} className={cn('absolute h-8 w-8 rounded-sm border-cyan/70', pos)} />
      ))}

      {/* scanning line */}
      {active && !frozen && (
        <div className="absolute inset-x-6 top-0 h-[3px] animate-scan-sweep rounded-full bg-gradient-to-r from-transparent via-cyan to-transparent shadow-[0_0_20px_var(--cyan)]" />
      )}

      {/* detection boxes */}
      {DETECT_BOXES.slice(0, revealed).map((b, i) => (
        <div
          key={b.label + i}
          className={cn(
            'animate-rise absolute rounded-lg border-2 transition-all',
            b.review
              ? 'border-warning shadow-[0_0_20px_-2px_var(--warning)]'
              : 'border-cyan shadow-[0_0_20px_-2px_var(--cyan)]',
          )}
          style={{ top: b.top, left: b.left, width: b.width, height: b.height }}
        >
          <span
            className={cn(
              'absolute -top-7 left-0 flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold backdrop-blur-md',
              b.review ? 'bg-warning/20 text-warning' : 'bg-cyan/20 text-cyan',
            )}
          >
            {b.label} · {b.confidence}%
          </span>
        </div>
      ))}

      {/* status HUD */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-[oklch(0.1_0.02_264)] to-transparent p-4">
        <span
          className={cn(
            'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold backdrop-blur-md',
            active
              ? 'border-cyan/40 bg-cyan/15 text-cyan'
              : 'border-border bg-secondary/60 text-muted-foreground',
          )}
        >
          {active ? (
            <>
              <Radio className="h-3.5 w-3.5 animate-pulse" />
              AI Scan Active
            </>
          ) : (
            <>
              <Camera className="h-3.5 w-3.5" />
              Camera Ready
            </>
          )}
        </span>
        <span className="rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs font-semibold text-foreground backdrop-blur-md">
          {count} items found
        </span>
      </div>
    </div>
  )
}
