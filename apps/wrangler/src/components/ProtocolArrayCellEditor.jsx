import React, { useState, useEffect, useRef } from 'react';
import protocolStore from '../utils/protocolStore';
import './ProtocolArrayCellEditor.css';

const ProtocolArrayCellEditor = ({ value, onValueChange, colDef, data, api, columnApi, context, node, rowIndex }) => {
    const [protocols, setProtocols] = useState([]);
    const [availableProtocols, setAvailableProtocols] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef(null);

    // Initialize protocols from the cell value
    useEffect(() => {
        if (value) {
            // Handle both array and comma-separated string formats
            const protocolArray = Array.isArray(value)
                ? value
                : (typeof value === 'string' ? value.split(',').map(p => p.trim()).filter(p => p) : []);
            setProtocols(protocolArray);
        } else {
            setProtocols([]);
        }
    }, [value]);

    // Load available protocols
    useEffect(() => {
        const field = colDef.cellEditorParams?.field || colDef.field;
        const protocolType = field.includes('Stain') ? 'stain' : 'region';
        const available = protocolType === 'stain' ? protocolStore.stainProtocols : protocolStore.regionProtocols;
        setAvailableProtocols(available || []);
    }, [colDef]);

    // Handle clicks outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleAddProtocol = (protocolName) => {
        if (!protocols.includes(protocolName)) {
            const newProtocols = [...protocols, protocolName];
            setProtocols(newProtocols);
            onValueChange(newProtocols);
            setSearchTerm('');
            setIsOpen(false);
        }
    };

    const handleRemoveProtocol = (protocolName) => {
        const newProtocols = protocols.filter(p => p !== protocolName);
        setProtocols(newProtocols);
        onValueChange(newProtocols);
    };

    const filteredProtocols = availableProtocols.filter(protocol =>
        protocol.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !protocols.includes(protocol.name)
    );

    const getDisplayValue = () => {
        return protocols.length > 0 ? protocols.join(', ') : '';
    };

    return (
        <div ref={containerRef} className="protocol-array-editor">
            <div className="protocol-tags-container">
                {protocols.map((protocol, index) => (
                    <span key={index} className="protocol-tag">
                        {protocol}
                        <button
                            type="button"
                            className="remove-protocol-btn"
                            onClick={() => handleRemoveProtocol(protocol)}
                            title={`Remove ${protocol}`}
                        >
                            ×
                        </button>
                    </span>
                ))}
                <button
                    type="button"
                    className="add-protocol-btn"
                    onClick={() => setIsOpen(!isOpen)}
                    title="Add protocol"
                >
                    + Add Protocol
                </button>
            </div>

            {isOpen && (
                <div className="protocol-dropdown">
                    <div className="search-container">
                        <input
                            type="text"
                            placeholder="Search protocols..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="protocol-search"
                            autoFocus
                        />
                    </div>
                    <div className="protocol-list">
                        {filteredProtocols.length > 0 ? (
                            filteredProtocols.map(protocol => (
                                <button
                                    key={protocol.id}
                                    type="button"
                                    className="protocol-option"
                                    onClick={() => handleAddProtocol(protocol.name)}
                                >
                                    <span className="protocol-name">{protocol.name}</span>
                                    {protocol.description && (
                                        <span className="protocol-description">{protocol.description}</span>
                                    )}
                                </button>
                            ))
                        ) : (
                            <div className="no-protocols">
                                {searchTerm ? 'No matching protocols found' : 'No available protocols'}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProtocolArrayCellEditor;
