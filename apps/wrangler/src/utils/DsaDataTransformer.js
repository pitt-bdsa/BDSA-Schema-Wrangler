/**
 * DSA Data Transformation Utilities
 * Handles data transformation, filtering, and metadata enhancement for DSA data
 */

/**
 * Flattens nested objects recursively
 * @param {Object} obj - The object to flatten
 * @param {string} prefix - The prefix for nested keys
 * @returns {Object} Flattened object
 */
export const flattenObject = (obj, prefix = '') => {
    const flattened = {};

    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const newKey = prefix ? `${prefix}_${key}` : key;

            if (obj[key] !== null && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
                // Recursively flatten nested objects
                Object.assign(flattened, flattenObject(obj[key], newKey));
            } else if (Array.isArray(obj[key])) {
                // Handle arrays - convert to comma-separated string or keep as array
                flattened[newKey] = obj[key].join(', ');
            } else {
                // Handle primitive values
                flattened[newKey] = obj[key];
            }
        }
    }

    return flattened;
};

/**
 * Filters files by extension to skip unwanted file types
 * @param {Array} dsaData - Raw DSA API response data
 * @returns {Object} Object with filteredData and skipStats
 */
export const filterFilesByExtension = (dsaData) => {
    // Define allowed file extensions (case-insensitive)
    const allowedExtensions = [
        'czi', 'mrxs', 'ndpi', 'tiff', 'svs', 'tif', 'png', 'jpg', 'jpeg'
    ];

    const skipStats = {
        totalSkipped: 0,
        extensions: {},
        skippedFiles: []
    };

    const filteredData = dsaData.filter(item => {
        const fileName = item.name || item._id || '';
        const extension = fileName.split('.').pop()?.toLowerCase();

        // Debug logging for first few items (disabled to reduce console spam)
        // if (skipStats.totalSkipped < 10) {
        //     console.log(`🔍 File filtering debug: "${fileName}" -> extension: "${extension}" -> allowed: ${allowedExtensions.includes(extension)}`);
        // }

        // If no extension, keep the file (might be a folder or special item)
        if (!extension) {
            return true;
        }

        if (allowedExtensions.includes(extension)) {
            return true; // Keep the file
        } else {
            // Skip the file and track stats
            skipStats.totalSkipped++;
            skipStats.extensions[extension] = (skipStats.extensions[extension] || 0) + 1;
            skipStats.skippedFiles.push(fileName);
            return false;
        }
    });

    // Log filtering results
    console.log(`📁 File filtering: ${filteredData.length} files kept out of ${dsaData.length} total files`);

    // Show sample of file names for debugging
    if (dsaData.length > 0) {
        console.log('📁 Sample file names from DSA:', dsaData.slice(0, 10).map(item => item.name || item._id || 'unnamed'));
        console.log('📁 Sample file extensions:', dsaData.slice(0, 10).map(item => {
            const fileName = item.name || item._id || '';
            return fileName.split('.').pop()?.toLowerCase() || 'no-extension';
        }));
    }

    // Check if filtering is working
    if (filteredData.length === dsaData.length) {
        console.warn('⚠️ No files were filtered! All files match allowed extensions.');
        console.warn('💡 This might cause localStorage quota issues with large datasets.');

        // If no filtering happened, limit to first 10,000 items to prevent quota issues
        if (filteredData.length > 10000) {
            console.warn('⚠️ Limiting to first 10,000 items to prevent quota issues');
            filteredData.splice(10000);
        }
    } else {
        console.log(`✅ File filtering working: ${((dsaData.length - filteredData.length) / dsaData.length * 100).toFixed(1)}% of files filtered out`);
    }

    // Debug: Show what we actually got
    console.log(`🔍 Final result: ${filteredData.length} items after filtering`);
    if (filteredData.length > 0) {
        console.log('🔍 Sample of filtered items:', filteredData.slice(0, 3).map(item => ({
            name: item.name || item._id || 'unnamed',
            type: item.type || 'unknown'
        })));
    } else {
        console.warn('⚠️ No items left after filtering! This might be why the table is empty.');
    }

    if (skipStats.totalSkipped > 0) {
        console.log(`📁 File filtering applied: ${skipStats.totalSkipped} files skipped out of ${dsaData.length} total files`);
        console.log('Skipped file extensions:', skipStats.extensions);

        // Show top 10 skipped files as examples
        const exampleSkipped = skipStats.skippedFiles.slice(0, 10);
        if (exampleSkipped.length > 0) {
            console.log('Example skipped files:', exampleSkipped);
        }
    } else {
        console.log('📁 No files were filtered - all files match allowed extensions');
    }

    return { filteredData, skipStats };
};

