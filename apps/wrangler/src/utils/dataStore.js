// Data Store - Manages loaded data from CSV files, Excel files and DSA servers
// with localStorage persistence and data transformation

import * as XLSX from 'xlsx';

class DataStore {
    constructor() {
        this.listeners = new Set();
        this.syncListeners = new Set(); // Separate listeners for sync events
        this.processedData = [];
        this.dataSource = null;
        this.dataSourceInfo = null;
        this.dataLoadTimestamp = null;
        this.modifiedItems = new Set();
        this.caseIdMappings = new Map();
        this.caseIdConflicts = new Map();
        this.bdsaCaseIdConflicts = new Map();
        this.caseProtocolMappings = new Map();

        // Track if we're currently in a batch update to avoid excessive notifications
        this._batchUpdateMode = false;

        // DSA sync state
        this.syncInProgress = false;
        this.syncCancelled = false; // Flag to cancel sync loop
        this.syncStatus = 'offline'; // 'offline', 'syncing', 'synced', 'error'
        this.syncProgress = null;
        this.lastSyncResults = null;
        this.batchProcessor = null;

        // DSA configuration
        this.girderToken = null;
        this.dsaConfig = null;
        this.columnMappings = {};

        // Load from localStorage on initialization
        this.loadFromStorage();
        this.migrateProtocolIdsInData();
    }

    // Migrate protocol IDs in processed data from timestamp-based IDs to protocol names
    migrateProtocolIdsInData() {
        if (!this.processedData || this.processedData.length === 0) {
            return;
        }

        let migrated = false;

        // Get protocol store instance directly (avoiding circular import issues)
        // We'll access it through the global scope or pass it as a parameter
        this.processedData.forEach(item => {
            if (item.BDSA?.bdsaLocal) {
                // Migrate stain protocols
                if (item.BDSA.bdsaLocal.bdsaStainProtocol && Array.isArray(item.BDSA.bdsaLocal.bdsaStainProtocol)) {
                    const updatedStainProtocols = item.BDSA.bdsaLocal.bdsaStainProtocol.map(protocolId => {
                        // Check if this is a timestamp-based ID
                        if (this.isTimestampId(protocolId)) {
                            // For now, we'll need to handle this differently
                            // The protocol store migration should have already happened
                            // So we'll try to find the protocol by name in localStorage
                            const storedProtocols = this.getStoredProtocols('stain');
                            const protocol = storedProtocols.find(p => p.id === protocolId);
                            if (protocol && protocol.name) {
                                migrated = true;
                                return protocol.name; // Use the protocol name as the new ID
                            }
                        }
                        return protocolId;
                    });
                    item.BDSA.bdsaLocal.bdsaStainProtocol = updatedStainProtocols;
                }

                // Migrate region protocols
                if (item.BDSA.bdsaLocal.bdsaRegionProtocol && Array.isArray(item.BDSA.bdsaLocal.bdsaRegionProtocol)) {
                    const updatedRegionProtocols = item.BDSA.bdsaLocal.bdsaRegionProtocol.map(protocolId => {
                        // Check if this is a timestamp-based ID
                        if (this.isTimestampId(protocolId)) {
                            // For now, we'll need to handle this differently
                            // The protocol store migration should have already happened
                            // So we'll try to find the protocol by name in localStorage
                            const storedProtocols = this.getStoredProtocols('region');
                            const protocol = storedProtocols.find(p => p.id === protocolId);
                            if (protocol && protocol.name) {
                                migrated = true;
                                return protocol.name; // Use the protocol name as the new ID
                            }
                        }
                        return protocolId;
                    });
                    item.BDSA.bdsaLocal.bdsaRegionProtocol = updatedRegionProtocols;
                }
            }
        });

        if (migrated) {
            // Skip saveToStorage() for large datasets to avoid quota errors
            // this.saveToStorage();
            console.log('🔄 Migrated protocol IDs in processed data to use protocol names instead of timestamps');
        }
    }

    // Helper to get stored protocols from localStorage
    getStoredProtocols(type) {
        try {
            const key = type === 'stain' ? 'bdsa_stain_protocols' : 'bdsa_region_protocols';
            const stored = localStorage.getItem(key);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Error loading stored protocols:', error);
            return [];
        }
    }

    // Helper function to check if an ID is a timestamp
    isTimestampId(id) {
        // Check if the ID is a numeric string that looks like a timestamp
        return /^\d{13}$/.test(id) || /^\d{10}$/.test(id);
    }

    // Event system for UI updates
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notify() {
        console.log('🔔 DataStore: notify() called, notifying', this.listeners.size, 'listeners');
        this.listeners.forEach(listener => {
            try {
                listener();
            } catch (error) {
                console.error('🔔 DataStore: Error in listener:', error);
            }
        });
    }

    /**
     * Create a proxy that automatically tracks changes to BDSA fields
     * This ensures any modification to BDSA.{} structure is tracked
     */
    createBdsaTrackingProxy(item) {
        const self = this;

        // Ensure the item has a valid ID
        if (!item.id) {
            console.warn(`⚠️ Item missing ID:`, item);
            return item; // Return original item if no ID
        }

        // Create a deep proxy that monitors nested BDSA changes
        const createDeepProxy = (obj, path = '') => {
            if (obj === null || typeof obj !== 'object') {
                return obj;
            }

            return new Proxy(obj, {
                set(target, property, value) {
                    const fullPath = path ? `${path}.${property}` : property;
                    const oldValue = target[property];
                    target[property] = value;

                    // Check if this is a BDSA-related change
                    if (fullPath.startsWith('BDSA.') ||
                        fullPath === 'BDSA' ||
                        (path === 'BDSA.bdsaLocal' && property !== '_dataSource' && property !== '_lastModified')) {

                        // Mark item as modified
                        self.modifiedItems.add(item.id);
                        console.log(`🔍 Auto-tracked BDSA change: ${fullPath} = ${value} (item ${item.id})`);
                        console.log(`🔍 Current modifiedItems size: ${self.modifiedItems.size}`);

                        // Update timestamp
                        if (item.BDSA) {
                            item.BDSA._lastModified = new Date().toISOString();
                        }

                        // Notify listeners (but only if not in batch mode)
                        if (!self._batchUpdateMode) {
                            self.notify();
                        }
                    }

                    // If the new value is an object, wrap it in a proxy too
                    if (typeof value === 'object' && value !== null) {
                        target[property] = createDeepProxy(value, fullPath);
                    }

                    return true;
                },

                // Add get trap to handle AG Grid property access
                get(target, property) {
                    const value = target[property];

                    // If AG Grid is trying to access properties, return the actual value
                    if (property === 'id' || property === '_id' || property === 'dsa_id') {
                        return value;
                    }

                    return value;
                }
            });
        };

        return createDeepProxy(item);
    }

    /**
     * Start batch update mode to avoid excessive notifications
     */
    startBatchUpdate() {
        this._batchUpdateMode = true;
    }

    /**
     * End batch update mode and notify listeners
     */
    endBatchUpdate() {
        this._batchUpdateMode = false;
        this.notify();
    }

    /**
     * Wrap existing processed data in BDSA tracking proxies
     * This should be called after data is loaded to enable automatic change tracking
     */
    enableBdsaTracking() {
        if (this.processedData && this.processedData.length > 0) {
            console.log('🔍 Enabling BDSA tracking for existing data...');
            // Temporarily disable proxy to avoid AG Grid issues
            // this.processedData = this.processedData.map(item => this.createBdsaTrackingProxy(item));
            console.log(`✅ BDSA tracking enabled for ${this.processedData.length} items (proxy disabled for AG Grid compatibility)`);
            console.log(`🔍 Sample item:`, this.processedData[0]);
        }
    }

    // Force a data refresh by creating a new array reference
    forceDataRefresh() {
        if (this.processedData && this.processedData.length > 0) {
            // Create a new array reference to trigger React re-renders
            this.processedData = [...this.processedData];
            console.log('🔄 DataStore: Forced data refresh - created new array reference');
        }
    }

    // Sync event system
    subscribeToSync(listener) {
        this.syncListeners.add(listener);
        return () => this.syncListeners.delete(listener);
    }

    notifySync(eventType, data = {}) {
        this.syncListeners.forEach(listener => {
            try {
                listener({
                    eventType,
                    dataStore: this.getSnapshot(),
                    ...data
                });
            } catch (error) {
                console.error('Error in sync listener:', error);
            }
        });
    }

    // Local Storage Management
    loadFromStorage() {
        try {
            const stored = localStorage.getItem('bdsa_data_store');
            if (stored) {
                const data = JSON.parse(stored);
                this.processedData = this.initializeBdsaStructure(data.processedData || []);
                this.dataSource = data.dataSource;
                this.dataSourceInfo = data.dataSourceInfo;
                this.dataLoadTimestamp = data.dataLoadTimestamp;
                this.modifiedItems = new Set(data.modifiedItems || []);
                this.caseIdMappings = new Map(data.caseIdMappings || []);

                // Restore caseIdConflicts with proper Set values
                this.caseIdConflicts = new Map();
                if (data.caseIdConflicts) {
                    for (const [localCaseId, bdsaIds] of data.caseIdConflicts) {
                        this.caseIdConflicts.set(localCaseId, new Set(bdsaIds));
                    }
                }

                // Restore bdsaCaseIdConflicts with proper Set values
                this.bdsaCaseIdConflicts = new Map();
                if (data.bdsaCaseIdConflicts) {
                    for (const [bdsaCaseId, localIds] of data.bdsaCaseIdConflicts) {
                        this.bdsaCaseIdConflicts.set(bdsaCaseId, new Set(localIds));
                    }
                }

                this.caseProtocolMappings = new Map(data.caseProtocolMappings || []);

                console.log(`📦 Loaded data from localStorage:`, {
                    itemCount: this.processedData.length,
                    dataSource: this.dataSource,
                    modifiedItems: this.modifiedItems.size,
                    hasBdsaCaseIds: this.processedData.some(item => item.BDSA?.bdsaLocal?.bdsaCaseId),
                    sampleBDSA: this.processedData[0]?.BDSA
                });
            }
        } catch (error) {
            console.error('Error loading data store from storage:', error);
        }
    }

    saveToStorage() {
        try {
            const data = {
                processedData: this.processedData,
                dataSource: this.dataSource,
                dataSourceInfo: this.dataSourceInfo,
                dataLoadTimestamp: this.dataLoadTimestamp,
                modifiedItems: Array.from(this.modifiedItems),
                caseIdMappings: Array.from(this.caseIdMappings),
                caseIdConflicts: Array.from(this.caseIdConflicts),
                bdsaCaseIdConflicts: Array.from(this.bdsaCaseIdConflicts),
                caseProtocolMappings: Array.from(this.caseProtocolMappings)
            };
            localStorage.setItem('bdsa_data_store', JSON.stringify(data));
        } catch (error) {
            console.error('Error saving data store to storage:', error);
        }
    }

    // CSV Data Loading
    async loadCsvData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const csvText = e.target.result;
                    const data = this.parseCsv(csvText, file.name);

                    this.processedData = this.initializeBdsaStructure(data);
                    this.dataSource = 'csv';
                    this.dataSourceInfo = {
                        fileName: file.name,
                        fileSize: file.size,
                        lastModified: file.lastModified
                    };
                    this.dataLoadTimestamp = new Date().toISOString();
                    console.log(`🧹 Clearing modifiedItems (${this.modifiedItems.size} items) from:`, new Error().stack);
                    this.modifiedItems.clear();

                    // Enable BDSA tracking for the loaded data
                    this.enableBdsaTracking();

                    // Clear case ID mappings when loading new data (they're specific to the previous dataset)
                    this.caseIdMappings.clear();
                    this.caseIdConflicts.clear();
                    this.bdsaCaseIdConflicts.clear();

                    // Skip saveToStorage() for large datasets to avoid quota errors
                    // this.saveToStorage();
                    this.notify();

