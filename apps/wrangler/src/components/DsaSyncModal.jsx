import React from 'react';
import DsaSyncControl from './DsaSyncControl';

const DsaSyncModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content dsa-sync-modal-content">
                <div className="modal-header">
                    <h2>DSA Metadata Sync</h2>
                    <button
                        className="close-modal-btn"
                        onClick={onClose}
                        title="Close"
                    >
                        ×
                    </button>
                </div>
                <div className="modal-body">
                    <DsaSyncControl />
                </div>
            </div>
        </div>
    );
};

export default DsaSyncModal;