/**
 * Reads existing bdsaLocal metadata from DSA items to avoid re-processing
 * @param {Array} dsaData - Raw DSA data from API
 * @returns {Array} DSA data enhanced with existing bdsaLocal metadata
 */
export const enhanceDataWithExistingMetadata = (dsaData) => {
    console.log('🔍 Enhancing DSA data with existing metadata...');

    let itemsWithMetadata = 0;
    let itemsWithBdsaMetadata = 0;

    const enhanced = dsaData.map((item, index) => {
        const enhancedItem = { ...item };

        // Check for meta.bdsaLocal (old format)
        if (item.meta && item.meta.bdsaLocal) {
            const bdsaLocal = item.meta.bdsaLocal;
            console.log(`✅ Found meta.bdsaLocal for item ${item._id}:`, bdsaLocal);

            if (!enhancedItem.BDSA) {
                enhancedItem.BDSA = {};
            }
            if (!enhancedItem.BDSA.bdsaLocal) {
                enhancedItem.BDSA.bdsaLocal = {};
            }

            enhancedItem.BDSA.bdsaLocal.localCaseId = bdsaLocal.localCaseId || enhancedItem.BDSA.bdsaLocal.localCaseId || '';
            enhancedItem.BDSA.bdsaLocal.localStainID = bdsaLocal.localStainID || enhancedItem.BDSA.bdsaLocal.localStainID || '';
            enhancedItem.BDSA.bdsaLocal.localRegionId = bdsaLocal.localRegionId || enhancedItem.BDSA.bdsaLocal.localRegionId || '';
            enhancedItem.BDSA.bdsaLocal.bdsaCaseId = bdsaLocal.bdsaCaseId || enhancedItem.BDSA.bdsaLocal.bdsaCaseId || '';
            enhancedItem.BDSA.bdsaLocal.bdsaStainProtocol = bdsaLocal.bdsaStainProtocol || enhancedItem.BDSA.bdsaLocal.bdsaStainProtocol || [];
            enhancedItem.BDSA.bdsaLocal.bdsaRegionProtocol = bdsaLocal.bdsaRegionProtocol || enhancedItem.BDSA.bdsaLocal.bdsaRegionProtocol || [];
            enhancedItem.BDSA.bdsaLocal.bdsaSectioningProtocol = bdsaLocal.bdsaSectioningProtocol || enhancedItem.BDSA.bdsaLocal.bdsaSectioningProtocol || '';
            enhancedItem.BDSA.bdsaLocal.bdsaSectioningProtocolId = bdsaLocal.bdsaSectioningProtocolId || enhancedItem.BDSA.bdsaLocal.bdsaSectioningProtocolId || '';
            if (bdsaLocal.fieldSource && typeof bdsaLocal.fieldSource === 'object') {
                enhancedItem.BDSA._dataSource = { ...bdsaLocal.fieldSource };
            }

            enhancedItem._hasServerMetadata = true;
            enhancedItem._serverMetadataSource = 'meta.bdsaLocal';
            enhancedItem._serverMetadataLastUpdated = bdsaLocal.lastUpdated;
            itemsWithMetadata++;
        }
        // Check for meta.BDSA.bdsaLocal (new format)
        else if (item.meta && item.meta.BDSA && item.meta.BDSA.bdsaLocal) {
            const bdsaLocal = item.meta.BDSA.bdsaLocal;
            console.log(`✅ Found meta.BDSA.bdsaLocal for item ${item._id}:`, bdsaLocal);

            if (!enhancedItem.BDSA) {
                enhancedItem.BDSA = {};
            }
            if (!enhancedItem.BDSA.bdsaLocal) {
                enhancedItem.BDSA.bdsaLocal = {};
            }

            enhancedItem.BDSA.bdsaLocal.localCaseId = bdsaLocal.localCaseId || enhancedItem.BDSA.bdsaLocal.localCaseId || '';
            enhancedItem.BDSA.bdsaLocal.localStainID = bdsaLocal.localStainID || enhancedItem.BDSA.bdsaLocal.localStainID || '';
            enhancedItem.BDSA.bdsaLocal.localRegionId = bdsaLocal.localRegionId || enhancedItem.BDSA.bdsaLocal.localRegionId || '';
            enhancedItem.BDSA.bdsaLocal.bdsaCaseId = bdsaLocal.bdsaCaseId || enhancedItem.BDSA.bdsaLocal.bdsaCaseId || '';
            enhancedItem.BDSA.bdsaLocal.bdsaStainProtocol = bdsaLocal.bdsaStainProtocol || enhancedItem.BDSA.bdsaLocal.bdsaStainProtocol || [];
            enhancedItem.BDSA.bdsaLocal.bdsaRegionProtocol = bdsaLocal.bdsaRegionProtocol || enhancedItem.BDSA.bdsaLocal.bdsaRegionProtocol || [];
            enhancedItem.BDSA.bdsaLocal.bdsaSectioningProtocol = bdsaLocal.bdsaSectioningProtocol || enhancedItem.BDSA.bdsaLocal.bdsaSectioningProtocol || '';
            enhancedItem.BDSA.bdsaLocal.bdsaSectioningProtocolId = bdsaLocal.bdsaSectioningProtocolId || enhancedItem.BDSA.bdsaLocal.bdsaSectioningProtocolId || '';
            if (bdsaLocal.fieldSource && typeof bdsaLocal.fieldSource === 'object') {
                enhancedItem.BDSA._dataSource = { ...bdsaLocal.fieldSource };
            }

            enhancedItem._hasServerMetadata = true;
            enhancedItem._serverMetadataSource = 'meta.BDSA.bdsaLocal';
            enhancedItem._serverMetadataLastUpdated = bdsaLocal.lastUpdated;
            itemsWithBdsaMetadata++;
        }

        // Debug first item structure
        if (index === 0) {
            console.log('🔍 First item structure:', {
                itemId: item._id,
                hasMeta: !!item.meta,
                metaKeys: item.meta ? Object.keys(item.meta) : [],
                hasBdsaLocal: !!(item.meta?.bdsaLocal),
                hasMetaBDSA: !!(item.meta?.BDSA),
                metaBDSAKeys: item.meta?.BDSA ? Object.keys(item.meta.BDSA) : [],
                hasMetaBDSAbdsaLocal: !!(item.meta?.BDSA?.bdsaLocal)
            });
        }

        return enhancedItem;
    });

    console.log(`📊 Metadata import summary: ${itemsWithMetadata} items with meta.bdsaLocal, ${itemsWithBdsaMetadata} items with meta.BDSA.bdsaLocal`);

    return enhanced;
};

