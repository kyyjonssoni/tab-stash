import React, { useEffect, useMemo, useState } from 'react'
import { sendMessage } from '../../shared/messaging'
import type { Item, TabWithStatus } from '../../shared/types'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Checkbox } from '../../components/ui/checkbox'
import { Separator } from '../../components/ui/separator'
import { Switch } from '../../components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { X } from 'lucide-react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

const StatusChip = ({ status }: { status: Item['status'] }) => (
  <Badge>{status}</Badge>
)

export function SidePanelApp() {
  const [tabs, setTabs] = useState<TabWithStatus[]>([])
  const [selected, setSelected] = useState<Record<number, boolean>>({})
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [staleDays, setStaleDays] = useState(30)
  const [closeAfterStash, setCloseAfterStash] = useState(true)
  // no tags input in side panel
  const [banner, setBanner] = useState<string>('')
  const [bannerDismissing, setBannerDismissing] = useState(false)
  const [showStashed, setShowStashed] = useState(false)
  const [activeTab, setActiveTab] = useState<'new' | 'stashed'>('new')
  const [closing, setClosing] = useState(false)
  const [confirmCloseStashed, setConfirmCloseStashed] = useState(false)

  useEffect(() => {
    refreshTabs()
    refreshItems()
    chrome.storage.local.get({ staleDays: 30, closeAfterStash: true }).then((o: any) => {
      setStaleDays(o.staleDays)
      setCloseAfterStash(o.closeAfterStash)
    })
    // Live update when tabs change
    const debounceRef = { id: 0 as number | undefined }
    const schedule = () => {
      if (debounceRef.id) clearTimeout(debounceRef.id)
      debounceRef.id = window.setTimeout(() => {
        refreshTabs()
        debounceRef.id = undefined
      }, 200)
    }
    const onCreated = () => schedule()
    const onRemoved = () => schedule()
    const onUpdated = (_id: number, changeInfo: any) => {
      if (changeInfo.url || changeInfo.title || changeInfo.status === 'complete') schedule()
    }
    const onActivated = () => schedule()
    try {
      chrome.tabs.onCreated.addListener(onCreated)
      chrome.tabs.onRemoved.addListener(onRemoved)
      chrome.tabs.onUpdated.addListener(onUpdated)
      chrome.tabs.onActivated.addListener(onActivated)
    } catch {}
    return () => {
      try {
        chrome.tabs.onCreated.removeListener(onCreated)
        chrome.tabs.onRemoved.removeListener(onRemoved)
        chrome.tabs.onUpdated.removeListener(onUpdated)
        chrome.tabs.onActivated.removeListener(onActivated)
      } catch {}
      if (debounceRef.id) clearTimeout(debounceRef.id)
    }
  }, [])

  // Reset dismiss state whenever a new banner message appears
  useEffect(() => {
    if (banner) setBannerDismissing(false)
  }, [banner])

  // Refresh when side panel becomes visible again (e.g., after sleep/resume)
  useEffect(() => {
    const onFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        refreshTabs()
        refreshItems()
      }
    }
    window.addEventListener('focus', onFocusOrVisible)
    document.addEventListener('visibilitychange', onFocusOrVisible)
    return () => {
      window.removeEventListener('focus', onFocusOrVisible)
      document.removeEventListener('visibilitychange', onFocusOrVisible)
    }
  }, [])

  // Lightweight polling fallback while visible (handles missed tab events after sleep)
  useEffect(() => {
    let timer: number | undefined
    const start = () => {
      if (document.visibilityState === 'visible') {
        timer = window.setInterval(() => {
          refreshTabs()
        }, 4000)
      }
    }
    const stop = () => { if (timer) { clearInterval(timer); timer = undefined } }
    start()
    const onVis = () => { stop(); start() }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onVis)
    return () => { stop(); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('focus', onVis) }
  }, [])

  async function refreshTabs() {
    const res = await sendMessage({ type: 'GET_TABS_STATUS', currentWindow: true })
    if (res.ok && 'tabStatus' in res) setTabs(res.tabStatus)
  }

  async function refreshItems() {
    const res = await sendMessage({ type: 'GET_ITEMS', limit: 200 })
    if (res.ok && 'items' in res) setItems(res.items)
  }

  const selCount = useMemo(() => Object.values(selected).filter(Boolean).length, [selected])
  const newTabs = useMemo(() => tabs.filter((t) => !t.stashed && t.stashable), [tabs])
  const stashedTabs = useMemo(() => tabs.filter((t) => t.stashed), [tabs])
  const stashedItems = useMemo(() => items.filter((i) => i.status === 'stashed'), [items])

  function parseTags(_input: string): string[] { return [] }

  async function stashAll() {
    setLoading(true)
    // Stash only new tabs by default
    const ids = newTabs.map((t) => t.id)
    const res = await sendMessage({ type: 'STASH_TABS', tabIds: ids, tags: [], close: closeAfterStash })
    setLoading(false)
    if (res.ok) {
      if ('stash' in res) {
        const n = res.stash.added
        setBanner(`${n} item${n === 1 ? '' : 's'} ${n === 1 ? 'has' : 'have'} been stashed.`)
      }
      await refreshItems()
      await refreshTabs()
    }
  }

  async function stashSelected() {
    const ids = Object.entries(selected)
      .filter(([, v]) => v)
      .map(([k]) => Number(k))
    if (!ids.length) return
    setLoading(true)
    const res = await sendMessage({ type: 'STASH_TABS', tabIds: ids, tags: [], close: closeAfterStash })
    setLoading(false)
    if (res.ok) {
      setSelected({})
      if ('stash' in res) {
        const n = res.stash.added
        setBanner(`${n} item${n === 1 ? '' : 's'} ${n === 1 ? 'has' : 'have'} been stashed.`)
      }
      await refreshItems()
    }
  }

  async function closeAllStashed() {
    const ids = stashedTabs.map((t) => t.id)
    if (!ids.length) return
    setClosing(true)
    const res = await sendMessage({ type: 'CLOSE_TABS', tabIds: ids })
    setClosing(false)
    if (res.ok && 'closed' in res) {
      const c = res.closed
      setBanner(`Closed ${c} stashed tab${c === 1 ? '' : 's'}.`) // uses settings.closePinned for pinned behavior
      await refreshTabs()
    }
  }

  async function search(q: string) {
    setQ(q)
    if (!q) return refreshItems()
    const res = await sendMessage({ type: 'SEARCH_ITEMS', q })
    if (res.ok && 'items' in res) setItems(res.items)
  }

  return (
    <div className="flex flex-col gap-3 p-3 min-w-[360px]">
      <div className="grid grid-cols-3 gap-2 items-center">
        {activeTab === 'new' ? (
          <>
            <Button className="w-full" size="sm" onClick={stashAll} disabled={loading}>
              {loading ? 'Stashing…' : `Stash ${newTabs.length} New`}
            </Button>
            <Button className="w-full" size="sm" variant="secondary" onClick={stashSelected} disabled={loading || selCount === 0}>
              Stash Selected ({selCount})
            </Button>
            <Button
              className="w-full"
              size="sm"
              variant="outline"
              onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html') })}
            >
              Dashboard →
            </Button>
          </>
        ) : (
          <>
            <Button className="w-full" size="sm" variant="secondary" onClick={() => { stashedTabs.length > 10 ? setConfirmCloseStashed(true) : closeAllStashed() }} disabled={closing || stashedTabs.length === 0}>
              {closing ? 'Closing…' : `Close Stashed (${stashedTabs.length})`}
            </Button>
            <div />
            <Button
              className="w-full"
              size="sm"
              variant="outline"
              onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html') })}
            >
              Dashboard →
            </Button>
          </>
        )}
      </div>

      {activeTab === 'new' && (
        <div className="flex justify-start">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={closeAfterStash} onCheckedChange={(v) => { setCloseAfterStash(!!v); chrome.storage.local.set({ closeAfterStash: !!v }) }} />
            Close after stash
          </label>
        </div>
      )}

      {/* Tagging is dashboard-only */}

      {banner ? (
        <Alert className={"relative transition-opacity duration-200 " + (bannerDismissing ? 'opacity-0 pointer-events-none' : 'opacity-100')}>
          <button
            aria-label="Dismiss"
            className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
            onClick={() => { setBannerDismissing(true); window.setTimeout(() => setBanner(''), 200) }}
          >
            <X className="size-4" />
          </button>
          <AlertDescription>{banner}</AlertDescription>
          <div className="mt-2">
            <Button
              size="sm"
              onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html') })}
            >
              Open dashboard →
            </Button>
          </div>
        </Alert>
      ) : null}

      <Tabs defaultValue="new" className="w-full" onValueChange={(v) => setActiveTab(v as 'new' | 'stashed')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="new">New ({newTabs.length})</TabsTrigger>
          <TabsTrigger value="stashed">Stashed ({stashedItems.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="new" className="mt-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Domain</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {newTabs.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <Checkbox checked={!!selected[t.id]} onCheckedChange={(v) => setSelected((s) => ({ ...s, [t.id]: !!v }))} />
                  </TableCell>
                  <TableCell className="max-w-[300px] min-w-0">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="inline-block max-w-[300px] truncate font-medium text-left hover:underline align-middle cursor-pointer"
                          onClick={async () => { await sendMessage({ type: 'OPEN_OR_FOCUS_URL', url: t.url }) }}
                        >
                          {t.title || t.url}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[520px] break-words">{t.title || t.url}</TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">{new URL(t.url).host}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
        <TabsContent value="stashed" className="mt-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Domain</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stashedItems.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="max-w-[300px] min-w-0">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="inline-block max-w-[300px] truncate font-medium text-left hover:underline align-middle cursor-pointer"
                          onClick={async () => { await sendMessage({ type: 'OPEN_OR_FOCUS_URL', url: it.url }) }}
                        >
                          {it.title || it.url}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[520px] break-words">{it.title || it.url}</TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">{new URL(it.url).host}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>

      <Separator />

      {/* Side panel focuses on stashing; dashboard handles management */}

      {/* Confirm close many stashed tabs */}
      <AlertDialog open={confirmCloseStashed} onOpenChange={(o) => !o && setConfirmCloseStashed(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close {stashedTabs.length} stashed tab(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This will close open tabs that are already saved in your stash.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmCloseStashed(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { setConfirmCloseStashed(false); await closeAllStashed() }}>Close tabs</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
