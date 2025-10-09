// StorageManager - Handles localStorage persistence for the data store

class StorageManager {
    constructor() {
        this.storageKey = 'bdsa_data_store';
    }

    loadFromStorage(dataStoreInstance) {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const data = JSON.parse(stored);
                dataStoreInstance.processedData = dataStoreInstance.initializeBdsaStructure(data.processedData || []);
                dataStoreInstance.dataSource = data.dataSource;
                dataStoreInstance.dataSourceInfo = data.dataSourceInfo;
                dataStoreInstance.dataLoadTimestamp = data.dataLoadTimestamp;
                dataStoreInstance.modifiedItems = new Set(data.modifiedItems || []);
                dataStoreInstance.caseIdMappings = new Map(data.caseIdMappings || []);

                // Restore caseIdConflicts with proper Set values
                dataStoreInstance.caseIdConflicts = new Map();
                if (data.caseIdConflicts) {
                    for (const [localCaseId, bdsaIds] of data.caseIdConflicts) {
                        dataStoreInstance.caseIdConflicts.set(localCaseId, new Set(bdsaIds));
                    }
                }

                // Restore bdsaCaseIdConflicts with proper Set values
                dataStoreInstance.bdsaCaseIdConflicts = new Map();
                if (data.bdsaCaseIdConflicts) {
                    for (const [bdsaCaseId, localIds] of data.bdsaCaseIdConflicts) {
                        dataStoreInstance.bdsaCaseIdConflicts.set(bdsaCaseId, new Set(localIds));
                    }
                }

                dataStoreInstance.caseProtocolMappings = new Map(data.caseProtocolMappings || []);

                console.log(`📦 Loaded data from localStorage:`, {
                    itemCount: dataStoreInstance.processedData.length,
                    dataSource: dataStoreInstance.dataSource,
                    modifiedItems: dataStoreInstance.modifiedItems.size,
                    hasBdsaCaseIds: dataStoreInstance.processedData.some(item => item.BDSA?.bdsaLocal?.bdsaCaseId),
                    sampleBDSA: dataStoreInstance.processedData[0]?.BDSA
                });
            }
        } catch (error) {
            console.error('Error loading data store from storage:', error);
        }
    }

    saveToStorage(dataStoreInstance) {
        try {
            const data = {
                processedData: dataStoreInstance.processedData,
                dataSource: dataStoreInstance.dataSource,
                dataSourceInfo: dataStoreInstance.dataSourceInfo,
                dataLoadTimestamp: dataStoreInstance.dataLoadTimestamp,
                modifiedItems: Array.from(dataStoreInstance.modifiedItems),
                caseIdMappings: Array.from(dataStoreInstance.caseIdMappings),
                caseIdConflicts: Array.from(dataStoreInstance.caseIdConflicts),
                bdsaCaseIdConflicts: Array.from(dataStoreInstance.bdsaCaseIdConflicts),
                caseProtocolMappings: Array.from(dataStoreInstance.caseProtocolMappings)
            };
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (error) {
            console.error('Error saving data store to storage:', error);
        }
    }

    clearStorage() {
        try {
            localStorage.removeItem(this.storageKey);
            console.log('🗑️ Cleared data store from localStorage');
        } catch (error) {
            console.error('Error clearing storage:', error);
        }
    }
}

const storageManager = new StorageManager();
export default storageManager;
