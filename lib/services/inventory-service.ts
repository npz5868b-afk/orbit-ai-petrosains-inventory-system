import {
  statusMeta,
} from '@/lib/mock-data'
import {
  officialFacts,
  officialHomeStats,
  officialInventory,
  officialNeedsAttention,
  officialStores,
} from '@/lib/official-catalog'
import type { InventoryItem, InventoryStatus, ItemKind } from '@/lib/types'

export function getInventory() {
  return officialInventory
}

export function getInventoryItem(id: string) {
  return officialInventory.find((item) => item.id === id)
}

export function searchInventory(
  query: string,
  filter: 'all' | InventoryStatus = 'all',
  source: InventoryItem[] = officialInventory,
) {
  const q = query.trim().toLowerCase()
  return source.filter((item) => {
    const matchesFilter = filter === 'all' || item.status === filter
    const matchesQuery =
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.code.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.location.toLowerCase().includes(q)
    return matchesFilter && matchesQuery
  })
}

export function getInventoryFacts() {
  return officialFacts
}

export function getHomeStats() {
  return officialHomeStats
}

export function getNeedsAttention() {
  return officialNeedsAttention
}

export function getInventoryStatusMeta() {
  return statusMeta
}

export function getStoreStatuses() {
  return officialStores
}

export function getInventoryActions(item: Pick<InventoryItem, 'kind'>) {
  if (item.kind === 'consumable') {
    return [
      { label: 'Use Stock', kind: 'mock-action' as const },
      { label: 'Add Stock', kind: 'mock-action' as const },
    ]
  }

  return [
    { label: 'Check Out', kind: 'link' as const, href: '/scan?flow=check-out' },
    { label: 'Return', kind: 'link' as const, href: '/scan?flow=bulk-return' },
    { label: 'Report Missing', kind: 'mock-action' as const },
    { label: 'Report Damage', kind: 'mock-action' as const },
  ]
}

export function getAvailableCategories() {
  const categories = new Set<string>()
  officialInventory.forEach((item) => categories.add(item.category))
  return [...categories]
}

export function getDemoKindLabel(kind: ItemKind) {
  return kind === 'consumable' ? 'Consumable' : 'Reusable'
}