/**
 * Transforms DSA API response data to match expected format
 * @param {Array} dsaData - Raw DSA API response data
 * @returns {Array} Transformed and flattened data
 */
export const transformDsaData = (dsaData) => {
    // This function will transform DSA API response to match your expected data format
    // and flatten nested JSON dictionaries
    console.log('🚀🚀🚀 TRANSFORM DEBUG: transformDsaData called with', dsaData?.length, 'items');
    console.log('🚀🚀🚀 TRANSFORM DEBUG: First item keys:', dsaData?.[0] ? Object.keys(dsaData[0]) : 'no items');

    if (!dsaData || !Array.isArray(dsaData)) {
        console.log('❌ TRANSFORM DEBUG: No valid data provided');
        return [];
    }

    // First, enhance data with existing server metadata
    const enhancedData = enhanceDataWithExistingMetadata(dsaData);

    // Apply file extension filtering
    const { filteredData, skipStats } = filterFilesByExtension(enhancedData);

    console.log('🔍 TRANSFORM DEBUG: About to process', filteredData.length, 'filtered items');

    const transformedData = filteredData.map((item, index) => {
        // Debug: Log raw data structure for first few items
        if (index < 3) {
            console.log(`🔍 Raw item ${index} structure:`, {
                hasMeta: !!item.meta,
                metaKeys: item.meta ? Object.keys(item.meta) : [],
                hasNpClinical: !!(item.meta && item.meta.npClinical),
                npClinicalKeys: item.meta && item.meta.npClinical ? Object.keys(item.meta.npClinical) : []
            });

            // Debug: Check if meta.npClinical has actual data
            if (item.meta && item.meta.npClinical) {
                console.log(`🔍 Raw item ${index} meta.npClinical sample:`, {
                    keys: Object.keys(item.meta.npClinical).slice(0, 5),
                    sampleValues: Object.keys(item.meta.npClinical).slice(0, 3).map(key => ({
                        key,
                        value: item.meta.npClinical[key],
                        type: typeof item.meta.npClinical[key]
                    }))
                });
            }
        }

        // Flatten the entire item, including nested objects
        const flattenedItem = flattenObject(item);

        // CRITICAL: Remove BDSA-related fields from flattened data to prevent duplicates
        // We manage BDSA data separately in the BDSA.* structure, so don't include meta.BDSA.* or meta.bdsaLocal.*
        // This prevents the column filtering from showing duplicate columns like:
        // - meta.BDSA.bdsaLocal.localCaseId (from DSA) vs BDSA.bdsaLocal.localCaseId (our managed field)
        // - meta.BDSA.bdsaLocal.bdsaStainProtocol (from DSA) vs BDSA.bdsaLocal.bdsaStainProtocol (our managed field)
        const cleanedFlattenedItem = {};
        for (const key in flattenedItem) {
            // Skip any BDSA-related metadata fields that we manage separately
            if (!key.startsWith('meta.BDSA.') &&
                !key.startsWith('meta.bdsaLocal.') &&
                !key.startsWith('BDSA.')) {
                cleanedFlattenedItem[key] = flattenedItem[key];
            }
        }

        console.log(`🔍 Cleaned flattened data - removed BDSA fields to prevent duplicates`);
        console.log(`🔍 Sample flattened fields:`, Object.keys(cleanedFlattenedItem).slice(0, 20));
        console.log(`🔍 Sample meta.npClinical fields:`, Object.keys(cleanedFlattenedItem).filter(key => key.startsWith('meta.npClinical')).slice(0, 10));

        // Debug: Check if the flattened data has actual values
        const sampleValues = Object.keys(cleanedFlattenedItem).map(key => ({
            key,
            value: cleanedFlattenedItem[key],
            type: typeof cleanedFlattenedItem[key]
        }));
        console.log(`🔍 ALL flattened values:`, sampleValues);

        // Add some common field mappings for compatibility
        const transformedItem = {
            // Map common fields to expected names
            name: cleanedFlattenedItem.name || cleanedFlattenedItem._id || cleanedFlattenedItem.id || '',
            // Use server metadata if available, otherwise fall back to existing metadata
            localCaseId: item.localCaseId || cleanedFlattenedItem['meta.caseId'] || cleanedFlattenedItem['meta.localCaseId'] || cleanedFlattenedItem.caseId || cleanedFlattenedItem.localCaseId || '',
            localStainID: item.localStainID || cleanedFlattenedItem['meta.stainId'] || cleanedFlattenedItem['meta.localStainID'] || cleanedFlattenedItem.stainId || cleanedFlattenedItem.localStainID || '',
            localRegionId: item.localRegionId || cleanedFlattenedItem['meta.regionId'] || cleanedFlattenedItem['meta.localRegionId'] || cleanedFlattenedItem.regionId || cleanedFlattenedItem.localRegionId || '',

            // Include cleaned flattened fields (BDSA fields excluded)
            ...cleanedFlattenedItem,

            // Create a consistent row identifier (must be set AFTER spreading cleanedFlattenedItem to override any existing id)
            id: cleanedFlattenedItem._id || cleanedFlattenedItem.id || `dsa_item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,

            // Preserve BDSA structure from enhanceDataWithExistingMetadata (don't flatten it)
            BDSA: item.BDSA || undefined,

            // Preserve server metadata markers (only if they actually exist)
            ...(item._hasServerMetadata ? {
                _hasServerMetadata: item._hasServerMetadata,
                _serverMetadataSource: item._serverMetadataSource,
                _serverMetadataLastUpdated: item._serverMetadataLastUpdated
            } : {}),

            // Add original DSA fields for reference
            dsa_id: cleanedFlattenedItem._id || cleanedFlattenedItem.id || '',
            dsa_name: cleanedFlattenedItem.name || ''
        };

        return transformedItem;
    });

    const result = transformedData;

    console.log('transformDsaData: Processing complete:', {
        originalLength: dsaData.length,
        afterFiltering: filteredData.length,
        resultLength: result.length,
        filesSkipped: skipStats.totalSkipped,
        skippedExtensions: skipStats.extensions
    });

    // Store skip stats globally for UI display
    if (typeof window !== 'undefined') {
        window.dsaSkipStats = skipStats;
        console.log('🔍 DEBUG: Setting window.dsaSkipStats:', skipStats);
    }

    return result;
};
