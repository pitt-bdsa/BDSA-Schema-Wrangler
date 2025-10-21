import React, { useCallback, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { DATA_SOURCE_TYPES } from '../utils/constants';
import dataStore from '../utils/dataStore';
import dsaAuthStore from '../utils/dsaAuthStore';

const DataGrid = ({
    dataStatus,
    getColumnDefs,
    dataSource
}) => {
    // Disable server-side pagination for now to fix AG Grid creation error
    const isServerSidePagination = false; // Temporarily disabled

    // Data source for server-side pagination
    const dataSourceConfig = null; // Disabled for now

    return (
        <div>
            {(() => {
                // Debug: Log the actual data being passed to AG Grid
                if (dataStatus.processedData && dataStatus.processedData.length > 0) {
                    console.log('🔍 GRID DEBUG: First 3 rows of data being passed to AG Grid:');
                    dataStatus.processedData.slice(0, 3).forEach((row, index) => {
                        console.log(`Row ${index}:`, {
                            name: row.name,
                            'meta.npClinical.Age at Death/Bx': row['meta.npClinical.Age at Death/Bx'],
                            'meta.npClinical.ApoE': row['meta.npClinical.ApoE'],
                            'meta.npClinical.Case Number': row['meta.npClinical.Case Number'],
                            allMetaNpClinicalKeys: Object.keys(row).filter(key => key.startsWith('meta.npClinical.')).slice(0, 5)
                        });
                    });
                }

                // Debug: Log the AG Grid column definitions
                if (dataStatus.columnDefs && dataStatus.columnDefs.length > 0) {
                    const metaNpClinicalColumns = dataStatus.columnDefs.filter(col => col.field && col.field.startsWith('meta.npClinical.'));
                    console.log('🔍 GRID DEBUG: AG Grid column definitions for meta.npClinical fields:');
                    metaNpClinicalColumns.slice(0, 5).forEach(col => {
                        console.log(`Column: ${col.field}`, {
                            field: col.field,
                            headerName: col.headerName,
                            hide: col.hide,
                            editable: col.editable
                        });
                    });
                }

                // Debug: Test how AG Grid would access the data
                if (dataStatus.processedData && dataStatus.processedData.length > 0) {
                    const firstRow = dataStatus.processedData[0];
                    console.log('🔍 GRID DEBUG: Testing data access patterns:');
                    console.log('Direct access:', firstRow['meta.npClinical.Age at Death/Bx']);
                    console.log('Nested access attempt:', firstRow.meta?.npClinical?.['Age at Death/Bx']);
                    console.log('Has meta object:', !!firstRow.meta);
                    console.log('Has meta.npClinical object:', !!firstRow.meta?.npClinical);
                }

                // console.log('🔄 Rendering data grid with status:', {
                //     hasData: dataStatus.processedData && dataStatus.processedData.length > 0,
                //     dataLength: dataStatus.processedData ? dataStatus.processedData.length : 0,
                //     dataSource: dataStatus.dataSource,
                //     isLoading: dataStatus.isLoading,
                //     isServerSidePagination,
                //     dataType: typeof dataStatus.processedData,
                //     isArray: Array.isArray(dataStatus.processedData)
                // });

                // Check if we have valid data
                const hasValidData = dataStatus.processedData &&
                    Array.isArray(dataStatus.processedData) &&
                    dataStatus.processedData.length > 0;

                if (!hasValidData) {
                    console.warn('⚠️ DataGrid: No valid data to render', {
                        hasProcessedData: !!dataStatus.processedData,
                        isArray: Array.isArray(dataStatus.processedData),
                        length: dataStatus.processedData?.length || 0
                    });
                }

                return hasValidData;
            })() ? (
                <div className="ag-theme-alpine" style={{ height: '100%', width: '100%', minHeight: '600px' }}>
                    {(() => {
                        console.log('🎯 Rendering AG Grid with:', {
                            rowModelType: isServerSidePagination ? 'serverSide' : 'clientSide',
                            hasRowData: !isServerSidePagination && !!dataStatus.processedData,
                            rowDataLength: dataStatus.processedData?.length || 0,
                            hasColumnDefs: !!getColumnDefs,
                            columnDefsCount: getColumnDefs()?.length || 0
                        });
                        return null;
                    })()}
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
                        animateRows={true}
                        enableRangeSelection={true}
                        enableCellTextSelection={true}
                        ensureDomOrder={true}
                        context={{
                            dataStore: dataStore
                        }}
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
    );
};

export default DataGrid;
