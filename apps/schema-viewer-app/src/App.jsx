import React, { useState } from 'react';
import SchemaViewer from './components/SchemaViewer';
import './App.css';

const App = () => {
    const [activeSchema, setActiveSchema] = useState('clinical');

    const schemas = [
        { id: 'clinical', label: 'Clinical Schema', file: '/api/schemas/clinical-metadata' },
        { id: 'region', label: 'Region Schema', file: '/api/schemas/region-metadata' },
        { id: 'stain', label: 'Stain Schema', file: '/api/schemas/stain-metadata' },
        { id: 'bdsa', label: 'BDSA Schema', file: '/api/schemas/bdsa-schema' }
    ];

    return (
        <div className="app">
            <div className="app-header">
                <div className="header-left">
                    <img src="/BDSA_logo_clear.png" alt="BDSA Logo" className="logo" />
                    <div className="header-text">
                        <h1>BDSA Schema Viewer</h1>
                        <p>View and explore the JSON schemas used for data harmonization</p>
                    </div>
                </div>
                <div className="header-right">
                    <button
                        className="api-button"
                        onClick={() => window.open('/api/docs', '_blank')}
                        title="Open API Documentation"
                    >
                        📚 API Docs
                    </button>
                </div>
            </div>

            <div className="schema-navigation">
                {schemas.map(schema => (
                    <button
                        key={schema.id}
                        className={`schema-nav-button ${activeSchema === schema.id ? 'active' : ''}`}
                        onClick={() => setActiveSchema(schema.id)}
                    >
                        {schema.label}
                    </button>
                ))}
            </div>

            <div className="schema-content">
                <SchemaViewer
                    schemaFile={schemas.find(s => s.id === activeSchema)?.file}
                    schemaType={activeSchema}
                />
            </div>
        </div>
    );
};

export default App;
