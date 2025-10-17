import { db } from '../shared/db'
import type { BgMessage, BgResponse } from '../shared/messaging'
import type { Item, TabSummary, TabWithStatus } from '../shared/types'
import { normalizeUrl, sha256Hex } from '../shared/url'
// Sync removed in v1
import { getSettings } from '../shared/settings'

async function queryTabs(currentWindow = true): Promise<TabSummary[]> {
  const tabs = await chrome.tabs.query({ currentWindow })
  return tabs
    .filter((t: any) => t.url && typeof t.id === 'number')
    .map((t: any) => ({
      id: t.id as number,
      url: t.url as string,
      title: t.title as string | undefined,
      favIconUrl: t.favIconUrl as string | undefined,
      pinned: !!t.pinned,
      groupId: typeof t.groupId === 'number' ? (t.groupId as number) : undefined
    }))
}

function isHttpUrl(url: string) {
  return url.startsWith('http://') || url.startsWith('https://')
}

function isStashableUrl(url: string) {
  if (!url) return false
  // Disallow internal and special schemes
  const lower = url.toLowerCase()
  if (lower.startsWith('view-source:')) return false
  const disallowed = [
    'chrome://',
    'chrome-extension://',
    'edge://',
    'about:',
    'devtools://',
    'file://',
    'data:',
    'blob:'
  ]
  if (disallowed.some((p) => lower.startsWith(p))) return false
  return isHttpUrl(lower)
}

async function upsertItemFromTab(tab: TabSummary, tags: string[] = []): Promise<'add' | 'update' | 'skip'> {
  if (!isHttpUrl(tab.url)) return 'skip'
  const settings = await getSettings()
  const originalUrl = tab.url
  const n = normalizeUrl(originalUrl, { stripAllParams: settings.stripAllParams, stripTracking: settings.stripTrackingParams })
  const urlHash = await sha256Hex(n)
  const now = Date.now()
  const existing = await db.items.where('urlHash').equals(urlHash).first()
  if (existing) {
    await db.items.update(existing.id, {
      lastSeenAt: now,
      timesAdded: (existing.timesAdded || 1) + 1,
      title: tab.title || existing.title,
      favicon: tab.favIconUrl || existing.favicon,
      tags: Array.from(new Set([...(existing.tags || []), ...tags]))
    })
    return 'update'
  }
  const item: Item = {
    id: crypto.randomUUID(),
    url: originalUrl,
    urlHash,
    title: tab.title,
    favicon: tab.favIconUrl,
    createdAt: now,
    lastSeenAt: now,
    status: 'stashed',
    timesAdded: 1,
    tags: tags
  }
  await db.items.add(item)
  return 'add'
}

async function stashTabs(
  tabIds?: number[],
  tags: string[] = [],
  close = false,
  preserveActive = false
): Promise<{ added: number; updated: number; closed: number }> {
  const tabs = tabIds && tabIds.length
    ? (await chrome.tabs.query({})).filter((t: any) => tabIds.includes(t.id as number)).map((t: any) => ({
        id: t.id as number,
        url: t.url as string,
        title: t.title as string | undefined,
        favIconUrl: t.favIconUrl as string | undefined,
        pinned: !!t.pinned,
        groupId: typeof t.groupId === 'number' ? (t.groupId as number) : undefined
      }))
    : await queryTabs(true)

  let added = 0
  let updated = 0
  let closed = 0
  const toClose: number[] = []
  const settings = await getSettings()
  let activeId: number | undefined
  if (preserveActive) {
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true })
    activeId = active?.id as number | undefined
  }
  for (const t of tabs) {
    const res = await upsertItemFromTab(t, tags)
    if (res === 'add') added++
    else if (res === 'update') updated++
    if (close && (settings.closePinned || !t.pinned) && t.id !== activeId) toClose.push(t.id)
  }
  // Schedule a background sync snapshot
  // Sync removed in v1
  if (toClose.length) {
    try { await chrome.tabs.remove(toClose); closed = toClose.length } catch {}
  }
  return { added, updated, closed }
}