                    resolve({
                        success: true,
                        itemCount: data.length,
                        message: `Successfully loaded ${data.length} items from CSV`
                    });
                } catch (error) {
                    reject(new Error(`Failed to parse CSV: ${error.message}`));
                }
            };

            reader.onerror = () => {
                reject(new Error('Failed to read CSV file'));
            };

            reader.readAsText(file);
        });
    }

    parseCsv(csvText, fileName = 'unknown') {
        const lines = csvText.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
            throw new Error('CSV file must have at least a header and one data row');
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const data = [];

        // Create a unique prefix based on filename and timestamp
        const filePrefix = fileName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        const timestamp = Date.now();

        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCsvLine(lines[i]);
            if (values.length !== headers.length) {
                console.warn(`Row ${i + 1} has ${values.length} values but expected ${headers.length}`);
                continue;
            }

            const item = {};
            headers.forEach((header, index) => {
                item[header] = values[index];
            });

            // Add consistent row identifier and BDSA structure
            item.id = `csv_${filePrefix}_${timestamp}_row_${i}`;
            item.BDSA = {
                bdsaLocal: {
                    localCaseId: null,
                    localStainID: null,
                    localRegionId: null
                },
                _dataSource: {},
                _lastModified: new Date().toISOString()
            };

            data.push(item);
        }

        return data;
    }

    // Excel Data Loading - Get sheet names first
    async getExcelSheetNames(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = e.target.result;
                    const workbook = XLSX.read(data, { type: 'binary' });
                    resolve(workbook.SheetNames);
                } catch (error) {
                    reject(new Error(`Failed to read Excel file: ${error.message}`));
                }
            };

            reader.onerror = () => {
                reject(new Error('Failed to read Excel file'));
            };

            reader.readAsBinaryString(file);
        });
    }

    // Excel Data Loading - Load specific sheet
    async loadExcelData(file, sheetName = null) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = e.target.result;
                    const workbook = XLSX.read(data, { type: 'binary' });

                    // Use provided sheet name or first sheet
                    const targetSheetName = sheetName || workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[targetSheetName];

                    if (!worksheet) {
                        throw new Error(`Sheet "${targetSheetName}" not found`);
                    }

                    // Convert to JSON
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);

                    this.processedData = this.initializeBdsaStructure(jsonData);
                    this.dataSource = 'excel';
                    this.dataSourceInfo = {
                        fileName: file.name,
                        fileSize: file.size,
                        lastModified: file.lastModified,
                        sheetName: targetSheetName
                    };
                    this.dataLoadTimestamp = new Date().toISOString();
                    console.log(`🧹 Clearing modifiedItems (${this.modifiedItems.size} items) from:`, new Error().stack);
                    this.modifiedItems.clear();

                    // Clear case ID mappings when loading new data (they're specific to the previous dataset)
                    this.caseIdMappings.clear();
                    this.caseIdConflicts.clear();
                    this.bdsaCaseIdConflicts.clear();

                    // Skip saveToStorage() for large datasets to avoid quota errors
                    // this.saveToStorage();
                    this.notify();

                    resolve({
                        success: true,
                        itemCount: jsonData.length,
                        message: `Successfully loaded ${jsonData.length} items from Excel sheet "${targetSheetName}"`
                    });
                } catch (error) {
                    reject(new Error(`Failed to parse Excel file: ${error.message}`));
                }
            };

            reader.onerror = () => {
                reject(new Error('Failed to read Excel file'));
            };

            reader.readAsBinaryString(file);
        });
    }

    parseCsvLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim().replace(/"/g, ''));
                current = '';
            } else {
                current += char;
            }
        }

        values.push(current.trim().replace(/"/g, ''));
        return values;
    }

    // Accessory File Loading - for CSV/Excel files with additional metadata
    async loadAccessoryFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    let accessoryData;

                    if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
                        // Handle CSV file
                        const csvText = e.target.result;
                        accessoryData = this.parseCsv(csvText, file.name);
                    } else {
                        // Handle Excel file
                        const data = e.target.result;
                        const workbook = XLSX.read(data, { type: 'binary' });
                        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                        accessoryData = XLSX.utils.sheet_to_json(worksheet);
                    }

                    if (!accessoryData || accessoryData.length === 0) {
                        throw new Error('Accessory file is empty or could not be parsed');
                    }

                    // Match accessory data with existing DSA data based on filename
                    const matchedData = this.matchAccessoryData(accessoryData);

                    resolve({
                        success: true,
                        itemCount: accessoryData.length,
                        matchedCount: matchedData.matchedCount,
                        data: accessoryData,
                        matchedData: matchedData.matchedData,
                        message: `Successfully loaded ${accessoryData.length} accessory items, matched ${matchedData.matchedCount} with DSA data`
                    });
                } catch (error) {
                    reject(new Error(`Failed to parse accessory file: ${error.message}`));
                }
            };

            reader.onerror = () => {
                reject(new Error('Failed to read accessory file'));
            };

            if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
                reader.readAsText(file);
            } else {
                reader.readAsBinaryString(file);
            }
        });
    }

    // Match accessory data with existing DSA data based on filename
    matchAccessoryData(accessoryData) {
        if (!this.processedData || this.processedData.length === 0) {
            return { matchedData: [], matchedCount: 0 };
        }

        const matchedData = [];
        let matchedCount = 0;

        // Create a map of DSA filenames for quick lookup
        const dsaFilenameMap = new Map();
        this.processedData.forEach((item, index) => {
            const filename = item.name || item.dsa_name || '';
            if (filename) {
                // Store both exact match and normalized versions
                dsaFilenameMap.set(filename, { item, index });
                dsaFilenameMap.set(filename.toLowerCase(), { item, index });

                // Also try without extension
                const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
                dsaFilenameMap.set(nameWithoutExt, { item, index });
                dsaFilenameMap.set(nameWithoutExt.toLowerCase(), { item, index });
            }
        });

        // Try to match each accessory item
        accessoryData.forEach((accessoryItem, accessoryIndex) => {
            let matched = false;
            let dsaItem = null; // Declare dsaItem at the top of the loop scope

            // Look for filename field in accessory data (could be 'new_filename', 'filename', 'name', etc.)
            const possibleFilenameFields = ['new_filename', 'filename', 'name', 'file_name', 'image_name', 'FileName', 'Filename', 'ImageName'];
            let accessoryFilename = '';

            for (const field of possibleFilenameFields) {
                if (accessoryItem[field]) {
                    accessoryFilename = accessoryItem[field];
                    console.log(`🔍 Found filename in field "${field}": ${accessoryFilename}`);
                    break;
                }
            }

            // If no match found, try case-insensitive search through all fields
            if (!accessoryFilename) {
                const allKeys = Object.keys(accessoryItem);
                for (const key of allKeys) {
                    if (key.toLowerCase().includes('filename') || key.toLowerCase().includes('name')) {
                        accessoryFilename = accessoryItem[key];
                        console.log(`🔍 Found filename in field "${key}" (case-insensitive): ${accessoryFilename}`);
                        break;
                    }
                }
            }

            if (accessoryFilename) {
                // Try exact match first
                dsaItem = dsaFilenameMap.get(accessoryFilename);

                if (!dsaItem) {
                    // Try case-insensitive match
                    dsaItem = dsaFilenameMap.get(accessoryFilename.toLowerCase());
                }

                if (!dsaItem) {
                    // Try without extension
                    const nameWithoutExt = accessoryFilename.replace(/\.[^/.]+$/, '');
                    dsaItem = dsaFilenameMap.get(nameWithoutExt);
                    if (!dsaItem) {
                        dsaItem = dsaFilenameMap.get(nameWithoutExt.toLowerCase());
                    }
                }

                if (dsaItem) {
                    // Add accessory data as temporary fields to the DSA item
                    if (!dsaItem.item.accessoryData) {
                        dsaItem.item.accessoryData = {};
                    }

                    // Add all accessory fields with a prefix to avoid conflicts
                    // Skip filename fields, BDSA fields, and other internal fields
                    Object.keys(accessoryItem).forEach(key => {
                        // Skip filename fields
                        if (key === 'new_filename' || key === 'filename' || key === 'name') {
                            return;
                        }

                        // Skip BDSA fields (these are app-internal, not from the original accessory file)
                        if (key === 'BDSA' || key.startsWith('BDSA.')) {
                            console.log(`⚠️ Skipping internal BDSA field from accessory item: ${key}`);
                            return;
                        }

                        // Skip internal fields
                        if (key.startsWith('_')) {
                            return;
                        }

                        dsaItem.item.accessoryData[`accessory_${key}`] = accessoryItem[key];
                    });

                    // Mark the item as modified
                    this.modifiedItems.add(dsaItem.item.id || dsaItem.index);
                    matched = true;
                    matchedCount++;
                }
            }

            matchedData.push({
                accessoryIndex,
                accessoryItem,
                matched,
                dsaItem: matched ? dsaItem : null
            });
        });

        // Save changes and notify listeners
        // Skip saveToStorage() for large datasets to avoid quota errors
        // this.saveToStorage();
        this.notify();

        console.log(`🔗 Accessory data matching complete: ${matchedCount}/${accessoryData.length} items matched with DSA data`);

        return { matchedData, matchedCount };
    }

    // Retry accessory matching with a specific filename field
    retryAccessoryMatching(accessoryData, filenameField) {
        if (!this.processedData || this.processedData.length === 0) {
            return { matchedData: [], matchedCount: 0, itemCount: accessoryData.length };
        }

        const matchedData = [];
        let matchedCount = 0;

        // Create a map of DSA filenames for quick lookup
        const dsaFilenameMap = new Map();
        this.processedData.forEach((item, index) => {
            const filename = item.name || item.dsa_name || '';
            if (filename) {
                // Store both exact match and normalized versions
                dsaFilenameMap.set(filename, { item, index });
                dsaFilenameMap.set(filename.toLowerCase(), { item, index });

                // Also try without extension
                const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
                dsaFilenameMap.set(nameWithoutExt, { item, index });
                dsaFilenameMap.set(nameWithoutExt.toLowerCase(), { item, index });
            }
        });

        // Try to match each accessory item using the specified filename field
        accessoryData.forEach((accessoryItem, accessoryIndex) => {
            let matched = false;

            const accessoryFilename = accessoryItem[filenameField];

            if (accessoryFilename) {
                // Try exact match first
                let dsaItem = dsaFilenameMap.get(accessoryFilename);

                if (!dsaItem) {
                    // Try case-insensitive match
                    dsaItem = dsaFilenameMap.get(accessoryFilename.toLowerCase());
                }

                if (!dsaItem) {
                    // Try without extension
                    const nameWithoutExt = accessoryFilename.replace(/\.[^/.]+$/, '');
                    dsaItem = dsaFilenameMap.get(nameWithoutExt);
                    if (!dsaItem) {
                        dsaItem = dsaFilenameMap.get(nameWithoutExt.toLowerCase());
                    }
                }

                if (dsaItem) {
                    // Add accessory data as temporary fields to the DSA item
                    if (!dsaItem.item.accessoryData) {
                        dsaItem.item.accessoryData = {};
                    }

                    // Add all accessory fields with a prefix to avoid conflicts
                    Object.keys(accessoryItem).forEach(key => {
                        if (key !== filenameField) {
                            dsaItem.item.accessoryData[`accessory_${key}`] = accessoryItem[key];
                        }
                    });

                    // Mark the item as modified
                    this.modifiedItems.add(dsaItem.item.id || dsaItem.index);
                    matched = true;
                    matchedCount++;
                }
            }

            matchedData.push({
                accessoryIndex,
                accessoryItem,
                matched,
                dsaItem: matched ? dsaItem : null
            });
        });

        // Save changes and notify listeners
        // Skip saveToStorage() for large datasets to avoid quota errors
        // this.saveToStorage();
        this.notify();

        console.log(`🔗 Retry matching complete: ${matchedCount}/${accessoryData.length} items matched using field "${filenameField}"`);

        return { matchedData, matchedCount, itemCount: accessoryData.length };
    }

    // DSA Data Loading - Back to working approach with file filtering
    async loadDsaData(dsaAuthStore) {
        console.log('🚀 DEBUG - loadDsaData called');
        try {
            const authStatus = dsaAuthStore.getStatus();
            if (!authStatus.isAuthenticated) {
                throw new Error('Not authenticated with DSA server');
            }

            if (!authStatus.isConfigured) {
                throw new Error('DSA server not configured');
            }

            const config = dsaAuthStore.config;
            const token = dsaAuthStore.token;

            console.log('🔄 Using dsaIntegration.loadDsaData for proper filtering...');

            // Import and use the proper loadDsaData from dsaIntegration that includes filtering
            const { loadDsaData } = await import('./dsaIntegration.js');
            console.log('🚀 Calling dsaIntegration.loadDsaData with config:', config);
            const result = await loadDsaData(config, token);
            console.log('✅ dsaIntegration.loadDsaData returned:', result);

            if (!result.success) {
                throw new Error(result.error || 'Failed to load DSA data');
            }

            console.log(`📊 DataStore: Setting processedData to ${result.data.length} items`);
            this.processedData = result.data;
            this.dataSource = 'dsa';
            this.dataSourceInfo = {
                baseUrl: config.baseUrl,
                resourceId: config.resourceId,
                resourceType: config.resourceType
            };
            this.dataLoadTimestamp = new Date().toISOString();

            // Clean up orphaned IDs from modifiedItems Set
            // (items that were modified but no longer exist after data refresh)
            this.cleanupModifiedItems();

            // Only clear modifiedItems if this is a fresh data load (not a refresh with existing modifications)
            if (this.modifiedItems.size === 0) {
                console.log(`🧹 Clearing modifiedItems (${this.modifiedItems.size} items) from:`, new Error().stack);
                this.modifiedItems.clear();
            } else {
                console.log(`🔍 Preserving ${this.modifiedItems.size} existing modified items during data load`);
            }

            // Enable BDSA tracking for the loaded data
            console.log(`🔍 About to enable BDSA tracking. Current modifiedItems size: ${this.modifiedItems.size}`);
            this.enableBdsaTracking();
            console.log(`🔍 After enabling BDSA tracking. Current modifiedItems size: ${this.modifiedItems.size}`);

            // Set DSA configuration for sync functionality
            this.girderToken = token;
            this.dsaConfig = config;

            // Try to save to storage, but don't fail if quota exceeded
            try {
                // Skip saveToStorage() for large datasets to avoid quota errors
                // this.saveToStorage();
            } catch (error) {
                if (error.name === 'QuotaExceededError') {
                    console.warn('⚠️ Data too large for localStorage, skipping storage save');
                    console.warn(`📊 Data size: ${JSON.stringify(this.processedData).length} characters`);
                    console.warn('💡 Consider using file filtering to reduce data size');
                } else {
                    console.error('Error saving to storage:', error);
                }
            }
            this.notify();

            console.log(`📊 DataStore: Final processedData length: ${this.processedData.length}`);
            console.log(`📊 DataStore: Data source: ${this.dataSource}`);
            console.log(`📊 DataStore: Data type: ${typeof this.processedData}`);
            console.log(`📊 DataStore: Is array: ${Array.isArray(this.processedData)}`);
            if (this.processedData.length > 0) {
                const sampleItem = this.processedData[0];
                console.log(`📊 DataStore: Sample item:`, sampleItem);
                console.log(`📊 DataStore: Sample item BDSA structure:`, {
                    hasBDSA: !!sampleItem.BDSA,
                    hasBdsaLocal: !!sampleItem.BDSA?.bdsaLocal,
                    bdsaLocalKeys: sampleItem.BDSA?.bdsaLocal ? Object.keys(sampleItem.BDSA.bdsaLocal) : [],
                    localCaseId: sampleItem.BDSA?.bdsaLocal?.localCaseId,
                    localStainID: sampleItem.BDSA?.bdsaLocal?.localStainID,
                    localRegionId: sampleItem.BDSA?.bdsaLocal?.localRegionId,
                    bdsaCaseId: sampleItem.BDSA?.bdsaLocal?.bdsaCaseId
                });
            }

            return {
                success: true,
                itemCount: result.data.length,
                message: `Successfully loaded ${result.data.length} items from DSA (filtered)`
            };
        } catch (error) {
            throw new Error(`Failed to load DSA data: ${error.message}`);
        }
    }

    async loadMoreDsaData(dsaAuthStore, progressCallback) {
        console.log('🚀 Loading more DSA data in background...');
        try {
            const authStatus = dsaAuthStore.getStatus();
            if (!authStatus.isAuthenticated) {
                throw new Error('Not authenticated with DSA server');
            }

            const config = dsaAuthStore.config;
            const token = dsaAuthStore.token;

            // Import the pagination function
            const { loadMoreDsaDataPaginated } = await import('./dsaIntegration.js');

            // Calculate how many pages we've already loaded (5 pages = 5000 items / 1000 per page)
            const currentPageCount = Math.ceil(this.processedData.length / 1000);

            // Load more pages (e.g., load 20 more pages)
            const result = await loadMoreDsaDataPaginated(config, token, currentPageCount, 20, progressCallback);

            if (result.success && result.data.length > 0) {
                // Append new data to existing data
                this.processedData = [...this.processedData, ...result.data];
                console.log(`📊 DataStore: Added ${result.data.length} more items. Total: ${this.processedData.length}`);

                // Notify listeners about the update
                this.notify();
            }

            return {
                success: true,
                totalItemCount: this.processedData.length,
                newItemCount: result.data.length,
                message: `Successfully loaded ${result.data.length} more items. Total: ${this.processedData.length}`
            };
        } catch (error) {
            throw new Error(`Failed to load more DSA data: ${error.message}`);
        }
    }

    // Background loading to progressively cache more data
    async startBackgroundLoading() {
        if (this.backgroundLoading.isActive) {
            console.log('🔄 Background loading already active');
            return;
        }

        this.backgroundLoading.isActive = true;
        console.log('🚀 Starting background data loading...');

        try {
            const config = this.serverSideConfig;
            const pageSize = 1000; // Load 1000 items at a time in background
            let page = 0;
            let hasMore = true;
            let totalFilteredCount = 0;

            while (hasMore && this.backgroundLoading.isActive) {
                console.log(`📄 Background loading page ${page}...`);

                const offset = page * pageSize;
                const apiUrl = `${config.baseUrl}/api/v1/resource/${config.resourceId}/items?type=${config.resourceType || 'folder'}&limit=${pageSize}&offset=${offset}`;

                const headers = {
                    'Content-Type': 'application/json',
                    'Girder-Token': config.token
                };

                const response = await fetch(apiUrl, {
                    method: 'GET',
                    headers: headers
                });

                if (!response.ok) {
                    console.error(`Background loading failed at page ${page}:`, response.status);
                    break;
                }

                const items = await response.json();

                // Apply file filtering to the page data
                const { transformDsaData } = await import('./dsaIntegration.js');
                const filteredData = transformDsaData(items);

                // Cache the filtered data
                this.backgroundLoading.cachedData.set(page, filteredData);
                this.backgroundLoading.loadedPages.add(page);
                totalFilteredCount += filteredData.length;

                console.log(`✅ Background loaded page ${page}: ${filteredData.length} items (total so far: ${totalFilteredCount})`);

                // Check if we should continue
                if (items.length < pageSize) {
                    hasMore = false;
                    console.log('🏁 Background loading complete - reached end of data');
                } else {
                    page++;
                }

                // Update total count as we learn more
                this.backgroundLoading.totalCount = (page + 1) * pageSize;
                this.backgroundLoading.filteredCount = totalFilteredCount;

                // Notify UI of progress
                this.notify();

                // Small delay to prevent overwhelming the server
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            console.log(`🎉 Background loading complete! Total filtered items: ${totalFilteredCount}`);
            this.backgroundLoading.isActive = false;

        } catch (error) {
            console.error('Background loading error:', error);
            this.backgroundLoading.isActive = false;
        }
    }

    // Stop background loading
    stopBackgroundLoading() {
        console.log('🛑 Stopping background loading...');
        this.backgroundLoading.isActive = false;
    }

    async fetchDsaItems(config, token) {
        const apiUrl = `${config.baseUrl}/api/v1/resource/${config.resourceId}/items?type=${config.resourceType || 'folder'}&limit=0`;

        const headers = {
            'Content-Type': 'application/json',
            'Girder-Token': token
        };

        console.log('Fetching DSA items from:', apiUrl);

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: headers
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('DSA API Error:', {
                status: response.status,
                statusText: response.statusText,
                url: apiUrl,
                response: errorText
            });
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        const items = await response.json();
        console.log(`✅ Fetched ${items.length} items from DSA`);
        return items;
    }

    // Server-side pagination for AG Grid with background cache support
    async fetchDsaPage({ page, pageSize, sortModel, filterModel }) {
        console.log('📄 Fetching DSA page:', { page, pageSize, sortModel, filterModel });

        try {
            if (!this.serverSideConfig) {
                throw new Error('Server-side pagination not configured');
            }

            // Check if we have cached data for this page
            if (this.backgroundLoading && this.backgroundLoading.cachedData.has(page)) {
                console.log(`📦 Using cached data for page ${page}`);
                const cachedData = this.backgroundLoading.cachedData.get(page);
                const totalCount = this.backgroundLoading.filteredCount || cachedData.length * 100;

                return {
                    data: cachedData,
                    totalCount: totalCount
                };
            }

            // Fallback to live API request
            const config = this.serverSideConfig;
            const token = config.token;

            // Calculate offset for pagination
            const offset = page * pageSize;

            // Build API URL with pagination
            let apiUrl = `${config.baseUrl}/api/v1/resource/${config.resourceId}/items?type=${config.resourceType || 'folder'}&limit=${pageSize}&offset=${offset}`;

            // Add sorting if specified
            if (sortModel && sortModel.length > 0) {
                const sort = sortModel[0];
                apiUrl += `&sort=${sort.colId}&sortdir=${sort.sort === 'asc' ? 1 : -1}`;
            }

            const headers = {
                'Content-Type': 'application/json',
                'Girder-Token': token
            };

            console.log('📄 Fetching page from API:', apiUrl);

            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: headers
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('DSA API Error:', {
                    status: response.status,
                    statusText: response.statusText,
                    url: apiUrl,
                    response: errorText
                });
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }

            const items = await response.json();

            // Apply file filtering to the page data
            const { transformDsaData } = await import('./dsaIntegration.js');
            const filteredData = transformDsaData(items);

            // Use background loading stats if available, otherwise estimate
            const totalCount = this.backgroundLoading?.filteredCount ||
                this.backgroundLoading?.totalCount ||
                Math.max(filteredData.length * 100, 10000);

            console.log(`✅ Fetched page ${page}: ${filteredData.length} items (total: ${totalCount})`);

            return {
                data: filteredData,
                totalCount: totalCount
            };

        } catch (error) {
            console.error('Error fetching DSA page:', error);
            throw error;
        }
    }

    transformDsaData(dsaData) {
        if (!dsaData || !Array.isArray(dsaData)) {
            return [];
        }

        console.log('🔄 Transforming DSA data:', {
            itemCount: dsaData.length,
            sampleItem: dsaData[0] ? Object.keys(dsaData[0]) : []
        });

        // Debug: Check if the first few items have bdsaCaseId in meta.BDSA.bdsaLocal
        for (let i = 0; i < Math.min(3, dsaData.length); i++) {
            const item = dsaData[i];
            const bdsaCaseId = item.meta?.BDSA?.bdsaLocal?.bdsaCaseId;
            if (bdsaCaseId) {
                console.log(`🔍 Found bdsaCaseId in server data for item ${i}:`, {
                    itemId: item._id || item.id,
                    bdsaCaseId: bdsaCaseId,
                    fullBdsaLocal: item.meta?.BDSA?.bdsaLocal
                });
            }
        }

        return dsaData.map((item, index) => {
            // Debug: Log the raw item structure to see what we're getting from the server
            if (index === 0) {
                console.log('🔍 DEBUG - Raw DSA item structure:', {
                    itemId: item._id || item.id,
                    itemName: item.name,
                    hasMeta: !!item.meta,
                    metaKeys: item.meta ? Object.keys(item.meta) : [],
                    hasBdsaMeta: !!(item.meta?.BDSA),
                    bdsaKeys: item.meta?.BDSA ? Object.keys(item.meta.BDSA) : [],
                    bdsaLocal: item.meta?.BDSA?.bdsaLocal
                });
            }

            // Initialize BDSA object for local data management
            // First, check if the item already has BDSA metadata from the server
            const existingBdsaData = item.meta?.BDSA?.bdsaLocal || {};

            // Debug: Log what we're extracting for the first few items
            if (index < 3) {
                console.log(`🔍 DEBUG - Extracting BDSA data for item ${index}:`, {
                    itemId: item._id || item.id,
                    existingBdsaData,
                    extractedValues: {
                        localCaseId: existingBdsaData.localCaseId || null,
                        localStainID: existingBdsaData.localStainID || null,
                        localRegionId: existingBdsaData.localRegionId || null,
                        bdsaCaseId: existingBdsaData.bdsaCaseId || null,
                        stainProtocols: existingBdsaData.bdsaStainProtocol || [],
                        regionProtocols: existingBdsaData.bdsaRegionProtocol || []
                    }
                });
            }

            // Keep the original data structure - don't flatten it
            const transformedItem = {
                // Include the original item data (nested structure preserved)
                ...item,

                // Create a single, consistent row identifier
                id: item._id || item.id || `dsa_item_${Date.now()}_${index}`,

                // Add convenient DSA metadata fields for easy access
                dsa_name: item.name || '',
                dsa_created: item.created || item.createdAt || '',
                dsa_updated: item.updated || item.updatedAt || '',
                dsa_size: item.size || item.fileSize || '',
                dsa_mimeType: item.mimeType || item.contentType || ''
            };

            // Initialize or merge BDSA structure (don't overwrite if it already exists from accessory data)
            if (!transformedItem.BDSA) {
                transformedItem.BDSA = {};
            }
            if (!transformedItem.BDSA.bdsaLocal) {
                transformedItem.BDSA.bdsaLocal = {};
            }
            if (!transformedItem.BDSA._dataSource) {
                transformedItem.BDSA._dataSource = {};
            }

            // Import server metadata into BDSA structure (only if not already set)
            if (existingBdsaData.localCaseId && !transformedItem.BDSA.bdsaLocal.localCaseId) {
                transformedItem.BDSA.bdsaLocal.localCaseId = existingBdsaData.localCaseId;
                transformedItem.BDSA._dataSource.localCaseId = 'dsa_server';
            }
            if (existingBdsaData.localStainID && !transformedItem.BDSA.bdsaLocal.localStainID) {
                transformedItem.BDSA.bdsaLocal.localStainID = existingBdsaData.localStainID;
                transformedItem.BDSA._dataSource.localStainID = 'dsa_server';
            }
            if (existingBdsaData.localRegionId && !transformedItem.BDSA.bdsaLocal.localRegionId) {
                transformedItem.BDSA.bdsaLocal.localRegionId = existingBdsaData.localRegionId;
                transformedItem.BDSA._dataSource.localRegionId = 'dsa_server';
            }
            if (existingBdsaData.bdsaCaseId && !transformedItem.BDSA.bdsaLocal.bdsaCaseId) {
                transformedItem.BDSA.bdsaLocal.bdsaCaseId = existingBdsaData.bdsaCaseId;
                transformedItem.BDSA._dataSource.bdsaCaseId = 'dsa_server';
            }
            if (existingBdsaData.bdsaStainProtocol && existingBdsaData.bdsaStainProtocol.length > 0 &&
                (!transformedItem.BDSA.bdsaLocal.bdsaStainProtocol || transformedItem.BDSA.bdsaLocal.bdsaStainProtocol.length === 0)) {
                transformedItem.BDSA.bdsaLocal.bdsaStainProtocol = existingBdsaData.bdsaStainProtocol;
                transformedItem.BDSA._dataSource.bdsaStainProtocol = 'dsa_server';
            }
            if (existingBdsaData.bdsaRegionProtocol && existingBdsaData.bdsaRegionProtocol.length > 0 &&
                (!transformedItem.BDSA.bdsaLocal.bdsaRegionProtocol || transformedItem.BDSA.bdsaLocal.bdsaRegionProtocol.length === 0)) {
                transformedItem.BDSA.bdsaLocal.bdsaRegionProtocol = existingBdsaData.bdsaRegionProtocol;
                transformedItem.BDSA._dataSource.bdsaRegionProtocol = 'dsa_server';
            }

            // Set last modified timestamp if we imported server data
            if (Object.keys(existingBdsaData).length > 0) {
                transformedItem.BDSA._lastModified = new Date().toISOString();
            }

            return transformedItem;
        });
    }

    flattenObject(obj, prefix = '') {
        const flattened = {};

        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const newKey = prefix ? `${prefix}.${key}` : key;
                const value = obj[key];

                // Debug: Log meta-related fields
                if (newKey.includes('meta') && prefix === '') {
                    console.log(`🔍 Flattening meta field: ${newKey} =`, value);
                    if (value && typeof value === 'object' && value.bdsaLocal) {
                        console.log(`🔍 Found bdsaLocal in meta:`, value.bdsaLocal);
                    }
                }

                if (value === null || value === undefined) {
                    // Handle null/undefined values
                    flattened[newKey] = value;
                } else if (Array.isArray(value)) {
                    // Handle arrays - convert to comma-separated string or index-based keys
                    if (value.length === 0) {
                        flattened[newKey] = '';
                    } else if (value.every(item => typeof item === 'string' || typeof item === 'number')) {
                        // Simple array of primitives - join with commas
                        flattened[newKey] = value.join(', ');
                    } else {
                        // Complex array - create indexed entries
                        value.forEach((item, index) => {
                            if (typeof item === 'object' && item !== null) {
                                // Recursively flatten complex array items
                                Object.assign(flattened, this.flattenObject(item, `${newKey}[${index}]`));
                            } else {
                                flattened[`${newKey}[${index}]`] = item;
                            }
                        });
                    }
                } else if (typeof value === 'object') {
                    // Recursively flatten nested objects
                    if (newKey === 'meta') {
                        console.log(`🔍 Recursively flattening meta object:`, value);
                    }
                    const nestedFlattened = this.flattenObject(value, newKey);
                    if (newKey === 'meta') {
                        console.log(`🔍 Meta flattening result:`, nestedFlattened);
                    }
                    Object.assign(flattened, nestedFlattened);
                } else {
                    // Add primitive values directly
                    flattened[newKey] = value;
                }
            }
        }

        return flattened;
    }

    // Data Management
    clearData() {
        this.processedData = [];
        this.dataSource = null;
        this.dataSourceInfo = null;
        this.dataLoadTimestamp = null;
        console.log(`🧹 Clearing modifiedItems (${this.modifiedItems.size} items) from:`, new Error().stack);
        this.modifiedItems.clear();
        this.caseIdMappings.clear();
        this.caseIdConflicts.clear();
        this.bdsaCaseIdConflicts.clear();
        this.caseProtocolMappings.clear();

        // Skip saveToStorage() for large datasets to avoid quota errors
        // this.saveToStorage();
        this.notify();
    }

    // Status and Getters
    getStatus() {
        // Ensure BDSA structure is always initialized when data is accessed
        if (this.processedData && this.processedData.length > 0) {
            this.processedData = this.initializeBdsaStructure(this.processedData);
        }

        return {
            processedData: this.processedData,
            dataSource: this.dataSource,
            dataSourceInfo: this.dataSourceInfo,
            dataLoadTimestamp: this.dataLoadTimestamp,
            modifiedItems: Array.from(this.modifiedItems),
            caseIdMappings: Object.fromEntries(this.caseIdMappings),
            caseIdConflicts: Object.fromEntries(this.caseIdConflicts),
            bdsaCaseIdConflicts: Object.fromEntries(this.bdsaCaseIdConflicts),
            caseProtocolMappings: Array.from(this.caseProtocolMappings)
        };
    }

    // Data Query Methods
    getItemsByField(fieldName, value) {
        return this.processedData.filter(item => item[fieldName] === value);
    }

    getItemsByFieldContains(fieldName, value) {
        return this.processedData.filter(item =>
            item[fieldName] && item[fieldName].toString().toLowerCase().includes(value.toLowerCase())
        );
    }

    // Statistics
    getStatistics() {
        const totalItems = this.processedData.length;
        const fieldCounts = {};

        // Count unique values for each field
        this.processedData.forEach(item => {
            Object.keys(item).forEach(key => {
                if (!fieldCounts[key]) {
                    fieldCounts[key] = new Set();
                }
                if (item[key] && item[key] !== '') {
                    fieldCounts[key].add(item[key]);
                }
            });
        });

        // Convert sets to counts
        const uniqueFieldCounts = {};
        Object.keys(fieldCounts).forEach(key => {
            uniqueFieldCounts[key] = fieldCounts[key].size;
        });

        return {
            totalItems,
            uniqueFieldCounts,
            modifiedItems: this.modifiedItems.size
        };
    }

    /**
     * Get nested property value from an object using dot notation
     * @param {Object} obj - The object to query
     * @param {string} path - Dot-separated path (e.g., 'accessoryData.accessory_SubNum')
     * @returns {*} The value at the path, or undefined if not found
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    /**
     * Apply column mappings to populate BDSA fields from source data
     * @param {Object} columnMappings - Object mapping BDSA fields to source columns
     * @param {boolean} markAsModified - Whether to mark items as modified (default: true)
     * @returns {Object} - Result with success status and updated count
     */
    applyColumnMappings(columnMappings, markAsModified = true) {
        if (!this.processedData || this.processedData.length === 0) {
            return { success: false, error: 'No data available' };
        }

        if (!columnMappings) {
            return { success: false, error: 'No column mappings provided' };
        }

        let updatedCount = 0;
        const updatedItems = [];

        this.processedData.forEach((item, index) => {
            let itemUpdated = false;

            // Apply mappings for each field
            Object.entries(columnMappings).forEach(([bdsaField, sourceColumn]) => {
                if (sourceColumn && sourceColumn.trim() !== '') {
                    // Use nested property access for columns like 'accessoryData.accessory_SubNum'
                    const sourceValue = this.getNestedValue(item, sourceColumn);

                    // Debug first few items
                    if (index < 3) {
                        console.log(`🔍 Column mapping [item ${index}]: ${bdsaField} ← ${sourceColumn} = ${sourceValue}`);
                    }

                    // Only update if source value exists and is not empty
                    if (sourceValue !== null && sourceValue !== undefined && sourceValue !== '') {
                        // Initialize nested structure if needed (directly on item, not a copy)
                        if (!item.BDSA) {
                            item.BDSA = {
                                bdsaLocal: {},
                                _dataSource: {}
                            };
                        }
                        if (!item.BDSA.bdsaLocal) {
                            item.BDSA.bdsaLocal = {};
                        }
                        if (!item.BDSA._dataSource) {
                            item.BDSA._dataSource = {};
                        }

                        // Set the value and track source directly on the item
                        item.BDSA.bdsaLocal[bdsaField] = sourceValue;
                        item.BDSA._dataSource[bdsaField] = 'column_mapping';
                        item.BDSA._lastModified = new Date().toISOString();
                        itemUpdated = true;

                        // Debug successful mapping
                        if (index < 3) {
                            console.log(`✅ Mapped ${bdsaField} = ${sourceValue} from ${sourceColumn}`);
                        }
                    }
                }
            });

            if (itemUpdated) {
                // Only mark as modified if requested
                if (markAsModified) {
                    this.modifiedItems.add(item.id);
                    console.log(`🔍 Added item ${item.id} to modifiedItems. Total modified: ${this.modifiedItems.size}`);
                } else {
                    console.log(`🔍 Updated item ${item.id} but did not mark as modified (data refresh)`);
                }
                updatedCount++;
            }
        });

        // Skip saveToStorage() for large datasets to avoid quota errors
        // Data will be persisted via export/sync instead
        // this.saveToStorage();
        this.notify();

        console.log(`📊 Applied column mappings: ${updatedCount} items updated`);
        return {
            success: true,
            updatedCount,
            totalItems: this.processedData.length
        };
    }

    /**
     * Apply regex rules to extract BDSA fields from filenames
     * @param {Object} regexRules - Object containing regex patterns for each field
     * @returns {Object} - Result with success status and extracted count
     */
    applyRegexRules(regexRules, markAsModified = true) {
        if (!this.processedData || this.processedData.length === 0) {
            return { success: false, error: 'No data available' };
        }

        if (!regexRules) {
            return { success: false, error: 'No regex rules provided' };
        }

        let extractedCount = 0;
        const updatedItems = [];

        this.processedData.forEach((item, index) => {
            let itemUpdated = false;
            const updatedItem = { ...item };
            const fileName = item.name || item.dsa_name || '';

            // Ensure BDSA object exists
            if (!updatedItem.BDSA) {
                updatedItem.BDSA = {
                    bdsaLocal: {},
                    _dataSource: {},
                    _lastModified: new Date().toISOString()
                };
            }

            // Skip regex processing entirely if this item has server metadata
            if (updatedItem._hasServerMetadata) {
                console.log(`⏭️ Skipping regex processing for item ${updatedItem.id} - has server metadata`);
                return; // Skip this item entirely
            }

            // Apply regex rules for each field
            Object.entries(regexRules).forEach(([field, rule]) => {
                if (rule && rule.pattern && rule.pattern.trim() !== '') {
                    // Only apply regex if field is not already populated
                    const currentValue = updatedItem.BDSA.bdsaLocal?.[field];
                    const currentSource = updatedItem.BDSA._dataSource?.[field];

                    // Don't apply regex if:
                    // 1. Field already has a value from any source other than regex
                    // 2. Field has a value from regex but we're not re-applying regex
                    if (!currentValue || (currentSource === 'regex' && markAsModified)) {
                        try {
                            const regex = new RegExp(rule.pattern);
                            const match = fileName.match(regex);

                            if (match) {
                                const extractedValue = match[1] || match[0];

                                // Initialize nested structure if needed
                                if (!updatedItem.BDSA.bdsaLocal) {
                                    updatedItem.BDSA.bdsaLocal = {};
                                }
                                if (!updatedItem.BDSA._dataSource) {
                                    updatedItem.BDSA._dataSource = {};
                                }

                                updatedItem.BDSA.bdsaLocal[field] = extractedValue;
                                updatedItem.BDSA._dataSource[field] = 'regex';
                                updatedItem.BDSA._lastModified = new Date().toISOString();
                                itemUpdated = true;
                            }
                        } catch (error) {
                            console.error(`Regex error for field ${field}:`, error);
                        }
                    }
                }
            });

            if (itemUpdated) {
                updatedItems.push(updatedItem);
                // Only mark as modified if this is user-initiated processing, not initial data loading
                if (markAsModified) {
                    this.modifiedItems.add(updatedItem.id);
                    console.log(`🔍 Added item ${updatedItem.id} to modifiedItems via regex. Total modified: ${this.modifiedItems.size}`);
                }
                extractedCount++;
            }
        });

        // Update the processed data
        this.processedData = this.processedData.map(item => {
            const updated = updatedItems.find(u => u.id === item.id);
            return updated || item;
        });

        // Skip saveToStorage() for large datasets to avoid quota errors
        // this.saveToStorage();
        this.notify();

        console.log(`🔍 Applied regex rules: ${extractedCount} items updated`);
        return {
            success: true,
            extractedCount,
            totalItems: this.processedData.length
        };
    }

    /**
     * Get items that have been modified since last sync
     * @returns {Array} - Array of modified items
     */
    getModifiedItems() {
        // Use a Map to deduplicate by item.id (in case of duplicates in processedData)
        const itemsMap = new Map();

        this.processedData.forEach(item => {
            if (this.modifiedItems.has(item.id)) {
                // Only add if not already in map (prevents duplicates)
                if (!itemsMap.has(item.id)) {
                    itemsMap.set(item.id, item);
                }
            }
        });

        const modifiedItems = Array.from(itemsMap.values());
        console.log(`📊 Found ${modifiedItems.length} unique modified items out of ${this.processedData.length} total items`);
        console.log(`📊 modifiedItems Set size: ${this.modifiedItems.size}`);

        // If there's a mismatch, log a warning
        if (modifiedItems.length !== this.modifiedItems.size) {
            console.warn(`⚠️ Mismatch: ${modifiedItems.length} items found but ${this.modifiedItems.size} IDs in Set`);
            console.warn(`⚠️ This might indicate duplicate items or orphaned IDs in modifiedItems Set`);
        }

        return modifiedItems;
    }

    /**
     * Clear the modified items tracking (after successful sync)
     */
    clearModifiedItems() {
        console.log(`🧹 Clearing ${this.modifiedItems.size} modified items`);
        console.trace('🧹 clearModifiedItems called from:');
        console.log(`🧹 Clearing modifiedItems (${this.modifiedItems.size} items) from:`, new Error().stack);
        this.modifiedItems.clear();
        // Skip saveToStorage() for large datasets to avoid quota errors
        // this.saveToStorage();
        this.notify();
    }

    /**
     * Clean up orphaned IDs from modifiedItems Set
     * (IDs that don't correspond to any items in processedData)
     */
    cleanupModifiedItems() {
        const validIds = new Set(this.processedData.map(item => item.id));
        const orphanedIds = [];

        this.modifiedItems.forEach(id => {
            if (!validIds.has(id)) {
                orphanedIds.push(id);
            }
        });

        if (orphanedIds.length > 0) {
            console.warn(`🧹 Found ${orphanedIds.length} orphaned IDs in modifiedItems Set`);
            orphanedIds.forEach(id => {
                this.modifiedItems.delete(id);
                console.log(`🧹 Removed orphaned ID: ${id}`);
            });
            console.log(`✅ Cleaned up modifiedItems Set: ${orphanedIds.length} orphaned IDs removed`);
            this.notify();
        }
    }

    /**
     * Get the actual count of modified items (ensures accuracy)
     * This method validates that all IDs in modifiedItems actually exist in processedData
     * @returns {number} - Actual count of modified items
     */
    getModifiedItemsCount() {
        // Clean up any orphaned IDs first
        this.cleanupModifiedItems();

        // Return the size of the Set (should be accurate after cleanup)
        return this.modifiedItems.size;
    }

    // DSA Sync Methods
    async syncBdsaMetadataToServer(progressCallback = null) {
        if (this.dataSource !== 'dsa') {
            throw new Error('DSA sync is only available when using DSA data source');
        }

        // Import dsaAuthStore to check authentication
        const { default: dsaAuthStore } = await import('./dsaAuthStore');
        const authStatus = dsaAuthStore.getStatus();

        if (!authStatus.isAuthenticated || !authStatus.isConfigured) {
            throw new Error('DSA authentication or configuration missing');
        }

        if (this.syncInProgress) {
            throw new Error('Sync already in progress');
        }

        try {
            // Set sync in progress
            this.syncInProgress = true;
            this.syncStatus = 'syncing';
            this.syncProgress = { processed: 0, total: this.processedData.length };

            this.notifySync('SYNC_STATUS_CHANGED', {
                syncStatus: this.syncStatus
            });

            // Import sync utilities
            const { syncAllBdsaMetadata } = await import('./dsaIntegration.js');

            // Get authentication info from dsaAuthStore
            const config = dsaAuthStore.config;
            const token = dsaAuthStore.token;

            // Create processor reference for cancellation
            const processorRef = { current: null };

            // Only sync modified items, not all items
            const itemsToSync = this.getModifiedItems();
            console.log(`🔄 Syncing ${itemsToSync.length} modified items out of ${this.processedData.length} total items`);

            if (itemsToSync.length === 0) {
                console.log('✅ No modified items to sync - sync complete');
                this.syncStatus = 'synced';
                this.notifySync('SYNC_COMPLETED', {
                    completed: true,
                    totalItems: 0,
                    processed: 0,
                    success: 0,
                    errors: 0,
                    skipped: 0,
                    results: []
                });
                return {
                    completed: true,
                    totalItems: 0,
                    processed: 0,
                    success: 0,
                    errors: 0,
                    skipped: 0,
                    results: []
                };
            }

            // Start sync process
            const syncPromise = syncAllBdsaMetadata(
                config.baseUrl,
                itemsToSync,
                token,
                this.columnMappings,
                (progress) => {
                    this.syncProgress = progress;
                    if (progressCallback) {
                        progressCallback(progress);
                    }
                    // Notify only sync listeners
                    this.notifySync('SYNC_PROGRESS_UPDATED', progress);
                },
                processorRef
            );

            // Store processor reference for cancellation (available immediately after syncAllBdsaMetadata call)
            this.batchProcessor = processorRef.current;

            // Wait for sync to complete
            const results = await syncPromise;

            // Store results
            this.lastSyncResults = results;
            this.syncStatus = results.completed ? 'synced' : 'error';

            // Clear modified items for successfully synced items
            if (results.completed && results.results) {
                let clearedCount = 0;
                console.log(`🧹 Before clearing - modifiedItems size: ${this.modifiedItems.size}`);
                console.log(`🧹 Modified items before sync:`, Array.from(this.modifiedItems));

                results.results.forEach(result => {
                    console.log(`🧹 Sync result:`, { success: result.success, itemId: result.itemId });
                    if (result.success && result.itemId) {
                        const wasInSet = this.modifiedItems.has(result.itemId);
                        this.modifiedItems.delete(result.itemId);
                        if (wasInSet) {
                            clearedCount++;
                            console.log(`✅ Cleared item ${result.itemId} from modifiedItems`);
                        } else {
                            console.log(`⚠️ Item ${result.itemId} was not in modifiedItems set`);
                        }
                    }
                });
                console.log(`🧹 After clearing - modifiedItems size: ${this.modifiedItems.size}`);
                console.log(`🧹 Cleared ${clearedCount} items from modified items set after successful sync`);

                // Notify UI to update the counter
                this.notify();

                // Save the updated state
                // Skip saveToStorage() for large datasets to avoid quota errors
                // this.saveToStorage();
            }

            console.log('DSA metadata sync completed:', results);

            // Clear processor reference after completion
            this.batchProcessor = null;

            // Notify only sync listeners about completion
            this.notifySync('SYNC_COMPLETED', results);

            return results;

        } catch (error) {
            console.error('DSA metadata sync failed:', error);
            this.syncStatus = 'error';
            this.lastSyncResults = {
                completed: false,
                error: error.message,
                totalItems: this.processedData.length,
                success: 0,
                errors: 1,
                skipped: 0
            };

            // Clear processor reference on error
            this.batchProcessor = null;

            this.notifySync('SYNC_ERROR', {
                error: error.message
            });

            throw error;
        } finally {
            this.syncInProgress = false;
            this.batchProcessor = null;
        }
    }

    cancelDsaMetadataSync() {
        console.log('🚫 Cancel sync requested - checking for active processor...');
        if (this.batchProcessor) {
            console.log('🚫 Found active batch processor - cancelling DSA metadata sync...');
            this.batchProcessor.cancel();
            this.syncStatus = 'offline';
            this.syncInProgress = false;
            this.batchProcessor = null;

            this.notifySync('SYNC_CANCELLED', {
                dataStore: this.getSnapshot()
            });

            console.log('✅ DSA metadata sync cancelled successfully');
        } else {
            console.log('⚠️ No active batch processor found - sync may have already completed or not started');
        }
    }

    getSyncStatus() {
        return {
            inProgress: this.syncInProgress,
            status: this.syncStatus,
            progress: this.syncProgress,
            lastResults: this.lastSyncResults
        };
    }

    setColumnMappings(mappings) {
        this.columnMappings = { ...this.columnMappings, ...mappings };
        // Skip saveToStorage() for large datasets to avoid quota errors
        // this.saveToStorage();
        this.notify();
    }

    /**
     * Update case ID mappings and apply them to the actual data items
     * @param {Object|Map} mappings - Object or Map containing local case ID to BDSA case ID mappings
     */
    updateCaseIdMappings(mappings) {
        if (mappings instanceof Map) {
            this.caseIdMappings = new Map(mappings);
        } else if (typeof mappings === 'object') {
            this.caseIdMappings = new Map(Object.entries(mappings));
        } else {
            throw new Error('Invalid mappings format. Expected Object or Map.');
        }

        // Apply the mappings to the actual data items
        this.applyCaseIdMappingsToData();

        // Skip saveToStorage() for large datasets to avoid quota errors
        // this.saveToStorage();

        // Notify UI of changes so the table updates
        this.notify();
    }

    /**
     * Clear all case ID mappings (used when switching to a new collection)
     * Only clears the bdsaCaseId field, preserves localCaseId, localStainID, localRegionId
     */
    clearCaseIdMappings() {
        console.log('🧹 Clearing all case ID mappings');
        this.caseIdMappings.clear();

        // Only clear BDSA Case IDs from data items, preserve localCaseId/localStainID/localRegionId
        if (this.processedData && this.processedData.length > 0) {
            this.processedData.forEach(item => {
                if (item.BDSA?.bdsaLocal) {
                    // Only clear the bdsaCaseId, keep localCaseId/localStainID/localRegionId intact
                    item.BDSA.bdsaLocal.bdsaCaseId = '';
                }
            });
            console.log(`🧹 Cleared BDSA Case IDs from ${this.processedData.length} data items (preserved local IDs)`);
        }

        this.notify();
    }

    /**
     * Set a case ID directly in the data items (single source of truth approach)
     * @param {string} localCaseId - The local case ID to update
     * @param {string|null} bdsaCaseId - The BDSA case ID to set, or null to clear
     */
    setCaseIdInData(localCaseId, bdsaCaseId) {
        if (!this.processedData || this.processedData.length === 0) {
            return;
        }

        console.log(`🔍 setCaseIdInData called: localCaseId="${localCaseId}", bdsaCaseId="${bdsaCaseId}"`);
        let updatedCount = 0;
        this.processedData.forEach((item) => {
            if (item.BDSA?.bdsaLocal?.localCaseId === localCaseId) {
                console.log(`🔧 Found matching item: localCaseId="${item.BDSA?.bdsaLocal?.localCaseId}", current bdsaCaseId="${item.BDSA?.bdsaLocal?.bdsaCaseId}"`);
                if (!item.BDSA) {
                    item.BDSA = {};
                }
                if (!item.BDSA.bdsaLocal) {
                    item.BDSA.bdsaLocal = {};
                }

                item.BDSA.bdsaLocal.bdsaCaseId = bdsaCaseId;
                item.BDSA._lastModified = new Date().toISOString();

                // Mark the data source for UI highlighting
                if (!item.BDSA._dataSource) {
                    item.BDSA._dataSource = {};
                }

                if (bdsaCaseId) {
                    item.BDSA._dataSource.bdsaCaseId = 'case_id_mapping';
                } else {
                    delete item.BDSA._dataSource.bdsaCaseId;
                }

                // Note: modifiedItems.add() is now handled automatically by the BDSA tracking proxy
                updatedCount++;
            }
        });

        if (updatedCount > 0) {
            const action = bdsaCaseId ? `Set` : `Cleared`;
            const value = bdsaCaseId ? `${localCaseId} -> ${bdsaCaseId}` : localCaseId;
            console.log(`${action} case ID ${value} for ${updatedCount} items`);
            console.log(`🔍 Added ${updatedCount} items to modifiedItems. Total modified: ${this.modifiedItems.size}`);

            // Update the caseIdMappings Map to keep it in sync
            if (bdsaCaseId) {
                this.caseIdMappings.set(localCaseId, bdsaCaseId);
                console.log(`✅ Updated caseIdMappings: ${localCaseId} -> ${bdsaCaseId}`);
            } else {
                this.caseIdMappings.delete(localCaseId);
                console.log(`🗑️ Removed ${localCaseId} from caseIdMappings`);
            }

            // Re-initialize case ID mappings to update the UI with new mappings
            this.initializeCaseIdMappingsFromData();

            // Notify UI of changes (proxy is disabled, so we need to call this explicitly)
            this.notify();

            // Skip saveToStorage() for large datasets to avoid quota errors
            // Data will be persisted via export/sync instead
            // this.saveToStorage();
        }
    }

    /**
     * Apply case ID mappings to the actual data items
     * This updates the BDSA.bdsaLocal.bdsaCaseId field in the data items
     */
    applyCaseIdMappingsToData() {
        if (!this.processedData || this.processedData.length === 0) {
            console.log('🔧 applyCaseIdMappingsToData: No processed data');
            return;
        }

        console.log(`🔧 applyCaseIdMappingsToData: Processing ${this.processedData.length} items with ${this.caseIdMappings.size} mappings`);
        if (this.caseIdMappings.size > 0) {
            console.log('🔧 Current mappings:', Array.from(this.caseIdMappings.entries()));
        }
        let updatedCount = 0;

        this.processedData.forEach((item) => {
            const currentLocalCaseId = item.BDSA?.bdsaLocal?.localCaseId;
            if (currentLocalCaseId && this.caseIdMappings.has(currentLocalCaseId)) {
                const bdsaCaseId = this.caseIdMappings.get(currentLocalCaseId);

                // Only update if the value has changed
                if (item.BDSA?.bdsaLocal?.bdsaCaseId !== bdsaCaseId) {
                    if (!item.BDSA) {
                        item.BDSA = {};
                    }
                    if (!item.BDSA.bdsaLocal) {
                        item.BDSA.bdsaLocal = {};
                    }

                    item.BDSA.bdsaLocal.bdsaCaseId = bdsaCaseId;
                    item.BDSA._lastModified = new Date().toISOString();

                    // Mark the data source for UI highlighting
                    if (!item.BDSA._dataSource) {
                        item.BDSA._dataSource = {};
                    }
                    item.BDSA._dataSource.bdsaCaseId = 'case_id_mapping';

                    // Note: modifiedItems.add() is now handled automatically by the BDSA tracking proxy
                    updatedCount++;
                }
            }
        });

        if (updatedCount > 0) {
            console.log(`Applied case ID mappings to ${updatedCount} data items`);
            console.log(`🔍 Added ${updatedCount} items to modifiedItems via case ID mappings. Total modified: ${this.modifiedItems.size}`);

            // Note: notify() is now handled automatically by the BDSA tracking proxy
        }
    }

    /**
     * Initialize case ID mappings from existing data
     * This reads existing BDSA.bdsaLocal.bdsaCaseId values and populates the mappings
     * Handles conflicts where the same localCaseId has different bdsaCaseId values
     */
    initializeCaseIdMappingsFromData() {
        console.log('🔍 initializeCaseIdMappingsFromData called with', this.processedData?.length, 'items');
        if (!this.processedData || this.processedData.length === 0) {
            console.log('🔍 No processed data available for conflict detection');
            return;
        }

        const mappings = new Map();
        const conflicts = new Map();
        const bdsaConflicts = new Map();

        // First pass: collect all mappings and detect localCaseId conflicts
        this.processedData.forEach((item) => {
            const localCaseId = item.BDSA?.bdsaLocal?.localCaseId;
            const bdsaCaseId = item.BDSA?.bdsaLocal?.bdsaCaseId;

            if (localCaseId && bdsaCaseId) {
                // Check for conflicts - same localCaseId but different bdsaCaseId
                if (mappings.has(localCaseId) && mappings.get(localCaseId) !== bdsaCaseId) {
                    // Record the conflict
                    if (!conflicts.has(localCaseId)) {
                        conflicts.set(localCaseId, new Set([mappings.get(localCaseId)]));
                    }
                    conflicts.get(localCaseId).add(bdsaCaseId);
                    console.warn(`⚠️ Local Case ID Conflict: localCaseId "${localCaseId}" has multiple BDSA Case IDs:`, Array.from(conflicts.get(localCaseId)));
                } else {
                    mappings.set(localCaseId, bdsaCaseId);
                }
            }
        });

        // Second pass: detect bdsaCaseId conflicts (same BDSA Case ID mapped to multiple local case IDs)
        const bdsaToLocalMap = new Map();
        this.processedData.forEach((item) => {
            const localCaseId = item.BDSA?.bdsaLocal?.localCaseId;
            const bdsaCaseId = item.BDSA?.bdsaLocal?.bdsaCaseId;

            if (localCaseId && bdsaCaseId) {
                if (bdsaToLocalMap.has(bdsaCaseId)) {
                    const existingLocalIds = bdsaToLocalMap.get(bdsaCaseId);
                    if (!existingLocalIds.has(localCaseId)) {
                        existingLocalIds.add(localCaseId);
                        if (existingLocalIds.size === 2) {
                            // First time we detect this conflict
                            bdsaConflicts.set(bdsaCaseId, new Set(existingLocalIds));
                            console.warn(`⚠️ BDSA Case ID Conflict: bdsaCaseId "${bdsaCaseId}" is mapped to multiple local case IDs:`, Array.from(existingLocalIds));
                        } else {
                            // Update existing conflict
                            bdsaConflicts.get(bdsaCaseId).add(localCaseId);
                            console.warn(`⚠️ BDSA Case ID Conflict: bdsaCaseId "${bdsaCaseId}" is mapped to multiple local case IDs:`, Array.from(bdsaConflicts.get(bdsaCaseId)));
                        }
                    }
                } else {
                    bdsaToLocalMap.set(bdsaCaseId, new Set([localCaseId]));
                }
            }
        });

        this.caseIdMappings = mappings;
        this.caseIdConflicts = conflicts;
        this.bdsaCaseIdConflicts = bdsaConflicts;

        console.log(`Initialized case ID mappings from data: ${mappings.size} mappings found`);
        if (conflicts.size > 0) {
            console.warn(`⚠️ Found ${conflicts.size} local case ID conflicts that need resolution`);
            console.log('🔍 Local conflicts:', conflicts);
        }
        if (bdsaConflicts.size > 0) {
            console.warn(`⚠️ Found ${bdsaConflicts.size} BDSA case ID conflicts that need resolution`);
            console.log('🔍 BDSA conflicts:', bdsaConflicts);
        } else {
            console.log('🔍 No BDSA conflicts detected');
        }
    }

    /**
     * Get all case ID conflicts
     * @returns {Object} Object mapping localCaseId to array of conflicting BDSA Case IDs
     */
    getCaseIdConflicts() {
        const conflicts = {};
        for (const [localCaseId, bdsaCaseIdSet] of this.caseIdConflicts) {
            conflicts[localCaseId] = Array.from(bdsaCaseIdSet);
        }
        return conflicts;
    }

    /**
     * Resolve a case ID conflict by choosing one BDSA Case ID and applying it to all items
     * @param {string} localCaseId - The local case ID with the conflict
     * @param {string} chosenBdsaCaseId - The BDSA Case ID to use for resolution
     */
    resolveCaseIdConflict(localCaseId, chosenBdsaCaseId) {
        if (!this.caseIdConflicts.has(localCaseId)) {
            console.warn(`No conflict found for localCaseId: ${localCaseId}`);
            return;
        }

        // Update all items with this localCaseId to use the chosen BDSA Case ID
        let updatedCount = 0;
        this.processedData.forEach((item) => {
            if (item.BDSA?.bdsaLocal?.localCaseId === localCaseId) {
                if (!item.BDSA) {
                    item.BDSA = {};
                }
                if (!item.BDSA.bdsaLocal) {
                    item.BDSA.bdsaLocal = {};
                }

                item.BDSA.bdsaLocal.bdsaCaseId = chosenBdsaCaseId;
                item.BDSA._lastModified = new Date().toISOString();
                updatedCount++;
            }
        });

        // Update the mappings
        this.caseIdMappings.set(localCaseId, chosenBdsaCaseId);

        // Remove the conflict
        this.caseIdConflicts.delete(localCaseId);

        // Skip saveToStorage() for large datasets to avoid quota errors
        // this.saveToStorage();
        console.log(`Resolved conflict for localCaseId "${localCaseId}": updated ${updatedCount} items to use BDSA Case ID "${chosenBdsaCaseId}"`);
    }

    /**
     * Clear all conflicting BDSA Case IDs for a specific local case ID
     * This removes the bdsaCaseId from all items with that localCaseId
     * @param {string} localCaseId - The local case ID to clear
     */
    clearCaseIdConflict(localCaseId) {
        if (!this.caseIdConflicts.has(localCaseId)) {
            console.warn(`No conflict found for localCaseId: ${localCaseId}`);
            return;
        }

        // Clear BDSA Case ID from all items with this localCaseId
        let updatedCount = 0;
        this.processedData.forEach((item) => {
            if (item.BDSA?.bdsaLocal?.localCaseId === localCaseId) {
                if (item.BDSA?.bdsaLocal?.bdsaCaseId) {
                    delete item.BDSA.bdsaLocal.bdsaCaseId;
                    item.BDSA._lastModified = new Date().toISOString();
                    updatedCount++;
                }
            }
        });

        // Remove from mappings
        this.caseIdMappings.delete(localCaseId);

        // Remove the conflict
        this.caseIdConflicts.delete(localCaseId);

        // Skip saveToStorage() for large datasets to avoid quota errors
        // this.saveToStorage();
        console.log(`Cleared conflict for localCaseId "${localCaseId}": removed BDSA Case ID from ${updatedCount} items`);
    }

    /**
     * Get all BDSA case ID conflicts
     * @returns {Object} Object mapping bdsaCaseId to array of conflicting local case IDs
     */
    getBdsaCaseIdConflicts() {
        const conflicts = {};
        for (const [bdsaCaseId, localCaseIdSet] of this.bdsaCaseIdConflicts) {
            conflicts[bdsaCaseId] = Array.from(localCaseIdSet);
        }
        return conflicts;
    }

    /**
     * Resolve a BDSA case ID conflict by choosing one local case ID and removing the BDSA Case ID from others
     * @param {string} bdsaCaseId - The BDSA Case ID with the conflict
     * @param {string} chosenLocalCaseId - The local case ID to keep the BDSA Case ID
     */
    resolveBdsaCaseIdConflict(bdsaCaseId, chosenLocalCaseId) {
        if (!this.bdsaCaseIdConflicts.has(bdsaCaseId)) {
            console.warn(`No BDSA Case ID conflict found for: ${bdsaCaseId}`);
            return;
        }

        const conflictingLocalIds = this.bdsaCaseIdConflicts.get(bdsaCaseId);
        if (!conflictingLocalIds.has(chosenLocalCaseId)) {
            console.warn(`Chosen local case ID "${chosenLocalCaseId}" is not part of the conflict for BDSA Case ID "${bdsaCaseId}"`);
            return;
        }

        // Remove BDSA Case ID from all conflicting local case IDs except the chosen one
        let updatedCount = 0;
        this.processedData.forEach((item) => {
            const localCaseId = item.BDSA?.bdsaLocal?.localCaseId;
            const itemBdsaCaseId = item.BDSA?.bdsaLocal?.bdsaCaseId;

            if (localCaseId && itemBdsaCaseId === bdsaCaseId && localCaseId !== chosenLocalCaseId) {
                if (item.BDSA?.bdsaLocal?.bdsaCaseId) {
                    delete item.BDSA.bdsaLocal.bdsaCaseId;
                    item.BDSA._lastModified = new Date().toISOString();
                    updatedCount++;
                }
            }
        });

        // Update mappings - remove from all except chosen one
        for (const localCaseId of conflictingLocalIds) {
            if (localCaseId !== chosenLocalCaseId) {
                this.caseIdMappings.delete(localCaseId);
            }
        }

        // Mark the conflict as resolved instead of deleting it
        // This allows the UI to show it as resolved rather than disappearing
        this.bdsaCaseIdConflicts.set(bdsaCaseId, new Set([chosenLocalCaseId, 'RESOLVED']));

        // Skip saveToStorage() for large datasets to avoid quota errors
        // this.saveToStorage();
        // Don't immediately notify to allow user to track fixes
        // this.notify();
        console.log(`Resolved BDSA Case ID conflict for "${bdsaCaseId}": kept mapping for "${chosenLocalCaseId}", removed from ${updatedCount} other items`);
    }

    /**
     * Clear all BDSA Case ID conflicts by removing the BDSA Case ID from all conflicting items
     * @param {string} bdsaCaseId - The BDSA Case ID to clear from all conflicting items
     */
    clearBdsaCaseIdConflict(bdsaCaseId) {
        if (!this.bdsaCaseIdConflicts.has(bdsaCaseId)) {
            console.warn(`No BDSA Case ID conflict found for: ${bdsaCaseId}`);
            return;
        }

        const conflictingLocalIds = this.bdsaCaseIdConflicts.get(bdsaCaseId);

        // Remove BDSA Case ID from all conflicting items
        let updatedCount = 0;
        this.processedData.forEach((item) => {
            const localCaseId = item.BDSA?.bdsaLocal?.localCaseId;
            const itemBdsaCaseId = item.BDSA?.bdsaLocal?.bdsaCaseId;

            if (localCaseId && itemBdsaCaseId === bdsaCaseId && conflictingLocalIds.has(localCaseId)) {
                if (item.BDSA?.bdsaLocal?.bdsaCaseId) {
                    delete item.BDSA.bdsaLocal.bdsaCaseId;
                    item.BDSA._lastModified = new Date().toISOString();
                    updatedCount++;
                }
            }
        });

        // Remove from mappings
        for (const localCaseId of conflictingLocalIds) {
            this.caseIdMappings.delete(localCaseId);
        }

        // Mark the conflict as cleared instead of deleting it
        // This allows the UI to show it as resolved rather than disappearing
        this.bdsaCaseIdConflicts.set(bdsaCaseId, new Set(['CLEARED']));

        // Skip saveToStorage() for large datasets to avoid quota errors
        // this.saveToStorage();
        // Don't immediately notify to allow user to track fixes
        // this.notify();
        console.log(`Cleared BDSA Case ID conflict for "${bdsaCaseId}": removed BDSA Case ID from ${updatedCount} items`);
    }

    /**
     * Initialize BDSA structure for all data items
     * This ensures all items have the BDSA.bdsaLocal structure with placeholder fields
     * so that columns are generated properly
     * @param {Array} data - The data to initialize
     * @returns {Array} Data with initialized BDSA structure
     */
    initializeBdsaStructure(data) {
        if (!data || !Array.isArray(data)) {
            return data;
        }

        // console.log('🔧 DEBUG - initializeBdsaStructure called, checking first item:', {
        //     hasBDSA: !!data[0]?.BDSA,
        //     hasBdsaLocal: !!data[0]?.BDSA?.bdsaLocal,
        //     bdsaLocalValues: data[0]?.BDSA?.bdsaLocal
        // });

        return data.map(item => {
            // Initialize BDSA structure if it doesn't exist
            if (!item.BDSA) {
                item.BDSA = {
                    bdsaLocal: {
                        localCaseId: null,
                        localStainID: null,
                        localRegionId: null,
                        bdsaCaseId: null,  // Initialize this field so the column appears
                        bdsaStainProtocol: null,  // Initialize BDSA Region Protocol field (can be array)
                        bdsaRegionProtocol: null  // Initialize BDSA Protocol field (can be array)
                    },
                    _dataSource: {}
                    // Don't set _lastModified here - only set it when actually modifying data
                };
            } else {
                // Ensure bdsaLocal structure exists
                if (!item.BDSA.bdsaLocal) {
                    item.BDSA.bdsaLocal = {
                        localCaseId: null,
                        localStainID: null,
                        localRegionId: null,
                        bdsaCaseId: null,
                        bdsaStainProtocol: null,  // Initialize BDSA Region Protocol field (can be array)
                        bdsaRegionProtocol: null  // Initialize BDSA Protocol field (can be array)
                    };
                } else {
                    // Ensure bdsaCaseId field exists - but preserve existing value if it exists
                    if (!item.BDSA.bdsaLocal.hasOwnProperty('bdsaCaseId')) {
                        item.BDSA.bdsaLocal.bdsaCaseId = null;
                    }
                    // Ensure bdsaStainProtocol field exists - but preserve existing value if it exists
                    if (!item.BDSA.bdsaLocal.hasOwnProperty('bdsaStainProtocol')) {
                        item.BDSA.bdsaLocal.bdsaStainProtocol = null;
                    }
                    // Ensure bdsaRegionProtocol field exists - but preserve existing value if it exists
                    if (!item.BDSA.bdsaLocal.hasOwnProperty('bdsaRegionProtocol')) {
                        item.BDSA.bdsaLocal.bdsaRegionProtocol = null;
                    }
                    // Preserve existing values - don't overwrite them with null
                    // The existing values should already be set by transformDsaData
                }

                // Ensure _dataSource exists
                if (!item.BDSA._dataSource) {
                    item.BDSA._dataSource = {};
                }
            }

            return item;
        });
    }

    /**
     * Set processed data and ensure BDSA structure is initialized
     * This method should be used whenever data is loaded from any source
     * @param {Array} data - The data to set
     * @param {string} source - The data source ('csv', 'dsa', etc.)
     * @param {Object} sourceInfo - Additional information about the data source
     */
    setProcessedData(data, source = null, sourceInfo = null) {
        console.log('📊 Setting processed data with BDSA structure initialization');
        console.log('🚨 WARNING: setProcessedData called - this will clear modifiedItems!');

        // Initialize BDSA structure and wrap each item in a tracking proxy
        const initializedData = this.initializeBdsaStructure(data);
        // Temporarily disable proxy to avoid issues with Generate button
        this.processedData = initializedData;
        // this.processedData = initializedData.map(item => this.createBdsaTrackingProxy(item));

        if (source) {
            this.dataSource = source;
        }
        if (sourceInfo) {
            this.dataSourceInfo = sourceInfo;
        }

        this.dataLoadTimestamp = new Date().toISOString();
        console.log(`🧹 Clearing modifiedItems (${this.modifiedItems.size} items) from:`, new Error().stack);
        this.modifiedItems.clear();

        // Clear case ID mappings when loading new data (they're specific to the previous dataset)
        this.caseIdMappings.clear();
        this.caseIdConflicts.clear();
        this.bdsaCaseIdConflicts.clear();

        // Clear sync results when loading new data (they're specific to the previous dataset)
        this.lastSyncResults = null;

        // Skip saveToStorage() for large datasets to avoid quota errors
        // this.saveToStorage();
        this.notify();

        console.log('✅ Processed data set with BDSA structure:', {
            itemCount: this.processedData.length,
            hasBdsaStructure: this.processedData.every(item => item.BDSA?.bdsaLocal?.hasOwnProperty('bdsaCaseId'))
        });
    }


    // DSA Sync Methods
    async syncBdsaMetadataToServer(progressCallback) {
        if (this.syncInProgress) {
            throw new Error('Sync already in progress');
        }

        console.log('🚀 Starting sync - setting syncInProgress to true');
        this.syncInProgress = true;
        this.syncCancelled = false; // Reset cancellation flag
        this.syncStatus = 'syncing';
        this.syncProgress = {
            current: 0,
            total: this.processedData.length,
            percentage: 0,
            success: 0,
            errors: 0,
            skipped: 0
        };
        this.notifySyncListeners('syncStatusChanged');
        console.log('📡 Notified listeners of sync status change');

        try {
            const results = {
                success: 0,
                errors: 0,
                skipped: 0,
                details: []
            };

            for (let i = 0; i < this.processedData.length; i++) {
                // Check for cancellation before processing each item
                if (this.syncCancelled) {
                    console.log('🛑 Sync cancelled by user, stopping at item', i);
                    break;
                }

                const item = this.processedData[i];

                try {
                    // Check if item has BDSA metadata to sync AND has been modified
                    if (item.BDSA?.bdsaLocal && this.shouldSyncItem(item)) {
                        // Here you would implement the actual DSA API call
                        // For now, we'll just simulate the sync
                        await this.syncItemToServer(item);
                        results.success++;
                    } else {
                        results.skipped++;
                    }
                } catch (error) {
                    console.error(`Failed to sync item ${i}:`, error);
                    results.errors++;
                    results.details.push({
                        itemIndex: i,
                        error: error.message
                    });
                }

                // Update progress
                this.syncProgress.current = i + 1;
                this.syncProgress.percentage = Math.round(((i + 1) / this.processedData.length) * 100);
                this.syncProgress.success = results.success;
                this.syncProgress.errors = results.errors;
                this.syncProgress.skipped = results.skipped;

                if (progressCallback) {
                    progressCallback({
                        current: i + 1,
                        total: this.processedData.length,
                        percentage: this.syncProgress.percentage,
                        success: results.success,
                        errors: results.errors,
                        skipped: results.skipped
                    });
                }
                this.notifySyncListeners('syncProgressUpdated');
            }

            // Check if sync was cancelled
            if (this.syncCancelled) {
                console.log('🚫 Sync was cancelled by user');
                this.syncStatus = 'offline';
                this.lastSyncResults = {
                    ...results,
                    cancelled: true,
                    totalItems: this.processedData.length
                };
                this.notifySyncListeners('syncCancelled');
            } else {
                console.log('✅ Sync completed successfully');
                this.syncStatus = 'synced';
                this.lastSyncResults = results;
                this.notifySyncListeners('syncCompleted');
            }

            return results;
        } catch (error) {
            console.error('❌ Sync failed:', error);
            this.syncStatus = 'error';
            this.notifySyncListeners('syncError');
            throw error;
        } finally {
            console.log('🛑 Sync finished - setting syncInProgress to false');
            this.syncInProgress = false;
            this.syncCancelled = false; // Reset cancellation flag
            this.notifySyncListeners('syncStatusChanged');
        }
    }

    shouldSyncItem(item) {
        // Only sync items that are explicitly marked as modified
        return this.modifiedItems.has(item.id);
    }

    getItemsToSyncCount() {
        // Simple: only count items that are explicitly marked as modified
        return this.modifiedItems.size;
    }

    async syncItemToServer(item) {
        console.log('Syncing item to server:', item.id);

        // Get DSA configuration from auth store
        const { default: dsaAuthStore } = await import('./dsaAuthStore.js');
        const authStatus = dsaAuthStore.getStatus();

        if (!authStatus.isAuthenticated || !authStatus.serverUrl || !authStatus.hasToken) {
            throw new Error('DSA configuration or authentication token not available');
        }

        console.log('DSA auth status for sync:', {
            isAuthenticated: authStatus.isAuthenticated,
            hasConfig: !!authStatus.serverUrl,
            hasToken: authStatus.hasToken,
            baseUrl: authStatus.serverUrl
        });

        // Import the DSA sync function dynamically to avoid circular dependencies
        const { syncItemBdsaMetadata } = await import('./dsaIntegration.js');

        // Use empty column mapping since we're reading from BDSA.bdsaLocal directly
        const columnMapping = {
            localCaseId: 'BDSA.bdsaLocal.localCaseId',
            localStainID: 'BDSA.bdsaLocal.localStainID',
            localRegionId: 'BDSA.bdsaLocal.localRegionId'
        };

        const result = await syncItemBdsaMetadata(
            authStatus.serverUrl,
            item,
            dsaAuthStore.token,
            columnMapping,
            () => this.syncCancelled
        );

        if (!result.success) {
            throw new Error(result.error || 'Sync failed');
        }

        console.log('Successfully synced item to server:', item.id);
    }

    cancelDsaMetadataSync() {
        console.log('🛑 Cancel sync requested, current syncInProgress:', this.syncInProgress);
        if (this.syncInProgress) {
            this.syncCancelled = true; // Set cancellation flag
            console.log('🚫 Sync cancellation flag set - will stop on next iteration');
            // Don't set syncInProgress to false yet - let the loop handle it
            this.notifySyncListeners('syncCancelled');
        } else {
            console.log('⚠️ Cancel requested but no sync in progress');
        }
    }

    getSyncStatus() {
        return {
            inProgress: this.syncInProgress,
            status: this.syncStatus,
            progress: this.syncProgress,
            lastResults: this.lastSyncResults
        };
    }

    subscribeToSync(callback) {
        this.syncListeners.add(callback);
        return () => this.syncListeners.delete(callback);
    }

    notifySyncListeners(eventType) {
        // Update sync status before notifying listeners
        this.updateSyncStatus();

        this.syncListeners.forEach(callback => {
            try {
                callback({
                    eventType,
                    dataStore: this.getSnapshot()
                });
            } catch (error) {
                console.error('Error in sync listener:', error);
            }
        });
    }

    updateSyncStatus() {
        // Don't change status if sync is in progress
        if (this.syncInProgress) {
            return;
        }

        // Check if we can sync (have DSA data and configuration)
        const canSync = this.dataSource === 'dsa' &&
            this.processedData &&
            this.processedData.length > 0;

        if (canSync) {
            // If we have DSA data and it's not currently syncing, set to 'ready'
            if (this.syncStatus === 'offline') {
                this.syncStatus = 'ready';
            }
        } else {
            // No DSA data or configuration, set to offline
            this.syncStatus = 'offline';
        }
    }

    getSnapshot() {
        return {
            processedData: this.processedData,
            dataSource: this.dataSource,
            dataSourceInfo: this.dataSourceInfo,
            dataLoadTimestamp: this.dataLoadTimestamp,
            modifiedItems: this.modifiedItems,
            caseIdMappings: this.caseIdMappings,
            caseIdConflicts: this.caseIdConflicts,
            bdsaCaseIdConflicts: this.bdsaCaseIdConflicts,
            caseProtocolMappings: this.caseProtocolMappings,
            syncInProgress: this.syncInProgress,
            syncStatus: this.syncStatus,
            syncProgress: this.syncProgress,
            lastSyncResults: this.lastSyncResults,
            girderToken: this.girderToken,
            dsaConfig: this.dsaConfig,
            columnMappings: this.columnMappings
        };
    }

    // Generate cases with stain slides for stain protocol mapping
    generateStainProtocolCases() {
        return this.generateProtocolCases('stain');
    }

    // Generate cases with region slides for region protocol mapping  
    generateRegionProtocolCases() {
        return this.generateProtocolCases('region');
    }

    // Generate unmapped cases from current data for protocol mapping (legacy - now calls stain)
    generateUnmappedCases() {
        return this.generateStainProtocolCases();
    }

    // Internal helper to generate cases for a specific protocol type
    generateProtocolCases(protocolType) {
        if (!this.processedData.length) {
            console.log('🔍 No processed data available');
            return [];
        }

        // Debugging for protocol case generation
        console.log(`🔍 generate${protocolType.charAt(0).toUpperCase() + protocolType.slice(1)}ProtocolCases: ${this.processedData.length} rows, ${this.caseIdMappings.size} case mappings`);

        // Sample first few rows to see what data looks like
        const sampleRows = this.processedData.slice(0, 3).map(row => ({
            localCaseId: row.BDSA?.bdsaLocal?.localCaseId,
            localStainID: row.BDSA?.bdsaLocal?.localStainID,
            localRegionId: row.BDSA?.bdsaLocal?.localRegionId,
            hasBDSA: !!row.BDSA,
            hasBdsaLocal: !!row.BDSA?.bdsaLocal,
            name: row.name
        }));
        console.log(`🔍 Sample rows (first 3):`, sampleRows);

        // Show what case IDs are actually in the mappings
        const mappingKeys = Array.from(this.caseIdMappings.keys()).slice(0, 10);
        console.log(`🔍 Case ID mappings (first 10 keys):`, mappingKeys);

        // Check if sample row case IDs are in mappings
        const sampleCaseIds = sampleRows.map(r => r.localCaseId);
        const mappingChecks = sampleCaseIds.map(id => ({
            localCaseId: id,
            hasMapping: this.caseIdMappings.has(id),
            mappedTo: this.caseIdMappings.get(id)
        }));
        console.log(`🔍 Sample case ID mapping checks:`, mappingChecks);

        // Use default column mappings for BDSA data if not set
        const columnMapping = this.columnMappings.localStainID ? this.columnMappings : {
            localCaseId: 'BDSA.bdsaLocal.localCaseId',
            localStainID: 'BDSA.bdsaLocal.localStainID',
            localRegionId: 'BDSA.bdsaLocal.localRegionId'
        };

        // Removed verbose column mapping logging

        // Build case ID mappings directly from the data (single source of truth)
        // This matches how the Case ID Mapping tab reads the data
        const caseIdMappings = new Map();
        this.processedData.forEach((item) => {
            const localCaseId = item.BDSA?.bdsaLocal?.localCaseId;
            const bdsaCaseId = item.BDSA?.bdsaLocal?.bdsaCaseId;
            if (localCaseId && bdsaCaseId) {
                caseIdMappings.set(localCaseId, bdsaCaseId);
            }
        });

        console.log(`🔍 Built case ID mappings from data: ${caseIdMappings.size} mappings found`);

        // Check if case ID mappings are empty
        if (caseIdMappings.size === 0) {
            console.log('🚨 WARNING: No case ID mappings found! This will cause no cases to be generated.');
            console.log('💡 Make sure to set up case ID mappings first in the Case ID Mapping tab.');
            return [];
        }

        const caseGroups = {};
        const slideIdsSeen = new Set(); // Track slide IDs to prevent duplicates

        this.processedData.forEach((row, index) => {
            // Access the BDSA data correctly from the nested structure
            const localCaseId = row.BDSA?.bdsaLocal?.localCaseId;
            const localStainId = row.BDSA?.bdsaLocal?.localStainID;
            const localRegionId = row.BDSA?.bdsaLocal?.localRegionId;
            const filename = row['name'] || row['dsa_name'];

            const finalFilename = filename || `${localCaseId}_${localStainId || localRegionId}.svs`;

            // Use the actual _id or dsa_id from the data for proper table reference
            const slideId = row._id || row.dsa_id || finalFilename;

            // Removed verbose row debugging

            // Filter based on protocol type - only include slides with the relevant ID type
            const hasRelevantId = protocolType === 'stain' ? localStainId : localRegionId;

            // Skip if no relevant ID for this protocol type, or no BDSA case ID mapping
            if (!hasRelevantId || !caseIdMappings.has(localCaseId)) {
                return;
            }

            const bdsaCaseId = caseIdMappings.get(localCaseId);

            if (!caseGroups[bdsaCaseId]) {
                caseGroups[bdsaCaseId] = {
                    bdsaId: bdsaCaseId,
                    localCaseId: localCaseId,
                    slides: []
                };
            }

            // Skip if we've already processed this slide ID
            if (slideIdsSeen.has(slideId)) {
                console.log(`🔍 Skipping duplicate slide: ${slideId}`);
                return;
            }
            slideIdsSeen.add(slideId);

            // Get protocol information for the specific protocol type
            const protocolFieldName = `bdsa${protocolType.charAt(0).toUpperCase() + protocolType.slice(1)}Protocol`;
            const bdsaProtocol = row.BDSA?.bdsaLocal?.[protocolFieldName];

            // Parse the protocol data - always store as arrays internally
            let protocols = [];
            if (bdsaProtocol) {
                if (Array.isArray(bdsaProtocol)) {
                    // Already an array, just filter out invalid entries
                    protocols = bdsaProtocol.filter(p => p && typeof p === 'string');
                } else if (typeof bdsaProtocol === 'string') {
                    // Convert string to array
                    protocols = bdsaProtocol.split(',').map(p => p.trim()).filter(p => p);
                }
            }

            // Also check the caseProtocolMappings for any additional mappings
            const additionalSlideProtocols = this.caseProtocolMappings.get(bdsaCaseId)?.[slideId] || { stain: [], region: [] };

            // Combine protocols from data and mappings for this protocol type
            const allProtocols = [...protocols, ...(additionalSlideProtocols[protocolType] || [])];

            // Check if slide is mapped (has protocols for this type)
            const isMapped = allProtocols.length > 0;

            // Debug logging for protocol detection
            if (index < 5) { // Show fewer rows but with more detail
                console.log(`🔍 Row ${index} ${protocolType} protocol detection:`, {
                    slideId,
                    filename: finalFilename,
                    protocolType,
                    protocolFieldName,
                    bdsaProtocol,
                    protocols,
                    allProtocols,
                    isMapped,
                    localStainId,
                    localRegionId
                });
            }

            // Create slide object with protocol-type specific data
            const slideData = {
                id: slideId, // This is now the actual _id or dsa_id for table reference
                filename: finalFilename, // This is the display name
                status: isMapped ? 'mapped' : 'unmapped',
                localStainId: localStainId,
                localRegionId: localRegionId,
                hasProtocol: isMapped
            };

            // Add protocol-type specific fields
            if (protocolType === 'stain') {
                slideData.stainType = localStainId;
                slideData.stainProtocols = allProtocols;
                slideData.hasStainProtocol = isMapped;
            } else {
                slideData.regionType = localRegionId;
                slideData.regionProtocols = allProtocols;
                slideData.hasRegionProtocol = isMapped;
            }

            caseGroups[bdsaCaseId].slides.push(slideData);
        });

        const allCases = Object.values(caseGroups);
        // Return ALL cases that have slides with the relevant protocol type
        const casesWithRelevantSlides = allCases.filter(caseData =>
            caseData.slides.some(slide =>
                protocolType === 'stain' ? slide.stainType : slide.regionType
            )
        );

        console.log(`🔍 DEBUG - ${protocolType} case generation results:`, {
            protocolType,
            totalCaseGroups: allCases.length,
            casesWithRelevantSlides: casesWithRelevantSlides.length,
            allCases: allCases.map(c => ({
                bdsaId: c.bdsaId,
                localCaseId: c.localCaseId,
                totalSlides: c.slides.length,
                relevantSlides: c.slides.filter(s =>
                    protocolType === 'stain' ? s.stainType : s.regionType
                ).length,
                mappedSlides: c.slides.filter(s => s.status === 'mapped').length,
                unmappedSlides: c.slides.filter(s => s.status === 'unmapped').length
            })),
            caseGroupsKeys: Object.keys(caseGroups)
        });

        return casesWithRelevantSlides;
    }

    // Add protocol mapping to a specific slide
    addProtocolMapping(bdsaCaseId, slideId, protocolId, protocolType, batchMode = false) {
        console.log(`🔍 addProtocolMapping called: ${bdsaCaseId}, ${slideId}, ${protocolId}, ${protocolType}`);

        // Find the data row that matches this case and slide
        const dataRow = this.processedData.find(row =>
            row.BDSA?.bdsaLocal?.bdsaCaseId === bdsaCaseId &&
            (row._id === slideId || row.dsa_id === slideId)
        );

        if (!dataRow) {
            console.log(`❌ No data row found for case ${bdsaCaseId}, slide ${slideId}`);
            return;
        }

        // Get the field name based on protocol type
        const fieldName = `bdsa${protocolType === 'stain' ? 'Stain' : 'Region'}Protocol`;
        const currentProtocols = dataRow.BDSA?.bdsaLocal?.[fieldName] || [];

        // Convert to array if it's a string
        const protocolArray = Array.isArray(currentProtocols) ? currentProtocols :
            (typeof currentProtocols === 'string' ? currentProtocols.split(',').map(p => p.trim()).filter(p => p) : []);

        console.log(`🔍 Current ${fieldName} for slide ${slideId}:`, protocolArray);

        // Add protocol if not already present
        if (!protocolArray.includes(protocolId)) {
            protocolArray.push(protocolId);
            dataRow.BDSA.bdsaLocal[fieldName] = protocolArray;

            // Mark item as modified
            dataRow.BDSA._lastModified = new Date().toISOString();
            this.modifiedItems.add(dataRow.id);

            // Only save to storage and notify if not in batch mode
            if (!batchMode) {
                // Skip saveToStorage() for large datasets to avoid quota errors
                // this.saveToStorage();
                this.notify();
            }
            console.log(`✅ Added protocol ${protocolId} to slide ${slideId}. New protocols:`, protocolArray);
        } else {
            console.log(`🔔 Protocol ${protocolId} already exists for slide ${slideId}`);
        }
    }


    // Remove protocol mapping from a specific slide
    removeProtocolMapping(bdsaCaseId, slideId, protocolId, protocolType) {
        console.log(`🔍 removeProtocolMapping called: ${bdsaCaseId}, ${slideId}, ${protocolId}, ${protocolType}`);

        // Find the data row that matches this case and slide
        const dataRow = this.processedData.find(row =>
            row.BDSA?.bdsaLocal?.bdsaCaseId === bdsaCaseId &&
            (row._id === slideId || row.dsa_id === slideId)
        );

        if (!dataRow) {
            console.log(`❌ No data row found for case ${bdsaCaseId}, slide ${slideId}`);
            return;
        }

        // Get the field name based on protocol type
        const fieldName = `bdsa${protocolType === 'stain' ? 'Stain' : 'Region'}Protocol`;
        const bdsaProtocol = dataRow.BDSA?.bdsaLocal?.[fieldName];

        // Parse the protocol data - use the same logic as generateUnmappedCases
        let protocols = [];
        if (bdsaProtocol) {
            if (Array.isArray(bdsaProtocol)) {
                protocols = bdsaProtocol.filter(p => p && typeof p === 'string');
            } else if (typeof bdsaProtocol === 'string') {
                protocols = bdsaProtocol.split(',').map(p => p.trim()).filter(p => p);
            }
        }

        // Also check the caseProtocolMappings for any additional mappings (same logic as generateUnmappedCases)
        const additionalSlideProtocols = this.caseProtocolMappings.get(bdsaCaseId)?.[slideId] || { stain: [], region: [] };

        // Combine protocols from data and mappings (same logic as generateUnmappedCases)
        const allProtocols = [...protocols, ...(additionalSlideProtocols[protocolType] || [])];

        console.log(`🔍 Current ${fieldName} for slide ${slideId}:`, allProtocols);
        console.log(`🔍 Original data:`, protocols);
        console.log(`🔍 Additional mappings:`, additionalSlideProtocols[protocolType] || []);

        // Remove protocol if present
        const index = allProtocols.indexOf(protocolId);
        if (index > -1) {
            console.log(`✅ Found protocol ${protocolId} at index ${index}, removing...`);

            // Remove from the appropriate source
            if (index < protocols.length) {
                // Remove from original data
                protocols.splice(index, 1);
                dataRow.BDSA.bdsaLocal[fieldName] = protocols;
                console.log(`✅ Removed from original data. New protocols:`, protocols);
            } else {
                // Remove from caseProtocolMappings
                const mappingIndex = index - protocols.length;
                additionalSlideProtocols[protocolType].splice(mappingIndex, 1);
                console.log(`✅ Removed from caseProtocolMappings. New mappings:`, additionalSlideProtocols[protocolType]);
            }

            // Mark item as modified
            dataRow.BDSA._lastModified = new Date().toISOString();
            this.modifiedItems.add(dataRow.id);

            // Skip saveToStorage() for large datasets to avoid quota errors
            // this.saveToStorage();
            this.notify();
            console.log(`✅ Protocol ${protocolId} removed from slide ${slideId} (marked as modified)`);
        } else {
            console.log(`❌ Protocol ${protocolId} not found in slide protocols:`, allProtocols);
        }
    }

    /**
     * Get protocol suggestions based on existing mappings in the collection
     * @param {string} stainType - The stain type to get suggestions for
     * @param {string} protocolType - 'stain' or 'region'
     * @returns {Object} Suggestion data with recommended protocol and confidence
     */
    getProtocolSuggestions(stainType, protocolType = 'stain') {
        console.log(`🔍 ANALYZING SUGGESTIONS for ${stainType} (${protocolType}):`, {
            dataLength: this.processedData?.length || 0,
            hasData: !!this.processedData
        });

        if (!this.processedData || this.processedData.length === 0) {
            return { suggested: null, confidence: 0, reason: 'No data available' };
        }

        // For suggestions, we need to look at the BDSA metadata structure
        // The protocols are stored in BDSA.bdsaLocal as bdsaStainProtocol/bdsaRegionProtocol
        const protocolField = protocolType === 'stain' ? 'bdsaStainProtocol' : 'bdsaRegionProtocol';
        const typeField = protocolType === 'stain' ? 'localStainID' : 'localRegionId';

        // Collect all mappings for this stain/region type across all cases
        const mappings = new Map(); // stainType -> Set of protocols used

        this.processedData.forEach((item, index) => {
            const itemStainType = item.BDSA?.bdsaLocal?.[typeField];
            const protocols = item.BDSA?.bdsaLocal?.[protocolField];

            // Debug first few items to see the data structure
            if (index < 3) {
                console.log(`🔍 DEBUG ITEM ${index}:`, {
                    itemStainType,
                    protocols,
                    BDSA: item.BDSA,
                    bdsaLocal: item.BDSA?.bdsaLocal,
                    protocolField,
                    typeField,
                    allKeys: Object.keys(item),
                    bdsaLocalKeys: item.BDSA?.bdsaLocal ? Object.keys(item.BDSA.bdsaLocal) : 'no bdsaLocal'
                });
            }

            if (itemStainType && protocols && Array.isArray(protocols) && protocols.length > 0) {
                // Filter out IGNORE protocols from suggestion calculations
                const nonIgnoreProtocols = protocols.filter(protocol =>
                    protocol && protocol.toUpperCase() !== 'IGNORE'
                );

                // Only include this mapping if there are non-IGNORE protocols
                if (nonIgnoreProtocols.length > 0) {
                    console.log(`🔍 FOUND MAPPING: ${itemStainType} -> ${nonIgnoreProtocols.join(', ')} (filtered out IGNORE)`);
                    if (!mappings.has(itemStainType)) {
                        mappings.set(itemStainType, new Map());
                    }

                    const typeMappings = mappings.get(itemStainType);
                    nonIgnoreProtocols.forEach(protocol => {
                        typeMappings.set(protocol, (typeMappings.get(protocol) || 0) + 1);
                    });
                } else {
                    console.log(`🔍 SKIPPING MAPPING: ${itemStainType} -> ${protocols.join(', ')} (only IGNORE protocols)`);
                }
            }
        });

        console.log(`🔍 ALL MAPPINGS FOUND:`, Array.from(mappings.entries()));

        // Check for exact 1:1 mapping
        if (mappings.has(stainType)) {
            const typeMappings = mappings.get(stainType);
            const entries = Array.from(typeMappings.entries());

            if (entries.length === 1) {
                // Perfect 1:1 mapping
                const [protocol, count] = entries[0];
                return {
                    suggested: protocol,
                    confidence: 1.0,
                    reason: `Perfect 1:1 mapping: ${stainType} → ${protocol} (${count} cases)`,
                    isExactMatch: true
                };
            } else if (entries.length > 1) {
                // Multiple protocols, find the most common
                entries.sort((a, b) => b[1] - a[1]);
                const [mostCommonProtocol, count] = entries[0];
                const totalCases = Array.from(typeMappings.values()).reduce((sum, c) => sum + c, 0);
                const confidence = count / totalCases;

                return {
                    suggested: mostCommonProtocol,
                    confidence: confidence,
                    reason: `Most common mapping: ${stainType} → ${mostCommonProtocol} (${count}/${totalCases} cases, ${Math.round(confidence * 100)}%)`,
                    isExactMatch: false,
                    alternatives: entries.slice(1).map(([protocol, count]) => ({ protocol, count }))
                };
            }
        }

        // Check for similar stain types (fuzzy matching)
        const similarTypes = Array.from(mappings.keys()).filter(type =>
            type.toLowerCase().includes(stainType.toLowerCase()) ||
            stainType.toLowerCase().includes(type.toLowerCase())
        );

        if (similarTypes.length > 0) {
            // Find the most common protocol across similar types
            const similarMappings = new Map();
            similarTypes.forEach(type => {
                const typeMappings = mappings.get(type);
                typeMappings.forEach((count, protocol) => {
                    similarMappings.set(protocol, (similarMappings.get(protocol) || 0) + count);
                });
            });

            if (similarMappings.size > 0) {
                const entries = Array.from(similarMappings.entries());
                entries.sort((a, b) => b[1] - a[1]);
                const [suggestedProtocol, totalCount] = entries[0];

                return {
                    suggested: suggestedProtocol,
                    confidence: 0.6, // Lower confidence for fuzzy matches
                    reason: `Similar types use: ${suggestedProtocol} (${totalCount} cases across similar types)`,
                    isExactMatch: false,
                    similarTypes: similarTypes
                };
            }
        }

        return {
            suggested: null,
            confidence: 0,
            reason: `No existing mappings found for ${stainType}`
        };
    }

    /**
     * Get all protocol suggestions for a given protocol type
     * @param {string} protocolType - 'stain' or 'region'
     * @returns {Map} Map of stain/region types to their suggestions
     */
    getAllProtocolSuggestions(protocolType = 'stain') {
        const suggestions = new Map();

        if (!this.processedData || this.processedData.length === 0) {
            return suggestions;
        }

        const typeField = protocolType === 'stain' ? 'stainType' : 'regionType';

        // Get all unique stain/region types in the data
        const types = new Set();
        this.processedData.forEach(item => {
            const type = item[typeField];
            if (type) {
                types.add(type);
            }
        });

        // Get suggestions for each type
        types.forEach(type => {
            const suggestion = this.getProtocolSuggestions(type, protocolType);
            if (suggestion.suggested) {
                suggestions.set(type, suggestion);
            }
        });

        return suggestions;
    }
}

