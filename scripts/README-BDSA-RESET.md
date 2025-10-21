# BDSA Metadata Reset Tool

## Overview

This script resets all corrupted BDSA metadata from items in a DSA resource (folder or collection). It fetches all items using the recurse endpoint and sets the `meta.BDSA` field to an empty object `{}`, allowing you to start fresh with clean metadata.

## Installation

Make sure you have the required dependencies:

```bash
pip install girder-client
```

## Usage

### Basic Usage (Interactive Login)

```bash
python scripts/reset-bdsa-metadata.py \
    --url https://megabrain.neurology.emory.edu/api/v1 \
    --resource-id YOUR_FOLDER_ID \
    --resource-type folder
```

This will:
1. Prompt you for login credentials interactively
2. Fetch all items from the specified folder
3. Ask for confirmation before proceeding
4. Reset BDSA metadata for all items

### Large Collections (Default Behavior)

**Pagination is now the default** for all collections to prevent timeouts:

```bash
python scripts/reset-bdsa-metadata.py \
    --url https://megabrain.neurology.emory.edu/api/v1 \
    --resource-id YOUR_FOLDER_ID
```

This automatically fetches items in batches of 5000, preventing timeouts and memory issues.

### Very Large Collections

For collections with hundreds of thousands of items, use smaller batches:

```bash
python scripts/reset-bdsa-metadata.py \
    --url https://megabrain.neurology.emory.edu/api/v1 \
    --resource-id YOUR_FOLDER_ID \
    --page-size 1000
```

### Using API Token

```bash
python scripts/reset-bdsa-metadata.py \
    --url https://megabrain.neurology.emory.edu/api/v1 \
    --resource-id YOUR_FOLDER_ID \
    --resource-type folder \
    --token YOUR_API_TOKEN
```

### Using Username/Password

```bash
python scripts/reset-bdsa-metadata.py \
    --url https://megabrain.neurology.emory.edu/api/v1 \
    --resource-id YOUR_FOLDER_ID \
    --resource-type folder \
    --username your_username \
    --password your_password
```

### Dry Run (Preview What Will Happen)

```bash
python scripts/reset-bdsa-metadata.py \
    --url https://megabrain.neurology.emory.edu/api/v1 \
    --resource-id YOUR_FOLDER_ID \
    --dry-run
```

This will show you what items would be affected without actually making any changes. The dry run also shows which BDSA keys exist on each item (e.g., `bdsaLocal`, `bdsaGlobal`, etc.).

## Options

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `--url` | Yes | - | DSA server API URL |
| `--resource-id` | Yes | - | Folder or collection ID to process |
| `--resource-type` | No | `folder` | Resource type: `folder` or `collection` |
| `--token` | No | - | API token for authentication |
| `--username` | No | - | Username for authentication |
| `--password` | No | - | Password for authentication |
| `--dry-run` | No | `false` | Preview changes without updating |
| `--batch-size` | No | `10` | Progress update frequency |
| `--use-pagination` | No | `true` | Use pagination (default: True, recommended for large collections) |
| `--no-pagination` | No | `false` | Disable pagination and fetch all items at once (not recommended) |
| `--page-size` | No | `5000` | Items per page when using pagination |

## Getting Resource IDs

### From the Browser

1. Navigate to your folder in the DSA web interface
2. Look at the URL: `https://your-server/#folder/507f1f77bcf86cd799439011`
3. The ID is the part after `/folder/`: `507f1f77bcf86cd799439011`

### From the API

You can also use the Girder API to find folder IDs:

```bash
curl -H "Girder-Token: YOUR_TOKEN" \
     "https://your-server/api/v1/folder?parentType=collection&parentId=COLLECTION_ID"
```

## How It Works

1. **Authenticates** with the DSA server using your credentials or token
2. **Fetches** all items from the specified resource:
   - **Without pagination** (default): Single request with `limit=0` - fast for small/medium collections
   - **With pagination** (`--use-pagination`): Fetches in batches - safer for large collections (100K+ items)
3. **Filters** items to only those that have `meta.BDSA` metadata (skips items without BDSA data for efficiency)
4. **Resets** each item's BDSA metadata by sending `{"BDSA": {}}` to `/api/v1/item/{itemId}/metadata`
5. **Reports** progress and errors

**Performance Tips**:
- **Pagination is now the default** - automatically handles large collections safely
- The script only processes items that actually have BDSA metadata, skipping items without BDSA data
- For collections with **100,000+ items**, use `--page-size 1000` for better performance
- For collections with **1M+ items**, use `--page-size 1000 --batch-size 100` to reduce console output
- Use `--no-pagination` only for small collections (< 1000 items) if you want faster single-request mode

