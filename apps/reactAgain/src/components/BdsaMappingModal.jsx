import React, { useState, useEffect } from 'react';
import './BdsaMappingModal.css';

const BdsaMappingModal = ({ isOpen, onClose, onSave, currentMappings, availableColumns }) => {
    const [mappings, setMappings] = useState({
        localCaseId: '',
        localStainID: '',
        localRegionId: ''
    });

    useEffect(() => {
        if (currentMappings) {
            setMappings(currentMappings);
        }
    }, [currentMappings]);

    const handleMappingChange = (field, value) => {
        setMappings(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSave = () => {
        onSave(mappings);
        onClose();
    };

    const getFieldDescription = (field) => {
        const descriptions = {
            localCaseId: 'Select the column that contains your local case identifier (e.g., "05-662")',
            localStainID: 'Select the column that contains your local stain identifier (e.g., "AT8")',
            localRegionId: 'Select the column that contains your local region/block identifier (e.g., "Temporal")'
        };
        return descriptions[field] || '';
    };

    const getFieldLabel = (field) => {
        const labels = {
            localCaseId: 'Local Case ID',
            localStainID: 'Local Stain ID',
            localRegionId: 'Local Region ID'
        };
        return labels[field] || field;
    };

    if (!isOpen) return null;

    return (
        <div className="bdsa-mapping-modal-overlay">
            <div className="bdsa-mapping-modal-content">
                <div className="bdsa-mapping-modal-header">
                    <h2>BDSA Schema Mapping</h2>
                    <button className="bdsa-mapping-modal-close" onClick={onClose}>×</button>
                </div>

                <div className="bdsa-mapping-modal-body">
                    <p className="bdsa-mapping-description">
                        Designate which columns represent your local identifiers for mapping to BDSA schema standards.
                    </p>

                    <div className="bdsa-mapping-fields">
                        {Object.keys(mappings).map(field => (
                            <div key={field} className="bdsa-mapping-field">
                                <label className="bdsa-mapping-label">
                                    {getFieldLabel(field)}:
                                </label>
                                <select
                                    value={mappings[field]}
                                    onChange={(e) => handleMappingChange(field, e.target.value)}
                                    className="bdsa-mapping-select"
                                >
                                    <option value="">-- Select Column --</option>
                                    {availableColumns.map(column => (
                                        <option key={column} value={column}>
                                            {column}
                                        </option>
                                    ))}
                                </select>
                                <p className="bdsa-mapping-help">
                                    {getFieldDescription(field)}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div className="bdsa-mapping-info">
                        <h4>How this works:</h4>
                        <ul>
                            <li>If a column is selected, values will be imported directly from that column</li>
                            <li>If no column is selected or the column is empty, regex rules will be used to extract values from filenames</li>
                            <li>You can configure regex rules using the "Regex Rules" button</li>
                        </ul>
                    </div>
                </div>

                <div className="bdsa-mapping-modal-footer">
                    <button onClick={onClose} className="bdsa-mapping-cancel-btn">Cancel</button>
                    <button onClick={handleSave} className="bdsa-mapping-save-btn">Save Mappings</button>
                </div>
            </div>
        </div>
    );
};

export default BdsaMappingModal;
