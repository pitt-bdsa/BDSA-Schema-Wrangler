import React, { useEffect, useRef, useState } from 'react';
import { DATA_SOURCE_TYPES } from '../utils/constants';
import { getItemsToSyncCount } from '../utils/dataStore';
import { generateNestedKeys } from '../utils/columnDefinitionGenerator';

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
    setShowDsaSync,
    onClearAllData
}) => {
    const [toolsOpen, setToolsOpen] = useState(false);
    const toolsRef = useRef(null);
    const accessoryInputRef = useRef(null);
    const pendingCount = getItemsToSyncCount();

    useEffect(() => {
        if (!toolsOpen) return undefined;
        const onPointerDown = (event) => {
            if (toolsRef.current && !toolsRef.current.contains(event.target)) {
                setToolsOpen(false);
            }
        };
        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [toolsOpen]);

    const handleCsvExport = () => {
        if (!dataStatus.processedData || dataStatus.processedData.length === 0) {
            console.warn('No data to export');
            return;
        }

        try {
            // Get all unique column keys from all rows
            const allKeys = new Set();
            dataStatus.processedData.forEach(row => {
                const rowKeys = generateNestedKeys(row);
                rowKeys.forEach(key => allKeys.add(key));
            });

            const columns = Array.from(allKeys).sort();

            // Create CSV header
            const csvHeader = columns.join(',');

            // Create CSV rows
            const csvRows = dataStatus.processedData.map(row => {
                return columns.map(column => {
                    const value = getNestedValue(row, column);
                    // Escape CSV values (handle commas, quotes, newlines)
                    if (value === null || value === undefined) {
                        return '';
                    }
                    const stringValue = String(value);
                    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                        return `"${stringValue.replace(/"/g, '""')}"`;
                    }
                    return stringValue;
                }).join(',');
            });

            // Combine header and rows
            const csvContent = [csvHeader, ...csvRows].join('\n');

            // Create and download file
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);

            // Generate filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const filename = `bdsa-data-export-${timestamp}.csv`;
            link.setAttribute('download', filename);

            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            console.log(`✅ CSV exported: ${filename} (${dataStatus.processedData.length} rows, ${columns.length} columns)`);
        } catch (error) {
            console.error('❌ CSV export failed:', error);
            alert('Failed to export CSV: ' + error.message);
        }
    };

    // Helper function to get nested values
    const getNestedValue = (obj, path) => {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : null;
        }, obj);
    };

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
                <div className="accessory-file-section">
                    <input
                        ref={accessoryInputRef}
                        type="file"
                        id="accessory-file"
                        accept=".csv,.xlsx,.xls"
                        onChange={handleAccessoryFileChange}
                        className="accessory-file-input"
                    />
                    <button
                        type="button"
                        className="load-accessory-btn"
                        onClick={() => accessoryInputRef.current?.click()}
                        disabled={isLoading}
                        title="Upload a CSV or Excel file and match its rows to loaded DSA items"
                    >
                        {accessoryFile ? accessoryFile.name : 'Load accessory data'}
                    </button>
                    {accessoryData && accessoryMatchInfo && (
                        <span className="accessory-status">
                            {accessoryMatchInfo.matched} matched, {accessoryMatchInfo.unmatched} unmatched
                        </span>
                    )}
                </div>
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

            {dataStatus.processedData && dataStatus.processedData.length > 0 && (
                <div className="toolbar-tools" ref={toolsRef}>
                    <button
                        type="button"
                        className={`toolbar-gear-btn${toolsOpen ? ' open' : ''}${pendingCount > 0 ? ' has-pending' : ''}`}
                        onClick={() => setToolsOpen((open) => !open)}
                        title="More tools"
                        aria-haspopup="menu"
                        aria-expanded={toolsOpen}
                    >
                        ⚙
                    </button>
                    {toolsOpen && (
                        <div className="toolbar-tools-menu" role="menu">
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    setShowColumnPanel(!showColumnPanel);
                                    setToolsOpen(false);
                                }}
                            >
                                {showColumnPanel ? 'Hide columns' : 'Show columns'}
                            </button>
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    setShowBdsaMapping(true);
                                    setToolsOpen(false);
                                }}
                            >
                                BDSA Mapping
                            </button>
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    handleCsvExport();
                                    setToolsOpen(false);
                                }}
                            >
                                Export CSV
                            </button>
                            {dataStatus.dataSource === 'dsa' && (
                                <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                        setShowDsaSync(true);
                                        setToolsOpen(false);
                                    }}
                                >
                                    {pendingCount > 0
                                        ? `DSA metadata sync (${pendingCount} pending)`
                                        : 'DSA metadata sync'}
                                </button>
                            )}
                            <button
                                type="button"
                                role="menuitem"
                                className="toolbar-tools-menu-danger"
                                onClick={() => {
                                    setToolsOpen(false);
                                    onClearAllData?.();
                                }}
                            >
                                Clear all data and restart
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default DataControlsToolbar;
