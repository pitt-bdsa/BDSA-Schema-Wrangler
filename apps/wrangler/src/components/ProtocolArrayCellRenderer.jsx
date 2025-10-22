import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import protocolStore from '../utils/protocolStore';
import dataStore from '../utils/dataStore';
import './ProtocolArrayCellRenderer.css';

const ProtocolArrayCellRenderer = ({ value, data, colDef, api }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [protocols, setProtocols] = useState([]);
    const [availableProtocols, setAvailableProtocols] = useState([]);

    // Initialize protocols from the cell value
    React.useEffect(() => {
        if (value) {
            const protocolArray = Array.isArray(value)
                ? value
                : (typeof value === 'string' ? value.split(',').map(p => p.trim()).filter(p => p) : []);
            setProtocols(protocolArray);
        } else {
            setProtocols([]);
        }
    }, [value]);

    // Load available protocols
    React.useEffect(() => {
        const protocolType = colDef.field.includes('Stain') ? 'stain' : 'region';
        const available = protocolType === 'stain' ? protocolStore.stainProtocols : protocolStore.regionProtocols;
        setAvailableProtocols(available || []);
    }, [colDef.field]);

    const handleCellClick = () => {
        setIsEditing(true);
    };

    const handleAddProtocol = (protocolName) => {
        if (!protocols.includes(protocolName)) {
            const newProtocols = [...protocols, protocolName];
            setProtocols(newProtocols);
            updateCellValue(newProtocols);
        }
    };

    const handleRemoveProtocol = (protocolName) => {
        const newProtocols = protocols.filter(p => p !== protocolName);
        setProtocols(newProtocols);
        updateCellValue(newProtocols);
    };

    const updateCellValue = (newProtocols) => {
        // Update the data directly (for immediate UI feedback)
        const fieldName = colDef.field.replace('BDSA.bdsaLocal.', '');
        if (!data.BDSA) {
            data.BDSA = {};
        }
        if (!data.BDSA.bdsaLocal) {
            data.BDSA.bdsaLocal = {};
        }
        data.BDSA.bdsaLocal[fieldName] = newProtocols;
        data.BDSA._lastModified = new Date().toISOString();

        // Also update the dataStore to ensure persistence
        const protocolType = fieldName.includes('Stain') ? 'stain' : 'region';
        const bdsaCaseId = data.BDSA?.bdsaLocal?.bdsaCaseId;
        const slideId = data.id || data._id || data.dsa_id;

        if (bdsaCaseId && slideId) {
            // Use the dataStore's protocol mapping methods for proper persistence
            const currentProtocols = data.BDSA.bdsaLocal[fieldName] || [];
            const previousProtocols = value ? (Array.isArray(value) ? value : value.split(',').map(p => p.trim()).filter(p => p)) : [];

            // Find protocols that were added or removed
            const addedProtocols = newProtocols.filter(p => !previousProtocols.includes(p));
            const removedProtocols = previousProtocols.filter(p => !newProtocols.includes(p));

            // Add new protocols
            addedProtocols.forEach(protocol => {
                dataStore.addProtocolMapping(bdsaCaseId, slideId, protocol, protocolType, true); // batch mode
            });

            // Remove protocols
            removedProtocols.forEach(protocol => {
                dataStore.removeProtocolMapping(bdsaCaseId, slideId, protocol, protocolType);
            });
        }

        // Mark as modified (with fallback ID fields for safety)
        const itemId = data.id || data._id || data.dsa_id;
        if (itemId) {
            dataStore.modifiedItems.add(itemId);
            console.log(`🔍 Protocol updated for item ${itemId}. Total modified: ${dataStore.modifiedItems.size}`);
        } else {
            console.error(`❌ Cannot mark item as modified - no valid ID found:`, data);
        }

        // Notify listeners to update UI
        dataStore.notify();
    };

    const handleClose = () => {
        setIsEditing(false);
        // Now notify data store that changes have been made
        dataStore.notify();
        // Refresh the grid when modal closes to show updated data
        api.refreshCells({ rowNodes: [api.getRowNode(data.id)] });
    };

    const modalContent = isEditing && (
        <div className="protocol-edit-modal-overlay">
            <div className="protocol-edit-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Edit Protocols</h3>
                    <button className="close-btn" onClick={handleClose}>×</button>
                </div>
                <div className="modal-content">
                    <div className="current-protocols">
                        <h4>Current Protocols:</h4>
                        <div className="protocol-tags">
                            {protocols.map((protocol, index) => (
                                <span key={index} className="protocol-tag">
                                    {protocol}
                                    <button
                                        className="remove-btn"
                                        onClick={() => handleRemoveProtocol(protocol)}
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className="available-protocols">
                        <h4>Add Protocol:</h4>
                        <div className="protocol-buttons">
                            {availableProtocols
                                .filter(protocol => !protocols.includes(protocol.name))
                                .map(protocol => (
                                    <button
                                        key={protocol.id}
                                        className="add-protocol-btn"
                                        onClick={() => handleAddProtocol(protocol.name)}
                                    >
                                        + {protocol.name}
                                    </button>
                                ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <>
            <div className="protocol-cell-renderer clickable" onClick={handleCellClick}>
                {protocols.length > 0 ? (
                    protocols.map((protocol, index) => (
                        <span key={index} className="protocol-chip">
                            {protocol}
                        </span>
                    ))
                ) : (
                    <span className="no-protocols">Click to add protocols</span>
                )}
            </div>

            {isEditing && createPortal(modalContent, document.body)}
        </>
    );
};

export default ProtocolArrayCellRenderer;
