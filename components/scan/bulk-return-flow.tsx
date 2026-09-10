'use client'

import { CountUp, GlassCard, StatusPill } from '@/components/ui-kit'
import {
  confirmDetection,
  countBulkReturnItems,
  detectItems,
  getBulkReturnReviewCandidates,
  previewBulkReturnStockUpdate,
  returnItems,
} from '@/lib/services/scan-service'
import type { BulkReturnItem, ReviewCandidate } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  ArrowRight,
  Camera,
  Check,
  ChevronDown,
  Clock3,
  PackageCheck,
  RefreshCw,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { CameraView } from './camera-view'

type Stage = 'camera' | 'scanning' | 'found' | 'review' | 'summary' | 'updated'

export function BulkReturnFlow({
  onExit,
  initialStage = 'camera',
}: {
  onExit: () => void
  initialStage?: Stage
}) {
  const detectedItems = detectItems()
  const reviewCandidates = getBulkReturnReviewCandidates()
  const defaultReviewCandidate = reviewCandidates[0]!
  const [stage, setStage] = useState<Stage>(initialStage)
  const [revealed, setRevealed] = useState(initialStage === 'review' ? detectedItems.length : 0)
  const [confirmedReviewCandidate, setConfirmedReviewCandidate] =
    useState<ReviewCandidate>(defaultReviewCandidate)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    return () => timers.current.forEach(clearTimeout)
  }, [])

  function clearScanTimers() {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  function startScan() {
    clearScanTimers()
    setStage('scanning')
    setRevealed(0)
    setConfirmedReviewCandidate(defaultReviewCandidate)
    detectedItems.forEach((_, i) => {
      timers.current.push(
        setTimeout(() => setRevealed(i + 1), 700 + i * 900),
      )
    })
    timers.current.push(
      setTimeout(() => setStage('found'), 700 + detectedItems.length * 900 + 500),
    )
  }

  const revealedCount = stage === 'camera' ? 0 : revealed
  const reviewItems = detectedItems.filter((i) => i.status === 'review')
  const confirmedItems = detectedItems.map((item) =>
    item.status === 'review' ? confirmDetection(item, confirmedReviewCandidate) : item,
  )
  const totalItems = countBulkReturnItems(confirmedItems)

  return (
    <div>
      <FlowHeader
        stage={stage}
        onExit={onExit}
      />

      {(stage === 'camera' || stage === 'scanning' || stage === 'found') && (
        <div className="grid gap-5 lg:grid-cols-[1.45fr_0.95fr]">
          <div className="relative">
            <CameraView
              active={stage === 'scanning' || stage === 'found'}
              revealed={revealedCount}
              count={revealedCount}
              frozen={stage === 'found'}
            />
            {stage === 'camera' && (
              <div className="absolute inset-0 grid place-items-center rounded-2xl bg-[oklch(0.075_0.018_264/0.62)] p-6 backdrop-blur-sm">
                <div className="animate-rise flex max-w-xs flex-col items-center text-center">
                  <span className="grid h-14 w-14 place-items-center rounded-2xl border border-violet/35 bg-violet/15 text-violet shadow-[0_0_32px_-16px_var(--violet)]">
                    <Camera className="h-6 w-6" />
                  </span>
                  <p className="mt-4 text-sm text-muted-foreground">
                    Point the camera at returned items.
                  </p>
                  <button
                    onClick={startScan}
                    className="group cta-sheen mt-5 inline-flex items-center gap-2.5 rounded-xl px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:shadow-[0_0_34px_-4px_var(--violet)]"
                  >
                    <Camera className="h-5 w-5" />
                    Start Camera
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Items found panel */}
          <GlassCard strong className="flex flex-col p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold">Items Found</h3>
              <span className="text-sm text-muted-foreground">
                {revealedCount} detected
              </span>
            </div>

            <div className="mt-4 flex flex-1 flex-col gap-2.5">
              {stage === 'camera' ? (
                <div className="grid min-h-[250px] flex-1 place-items-center rounded-xl border border-dashed border-border bg-secondary/20 py-10 text-center">
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
                detectedItems.slice(0, revealedCount).map((item, i) => (
                  <div
                    key={item.id}
                    className={cn(
                      'animate-rise premium-hover rounded-2xl border p-3.5',
                      item.status === 'ready'
                        ? 'border-success/18 bg-success/[0.045]'
                        : 'border-warning/30 bg-warning/[0.055]',
                    )}
                    style={{ animationDelay: `${i * 70}ms` }}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
                          item.status === 'ready'
                            ? 'bg-success/15 text-success'
                            : 'bg-warning/15 text-warning',
                        )}
                      >
                        {item.status === 'ready' ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <TriangleAlert className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{item.itemName}</p>
                            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                              {item.itemCode}
                            </p>
                          </div>
                          <StatusPill
                            label={item.status === 'ready' ? 'Ready' : 'Review Needed'}
                            tone={item.status === 'ready' ? 'success' : 'warning'}
                          />
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div className="rounded-lg border border-border bg-secondary/35 px-3 py-2">
                            <p className="text-[11px] text-muted-foreground">Qty</p>
                            <p className="font-display text-lg font-semibold">{item.quantity}</p>
                          </div>
                          <div className="rounded-lg border border-border bg-secondary/35 px-3 py-2">
                            <p className="text-[11px] text-muted-foreground">Confidence</p>
                            <p
                              className={cn(
                                'font-display text-lg font-semibold',
                                item.status === 'ready' ? 'text-success' : 'text-warning',
                              )}
                            >
                              {item.confidence}%
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {stage === 'found' && (
              <button
                onClick={() => setStage(reviewItems.length ? 'review' : 'summary')}
                className="cta-sheen-cyan mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-primary-foreground transition-all hover:shadow-[0_0_30px_-4px_var(--cyan)]"
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
          candidates={reviewCandidates}
          onConfirm={(candidate) => {
            setConfirmedReviewCandidate(candidate)
            setStage('summary')
          }}
          onScanAgain={() => {
            clearScanTimers()
            setRevealed(0)
            setStage('camera')
          }}
        />
      )}

      {stage === 'summary' && (
        <ReturnSummary
          total={totalItems}
          items={confirmedItems}
          onConfirm={() => setStage('updated')}
        />
      )}

      {stage === 'updated' && (
        <InventoryUpdated onExit={onExit} items={confirmedItems} />
      )}
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
    <div className="mb-5 animate-rise">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-violet">
            Bulk Return
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold tracking-tight">
            {titles[stage]}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Step {idx + 1} of {order.length}</p>
        </div>
        <button
          onClick={onExit}
          className="rounded-lg border border-border bg-secondary/60 px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Cancel
        </button>
      </div>
      <div className="mt-4 flex gap-1.5 rounded-full border border-border bg-secondary/20 p-1">
        {order.map((s, i) => (
          <span
            key={s}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-all duration-500',
              i <= idx ? 'bg-gradient-to-r from-violet to-cyan shadow-[0_0_12px_-5px_var(--cyan)]' : 'bg-border',
            )}
          />
        ))}
      </div>
    </div>
  )
}

function ReviewNeeded({
  candidates,
  onConfirm,
  onScanAgain,
}: {
  candidates: ReviewCandidate[]
  onConfirm: (candidate: ReviewCandidate) => void
  onScanAgain: () => void
}) {
  const [why, setWhy] = useState(false)
  const [choice, setChoice] = useState(candidates[0]?.id ?? '')
  const selected = candidates.find((m) => m.id === choice) ?? candidates[0]!
  const nextChoice = candidates.find((m) => m.id !== choice) ?? selected

  return (
    <GlassCard strong className="mx-auto max-w-4xl animate-rise overflow-hidden p-6">
      <div className="grid gap-6 md:grid-cols-[0.9fr_1.1fr]">
        <div>
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-warning/15 text-warning">
              <TriangleAlert className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-display text-lg font-semibold">Review Needed</h3>
              <p className="text-sm text-muted-foreground">
                We are not fully sure about this item.
              </p>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-warning/25 bg-warning/[0.045] p-3">
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-[oklch(0.1_0.02_264)]">
              <div className="absolute inset-0 bg-[radial-gradient(90%_75%_at_50%_42%,oklch(0.82_0.15_78/0.16),transparent_70%)]" />
              <div className="absolute left-1/2 top-1/2 h-24 w-36 -translate-x-1/2 -translate-y-1/2 rounded-[1.25rem] border border-warning/35 bg-secondary/70 shadow-[0_0_30px_-18px_var(--warning)]" />
              <div className="absolute left-[42%] top-[38%] h-5 w-16 rounded-full border border-warning/40 bg-warning/10" />
              {[
                'left-4 top-4 border-l-2 border-t-2',
                'right-4 top-4 border-r-2 border-t-2',
                'left-4 bottom-4 border-l-2 border-b-2',
                'right-4 bottom-4 border-r-2 border-b-2',
              ].map((pos) => (
                <span key={pos} className={cn('absolute h-7 w-7 border-warning/65', pos)} />
              ))}
            </div>
            <p className="mt-2 text-xs font-medium uppercase tracking-wide text-warning">
              Captured item
            </p>
          </div>
        </div>

        <div>
          <div className="flex flex-col gap-2.5">
            <p className="text-sm font-medium text-muted-foreground">Possible matches</p>
            {candidates.map((m) => (
              <button
                key={m.id}
                onClick={() => setChoice(m.id)}
                className={cn(
                  'premium-hover rounded-2xl border p-3.5 text-left',
                  choice === m.id
                    ? 'border-cyan/50 bg-cyan/10'
                    : 'border-border bg-secondary/40 hover:border-border/80',
                )}
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="font-medium">{m.itemName}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">{m.confidence}%</span>
                    <span
                      className={cn(
                        'grid h-5 w-5 place-items-center rounded-full border',
                        choice === m.id
                          ? 'border-cyan bg-cyan text-primary-foreground'
                          : 'border-border',
                      )}
                    >
                      {choice === m.id && <Check className="h-3 w-3" />}
                    </span>
                  </span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary/70">
                  <span
                    className={cn(
                      'block h-full rounded-full',
                      choice === m.id
                        ? 'bg-gradient-to-r from-cyan to-teal'
                        : 'bg-muted-foreground/35',
                    )}
                    style={{ width: `${m.confidence}%` }}
                  />
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={() => setWhy((v) => !v)}
            className="mt-4 flex w-full items-center justify-between rounded-xl border border-border bg-secondary/30 px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Why?
            <ChevronDown className={cn('h-4 w-4 transition-transform', why && 'rotate-180')} />
          </button>
          {why && (
            <ul className="animate-rise mt-2 space-y-1.5 rounded-xl border border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
              <li>Similar shape detected</li>
              <li>Label was partly hidden</li>
              <li>Image confidence was low</li>
            </ul>
          )}

          <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
            <button
              onClick={() => onConfirm(selected)}
              className="cta-sheen-cyan inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-primary-foreground transition-all hover:shadow-[0_0_30px_-4px_var(--cyan)]"
            >
              <Check className="h-4 w-4" />
              Confirm Item
            </button>
            <button
              onClick={() => setChoice(nextChoice.id)}
              className="rounded-xl border border-border bg-secondary/60 px-5 py-3 text-sm font-medium transition-colors hover:text-cyan"
            >
              Choose Another Item
            </button>
            <button
              onClick={onScanAgain}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary/60 px-5 py-3 text-sm font-medium transition-colors hover:text-cyan"
            >
              <RefreshCw className="h-4 w-4" />
              Scan Again
            </button>
          </div>
        </div>
      </div>
    </GlassCard>
  )
}

function ReturnSummary({
  total,
  items,
  onConfirm,
}: {
  total: number
  items: BulkReturnItem[]
  onConfirm: () => void
}) {
  const reviewedCount = items.filter((item) => item.status === 'reviewed').length

  return (
    <GlassCard strong className="mx-auto max-w-2xl animate-rise overflow-hidden p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold">Return Summary</h3>
          <p className="text-sm text-muted-foreground">Review before you confirm the return.</p>
        </div>
        {reviewedCount > 0 && <StatusPill label={`${reviewedCount} reviewed`} tone="warning" />}
      </div>

      <div className="mt-5 flex flex-col gap-2.5">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              'flex items-center justify-between gap-4 rounded-xl border p-3.5',
              item.status === 'reviewed'
                ? 'border-warning/25 bg-warning/[0.045]'
                : 'border-border bg-secondary/40',
            )}
          >
            <div className="min-w-0">
              <span className="block truncate font-medium">{item.itemName}</span>
              {item.status === 'reviewed' && (
                <span className="mt-0.5 block text-xs text-warning">
                  Reviewed · {item.confidence}%
                </span>
              )}
            </div>
            <span className="shrink-0 text-sm text-muted-foreground">Qty {item.quantity}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between rounded-xl border border-cyan/30 bg-cyan/10 p-4">
        <span className="font-medium">Total items</span>
        <span className="font-display text-2xl font-bold text-cyan">
          <CountUp value={total} />
        </span>
      </div>

      <button
        onClick={onConfirm}
        className="cta-sheen mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:shadow-[0_0_34px_-4px_var(--violet)]"
      >
        <PackageCheck className="h-5 w-5" />
        Confirm Return
      </button>
    </GlassCard>
  )
}

function InventoryUpdated({
  onExit,
  items,
}: {
  onExit: () => void
  items: BulkReturnItem[]
}) {
  const stockRows = previewBulkReturnStockUpdate(items)
  const result = returnItems(items)

  return (
    <div className="mx-auto max-w-2xl">
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

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-success/20 bg-success/[0.055] p-3">
            <p className="font-display text-xl font-bold text-success">
              <CountUp value={result.totalItems} />
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">items returned</p>
          </div>
          <div className="rounded-xl border border-border bg-secondary/40 p-3">
            <p className="font-display text-xl font-bold text-cyan">
              <CountUp value={result.reviewRemaining} />
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">items need review</p>
          </div>
          <div className="rounded-xl border border-border bg-secondary/40 p-3">
            <p className="flex items-center justify-center gap-1.5 font-display text-xl font-bold text-cyan">
              <Clock3 className="h-4 w-4" />
              8.4s
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">completed in</p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2 text-left">
          {stockRows.map((b) => (
            <div
              key={b.name}
              className="animate-rise flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/30 px-4 py-3"
            >
              <span className="text-sm font-medium">{b.name}</span>
              <span className="flex shrink-0 items-center gap-2 text-sm">
                <span className="text-muted-foreground">{b.before} available</span>
                <ArrowRight className="h-3.5 w-3.5 text-success" />
                <span className="font-semibold text-success">
                  <CountUp value={b.after} /> available
                </span>
              </span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <button
            onClick={onExit}
            className="cta-sheen-cyan inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-primary-foreground transition-all hover:shadow-[0_0_30px_-4px_var(--cyan)]"
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
