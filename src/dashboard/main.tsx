import React from 'react'
import { createRoot } from 'react-dom/client'
import { sendMessage } from '../shared/messaging'
import type { Item } from '../shared/types'
import '../styles/globals.css'
import { initSystemTheme } from '@/shared/theme'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Toaster, toast } from 'sonner'
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '@/components/ui/table'
// Status filter now uses DropdownMenu with checkboxes (multi-select)
import { Dialog as ConfirmDialog, DialogContent as ConfirmContent, DialogHeader as ConfirmHeader, DialogTitle as ConfirmTitle, DialogDescription as ConfirmDescription } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { ChevronsUpDown, Info, Clock, Sparkles } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { SelectionBar } from './components/SelectionBar'
import { RowActions } from './components/RowActions'
import { useDebounce } from '@/hooks/use-debounce'
import { getLifespanProgress, getRemainingDays, getShamingMessage, getStalenessLevel, getProgressColor } from '@/shared/lifespan'
import { parseOneTabExport, oneTabToItems, parseOneTabExportWithGroups, type OneTabGroup } from '@/shared/onetab-import'

// Apply system theme (MV3 CSP-safe)
initSystemTheme()

function Dashboard() {
  // Sonner toast utility
  const [items, setItems] = React.useState<Item[]>([])
  const [q, setQ] = React.useState('')
  const dq = useDebounce(q, 300)
  const allStatuses: Item['status'][] = ['stashed', 'read', 'archived', 'trashed']
  // Default to only "To Read" (stashed)
  const [statusMulti, setStatusMulti] = React.useState<Item['status'][]>(['stashed'])
  const [selectedTags, setSelectedTags] = React.useState<string[]>([])
  const [selected, setSelected] = React.useState<Record<string, boolean>>({})
  const [editTags, setEditTags] = React.useState<Record<string, string>>({})
  const [editingRowId, setEditingRowId] = React.useState<string | null>(null)
  const [removeTag, setRemoveTag] = React.useState<{ id: string; tag: string } | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false)
  const [confirmId, setConfirmId] = React.useState<string | null>(null)
  const [openStashedIds, setOpenStashedIds] = React.useState<number[]>([])
  const [closingStashed, setClosingStashed] = React.useState(false)
  const [confirmCloseStashed, setConfirmCloseStashed] = React.useState(false)
  const editorRef = React.useRef<HTMLDivElement | null>(null)
  type SortKey = 'createdAt' | 'title' | 'domain' | 'status' | 'lifespan'
  const [sortKey, setSortKey] = React.useState<SortKey>('createdAt')
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc')
  const [oneTabText, setOneTabText] = React.useState('')
  const [oneTabDialogOpen, setOneTabDialogOpen] = React.useState(false)
  const [oneTabGroups, setOneTabGroups] = React.useState<OneTabGroup[]>([])
  const [oneTabPreviewMode, setOneTabPreviewMode] = React.useState(false)
  const [summaryDialogOpen, setSummaryDialogOpen] = React.useState(false)
  const [summaryItemId, setSummaryItemId] = React.useState<string | null>(null)
  const [generatingSummary, setGeneratingSummary] = React.useState(false)
  const [selectedGroups, setSelectedGroups] = React.useState<string[]>([])

  function displayStatus(s: Item['status']): string {
    if (s === 'stashed') return 'To Read'
    if (s === 'read') return 'Read'
    if (s === 'archived') return 'Archived'
    if (s === 'trashed') return 'Trashed'
    return s
  }

  React.useEffect(() => {
    refresh()
  }, [])

  // Instant refresh when background reports item changes
  React.useEffect(() => {
    const onMsg = (msg: any) => { if (msg?.type === 'EVENT_ITEMS_CHANGED') refresh() }
    try { chrome.runtime.onMessage.addListener(onMsg) } catch {}
    return () => { try { chrome.runtime.onMessage.removeListener(onMsg) } catch {} }
  }, [])

  // Refresh when window regains focus or tab becomes visible (e.g., after sleep)
  React.useEffect(() => {
    const onFocusOrVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('focus', onFocusOrVisible)
    document.addEventListener('visibilitychange', onFocusOrVisible)
    return () => {
      window.removeEventListener('focus', onFocusOrVisible)
      document.removeEventListener('visibilitychange', onFocusOrVisible)
    }
  }, [])

  // Close tag editor on outside click (same as Esc)
  React.useEffect(() => {
    if (!editingRowId) return
    function onDown(e: MouseEvent | TouchEvent) {
      const el = editorRef.current
      const target = e.target as Node | null
      if (!el || (target && el.contains(target))) return
      const id = editingRowId!
      const item = items.find((i) => i.id === id)
      if (item) setEditTags((m) => ({ ...m, [id]: (item.tags || []).join(' ') }))
      setEditingRowId(null)
    }
    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('touchstart', onDown, true)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('touchstart', onDown, true)
    }
  }, [editingRowId, items])

  async function refresh() {
    const res = await sendMessage({ type: 'GET_ITEMS', limit: 2000 })
    if (res.ok && 'items' in res) {
      setItems(res.items)
      const map: Record<string, string> = {}
      res.items.forEach((it) => { map[it.id] = (it.tags || []).join(' ') })
      setEditTags(map)
    }
    await refreshOpenStashed()
  }

  async function refreshOpenStashed() {
    const res = await sendMessage({ type: 'GET_TABS_STATUS', currentWindow: true })
    if (res.ok && 'tabStatus' in res) {
      const ids = (res.tabStatus as any[]).filter((t) => t.stashed).map((t) => t.id as number)
      setOpenStashedIds(ids)
    }
  }

  async function onSearchImmediate(v: string) {
    if (!v) return refresh()
    const res = await sendMessage({ type: 'SEARCH_ITEMS', q: v })
    if (res.ok && 'items' in res) setItems(res.items)
  }
  React.useEffect(() => { onSearchImmediate(dq) }, [dq])

  const uniqueTags = React.useMemo(() => {
    const s = new Set<string>()
    for (const it of items) for (const t of it.tags || []) s.add(t)
    return Array.from(s).sort()
  }, [items])

  const uniqueGroups = React.useMemo(() => {
    const s = new Set<string>()
    for (const it of items) if (it.group) s.add(it.group)
    return Array.from(s).sort()
  }, [items])

  const filtered = React.useMemo(() => {
    return items.filter((it) => {
      const byStatus = statusMulti.length === 0 || statusMulti.includes(it.status)
      const byTagMulti = selectedTags.length === 0 || (it.tags || []).some((t) => selectedTags.includes(t))
      const byGroup = selectedGroups.length === 0 || (it.group && selectedGroups.includes(it.group))
      return byStatus && byTagMulti && byGroup
    })
  }, [items, statusMulti, selectedTags, selectedGroups])

  function domainOf(it: Item) {
    try { return new URL(it.url).host.toLowerCase() } catch { return '' }
  }
  const sorted = React.useMemo(() => {
    const arr = [...filtered]
    arr.sort((a, b) => {
      let av: string | number = 0
      let bv: string | number = 0
      if (sortKey === 'createdAt') { av = a.createdAt; bv = b.createdAt }
      else if (sortKey === 'title') { av = (a.title || a.url).toLowerCase(); bv = (b.title || b.url).toLowerCase() }
      else if (sortKey === 'domain') { av = domainOf(a); bv = domainOf(b) }
      else if (sortKey === 'status') { av = a.status; bv = b.status }
      else if (sortKey === 'lifespan') { av = getLifespanProgress(a); bv = getLifespanProgress(b) }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return arr
  }, [filtered, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
        return prev
      }
      setSortDir('asc')
      return key
    })
  }

  function fmtDate(ts: number) {
    try { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(ts) } catch { return new Date(ts).toLocaleString() }
  }

  const selectedIds = React.useMemo(() => Object.entries(selected).filter(([, v]) => v).map(([k]) => k), [selected])
  const selectedItems = React.useMemo(() => {
    if (!selectedIds.length) return [] as Item[]
    const map = new Map(items.map((it) => [it.id, it]))
    return selectedIds.map((id) => map.get(id)!).filter(Boolean) as Item[]
  }, [selectedIds, items])
  const allSelected = React.useMemo(() => {
    if (!sorted.length) return false
    return sorted.every((it) => !!selected[it.id])
  }, [sorted, selected])

  async function bulkSetStatus(next: Item['status']) {
    const tasks = selectedIds.map((id) => () => sendMessage({ type: 'UPDATE_ITEM', id, patch: { status: next } }))
    await runConcurrent(tasks, 8)
    setSelected({})
    await refresh()
    toast(`Updated ${selectedIds.length} item(s)`)
  }

  async function bulkDelete() {
    const map = new Map(items.map((it) => [it.id, it]))
    const first = map.get(selectedIds[0])
    const tasks = selectedIds.map((id) => () => sendMessage({ type: 'DELETE_ITEM', id }))
    await runConcurrent(tasks, 8)
    setSelected({})
    await refresh()
    const rest = selectedIds.length - 1
    const firstLine = first ? (first.title || first.url) : ''
    toast(`Deleted ${selectedIds.length} item(s)`, { description: rest > 0 && firstLine ? `${firstLine} (+${rest} more)` : firstLine || undefined })
  }

  function activeItems(): Item[] {
    const map = new Map(items.map((it) => [it.id, it]))
    if (selectedIds.length) return selectedIds.map((id) => map.get(id)!).filter(Boolean) as Item[]
    return filtered
  }

  async function restoreAll() {
    const targets = activeItems()
    if (!targets.length) return
    if (targets.length > 25 && !confirm(`Open ${targets.length} tabs?`)) return
    for (const it of targets) {
      chrome.tabs.create({ url: it.url })
    }
    toast(`Opened ${targets.length} tab(s)`)
  }

  function downloadBlob(filename: string, content: string, mime = 'text/plain') {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function exportTXT() {
    // One URL per line (no blank lines)
    const list = activeItems().map((it) => it.url).join('\n')
    downloadBlob('tab-stash.txt', list, 'text/plain')
    toast('Downloaded text list')
  }

  function exportCSV() {
    const rows = activeItems().map((it) => {
      const esc = (s: string) => '"' + s.replace(/"/g, '""') + '"'
      const date = new Date(it.createdAt).toISOString()
      return [esc(it.title || ''), esc(it.url), esc(it.status), esc((it.tags || []).join(' ')), esc(date)].join(',')
    })
    const header = 'title,url,status,tags,createdAt'
    downloadBlob('tab-stash.csv', [header, ...rows].join('\n'), 'text/csv')
    toast('Downloaded CSV')
  }

  function parseCSV(text: string): Array<{ url: string; title?: string; status?: Item['status']; tags?: string[]; createdAt?: number }> {
    // Minimal CSV parser supporting quotes and escaped quotes
    const rows: string[][] = []
    let field = ''
    let row: string[] = []
    let inQuotes = false
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++ } else { inQuotes = false }
        } else { field += ch }
      } else {
        if (ch === '"') inQuotes = true
        else if (ch === ',') { row.push(field); field = '' }
        else if (ch === '\n' || ch === '\r') {
          if (ch === '\r' && text[i + 1] === '\n') i++
          row.push(field); field = ''
          if (row.length) rows.push(row)
          row = []
        } else { field += ch }
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row) }
    if (!rows.length) return []
    const header = rows[0].map((h) => h.trim().toLowerCase())
    const ti = header.indexOf('title')
    const ui = header.indexOf('url')
    const si = header.indexOf('status')
    const gi = header.indexOf('tags')
    const ci = header.indexOf('createdat')
    const out: Array<{ url: string; title?: string; status?: Item['status']; tags?: string[]; createdAt?: number }> = []
    for (let r = 1; r < rows.length; r++) {
      const cols = rows[r]
      const url = ui >= 0 ? cols[ui]?.trim() : ''
      if (!url) continue
      const title = ti >= 0 ? cols[ti]?.trim() : undefined
      const status = si >= 0 ? (cols[si]?.trim() as Item['status']) : undefined
      const tagsStr = gi >= 0 ? cols[gi] || '' : ''
      const createdAt = ci >= 0 ? Date.parse(cols[ci] || '') : undefined
      const tags = Array.from(new Set(tagsStr.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)))
      out.push({ url, title, status, tags, createdAt: isNaN(createdAt ?? NaN) ? undefined : createdAt })
    }
    return out
  }

  const fileRef = React.useRef<HTMLInputElement | null>(null)


  async function closeOpenStashedTabs() {
    if (openStashedIds.length === 0) return
    setClosingStashed(true)
    const res = await sendMessage({ type: 'CLOSE_TABS', tabIds: openStashedIds })
    setClosingStashed(false)
    if (res.ok && 'closed' in res) {
      toast(`Closed ${res.closed} stashed tab(s)`)
      await refreshOpenStashed()
    }
  }

  function parseTags(input: string) {
    return Array.from(new Set(input.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)))
  }

  async function runConcurrent(tasks: Array<() => Promise<any>>, concurrency = 8) {
    let i = 0
    const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
      while (i < tasks.length) {
        const cur = i++
        try { await tasks[cur]() } catch {}
      }
    })
    await Promise.all(workers)
  }

  async function previewOneTabImport() {
    if (!oneTabText.trim()) {
      toast('Please paste OneTab export data')
      return
    }
    const groups = parseOneTabExportWithGroups(oneTabText)
    if (!groups.length) {
      toast('No valid URLs found')
      return
    }
    setOneTabGroups(groups)
    setOneTabPreviewMode(true)
  }

  async function importOneTab() {
    if (!oneTabPreviewMode) {
      await previewOneTabImport()
      return
    }
    
    const lines = parseOneTabExport(oneTabText)
    if (!lines.length) {
      toast('No valid URLs found')
      return
    }
    const items = oneTabToItems(lines)
    const res = await sendMessage({ type: 'IMPORT_ITEMS', items })
    if (res.ok && 'imported' in res) {
      const groupCount = oneTabGroups.length
      toast(`Imported ${res.imported} items from ${groupCount} group(s), updated ${res.updated}`)
      setOneTabDialogOpen(false)
      setOneTabText('')
      setOneTabGroups([])
      setOneTabPreviewMode(false)
      await refresh()
    }
  }

  async function generateSummary(itemId: string) {
    setGeneratingSummary(true)
    const res = await sendMessage({ type: 'GENERATE_SUMMARY', id: itemId })
    setGeneratingSummary(false)
    if (res.ok && 'summary' in res) {
      toast('Summary generated')
      await refresh()
    } else if ('error' in res) {
      toast(`Error: ${res.error}`)
    }
  }

  async function extendLifespan(itemId: string, days: number) {
    const res = await sendMessage({ type: 'EXTEND_LIFESPAN', id: itemId, additionalDays: days })
    if (res.ok && 'extended' in res) {
      toast(`Extended lifespan by ${days} day(s)`)
      await refresh()
    } else if ('error' in res) {
      toast(`Error: ${res.error}`)
    }
  }

  return (
    <div className="p-4 space-y-3">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <img src="/branding/stashy.svg" alt="Logo" className="w-12" />
        <span>Tab Stash</span>
        <span className="text-xs text-muted-foreground font-normal font-mono ml-0 mt-1.5">
          by
          {" "}
          <a
            href="https://x.com/iannuttall"
            target="_blank"
            rel="noreferrer noopener"
            className="underline text-current hover:text-current"
          >
            ian
          </a>
        </span>
      </h2>
      <div className="flex gap-2 items-center flex-wrap">
        <div className="w-[280px] shrink-0">
          <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-8 w-40 justify-between px-3">
              <span className="truncate">
                {statusMulti.length === 0 || statusMulti.length === allStatuses.length
                  ? 'All statuses'
                  : statusMulti
                      .map((s) => displayStatus(s))
                      .join(', ')}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 bg-background border shadow-lg z-[1000]">
            <DropdownMenuCheckboxItem
              checked={statusMulti.length === allStatuses.length}
              onCheckedChange={(v) => {
                const checked = !!v
                setStatusMulti(checked ? [...allStatuses] : [])
              }}
              onSelect={(e) => e.preventDefault()}
            >
              All statuses
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={statusMulti.includes('stashed')}
              onCheckedChange={(v) => {
                const checked = !!v
                setStatusMulti((prev) => {
                  const set = new Set(prev)
                  if (checked) set.add('stashed'); else set.delete('stashed')
                  return Array.from(set)
                })
              }}
              onSelect={(e) => e.preventDefault()}
            >
              <span className="inline-flex items-center gap-2">
                <span className="size-2 rounded-full bg-blue-500" />
                To Read
              </span>
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={statusMulti.includes('read')}
              onCheckedChange={(v) => {
                const checked = !!v
                setStatusMulti((prev) => {
                  const set = new Set(prev)
                  if (checked) set.add('read'); else set.delete('read')
                  return Array.from(set)
                })
              }}
              onSelect={(e) => e.preventDefault()}
            >
              <span className="inline-flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-500" />
                Read
              </span>
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={statusMulti.includes('archived')}
              onCheckedChange={(v) => {
                const checked = !!v
                setStatusMulti((prev) => {
                  const set = new Set(prev)
                  if (checked) set.add('archived'); else set.delete('archived')
                  return Array.from(set)
                })
              }}
              onSelect={(e) => e.preventDefault()}
            >
              <span className="inline-flex items-center gap-2">
                <span className="size-2 rounded-full bg-zinc-400" />
                Archived
              </span>
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={statusMulti.includes('trashed')}
              onCheckedChange={(v) => {
                const checked = !!v
                setStatusMulti((prev) => {
                  const set = new Set(prev)
                  if (checked) set.add('trashed'); else set.delete('trashed')
                  return Array.from(set)
                })
              }}
              onSelect={(e) => e.preventDefault()}
            >
              <span className="inline-flex items-center gap-2">
                <span className="size-2 rounded-full bg-red-500" />
                Trashed
              </span>
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="min-w-[240px] shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-8 w-full justify-start gap-2 overflow-hidden">
                {selectedTags.length === 0 ? (
                  <span className="text-muted-foreground">Filter by tags</span>
                ) : (
                  <div className="flex gap-1 flex-wrap items-center">
                    {selectedTags.slice(0, 3).map((t) => (
                      <Badge key={t} className="flex items-center gap-1">
                        {t}
                        <span
                          role="button"
                          aria-label={`Remove ${t}`}
                          className="cursor-pointer opacity-70 hover:opacity-100"
                          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation() }}
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedTags((arr) => arr.filter((x) => x !== t)) }}
                        >×</span>
                      </Badge>
                    ))}
                    {selectedTags.length > 3 && (
                      <Badge variant="secondary">+{selectedTags.length - 3}</Badge>
                    )}
                  </div>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[240px] bg-background border shadow-lg z-[1000]">
              {uniqueTags.length === 0 ? (
                <DropdownMenuItem disabled>No tags</DropdownMenuItem>
              ) : (
                uniqueTags.map((t) => (
                  <DropdownMenuCheckboxItem
                    key={t}
                    checked={selectedTags.includes(t)}
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={(v) => {
                      const checked = !!v
                      setSelectedTags((prev) => {
                        if (checked) return Array.from(new Set([...prev, t]))
                        return prev.filter((x) => x !== t)
                      })
                    }}
                  >
                    {t}
                  </DropdownMenuCheckboxItem>
                ))
              )}
              {selectedTags.length > 0 && (
                <>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={() => setSelectedTags([])}>Clear selection</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="min-w-[240px] shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-8 w-full justify-start gap-2 overflow-hidden">
                {selectedGroups.length === 0 ? (
                  <span className="text-muted-foreground">Filter by group</span>
                ) : (
                  <div className="flex gap-1 flex-wrap items-center">
                    {selectedGroups.slice(0, 2).map((g) => (
                      <Badge key={g} variant="outline" className="flex items-center gap-1">
                        {g}
                        <span
                          role="button"
                          aria-label={`Remove ${g}`}
                          className="cursor-pointer opacity-70 hover:opacity-100"
                          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation() }}
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedGroups((arr) => arr.filter((x) => x !== g)) }}
                        >×</span>
                      </Badge>
                    ))}
                    {selectedGroups.length > 2 && (
                      <Badge variant="secondary">+{selectedGroups.length - 2}</Badge>
                    )}
                  </div>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[240px] bg-background border shadow-lg z-[1000]">
              {uniqueGroups.length === 0 ? (
                <DropdownMenuItem disabled>No groups</DropdownMenuItem>
              ) : (
                uniqueGroups.map((g) => (
                  <DropdownMenuCheckboxItem
                    key={g}
                    checked={selectedGroups.includes(g)}
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={(v) => {
                      const checked = !!v
                      setSelectedGroups((prev) => {
                        if (checked) return Array.from(new Set([...prev, g]))
                        return prev.filter((x) => x !== g)
                      })
                    }}
                  >
                    {g}
                  </DropdownMenuCheckboxItem>
                ))
              )}
              {selectedGroups.length > 0 && (
                <>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={() => setSelectedGroups([])}>Clear selection</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => { openStashedIds.length > 10 ? setConfirmCloseStashed(true) : closeOpenStashedTabs() }} disabled={closingStashed || openStashedIds.length === 0}>
            {closingStashed ? 'Closing…' : `Close Stashed (${openStashedIds.length})`}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">Export</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={exportTXT}>Download .txt</DropdownMenuItem>
              <DropdownMenuItem onClick={exportCSV}>Download .csv</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={async (e) => {
            const f = e.currentTarget.files?.[0]
            if (!f) return
            const text = await f.text()
            const items = parseCSV(text)
            if (!items.length) { toast('No rows found'); return }
            const res = await sendMessage({ type: 'IMPORT_ITEMS', items })
            if (res.ok && 'imported' in res) {
              toast(`Imported ${res.imported}, updated ${res.updated}`)
              await refresh()
            }
            e.currentTarget.value = ''
          }} />
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>Import CSV</Button>
          <Button size="sm" variant="outline" onClick={() => setOneTabDialogOpen(true)}>Import OneTab</Button>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <SelectionBar
          count={selectedIds.length}
          onToRead={() => bulkSetStatus('stashed')}
          onRestore={restoreAll}
          onMarkRead={() => bulkSetStatus('read')}
          onArchive={() => bulkSetStatus('archived')}
          onTrash={() => bulkSetStatus('trashed')}
          onDelete={() => setBulkDeleteOpen(true)}
          onClear={() => setSelected({})}
          toReadCount={selectedItems.filter((i) => i.status !== 'stashed').length}
          markReadCount={selectedItems.filter((i) => i.status !== 'read').length}
          archiveCount={selectedItems.filter((i) => i.status !== 'archived').length}
          trashCount={selectedItems.filter((i) => i.status !== 'trashed').length}
        />
      )}

      {/* Removed inline tag cloud; using compact multi-select above */}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(v) => {
                  const val = !!v
                  setSelected((cur) => {
                    const next = { ...cur }
                    for (const it of sorted) next[it.id] = val
                    return next
                  })
                }}
                aria-label="Select all"
              />
            </TableHead>
            <TableHead>
              <Button variant="ghost" size="sm" className="-ml-3 h-8 gap-1.5" onClick={() => toggleSort('title')}>
                <span>Title</span>
                <ChevronsUpDown className="size-4" />
              </Button>
            </TableHead>
            <TableHead>
              <Button variant="ghost" size="sm" className="-ml-3 h-8 gap-1.5" onClick={() => toggleSort('domain')}>
                <span>Domain</span>
                <ChevronsUpDown className="size-4" />
              </Button>
            </TableHead>
            <TableHead className="w-[250px]">Tags</TableHead>
            <TableHead className="w-[180px]">Group</TableHead>
            <TableHead>
              <Button variant="ghost" size="sm" className="-ml-3 h-8 gap-1.5" onClick={() => toggleSort('createdAt')}>
                <span>Added</span>
                <ChevronsUpDown className="size-4" />
              </Button>
            </TableHead>
            <TableHead className="w-[180px]">
              <Button variant="ghost" size="sm" className="-ml-3 h-8 gap-1.5" onClick={() => toggleSort('lifespan')}>
                <span>Lifespan</span>
                <ChevronsUpDown className="size-4" />
              </Button>
            </TableHead>
            <TableHead className="text-right w-[56px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((it) => (
            <TableRow key={it.id} className="hover:bg-muted/50">
              <TableCell>
                <Checkbox checked={!!selected[it.id]} onCheckedChange={(v) => setSelected((s) => ({ ...s, [it.id]: !!v }))} />
              </TableCell>
              <TableCell className="max-w-[420px]">
                <div className="flex items-center gap-2 min-w-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        aria-label={`${it.status}`}
                        className={[
                          'inline-block size-2 rounded-full flex-shrink-0 cursor-help',
                          it.status === 'stashed' ? 'bg-blue-500' :
                          it.status === 'read' ? 'bg-emerald-500' :
                          it.status === 'archived' ? 'bg-zinc-400' :
                          it.status === 'trashed' ? 'bg-red-500' : 'bg-zinc-300',
                        ].join(' ')}
                      />
                    </TooltipTrigger>
                    <TooltipContent>{displayStatus(it.status)}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className="font-medium truncate text-left hover:underline cursor-pointer inline-block max-w-full align-middle"
                        onClick={async () => {
                          await sendMessage({ type: 'OPEN_OR_FOCUS_URL', url: it.url })
                        }}
                      >
                        {it.title || it.url}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[520px] break-words">{it.title || it.url}</TooltipContent>
                  </Tooltip>
                </div>
              </TableCell>
              <TableCell className="text-xs text-gray-500">{domainOf(it)}</TableCell>
              <TableCell className="relative w-[250px]">
                <div className="flex gap-1 flex-wrap items-center">
                  {/* Add first so the column aligns */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-block">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-xs"
                          disabled={(it.tags || []).length >= 3}
                          onClick={() => {
                            setEditTags((m) => ({ ...m, [it.id]: '' }))
                            setEditingRowId(it.id)
                          }}
                        >
                          + Add
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {(it.tags || []).length >= 3 && (
                      <TooltipContent>Maximum 3 tags</TooltipContent>
                    )}
                  </Tooltip>

                  {(it.tags || []).slice(0,3).map((t) => (
                    <Badge key={t} className="flex items-center gap-1">
                      {t}
                      <span
                        role="button"
                        aria-label={`Remove ${t}`}
                        className="cursor-pointer opacity-70 hover:opacity-100"
                        onClick={() => setRemoveTag({ id: it.id, tag: t })}
                      >×</span>
                    </Badge>
                  ))}
                  {/* limit display to 3 tags; no more/less */}
                </div>
                {editingRowId === it.id && (
                  <div ref={editorRef} className="absolute left-0 right-0 top-0 z-[100] bg-transparent p-2">
                    <div className="flex items-center gap-2">
                      <Input
                        autoFocus
                        value={editTags[it.id] ?? ''}
                        onChange={(e) => setEditTags((m) => ({ ...m, [it.id]: e.target.value }))}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            const raw = editTags[it.id] ?? ''
                            const add = parseTags(raw)
                            const existing = it.tags || []
                            const available = Math.max(0, 3 - existing.length)
                            const candidate = add.filter((t) => !(existing as string[]).includes(t))
                            if (available <= 0) {
                              const notAdded = candidate
                          if (notAdded.length) toast('Max 3 tags', { description: `These were not added: ${notAdded.join(', ')}` })
                              setEditingRowId(null)
                              return
                            }
                            const toAdd = candidate.slice(0, available)
                            const overflow = candidate.slice(available)
                            if (toAdd.length === 0) { setEditingRowId(null); return }
                            const merged = [...existing, ...toAdd]
                            await sendMessage({ type: 'UPDATE_ITEM', id: it.id, patch: { tags: merged } })
                            toast(`Added ${toAdd.length} tag(s)`)
                            if (overflow.length) toast('Max 3 tags', { description: `These were not added: ${overflow.join(', ')}` })
                            setEditingRowId(null)
                            await refresh()
                          } else if (e.key === 'Escape') {
                            e.preventDefault()
                            setEditingRowId(null)
                            setEditTags((m) => ({ ...m, [it.id]: (it.tags || []).join(' ') }))
                          }
                        }}
                        placeholder="Tags (space/comma separated)"
                      />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            aria-label="Editing shortcuts"
                            className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground cursor-help"
                          >
                            <Info className="size-4" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="text-xs">Enter to save · Esc to cancel</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                )}
              </TableCell>
              <TableCell className="w-[180px]">
                {it.group && (
                  <Badge variant="outline" className="text-xs">
                    {it.group}
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-xs text-gray-500">{fmtDate(it.createdAt)}</TableCell>
              <TableCell className="w-[180px]">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${getProgressColor(getLifespanProgress(it))}`}
                        style={{ width: `${Math.min(getLifespanProgress(it), 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-600 dark:text-gray-400 min-w-[40px]">
                      {getRemainingDays(it)}d
                    </span>
                  </div>
                  {getShamingMessage(it) && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="text-xs text-orange-600 dark:text-orange-400 truncate cursor-help">
                          {getShamingMessage(it)}
                        </p>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[300px]">{getShamingMessage(it)}</TooltipContent>
                    </Tooltip>
                  )}
                  {it.autoArchived && (
                    <p className="text-xs text-gray-500 italic">Auto-archived</p>
                  )}
                  <div className="flex gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 px-1 text-xs"
                          onClick={() => extendLifespan(it.id, 7)}
                        >
                          <Clock className="size-3 mr-1" />
                          +7d
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Extend by 7 days</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 px-1 text-xs"
                          onClick={() => {
                            setSummaryItemId(it.id)
                            if (!it.summary) {
                              generateSummary(it.id)
                            }
                            setSummaryDialogOpen(true)
                          }}
                        >
                          <Sparkles className="size-3 mr-1" />
                          {it.summary ? 'View' : 'Gen'}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{it.summary ? 'View AI summary' : 'Generate AI summary'}</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right w-[56px]">
                <div className="inline-flex items-center justify-end w-full">
                  <RowActions
                    status={it.status}
                    onToRead={async () => { await sendMessage({ type: 'UPDATE_ITEM', id: it.id, patch: { status: 'stashed' } }); await refresh(); toast('Moved to To Read') }}
                    onMarkRead={async () => { await sendMessage({ type: 'UPDATE_ITEM', id: it.id, patch: { status: 'read' } }); await refresh(); toast('Marked read') }}
                    onArchive={async () => { await sendMessage({ type: 'UPDATE_ITEM', id: it.id, patch: { status: 'archived' } }); await refresh(); toast('Archived') }}
                    onTrash={async () => { setConfirmId(it.id) }}
                  />
                  {/* Edit and delete buttons removed (menu contains Trash) */}
            </div>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
      </Table>

      <ConfirmDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)}>
        <ConfirmContent>
          <ConfirmHeader>
            <ConfirmTitle>Delete this item?</ConfirmTitle>
            <ConfirmDescription>
              This action cannot be undone. The item will be permanently removed from your stash.
            </ConfirmDescription>
          </ConfirmHeader>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>Cancel</Button>
            <Button size="sm" variant="destructive" onClick={async () => {
              if (!confirmId) return
              const delItem = items.find((i) => i.id === confirmId)
              await sendMessage({ type: 'DELETE_ITEM', id: confirmId })
              setConfirmId(null)
              await refresh()
              const desc = delItem ? (delItem.title || delItem.url) : undefined
              toast('Deleted item', { description: desc })
            }}>Delete</Button>
          </div>
        </ConfirmContent>
      </ConfirmDialog>

      {/* Bulk delete confirm */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={(o) => !o && setBulkDeleteOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.length} item(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The selected items will be permanently removed from your stash.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBulkDeleteOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                await bulkDelete()
                setBulkDeleteOpen(false)
              }}
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Close many stashed confirm */}
      <AlertDialog open={confirmCloseStashed} onOpenChange={(o) => !o && setConfirmCloseStashed(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close {openStashedIds.length} stashed tab(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This will close open tabs that are already saved in your stash.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmCloseStashed(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { setConfirmCloseStashed(false); await closeOpenStashedTabs() }}>Close tabs</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove tag confirm */}
      <AlertDialog open={!!removeTag} onOpenChange={(o) => !o && setRemoveTag(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove tag?</AlertDialogTitle>
            <AlertDialogDescription>{removeTag?.tag}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRemoveTag(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={async () => {
              if (!removeTag) return
              const item = items.find((i) => i.id === removeTag.id)
              const next = (item?.tags || []).filter((x) => x !== removeTag.tag)
              await sendMessage({ type: 'UPDATE_ITEM', id: removeTag.id, patch: { tags: next } })
              toast('Removed tag', { description: removeTag.tag })
              setRemoveTag(null)
              await refresh()
            }}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* OneTab Import Dialog */}
      <Dialog open={oneTabDialogOpen} onOpenChange={(open) => {
        setOneTabDialogOpen(open)
        if (!open) {
          setOneTabPreviewMode(false)
          setOneTabGroups([])
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import from OneTab</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {!oneTabPreviewMode ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Paste your OneTab export below. Use OneTab's <strong>"Export / Import URLs"</strong> button (top right of OneTab page) to export all your tabs at once.
                </p>
                <code className="block text-xs bg-muted p-2 rounded leading-relaxed">
                  https://example.com | Page Title<br />
                  https://another.com | Another Title<br />
                  https://third.com | Third Title<br />
                  ...<br />
                  <br />
                  All tabs will be grouped as "Import #[number]" so you can see what was imported together
                </code>
                <textarea
                  className="w-full h-64 p-3 border rounded-md font-mono text-sm"
                  placeholder="Paste OneTab export here..."
                  value={oneTabText}
                  onChange={(e) => setOneTabText(e.target.value)}
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" onClick={() => setOneTabDialogOpen(false)}>Cancel</Button>
                  <Button onClick={importOneTab}>Preview Import</Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Found {oneTabGroups.length} group(s) with {oneTabGroups.reduce((sum, g) => sum + g.tabs.length, 0)} tab(s) total.
                </p>
                <div className="space-y-4 max-h-[400px] overflow-y-auto border rounded-md p-3">
                  {oneTabGroups.map((group, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-semibold">
                          {group.name}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {group.tabs.length} tab(s)
                        </span>
                      </div>
                      <div className="pl-4 space-y-1">
                        {group.tabs.slice(0, 5).map((tab, tabIdx) => (
                          <div key={tabIdx} className="text-xs text-gray-600 dark:text-gray-400 truncate">
                            • {tab.title || tab.url}
                          </div>
                        ))}
                        {group.tabs.length > 5 && (
                          <div className="text-xs text-muted-foreground italic">
                            ... and {group.tabs.length - 5} more
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" onClick={() => {
                    setOneTabPreviewMode(false)
                    setOneTabGroups([])
                  }}>Back</Button>
                  <Button onClick={importOneTab}>Confirm Import</Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Summary Dialog */}
      <Dialog open={summaryDialogOpen} onOpenChange={setSummaryDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>AI Summary</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {generatingSummary ? (
              <div className="flex items-center gap-2 py-8 justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p>Generating summary...</p>
              </div>
            ) : summaryItemId ? (
              <div className="space-y-2">
                <p className="text-sm whitespace-pre-wrap">
                  {items.find((i) => i.id === summaryItemId)?.summary || 'No summary available.'}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No item selected.</p>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setSummaryDialogOpen(false)}>Close</Button>
              {summaryItemId && (
                <Button onClick={() => generateSummary(summaryItemId)} disabled={generatingSummary}>
                  Regenerate
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <TooltipProvider>
    <Dashboard />
    <Toaster richColors />
  </TooltipProvider>
)
