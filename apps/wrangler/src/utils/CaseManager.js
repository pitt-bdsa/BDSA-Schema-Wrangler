// CaseManager - Handles case ID mapping and conflict detection

import { normalizeLocalCaseId } from './bdsaCaseIdAllocator.js';

class CaseManager {
    constructor() {
        // This class is stateless and operates on provided data
    }

    initializeCaseIdMappingsFromData(processedData, dataStoreInstance) {
        console.log('🔍 initializeCaseIdMappingsFromData called with', processedData?.length, 'items');
        if (!processedData || processedData.length === 0) {
            console.log('🔍 No processed data available for conflict detection');
            return;
        }

        const mappings = new Map();
        const conflicts = new Map();
        const bdsaConflicts = new Map();

        // First pass: collect all mappings and detect localCaseId conflicts
        processedData.forEach((item) => {
            const localCaseId = normalizeLocalCaseId(item.BDSA?.bdsaLocal?.localCaseId);
            const bdsaCaseId = item.BDSA?.bdsaLocal?.bdsaCaseId && String(item.BDSA.bdsaLocal.bdsaCaseId).trim();

            if (localCaseId && bdsaCaseId) {
                // Check for conflicts - same localCaseId but different bdsaCaseId
                if (mappings.has(localCaseId) && mappings.get(localCaseId) !== bdsaCaseId) {
                    // Record the conflict
                    if (!conflicts.has(localCaseId)) {
                        conflicts.set(localCaseId, new Set([mappings.get(localCaseId)]));
                    }
                    conflicts.get(localCaseId).add(bdsaCaseId);
                    console.warn(`⚠️ Local Case ID Conflict: localCaseId "${localCaseId}" has multiple BDSA Case IDs:`, Array.from(conflicts.get(localCaseId)));
                } else {
                    mappings.set(localCaseId, bdsaCaseId);
                }
            }
        });

        // Second pass: detect bdsaCaseId conflicts (same BDSA Case ID mapped to multiple local case IDs)
        const bdsaToLocalMap = new Map();
        processedData.forEach((item) => {
            const localCaseId = normalizeLocalCaseId(item.BDSA?.bdsaLocal?.localCaseId);
            const bdsaCaseId = item.BDSA?.bdsaLocal?.bdsaCaseId && String(item.BDSA.bdsaLocal.bdsaCaseId).trim();

            if (localCaseId && bdsaCaseId) {
                if (bdsaToLocalMap.has(bdsaCaseId)) {
                    const existingLocalIds = bdsaToLocalMap.get(bdsaCaseId);
                    if (!existingLocalIds.has(localCaseId)) {
                        existingLocalIds.add(localCaseId);
                        if (existingLocalIds.size === 2) {
                            // First time we detect this conflict
                            bdsaConflicts.set(bdsaCaseId, new Set(existingLocalIds));
                            console.warn(`⚠️ BDSA Case ID Conflict: bdsaCaseId "${bdsaCaseId}" is mapped to multiple local case IDs:`, Array.from(existingLocalIds));
                        } else {
                            // Update existing conflict
                            bdsaConflicts.get(bdsaCaseId).add(localCaseId);
                            console.warn(`⚠️ BDSA Case ID Conflict: bdsaCaseId "${bdsaCaseId}" is mapped to multiple local case IDs:`, Array.from(bdsaConflicts.get(bdsaCaseId)));
                        }
                    }
                } else {
                    bdsaToLocalMap.set(bdsaCaseId, new Set([localCaseId]));
                }
            }
        });

        dataStoreInstance.caseIdMappings = mappings;
        dataStoreInstance.caseIdConflicts = conflicts;
        dataStoreInstance.bdsaCaseIdConflicts = bdsaConflicts;

        console.log(`Initialized case ID mappings from data: ${mappings.size} mappings found`);
        if (conflicts.size > 0) {
            console.warn(`⚠️ Found ${conflicts.size} local case ID conflicts that need resolution`);
            console.log('🔍 Local conflicts:', conflicts);
        }
        if (bdsaConflicts.size > 0) {
            console.warn(`⚠️ Found ${bdsaConflicts.size} BDSA case ID conflicts that need resolution`);
            console.log('🔍 BDSA conflicts:', bdsaConflicts);
        } else {
            console.log('🔍 No BDSA conflicts detected');
        }
    }

    applyCaseIdMappingsToData(processedData, caseIdMappings, dataStoreInstance) {
        if (!processedData || processedData.length === 0) {
            console.log('🔧 applyCaseIdMappingsToData: No processed data');
            return;
        }

        console.log(`🔧 applyCaseIdMappingsToData: Processing ${processedData.length} items with ${caseIdMappings.size} mappings`);
        if (caseIdMappings.size > 0) {
            console.log('🔧 Current mappings:', Array.from(caseIdMappings.entries()));
        }
        let updatedCount = 0;

        processedData.forEach((item) => {
            const currentLocalCaseId = normalizeLocalCaseId(item.BDSA?.bdsaLocal?.localCaseId);
            if (currentLocalCaseId && caseIdMappings.has(currentLocalCaseId)) {
                const bdsaCaseId = caseIdMappings.get(currentLocalCaseId);

                // Only update if the value has changed
                if (item.BDSA?.bdsaLocal?.bdsaCaseId !== bdsaCaseId) {
                    if (!item.BDSA) {
                        item.BDSA = {};
                    }
                    if (!item.BDSA.bdsaLocal) {
                        item.BDSA.bdsaLocal = {};
                    }

                    item.BDSA.bdsaLocal.bdsaCaseId = bdsaCaseId;
                    item.BDSA._lastModified = new Date().toISOString();

                    // Mark the data source for UI highlighting
                    if (!item.BDSA._dataSource) {
                        item.BDSA._dataSource = {};
                    }
                    item.BDSA._dataSource.bdsaCaseId = 'case_id_mapping';

                    // Explicitly mark item as modified (fallback in case proxy doesn't work)
                    const itemId = item.id || item._id || item.dsa_id;
                    if (itemId) {
                        dataStoreInstance.modifiedItems.add(itemId);
                        console.log(`🔍 CaseManager: Added item ${itemId} to modifiedItems. Total modified: ${dataStoreInstance.modifiedItems.size}`);
                    }
                    
                    updatedCount++;
                }
            }
        });

        if (updatedCount > 0) {
            console.log(`Applied case ID mappings to ${updatedCount} data items`);
            console.log(`🔍 Added ${updatedCount} items to modifiedItems via case ID mappings. Total modified: ${dataStoreInstance.modifiedItems.size}`);

            // Notify listeners so UI updates with new modified count
            dataStoreInstance.notify();
        }
    }
}

const caseManager = new CaseManager();
export default caseManager;
