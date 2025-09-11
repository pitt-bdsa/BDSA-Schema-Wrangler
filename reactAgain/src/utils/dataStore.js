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
        this.caseProtocolMappings = new Map();

        // DSA sync state
        this.syncInProgress = false;
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
    }

    // Event system for UI updates
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notify() {
        this.listeners.forEach(listener => listener());
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
                this.processedData = data.processedData || [];
                this.dataSource = data.dataSource;
                this.dataSourceInfo = data.dataSourceInfo;
                this.dataLoadTimestamp = data.dataLoadTimestamp;
                this.modifiedItems = new Set(data.modifiedItems || []);
                this.caseIdMappings = new Map(data.caseIdMappings || []);
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

                    this.processedData = data;
                    this.dataSource = 'csv';
                    this.dataSourceInfo = {
                        fileName: file.name,
                        fileSize: file.size,
                        lastModified: file.lastModified
                    };
                    this.dataLoadTimestamp = new Date().toISOString();
                    this.modifiedItems.clear();

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

            const items = await this.fetchDsaItems(config, token);
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

        return dsaData.map((item, index) => {
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

                // Initialize BDSA object for local data management
                BDSA: {
                    bdsaLocal: {
                        localCaseId: null,
                        localStainID: null,
                        localRegionId: null
                    },
                    _dataSource: {}, // Track where each field came from
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
        this.caseProtocolMappings.clear();

        this.saveToStorage();
        this.notify();
    }

    // Status and Getters
    getStatus() {
        return {
            processedData: this.processedData,
            dataSource: this.dataSource,
            dataSourceInfo: this.dataSourceInfo,
            dataLoadTimestamp: this.dataLoadTimestamp,
            modifiedItems: Array.from(this.modifiedItems),
            caseIdMappings: Array.from(this.caseIdMappings),
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

            // Skip regex processing entirely if this item has server metadata or existing BDSA values
            if (updatedItem._hasServerMetadata) {
                console.log(`⏭️ Skipping regex processing for item ${updatedItem.id} - has server metadata`);
                return; // Skip this item entirely
            }

            // Also skip if item already has any BDSA values from any source
            const hasExistingBdsaValues = updatedItem.BDSA?.bdsaLocal && (
                (updatedItem.BDSA.bdsaLocal.localCaseId && updatedItem.BDSA.bdsaLocal.localCaseId.trim() !== '') ||
                (updatedItem.BDSA.bdsaLocal.localStainID && updatedItem.BDSA.bdsaLocal.localStainID.trim() !== '') ||
                (updatedItem.BDSA.bdsaLocal.localRegionId && updatedItem.BDSA.bdsaLocal.localRegionId.trim() !== '')
            );

            if (hasExistingBdsaValues) {
                console.log(`⏭️ Skipping regex processing for item ${updatedItem.id} - already has BDSA values`);
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

    getSnapshot() {
        return {
            processedData: this.processedData,
            dataSource: this.dataSource,
            dataSourceInfo: this.dataSourceInfo,
            dataLoadTimestamp: this.dataLoadTimestamp,
            modifiedItems: this.modifiedItems,
            caseIdMappings: this.caseIdMappings,
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
}

// Create singleton instance
const dataStore = new DataStore();

// Export functions for DSA sync functionality
export const syncBdsaMetadataToServer = (progressCallback) => dataStore.syncBdsaMetadataToServer(progressCallback);
export const cancelDsaMetadataSync = () => dataStore.cancelDsaMetadataSync();
export const getSyncStatus = () => dataStore.getSyncStatus();
export const subscribeToSyncEvents = (callback) => dataStore.subscribeToSync(callback);
export const getDataStoreSnapshot = () => dataStore.getSnapshot();

// Export constants for sync events
export const DATA_CHANGE_EVENTS = {
    SYNC_STATUS_CHANGED: 'syncStatusChanged',
    SYNC_PROGRESS_UPDATED: 'syncProgressUpdated',
    SYNC_COMPLETED: 'syncCompleted',
    SYNC_ERROR: 'syncError',
    SYNC_CANCELLED: 'syncCancelled'
};

export default dataStore;
