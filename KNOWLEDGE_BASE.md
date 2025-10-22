# BDSA Schema Wrangler - Knowledge Base

## Overview
The BDSA Schema Wrangler is a React application for managing and mapping biomedical data between local formats and the BDSA (Brain Data Science Archive) standard format. It handles CSV data processing, protocol mapping, case ID management, and synchronization with DSA servers.

## Architecture

### Main Components
1. **App.jsx** - Main application container with tab navigation
2. **InputDataTab.jsx** - Displays and manages input data (CSV/DSA)
3. **CaseManagementTab.jsx** - Manages case ID mappings and protocol assignments
4. **ProtocolsTab.jsx** - Manages stain and region protocol definitions
5. **BDSAchemaTab.jsx** - BDSA schema management
6. **DsaSyncControl.jsx** - DSA server synchronization controls

### Data Flow
```
Input Data (CSV/DSA) → Data Store → Processing → Mapping → Sync to DSA
```

## Core Data Structures

### Global Data Store (`dataStore.js`)
```javascript
globalDataStore = {
  // Data state
  currentDataSource: null,           // 'csv' or 'dsa'
  rawData: [],                      // Original input data
  processedData: [],                // Processed/flattened data
  columnDefs: [],                   // AG-Grid column definitions
  
  // Configuration
  columnMapping: {                  // Maps generic names to actual columns
    localStainID: '',
    localCaseId: '',
    localRegionId: ''
  },
  caseIdMappings: {},               // localCaseId → bdsaCaseId mappings
  caseProtocolMappings: {},         // Protocol assignments per case
  regexRules: {},                   // Data extraction rules
  dsaConfig: {},                    // DSA server configuration
  girderToken: '',                  // DSA authentication token
  
  // UI state
  isLoading: false,
  loadingMessage: '',
  error: null,
  
  // Modification tracking
  modifiedItems: new Set(),         // Items modified since load
  dataLoadTimestamp: null
}
```

### Data Item Structure
```javascript
dataItem = {
  // Original fields from input
  [columnMapping.localCaseId]: "02-109",     // Original case ID
  [columnMapping.localStainID]: "4G8",       // Original stain ID
  [columnMapping.localRegionId]: "MFG",      // Original region ID
  name: "02-109-MFG_4G8_...",               // Generated name
  size: 1006922592,                          // File size
  dsa_id: "68bb280ce07d3c7f37ae2c4e",       // DSA item ID
  
  // BDSA namespace (processed values)
  BDSA: {
    localCaseId: "02-109",                   // Same as original
    localStainID: "4G8",                     // Same as original
    localRegionId: "MFG",                    // Same as original
    bdsaCaseId: "BDSA-001-0047",             // Mapped BDSA case ID
    stainProtocols: ["4G8"],                 // Array of protocol names
    regionProtocols: ["MFG"]                 // Array of protocol names
  },
  
  // Metadata
  _localLastModified: "2025-01-10T17:40:57.282Z",
  _hasServerMetadata: true
}
```

## Key Functionality

### 1. Data Loading
- **CSV Files**: Loaded via Papa Parse, processed with regex rules
- **DSA Data**: Fetched from Digital Slide Archive API, flattened JSON
- **Column Mapping**: Maps generic column names to actual data columns

### 2. Case ID Management
- **Local Case IDs**: Original identifiers (e.g., "02-109")
- **BDSA Case IDs**: Standardized format (e.g., "BDSA-001-0047")
- **Mapping**: One-to-one relationship between local and BDSA IDs
- **Generation**: Auto-generate BDSA IDs with institution prefix

### 3. Protocol Management
- **Stain Protocols**: Define stain types and their properties
- **Region Protocols**: Define brain regions and their properties
- **Assignment**: Assign protocols to cases (many-to-many relationship)
- **Storage**: Arrays of protocol names in BDSA namespace

### 4. DSA Synchronization
- **Metadata Sync**: Push BDSA metadata to DSA server as `bdsaLocal` field
- **Batch Processing**: Process items in batches with progress tracking
- **Conflict Resolution**: Handle local vs server metadata conflicts
- **Modification Tracking**: Only sync items that have been locally modified

