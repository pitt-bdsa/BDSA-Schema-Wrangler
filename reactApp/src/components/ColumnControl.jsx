import React, { useState, useEffect } from 'react';
import './ColumnControl.css';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const LOCAL_STORAGE_KEY = 'bdsa_hidden_columns';
const COLUMN_MAPPING_KEY = 'bdsa_column_mapping';
const COLUMN_ORDER_KEY = 'bdsa_column_order';
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

const ColumnControl = ({ allColumns, rowData, onColumnVisibilityChange, onColumnMappingChange, onColumnOrderChange }) => {
    const [hiddenColumns, setHiddenColumns] = useState(() => {
        try {
            const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
            console.log('Loading hidden columns from localStorage:', stored);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.warn('Error loading hidden columns from localStorage:', error);
            return [];
        }
    });
    const [columnMapping, setColumnMapping] = useState(() => {
        try {
            const stored = localStorage.getItem(COLUMN_MAPPING_KEY);
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
            const stored = localStorage.getItem(COLUMN_ORDER_KEY);
            return stored ? JSON.parse(stored) : allColumns;
        } catch (error) {
            console.warn('Error loading column order from localStorage:', error);
            return allColumns;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(hiddenColumns));
            if (onColumnVisibilityChange) {
                onColumnVisibilityChange(hiddenColumns);
            }
        } catch (error) {
            console.warn('Error saving hidden columns to localStorage:', error);
        }
    }, [hiddenColumns, onColumnVisibilityChange]);

    useEffect(() => {
        try {
            localStorage.setItem(COLUMN_MAPPING_KEY, JSON.stringify(columnMapping));
            if (onColumnMappingChange) {
                onColumnMappingChange(columnMapping);
            }
        } catch (error) {
            console.warn('Error saving column mapping to localStorage:', error);
        }
    }, [columnMapping, onColumnMappingChange]);

    useEffect(() => {
        try {
            localStorage.setItem(COLUMN_ORDER_KEY, JSON.stringify(columnOrder));
            if (onColumnOrderChange) {
                onColumnOrderChange(columnOrder);
            }
        } catch (error) {
            console.warn('Error saving column order to localStorage:', error);
        }
    }, [columnOrder, onColumnOrderChange]);

    const handleColumnToggle = (field) => {
        setHiddenColumns(prev =>
            prev.includes(field)
                ? prev.filter(f => f !== field)
                : [...prev, field]
        );
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
        return columnOrder.filter(col => !hiddenColumns.includes(col));
    };

    const getMappingStatus = () => {
        const mapped = Object.values(columnMapping).filter(v => v !== '').length;
        const total = Object.keys(columnMapping).length;
        return `${mapped}/${total}`;
    };

    return (
        <>
            <button className="show-columns-btn" onClick={() => setColumnModalOpen(true)}>
                Show/Hide Columns ({getVisibleColumns().length}/{allColumns.length})
            </button>
            <button className="mapping-btn" onClick={() => setMappingModalOpen(true)}>
                Column Mapping ({getMappingStatus()})
            </button>

            {/* Column Visibility Modal */}
            {columnModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>Show/Hide Columns</h2>
                        <div className="modal-column-list">
                            {columnOrder.map((field, index) => (
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
                            ))}
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