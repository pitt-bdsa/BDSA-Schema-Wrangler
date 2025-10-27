import React, { useState, useEffect } from 'react';
import './SchemaViewer.css';

/**
 * SchemaViewer - Displays JSON Schema in a readable, hierarchical format
 * 
 * @param {string} schemaFile - URL to fetch schema from (optional if schemaData provided)
 * @param {object} schemaData - Schema object to display directly (optional if schemaFile provided)
 * @param {string} schemaType - Display name for the schema type (e.g., "BDSA", "Stain")
 * @param {string} schemaSection - Extract specific section from schema (clinical, region, stain, bdsa)
 */
const SchemaViewer = ({ schemaFile, schemaData, schemaType = 'Schema', schemaSection }) => {
    const [schema, setSchema] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (schemaData) {
            // Use provided schema data directly
            processSchemaData(schemaData);
        } else if (schemaFile) {
            // Load from file
            loadSchema();
        } else {
            setLoading(false);
        }
    }, [schemaFile, schemaData, schemaSection]);

    const processSchemaData = (data) => {
        setLoading(true);
        setError(null);

        try {
            let processedSchema = data;

            // Extract specific section if requested
            if (schemaSection && data.properties) {
                switch (schemaSection) {
                    case 'clinical':
                        processedSchema = data.properties.clinicalData;
                        break;
                    case 'region':
                        processedSchema = data.properties.regionIDs;
                        break;
                    case 'stain':
                        // Extract stain properties from array items
                        const stainSchema = data.properties.stainIDs;
                        if (stainSchema?.items?.properties) {
                            processedSchema = {
                                type: 'object',
                                title: 'Stain Schema',
                                description: 'Stain-related properties from BDSA schema',
                                properties: stainSchema.items.properties
                            };
                        } else {
                            processedSchema = stainSchema;
                        }
                        break;
                    case 'bdsa':
                    default:
                        processedSchema = data;
                }
            }

            setSchema(processedSchema);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const loadSchema = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch(`${schemaFile}?t=${Date.now()}`);
            if (!response.ok) {
                throw new Error(`Failed to load ${schemaType} schema`);
            }
            const data = await response.json();
            processSchemaData(data);
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    const renderProperty = (key, property, level = 0) => {
        const indent = level * 20;

        return (
            <div key={key} style={{ marginLeft: indent }}>
                <div className="schema-property">
                    <div className="property-header">
                        <span className="property-name">{key}</span>
                        {property.title && <span className="property-title"> - {property.title}</span>}
                        {property.type && <span className="property-type"> ({property.type})</span>}
                    </div>

                    {property.description && (
                        <div className="property-description">{property.description}</div>
                    )}

                    {property.abbreviation && (
                        <div className="property-abbreviation">
                            <strong>Abbreviation:</strong> <code>{property.abbreviation}</code>
                        </div>
                    )}

                    {property.enum && (
                        <div className="property-enum">
                            <strong>Allowed values:</strong> {property.enum.join(', ')}
                        </div>
                    )}

                    {property.pattern && (
                        <div className="property-pattern">
                            <strong>Pattern:</strong> <code>{property.pattern}</code>
                        </div>
                    )}

                    {property.cde && (
                        <div className="property-cde">
                            <strong>CDE:</strong> <code>{property.cde}</code>
                        </div>
                    )}
                </div>

                {property.properties && (
                    <div className="property-children">
                        {Object.entries(property.properties).map(([childKey, childProperty]) =>
                            renderProperty(childKey, childProperty, level + 1)
                        )}
                    </div>
                )}

                {property.items && (
                    <div className="property-children">
                        {property.items.properties ? (
                            <>
                                <div className="array-items-label">Array items:</div>
                                {Object.entries(property.items.properties).map(([childKey, childProperty]) =>
                                    renderProperty(childKey, childProperty, level + 1)
                                )}
                            </>
                        ) : property.items.enum ? (
                            <div className="property-enum">
                                <strong>Landmarks:</strong> {property.items.enum.join(', ')}
                            </div>
                        ) : null}
                    </div>
                )}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="schema-loading" role="status">
                <div className="loading-spinner"></div>
                <p>Loading {schemaType} schema...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="schema-error" role="alert">
                <div className="error-icon">⚠️</div>
                <h3>Error loading schema</h3>
                <p>{error}</p>
                <button onClick={loadSchema} className="retry-button">
                    Retry
                </button>
            </div>
        );
    }

    if (!schema) {
        return (
            <div className="schema-empty">
                <p>No schema data available</p>
            </div>
        );
    }

    return (
        <div className="schema-viewer">
            <div className="schema-overview">
                <div className="schema-header-row">
                    <h3>{schema.title || `${schemaType} Schema`}</h3>
                    {schemaFile && (
                        <button onClick={loadSchema} className="refresh-button" disabled={loading}>
                            {loading ? 'Loading...' : 'Refresh'}
                        </button>
                    )}
                </div>

                <div className="schema-info">
                    <p><strong>Type:</strong> {schema.type}</p>
                    {schema.description && <p><strong>Description:</strong> {schema.description}</p>}
                    {schema.required && schema.required.length > 0 && (
                        <p><strong>Required Fields:</strong> {schema.required.join(', ')}</p>
                    )}
                </div>
            </div>

            <div className="schema-properties-section">
                <h3>Properties</h3>
                <div className="schema-properties">
                    {schema.properties && Object.entries(schema.properties).map(([key, property]) =>
                        renderProperty(key, property)
                    )}
                </div>
            </div>
        </div>
    );
};

export default SchemaViewer;

