import React, { useState, useEffect } from 'react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import dataStore, { getItemsToSyncCount } from '../utils/dataStore';
import dsaAuthStore from '../utils/dsaAuthStore';
import RegexRulesModal from './RegexRulesModal';
import BdsaMappingModal from './BdsaMappingModal';
import DsaSyncModal from './DsaSyncModal';
import DataControlsToolbar from './DataControlsToolbar';
import DataGrid from './DataGrid';
import ColumnVisibilityModal from './ColumnVisibilityModal';
import ProtocolArrayCellRenderer from './ProtocolArrayCellRenderer';
import { getDefaultRegexRules, applyRegexRules } from '../utils/regexExtractor';
import { HIDDEN_DSA_FIELDS, PRIORITY_BDSA_FIELDS, DEFAULT_COLUMN_VISIBILITY, DATA_SOURCE_TYPES } from '../utils/constants';
import { generateColumnDefinitions, getColumnDisplayName, generateNestedKeys } from '../utils/columnDefinitionGenerator';
import { useColumnVisibility } from '../hooks/useColumnVisibility';
import './InputDataTab.css';



const InputDataTab = () => {
    const [dataSource, setDataSource] = useState(DATA_SOURCE_TYPES.DSA);
    const [dataStatus, setDataStatus] = useState(dataStore.getStatus());
    const [authStatus, setAuthStatus] = useState(dsaAuthStore.getStatus());
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [error, setError] = useState(null);
    const [csvFile, setCsvFile] = useState(null);
    // Column visibility management
    const {
        showColumnPanel,
        setShowColumnPanel,
        columnVisibility,
        columnOrder,
        toggleColumnVisibility,
        showAllColumns,
        hideAllColumns,
        moveColumn,
        resetColumnOrder
    } = useColumnVisibility(dataStatus);
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
    const [hasAppliedInitialRegex, setHasAppliedInitialRegex] = useState(false);

    // Generate nested keys from an object (excluding meta.bdsaLocal fields)

    // Generate a unique key for the current data source

    // Load column configuration from localStorage

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


    // Auto-apply regex rules when data is loaded (if no column mappings exist)
    // Only run this once when data is first loaded, not on every data change
    useEffect(() => {
        console.log('🔍 Auto-apply useEffect triggered:', {
            hasData: dataStatus.processedData && dataStatus.processedData.length > 0,
            dataLength: dataStatus.processedData?.length || 0,
            isDataRefresh,
            hasAppliedInitialRegex,
            shouldRun: dataStatus.processedData && dataStatus.processedData.length > 0 && !isDataRefresh && !hasAppliedInitialRegex
        });

        if (dataStatus.processedData && dataStatus.processedData.length > 0 && !isDataRefresh && !hasAppliedInitialRegex) {
            // Check which fields need regex extraction on a per-field basis
            const fieldsNeedingExtraction = {
                localCaseId: 0,
                localStainID: 0,
                localRegionId: 0
            };

            dataStatus.processedData.forEach(item => {
                const bdsaLocal = item.BDSA?.bdsaLocal;
                if (!bdsaLocal) return;

                // Count items missing each field
                if (!bdsaLocal.localCaseId || bdsaLocal.localCaseId.trim() === '') {
                    fieldsNeedingExtraction.localCaseId++;
                }
                if (!bdsaLocal.localStainID || bdsaLocal.localStainID.trim() === '') {
                    fieldsNeedingExtraction.localStainID++;
                }
                if (!bdsaLocal.localRegionId || bdsaLocal.localRegionId.trim() === '') {
                    fieldsNeedingExtraction.localRegionId++;
                }
            });

            // If any fields need extraction, apply regex rules
            const totalNeedingExtraction = Object.values(fieldsNeedingExtraction).reduce((sum, count) => sum + count, 0);

            console.log(`🔍 Fields needing extraction:`, fieldsNeedingExtraction, `Total: ${totalNeedingExtraction}`);

            if (totalNeedingExtraction > 0) {
                console.log(`🔄 Found items needing regex extraction:`, fieldsNeedingExtraction);
                console.log(`🔄 Auto-applying regex rules to extract missing field values...`);
                // Mark items as modified so they can be synced to DSA
                const result = dataStore.applyRegexRules(regexRules, true);
                if (result.success) {
                    console.log(`✅ Auto-applied regex rules: ${result.extractedCount} items updated (marked as modified for sync)`);
                }
            } else {
                console.log('🔄 All items already have BDSA field values, skipping auto-apply of regex rules');
            }

            // Mark that we've applied initial regex to prevent infinite loop
            setHasAppliedInitialRegex(true);
        }
    }, [dataStatus.processedData, dataStatus.dataSource, isDataRefresh, hasAppliedInitialRegex]); // Removed regexRules from dependencies

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
            setHasAppliedInitialRegex(false); // Reset regex flag when clearing data
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
            setHasAppliedInitialRegex(false); // Reset regex flag when clearing data
        }
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

                            // Use custom cell renderer for protocol fields
                            if (fullKey.includes('Protocol')) {
                                columnDef.cellRenderer = ProtocolArrayCellRenderer;
                                columnDef.editable = false; // Disable AG Grid editing, use modal instead
                            }

                            columnDef.onCellValueChanged = (params) => {
                                const { data, newValue, oldValue, colDef } = params;
                                if (newValue !== oldValue) {
                                    // Update the BDSA field
                                    if (!data.BDSA) {
                                        data.BDSA = {};
                                    }
                                    if (!data.BDSA.bdsaLocal) {
                                        data.BDSA.bdsaLocal = {};
                                    }
                                    const fieldName = colDef.field.replace('BDSA.bdsaLocal.', '');

                                    // Handle protocol arrays properly
                                    if (colDef.field.includes('Protocol')) {
                                        // Ensure we store as array
                                        data.BDSA.bdsaLocal[fieldName] = Array.isArray(newValue) ? newValue : [];
                                    } else {
                                        data.BDSA.bdsaLocal[fieldName] = newValue;
                                    }

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
            <DataControlsToolbar
                dataSource={dataSource}
                handleDataSourceChange={handleDataSourceChange}
                csvFile={csvFile}
                handleCsvFileChange={handleCsvFileChange}
                handleLoadCsv={handleLoadCsv}
                isLoading={isLoading}
                authStatus={authStatus}
                handleLoadDsa={handleLoadDsa}
                dataStatus={dataStatus}
                showColumnPanel={showColumnPanel}
                setShowColumnPanel={setShowColumnPanel}
                setShowBdsaMapping={setShowBdsaMapping}
                setShowRegexRules={setShowRegexRules}
                setShowDsaSync={setShowDsaSync}
            />

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

            {/* Column Visibility Modal */}
            <ColumnVisibilityModal
                isOpen={showColumnPanel && dataStatus.processedData && dataStatus.processedData.length > 0}
                onClose={() => setShowColumnPanel(false)}
                dataStatus={dataStatus}
                columnVisibility={columnVisibility}
                columnOrder={columnOrder}
                toggleColumnVisibility={toggleColumnVisibility}
                moveColumn={moveColumn}
                showAllColumns={showAllColumns}
                hideAllColumns={hideAllColumns}
                resetColumnOrder={resetColumnOrder}
            />

            {/* Data Grid */}
            <div className="data-grid-container">
                <DataGrid
                    dataStatus={dataStatus}
                    getColumnDefs={getColumnDefs}
                    dataSource={dataSource}
                />
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
