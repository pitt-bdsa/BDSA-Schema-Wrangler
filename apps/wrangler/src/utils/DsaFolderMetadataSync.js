/**
 * DSA Folder Metadata Synchronization Utilities
 * Handles syncing and retrieving various metadata (protocols, mappings, rules) to/from DSA folders
 */

import { addFolderMetadata } from './DsaMetadataManager.js';

/**
 * Syncs stain and region protocols to DSA folder metadata
 * @param {string} baseUrl - DSA base URL
 * @param {string} folderId - DSA folder ID
 * @param {string} girderToken - Authentication token
 * @param {Object} stainProtocols - Array of stain protocols
 * @param {Object} regionProtocols - Array of region protocols
 * @returns {Promise<Object>} Sync result
 */
export const syncProtocolsToFolder = async (baseUrl, folderId, girderToken, stainProtocols, regionProtocols) => {
    try {
        if (!baseUrl || !folderId || !girderToken) {
            throw new Error('Missing required parameters: baseUrl, folderId, or girderToken');
        }

        console.log('🔄 MERGE SYNC - Starting protocols merge:', {
            folderId,
            newStainCount: stainProtocols?.length || 0,
            newRegionCount: regionProtocols?.length || 0
        });

        // CRITICAL: Fetch existing protocols first to avoid overwriting
        const existingProtocols = await getProtocolsFromFolder(baseUrl, folderId, girderToken);

        let mergedStainProtocols = stainProtocols || [];
        let mergedRegionProtocols = regionProtocols || [];
        let stainAddedCount = 0;
        let regionAddedCount = 0;
        let stainSkippedCount = 0;
        let regionSkippedCount = 0;

        if (existingProtocols.success && existingProtocols.protocols) {
            console.log('🔄 MERGE SYNC - Found existing protocols:', {
                existingStainCount: existingProtocols.protocols.stainProtocols?.length || 0,
                existingRegionCount: existingProtocols.protocols.regionProtocols?.length || 0
            });

            // Merge stain protocols
            if (stainProtocols && stainProtocols.length > 0) {
                const existingStainIds = new Set((existingProtocols.protocols.stainProtocols || []).map(p => p.id));
                const newStainProtocols = stainProtocols.filter(protocol => {
                    if (existingStainIds.has(protocol.id)) {
                        console.log(`⏭️ SKIP - Stain protocol already exists: ${protocol.name} (${protocol.id})`);
                        stainSkippedCount++;
                        return false;
                    } else {
                        console.log(`✅ ADD - New stain protocol: ${protocol.name} (${protocol.id})`);
                        stainAddedCount++;
                        return true;
                    }
                });

                mergedStainProtocols = [
                    ...(existingProtocols.protocols.stainProtocols || []),
                    ...newStainProtocols
                ];
            } else {
                mergedStainProtocols = existingProtocols.protocols.stainProtocols || [];
            }

            // Merge region protocols
            if (regionProtocols && regionProtocols.length > 0) {
                const existingRegionIds = new Set((existingProtocols.protocols.regionProtocols || []).map(p => p.id));
                const newRegionProtocols = regionProtocols.filter(protocol => {
                    if (existingRegionIds.has(protocol.id)) {
                        console.log(`⏭️ SKIP - Region protocol already exists: ${protocol.name} (${protocol.id})`);
                        regionSkippedCount++;
                        return false;
                    } else {
                        console.log(`✅ ADD - New region protocol: ${protocol.name} (${protocol.id})`);
                        regionAddedCount++;
                        return true;
                    }
                });

                mergedRegionProtocols = [
                    ...(existingProtocols.protocols.regionProtocols || []),
                    ...newRegionProtocols
                ];
            } else {
                mergedRegionProtocols = existingProtocols.protocols.regionProtocols || [];
            }

        } else {
            console.log('🔄 MERGE SYNC - No existing protocols found, using new protocols only');
            stainAddedCount = stainProtocols?.length || 0;
            regionAddedCount = regionProtocols?.length || 0;
        }

        console.log('🔄 MERGE SYNC - Protocol merge results:', {
            totalStainProtocols: mergedStainProtocols.length,
            totalRegionProtocols: mergedRegionProtocols.length,
            stainAdded: stainAddedCount,
            regionAdded: regionAddedCount,
            stainSkipped: stainSkippedCount,
            regionSkipped: regionSkippedCount
        });

        // Prepare the metadata structure for protocols
        const protocolsMetadata = {
            bdsaProtocols: {
                stainProtocols: mergedStainProtocols,
                regionProtocols: mergedRegionProtocols,
                lastUpdated: new Date().toISOString(),
                source: 'BDSA-Schema-Wrangler',
                version: '1.0',
                mergeStats: {
                    stainAdded: stainAddedCount,
                    regionAdded: regionAddedCount,
                    stainSkipped: stainSkippedCount,
                    regionSkipped: regionSkippedCount
                }
            }
        };

        console.log('Syncing merged protocols to folder metadata:', {
            folderId,
            totalStainCount: mergedStainProtocols.length,
            totalRegionCount: mergedRegionProtocols.length,
            mergeStats: protocolsMetadata.bdsaProtocols.mergeStats
        });

        const result = await addFolderMetadata(baseUrl, folderId, girderToken, protocolsMetadata);

        if (result.success) {
            console.log('Successfully synced merged protocols to folder:', folderId);
            result.mergeStats = protocolsMetadata.bdsaProtocols.mergeStats;
        }

        return result;
    } catch (error) {
        console.error('Error syncing protocols to folder:', error);
        return {
            success: false,
            folderId,
            error: error.message
        };
    }
};



