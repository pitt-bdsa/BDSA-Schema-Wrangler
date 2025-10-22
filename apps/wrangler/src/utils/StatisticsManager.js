// StatisticsManager - Handles statistics, status, and snapshot generation

class StatisticsManager {
    constructor() {
        // This class is stateless and operates on provided data
    }

    getStatus(dataStoreInstance) {
        // Don't re-initialize BDSA structure on status check - it creates new object references
        // and triggers false change detection. Structure should already be initialized from loading.
        return {
            processedData: dataStoreInstance.processedData,
            dataSource: dataStoreInstance.dataSource,
            dataSourceInfo: dataStoreInstance.dataSourceInfo,
            dataLoadTimestamp: dataStoreInstance.dataLoadTimestamp,
            modifiedItems: Array.from(dataStoreInstance.modifiedItems),
            caseIdMappings: Object.fromEntries(dataStoreInstance.caseIdMappings),
            caseIdConflicts: Object.fromEntries(dataStoreInstance.caseIdConflicts),
            bdsaCaseIdConflicts: Object.fromEntries(dataStoreInstance.bdsaCaseIdConflicts),
            caseProtocolMappings: Array.from(dataStoreInstance.caseProtocolMappings)
        };
    }

    getStatistics(processedData, modifiedItems) {
        const totalItems = processedData.length;
        const fieldCounts = {};

        // Count unique values for each field
        processedData.forEach(item => {
            Object.keys(item).forEach(key => {
                if (!fieldCounts[key]) {
                    fieldCounts[key] = new Set();
                }
                if (item[key] && item[key] !== '') {
                    fieldCounts[key].add(item[key]);
                }
            });
        });

        // Convert sets to counts
        const uniqueFieldCounts = {};
        Object.keys(fieldCounts).forEach(key => {
            uniqueFieldCounts[key] = fieldCounts[key].size;
        });

        return {
            totalItems,
            uniqueFieldCounts,
            modifiedItems: modifiedItems.size
        };
    }

    getModifiedItems(processedData, modifiedItems) {
        // Use a Map to deduplicate by item.id (in case of duplicates in processedData)
        const itemsMap = new Map();

        processedData.forEach(item => {
            if (modifiedItems.has(item.id)) {
                // Only add if not already in map (prevents duplicates)
                if (!itemsMap.has(item.id)) {
                    itemsMap.set(item.id, item);
                }
            }
        });

        const modifiedItemsList = Array.from(itemsMap.values());
        console.log(`📊 Found ${modifiedItemsList.length} unique modified items out of ${processedData.length} total items`);
        console.log(`📊 modifiedItems Set size: ${modifiedItems.size}`);

        // If there's a mismatch, log a warning
        if (modifiedItemsList.length !== modifiedItems.size) {
            console.warn(`⚠️ Mismatch: ${modifiedItemsList.length} items found but ${modifiedItems.size} IDs in Set`);
            console.warn(`⚠️ This might indicate duplicate items or orphaned IDs in modifiedItems Set`);
        }

        return modifiedItemsList;
    }

    getSnapshot(dataStoreInstance) {
        return {
            processedData: dataStoreInstance.processedData,
            dataSource: dataStoreInstance.dataSource,
            dataSourceInfo: dataStoreInstance.dataSourceInfo,
            dataLoadTimestamp: dataStoreInstance.dataLoadTimestamp,
            modifiedItems: dataStoreInstance.modifiedItems,
            caseIdMappings: dataStoreInstance.caseIdMappings,
            caseIdConflicts: dataStoreInstance.caseIdConflicts,
            bdsaCaseIdConflicts: dataStoreInstance.bdsaCaseIdConflicts,
            caseProtocolMappings: dataStoreInstance.caseProtocolMappings,
            syncInProgress: dataStoreInstance.syncInProgress,
            syncStatus: dataStoreInstance.syncStatus,
            syncProgress: dataStoreInstance.syncProgress,
            lastSyncResults: dataStoreInstance.lastSyncResults,
            girderToken: dataStoreInstance.girderToken,
            dsaConfig: dataStoreInstance.dsaConfig,
            columnMappings: dataStoreInstance.columnMappings
        };
    }
}

const statisticsManager = new StatisticsManager();
export default statisticsManager;
