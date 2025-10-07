import { applyRegexRules } from './regexExtractor';

/**
 * DSA Integration Utilities
 * Handles all Digital Slide Archive API interactions and data processing
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
            const newKey = prefix ? `${prefix}.${key}` : key;

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

        // Debug logging for first few items
        if (skipStats.totalSkipped < 10) {
            console.log(`🔍 File filtering debug: "${fileName}" -> extension: "${extension}" -> allowed: ${allowedExtensions.includes(extension)}`);
        }

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
 * Transforms DSA API response data to match expected format
 * @param {Array} dsaData - Raw DSA API response data
 * @param {Object} regexRules - Regex rules for data extraction
 * @returns {Array} Transformed and flattened data
 */
export const transformDsaData = (dsaData, regexRules = {}) => {
    console.log('🚨🚨🚨 TRANSFORM DSA DATA CALLED 🚨🚨🚨');
    console.log('🚨🚨🚨 TRANSFORM DSA DATA CALLED 🚨🚨🚨');
    console.log('🚨🚨🚨 TRANSFORM DSA DATA CALLED 🚨🚨🚨');
    // This function will transform DSA API response to match your expected data format
    // and flatten nested JSON dictionaries
    if (!dsaData || !Array.isArray(dsaData)) {
        return [];
    }

    // First, enhance data with existing server metadata
    console.log('🚀 About to call enhanceDataWithExistingMetadata with', dsaData.length, 'items');
    const enhancedData = enhanceDataWithExistingMetadata(dsaData);
    console.log('✅ enhanceDataWithExistingMetadata completed, returned', enhancedData.length, 'items');

    // Apply file extension filtering
    const { filteredData, skipStats } = filterFilesByExtension(enhancedData);

    const transformedData = filteredData.map(item => {
        // Flatten the entire item, including nested objects
        const flattenedItem = flattenObject(item);

        // Add some common field mappings for compatibility
        const transformedItem = {
            // Map common fields to expected names
            name: flattenedItem.name || flattenedItem._id || flattenedItem.id || '',
            // Use server metadata if available, otherwise fall back to existing metadata
            localCaseId: item.localCaseId || flattenedItem['meta.caseId'] || flattenedItem['meta.localCaseId'] || flattenedItem.caseId || flattenedItem.localCaseId || '',
            localStainID: item.localStainID || flattenedItem['meta.stainId'] || flattenedItem['meta.localStainID'] || flattenedItem.stainId || flattenedItem.localStainID || '',
            localRegionId: item.localRegionId || flattenedItem['meta.regionId'] || flattenedItem['meta.localRegionId'] || flattenedItem.regionId || flattenedItem.localRegionId || '',

            // Include all flattened fields
            ...flattenedItem,

            // Preserve BDSA structure from enhanceDataWithExistingMetadata (don't flatten it)
            BDSA: item.BDSA || undefined,

            // Preserve server metadata markers
            _hasServerMetadata: item._hasServerMetadata || false,
            _serverMetadataSource: item._serverMetadataSource || null,
            _serverMetadataLastUpdated: item._serverMetadataLastUpdated || null,

            // Add original DSA fields for reference
            dsa_id: flattenedItem._id || flattenedItem.id || '',
            dsa_name: flattenedItem.name || ''
        };

        return transformedItem;
    });

    // Only apply regex rules to items that don't already have server metadata
    const itemsNeedingRegex = transformedData.filter(item => !item._hasServerMetadata);
    const itemsWithServerMetadata = transformedData.filter(item => item._hasServerMetadata);

    console.log('Metadata processing summary:', {
        totalItems: transformedData.length,
        itemsWithServerMetadata: itemsWithServerMetadata.length,
        itemsNeedingRegex: itemsNeedingRegex.length
    });

    // Apply regex rules only to items that need it
    const regexProcessedItems = itemsNeedingRegex.length > 0
        ? applyRegexRules(itemsNeedingRegex, regexRules)
        : [];

    // Combine items with server metadata and regex-processed items
    const result = [...itemsWithServerMetadata, ...regexProcessedItems];

    console.log('transformDsaData: Processing complete:', {
        originalLength: dsaData.length,
        afterFiltering: filteredData.length,
        resultLength: result.length,
        itemsWithServerMetadata: itemsWithServerMetadata.length,
        itemsProcessedWithRegex: regexProcessedItems.length,
        filesSkipped: skipStats.totalSkipped,
        skippedExtensions: skipStats.extensions
    });

    // Store skip stats globally for UI display
    if (typeof window !== 'undefined') {
        window.dsaSkipStats = skipStats;
    }

    return result;
};

