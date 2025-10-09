import React from 'react';
import './ProtocolList.css';
import protocolStore from '../utils/protocolStore';

const ProtocolList = ({ protocols, type, onEdit, onDelete, onAdd }) => {
    const renderProtocolDetails = (protocol) => {
        if (type === 'stain') {
            return (
                <div className="protocol-details">
                    <p><strong>Description:</strong> {protocol.description || 'No description'}</p>
                    {protocol.stainType && protocol.stainType !== 'ignore' && (
                        <p><strong>Stain Type:</strong> {protocol.stainType}</p>
                    )}
                    {protocol.antibody && (
                        <p><strong>Antibody:</strong> {protocol.antibody}</p>
                    )}
                    {protocol.technique && (
                        <p><strong>Technique:</strong> {protocol.technique}</p>
                    )}
                    {protocol.phosphoSpecific && (
                        <p><strong>Phospho-specific:</strong> {protocol.phosphoSpecific}</p>
                    )}
                    {protocol.dilution && (
                        <p><strong>Dilution:</strong> {protocol.dilution}</p>
                    )}
                    {protocol.vendor && (
                        <p><strong>Vendor:</strong> {protocol.vendor}</p>
                    )}
                </div>
            );
        } else {
            return (
                <div className="protocol-details">
                    <p><strong>Description:</strong> {protocol.description || 'No description'}</p>
                    {protocol.regionType && protocol.regionType !== 'ignore' && (
                        <p><strong>Region Type:</strong> {protocol.regionType}</p>
                    )}
                    {protocol.subRegion && (
                        <p><strong>Sub-Region:</strong> {protocol.subRegion}</p>
                    )}
                    {protocol.landmarks && protocol.landmarks.length > 0 && (
                        <p><strong>Landmarks:</strong> {protocol.landmarks.join(', ')}</p>
                    )}
                    {protocol.hemisphere && (
                        <p><strong>Hemisphere:</strong> {protocol.hemisphere}</p>
                    )}
                    {protocol.sliceOrientation && (
                        <p><strong>Slice Orientation:</strong> {protocol.sliceOrientation}</p>
                    )}
                    {protocol.damage && protocol.damage.length > 0 && (
                        <p><strong>Damage:</strong> {protocol.damage.join(', ')}</p>
                    )}
                </div>
            );
        }
    };

    const getProtocolStatus = (protocol) => {
        if (protocol._localModified) {
            return { status: 'modified', label: 'Modified', className: 'status-modified' };
        }
        if (protocol._remoteVersion) {
            return { status: 'synced', label: 'Synced', className: 'status-synced' };
        }
        return { status: 'local', label: 'Local', className: 'status-local' };
    };

    const isProtocolApproved = (protocol) => {
        if (type === 'stain') {
            return protocolStore.isStainProtocolApproved(protocol.id);
        } else {
            return protocolStore.isRegionProtocolApproved(protocol.id);
        }
    };

    const handleAssociationToggle = (protocol) => {
        const isApproved = isProtocolApproved(protocol);

        if (isApproved) {
            if (type === 'stain') {
                protocolStore.disassociateStainProtocol(protocol.id);
            } else {
                protocolStore.disassociateRegionProtocol(protocol.id);
            }
        } else {
            if (type === 'stain') {
                protocolStore.associateStainProtocol(protocol.id);
            } else {
                protocolStore.associateRegionProtocol(protocol.id);
            }
        }
    };

    return (
        <div className="protocol-list">
            <div className="protocol-list-header">
                <h3>{type === 'stain' ? 'Stain' : 'Region'} Protocols</h3>
                <p>
                    {type === 'stain'
                        ? 'Define staining protocols for different tissue types and targets.'
                        : 'Define region protocols for different brain regions and anatomical landmarks.'
                    }
                </p>
            </div>

            <div className="protocols-grid">
                {protocols.map(protocol => {
                    const status = getProtocolStatus(protocol);
                    const isApproved = isProtocolApproved(protocol);
                    return (
                        <div key={protocol.id} className={`protocol-card ${isApproved ? 'approved' : 'not-approved'}`}>
                            <div className="protocol-header">
                                <div className="protocol-title">
                                    <h4>{protocol.name}</h4>
                                    <div className="protocol-badges">
                                        <span className={`status-badge ${status.className}`}>
                                            {status.label}
                                        </span>
                                        {protocol.id !== 'ignore' && (
                                            <span className={`association-badge ${isApproved ? 'approved' : 'not-approved'}`}>
                                                {isApproved ? '✅ Approved' : '⚠️ Not associated'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="protocol-actions">
                                    {protocol.id !== 'ignore' && (
                                        <>
                                            <button
                                                className={`association-button ${isApproved ? 'disassociate' : 'associate'}`}
                                                onClick={() => handleAssociationToggle(protocol)}
                                                title={isApproved ? 'Remove from this collection' : 'Associate with this collection'}
                                            >
                                                {isApproved ? '➖' : '➕'}
                                            </button>
                                            <button
                                                className="edit-button"
                                                onClick={() => onEdit(protocol)}
                                                title="Edit protocol"
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                className="delete-button"
                                                onClick={() => onDelete(protocol.id, type)}
                                                title="Delete protocol"
                                            >
                                                🗑️
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                            {renderProtocolDetails(protocol)}
                        </div>
                    );
                })}

                <div className="add-protocol-card" onClick={onAdd}>
                    <div className="add-content">
                        <div className="add-icon">+</div>
                        <h4>Add New {type === 'stain' ? 'Stain' : 'Region'} Protocol</h4>
                        <p>Click to create a new protocol</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProtocolList;