## API Endpoints

### DSA API
- **Base URL**: Configurable DSA server URL
- **Authentication**: Girder token-based
- **Endpoints**:
  - `GET /api/v1/item/{id}` - Get item details
  - `PUT /api/v1/item/{id}` - Update item metadata
  - `GET /api/v1/item/{id}/download` - Download item file

### Data Processing
- **CSV Processing**: Papa Parse for CSV parsing
- **Regex Extraction**: Custom regex rules for data extraction
- **Data Flattening**: Recursive object flattening for nested JSON

## Current Issues & Technical Debt

### 1. Event System Complexity
- Multiple subscription patterns (`subscribeToDataStore`, `subscribeToSyncEvents`)
- Stale closure issues in React components
- Complex callback chains between components and data store

### 2. Naming Inconsistencies
- `localCaseId` vs `BDSA.localCaseId` vs `BDSA.bdsaCaseId`
- Mixed usage of field names throughout codebase
- Confusing data flow between original and processed fields

### 3. State Management Issues
- Multiple sources of truth for the same data
- Complex re-rendering logic
- Auto-sorting issues in tables
- Data store updates not reflecting in UI

### 4. Performance Issues
- Excessive console logging
- Unnecessary re-renders
- Complex dependency arrays in useEffect hooks

## User Stories & Requirements

### Core Features
1. **Load Data**: Load CSV files or connect to DSA server
2. **Map Columns**: Configure which columns contain case IDs, stain IDs, region IDs
3. **Generate BDSA IDs**: Auto-generate standardized BDSA case IDs
4. **Assign Protocols**: Map stain and region protocols to cases
5. **Sync to DSA**: Push metadata changes back to DSA server
6. **Export Data**: Export processed data with BDSA mappings

### User Workflows
1. **Initial Setup**: Load data → Configure columns → Generate BDSA IDs
2. **Protocol Management**: Define protocols → Assign to cases → Review mappings
3. **Data Sync**: Review changes → Sync to DSA → Verify updates
4. **Data Export**: Export enriched data for downstream processing

## Implementation Recommendations

### Clean Architecture Approach
1. **Simple State Management**: React state + localStorage, no complex event systems
2. **Clear Data Flow**: One-way data flow, predictable updates
3. **Consistent Naming**: Clear distinction between local and BDSA fields
4. **Separation of Concerns**: UI components vs data logic vs API calls
5. **Better Testing**: Clear interfaces, predictable behavior

### Suggested Tech Stack
- **State Management**: React useState/useReducer + localStorage
- **Data Fetching**: Custom hooks for API calls
- **UI Components**: Reusable, focused components
- **Data Processing**: Pure functions for data transformation
- **Error Handling**: Centralized error boundaries and handling

## File Structure
```
reactApp/src/
├── components/
│   ├── App.jsx                 # Main app container
│   ├── TabView.jsx            # Tab navigation
│   ├── InputDataTab.jsx       # Data display and management
│   ├── CaseManagementTab.jsx  # Case ID and protocol mapping
│   ├── ProtocolsTab.jsx       # Protocol definitions
│   ├── BDSAchemaTab.jsx       # BDSA schema management
│   ├── DsaSyncControl.jsx     # DSA synchronization
│   └── DsaSyncModal.jsx       # Sync progress modal
├── utils/
│   ├── dataStore.js           # Centralized data store
│   ├── dsaIntegration.js      # DSA API integration
│   ├── csvProcessor.js        # CSV data processing
│   ├── regexExtractor.js      # Regex-based data extraction
│   └── dataSourceManager.js   # Data source configuration
└── styles/
    ├── App.css
    ├── TabView.css
    └── component-specific CSS files
```

## Migration Strategy
1. **Keep current version running** while building new one
2. **Start with core functionality**: Data loading, case ID mapping
3. **Gradual feature parity**: Add features one by one
4. **Switch over when ready**: Toggle between old/new versions
5. **User testing**: Validate functionality before full migration

This knowledge base provides a comprehensive overview of the existing system for implementing a clean, maintainable version.
