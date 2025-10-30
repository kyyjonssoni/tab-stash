# New Features in Tab Stash

## Overview
This document describes the new features added to Tab Stash: lifespan tracking, AI summaries, archiving, shaming messages, and OneTab import.

## 1. Lifespan Tracking (30-Day Default)

Every tab you stash now has a **30-day lifespan** by default. This helps you stay on top of your reading list.

### Features:
- **Progress Bar**: Visual indicator showing how much time is left before expiration
- **Days Remaining**: Shows exact number of days left (e.g., "15d")
- **Color-Coded Progress**:
  - 🟢 **Green** (0-50%): Fresh, plenty of time
  - 🟡 **Yellow** (50-80%): Aging, getting older
  - 🟠 **Orange** (80-100%): Stale, running out of time
  - 🔴 **Red** (100%+): Expired, ready for archive

### Extend Lifespan:
- Click the **+7d** button to extend any item by 7 days
- You can extend items multiple times
- Great for articles you want to keep around longer

### Auto-Archive:
- When items expire (30 days pass), they're automatically moved to "Archived" status
- Auto-archived items are marked with "Auto-archived" label
- The background service checks for expired items:
  - On extension startup
  - On extension install/update
  - Every 6 hours while running
- You can always restore archived items by changing their status back to "To Read"

## 2. Light-Hearted Shaming Messages

Stale items (80%+ of lifespan used) display fun, gentle reminders:

### Examples:
- **Stale** (80-100%): 
  - "Only 5 days left! Will you actually read this? 🤔"
  - "Getting crusty! 3 days until this expires. 🥖"
  - "Tick tock! 2 days before this disappears. ⌛"

- **Expired** (100%+):
  - "This link has expired. Time to let it go? 🍂"
  - "Expired! Either read it now or set it free. 🦋"
  - "This tab has left the building. Archive time? 📦"

These messages appear in the Lifespan column to motivate you to take action!

## 3. AI Summaries (Placeholder)

Each item can have an AI-generated summary to help you decide if it's worth reading.

### How to Use:
1. Click the **Gen** button (with ✨ sparkles icon) in the Lifespan column
2. A dialog opens showing the summary
3. If no summary exists yet, it will be generated automatically
4. Click **View** to see existing summaries

### AI Integration (For Implementation):
The current implementation includes a **placeholder** that shows:
- Item title
- URL
- Current tags
- Instructions for implementing real AI integration

### To Implement Real AI:
1. Add API key configuration in settings (OpenAI, Anthropic, etc.)
2. Fetch page content (you may need to scrape or use an API)
3. Send content to AI service with prompt: "Summarize this article in 2-3 sentences"
4. Optionally: Match summary against defined tags for auto-tagging
5. Store summary in the `summary` field

**Suggested AI Prompts:**
```
Given the following article, provide a 2-3 sentence summary that:
1. Captures the main idea
2. Highlights key takeaways
3. Helps determine if it's worth reading

Title: {title}
URL: {url}
Content: {content}
```

## 4. OneTab Import with Group Preservation

Easily migrate all your OneTab links to Tab Stash, **preserving your working sessions**!

### How to Use:
1. In OneTab, select the tabs you want to export
2. Click "Share as web page" or use the export feature
3. Copy the exported text (includes group names and URLs)
4. In Tab Stash Dashboard, click **Import OneTab** button
5. Paste the exported text
6. Click **Preview Import** to see detected groups
7. Review groups and tabs
8. Click **Confirm Import**

### Import Format:
OneTab exports groups in this format:
```
Work Project Alpha
https://example.com | Page Title
https://docs.example.com | Documentation

Personal Reading
https://blog.example.com | Interesting Article
https://news.example.com | Latest News
```

**Format Details:**
- Group names are plain text lines
- URLs follow: `https://url | Title` (or just `https://url`)
- Blank lines separate groups
- If no group name is present, Tab Stash creates numbered groups (Group 1, Group 2, etc.)

### Group Preview:
Before importing, you'll see:
- Total number of groups detected
- Total number of tabs
- Preview of each group with:
  - Group name
  - Number of tabs in that group
  - First 5 tab titles (with "... and X more" if more exist)

