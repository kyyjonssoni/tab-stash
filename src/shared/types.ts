export type ItemStatus = 'stashed' | 'read' | 'archived' | 'trashed'

export interface Item {
  id: string
  url: string
  urlHash: string
  title?: string
  favicon?: string
  createdAt: number
  lastSeenAt: number
  status: ItemStatus
  timesAdded: number
  notes?: string
  tags?: string[]
  // Lifespan tracking: default 30 days from createdAt
  expiresAt?: number
  lifespanDays?: number // customizable per item, default 30
  autoArchived?: boolean // true if archived by expiration
  summary?: string // AI-generated summary
  // Group/session tracking (from OneTab or manual grouping)
  group?: string // group name/session name
  groupCreatedAt?: number // when the group was created
}

export interface StashResult {
  added: number
  updated: number
  closed?: number
}

export interface TabSummary {
  id: number
  url: string
  title?: string
  favIconUrl?: string
  pinned?: boolean
  groupId?: number
}

export interface TabWithStatus extends TabSummary {
  urlHash: string
  stashed: boolean
  itemId?: string
  itemStatus?: ItemStatus
  stashable: boolean
}