/**
 * Tests DSA authentication using admin:password credentials
 * @param {string} baseUrl - DSA base URL
 * @returns {Promise<Object>} Authentication result with token and user info
 */
export const testDirectToken = async (baseUrl) => {
    try {
        if (!baseUrl) {
            throw new Error('Please fill in Base URL first.');
        }

        // Use HTTP Basic Auth with admin:password to get a proper Girder token
        const authUrl = `${baseUrl}/api/v1/user/authentication`;
        const credentials = btoa('admin:password'); // Base64 encode admin:password

        console.log('Testing authentication with admin:password to get Girder token:', { authUrl });

        const response = await fetch(authUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Authentication response:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok
        });

        if (response.ok) {
            const authData = await response.json();
            console.log('Authentication successful - Full auth data:', authData);

            // Extract the Girder token from the response
            const girderToken = authData?.authToken?.token;
            const userData = authData?.user;

            if (girderToken) {
                console.log('Girder token obtained:', girderToken);

                // Extract user info
                const userName = userData?.login || userData?.firstName || userData?.email || 'Admin User';
                const userId = userData?._id || userData?.id || 'Unknown ID';

                return {
                    success: true,
                    token: girderToken,
                    user: {
                        name: userName,
                        id: userId,
                        data: userData
                    },
                    message: `SUCCESS! Authentication successful!\n\nUser: ${userName}\nID: ${userId}\n\nGirder token obtained and ready to use for API requests.`
                };
            } else {
                console.error('No Girder token found in response:', authData);
                return {
                    success: false,
                    error: `Authentication succeeded but no Girder token found in response.\n\nResponse: ${JSON.stringify(authData)}`
                };
            }
        } else {
            const errorText = await response.text();
            console.log('Authentication failed:', {
                status: response.status,
                statusText: response.statusText,
                response: errorText
            });
            return {
                success: false,
                error: `FAILED! Authentication with admin:password failed.\n\nError: ${errorText}`
            };
        }
    } catch (error) {
        console.error('Error testing authentication:', error);
        return {
            success: false,
            error: `Error testing authentication: ${error.message}`
        };
    }
};

/**
 * Tests access to a specific DSA resource
 * @param {string} baseUrl - DSA base URL
 * @param {string} resourceId - Resource ID to test
 * @param {string} girderToken - Authentication token
 * @returns {Promise<Object>} Resource access test result
 */
export const testResourceAccess = async (baseUrl, resourceId, girderToken) => {
    try {
        if (!baseUrl || !resourceId) {
            throw new Error('Please fill in Base URL and Resource ID first.');
        }

        if (!girderToken) {
            throw new Error('No Girder token available! Please click "Get Girder Token" first to authenticate.');
        }

        const testUrl = `${baseUrl}/api/v1/resource/${resourceId}`;
        const headers = {
            'Content-Type': 'application/json',
            'Girder-Token': girderToken
        };

        console.log('Testing resource access:', { testUrl, headers: { ...headers, 'Girder-Token': '[REDACTED]' } });

        const response = await fetch(testUrl, {
            method: 'GET',
            headers: headers
        });

        console.log('Resource access test response:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok
        });

        if (response.ok) {
            const resourceData = await response.json();
            console.log('Resource access test successful:', resourceData);
            return {
                success: true,
                data: resourceData,
                message: `SUCCESS! You have access to this resource.\n\nResource Name: ${resourceData.name || 'Unknown'}\nResource Type: ${resourceData._modelType || 'Unknown'}\nResource ID: ${resourceData._id || 'Unknown'}`
            };
        } else {
            const errorText = await response.text();
            console.log('Resource access test failed:', {
                status: response.status,
                statusText: response.statusText,
                response: errorText
            });

            // Try to parse the error to provide better feedback
            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.message && errorJson.message.includes('Read access denied')) {
                    return {
                        success: false,
                        error: `FAILED! You do not have read access to this resource.\n\nThis could mean:\n1. The resource ID is incorrect\n2. The resource is private and requires specific permissions\n3. The resource type (collection/folder) is wrong\n\nError: ${errorText}\n\nTry using a public collection or check with the DSA administrator.`
                    };
                } else {
                    return {
                        success: false,
                        error: `FAILED! You do not have access to this resource.\n\nError: ${errorText}`
                    };
                }
            } catch (parseError) {
                return {
                    success: false,
                    error: `FAILED! You do not have access to this resource.\n\nError: ${errorText}`
                };
            }
        }
    } catch (error) {
        console.error('Error testing resource access:', error);
        return {
            success: false,
            error: `Error testing resource access: ${error.message}`
        };
    }
};

