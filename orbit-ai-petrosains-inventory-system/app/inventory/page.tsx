import { AppShell } from '@/components/app-shell'
import { InventoryBrowser } from '@/components/inventory/inventory-browser'

export default function InventoryPage() {
  return (
    <AppShell>
      <InventoryBrowser />
    </AppShell>
  )
}
