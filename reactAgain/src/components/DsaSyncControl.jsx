import React, { useState, useEffect } from 'react';
import { syncBdsaMetadataToServer, cancelDsaMetadataSync, getSyncStatus, subscribeToSyncEvents, getDataStoreSnapshot, DATA_CHANGE_EVENTS } from '../utils/dataStore';
import dsaAuthStore from '../utils/dsaAuthStore';
import './DsaSyncControl.css';

const DsaSyncControl = () => {
    const [syncState, setSyncState] = useState({
        inProgress: false,
        status: 'offline',
        progress: null,
        lastResults: null
    });
    const [dataStore, setDataStore] = useState(null);
    const [authStatus, setAuthStatus] = useState(dsaAuthStore.getStatus());

    useEffect(() => {
        // Subscribe to sync events only (separate from main data store events)
        const unsubscribe = subscribeToSyncEvents((event) => {
            console.log('DsaSyncControl received sync event:', event.eventType);

            // Get the latest data store snapshot
            const latestDataStore = event.dataStore || getDataStoreSnapshot();
            setDataStore(latestDataStore);

            // Update sync state - all events from subscribeToSyncEvents are sync-related
            const newSyncState = getSyncStatus();
            setSyncState(newSyncState);
        });

        // Subscribe to auth store changes
        const unsubscribeAuth = dsaAuthStore.subscribe(() => {
            setAuthStatus(dsaAuthStore.getStatus());
        });

        // Initialize with current data store state
        const initialDataStore = getDataStoreSnapshot();
        console.log('DsaSyncControl initial data store:', initialDataStore);
        setDataStore(initialDataStore);
        setSyncState(getSyncStatus());

        return () => {
            unsubscribe();
            unsubscribeAuth();
        };
    }, []);

    const handleStartSync = async () => {
        try {
            console.log('Starting DSA metadata sync...');
            await syncBdsaMetadataToServer((progress) => {
                console.log('Sync progress:', progress);
            });
        } catch (error) {
            console.error('Sync failed:', error);
            alert(`Sync failed: ${error.message}`);
        }
    };

    const handleCancelSync = () => {
        console.log('Cancelling DSA metadata sync...');
        cancelDsaMetadataSync();
    };

    const canStartSync = dataStore?.dataSource === 'dsa' &&
        authStatus.isAuthenticated &&
        authStatus.isConfigured &&
        !syncState.inProgress &&
        dataStore?.processedData?.length > 0;

    // Debug logging
    console.log('DSA Sync Debug:', {
        currentDataSource: dataStore?.dataSource,
        isAuthenticated: authStatus.isAuthenticated,
        isConfigured: authStatus.isConfigured,
        hasToken: authStatus.hasToken,
        hasConfig: authStatus.hasConfig,
        processedDataLength: dataStore?.processedData?.length || 0,
        syncInProgress: syncState.inProgress,
        canStartSync,
        authStatus,
        dataStore: dataStore
    });

    const getStatusDisplay = () => {
        switch (syncState.status) {
            case 'offline': return { text: 'Not Connected', className: 'status-offline' };
            case 'syncing': return { text: 'Syncing...', className: 'status-syncing' };
            case 'synced': return { text: 'Synced', className: 'status-synced' };
            case 'error': return { text: 'Error', className: 'status-error' };
            default: return { text: 'Unknown', className: 'status-unknown' };
        }
    };

    const statusDisplay = getStatusDisplay();

    return (
        <div className="dsa-sync-control">
            <div className="sync-header">
                <h3>🔄 DSA Metadata Sync</h3>
                <div className={`sync-status ${statusDisplay.className}`}>
                    {statusDisplay.text}
                </div>
            </div>

            <div className="sync-info">
                <p>Sync BDSA metadata (localCaseId, localStainID, localRegionId) to DSA server as <code>bdsaLocal</code> field.</p>

                {dataStore?.processedData?.length > 0 && (
                    <div className="sync-stats">
                        <span>📊 {dataStore.processedData.length} items ready to sync</span>
                    </div>
                )}
            </div>

            {syncState.progress && (
                <div className="sync-progress">
                    <div className="progress-bar">
                        <div
                            className="progress-fill"
                            style={{ width: `${syncState.progress.percentage || 0}%` }}
                        ></div>
                    </div>
                    <div className="progress-text">
                        {syncState.progress.processed} / {syncState.progress.total} items
                        ({syncState.progress.percentage || 0}%)
                    </div>
                    <div className="progress-details">
                        ✅ {syncState.progress.success} success |
                        ❌ {syncState.progress.errors} errors |
                        ⏭️ {syncState.progress.skipped} skipped
                    </div>
                </div>
            )}

            {syncState.lastResults && (
                <div className="sync-results">
                    <h4>Last Sync Results:</h4>
                    <div className="results-summary">
                        <span>Total: {syncState.lastResults.totalItems}</span>
                        <span>Success: {syncState.lastResults.success}</span>
                        <span>Errors: {syncState.lastResults.errors}</span>
                        <span>Skipped: {syncState.lastResults.skipped}</span>
                    </div>
                    {syncState.lastResults.error && (
                        <div className="error-message">
                            ❌ {syncState.lastResults.error}
                        </div>
                    )}
                </div>
            )}

            <div className="sync-controls">
                {syncState.inProgress ? (
                    <button
                        className="cancel-sync-btn"
                        onClick={handleCancelSync}
                    >
                        Cancel Sync
                    </button>
                ) : (
                    <button
                        className="start-sync-btn"
                        onClick={handleStartSync}
                        disabled={!canStartSync}
                        title={!canStartSync ? 'DSA data source, authentication, and data required' : 'Start syncing metadata to DSA server'}
                    >
                        Sync to DSA Server
                    </button>
                )}
            </div>

            {!canStartSync && (
                <div className="sync-requirements">
                    <h4>Requirements for sync:</h4>
                    <ul>
                        <li className={dataStore?.dataSource === 'dsa' ? 'requirement-met' : 'requirement-missing'}>
                            DSA data source selected
                        </li>
                        <li className={authStatus.isAuthenticated ? 'requirement-met' : 'requirement-missing'}>
                            DSA authentication (Girder token)
                        </li>
                        <li className={authStatus.isConfigured ? 'requirement-met' : 'requirement-missing'}>
                            DSA configuration
                        </li>
                        <li className={dataStore?.processedData?.length > 0 ? 'requirement-met' : 'requirement-missing'}>
                            Data loaded ({dataStore?.processedData?.length || 0} items)
                        </li>
                    </ul>
                </div>
            )}
        </div>
    );
};

export default DsaSyncControl;
