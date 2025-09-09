import React from 'react';

const DsaConfigModal = ({ 
    isOpen, 
    onClose, 
    dsaConfig, 
    onConfigChange, 
    localGirderToken, 
    onGetGirderToken 
}) => {
    if (!isOpen) return null;

    const handleConfigUpdate = (updates) => {
        const newConfig = { ...(dsaConfig || {}), ...updates };
        onConfigChange(newConfig);
    };

    const handleCloseAndLoad = () => {
        onClose();
        // Auto-load DSA data when closing the modal if everything is configured
        if (dsaConfig?.baseUrl && dsaConfig?.resourceId && localGirderToken) {
            // This will be handled by the parent component
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2>Digital Slide Archive Configuration</h2>
                <div className="dsa-settings-form">
                    <div className="form-group form-group-centered">
                        <label htmlFor="dsa-base-url">Base URL:</label>
                        <input
                            type="url"
                            id="dsa-base-url"
                            value={dsaConfig?.baseUrl || ''}
                            onChange={(e) => handleConfigUpdate({ baseUrl: e.target.value })}
                            placeholder="http://multiplex.pathology.emory.edu:8080"
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                        />
                        <small>Base URL of your Digital Slide Archive instance</small>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="resource-type">Resource Type:</label>
                            <select
                                id="resource-type"
                                value={dsaConfig?.resourceType || 'folder'}
                                onChange={(e) => handleConfigUpdate({ resourceType: e.target.value })}
                                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                            >
                                <option value="folder">Folder</option>
                                <option value="collection">Collection</option>
                                <option value="user">User</option>
                            </select>
                            <small>Type of resource to pull items from</small>
                        </div>

                        <div className="form-group">
                            <label htmlFor="resource-id">Resource ID:</label>
                            <input
                                type="text"
                                id="resource-id"
                                value={dsaConfig?.resourceId || ''}
                                onChange={(e) => handleConfigUpdate({ resourceId: e.target.value })}
                                placeholder="68bb20d0188a3d83b0a175da"
                                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                            />
                            <small>ID of the {dsaConfig?.resourceType || 'folder'} to pull items from</small>
                        </div>
                    </div>

                    <div style={{ marginTop: '16px', padding: '8px', backgroundColor: '#fff3cd', color: '#856404', borderRadius: '4px', fontSize: '0.8rem' }}>
                        <strong>Note:</strong> If you get "Read access denied" errors, the resource may be private and require specific permissions. Try using a public collection or contact the DSA administrator.
                    </div>

                    <div className="form-group">
                        <label>Data Fetching Strategy:</label>
                        <select
                            value={dsaConfig?.fetchStrategy || 'unlimited'}
                            onChange={(e) => handleConfigUpdate({ fetchStrategy: e.target.value })}
                            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                        >
                            <option value="unlimited">Get All Items (limit=0) - Faster</option>
                            <option value="paginate">Use Pagination - Safer for Large Datasets</option>
                        </select>
                        {dsaConfig?.fetchStrategy === 'paginate' && (
                            <div style={{ marginTop: '8px' }}>
                                <label>Page Size:</label>
                                <select
                                    value={dsaConfig?.pageSize || 100}
                                    onChange={(e) => handleConfigUpdate({ pageSize: parseInt(e.target.value) })}
                                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', marginTop: '4px' }}
                                >
                                    <option value={50}>50 items per page</option>
                                    <option value={100}>100 items per page</option>
                                    <option value={200}>200 items per page</option>
                                    <option value={500}>500 items per page</option>
                                </select>
                            </div>
                        )}
                        <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#e3f2fd', border: '1px solid #90caf9', borderRadius: '4px', fontSize: '0.8rem' }}>
                            <strong>💡 Tip:</strong> "Get All Items" fetches everything in one request (faster). Use pagination for very large datasets (10,000+ items) to avoid memory issues.
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Authentication:</label>
                        <div style={{ padding: '8px', backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '4px', fontSize: '0.9rem' }}>
                            <strong>Using admin:password authentication</strong><br />
                            <small>This will automatically obtain a Girder token for API access.</small>
                        </div>
                        {localGirderToken && (
                            <div style={{ marginTop: '8px', padding: '4px 8px', backgroundColor: '#d4edda', color: '#155724', borderRadius: '4px', fontSize: '0.8rem' }}>
                                ✓ Girder token obtained: {localGirderToken.substring(0, 20)}...
                            </div>
                        )}
                    </div>
                </div>
                <div className="modal-buttons">
                    <button
                        className="test-direct-token-btn"
                        onClick={onGetGirderToken}
                        disabled={!dsaConfig?.baseUrl}
                    >
                        Get Girder Token
                    </button>
                    <button
                        className="close-modal-btn"
                        onClick={handleCloseAndLoad}
                    >
                        Close & Load Data
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DsaConfigModal;
