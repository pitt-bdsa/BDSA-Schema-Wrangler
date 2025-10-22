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
        console.log('🚀 DataStore dsaConfig:', dataStore.dsaConfig);
        console.log('🚀 DataStore keys:', Object.keys(dataStore));
        console.log('🚀 DataStore has dsaConfig:', !!dataStore.dsaConfig);
        console.log('🚀 DataStore dsaConfig details:', {
            hasBaseUrl: !!dataStore.dsaConfig?.baseUrl,
            hasResourceId: !!dataStore.dsaConfig?.resourceId,
            hasToken: !!dataStore.dsaConfig?.token,
            resourceType: dataStore.dsaConfig?.resourceType
        });

        // Always update resourceId folder metadata to show it's been "touched" by BDSA Wrangler
        console.log('🚀 Calling updateResourceFolderTouchIndicator...');
        try {
            await this.updateResourceFolderTouchIndicator(dataStore);
            console.log('🚀 updateResourceFolderTouchIndicator completed');
        } catch (error) {
            console.error('❌ updateResourceFolderTouchIndicator failed:', error);
        }

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

            // Ensure resource folder touch indicator is updated after sync completion
            console.log('🚀 Final touch indicator update...');
            await this.updateResourceFolderTouchIndicator(dataStore);

            return results;

        } catch (error) {
            dataStore.syncStatus = 'error';
            dataStore.notifySyncListeners('syncError', { error: error.message });
            console.error('❌ Sync failed:', error);

            // Still try to update touch indicator even if sync failed
            console.log('🚀 Touch indicator update after sync error...');
            try {
                await this.updateResourceFolderTouchIndicator(dataStore);
            } catch (touchError) {
                console.warn('⚠️ Failed to update touch indicator after sync error:', touchError);
            }

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

    /**
     * Updates the resourceId folder metadata to show it's been "touched" by BDSA Wrangler
     * This ensures the folder shows BDSA indicators even when there are no items to sync
     * @param {Object} dataStore - Reference to the dataStore for state management
     */
    async updateResourceFolderTouchIndicator(dataStore) {
        console.log('🔍 updateResourceFolderTouchIndicator called with dataStore:', dataStore);
        try {
            // Get DSA configuration
            let dsaConfig = dataStore.dsaConfig;
            console.log('🔍 DSA Config in dataStore:', dsaConfig);
            console.log('🔍 dataStore type:', typeof dataStore);
            console.log('🔍 dataStore constructor:', dataStore.constructor.name);

            // Fallback: if dsaConfig is not available, try to get it from auth store
            if (!dsaConfig || !dsaConfig.baseUrl || !dsaConfig.resourceId || !dsaConfig.token) {
                console.log('🔍 DSA config incomplete in dataStore, trying auth store fallback...');
                try {
                    const { default: dsaAuthStore } = await import('./dsaAuthStore.js');
                    const authConfig = dsaAuthStore.getConfig();
                    const token = dsaAuthStore.getToken();

                    if (authConfig && token) {
                        dsaConfig = {
                            baseUrl: authConfig.baseUrl,
                            resourceId: authConfig.resourceId,
                            resourceType: authConfig.resourceType,
                            metadataSyncTargetFolder: authConfig.metadataSyncTargetFolder,
                            token: token
                        };
                        console.log('🔍 Fallback DSA config from auth store:', dsaConfig);
                    }
                } catch (authError) {
                    console.warn('🔍 Could not get DSA config from auth store:', authError);
                }
            }

            if (!dsaConfig || !dsaConfig.baseUrl || !dsaConfig.resourceId || !dsaConfig.token) {
                console.log('⚠️ DSA configuration incomplete, skipping resource folder touch update', {
                    hasConfig: !!dsaConfig,
                    hasBaseUrl: !!dsaConfig?.baseUrl,
                    hasResourceId: !!dsaConfig?.resourceId,
                    hasToken: !!dsaConfig?.token,
                    dsaConfig: dsaConfig
                });
                return;
            }

            console.log('🔍 Updating resource folder touch indicator...', {
                resourceId: dsaConfig.resourceId,
                resourceType: dsaConfig.resourceType,
                baseUrl: dsaConfig.baseUrl
            });

            // Import the DSA metadata manager
            const { addFolderMetadata } = await import('./DsaMetadataManager.js');

            // Check if this is a collection or folder and use appropriate endpoint
            const isCollection = dsaConfig.resourceType === 'collection';
            console.log('🔍 Resource type:', dsaConfig.resourceType, 'isCollection:', isCollection);

            // Create touch indicator metadata
            const touchMetadata = {
                bdsaWranglerTouch: {
                    lastTouched: new Date().toISOString(),
                    source: 'BDSA-Schema-Wrangler',
                    version: '1.0',
                    action: 'sync_attempt'
                },
                // Also set the legacy fields for compatibility
                bdsaProcessed: true,
                bdsaIndexed: true
            };

            // Update the resourceId metadata (collection or folder)
            console.log('📝 Calling addFolderMetadata with:', {
                baseUrl: dsaConfig.baseUrl,
                resourceId: dsaConfig.resourceId,
                resourceType: dsaConfig.resourceType,
                token: dsaConfig.token ? '[REDACTED]' : 'MISSING',
                metadata: touchMetadata
            });

            let result;
            if (isCollection) {
                // For collections, use the collection metadata endpoint
                console.log('📝 Using collection metadata endpoint');
                const collectionApiUrl = `${dsaConfig.baseUrl}/api/v1/collection/${dsaConfig.resourceId}/metadata`;
                const headers = {
                    'Content-Type': 'application/json',
                    'Girder-Token': dsaConfig.token
                };

                console.log('📡 Making PUT request to collection:', collectionApiUrl);
                const response = await fetch(collectionApiUrl, {
                    method: 'PUT',
                    headers: headers,
                    body: JSON.stringify(touchMetadata)
                });

                console.log('📡 Collection response status:', response.status);

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
                }

                const responseData = await response.json();
                result = {
                    success: true,
                    resourceId: dsaConfig.resourceId,
                    data: responseData
                };
            } else {
                // For folders, use the existing addFolderMetadata function
                console.log('📝 Using folder metadata endpoint');
                result = await addFolderMetadata(
                    dsaConfig.baseUrl,
                    dsaConfig.resourceId,
                    dsaConfig.token,
                    touchMetadata
                );
            }

            console.log('📝 Metadata update result:', result);

            if (result.success) {
                console.log('✅ Successfully updated resource folder touch indicator');
                console.log('✅ Updated resource:', dsaConfig.resourceId, 'with metadata:', touchMetadata);

                // Verify the metadata was actually applied by fetching it back
                console.log('🔍 Verifying metadata was applied...');
                try {
                    const verifyUrl = isCollection
                        ? `${dsaConfig.baseUrl}/api/v1/collection/${dsaConfig.resourceId}`
                        : `${dsaConfig.baseUrl}/api/v1/folder/${dsaConfig.resourceId}`;

                    const verifyResponse = await fetch(verifyUrl, {
                        headers: { 'Girder-Token': dsaConfig.token }
                    });

                    if (verifyResponse.ok) {
                        const verifyData = await verifyResponse.json();
                        console.log('🔍 Resource metadata after update:', verifyData.meta);
                        console.log('🔍 bdsaWranglerTouch:', verifyData.meta?.bdsaWranglerTouch);
                    } else {
                        console.warn('⚠️ Could not verify metadata update');
                    }
                } catch (verifyError) {
                    console.warn('⚠️ Error verifying metadata update:', verifyError);
                }
            } else {
                console.warn('⚠️ Failed to update resource folder touch indicator:', result.error);
                console.warn('⚠️ This means the resource folder will not show BDSA indicators');
            }

        } catch (error) {
            console.error('❌ Error updating resource folder touch indicator:', error);
            // Don't throw error - this is a non-critical operation
        }
    }
}

// Create singleton instance
const dsaSync = new DsaSync();

export default dsaSync;