/**
 * Fetches all items from DSA resource using different strategies
 * @param {Object} dsaConfig - DSA configuration object
 * @param {string} girderToken - Authentication token
 * @param {Object} options - Fetch options
 * @param {string} options.strategy - 'paginate' or 'unlimited' (default: 'paginate')
 * @param {number} options.pageSize - Items per page for pagination (default: 100)
 * @returns {Promise<Array>} All items from the resource
 */
export const fetchAllDsaItems = async (dsaConfig, girderToken, options = {}) => {
    const { strategy = 'paginate', pageSize = 100 } = options;

    if (strategy === 'unlimited') {
        // Strategy 1: Use limit=0 to get all items at once
        return await fetchAllDsaItemsUnlimited(dsaConfig, girderToken);
    } else {
        // Strategy 2: Use pagination (default)
        return await fetchAllDsaItemsPaginated(dsaConfig, girderToken, pageSize);
    }
};

/**
 * Fetches all items at once using limit=0
 * @param {Object} dsaConfig - DSA configuration object
 * @param {string} girderToken - Authentication token
 * @returns {Promise<Array>} All items from the resource
 */
export const fetchAllDsaItemsUnlimited = async (dsaConfig, girderToken) => {
    console.log('🚀 Fetching all DSA items at once (limit=0)...');

    const apiUrl = `${dsaConfig.baseUrl}/api/v1/resource/${dsaConfig.resourceId}/items?type=${dsaConfig.resourceType || 'folder'}&limit=0`;

    const headers = {
        'Content-Type': 'application/json',
        'Girder-Token': girderToken
    };

    console.log('Request URL:', apiUrl);

    try {
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

        const allItems = await response.json();
        console.log(`🎉 Successfully fetched all ${allItems.length} items from DSA resource (unlimited)`);
        return allItems;

    } catch (error) {
        console.error('Error fetching all items:', error);
        throw error;
    }
};

/**
 * Fetches all items using pagination
 * @param {Object} dsaConfig - DSA configuration object
 * @param {string} girderToken - Authentication token
 * @param {number} pageSize - Number of items per page (default 100)
 * @returns {Promise<Array>} All items from the resource
 */
