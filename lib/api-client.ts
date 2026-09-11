import { storeNames } from './official-catalog'
import type { ActivityRecord, InventoryItem, InventoryStatus, StoreLocation } from './types'

const API_BASE = (process.env.NEXT_PUBLIC_ORBIT_API_URL ?? 'http://127.0.0.1:8000/api').replace(/\/$/, '')

export class OrbitApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers:
  init?.body instanceof FormData
    ? { ...(init?.headers ?? {}) }
    : { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new OrbitApiError(
      payload?.error?.message ?? 'ORBIT AI backend request failed',
      payload?.error?.code ?? 'NETWORK_ERROR',
      response.status,
      payload?.error?.details,
    )
  }
  return payload as T
}

type ApiInventoryItem = {
  id: string
  sku: string
  name: string
  category: string
  item_type: 'reusable' | 'consumable'
  available_quantity: number
  checked_out_quantity: number
  total_quantity: number
  needs_attention: boolean
  store_id: string
  rack: string | null
  updated_at: string
}

export function mapApiInventoryItem(item: ApiInventoryItem): InventoryItem {
  const store = storeNames[item.store_id] ?? { name: item.store_id, area: 'Unknown location' }
  const status: InventoryStatus = item.needs_attention
    ? 'attention'
    : item.checked_out_quantity > 0
      ? 'checked-out'
      : 'available'
  return {
    id: item.id,
    name: item.name,
    code: item.sku,
    category: item.category,
    kind: item.item_type,
    available: item.available_quantity,
    checkedOut: item.checked_out_quantity,
    damaged: 0,
    location: `${store.name} — ${store.area}`,
    rack: item.rack ?? 'Location pending',
    lastSeen: item.updated_at,
    status,
    distribution: [{ store: store.name, qty: item.available_quantity }],
    users: item.checked_out_quantity ? [{ name: 'Current check-outs', qty: item.checked_out_quantity }] : [],
  }
}

export async function fetchInventoryFromApi(): Promise<InventoryItem[]> {
  const response = await request<{ items: ApiInventoryItem[] }>('/inventory?limit=250')
  return response.items.map(mapApiInventoryItem)
}

export async function fetchInventoryItemFromApi(itemId: string): Promise<InventoryItem> {
  return mapApiInventoryItem(await request<ApiInventoryItem>(`/inventory/${encodeURIComponent(itemId)}`))
}

export async function fetchStoresFromApi(): Promise<StoreLocation[]> {
  const response = await request<{
    stores: { id: string; name: string; location: string; status: 'online' | 'offline'; item_types: number }[]
  }>('/stores')
  return response.stores.map((store) => ({
    id: store.id,
    name: store.name,
    area: store.location,
    status: store.status,
    lastSync: store.status === 'online' ? 'Up to date' : 'Works locally; sync pending',
    items: store.item_types,
  }))
}

type ApiActivity = {
  id: string
  event_type: 'checkout' | 'return' | string
  entity_id: string
  store_id: string
  user_name: string | null
  summary: string
  details: Array<{ name: string; quantity_checked_out?: number; quantity_returned?: number }>
  created_at: string
}

export async function fetchActivitiesFromApi(): Promise<ActivityRecord[]> {
  const response = await request<{ events: ApiActivity[] }>('/activity?limit=100')
  return response.events.map((event) => {
    const quantity = event.details.reduce(
      (sum, item) => sum + (item.quantity_checked_out ?? item.quantity_returned ?? 0),
      0,
    )
    return {
      id: event.id,
      type: event.event_type === 'checkout' ? 'check-out' : event.event_type === 'return' ? 'return' : 'issue',
      title: event.summary,
      time: new Date(event.created_at).toLocaleString(),
      store: storeNames[event.store_id]?.name ?? event.store_id,
      user: event.user_name ?? 'Unknown user',
      qty: quantity,
      status: 'synced',
      syncStatus: 'up-to-date',
      transactionId: event.entity_id,
      items: event.details.map((item) => ({
        name: item.name,
        qty: item.quantity_checked_out ?? item.quantity_returned ?? 0,
      })),
      aiSummary: event.summary,
      online: true,
    }
  })
}

export type ApiScanItem = {
  detection_id: string
  item: { id: string; sku: string; name: string; image_url: string | null } | null
  quantity: number
  confidence: number
  status: 'ready' | 'review_needed' | 'resolved' | 'rejected'
  bbox: { x: number; y: number; w: number; h: number } | null
  bboxes: { x: number; y: number; w: number; h: number }[]
  possible_matches: { item_id: string; sku: string; name: string; confidence: number }[]
  why: string[]
}

export type ApiScan = {
  scan_session_id: string
  status: 'ready' | 'review_needed' | 'confirmed'
  detector_version: string
  processing_time_ms: number
  items: ApiScanItem[]
  summary: { detected_quantity: number; ready_lines: number; review_lines: number; rejected_lines: number }
}

export function startBulkScan(image: File) {
  const formData = new FormData()
  formData.append('image', image)
  formData.append('mode', 'bulk_return')
  formData.append('store_id', 'store-1')
  formData.append('client_scan_id', crypto.randomUUID())

  return request<ApiScan>('/scans', {
    method: 'POST',
    body: formData,
  })
}
export function resolveScanReview(
  scanId: string,
  detectionId: string,
  selectedItemId: string,
  quantity: number,
) {
  return request<ApiScan>(`/scans/${encodeURIComponent(scanId)}/reviews/${encodeURIComponent(detectionId)}`, {
    method: 'POST',
    body: JSON.stringify({
      action: 'confirm',
      selected_item_id: selectedItemId,
      quantity,
      reason: 'Confirmed in ORBIT AI review screen',
      reviewed_by: 'Demo User',
    }),
  })
}

export type CheckoutPayload = {
  client_transaction_id: string
  store_id: string
  user_name: string
  items: { item_id: string; quantity: number; unit: string }[]
  notes: string | null
}

export type ReturnPayload = {
  client_transaction_id: string
  scan_session_id: string
  store_id: string
  user_name: string
  items: { detection_id: string; item_id: string; quantity: number; unit: string; condition: 'good' }[]
}

export function postCheckout(payload: CheckoutPayload) {
  return request<TransactionResponse>('/transactions/checkout', { method: 'POST', body: JSON.stringify(payload) })
}

export function postReturn(payload: ReturnPayload) {
  return request<TransactionResponse>('/transactions/returns', { method: 'POST', body: JSON.stringify(payload) })
}

export type TransactionResponse = {
  transaction_id: string
  status: 'confirmed'
  type: 'checkout' | 'return'
  total_items_checked_out?: number
  total_items_returned?: number
  changes: Array<{
    item_id: string
    name: string
    quantity_before: number
    quantity_after: number
    quantity_checked_out?: number
    quantity_returned?: number
  }>
  idempotent_replay: boolean
}

export function syncOperations(deviceId: string, operations: unknown[]) {
  return request<{
    results: { client_transaction_id: string; status: 'applied' | 'duplicate' | 'conflict' | 'failed'; message: string }[]
  }>('/sync', { method: 'POST', body: JSON.stringify({ device_id: deviceId, operations }) })
}

export function notifyInventoryUpdated() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('orbit:inventory-updated'))
}
