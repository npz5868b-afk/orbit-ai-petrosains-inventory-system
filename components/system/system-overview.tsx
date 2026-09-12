'use client'

import { GlassCard, StatusPill } from '@/components/ui-kit'
import { getSystemOverview } from '@/lib/services/system-service'
import { fetchStoresFromApi } from '@/lib/api-client'
import { flushOfflineQueue, getPendingOperations } from '@/lib/offline-queue'
import { getStorePhotoSet, type StorePhotoAsset } from '@/lib/store-photos'
import { cn } from '@/lib/utils'
import {
  ChevronDown,
  ChevronUp,
  Cpu,
  ImageIcon,
  Info,
  MapPin,
  PackageCheck,
  RefreshCw,
  Sparkles,
  TriangleAlert,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { useEffect, useState } from 'react'

function StorePhotoFrame({
  photo,
  fallbackLabel,
  className,
  imageClassName,
}: {
  photo: StorePhotoAsset | null
  fallbackLabel: string
  className: string
  imageClassName?: string
}) {
  const [failed, setFailed] = useState(false)
  const showImage = photo && !failed

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-border bg-secondary/35',
        className,
      )}
    >
      {showImage ? (
        <img
          src={photo.src}
          alt={photo.alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className={cn('h-full w-full object-cover object-center', imageClassName)}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-3 text-center text-muted-foreground">
          <ImageIcon className="h-5 w-5 text-cyan" />
          <span className="text-xs font-medium">{fallbackLabel}</span>
        </div>
      )}
    </div>
  )
}

