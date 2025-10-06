# BDSA Schema Wrangler

A React application for managing and wrangling biomedical data schemas, with integration to Digital Slide Archive (DSA) servers.

## Features

- **Data Management**: Load and process data from CSV files and DSA servers
- **Schema Mapping**: Map local data fields to standardized BDSA schemas
- **Case ID Management**: Generate and manage harmonized case IDs
- **DSA Integration**: Sync metadata to and from DSA servers
- **Regex Extraction**: Apply regex rules to extract structured data
- **Protocol Management**: Manage and apply data processing protocols

## Environment Variables

### Auto-Refresh After Sync

The application supports automatic data refresh after DSA sync operations. This ensures the UI always reflects the current server state after syncing metadata.

**Configuration:**
- **Default**: Auto-refresh is enabled (`true`)
- **Environment Variable**: `VITE_AUTO_REFRESH_AFTER_SYNC`
- **Values**: `true` (default) or `false`

**To disable auto-refresh:**
1. Create a `.env` file in the project root
2. Add: `VITE_AUTO_REFRESH_AFTER_SYNC=false`
3. Restart the development server

**Behavior:**
- When enabled: After successful DSA sync, automatically refreshes data from server
- When disabled: Shows sync results without refreshing data
- Console logs: Shows "🔄 Auto-refreshing data after sync..." and success/error messages

## Development

### Prerequisites
- Node.js 16+
- npm or yarn

### Installation
```bash
npm install
```

### Development Server
```bash
npm run dev
```

### Build
```bash
npm run build
```

## Data Sources

The application supports multiple data sources:
- **CSV Files**: Upload and process CSV files
- **DSA Server**: Connect to Digital Slide Archive servers

## DSA Integration

### Authentication
- Username/password authentication
- Token-based API access
- Automatic token management and refresh

### Sync Operations
- Sync BDSA metadata to DSA servers
- Smart sync: Only sync modified items
- Progress tracking and cancellation support
- Auto-refresh after sync (configurable)

## Architecture

### Key Components
- **DataStore**: Centralized data management with localStorage persistence
- **DSA Integration**: Server communication and authentication
- **Case Management**: Case ID mapping and conflict resolution
- **Schema Validation**: BDSA schema compliance checking

### Data Flow
1. Load data from source (CSV/DSA)
2. Initialize BDSA structure
3. Apply mappings and transformations
4. Generate case IDs and manage conflicts
5. Sync to DSA server (optional)
6. Persist changes locally and remotely

## Configuration

### DSA Server Setup
1. Configure server URL and credentials
2. Select resource (folder/collection)
3. Test connection and authentication
4. Load data from server

### Case ID Management
- View unique local case IDs
- Generate sequential BDSA case IDs
- Resolve mapping conflicts
- Bulk operations (Generate All, Clear Duplicates)

## Troubleshooting

### Common Issues
- **Sync Errors**: Check DSA server connectivity and authentication
- **Data Not Refreshing**: Verify auto-refresh is enabled in config
- **Case ID Conflicts**: Use conflict resolution tools in Case Management tab

### Debug Mode
Enable console logging for detailed debugging:
- Data loading and transformation
- DSA sync operations
- Case ID management
- Schema validation