/**
 * Syncs BDSA case ID mappings to DSA folder metadata
 * @param {string} baseUrl - DSA base URL
 * @param {string} folderId - DSA folder ID
 * @param {string} girderToken - Authentication token
 * @param {Object} caseIdMappings - Map or object of localCaseId -> bdsaCaseId mappings
 * @param {string} institutionId - BDSA institution ID
 * @returns {Promise<Object>} Sync result
 */
export const syncCaseIdMappingsToFolder = async (baseUrl, folderId, girderToken, caseIdMappings, institutionId) => {
    try {
        if (!baseUrl || !folderId || !girderToken) {
            throw new Error('Missing required parameters: baseUrl, folderId, or girderToken');
        }

        // Convert caseIdMappings to a serializable format
        let newMappingsArray = [];
        if (caseIdMappings instanceof Map) {
            newMappingsArray = Array.from(caseIdMappings.entries()).map(([localId, bdsaId]) => ({
                localCaseId: localId,
                bdsaCaseId: bdsaId
            }));
        } else if (typeof caseIdMappings === 'object' && caseIdMappings !== null) {
            newMappingsArray = Object.entries(caseIdMappings).map(([localId, bdsaId]) => ({
                localCaseId: localId,
                bdsaCaseId: bdsaId
            }));
        }

        console.log('🔄 MERGE SYNC - Starting case ID mappings merge:', {
            folderId,
            institutionId,
            newMappingsCount: newMappingsArray.length,
            newMappings: newMappingsArray
        });

        // CRITICAL: Fetch existing mappings first to avoid overwriting
        const existingMappings = await getCaseIdMappingsFromFolder(baseUrl, folderId, girderToken);

        let mergedMappings = [];
        let conflicts = [];
        let addedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;

        if (existingMappings.success && existingMappings.mappings) {
            console.log('🔄 MERGE SYNC - Found existing mappings:', {
                existingCount: existingMappings.mappings.length,
                existingMappings: existingMappings.mappings
            });

            // Create a map of existing mappings for quick lookup
            const existingMap = new Map();
            existingMappings.mappings.forEach(mapping => {
                existingMap.set(mapping.localCaseId, mapping.bdsaCaseId);
            });

            // Merge new mappings with existing ones
            newMappingsArray.forEach(newMapping => {
                const existingBdsaId = existingMap.get(newMapping.localCaseId);

                if (existingBdsaId) {
                    if (existingBdsaId === newMapping.bdsaCaseId) {
                        // Same mapping exists - skip
                        console.log(`⏭️ SKIP - Mapping already exists: ${newMapping.localCaseId} -> ${newMapping.bdsaCaseId}`);
                        skippedCount++;
                    } else {
                        // Conflict - different BDSA Case ID for same local ID
                        console.warn(`⚠️ CONFLICT - Different BDSA Case ID for ${newMapping.localCaseId}: existing=${existingBdsaId}, new=${newMapping.bdsaCaseId}`);
                        conflicts.push({
                            localCaseId: newMapping.localCaseId,
                            existingBdsaId,
                            newBdsaId: newMapping.bdsaCaseId
                        });
                        // For now, keep the existing mapping (don't overwrite)
                        skippedCount++;
                    }
                } else {
                    // New mapping - add it
                    console.log(`✅ ADD - New mapping: ${newMapping.localCaseId} -> ${newMapping.bdsaCaseId}`);
                    mergedMappings.push(newMapping);
                    addedCount++;
                }
            });

            // Add all existing mappings that weren't updated
            existingMappings.mappings.forEach(existingMapping => {
                const wasUpdated = newMappingsArray.some(newMapping =>
                    newMapping.localCaseId === existingMapping.localCaseId
                );
                if (!wasUpdated) {
                    mergedMappings.push(existingMapping);
                }
            });

        } else {
            console.log('🔄 MERGE SYNC - No existing mappings found, using new mappings only');
            mergedMappings = newMappingsArray;
            addedCount = newMappingsArray.length;
        }

        console.log('🔄 MERGE SYNC - Merge results:', {
            totalMappings: mergedMappings.length,
            addedCount,
            updatedCount,
            skippedCount,
            conflictsCount: conflicts.length,
            conflicts
        });

        // Prepare the metadata structure for case ID mappings
        const caseIdMetadata = {
            bdsaCaseIdMappings: {
                institutionId: institutionId || '001',
                mappings: mergedMappings,
                lastUpdated: new Date().toISOString(),
                source: 'BDSA-Schema-Wrangler',
                version: '1.0',
                totalMappings: mergedMappings.length,
                mergeStats: {
                    added: addedCount,
                    updated: updatedCount,
                    skipped: skippedCount,
                    conflicts: conflicts.length
                }
            }
        };

        console.log('Syncing merged case ID mappings to folder metadata:', {
            folderId,
            institutionId,
            totalMappings: mergedMappings.length,
            mergeStats: caseIdMetadata.bdsaCaseIdMappings.mergeStats
        });

        const result = await addFolderMetadata(baseUrl, folderId, girderToken, caseIdMetadata);

        if (result.success) {
            console.log('Successfully synced merged case ID mappings to folder:', folderId);
            result.mergeStats = caseIdMetadata.bdsaCaseIdMappings.mergeStats;
            result.conflicts = conflicts;
        }

        return result;
    } catch (error) {
        console.error('Error syncing case ID mappings to folder:', error);
        return {
            success: false,
            folderId,
            error: error.message
        };
    }
};

