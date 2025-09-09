import React from 'react';

const BdsaSettingsModal = ({ 
    isOpen, 
    onClose, 
    bdsaInstitutionId, 
    onInstitutionIdChange 
}) => {
    if (!isOpen) return null;

    const handleInstitutionIdChange = (e) => {
        const value = e.target.value;
        // Only allow 3 digits
        if (/^\d{0,3}$/.test(value)) {
            onInstitutionIdChange(value.padStart(3, '0'));
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2>BDSA Settings</h2>
                <div className="bdsa-settings-form">
                    <div className="form-group">
                        <label htmlFor="bdsa-institution-id">BDSA Institution ID:</label>
                        <input
                            type="text"
                            id="bdsa-institution-id"
                            value={bdsaInstitutionId}
                            onChange={handleInstitutionIdChange}
                            placeholder="001"
                            maxLength={3}
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                        />
                        <small>3-digit institution ID (e.g., 001, 002, etc.)</small>
                    </div>
                </div>
                <div className="modal-buttons">
                    <button
                        className="close-modal-btn"
                        onClick={onClose}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BdsaSettingsModal;
