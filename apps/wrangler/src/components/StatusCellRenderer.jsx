import React from 'react';

const StatusCellRenderer = (params) => {
    const rowData = params.data;

    // Check if this item has been modified
    const isModified = params.context?.dataStore?.modifiedItems?.has(rowData?.id);

    if (!isModified) {
        return null;
    }

    // Determine the modification type based on BDSA data sources
    const bdsaSources = rowData?.BDSA?._dataSource || {};
    const sources = Object.values(bdsaSources);

    let statusType = 'manual-edit'; // default
    let statusText = 'Modified';

    if (sources.includes('column_mapping')) {
        statusType = 'column-mapping';
        statusText = 'Column';
    } else if (sources.includes('regex')) {
        statusType = 'regex-extraction';
        statusText = 'Regex';
    } else {
        statusType = 'modified-row';
        statusText = 'Manual';
    }

    return (
        <span className={`status-badge ${statusType}`} title={`${statusText} modification`}>
            <span className={`status-indicator ${statusType}`}></span>
            {statusText}
        </span>
    );
};

export default StatusCellRenderer;