/**
 * Syncs regex rules to DSA folder metadata
 * @param {string} baseUrl - DSA base URL
 * @param {string} folderId - DSA folder ID
 * @param {string} girderToken - Authentication token
 * @param {Object} regexRules - Regex rules object
 * @param {string} ruleSetName - Optional name for the rule set
 * @returns {Promise<Object>} Sync result
 */
export const syncRegexRulesToFolder = async (baseUrl, folderId, girderToken, regexRules, ruleSetName = '') => {
    try {
        if (!baseUrl || !folderId || !girderToken) {
            throw new Error('Missing required parameters: baseUrl, folderId, or girderToken');
        }

        // Prepare the metadata structure for regex rules
        const regexRulesMetadata = {
            bdsaRegexRules: {
                rules: regexRules || {},
                ruleSetName: ruleSetName || 'custom',
                lastUpdated: new Date().toISOString(),
                source: 'BDSA-Schema-Wrangler',
                version: '1.0'
            }
        };

        console.log('Syncing regex rules to folder metadata:', {
            folderId,
            ruleSetName,
            rulesCount: Object.keys(regexRules || {}).length,
            metadata: regexRulesMetadata
        });

        const result = await addFolderMetadata(baseUrl, folderId, girderToken, regexRulesMetadata);

        if (result.success) {
            console.log('Successfully synced regex rules to folder:', folderId);
        }

        return result;
    } catch (error) {
        console.error('Error syncing regex rules to folder:', error);
        return {
            success: false,
            folderId,
            error: error.message
        };
    }
};

