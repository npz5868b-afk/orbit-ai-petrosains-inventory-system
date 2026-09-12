'use client'

import { InventoryPhoto } from '@/components/inventory/inventory-photo'
import { GlassCard, StatusPill } from '@/components/ui-kit'
import {
  getInventory,
  getInventoryFacts,
  getInventoryStatusMeta,
  searchInventory,
} from '@/lib/services/inventory-service'
import { fetchInventoryFromApi } from '@/lib/api-client'
import type { InventoryStatus } from '@/lib/types'
import { cn } from '@/lib/utils'
import { ChevronRight, MapPin, Search } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

const FILTERS: { key: 'all' | InventoryStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'available', label: 'Available' },
  { key: 'checked-out', label: 'Checked Out' },
  { key: 'attention', label: 'Need Attention' },
]

export function InventoryBrowser() {
  const params = useSearchParams()
  const initialFilter = params.get('filter') === 'attention' ? 'attention' : 'all'
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | InventoryStatus>(initialFilter)
  const [items, setItems] = useState(getInventory())
  const [loadState, setLoadState] = useState<'loading' | 'live' | 'offline'>('loading')
  const facts = getInventoryFacts()
  const statusMeta = getInventoryStatusMeta()

  useEffect(() => {
    let active = true
    const refresh = () => {
      fetchInventoryFromApi()
        .then((next) => {
          if (active) {
            setItems(next)
            setLoadState('live')
          }
        })
        .catch(() => {
          if (active) setLoadState('offline')
        })
    }
    refresh()
    window.addEventListener('orbit:inventory-updated', refresh)
    return () => {
      active = false
      window.removeEventListener('orbit:inventory-updated', refresh)
    }
  }, [])

  const results = useMemo(() => {
    return searchInventory(query, filter, items)
  }, [query, filter, items])

  return (
    <div>
      <div className="animate-rise">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Find Inventory
        </h1>
        <p className="mt-2 text-muted-foreground">
          Search items across all stores. {facts.itemTypes} item types available.
        </p>
        <p className={cn('mt-1 text-xs', loadState === 'live' ? 'text-success' : loadState === 'offline' ? 'text-warning' : 'text-muted-foreground')}>
          {loadState === 'live' ? 'Live inventory connected' : loadState === 'offline' ? 'Showing the saved official catalog while offline' : 'Connecting to inventory…'}
        </p>
      </div>

      {/* search */}
      <div className="mt-6 animate-rise" style={{ animationDelay: '60ms' }}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items..."
            className="w-full rounded-2xl border border-border bg-card/60 py-4 pl-12 pr-4 text-base outline-none backdrop-blur-xl transition-all placeholder:text-muted-foreground focus:border-cyan/50 focus:glow-cyan"
          />
        </div>

        {/* filter pills */}
        <div className="mt-3 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
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
            </button>
          ))}
        </div>
      </div>

      {/* results */}
      <div className="mt-6 flex flex-col gap-3">
        {results.length === 0 ? (
          <GlassCard className="animate-rise p-10 text-center">
            <Search className="mx-auto h-8 w-8 text-muted-foreground" />
            <h3 className="mt-3 font-display text-lg font-semibold">No Inventory Found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Try a different search or clear your filters.
            </p>
            <button
              onClick={() => {
                setQuery('')
                setFilter('all')
              }}
              className="mt-4 rounded-xl border border-border bg-secondary/60 px-4 py-2.5 text-sm font-medium transition-colors hover:text-cyan"
            >
              Clear search
            </button>
          </GlassCard>
        ) : (
          results.map((item, i) => (
            <Link
              key={item.id}
              href={`/inventory/${item.id}`}
              className="group animate-rise"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <GlassCard className="flex items-center gap-4 p-4 transition-all group-hover:border-cyan/30 group-hover:glow-cyan">
                <InventoryPhoto item={item} />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-base font-semibold">{item.name}</p>
                    <span className="rounded-md bg-secondary/60 px-2 py-0.5 font-mono text-xs text-muted-foreground">
                      {item.code}
                    </span>
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    {item.location}
                  </p>
                </div>

                <div className="hidden text-right sm:block">
                  <p className="font-display text-xl font-bold text-cyan">{item.available}</p>
                  <p className="text-xs text-muted-foreground">available</p>
                </div>

                <StatusPill
                  label={statusMeta[item.status].label}
                  tone={statusMeta[item.status].tone}
                  pulse={item.status === 'attention'}
                />

                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors group-hover:border-cyan/40 group-hover:text-cyan">
                  <ChevronRight className="h-4 w-4" />
                </span>
              </GlassCard>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
