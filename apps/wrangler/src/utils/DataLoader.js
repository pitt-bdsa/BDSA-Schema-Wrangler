// DataLoader - Handles background data loading from DSA servers

class DataLoader {
    constructor() {
        // This class manages background loading, but relies on DataStore for state
    }

    async startBackgroundLoading(dataStoreInstance) {
        if (dataStoreInstance.backgroundLoading.isActive) {
            console.log('🔄 Background loading already active');
            return;
        }

        dataStoreInstance.backgroundLoading.isActive = true;
        console.log('🚀 Starting background data loading...');

        try {
            const config = dataStoreInstance.serverSideConfig;
            const pageSize = 1000; // Load 1000 items at a time in background
            let page = 0;
            let hasMore = true;
            let totalFilteredCount = 0;

            while (hasMore && dataStoreInstance.backgroundLoading.isActive) {
                console.log(`📄 Background loading page ${page}...`);

                const offset = page * pageSize;
                const apiUrl = `${config.baseUrl}/api/v1/resource/${config.resourceId}/items?type=${config.resourceType || 'folder'}&limit=${pageSize}&offset=${offset}`;

                const headers = {
                    'Content-Type': 'application/json',
                    'Girder-Token': config.token
                };

                const response = await fetch(apiUrl, {
                    method: 'GET',
                    headers: headers
                });

                if (!response.ok) {
                    console.error(`Background loading failed at page ${page}:`, response.status);
                    break;
                }

                const items = await response.json();

                // Apply file filtering to the page data
                const { transformDsaData } = await import('./dsaIntegration.js');
                const filteredData = transformDsaData(items);

                // Cache the filtered data
                dataStoreInstance.backgroundLoading.cachedData.set(page, filteredData);
                dataStoreInstance.backgroundLoading.loadedPages.add(page);
                totalFilteredCount += filteredData.length;

                console.log(`✅ Background loaded page ${page}: ${filteredData.length} items (total so far: ${totalFilteredCount})`);

                // Check if we should continue
                if (items.length < pageSize) {
                    hasMore = false;
                    console.log('🏁 Background loading complete - reached end of data');
                } else {
                    page++;
                }

                // Update total count as we learn more
                dataStoreInstance.backgroundLoading.totalCount = (page + 1) * pageSize;
                dataStoreInstance.backgroundLoading.filteredCount = totalFilteredCount;

                // Notify UI of progress
                dataStoreInstance.notify();

                // Small delay to prevent overwhelming the server
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            console.log(`🎉 Background loading complete! Total filtered items: ${totalFilteredCount}`);
            dataStoreInstance.backgroundLoading.isActive = false;

        } catch (error) {
            console.error('Background loading error:', error);
            dataStoreInstance.backgroundLoading.isActive = false;
        }
    }

    stopBackgroundLoading(dataStoreInstance) {
        if (dataStoreInstance.backgroundLoading.isActive) {
            console.log('🛑 Stopping background loading...');
            dataStoreInstance.backgroundLoading.isActive = false;
        }
    }

    getBackgroundLoadingStatus(dataStoreInstance) {
        return {
            isActive: dataStoreInstance.backgroundLoading.isActive,
            loadedPages: Array.from(dataStoreInstance.backgroundLoading.loadedPages),
            totalCount: dataStoreInstance.backgroundLoading.totalCount,
            filteredCount: dataStoreInstance.backgroundLoading.filteredCount
        };
    }

    getBackgroundPage(dataStoreInstance, page) {
        return dataStoreInstance.backgroundLoading.cachedData.get(page) || [];
    }

    clearBackgroundCache(dataStoreInstance) {
        dataStoreInstance.backgroundLoading.cachedData.clear();
        dataStoreInstance.backgroundLoading.loadedPages.clear();
        dataStoreInstance.backgroundLoading.totalCount = 0;
        dataStoreInstance.backgroundLoading.filteredCount = 0;
    }
}

const dataLoader = new DataLoader();
export default dataLoader;
