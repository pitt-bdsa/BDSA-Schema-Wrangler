import React, { useState, useEffect } from 'react';
import './CdeReferenceView.css';

const CdeReferenceView = ({ schemaFile }) => {
    const [schema, setSchema] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

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

    // Extract CDE-style data from schema
    const extractCdeData = (obj, collection = '', path = '', fullSchema = null) => {
        const cdeItems = [];

        if (!obj || typeof obj !== 'object') return cdeItems;

        // Handle properties object
        if (obj.properties) {
            Object.entries(obj.properties).forEach(([key, value]) => {
                const currentPath = path ? `${path}.${key}` : key;

                // Determine collection based on schema structure (slide/region/case)
                let itemCollection = collection;
                if (currentPath.startsWith('bdsaID')) itemCollection = 'Case';
                else if (currentPath.includes('stainIDs') || currentPath.startsWith('stainIDs')) itemCollection = 'Slide';
                else if (currentPath.includes('regionIDs') || currentPath.startsWith('regionIDs')) itemCollection = 'Region';
                else if (currentPath.includes('clinicalData')) itemCollection = 'Case';
                else if (!itemCollection) itemCollection = 'General';

                // Include all meaningful properties (with or without CDE mappings)
                // Skip internal/nested array items structures
                // Skip individual stain types (they're handled as constraints of stainIDs)
                // Skip individual region types (they're handled as constraints of regionIDs)
                if (key !== 'items' &&
                    !currentPath.includes('stainIDs[].') &&
                    !(currentPath.startsWith('stainIDs.') && currentPath !== 'stainIDs') &&
                    !currentPath.includes('regionIDs.regions.') &&
                    !(currentPath.startsWith('regionIDs.') && currentPath !== 'regionIDs') &&
                    (value.type || value.title || value.description)) {
                    const item = {
                        collection: itemCollection,
                        item: key,
                        description: value.description || value.title || '',
                        itemType: value.type || '',
                        itemDescription: value.title || '',
                        required: value.required ? 'required' : 'nullable',
                        values: formatValues(value, fullSchema || obj),
                        comments: value._comment || '',
                        alternateItemNames: '', // Could be populated from schema if available
                        alternateDescription: '',
                        cde: value.cde || value.cdeName || 'TBD',
                        hasCde: !!(value.cde || value.cdeName),
                        path: currentPath
                    };
                    cdeItems.push(item);
                }

                // Recursively process nested objects
                if (value.type === 'object' && value.properties) {
                    cdeItems.push(...extractCdeData(value, itemCollection, currentPath, fullSchema || obj));
                }
                // Handle array items
                if (value.type === 'array' && value.items && value.items.properties) {
                    cdeItems.push(...extractCdeData(value.items, itemCollection, `${currentPath}[]`, fullSchema || obj));
                }
            });
        }

        return cdeItems;
    };

    const formatValues = (property, allSchemaData = null) => {
        // Special handling for stainIDs - extract allowed stain types
        if (property.cde === 'stain_protocol_path_stain' && allSchemaData) {
            const stainTypes = extractStainTypes(allSchemaData);
            if (stainTypes.length > 0) {
                return `Allowed stain types: ${stainTypes.join(', ')}`;
            }
        }

        // Special handling for regionIDs - extract allowed region types
        if (property.cde === 'region_protocol_path_region' && allSchemaData) {
            const regionTypes = extractRegionTypes(allSchemaData);
            if (regionTypes.length > 0) {
                return `Allowed region types: ${regionTypes.join(', ')}`;
            }
        }

        if (property.enum) {
            return `Allowed values: ${property.enum.join(', ')}`;
        }
        if (property.pattern) {
            return `Pattern: ${property.pattern}`;
        }
        if (property.minimum !== undefined || property.maximum !== undefined) {
            const min = property.minimum !== undefined ? property.minimum : '−∞';
            const max = property.maximum !== undefined ? property.maximum : '∞';
            return `Range: ${min} to ${max}`;
        }
        if (property.minLength !== undefined || property.maxLength !== undefined) {
            const min = property.minLength !== undefined ? property.minLength : 0;
            const max = property.maxLength !== undefined ? property.maxLength : '∞';
            return `Length: ${min} to ${max}`;
        }
        if (property.examples && property.examples.length > 0) {
            return `Examples: ${property.examples.join(', ')}`;
        }

        // Handle array of objects with specific structure
        if (property.type === 'array' && property.items && property.items.type === 'object' && property.items.properties) {
            const requiredFields = property.items.required || [];
            const optionalFields = Object.keys(property.items.properties).filter(key => !requiredFields.includes(key));

            let constraintText = `Array of objects`;
            if (requiredFields.length > 0) {
                constraintText += ` with required properties: ${requiredFields.join(', ')}`;
            }
            if (optionalFields.length > 0) {
                constraintText += ` and optional properties: ${optionalFields.join(', ')}`;
            }

            // Add enum constraints for specific fields
            const enumFields = [];
            Object.entries(property.items.properties).forEach(([fieldName, fieldDef]) => {
                if (fieldDef.enum) {
                    enumFields.push(`${fieldName}: ${fieldDef.enum.join(', ')}`);
                }
            });

            if (enumFields.length > 0) {
                constraintText += ` (${enumFields.join('; ')})`;
            }

            return constraintText;
        }

        if (property.type) {
            return property.type;
        }
        return '';
    };

    // Extract allowed stain types from schema
    const extractStainTypes = (schema) => {
        const stainTypes = [];
        if (schema?.properties?.stainIDs?.items?.properties) {
            Object.keys(schema.properties.stainIDs.items.properties).forEach(stainType => {
                if (stainType !== 'items') {
                    stainTypes.push(stainType);
                }
            });
        }
        return stainTypes;
    };

    // Extract allowed region types from schema
    const extractRegionTypes = (schema) => {
        const regionTypes = [];
        if (schema?.properties?.regionIDs?.properties?.regions?.properties) {
            Object.keys(schema.properties.regionIDs.properties.regions.properties).forEach(regionType => {
                if (regionType !== 'items') {
                    regionTypes.push(regionType);
                }
            });
        }
        return regionTypes;
    };

    const exportToCSV = (cdeData) => {
        // CSV headers matching the DigiPath template
        const headers = [
            'Collection', 'Item', 'Description', 'ItemType', 'ItemDescription',
            'Required', 'Values', 'Comments', 'AlternateItemNames', 'AlternateDescription'
        ];

        // Create CSV rows
        const rows = cdeData.map(item => {
            return [
                item.collection,
                item.item,
                item.description,
                item.itemType,
                item.itemDescription,
                item.required,
                item.values,
                item.comments,
                item.alternateItemNames,
                item.alternateDescription
            ].map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(',');
        });

        // Combine headers and rows
        const csv = [headers.join(','), ...rows].join('\n');

        // Create download
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'bdsa-cde-reference.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) {
        return <div className="cde-reference-view">Loading CDE reference data...</div>;
    }

    if (error) {
        return <div className="cde-reference-view">Error loading schema: {error}</div>;
    }

    if (!schema) {
        return <div className="cde-reference-view">No schema data available</div>;
    }

    const cdeData = extractCdeData(schema);

    // Filter by search term
    const filteredData = searchTerm
        ? cdeData.filter(item =>
            item.item.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.collection.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.cde.toLowerCase().includes(searchTerm.toLowerCase())
        )
        : cdeData;

    // Group by collection
    const groupedData = filteredData.reduce((acc, item) => {
        if (!acc[item.collection]) {
            acc[item.collection] = [];
        }
        acc[item.collection].push(item);
        return acc;
    }, {});

    return (
        <div className="cde-reference-view">
            <div className="cde-header">
                <h2>Common Data Elements (CDE) Reference</h2>
                <p>BDSA Schema mapped to CDE format (DigiPath CDEs template) - Grouped by Case, Slide, and Region</p>
                <div className="header-actions">
                    <div className="search-box">
                        <input
                            type="text"
                            placeholder="Search by item name, description, collection, or CDE..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                        {searchTerm && (
                            <button
                                className="clear-search"
                                onClick={() => setSearchTerm('')}
                                title="Clear search"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                    <div className="stats">
                        <span className="stat">Total Items: {filteredData.length}</span>
                        <span className="stat">Mapped: {filteredData.filter(item => item.hasCde).length}</span>
                        <span className="stat stat-warning">TBD: {filteredData.filter(item => !item.hasCde).length}</span>
                        <span className="stat">Categories: {Object.keys(groupedData).length}</span>
                    </div>
                    <button
                        className="export-button"
                        onClick={() => exportToCSV(filteredData)}
                        title="Download as CSV"
                    >
                        📊 Export CSV
                    </button>
                </div>
            </div>

            <div className="cde-content">
                {Object.entries(groupedData).map(([collection, items]) => (
                    <div key={collection} className="cde-collection">
                        <h3 className="collection-header">
                            {collection} <span className="collection-count">({items.length} items)</span>
                        </h3>
                        <div className="cde-table">
                            <div className="table-header">
                                <div className="col-collection">Collection</div>
                                <div className="col-item">Item</div>
                                <div className="col-type">Type</div>
                                <div className="col-required">Required</div>
                                <div className="col-values">Values/Constraints</div>
                                <div className="col-description">Description</div>
                                <div className="col-cde">CDE</div>
                            </div>
                            {items.map((item, index) => (
                                <div key={index} className="table-row">
                                    <div className="col-collection">
                                        <span className="collection-badge">{item.collection}</span>
                                    </div>
                                    <div className="col-item">
                                        <code className="item-name">{item.item}</code>
                                        {item.itemDescription && item.itemDescription !== item.item && (
                                            <div className="item-title">{item.itemDescription}</div>
                                        )}
                                    </div>
                                    <div className="col-type">
                                        <span className={`type-badge type-${item.itemType}`}>
                                            {item.itemType}
                                        </span>
                                    </div>
                                    <div className="col-required">
                                        <span className={`required-badge ${item.required}`}>
                                            {item.required}
                                        </span>
                                    </div>
                                    <div className="col-values">
                                        <div className="values-text">{item.values}</div>
                                    </div>
                                    <div className="col-description">
                                        {item.description}
                                        {item.comments && (
                                            <div className="comments">
                                                <strong>Note:</strong> {item.comments}
                                            </div>
                                        )}
                                    </div>
                                    <div className="col-cde">
                                        {item.hasCde ? (
                                            <span className="cde-value">{item.cde}</span>
                                        ) : (
                                            <span className="cde-tbd">TBD</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CdeReferenceView;