export function SystemOverview() {
  const overview = getSystemOverview()
  const { facts, offlineStates, recoveryStates } = overview
  const [stores, setStores] = useState(overview.stores)
  const [pendingCount, setPendingCount] = useState(0)
  const [conflictCount, setConflictCount] = useState(0)
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'done'>('idle')
  const [expandedStoreId, setExpandedStoreId] = useState<string | null>(null)
  const online = stores.filter((s) => s.status === 'online').length

  useEffect(() => {
    const refresh = () => {
      const pending = getPendingOperations()
      setPendingCount(pending.length)
      setConflictCount(pending.filter((operation) => operation.status === 'conflict').length)
      fetchStoresFromApi().then(setStores).catch(() => undefined)
    }
    refresh()
    window.addEventListener('online', refresh)
    window.addEventListener('orbit:queue-changed', refresh)
    return () => {
      window.removeEventListener('online', refresh)
      window.removeEventListener('orbit:queue-changed', refresh)
    }
  }, [])

  async function syncAll() {
    setSyncState('syncing')
    try {
      await flushOfflineQueue()
      setPendingCount(getPendingOperations().length)
      setConflictCount(getPendingOperations().filter((operation) => operation.status === 'conflict').length)
      setStores(await fetchStoresFromApi())
      setSyncState('done')
    } catch {
      setSyncState('idle')
    }
  }

  return (
    <div>
      <div className="animate-rise">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">System</h1>
        <p className="mt-2 text-muted-foreground">
          Store connections, offline sync, and how the AI helps you work.
        </p>
      </div>

      {/* connection banner */}
      <GlassCard
        strong
        className="mt-6 animate-rise flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between"
        style={{ animationDelay: '60ms' }}
      >
        <div className="flex items-center gap-4">
          <span className="relative grid h-12 w-12 place-items-center rounded-2xl bg-success/15 text-success">
            <span
              className="absolute inset-0 rounded-2xl bg-success/30"
              style={{ animation: 'pulse-ring 2s ease-out infinite' }}
            />
            <Wifi className="relative h-6 w-6" />
          </span>
          <div>
            <p className="font-display text-lg font-semibold">You are online</p>
            <p className="text-sm text-muted-foreground">
              {online} of {facts.activeStorageLocations} active storage locations connected
            </p>
            {syncState === 'done' && (
              <p className="mt-1 text-sm text-success">Everything is up to date.</p>
            )}
            {pendingCount > 0 && (
              <p className="mt-1 text-sm text-warning">{pendingCount} operation(s) saved on this device.</p>
            )}
            {conflictCount > 0 && (
              <p className="mt-1 text-sm text-danger">{conflictCount} sync conflict(s) need review before retrying.</p>
            )}
          </div>
        </div>
        <button
          onClick={syncAll}
          disabled={syncState === 'syncing'}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary/60 px-4 py-2.5 text-sm font-medium transition-colors hover:text-cyan disabled:opacity-60"
        >
          <RefreshCw className={cn('h-4 w-4', syncState === 'syncing' && 'animate-spin')} />
          {syncState === 'syncing' ? 'Syncing' : 'Sync all now'}
        </button>
      </GlassCard>

      {/* stores */}
      <h2 className="mt-8 animate-rise font-display text-lg font-semibold">Store Status</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {stores.map((s, i) => {
          const photos = getStorePhotoSet(s.id)
          const isExpanded = expandedStoreId === s.id
          const environmentCount = photos?.environment.length ?? 0
          return (
            <GlassCard
              key={s.id}
              className="animate-rise p-4 transition duration-300 hover:-translate-y-0.5 hover:border-cyan/30 hover:shadow-[0_18px_46px_-34px_var(--cyan)]"
              style={{ animationDelay: `${120 + i * 60}ms` }}
            >
              <div className="flex gap-3">
                <div className="shrink-0">
                  <StorePhotoFrame
                    photo={photos?.hero ?? null}
                    fallbackLabel={`${s.name} photo`}
                    className="store-hero-thumb rounded-xl"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-display text-lg font-semibold">{s.name}</p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{s.area}</span>
                      </p>
                    </div>
                    <StatusPill
                      label={s.status === 'online' ? 'Online' : 'Offline'}
                      tone={s.status === 'online' ? 'success' : 'warning'}
                      pulse={s.status === 'offline'}
                    />
                  </div>

                  <div className="mt-3 grid gap-1.5 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Last sync</span>
                      <span
                        className={cn(
                          'truncate text-right',
                          s.status === 'online' ? 'text-foreground' : 'text-warning',
                        )}
                      >
                        {s.lastSync}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Items tracked</span>
                      <span className="font-semibold text-cyan">{s.items}</span>
                    </div>
                  </div>
                </div>
              </div>

              {environmentCount > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setExpandedStoreId(isExpanded ? null : s.id)}
                    className="mt-3 flex w-full items-center justify-between rounded-xl border border-border bg-secondary/30 px-3 py-2 text-xs font-medium text-muted-foreground transition hover:border-cyan/35 hover:text-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/45"
                    aria-expanded={isExpanded}
                  >
                    <span>
                      {isExpanded ? 'Hide environment' : `View environment (${environmentCount})`}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>

                  <div
                    className={cn(
                      'grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-out',
                      isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                    )}
                  >
                    <div className="min-h-0">
                      <p className="mt-3 text-[11px] text-muted-foreground">
                        Real Petrosains storage environment
                      </p>
                      <div
                        className={cn(
                          'mt-2 grid gap-2',
                          environmentCount === 2 ? 'grid-cols-2' : 'grid-cols-3',
                        )}
                      >
                        {photos?.environment.map((photo, index) => (
                          <StorePhotoFrame
                            key={photo.src}
                            photo={photo}
                            fallbackLabel={`View ${index + 1}`}
                            className="h-20 sm:h-24 lg:h-[92px]"
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </GlassCard>
          )
        })}
      </div>

      {/* sync status */}
      <h2 className="mt-8 animate-rise font-display text-lg font-semibold">Sync Status</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {offlineStates.map((state, i) => (
          <GlassCard
            key={state.label}
            className="animate-rise p-4"
            style={{ animationDelay: `${260 + i * 45}ms` }}
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  'mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl',
                  state.tone === 'success' && 'bg-success/15 text-success',
                  state.tone === 'warning' && 'bg-warning/15 text-warning',
                  state.tone === 'danger' && 'bg-danger/15 text-danger',
                  state.tone === 'cyan' && 'bg-cyan/15 text-cyan',
                )}
              >
                {state.status === 'offline' || state.status === 'saved-offline' ? (
                  <WifiOff className="h-4 w-4" />
                ) : (
                  <Wifi className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0">
                <p className="font-medium">{state.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{state.message}</p>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <GlassCard className="animate-rise p-6" style={{ animationDelay: '360ms' }}>
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-cyan/15 text-cyan">
            <WifiOff className="h-5 w-5" />
          </span>
          <h3 className="mt-4 font-display text-lg font-semibold">Works offline</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            When a store loses connection, ORBIT AI keeps working. Every scan, check-out
            and return is saved on the device and syncs automatically the moment the
            connection returns — nothing is ever lost.
          </p>
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-warning/25 bg-warning/5 p-3 text-sm">
            <span className="h-2 w-2 rounded-full bg-warning" />
            <span className="text-muted-foreground">
              Store 3 has <span className="text-warning">4 changes</span> waiting to sync.
            </span>
          </div>
        </GlassCard>

        <GlassCard className="animate-rise p-6" style={{ animationDelay: '420ms' }}>
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-violet/15 text-violet">
            <Cpu className="h-5 w-5" />
          </span>
          <h3 className="mt-4 font-display text-lg font-semibold">AI Details</h3>
          <ul className="mt-3 space-y-2.5 text-sm text-muted-foreground">
            {[
              'Recognizes many items at once from a single camera view',
              'Reads item codes and matches them to your catalog',
              'Flags anything it is unsure about for a quick human check',
              'Writes a plain-language summary for every transaction',
            ].map((point) => (
              <li key={point} className="flex items-start gap-2.5">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet" />
                {point}
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <GlassCard className="animate-rise p-6" style={{ animationDelay: '480ms' }}>
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-success/15 text-success">
            <Info className="h-5 w-5" />
          </span>
          <h3 className="mt-4 font-display text-lg font-semibold">App Information</h3>
          <div className="mt-4 grid gap-2 text-sm">
            <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/35 px-3 py-2.5">
              <span className="text-muted-foreground">Item Types</span>
              <span className="font-semibold">{facts.itemTypes}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/35 px-3 py-2.5">
              <span className="text-muted-foreground">Categories</span>
              <span className="font-semibold">{facts.categories}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/35 px-3 py-2.5">
              <span className="text-muted-foreground">Active storage locations</span>
              <span className="font-semibold">{facts.activeStorageLocations}</span>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="animate-rise p-6" style={{ animationDelay: '540ms' }}>
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-warning/15 text-warning">
            <TriangleAlert className="h-5 w-5" />
          </span>
          <h3 className="mt-4 font-display text-lg font-semibold">Recovery States</h3>
          <div className="mt-4 grid gap-2">
            {recoveryStates.map((state) => (
              <div
                key={state.title}
                className="rounded-xl border border-border bg-secondary/30 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{state.title}</p>
                  <StatusPill
                    label={state.inventoryChanged ? 'Inventory changed' : 'No inventory changes'}
                    tone={state.inventoryChanged ? 'warning' : 'success'}
                  />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{state.message}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {state.actions.map((action) => (
                    <span
                      key={action}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/45 px-2.5 py-1 text-xs text-muted-foreground"
                    >
                      <PackageCheck className="h-3 w-3" />
                      {action}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
