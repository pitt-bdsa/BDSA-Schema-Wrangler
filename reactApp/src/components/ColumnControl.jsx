import React, { useState, useEffect } from 'react';
import './ColumnControl.css';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Default keys for backward compatibility
const DEFAULT_HIDDEN_COLUMNS_KEY = 'bdsa_hidden_columns';
const DEFAULT_COLUMN_MAPPING_KEY = 'bdsa_column_mapping';
const DEFAULT_COLUMN_ORDER_KEY = 'bdsa_column_order';
const PIE_COLORS = [
    '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A28CFE', '#FF6699', '#33CC99', '#FF6666', '#FFB347', '#B6D7A8', '#C9C9FF', '#FFD1DC'
];

const getValueCounts = (rowData, field) => {
    const counts = {};
    rowData.forEach(row => {
        const value = row[field];
        if (value === null || value === undefined || value === '') {
            counts['(empty)'] = (counts['(empty)'] || 0) + 1;
        } else {
            counts[value] = (counts[value] || 0) + 1;
        }
    });
    // Convert to array and sort by count desc
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    // Top 10 + 'Other'
    const top = entries.slice(0, 10).map(([name, value]) => ({ name, value }));
    const otherCount = entries.slice(10).reduce((sum, [, v]) => sum + v, 0);
    if (otherCount > 0) top.push({ name: 'Other', value: otherCount });
    return top;
};

const getDisplayName = (fieldName) => {
    if (fieldName.startsWith('meta.')) {
        return fieldName.substring(5); // Remove 'meta.' prefix
    }
    return fieldName;
};

