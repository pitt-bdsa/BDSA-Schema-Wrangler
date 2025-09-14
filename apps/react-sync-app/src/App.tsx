import React, { useState, useEffect } from 'react';
import { DSAConfig, DSAAuthStatus, SyncProgress, DSAItem, SyncResult } from '@bdsa/shared-types';
import { DSAApiClient, createDSAClient, validateDSAConfig } from '@bdsa/shared-utils';
import { DSAConfigForm, SyncProgress as SyncProgressComponent } from '@bdsa/shared-components';
import './App.css';

const App: React.FC = () => {
  const [config, setConfig] = useState<DSAConfig>({
    baseUrl: '',
    resourceId: '',
    resourceType: 'folder',
    fetchStrategy: 'unlimited',
    pageSize: 100,
  });

  const [authStatus, setAuthStatus] = useState<DSAAuthStatus>({
    isAuthenticated: false,
    isConfigured: false,
    hasToken: false,
    hasConfig: false,
  });

  const [sourceItems, setSourceItems] = useState<DSAItem[]>([]);
  const [targetItems, setTargetItems] = useState<DSAItem[]>([]);
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    current: 0,
    total: 0,
    status: 'idle',
  });

  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const [dsaClient, setDsaClient] = useState<DSAApiClient | null>(null);

  // Initialize DSA client when config changes
  useEffect(() => {
    if (validateDSAConfig(config)) {
      const client = createDSAClient(config);
      setDsaClient(client);
      setAuthStatus(prev => ({
        ...prev,
        isConfigured: true,
        hasConfig: true,
      }));
    } else {
      setDsaClient(null);
      setAuthStatus(prev => ({
        ...prev,
        isConfigured: false,
        hasConfig: false,
      }));
    }
  }, [config]);

  const handleConfigChange = (newConfig: DSAConfig) => {
    setConfig(newConfig);
    setError('');
  };

  const handleAuthenticate = async (username: string, password: string) => {
    if (!dsaClient) {
      throw new Error('DSA client not initialized');
    }

    try {
      const result = await dsaClient.authenticate(username, password);
      if (result.success && result.token) {
        dsaClient.setToken(result.token);
        setAuthStatus(prev => ({
          ...prev,
          isAuthenticated: true,
          hasToken: true,
          user: result.user,
          serverUrl: config.baseUrl,
          lastLogin: new Date(),
        }));
      }
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  const handleTestConnection = async () => {
    if (!dsaClient) {
      throw new Error('DSA client not initialized');
    }

    try {
      await dsaClient.testConnection();
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  const handleLogout = () => {
    if (dsaClient) {
      dsaClient.setToken('');
    }
    setAuthStatus(prev => ({
      ...prev,
      isAuthenticated: false,
      hasToken: false,
      user: undefined,
      lastLogin: undefined,
    }));
  };

  const loadSourceItems = async () => {
    if (!dsaClient || !authStatus.isAuthenticated) {
      setError('Please authenticate first');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const items = await dsaClient.getAllResourceItems(config.resourceId);
      setSourceItems(items);
    } catch (error: any) {
      setError(`Failed to load source items: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTargetItems = async () => {
    if (!dsaClient || !authStatus.isAuthenticated) {
      setError('Please authenticate first');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // For now, we'll use the same resource ID for target
      // In a real implementation, you'd have separate source/target folder IDs
      const items = await dsaClient.getAllResourceItems(config.resourceId);
      setTargetItems(items);
    } catch (error: any) {
      setError(`Failed to load target items: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const startSync = async () => {
    if (!dsaClient || !authStatus.isAuthenticated) {
      setError('Please authenticate first');
      return;
    }

    if (sourceItems.length === 0) {
      setError('No source items to sync');
      return;
    }

    setSyncProgress({
      current: 0,
      total: sourceItems.length,
      status: 'running',
    });

    setError('');
    setSyncResult(null);

    try {
      // This is a simplified sync implementation
      // In a real implementation, you'd:
      // 1. Create patient folders
      // 2. Copy items with standardized naming
      // 3. Update metadata
      
      const result: SyncResult = {
        success: true,
        message: 'Sync completed successfully',
        processed: 0,
        errors: [],
        createdFolders: [],
        copiedItems: [],
      };

      for (let i = 0; i < sourceItems.length; i++) {
        const item = sourceItems[i];
        
        setSyncProgress(prev => ({
          ...prev,
          current: i + 1,
          currentItem: item.name,
        }));

        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 100));

        // Here you would implement the actual sync logic
        result.processed++;
        result.copiedItems.push(item._id);
      }

      setSyncProgress(prev => ({
        ...prev,
        status: 'completed',
      }));

      setSyncResult(result);
    } catch (error: any) {
      setSyncProgress(prev => ({
        ...prev,
        status: 'error',
        error: error.message,
      }));
      setError(`Sync failed: ${error.message}`);
    }
  };

  const cancelSync = () => {
    setSyncProgress(prev => ({
      ...prev,
      status: 'idle',
    }));
  };

  return (
    <div className="app">
      <div className="header">
        <h1>BDSA DSA Folder Synchronization Tool</h1>
        <p>Organize and synchronize DSA folders with standardized naming</p>
      </div>

      <div className="main-content">
        <div className="config-panel">
          <DSAConfigForm
            config={config}
            authStatus={authStatus}
            onConfigChange={handleConfigChange}
            onAuthenticate={handleAuthenticate}
            onTestConnection={handleTestConnection}
            onLogout={handleLogout}
          />

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {authStatus.isAuthenticated && (
            <div className="sync-controls">
              <h3>Sync Controls</h3>
              <div className="form-group">
                <button
                  className="btn btn-secondary"
                  onClick={loadSourceItems}
                  disabled={isLoading}
                >
                  {isLoading ? 'Loading...' : 'Load Source Items'}
                </button>
                <span className="item-count">
                  {sourceItems.length} items loaded
                </span>
              </div>

              <div className="form-group">
                <button
                  className="btn btn-secondary"
                  onClick={loadTargetItems}
                  disabled={isLoading}
                >
                  {isLoading ? 'Loading...' : 'Load Target Items'}
                </button>
                <span className="item-count">
                  {targetItems.length} items loaded
                </span>
              </div>

              <div className="form-group">
                <button
                  className="btn btn-success"
                  onClick={startSync}
                  disabled={isLoading || sourceItems.length === 0 || syncProgress.status === 'running'}
                >
                  Start Sync
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="sync-panel">
          <h3>Sync Progress</h3>
          
          {syncProgress.status !== 'idle' && (
            <SyncProgressComponent
              progress={syncProgress}
              onCancel={cancelSync}
              showDetails={true}
            />
          )}

          {syncResult && (
            <div className="success-message">
              <h4>Sync Results</h4>
              <p><strong>Status:</strong> {syncResult.message}</p>
              <p><strong>Processed:</strong> {syncResult.processed} items</p>
              <p><strong>Created Folders:</strong> {syncResult.createdFolders.length}</p>
              <p><strong>Copied Items:</strong> {syncResult.copiedItems.length}</p>
              {syncResult.errors.length > 0 && (
                <div>
                  <strong>Errors:</strong>
                  <ul>
                    {syncResult.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {sourceItems.length > 0 && (
            <div className="item-preview">
              <h4>Source Items Preview</h4>
              <div className="item-list">
                {sourceItems.slice(0, 10).map((item) => (
                  <div key={item._id} className="item-list-item">
                    <div>
                      <div className="item-name">{item.name}</div>
                      <div className="item-meta">
                        Size: {item.size ? `${Math.round(item.size / 1024 / 1024)}MB` : 'Unknown'}
                      </div>
                    </div>
                  </div>
                ))}
                {sourceItems.length > 10 && (
                  <div className="item-list-item">
                    <div className="item-meta">
                      ... and {sourceItems.length - 10} more items
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
