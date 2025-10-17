import React from 'react'
import { Button } from '@/components/ui/button'

export function SelectionBar({
  count,
  onToRead,
  onRestore,
  onMarkRead,
  onArchive,
  onTrash,
  onDelete,
  onClear,
  toReadCount,
  markReadCount,
  archiveCount,
  trashCount,
}: {
  count: number
  onToRead: () => void | Promise<void>
  onRestore: () => void | Promise<void>
  onMarkRead: () => void | Promise<void>
  onArchive: () => void | Promise<void>
  onTrash: () => void | Promise<void>
  onDelete: () => void | Promise<void>
  onClear: () => void
  toReadCount: number
  markReadCount: number
  archiveCount: number
  trashCount: number
}) {
  return (
    <div className="flex gap-2 items-center flex-wrap mt-2">
      <Button size="sm" variant="secondary" onClick={onToRead} disabled={!toReadCount}>To Read ({toReadCount})</Button>
      <Button size="sm" variant="secondary" onClick={onRestore}>Restore ({count})</Button>
      <Button size="sm" variant="secondary" onClick={onMarkRead} disabled={!markReadCount}>Mark Read ({markReadCount})</Button>
      <Button size="sm" variant="secondary" onClick={onArchive} disabled={!archiveCount}>Archive ({archiveCount})</Button>
      <Button size="sm" variant="secondary" onClick={onTrash} disabled={!trashCount}>Trash ({trashCount})</Button>
      <Button size="sm" variant="secondary" onClick={onDelete}>Delete ({count})</Button>
      <Button size="sm" variant="ghost" onClick={onClear}>Clear</Button>
    </div>
  )
}
