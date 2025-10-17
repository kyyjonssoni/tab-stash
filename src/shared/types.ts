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
