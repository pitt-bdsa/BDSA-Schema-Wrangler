// ColumnMapper - Handles column mapping from source data to BDSA fields

class ColumnMapper {
    constructor() {
        // This class is stateless
    }

    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    applyRegexRules(processedData, regexRules, modifiedItems, notifyCallback, markAsModified = true, forceOverride = false) {
        if (!processedData || processedData.length === 0) {
            return { success: false, error: 'No data available' };
        }

        if (!regexRules) {
            return { success: false, error: 'No regex rules provided' };
        }

        let extractedCount = 0;
        let skippedCount = 0;
        const updatedItems = [];

        // Debug: Log what we're about to process
        const rulesToApply = Object.entries(regexRules).filter(([field, rule]) => rule.pattern && rule.pattern.trim() !== '');
        console.log('🔍 Starting regex processing:', {
            totalItems: processedData.length,
            rulesToApply,
            markAsModified,
            forceOverride
        });

        // Debug: Check how many items have empty fields for each rule
        rulesToApply.forEach(([field, rule]) => {
            const emptyCount = processedData.filter(item => {
                const currentValue = item.BDSA?.bdsaLocal?.[field];
                return !currentValue;
            }).length;

            const regexCount = processedData.filter(item => {
                const currentSource = item.BDSA?._dataSource?.[field];
                return currentSource === 'regex';
            }).length;

            const manualCount = processedData.filter(item => {
                const currentSource = item.BDSA?._dataSource?.[field];
                return currentSource === 'manual';
            }).length;

            const mappingCount = processedData.filter(item => {
                const currentSource = item.BDSA?._dataSource?.[field];
                return currentSource === 'column_mapping';
            }).length;

            console.log(`🔍 Field "${field}": ${emptyCount} empty, ${regexCount} from regex, ${manualCount} manual, ${mappingCount} from mapping`);
        });

        processedData.forEach((item, index) => {
            let itemUpdated = false;
            let valueChanged = false;
            const fileName = item.name || item.dsa_name || '';

            // Ensure BDSA object exists
            if (!item.BDSA) {
                item.BDSA = {
                    bdsaLocal: {},
                    _dataSource: {},
                    _lastModified: new Date().toISOString()
                };
            }

            // Note: We no longer skip items with server metadata entirely
            // Instead, we'll check each field individually to see if it's empty

            // Debug: Log first few items to see what's happening
            if (index < 3) {
                console.log(`🔍 Processing item ${index}:`, {
                    id: item.id,
                    name: fileName,
                    hasBDSA: !!item.BDSA,
                    bdsaLocal: item.BDSA?.bdsaLocal
                });
            }

            // Try primary pattern with named groups first
            let primaryMatch = null;
            if (regexRules.primaryPattern && regexRules.primaryPattern.pattern && regexRules.primaryPattern.pattern.trim() !== '') {
                try {
                    const primaryRegex = new RegExp(regexRules.primaryPattern.pattern);
                    primaryMatch = fileName.match(primaryRegex);

                    if (primaryMatch && primaryMatch.groups) {
                        console.log(`🔍 Primary pattern matched for item ${index}:`, primaryMatch.groups);

                        // Initialize nested structure if needed
                        if (!item.BDSA.bdsaLocal) {
                            item.BDSA.bdsaLocal = {};
                        }
                        if (!item.BDSA._dataSource) {
                            item.BDSA._dataSource = {};
                        }

                        // Extract all fields from named groups
                        Object.entries(primaryMatch.groups).forEach(([field, extractedValue]) => {
                            if (extractedValue) {
                                const currentValue = item.BDSA.bdsaLocal?.[field];
                                const currentSource = item.BDSA._dataSource?.[field];

                                // Apply if field is empty or we're overriding values when forceOverride is true
                                const shouldApply = !currentValue || (forceOverride && currentSource !== 'manual' && currentSource !== 'column_mapping');
                                
                                // Debug logging for override logic
                                if (index < 5) {
                                    console.log(`🔍 Override logic for ${field}:`, {
                                        currentValue,
                                        currentSource,
                                        forceOverride,
                                        shouldApply,
                                        condition1: !currentValue,
                                        condition2: forceOverride,
                                        condition3: currentSource !== 'manual',
                                        condition4: currentSource !== 'column_mapping'
                                    });
                                }
                                
                                if (shouldApply) {
                                    const fieldValueChanged = currentValue !== extractedValue;
                                    
                                    item.BDSA.bdsaLocal[field] = extractedValue;
                                    item.BDSA._dataSource[field] = 'regex';
                                    item.BDSA._lastModified = new Date().toISOString();
                                    itemUpdated = true;
                                    
                                    // Track if any value actually changed for this item
                                    if (fieldValueChanged) {
                                        valueChanged = true;
                                        console.log(`✅ Extracted ${field} = ${extractedValue} from primary pattern (value changed from ${currentValue})`);
                                    } else {
                                        console.log(`✅ Extracted ${field} = ${extractedValue} from primary pattern (value unchanged)`);
                                    }
                                } else {
                                    console.log(`⏭️ Skipped ${field} (already has value from ${currentSource})`);
                                }
                            }
                        });
                    }
                } catch (error) {
                    console.error('Primary pattern regex error:', error);
                }
            }

            // If primary pattern didn't match, try fallback patterns
            if (!primaryMatch && regexRules.fallbackPatterns) {
                Object.entries(regexRules.fallbackPatterns).forEach(([field, rule]) => {
                    if (rule && rule.pattern && rule.pattern.trim() !== '') {
                        // Only apply regex if field is not already populated
                        const currentValue = item.BDSA.bdsaLocal?.[field];
                        const currentSource = item.BDSA._dataSource?.[field];

                        // Debug: Log field processing for first few items
                        if (index < 3) {
                            console.log(`🔍 Processing fallback field ${field}:`, {
                                currentValue,
                                currentSource,
                                willApply: !currentValue || (currentSource === 'regex' && (markAsModified || forceOverride)),
                                pattern: rule.pattern,
                                forceOverride
                            });
                        }

                        // Apply regex if:
                        // 1. Field is empty (no current value), OR
                        // 2. We're overriding values when forceOverride is true (except manual/column_mapping)
                        // PROTECTED: Never override 'manual' edits or 'column_mapping' sources
                        const shouldApplyFallback = !currentValue || (forceOverride && currentSource !== 'manual' && currentSource !== 'column_mapping');
                        
                        if (shouldApplyFallback) {
                            try {
                                const regex = new RegExp(rule.pattern);
                                const match = fileName.match(regex);

                                if (match) {
                                    const extractedValue = match[1] || match[0];
                                    const fieldValueChanged = currentValue !== extractedValue;

                                    // Initialize nested structure if needed
                                    if (!item.BDSA.bdsaLocal) {
                                        item.BDSA.bdsaLocal = {};
                                    }
                                    if (!item.BDSA._dataSource) {
                                        item.BDSA._dataSource = {};
                                    }

                                    item.BDSA.bdsaLocal[field] = extractedValue;
                                    item.BDSA._dataSource[field] = 'regex';
                                    item.BDSA._lastModified = new Date().toISOString();
                                    itemUpdated = true;
                                    
                                    // Track if any value actually changed for this item
                                    if (fieldValueChanged) {
                                        valueChanged = true;
                                        console.log(`✅ Extracted ${field} = ${extractedValue} from fallback pattern (value changed from ${currentValue})`);
                                    } else {
                                        console.log(`✅ Extracted ${field} = ${extractedValue} from fallback pattern (value unchanged)`);
                                    }
                                }
                            } catch (error) {
                                console.error(`Fallback regex error for field ${field}:`, error);
                            }
                        }
                    }
                });
            }

            if (itemUpdated) {
                // Only mark as modified if this is user-initiated processing AND values actually changed
                if (markAsModified && valueChanged) {
                    modifiedItems.add(item.id);
                    console.log(`🔍 Added item ${item.id} to modifiedItems via regex (value changed). Total modified: ${modifiedItems.size}`);
                } else if (markAsModified && !valueChanged) {
                    console.log(`🔍 Item ${item.id} updated via regex but no values changed, not marking as modified`);
                }
                extractedCount++;
                if (index < 3) {
                    console.log(`✅ Item ${index} updated via regex (valueChanged: ${valueChanged})`);
                }
            } else {
                skippedCount++;
                if (index < 3) {
                    console.log(`⏭️ Item ${index} skipped (no updates needed)`);
                }
            }
        });

        // Skip saveToStorage() for large datasets to avoid quota errors
        // saveToStorage callback would go here
        notifyCallback();

        console.log(`🔍 Applied regex rules: ${extractedCount} items updated`);
        return {
            success: true,
            extractedCount,
            updatedItems: extractedCount,
            skippedItems: processedData.length - extractedCount,
            totalItems: processedData.length
        };
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
