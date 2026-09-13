import { AppShell } from '@/components/app-shell'
import { CountUp, GlassCard, SectionHeading, StatusPill } from '@/components/ui-kit'
import { getHomeStats, getNeedsAttention } from '@/lib/services/inventory-service'
import { cn } from '@/lib/utils'
import {
  ArrowRight,
  ChevronRight,
  PackageCheck,
  ScanLine,
  Search,
  Sparkles,
} from 'lucide-react'
import Link from 'next/link'

const toneAccent: Record<string, string> = {
  cyan: 'text-cyan',
  violet: 'text-violet',
  warning: 'text-warning',
  danger: 'text-danger',
}

export default function HomePage() {
  const homeStats = getHomeStats()
  const needsAttention = getNeedsAttention()

  return (
    <AppShell>
      {/* Hero / branding */}
      <section className="animate-rise">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.25em] text-cyan">
          <Sparkles className="h-3.5 w-3.5" />
          Smart Inventory Operations
        </div>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          Welcome back to{' '}
          <span className="text-glow-cyan block text-cyan sm:inline">ORBIT AI</span>
        </h1>
        <p className="mt-3 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
          Scan, track and manage inventory with speed and clarity — for Petrosains.
        </p>
      </section>

      {/* Primary actions */}
      <section className="mt-8">
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Bulk Return — hero card, spans wider on large screens */}
          <Link
            href="/scan?flow=bulk-return"
            className="group flagship-breathe premium-hover relative isolate order-first overflow-hidden rounded-3xl border border-violet/30 p-7 lg:col-span-2 lg:row-span-1 animate-rise"
            style={{ animationDelay: '60ms' }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-violet/28 via-card/72 to-cyan/18" />
            <div className="absolute inset-x-8 top-6 h-px bg-gradient-to-r from-transparent via-cyan/60 to-transparent opacity-70 transition-transform duration-500 group-hover:translate-x-3" />
            <div
              className="absolute -right-8 -top-12 h-56 w-56 rounded-full opacity-70 blur-3xl"
              style={{ background: 'radial-gradient(circle, var(--violet), transparent 65%)' }}
            />
            <div
              className="absolute -bottom-20 left-12 h-56 w-56 rounded-full opacity-50 blur-3xl"
              style={{ background: 'radial-gradient(circle, var(--cyan), transparent 68%)' }}
            />
            <div className="relative flex h-full flex-col">
              <div className="flex items-center justify-between">
                <StatusPill label="Most used" tone="violet" pulse />
                <span className="grid h-12 w-12 place-items-center rounded-2xl border border-violet/40 bg-violet/15 shadow-[0_0_26px_-12px_var(--violet)]">
                  <PackageCheck className="h-6 w-6 text-violet" />
                </span>
              </div>
              <h3 className="mt-6 font-display text-2xl font-bold tracking-tight">
                Bulk Return
              </h3>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                Scan multiple returned items at once. The camera detects everything
                in view and updates inventory in seconds.
              </p>
              <span className="cta-sheen mt-6 inline-flex w-fit items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-primary-foreground transition-all group-hover:shadow-[0_0_34px_-4px_var(--violet)]">
                Start Bulk Return
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>

          {/* Scan & Check Out */}
          <ActionCard
            href="/scan?flow=check-out"
            icon={<ScanLine className="h-6 w-6 text-cyan" />}
            accent="cyan"
            title="Scan & Check Out"
            description="Scan items and assign them to a person or team."
            cta="Start Check-out"
            delay="120ms"
          />

          {/* Find Inventory */}
          <ActionCard
            href="/inventory"
            icon={<Search className="h-6 w-6 text-teal" />}
            accent="teal"
            title="Find Inventory"
            description="Search items across all stores instantly."
            cta="Search Inventory"
            delay="180ms"
          />
        </div>
      </section>

      {/* Status stats */}
      <section className="mt-10">
        <SectionHeading title="System status" hint="A quick pulse across all stores" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {homeStats.map((stat, i) => (
            <GlassCard
              key={stat.label}
              className="animate-rise p-5"
              style={{ animationDelay: `${200 + i * 60}ms` }}
            >
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p
                className={cn(
                  'mt-2 font-display text-4xl font-bold tracking-tight',
                  toneAccent[stat.tone],
                )}
              >
                <CountUp value={stat.value} />
              </p>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* Needs attention */}
      <section className="mt-10">
        <SectionHeading
          title="Needs attention"
          hint="Handle these to keep everything in sync"
          action={
            <Link
              href="/activity"
              className="text-sm font-medium text-cyan hover:underline"
            >
              View all
            </Link>
          }
        />
        <div className="flex flex-col gap-3">
          {needsAttention.map((n, i) => (
            <GlassCard
              key={n.id}
              className="animate-rise flex items-center gap-4 p-4"
              style={{ animationDelay: `${360 + i * 70}ms` }}
            >
              <span
                className={cn(
                  'grid h-11 w-11 shrink-0 place-items-center rounded-xl',
                  n.tone === 'danger' ? 'bg-danger/15 text-danger' : 'bg-warning/15 text-warning',
                )}
              >
                <PackageCheck className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{n.title}</p>
                <p className="truncate text-sm text-muted-foreground">{n.detail}</p>
              </div>
              <Link
                href={n.href}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border bg-secondary/60 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-cyan/40 hover:text-cyan"
              >
                {n.action}
                <ChevronRight className="h-4 w-4" />
              </Link>
            </GlassCard>
          ))}
        </div>
      </section>
    </AppShell>
  )
}

function ActionCard({
  href,
  icon,
  accent,
  title,
  description,
  cta,
  delay,
}: {
  href: string
  icon: React.ReactNode
  accent: 'cyan' | 'teal'
  title: string
  description: string
  cta: string
  delay: string
}) {
  return (
    <Link
      href={href}
      className="group animate-rise premium-hover relative flex flex-col overflow-hidden rounded-3xl glass p-6"
      style={{ animationDelay: delay }}
    >
      <span className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan/35 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <span
        className={cn(
          'grid h-12 w-12 place-items-center rounded-2xl border',
          accent === 'cyan' ? 'border-cyan/40 bg-cyan/10' : 'border-teal/40 bg-teal/10',
        )}
      >
        {icon}
      </span>
      <h3 className="mt-5 font-display text-xl font-bold tracking-tight">{title}</h3>
      <p className="mt-2 flex-1 text-sm text-muted-foreground">{description}</p>
      <span
        className={cn(
          'mt-5 inline-flex items-center gap-2 text-sm font-semibold',
          accent === 'cyan' ? 'text-cyan' : 'text-teal',
        )}
      >
        {cta}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  )
}
