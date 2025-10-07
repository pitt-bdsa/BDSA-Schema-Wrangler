import React from 'react';
import { DATA_SOURCE_TYPES } from '../utils/constants';
import { getItemsToSyncCount } from '../utils/dataStore';

const DataControlsToolbar = ({
    dataSource,
    handleDataSourceChange,
    csvFile,
    handleCsvFileChange,
    handleLoadCsv,
    excelFile,
    handleExcelFileChange,
    handleLoadExcel,
    accessoryFile,
    handleAccessoryFileChange,
    handleLoadAccessoryFile,
    accessoryData,
    accessoryMatchInfo,
    isLoading,
    authStatus,
    handleLoadDsa,
    dataStatus,
    showColumnPanel,
    setShowColumnPanel,
    setShowBdsaMapping,
    setShowRegexRules,
    setShowDsaSync
}) => {
    return (
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
                    <option value={DATA_SOURCE_TYPES.EXCEL}>Excel File</option>
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

            {dataSource === DATA_SOURCE_TYPES.EXCEL && (
                <>
                    <div className="file-input-container">
                        <input
                            type="file"
                            id="excel-file"
                            accept=".xlsx,.xls"
                            onChange={handleExcelFileChange}
                            className="file-input"
                        />
                        <label htmlFor="excel-file" className="file-input-label">
                            {excelFile ? excelFile.name : 'Choose Excel File'}
                        </label>
                    </div>
                    <button
                        className="load-excel-btn"
                        onClick={handleLoadExcel}
                        disabled={!excelFile || isLoading}
                    >
                        Load Excel Data
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

            {/* Accessory File Controls - Only show when DSA data is loaded */}
            {dataStatus.processedData && dataStatus.processedData.length > 0 && dataStatus.dataSource === 'dsa' && (
                <>
                    <div className="accessory-file-section">
                        <div className="file-input-container">
                            <input
                                type="file"
                                id="accessory-file"
                                accept=".csv,.xlsx,.xls"
                                onChange={handleAccessoryFileChange}
                                className="file-input"
                            />
                            <label htmlFor="accessory-file" className="file-input-label">
                                {accessoryFile ? accessoryFile.name : 'Choose Accessory File'}
                            </label>
                        </div>
                        <button
                            className="load-accessory-btn"
                            onClick={handleLoadAccessoryFile}
                            disabled={!accessoryFile || isLoading}
                            title="Upload CSV/Excel file with additional metadata to match with DSA items"
                        >
                            Load Accessory Data
                        </button>
                        {accessoryData && (
                            <span className="accessory-status">
                                ✓ {accessoryData.length} accessory items loaded
                                {accessoryMatchInfo && (
                                    <span className="match-info">
                                        ({accessoryMatchInfo.matched} matched, {accessoryMatchInfo.unmatched} unmatched)
                                    </span>
                                )}
                            </span>
                        )}
                    </div>
                </>
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
        </div>
    );
};

export default DataControlsToolbar;
