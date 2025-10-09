import React, { useState, useEffect } from 'react';
import './FlattenedDataView.css';

const FlattenedDataView = ({ schemaFile }) => {
    const [schema, setSchema] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (schemaFile) {
            loadSchema();
        }
    }, [schemaFile]);

    const loadSchema = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch(`${schemaFile}?t=${Date.now()}`);
            if (!response.ok) {
                throw new Error('Failed to load schema');
            }
            const schemaData = await response.json();
            setSchema(schemaData);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="flattened-data-view">Loading schema data...</div>;
    }

    if (error) {
        return <div className="flattened-data-view">Error loading schema: {error}</div>;
    }
    // Recursively flatten schema properties
    const flattenSchema = (obj, path = '', level = 0) => {
        const flattened = [];

        if (!obj || typeof obj !== 'object') return flattened;

        // Handle properties object
        if (obj.properties) {
            Object.entries(obj.properties).forEach(([key, value]) => {
                const currentPath = path ? `${path}.${key}` : key;
                const item = {
                    path: currentPath,
                    level: level,
                    variableName: key,  // The property key is the variable name
                    title: value.title || key,
                    type: value.type,
                    description: value.description,
                    required: value.required,
                    enum: value.enum,
                    pattern: value.pattern,
                    examples: value.examples,
                    format: value.format,
                    minimum: value.minimum,
                    maximum: value.maximum,
                    minLength: value.minLength,
                    maxLength: value.maxLength,
                    items: value.items,
                    cde: value.cde,  // CDE field
                    cdeName: value.cdeName,  // Optional cdeName field
                    _comment: value._comment
                };
                flattened.push(item);

                // Recursively process nested objects
                if (value.type === 'object' && value.properties) {
                    flattened.push(...flattenSchema(value, currentPath, level + 1));
                }
                // Handle array items
                if (value.type === 'array' && value.items && value.items.properties) {
                    flattened.push(...flattenSchema(value.items, `${currentPath}[]`, level + 1));
                }
            });
        }

        return flattened;
    };

    const getConstraintText = (item, allFlattenedData) => {
        const constraints = [];

        if (item.enum) {
            constraints.push(`Must be one of: ${item.enum.join(', ')}`);
        }
        if (item.pattern) {
            constraints.push(`Pattern: ${item.pattern}`);
        }
        if (item.minimum !== undefined) {
            constraints.push(`Min: ${item.minimum}`);
        }
        if (item.maximum !== undefined) {
            constraints.push(`Max: ${item.maximum}`);
        }
        if (item.minLength !== undefined) {
            constraints.push(`Min length: ${item.minLength}`);
        }
        if (item.maxLength !== undefined) {
            constraints.push(`Max length: ${item.maxLength}`);
        }
        if (item.format) {
            constraints.push(`Format: ${item.format}`);
        }
        if (item.examples && item.examples.length > 0) {
            constraints.push(`Examples: ${item.examples.join(', ')}`);
        }

        // Special handling for stainIDs and regionIDs
        if (item.variableName === 'stainIDs' && item.type === 'array') {
            const stainTypes = allFlattenedData
                .filter(data => data.path.startsWith('stainIDs[].') && data.level === 1)
                .map(data => data.variableName)
                .filter(name => name && name !== 'items');

            if (stainTypes.length > 0) {
                constraints.push(`Must contain one of these stain types: ${stainTypes.join(', ')}`);
            }
        }

        if (item.variableName === 'regionIDs' && item.type === 'object') {
            const regionTypes = allFlattenedData
                .filter(data => data.path.startsWith('regionIDs.regions.') && data.level === 2)
                .map(data => data.variableName)
                .filter(name => name && name !== 'regions');

            if (regionTypes.length > 0) {
                constraints.push(`Must contain regions from: ${regionTypes.join(', ')}`);
            }
        }

        return constraints;
    };

    const getTypeColor = (type) => {
        switch (type) {
            case 'string': return '#e3f2fd';
            case 'number': return '#f3e5f5';
            case 'integer': return '#f3e5f5';
            case 'boolean': return '#e8f5e8';
            case 'array': return '#fff3e0';
            case 'object': return '#fce4ec';
            default: return '#f5f5f5';
        }
    };

    const exportToCSV = (flattenedData) => {
        // CSV headers
        const headers = ['Variable Name', 'Variable Path', 'Type', 'Title', 'CDE', 'Required', 'Constraints', 'Description', 'Comments'];

        // Create CSV rows
        const rows = flattenedData.map(item => {
            const constraints = getConstraintText(item, flattenedData);
            return [
                item.variableName || '',
                item.path,
                item.type || '',
                item.title || '',
                item.cde || item.cdeName || '',
                item.required ? 'Yes' : 'No',
                constraints.join('; '),
                (item.description || '').replace(/"/g, '""'), // Escape quotes
                (item._comment || '').replace(/"/g, '""')
            ].map(cell => `"${cell}"`).join(',');
        });

        // Combine headers and rows
        const csv = [headers.join(','), ...rows].join('\n');

        // Create download
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'bdsa-schema-flattened.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportToExcel = (flattenedData) => {
        // Create HTML table for Excel
        const headers = ['Variable Name', 'Variable Path', 'Type', 'Title', 'CDE', 'Required', 'Constraints', 'Description', 'Comments'];

        let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">';
        html += '<head><meta charset="utf-8"><style>table {border-collapse: collapse;} th, td {border: 1px solid #ddd; padding: 8px;} th {background-color: #f2f2f2;}</style></head>';
        html += '<body><table>';

        // Add headers
        html += '<tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr>';

        // Add rows
        flattenedData.forEach(item => {
            const constraints = getConstraintText(item, flattenedData);
            html += '<tr>';
            html += `<td>${item.variableName || ''}</td>`;
            html += `<td>${item.path}</td>`;
            html += `<td>${item.type || ''}</td>`;
            html += `<td>${item.title || ''}</td>`;
            html += `<td>${item.cde || item.cdeName || ''}</td>`;
            html += `<td>${item.required ? 'Yes' : 'No'}</td>`;
            html += `<td>${constraints.join('; ')}</td>`;
            html += `<td>${(item.description || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`;
            html += `<td>${(item._comment || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`;
            html += '</tr>';
        });

        html += '</table></body></html>';

        // Create download
        const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'bdsa-schema-flattened.xls');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (!schema) {
        return <div className="flattened-data-view">No schema data available</div>;
    }

    const flattenedData = flattenSchema(schema);

    return (
        <div className="flattened-data-view">
            <div className="flattened-header">
                <h2>Flattened Data View</h2>
                <p>All variables and their constraints from the BDSA schema</p>
                <div className="header-actions">
                    <div className="stats">
                        <span className="stat">Total Variables: {flattenedData.length}</span>
                        <span className="stat">Required Fields: {flattenedData.filter(item => item.required).length}</span>
                    </div>
                    <div className="export-buttons">
                        <button
                            className="export-button csv"
                            onClick={() => exportToCSV(flattenedData)}
                            title="Download as CSV"
                        >
                            📊 Export CSV
                        </button>
                        <button
                            className="export-button excel"
                            onClick={() => exportToExcel(flattenedData)}
                            title="Download as Excel"
                        >
                            📑 Export Excel
                        </button>
                    </div>
                </div>
            </div>

            <div className="flattened-content">
                <div className="table-header">
                    <div className="col-variable">Variable Name</div>
                    <div className="col-type">Type</div>
                    <div className="col-title">Title</div>
                    <div className="col-cde">CDE</div>
                    <div className="col-constraints">Constraints</div>
                    <div className="col-description">Description</div>
                </div>

                {flattenedData.map((item, index) => {
                    const constraints = getConstraintText(item, flattenedData);
                    const indentStyle = { marginLeft: `${item.level * 20}px` };

                    return (
                        <div key={index} className="table-row" style={indentStyle}>
                            <div className="col-variable">
                                <code className={`path-level-${item.level}`}>{item.variableName}</code>
                                {item.required && <span className="required-badge">Required</span>}
                            </div>
                            <div className="col-type">
                                <span
                                    className="type-badge"
                                    style={{ backgroundColor: getTypeColor(item.type) }}
                                >
                                    {item.type}
                                </span>
                            </div>
                            <div className="col-title">
                                {item.title}
                            </div>
                            <div className="col-cde">
                                {item.cde || item.cdeName ? (
                                    <span className="cde-value">{item.cde || item.cdeName}</span>
                                ) : (
                                    <span className="no-cde">—</span>
                                )}
                            </div>
                            <div className="col-constraints">
                                {constraints.length > 0 ? (
                                    <ul className="constraints-list">
                                        {constraints.map((constraint, idx) => (
                                            <li key={idx}>{constraint}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <span className="no-constraints">No constraints</span>
                                )}
                            </div>
                            <div className="col-description">
                                {item.description || <em>No description</em>}
                                {item._comment && (
                                    <div className="comment">
                                        <strong>Note:</strong> {item._comment}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default FlattenedDataView;
