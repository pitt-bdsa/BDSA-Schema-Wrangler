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
        // Update the data
        const fieldName = colDef.field.replace('BDSA.bdsaLocal.', '');
        if (!data.BDSA) {
            data.BDSA = {};
        }
        if (!data.BDSA.bdsaLocal) {
            data.BDSA.bdsaLocal = {};
        }
        data.BDSA.bdsaLocal[fieldName] = newProtocols;

        // Mark as modified
        dataStore.modifiedItems.add(data.id);
        dataStore.saveToStorage();
        dataStore.notify();

        // Don't refresh the grid while modal is open - it will refresh when modal closes
    };

    const handleClose = () => {
        setIsEditing(false);
        // Refresh the grid when modal closes to show updated data
        api.refreshCells({ rowNodes: [api.getRowNode(data.id)] });
    };

    const modalContent = isEditing && (
        <div className="protocol-edit-modal-overlay" onClick={handleClose}>
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
