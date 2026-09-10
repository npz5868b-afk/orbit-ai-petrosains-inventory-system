import { AppShell } from '@/components/app-shell'
import { InventoryBrowser } from '@/components/inventory/inventory-browser'
import { Suspense } from 'react'

export default function InventoryPage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <InventoryBrowser />
      </Suspense>
    </AppShell>
  )
}
