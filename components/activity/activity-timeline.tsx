'use client'

import { GlassCard, StatusPill } from '@/components/ui-kit'
import {
  filterActivities,
  getActivityStatusMeta,
  type ActivityFilter,
} from '@/lib/services/activity-service'
import type { ActivityRecord } from '@/lib/types'
import { fetchActivitiesFromApi } from '@/lib/api-client'
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
import Link from 'next/link'
import { useEffect, useState } from 'react'

const typeMeta = {
  'check-out': { icon: ScanLine, tone: 'cyan' as const, bg: 'bg-cyan/15 text-cyan' },
  return: { icon: Undo2, tone: 'violet' as const, bg: 'bg-violet/15 text-violet' },
  issue: { icon: TriangleAlert, tone: 'warning' as const, bg: 'bg-warning/15 text-warning' },
}

export function ActivityTimeline() {
  const [filter, setFilter] = useState<ActivityFilter>('all')
  const [activities, setActivities] = useState<ActivityRecord[]>([])
  const list = filterActivities(filter, activities)
  const filters: { key: ActivityFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'check-out', label: 'Check-outs' },
    { key: 'return', label: 'Returns' },
    { key: 'issue', label: 'Issues' },
  ]

  useEffect(() => {
    const refresh = () => fetchActivitiesFromApi().then(setActivities).catch(() => undefined)
    refresh()
    window.addEventListener('orbit:inventory-updated', refresh)
    return () => window.removeEventListener('orbit:inventory-updated', refresh)
  }, [])

  return (
    <div>
      <div className="animate-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Activity</h1>
          <p className="mt-2 text-muted-foreground">
            Every scan, check-out and return in one clear timeline.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'rounded-full border px-4 py-2 text-sm font-medium transition-all',
                filter === f.key
                  ? 'border-cyan/50 bg-cyan/15 text-cyan'
                  : 'border-border bg-secondary/40 text-muted-foreground hover:text-foreground',
              )}
            >
              {f.label}
              <span className="ml-1.5 text-xs text-muted-foreground">
                {f.key === 'all'
                  ? activities.length
                  : activities.filter((activity) => activity.type === f.key).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {list.length === 0 ? (
          <GlassCard className="p-10 text-center text-sm text-muted-foreground">
            No activity yet. Complete a check-out or return to create the first audit record.
          </GlassCard>
        ) : list.map((a, i) => (
          <ActivityCard key={a.id} activity={a} delay={i * 60} />
        ))}
      </div>
    </div>
  )
}

function ActivityCard({ activity, delay }: { activity: ActivityRecord; delay: number }) {
  const [open, setOpen] = useState(false)
  const [syncState, setSyncState] = useState(activity.syncStatus)
  const meta = typeMeta[activity.type]
  const statusMeta = getActivityStatusMeta()
  const status =
    syncState === 'syncing'
      ? { label: 'Syncing', tone: 'cyan' as const }
      : syncState === 'restored'
        ? { label: 'Connection Restored', tone: 'success' as const }
        : statusMeta[activity.status]
  const Icon = meta.icon
  const isOffline = activity.status === 'offline' && syncState !== 'restored'

  function syncNow() {
    setSyncState('syncing')
    window.setTimeout(() => setSyncState('restored'), 900)
  }

  return (
    <GlassCard className="animate-rise overflow-hidden" style={{ animationDelay: `${delay}ms` }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-center gap-3 p-4 text-left sm:flex-nowrap sm:gap-4"
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
        <StatusPill label={status.label} tone={status.tone} pulse={isOffline} />
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
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Time</dt>
                  <dd className="text-right">{activity.time}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Location</dt>
                  <dd className="text-right">{activity.store}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">User or team</dt>
                  <dd className="text-right">{activity.user}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Total items</dt>
                  <dd>{activity.qty}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>{status.label}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Sync</dt>
                  <dd className={syncState === 'restored' || activity.online ? 'text-success' : 'text-warning'}>
                    {syncState === 'syncing'
                      ? 'Syncing'
                      : syncState === 'restored'
                        ? 'Connection restored'
                        : activity.online
                          ? 'Everything is up to date'
                          : 'Saved offline'}
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

          {!activity.online && syncState !== 'restored' && (
            <button
              onClick={syncNow}
              disabled={syncState === 'syncing'}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-2 text-sm font-medium text-warning transition-colors hover:bg-warning/20 disabled:opacity-60"
            >
              <CloudUpload className="h-4 w-4" />
              {syncState === 'syncing' ? 'Syncing' : 'Sync now'}
            </button>
          )}
          {activity.type === 'return' && activity.online && (
            <Link
              href="/inventory"
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border bg-secondary/60 px-4 py-2 text-sm font-medium transition-colors hover:text-cyan"
            >
              <PackageCheck className="h-4 w-4" />
              View updated stock
            </Link>
          )}
        </div>
      )}
    </GlassCard>
  )
}
