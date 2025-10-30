import type { Item } from './types'

export const DEFAULT_LIFESPAN_DAYS = 30

export function calculateExpiresAt(createdAt: number, lifespanDays = DEFAULT_LIFESPAN_DAYS): number {
  return createdAt + lifespanDays * 24 * 60 * 60 * 1000
}

export function getRemainingDays(item: Item): number {
  if (!item.expiresAt) return DEFAULT_LIFESPAN_DAYS
  const now = Date.now()
  const remaining = item.expiresAt - now
  return Math.ceil(remaining / (24 * 60 * 60 * 1000))
}

export function getLifespanProgress(item: Item): number {
  const lifespanDays = item.lifespanDays ?? DEFAULT_LIFESPAN_DAYS
  const totalMs = lifespanDays * 24 * 60 * 60 * 1000
  const elapsed = Date.now() - item.createdAt
  const progress = (elapsed / totalMs) * 100
  return Math.min(Math.max(progress, 0), 100)
}

export function isExpired(item: Item): boolean {
  if (!item.expiresAt) return false
  return Date.now() > item.expiresAt
}

export function getStalenessLevel(item: Item): 'fresh' | 'aging' | 'stale' | 'expired' {
  const progress = getLifespanProgress(item)
  if (progress >= 100) return 'expired'
  if (progress >= 80) return 'stale'
  if (progress >= 50) return 'aging'
  return 'fresh'
}

// Light-hearted shaming messages based on staleness
export function getShamingMessage(item: Item): string | null {
  const level = getStalenessLevel(item)
  const remainingDays = getRemainingDays(item)
  
  if (level === 'expired') {
    const messages = [
      "This link has expired. Time to let it go? 🍂",
      "Expired! Either read it now or set it free. 🦋",
      "This tab has left the building. Archive time? 📦",
      "It's been too long. This one's ready for the archive. 🗄️",
    ]
    return messages[Math.floor(Math.random() * messages.length)]
  }
  
  if (level === 'stale') {
    const messages = [
      `Only ${remainingDays} days left! Will you actually read this? 🤔`,
      `${remainingDays} days remaining. Time's ticking... ⏰`,
      `Getting crusty! ${remainingDays} days until this expires. 🥖`,
      `Tick tock! ${remainingDays} days before this disappears. ⌛`,
    ]
    return messages[Math.floor(Math.random() * messages.length)]
  }
  
  if (level === 'aging') {
    const messages = [
      `${remainingDays} days left. Maybe give it a read? 📖`,
      `Half-life reached. ${remainingDays} days to go. ☢️`,
      `Getting older... ${remainingDays} days remain. 🧓`,
    ]
    return messages[Math.floor(Math.random() * messages.length)]
  }
  
  return null // fresh items don't get shamed
}

export function getProgressColor(progress: number): string {
  if (progress >= 100) return 'bg-red-500'
  if (progress >= 80) return 'bg-orange-500'
  if (progress >= 50) return 'bg-yellow-500'
  return 'bg-green-500'
}
