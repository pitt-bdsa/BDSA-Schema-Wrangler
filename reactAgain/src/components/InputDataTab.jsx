import React, { useState, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import dataStore, { getItemsToSyncCount } from '../utils/dataStore';
import dsaAuthStore from '../utils/dsaAuthStore';
import RegexRulesModal from './RegexRulesModal';
import BdsaMappingModal from './BdsaMappingModal';
import DsaSyncModal from './DsaSyncModal';
import { getDefaultRegexRules, applyRegexRules } from '../utils/regexExtractor';
import { HIDDEN_DSA_FIELDS, PRIORITY_BDSA_FIELDS, DEFAULT_COLUMN_VISIBILITY, DATA_SOURCE_TYPES } from '../utils/constants';
import './InputDataTab.css';

// Column display name mapping
const getColumnDisplayName = (fieldName) => {
    const displayNames = {
        'id': 'ID',
        'name': 'Name',
        'BDSA.bdsaLocal.bdsaCaseId': 'BDSA Case ID',
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

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

const InputDataTab = () => {
    const [dataSource, setDataSource] = useState(DATA_SOURCE_TYPES.DSA);
    const [dataStatus, setDataStatus] = useState(dataStore.getStatus());
    const [authStatus, setAuthStatus] = useState(dsaAuthStore.getStatus());
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [error, setError] = useState(null);
    const [csvFile, setCsvFile] = useState(null);
    const [showColumnPanel, setShowColumnPanel] = useState(false);
    const [columnVisibility, setColumnVisibility] = useState({});
    const [columnOrder, setColumnOrder] = useState([]);
    const [showRegexRules, setShowRegexRules] = useState(false);
    const [regexRules, setRegexRules] = useState(() => {
        // Load saved regex rules from localStorage
        const savedRules = localStorage.getItem('regexRules');
        if (savedRules) {
            try {
                return JSON.parse(savedRules);
            } catch (error) {
                console.error('Error loading saved regex rules:', error);
            }
        }
        return getDefaultRegexRules();
    });
    const [showBdsaMapping, setShowBdsaMapping] = useState(false);
    const [columnMappings, setColumnMappings] = useState(() => {
        // Load saved column mappings from localStorage
        const savedMappings = localStorage.getItem('columnMappings');
        if (savedMappings) {
            try {
                return JSON.parse(savedMappings);
            } catch (error) {
                console.error('Error loading saved column mappings:', error);
            }
        }
        return {
            localCaseId: '',
            localStainID: '',
            localRegionId: ''
        };
    });
    const [showDsaSync, setShowDsaSync] = useState(false);
    const [isDataRefresh, setIsDataRefresh] = useState(false);

    // Generate nested keys from an object (excluding meta.bdsaLocal fields)
    const generateNestedKeys = (obj, prefix = '') => {
        const keys = [];
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const fullKey = prefix ? `${prefix}.${key}` : key;
                const value = obj[key];
                if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
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

    // Generate a unique key for the current data source
    const getDataSourceKey = () => {
        console.log('🔍 Getting data source key:', {
            dataSource: dataStatus.dataSource,
            hasProcessedData: !!dataStatus.processedData,
            processedDataLength: dataStatus.processedData?.length,
            dataSourceInfo: dataStatus.dataSourceInfo
        });

        if (!dataStatus.dataSource || !dataStatus.processedData || dataStatus.processedData.length === 0) {
            console.log('🔍 No data source key - missing data');
            return null;
        }

        if (dataStatus.dataSource === 'csv' && dataStatus.dataSourceInfo?.fileName) {
            const key = `csv_${dataStatus.dataSourceInfo.fileName}`;
            console.log('🔍 CSV data source key:', key);
            return key;
        } else if (dataStatus.dataSource === 'dsa' && dataStatus.dataSourceInfo?.baseUrl && dataStatus.dataSourceInfo?.resourceId) {
            const key = `dsa_${dataStatus.dataSourceInfo.baseUrl}_${dataStatus.dataSourceInfo.resourceId}`;
            console.log('🔍 DSA data source key:', key);
            return key;
        }

        console.log('🔍 No data source key - missing info');
        return null;
    };

    // Load column configuration from localStorage
    const loadColumnConfig = () => {
        const dataSourceKey = getDataSourceKey();
        if (!dataSourceKey) return;

        try {
            const savedConfig = localStorage.getItem(`column_config_${dataSourceKey}`);
            if (savedConfig) {
                const config = JSON.parse(savedConfig);
                console.log('🔄 Loading column config for:', dataSourceKey, config);
                setColumnVisibility(config.visibility || {});
                setColumnOrder(config.order || []);
            }
        } catch (error) {
            console.error('Error loading column config:', error);
        }
    };

    // Save column configuration to localStorage
    const saveColumnConfig = (visibility, order) => {
        const dataSourceKey = getDataSourceKey();
        console.log('💾 Attempting to save column config:', {
            dataSourceKey,
            visibility: visibility || columnVisibility,
            order: order || columnOrder
        });

        if (!dataSourceKey) {
            console.log('💾 No data source key - cannot save');
            return;
        }

        try {
            const config = {
                visibility: visibility || columnVisibility,
                order: order || columnOrder,
                timestamp: new Date().toISOString()
            };
            localStorage.setItem(`column_config_${dataSourceKey}`, JSON.stringify(config));
            console.log('💾 Successfully saved column config for:', dataSourceKey, config);
        } catch (error) {
            console.error('Error saving column config:', error);
        }
    };

    useEffect(() => {
        const unsubscribeData = dataStore.subscribe(() => {
            const newStatus = dataStore.getStatus();
            console.log('🔄 InputDataTab received data update:', {
                processedDataLength: newStatus.processedData?.length || 0,
                dataSource: newStatus.dataSource
            });
            setDataStatus(newStatus);

            // Column loading is now handled in a separate useEffect
        });

        const unsubscribeAuth = dsaAuthStore.subscribe(() => {
            setAuthStatus(dsaAuthStore.getStatus());
        });

        return () => {
            unsubscribeData();
            unsubscribeAuth();
        };
    }, []);

    // Load column config when data is available
    useEffect(() => {
        if (dataStatus.processedData && dataStatus.processedData.length > 0 && dataStatus.dataSource) {
            console.log('🔄 Data loaded, attempting to load column config...');
            const dataSourceKey = getDataSourceKey();
            if (dataSourceKey) {
                try {
                    const savedConfig = localStorage.getItem(`column_config_${dataSourceKey}`);
                    if (savedConfig) {
                        const config = JSON.parse(savedConfig);
                        console.log('🔄 Loading saved column config for:', dataSourceKey, config);

                        console.log('🔍 Sample data structure:', dataStatus.processedData[0]);
                        const currentColumns = generateNestedKeys(dataStatus.processedData[0]);
                        console.log('🔍 Generated keys:', currentColumns);
                        const savedOrder = config.order || [];
                        const savedVisibility = config.visibility || {};

                        const hasAllColumns = currentColumns.every(col => savedOrder.includes(col));

                        if (hasAllColumns && savedOrder.length === currentColumns.length) {
                            console.log('🔄 Applying saved column config');
                            setColumnOrder(savedOrder);
                            setColumnVisibility(savedVisibility);
                        } else {
                            console.log('🔄 Saved config invalid, using preferred order');
                            // Use preferred order for default
                            const preferredOrder = PRIORITY_BDSA_FIELDS;

                            const allKeys = generateNestedKeys(dataStatus.processedData[0]);
                            const orderedKeys = [];
                            const remainingKeys = [...allKeys];

                            // Add preferred keys first
                            console.log('🔍 Applying preferred order:', {
                                preferredOrder: preferredOrder,
                                remainingKeys: remainingKeys,
                                allKeys: allKeys
                            });

                            preferredOrder.forEach(key => {
                                if (remainingKeys.includes(key)) {
                                    orderedKeys.push(key);
                                    const index = remainingKeys.indexOf(key);
                                    remainingKeys.splice(index, 1);
                                    console.log(`✅ Added priority field: ${key}`);
                                } else {
                                    console.log(`❌ Priority field not found in data: ${key}`);
                                }
                            });

                            // Add remaining keys
                            orderedKeys.push(...remainingKeys);

                            setColumnOrder(orderedKeys);
                            setColumnVisibility(DEFAULT_COLUMN_VISIBILITY);
                            saveColumnConfig(DEFAULT_COLUMN_VISIBILITY, orderedKeys);
                        }
                    } else {
                        console.log('🔄 No saved config found, using preferred order');
                        // Use preferred order for default
                        const preferredOrder = PRIORITY_BDSA_FIELDS;

                        const allKeys = generateNestedKeys(dataStatus.processedData[0]);
                        const orderedKeys = [];
                        const remainingKeys = [...allKeys];

                        // Add preferred keys first
                        preferredOrder.forEach(key => {
                            if (remainingKeys.includes(key)) {
                                orderedKeys.push(key);
                                const index = remainingKeys.indexOf(key);
                                remainingKeys.splice(index, 1);
                            }
                        });

                        // Add remaining keys
                        orderedKeys.push(...remainingKeys);

                        setColumnOrder(orderedKeys);
                        // Use default column visibility to hide unwanted fields
                        setColumnVisibility(DEFAULT_COLUMN_VISIBILITY);
                        saveColumnConfig(DEFAULT_COLUMN_VISIBILITY, orderedKeys);
                    }
                } catch (error) {
                    console.error('Error loading saved column config:', error);
                    // Use preferred order as fallback
                    const preferredOrder = PRIORITY_BDSA_FIELDS;

                    const allKeys = generateNestedKeys(dataStatus.processedData[0]);
                    const orderedKeys = [];
                    const remainingKeys = [...allKeys];

                    // Add preferred keys first
                    preferredOrder.forEach(key => {
                        if (remainingKeys.includes(key)) {
                            orderedKeys.push(key);
                            const index = remainingKeys.indexOf(key);
                            remainingKeys.splice(index, 1);
                        }
                    });

                    // Add remaining keys
                    orderedKeys.push(...remainingKeys);

                    setColumnOrder(orderedKeys);
                    setColumnVisibility(DEFAULT_COLUMN_VISIBILITY);
                }
            }
        }
    }, [dataStatus.processedData, dataStatus.dataSource, dataStatus.dataSourceInfo]);

    // Auto-apply regex rules when data is loaded (if no column mappings exist)
    // Only run this once when data is first loaded, not on every data change
    useEffect(() => {
        if (dataStatus.processedData && dataStatus.processedData.length > 0 && !isDataRefresh) {
            // Check if any BDSA local fields have values
            const hasBdsaValues = dataStatus.processedData.some(item =>
                (item.BDSA?.bdsaLocal?.localCaseId && item.BDSA.bdsaLocal.localCaseId.trim() !== '') ||
                (item.BDSA?.bdsaLocal?.localStainID && item.BDSA.bdsaLocal.localStainID.trim() !== '') ||
                (item.BDSA?.bdsaLocal?.localRegionId && item.BDSA.bdsaLocal.localRegionId.trim() !== '')
            );

            // If no BDSA values exist, auto-apply regex rules
            if (!hasBdsaValues) {
                console.log('🔄 No BDSA values found, auto-applying regex rules to items without existing data...');
                // Don't mark items as modified during initial data processing
                const result = dataStore.applyRegexRules(regexRules, false);
                if (result.success) {
                    console.log(`✅ Auto-applied regex rules: ${result.extractedCount} items updated (not marked as modified)`);
                }
            } else {
                console.log('🔄 BDSA values found, skipping auto-apply of regex rules to preserve existing data');
            }
        }
    }, [dataStatus.processedData, dataStatus.dataSource, isDataRefresh]); // Removed regexRules from dependencies

    // Auto-load DSA data when authenticated and no data is loaded
    useEffect(() => {
        if (authStatus.isAuthenticated &&
            dataSource === DATA_SOURCE_TYPES.DSA &&
            (!dataStatus.processedData || dataStatus.processedData.length === 0) &&
            !isLoading) {
            console.log('🚀 Auto-loading DSA data...');
            handleLoadDsa();
        }
    }, [authStatus.isAuthenticated, dataSource, dataStatus.processedData, isLoading]);

    const handleDataSourceChange = (newDataSource) => {
        setDataSource(newDataSource);
        setError(null);

        // Clear data when switching data sources
        if (newDataSource !== dataStatus.dataSource) {
            dataStore.clearData();
        }
    };

    const handleCsvFileChange = (event) => {
        const file = event.target.files[0];
        if (file && file.type === 'text/csv') {
            setCsvFile(file);
            setError(null);
        } else {
            setError('Please select a valid CSV file');
            setCsvFile(null);
        }
    };

    const handleLoadCsv = async () => {
        if (!csvFile) {
            setError('Please select a CSV file first');
            return;
        }

        setIsLoading(true);
        setLoadingMessage('Loading CSV file...');
        setError(null);

        try {
            const result = await dataStore.loadCsvData(csvFile);
            if (result.success) {
                console.log(`✅ Successfully loaded ${result.itemCount} items from CSV`);
            }
        } catch (error) {
            console.error('Error loading CSV:', error);
            setError(error.message);
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    };

    const handleLoadDsa = async () => {
        if (!authStatus.isAuthenticated) {
            setError('Please login to DSA server first');
            return;
        }

        // Check if this is a refresh (data already exists from same source)
        const isRefresh = dataStatus.processedData && dataStatus.processedData.length > 0 &&
            dataStatus.dataSource === 'dsa';
        setIsDataRefresh(isRefresh);

        setIsLoading(true);
        setLoadingMessage('Loading data from DSA server...');
        setError(null);

        try {
            const result = await dataStore.loadDsaData(dsaAuthStore);
            if (result.success) {
                console.log(`✅ Successfully loaded ${result.itemCount} items from DSA`);
            }
        } catch (error) {
            console.error('Error loading DSA data:', error);
            setError(error.message);
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
            // Reset the refresh flag after a short delay
            setTimeout(() => setIsDataRefresh(false), 100);
        }
    };

    const handleClearData = () => {
        if (window.confirm('Are you sure you want to clear all loaded data?')) {
            dataStore.clearData();
            setCsvFile(null);
            setError(null);
        }
    };

    const toggleColumnVisibility = (columnKey) => {
        setColumnVisibility(prev => {
            const isCurrentlyHidden = prev[columnKey] === false || HIDDEN_DSA_FIELDS.includes(columnKey);
            const newVisibility = {
                ...prev,
                [columnKey]: isCurrentlyHidden ? true : false
            };
            saveColumnConfig(newVisibility, columnOrder);
            return newVisibility;
        });
    };

    const showAllColumns = () => {
        setColumnVisibility({});
        saveColumnConfig({}, columnOrder);
    };

    const hideAllColumns = () => {
        if (!dataStatus.processedData || dataStatus.processedData.length === 0) return;

        const allColumns = Object.keys(dataStatus.processedData[0]);
        const hiddenColumns = {};
        allColumns.forEach(key => {
            hiddenColumns[key] = false;
        });
        setColumnVisibility(hiddenColumns);
        saveColumnConfig(hiddenColumns, columnOrder);
    };

    // Helper function to compare arrays
    const arraysEqual = (a, b) => {
        if (a.length !== b.length) return false;
        return a.every((val, index) => val === b[index]);
    };

    // Column reordering functions
    const moveColumn = (fromIndex, toIndex) => {
        const currentOrder = columnOrder.length > 0 ? columnOrder : Object.keys(dataStatus.processedData[0]);
        const newOrder = [...currentOrder];
        const [movedColumn] = newOrder.splice(fromIndex, 1);
        newOrder.splice(toIndex, 0, movedColumn);
        setColumnOrder(newOrder);
        saveColumnConfig(columnVisibility, newOrder);
    };

    const resetColumnOrder = () => {
        if (!dataStatus.processedData || dataStatus.processedData.length === 0) return;

        // Use the priority fields from constants
        const preferredOrder = PRIORITY_BDSA_FIELDS;

        const allKeys = generateNestedKeys(dataStatus.processedData[0]);

        // Create ordered list: preferred order first, then remaining keys
        const orderedKeys = [];
        const remainingKeys = [...allKeys];

        // Add preferred keys first
        preferredOrder.forEach(key => {
            if (remainingKeys.includes(key)) {
                orderedKeys.push(key);
                const index = remainingKeys.indexOf(key);
                remainingKeys.splice(index, 1);
            }
        });

        // Add remaining keys
        orderedKeys.push(...remainingKeys);

        setColumnOrder(orderedKeys);
        saveColumnConfig(columnVisibility, orderedKeys);
    };

    const handleSaveRegexRules = (newRules) => {
        setRegexRules(newRules);
        // Save to localStorage for persistence
        localStorage.setItem('regexRules', JSON.stringify(newRules));
        console.log('💾 Saved regex rules:', newRules);

        // Apply the regex rules to the current data
        const result = dataStore.applyRegexRules(newRules);
        if (result.success) {
            console.log(`✅ Applied regex rules: ${result.extractedCount} items updated`);
        } else {
            console.error('❌ Failed to apply regex rules:', result.error);
        }
    };

    const handleSaveColumnMappings = (newMappings) => {
        setColumnMappings(newMappings);
        // Save to localStorage for persistence
        localStorage.setItem('columnMappings', JSON.stringify(newMappings));
        console.log('💾 Saved column mappings:', newMappings);

        // Update dataStore with column mappings
        dataStore.setColumnMappings(newMappings);

        // Apply the mappings to the current data
        const result = dataStore.applyColumnMappings(newMappings);
        if (result.success) {
            console.log(`✅ Applied column mappings: ${result.updatedCount} items updated`);
        } else {
            console.error('❌ Failed to apply column mappings:', result.error);
        }
    };

    const getAvailableColumns = () => {
        if (!dataStatus.processedData || dataStatus.processedData.length === 0) {
            return [];
        }

        // Generate nested column keys from the first row (excluding meta.bdsaLocal fields)
        const firstRow = dataStatus.processedData[0];

        return generateNestedKeys(firstRow).sort();
    };

    // Generate column definitions from the first row of data
    const getColumnDefs = () => {
        if (!dataStatus.processedData || dataStatus.processedData.length === 0) {
            console.log('🔍 No data for column definitions');
            return [];
        }

        const firstRow = dataStatus.processedData[0];

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
                        const columnDef = {
                            field: fullKey,
                            headerName: getColumnDisplayName(fullKey),
                            sortable: true,
                            filter: true,
                            resizable: true,
                            minWidth: 150,
                            // Hide if explicitly set to false in columnVisibility OR if it's in HIDDEN_DSA_FIELDS (unless explicitly overridden)
                            hide: (columnVisibility[fullKey] === false) || (HIDDEN_DSA_FIELDS.includes(fullKey) && columnVisibility[fullKey] !== true),
                            cellStyle: (params) => {
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
                            }
                        };

                        // Make BDSA local fields editable
                        if (fullKey.startsWith('BDSA.bdsaLocal.')) {
                            columnDef.editable = true;
                            columnDef.onCellValueChanged = (params) => {
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
                                    dataStore.saveToStorage();
                                    dataStore.notify();

                                    console.log(`Manually updated ${colDef.field} to:`, newValue);
                                }
                            };
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

        return columnDefs;
    };

    return (
        <div className="input-data-tab">
            {isLoading && (
                <div className="loading-overlay">
                    <div className="loading-content">
                        <div className="loading-spinner"></div>
                        <p>{loadingMessage}</p>
                    </div>
                </div>
            )}

            {error && (
                <div className="error-message">
                    <span className="error-icon">⚠️</span>
                    {error}
                </div>
            )}

            {/* Toolbar */}
            <div className="controls-row">
                <div className="data-source-selector">
                    <label htmlFor="data-source">Data Source:</label>
                    <select
                        id="data-source"
                        value={dataSource}
                        onChange={(e) => handleDataSourceChange(e.target.value)}
                        className="data-source-dropdown"
                    >
                        <option value={DATA_SOURCE_TYPES.CSV}>CSV File</option>
                        <option value={DATA_SOURCE_TYPES.DSA}>Digital Slide Archive</option>
                    </select>
                </div>

                {dataSource === DATA_SOURCE_TYPES.CSV && (
                    <>
                        <div className="file-input-container">
                            <input
                                type="file"
                                id="csv-file"
                                accept=".csv"
                                onChange={handleCsvFileChange}
                                className="file-input"
                            />
                            <label htmlFor="csv-file" className="file-input-label">
                                {csvFile ? csvFile.name : 'Choose CSV File'}
                            </label>
                        </div>
                        <button
                            className="load-csv-btn"
                            onClick={handleLoadCsv}
                            disabled={!csvFile || isLoading}
                        >
                            Load CSV Data
                        </button>
                    </>
                )}

                {dataSource === DATA_SOURCE_TYPES.DSA && authStatus.isAuthenticated && (
                    <button
                        className="refresh-btn"
                        onClick={handleLoadDsa}
                        disabled={isLoading}
                    >
                        Refresh Data
                    </button>
                )}

                {dataStatus.processedData && dataStatus.processedData.length > 0 && (
                    <button
                        className="column-toggle-btn"
                        onClick={() => setShowColumnPanel(!showColumnPanel)}
                        title="Show/Hide Columns"
                    >
                        {showColumnPanel ? 'Hide Columns' : 'Show Columns'}
                    </button>
                )}

                {dataStatus.processedData && dataStatus.processedData.length > 0 && (
                    <button
                        className="bdsa-mapping-btn"
                        onClick={() => setShowBdsaMapping(true)}
                        title="Map source columns to BDSA schema fields"
                    >
                        BDSA Mapping
                    </button>
                )}

                {dataStatus.processedData && dataStatus.processedData.length > 0 && (
                    <button
                        className="regex-rules-btn"
                        onClick={() => setShowRegexRules(true)}
                        title="Configure Regex Rules for Data Extraction"
                    >
                        Regex Rules
                    </button>
                )}

                {dataStatus.processedData && dataStatus.processedData.length > 0 && dataStatus.dataSource === 'dsa' && (
                    <button
                        className="dsa-sync-btn"
                        onClick={() => setShowDsaSync(true)}
                        title="Sync BDSA metadata to DSA server"
                    >
                        <span className={`sync-icon ${getItemsToSyncCount() > 0 ? 'sync-icon-orange' : ''}`}>
                            {getItemsToSyncCount() > 0 ? '🟠' : '🔄'}
                        </span>
                        <span className="sync-text">
                            <span>DSA</span>
                            <span>Metadata</span>
                            <span>Sync</span>
                        </span>
                    </button>
                )}

                {/* Update Status Indicator */}
                {dataStatus.processedData && dataStatus.processedData.length > 0 && dataStore.modifiedItems.size > 0 && (
                    <div className="update-status-indicator">
                        <span className="update-status-text">
                            {dataStore.modifiedItems.size} of {dataStatus.processedData.length} items updated
                        </span>
                    </div>
                )}

                {/* Color Legend */}
                {dataStatus.processedData && dataStatus.processedData.length > 0 && (
                    <div className="color-legend">
                        <span className="legend-item">
                            <span className="legend-color column-mapping"></span>
                            Column Mapping
                        </span>
                        <span className="legend-item">
                            <span className="legend-color regex-extraction"></span>
                            Regex Extraction
                        </span>
                        <span className="legend-item">
                            <span className="legend-color manual-edit"></span>
                            Manual Edit
                        </span>
                        <span className="legend-item">
                            <span className="legend-color modified-row"></span>
                            Modified Row
                        </span>
                    </div>
                )}
            </div>

            {/* Column Visibility Modal */}
            {showColumnPanel && dataStatus.processedData && dataStatus.processedData.length > 0 && (
                <div className="modal-overlay" onClick={() => setShowColumnPanel(false)}>
                    <div className="modal-content column-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Column Visibility</h2>
                            <button className="close-button" onClick={() => setShowColumnPanel(false)}>×</button>
                        </div>

                        <div className="column-modal-content">
                            <div className="column-panel-actions">
                                <button onClick={showAllColumns} className="show-all-btn">
                                    Show All
                                </button>
                                <button onClick={hideAllColumns} className="hide-all-btn">
                                    Hide All
                                </button>
                                <button onClick={resetColumnOrder} className="reset-order-btn">
                                    Reset Order
                                </button>
                            </div>

                            <div className="column-list">
                                {(() => {
                                    const currentOrder = columnOrder.length > 0 ? columnOrder : Object.keys(dataStatus.processedData[0]);
                                    console.log('🔄 Rendering column list:', {
                                        columnOrder,
                                        currentOrder,
                                        dataKeys: Object.keys(dataStatus.processedData[0])
                                    });
                                    return currentOrder;
                                })().map((columnKey, index) => (
                                    <div key={columnKey} className="column-item draggable">
                                        <div className="drag-handle">⋮⋮</div>
                                        <label className="column-checkbox">
                                            <input
                                                type="checkbox"
                                                checked={columnVisibility[columnKey] !== false && !HIDDEN_DSA_FIELDS.includes(columnKey)}
                                                onChange={() => toggleColumnVisibility(columnKey)}
                                            />
                                            <span className="column-name">{columnKey}</span>
                                        </label>
                                        <div className="column-controls">
                                            <button
                                                className="move-up-btn"
                                                onClick={() => moveColumn(index, Math.max(0, index - 1))}
                                                disabled={index === 0}
                                                title="Move Up"
                                            >
                                                ↑
                                            </button>
                                            <button
                                                className="move-down-btn"
                                                onClick={() => {
                                                    const currentOrder = columnOrder.length > 0 ? columnOrder : Object.keys(dataStatus.processedData[0]);
                                                    moveColumn(index, Math.min(currentOrder.length - 1, index + 1));
                                                }}
                                                disabled={index === (columnOrder.length > 0 ? columnOrder : Object.keys(dataStatus.processedData[0])).length - 1}
                                                title="Move Down"
                                            >
                                                ↓
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Data Grid */}
            <div className="data-grid-container">
                {(() => {
                    console.log('🔍 Rendering data grid, dataStatus:', {
                        hasProcessedData: !!dataStatus.processedData,
                        processedDataLength: dataStatus.processedData?.length || 0,
                        dataSource: dataStatus.dataSource,
                        isLoading: dataStatus.isLoading
                    });
                    return dataStatus.processedData && dataStatus.processedData.length > 0;
                })() ? (
                    <div className="ag-theme-alpine" style={{ height: 'calc(100vh - 200px)', width: '100%', minHeight: '400px' }}>
                        <AgGridReact
                            rowData={dataStatus.processedData}
                            columnDefs={getColumnDefs()}
                            defaultColDef={{
                                resizable: true,
                                sortable: true,
                                filter: true,
                                minWidth: 150
                            }}
                            pagination={true}
                            paginationPageSize={50}
                            suppressHorizontalScroll={false}
                            suppressColumnVirtualisation={false}
                            suppressRowVirtualisation={false}
                        />
                    </div>
                ) : (
                    <div className="no-data-message">
                        <h3>No Data Loaded</h3>
                        <p>Select a data source above and load your data to get started.</p>
                        {dataSource === DATA_SOURCE_TYPES.CSV && (
                            <p>Choose a CSV file and click "Load CSV Data" to begin.</p>
                        )}
                        {dataSource === DATA_SOURCE_TYPES.DSA && (
                            <p>Configure your DSA server and click "Load DSA Data" to begin.</p>
                        )}
                    </div>
                )}
            </div>

            {/* BDSA Mapping Modal */}
            <BdsaMappingModal
                isOpen={showBdsaMapping}
                onClose={() => setShowBdsaMapping(false)}
                onSave={handleSaveColumnMappings}
                currentMappings={columnMappings}
                availableColumns={getAvailableColumns()}
            />

            {/* Regex Rules Modal */}
            <RegexRulesModal
                isOpen={showRegexRules}
                onClose={() => setShowRegexRules(false)}
                onSave={handleSaveRegexRules}
                currentRules={regexRules}
                sampleData={dataStatus.processedData || []}
            />

            {/* DSA Sync Modal */}
            <DsaSyncModal
                isOpen={showDsaSync}
                onClose={() => setShowDsaSync(false)}
            />
        </div>
    );
};

export default InputDataTab;
