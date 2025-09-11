import React from 'react';
import './TabView.css';

const TabView = ({ tabs, activeTab, onTabChange }) => {
    return (
        <div className="tab-view">
            <div className="tab-header">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => onTabChange(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            <div className="tab-content">
                {tabs[activeTab]?.component}
            </div>
        </div>
    );
};

export default TabView;
