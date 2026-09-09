'use client'

import { GlassCard, StatusPill } from '@/components/ui-kit'
import { statusMeta, type InventoryItem } from '@/lib/mock-data'
import { cn } from '@/lib/utils'
import { ArrowLeft, MapPin, PackageCheck, ScanLine, Users } from 'lucide-react'
import Link from 'next/link'

export function ItemDetail({ item }: { item: InventoryItem }) {
  const total = item.available + item.checkedOut + item.damaged
  const segments = [
    { label: 'Available', value: item.available, tone: 'success' as const, color: 'var(--success)' },
    { label: 'Checked out', value: item.checkedOut, tone: 'cyan' as const, color: 'var(--cyan)' },
    { label: 'Damaged', value: item.damaged, tone: 'danger' as const, color: 'var(--danger)' },
  ]

  return (
    <div>
      <Link
        href="/inventory"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to inventory
      </Link>

      {/* header */}
      <div className="mt-4 animate-rise">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {item.name}
          </h1>
          <StatusPill
            label={statusMeta[item.status].label}
            tone={statusMeta[item.status].tone}
            pulse={item.status === 'attention'}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span className="rounded-md bg-secondary/60 px-2 py-0.5 font-mono">{item.code}</span>
          <span className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4" />
            {item.location} · {item.rack}
          </span>
          <span className="capitalize">{item.kind}</span>
        </div>
      </div>

      {/* stock breakdown */}
      <GlassCard strong className="mt-6 animate-rise p-6" style={{ animationDelay: '60ms' }}>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm text-muted-foreground">In stock right now</p>
            <p className="font-display text-5xl font-bold tracking-tight text-cyan">
              {item.available}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">{total} total units</p>
        </div>

        {/* stacked bar */}
        <div className="mt-5 flex h-3 w-full overflow-hidden rounded-full bg-secondary/60">
          {segments.map((s) =>
            s.value > 0 ? (
              <div
                key={s.label}
                style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
                className="h-full"
              />
            ) : null,
          )}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {segments.map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-secondary/40 p-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className="mt-1 font-display text-xl font-bold">{s.value}</p>
            </div>
          ))}
        </div>
      </GlassCard>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {/* distribution by store */}
        <GlassCard className="animate-rise p-6" style={{ animationDelay: '120ms' }}>
          <h3 className="flex items-center gap-2 font-display text-base font-semibold">
            <MapPin className="h-4 w-4 text-cyan" />
            Where it is
          </h3>
          <div className="mt-4 flex flex-col gap-3">
            {item.distribution.map((d) => {
              const max = Math.max(...item.distribution.map((x) => x.qty), 1)
              return (
                <div key={d.store}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{d.store}</span>
                    <span className="text-muted-foreground">{d.qty} units</span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-secondary/60">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan to-teal transition-all duration-700"
                      style={{ width: `${(d.qty / max) * 100}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </GlassCard>

        {/* who has it */}
        <GlassCard className="animate-rise p-6" style={{ animationDelay: '180ms' }}>
          <h3 className="flex items-center gap-2 font-display text-base font-semibold">
            <Users className="h-4 w-4 text-violet" />
            Who has it
          </h3>
          {item.users.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
              All units are in stock. Nobody has this checked out.
            </p>
          ) : (
            <div className="mt-4 flex flex-col gap-2.5">
              {item.users.map((u) => (
                <div
                  key={u.name}
                  className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 p-3.5"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-violet/15 text-sm font-semibold text-violet">
                      {u.name.slice(0, 1)}
                    </span>
                    <span className="text-sm font-medium">{u.name}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{u.qty} units</span>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">Last seen {item.lastSeen}</p>
        </GlassCard>
      </div>

      {/* actions */}
      <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
        <Link
          href="/scan?flow=check-out"
          className={cn(
            'inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan to-teal px-5 py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:shadow-[0_0_30px_-4px_var(--cyan)]',
          )}
        >
          <ScanLine className="h-4 w-4" />
          Check Out This Item
        </Link>
        <Link
          href="/scan?flow=bulk-return"
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-secondary/60 px-5 py-3.5 text-sm font-medium transition-colors hover:text-violet"
        >
          <PackageCheck className="h-4 w-4" />
          Return Items
        </Link>
      </div>
    </div>
  )
}
