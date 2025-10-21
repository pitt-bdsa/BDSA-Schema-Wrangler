/**
 * DSA Data Fetching Utilities
 * Handles all DSA API data fetching operations including pagination and loading strategies
 */

import { transformDsaData, filterFilesByExtension } from './DsaDataTransformer.js';

/**
 * Main DSA data loading function - loads all data from a DSA resource
 * This is the primary entry point for loading DSA data into the application
 */
export const loadDsaData = async (dsaConfig, girderToken) => {
    try {
        console.log('🚀 loadDsaData: Starting DSA data fetch...');

        // Use the paginated approach for better performance and memory management
        const rawItems = await fetchAllDsaItemsPaginated(dsaConfig, girderToken, 500);

        console.log(`✅ loadDsaData: Successfully fetched ${rawItems.length} raw items`);

        // Debug: Log sample file names to see what we're getting
        if (rawItems.length > 0) {
            console.log('🔍 Sample file names from loadDsaData:', rawItems.slice(0, 5).map(item => item.name || item._id || 'unnamed'));
        }

        // Transform the data to import existing meta.BDSA metadata and apply filtering
        console.log('🔄 Transforming DSA data to import existing metadata...');
        console.log('🚀🚀🚀 FETCHER DEBUG: About to call transformDsaData with', rawItems.length, 'raw items');
        const transformedItems = transformDsaData(rawItems);
        console.log('🚀🚀🚀 FETCHER DEBUG: transformDsaData returned', transformedItems.length, 'transformed items');

        console.log(`✅ loadDsaData: Successfully transformed ${transformedItems.length} items (imported existing metadata)`);

        return {
            success: true,
            data: transformedItems,
            itemCount: transformedItems.length,
            hasMoreData: rawItems.length < (10 * 500) // If we got less than 5,000 items, there might be more
        };

    } catch (error) {
        console.error('❌ loadDsaData error:', error);
        return {
            success: false,
            error: error.message || 'Unknown error occurred while loading DSA data'
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
 * @param {number} pageSize - Number of items per page (default 500)
 * @returns {Promise<Array>} All items from the resource
 */
export const fetchAllDsaItemsPaginated = async (dsaConfig, girderToken, pageSize = 500) => {
    const allItems = [];
    let offset = 0;
    let hasMore = true;
    let pageCount = 0;
    const maxPages = 10; // Limit to 5,000 items (10 pages × 500 items)
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
            const currentOffset = offset;  // Store current offset before incrementing
            console.log(`✅ Fetched ${pageData.length} items from page ${pageCount} (offset ${currentOffset})`);

            // Check if we got no data - we're done
            if (pageData.length === 0) {
                hasMore = false;
                console.log(`🏁 No more data available. Total items fetched: ${allItems.length}`);
                break;
            }

            // Add items to our collection
            allItems.push(...pageData);

            // Check if we got fewer items than requested - we're done
            if (pageData.length < pageSize) {
                hasMore = false;
                console.log(`🏁 Reached end of data (partial page). Total items fetched: ${allItems.length}`);
                break;
            }

            // If we got exactly pageSize items, there might be more
            // Increment offset for next iteration
            offset += pageSize;
            console.log(`➡️ Got full page, continuing with next offset ${offset}`);

        } catch (error) {
            console.error('Error fetching page:', error);
            throw error;
        }
    }

    if (pageCount >= maxPages) {
        console.warn(`⚠️ Reached maximum page limit (${maxPages} pages = 5,000 items). Stopping pagination.`);
        console.warn(`📊 Total items fetched: ${allItems.length}`);
    }

    if ((Date.now() - startTime) >= maxTime) {
        console.warn(`⚠️ Reached time limit (${maxTime / 1000}s). Stopping pagination.`);
        console.warn(`📊 Total items fetched: ${allItems.length}`);
    }

    console.log(`🎉 Successfully fetched ${allItems.length} items from DSA resource (${pageCount} pages)`);
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
        hasMoreData: transformedData.length > 0, // If we got no items, there's no more data
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
export const fetchDsaDataWithRegex = async (dsaConfig, girderToken, regexRules = {}) => {
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