/**
 * Retrieves regex rules from DSA folder metadata
 * @param {string} baseUrl - DSA base URL
 * @param {string} folderId - DSA folder ID
 * @param {string} girderToken - Authentication token
 * @returns {Promise<Object>} Retrieved regex rules or null if not found
 */
export const getRegexRulesFromFolder = async (baseUrl, folderId, girderToken) => {
    try {
        if (!baseUrl || !folderId || !girderToken) {
            throw new Error('Missing required parameters: baseUrl, folderId, or girderToken');
        }

        const apiUrl = `${baseUrl}/api/v1/folder/${folderId}`;
        const headers = {
            'Girder-Token': girderToken
        };

        console.log('Retrieving folder metadata for regex rules:', {
            folderId,
            apiUrl,
            headers: { ...headers, 'Girder-Token': '[REDACTED]' }
        });

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: headers
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to retrieve folder metadata:', {
                status: response.status,
                statusText: response.statusText,
                folderId,
                response: errorText
            });
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        const result = await response.json();

        // Extract regex rules from metadata
        const regexRules = result.meta?.bdsaRegexRules || null;

        if (regexRules) {
            console.log('Successfully retrieved regex rules from folder:', folderId);
        } else {
            console.log('No regex rules found in folder metadata:', folderId);
        }

        return {
            success: true,
            folderId,
            regexRules
        };
    } catch (error) {
        console.error('Error retrieving regex rules from folder:', error);
        return {
            success: false,
            folderId,
            error: error.message,
            regexRules: null
        };
    }
};

/**
 * Syncs column mappings to DSA folder metadata
 * @param {string} baseUrl - DSA base URL
 * @param {string} folderId - DSA folder ID
 * @param {string} girderToken - Authentication token
 * @param {Object} columnMappings - Column mappings object
 * @returns {Promise<Object>} Sync result
 */
export const syncColumnMappingsToFolder = async (baseUrl, folderId, girderToken, columnMappings) => {
    try {
        if (!baseUrl || !folderId || !girderToken) {
            throw new Error('Missing required parameters: baseUrl, folderId, or girderToken');
        }

        // Prepare the metadata structure for column mappings
        const columnMappingsMetadata = {
            bdsaColumnMappings: {
                mappings: columnMappings || {},
                lastUpdated: new Date().toISOString(),
                source: 'BDSA-Schema-Wrangler',
                version: '1.0'
            }
        };

        console.log('Syncing column mappings to folder metadata:', {
            folderId,
            mappingsCount: Object.keys(columnMappings || {}).length,
            metadata: columnMappingsMetadata
        });

        const result = await addFolderMetadata(baseUrl, folderId, girderToken, columnMappingsMetadata);

        if (result.success) {
            console.log('Successfully synced column mappings to folder:', folderId);
        }

        return result;
    } catch (error) {
        console.error('Error syncing column mappings to folder:', error);
        return {
            success: false,
            folderId,
            error: error.message
        };
    }
};

/**
 * Retrieves column mappings from DSA folder metadata
 * @param {string} baseUrl - DSA base URL
 * @param {string} folderId - DSA folder ID
 * @param {string} girderToken - Authentication token
 * @returns {Promise<Object>} Retrieved column mappings or null if not found
 */
export const getColumnMappingsFromFolder = async (baseUrl, folderId, girderToken) => {
    try {
        if (!baseUrl || !folderId || !girderToken) {
            throw new Error('Missing required parameters: baseUrl, folderId, or girderToken');
        }

        const apiUrl = `${baseUrl}/api/v1/folder/${folderId}`;
        const headers = {
            'Girder-Token': girderToken
        };

        console.log('Retrieving folder metadata for column mappings:', {
            folderId,
            apiUrl,
            headers: { ...headers, 'Girder-Token': '[REDACTED]' }
        });

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: headers
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to retrieve folder metadata:', {
                status: response.status,
                statusText: response.statusText,
                folderId,
                response: errorText
            });
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        const result = await response.json();

        // Extract column mappings from metadata
        const columnMappings = result.meta?.bdsaColumnMappings || null;

        if (columnMappings) {
            console.log('Successfully retrieved column mappings from folder:', folderId);
        } else {
            console.log('No column mappings found in folder metadata:', folderId);
        }

        return {
            success: true,
            folderId,
            columnMappings
        };
    } catch (error) {
        console.error('Error retrieving column mappings from folder:', error);
        return {
            success: false,
            folderId,
            error: error.message,
            columnMappings: null
        };
    }
};