export const fetchAllDsaItemsPaginated = async (dsaConfig, girderToken, pageSize = 100) => {
    const allItems = [];
    let offset = 0;
    let hasMore = true;
    let pageCount = 0;
    const maxPages = 100; // Reduced safety limit to prevent infinite loops
    const startTime = Date.now();
    const maxTime = 5 * 60 * 1000; // 5 minutes timeout

    console.log('🔄 Starting paginated fetch of all DSA items...');

    while (hasMore && pageCount < maxPages && (Date.now() - startTime) < maxTime) {
        pageCount++;

        // Build the API endpoint URL with pagination parameters
        const apiUrl = `${dsaConfig.baseUrl}/api/v1/resource/${dsaConfig.resourceId}/items?type=${dsaConfig.resourceType || 'folder'}&limit=${pageSize}&offset=${offset}`;

        const headers = {
            'Content-Type': 'application/json',
            'Girder-Token': girderToken
        };

        console.log(`📄 Fetching page ${pageCount}: offset=${offset}, limit=${pageSize}`);
        console.log(`🔢 Page count: ${pageCount}, Max pages: 20`);
        console.log('Request URL:', apiUrl);

        try {
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

                // Try to parse the error response as JSON
                try {
                    const errorJson = JSON.parse(errorText);
                    console.error('Parsed error response:', errorJson);

                    // Check if it's a permission issue
                    if (errorJson.type === 'access' && errorJson.message.includes('Read access denied')) {
                        console.error('PERMISSION ERROR: The authenticated user does not have read access to this resource.');
                        console.error('Resource ID:', dsaConfig.resourceId);
                        console.error('Resource Type:', dsaConfig.resourceType);
                    }
                } catch (parseError) {
                    console.error('Could not parse error response as JSON:', parseError);
                }

                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }

            const pageData = await response.json();
            console.log(`✅ Fetched ${pageData.length} items from page (offset ${offset})`);

            // Add items to our collection
            allItems.push(...pageData);

            // Check if we should continue (if we got fewer items than requested, we're done)
            if (pageData.length < pageSize) {
                hasMore = false;
                console.log(`🏁 Reached end of data. Total items fetched: ${allItems.length}`);
            } else if (pageData.length === 0) {
                hasMore = false;
                console.log(`🏁 No more data available. Total items fetched: ${allItems.length}`);
            } else if (pageData.length === pageSize) {
                // If we got exactly the page size, continue but with a limit
                offset += pageSize;
                console.log(`➡️ More data available, continuing with offset ${offset}`);

                // Stop after 5 pages (5,000 items) for initial testing
                if (pageCount >= 5) {
                    console.log(`⚠️ Stopping after 5 pages for initial testing. Total items: ${allItems.length}`);
                    console.log(`📊 This should be enough to test file filtering. You can increase the limit later if needed.`);
                    hasMore = false;
                }
            } else {
                offset += pageSize;
                console.log(`➡️ More data available, continuing with offset ${offset}`);
            }

        } catch (error) {
            console.error('Error fetching page:', error);
            throw error;
        }
    }

    if (pageCount >= maxPages) {
        console.warn(`⚠️ Reached maximum page limit (${maxPages}). Stopping pagination.`);
    }

    if ((Date.now() - startTime) >= maxTime) {
        console.warn(`⚠️ Reached time limit (${maxTime / 1000}s). Stopping pagination.`);
    }

    console.log(`🎉 Successfully fetched all ${allItems.length} items from DSA resource`);
    return allItems;
};

/**
 * Loads more DSA data in paginated batches with progress callback
 * @param {Object} dsaConfig - DSA configuration object
 * @param {string} girderToken - Authentication token
 * @param {number} startPage - Page number to start from (already loaded pages)
 * @param {number} pagesToLoad - Number of additional pages to load
 * @param {Function} progressCallback - Callback to report progress
 * @returns {Promise<Object>} Result with loaded data
 */
export const loadMoreDsaDataPaginated = async (dsaConfig, girderToken, startPage, pagesToLoad, progressCallback) => {
    const pageSize = 1000;
    let offset = startPage * pageSize;
    let pagesLoaded = 0;
    const allNewItems = [];

    console.log(`🔄 Loading ${pagesToLoad} more pages starting from page ${startPage}...`);

    while (pagesLoaded < pagesToLoad) {
        try {
            const params = new URLSearchParams({
                parentType: dsaConfig.resourceType || 'folder',
                parentId: dsaConfig.resourceId,
                limit: pageSize,
                offset: offset
            });

            const apiUrl = `${dsaConfig.baseUrl}/api/v1/resource/${dsaConfig.resourceId}/items?type=${dsaConfig.resourceType || 'folder'}&limit=${pageSize}&offset=${offset}`;

            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Girder-Token': girderToken
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const pageData = await response.json();

            // Apply file filtering to this batch
            const { filteredData } = filterFilesByExtension(pageData);

            allNewItems.push(...filteredData);
            pagesLoaded++;
            offset += pageSize;

            // Report progress
            if (progressCallback) {
                progressCallback({
                    current: pagesLoaded,
                    total: pagesToLoad,
                    itemsLoaded: allNewItems.length
                });
            }

            console.log(`✅ Loaded page ${startPage + pagesLoaded}: ${filteredData.length} items (${allNewItems.length} total)`);

            // If we got fewer items than requested, we've reached the end
            if (pageData.length < pageSize) {
                console.log(`🏁 Reached end of data after ${pagesLoaded} pages`);
                break;
            }

        } catch (error) {
            console.error(`Error loading page ${startPage + pagesLoaded}:`, error);
            break;
        }
    }

    // Transform the loaded data
    const transformedData = transformDsaData(allNewItems);

    return {
        success: true,
        data: transformedData,
        pagesLoaded: pagesLoaded,
        message: `Loaded ${pagesLoaded} more pages (${transformedData.length} items)`
    };
};

