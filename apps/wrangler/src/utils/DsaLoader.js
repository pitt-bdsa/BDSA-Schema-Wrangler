// DsaLoader - Handles DSA (Digital Slide Archive) data loading

class DsaLoader {
    constructor() {
        // This class is stateless and operates on provided data
    }

    async loadDsaData(dsaAuthStore, dataStoreInstance) {
        console.log('🚀🚀🚀 LOADER DEBUG - DsaLoader.loadDsaData called - this should trigger DSA API fetch');
        try {
            const authStatus = dsaAuthStore.getStatus();
            if (!authStatus.isAuthenticated) {
                throw new Error('Not authenticated with DSA server');
            }

            if (!authStatus.isConfigured) {
                throw new Error('DSA server not configured');
            }

            if (!authStatus.resourceId) {
                throw new Error('Resource ID not configured. Please select a folder or collection first.');
            }

            const config = dsaAuthStore.config;
            const token = dsaAuthStore.token;

            console.log('🔄 Using dsaIntegration.loadDsaData for proper filtering...');

            // Import and use the proper loadDsaData from dsaIntegration that includes filtering
            const { loadDsaData } = await import('./dsaIntegration.js');
            console.log('🚀 Calling dsaIntegration.loadDsaData with config:', config);
            const result = await loadDsaData(config, token);
            console.log('✅ dsaIntegration.loadDsaData returned:', result);

            if (!result.success) {
                throw new Error(result.error || 'Failed to load DSA data');
            }

            console.log(`📊 DataStore: Setting processedData to ${result.data.length} items`);
            console.log('🚀🚀🚀 LOADER DEBUG: Data is already transformed, bypassing transformDsaData');

            // Debug: Check if data has flattened fields before initializeBdsaStructure
            if (result.data.length > 0) {
                const firstItem = result.data[0];
                const metaNpClinicalKeys = Object.keys(firstItem).filter(key => key.startsWith('meta.npClinical.'));
                console.log('🔍 LOADER DEBUG: Before initializeBdsaStructure - meta.npClinical keys:', metaNpClinicalKeys.slice(0, 5));
                console.log('🔍 LOADER DEBUG: Sample values:', {
                    'meta.npClinical.Age at Death/Bx': firstItem['meta.npClinical.Age at Death/Bx'],
                    'meta.npClinical.ApoE': firstItem['meta.npClinical.ApoE']
                });
            }

            dataStoreInstance.processedData = dataStoreInstance.initializeBdsaStructure(result.data);

            // Debug: Check if data still has flattened fields after initializeBdsaStructure
            if (dataStoreInstance.processedData.length > 0) {
                const firstItem = dataStoreInstance.processedData[0];
                const metaNpClinicalKeys = Object.keys(firstItem).filter(key => key.startsWith('meta.npClinical.'));
                console.log('🔍 LOADER DEBUG: After initializeBdsaStructure - meta.npClinical keys:', metaNpClinicalKeys.slice(0, 5));
                console.log('🔍 LOADER DEBUG: Sample values:', {
                    'meta.npClinical.Age at Death/Bx': firstItem['meta.npClinical.Age at Death/Bx'],
                    'meta.npClinical.ApoE': firstItem['meta.npClinical.ApoE']
                });
            }
            dataStoreInstance.dataSource = 'dsa';
            dataStoreInstance.dataSourceInfo = {
                baseUrl: config.baseUrl,
                resourceId: config.resourceId,
                resourceType: config.resourceType
            };
            dataStoreInstance.dataLoadTimestamp = new Date().toISOString();

            // Clean up orphaned IDs from modifiedItems Set
            // (items that were modified but no longer exist after data refresh)
            console.log('🔍 About to call cleanupModifiedItems...');
            dataStoreInstance.cleanupModifiedItems();
            console.log('✅ cleanupModifiedItems completed successfully');

            // Only clear modifiedItems if this is a fresh data load (not a refresh with existing modifications)
            if (dataStoreInstance.modifiedItems.size === 0) {
                console.log(`🧹 Clearing modifiedItems (${dataStoreInstance.modifiedItems.size} items) from:`, new Error().stack);
                dataStoreInstance.modifiedItems.clear();
            } else {
                console.log(`🔍 Preserving ${dataStoreInstance.modifiedItems.size} existing modified items during data load`);
            }

            // Enable BDSA tracking for the loaded data
            console.log(`🔍 About to enable BDSA tracking. Current modifiedItems size: ${dataStoreInstance.modifiedItems.size}`);
            try {
                dataStoreInstance.enableBdsaTracking();
                console.log(`🔍 After enabling BDSA tracking. Current modifiedItems size: ${dataStoreInstance.modifiedItems.size}`);
            } catch (trackingError) {
                console.error('❌ Error in enableBdsaTracking:', trackingError);
                throw trackingError;
            }

            // Set DSA configuration for sync functionality
            dataStoreInstance.girderToken = token;
            dataStoreInstance.dsaConfig = config;

            // Try to save to storage, but don't fail if quota exceeded
            try {
                // Skip saveToStorage() for large datasets to avoid quota errors
                // dataStoreInstance.saveToStorage();
            } catch (error) {
                if (error.name === 'QuotaExceededError') {
                    console.warn('⚠️ Data too large for localStorage, skipping storage save');
                    console.warn(`📊 Data size: ${JSON.stringify(dataStoreInstance.processedData).length} characters`);
                    console.warn('💡 Consider using file filtering to reduce data size');
                } else {
                    console.error('Error saving to storage:', error);
                }
            }
            console.log('🔍 About to call notify...');
            dataStoreInstance.notify();
            console.log('✅ notify completed successfully');

            console.log(`📊 DataStore: Final processedData length: ${dataStoreInstance.processedData.length}`);
            console.log(`📊 DataStore: Data source: ${dataStoreInstance.dataSource}`);
            console.log(`📊 DataStore: Data type: ${typeof dataStoreInstance.processedData}`);
            console.log(`📊 DataStore: Is array: ${Array.isArray(dataStoreInstance.processedData)}`);
            if (dataStoreInstance.processedData.length > 0) {
                const sampleItem = dataStoreInstance.processedData[0];
                console.log(`📊 DataStore: Sample item:`, sampleItem);
                console.log(`📊 DataStore: Sample item BDSA structure:`, {
                    hasBDSA: !!sampleItem.BDSA,
                    hasBdsaLocal: !!sampleItem.BDSA?.bdsaLocal,
                    bdsaLocalKeys: sampleItem.BDSA?.bdsaLocal ? Object.keys(sampleItem.BDSA.bdsaLocal) : [],
                    localCaseId: sampleItem.BDSA?.bdsaLocal?.localCaseId,
                    localStainID: sampleItem.BDSA?.bdsaLocal?.localStainID,
                    localRegionId: sampleItem.BDSA?.bdsaLocal?.localRegionId,
                    bdsaCaseId: sampleItem.BDSA?.bdsaLocal?.bdsaCaseId
                });
            }

            return {
                success: true,
                itemCount: result.data.length,
                hasMoreData: result.hasMoreData, // Pass through the hasMoreData information
                message: `Successfully loaded ${result.data.length} items from DSA (filtered)`
            };
        } catch (error) {
            throw new Error(`Failed to load DSA data: ${error.message}`);
        }
    }

