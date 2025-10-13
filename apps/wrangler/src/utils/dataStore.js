// Data Store - Manages loaded data from CSV files, Excel files and DSA servers
// with localStorage persistence and data transformation

import * as XLSX from 'xlsx';
import suggestionEngine from './SuggestionEngine.js';
import protocolCaseGenerator from './ProtocolCaseGenerator.js';
import dsaSync from './DsaSync.js';
import dataLoader from './DataLoader.js';
import caseManager from './CaseManager.js';
import protocolMapper from './ProtocolMapper.js';
import storageManager from './StorageManager.js';
import statisticsManager from './StatisticsManager.js';
import csvLoader from './CsvLoader.js';
import excelLoader from './ExcelLoader.js';
import dsaLoader from './DsaLoader.js';
import bdsaInitializer from './BdsaInitializer.js';
import columnMapper from './ColumnMapper.js';
import accessoryDataMatcher from './AccessoryDataMatcher.js';
import protocolStore from './protocolStore.js';

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
        return storageManager.loadFromStorage(this);
    }

    saveToStorage() {
        return storageManager.saveToStorage(this);
    }

    // CSV Data Loading
    async loadCsvData(file) {
        return csvLoader.loadCsvData(file, this);
    }


    // Excel Data Loading - Get sheet names first
    async getExcelSheetNames(file) {
        return excelLoader.getExcelSheetNames(file);
    }

    // Excel Data Loading - Load specific sheet
    async loadExcelData(file, sheetName = null) {
        return excelLoader.loadExcelData(file, sheetName, this);
    }


    // Accessory File Loading - for CSV/Excel files with additional metadata
    async loadAccessoryFile(file) {
        return accessoryDataMatcher.loadAccessoryFile(file, this, csvLoader);
    }

    // Match accessory data with existing DSA data based on filename
    matchAccessoryData(accessoryData) {
        return accessoryDataMatcher.matchAccessoryData(accessoryData, this);
    }

    // Retry accessory matching with a specific filename field
    retryAccessoryMatching(accessoryData, filenameField) {
        return accessoryDataMatcher.retryAccessoryMatching(accessoryData, filenameField, this);
    }

    // DSA Data Loading - Back to working approach with file filtering
    async loadDsaData(dsaAuthStore) {
        return dsaLoader.loadDsaData(dsaAuthStore, this);
    }

    async loadMoreDsaData(dsaAuthStore, progressCallback) {
        return dsaLoader.loadMoreDsaData(dsaAuthStore, this, progressCallback);
    }

    // Background loading to progressively cache more data
    async startBackgroundLoading() {
        return dataLoader.startBackgroundLoading(this);
    }

    // Stop background loading
    stopBackgroundLoading() {
        return dataLoader.stopBackgroundLoading(this);
    }

    async fetchDsaItems(config, token) {
        return dsaLoader.fetchDsaItems(config, token);
    }

    // Server-side pagination for AG Grid with background cache support
    async fetchDsaPage({ page, pageSize, sortModel, filterModel }) {
        return dsaLoader.fetchDsaPage({ page, pageSize, sortModel, filterModel }, this);
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
        return statisticsManager.getStatus(this);
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
        return statisticsManager.getStatistics(this.processedData, this.modifiedItems);
    }

    /**
     * Get nested property value from an object using dot notation
     * @param {Object} obj - The object to query
     * @param {string} path - Dot-separated path (e.g., 'accessoryData.accessory_SubNum')
     * @returns {*} The value at the path, or undefined if not found
     */
    getNestedValue(obj, path) {
        return columnMapper.getNestedValue(obj, path);
    }

    /**
     * Apply column mappings to populate BDSA fields from source data
     * @param {Object} columnMappings - Object mapping BDSA fields to source columns
     * @param {boolean} markAsModified - Whether to mark items as modified (default: true)
     * @returns {Object} - Result with success status and updated count
     */
    applyColumnMappings(columnMappings, markAsModified = true) {
        return columnMapper.applyColumnMappings(this.processedData, columnMappings, this.modifiedItems, () => this.notify(), markAsModified);
    }

    /**
     * Apply regex rules to extract BDSA fields from filenames
     * @param {Object} regexRules - Object containing regex patterns for each field
     * @returns {Object} - Result with success status and extracted count
     */
    applyRegexRules(regexRules, markAsModified = true, forceOverride = false) {
        return columnMapper.applyRegexRules(this.processedData, regexRules, this.modifiedItems, () => this.notify(), markAsModified, forceOverride);
    }

    /**
     * Get items that have been modified since last sync
     * @returns {Array} - Array of modified items
     */
    getModifiedItems() {
        return statisticsManager.getModifiedItems(this.processedData, this.modifiedItems);
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

                // Explicitly mark item as modified (fallback in case proxy doesn't work)
                const itemId = item.id || item._id || item.dsa_id;
                if (itemId) {
                    this.modifiedItems.add(itemId);
                    console.log(`🔍 setCaseIdInData: Added item ${itemId} to modifiedItems. Total modified: ${this.modifiedItems.size}`);
                }
                
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
        return caseManager.applyCaseIdMappingsToData(this.processedData, this.caseIdMappings, this);
    }

    /**
     * Initialize case ID mappings from existing data
     * This reads existing BDSA.bdsaLocal.bdsaCaseId values and populates the mappings
     * Handles conflicts where the same localCaseId has different bdsaCaseId values
     */
    initializeCaseIdMappingsFromData() {
        return caseManager.initializeCaseIdMappingsFromData(this.processedData, this);
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
        return bdsaInitializer.initializeBdsaStructure(data);
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

        // Clear protocols when loading new data (they're specific to the previous dataset)
        // This prevents confusion from protocols from previous datasets
        this.caseProtocolMappings.clear();

        // Clear protocol store when loading new data
        protocolStore.resetToDefaults('new_dataset');
        console.log('🧹 Cleared protocols when loading new dataset - protocols are dataset-specific');

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
        return dsaSync.syncBdsaMetadataToServer(this.processedData, this.modifiedItems, this, progressCallback);
    }
    shouldSyncItem(item) {
        return dsaSync.shouldSyncItem(item, this.modifiedItems);
    }

    getItemsToSyncCount() {
        return dsaSync.getItemsToSyncCount(this.modifiedItems);
    }

    async syncItemToServer(item) {
        return dsaSync.syncItemToServer(item, this);
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
        return statisticsManager.getSnapshot(this);
    }

    // Generate cases with stain slides for stain protocol mapping
    generateStainProtocolCases() {
        return protocolCaseGenerator.generateStainProtocolCases(this.processedData, this.caseIdMappings, this.columnMappings);
    }

    // Generate cases with region slides for region protocol mapping  
    generateRegionProtocolCases() {
        return protocolCaseGenerator.generateRegionProtocolCases(this.processedData, this.caseIdMappings, this.columnMappings);
    }

    // Generate unmapped cases from current data for protocol mapping (legacy - now calls stain)
    generateUnmappedCases() {
        return this.generateStainProtocolCases();
    }

    addProtocolMapping(bdsaCaseId, slideId, protocolId, protocolType, batchMode = false) {
        return protocolMapper.addProtocolMapping(
            bdsaCaseId, slideId, protocolId, protocolType,
            this.processedData, this.modifiedItems, this.caseProtocolMappings,
            () => this.notify(), batchMode
        );
    }


    // Remove protocol mapping from a specific slide
    removeProtocolMapping(bdsaCaseId, slideId, protocolId, protocolType) {
        return protocolMapper.removeProtocolMapping(
            bdsaCaseId, slideId, protocolId, protocolType,
            this.processedData, this.modifiedItems, this.caseProtocolMappings,
            () => this.notify()
        );
    }

    /**
     * Get protocol suggestions based on existing mappings in the collection
     * @param {string} stainType - The stain type to get suggestions for
     * @param {string} protocolType - 'stain' or 'region'
     * @returns {Object} Suggestion data with recommended protocol and confidence
     */
    getProtocolSuggestions(stainType, protocolType = 'stain') {
        return suggestionEngine.getProtocolSuggestions(this.processedData, stainType, protocolType);
    }

    /**
     * Get all protocol suggestions for a given protocol type
     * @param {string} protocolType - 'stain' or 'region'
     * @returns {Map} Map of stain/region types to their suggestions
     */
    getAllProtocolSuggestions(protocolType = 'stain') {
        return suggestionEngine.getAllProtocolSuggestions(this.processedData, protocolType);
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