chrome.runtime.onInstalled.addListener(() => {
  // Ensure toolbar click opens the Side Panel
  chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true }).catch(() => {})
})

chrome.runtime.onStartup.addListener(() => {
  chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true }).catch(() => {})
})

chrome.runtime.onMessage.addListener((msg: BgMessage, _sender: any, sendResponse: (res: BgResponse) => void) => {
  ;(async () => {
    try {
      switch (msg.type) {
        case 'PING':
          sendResponse({ ok: true, pong: true } satisfies BgResponse)
          break
        case 'GET_TABS': {
          const tabs = await queryTabs(msg.currentWindow !== false)
          sendResponse({ ok: true, tabs } satisfies BgResponse)
          break
        }
        case 'GET_TABS_STATUS': {
          const tabStatus = await getTabsWithStatus(msg.currentWindow !== false)
          sendResponse({ ok: true, tabStatus } satisfies BgResponse)
          break
        }
        case 'STASH_TABS': {
          const settings = await getSettings()
          const close = typeof msg.close === 'boolean' ? msg.close : settings.closeAfterStash
          const res = await stashTabs(msg.tabIds, msg.tags || [], close, !!msg.preserveActive)
          sendResponse({ ok: true, stash: res } satisfies BgResponse)
          try { chrome.runtime.sendMessage({ type: 'EVENT_ITEMS_CHANGED' } as any) } catch {}
          break
        }
        case 'GET_ITEMS': {
          const items = await db.items.orderBy('createdAt').reverse().limit(msg.limit ?? 200).toArray()
          sendResponse({ ok: true, items } satisfies BgResponse)
          break
        }
        case 'SEARCH_ITEMS': {
          const q = msg.q.toLowerCase()
          const items = await db.items
            .filter((it) => (it.title || '').toLowerCase().includes(q) || it.url.toLowerCase().includes(q) || (it.tags || []).some((t) => t.toLowerCase().includes(q)))
            .limit(200)
            .toArray()
          sendResponse({ ok: true, items } satisfies BgResponse)
          break
        }
        case 'UPDATE_ITEM': {
          await db.items.update(msg.id, msg.patch)
          sendResponse({ ok: true, updated: true } satisfies BgResponse)
          try { chrome.runtime.sendMessage({ type: 'EVENT_ITEMS_CHANGED' } as any) } catch {}
          break
        }
        case 'DELETE_ITEM': {
          await db.items.delete(msg.id)
          sendResponse({ ok: true, deleted: true } satisfies BgResponse)
          try { chrome.runtime.sendMessage({ type: 'EVENT_ITEMS_CHANGED' } as any) } catch {}
          break
        }
        case 'IMPORT_ITEMS': {
          const now = Date.now()
          let imported = 0
          let updated = 0
          const toInsert: Item[] = []
          const toUpdate: { id: string; patch: Partial<Item> }[] = []
          const settings = await getSettings()
          for (const raw of msg.items) {
            try {
              const originalUrl = raw.url
              if (!isHttpUrl(originalUrl)) continue
              const n = normalizeUrl(originalUrl, { stripAllParams: settings.stripAllParams, stripTracking: settings.stripTrackingParams })
              const urlHash = await sha256Hex(n)
              const existing = await db.items.where('urlHash').equals(urlHash).first()
              const tags = Array.from(new Set((existing?.tags || []).concat(raw.tags || [])))
              if (existing) {
                toUpdate.push({ id: existing.id, patch: {
                  title: raw.title ?? existing.title,
                  status: raw.status ?? existing.status,
                  tags,
                  lastSeenAt: now
                } })
                updated++
              } else {
                const item: Item = {
                  id: crypto.randomUUID(),
                  url: originalUrl,
                  urlHash,
                  title: raw.title,
                  createdAt: raw.createdAt ?? now,
                  lastSeenAt: now,
                  status: raw.status ?? 'stashed',
                  timesAdded: 1,
                  tags
                }
                toInsert.push(item)
                imported++
              }
            } catch {}
          }
          if (toInsert.length) await db.items.bulkAdd(toInsert, { allKeys: false })
          for (const u of toUpdate) await db.items.update(u.id, u.patch)
          sendResponse({ ok: true, imported, updated } satisfies BgResponse)
          try { chrome.runtime.sendMessage({ type: 'EVENT_ITEMS_CHANGED' } as any) } catch {}
          break
        }
        // SYNC_NOW removed in v1
        case 'CLOSE_TABS': {
          const settings = await getSettings()
          const includePinned = msg.includePinned ?? settings.closePinned
          const ids = msg.tabIds
          const tabs = await chrome.tabs.query({})
          const toClose = tabs
            .filter((t: any) => ids.includes(t.id as number))
            .filter((t: any) => includePinned || !t.pinned)
            .map((t: any) => t.id as number)
          let closed = 0
          if (toClose.length) {
            try { await chrome.tabs.remove(toClose); closed = toClose.length } catch {}
          }
          sendResponse({ ok: true, closed } satisfies BgResponse)
          break
        }
        case 'OPEN_OR_FOCUS_URL': {
          const settings = await getSettings()
          const targetNorm = normalizeUrl(msg.url, { stripAllParams: settings.stripAllParams, stripTracking: settings.stripTrackingParams })
          const targetHash = await sha256Hex(targetNorm)
          const tabs = await chrome.tabs.query({})
          for (const t of tabs) {
            const href = (t as any).url as string | undefined
            if (!href) continue
            if (!isHttpUrl(href)) continue
            const norm = normalizeUrl(href, { stripAllParams: settings.stripAllParams, stripTracking: settings.stripTrackingParams })
            const hash = await sha256Hex(norm)
            if (hash === targetHash) {
              try {
                if (typeof (t as any).windowId === 'number') await chrome.windows.update((t as any).windowId as number, { focused: true })
                if (typeof (t as any).id === 'number') await chrome.tabs.update((t as any).id as number, { active: true })
              } catch {}
              sendResponse({ ok: true, focused: true } satisfies BgResponse)
              return
            }
          }
          await chrome.tabs.create({ url: msg.url })
          sendResponse({ ok: true, opened: true } satisfies BgResponse)
          break
        }
        default:
          sendResponse({ ok: false, error: 'Unknown message' } as BgResponse)
      }
    } catch (e: any) {
      sendResponse({ ok: false, error: String(e?.message || e) } as BgResponse)
    }
  })()
  return true
})

