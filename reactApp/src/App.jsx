import React from 'react';
import TabView from './components/TabView';
import InputDataTab from './components/InputDataTab';
import BDSAchemaTab from './components/BDSAchemaTab';
import ProtocolsTab from './components/ProtocolsTab';
import './App.css';

function App() {
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
      </TabView>
    </div>
  );
}

export default App;
