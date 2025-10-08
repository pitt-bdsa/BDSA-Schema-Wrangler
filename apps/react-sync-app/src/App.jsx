import React, { useState, useEffect } from 'react';
import { DSAApiClient } from '@bdsa/shared-utils';
import AuthSection from './components/AuthSection';
import BdsaConfigSection from './components/BdsaConfigSection';
import SyncControlsSection from './components/SyncControlsSection';
import SyncResultsSection from './components/SyncResultsSection';
import LargeImageConfigSection from './components/LargeImageConfigSection';
import DebugModal from './components/DebugModal';
import DSAFolderBrowserModal from './components/DSAFolderBrowserModal';
import { generateNormalizedName } from './utils/naming';
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
      bdsaNamingTemplate: '{bdsaCaseId}-{bdsaRegionProtocol}-{bdsaStainProtocol}',
      syncAllItems: true, // Default to true for better first-time user experience
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
  const [modifiedItems, setModifiedItems] = useState(new Set());
  const [syncProgress, setSyncProgress] = useState({
    current: 0,
    total: 0,
    status: 'idle',
  });

  // Calculate unique BDSA Case IDs from source items
  const uniqueBdsaCaseIds = React.useMemo(() => {
    const uniqueIds = new Set();
    sourceItems.forEach(item => {
      const bdsaCaseId = item.bdsaCaseId;
      if (bdsaCaseId && bdsaCaseId !== 'unknown' && bdsaCaseId.trim() !== '') {
        uniqueIds.add(bdsaCaseId);
      }
    });
    return Array.from(uniqueIds);
  }, [sourceItems]);

  const [syncResult, setSyncResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('');
  const [debugInfo, setDebugInfo] = useState(null);

  // Folder browser modal state
  const [showFolderBrowser, setShowFolderBrowser] = useState(false);
  const [folderBrowserType, setFolderBrowserType] = useState('source'); // 'source' or 'target'

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

  // Cache for target folder IDs to avoid repeated lookups
  const [targetFolderCache, setTargetFolderCache] = useState({});

  // Function to get target folder ID for a given case ID, with caching
  const getTargetFolderId = async (caseId) => {
    // Check cache first
    if (targetFolderCache[caseId]) {
      console.log(`🧪 Using cached folder ID for case ${caseId}: ${targetFolderCache[caseId]}`);
      return targetFolderCache[caseId];
    }

    try {
      // Look for existing folder in target resource
      const existingFolders = await dsaClient.getAllExistingFolders(config.targetResourceId, config.resourceType || 'collection');
      const targetFolder = existingFolders.find(folder => folder.name === caseId);

      if (targetFolder) {
        // Verify it's in the target resource
        if (targetFolder.parentId === config.targetResourceId) {
          console.log(`🧪 Found existing target folder for case ${caseId}: ${targetFolder._id}`);
          // Cache the result
          setTargetFolderCache(prev => ({ ...prev, [caseId]: targetFolder._id }));
          return targetFolder._id;
        } else {
          console.warn(`⚠️ Folder ${caseId} exists but is in wrong location (parent: ${targetFolder.parentId}, expected: ${config.targetResourceId})`);
        }
      }

      // Create new folder if not found
      console.log(`🧪 Creating new target folder for case ${caseId}`);
      const newFolder = await dsaClient.createFolder(
        config.targetResourceId,
        caseId,
        `BDSA case folder for ${caseId}`,
        config.resourceType || 'collection'
      );

      console.log(`🧪 Created new target folder for case ${caseId}: ${newFolder._id}`);
      // Cache the result
      setTargetFolderCache(prev => ({ ...prev, [caseId]: newFolder._id }));
      return newFolder._id;
    } catch (error) {
      console.error(`❌ Failed to get/create target folder for case ${caseId}:`, error);
      throw error;
    }
  };

  // Function to check if an item with the same name already exists in target folder
  const checkForDuplicate = async (targetFolderId, newName) => {
    try {
      const targetItems = await dsaClient.getResourceItems(targetFolderId, 0, undefined, config.resourceType);
      return targetItems.some(item => item.name === newName);
    } catch (error) {
      console.warn('Failed to check for duplicates:', error);
      return false; // If we can't check, assume no duplicate to avoid blocking the process
    }
  };


  const processDsaItems = (items) => {
    const newModifiedItems = new Set();

    const processedItems = items.map((item, index) => {
      // Extract BDSA metadata from meta.BDSA.bdsaLocal (same as reactAgain app)
      const existingBdsaData = item.meta?.BDSA?.bdsaLocal || {};

      // Check if this item has been modified locally (has _localLastModified)
      const isModified = item._localLastModified || item.BDSA?._lastModified;
      if (isModified) {
        newModifiedItems.add(item._id || item.id);
        console.log(`🔍 Found modified item: ${item._id || item.id}`, {
          _localLastModified: item._localLastModified,
          BDSA_lastModified: item.BDSA?._lastModified,
          isModified
        });
      }

      // Debug: Log what we're extracting for the first few items
      if (index < 3) {
        console.log(`🔍 DEBUG - Extracting BDSA data for item ${index}:`, {
          itemId: item._id || item.id,
          existingBdsaData,
          isModified,
          extractedValues: {
            localCaseId: existingBdsaData.localCaseId || null,
            localStainID: existingBdsaData.localStainID || null,
            localRegionId: existingBdsaData.localRegionId || null,
            bdsaCaseId: existingBdsaData.bdsaCaseId || null,
            bdsaStainProtocol: existingBdsaData.bdsaStainProtocol || [],
            bdsaRegionProtocol: existingBdsaData.bdsaRegionProtocol || []
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
            bdsaCaseId: existingBdsaData.bdsaCaseId || null,
            bdsaStainProtocol: existingBdsaData.bdsaStainProtocol || [],
            bdsaRegionProtocol: existingBdsaData.bdsaRegionProtocol || []
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

    // Update the modified items state
    setModifiedItems(newModifiedItems);
    console.log(`📊 Found ${newModifiedItems.size} modified items out of ${processedItems.length} total items`);

    if (newModifiedItems.size === 0) {
      console.log(`ℹ️ No modified items found. This could mean:`);
      console.log(`   • This is the first sync (no items have been processed before)`);
      console.log(`   • No items have been modified since the last sync`);
      console.log(`   • Check the "Sync All Items" checkbox to sync all items regardless of modification status`);
    }

    return processedItems;
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

      // Debug: Log the first few raw items to see their structure
      console.log(`🔍 DEBUG - Raw items from DSA server (first 3):`, rawItems.slice(0, 3).map(item => ({
        id: item._id || item.id,
        name: item.name,
        hasMeta: !!item.meta,
        hasBDSA: !!item.meta?.BDSA,
        hasBdsaLocal: !!item.meta?.BDSA?.bdsaLocal,
        bdsaLocalKeys: item.meta?.BDSA?.bdsaLocal ? Object.keys(item.meta.BDSA.bdsaLocal) : [],
        _localLastModified: item._localLastModified,
        BDSA_lastModified: item.BDSA?._lastModified
      })));

      // Process items to extract BDSA metadata
      const processedItems = processDsaItems(rawItems);
      setSourceItems(processedItems);

      console.log(`✅ Loaded ${processedItems.length} items from source folder`);
      console.log(`📊 BDSA metadata extracted:`, {
        withCaseId: processedItems.filter(item => item.localCaseId).length,
        withStainId: processedItems.filter(item => item.localStainID).length,
        withRegionId: processedItems.filter(item => item.localRegionId).length,
        withBdsaCaseId: processedItems.filter(item => item.bdsaCaseId).length,
        withStainProtocols: processedItems.filter(item => item.BDSA?.bdsaLocal?.bdsaStainProtocol && item.BDSA.bdsaLocal.bdsaStainProtocol.length > 0).length,
        withRegionProtocols: processedItems.filter(item => item.BDSA?.bdsaLocal?.bdsaRegionProtocol && item.BDSA.bdsaLocal.bdsaRegionProtocol.length > 0).length
      });

      // Debug: Show BDSA structure for first few items with protocols
      const itemsWithProtocols = processedItems.filter(item =>
        (item.BDSA?.bdsaLocal?.bdsaStainProtocol && item.BDSA.bdsaLocal.bdsaStainProtocol.length > 0) ||
        (item.BDSA?.bdsaLocal?.bdsaRegionProtocol && item.BDSA.bdsaLocal.bdsaRegionProtocol.length > 0)
      );
      if (itemsWithProtocols.length > 0) {
        console.log(`🔍 DEBUG - Items with protocols (first 3):`, itemsWithProtocols.slice(0, 3).map(item => ({
          id: item._id || item.id,
          name: item.name,
          BDSA: item.BDSA,
          bdsaStainProtocol: item.BDSA?.bdsaLocal?.bdsaStainProtocol,
          bdsaRegionProtocol: item.BDSA?.bdsaLocal?.bdsaRegionProtocol
        })));
      }
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
        withBdsaCaseId: processedItems.filter(item => item.bdsaCaseId).length,
        withStainProtocols: processedItems.filter(item => item.BDSA?.bdsaLocal?.bdsaStainProtocol && item.BDSA.bdsaLocal.bdsaStainProtocol.length > 0).length,
        withRegionProtocols: processedItems.filter(item => item.BDSA?.bdsaLocal?.bdsaRegionProtocol && item.BDSA.bdsaLocal.bdsaRegionProtocol.length > 0).length
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

      console.log(`🧪 Creating folders in target resource: ${config.targetResourceId}`);
      console.log(`🧪 Folder names to create:`, folderNames);
      console.log(`🧪 Source resource ID: ${config.sourceResourceId}`);
      console.log(`🧪 Target resource ID: ${config.targetResourceId}`);
      console.log(`🧪 Are source and target different? ${config.sourceResourceId !== config.targetResourceId}`);

      const folderMap = await dsaClient.ensureFoldersExist(
        config.targetResourceId,
        folderNames,
        config.resourceType || 'collection'
      );

      console.log(`✅ Batch folder creation completed. Created ${Object.keys(folderMap).length} folders total.`);
      console.log(`🧪 Created folder map:`, folderMap);

      // Convert the folder map to the expected format
      const createdFolders = Object.entries(folderMap).map(([caseId, folder]) => ({
        caseId,
        folderId: folder._id,
        name: folder.name
      }));

      console.log(`✅ Folder structure created:`, { createdFolders });

      // DEBUG: Show detailed folder information
      createdFolders.forEach((folder) => {
        console.log(`🧪 Folder: ${folder.caseId} → ID: ${folder.folderId}, Name: ${folder.name}`);
      });
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

  // Folder browser handlers
  const openFolderBrowser = (type) => {
    setFolderBrowserType(type);
    setShowFolderBrowser(true);
  };

  const closeFolderBrowser = () => {
    setShowFolderBrowser(false);
  };

  const handleResourceSelect = (resource) => {
    console.log('Selected resource:', resource);

    if (folderBrowserType === 'source') {
      handleConfigChange('sourceResourceId', resource._id);
    } else if (folderBrowserType === 'target') {
      handleConfigChange('targetResourceId', resource._id);
    }

    // Also update resource type based on the selected resource
    handleConfigChange('resourceType', resource.type);

    closeFolderBrowser();
  };


  const startSync = async () => {
    console.log('🚀 Start Sync button clicked!');

    if (sourceItems.length === 0) {
      setError('No source items to sync');
      return;
    }

    console.log(`🔄 Starting sync for ${sourceItems.length} source items`);

    setSyncProgress({
      current: 0,
      total: sourceItems.length,
      status: 'running',
    });

    setError('');
    setSyncResult(null);

    // Add a temporary message to show the button was clicked
    setError('Sync started... (check console for details)');

    try {
      const result = {
        success: true,
        message: 'Sync completed successfully',
        processed: 0,
        errors: [],
        createdFolders: [],
        copiedItems: [],
        skippedDuplicates: [],
      };

      // First, create the target folder structure (use existing logic)
      console.log('🏗️ Creating target folder structure...');
      const folderStructure = await createTargetFolderStructure();

      if (!folderStructure) {
        throw new Error('Failed to create folder structure');
      }

      result.createdFolders = folderStructure.createdFolders.map(f => f.name);

      // Create a map of case IDs to folder IDs for quick lookup
      const caseIdToFolderId = {};
      folderStructure.createdFolders.forEach(folder => {
        caseIdToFolderId[folder.caseId] = folder.folderId;
      });

      console.log(`📋 Case ID to Folder ID mapping:`, caseIdToFolderId);

      // Check if this is a first-time sync by looking for existing items in target folders
      let isFirstTimeSync = true;
      try {
        for (const folderId of Object.values(caseIdToFolderId)) {
          const existingItems = await dsaClient.getResourceItems(folderId, 0, undefined, config.resourceType);
          if (existingItems.length > 0) {
            isFirstTimeSync = false;
            break;
          }
        }
      } catch (error) {
        console.warn('Could not check for existing items in target folders:', error);
        // Assume first-time sync if we can't check
      }

      // Auto-enable syncAllItems for first-time syncs
      const shouldSyncAllItems = metadataConfig.syncAllItems || isFirstTimeSync;
      if (isFirstTimeSync && !metadataConfig.syncAllItems) {
        console.log('🆕 First-time sync detected - automatically syncing all items');
      }

      // Process all items
      const itemsToProcess = shouldSyncAllItems ? sourceItems : sourceItems.filter(item => modifiedItems.has(item._id));
      console.log(`🔄 Processing ${itemsToProcess.length} items (${shouldSyncAllItems ? 'all items' : 'modified items only'})`);

      if (itemsToProcess.length === 0) {
        console.log(`⚠️ No items to process! This means:`);
        console.log(`   • Checkbox is unchecked AND no modified items were found`);
        console.log(`   • Try checking "Sync All Items" to process all ${sourceItems.length} items`);
        console.log(`   • Or ensure some items have been modified since last sync`);
      }

      let processedCount = 0;

      // Process each item
      for (const item of itemsToProcess) {
        const bdsaCaseId = item.bdsaCaseId || item.localCaseId || 'unknown';

        // Find the target folder for this case
        const targetFolderId = caseIdToFolderId[bdsaCaseId];
        if (!targetFolderId) {
          console.warn(`⚠️ No target folder found for case ID: ${bdsaCaseId}, skipping item: ${item.name}`);
          continue;
        }

        setSyncProgress(prev => ({
          ...prev,
          current: processedCount + 1,
          currentItem: `${bdsaCaseId}: ${item.name}`,
        }));

        // Generate normalized name
        const newName = generateNormalizedName(item, metadataConfig.bdsaNamingTemplate);
        console.log(`🧪 Generated new name: ${item.name} → ${newName}`);

        // Check for duplicates before copying
        const isDuplicate = await checkForDuplicate(targetFolderId, newName);
        if (isDuplicate) {
          console.log(`⏭️ Skipping duplicate: ${newName} already exists in target folder`);
          result.skippedDuplicates.push(newName);
          continue;
        }

        try {
          // Copy the item to the target folder with the new name
          const copiedItem = await dsaClient.copyItem(item._id, targetFolderId, newName);

          console.log(`✅ Successfully copied: ${item.name} → ${newName}`);

          // Update metadata for the copied item
          const metadataUpdate = {
            BDSA: {
              bdsaLocal: {
                ...item.BDSA?.bdsaLocal,
                lastUpdated: new Date().toISOString(),
                source: 'BDSA-Schema-Wrangler-Sync'
              }
            }
          };

          await dsaClient.updateItem(copiedItem._id, metadataUpdate);
          console.log(`✅ Updated metadata for: ${newName}`);

          result.copiedItems.push({
            originalName: item.name,
            newName: newName,
            caseId: bdsaCaseId,
            targetFolder: caseIdToFolderId[bdsaCaseId]
          });

          processedCount++;
        } catch (error) {
          console.error(`❌ Failed to copy item ${item.name}:`, error);
          result.errors.push(`Failed to copy ${item.name}: ${error.message}`);
        }
      }

      result.processed = processedCount;

      setSyncProgress(prev => ({
        ...prev,
        status: 'completed',
      }));

      setSyncResult(result);
      console.log(`🎉 Sync completed! Processed ${result.processed} items, skipped ${result.skippedDuplicates.length} duplicates`);
    } catch (error) {
      setSyncProgress(prev => ({
        ...prev,
        status: 'error',
        error: error.message,
      }));
      setError(`Sync failed: ${error.message}`);
      console.error('Sync error:', error);
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

      {/* Stats Panel */}
      {sourceItems.length > 0 && (
        <div className="stats-panel">
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-value">{sourceItems.length}</div>
              <div className="stat-label">Total Source Items</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{uniqueBdsaCaseIds.length}</div>
              <div className="stat-label">Unique BDSA Case IDs</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">
                {sourceItems.filter(item => item.bdsaCaseId && item.bdsaCaseId !== 'unknown' && item.bdsaCaseId.trim() !== '').length}
              </div>
              <div className="stat-label">Items with BDSA Case ID</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">
                {sourceItems.filter(item => !item.bdsaCaseId || item.bdsaCaseId === 'unknown' || item.bdsaCaseId.trim() === '').length}
              </div>
              <div className="stat-label">Items Missing BDSA Case ID</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">
                {sourceItems.filter(item => item.BDSA?.bdsaLocal?.bdsaStainProtocol && item.BDSA.bdsaLocal.bdsaStainProtocol.length > 0).length}
              </div>
              <div className="stat-label">Items with Stain Protocols</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">
                {sourceItems.filter(item => item.BDSA?.bdsaLocal?.bdsaRegionProtocol && item.BDSA.bdsaLocal.bdsaRegionProtocol.length > 0).length}
              </div>
              <div className="stat-label">Items with Region Protocols</div>
            </div>
            <div className="stat-item">
              <div className="stat-value" style={{ color: modifiedItems.size > 0 ? '#ff6b35' : '#007bff' }}>
                {modifiedItems.size}
              </div>
              <div className="stat-label">Modified Items (Need Sync)</div>
            </div>
          </div>
        </div>
      )}

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
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={config.sourceResourceId}
                  onChange={(e) => handleConfigChange('sourceResourceId', e.target.value)}
                  placeholder="Source folder or collection ID"
                  disabled={isLoading}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => openFolderBrowser('source')}
                  disabled={isLoading || !authStatus.isAuthenticated}
                  style={{ padding: '8px 12px', fontSize: '12px' }}
                >
                  Browse
                </button>
              </div>
            </label>

            <label>
              Target Folder ID:
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={config.targetResourceId}
                  onChange={(e) => handleConfigChange('targetResourceId', e.target.value)}
                  placeholder="Target folder or collection ID"
                  disabled={isLoading}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => openFolderBrowser('target')}
                  disabled={isLoading || !authStatus.isAuthenticated}
                  style={{ padding: '8px 12px', fontSize: '12px' }}
                >
                  Browse
                </button>
              </div>
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

          <AuthSection
            authStatus={authStatus}
            isLoading={isLoading}
            onAuthenticate={handleAuthenticate}
            onLogout={handleLogout}
            config={config}
          />

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {authStatus.isAuthenticated && (
            <BdsaConfigSection
              metadataConfig={metadataConfig}
              onConfigChange={handleMetadataConfigChange}
              isLoading={isLoading}
            />
          )}

          {authStatus.isAuthenticated && (
            <LargeImageConfigSection
              dsaClient={dsaClient}
              config={config}
              isLoading={isLoading}
              onError={setError}
            />
          )}

          {authStatus.isAuthenticated && (
            <SyncControlsSection
              sourceItems={sourceItems}
              targetItems={targetItems}
              isLoading={isLoading}
              syncProgress={syncProgress}
              onLoadSourceItems={loadSourceItems}
              onLoadTargetItems={loadTargetItems}
              onCreateFolders={createTargetFolderStructure}
              onStartSync={startSync}
            />
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
              {syncResult.skippedDuplicates && syncResult.skippedDuplicates.length > 0 && (
                <div>
                  <p><strong>Skipped Duplicates:</strong> {syncResult.skippedDuplicates.length}</p>
                  <details>
                    <summary>View skipped files</summary>
                    <ul>
                      {syncResult.skippedDuplicates.map((fileName, index) => (
                        <li key={index}>{fileName}</li>
                      ))}
                    </ul>
                  </details>
                </div>
              )}
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
                        <div>Stain Protocols: {item.BDSA?.bdsaLocal?.bdsaStainProtocol && item.BDSA.bdsaLocal.bdsaStainProtocol.length > 0 ? item.BDSA.bdsaLocal.bdsaStainProtocol.join(', ') : 'N/A'}</div>
                        <div>Region Protocols: {item.BDSA?.bdsaLocal?.bdsaRegionProtocol && item.BDSA.bdsaLocal.bdsaRegionProtocol.length > 0 ? item.BDSA.bdsaLocal.bdsaRegionProtocol.join(', ') : 'N/A'}</div>
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

      {/* Debug Modal */}
      {debugInfo && (
        <div className="debug-modal-overlay" onClick={() => setDebugInfo(null)}>
          <div className="debug-modal" onClick={(e) => e.stopPropagation()}>
            <div className="debug-modal-header">
              <h3>🧪 Debug Information: {debugInfo.title}</h3>
              <button
                className="debug-close-btn"
                onClick={() => setDebugInfo(null)}
              >
                ✕
              </button>
            </div>
            <div className="debug-modal-content">
              <pre className="debug-json">
                {JSON.stringify(debugInfo.data, null, 2)}
              </pre>
              <div className="debug-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(debugInfo.data, null, 2));
                    alert('Debug info copied to clipboard!');
                  }}
                >
                  Copy to Clipboard
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => setDebugInfo(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DSA Folder Browser Modal */}
      <DSAFolderBrowserModal
        isOpen={showFolderBrowser}
        onClose={closeFolderBrowser}
        dsaClient={dsaClient}
        onSelectResource={handleResourceSelect}
        title={`Select ${folderBrowserType === 'source' ? 'Source' : 'Target'} Resource`}
      />
    </div>
  );
};

export default App;