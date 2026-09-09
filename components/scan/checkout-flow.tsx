'use client'

import { GlassCard, StatusPill } from '@/components/ui-kit'
import { teams } from '@/lib/mock-data'
import { cn } from '@/lib/utils'
import {
  ArrowRight,
  Check,
  Minus,
  Plus,
  ScanLine,
  Sparkles,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

type Step = 0 | 1 | 2 | 3 | 4

const catalog = [
  { name: 'Arduino Uno', code: 'ELC-0421', confidence: 98 },
  { name: 'Ultrasonic Sensor', code: 'SNS-1180', confidence: 95 },
  { name: 'Precision Screwdriver', code: 'TL-0092', confidence: 92 },
]

type CartItem = { name: string; code: string; qty: number }

const STEP_LABELS = ['Assign', 'Scan', 'Review', 'Confirm', 'Done']

export function CheckoutFlow({ onExit }: { onExit: () => void }) {
  const [step, setStep] = useState<Step>(0)
  const [who, setWho] = useState<string | null>(null)
  const [scanned, setScanned] = useState(0)
  const [cart, setCart] = useState<CartItem[]>([])

  const current = catalog[scanned % catalog.length]

  function addToCart() {
    setCart((prev) => {
      const found = prev.find((c) => c.code === current.code)
      if (found) {
        return prev.map((c) => (c.code === current.code ? { ...c, qty: c.qty + 1 } : c))
      }
      return [...prev, { name: current.name, code: current.code, qty: 1 }]
    })
    setScanned((s) => s + 1)
  }

  function setQty(code: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) => (c.code === code ? { ...c, qty: Math.max(0, c.qty + delta) } : c))
        .filter((c) => c.qty > 0),
    )
  }

  const totalItems = cart.reduce((s, c) => s + c.qty, 0)

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan">
            Check Out
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold tracking-tight">
            {['Select User or Team', 'Scan Item', 'Check-out Summary', 'Confirm Check-out', 'Complete'][step]}
          </h2>
        </div>
        <button
          onClick={onExit}
          className="rounded-lg border border-border bg-secondary/60 px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Cancel
        </button>
      </div>

      {/* stepper */}
      <div className="mb-6 flex items-center gap-2">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                'grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition-all',
                i < step && 'bg-cyan text-primary-foreground',
                i === step && 'border-2 border-cyan text-cyan',
                i > step && 'border border-border text-muted-foreground',
              )}
            >
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            {i < STEP_LABELS.length - 1 && (
              <span
                className={cn(
                  'h-0.5 flex-1 rounded-full transition-all duration-500',
                  i < step ? 'bg-cyan' : 'bg-border',
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 0: assign */}
      {step === 0 && (
        <GlassCard strong className="animate-rise p-5">
          <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4 text-cyan" />
            Who is taking these items?
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {teams.map((t) => (
              <button
                key={t}
                onClick={() => setWho(t)}
                className={cn(
                  'flex items-center justify-between rounded-xl border p-4 text-left transition-all',
                  who === t
                    ? 'border-cyan/50 bg-cyan/10'
                    : 'border-border bg-secondary/40 hover:border-border/80',
                )}
              >
                <span className="font-medium">{t}</span>
                <span
                  className={cn(
                    'grid h-5 w-5 place-items-center rounded-full border',
                    who === t ? 'border-cyan bg-cyan text-primary-foreground' : 'border-border',
                  )}
                >
                  {who === t && <Check className="h-3 w-3" />}
                </span>
              </button>
            ))}
          </div>
          <button
            disabled={!who}
            onClick={() => setStep(1)}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan to-teal px-5 py-3 text-sm font-semibold text-primary-foreground transition-all enabled:hover:shadow-[0_0_30px_-4px_var(--cyan)] disabled:opacity-40"
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </button>
        </GlassCard>
      )}

      {/* Step 1: scan */}
      {step === 1 && (
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <GlassCard strong className="animate-rise flex flex-col p-5">
            <div className="relative grid flex-1 place-items-center overflow-hidden rounded-xl border border-cyan/25 bg-[oklch(0.12_0.02_264)] py-14">
              <div className="absolute inset-x-8 top-0 h-[3px] animate-scan-sweep rounded-full bg-gradient-to-r from-transparent via-cyan to-transparent" />
              <div className="text-center">
                <ScanLine className="mx-auto h-10 w-10 text-cyan" />
                <p className="mt-3 text-sm text-muted-foreground">Point at an item barcode</p>
              </div>
            </div>

            {/* Item Found */}
            <div className="mt-4 animate-rise rounded-xl border border-cyan/30 bg-cyan/5 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-cyan">
                  Item Found
                </span>
                <StatusPill label={`${current.confidence}% match`} tone="success" />
              </div>
              <p className="mt-2 font-display text-lg font-semibold">{current.name}</p>
              <p className="text-sm text-muted-foreground">Code {current.code}</p>
              <button
                onClick={addToCart}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan/15 px-4 py-2.5 text-sm font-semibold text-cyan transition-colors hover:bg-cyan/25"
              >
                <Plus className="h-4 w-4" />
                Add Item
              </button>
            </div>
          </GlassCard>

          {/* Cart */}
          <GlassCard strong className="flex flex-col p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold">In this check-out</h3>
              <span className="text-sm text-muted-foreground">{totalItems} items</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Assigned to <span className="text-foreground">{who}</span>
            </p>

            <div className="mt-4 flex flex-1 flex-col gap-2">
              {cart.length === 0 ? (
                <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                  Scan and add items to build the list.
                </div>
              ) : (
                cart.map((c) => (
                  <div
                    key={c.code}
                    className="animate-rise flex items-center gap-3 rounded-xl border border-border bg-secondary/40 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.code}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setQty(c.code, -1)}
                        className="grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-5 text-center text-sm font-semibold">{c.qty}</span>
                      <button
                        onClick={() => setQty(c.code, 1)}
                        className="grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              disabled={cart.length === 0}
              onClick={() => setStep(2)}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan to-teal px-5 py-3 text-sm font-semibold text-primary-foreground transition-all enabled:hover:shadow-[0_0_30px_-4px_var(--cyan)] disabled:opacity-40"
            >
              Review Check-out
              <ArrowRight className="h-4 w-4" />
            </button>
          </GlassCard>
        </div>
      )}

      {/* Step 2: summary */}
      {step === 2 && (
        <GlassCard strong className="mx-auto max-w-xl animate-rise p-6">
          <h3 className="font-display text-lg font-semibold">Check-out Summary</h3>
          <p className="text-sm text-muted-foreground">
            Assigned to <span className="text-foreground">{who}</span>
          </p>
          <div className="mt-4 flex flex-col gap-2">
            {cart.map((c) => (
              <div
                key={c.code}
                className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 p-3.5"
              >
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.code}</p>
                </div>
                <span className="text-sm text-muted-foreground">Qty {c.qty}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between rounded-xl border border-cyan/30 bg-cyan/10 p-4">
            <span className="font-medium">Total items</span>
            <span className="font-display text-2xl font-bold text-cyan">{totalItems}</span>
          </div>
          <button
            onClick={() => setStep(3)}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan to-teal px-5 py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:shadow-[0_0_30px_-4px_var(--cyan)]"
          >
            Confirm Check-out
          </button>
        </GlassCard>
      )}

      {/* Step 3 -> confirm animation */}
      {step === 3 && (
        <GlassCard strong className="mx-auto max-w-md animate-rise p-8 text-center">
          <div className="relative mx-auto grid h-16 w-16 place-items-center">
            <span
              className="absolute inset-0 rounded-full bg-cyan/40"
              style={{ animation: 'pulse-ring 1.6s ease-out infinite' }}
            />
            <span className="relative grid h-16 w-16 place-items-center rounded-full bg-cyan/20 text-cyan">
              <Sparkles className="h-7 w-7" />
            </span>
          </div>
          <p className="mt-4 font-medium">Assigning items to {who}...</p>
          <button
            onClick={() => setStep(4)}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan to-teal px-5 py-3 text-sm font-semibold text-primary-foreground transition-all hover:shadow-[0_0_30px_-4px_var(--cyan)]"
          >
            Finish
          </button>
        </GlassCard>
      )}

      {/* Step 4: complete */}
      {step === 4 && (
        <GlassCard strong className="mx-auto max-w-md animate-rise p-8 text-center">
          <div className="relative mx-auto grid h-20 w-20 place-items-center">
            <span
              className="absolute inset-0 rounded-full bg-success/40"
              style={{ animation: 'pulse-ring 1.8s ease-out infinite' }}
            />
            <span className="relative grid h-20 w-20 place-items-center rounded-full bg-success/20 text-success">
              <Check className="h-10 w-10" />
            </span>
          </div>
          <h3 className="mt-5 font-display text-2xl font-bold">Check-out Complete</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalItems} items assigned to {who}.
          </p>
          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
            <button
              onClick={onExit}
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-cyan to-teal px-5 py-3 text-sm font-semibold text-primary-foreground transition-all hover:shadow-[0_0_30px_-4px_var(--cyan)]"
            >
              Done
            </button>
            <Link
              href="/activity"
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-border bg-secondary/60 px-5 py-3 text-sm font-medium transition-colors hover:text-cyan"
            >
              View Activity
            </Link>
          </div>
        </GlassCard>
      )}
    </div>
  )
}
