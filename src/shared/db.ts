import Dexie, { Table } from 'dexie'
import type { Item } from './types'

export class TabStashDB extends Dexie {
  items!: Table<Item, string>

  constructor() {
    super('tab-stash-db')
    this.version(1).stores({
      // id is primary key, urlHash indexed for dedupe, status and dates for queries
      items: '&id, urlHash, status, createdAt, lastSeenAt'
    })
    // Migration for v2: add expiresAt and lifespan fields
    this.version(2).stores({
      items: '&id, urlHash, status, createdAt, lastSeenAt, expiresAt'
    }).upgrade(async (tx) => {
      // Add expiresAt to existing items (30 days from createdAt)
      const items = await tx.table('items').toArray()
      for (const item of items) {
        if (!item.expiresAt && item.createdAt) {
          const lifespanDays = item.lifespanDays ?? 30
          const expiresAt = item.createdAt + lifespanDays * 24 * 60 * 60 * 1000
          await tx.table('items').update(item.id, { expiresAt, lifespanDays })
        }
      }
    })
    // Migration for v3: add group field
    this.version(3).stores({
      items: '&id, urlHash, status, createdAt, lastSeenAt, expiresAt, group'
    })
  }
}

export const db = new TabStashDB()