// Keyboard shortcuts/commands
chrome.commands?.onCommand.addListener(async (command: string) => {
  try {
    if (command === 'stash_all_tabs') {
      const settings = await getSettings()
      await stashTabs(undefined, [], settings.closeAfterStash)
    } else if (command === 'open_side_panel') {
      try { await chrome.sidePanel.open({}) } catch {}
    } else if (command === 'open_dashboard') {
      const url = chrome.runtime.getURL('src/dashboard/index.html')
      await chrome.tabs.create({ url })
    } else if (command === 'stash_current_tab') {
      const [active] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (active?.id) await stashTabs([active.id], [], (await getSettings()).closeAfterStash)
    }
  } catch {}
})

// Clicking the toolbar button opens the Side Panel
chrome.action?.onClicked.addListener(async () => {
  try { await chrome.sidePanel.open({}) } catch {}
})
async function getTabsWithStatus(currentWindow = true): Promise<TabWithStatus[]> {
  const settings = await getSettings()
  const tabs = await queryTabs(currentWindow)
  const out: TabWithStatus[] = []
  for (const t of tabs) {
    const stashable = isStashableUrl(t.url)
    let urlHash = ''
    let existing: Item | undefined
    if (stashable) {
      const n = normalizeUrl(t.url, { stripAllParams: settings.stripAllParams, stripTracking: settings.stripTrackingParams })
      urlHash = await sha256Hex(n)
      existing = await db.items.where('urlHash').equals(urlHash).first()
    }
    out.push({
      ...t,
      urlHash,
      stashed: !!existing && existing.status !== 'trashed',
      itemId: existing?.id,
      itemStatus: existing?.status,
      stashable
    })
  }
  return out
}
