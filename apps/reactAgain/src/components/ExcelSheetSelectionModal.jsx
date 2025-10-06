import React, { useState } from 'react';
import './ExcelSheetSelectionModal.css';

const ExcelSheetSelectionModal = ({
    isOpen,
    onClose,
    sheetNames,
    onSheetSelect,
    fileName
}) => {
    const [selectedSheet, setSelectedSheet] = useState('');

    const handleConfirm = () => {
        if (selectedSheet) {
            onSheetSelect(selectedSheet);
            onClose();
        }
    };

    const handleCancel = () => {
        setSelectedSheet('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="excel-sheet-modal-overlay" onClick={handleCancel}>
            <div className="excel-sheet-modal" onClick={(e) => e.stopPropagation()}>
                <div className="excel-sheet-modal-header">
                    <h3>📊 Select Excel Worksheet</h3>
                    <button
                        className="excel-sheet-close-btn"
                        onClick={handleCancel}
                    >
                        ✕
                    </button>
                </div>

                <div className="excel-sheet-modal-content">
                    <p><strong>File:</strong> {fileName}</p>
                    <p><strong>Available Worksheets:</strong></p>

                    <div className="sheet-list">
                        {sheetNames.map((sheetName, index) => (
                            <label key={index} className="sheet-option">
                                <input
                                    type="radio"
                                    name="sheet"
                                    value={sheetName}
                                    checked={selectedSheet === sheetName}
                                    onChange={(e) => setSelectedSheet(e.target.value)}
                                />
                                <span className="sheet-name">{sheetName}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="excel-sheet-modal-actions">
                    <button
                        className="btn btn-secondary"
                        onClick={handleCancel}
                    >
                        Cancel
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleConfirm}
                        disabled={!selectedSheet}
                    >
                        Load Selected Sheet
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExcelSheetSelectionModal;
