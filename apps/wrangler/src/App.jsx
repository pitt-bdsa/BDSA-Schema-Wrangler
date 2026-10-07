import React, { useState } from 'react';
import TabView from './components/TabView';
import SchemaTab from './components/SchemaTab';
import ProtocolsTab from './components/ProtocolsTab';
import InputDataTab from './components/InputDataTab';
import CaseManagementTab from './components/CaseManagementTab';
import ProtocolDebugPanel from './components/ProtocolDebugPanel';
import DsaLogin from './components/DsaLogin';
import schemaValidator from './utils/schemaValidator';
import './App.css';

function App({
    embedded = false,
    schemaFile = '/bdsa-schema.json',
    logoSrc = '/assets/BDSA_logo_clear.png',
    onCatalogChanged,
} = {}) {
    const [activeTab, setActiveTab] = useState(0);

    schemaValidator.setSchemaFile(schemaFile);

    const tabs = [
        { label: 'Input Data', component: <InputDataTab embedded={embedded} /> },
        !embedded && { label: 'BDSA Schema', component: <SchemaTab schemaFile={schemaFile} /> },
        { label: 'Protocols', component: <ProtocolsTab embedded={embedded} onCatalogChanged={onCatalogChanged} /> },
        { label: 'Case Management', component: <CaseManagementTab embedded={embedded} /> },
        { label: '🔍 Protocol Debug', component: <ProtocolDebugPanel /> },
    ].filter(Boolean).map((tab, id) => ({ ...tab, id }));

    return (
        <div className={`app wrangler-app${embedded ? ' wrangler-app-embedded' : ''}`}>
            <div className="app-header">
                <div className="header-left">
                    <img src={logoSrc} alt="BDSA Logo" className="logo" />
                    <h1>BDSA Schema Wrangler</h1>
                </div>
                <div className="header-right">
                    <DsaLogin embedded={embedded} />
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
