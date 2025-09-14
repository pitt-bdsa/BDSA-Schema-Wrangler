// Data Store - Manages loaded data from CSV files and DSA servers
// with localStorage persistence and data transformation

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
            this.saveToStorage();
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
                this.caseIdConflicts = new Map(data.caseIdConflicts || []);
                this.bdsaCaseIdConflicts = new Map(data.bdsaCaseIdConflicts || []);
                this.caseProtocolMappings = new Map(data.caseProtocolMappings || []);
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
                    this.modifiedItems.clear();

                    // Clear case ID mappings when loading new data (they're specific to the previous dataset)
                    this.caseIdMappings.clear();
                    this.caseIdConflicts.clear();
                    this.bdsaCaseIdConflicts.clear();

                    this.saveToStorage();
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

    // DSA Data Loading
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

            console.log(' DEBUG - About to fetch items from DSA server');
            const items = await this.fetchDsaItems(config, token);
            console.log(' DEBUG - Fetched items, about to transform:', items.length);
            const transformedData = this.transformDsaData(items);

            this.processedData = transformedData;
            this.dataSource = 'dsa';
            this.dataSourceInfo = {
                baseUrl: config.baseUrl,
                resourceId: config.resourceId,
                resourceType: config.resourceType
            };
            this.dataLoadTimestamp = new Date().toISOString();
            this.modifiedItems.clear();

            // Set DSA configuration for sync functionality
            this.girderToken = token;
            this.dsaConfig = config;


            this.saveToStorage();
            this.notify();

            return {
                success: true,
                itemCount: transformedData.length,
                message: `Successfully loaded ${transformedData.length} items from DSA`
            };
        } catch (error) {
            throw new Error(`Failed to load DSA data: ${error.message}`);
        }
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
                        bdsaCaseId: existingBdsaData.bdsaCaseId || null
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
                dsa_mimeType: item.mimeType || item.contentType || '',

                BDSA: {
                    bdsaLocal: {
                        localCaseId: existingBdsaData.localCaseId || null,
                        localStainID: existingBdsaData.localStainID || null,
                        localRegionId: existingBdsaData.localRegionId || null,
                        bdsaCaseId: existingBdsaData.bdsaCaseId || null // Read existing bdsaCaseId from server
                    },
                    _dataSource: existingBdsaData.source ? {
                        localCaseId: 'dsa_server',
                        localStainID: 'dsa_server',
                        localRegionId: 'dsa_server',
                        bdsaCaseId: 'dsa_server'
                    } : {}, // Track where each field came from
                    _lastModified: new Date().toISOString()
                }
            };

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
        this.modifiedItems.clear();
        this.caseIdMappings.clear();
        this.caseIdConflicts.clear();
        this.bdsaCaseIdConflicts.clear();
        this.caseProtocolMappings.clear();

        this.saveToStorage();
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
     * Apply column mappings to populate BDSA fields from source data
     * @param {Object} columnMappings - Object mapping BDSA fields to source columns
     * @returns {Object} - Result with success status and updated count
     */
    applyColumnMappings(columnMappings) {
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
            const updatedItem = { ...item };

            // Ensure BDSA object exists
            if (!updatedItem.BDSA) {
                updatedItem.BDSA = {
                    bdsaLocal: {},
                    _dataSource: {},
                    _lastModified: new Date().toISOString()
                };
            }

            // Apply mappings for each field
            Object.entries(columnMappings).forEach(([bdsaField, sourceColumn]) => {
                if (sourceColumn && sourceColumn.trim() !== '') {
                    const sourceValue = item[sourceColumn];

                    // Only update if source value exists and is not empty
                    if (sourceValue !== null && sourceValue !== undefined && sourceValue !== '') {
                        // Initialize nested structure if needed
                        if (!updatedItem.BDSA.bdsaLocal) {
                            updatedItem.BDSA.bdsaLocal = {};
                        }
                        if (!updatedItem.BDSA._dataSource) {
                            updatedItem.BDSA._dataSource = {};
                        }

                        // Set the value and track source
                        updatedItem.BDSA.bdsaLocal[bdsaField] = sourceValue;
                        updatedItem.BDSA._dataSource[bdsaField] = 'column_mapping';
                        updatedItem.BDSA._lastModified = new Date().toISOString();
                        itemUpdated = true;
                    }
                }
            });

            if (itemUpdated) {
                updatedItems.push(updatedItem);
                this.modifiedItems.add(updatedItem.id);
                updatedCount++;
            }
        });

        // Update the processed data
        this.processedData = this.processedData.map(item => {
            const updated = updatedItems.find(u => u.id === item.id);
            return updated || item;
        });

        this.saveToStorage();
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
                }
                extractedCount++;
            }
        });

        // Update the processed data
        this.processedData = this.processedData.map(item => {
            const updated = updatedItems.find(u => u.id === item.id);
            return updated || item;
        });

        this.saveToStorage();
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
        const modifiedItems = this.processedData.filter(item =>
            this.modifiedItems.has(item.id)
        );
        console.log(`📊 Found ${modifiedItems.length} modified items out of ${this.processedData.length} total items`);
        return modifiedItems;
    }

    /**
     * Clear the modified items tracking (after successful sync)
     */
    clearModifiedItems() {
        console.log(`🧹 Clearing ${this.modifiedItems.size} modified items`);
        this.modifiedItems.clear();
        this.saveToStorage();
        this.notify();
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
                results.results.forEach(result => {
                    if (result.success && result.itemId) {
                        this.modifiedItems.delete(result.itemId);
                        clearedCount++;
                    }
                });
                console.log(`Cleared ${clearedCount} items from modified items set after successful sync`);

                // Save the updated state
                this.saveToStorage();
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
        this.saveToStorage();
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

        this.saveToStorage();
        // Don't call notify() to avoid triggering any logic that might mark items as modified
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

        let updatedCount = 0;
        this.processedData.forEach((item) => {
            if (item.BDSA?.bdsaLocal?.localCaseId === localCaseId) {
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

                // Mark as modified since this is a user action that should be synced
                this.modifiedItems.add(item.id);
                updatedCount++;
            }
        });

        if (updatedCount > 0) {
            const action = bdsaCaseId ? `Set` : `Cleared`;
            const value = bdsaCaseId ? `${localCaseId} -> ${bdsaCaseId}` : localCaseId;
            console.log(`${action} case ID ${value} for ${updatedCount} items`);
            this.saveToStorage();
            this.notify();
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

                    // Mark as modified since this is a user action that should be synced
                    this.modifiedItems.add(item.id);
                    updatedCount++;
                }
            }
        });

        if (updatedCount > 0) {
            console.log(`Applied case ID mappings to ${updatedCount} data items`);
        }
    }

    /**
     * Initialize case ID mappings from existing data
     * This reads existing BDSA.bdsaLocal.bdsaCaseId values and populates the mappings
     * Handles conflicts where the same localCaseId has different bdsaCaseId values
     */
    initializeCaseIdMappingsFromData() {
        if (!this.processedData || this.processedData.length === 0) {
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
        }
        if (bdsaConflicts.size > 0) {
            console.warn(`⚠️ Found ${bdsaConflicts.size} BDSA case ID conflicts that need resolution`);
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

        this.saveToStorage();
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

        this.saveToStorage();
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

        // Remove the conflict
        this.bdsaCaseIdConflicts.delete(bdsaCaseId);

        this.saveToStorage();
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

        // Remove the conflict
        this.bdsaCaseIdConflicts.delete(bdsaCaseId);

        this.saveToStorage();
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

        console.log('🔧 DEBUG - initializeBdsaStructure called, checking first item:', {
            hasBDSA: !!data[0]?.BDSA,
            hasBdsaLocal: !!data[0]?.BDSA?.bdsaLocal,
            bdsaLocalValues: data[0]?.BDSA?.bdsaLocal
        });

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
        this.processedData = this.initializeBdsaStructure(data);

        if (source) {
            this.dataSource = source;
        }
        if (sourceInfo) {
            this.dataSourceInfo = sourceInfo;
        }

        this.dataLoadTimestamp = new Date().toISOString();
        this.modifiedItems.clear();

        // Clear case ID mappings when loading new data (they're specific to the previous dataset)
        this.caseIdMappings.clear();
        this.caseIdConflicts.clear();
        this.bdsaCaseIdConflicts.clear();

        // Clear sync results when loading new data (they're specific to the previous dataset)
        this.lastSyncResults = null;

        this.saveToStorage();
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

    // Generate unmapped cases from current data for protocol mapping
    generateUnmappedCases() {
        if (!this.processedData.length) {
            console.log('🔍 No processed data available');
            return [];
        }

        console.log('🔍 DEBUG - generateUnmappedCases called with:', {
            processedDataLength: this.processedData.length,
            caseIdMappingsSize: this.caseIdMappings.size,
            columnMappings: this.columnMappings,
            sampleDataItem: this.processedData[0] ? {
                id: this.processedData[0].id,
                name: this.processedData[0].name,
                BDSA: this.processedData[0].BDSA
            } : null
        });

        // Use default column mappings for BDSA data if not set
        const columnMapping = this.columnMappings.localStainID ? this.columnMappings : {
            localCaseId: 'BDSA.bdsaLocal.localCaseId',
            localStainID: 'BDSA.bdsaLocal.localStainID',
            localRegionId: 'BDSA.bdsaLocal.localRegionId'
        };

        console.log('🔍 Using column mapping:', columnMapping);

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

            // Debug first few rows
            if (index < 3) {
                console.log(`🔍 Row ${index}:`, {
                    localCaseId,
                    localStainId,
                    localRegionId,
                    filename,
                    finalFilename,
                    slideId,
                    _id: row._id,
                    dsa_id: row.dsa_id,
                    hasCaseIdMapping: this.caseIdMappings.has(localCaseId),
                    bdsaData: row.BDSA?.bdsaLocal,
                    fullRowKeys: Object.keys(row).slice(0, 10) // Show first 10 keys for debugging
                });
            }

            // Skip if no stain ID or region ID, or no BDSA case ID mapping
            if ((!localStainId && !localRegionId) || !this.caseIdMappings.has(localCaseId)) {
                if (index < 5) { // Show more debug info
                    console.log(`🔍 Skipping row ${index}:`, {
                        reason: !localStainId && !localRegionId ? 'No stain/region ID' : 'No case ID mapping',
                        localStainId,
                        localRegionId,
                        localCaseId,
                        hasCaseIdMapping: this.caseIdMappings.has(localCaseId),
                        caseIdMappingsKeys: Array.from(this.caseIdMappings.keys()).slice(0, 5) // Show first 5 keys
                    });
                }
                return;
            }

            const bdsaCaseId = this.caseIdMappings.get(localCaseId);

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

            // Get protocol information from the actual data
            const bdsaStainProtocol = row.BDSA?.bdsaLocal?.bdsaStainProtocol;
            const bdsaRegionProtocol = row.BDSA?.bdsaLocal?.bdsaRegionProtocol;

            // Parse the protocol data - always store as arrays internally
            let stainProtocols = [];
            if (bdsaStainProtocol) {
                if (Array.isArray(bdsaStainProtocol)) {
                    // Already an array, just filter out invalid entries
                    stainProtocols = bdsaStainProtocol.filter(p => p && typeof p === 'string');
                } else if (typeof bdsaStainProtocol === 'string') {
                    // Convert string to array
                    stainProtocols = bdsaStainProtocol.split(',').map(p => p.trim()).filter(p => p);
                }
            }

            let regionProtocols = [];
            if (bdsaRegionProtocol) {
                if (Array.isArray(bdsaRegionProtocol)) {
                    // Already an array, just filter out invalid entries
                    regionProtocols = bdsaRegionProtocol.filter(p => p && typeof p === 'string');
                } else if (typeof bdsaRegionProtocol === 'string') {
                    // Convert string to array
                    regionProtocols = bdsaRegionProtocol.split(',').map(p => p.trim()).filter(p => p);
                }
            }

            // Also check the caseProtocolMappings for any additional mappings
            const additionalSlideProtocols = this.caseProtocolMappings.get(bdsaCaseId)?.[slideId] || { stain: [], region: [] };

            // Combine protocols from data and mappings
            const allStainProtocols = [...stainProtocols, ...(additionalSlideProtocols.stain || [])];
            const allRegionProtocols = [...regionProtocols, ...(additionalSlideProtocols.region || [])];

            // Check if slide is mapped (has protocols)
            const hasStainProtocols = allStainProtocols.length > 0;
            const hasRegionProtocols = allRegionProtocols.length > 0;
            const isMapped = hasStainProtocols || hasRegionProtocols;

            // Debug logging for protocol detection
            if (index < 5) { // Show fewer rows but with more detail
                console.log(`🔍 Row ${index} protocol detection:`, {
                    slideId,
                    filename: finalFilename,
                    bdsaStainProtocol,
                    bdsaStainProtocolArray: Array.isArray(bdsaStainProtocol) ? bdsaStainProtocol : 'not array',
                    bdsaRegionProtocol,
                    bdsaRegionProtocolArray: Array.isArray(bdsaRegionProtocol) ? bdsaRegionProtocol : 'not array',
                    stainProtocols,
                    regionProtocols,
                    localStainId,
                    localRegionId,
                    isMapped,
                    hasStainProtocols,
                    hasRegionProtocols,
                    allStainProtocols,
                    allRegionProtocols
                });
            }

            caseGroups[bdsaCaseId].slides.push({
                id: slideId, // This is now the actual _id or dsa_id for table reference
                filename: finalFilename, // This is the display name
                stainType: localStainId,
                regionType: localRegionId,
                status: isMapped ? 'mapped' : 'unmapped',
                localStainId: localStainId,
                localRegionId: localRegionId,
                stainProtocols: allStainProtocols,
                regionProtocols: allRegionProtocols
            });
        });

        const allCases = Object.values(caseGroups);
        // Return ALL cases that have slides with stain types, not just unmapped ones
        const casesWithStainSlides = allCases.filter(caseData =>
            caseData.slides.some(slide => slide.stainType)
        );

        console.log('🔍 DEBUG - Case generation results:', {
            totalCaseGroups: allCases.length,
            casesWithStainSlides: casesWithStainSlides.length,
            allCases: allCases.map(c => ({
                bdsaId: c.bdsaId,
                localCaseId: c.localCaseId,
                totalSlides: c.slides.length,
                stainSlides: c.slides.filter(s => s.stainType).length,
                mappedSlides: c.slides.filter(s => s.status === 'mapped').length,
                unmappedSlides: c.slides.filter(s => s.status === 'unmapped').length
            })),
            caseGroupsKeys: Object.keys(caseGroups)
        });

        return casesWithStainSlides;
    }

    // Add protocol mapping to a specific slide
    addProtocolMapping(bdsaCaseId, slideId, protocolId, protocolType) {
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

            this.saveToStorage();
            console.log(`✅ Added protocol ${protocolId} to slide ${slideId}. New protocols:`, protocolArray);
            this.notify();
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

            this.saveToStorage();
            this.notify();
            console.log(`✅ Protocol ${protocolId} removed from slide ${slideId}`);
        } else {
            console.log(`❌ Protocol ${protocolId} not found in slide protocols:`, allProtocols);
        }
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

// Export constants for sync events
export const DATA_CHANGE_EVENTS = {
    SYNC_STATUS_CHANGED: 'syncStatusChanged',
    SYNC_PROGRESS_UPDATED: 'syncProgressUpdated',
    SYNC_COMPLETED: 'syncCompleted',
    SYNC_ERROR: 'syncError',
    SYNC_CANCELLED: 'syncCancelled'
};

export default dataStore;
