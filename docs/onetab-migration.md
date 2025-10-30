# Migrating from OneTab to Tab Stash

This guide will help you migrate all your tabs from OneTab to Tab Stash.

## Why Switch to Tab Stash?

- ✅ **Lifespan Tracking**: 30-day countdown helps you stay on top of your reading list
- ✅ **Auto-Archive**: Old items automatically archived so your list stays clean
- ✅ **Better Organization**: Tags, search, and multiple status types (To Read, Read, Archived)
- ✅ **AI Summaries**: Generate summaries to help decide what's worth reading (placeholder ready for implementation)
- ✅ **Light-hearted Motivation**: Fun shaming messages for stale items
- ✅ **Open Source**: Fully transparent, privacy-first, local-only storage
- ✅ **Active Development**: Regular updates and improvements

## Step-by-Step Migration

### Method 1: OneTab Export (Recommended)

1. **In OneTab**:
   - Open your OneTab page (click the OneTab extension icon)
   - Click the **"Export / Import URLs"** link at the top right
   - Click **"Export"** in the dialog that appears
   - Your browser will copy all tabs to clipboard (or show export text)
   - The export includes ALL tab groups with their names and URLs

2. **In Tab Stash**:
   - Open Tab Stash Dashboard (click extension icon or use keyboard shortcut)
   - Click the **"Import OneTab"** button (next to "Import CSV")
   - Paste the copied OneTab export text
   - Click **"Preview Import"** to see detected groups
   - Review the groups and tabs
   - Click **"Confirm Import"**
   - ✅ Done! All your tabs are now in Tab Stash with:
     - Tag: `imported-from-onetab`
     - Groups: Preserved from OneTab with original names

**Note:** 
- The "Export / Import URLs" feature exports ALL your OneTab tabs at once
- All imported tabs will be grouped with a unique number (e.g., "Import #1731073920000")
- This lets you see which tabs were imported together in one batch
- If you want to migrate everything from OneTab, this is the fastest way!

### Method 2: Copy-Paste URLs

If OneTab export doesn't work, you can manually copy URLs:

1. **In OneTab**:
   - Copy all URLs (one per line)

2. **Format as OneTab export** (with groups):
   ```
   Work Projects
   https://example.com | Page Title
   https://another-site.com | Another Title
   
   Personal Reading
   https://third-site.com | Article Title
   https://fourth-site.com
   ```
   
   **OneTab Format:**
   - Group names are plain text lines
   - URLs follow the format: `https://url | Title` (or just `https://url`)
   - Blank lines separate groups

3. **Import to Tab Stash**:
   - Use the "Import OneTab" button
   - Paste your formatted text
   - Import!

### Method 3: CSV Export

If you prefer CSV:

1. Create a CSV file with columns: `title,url,status,tags,createdAt`
2. Export your OneTab data to this format
3. Use Tab Stash's "Import CSV" button

## After Migration

### What Happens to Imported Tabs?

- ✅ **Status**: Set to "To Read" (stashed)
- ✅ **Lifespan**: 30 days from import date
- ✅ **Tags**: Automatically tagged with `imported-from-onetab`
- ✅ **Groups**: Each import batch gets a unique group number (e.g., "Import #12345")
- ✅ **No Duplicates**: If a URL already exists, it updates the existing entry

### Working with Import Groups

Each time you import from OneTab, all tabs get a unique group number so you can track what was imported together:

1. **View Groups**:
   - Groups appear in a new "Group" column in the Dashboard table
   - Each item shows its group number as a badge (e.g., "Import #12345")

2. **Filter by Group**:
   - Click the "Filter by group" dropdown
   - Select one or more import groups to view
   - Great for reviewing what you imported in each batch

3. **Group Numbers**:
   - Each import gets a unique timestamp-based number
   - Example: "Import #1731073920000"
   - Numbers are unique so you'll never confuse different import sessions

4. **Why Group Numbers?**:
   - **Track Import Batches**: See which tabs came from the same OneTab export
   - **Review by Session**: Filter to see only tabs from a specific import
   - **One-Time Use**: Once you've organized your tabs with tags, you can ignore groups
   - **Simple & Clear**: No naming conflicts, just sequential numbers

### Organizing Your Imported Tabs

1. **Filter by Import Tag**:
   - Click the "Filter by tags" dropdown
   - Select `imported-from-onetab`
   - Review all imported items

2. **Add More Tags**:
   - Click "+ Add" in the Tags column
   - Add relevant tags (e.g., "work", "research", "tutorial")
   - Max 3 tags per item

3. **Set Priorities**:
   - Sort by domain or title
   - Mark urgent items with additional tags
   - Use the "Mark Read" action for items you've already read

4. **Clean Up**:
   - Archive or trash items you no longer need
   - Extend lifespan (+7d) for important items
   - Generate AI summaries to decide what's worth keeping

## Batch Import Tips

If you have hundreds of tabs in OneTab:

1. **Import in Batches**: 
   - Don't import everything at once
   - Import by category (e.g., work tabs, then personal tabs)
   
2. **Use Tags Wisely**:
   - Add category-specific tags during import
   - Edit the import text to add more tags:
     ```
     https://example.com | Work Article
     ```
   - Then manually add tags after import

3. **Review Progress**:
   - Check the lifespan column
   - Focus on items with less time remaining
   - Archive or delete items you won't read

## Keeping OneTab as Backup

You can keep OneTab installed as a backup:

- Use Tab Stash as your primary read-later tool
- Keep OneTab for emergencies or as a secondary backup
- Export from Tab Stash periodically (CSV format)

## Troubleshooting

### Import Shows 0 Items

**Problem**: Pasted text but nothing imported.

**Solutions**:
- Make sure URLs start with `http://` or `https://`
- Check the format: `URL | Title` or just `URL`
- Remove any empty lines at the beginning
- Try importing just 1-2 URLs to test

### Duplicates Created

**Problem**: Same URL appears twice.

**Solutions**:
- Tab Stash uses URL normalization to detect duplicates
- If URLs have different query parameters, they might be treated as unique
- Check settings for URL normalization options
- Manually delete duplicates using bulk selection

### Import Fails

**Problem**: Import button does nothing or shows error.

**Solutions**:
- Check browser console (F12) for errors
- Try smaller batches (e.g., 50 URLs at a time)
- Verify the format of your export text
- Report issue on GitHub with example data

## Comparison: OneTab vs Tab Stash

| Feature | OneTab | Tab Stash |
|---------|--------|-----------|
| Save tabs | ✅ | ✅ |
| Bulk operations | ✅ | ✅ |
| Search | ✅ | ✅ |
| Tags | ❌ | ✅ |
| Lifespan tracking | ❌ | ✅ |
| Auto-archive | ❌ | ✅ |
| AI summaries | ❌ | ✅ (placeholder) |
| Multiple statuses | ❌ | ✅ (To Read, Read, Archived, Trashed) |
| Shaming messages | ❌ | ✅ |
| Import/Export | ✅ | ✅ (CSV + OneTab) |
| Open source | ❌ | ✅ |
| Privacy-first | ✅ | ✅ |
| Cloud sync | ⚠️ (paid) | ❌ (local only) |

## Need Help?

- 📖 **Documentation**: [docs/new-features.md](new-features.md)
- 🐛 **Issues**: Open an issue on GitHub
- 💬 **Questions**: Check GitHub Discussions

---

**Happy Tab Stashing! 📚**
