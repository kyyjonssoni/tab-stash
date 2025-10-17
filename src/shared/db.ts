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
  }
}

export const db = new TabStashDB()