    async loadMoreDsaData(dsaAuthStore, dataStoreInstance, progressCallback) {
        console.log('🚀 Loading more DSA data in background...');
        try {
            const authStatus = dsaAuthStore.getStatus();
            if (!authStatus.isAuthenticated) {
                throw new Error('Not authenticated with DSA server');
            }

            const config = dsaAuthStore.config;
            const token = dsaAuthStore.token;

            // Import the pagination function
            const { loadMoreDsaDataPaginated } = await import('./dsaIntegration.js');

            // Calculate how many pages we've already loaded (5 pages = 5000 items / 1000 per page)
            const currentPageCount = Math.ceil(dataStoreInstance.processedData.length / 1000);

            // Load more pages (e.g., load 20 more pages)
            const result = await loadMoreDsaDataPaginated(config, token, currentPageCount, 20, progressCallback);

            if (result.success && result.data.length > 0) {
                // Append new data to existing data
                dataStoreInstance.processedData = [...dataStoreInstance.processedData, ...result.data];
                console.log(`📊 DataStore: Added ${result.data.length} more items. Total: ${dataStoreInstance.processedData.length}`);

                // Notify listeners about the update
                dataStoreInstance.notify();
            }

            return {
                success: true,
                totalItemCount: dataStoreInstance.processedData.length,
                newItemCount: result.data.length,
                hasMoreData: result.data.length > 0, // If we got no new items, there's no more data
                message: `Successfully loaded ${result.data.length} more items. Total: ${dataStoreInstance.processedData.length}`
            };
        } catch (error) {
            throw new Error(`Failed to load more DSA data: ${error.message}`);
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

    async fetchDsaPage({ page, pageSize, sortModel, filterModel }, dataStoreInstance) {
        console.log('📄 Fetching DSA page:', { page, pageSize, sortModel, filterModel });

        try {
            if (!dataStoreInstance.serverSideConfig) {
                throw new Error('Server-side pagination not configured');
            }

            // Check if we have cached data for this page
            if (dataStoreInstance.backgroundLoading && dataStoreInstance.backgroundLoading.cachedData.has(page)) {
                console.log(`📦 Using cached data for page ${page}`);
                const cachedData = dataStoreInstance.backgroundLoading.cachedData.get(page);
                const totalCount = dataStoreInstance.backgroundLoading.filteredCount || cachedData.length * 100;

                return {
                    data: cachedData,
                    totalCount: totalCount
                };
            }

            // Fallback to live API request
            const config = dataStoreInstance.serverSideConfig;
            const token = config.token;

            // Calculate offset for pagination
            const offset = page * pageSize;

            // Build API URL with pagination
            let apiUrl = `${config.baseUrl}/api/v1/resource/${config.resourceId}/items?type=${config.resourceType || 'folder'}&limit=${pageSize}&offset=${offset}`;

            // Add sorting if specified
            if (sortModel && sortModel.length > 0) {
                const sort = sortModel[0];
                apiUrl += `&sort=${sort.colId}&sortdir=${sort.sort === 'asc' ? 1 : -1}`;
            }

            const headers = {
                'Content-Type': 'application/json',
                'Girder-Token': token
            };

            console.log('📄 Fetching page from API:', apiUrl);

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

            // Apply file filtering to the page data
            const { transformDsaData } = await import('./dsaIntegration.js');
            const filteredData = transformDsaData(items);

            // Use background loading stats if available, otherwise estimate
            const totalCount = dataStoreInstance.backgroundLoading?.filteredCount ||
                dataStoreInstance.backgroundLoading?.totalCount ||
                Math.max(filteredData.length * 100, 10000);

            console.log(`✅ Fetched page ${page}: ${filteredData.length} items (total: ${totalCount})`);

            return {
                data: filteredData,
                totalCount: totalCount
            };

        } catch (error) {
            console.error('Error fetching DSA page:', error);
            throw error;
        }
    }
}

const dsaLoader = new DsaLoader();
export default dsaLoader;
