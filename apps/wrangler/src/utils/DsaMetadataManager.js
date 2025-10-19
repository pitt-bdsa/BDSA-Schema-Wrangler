/**
 * DSA Metadata Management Utilities
 * Handles metadata operations for DSA items and folders
 */

/**
 * Resolves protocol references (GUIDs or names) to protocol NAMES for DSA storage
 * GUIDs are used internally for tracking, but DSA stores human-readable names
 * @param {Array<string>} protocolRefs - Array of protocol references (GUIDs or names)
 * @param {string} protocolType - 'stain' or 'region'
 * @param {Object} protocolStore - Protocol store instance
 * @returns {Array<string>} Array of protocol names
 */
const resolveProtocolToNames = (protocolRefs, protocolType, protocolStore) => {
    if (!Array.isArray(protocolRefs) || protocolRefs.length === 0) {
        return [];
    }

    return protocolRefs.map(ref => {
        // Check if this looks like a GUID (STAIN_xxxxx or REGION_xxxxx)
        const isGuid = /^(STAIN|REGION)_[a-z0-9]{6}$/.test(ref);

        if (isGuid) {
            // Resolve GUID to name
            const protocols = protocolType === 'stain'
                ? protocolStore.stainProtocols
                : protocolStore.regionProtocols;
            const protocol = protocols.find(p => p.id === ref);

            if (protocol) {
                console.log(`✅ Resolved protocol GUID ${ref} → ${protocol.name}`);
                return protocol.name;
            } else {
                console.warn(`⚠️ Protocol GUID ${ref} not found in ${protocolType} protocols, using as-is`);
                return ref; // Fallback to GUID if not found
            }
        } else {
            // Already a name, use as-is
            return ref;
        }
    });
};

/**
 * Adds/updates specific metadata fields for a single DSA item using the add metadata endpoint
 * This only updates the specified metadata fields without replacing the entire metadata object
 * @param {string} baseUrl - DSA base URL
 * @param {string} itemId - DSA item ID
 * @param {string} girderToken - Authentication token
 * @param {Object} metadata - Metadata fields to add/update (only meta.BDSA.* fields)
 * @returns {Promise<Object>} Update result
 */
export const addItemMetadata = async (baseUrl, itemId, girderToken, metadata) => {
    try {
        if (!baseUrl || !itemId || !girderToken) {
            throw new Error('Missing required parameters: baseUrl, itemId, or girderToken');
        }

        // Ensure we're sending the BDSA metadata structure (stripping off meta. prefix)
        // The server stores it as meta.BDSA.{} but we send just BDSA.{}
        let bdsaMetadata = {};

        // If metadata has a BDSA key, use it directly (this is what we want)
        if (metadata.BDSA) {
            bdsaMetadata = metadata;
        } else {
            // Otherwise, wrap the metadata in BDSA structure
            bdsaMetadata = { BDSA: metadata };
        }

        if (!bdsaMetadata.BDSA || Object.keys(bdsaMetadata.BDSA).length === 0) {
            console.log('No BDSA metadata fields to update for item:', itemId);
            return {
                success: true,
                itemId,
                skipped: true,
                reason: 'No BDSA metadata fields to update'
            };
        }

        const apiUrl = `${baseUrl}/api/v1/item/${itemId}/metadata`;
        const headers = {
            'Content-Type': 'application/json',
            'Girder-Token': girderToken
        };

        console.log('Adding BDSA metadata to item (sending BDSA.{} which becomes meta.BDSA.{} on server):', {
            itemId,
            apiUrl,
            bdsaMetadata,
            bdsaStructure: bdsaMetadata.BDSA,
            headers: { ...headers, 'Girder-Token': '[REDACTED]' }
        });

        // Use PUT to update metadata fields
        // Just send the BDSA.{} object - the server will handle it properly
        const response = await fetch(apiUrl, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify(bdsaMetadata)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to add BDSA metadata to item:', {
                status: response.status,
                statusText: response.statusText,
                itemId,
                response: errorText
            });
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log('Successfully added BDSA metadata to item:', itemId, bdsaMetadata);
        return {
            success: true,
            itemId,
            data: result,
            updatedFields: Object.keys(bdsaMetadata)
        };
    } catch (error) {
        console.error('Error adding BDSA metadata to item:', error);
        return {
            success: false,
            itemId,
            error: error.message
        };
    }
};

/**
 * Legacy function - kept for backward compatibility but now uses addItemMetadata
 * @deprecated Use addItemMetadata instead
 */
export const updateItemMetadata = async (baseUrl, itemId, girderToken, metadata) => {
    console.warn('updateItemMetadata is deprecated. Use addItemMetadata for BDSA metadata updates.');
    return addItemMetadata(baseUrl, itemId, girderToken, metadata);
};

/**
 * Adds/updates specific metadata fields for a DSA folder using the add metadata endpoint
 * This only updates the specified metadata fields without replacing the entire metadata object
 * @param {string} baseUrl - DSA base URL
 * @param {string} folderId - DSA folder ID
 * @param {string} girderToken - Authentication token
 * @param {Object} metadata - Metadata fields to add/update
 * @returns {Promise<Object>} Update result
 */
