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

    useEffect(() => {
        loadCSVData();
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

    const handleColumnVisibilityChange = useCallback((hiddenCols) => {
        setHiddenColumns(hiddenCols);
    }, []);

    const handleColumnMappingChange = useCallback((mapping) => {
        setColumnMapping(mapping);
    }, []);

    const handleThemeChange = (event) => {
        setGridTheme(event.target.value);
    };

    const getVisibleColumns = () => {
        return columnDefs.filter(col => !hiddenColumns.includes(col.field));
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
                />

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