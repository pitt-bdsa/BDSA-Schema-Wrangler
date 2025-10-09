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

        // Prepare the metadata structure for protocols
        const protocolsMetadata = {
            bdsaProtocols: {
                stainProtocols: stainProtocols || [],
                regionProtocols: regionProtocols || [],
                lastUpdated: new Date().toISOString(),
                source: 'BDSA-Schema-Wrangler',
                version: '1.0'
            }
        };

        console.log('Syncing protocols to folder metadata:', {
            folderId,
            stainProtocolCount: stainProtocols?.length || 0,
            regionProtocolCount: regionProtocols?.length || 0,
            metadata: protocolsMetadata
        });

        const result = await addFolderMetadata(baseUrl, folderId, girderToken, protocolsMetadata);

        if (result.success) {
            console.log('Successfully synced protocols to folder:', folderId);
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
 * Syncs approved protocols list to DSA folder metadata
 * @param {string} baseUrl - DSA base URL
 * @param {string} folderId - DSA folder ID
 * @param {string} girderToken - Authentication token
 * @param {Array} approvedStainProtocols - Array of approved stain protocol IDs
 * @param {Array} approvedRegionProtocols - Array of approved region protocol IDs
 * @returns {Promise<Object>} Sync result
 */
export const syncApprovedProtocolsToFolder = async (baseUrl, folderId, girderToken, approvedStainProtocols, approvedRegionProtocols) => {
    try {
        if (!baseUrl || !folderId || !girderToken) {
            throw new Error('Missing required parameters: baseUrl, folderId, or girderToken');
        }

        // Prepare the metadata structure for approved protocols
        const approvedProtocolsMetadata = {
            bdsaApprovedProtocols: {
                stainProtocols: approvedStainProtocols || [],
                regionProtocols: approvedRegionProtocols || [],
                lastUpdated: new Date().toISOString(),
                source: 'BDSA-Schema-Wrangler',
                version: '1.0'
            }
        };

        console.log('Syncing approved protocols to folder metadata:', {
            folderId,
            approvedStainCount: approvedStainProtocols?.length || 0,
            approvedRegionCount: approvedRegionProtocols?.length || 0,
            metadata: approvedProtocolsMetadata
        });

        const result = await addFolderMetadata(baseUrl, folderId, girderToken, approvedProtocolsMetadata);

        if (result.success) {
            console.log('Successfully synced approved protocols to folder:', folderId);
        }

        return result;
    } catch (error) {
        console.error('Error syncing approved protocols to folder:', error);
        return {
            success: false,
            folderId,
            error: error.message
        };
    }
};

/**
 * Retrieves approved protocols list from DSA folder metadata
 * @param {string} baseUrl - DSA base URL
 * @param {string} folderId - DSA folder ID
 * @param {string} girderToken - Authentication token
 * @returns {Promise<Object>} Retrieved approved protocols or null if not found
 */
export const getApprovedProtocolsFromFolder = async (baseUrl, folderId, girderToken) => {
    try {
        if (!baseUrl || !folderId || !girderToken) {
            throw new Error('Missing required parameters: baseUrl, folderId, or girderToken');
        }

        const apiUrl = `${baseUrl}/api/v1/folder/${folderId}`;
        const headers = {
            'Girder-Token': girderToken
        };

        console.log('Retrieving folder metadata for approved protocols:', {
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

        // Extract approved protocols from metadata
        const approvedProtocols = result.meta?.bdsaApprovedProtocols || null;

        if (approvedProtocols) {
            console.log('Successfully retrieved approved protocols from folder:', folderId);
        } else {
            console.log('No approved protocols found in folder metadata:', folderId);
        }

        return {
            success: true,
            folderId,
            approvedProtocols
        };
    } catch (error) {
        console.error('Error retrieving approved protocols from folder:', error);
        return {
            success: false,
            folderId,
            error: error.message,
            approvedProtocols: null
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
        let mappingsArray = [];
        if (caseIdMappings instanceof Map) {
            mappingsArray = Array.from(caseIdMappings.entries()).map(([localId, bdsaId]) => ({
                localCaseId: localId,
                bdsaCaseId: bdsaId
            }));
        } else if (typeof caseIdMappings === 'object' && caseIdMappings !== null) {
            mappingsArray = Object.entries(caseIdMappings).map(([localId, bdsaId]) => ({
                localCaseId: localId,
                bdsaCaseId: bdsaId
            }));
        }

        // Prepare the metadata structure for case ID mappings
        const caseIdMetadata = {
            bdsaCaseIdMappings: {
                institutionId: institutionId || '001',
                mappings: mappingsArray,
                lastUpdated: new Date().toISOString(),
                source: 'BDSA-Schema-Wrangler',
                version: '1.0',
                totalMappings: mappingsArray.length
            }
        };

        console.log('Syncing case ID mappings to folder metadata:', {
            folderId,
            institutionId,
            mappingCount: mappingsArray.length,
            metadata: caseIdMetadata
        });

        const result = await addFolderMetadata(baseUrl, folderId, girderToken, caseIdMetadata);

        if (result.success) {
            console.log('Successfully synced case ID mappings to folder:', folderId);
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

        console.log('Retrieving folder metadata for case ID mappings:', {
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
            console.log('Successfully retrieved case ID mappings from folder:', folderId);
        } else {
            console.log('No case ID mappings found in folder metadata:', folderId);
        }

        return {
            success: true,
            folderId,
            caseIdMappings
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
