import React, { useState, useEffect, useCallback } from 'react';
import ProtocolList from './ProtocolList';
import ProtocolModal from './ProtocolModal';
import SectioningProtocolsPanel from './SectioningProtocolsPanel';
import protocolStore from '../utils/protocolStore';
import schemaValidator from '../utils/schemaValidator';
import dsaAuthStore from '../utils/dsaAuthStore';
import bdsaCatalogService from '../utils/bdsaCatalogService';
import './ProtocolsTab.css';

const ProtocolsTab = ({ embedded = false, onCatalogChanged }) => {
    const [activeSubTab, setActiveSubTab] = useState('stain');
    const [showModal, setShowModal] = useState(false);
    const [editingProtocol, setEditingProtocol] = useState(null);
    const [protocols, setProtocols] = useState({
        stain: embedded ? [] : protocolStore.stainProtocols,
        region: embedded ? [] : protocolStore.regionProtocols
    });
    const [typeOptions, setTypeOptions] = useState({ stain: [], region: [] });
    const [catalogError, setCatalogError] = useState('');
    const [isLoadingCatalog, setIsLoadingCatalog] = useState(embedded);
    const [syncStatus, setSyncStatus] = useState({
        lastSync: protocolStore.lastSync,
        hasLocalChanges: false
    });
    const [isSyncing, setIsSyncing] = useState(false);

    const notifyHost = useCallback(() => {
        if (typeof onCatalogChanged === 'function') {
            onCatalogChanged();
        }
    }, [onCatalogChanged]);

    const loadCatalog = useCallback(async () => {
        if (!embedded) return;
        setIsLoadingCatalog(true);
        setCatalogError('');
        try {
            const schemas = await bdsaCatalogService.loadSchemas();
            const { stain, region } = await bdsaCatalogService.refreshProtocols();
            setTypeOptions({
                stain: schemas.stainOptions,
                region: schemas.regionOptions
            });
            setProtocols({ stain, region });
        } catch (error) {
            setCatalogError(error.message || 'Failed to load catalog from this DSA node');
        } finally {
            setIsLoadingCatalog(false);
        }
    }, [embedded]);

    useEffect(() => {
        const loadSchemas = async () => {
            await schemaValidator.loadSchemas();
        };
        loadSchemas();

        if (embedded) {
            loadCatalog();
            return undefined;
        }

        const unsubscribe = protocolStore.subscribe(() => {
            setProtocols({
                stain: protocolStore.stainProtocols,
                region: protocolStore.regionProtocols
            });
            setSyncStatus({
                lastSync: protocolStore.lastSync,
                hasLocalChanges: protocolStore.getModifiedProtocols().stain.length > 0 ||
                    protocolStore.getModifiedProtocols().region.length > 0
            });
        });

        return unsubscribe;
    }, [embedded, loadCatalog]);

    const handleAddProtocol = () => {
        setEditingProtocol(null);
        setShowModal(true);
    };

    const handleEditProtocol = (protocol) => {
        setEditingProtocol(protocol);
        setShowModal(true);
    };

    const handleDeleteProtocol = async (id, type) => {
        if (!window.confirm('Are you sure you want to delete this protocol?')) {
            return;
        }

        if (embedded) {
            try {
                if (type === 'stain') {
                    await bdsaCatalogService.deleteStainProtocol(id);
                } else {
                    await bdsaCatalogService.deleteRegionProtocol(id);
                }
                notifyHost();
                await loadCatalog();
            } catch (error) {
                alert(error.message || 'Failed to delete protocol');
            }
            return;
        }

        if (type === 'stain') {
            protocolStore.deleteStainProtocol(id);
        } else {
            protocolStore.deleteRegionProtocol(id);
        }
        await handleAutoSyncToDSA();
    };

    const handleSaveProtocol = async (protocolData) => {
        if (embedded) {
            if (activeSubTab === 'stain') {
                await bdsaCatalogService.saveStainProtocol(protocolData, editingProtocol?.id);
            } else {
                await bdsaCatalogService.saveRegionProtocol(protocolData, editingProtocol?.id);
            }
            notifyHost();
            await loadCatalog();
            setShowModal(false);
            setEditingProtocol(null);
            return;
        }

        if (editingProtocol) {
            if (activeSubTab === 'stain') {
                protocolStore.updateStainProtocol(editingProtocol.id, protocolData);
            } else {
                protocolStore.updateRegionProtocol(editingProtocol.id, protocolData);
            }
        } else if (activeSubTab === 'stain') {
            protocolStore.addStainProtocol(protocolData);
        } else {
            protocolStore.addRegionProtocol(protocolData);
        }

        await handleAutoSyncToDSA();
        setShowModal(false);
        setEditingProtocol(null);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingProtocol(null);
    };

    const handleAutoSyncToDSA = async () => {
        const authStatus = dsaAuthStore.getStatus();

        if (!authStatus.isAuthenticated || !authStatus.isConfigured || authStatus.hostImported) {
            return;
        }

        try {
            const config = dsaAuthStore.getConfig();
            const dsaConfig = {
                baseUrl: config.baseUrl,
                resourceId: config.resourceId,
                metadataSyncTargetFolder: config.metadataSyncTargetFolder,
                token: dsaAuthStore.getToken()
            };
            await protocolStore.syncWithDSA(dsaConfig);
        } catch (error) {
            console.warn('Auto-sync error:', error.message);
        }
    };

    const handleSyncWithDSA = async () => {
        const authStatus = dsaAuthStore.getStatus();

        if (!authStatus.isAuthenticated) {
            alert('Please login to DSA server first');
            return;
        }

        if (!authStatus.isConfigured) {
            alert('Please configure DSA server first');
            return;
        }

        setIsSyncing(true);
        try {
            await dsaAuthStore.testConnection();
            const config = dsaAuthStore.getConfig();
            const dsaConfig = {
                baseUrl: config.baseUrl,
                resourceId: config.resourceId,
                metadataSyncTargetFolder: config.metadataSyncTargetFolder,
                token: dsaAuthStore.getToken()
            };
            const result = await protocolStore.syncWithDSA(dsaConfig);
            if (result.success) {
                alert(`Protocols synced successfully!\n\nPushed:\n- ${result.pushed.stainProtocols} stain protocols\n- ${result.pushed.regionProtocols} region protocols`);
            } else {
                alert(`Sync failed: ${result.error}`);
            }
        } catch (error) {
            alert(`DSA sync failed: ${error.message}`);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleClearProtocols = () => {
        const confirmMessage = `Are you sure you want to clear all protocols?\n\nThis will remove:\n- ${protocols.stain.length} stain protocols\n- ${protocols.region.length} region protocols\n\nThis action cannot be undone.`;
        if (window.confirm(confirmMessage)) {
            protocolStore.resetToDefaults();
        }
    };

    const handlePullFromDSA = async () => {
        const authStatus = dsaAuthStore.getStatus();

        if (!authStatus.isAuthenticated) {
            alert('Please login to DSA server first');
            return;
        }

        if (!authStatus.isConfigured) {
            alert('Please configure DSA server first');
            return;
        }

        setIsSyncing(true);
        try {
            await dsaAuthStore.testConnection();
            const config = dsaAuthStore.getConfig();
            const dsaConfig = {
                baseUrl: config.baseUrl,
                resourceId: config.resourceId,
                metadataSyncTargetFolder: config.metadataSyncTargetFolder,
                token: dsaAuthStore.getToken()
            };
            if (!window.confirm('This will overwrite your local protocols with the versions from the DSA server. Continue?')) {
                return;
            }
            const result = await protocolStore.pullFromDSA(dsaConfig);
            if (result.success) {
                if (result.pulled.stainProtocols > 0 || result.pulled.regionProtocols > 0) {
                    alert(`Protocols pulled successfully!\n\nPulled:\n- ${result.pulled.stainProtocols} stain protocols\n- ${result.pulled.regionProtocols} region protocols`);
                } else {
                    alert('No protocols found in DSA folder metadata.');
                }
            } else {
                alert(`Pull failed: ${result.error}`);
            }
        } catch (error) {
            alert(`DSA pull failed: ${error.message}`);
        } finally {
            setIsSyncing(false);
        }
    };

    const currentProtocols = activeSubTab === 'stain' ? protocols.stain : protocols.region;
    const currentTypeOptions = activeSubTab === 'stain' ? typeOptions.stain : typeOptions.region;

    return (
        <div className="protocols-tab">
            <div className="protocols-header">
                <div className="header-content">
                    <h2>Protocols</h2>
                    <p>
                        {embedded
                            ? 'Stain and region definitions are catalogs. A sectioning protocol is the blocking recipe: it owns blocks, and each block lists which regions were sampled.'
                            : 'Manage stain and region protocols for BDSA schema compliance'}
                    </p>
                    {!embedded && (
                        <div className="sync-status">
                            {syncStatus.lastSync && (
                                <span className="last-sync">
                                    Last sync: {syncStatus.lastSync.toLocaleString()}
                                </span>
                            )}
                            {syncStatus.hasLocalChanges && (
                                <span className="local-changes">
                                    Local changes pending
                                </span>
                            )}
                        </div>
                    )}
                    {embedded && catalogError && (
                        <div className="local-changes">{catalogError}</div>
                    )}
                </div>
                <div className="header-actions">
                    {embedded ? (
                        <button
                            className="sync-button"
                            onClick={loadCatalog}
                            disabled={isLoadingCatalog}
                            title="Reload catalog from this DSA node"
                        >
                            {isLoadingCatalog ? 'Loading…' : 'Refresh'}
                        </button>
                    ) : (
                        <>
                            <button
                                className="sync-button"
                                onClick={handlePullFromDSA}
                                disabled={isSyncing}
                                title="Pull protocols from DSA server"
                            >
                                {isSyncing ? '⏳' : '⬇️'} Pull from DSA
                            </button>
                            <button
                                className={`sync-button ${syncStatus.hasLocalChanges ? 'has-changes' : ''}`}
                                onClick={handleSyncWithDSA}
                                disabled={isSyncing}
                                title="Push protocols to DSA server"
                            >
                                {isSyncing ? '⏳' : '🔄'} Push to DSA
                                {syncStatus.hasLocalChanges && !isSyncing && <span className="change-indicator">●</span>}
                            </button>
                            <button
                                className="sync-button clear-button"
                                onClick={handleClearProtocols}
                                disabled={isSyncing}
                                title="Clear all protocols and reset to defaults"
                            >
                                🧹 Clear Protocols
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="protocols-navigation">
                <button
                    className={`nav-button ${activeSubTab === 'stain' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('stain')}
                >
                    {embedded ? 'Stain Definitions' : 'Stain Protocols'} ({protocols.stain.length})
                </button>
                <button
                    className={`nav-button ${activeSubTab === 'region' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('region')}
                >
                    {embedded ? 'Region Definitions' : 'Region Protocols'} ({protocols.region.length})
                </button>
                {embedded && (
                    <button
                        className={`nav-button ${activeSubTab === 'blocks' ? 'active' : ''}`}
                        onClick={() => setActiveSubTab('blocks')}
                    >
                        Sectioning Protocols
                    </button>
                )}
            </div>

            <div className="protocols-content">
                {activeSubTab === 'blocks' && embedded ? (
                    <SectioningProtocolsPanel
                        regionTemplates={protocols.region.filter((protocol) => protocol.id !== 'ignore')}
                        onCatalogChanged={notifyHost}
                    />
                ) : (
                    <ProtocolList
                        protocols={currentProtocols}
                        type={activeSubTab}
                        onEdit={handleEditProtocol}
                        onDelete={handleDeleteProtocol}
                        onAdd={handleAddProtocol}
                        embedded={embedded}
                    />
                )}
            </div>

            {showModal && activeSubTab !== 'blocks' && (
                <ProtocolModal
                    protocol={editingProtocol}
                    type={activeSubTab}
                    onSave={handleSaveProtocol}
                    onClose={handleCloseModal}
                    embedded={embedded}
                    typeOptions={embedded ? currentTypeOptions : null}
                />
            )}
        </div>
    );
};

export default ProtocolsTab;
