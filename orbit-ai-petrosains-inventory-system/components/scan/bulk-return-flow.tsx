'use client'

import { GlassCard, StatusPill } from '@/components/ui-kit'
import { scannedItems } from '@/lib/mock-data'
import { cn } from '@/lib/utils'
import {
  ArrowRight,
  Camera,
  Check,
  ChevronDown,
  PackageCheck,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { CameraView, DETECT_BOXES } from './camera-view'

type Stage = 'camera' | 'scanning' | 'found' | 'review' | 'summary' | 'updated'

const beforeAfter = [
  { name: 'Arduino Uno', before: 9, after: 12 },
  { name: 'Ultrasonic Sensor', before: 14, after: 16 },
  { name: 'Precision Screwdriver', before: 22, after: 23 },
  { name: 'IR Sensor', before: 3, after: 4 },
]

export function BulkReturnFlow({ onExit }: { onExit: () => void }) {
  const [stage, setStage] = useState<Stage>('camera')
  const [revealed, setRevealed] = useState(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    return () => timers.current.forEach(clearTimeout)
  }, [])

  function startScan() {
    setStage('scanning')
    setRevealed(0)
    DETECT_BOXES.forEach((_, i) => {
      timers.current.push(
        setTimeout(() => setRevealed(i + 1), 700 + i * 900),
      )
    })
    timers.current.push(
      setTimeout(() => setStage('found'), 700 + DETECT_BOXES.length * 900 + 500),
    )
  }

  const readyItems = scannedItems.filter((i) => i.status === 'ready')
  const reviewItems = scannedItems.filter((i) => i.status === 'review')
  const totalReady = readyItems.reduce((s, i) => s + i.qty, 0)

  return (
    <div>
      <FlowHeader
        stage={stage}
        onExit={onExit}
      />

      {(stage === 'camera' || stage === 'scanning' || stage === 'found') && (
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <div className="relative">
            <CameraView
              active={stage === 'scanning' || stage === 'found'}
              revealed={stage === 'camera' ? 0 : revealed}
              count={stage === 'camera' ? 0 : revealed}
              frozen={stage === 'found'}
            />
            {stage === 'camera' && (
              <div className="absolute inset-0 grid place-items-center rounded-2xl bg-[oklch(0.1_0.02_264/0.55)] backdrop-blur-sm">
                <button
                  onClick={startScan}
                  className="group inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-violet to-cyan px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:shadow-[0_0_34px_-4px_var(--violet)]"
                >
                  <Camera className="h-5 w-5" />
                  Start Camera
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
            )}
          </div>

          {/* Items found panel */}
          <GlassCard strong className="flex flex-col p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold">Items Found</h3>
              <span className="text-sm text-muted-foreground">
                {stage === 'camera' ? 0 : revealed} detected
              </span>
            </div>

            <div className="mt-4 flex flex-1 flex-col gap-2.5">
              {stage === 'camera' ? (
                <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border py-10 text-center">
                  <div>
                    <Sparkles className="mx-auto h-6 w-6 text-cyan" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      Point the camera at returned items.
                      <br />
                      AI will detect them automatically.
                    </p>
                  </div>
                </div>
              ) : (
                scannedItems.slice(0, revealed).map((item) => (
                  <div
                    key={item.id}
                    className="animate-rise flex items-center gap-3 rounded-xl border border-border bg-secondary/40 p-3"
                  >
                    <span
                      className={cn(
                        'grid h-9 w-9 shrink-0 place-items-center rounded-lg',
                        item.status === 'ready'
                          ? 'bg-success/15 text-success'
                          : 'bg-warning/15 text-warning',
                      )}
                    >
                      {item.status === 'ready' ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {item.name}{' '}
                        <span className="text-muted-foreground">×{item.qty}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.confidence}% confidence
                      </p>
                    </div>
                    <StatusPill
                      label={item.status === 'ready' ? 'Ready' : 'Review Needed'}
                      tone={item.status === 'ready' ? 'success' : 'warning'}
                    />
                  </div>
                ))
              )}
            </div>

            {stage === 'found' && (
              <button
                onClick={() => setStage(reviewItems.length ? 'review' : 'summary')}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan to-teal px-5 py-3 text-sm font-semibold text-primary-foreground transition-all hover:shadow-[0_0_30px_-4px_var(--cyan)]"
              >
                {reviewItems.length ? `Review ${reviewItems.length} item` : 'Continue to Summary'}
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </GlassCard>
        </div>
      )}

      {stage === 'review' && (
        <ReviewNeeded
          onConfirm={() => setStage('summary')}
        />
      )}

      {stage === 'summary' && (
        <ReturnSummary
          total={totalReady + reviewItems.reduce((s, i) => s + i.qty, 0)}
          onConfirm={() => setStage('updated')}
        />
      )}

      {stage === 'updated' && <InventoryUpdated onExit={onExit} />}
    </div>
  )
}

function FlowHeader({ stage, onExit }: { stage: Stage; onExit: () => void }) {
  const titles: Record<Stage, string> = {
    camera: 'Start Camera',
    scanning: 'Scanning Items',
    found: 'Items Found',
    review: 'Review Needed',
    summary: 'Return Summary',
    updated: 'Inventory Updated',
  }
  const order: Stage[] = ['camera', 'scanning', 'found', 'review', 'summary', 'updated']
  const idx = order.indexOf(stage)
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-violet">
            Bulk Return
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold tracking-tight">
            {titles[stage]}
          </h2>
        </div>
        <button
          onClick={onExit}
          className="rounded-lg border border-border bg-secondary/60 px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Cancel
        </button>
      </div>
      <div className="mt-4 flex gap-1.5">
        {order.map((s, i) => (
          <span
            key={s}
            className={cn(
              'h-1 flex-1 rounded-full transition-all duration-500',
              i <= idx ? 'bg-gradient-to-r from-violet to-cyan' : 'bg-border',
            )}
          />
        ))}
      </div>
    </div>
  )
}

function ReviewNeeded({ onConfirm }: { onConfirm: () => void }) {
  const [why, setWhy] = useState(false)
  const [choice, setChoice] = useState('ultrasonic')
  const matches = [
    { id: 'ultrasonic', name: 'Ultrasonic Sensor', conf: 54 },
    { id: 'ir', name: 'IR Sensor', conf: 39 },
  ]
  return (
    <GlassCard strong className="mx-auto max-w-xl animate-rise p-6">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-warning/15 text-warning">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-display text-lg font-semibold">Review Needed</h3>
          <p className="text-sm text-muted-foreground">
            We are not fully sure about this item.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2.5">
        <p className="text-sm font-medium text-muted-foreground">Possible matches</p>
        {matches.map((m) => (
          <button
            key={m.id}
            onClick={() => setChoice(m.id)}
            className={cn(
              'flex items-center justify-between rounded-xl border p-3.5 text-left transition-all',
              choice === m.id
                ? 'border-cyan/50 bg-cyan/10'
                : 'border-border bg-secondary/40 hover:border-border/80',
            )}
          >
            <span className="font-medium">{m.name}</span>
            <span className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">{m.conf}%</span>
              <span
                className={cn(
                  'grid h-5 w-5 place-items-center rounded-full border',
                  choice === m.id ? 'border-cyan bg-cyan text-primary-foreground' : 'border-border',
                )}
              >
                {choice === m.id && <Check className="h-3 w-3" />}
              </span>
            </span>
          </button>
        ))}
      </div>

      <button
        onClick={() => setWhy((v) => !v)}
        className="mt-4 flex w-full items-center justify-between rounded-xl border border-border bg-secondary/30 px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        Why is this uncertain?
        <ChevronDown className={cn('h-4 w-4 transition-transform', why && 'rotate-180')} />
      </button>
      {why && (
        <ul className="animate-rise mt-2 space-y-1.5 rounded-xl border border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
          <li>· Similar shape detected between two sensors</li>
          <li>· Label was partly hidden from the camera</li>
          <li>· Image confidence was low in this lighting</li>
        </ul>
      )}

      <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
        <button
          onClick={onConfirm}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan to-teal px-5 py-3 text-sm font-semibold text-primary-foreground transition-all hover:shadow-[0_0_30px_-4px_var(--cyan)]"
        >
          <Check className="h-4 w-4" />
          Confirm Item
        </button>
        <button className="rounded-xl border border-border bg-secondary/60 px-5 py-3 text-sm font-medium transition-colors hover:text-cyan">
          Choose Another
        </button>
        <button className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary/60 px-5 py-3 text-sm font-medium transition-colors hover:text-cyan">
          <RefreshCw className="h-4 w-4" />
          Scan Again
        </button>
      </div>
    </GlassCard>
  )
}

function ReturnSummary({ total, onConfirm }: { total: number; onConfirm: () => void }) {
  return (
    <GlassCard strong className="mx-auto max-w-xl animate-rise p-6">
      <h3 className="font-display text-lg font-semibold">Return Summary</h3>
      <p className="text-sm text-muted-foreground">Review before you confirm the return.</p>

      <div className="mt-5 flex flex-col gap-2">
        {scannedItems.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 p-3.5"
          >
            <span className="font-medium">
              {item.status === 'review' ? 'Ultrasonic Sensor' : item.name}
            </span>
            <span className="text-sm text-muted-foreground">Qty {item.qty}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between rounded-xl border border-cyan/30 bg-cyan/10 p-4">
        <span className="font-medium">Total items</span>
        <span className="font-display text-2xl font-bold text-cyan">{total}</span>
      </div>

      <button
        onClick={onConfirm}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet to-cyan px-5 py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:shadow-[0_0_34px_-4px_var(--violet)]"
      >
        <PackageCheck className="h-5 w-5" />
        Confirm Return
      </button>
    </GlassCard>
  )
}

function InventoryUpdated({ onExit }: { onExit: () => void }) {
  return (
    <div className="mx-auto max-w-xl">
      <GlassCard strong className="animate-rise overflow-hidden p-6 text-center">
        <div className="relative mx-auto grid h-20 w-20 place-items-center">
          <span
            className="absolute inset-0 rounded-full bg-success/40"
            style={{ animation: 'pulse-ring 1.8s ease-out infinite' }}
          />
          <span className="relative grid h-20 w-20 place-items-center rounded-full bg-success/20 text-success">
            <Check className="h-10 w-10" />
          </span>
        </div>
        <h3 className="mt-5 font-display text-2xl font-bold tracking-tight">
          Inventory Updated
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything synced successfully.
        </p>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            { k: '7', v: 'items returned' },
            { k: '0', v: 'need review' },
            { k: '8.4s', v: 'completed in' },
          ].map((s) => (
            <div key={s.v} className="rounded-xl border border-border bg-secondary/40 p-3">
              <p className="font-display text-xl font-bold text-cyan">{s.k}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{s.v}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-2 text-left">
          {beforeAfter.map((b) => (
            <div
              key={b.name}
              className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 px-4 py-3"
            >
              <span className="text-sm font-medium">{b.name}</span>
              <span className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{b.before} available</span>
                <ArrowRight className="h-3.5 w-3.5 text-success" />
                <span className="font-semibold text-success">{b.after} available</span>
              </span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <button
            onClick={onExit}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan to-teal px-5 py-3 text-sm font-semibold text-primary-foreground transition-all hover:shadow-[0_0_30px_-4px_var(--cyan)]"
          >
            Done
          </button>
          <Link
            href="/activity"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-secondary/60 px-5 py-3 text-sm font-medium transition-colors hover:text-cyan"
          >
            View Activity
          </Link>
        </div>
      </GlassCard>
    </div>
  )
}
