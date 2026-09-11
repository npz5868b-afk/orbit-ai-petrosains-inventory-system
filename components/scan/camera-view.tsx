'use client'

import { cn } from '@/lib/utils'
import { Camera, Radio } from 'lucide-react'

type BoundingBox = {
  x: number
  y: number
  w: number
  h: number
}

type CameraDetection = {
  detection_id: string
  item: {
    id: string
    sku: string
    name: string
    image_url: string | null
  } | null
  quantity: number
  confidence: number
  status: 'ready' | 'review_needed' | 'resolved' | 'rejected'
  bbox: BoundingBox | null
  bboxes: BoundingBox[]
}

export function CameraView({
  active,
  revealed,
  count,
  frozen = false,
  imageUrl = null,
  detections = [],
}: {
  active: boolean
  revealed: number
  count: number
  frozen?: boolean
  imageUrl?: string | null
  detections?: CameraDetection[]
}) {
  const visibleDetections = detections
    .filter((detection) => detection.status !== 'rejected')
    .slice(0, revealed)

  return (
    <div className="relative aspect-[16/10] min-h-[280px] w-full overflow-hidden rounded-2xl border border-cyan/25 bg-[oklch(0.1_0.024_264)] shadow-[0_22px_80px_-44px_var(--cyan)]">

      {/* Real scanned image */}
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="Scanned inventory"
          className="absolute inset-0 z-0 h-full w-full object-contain"
        />
      ) : (
        <>
          <div className="absolute inset-0 z-0 bg-[radial-gradient(120%_100%_at_24%_18%,oklch(0.28_0.05_240),oklch(0.12_0.024_264)_68%,oklch(0.08_0.018_264)_100%)]" />
          <div className="absolute inset-0 z-0 bg-[radial-gradient(70%_55%_at_50%_45%,oklch(0.8_0.14_205/0.12),transparent_72%)]" />
        </>
      )}

      {/* Tech grid */}
      <div
        className="pointer-events-none absolute inset-0 z-10 opacity-20"
        style={{
          backgroundImage:
            'linear-gradient(oklch(0.8 0.14 205 / 0.24) 1px, transparent 1px), linear-gradient(90deg, oklch(0.8 0.14 205 / 0.18) 1px, transparent 1px)',
          backgroundSize: '42px 42px',
          animation:
            active && !frozen
              ? 'depth-grid-pan 6s linear infinite'
              : undefined,
        }}
      />

      <div className="pointer-events-none absolute inset-x-8 top-1/2 z-10 h-px bg-gradient-to-r from-transparent via-cyan/30 to-transparent" />

      <div className="pointer-events-none absolute inset-y-8 left-1/2 z-10 w-px bg-gradient-to-b from-transparent via-cyan/20 to-transparent" />

      {/* Corner brackets */}
      {[
        'left-5 top-5 border-l-2 border-t-2',
        'right-5 top-5 border-r-2 border-t-2',
        'left-5 bottom-5 border-l-2 border-b-2',
        'right-5 bottom-5 border-r-2 border-b-2',
      ].map((pos) => (
        <span
          key={pos}
          className={cn(
            'pointer-events-none absolute z-20 h-10 w-10 rounded-sm border-cyan/65 shadow-[0_0_18px_-8px_var(--cyan)]',
            pos,
          )}
        />
      ))}

      {/* Scanning animation */}
      {active && !frozen && (
        <>
          <div className="pointer-events-none absolute inset-x-7 top-0 z-20 h-[3px] animate-scan-sweep rounded-full bg-gradient-to-r from-transparent via-cyan to-transparent shadow-[0_0_22px_var(--cyan)]" />

          <div className="pointer-events-none absolute inset-x-8 top-0 z-20 h-28 animate-scan-sweep bg-gradient-to-b from-cyan/12 to-transparent blur-sm" />
        </>
      )}

      {/* REAL YOLO instance boxes */}
      {visibleDetections.flatMap((detection) => {
        const boxes =
          detection.bboxes?.length
            ? detection.bboxes
            : detection.bbox
              ? [detection.bbox]
              : []

        return boxes.map((bbox, index) => {
          const needsReview = detection.status === 'review_needed'

          return (
            <div
              key={`${detection.detection_id}-${index}`}
              className={cn(
                'detection-reveal absolute z-20 rounded-lg border-2 transition-all',
                needsReview
                  ? 'border-warning/90 bg-warning/[0.04] shadow-[0_0_22px_-6px_var(--warning)]'
                  : 'border-cyan/90 bg-cyan/[0.025] shadow-[0_0_22px_-7px_var(--cyan)]',
              )}
              style={{
                left: `${bbox.x * 100}%`,
                top: `${bbox.y * 100}%`,
                width: `${bbox.w * 100}%`,
                height: `${bbox.h * 100}%`,
                animationDelay: `${index * 90}ms`,
              }}
            >
              <span
                className={cn(
                  'absolute -top-8 left-0 flex max-w-[min(18rem,75vw)] items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-semibold backdrop-blur-md',
                  needsReview
                    ? 'border-warning/30 bg-warning/15 text-warning'
                    : 'border-cyan/30 bg-cyan/15 text-cyan',
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />

                {detection.item?.name ?? 'Unknown item'}

                {boxes.length > 1
                  ? ` ${index + 1}/${boxes.length}`
                  : ''}

                {index === 0
                  ? ` - ${Math.round(detection.confidence * 100)}%`
                  : ''}
              </span>
            </div>
          )
        })
      })}

      {/* Bottom HUD */}
      <div className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 bg-gradient-to-t from-[oklch(0.075_0.018_264/0.98)] via-[oklch(0.075_0.018_264/0.68)] to-transparent p-4">
        <span
          className={cn(
            'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold backdrop-blur-md',
            active
              ? 'status-soft-pulse border-cyan/40 bg-cyan/15 text-cyan'
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