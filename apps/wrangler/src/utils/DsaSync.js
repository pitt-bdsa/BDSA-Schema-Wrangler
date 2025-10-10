/**
 * DsaSync - Handles DSA synchronization functionality
 * Extracted from the massive dataStore.js to improve maintainability
 */

class DsaSync {
    constructor() {
        // No state - this is a pure utility class
    }

    /**
     * Sync BDSA metadata to DSA server
     * @param {Array} processedData - The processed data to sync
     * @param {Set} modifiedItems - Set of modified item IDs
     * @param {Object} dataStore - Reference to the dataStore for state management
     * @param {Function} progressCallback - Optional progress callback
     * @returns {Promise<Object>} Sync results
     */
    async syncBdsaMetadataToServer(processedData, modifiedItems, dataStore, progressCallback) {
        if (dataStore.syncInProgress) {
            throw new Error('Sync already in progress');
        }

        // Filter to only modified items
        const itemsToSync = processedData.filter(item => modifiedItems.has(item.id));

        console.log(`🚀 Starting sync - ${itemsToSync.length} items to sync out of ${processedData.length} total`);
        console.log('🚀 Modified item IDs:', Array.from(modifiedItems));

        dataStore.syncInProgress = true;
        dataStore.syncCancelled = false; // Reset cancellation flag
        dataStore.syncStatus = 'syncing';
        dataStore.syncProgress = {
            current: 0,
            total: itemsToSync.length,
            percentage: 0,
            success: 0,
            errors: 0,
            skipped: 0
        };
        dataStore.notifySyncListeners('syncStatusChanged');
        console.log('📡 Notified listeners of sync status change');

        try {
            const results = {
                success: 0,
                errors: 0,
                skipped: 0,
                details: []
            };

            for (let i = 0; i < itemsToSync.length; i++) {
                // Check for cancellation before processing each item
                if (dataStore.syncCancelled) {
                    console.log('🛑 Sync cancelled by user');
                    break;
                }

                const item = itemsToSync[i];

                // Update progress
                dataStore.syncProgress.current = i + 1;
                dataStore.syncProgress.percentage = Math.round(((i + 1) / itemsToSync.length) * 100);

                if (progressCallback) {
                    progressCallback(dataStore.syncProgress);
                }

                try {
                    // All items in itemsToSync are modified, so sync them all
                    await this.syncItemToServer(item, dataStore);
                    results.success++;
                    dataStore.syncProgress.success++;
                    console.log(`✅ Synced item ${i + 1}/${itemsToSync.length}: ${item.name}`);
                } catch (error) {
                    results.errors++;
                    dataStore.syncProgress.errors++;
                    results.details.push({
                        item: item.name,
                        error: error.message
                    });
                    console.error(`❌ Error syncing item ${i + 1}/${processedData.length}: ${item.name}`, error);
                }

                // Notify listeners of progress update
                dataStore.notifySyncListeners('syncProgressUpdated', dataStore.syncProgress);
            }

            // Final status update
            if (dataStore.syncCancelled) {
                dataStore.syncStatus = 'cancelled';
                dataStore.notifySyncListeners('syncCancelled');
                console.log('🛑 Sync cancelled');
            } else {
                dataStore.syncStatus = 'synced';
                dataStore.notifySyncListeners('syncCompleted', results);
                console.log('✅ Sync completed:', results);
            }

            return results;

        } catch (error) {
            dataStore.syncStatus = 'error';
            dataStore.notifySyncListeners('syncError', { error: error.message });
            console.error('❌ Sync failed:', error);
            throw error;
        } finally {
            dataStore.syncInProgress = false;
            dataStore.notifySyncListeners('syncStatusChanged');
        }
    }

    /**
     * Check if an item should be synced
     * @param {Object} item - The item to check
     * @param {Set} modifiedItems - Set of modified item IDs
     * @returns {boolean} Whether the item should be synced
     */
    shouldSyncItem(item, modifiedItems) {
        // Only sync items that are explicitly marked as modified
        return modifiedItems.has(item.id);
    }

    /**
     * Get count of items to sync
     * @param {Set} modifiedItems - Set of modified item IDs
     * @returns {number} Number of items to sync
     */
    getItemsToSyncCount(modifiedItems) {
        // Simple: only count items that are explicitly marked as modified
        return modifiedItems.size;
    }

    /**
     * Sync a single item to the server
     * @param {Object} item - The item to sync
     * @param {Object} dataStore - Reference to the dataStore
     * @returns {Promise<void>}
     */
    async syncItemToServer(item, dataStore) {
        // Import dsaAuthStore to get current auth status
        const { default: dsaAuthStore } = await import('./dsaAuthStore');
        const authStatus = dsaAuthStore.getStatus();

        if (!authStatus.isAuthenticated || !authStatus.isConfigured) {
            throw new Error('DSA authentication or configuration missing');
        }

        // Import sync utilities
        const { syncItemBdsaMetadata } = await import('./dsaIntegration.js');

        // Get column mappings from localStorage or use defaults
        const columnMappings = JSON.parse(localStorage.getItem('columnMappings') || '{}');

        // Get DSA config
        const config = dsaAuthStore.getConfig();
        const token = dsaAuthStore.getToken();

        // Sync the item
        const result = await syncItemBdsaMetadata(
            config.baseUrl,
            item,
            token,
            columnMappings
        );

        if (!result.success) {
            throw new Error(result.error || 'Failed to sync item metadata');
        }

        // Remove from modified items after successful sync
        dataStore.modifiedItems.delete(item.id);
    }

    /**
     * Cancel DSA metadata sync
     * @param {Object} dataStore - Reference to the dataStore
     */
    cancelDsaMetadataSync(dataStore) {
        if (dataStore.syncInProgress) {
            dataStore.syncCancelled = true;
            console.log('🛑 Sync cancellation requested');
        }
    }

    /**
     * Get current sync status
     * @param {Object} dataStore - Reference to the dataStore
     * @returns {Object} Current sync status
     */
    getSyncStatus(dataStore) {
        return {
            syncInProgress: dataStore.syncInProgress,
            syncStatus: dataStore.syncStatus,
            syncProgress: dataStore.syncProgress,
            syncCancelled: dataStore.syncCancelled
        };
    }
}

// Create singleton instance
const dsaSync = new DsaSync();

export default dsaSync;