// Create singleton instance
const dataStore = new DataStore();

// Export functions for DSA sync functionality
export const syncBdsaMetadataToServer = (progressCallback) => dataStore.syncBdsaMetadataToServer(progressCallback);
export const cancelDsaMetadataSync = () => dataStore.cancelDsaMetadataSync();
export const getSyncStatus = () => dataStore.getSyncStatus();
export const subscribe = (callback) => dataStore.subscribe(callback);
export const subscribeToSyncEvents = (callback) => dataStore.subscribeToSync(callback);
export const getDataStoreSnapshot = () => dataStore.getSnapshot();
export const getItemsToSyncCount = () => dataStore.getItemsToSyncCount();

// Export data management functions
export const setProcessedData = (data, source, sourceInfo) => dataStore.setProcessedData(data, source, sourceInfo);
export const setCaseIdInData = (localCaseId, bdsaCaseId) => dataStore.setCaseIdInData(localCaseId, bdsaCaseId);
export const loadDsaData = (dsaAuthStore) => dataStore.loadDsaData(dsaAuthStore);
export const generateUnmappedCases = () => dataStore.generateUnmappedCases();
export const generateStainProtocolCases = () => dataStore.generateStainProtocolCases();
export const generateRegionProtocolCases = () => dataStore.generateRegionProtocolCases();
export const getProtocolSuggestions = (stainType, protocolType) => dataStore.getProtocolSuggestions(stainType, protocolType);
export const getAllProtocolSuggestions = (protocolType) => dataStore.getAllProtocolSuggestions(protocolType);

// Export constants for sync events
export const DATA_CHANGE_EVENTS = {
    SYNC_STATUS_CHANGED: 'syncStatusChanged',
    SYNC_PROGRESS_UPDATED: 'syncProgressUpdated',
    SYNC_COMPLETED: 'syncCompleted',
    SYNC_ERROR: 'syncError',
    SYNC_CANCELLED: 'syncCancelled'
};

export default dataStore;