/**
 * Retrieves BDSA case ID mappings from DSA folder metadata
 * @param {string} baseUrl - DSA base URL
 * @param {string} folderId - DSA folder ID
 * @param {string} girderToken - Authentication token
 * @returns {Promise<Object>} Retrieved case ID mappings or null if not found
 */
export const getCaseIdMappingsFromFolder = async (baseUrl, folderId, girderToken) => {
    try {
        if (!baseUrl || !folderId || !girderToken) {
            throw new Error('Missing required parameters: baseUrl, folderId, or girderToken');
        }

        const apiUrl = `${baseUrl}/api/v1/folder/${folderId}`;
        const headers = {
            'Girder-Token': girderToken
        };

        console.log('🔍 PULL DEBUG - Retrieving folder metadata for case ID mappings:', {
            folderId,
            apiUrl,
            headers: { ...headers, 'Girder-Token': '[REDACTED]' }
        });

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: headers
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to retrieve folder metadata:', {
                status: response.status,
                statusText: response.statusText,
                folderId,
                response: errorText
            });
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        const result = await response.json();

        // Extract case ID mappings from metadata
        const caseIdMappings = result.meta?.bdsaCaseIdMappings || null;

        if (caseIdMappings) {
            // Check for mixed institution IDs in the retrieved data
            const institutionIds = new Set();
            caseIdMappings.mappings?.forEach(mapping => {
                if (mapping.bdsaCaseId) {
                    const match = mapping.bdsaCaseId.match(/BDSA-(\d{3})-/);
                    if (match) {
                        institutionIds.add(match[1]);
                    }
                }
            });

            console.log('🔍 PULL DEBUG - Successfully retrieved case ID mappings from folder:', {
                folderId,
                totalMappings: caseIdMappings.totalMappings,
                institutionId: caseIdMappings.institutionId,
                foundInstitutionIds: Array.from(institutionIds),
                hasMixedInstitutions: institutionIds.size > 1,
                mappings: caseIdMappings.mappings?.slice(0, 5), // Show first 5 mappings
                allMappings: caseIdMappings.mappings
            });
        } else {
            console.log('🔍 PULL DEBUG - No case ID mappings found in folder metadata:', folderId);
        }

        return {
            success: true,
            folderId,
            caseIdMappings: caseIdMappings || null
        };
    } catch (error) {
        console.error('Error retrieving case ID mappings from folder:', error);
        return {
            success: false,
            folderId,
            error: error.message,
            caseIdMappings: null
        };
    }
};

/**
 * Retrieves protocols from DSA folder metadata
 * @param {string} baseUrl - DSA base URL
 * @param {string} folderId - DSA folder ID
 * @param {string} girderToken - Authentication token
 * @returns {Promise<Object>} Retrieved protocols or null if not found
 */
export const getProtocolsFromFolder = async (baseUrl, folderId, girderToken) => {
    try {
        if (!baseUrl || !folderId || !girderToken) {
            throw new Error('Missing required parameters: baseUrl, folderId, or girderToken');
        }

        const apiUrl = `${baseUrl}/api/v1/folder/${folderId}`;
        const headers = {
            'Girder-Token': girderToken
        };

        console.log('Retrieving folder metadata for protocols:', {
            folderId,
            apiUrl,
            headers: { ...headers, 'Girder-Token': '[REDACTED]' }
        });

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: headers
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to retrieve folder metadata:', {
                status: response.status,
                statusText: response.statusText,
                folderId,
                response: errorText
            });
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        const result = await response.json();

        // Extract protocols from metadata
        const protocols = result.meta?.bdsaProtocols || null;

        if (protocols) {
            console.log('Successfully retrieved protocols from folder:', folderId);
        } else {
            console.log('No protocols found in folder metadata:', folderId);
        }

        return {
            success: true,
            folderId,
            protocols
        };
    } catch (error) {
        console.error('Error retrieving protocols from folder:', error);
        return {
            success: false,
            folderId,
            error: error.message,
            protocols: null
        };
    }
};