/**
 * Loads data from DSA API with automatic pagination
 * @param {Object} dsaConfig - DSA configuration object
 * @param {string} girderToken - Authentication token
 * @param {Object} regexRules - Regex rules for data extraction
 * @returns {Promise<Object>} Load result with data and columns
 */
export const loadDsaData = async (dsaConfig, girderToken, regexRules = {}) => {
    try {
        if (!dsaConfig?.baseUrl || !dsaConfig?.resourceId) {
            throw new Error('DSA configuration incomplete');
        }

        if (!girderToken) {
            throw new Error('No Girder token available! Please click "Get Girder Token" first to authenticate.');
        }

        console.log('Authentication state:', {
            girderToken: girderToken ? `${girderToken.substring(0, 10)}...` : 'empty'
        });

        // Use pagination with aggressive limits to prevent infinite loops
        const fetchStrategy = 'paginate';
        const pageSize = 1000;

        console.log(`📊 Using fetch strategy: ${fetchStrategy} with aggressive limits`);

        const dsaData = await fetchAllDsaItems(dsaConfig, girderToken, {
            strategy: fetchStrategy,
            pageSize: pageSize
        });

        // Transform and flatten DSA data to match expected format
        console.log(`🔄 Transforming ${dsaData.length} raw DSA items...`);
        const transformedData = transformDsaData(dsaData, regexRules);
        console.log(`✅ Transformation complete: ${transformedData.length} items after filtering and processing`);

        if (transformedData.length > 0) {
            // Filter out BDSA object from column generation to avoid [object Object] display
            const columns = Object.keys(transformedData[0] || {})
                .filter(key => key !== 'BDSA') // Exclude BDSA object
                .map(key => {
                    const column = {
                        field: key,
                        headerName: key,
                        sortable: true,
                        filter: true,
                        resizable: true,
                        minWidth: 150
                    };

                    // Add orange cell styling for regex-extracted fields
                    if (key === 'localCaseId' || key === 'localStainID' || key === 'localRegionId') {
                        column.cellStyle = (params) => {
                            // Check if this field was extracted by regex
                            if (params.data && params.data._regexExtracted && params.data._regexExtracted[key]) {
                                return { backgroundColor: '#fff3cd', color: '#856404' }; // Orange background
                            }
                            return null;
                        };
                    }

                    return column;
                });

            return {
                success: true,
                data: transformedData,
                columns: columns
            };
        } else {
            return {
                success: true,
                data: [],
                columns: []
            };
        }
    } catch (error) {
        console.error('Error loading DSA data:', error);
        return {
            success: false,
            error: error.message
        };
    }
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

/**
 * Syncs local BDSA metadata to DSA server for a single item
 * @param {string} baseUrl - DSA base URL
 * @param {Object} item - Data item with local metadata
 * @param {string} girderToken - Authentication token
 * @param {Object} columnMapping - Column mapping configuration
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

        const itemId = item._id || item.dsa_id;
        if (!itemId) {
            throw new Error('No DSA item ID found in data item');
        }

        // Extract BDSA metadata values from the BDSA.bdsaLocal namespace (authoritative source)
        const localCaseId = item.BDSA?.bdsaLocal?.localCaseId || item[columnMapping.localCaseId] || '';
        const localStainID = item.BDSA?.bdsaLocal?.localStainID || item[columnMapping.localStainID] || '';
        const localRegionId = item.BDSA?.bdsaLocal?.localRegionId || item[columnMapping.localRegionId] || '';
        const bdsaCaseId = item.BDSA?.bdsaLocal?.bdsaCaseId || '';
        const bdsaStainProtocol = item.BDSA?.bdsaLocal?.bdsaStainProtocol || [];
        const bdsaRegionProtocol = item.BDSA?.bdsaLocal?.bdsaRegionProtocol || [];

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
 * Batch processor for syncing multiple items with progress tracking
 */
export class DsaBatchProcessor {
    constructor(baseUrl, girderToken, options = {}) {
        this.baseUrl = baseUrl;
        this.girderToken = girderToken;
        this.options = {
            batchSize: 5, // Process 5 items concurrently
            delayBetweenBatches: 1000, // 1 second delay between batches
            retryAttempts: 3,
            retryDelay: 2000,
            ...options
        };
        this.cancelled = false;
        this.progressCallback = null;
        this.results = [];
    }

    /**
     * Sets progress callback function
     * @param {Function} callback - Progress callback (current, total, results)
     */
    onProgress(callback) {
        this.progressCallback = callback;
        return this;
    }

    /**
     * Cancels the batch processing
     */
    cancel() {
        this.cancelled = true;
        console.log('🚫 Batch processing cancelled - stopping all future batches');
        // Force immediate cancellation by throwing an error to break out of any ongoing operations
        this.cancelError = new Error('Batch processing cancelled by user');
    }

    /**
     * Processes items in batches with rate limiting
     * @param {Array} items - Items to process
     * @param {Object} columnMapping - Column mapping configuration
     * @param {Function} processor - Processing function for each item
     * @returns {Promise<Object>} Batch processing results
     */
    async processBatch(items, columnMapping, processor = syncItemBdsaMetadata) {
        this.results = [];
        this.cancelled = false;

        const totalItems = items.length;
        let processedCount = 0;
        let successCount = 0;
        let errorCount = 0;
        let skippedCount = 0;

        console.log(`Starting batch processing of ${totalItems} items...`);

        // Early exit if no items to process
        if (totalItems === 0) {
            console.log('No items to process - batch complete');
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

        try {
            // Process items in batches
            for (let i = 0; i < items.length; i += this.options.batchSize) {
                if (this.cancelled) {
                    console.log('🚫 Batch processing cancelled by user - breaking main loop');
                    throw this.cancelError;
                }

                const batch = items.slice(i, i + this.options.batchSize);
                console.log(`Processing batch ${Math.floor(i / this.options.batchSize) + 1}, items ${i + 1}-${Math.min(i + this.options.batchSize, totalItems)}`);

                // Check for cancellation before starting batch
                if (this.cancelled) {
                    console.log('🚫 Batch processing cancelled before starting batch');
                    throw this.cancelError;
                }

                // Process batch items concurrently with cancellation support
                const batchPromises = batch.map(async (item) => {
                    if (this.cancelled) {
                        console.log(`🚫 Skipping item ${item._id || item.dsa_id} due to cancellation`);
                        throw this.cancelError;
                    }

                    let attempts = 0;
                    while (attempts < this.options.retryAttempts && !this.cancelled) {
                        if (this.cancelled) {
                            console.log(`🚫 Cancelled during retry loop for item ${item._id || item.dsa_id}`);
                            throw this.cancelError;
                        }

                        try {
                            // Pass cancellation check function to the processor
                            const result = await processor(this.baseUrl, item, this.girderToken, columnMapping, () => this.cancelled);
                            return result;
                        } catch (error) {
                            if (this.cancelled) {
                                console.log(`🚫 Cancelled during error handling for item ${item._id || item.dsa_id}`);
                                throw this.cancelError;
                            }

                            attempts++;
                            if (attempts < this.options.retryAttempts && !this.cancelled) {
                                console.log(`Retry attempt ${attempts} for item ${item._id || item.dsa_id}`);
                                await this.delay(this.options.retryDelay);
                            } else {
                                console.error(`Failed after ${this.options.retryAttempts} attempts:`, error);
                                return {
                                    success: false,
                                    itemId: item._id || item.dsa_id || 'unknown',
                                    error: error.message
                                };
                            }
                        }
                    }

                    if (this.cancelled) {
                        console.log(`🚫 Cancelled processing item ${item._id || item.dsa_id}`);
                        throw this.cancelError;
                    }
                });

                // Wait for batch to complete, but check for cancellation during processing
                // Use a more aggressive cancellation approach
                const batchResults = [];
                for (const promise of batchPromises) {
                    if (this.cancelled) {
                        console.log('Batch processing cancelled during promise execution');
                        break;
                    }
                    try {
                        const result = await promise;
                        if (result) {
                            batchResults.push({ status: 'fulfilled', value: result });
                        }
                    } catch (error) {
                        batchResults.push({ status: 'rejected', reason: error });
                    }
                }

                // Check for cancellation immediately after batch completion
                if (this.cancelled) {
                    console.log('Batch processing cancelled after batch completion');
                    break;
                }

                // Process results and track batch activity
                let batchHadUpdates = false;
                batchResults.forEach(promiseResult => {
                    // Handle Promise.allSettled format
                    const result = promiseResult.status === 'fulfilled' ? promiseResult.value : null;

                    if (result) {
                        this.results.push(result);
                        processedCount++;

                        if (result.success) {
                            successCount++;
                            batchHadUpdates = true; // Track that we had actual updates
                        } else if (result.skipped) {
                            skippedCount++;
                            // Skipped items don't count as updates
                        } else {
                            errorCount++;
                            batchHadUpdates = true; // Errors still count as server activity
                        }
                    } else if (promiseResult.status === 'rejected') {
                        console.error('Promise rejected during batch processing:', promiseResult.reason);
                        errorCount++;
                        batchHadUpdates = true;
                    }
                });

                // Update progress
                if (this.progressCallback) {
                    this.progressCallback({
                        processed: processedCount,
                        total: totalItems,
                        success: successCount,
                        errors: errorCount,
                        skipped: skippedCount,
                        percentage: Math.round((processedCount / totalItems) * 100)
                    });
                }

                // Check for cancellation before applying delay
                if (this.cancelled) {
                    console.log('Batch processing cancelled before delay');
                    break;
                }

                // Only delay between batches if we had actual updates (not just skips)
                if (i + this.options.batchSize < items.length && !this.cancelled && batchHadUpdates) {
                    console.log(`Batch had ${successCount + errorCount} updates, applying ${this.options.delayBetweenBatches}ms delay...`);
                    await this.delay(this.options.delayBetweenBatches);
                } else if (i + this.options.batchSize < items.length && !this.cancelled) {
                    console.log('Batch had only skips, no delay needed - continuing immediately');
                }
            }
        } catch (error) {
            if (error === this.cancelError) {
                console.log('🚫 Batch processing cancelled by user');
            } else {
                console.error('🚫 Batch processing error:', error);
            }
        }

        const summary = {
            completed: !this.cancelled,
            totalItems,
            processed: processedCount,
            success: successCount,
            errors: errorCount,
            skipped: skippedCount,
            results: this.results
        };

        console.log('Batch processing complete:', summary);
        return summary;
    }

    /**
     * Utility function for delays
     * @param {number} ms - Milliseconds to delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Syncs all items' BDSA metadata to DSA server
 * @param {string} baseUrl - DSA base URL
 * @param {Array} items - Data items to sync
 * @param {string} girderToken - Authentication token
 * @param {Object} columnMapping - Column mapping configuration
 * @param {Function} progressCallback - Progress callback function
 * @returns {Promise<Object>} Sync results
 */
export const syncAllBdsaMetadata = async (baseUrl, items, girderToken, columnMapping, progressCallback = null, processorRef = null) => {
    console.log('Starting sync of BDSA metadata to DSA server:', {
        itemCount: items.length,
        baseUrl,
        columnMapping
    });

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
