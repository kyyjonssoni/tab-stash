// Message types between UI <-> background
import type { StashResult, Item, TabSummary, TabWithStatus } from './types'

export type BgMessage =
  | { type: 'PING' }
  | { type: 'GET_TABS'; currentWindow?: boolean }
  | { type: 'GET_TABS_STATUS'; currentWindow?: boolean }
  | { type: 'STASH_TABS'; tabIds?: number[]; tags?: string[]; close?: boolean; preserveActive?: boolean }
  | { type: 'GET_ITEMS'; limit?: number }
  | { type: 'SEARCH_ITEMS'; q: string }
  | { type: 'UPDATE_ITEM'; id: string; patch: Partial<Item> }
  | { type: 'DELETE_ITEM'; id: string }
  | { type: 'OPEN_OR_FOCUS_URL'; url: string }
  | { type: 'IMPORT_ITEMS'; items: Array<{ url: string; title?: string; status?: Item['status']; tags?: string[]; createdAt?: number }> }
  | { type: 'CLOSE_TABS'; tabIds: number[]; includePinned?: boolean }
  | { type: 'EXTEND_LIFESPAN'; id: string; additionalDays: number }
  | { type: 'GENERATE_SUMMARY'; id: string }

export type BgResponse =
  | { ok: true; pong: true }
  | { ok: true; tabs: TabSummary[] }
  | { ok: true; tabStatus: TabWithStatus[] }
  | { ok: true; stash: StashResult }
  | { ok: true; items: Item[] }
  | { ok: true; updated: true }
  | { ok: true; deleted: true }
  | { ok: true; opened?: boolean; focused?: boolean }
  | { ok: true; imported: number; updated: number }
  | { ok: true; closed: number }
  | { ok: true; extended: true }
  | { ok: true; summary: string }
  | { ok: false; error: string }

export function sendMessage<T extends BgMessage>(msg: T): Promise<BgResponse> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (res: BgResponse) => resolve(res))
  })
}
