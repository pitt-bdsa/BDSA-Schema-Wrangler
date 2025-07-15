import React, { useState, useEffect } from 'react';
import './SchemaDisplay.css';

const RegionSchemaTab = () => {
    const [schema, setSchema] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadSchema();
    }, []);

    const loadSchema = async () => {
        try {
            setLoading(true);
            setError(null);
            // Add cache-busting parameter to force refresh
            const response = await fetch(`/region-metadata.json?t=${Date.now()}`);
            if (!response.ok) {
                throw new Error('Failed to load region schema');
            }
            const schemaData = await response.json();
            setSchema(schemaData);
            setLoading(false);
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
                    <span className="property-name">{key}</span>
                    {property.title && <span className="property-title"> - {property.title}</span>}
                    {property.type && <span className="property-type"> ({property.type})</span>}
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
                            <strong>Pattern:</strong> {property.pattern}
                        </div>
                    )}
                    {property.required && (
                        <div className="property-required">
                            <strong>Required:</strong> {property.required.join(', ')}
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
                        {Object.entries(property.items.properties).map(([childKey, childProperty]) =>
                            renderProperty(childKey, childProperty, level + 1)
                        )}
                    </div>
                )}
            </div>
        );
    };

    if (loading) {
        return <div className="loading">Loading region schema...</div>;
    }

    if (error) {
        return (
            <div className="schema-display">
                <div className="error">Error loading region schema: {error}</div>
                <button onClick={loadSchema} className="refresh-button">
                    Retry Load
                </button>
            </div>
        );
    }

    return (
        <div className="schema-display">
            <div className="schema-section">
                <div className="schema-header-row">
                    <h3>Region Schema Overview</h3>
                    <button onClick={loadSchema} className="refresh-button" disabled={loading}>
                        {loading ? 'Loading...' : 'Refresh'}
                    </button>
                </div>
                <div className="schema-info">
                    <p><strong>Title:</strong> {schema?.title || 'Region Metadata'}</p>
                    <p><strong>Type:</strong> {schema?.type}</p>
                    {schema?.required && (
                        <p><strong>Required Fields:</strong> {schema.required.join(', ')}</p>
                    )}
                </div>
            </div>

            <div className="schema-section">
                <h3>Properties</h3>
                <div className="schema-properties">
                    {schema?.properties && Object.entries(schema.properties).map(([key, property]) =>
                        renderProperty(key, property)
                    )}
                </div>
            </div>
        </div>
    );
};

export default RegionSchemaTab; 