import React from 'react';
import { AgGridReact } from 'ag-grid-react';
import { DATA_SOURCE_TYPES } from '../utils/constants';

const DataGrid = ({
    dataStatus,
    getColumnDefs,
    dataSource
}) => {
    return (
        <div>
            {(() => {
                console.log('🔄 Rendering data grid with status:', {
                    hasData: dataStatus.processedData && dataStatus.processedData.length > 0,
                    dataLength: dataStatus.processedData ? dataStatus.processedData.length : 0,
                    dataSource: dataStatus.dataSource,
                    isLoading: dataStatus.isLoading
                });
                return dataStatus.processedData && dataStatus.processedData.length > 0;
            })() ? (
                <div className="ag-theme-alpine" style={{ height: '100%', width: '100%', minHeight: '600px' }}>
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
    );
};

export default DataGrid;
