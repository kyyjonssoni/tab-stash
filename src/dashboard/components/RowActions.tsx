import React from 'react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Ellipsis } from 'lucide-react'
import type { Item } from '@/shared/types'

export function RowActions({ status, onToRead, onMarkRead, onArchive, onTrash }: {
  status: Item['status']
  onToRead: () => void | Promise<void>
  onMarkRead: () => void | Promise<void>
  onArchive: () => void | Promise<void>
  onTrash: () => void | Promise<void>
}) {
  const [open, setOpen] = React.useState(false)
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change status">
          <Ellipsis className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-40 bg-background border shadow-lg z-[1000]"
        onEscapeKeyDown={() => setOpen(false)}
        onPointerDownOutside={() => setOpen(false)}
      >
        {status !== 'stashed' && (
          <DropdownMenuItem onClick={async () => { setOpen(false); await onToRead() }}>
            <span className="inline-flex items-center gap-2">
              <span className="size-2 rounded-full bg-blue-500" />
              To Read
            </span>
          </DropdownMenuItem>
        )}
        {status !== 'read' && (
        <DropdownMenuItem onClick={async () => { setOpen(false); await onMarkRead() }}>
          <span className="inline-flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500" />
            Mark read
          </span>
        </DropdownMenuItem>
        )}
        {status !== 'archived' && (
        <DropdownMenuItem onClick={async () => { setOpen(false); await onArchive() }}>
          <span className="inline-flex items-center gap-2">
            <span className="size-2 rounded-full bg-zinc-400" />
            Archive
          </span>
        </DropdownMenuItem>
        )}
        <DropdownMenuItem className="text-destructive hover:text-destructive focus:bg-destructive/10 data-[highlighted]:bg-destructive/10" onClick={async () => { setOpen(false); await onTrash() }}>
          <span className="inline-flex items-center gap-2">
            <span className="size-2 rounded-full bg-red-500" />
            Trash
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
