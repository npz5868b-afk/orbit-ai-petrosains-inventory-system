'use client'

import { cn } from '@/lib/utils'
import { ArrowRight, PackageCheck, ScanLine } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { BulkReturnFlow } from './bulk-return-flow'
import { CheckoutFlow } from './checkout-flow'

type Mode = 'menu' | 'check-out' | 'bulk-return'

export function ScanExperience() {
  const params = useSearchParams()
  const initial = params.get('flow')
  const initialBulkStage = params.get('stage') === 'review' ? 'review' : 'camera'
  const [mode, setMode] = useState<Mode>(
    initial === 'check-out' ? 'check-out' : initial === 'bulk-return' ? 'bulk-return' : 'menu',
  )

  if (mode === 'check-out') return <CheckoutFlow onExit={() => setMode('menu')} />
  if (mode === 'bulk-return') {
    return <BulkReturnFlow initialStage={initialBulkStage} onExit={() => setMode('menu')} />
  }

  return (
    <div>
      <div className="animate-rise">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Scan</h1>
        <p className="mt-2 text-muted-foreground">
          Choose what you want to do. Point, scan, and let the AI do the rest.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <ScanOption
          onClick={() => setMode('check-out')}
          icon={<ScanLine className="h-7 w-7 text-cyan" />}
          accent="cyan"
          title="Check Out"
          description="Scan items and assign them to a person or team."
          delay="60ms"
        />
        <ScanOption
          onClick={() => setMode('bulk-return')}
          icon={<PackageCheck className="h-7 w-7 text-violet" />}
          accent="violet"
          title="Bulk Return"
          description="Scan many returned items at once with the camera."
          delay="120ms"
        />
      </div>
    </div>
  )
}

function ScanOption({
  onClick,
  icon,
  accent,
  title,
  description,
  delay,
}: {
  onClick: () => void
  icon: React.ReactNode
  accent: 'cyan' | 'violet'
  title: string
  description: string
  delay: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group animate-rise premium-hover relative isolate flex flex-col overflow-hidden rounded-3xl glass p-7 text-left',
        accent === 'cyan' ? 'hover:glow-cyan' : 'hover:glow-violet',
        accent === 'violet' && 'flagship-breathe border-violet/30',
      )}
      style={{ animationDelay: delay }}
    >
      {accent === 'violet' && (
        <>
          <span className="absolute inset-0 opacity-20 [background-image:linear-gradient(90deg,oklch(0.8_0.14_205/0.22)_1px,transparent_1px),linear-gradient(oklch(0.66_0.19_292/0.18)_1px,transparent_1px)] [background-size:42px_42px]" />
          <span className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-violet/35 blur-3xl" />
        </>
      )}
      <span
        className={cn(
          'relative grid h-14 w-14 place-items-center rounded-2xl border',
          accent === 'cyan' ? 'border-cyan/40 bg-cyan/10' : 'border-violet/40 bg-violet/10',
        )}
      >
        {icon}
      </span>
      <h3 className="relative mt-5 font-display text-2xl font-bold tracking-tight">{title}</h3>
      <p className="relative mt-2 flex-1 text-sm text-muted-foreground">{description}</p>
      <span
        className={cn(
          'relative mt-6 inline-flex items-center gap-2 text-sm font-semibold',
          accent === 'cyan' ? 'text-cyan' : 'text-violet',
        )}
      >
        Open
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  )
}
