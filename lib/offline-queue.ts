import {
  notifyInventoryUpdated,
  postCheckout,
  postReturn,
  syncOperations,
  type CheckoutPayload,
  type ReturnPayload,
  type TransactionResponse,
} from './api-client'

const QUEUE_KEY = 'orbit-ai:pending-operations:v1'
const DEVICE_KEY = 'orbit-ai:device-id:v1'

export type PendingOperation = {
  client_transaction_id: string
  type: 'checkout' | 'return'
  created_offline_at: string
  payload: CheckoutPayload | ReturnPayload
  status?: 'pending' | 'conflict' | 'failed'
  message?: string
}

function readQueue(): PendingOperation[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as PendingOperation[]
  } catch {
    return []
  }
}

function writeQueue(queue: PendingOperation[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  window.dispatchEvent(new CustomEvent('orbit:queue-changed', { detail: queue.length }))
}

export function getPendingOperations() {
  return readQueue()
}

export function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = `orbit-tablet-${crypto.randomUUID()}`
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

export function enqueueOperation(type: 'checkout' | 'return', payload: CheckoutPayload | ReturnPayload) {
  const queue = readQueue()
  if (!queue.some((entry) => entry.client_transaction_id === payload.client_transaction_id)) {
    queue.push({
      client_transaction_id: payload.client_transaction_id,
      type,
      created_offline_at: new Date().toISOString(),
      payload,
      status: 'pending',
    })
    writeQueue(queue)
  }
}

export async function submitOrQueue(
  type: 'checkout' | 'return',
  payload: CheckoutPayload | ReturnPayload,
): Promise<{ state: 'synced' | 'saved-offline'; response?: TransactionResponse }> {
  try {
    const response = type === 'checkout'
      ? await postCheckout(payload as CheckoutPayload)
      : await postReturn(payload as ReturnPayload)
    notifyInventoryUpdated()
    return { state: 'synced', response }
  } catch (error) {
    if (error instanceof TypeError || (error instanceof Error && /fetch|network|load/i.test(error.message))) {
      enqueueOperation(type, payload)
      return { state: 'saved-offline' }
    }
    throw error
  }
}

export async function flushOfflineQueue() {
  const queue = readQueue()
  if (!queue.length) return { synced: 0, remaining: 0 }
  const response = await syncOperations(getDeviceId(), queue)
  const resultById = new Map(response.results.map((result) => [result.client_transaction_id, result]))
  const remaining = queue.flatMap((entry) => {
    const result = resultById.get(entry.client_transaction_id)
    if (result?.status === 'applied' || result?.status === 'duplicate') return []
    return [{ ...entry, status: result?.status === 'conflict' ? 'conflict' as const : 'failed' as const, message: result?.message }]
  })
  writeQueue(remaining)
  if (remaining.length < queue.length) notifyInventoryUpdated()
  return { synced: queue.length - remaining.length, remaining: remaining.length }
}
