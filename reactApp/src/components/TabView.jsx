import React, { useState } from 'react';
import './TabView.css';

const TabView = ({ children }) => {
    const [activeTab, setActiveTab] = useState(0);

    const tabs = [
        { id: 0, label: 'Input Data' },
        { id: 1, label: 'BDSA Schema' },
        { id: 2, label: 'Protocols' },
        { id: 3, label: 'Case Management' }
    ];

    return (
        <div className="tab-view">
            <div className="tab-header">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            <div className="tab-content">
                {children.map((child, index) => (
                    <div
                        key={index}
                        className={`tab-panel ${activeTab === index ? 'active' : 'hidden'}`}
                    >
                        {child}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TabView; 