'use client'

import { GlassCard, StatusPill } from '@/components/ui-kit'
import { activities, type Activity as ActivityType } from '@/lib/mock-data'
import { cn } from '@/lib/utils'
import {
  ChevronDown,
  CloudUpload,
  PackageCheck,
  ScanLine,
  Sparkles,
  TriangleAlert,
  Undo2,
} from 'lucide-react'
import { useState } from 'react'

const typeMeta = {
  'check-out': { icon: ScanLine, tone: 'cyan' as const, bg: 'bg-cyan/15 text-cyan' },
  return: { icon: Undo2, tone: 'violet' as const, bg: 'bg-violet/15 text-violet' },
  issue: { icon: TriangleAlert, tone: 'warning' as const, bg: 'bg-warning/15 text-warning' },
}

const statusMeta = {
  synced: { label: 'Synced', tone: 'success' as const },
  offline: { label: 'Saved Offline', tone: 'warning' as const },
  review: { label: 'In Review', tone: 'cyan' as const },
}

export function ActivityTimeline() {
  const [filter, setFilter] = useState<'all' | 'offline'>('all')
  const list = filter === 'offline' ? activities.filter((a) => !a.online) : activities
  const offlineCount = activities.filter((a) => !a.online).length

  return (
    <div>
      <div className="animate-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Activity</h1>
          <p className="mt-2 text-muted-foreground">
            Every scan, check-out and return in one clear timeline.
          </p>
        </div>
        <div className="flex gap-2">
          {(['all', 'offline'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-full border px-4 py-2 text-sm font-medium transition-all',
                filter === f
                  ? 'border-cyan/50 bg-cyan/15 text-cyan'
                  : 'border-border bg-secondary/40 text-muted-foreground hover:text-foreground',
              )}
            >
              {f === 'all' ? 'All activity' : `Offline (${offlineCount})`}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {list.map((a, i) => (
          <ActivityCard key={a.id} activity={a} delay={i * 60} />
        ))}
      </div>
    </div>
  )
}

function ActivityCard({ activity, delay }: { activity: ActivityType; delay: number }) {
  const [open, setOpen] = useState(false)
  const meta = typeMeta[activity.type]
  const status = statusMeta[activity.status]
  const Icon = meta.icon

  return (
    <GlassCard className="animate-rise overflow-hidden" style={{ animationDelay: `${delay}ms` }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-4 p-4 text-left"
      >
        <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-xl', meta.bg)}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{activity.title}</p>
          <p className="truncate text-sm text-muted-foreground">
            {activity.time} · {activity.store} · {activity.user}
          </p>
        </div>
        <StatusPill label={status.label} tone={status.tone} pulse={activity.status === 'offline'} />
        <ChevronDown
          className={cn(
            'h-5 w-5 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div className="animate-rise border-t border-border p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Items
              </p>
              <div className="mt-2 flex flex-col gap-1.5">
                {activity.items.map((it) => (
                  <div
                    key={it.name}
                    className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
                  >
                    <span>{it.name}</span>
                    <span className="text-muted-foreground">×{it.qty}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Details
              </p>
              <dl className="mt-2 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Transaction</dt>
                  <dd className="font-mono text-xs">{activity.transactionId}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Total items</dt>
                  <dd>{activity.qty}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Sync</dt>
                  <dd className={activity.online ? 'text-success' : 'text-warning'}>
                    {activity.online ? 'Synced to cloud' : 'Waiting to sync'}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* AI summary */}
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-cyan/25 bg-cyan/5 p-3.5">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-cyan" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan">
                AI summary
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">{activity.aiSummary}</p>
            </div>
          </div>

          {!activity.online && (
            <button className="mt-3 inline-flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-2 text-sm font-medium text-warning transition-colors hover:bg-warning/20">
              <CloudUpload className="h-4 w-4" />
              Sync now
            </button>
          )}
          {activity.type === 'return' && activity.online && (
            <button className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border bg-secondary/60 px-4 py-2 text-sm font-medium transition-colors hover:text-cyan">
              <PackageCheck className="h-4 w-4" />
              View updated stock
            </button>
          )}
        </div>
      )}
    </GlassCard>
  )
}
