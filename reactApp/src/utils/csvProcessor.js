import Papa from 'papaparse';
import { applyRegexRules } from './regexExtractor';

// Simple UUID v4 generator (no external dependency needed)
const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

/**
 * CSV Processing Utilities
 * Handles CSV file loading, parsing, and data transformation
 */

/**
 * Loads and parses a CSV file from a URL
 * @param {string} csvUrl - URL to the CSV file
 * @returns {Promise<Object>} Result with data and columns
 */
export const loadCSVData = async (csvUrl = '/year_2020_dsametadata.csv', regexRules = {}) => {
    try {
        const response = await fetch(csvUrl);

        if (!response.ok) {
            throw new Error(`Failed to fetch CSV file: ${response.status} ${response.statusText}`);
        }

        const csvText = await response.text();

        return new Promise((resolve, reject) => {
            Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    try {
                        const data = results.data;

                        if (!data || data.length === 0) {
                            resolve({
                                success: true,
                                data: [],
                                columns: []
                            });
                            return;
                        }

                        // Apply regex rules to extract missing values
                        const processedData = applyRegexRules(data, regexRules);

                        // Add unique dsa_id to each row for CSV data (to match DSA data structure)
                        processedData.forEach(row => {
                            if (!row.dsa_id) {
                                row.dsa_id = generateUUID();
                            }
                        });

                        // Get all keys including metadata fields
                        const allKeys = Object.keys(processedData[0] || {});

                        const columns = allKeys.map(key => {
                            const column = {
                                field: key,
                                headerName: key,
                                sortable: true,
                                filter: true,
                                resizable: true,
                                minWidth: 150
                            };

                            // Hide metadata columns by default
                            if (key === '_regexExtracted') {
                                column.hide = true;
                            }

                            // Add orange cell styling for regex-extracted fields
                            if (key === 'localCaseId' || key === 'localStainID' || key === 'localRegionId') {
                                column.cellStyle = (params) => {
                                    // Check if this field was extracted by regex
                                    if (params.data && params.data._regexExtracted && params.data._regexExtracted[key]) {
                                        return { backgroundColor: '#fff3cd', color: '#856404' }; // Orange background
                                    }
                                    return null;
                                };
                            }

                            return column;
                        });

                        resolve({
                            success: true,
                            data: processedData,
                            columns: columns
                        });
                    } catch (error) {
                        reject({
                            success: false,
                            error: `Error processing CSV data: ${error.message}`
                        });
                    }
                },
                error: (error) => {
                    reject({
                        success: false,
                        error: `Error parsing CSV: ${error.message}`
                    });
                }
            });
        });
    } catch (error) {
        return {
            success: false,
            error: `Error loading CSV: ${error.message}`
        };
    }
};

/**
 * Parses CSV text content directly
 * @param {string} csvText - Raw CSV text content
 * @returns {Promise<Object>} Result with data and columns
 */
export const parseCSVText = async (csvText) => {
    return new Promise((resolve, reject) => {
        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                try {
                    const data = results.data;

                    if (!data || data.length === 0) {
                        resolve({
                            success: true,
                            data: [],
                            columns: []
                        });
                        return;
                    }

                    const columns = Object.keys(data[0] || {}).map(key => ({
                        field: key,
                        headerName: key,
                        sortable: true,
                        filter: true,
                        resizable: true,
                        minWidth: 150
                    }));

                    resolve({
                        success: true,
                        data: data,
                        columns: columns
                    });
                } catch (error) {
                    reject({
                        success: false,
                        error: `Error processing CSV data: ${error.message}`
                    });
                }
            },
            error: (error) => {
                reject({
                    success: false,
                    error: `Error parsing CSV: ${error.message}`
                });
            }
        });
    });
};

/**
 * Validates CSV data structure
 * @param {Array} data - CSV data array
 * @param {Array} requiredFields - Required field names
 * @returns {Object} Validation result
 */
export const validateCSVData = (data, requiredFields = []) => {
    if (!data || !Array.isArray(data)) {
        return {
            valid: false,
            error: 'Data is not a valid array'
        };
    }

    if (data.length === 0) {
        return {
            valid: false,
            error: 'CSV file is empty'
        };
    }

    const firstRow = data[0];
    if (!firstRow || typeof firstRow !== 'object') {
        return {
            valid: false,
            error: 'First row is not a valid object'
        };
    }

    // Check for required fields
    const missingFields = requiredFields.filter(field => !(field in firstRow));
    if (missingFields.length > 0) {
        return {
            valid: false,
            error: `Missing required fields: ${missingFields.join(', ')}`
        };
    }

    return {
        valid: true,
        rowCount: data.length,
        fields: Object.keys(firstRow)
    };
};

/**
 * Converts data to CSV format
 * @param {Array} data - Data array to convert
 * @param {Array} headers - Optional headers (if not provided, uses object keys)
 * @returns {string} CSV formatted string
 */
export const convertToCSV = (data, headers = null) => {
    if (!data || !Array.isArray(data) || data.length === 0) {
        return '';
    }

    const csvHeaders = headers || Object.keys(data[0] || {});
    const csvContent = [
        csvHeaders.join(','),
        ...data.map(row =>
            csvHeaders.map(header => {
                const value = row[header] || '';
                // Escape commas and quotes in CSV
                if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            }).join(',')
        )
    ].join('\n');

    return csvContent;
};

/**
 * Downloads data as a CSV file
 * @param {Array} data - Data to download
 * @param {string} filename - Filename for the download
 * @param {Array} headers - Optional headers
 */
export const downloadCSV = (data, filename = 'data.csv', headers = null) => {
    const csvContent = convertToCSV(data, headers);
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};
