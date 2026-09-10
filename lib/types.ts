export type Tone = 'cyan' | 'violet' | 'teal' | 'success' | 'warning' | 'danger'

export type InventoryStatus = 'available' | 'checked-out' | 'attention'
export type ItemKind = 'reusable' | 'consumable'
export type ActivityType = 'check-out' | 'return' | 'issue'
export type ActivityStatus = 'synced' | 'offline' | 'review'
export type StoreConnectionStatus = 'online' | 'offline'
export type SyncStatus = 'online' | 'offline' | 'saved-offline' | 'syncing' | 'restored' | 'up-to-date' | 'failed'
export type DetectionStatus = 'ready' | 'review' | 'reviewed'

export type InventoryItem = {
  id: string
  name: string
  code: string
  category: string
  kind: ItemKind
  available: number
  checkedOut: number
  damaged: number
  location: string
  rack: string
  lastSeen: string
  status: InventoryStatus
  distribution: { store: string; qty: number }[]
  users: { name: string; qty: number }[]
}

export type StoreLocation = {
  id: string
  name: string
  area: string
  status: StoreConnectionStatus
  lastSync: string
  items: number
}

export type DetectionResult = {
  id: string
  itemCode: string
  itemName: string
  quantity: number
  confidence: number
  status: DetectionStatus
}

export type BulkReturnDetection = DetectionResult & {
  top: string
  left: string
  width: string
  height: string
  labelSide?: 'left' | 'right'
}

export type BulkReturnItem = DetectionResult

export type CheckoutItem = {
  itemCode: string
  itemName: string
  confidence: number
}

export type ActivityRecord = {
  id: string
  type: ActivityType
  title: string
  time: string
  store: string
  user: string
  qty: number
  status: ActivityStatus
  syncStatus: SyncStatus
  transactionId: string
  items: { name: string; qty: number }[]
  aiSummary: string
  online: boolean
}

export type ReviewCandidate = {
  id: string
  itemCode: string
  itemName: string
  confidence: number
}

export type AttentionItem = {
  id: string
  title: string
  detail: string
  action: string
  href: string
  tone: Extract<Tone, 'warning' | 'danger'>
}

export type HomeStat = {
  label: string
  value: number
  tone: Tone
}

export type StatusMeta = {
  label: string
  tone: Tone
}

export type RecoveryState = {
  title: string
  message: string
  inventoryChanged: boolean
  actions: string[]
  tone: Extract<Tone, 'cyan' | 'warning' | 'danger' | 'success'>
}

export type OfflineState = {
  label: string
  message: string
  status: SyncStatus
  tone: Extract<Tone, 'cyan' | 'warning' | 'success' | 'danger'>
}
