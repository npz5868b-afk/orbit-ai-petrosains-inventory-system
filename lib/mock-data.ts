export type ItemStatus = 'available' | 'checked-out' | 'attention'
export type ItemKind = 'reusable' | 'consumable'

export type InventoryItem = {
  id: string
  name: string
  code: string
  kind: ItemKind
  available: number
  checkedOut: number
  damaged: number
  location: string
  rack: string
  lastSeen: string
  status: ItemStatus
  distribution: { store: string; qty: number }[]
  users: { name: string; qty: number }[]
}

export const inventory: InventoryItem[] = [
  {
    id: 'arduino-uno',
    name: 'Arduino Uno',
    code: 'ELC-0421',
    kind: 'reusable',
    available: 9,
    checkedOut: 4,
    damaged: 1,
    location: 'Store 1 — Electronics',
    rack: 'Rack B3',
    lastSeen: '2 minutes ago',
    status: 'available',
    distribution: [
      { store: 'Store 1', qty: 6 },
      { store: 'Store 2', qty: 2 },
      { store: 'Store 4', qty: 1 },
    ],
    users: [
      { name: 'Team Robotics', qty: 3 },
      { name: 'Aisha R.', qty: 1 },
    ],
  },
  {
    id: 'ultrasonic-sensor',
    name: 'Ultrasonic Sensor',
    code: 'SNS-1180',
    kind: 'reusable',
    available: 14,
    checkedOut: 6,
    damaged: 0,
    location: 'Store 1 — Sensors',
    rack: 'Rack A1',
    lastSeen: '11 minutes ago',
    status: 'available',
    distribution: [
      { store: 'Store 1', qty: 9 },
      { store: 'Store 3', qty: 5 },
    ],
    users: [{ name: 'Team Robotics', qty: 6 }],
  },
  {
    id: 'ir-sensor',
    name: 'IR Sensor',
    code: 'SNS-1204',
    kind: 'reusable',
    available: 3,
    checkedOut: 8,
    damaged: 2,
    location: 'Store 2 — Sensors',
    rack: 'Rack A2',
    lastSeen: '1 hour ago',
    status: 'attention',
    distribution: [
      { store: 'Store 2', qty: 3 },
    ],
    users: [
      { name: 'Team Prototyping', qty: 5 },
      { name: 'Daniel K.', qty: 3 },
    ],
  },
  {
    id: 'screwdriver',
    name: 'Precision Screwdriver',
    code: 'TL-0092',
    kind: 'reusable',
    available: 22,
    checkedOut: 3,
    damaged: 0,
    location: 'Store 1 — Tools',
    rack: 'Rack C5',
    lastSeen: '5 minutes ago',
    status: 'available',
    distribution: [
      { store: 'Store 1', qty: 12 },
      { store: 'Store 2', qty: 6 },
      { store: 'Store 4', qty: 4 },
    ],
    users: [{ name: 'Maintenance', qty: 3 }],
  },
  {
    id: 'jumper-wires',
    name: 'Jumper Wires (40pc)',
    code: 'CBL-3310',
    kind: 'consumable',
    available: 48,
    checkedOut: 0,
    damaged: 0,
    location: 'Store 1 — Cables',
    rack: 'Rack D2',
    lastSeen: '20 minutes ago',
    status: 'available',
    distribution: [
      { store: 'Store 1', qty: 30 },
      { store: 'Store 3', qty: 18 },
    ],
    users: [],
  },
  {
    id: 'breadboard',
    name: 'Breadboard 830pt',
    code: 'ELC-0510',
    kind: 'reusable',
    available: 0,
    checkedOut: 16,
    damaged: 1,
    location: 'Store 3 — Electronics',
    rack: 'Rack B1',
    lastSeen: '3 hours ago',
    status: 'attention',
    distribution: [{ store: 'Store 3', qty: 0 }],
    users: [{ name: 'Team Robotics', qty: 10 }, { name: 'Team Prototyping', qty: 6 }],
  },
  {
    id: 'soldering-iron',
    name: 'Soldering Iron',
    code: 'TL-0145',
    kind: 'reusable',
    available: 5,
    checkedOut: 2,
    damaged: 0,
    location: 'Store 2 — Tools',
    rack: 'Rack C1',
    lastSeen: '40 minutes ago',
    status: 'checked-out',
    distribution: [
      { store: 'Store 2', qty: 5 },
    ],
    users: [{ name: 'Maintenance', qty: 2 }],
  },
  {
    id: 'multimeter',
    name: 'Digital Multimeter',
    code: 'TL-0201',
    kind: 'reusable',
    available: 7,
    checkedOut: 1,
    damaged: 0,
    location: 'Store 1 — Tools',
    rack: 'Rack C6',
    lastSeen: '9 minutes ago',
    status: 'available',
    distribution: [
      { store: 'Store 1', qty: 4 },
      { store: 'Store 4', qty: 3 },
    ],
    users: [{ name: 'Aisha R.', qty: 1 }],
  },
]

export const statusMeta: Record<
  ItemStatus,
  { label: string; tone: 'success' | 'warning' | 'danger' | 'cyan' }
> = {
  available: { label: 'Available', tone: 'success' },
  'checked-out': { label: 'Checked Out', tone: 'cyan' },
  attention: { label: 'Need Attention', tone: 'warning' },
}

