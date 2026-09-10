import {
  teams,
} from '@/lib/mock-data'
import {
  officialBulkReturnDetections,
  officialCheckoutScanCatalog,
  officialReviewCandidates,
  officialStockBefore,
} from '@/lib/official-catalog'
import type { BulkReturnItem, CheckoutItem, ReviewCandidate } from '@/lib/types'

export function getTeams() {
  return teams
}

export function getCheckoutScanCatalog(): CheckoutItem[] {
  return officialCheckoutScanCatalog
}

export function detectItems(): BulkReturnItem[] {
  return officialBulkReturnDetections.map(({ top, left, width, height, labelSide, ...item }) => item)
}

export function getBulkReturnDetectionBoxes() {
  return officialBulkReturnDetections
}

export function getBulkReturnReviewCandidates(): ReviewCandidate[] {
  return officialReviewCandidates
}

export function confirmDetection(item: BulkReturnItem, candidate: ReviewCandidate): BulkReturnItem {
  return {
    ...item,
    itemCode: candidate.itemCode,
    itemName: candidate.itemName,
    confidence: candidate.confidence,
    status: 'reviewed',
  }
}

export function getBulkReturnStockBefore() {
  return officialStockBefore
}

export function previewBulkReturnStockUpdate(items: BulkReturnItem[]) {
  const returnedByName = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.itemName] = (acc[item.itemName] ?? 0) + item.quantity
    return acc
  }, {})

  return Object.entries(returnedByName).map(([name, qty]) => {
    const before = officialStockBefore[name] ?? 0
    return { name, before, after: before + qty, returned: qty }
  })
}

export function countBulkReturnItems(items: BulkReturnItem[]) {
  return items.reduce((sum, item) => sum + item.quantity, 0)
}

export function countItemsNeedingReview(items: BulkReturnItem[]) {
  return items.filter((item) => item.status === 'review').length
}

export function checkoutItems(items: { itemCode: string; quantity: number }[]) {
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)
  return {
    totalItems,
    status: 'synced' as const,
  }
}

export function returnItems(items: BulkReturnItem[]) {
  return {
    totalItems: countBulkReturnItems(items),
    reviewRemaining: countItemsNeedingReview(items),
    status: 'synced' as const,
  }
}
