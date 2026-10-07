// ColumnMapper - Handles column mapping from source data to BDSA fields

import { applyRegexRulesToItems } from './regexExtractor.js';

class ColumnMapper {
    constructor() {
        // This class is stateless
    }

    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    applyRegexRules(processedData, regexRules, modifiedItems, notifyCallback, markAsModified = true, forceOverride = false) {
        const result = applyRegexRulesToItems(processedData, regexRules, {
            markAsModified,
            forceOverride,
            modifiedItems,
        });
        if (typeof notifyCallback === 'function') {
            notifyCallback();
        }
        return result;
    }

    applyColumnMappings(processedData, columnMappings, modifiedItems, notifyCallback, markAsModified = true) {
        if (!processedData || processedData.length === 0) {
            return { success: false, error: 'No data available' };
        }

        if (!columnMappings) {
            return { success: false, error: 'No column mappings provided' };
        }

        let updatedCount = 0;
        const updatedItems = [];

        processedData.forEach((item, index) => {
            let itemUpdated = false;

            // Apply mappings for each field
            Object.entries(columnMappings).forEach(([bdsaField, sourceColumn]) => {
                if (sourceColumn && sourceColumn.trim() !== '') {
                    // Use nested property access for columns like 'accessoryData.accessory_SubNum'
                    const sourceValue = this.getNestedValue(item, sourceColumn);

                    // Debug first few items
                    if (index < 3) {
                        console.log(`🔍 Column mapping [item ${index}]: ${bdsaField} ← ${sourceColumn} = ${sourceValue}`);
                    }

                    // Only update if source value exists and is not empty
                    if (sourceValue !== null && sourceValue !== undefined && sourceValue !== '') {
                        // Initialize nested structure if needed (directly on item, not a copy)
                        if (!item.BDSA) {
                            item.BDSA = {
                                bdsaLocal: {},
                                _dataSource: {}
                            };
                        }
                        if (!item.BDSA.bdsaLocal) {
                            item.BDSA.bdsaLocal = {};
                        }
                        if (!item.BDSA._dataSource) {
                            item.BDSA._dataSource = {};
                        }

                        // Set the value and track source directly on the item
                        item.BDSA.bdsaLocal[bdsaField] = sourceValue;
                        item.BDSA._dataSource[bdsaField] = 'column_mapping';
                        item.BDSA._lastModified = new Date().toISOString();
                        itemUpdated = true;

                        // Debug successful mapping
                        if (index < 3) {
                            console.log(`✅ Mapped ${bdsaField} = ${sourceValue} from ${sourceColumn}`);
                        }
                    }
                }
            });

            if (itemUpdated) {
                // Only mark as modified if requested
                if (markAsModified) {
                    modifiedItems.add(item.id);
                    console.log(`🔍 Added item ${item.id} to modifiedItems. Total modified: ${modifiedItems.size}`);
                } else {
                    console.log(`🔍 Updated item ${item.id} but did not mark as modified (data refresh)`);
                }
                updatedCount++;
            }
        });

        // Skip saveToStorage() for large datasets to avoid quota errors
        // Data will be persisted via export/sync instead
        // saveToStorage() would go here
        notifyCallback();

        console.log(`📊 Applied column mappings: ${updatedCount} items updated`);
        return {
            success: true,
            updatedCount,
            totalItems: processedData.length
        };
    }
}

const columnMapper = new ColumnMapper();
export default columnMapper;
