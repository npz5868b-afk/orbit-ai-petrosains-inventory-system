'use client'

import { getSystemOverview } from '@/lib/services/system-service'
import { fetchStoresFromApi } from '@/lib/api-client'
import { flushOfflineQueue } from '@/lib/offline-queue'
import { cn } from '@/lib/utils'
import {
  Activity,
  Boxes,
  Home,
  ScanLine,
  Settings2,
  Wifi,
  WifiOff,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { AnimatedBackground } from './animated-background'

const NAV = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/scan', label: 'Scan', icon: ScanLine },
  { href: '/inventory', label: 'Inventory', icon: Boxes },
  { href: '/activity', label: 'Activity', icon: Activity },
  { href: '/system', label: 'System', icon: Settings2 },
]

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname.startsWith(href)
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-3">
      <span className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-cyan/25 via-card/70 to-violet/25 glow-cyan">
        <span className="absolute inset-0 rounded-xl border border-cyan/35" />
        <span className="logo-orbit-ring absolute inset-2 rounded-full border border-cyan/20 border-t-cyan/70 border-r-violet/55" />
        <span className="logo-core-breathe h-4 w-4 rounded-full border-2 border-cyan bg-transparent shadow-[0_0_12px_var(--cyan)]" />
        <span className="absolute h-1.5 w-1.5 translate-x-3 rounded-full bg-violet shadow-[0_0_10px_var(--violet)]" />
      </span>
      <span className="leading-tight">
        <span className="block font-display text-base font-bold tracking-[0.18em] text-foreground">
          ORBIT AI
        </span>
        <span className="block text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Petrosains
        </span>
      </span>
    </Link>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const overview = getSystemOverview()
  const { facts } = overview
  const [stores, setStores] = useState(overview.stores)
  const [isOnline, setIsOnline] = useState(true)
  useEffect(() => {
    fetchStoresFromApi().then(setStores).catch(() => undefined)
    setIsOnline(navigator.onLine)

    const handleOnline = () => {
      setIsOnline(true)
      flushOfflineQueue().catch(() => undefined)
    }
    const handleOffline = () => setIsOnline(false)

    if (navigator.onLine) {
      flushOfflineQueue().catch(() => undefined)
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])
  const onlineStores = stores.filter((store) => store.status === 'online').length
  const ConnectivityIcon = isOnline ? Wifi : WifiOff

  return (
    <div className="relative isolate min-h-screen overflow-x-hidden">
      <AnimatedBackground />

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar/90 p-5 shadow-[18px_0_60px_-48px_var(--cyan)] backdrop-blur-2xl lg:flex">
        <div className="px-1 py-2">
          <Logo />
        </div>

        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group relative flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition-all duration-300 hover:bg-foreground/[0.03]',
                  active
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {active && (
                  <span className="absolute inset-0 rounded-xl border border-cyan/30 bg-gradient-to-r from-cyan/15 to-violet/10 glow-cyan" />
                )}
                <item.icon
                  className={cn(
                    'relative h-[18px] w-[18px] transition-colors',
                    active ? 'text-cyan' : 'text-muted-foreground group-hover:text-foreground',
                  )}
                />
                <span className="relative">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="glass rounded-xl p-3.5">
          <div
            className={cn(
              'flex items-center gap-2 text-sm font-medium',
              isOnline ? 'text-success' : 'text-warning',
            )}
          >
            <span
              className={cn(
                'relative grid h-6 w-6 place-items-center rounded-full',
                isOnline ? 'bg-success/10' : 'bg-warning/10',
              )}
            >
              <span
                className={cn(
                  'absolute h-2 w-2 rounded-full',
                  isOnline ? 'bg-success/40 status-soft-pulse' : 'bg-warning/40',
                )}
              />
              <ConnectivityIcon className="relative h-4 w-4" />
            </span>
            {isOnline ? 'Online' : 'Offline'}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {onlineStores} of {facts.activeStorageLocations} stores connected. Changes sync later.
          </p>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-sidebar-border bg-sidebar/90 px-4 py-3 shadow-[0_16px_44px_-34px_var(--cyan)] backdrop-blur-2xl lg:hidden">
        <Logo />
        <span
          className={cn(
            'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
            isOnline
              ? 'status-soft-pulse border-success/25 bg-success/10 text-success'
              : 'border-warning/25 bg-warning/10 text-warning',
          )}
        >
          <ConnectivityIcon className="h-3.5 w-3.5" />
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </header>

      {/* Main content */}
      <main className="px-4 sm:px-6 lg:pl-64 lg:pr-0">
        <div className="mx-auto w-[calc(100vw-2rem)] max-w-6xl pb-28 pt-6 sm:w-[calc(100vw-3rem)] lg:w-auto lg:px-10 lg:pt-10">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-sidebar-border bg-sidebar/90 px-2 py-2 shadow-[0_-18px_50px_-42px_var(--cyan)] backdrop-blur-2xl lg:hidden">
        <div className="mx-auto flex max-w-md items-center justify-around">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-[10px] font-medium transition-colors',
                  active ? 'text-cyan' : 'text-muted-foreground',
                )}
              >
                <span
                  className={cn(
                    'grid h-9 w-9 place-items-center rounded-xl transition-all',
                    active && 'bg-cyan/15 glow-cyan',
                  )}
                >
                  <item.icon className="h-5 w-5" />
                </span>
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
