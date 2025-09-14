import React, { useState, useEffect } from 'react';
import { DSAApiClient } from '@bdsa/shared-utils';
import './App.css';

const App = () => {
  // Initialize DSA API client
  const [dsaClient, setDsaClient] = useState(null);

  // Load config from localStorage or use defaults
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem('bdsa-sync-config');
    return saved ? JSON.parse(saved) : {
      baseUrl: '',
      sourceResourceId: '',
      targetResourceId: '',
      resourceType: 'folder',
      fetchStrategy: 'unlimited',
      pageSize: 100
    };
  });

  const [metadataConfig, setMetadataConfig] = useState(() => {
    const saved = localStorage.getItem('bdsa-sync-metadata-config');
    return saved ? JSON.parse(saved) : {
      caseIdKey: 'caseID',
      stainIdKey: 'stainID',
      regionIdKey: 'regionName',
      patientIdPattern: '^([A-Z0-9]+)-', // Regex pattern to extract patient ID from filename
      namingTemplate: '{patientId}-{region}-{stain}',
    };
  });

  const [authStatus, setAuthStatus] = useState(() => {
    const saved = localStorage.getItem('bdsa-sync-auth-status');
    return saved ? JSON.parse(saved) : {
      isAuthenticated: false,
      isConfigured: false,
      hasToken: false,
      hasConfig: false,
    };
  });

  const [sourceItems, setSourceItems] = useState([]);
  const [targetItems, setTargetItems] = useState([]);
  const [syncProgress, setSyncProgress] = useState({
    current: 0,
    total: 0,
    status: 'idle',
  });

  const [syncResult, setSyncResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('');

  // Initialize DSA client when config changes
  useEffect(() => {
    if (config.baseUrl) {
      const client = new DSAApiClient(config);

      // Restore token from localStorage if available
      if (authStatus.token) {
        client.setToken(authStatus.token);
        console.log('🔑 Restored authentication token to DSA client');

        // Validate token on startup
        client.validateToken().then(isValid => {
          if (!isValid) {
            console.warn('⚠️ Stored token is invalid, clearing authentication');
            setAuthStatus({
              isAuthenticated: false,
              hasToken: false,
              isConfigured: false,
              hasConfig: false,
            });
            localStorage.removeItem('bdsa-sync-auth-status');
          } else {
            console.log('✅ Stored token is valid');
          }
        }).catch(error => {
          console.error('Token validation failed:', error);
        });
      }

      setDsaClient(client);
    } else {
      setDsaClient(null);
    }
  }, [config, authStatus.token]);

  const handleConfigChange = (field, value) => {
    const newConfig = {
      ...config,
      [field]: value
    };
    setConfig(newConfig);
    // Save to localStorage
    localStorage.setItem('bdsa-sync-config', JSON.stringify(newConfig));
    setError('');
  };

  const handleMetadataConfigChange = (field, value) => {
    const newMetadataConfig = {
      ...metadataConfig,
      [field]: value
    };
    setMetadataConfig(newMetadataConfig);
    // Save to localStorage
    localStorage.setItem('bdsa-sync-metadata-config', JSON.stringify(newMetadataConfig));
  };

  const handleAuthenticate = async (username, password) => {
    if (!dsaClient) {
      setError('Please enter a server URL first');
      return;
    }

    setIsLoading(true);
    try {
      // Use DSA client for authentication
      const result = await dsaClient.authenticate(username, password);

      if (result.success) {
        const newAuthStatus = {
          isAuthenticated: true,
          hasToken: true,
          user: {
            name: result.user?.login || result.user?.firstName || username,
            email: result.user?.email || `${username}@example.com`,
            id: result.user?._id || result.user?.id
          },
          serverUrl: config.baseUrl,
          lastLogin: new Date().toISOString(),
          token: result.token, // Store token for API calls
        };

        // Set token on the DSA client
        dsaClient.setToken(result.token);

        setAuthStatus(newAuthStatus);
        // Save to localStorage
        localStorage.setItem('bdsa-sync-auth-status', JSON.stringify(newAuthStatus));

        setError('');
      } else {
        throw new Error(result.error || 'Authentication failed');
      }
    } catch (error) {
      setError('Authentication failed: ' + error.message);
      console.error('Authentication error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!dsaClient) {
      setError('Please enter a server URL first');
      return;
    }

    setIsLoading(true);
    setConnectionStatus('');
    try {
      // Use DSA client to test connection
      const result = await dsaClient.testConnection();

      if (result.success) {
        setConnectionStatus(`✅ Connection successful! Server version: ${result.version?.version || 'Unknown'}`);
      } else {
        throw new Error(result.message || 'Connection failed');
      }
    } catch (error) {
      setConnectionStatus('❌ Connection failed: ' + error.message);
      console.error('Connection test error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      // Use DSA client to logout from server
      if (dsaClient && authStatus.token) {
        await dsaClient.logout();
      }
    } catch (error) {
      console.warn('Server logout failed:', error);
      // Continue with local logout even if server logout fails
    }

    const newAuthStatus = {
      isAuthenticated: false,
      hasToken: false,
      user: null,
      lastLogin: null,
      token: null
    };
    setAuthStatus(newAuthStatus);
    // Save to localStorage
    localStorage.setItem('bdsa-sync-auth-status', JSON.stringify(newAuthStatus));
    setConnectionStatus('');
  };

  const processDsaItems = (items) => {
    return items.map((item, index) => {
      // Extract BDSA metadata from meta.BDSA.bdsaLocal (same as reactAgain app)
      const existingBdsaData = item.meta?.BDSA?.bdsaLocal || {};

      // Debug: Log what we're extracting for the first few items
      if (index < 3) {
        console.log(`🔍 DEBUG - Extracting BDSA data for item ${index}:`, {
          itemId: item._id || item.id,
          existingBdsaData,
          extractedValues: {
            localCaseId: existingBdsaData.localCaseId || null,
            localStainID: existingBdsaData.localStainID || null,
            localRegionId: existingBdsaData.localRegionId || null,
            bdsaCaseId: existingBdsaData.bdsaCaseId || null
          }
        });
      }

      // Process item with BDSA metadata (same structure as reactAgain app)
      const processedItem = {
        // Include the original item data
        ...item,

        // Create a single, consistent row identifier
        id: item._id || item.id || `dsa_item_${Date.now()}_${index}`,

        // Add convenient DSA metadata fields for easy access
        dsa_name: item.name || '',
        dsa_created: item.created || item.createdAt || '',
        dsa_updated: item.updated || item.updatedAt || '',
        dsa_size: item.size || item.fileSize || '',
        dsa_mimeType: item.mimeType || item.contentType || '',

        // Extract BDSA metadata for easy access
        localCaseId: existingBdsaData.localCaseId || null,
        localStainID: existingBdsaData.localStainID || null,
        localRegionId: existingBdsaData.localRegionId || null,
        bdsaCaseId: existingBdsaData.bdsaCaseId || null,

        // Keep the full BDSA structure for reference
        BDSA: {
          bdsaLocal: {
            localCaseId: existingBdsaData.localCaseId || null,
            localStainID: existingBdsaData.localStainID || null,
            localRegionId: existingBdsaData.localRegionId || null,
            bdsaCaseId: existingBdsaData.bdsaCaseId || null
          },
          _dataSource: existingBdsaData.source ? {
            localCaseId: 'dsa_server',
            localStainID: 'dsa_server',
            localRegionId: 'dsa_server',
            bdsaCaseId: 'dsa_server'
          } : {},
          _lastModified: new Date().toISOString()
        }
      };

      return processedItem;
    });
  };

  const loadSourceItems = async () => {
    if (!dsaClient || !authStatus.isAuthenticated) {
      setError('Please authenticate first');
      return;
    }

    if (!config.sourceResourceId) {
      setError('Please enter a source resource ID');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      // Use the same approach as reactAgain app - limit=0 to get all items at once
      const rawItems = await dsaClient.getResourceItems(config.sourceResourceId, 0, undefined, config.resourceType);

      // Process items to extract BDSA metadata
      const processedItems = processDsaItems(rawItems);
      setSourceItems(processedItems);

      console.log(`✅ Loaded ${processedItems.length} items from source folder`);
      console.log(`📊 BDSA metadata extracted:`, {
        withCaseId: processedItems.filter(item => item.localCaseId).length,
        withStainId: processedItems.filter(item => item.localStainID).length,
        withRegionId: processedItems.filter(item => item.localRegionId).length,
        withBdsaCaseId: processedItems.filter(item => item.bdsaCaseId).length
      });
    } catch (error) {
      setError('Failed to load source items: ' + error.message);
      console.error('Error loading source items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTargetItems = async () => {
    if (!dsaClient || !authStatus.isAuthenticated) {
      setError('Please authenticate first');
      return;
    }

    if (!config.targetResourceId) {
      setError('Please enter a target resource ID');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      // Use the same approach as reactAgain app - limit=0 to get all items at once
      const rawItems = await dsaClient.getResourceItems(config.targetResourceId, 0, undefined, config.resourceType);

      // Process items to extract BDSA metadata
      const processedItems = processDsaItems(rawItems);
      setTargetItems(processedItems);

      console.log(`✅ Loaded ${processedItems.length} items from target folder`);
      console.log(`📊 BDSA metadata extracted:`, {
        withCaseId: processedItems.filter(item => item.localCaseId).length,
        withStainId: processedItems.filter(item => item.localStainID).length,
        withRegionId: processedItems.filter(item => item.localRegionId).length,
        withBdsaCaseId: processedItems.filter(item => item.bdsaCaseId).length
      });
    } catch (error) {
      setError('Failed to load target items: ' + error.message);
      console.error('Error loading target items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createTargetFolderStructure = async () => {
    if (!dsaClient || !authStatus.isAuthenticated) {
      setError('Please authenticate first');
      return;
    }

    if (sourceItems.length === 0) {
      setError('No source items to process');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Extract unique BDSA case IDs from source items (ONLY use bdsaCaseId)
      const uniqueCaseIds = new Set();
      sourceItems.forEach(item => {
        const bdsaCaseId = item.bdsaCaseId; // Only use bdsaCaseId, not localCaseId
        if (bdsaCaseId && bdsaCaseId !== 'unknown' && bdsaCaseId.trim() !== '') {
          uniqueCaseIds.add(bdsaCaseId);
        }
      });

      console.log(`📊 Found ${uniqueCaseIds.size} unique case IDs:`, Array.from(uniqueCaseIds));

      // Use the efficient batch folder creation method
      const folderNames = Array.from(uniqueCaseIds);
      console.log(`🚀 Starting batch folder creation for ${folderNames.length} folders...`);

      const folderMap = await dsaClient.ensureFoldersExist(
        config.targetResourceId,
        folderNames,
        config.resourceType || 'collection'
      );

      console.log(`✅ Batch folder creation completed. Created ${Object.keys(folderMap).length} folders total.`);

      // Convert the folder map to the expected format
      const createdFolders = Object.entries(folderMap).map(([caseId, folder]) => ({
        caseId,
        folderId: folder._id,
        name: folder.name
      }));

      console.log(`✅ Folder structure created:`, { createdFolders });
      return { createdFolders, existingFolders: [] };
    } catch (error) {
      setError('Failed to create folder structure: ' + error.message);
      console.error('Error creating folder structure:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const clearCache = () => {
    localStorage.removeItem('bdsa-sync-config');
    localStorage.removeItem('bdsa-sync-metadata-config');
    localStorage.removeItem('bdsa-sync-auth-status');
    window.location.reload();
  };


  const startSync = async () => {
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
      const result = {
        success: true,
        message: 'Sync completed successfully',
        processed: 0,
        errors: [],
        createdFolders: [],
        copiedItems: [],
      };

      // First, create the target folder structure
      console.log('🏗️ Creating target folder structure...');
      const folderStructure = await createTargetFolderStructure();

      if (!folderStructure) {
        throw new Error('Failed to create folder structure');
      }

      result.createdFolders = folderStructure.createdFolders.map(f => f.name);

      // Group items by patient using BDSA metadata
      const patientGroups = {};
      sourceItems.forEach(item => {
        // Use BDSA case ID if available, otherwise fall back to local case ID
        const patientId = item.bdsaCaseId || item.localCaseId || 'unknown';
        if (!patientGroups[patientId]) {
          patientGroups[patientId] = [];
        }
        patientGroups[patientId].push(item);
      });

      // Create a map of case ID to folder ID for quick lookup
      const caseIdToFolderId = {};
      folderStructure.createdFolders.forEach(folder => {
        caseIdToFolderId[folder.caseId] = folder.folderId;
      });

      let processedCount = 0;
      for (const [patientId, items] of Object.entries(patientGroups)) {
        const targetFolderId = caseIdToFolderId[patientId];

        if (!targetFolderId) {
          console.warn(`No target folder found for case ID: ${patientId}`);
          continue;
        }

        for (const item of items) {
          setSyncProgress(prev => ({
            ...prev,
            current: processedCount + 1,
            currentItem: item.name,
          }));

          // Generate standardized name using BDSA metadata and naming template
          const newName = metadataConfig.namingTemplate
            .replace('{patientId}', patientId)
            .replace('{caseId}', item.localCaseId || 'unknown')
            .replace('{stainId}', item.localStainID || 'unknown')
            .replace('{regionId}', item.localRegionId || 'unknown')
            .replace('{originalName}', item.name || 'unknown');

          // TODO: Implement actual item copying using dsaClient.copyItem()
          // await dsaClient.copyItem(item._id, targetFolderId, newName);

          // Simulate processing time
          await new Promise(resolve => setTimeout(resolve, 300));

          result.processed++;
          result.copiedItems.push(newName);
          processedCount++;
        }
      }

      setSyncProgress(prev => ({
        ...prev,
        status: 'completed',
      }));

      setSyncResult(result);
    } catch (error) {
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

  // Update configured status when config changes
  useEffect(() => {
    const isConfigured = !!(config.baseUrl && config.sourceResourceId && config.targetResourceId);
    setAuthStatus(prev => ({
      ...prev,
      isConfigured,
      hasConfig: isConfigured,
    }));
  }, [config]);

  return (
    <div className="app">
      <div className="header">
        <h1>BDSA DSA Folder Synchronization Tool</h1>
        <p>Organize and synchronize DSA folders with standardized naming</p>
        <div className="debug-controls">
          <button
            onClick={clearCache}
            className="btn btn-secondary"
            style={{ fontSize: '12px', padding: '4px 8px' }}
          >
            Clear Cache & Reload
          </button>
        </div>
      </div>

      <div className="main-content">
        <div className="config-panel">
          <h3>DSA Server Configuration</h3>

          <div className="config-section">
            <label>
              Server URL:
              <input
                type="url"
                value={config.baseUrl}
                onChange={(e) => handleConfigChange('baseUrl', e.target.value)}
                placeholder="https://your-dsa-server.com"
                disabled={isLoading}
              />
            </label>

            <label>
              Source Folder ID:
              <input
                type="text"
                value={config.sourceResourceId}
                onChange={(e) => handleConfigChange('sourceResourceId', e.target.value)}
                placeholder="Source folder or collection ID"
                disabled={isLoading}
              />
            </label>

            <label>
              Target Folder ID:
              <input
                type="text"
                value={config.targetResourceId}
                onChange={(e) => handleConfigChange('targetResourceId', e.target.value)}
                placeholder="Target folder or collection ID"
                disabled={isLoading}
              />
            </label>

            <label>
              Resource Type:
              <select
                value={config.resourceType}
                onChange={(e) => handleConfigChange('resourceType', e.target.value)}
                disabled={isLoading}
              >
                <option value="folder">Folder</option>
                <option value="collection">Collection</option>
              </select>
            </label>
          </div>

          <div className="connection-section">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isLoading || !config.baseUrl}
            >
              {isLoading ? 'Testing...' : 'Test Connection'}
            </button>

            {connectionStatus && (
              <div className={`connection-status ${connectionStatus.includes('✅') ? 'success' : 'error'}`}>
                {connectionStatus}
              </div>
            )}
          </div>

          <div className="auth-section">
            {authStatus.isAuthenticated ? (
              <div className="auth-status authenticated">
                <p>✅ Authenticated as: {authStatus.user?.name || 'Unknown User'}</p>
                <p>Server: {authStatus.serverUrl}</p>
                {authStatus.lastLogin && (
                  <p>Last login: {new Date(authStatus.lastLogin).toLocaleString()}</p>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoading}
                  className="logout-btn"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="auth-form">
                <h4>Authentication</h4>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.target);
                  const username = formData.get('username');
                  const password = formData.get('password');
                  if (username && password) {
                    handleAuthenticate(username, password);
                  }
                }}>
                  <label>
                    Username:
                    <input
                      type="text"
                      name="username"
                      required
                      disabled={isLoading}
                    />
                  </label>

                  <label>
                    Password:
                    <input
                      type="password"
                      name="password"
                      required
                      disabled={isLoading}
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={isLoading || !config.baseUrl}
                  >
                    {isLoading ? 'Authenticating...' : 'Login'}
                  </button>
                </form>
              </div>
            )}
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {authStatus.isAuthenticated && (
            <div className="metadata-config">
              <h3>Metadata Configuration</h3>
              <div className="config-section">
                <label>
                  Case ID Key:
                  <input
                    type="text"
                    value={metadataConfig.caseIdKey}
                    onChange={(e) => handleMetadataConfigChange('caseIdKey', e.target.value)}
                    placeholder="caseID"
                    disabled={isLoading}
                  />
                </label>

                <label>
                  Stain ID Key:
                  <input
                    type="text"
                    value={metadataConfig.stainIdKey}
                    onChange={(e) => handleMetadataConfigChange('stainIdKey', e.target.value)}
                    placeholder="stainID"
                    disabled={isLoading}
                  />
                </label>

                <label>
                  Region ID Key:
                  <input
                    type="text"
                    value={metadataConfig.regionIdKey}
                    onChange={(e) => handleMetadataConfigChange('regionIdKey', e.target.value)}
                    placeholder="regionName"
                    disabled={isLoading}
                  />
                </label>

                <label>
                  Patient ID Pattern:
                  <input
                    type="text"
                    value={metadataConfig.patientIdPattern}
                    onChange={(e) => handleMetadataConfigChange('patientIdPattern', e.target.value)}
                    placeholder="^([A-Z0-9]+)-"
                    disabled={isLoading}
                  />
                </label>

                <label>
                  Naming Template:
                  <input
                    type="text"
                    value={metadataConfig.namingTemplate}
                    onChange={(e) => handleMetadataConfigChange('namingTemplate', e.target.value)}
                    placeholder="{patientId}-{region}-{stain}"
                    disabled={isLoading}
                  />
                </label>
              </div>
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
                  className="btn btn-primary"
                  onClick={createTargetFolderStructure}
                  disabled={isLoading || sourceItems.length === 0}
                  style={{ marginRight: '10px' }}
                >
                  Create Folders
                </button>
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
            <div className="sync-progress">
              <div className="progress-header">
                <h4>
                  {syncProgress.status === 'running' ? '🔄' :
                    syncProgress.status === 'completed' ? '✅' :
                      syncProgress.status === 'error' ? '❌' : '⏸️'} Sync Progress
                </h4>
                {syncProgress.status === 'running' && (
                  <button
                    type="button"
                    onClick={cancelSync}
                    className="cancel-btn"
                  >
                    Cancel
                  </button>
                )}
              </div>

              <div className="progress-bar-container">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${syncProgress.total > 0 ? Math.round((syncProgress.current / syncProgress.total) * 100) : 0}%`,
                      backgroundColor: syncProgress.status === 'running' ? '#007bff' :
                        syncProgress.status === 'completed' ? '#28a745' :
                          syncProgress.status === 'error' ? '#dc3545' : '#6c757d',
                    }}
                  />
                </div>
                <div className="progress-text">
                  {syncProgress.current} / {syncProgress.total} ({syncProgress.total > 0 ? Math.round((syncProgress.current / syncProgress.total) * 100) : 0}%)
                </div>
              </div>

              <div className="progress-details">
                {syncProgress.currentItem && (
                  <div className="current-item">
                    <strong>Current:</strong> {syncProgress.currentItem}
                  </div>
                )}

                {syncProgress.status === 'error' && syncProgress.error && (
                  <div className="error-message">
                    <strong>Error:</strong> {syncProgress.error}
                  </div>
                )}

                {syncProgress.status === 'completed' && (
                  <div className="completion-message">
                    ✅ Sync completed successfully!
                  </div>
                )}
              </div>
            </div>
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
                        <div>Size: {item.size ? `${Math.round(item.size / 1024 / 1024)}MB` : 'Unknown'}</div>
                        <div>Case ID: {item.localCaseId || 'N/A'}</div>
                        <div>Stain ID: {item.localStainID || 'N/A'}</div>
                        <div>Region ID: {item.localRegionId || 'N/A'}</div>
                        <div>BDSA Case ID: {item.bdsaCaseId || 'N/A'}</div>
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