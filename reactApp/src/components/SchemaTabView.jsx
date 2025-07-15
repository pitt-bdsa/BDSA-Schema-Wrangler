import React, { useState } from 'react';
import './SchemaTabView.css';

const SchemaTabView = ({ children }) => {
    const [activeTab, setActiveTab] = useState(0);

    const tabs = [
        { id: 0, label: 'Clinical Schema' },
        { id: 1, label: 'Region Schema' },
        { id: 2, label: 'Stain Schema' }
    ];

    return (
        <div className="schema-tab-view">
            <div className="schema-tab-header">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`schema-tab-button ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            <div className="schema-tab-content">
                {children[activeTab]}
            </div>
        </div>
    );
};

export default SchemaTabView; 