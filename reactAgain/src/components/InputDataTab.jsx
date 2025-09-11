import React, { useState, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import dataStore from '../utils/dataStore';
import dsaAuthStore from '../utils/dsaAuthStore';
import './InputDataTab.css';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

const DATA_SOURCE_TYPES = {
    CSV: 'csv',
    DSA: 'dsa'
};

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

                        // Validate that saved order contains all current columns
                        const currentColumns = Object.keys(dataStatus.processedData[0]);
                        const savedOrder = config.order || [];
                        const hasAllColumns = currentColumns.every(col => savedOrder.includes(col));

                        if (hasAllColumns && savedOrder.length === currentColumns.length) {
                            console.log('🔄 Applying saved column config');
                            setColumnOrder(savedOrder);
                            setColumnVisibility(config.visibility || {});
                        } else {
                            console.log('🔄 Saved config invalid, using default order');
                            setColumnOrder(currentColumns);
                        }
                    } else {
                        console.log('🔄 No saved config found, using default order');
                        setColumnOrder(Object.keys(dataStatus.processedData[0]));
                    }
                } catch (error) {
                    console.error('Error loading saved column config:', error);
                    setColumnOrder(Object.keys(dataStatus.processedData[0]));
                }
            }
        }
    }, [dataStatus.processedData, dataStatus.dataSource, dataStatus.dataSourceInfo]);

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
            const newVisibility = {
                ...prev,
                [columnKey]: prev[columnKey] === false ? undefined : false
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
        const defaultOrder = Object.keys(dataStatus.processedData[0]);
        setColumnOrder(defaultOrder);
        saveColumnConfig(columnVisibility, defaultOrder);
    };

    // Generate column definitions from the first row of data
    const getColumnDefs = () => {
        if (!dataStatus.processedData || dataStatus.processedData.length === 0) {
            console.log('🔍 No data for column definitions');
            return [];
        }

        const firstRow = dataStatus.processedData[0];
        // Use custom column order if available, otherwise use default order
        const orderedKeys = columnOrder.length > 0 ? columnOrder : Object.keys(firstRow);

        const columnDefs = orderedKeys.map(key => ({
            field: key,
            headerName: key,
            sortable: true,
            filter: true,
            resizable: true,
            minWidth: 150,
            hide: columnVisibility[key] === false, // Hide column if explicitly set to false
            cellStyle: (params) => {
                // Highlight DSA-specific fields
                if (key.startsWith('dsa_') || key === 'id' || key === 'name') {
                    return { backgroundColor: '#f0f7ff', fontWeight: 'bold' };
                }
                return null;
            }
        }));

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
                                                checked={columnVisibility[columnKey] !== false}
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
        </div>
    );
};

export default InputDataTab;