### Groups as Working Sessions:
- **Preserved Names**: Your OneTab group names are kept intact
- **Filter by Group**: New "Filter by group" dropdown lets you focus on specific sessions
- **Group Column**: See which group each tab belongs to in the Dashboard table
- **Session Tracking**: Track different projects, work sessions, or research topics

### Auto-Tagging:
- All imported items automatically get the tag: `imported-from-onetab`
- Duplicates are handled automatically (won't create duplicates)
- All imports get the default 30-day lifespan
- Groups are preserved with original names

## 5. Archiving System

The archive status provides a home for old items you're not ready to delete.

### When Items Get Archived:
- **Automatically**: When 30-day lifespan expires
- **Manually**: When you change status to "Archived"
- **Bulk Operations**: Select multiple items and archive them together

### Archive Status:
- Marked with gray dot (🔘)
- Still searchable and can be restored anytime
- Auto-archived items show "Auto-archived" label
- Keep your "To Read" list clean without losing items

### Restore from Archive:
1. Filter by "Archived" status
2. Select item(s)
3. Change status back to "To Read" or "Read"

## Database Schema Changes

New fields added to the `Item` type:

```typescript
interface Item {
  // ... existing fields ...
  
  // Lifespan tracking (default 30 days from createdAt)
  expiresAt?: number          // Timestamp when item expires
  lifespanDays?: number       // Customizable per item, default 30
  autoArchived?: boolean      // True if archived by expiration
  
  // AI features
  summary?: string            // AI-generated summary
  
  // Group/session tracking (from OneTab or manual grouping)
  group?: string              // Group name/session name
  groupCreatedAt?: number     // When the group was created (optional)
}
```

### Database Migration:
- Version 2 migration: Adds `expiresAt` and lifespan fields to all existing items
- Version 3 migration: Adds `group` field for session tracking
- All migrations run automatically on first load
- No data loss, fully backwards compatible

## UI Changes

### Dashboard Table:
- New **Group** column showing:
  - Group/session name badge
  - Empty if no group assigned
- New **Lifespan** column showing:
  - Progress bar (color-coded)
  - Days remaining
  - Shaming message (if applicable)
  - Auto-archived indicator
  - +7d button (extend lifespan)
  - Gen/View button (AI summary)

### New Filters:
- **Filter by group**: Dropdown to filter by working session/group
- Multi-select: Choose multiple groups to view
- Shows count of available groups

### New Buttons:
- **Import OneTab**: Top toolbar, next to "Import CSV"
- **+7d**: In Lifespan column, extends by 7 days
- **Gen/View**: In Lifespan column, generates or views AI summary

### New Dialogs:
- **OneTab Import Dialog**: 
  - Step 1: Textarea for pasting OneTab export
  - Step 2: Preview showing detected groups and tabs
  - Back button to edit paste
  - Confirm button to import
- **AI Summary Dialog**: Shows generated summary with regenerate option

## Sorting

You can now sort by **Lifespan** (in addition to Title, Domain, Added, Status):
- Click the Lifespan column header
- Sorts by percentage of lifespan used
- Useful for finding most urgent items

## Tips & Best Practices

1. **Review Stale Items**: Check items with orange/red progress bars regularly
2. **Extend Strategically**: Use +7d for articles you're actively planning to read
3. **Let Expired Go**: If you haven't read it in 30 days, let it auto-archive
4. **Use Archive**: Archive is better than delete - you can always come back
5. **OneTab Migration**: Import your OneTab tabs in batches to stay organized
6. **AI Summaries**: Once implemented, use summaries to triage your reading list

## Future Enhancements

Potential improvements for AI summaries:
- **Tag Matching**: AI could suggest tags based on content
- **Quality Scoring**: AI rates article quality/relevance
- **Content Extraction**: Better scraping for paywalled/JS-heavy sites
- **Batch Summary**: Generate summaries for multiple items at once
- **Custom Prompts**: User-defined summary prompts
- **Multiple AI Providers**: Support OpenAI, Anthropic, local models

## Keyboard Shortcuts

All existing shortcuts still work. No new shortcuts added for these features.

## Privacy & Data

- **All data stays local**: No external API calls in current implementation
- **AI Integration**: When implemented, you'll need to provide your own API keys
- **No Tracking**: Lifespan and shaming messages are computed locally
- **OneTab Import**: Processed entirely in your browser

---

**Questions or Issues?** Open an issue on GitHub!
