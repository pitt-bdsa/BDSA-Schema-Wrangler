import React, { useState } from 'react';
import SchemaViewer from './SchemaViewer';
import './SchemaTab.css';

const SchemaTab = () => {
    const [activeSchema, setActiveSchema] = useState('clinical');

    const schemas = [
        { id: 'clinical', label: 'Clinical Schema', file: '/clinical-metadata.json' },
        { id: 'region', label: 'Region Schema', file: '/region-metadata.json' },
        { id: 'stain', label: 'Stain Schema', file: '/slide-level-metadata.json' }
    ];

    return (
        <div className="schema-tab">
            <div className="schema-header">
                <h2>BDSA Schema Documentation</h2>
                <p>View and explore the JSON schemas used for data harmonization</p>
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

export default SchemaTab;
