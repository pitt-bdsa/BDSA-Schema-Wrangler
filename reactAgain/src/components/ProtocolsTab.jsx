import React, { useState, useEffect } from 'react';
import ProtocolList from './ProtocolList';
import ProtocolModal from './ProtocolModal';
import protocolStore from '../utils/protocolStore';
import schemaValidator from '../utils/schemaValidator';
import './ProtocolsTab.css';

const ProtocolsTab = () => {
    const [activeSubTab, setActiveSubTab] = useState('stain');
    const [showModal, setShowModal] = useState(false);
    const [editingProtocol, setEditingProtocol] = useState(null);
    const [protocols, setProtocols] = useState({
        stain: protocolStore.stainProtocols,
        region: protocolStore.regionProtocols
    });

    useEffect(() => {
        // Load schemas for validation
        schemaValidator.loadSchemas();

        // Subscribe to protocol store changes
        const unsubscribe = protocolStore.subscribe(() => {
            setProtocols({
                stain: protocolStore.stainProtocols,
                region: protocolStore.regionProtocols
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
        // TODO: Implement DSA sync
        console.log('DSA sync not yet implemented');
    };

    const currentProtocols = activeSubTab === 'stain' ? protocols.stain : protocols.region;

    return (
        <div className="protocols-tab">
            <div className="protocols-header">
                <div className="header-content">
                    <h2>Protocols</h2>
                    <p>Manage stain and region protocols for BDSA schema compliance</p>
                </div>
                <div className="header-actions">
                    <button
                        className="sync-button"
                        onClick={handleSyncWithDSA}
                        title="Sync with DSA server (coming soon)"
                    >
                        🔄 Sync with DSA
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
