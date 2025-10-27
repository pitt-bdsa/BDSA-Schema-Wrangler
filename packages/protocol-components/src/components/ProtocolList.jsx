import React from 'react';
import ProtocolCard from './ProtocolCard';
import './ProtocolList.css';

/**
 * ProtocolList - Displays a grid of protocol cards
 * 
 * @param {Object} props
 * @param {Array} props.protocols - Array of protocol objects
 * @param {string} props.type - 'stain' or 'region'
 * @param {Function} props.onAdd - Callback when add button clicked
 * @param {Function} props.onEdit - Callback when edit button clicked
 * @param {Function} props.onDelete - Callback when delete button clicked
 * @param {boolean} props.readOnly - If true, hide edit/delete/add buttons
 * @param {boolean} props.showSync - If true, show sync status badges
 * @param {string} props.title - Optional custom title
 * @param {string} props.description - Optional custom description
 */
export function ProtocolList({
    protocols = [],
    type,
    onAdd,
    onEdit,
    onDelete,
    readOnly = false,
    showSync = true,
    title,
    description
}) {
    const defaultTitle = type === 'stain' ? 'Stain Protocols' : 'Region Protocols';
    const defaultDescription = type === 'stain'
        ? 'Define staining protocols for different tissue types and targets.'
        : 'Define region protocols for different brain regions and anatomical landmarks.';

    return (
        <div className="protocol-list">
            <div className="protocol-list-header">
                <h3>{title || defaultTitle}</h3>
                <p>{description || defaultDescription}</p>
            </div>

            <div className="protocols-grid">
                {protocols.map(protocol => (
                    <ProtocolCard
                        key={protocol.id}
                        protocol={protocol}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        readOnly={readOnly}
                        showSync={showSync}
                    />
                ))}

                {!readOnly && onAdd && (
                    <div className="add-protocol-card" onClick={onAdd}>
                        <div className="add-content">
                            <div className="add-icon">+</div>
                            <h4>Add New {type === 'stain' ? 'Stain' : 'Region'} Protocol</h4>
                            <p>Click to create a new protocol</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ProtocolList;

