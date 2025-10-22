import { HIDDEN_DSA_FIELDS, PRIORITY_BDSA_FIELDS } from './constants';
import dataStore from './dataStore';

// Column display name mapping
const getColumnDisplayName = (fieldName) => {
    const displayNames = {
        'id': 'ID',
        'name': 'Name',
        'BDSA.bdsaLocal.bdsaCaseId': 'BDSA Case ID',
        'BDSA.bdsaLocal.bdsaStainProtocol': 'BDSA Stain Protocol',
        'BDSA.bdsaLocal.bdsaRegionProtocol': 'BDSA Region Protocol',
        'BDSA.bdsaLocal.localCaseId': 'Local Case ID',
        'BDSA.bdsaLocal.localRegionId': 'Local Region ID',
        'BDSA.bdsaLocal.localStainID': 'Local Stain ID',
        'dsa_name': 'DSA Name',
        'dsa_created': 'DSA Created',
        'dsa_updated': 'DSA Updated',
        'dsa_size': 'DSA Size',
        'dsa_mimeType': 'DSA MIME Type',
        'meta.bdsaLocal.localCaseId': 'Meta Local Case ID',
        'meta.bdsaLocal.localStainID': 'Meta Local Stain ID',
        'meta.bdsaLocal.localRegionId': 'Meta Local Region ID',
        'meta.bdsaLocal.lastUpdated': 'Meta Last Updated',
        'meta.bdsaLocal.source': 'Meta Source',
        'meta.BDSA.bdsaLocal.bdsaStainProtocol': 'Meta BDSA Stain Protocol',
        'meta.BDSA.bdsaLocal.bdsaRegionProtocol': 'Meta BDSA Region Protocol',
        '_id': 'Internal ID',
        '_modelType': 'Model Type',
        '_accessLevel': 'Access Level',
        '_version': 'Version',
        '_text': 'Text',
        '_textScore': 'Text Score',
        'meta.originalName': 'Original Name',
        'meta.contentType': 'Content Type',
        'meta.size': 'File Size',
        'meta.checksum': 'Checksum',
        'meta.creatorId': 'Creator ID',
        'meta.creatorName': 'Creator Name',
        'meta.updated': 'Meta Updated',
        'meta.created': 'Meta Created',
        'girder': 'Girder',
        'girderId': 'Girder ID',
        'girderParentId': 'Girder Parent ID',
        'girderParentCollection': 'Girder Parent Collection',
        'description': 'Description',
        'notes': 'Notes',
        'tags': 'Tags',
        'public': 'Public',
        'folderId': 'Folder ID',
        'parentId': 'Parent ID',
        'parentCollection': 'Parent Collection',
        'baseParentId': 'Base Parent ID',
        'baseParentType': 'Base Parent Type'
    };

    return displayNames[fieldName] || fieldName;
};

const generateNestedKeys = (obj, prefix = '') => {
    const keys = [];
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            const value = obj[key];

            if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                // Recursively process nested objects
                keys.push(...generateNestedKeys(value, fullKey));
            } else {
                // Skip fields that should be hidden by default
                if (!HIDDEN_DSA_FIELDS.includes(fullKey)) {
                    keys.push(fullKey);
                }
            }
        }
    }
    return keys;
};

const getCellStyle = (params, fullKey) => {
    const rowData = params.data;
    const isModified = dataStore.modifiedItems?.has(rowData?.id);

    // Highlight BDSA fields with different colors based on data source
    if (fullKey.startsWith('BDSA.bdsaLocal.')) {
        const fieldName = fullKey.replace('BDSA.bdsaLocal.', '');
        const dataSource = rowData?.BDSA?._dataSource?.[fieldName];

        if (dataSource === 'column_mapping') {
            return {
                backgroundColor: '#e8f5e8',
                borderLeft: '4px solid #28a745',
                fontWeight: '500'
            };
        } else if (dataSource === 'regex') {
            return {
                backgroundColor: '#fff3cd',
                borderLeft: '4px solid #ffc107',
                fontWeight: '500'
            };
        } else if (dataSource === 'case_id_mapping') {
            return {
                backgroundColor: '#d4edda',
                borderLeft: '4px solid #28a745',
                fontWeight: '600'
            };
        } else if (params.value && params.value !== null && params.value !== '') {
            return {
                backgroundColor: '#f8f9fa',
                borderLeft: '4px solid #6c757d',
                fontWeight: '500'
            };
        }
    }

    // Highlight DSA-specific fields
    if (fullKey.startsWith('dsa_') || fullKey === 'id' || fullKey === 'name') {
        return { backgroundColor: '#f0f7ff', fontWeight: 'bold' };
    }

    // Highlight modified rows
    if (isModified) {
        return { backgroundColor: '#fff3e0', borderTop: '2px solid #ff9800' };
    }

    return null;
};