## What Gets Reset

The script sets `meta.BDSA = {}` on each item, which effectively removes all BDSA-related metadata including:

- `meta.BDSA.bdsaLocal.*` (all local BDSA data)
- Any other fields under `meta.BDSA`

This gives you a clean slate to re-import or re-annotate your data.

## Safety Features

- **Confirmation prompt** - Script asks for confirmation before making changes
- **Dry run mode** - Test what would happen without making changes
- **Progress updates** - See which items are being processed
- **Error reporting** - Detailed error messages if something goes wrong
- **Summary report** - Final statistics on successes and failures

## Example Session

### Small/Medium Collection (without pagination)

```bash
$ python scripts/reset-bdsa-metadata.py \
    --url https://megabrain.neurology.emory.edu/api/v1 \
    --resource-id 507f1f77bcf86cd799439011

🔐 Connecting to https://megabrain.neurology.emory.edu/api/v1...
   No credentials provided, using interactive authentication...
Username: myuser
Password: 
✅ Authentication successful
📥 Fetching all items from folder 507f1f77bcf86cd799439011 (single request)...
✅ Found 200 items

📊 Items with BDSA metadata: 150/200
   Items without BDSA metadata (will skip): 50

🔄 Resetting BDSA metadata for 150 items...
⚠️  WARNING: This will clear all BDSA metadata from these items!
   (50 items without BDSA metadata will be skipped)
Continue? (yes/no): yes
   ✅ Processed 10/150 items (10 successful, 0 errors)
   ✅ Processed 20/150 items (20 successful, 0 errors)
   ...
   ✅ Processed 150/150 items (150 successful, 0 errors)

============================================================
📊 SUMMARY
============================================================
Total items in resource: 200
Items with BDSA metadata: 150
Items without BDSA metadata (skipped): 50
✅ Successfully reset: 150
❌ Errors: 0

✅ All BDSA metadata has been reset successfully!
   You can now start fresh with clean metadata.
```

### Large Collection (with pagination)

```bash
$ python scripts/reset-bdsa-metadata.py \
    --url https://megabrain.neurology.emory.edu/api/v1 \
    --resource-id 507f1f77bcf86cd799439011 \
    --use-pagination \
    --page-size 1000 \
    --batch-size 50

🔐 Connecting to https://megabrain.neurology.emory.edu/api/v1...
✅ Authentication successful
📥 Fetching items from folder 507f1f77bcf86cd799439011 (paginated, 1000 items per page)...
   📄 Fetching page 1 (offset 0)...
      Got 1000 items (total so far: 1000)
   📄 Fetching page 2 (offset 1000)...
      Got 1000 items (total so far: 2000)
   📄 Fetching page 3 (offset 2000)...
      Got 845 items (total so far: 2845)
✅ Found 2845 total items across 3 pages

📊 Items with BDSA metadata: 2100/2845
   Items without BDSA metadata (will skip): 745

🔄 Resetting BDSA metadata for 2100 items...
⚠️  WARNING: This will clear all BDSA metadata from these items!
   (745 items without BDSA metadata will be skipped)
Continue? (yes/no): yes
   ✅ Processed 50/2100 items (50 successful, 0 errors)
   ✅ Processed 100/2100 items (100 successful, 0 errors)
   ...
   ✅ Processed 2100/2100 items (2100 successful, 0 errors)

============================================================
📊 SUMMARY
============================================================
Total items in resource: 2845
Items with BDSA metadata: 2100
Items without BDSA metadata (skipped): 745
✅ Successfully reset: 2100
❌ Errors: 0

✅ All BDSA metadata has been reset successfully!
   You can now start fresh with clean metadata.
```

## Troubleshooting

### "Authentication failed"
- Check that your credentials are correct
- Verify the API URL is correct (should end with `/api/v1`)
- Make sure your token hasn't expired

### "Failed to fetch items"
- Verify the resource ID is correct
- Check that you have permission to access the resource
- Ensure `--resource-type` matches your resource (folder vs collection)

### "Permission denied" errors on individual items
- Some items might have restricted permissions
- The script will continue processing other items and report errors at the end

## After Running the Script

Once the script completes successfully:

1. All items will have `meta.BDSA = {}`
2. You can verify in the DSA web interface or wrangler app
3. You can now re-import or re-annotate your data from scratch
4. The wrangler app will see these as "clean" items ready for new metadata

## Related Scripts

- `download-example-cohort.py` - Download sample items with metadata
- `emory-csv-file.py` - Work with CSV metadata files

## Questions?

If you encounter issues or have questions, check:
- The main project README
- The KNOWLEDGE_BASE.md file
- API_ENDPOINTS.md in the schema-viewer-app