export const addFolderMetadata = async (baseUrl, folderId, girderToken, metadata) => {
    try {
        if (!baseUrl || !folderId || !girderToken) {
            throw new Error('Missing required parameters: baseUrl, folderId, or girderToken');
        }

        if (!metadata || Object.keys(metadata).length === 0) {
            console.log('No metadata fields to update for folder:', folderId);
            return {
                success: true,
                folderId,
                skipped: true,
                reason: 'No metadata fields to update'
            };
        }

        const apiUrl = `${baseUrl}/api/v1/folder/${folderId}/metadata`;
        const headers = {
            'Content-Type': 'application/json',
            'Girder-Token': girderToken
        };

        console.log('Adding metadata to folder:', {
            folderId,
            apiUrl,
            metadata,
            headers: { ...headers, 'Girder-Token': '[REDACTED]' }
        });

        // Use PUT to update metadata fields
        const response = await fetch(apiUrl, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify(metadata)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to update folder metadata:', {
                status: response.status,
                statusText: response.statusText,
                folderId,
                response: errorText
            });
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log('Successfully updated metadata for folder:', folderId);
        return {
            success: true,
            folderId,
            data: result
        };
    } catch (error) {
        console.error('Error updating folder metadata:', error);
        return {
            success: false,
            folderId,
            error: error.message
        };
    }
};

/**
 * Syncs BDSA metadata for a single item to the DSA server
 * @param {string} baseUrl - DSA base URL
 * @param {Object} item - Data item with BDSA metadata
 * @param {string} girderToken - Authentication token
 * @param {Object} columnMapping - Column mapping configuration
 * @param {Function} isCancelled - Function to check if sync is cancelled
 * @returns {Promise<Object>} Sync result
 */