const ColumnControl = ({
    allColumns,
    rowData,
    hiddenColumnsKey = DEFAULT_HIDDEN_COLUMNS_KEY,
    columnMappingKey = DEFAULT_COLUMN_MAPPING_KEY,
    columnOrderKey = DEFAULT_COLUMN_ORDER_KEY,
    onHiddenColumnsChange
}) => {
    console.log('ColumnControl props:', {
        allColumns: allColumns,
        allColumnsLength: allColumns?.length,
        hiddenColumnsKey: hiddenColumnsKey,
        rowDataLength: rowData?.length
    });
    const [hiddenColumns, setHiddenColumns] = useState(() => {
        try {
            const stored = localStorage.getItem(hiddenColumnsKey);
            console.log('Loading hidden columns from localStorage:', {
                key: hiddenColumnsKey,
                stored: stored,
                parsed: stored ? JSON.parse(stored) : null
            });
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.warn('Error loading hidden columns from localStorage:', error);
            return [];
        }
    });
    const [columnMapping, setColumnMapping] = useState(() => {
        try {
            const stored = localStorage.getItem(columnMappingKey);
            console.log('Loading column mapping from localStorage:', stored);
            return stored ? JSON.parse(stored) : {
                localStainID: '',
                localCaseId: '',
                localRegionId: ''
            };
        } catch (error) {
            console.warn('Error loading column mapping from localStorage:', error);
            return {
                localStainID: '',
                localCaseId: '',
                localRegionId: ''
            };
        }
    });
    const [columnModalOpen, setColumnModalOpen] = useState(false);
    const [mappingModalOpen, setMappingModalOpen] = useState(false);
    const [pieModal, setPieModal] = useState({ open: false, field: null, data: [] });
    const [columnOrder, setColumnOrder] = useState(() => {
        try {
            const stored = localStorage.getItem(columnOrderKey);
            return stored ? JSON.parse(stored) : allColumns;
        } catch (error) {
            console.warn('Error loading column order from localStorage:', error);
            return allColumns;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(hiddenColumnsKey, JSON.stringify(hiddenColumns));
        } catch (error) {
            console.warn('Error saving hidden columns to localStorage:', error);
        }
    }, [hiddenColumns, hiddenColumnsKey]);

    useEffect(() => {
        try {
            localStorage.setItem(columnMappingKey, JSON.stringify(columnMapping));
        } catch (error) {
            console.warn('Error saving column mapping to localStorage:', error);
        }
    }, [columnMapping, columnMappingKey]);

    useEffect(() => {
        try {
            localStorage.setItem(columnOrderKey, JSON.stringify(columnOrder));
        } catch (error) {
            console.warn('Error saving column order to localStorage:', error);
        }
    }, [columnOrder, columnOrderKey]);


    // Reload state when storage keys change (data source switching)
    useEffect(() => {
        try {
            const storedHiddenColumns = localStorage.getItem(hiddenColumnsKey);
            const storedColumnMapping = localStorage.getItem(columnMappingKey);
            const storedColumnOrder = localStorage.getItem(columnOrderKey);

            console.log('Reloading state for data source switch:', {
                hiddenColumnsKey,
                columnMappingKey,
                columnOrderKey,
                allColumnsLength: allColumns.length,
                allColumns: allColumns,
                storedHiddenColumns,
                storedColumnMapping,
                storedColumnOrder
            });

            if (storedHiddenColumns) {
                const parsedHiddenColumns = JSON.parse(storedHiddenColumns);
                setHiddenColumns(parsedHiddenColumns);
            } else {
                setHiddenColumns([]);
            }

            if (storedColumnMapping) {
                const parsedColumnMapping = JSON.parse(storedColumnMapping);
                setColumnMapping(parsedColumnMapping);
            } else {
                const defaultMapping = {
                    localStainID: '',
                    localCaseId: '',
                    localRegionId: ''
                };
                setColumnMapping(defaultMapping);
            }

            if (storedColumnOrder) {
                const parsedColumnOrder = JSON.parse(storedColumnOrder);
                console.log('Setting columnOrder from stored value:', parsedColumnOrder);
                setColumnOrder(parsedColumnOrder);
            } else {
                // Only use allColumns as default if it's not empty
                if (allColumns.length > 0) {
                    console.log('Setting columnOrder to allColumns (no stored value):', allColumns);
                    setColumnOrder(allColumns);
                } else {
                    console.log('allColumns is empty, keeping columnOrder as is');
                }
            }
        } catch (error) {
            console.warn('Error loading column settings from localStorage:', error);
        }
    }, [hiddenColumnsKey, columnMappingKey, columnOrderKey]);

    // Also update columnOrder when allColumns changes (in case it's not caught by the above useEffect)
    useEffect(() => {
        console.log('allColumns change detected:', {
            allColumnsLength: allColumns.length,
            columnOrderLength: columnOrder.length,
            allColumns: allColumns
        });

        if (allColumns.length === 0) {
            console.log('allColumns is empty, resetting columnOrder to empty array');
            setColumnOrder([]);
        } else if (columnOrder.length === 0 && allColumns.length > 0) {
            console.log('allColumns has data but columnOrder is empty, setting columnOrder to allColumns');
            setColumnOrder(allColumns);
        }
    }, [allColumns, columnOrder.length]);

    const handleColumnToggle = (field) => {
        const newHiddenColumns = hiddenColumns.includes(field)
            ? hiddenColumns.filter(f => f !== field)
            : [...hiddenColumns, field];

        setHiddenColumns(newHiddenColumns);

        // Notify parent component of the change
        if (onHiddenColumnsChange) {
            onHiddenColumnsChange(newHiddenColumns);
        }
    };

    const handleMappingChange = (mappingType, field) => {
        setColumnMapping(prev => ({
            ...prev,
            [mappingType]: field
        }));
    };

    const handleShowPie = (field) => {
        if (!rowData || rowData.length === 0) return;
        const data = getValueCounts(rowData, field);
        setPieModal({ open: true, field, data });
    };

    const moveColumnUp = (field) => {
        setColumnOrder(prev => {
            const currentIndex = prev.indexOf(field);
            if (currentIndex <= 0) return prev;

            const newOrder = [...prev];
            [newOrder[currentIndex], newOrder[currentIndex - 1]] = [newOrder[currentIndex - 1], newOrder[currentIndex]];
            return newOrder;
        });
    };

    const moveColumnDown = (field) => {
        setColumnOrder(prev => {
            const currentIndex = prev.indexOf(field);
            if (currentIndex === -1 || currentIndex >= prev.length - 1) return prev;

            const newOrder = [...prev];
            [newOrder[currentIndex], newOrder[currentIndex + 1]] = [newOrder[currentIndex + 1], newOrder[currentIndex]];
            return newOrder;
        });
    };

    const closePieModal = () => setPieModal({ open: false, field: null, data: [] });

    const getVisibleColumns = () => {
        const visible = columnOrder.filter(col => !hiddenColumns.includes(col));
        console.log('getVisibleColumns calculation:', {
            columnOrder: columnOrder,
            columnOrderLength: columnOrder.length,
            hiddenColumns: hiddenColumns,
            hiddenColumnsLength: hiddenColumns.length,
            visible: visible,
            visibleLength: visible.length,
            allColumnsLength: allColumns.length
        });
        return visible;
    };

    const getMappingStatus = () => {
        const mapped = Object.values(columnMapping).filter(v => v !== '').length;
        const total = Object.keys(columnMapping).length;
        return `${mapped}/${total}`;
    };

    return (
        <>
            <button
                className="show-columns-btn"
                onClick={() => {
                    console.log('Opening column modal, columnOrder:', columnOrder, 'allColumns:', allColumns);
                    setColumnModalOpen(true);
                }}
                disabled={allColumns.length === 0}
            >
                Show/Hide Columns ({getVisibleColumns().length}/{allColumns.length})
            </button>
            <button className="mapping-btn" onClick={() => setMappingModalOpen(true)}>
                Column Mapping ({getMappingStatus()})
            </button>

            {/* Column Visibility Modal */}
            {columnModalOpen && allColumns.length > 0 && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>Show/Hide Columns</h2>
                        <div className="modal-column-list">
                            {columnOrder.length === 0 ? (
                                <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                                    No columns available. Please load data first.
                                </div>
                            ) : (
                                columnOrder.map((field, index) => (
                                    <div key={field} className="column-row">
                                        <div className="column-controls">
                                            <button
                                                className="order-btn up-btn"
                                                title="Move up"
                                                onClick={() => moveColumnUp(field)}
                                                disabled={index === 0}
                                            >
                                                ↑
                                            </button>
                                            <button
                                                className="order-btn down-btn"
                                                title="Move down"
                                                onClick={() => moveColumnDown(field)}
                                                disabled={index === columnOrder.length - 1}
                                            >
                                                ↓
                                            </button>
                                        </div>
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={!hiddenColumns.includes(field)}
                                                onChange={() => handleColumnToggle(field)}
                                            />
                                            <span className={columnMapping.localStainID === field ||
                                                columnMapping.localCaseId === field ||
                                                columnMapping.localRegionId === field ? 'mapped-column' : ''}>
                                                {getDisplayName(field)}
                                            </span>
                                        </label>
                                        <button
                                            className="pie-btn"
                                            title="Show value distribution"
                                            onClick={() => handleShowPie(field)}
                                            disabled={!rowData || rowData.length === 0}
                                        >
                                            📊
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                        <button className="close-modal-btn" onClick={() => setColumnModalOpen(false)}>
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* Column Mapping Modal */}
            {mappingModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>BDSA Schema Mapping</h2>
                        <p className="mapping-description">
                            Designate which columns represent your local identifiers for mapping to BDSA schema standards.
                        </p>
                        <div className="mapping-controls">
                            <div className="mapping-row">
                                <label>Local Stain ID:</label>
                                <select
                                    value={columnMapping.localStainID}
                                    onChange={(e) => handleMappingChange('localStainID', e.target.value)}
                                >
                                    <option value="">-- Select Column --</option>
                                    {allColumns.map(col => (
                                        <option key={col} value={col}>{col}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="mapping-row">
                                <label>Local Case ID:</label>
                                <select
                                    value={columnMapping.localCaseId}
                                    onChange={(e) => handleMappingChange('localCaseId', e.target.value)}
                                >
                                    <option value="">-- Select Column --</option>
                                    {allColumns.map(col => (
                                        <option key={col} value={col}>{col}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="mapping-row">
                                <label>Local Region ID:</label>
                                <select
                                    value={columnMapping.localRegionId}
                                    onChange={(e) => handleMappingChange('localRegionId', e.target.value)}
                                >
                                    <option value="">-- Select Column --</option>
                                    {allColumns.map(col => (
                                        <option key={col} value={col}>{col}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <button className="close-modal-btn" onClick={() => setMappingModalOpen(false)}>
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* Pie Chart Modal */}
            {pieModal.open && (
                <div className="modal-overlay">
                    <div className="modal-content pie-modal-content">
                        <h2><span style={{ color: '#333' }}>Distribution for: </span><span style={{ color: '#1976d2' }}>{pieModal.field}</span></h2>
                        <ResponsiveContainer width="100%" height={350}>
                            <PieChart margin={{ top: 20, right: 30, left: 30, bottom: 20 }}>
                                <Pie
                                    data={pieModal.data}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={120}
                                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(1)}%)`}
                                    labelLine={true}
                                >
                                    {pieModal.data.map((entry, idx) => (
                                        <Cell key={`cell-${idx}`} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value, name) => [value, name]} />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                        <button className="close-modal-btn" onClick={closePieModal}>
                            Close
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default ColumnControl; 