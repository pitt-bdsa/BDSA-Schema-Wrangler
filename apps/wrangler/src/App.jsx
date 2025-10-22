import React, { useState } from 'react';
import TabView from './components/TabView';
import SchemaTab from './components/SchemaTab';
import ProtocolsTab from './components/ProtocolsTab';
import InputDataTab from './components/InputDataTab';
import CaseManagementTab from './components/CaseManagementTab';
import ProtocolDebugPanel from './components/ProtocolDebugPanel';
import DsaLogin from './components/DsaLogin';
import './App.css';

function App() {
    const [activeTab, setActiveTab] = useState(0);

    const tabs = [
        { id: 0, label: 'Input Data', component: <InputDataTab /> },
        { id: 1, label: 'BDSA Schema', component: <SchemaTab /> },
        { id: 2, label: 'Protocols', component: <ProtocolsTab /> },
        { id: 3, label: 'Case Management', component: <CaseManagementTab /> },
        { id: 4, label: '🔍 Protocol Debug', component: <ProtocolDebugPanel /> }
    ];

    return (
        <div className="app">
            <div className="app-header">
                <div className="header-left">
                    <img src="/assets/BDSA_logo_clear.png" alt="BDSA Logo" className="logo" />
                    <h1>BDSA Schema Wrangler</h1>
                </div>
                <div className="header-right">
                    <DsaLogin />
                </div>
            </div>
            <TabView
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={setActiveTab}
            />
        </div>
    );
}

export default App;