export const syncItemBdsaMetadata = async (baseUrl, item, girderToken, columnMapping, isCancelled = null) => {
    try {
        // Check for cancellation at the start
        if (isCancelled && isCancelled()) {
            console.log(`🚫 Sync cancelled for item ${item._id || item.dsa_id}`);
            return {
                success: false,
                itemId: item._id || item.dsa_id || 'unknown',
                cancelled: true,
                reason: 'Sync cancelled by user'
            };
        }

        // Use the transformed id field (which matches what's in modifiedItems)
        const itemId = item.id || item._id || item.dsa_id;
        if (!itemId) {
            throw new Error('No item ID found in data item');
        }

        // Extract BDSA metadata values from the BDSA.bdsaLocal namespace (authoritative source)
        const localCaseId = item.BDSA?.bdsaLocal?.localCaseId || item[columnMapping.localCaseId] || '';
        const localStainID = item.BDSA?.bdsaLocal?.localStainID || item[columnMapping.localStainID] || '';
        const localRegionId = item.BDSA?.bdsaLocal?.localRegionId || item[columnMapping.localRegionId] || '';
        const bdsaCaseId = item.BDSA?.bdsaLocal?.bdsaCaseId || '';

        // Get protocol references (may be GUIDs or names)
        const bdsaStainProtocolRefs = item.BDSA?.bdsaLocal?.bdsaStainProtocol || [];
        const bdsaRegionProtocolRefs = item.BDSA?.bdsaLocal?.bdsaRegionProtocol || [];

        // Resolve protocol references to NAMES for DSA storage (GUIDs are internal only)
        const { default: protocolStore } = await import('./protocolStore.js');
        const bdsaStainProtocol = resolveProtocolToNames(bdsaStainProtocolRefs, 'stain', protocolStore);
        const bdsaRegionProtocol = resolveProtocolToNames(bdsaRegionProtocolRefs, 'region', protocolStore);

        console.log(`🔍 SYNC VALUES - Item ${itemId}:`, {
            localCaseId,
            localStainID,
            localRegionId,
            bdsaCaseId,
            bdsaStainProtocol,
            bdsaRegionProtocol,
            hasBDSAObject: !!item.BDSA,
            hasBdsaLocal: !!item.BDSA?.bdsaLocal,
            bdsaObject: item.BDSA,
            bdsaLocalObject: item.BDSA?.bdsaLocal,
            columnMapping: columnMapping
        });

        // Create bdsaLocal metadata object
        const bdsaLocal = {
            localCaseId,
            localStainID,
            localRegionId,
            bdsaCaseId,
            bdsaStainProtocol,
            bdsaRegionProtocol,
            lastUpdated: new Date().toISOString(),
            source: 'BDSA-Schema-Wrangler'
        };

        // Only sync if we have at least one local value, bdsaCaseId, or protocol arrays
        const hasProtocols = (Array.isArray(bdsaStainProtocol) && bdsaStainProtocol.length > 0) ||
            (Array.isArray(bdsaRegionProtocol) && bdsaRegionProtocol.length > 0);

        if (!localCaseId && !localStainID && !localRegionId && !bdsaCaseId && !hasProtocols) {
            console.log(`🚨 SYNC SKIP - Item ${itemId} has no local metadata values:`, {
                localCaseId,
                localStainID,
                localRegionId,
                bdsaCaseId,
                bdsaStainProtocol,
                bdsaRegionProtocol,
                hasProtocols,
                itemBDSA: item.BDSA,
                columnMapping: columnMapping
            });
            return {
                success: false,
                itemId,
                skipped: true,
                reason: 'No local metadata values to sync'
            };
        }

        // Check if this item has been modified since last sync
        const existingMetadata = item.meta?.bdsaLocal;
        const { default: dataStore } = await import('./dataStore');
        const hasBeenModified = dataStore.modifiedItems.has(itemId);

        console.log(`🔍 SYNC DEBUG - Item ${itemId}:`, {
            hasExistingMetadata: !!existingMetadata,
            existingMetadata,
            hasBeenModified,
            localCaseId,
            localStainID,
            localRegionId,
            bdsaCaseId,
            bdsaStainProtocol,
            bdsaRegionProtocol
        });

        if (existingMetadata) {
            // Normalize both values for comparison - handle arrays and strings
            const normalizeForComparison = (value) => {
                if (Array.isArray(value)) {
                    return value.sort().join(','); // Sort to handle order differences
                }
                return (value || '').toString();
            };

            const hasChanges =
                existingMetadata.localCaseId !== localCaseId ||
                normalizeForComparison(existingMetadata.localStainID) !== normalizeForComparison(localStainID) ||
                normalizeForComparison(existingMetadata.localRegionId) !== normalizeForComparison(localRegionId) ||
                existingMetadata.bdsaCaseId !== bdsaCaseId ||
                normalizeForComparison(existingMetadata.bdsaStainProtocol) !== normalizeForComparison(bdsaStainProtocol) ||
                normalizeForComparison(existingMetadata.bdsaRegionProtocol) !== normalizeForComparison(bdsaRegionProtocol);

            console.log(`Skip check for item ${itemId}:`, {
                existingMetadata: {
                    localCaseId: existingMetadata.localCaseId,
                    localStainID: existingMetadata.localStainID,
                    localRegionId: existingMetadata.localRegionId,
                    bdsaCaseId: existingMetadata.bdsaCaseId,
                    bdsaStainProtocol: existingMetadata.bdsaStainProtocol,
                    bdsaRegionProtocol: existingMetadata.bdsaRegionProtocol
                },
                newValues: { localCaseId, localStainID, localRegionId, bdsaCaseId, bdsaStainProtocol, bdsaRegionProtocol },
                hasChanges,
                hasBeenModified,
                willSkip: !hasChanges && !hasBeenModified
            });

            if (!hasChanges && !hasBeenModified) {
                return {
                    success: false,
                    itemId,
                    skipped: true,
                    reason: 'No changes detected since last sync'
                };
            }
        }

        // Check for cancellation before making API call
        if (isCancelled && isCancelled()) {
            console.log(`🚫 Sync cancelled before API call for item ${itemId}`);
            return {
                success: false,
                itemId,
                cancelled: true,
                reason: 'Sync cancelled by user before API call'
            };
        }

        // Update the item's metadata with BDSA structure
        // This will create/update meta.BDSA.bdsaLocal on the server
        const metadata = { BDSA: { bdsaLocal } };

        console.log(`🔄 Making API call for item ${itemId}:`, {
            baseUrl,
            itemId,
            metadata,
            hasToken: !!girderToken
        });

        const result = await updateItemMetadata(baseUrl, itemId, girderToken, metadata);

        if (result.success) {
            console.log(`✅ Successfully synced bdsaLocal metadata for item ${itemId}:`, bdsaLocal);
        } else {
            console.error(`❌ Failed to sync item ${itemId}:`, result);
        }

        return result;
    } catch (error) {
        console.error('Error syncing BDSA metadata for item:', error);
        return {
            success: false,
            itemId: item._id || item.dsa_id || 'unknown',
            error: error.message
        };
    }
};

/**
 * Syncs all BDSA metadata to DSA server using batch processing
 * @param {string} baseUrl - DSA base URL
 * @param {Array} items - Array of items to sync
 * @param {string} girderToken - Authentication token
 * @param {Object} columnMapping - Column mapping configuration
 * @param {Function} progressCallback - Progress callback function
 * @param {Object} processorRef - Reference to store processor instance
 * @returns {Promise<Object>} Sync result
 */
export const syncAllBdsaMetadata = async (baseUrl, items, girderToken, columnMapping, progressCallback = null, processorRef = null) => {
    console.log('Starting sync of BDSA metadata to DSA server:', {
        itemCount: items.length,
        baseUrl,
        columnMapping
    });

    // Import DsaBatchProcessor dynamically to avoid circular dependencies
    const { DsaBatchProcessor } = await import('./DsaBatchProcessor.js');

    const processor = new DsaBatchProcessor(baseUrl, girderToken, {
        batchSize: 5, // Conservative batch size
        delayBetweenBatches: 1000, // 1 second between batches
        retryAttempts: 3
    });

    // Store processor reference for cancellation
    if (processorRef) {
        processorRef.current = processor;
    }

    if (progressCallback) {
        processor.onProgress(progressCallback);
    }

    return await processor.processBatch(items, columnMapping, syncItemBdsaMetadata);
};
