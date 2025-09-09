import React, { useEffect } from 'react';
import TabView from './components/TabView';
import InputDataTab from './components/InputDataTab';
import BDSAchemaTab from './components/BDSAchemaTab';
import ProtocolsTab from './components/ProtocolsTab';
import CaseManagementTab from './components/CaseManagementTab';
import DataStoreDebug from './components/DataStoreDebug';
import { initializeDataStore } from './utils/dataStore';
import './App.css';

function App() {
  // Initialize the centralized data store on app startup
  useEffect(() => {
    initializeDataStore();
  }, []);

  return (
    <div className="app">
      <div className="app-header">
        <img src="/assets/BDSA_logo_clear.png" alt="BDSA Logo" className="logo" />
        <h1>BDSA Schema Wrangler</h1>
      </div>
      <TabView>
        <InputDataTab />
        <BDSAchemaTab />
        <ProtocolsTab />
        <CaseManagementTab />
      </TabView>
      <DataStoreDebug />
    </div>
  );
}

export default App;
