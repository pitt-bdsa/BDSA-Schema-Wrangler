import React, { useState, useEffect } from 'react';
import ProtocolList from './ProtocolList';
import ProtocolModal from './ProtocolModal';
import protocolStore from '../utils/protocolStore';
import schemaValidator from '../utils/schemaValidator';
import dsaAuthStore from '../utils/dsaAuthStore';
import './ProtocolsTab.css';

const ProtocolsTab = () => {
    const [activeSubTab, setActiveSubTab] = useState('stain');
    const [showModal, setShowModal] = useState(false);
    const [editingProtocol, setEditingProtocol] = useState(null);
    const [protocols, setProtocols] = useState({
        stain: protocolStore.stainProtocols,
        region: protocolStore.regionProtocols
    });
    const [syncStatus, setSyncStatus] = useState({
        lastSync: protocolStore.lastSync,
        hasLocalChanges: false
    });
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        // Load schemas for validation
        const loadSchemas = async () => {
            await schemaValidator.loadSchemas();
        };
        loadSchemas();

        // Subscribe to protocol store changes
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
    }, []);

    const handleAddProtocol = () => {
        setEditingProtocol(null);
        setShowModal(true);
    };

    const handleEditProtocol = (protocol) => {
        setEditingProtocol(protocol);
        setShowModal(true);
    };

    const handleDeleteProtocol = (id, type) => {
        if (window.confirm('Are you sure you want to delete this protocol?')) {
            if (type === 'stain') {
                protocolStore.deleteStainProtocol(id);
            } else {
                protocolStore.deleteRegionProtocol(id);
            }
        }
    };

    const handleSaveProtocol = (protocolData) => {
        if (editingProtocol) {
            // Update existing protocol
            if (activeSubTab === 'stain') {
                protocolStore.updateStainProtocol(editingProtocol.id, protocolData);
            } else {
                protocolStore.updateRegionProtocol(editingProtocol.id, protocolData);
            }
        } else {
            // Add new protocol
            if (activeSubTab === 'stain') {
                protocolStore.addStainProtocol(protocolData);
            } else {
                protocolStore.addRegionProtocol(protocolData);
            }
        }
        setShowModal(false);
        setEditingProtocol(null);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingProtocol(null);
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
            // Test connection first
            await dsaAuthStore.testConnection();

            // Get DSA configuration
            const config = dsaAuthStore.getConfig();
            const dsaConfig = {
                baseUrl: config.baseUrl,
                resourceId: config.resourceId,
                token: dsaAuthStore.getToken()
            };

            // Sync protocols to DSA folder
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
            console.log('🧹 Cleared all protocols and reset to defaults');
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
            // Test connection first
            await dsaAuthStore.testConnection();

            // Get DSA configuration
            const config = dsaAuthStore.getConfig();
            const dsaConfig = {
                baseUrl: config.baseUrl,
                resourceId: config.resourceId,
                token: dsaAuthStore.getToken()
            };

            // Confirm before overwriting local protocols
            const confirmMessage = 'This will overwrite your local protocols with the versions from the DSA server. Continue?';
            if (!window.confirm(confirmMessage)) {
                return;
            }

            // Pull protocols from DSA folder
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

    return (
        <div className="protocols-tab">
            <div className="protocols-header">
                <div className="header-content">
                    <h2>Protocols</h2>
                    <p>Manage stain and region protocols for BDSA schema compliance</p>
                    <div className="sync-status">
                        {syncStatus.lastSync && (
                            <span className="last-sync">
                                Last sync: {syncStatus.lastSync.toLocaleString()}
                            </span>
                        )}
                        {syncStatus.hasLocalChanges && (
                            <span className="local-changes">
                                ⚠️ Local changes pending
                            </span>
                        )}
                    </div>
                </div>
                <div className="header-actions">
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
                </div>
            </div>

            <div className="protocols-navigation">
                <button
                    className={`nav-button ${activeSubTab === 'stain' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('stain')}
                >
                    Stain Protocols ({protocols.stain.length})
                </button>
                <button
                    className={`nav-button ${activeSubTab === 'region' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('region')}
                >
                    Region Protocols ({protocols.region.length})
                </button>
            </div>

            <div className="protocols-content">
                <ProtocolList
                    protocols={currentProtocols}
                    type={activeSubTab}
                    onEdit={handleEditProtocol}
                    onDelete={handleDeleteProtocol}
                    onAdd={handleAddProtocol}
                />
            </div>

            {showModal && (
                <ProtocolModal
                    protocol={editingProtocol}
                    type={activeSubTab}
                    onSave={handleSaveProtocol}
                    onClose={handleCloseModal}
                />
            )}
        </div>
    );
};

export default ProtocolsTab;