const onCellValueChanged = (params) => {
    console.log('🔍 onCellValueChanged called:', params);
    const { data, newValue, oldValue, colDef } = params;
    if (newValue !== oldValue) {
        // Update the BDSA field
        if (!data.BDSA) {
            data.BDSA = {};
        }
        const fieldName = colDef.field.replace('BDSA.bdsaLocal.', '');
        data.BDSA[fieldName] = newValue;

        // Set data source to manual and update timestamp
        if (!data.BDSA._dataSource) {
            data.BDSA._dataSource = {};
        }
        data.BDSA._dataSource[fieldName] = 'manual';
        data.BDSA._lastModified = new Date().toISOString();

        // Mark item as modified
        dataStore.modifiedItems.add(data.id);
        console.log(`🔍 Added item ${data.id} to modifiedItems. Total modified: ${dataStore.modifiedItems.size}`);

        // Notify listeners to update UI
        dataStore.notify();

        console.log(`📝 Manual edit: ${colDef.field} = "${newValue}" (was "${oldValue}")`);
    }
};

export const generateColumnDefinitions = (processedData, columnVisibility, columnOrder) => {
    if (!processedData || processedData.length === 0) {
        console.log('🔍 No data for column definitions');
        return [];
    }

    const firstRow = processedData[0];

    // Generate column definitions with proper nested field paths
    const generateColumnDefs = (obj, prefix = '') => {
        const columns = [];

        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const fullKey = prefix ? `${prefix}.${key}` : key;
                const value = obj[key];

                if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                    // Recursively process nested objects
                    columns.push(...generateColumnDefs(value, fullKey));
                } else {
                    // Add column for primitive values

                    // Check if field should be hidden
                    const isMetaBDSAPattern = fullKey.startsWith('meta.BDSA.') || fullKey.startsWith('meta.bdsaLocal.');
                    const isBDSAManagedField = fullKey.startsWith('BDSA.bdsaLocal.');
                    const isBDSAInternalField = fullKey.startsWith('BDSA._');
                    const isRawDuplicateField = ['localCaseId', 'localStainID', 'localRegionId', 'localImageType'].includes(fullKey);
                    const isInternalField = fullKey.startsWith('_') || fullKey.includes('_dataSource') || fullKey.includes('_lastModified') || fullKey.includes('_localLastModified');

                    // Additional check for any BDSA-related fields that might have slipped through
                    const isAnyBDSAPattern = fullKey.includes('BDSA') || fullKey.includes('bdsaLocal');

                    const shouldHide = (columnVisibility[fullKey] === false) ||
                        (HIDDEN_DSA_FIELDS.includes(fullKey) && columnVisibility[fullKey] !== true) ||
                        // Hide all meta.BDSA.* and meta.bdsaLocal.* fields (unless explicitly shown)
                        (isMetaBDSAPattern && columnVisibility[fullKey] !== true) ||
                        // Hide raw duplicate fields that we manage in BDSA structure
                        (isRawDuplicateField && columnVisibility[fullKey] !== true) ||
                        // Hide internal tracking fields (unless explicitly shown)
                        (isInternalField && columnVisibility[fullKey] !== true) ||
                        // Hide BDSA internal fields like BDSA._dataSource, BDSA._lastModified
                        (isBDSAInternalField && columnVisibility[fullKey] !== true) ||
                        // Hide any other BDSA-related fields that we manage separately (unless explicitly shown)
                        (isAnyBDSAPattern && !isBDSAManagedField && columnVisibility[fullKey] !== true);

                    // Debug logging for problematic fields
                    if (isMetaBDSAPattern || isRawDuplicateField || isAnyBDSAPattern || isInternalField || isBDSAInternalField) {
                        console.log(`🔍 Column hiding check for ${fullKey}:`, {
                            isMetaBDSAPattern,
                            isRawDuplicateField,
                            isAnyBDSAPattern,
                            isInternalField,
                            isBDSAInternalField,
                            isBDSAManagedField,
                            columnVisibilityValue: columnVisibility[fullKey],
                            shouldHide,
                            willBeHidden: shouldHide
                        });
                    }

                    const columnDef = {
                        field: fullKey,
                        headerName: getColumnDisplayName(fullKey),
                        sortable: true,
                        filter: true,
                        resizable: true,
                        minWidth: 150,
                        hide: shouldHide,
                        cellStyle: (params) => getCellStyle(params, fullKey)
                    };

                    // Debug BDSA columns
                    if (fullKey.startsWith('BDSA.bdsaLocal.')) {
                        console.log(`🔍 BDSA Column definition:`, {
                            field: fullKey,
                            headerName: columnDef.headerName,
                            hide: columnDef.hide
                        });
                    }

                    // Make BDSA local fields editable
                    if (fullKey.startsWith('BDSA.bdsaLocal.')) {
                        columnDef.editable = true;
                        columnDef.onCellValueChanged = onCellValueChanged;
                        console.log(`🔍 BDSA Column created: ${fullKey} (editable: ${columnDef.editable})`);
                    }

                    columns.push(columnDef);
                }
            }
        }

        return columns;
    };

    const allColumns = generateColumnDefs(firstRow);

    // Use the priority fields from constants
    const preferredOrder = PRIORITY_BDSA_FIELDS;

    // Create ordered columns array
    const orderedColumns = [];
    const remainingColumns = [...allColumns];

    console.log('🔍 Column generation debug:', {
        allColumns: allColumns.map(col => col.field),
        columnOrder: columnOrder,
        preferredOrder: preferredOrder
    });

    // If we have a saved column order, use it (this takes precedence)
    if (columnOrder.length > 0) {
        columnOrder.forEach(field => {
            const column = remainingColumns.find(col => col.field === field);
            if (column) {
                orderedColumns.push(column);
                const index = remainingColumns.indexOf(column);
                remainingColumns.splice(index, 1);
            }
        });
    } else {
        // Only use preferred order if no saved order exists
        preferredOrder.forEach(field => {
            const column = remainingColumns.find(col => col.field === field);
            if (column) {
                orderedColumns.push(column);
                const index = remainingColumns.indexOf(column);
                remainingColumns.splice(index, 1);
            }
        });
    }

    // Finally, add any remaining columns
    orderedColumns.push(...remainingColumns);

    const columnDefs = orderedColumns;

    console.log('🔍 Generated column definitions:', {
        count: columnDefs.length,
        sampleColumns: columnDefs.slice(0, 5).map(col => col.field)
    });

    // Debug: Check for meta.npClinical columns
    const metaNpClinicalColumns = columnDefs.filter(col => col.field.startsWith('meta.npClinical.'));
    console.log('🔍 meta.npClinical columns found:', {
        count: metaNpClinicalColumns.length,
        sampleFields: metaNpClinicalColumns.slice(0, 5).map(col => col.field)
    });

    // Debug: Check if the data actually has values for these fields
    if (processedData.length > 0) {
        const firstRow = processedData[0];
        const sampleMetaFields = metaNpClinicalColumns.slice(0, 3).map(col => ({
            field: col.field,
            value: firstRow[col.field],
            type: typeof firstRow[col.field]
        }));
        console.log('🔍 Sample meta.npClinical values in data:', sampleMetaFields);
    }

    return columnDefs;
};

export { getColumnDisplayName, generateNestedKeys };
