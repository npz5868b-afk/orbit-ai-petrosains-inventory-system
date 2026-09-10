import catalogJson from '@/backend/data/inventory_catalog.json'
import type {
  AttentionItem,
  BulkReturnDetection,
  CheckoutItem,
  HomeStat,
  InventoryItem,
  ReviewCandidate,
  StoreLocation,
} from './types'

type CatalogRow = {
  id: string
  sku: string
  name: string
  category: string
  item_type: 'reusable' | 'consumable'
  available_quantity: number
  total_quantity: number
  store_id: string
  rack: string | null
}

export const storeNames: Record<string, { name: string; area: string }> = {
  'store-1': { name: 'Store 1', area: 'Store Level 4' },
  'store-2': { name: 'Store 2', area: 'Edustore / Maker Studio' },
  'store-3': { name: 'Store 3', area: 'Chemical Room' },
  'store-4': { name: 'Store 4', area: 'Store Concourse / Chillax' },
}

const catalog = catalogJson as CatalogRow[]

export const officialInventory: InventoryItem[] = catalog.map((row) => {
  const checkedOut = Math.max(0, row.total_quantity - row.available_quantity)
  const status =
    row.available_quantity <= Math.max(1, Math.min(5, Math.floor(row.total_quantity / 10)))
      ? 'attention'
      : checkedOut > 0
        ? 'checked-out'
        : 'available'
  return {
    id: row.id,
    name: row.name,
    code: row.sku,
    category: row.category,
    kind: row.item_type,
    available: row.available_quantity,
    checkedOut,
    damaged: 0,
    location: `${storeNames[row.store_id].name} — ${storeNames[row.store_id].area}`,
    rack: row.rack ?? 'Location pending',
    lastSeen: row.store_id === 'store-3' || row.store_id === 'store-4' ? 'saved offline' : 'at last sync',
    status,
    distribution: [{ store: storeNames[row.store_id].name, qty: row.available_quantity }],
    users: checkedOut ? [{ name: 'Demo checkout', qty: checkedOut }] : [],
  }
})

export const officialFacts = {
  itemTypes: officialInventory.length,
  categories: new Set(officialInventory.map((item) => item.category)).size,
  activeStorageLocations: Object.keys(storeNames).length,
} as const

export const officialStores: StoreLocation[] = Object.entries(storeNames).map(([id, meta]) => ({
  id,
  name: meta.name,
  area: meta.area,
  status: id === 'store-3' || id === 'store-4' ? 'offline' : 'online',
  lastSync: id === 'store-3' || id === 'store-4' ? 'Works locally; sync pending' : 'Up to date',
  items: officialInventory.filter((item) => item.location.startsWith(meta.name)).length,
}))

export const officialHomeStats: HomeStat[] = [
  { label: 'Item Types', value: officialFacts.itemTypes, tone: 'cyan' },
  { label: 'Checked Out', value: officialInventory.reduce((sum, item) => sum + item.checkedOut, 0), tone: 'violet' },
  { label: 'Need Attention', value: officialInventory.filter((item) => item.status === 'attention').length, tone: 'warning' },
  { label: 'Offline Stores', value: officialStores.filter((store) => store.status === 'offline').length, tone: 'danger' },
]

export const officialNeedsAttention: AttentionItem[] = [
  {
    id: 'review-demo',
    title: '1 return needs review',
    detail: 'Bulk return · Store 1 · red or blue LED',
    action: 'Review',
    href: '/scan?flow=bulk-return',
    tone: 'warning',
  },
  {
    id: 'offline-stores',
    title: '2 stores are offline by design',
    detail: 'Store 3 and Store 4 continue locally and sync later',
    action: 'Check Status',
    href: '/system',
    tone: 'warning',
  },
]

export const officialCheckoutScanCatalog: CheckoutItem[] = [
  { itemName: 'Screwdriver', itemCode: 'T003', confidence: 98 },
  { itemName: 'Measure Tape', itemCode: 'T005', confidence: 95 },
  { itemName: 'Beaker 250ml', itemCode: 'L003', confidence: 92 },
]

export const officialBulkReturnDetections: BulkReturnDetection[] = [
  { id: 's1', itemName: 'Screwdriver', itemCode: 'T003', quantity: 3, confidence: 96, status: 'ready', top: '15%', left: '8%', width: '31%', height: '25%' },
  { id: 's2', itemName: 'Measure Tape', itemCode: 'T005', quantity: 2, confidence: 91, status: 'ready', top: '23%', left: '56%', width: '31%', height: '31%', labelSide: 'right' },
  { id: 's3', itemName: 'Beaker 250ml', itemCode: 'L003', quantity: 1, confidence: 95, status: 'ready', top: '58%', left: '14%', width: '27%', height: '27%' },
  { id: 's4', itemName: 'LED Red', itemCode: 'E018', quantity: 1, confidence: 71, status: 'review', top: '57%', left: '58%', width: '28%', height: '29%', labelSide: 'right' },
]

export const officialReviewCandidates: ReviewCandidate[] = [
  { id: 'item-e018', itemName: 'LED Red', itemCode: 'E018', confidence: 71 },
  { id: 'item-e019', itemName: 'LED Blue', itemCode: 'E019', confidence: 22 },
]

export const officialStockBefore: Record<string, number> = {
  Screwdriver: 50,
  'Measure Tape': 24,
  'Beaker 250ml': 54,
  'LED Red': 173,
  'LED Blue': 153,
}

export function itemIdFromCode(code: string) {
  return officialInventory.find((item) => item.code === code)?.id
}
