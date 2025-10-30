import { db } from '../shared/db'
import type { BgMessage, BgResponse } from '../shared/messaging'
import type { Item, TabSummary, TabWithStatus } from '../shared/types'
import { normalizeUrl, sha256Hex } from '../shared/url'
// Sync removed in v1
import { getSettings } from '../shared/settings'
import { calculateExpiresAt, DEFAULT_LIFESPAN_DAYS, isExpired } from '../shared/lifespan'

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
  const lifespanDays = DEFAULT_LIFESPAN_DAYS
  const expiresAt = calculateExpiresAt(now, lifespanDays)
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
    tags: tags,
    lifespanDays,
    expiresAt
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

async function autoArchiveExpiredItems() {
  try {
    const allItems = await db.items.where('status').equals('stashed').toArray()
    const expired = allItems.filter((item) => isExpired(item))
    
    if (expired.length > 0) {
      for (const item of expired) {
        await db.items.update(item.id, {
          status: 'archived',
          autoArchived: true
        })
      }
      console.log(`Auto-archived ${expired.length} expired item(s)`)
      try {
        chrome.runtime.sendMessage({ type: 'EVENT_ITEMS_CHANGED' } as any)
      } catch {}
    }
  } catch (e) {
    console.error('Auto-archive failed:', e)
  }
}

chrome.runtime.onInstalled.addListener(() => {
  // Ensure toolbar click opens the Side Panel
  chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true }).catch(() => {})
  // Run initial auto-archive check
  autoArchiveExpiredItems()
})

chrome.runtime.onStartup.addListener(() => {
  chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true }).catch(() => {})
  // Run auto-archive on startup
  autoArchiveExpiredItems()
})

// Run auto-archive check every 6 hours
setInterval(autoArchiveExpiredItems, 6 * 60 * 60 * 1000)

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
          const settings = await getSettings()
          
          // PERFORMANCE OPTIMIZATION: Batch process all URLs first
          // Instead of individual lookups (N queries), we do 1 bulk query
          const urlData: Array<{ url: string; normalized: string; hash: string; raw: any }> = []
          
          // Step 1: Normalize all URLs and compute hashes in parallel
          const hashPromises = msg.items.map(async (raw) => {
            try {
              const originalUrl = raw.url
              if (!isHttpUrl(originalUrl)) return null
              const normalized = normalizeUrl(originalUrl, { 
                stripAllParams: settings.stripAllParams, 
                stripTracking: settings.stripTrackingParams 
              })
              const hash = await sha256Hex(normalized)
              return { url: originalUrl, normalized, hash, raw }
            } catch {
              return null
            }
          })
          
          const results = await Promise.all(hashPromises)
          for (const result of results) {
            if (result) urlData.push(result)
          }
          
          if (urlData.length === 0) {
            sendResponse({ ok: true, imported: 0, updated: 0 } satisfies BgResponse)
            break
          }
          
          // Step 2: Batch fetch all existing items with matching hashes (1 query instead of N)
          const allHashes = urlData.map(d => d.hash)
          const existingItems = await db.items.where('urlHash').anyOf(allHashes).toArray()
          const existingMap = new Map(existingItems.map(it => [it.urlHash, it]))
          
          // Step 3: Process in memory (fast)
          const toInsert: Item[] = []
          const toUpdate: { id: string; patch: Partial<Item> }[] = []
          let imported = 0
          let updated = 0
          
          for (const { url, hash, raw } of urlData) {
            const existing = existingMap.get(hash)
            const tags = Array.from(new Set((existing?.tags || []).concat(raw.tags || [])))
            
            if (existing) {
              toUpdate.push({ 
                id: existing.id, 
                patch: {
                  title: raw.title ?? existing.title,
                  status: raw.status ?? existing.status,
                  tags,
                  lastSeenAt: now
                } 
              })
              updated++
            } else {
              const createdAt = raw.createdAt ?? now
              const lifespanDays = DEFAULT_LIFESPAN_DAYS
              const expiresAt = calculateExpiresAt(createdAt, lifespanDays)
              const item: Item = {
                id: crypto.randomUUID(),
                url,
                urlHash: hash,
                title: raw.title,
                createdAt,
                lastSeenAt: now,
                status: raw.status ?? 'stashed',
                timesAdded: 1,
                tags,
                lifespanDays,
                expiresAt,
                group: raw.group,
                groupCreatedAt: raw.groupCreatedAt
              }
              toInsert.push(item)
              imported++
            }
          }
          
          // Step 4: Batch write to database
          if (toInsert.length) await db.items.bulkAdd(toInsert, { allKeys: false })
          if (toUpdate.length) {
            // Batch updates for better performance
            await Promise.all(toUpdate.map(u => db.items.update(u.id, u.patch)))
          }
          
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
        case 'EXTEND_LIFESPAN': {
          const item = await db.items.get(msg.id)
          if (!item) {
            sendResponse({ ok: false, error: 'Item not found' } as BgResponse)
            break
          }
          const currentLifespan = item.lifespanDays ?? DEFAULT_LIFESPAN_DAYS
          const newLifespan = currentLifespan + msg.additionalDays
          const newExpiresAt = calculateExpiresAt(item.createdAt, newLifespan)
          await db.items.update(msg.id, {
            lifespanDays: newLifespan,
            expiresAt: newExpiresAt
          })
          sendResponse({ ok: true, extended: true } satisfies BgResponse)
          try { chrome.runtime.sendMessage({ type: 'EVENT_ITEMS_CHANGED' } as any) } catch {}
          break
        }
        case 'GENERATE_SUMMARY': {
          const item = await db.items.get(msg.id)
          if (!item) {
            sendResponse({ ok: false, error: 'Item not found' } as BgResponse)
            break
          }
          // Placeholder for AI summary generation
          // This would integrate with an AI service (OpenAI, Anthropic, etc.)
          // For now, return a placeholder that indicates where AI integration should go
          const summary = `[AI Summary Placeholder]\n\nThis is where an AI-generated summary would appear. To implement:\n1. Add API key configuration in settings\n2. Fetch page content\n3. Send to AI service with prompt: "Summarize this article in 2-3 sentences"\n4. Match against defined tags if any\n\nTitle: ${item.title || 'Untitled'}\nURL: ${item.url}\nTags: ${(item.tags || []).join(', ') || 'None'}`
          
          await db.items.update(msg.id, { summary })
          sendResponse({ ok: true, summary } satisfies BgResponse)
          try { chrome.runtime.sendMessage({ type: 'EVENT_ITEMS_CHANGED' } as any) } catch {}
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
