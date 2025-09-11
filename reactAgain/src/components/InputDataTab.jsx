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

    useEffect(() => {
        const unsubscribeData = dataStore.subscribe(() => {
            const newStatus = dataStore.getStatus();
            console.log('🔄 InputDataTab received data update:', {
                processedDataLength: newStatus.processedData?.length || 0,
                dataSource: newStatus.dataSource
            });
            setDataStatus(newStatus);
        });

        const unsubscribeAuth = dsaAuthStore.subscribe(() => {
            setAuthStatus(dsaAuthStore.getStatus());
        });

        return () => {
            unsubscribeData();
            unsubscribeAuth();
        };
    }, []);

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

    // Generate column definitions from the first row of data
    const getColumnDefs = () => {
        if (!dataStatus.processedData || dataStatus.processedData.length === 0) {
            console.log('🔍 No data for column definitions');
            return [];
        }

        const firstRow = dataStatus.processedData[0];
        const columnDefs = Object.keys(firstRow).map(key => ({
            field: key,
            headerName: key,
            sortable: true,
            filter: true,
            resizable: true,
            minWidth: 150,
            cellStyle: (params) => {
                // Highlight BDSA fields
                if (key.startsWith('BDSA.') || key === 'dsa_id' || key === 'dsa_name') {
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

                {dataSource === DATA_SOURCE_TYPES.DSA && (
                    <button
                        className="refresh-btn"
                        onClick={handleLoadDsa}
                        disabled={!authStatus.isAuthenticated || isLoading}
                    >
                        Load DSA Data
                    </button>
                )}

                {dataStatus.processedData && dataStatus.processedData.length > 0 && (
                    <button className="refresh-btn" onClick={handleClearData}>
                        Clear Data
                    </button>
                )}
            </div>

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
                    <div className="ag-theme-alpine" style={{ height: '600px', width: '100%' }}>
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
