import React, { useState, useEffect } from 'react';
import './AccessoryFieldMappingModal.css';

const AccessoryFieldMappingModal = ({
    isOpen,
    onClose,
    onSave,
    accessoryData,
    dsaData
}) => {
    const [selectedField, setSelectedField] = useState('');
    const [previewMatches, setPreviewMatches] = useState([]);

    useEffect(() => {
        if (accessoryData && accessoryData.length > 0) {
            // Auto-select the first field that looks like a filename
            const filenameFields = accessoryData[0] ? Object.keys(accessoryData[0]).filter(key =>
                key.toLowerCase().includes('filename') ||
                key.toLowerCase().includes('name') ||
                key.toLowerCase().includes('file')
            ) : [];

            if (filenameFields.length > 0) {
                setSelectedField(filenameFields[0]);
            }
        }
    }, [accessoryData]);

    useEffect(() => {
        if (selectedField && accessoryData && dsaData) {
            // Show preview of potential matches
            const preview = accessoryData.slice(0, 5).map(accessoryItem => {
                const accessoryFilename = accessoryItem[selectedField];
                const dsaItem = dsaData.find(dsaItem => {
                    const dsaFilename = dsaItem.name || dsaItem.dsa_name || '';
                    return dsaFilename === accessoryFilename ||
                        dsaFilename.toLowerCase() === accessoryFilename?.toLowerCase() ||
                        dsaFilename.replace(/\.[^/.]+$/, '') === accessoryFilename?.replace(/\.[^/.]+$/, '');
                });

                return {
                    accessoryFilename,
                    matched: !!dsaItem,
                    dsaFilename: dsaItem ? (dsaItem.name || dsaItem.dsa_name) : null
                };
            });

            setPreviewMatches(preview);
        }
    }, [selectedField, accessoryData, dsaData]);

    const handleSave = () => {
        if (selectedField) {
            onSave(selectedField);
        }
    };

    const getAvailableFields = () => {
        if (!accessoryData || accessoryData.length === 0) return [];
        return Object.keys(accessoryData[0]);
    };

    if (!isOpen) return null;

    return (
        <div className="accessory-field-mapping-modal-overlay">
            <div className="accessory-field-mapping-modal">
                <div className="modal-header">
                    <h3>🔗 Select Filename Field for Matching</h3>
                    <p>No matches were found. Please select which field in your accessory file contains the filenames to match against DSA data.</p>
                </div>

                <div className="field-selection">
                    <label htmlFor="filename-field">Filename Field:</label>
                    <select
                        id="filename-field"
                        value={selectedField}
                        onChange={(e) => setSelectedField(e.target.value)}
                        className="field-dropdown"
                    >
                        <option value="">Select a field...</option>
                        {getAvailableFields().map(field => (
                            <option key={field} value={field}>
                                {field}
                            </option>
                        ))}
                    </select>
                </div>

                {selectedField && previewMatches.length > 0 && (
                    <div className="preview-section">
                        <h4>Preview (first 5 items):</h4>
                        <div className="preview-table">
                            <div className="preview-header">
                                <span>Accessory Filename</span>
                                <span>Match Status</span>
                                <span>DSA Filename</span>
                            </div>
                            {previewMatches.map((preview, index) => (
                                <div key={index} className={`preview-row ${preview.matched ? 'matched' : 'unmatched'}`}>
                                    <span className="filename">{preview.accessoryFilename}</span>
                                    <span className="status">
                                        {preview.matched ? '✅ Match' : '❌ No Match'}
                                    </span>
                                    <span className="dsa-filename">{preview.dsaFilename || 'N/A'}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="modal-actions">
                    <button
                        className="cancel-btn"
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button
                        className="save-btn"
                        onClick={handleSave}
                        disabled={!selectedField}
                    >
                        Apply Field Mapping
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AccessoryFieldMappingModal;

