import React, { useState, useEffect, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import 'ag-grid-community/styles/ag-theme-balham.css';
import 'ag-grid-community/styles/ag-theme-material.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import Papa from 'papaparse';
import ColumnControl from './ColumnControl';
import './InputDataTab.css';

ModuleRegistry.registerModules([AllCommunityModule]);

const InputDataTab = () => {
    const [rowData, setRowData] = useState([]);
    const [columnDefs, setColumnDefs] = useState([]);
    const [hiddenColumns, setHiddenColumns] = useState([]);
    const [columnMapping, setColumnMapping] = useState({
        localStainID: '',
        localCaseId: '',
        localRegionId: ''
    });
    const [loading, setLoading] = useState(true);
    const [gridTheme, setGridTheme] = useState('alpine');
    const [bdsaInstitutionId, setBdsaInstitutionId] = useState('001');
    const [showBdsaSettings, setShowBdsaSettings] = useState(false);
    const [caseIdMappings, setCaseIdMappings] = useState({});

    const [columnWidths, setColumnWidths] = useState({});
    const [columnOrder, setColumnOrder] = useState([]);

    useEffect(() => {
        loadCSVData();
        loadColumnWidths();
        loadCaseIdMappings();
    }, []);

    const loadCSVData = async () => {
        try {
            const response = await fetch('/year_2020_dsametadata.csv');
            const csvText = await response.text();

            Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    const data = results.data;
                    const columns = Object.keys(data[0] || {}).map(key => ({
                        field: key,
                        headerName: key,
                        sortable: true,
                        filter: true,
                        resizable: true,
                        minWidth: 150
                    }));

                    setColumnDefs(columns);
                    setRowData(data);
                    setLoading(false);
                },
                error: (error) => {
                    console.error('Error parsing CSV:', error);
                    setLoading(false);
                }
            });
        } catch (error) {
            console.error('Error loading CSV:', error);
            setLoading(false);
        }
    };



    const loadColumnWidths = () => {
        try {
            const stored = localStorage.getItem('bdsa_column_widths');
            console.log('Loading column widths from localStorage:', stored);
            if (stored) {
                setColumnWidths(JSON.parse(stored));
            }
        } catch (error) {
            console.error('Error loading column widths:', error);
        }
    };

    const loadCaseIdMappings = () => {
        try {
            const stored = localStorage.getItem('bdsa_case_id_mappings');
            if (stored) {
                setCaseIdMappings(JSON.parse(stored));
            }
        } catch (error) {
            console.error('Error loading case ID mappings:', error);
        }
    };

    const saveColumnWidths = (widths) => {
        try {
            localStorage.setItem('bdsa_column_widths', JSON.stringify(widths));
            setColumnWidths(widths);
        } catch (error) {
            console.error('Error saving column widths:', error);
        }
    };







    const handleColumnVisibilityChange = useCallback((hiddenCols) => {
        setHiddenColumns(hiddenCols);
    }, []);

    const handleColumnMappingChange = useCallback((mapping) => {
        setColumnMapping(mapping);
    }, []);

    const handleColumnOrderChange = useCallback((order) => {
        setColumnOrder(order);
    }, []);

    const handleColumnResized = useCallback((event) => {
        if (!event.columnApi) return;

        const newWidths = { ...columnWidths };
        event.columnApi.getAllDisplayedColumns().forEach(col => {
            newWidths[col.getColId()] = col.getActualWidth();
        });
        saveColumnWidths(newWidths);
    }, [columnWidths]);

    const getDisplayName = (fieldName) => {
        if (fieldName.startsWith('meta.')) {
            return fieldName.substring(5); // Remove 'meta.' prefix
        }
        return fieldName;
    };

    const handleGridReady = useCallback((params) => {
        // Set title attributes for column headers
        setTimeout(() => {
            const headerTexts = document.querySelectorAll('.ag-header-cell-text');
            headerTexts.forEach(headerText => {
                const fullText = headerText.textContent || headerText.innerText;
                headerText.setAttribute('title', fullText);
            });
        }, 100);
    }, []);



    const handleThemeChange = (event) => {
        setGridTheme(event.target.value);
    };

    const generateBdsaCaseId = (localCaseId) => {
        if (!localCaseId || !bdsaInstitutionId) return '';

        // Only return BDSA case ID if we have a stored mapping
        if (caseIdMappings[localCaseId]) {
            return caseIdMappings[localCaseId];
        }

        // Return empty string for unmapped cases
        return '';
    };







    const getVisibleColumns = () => {
        // Map of mapping keys to display names
        const mappingLabels = {
            localCaseId: 'localCaseID',
            localStainID: 'localStainID',
            localRegionId: 'localRegionID'
        };
        // Build an array of { field, label } for mapped columns, in the desired order
        const mappedColumnsInfo = [
            { field: columnMapping.localCaseId, label: mappingLabels.localCaseId },
            { field: columnMapping.localStainID, label: mappingLabels.localStainID },
            { field: columnMapping.localRegionId, label: mappingLabels.localRegionId }
        ].filter(item => item.field);

        // Remove duplicates and hidden columns
        const mappedColumns = mappedColumnsInfo
            .filter((item, idx, arr) => arr.findIndex(i => i.field === item.field) === idx)
            .map(item => {
                const col = columnDefs.find(col => col.field === item.field);
                if (!col || hiddenColumns.includes(col.field)) return null;
                // Override headerName for mapped columns and set smaller width
                const savedWidth = columnWidths[item.field];
                return {
                    ...col,
                    headerName: item.label,
                    minWidth: 140,
                    width: savedWidth || 140,

                };
            })
            .filter(Boolean);

        // Add BDSA Case ID column if local case ID is mapped
        let bdsaCaseIdColumn = null;
        if (columnMapping.localCaseId) {
            const savedWidth = columnWidths['bdsa_case_id'];
            bdsaCaseIdColumn = {
                field: 'bdsa_case_id',
                headerName: 'BDSA Case ID',
                sortable: true,
                filter: true,
                resizable: true,
                minWidth: 150,
                width: savedWidth || 150,
                valueGetter: (params) => {
                    const localCaseId = params.data[columnMapping.localCaseId];
                    return generateBdsaCaseId(localCaseId);
                },
                cellStyle: (params) => {
                    const localCaseId = params.data[columnMapping.localCaseId];
                    // Check if this local case ID has been manually mapped
                    if (localCaseId && caseIdMappings[localCaseId]) {
                        return { backgroundColor: '#d4edda', color: '#155724' };
                    }
                    return { backgroundColor: '#f8d7da', color: '#721c24' }; // Red background for unmapped
                }
            };
        }

        // All other columns, excluding mapped and hidden
        const mappedSet = new Set(mappedColumnsInfo.map(item => item.field));
        const otherColumns = columnDefs.filter(
            col => !mappedSet.has(col.field) && !hiddenColumns.includes(col.field)
        ).map(col => {
            const savedWidth = columnWidths[col.field];
            return {
                ...col,
                headerName: getDisplayName(col.field),
                width: savedWidth || col.width || 150,

            };
        });

        // Apply custom column order if available
        if (columnOrder.length > 0) {
            const orderedColumns = [];
            const processedFields = new Set();

            // Add BDSA Case ID first if it exists
            if (bdsaCaseIdColumn) {
                orderedColumns.push(bdsaCaseIdColumn);
                processedFields.add('bdsa_case_id');
            }

            // Add mapped columns in order
            mappedColumns.forEach(col => {
                orderedColumns.push(col);
                processedFields.add(col.field);
            });

            // Add remaining columns in custom order
            columnOrder.forEach(field => {
                if (!processedFields.has(field) && !hiddenColumns.includes(field)) {
                    const col = otherColumns.find(c => c.field === field);
                    if (col) {
                        orderedColumns.push(col);
                        processedFields.add(field);
                    }
                }
            });

            // Add any remaining columns that weren't in the order
            otherColumns.forEach(col => {
                if (!processedFields.has(col.field)) {
                    orderedColumns.push(col);
                }
            });

            return orderedColumns;
        }

        // Return BDSA Case ID first, then mapped columns, then the rest (default behavior)
        const result = [];
        if (bdsaCaseIdColumn) {
            result.push(bdsaCaseIdColumn);
        }
        result.push(...mappedColumns);
        result.push(...otherColumns);

        return result;
    };

    if (loading) {
        return <div className="loading">Loading data...</div>;
    }

    return (
        <div className="input-data-tab">
            <div className="controls-row">
                <ColumnControl
                    allColumns={columnDefs.map(col => col.field)}
                    rowData={rowData}
                    onColumnVisibilityChange={handleColumnVisibilityChange}
                    onColumnMappingChange={handleColumnMappingChange}
                    onColumnOrderChange={handleColumnOrderChange}
                />

                <button
                    className="bdsa-settings-btn"
                    onClick={() => setShowBdsaSettings(true)}
                >
                    BDSA Settings
                </button>

                <div className="theme-selector">
                    <label htmlFor="grid-theme">Grid Theme:</label>
                    <select
                        id="grid-theme"
                        value={gridTheme}
                        onChange={handleThemeChange}
                        className="theme-dropdown"
                    >
                        <option value="alpine">Alpine</option>
                        <option value="balham">Balham</option>
                        <option value="material">Material</option>
                        <option value="quartz">Quartz</option>
                    </select>
                </div>
            </div>

            {/* BDSA Settings Modal */}
            {showBdsaSettings && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>BDSA Settings</h2>
                        <div className="bdsa-settings-form">
                            <div className="form-group">
                                <label htmlFor="bdsa-institution-id">BDSA Institution ID:</label>
                                <input
                                    type="text"
                                    id="bdsa-institution-id"
                                    value={bdsaInstitutionId}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        // Only allow 3 digits
                                        if (/^\d{0,3}$/.test(value)) {
                                            setBdsaInstitutionId(value.padStart(3, '0'));
                                        }
                                    }}
                                    placeholder="001"
                                    maxLength={3}
                                />
                                <small>3-digit institution ID (e.g., 001, 002, etc.)</small>
                            </div>


                        </div>
                        <button
                            className="close-modal-btn"
                            onClick={() => setShowBdsaSettings(false)}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}



            <div className="grid-container">
                <AgGridReact
                    rowData={rowData}
                    columnDefs={getVisibleColumns()}
                    pagination={true}
                    paginationPageSize={25}
                    domLayout="normal"
                    theme="legacy"
                    className={`ag-theme-${gridTheme}`}
                    suppressFieldDotNotation={true}
                    onColumnResized={handleColumnResized}
                    onGridReady={handleGridReady}
                    enableTooltip={true}
                    tooltipShowDelay={0}
                    defaultColDef={{
                        sortable: true,
                        filter: true,
                        resizable: true
                    }}
                />
            </div>
        </div>
    );
};

export default InputDataTab; 