import React, { useState } from 'react';
import SchemaViewer from '../../../packages/schema-components/src/SchemaViewer';
import FlattenedDataView from './components/FlattenedDataView';
import CdeReferenceView from './components/CdeReferenceView';
import './App.css';

const DEFAULT_SCHEMA_FILE = '/bdsa-schema.json';

const App = ({
    schemaFile = DEFAULT_SCHEMA_FILE,
    logoSrc = '/BDSA_logo_clear.png',
    showApiDocs = true,
    apiDocsUrl = '/api/docs',
}) => {
    const [activeSchema, setActiveSchema] = useState('clinical');

    const schemas = [
        { id: 'clinical', label: 'Clinical Schema', file: schemaFile, section: 'clinical' },
        { id: 'region', label: 'Region Schema', file: schemaFile, section: 'region' },
        { id: 'stain', label: 'Stain Schema', file: schemaFile, section: 'stain' },
        { id: 'bdsa', label: 'BDSA Schema', file: schemaFile, section: 'bdsa' },
        { id: 'flattened', label: 'Flattened View', file: schemaFile, section: 'flattened' },
        { id: 'cde-reference', label: 'CDE Reference', file: schemaFile, section: 'cde-reference' }
    ];

    return (
        <div className="app">
            <div className="app-header">
                <div className="header-left">
                    <img src={logoSrc} alt="BDSA Logo" className="logo" />
                    <div className="header-text">
                        <h1>BDSA Schema Viewer</h1>
                        <p>View and explore the JSON schemas used for data harmonization</p>
                    </div>
                </div>
                {showApiDocs && (
                    <div className="header-right">
                        <button
                            className="api-button"
                            onClick={() => window.open(apiDocsUrl, '_blank')}
                            title="Open API Documentation"
                        >
                            📚 API Docs
                        </button>
                    </div>
                )}
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
                {activeSchema === 'flattened' ? (
                    <FlattenedDataView
                        schemaFile={schemas.find(s => s.id === activeSchema)?.file}
                    />
                ) : activeSchema === 'cde-reference' ? (
                    <CdeReferenceView
                        schemaFile={schemas.find(s => s.id === activeSchema)?.file}
                    />
                ) : (
                    <SchemaViewer
                        schemaFile={schemas.find(s => s.id === activeSchema)?.file}
                        schemaType={activeSchema}
                        schemaSection={schemas.find(s => s.id === activeSchema)?.section}
                    />
                )}
            </div>
        </div>
    );
};

export default App;
