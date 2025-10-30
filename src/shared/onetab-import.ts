import type { Item } from './types'

export interface OneTabExportLine {
  url: string
  title?: string
  group?: string
  groupCreatedAt?: number
}

export interface OneTabGroup {
  name: string
  createdAt?: number
  tabs: Array<{ url: string; title?: string }>
}

/**
 * Parse OneTab export format with group detection.
 * OneTab's "Export / Import URLs" typically exports as a flat list:
 * - URLs with titles: https://example.com | Page Title
 * - Or just URLs: https://example.com
 * 
 * We assign each import batch a unique group number for tracking.
 */
export function parseOneTabExportWithGroups(text: string): OneTabGroup[] {
  const lines = text.split(/\r?\n/)
  
  // Generate unique group number based on timestamp
  const groupNumber = Date.now()
  
  // Single group for all imported tabs
  const group: OneTabGroup = {
    name: `Import #${groupNumber}`,
    tabs: []
  }
  
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    
    // Only process URLs
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const parts = trimmed.split(' | ')
      const url = parts[0].trim()
      const title = parts.length >= 2 ? parts.slice(1).join(' | ').trim() : undefined
      group.tabs.push({ url, title })
    }
  }
  
  // Return single group if we found any tabs
  if (group.tabs.length > 0) {
    return [group]
  }
  
  return []
}

/**
 * Legacy: Parse OneTab export format without groups (backwards compatible)
 */
export function parseOneTabExport(text: string): OneTabExportLine[] {
  const groups = parseOneTabExportWithGroups(text)
  const results: OneTabExportLine[] = []
  
  for (const group of groups) {
    for (const tab of group.tabs) {
      results.push({
        url: tab.url,
        title: tab.title,
        group: group.name,
        groupCreatedAt: group.createdAt
      })
    }
  }
  
  return results
}

/**
 * Convert OneTab export to items format for import
 */
export function oneTabToItems(lines: OneTabExportLine[]): Array<{
  url: string
  title?: string
  status?: Item['status']
  tags?: string[]
  createdAt?: number
  group?: string
  groupCreatedAt?: number
}> {
  return lines.map(line => ({
    url: line.url,
    title: line.title,
    status: 'stashed' as const,
    tags: ['imported-from-onetab'],
    group: line.group,
    groupCreatedAt: line.groupCreatedAt
  }))
}
