# BDSA DSA Folder Synchronization Tool

This is a React application for synchronizing and organizing DSA (Digital Slide Archive) folders with standardized naming conventions.

## Architecture

The project uses a monorepo structure with shared packages:

```
BDSA-Schema-Wrangler/
├── packages/
│   ├── shared-types/          # Shared TypeScript types
│   ├── shared-utils/          # Shared utilities (DSA API, data processing)
│   └── shared-components/     # Shared React components
├── apps/
│   ├── reactAgain/           # Original BDSA Schema Wrangler app
│   └── react-sync-app/       # New DSA folder sync tool
└── package.json              # Root package.json with workspaces
```

## Features

### DSA Folder Synchronization Tool (`react-sync-app`)

- **DSA Server Configuration**: Connect to DSA servers with authentication
- **Folder Selection**: Select source and target folders for synchronization
- **Item Discovery**: Use `resource/{id}/items` endpoint to get all items
- **Patient Organization**: Create separate folders for each patient
- **Standardized Naming**: Copy slides with consistent naming templates
- **Progress Tracking**: Real-time sync progress with cancellation support
- **Batch Operations**: Process multiple items efficiently

### Shared Components

- **DSAConfigForm**: Reusable DSA server configuration and authentication
- **SyncProgress**: Progress tracking component with visual indicators
- **DSA API Client**: Comprehensive DSA API integration
- **Data Processing**: Utilities for organizing and processing DSA items
- **Naming Templates**: Flexible naming convention system

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm 8+

### Installation

```bash
# Install all dependencies
npm install --legacy-peer-deps

# Build shared packages
cd packages/shared-types && npm run build
cd ../shared-utils && npm run build  
cd ../shared-components && npm run build
```

### Running the Applications

```bash
# Run the original BDSA Schema Wrangler
npm run dev:react-again

# Run the new DSA Sync Tool
npm run dev:sync-app
```

## Usage

### DSA Sync Tool

1. **Configure DSA Server**:
   - Enter DSA server URL
   - Set resource ID (folder or collection)
   - Test connection

2. **Authenticate**:
   - Enter username and password
   - Verify authentication status

3. **Load Items**:
   - Load source folder items
   - Load target folder items (optional)

4. **Start Sync**:
   - Review items to be processed
   - Start synchronization process
   - Monitor progress in real-time

### Naming Templates

The tool supports flexible naming templates with variables:

- `{patientId}` - Patient identifier
- `{region}` - Brain region
- `{stain}` - Stain type
- `{institutionId}` - Institution ID
- `{index}` - Slide index
- `{timestamp}` - Date stamp

Example: `{patientId}-{region}-{stain}-{index}` → `E05-194-MFG-4G8-01`

## API Integration

### DSA API Endpoints Used

- `GET /api/v1/user/authentication` - Authentication
- `GET /api/v1/user/me` - Token validation
- `GET /api/v1/system/version` - Connection test
- `GET /resource/{id}/items` - Get folder items
- `GET /api/v1/item/{id}` - Get item details
- `PUT /api/v1/item/{id}` - Update item metadata
- `POST /api/v1/folder` - Create folder
- `POST /api/v1/item/{id}/copy` - Copy item

### Data Flow

```
Source Folder → Item Discovery → Patient Grouping → Folder Creation → Item Copying → Metadata Update
```

## Development

### Adding New Shared Components

1. Create component in `packages/shared-components/src/`
2. Export from `packages/shared-components/src/index.ts`
3. Build the package: `cd packages/shared-components && npm run build`
4. Import in apps: `import { ComponentName } from '@bdsa/shared-components'`

### Adding New Utilities

1. Create utility in `packages/shared-utils/src/`
2. Export from `packages/shared-utils/src/index.ts`
3. Build the package: `cd packages/shared-utils && npm run build`
4. Import in apps: `import { utilityName } from '@bdsa/shared-utils'`

### Type Definitions

All shared types are defined in `packages/shared-types/src/index.ts`:

- `DSAConfig` - DSA server configuration
- `DSAItem` - DSA item structure
- `SyncProgress` - Sync progress tracking
- `SyncResult` - Sync operation results
- `PatientFolder` - Patient folder organization

## Future Enhancements

- **Advanced Filtering**: Filter items by metadata, size, date
- **Conflict Resolution**: Handle duplicate items and naming conflicts
- **Batch Processing**: Process large datasets efficiently
- **Metadata Validation**: Validate BDSA schema compliance
- **Export/Import**: Export sync configurations and results
- **Scheduling**: Automated sync scheduling
- **Notifications**: Email/Slack notifications for sync completion

## Troubleshooting

### Common Issues

1. **TypeScript Version Conflicts**: Use `--legacy-peer-deps` flag
2. **Build Failures**: Ensure shared packages are built before running apps
3. **Authentication Issues**: Verify DSA server URL and credentials
4. **Network Errors**: Check firewall and proxy settings

### Debug Mode

Enable debug logging by setting `localStorage.debug = 'bdsa:*'` in browser console.

## Contributing

1. Follow the monorepo structure
2. Add tests for new functionality
3. Update documentation for API changes
4. Use TypeScript for type safety
5. Follow existing code style and patterns
