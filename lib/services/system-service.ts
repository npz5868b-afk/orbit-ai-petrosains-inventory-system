import { offlineStates, recoveryStates } from '@/lib/mock-data'
import { getInventoryFacts, getStoreStatuses } from './inventory-service'

export function getSystemOverview() {
  return {
    facts: getInventoryFacts(),
    stores: getStoreStatuses(),
    offlineStates,
    recoveryStates,
  }
}
