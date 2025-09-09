import React from 'react';
import DsaSyncControl from './DsaSyncControl';

const DsaSyncModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content dsa-sync-modal-content">
                <DsaSyncControl />
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

export default DsaSyncModal;
