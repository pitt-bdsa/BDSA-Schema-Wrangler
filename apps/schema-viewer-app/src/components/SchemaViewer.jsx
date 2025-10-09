import React, { useState, useEffect } from 'react';
import './SchemaViewer.css';

const SchemaViewer = ({ schemaFile, schemaType, schemaSection }) => {
    const [schema, setSchema] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (schemaFile) {
            loadSchema();
        }
    }, [schemaFile, schemaSection]);

    const loadSchema = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch(`${schemaFile}?t=${Date.now()}`);
            if (!response.ok) {
                throw new Error(`Failed to load ${schemaType} schema`);
            }
            const schemaData = await response.json();

            // Extract the appropriate section based on schemaSection
            if (schemaSection && schemaData.properties) {
                let sectionData = null;

                switch (schemaSection) {
                    case 'clinical':
                        sectionData = schemaData.properties.clinicalData;
                        break;
                    case 'region':
                        sectionData = schemaData.properties.regionIDs;
                        break;
                    case 'stain':
                        // Extract the stain properties from the array items
                        const stainSchema = schemaData.properties.stainIDs;
                        if (stainSchema && stainSchema.items && stainSchema.items.properties) {
                            sectionData = {
                                type: 'object',
                                title: 'Stain Schema',
                                description: 'Stain-related properties from BDSA schema',
                                properties: stainSchema.items.properties
                            };
                        } else {
                            sectionData = stainSchema;
                        }
                        break;
                    case 'bdsa':
                        // Show the full schema
                        sectionData = schemaData;
                        break;
                    default:
                        sectionData = schemaData;
                }

                setSchema(sectionData);
            } else {
                setSchema(schemaData);
            }
        } catch (err) {
            setError(err.message);
        } finally {
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

                {property.items && property.items.properties && (
                    <div className="property-children">
                        <div className="array-items-label">Array items:</div>
                        {Object.entries(property.items.properties).map(([childKey, childProperty]) =>
                            renderProperty(childKey, childProperty, level + 1)
                        )}
                    </div>
                )}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="schema-loading">
                <div className="loading-spinner"></div>
                <p>Loading {schemaType} schema...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="schema-error">
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
                    <button onClick={loadSchema} className="refresh-button" disabled={loading}>
                        {loading ? 'Loading...' : 'Refresh'}
                    </button>
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