export const homeStats = [
  { label: 'Item Types', value: 128, tone: 'cyan' as const },
  { label: 'Checked Out', value: 41, tone: 'violet' as const },
  { label: 'Need Attention', value: 3, tone: 'warning' as const },
  { label: 'Offline Stores', value: 1, tone: 'danger' as const },
]

export const needsAttention = [
  {
    id: 'a1',
    title: '1 return needs review',
    detail: 'Bulk return · Store 1 · uncertain item',
    action: 'Review',
    tone: 'warning' as const,
  },
  {
    id: 'a2',
    title: '2 items overdue',
    detail: 'IR Sensor, Breadboard · Team Prototyping',
    action: 'View Items',
    tone: 'danger' as const,
  },
  {
    id: 'a3',
    title: 'Store 3 offline',
    detail: 'Last sync 3 hours ago · 4 changes waiting',
    action: 'Check Status',
    tone: 'warning' as const,
  },
]

export type Activity = {
  id: string
  type: 'check-out' | 'return' | 'issue'
  title: string
  time: string
  store: string
  user: string
  qty: number
  status: 'synced' | 'offline' | 'review'
  transactionId: string
  items: { name: string; qty: number }[]
  aiSummary: string
  online: boolean
}

export const activities: Activity[] = [
  {
    id: 't-1042',
    type: 'return',
    title: 'Bulk Return · 7 items',
    time: 'Today · 14:32',
    store: 'Store 1',
    user: 'Team Robotics',
    qty: 7,
    status: 'synced',
    transactionId: 'TXN-2048-1042',
    items: [
      { name: 'Arduino Uno', qty: 3 },
      { name: 'Ultrasonic Sensor', qty: 2 },
      { name: 'Jumper Wires (40pc)', qty: 2 },
    ],
    aiSummary: 'All 7 items identified with high confidence. No manual review needed.',
    online: true,
  },
  {
    id: 't-1041',
    type: 'check-out',
    title: 'Check-out · 2 items',
    time: 'Today · 13:05',
    store: 'Store 2',
    user: 'Aisha R.',
    qty: 2,
    status: 'synced',
    transactionId: 'TXN-2048-1041',
    items: [
      { name: 'Digital Multimeter', qty: 1 },
      { name: 'Precision Screwdriver', qty: 1 },
    ],
    aiSummary: 'Items matched by code scan. Assigned to Aisha R.',
    online: true,
  },
  {
    id: 't-1040',
    type: 'issue',
    title: 'Reported Damage · IR Sensor',
    time: 'Today · 11:48',
    store: 'Store 2',
    user: 'Daniel K.',
    qty: 2,
    status: 'review',
    transactionId: 'TXN-2048-1040',
    items: [{ name: 'IR Sensor', qty: 2 }],
    aiSummary: 'Damage report flagged for supervisor review.',
    online: true,
  },
  {
    id: 't-1039',
    type: 'return',
    title: 'Bulk Return · 4 items',
    time: 'Today · 10:20',
    store: 'Store 3',
    user: 'Team Prototyping',
    qty: 4,
    status: 'offline',
    transactionId: 'TXN-2048-1039',
    items: [
      { name: 'Breadboard 830pt', qty: 2 },
      { name: 'Jumper Wires (40pc)', qty: 2 },
    ],
    aiSummary: 'Saved offline while Store 3 was disconnected. Will sync when back online.',
    online: false,
  },
  {
    id: 't-1038',
    type: 'check-out',
    title: 'Check-out · 6 items',
    time: 'Yesterday · 16:11',
    store: 'Store 1',
    user: 'Team Robotics',
    qty: 6,
    status: 'synced',
    transactionId: 'TXN-2047-1038',
    items: [
      { name: 'Ultrasonic Sensor', qty: 4 },
      { name: 'Arduino Uno', qty: 2 },
    ],
    aiSummary: 'Batch check-out assigned to Team Robotics.',
    online: true,
  },
]

export const stores = [
  { name: 'Store 1', area: 'Main Lab', status: 'online' as const, lastSync: 'Just now', items: 512 },
  { name: 'Store 2', area: 'Workshop', status: 'online' as const, lastSync: '2 min ago', items: 344 },
  { name: 'Store 3', area: 'Annex', status: 'offline' as const, lastSync: '3 hours ago', items: 210 },
  { name: 'Store 4', area: 'Storage', status: 'online' as const, lastSync: '5 min ago', items: 168 },
]

export const teams = [
  'Team Robotics',
  'Team Prototyping',
  'Maintenance',
  'Aisha R.',
  'Daniel K.',
]

// Items surfaced during the bulk-return scan demo
export const scannedItems = [
  { id: 's1', name: 'Arduino Uno', code: 'ELC-0421', qty: 3, confidence: 98, status: 'ready' as const },
  { id: 's2', name: 'Ultrasonic Sensor', code: 'SNS-1180', qty: 2, confidence: 95, status: 'ready' as const },
  { id: 's3', name: 'Precision Screwdriver', code: 'TL-0092', qty: 1, confidence: 91, status: 'ready' as const },
  { id: 's4', name: 'Unknown Sensor', code: '—', qty: 1, confidence: 54, status: 'review' as const },
]
