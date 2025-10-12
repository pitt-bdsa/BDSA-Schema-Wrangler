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
                console.log('🔄 Rendering data grid with status:', {
                    hasData: dataStatus.processedData && dataStatus.processedData.length > 0,
                    dataLength: dataStatus.processedData ? dataStatus.processedData.length : 0,
                    dataSource: dataStatus.dataSource,
                    isLoading: dataStatus.isLoading,
                    isServerSidePagination,
                    dataType: typeof dataStatus.processedData,
                    isArray: Array.isArray(dataStatus.processedData)
                });

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
