import { useState, useEffect } from 'react';
import { HIDDEN_DSA_FIELDS, PRIORITY_BDSA_FIELDS, DEFAULT_COLUMN_VISIBILITY } from '../utils/constants';
import { generateNestedKeys } from '../utils/columnDefinitionGenerator';

export const useColumnVisibility = (dataStatus) => {
    const [showColumnPanel, setShowColumnPanel] = useState(false);
    const [columnVisibility, setColumnVisibility] = useState({});
    const [columnOrder, setColumnOrder] = useState([]);

    // Load column configuration from localStorage
    const loadColumnConfig = () => {
        if (!dataStatus.processedData || dataStatus.processedData.length === 0) return;

        const dataSourceKey = getDataSourceKey();
        if (!dataSourceKey) return;

        try {
            const savedConfig = localStorage.getItem(`column_config_${dataSourceKey}`);
            if (savedConfig) {
                const config = JSON.parse(savedConfig);
                console.log('📁 Loaded column config:', config);
                setColumnVisibility(config.visibility || {});
                setColumnOrder(config.order || []);
            } else {
                // Initialize with default visibility
                setColumnVisibility(DEFAULT_COLUMN_VISIBILITY);
                setColumnOrder([]);
            }
        } catch (error) {
            console.error('Error loading column config:', error);
            setColumnVisibility(DEFAULT_COLUMN_VISIBILITY);
            setColumnOrder([]);
        }
    };

    const getDataSourceKey = () => {
        if (!dataStatus.processedData || dataStatus.processedData.length === 0) return null;

        const dataSource = dataStatus.dataSource || 'unknown';

        // Create a unique key based on data structure and source
        // Scan all rows to capture all possible columns (including accessory data)
        const allKeys = new Set();
        dataStatus.processedData.forEach(row => {
            const rowKeys = generateNestedKeys(row);
            rowKeys.forEach(key => allKeys.add(key));
        });

        const structureKey = Array.from(allKeys).sort().join(',');
        return `${dataSource}_${structureKey}`;
    };

    // Save column configuration to localStorage
    const saveColumnConfig = (visibility, order) => {
        const dataSourceKey = getDataSourceKey();
        console.log('💾 Attempting to save column config:', {
            dataSourceKey,
            visibility: visibility || columnVisibility,
            order: order || columnOrder
        });

        if (!dataSourceKey) {
            console.warn('Cannot save column config: no data source key');
            return;
        }

        try {
            const config = {
                visibility: visibility || columnVisibility,
                order: order || columnOrder,
                timestamp: new Date().toISOString()
            };
            localStorage.setItem(`column_config_${dataSourceKey}`, JSON.stringify(config));
            console.log('✅ Column config saved successfully');
        } catch (error) {
            console.error('Error saving column config:', error);
        }
    };

    const toggleColumnVisibility = (columnKey) => {
        setColumnVisibility(prev => {
            const isCurrentlyHidden = prev[columnKey] === false || HIDDEN_DSA_FIELDS.includes(columnKey);
            const newVisibility = {
                ...prev,
                [columnKey]: isCurrentlyHidden ? true : false
            };
            saveColumnConfig(newVisibility, columnOrder);
            return newVisibility;
        });
    };

    const showAllColumns = () => {
        setColumnVisibility({});
        saveColumnConfig({}, columnOrder);
    };

    const hideAllColumns = () => {
        if (!dataStatus.processedData || dataStatus.processedData.length === 0) return;

        // Scan all rows to capture all possible columns (including accessory data)
        const allKeys = new Set();
        dataStatus.processedData.forEach(row => {
            const rowKeys = generateNestedKeys(row);
            rowKeys.forEach(key => allKeys.add(key));
        });

        const hiddenColumns = {};
        Array.from(allKeys).forEach(key => {
            hiddenColumns[key] = false;
        });
        setColumnVisibility(hiddenColumns);
        saveColumnConfig(hiddenColumns, columnOrder);
    };

    // Helper function to compare arrays
    const arraysEqual = (a, b) => {
        return a.length === b.length && a.every((val, index) => val === b[index]);
    };

    // Column reordering functions
    const moveColumn = (fromIndex, toIndex) => {
        const currentOrder = columnOrder.length > 0 ? columnOrder : Object.keys(dataStatus.processedData[0]);
        const newOrder = [...currentOrder];
        const [movedColumn] = newOrder.splice(fromIndex, 1);
        newOrder.splice(toIndex, 0, movedColumn);
        setColumnOrder(newOrder);
        saveColumnConfig(columnVisibility, newOrder);
    };

    const resetColumnOrder = () => {
        if (!dataStatus.processedData || dataStatus.processedData.length === 0) return;

        // Use the priority fields from constants
        const preferredOrder = PRIORITY_BDSA_FIELDS;

        // Scan all rows to capture all possible columns (including accessory data)
        const allKeys = new Set();
        dataStatus.processedData.forEach(row => {
            const rowKeys = generateNestedKeys(row);
            rowKeys.forEach(key => allKeys.add(key));
        });

        // Create ordered list: preferred order first, then remaining keys
        const orderedKeys = [];
        const remainingKeys = Array.from(allKeys);

        // Add preferred keys first
        preferredOrder.forEach(key => {
            if (remainingKeys.includes(key)) {
                orderedKeys.push(key);
                const index = remainingKeys.indexOf(key);
                remainingKeys.splice(index, 1);
            }
        });

        // Add remaining keys
        orderedKeys.push(...remainingKeys);

        setColumnOrder(orderedKeys);
        saveColumnConfig(columnVisibility, orderedKeys);
    };

    // Load config when data changes
    useEffect(() => {
        loadColumnConfig();
    }, [dataStatus.processedData, dataStatus.dataSource]);

    return {
        showColumnPanel,
        setShowColumnPanel,
        columnVisibility,
        columnOrder,
        toggleColumnVisibility,
        showAllColumns,
        hideAllColumns,
        moveColumn,
        resetColumnOrder
    };
};
