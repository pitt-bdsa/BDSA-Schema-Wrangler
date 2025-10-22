import React, { useState, useEffect } from 'react';
import dsaAuthStore from '../utils/dsaAuthStore';
import DSAClient from '../utils/dsaClient';
import DSAFolderBrowserModal from './DSAFolderBrowserModal';
import './DsaConfigModal.css';

const DsaConfigModal = ({ onSave, onClose }) => {
    const [config, setConfig] = useState(dsaAuthStore.config);
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [errors, setErrors] = useState({});

    // Folder browser state
    const [showFolderBrowser, setShowFolderBrowser] = useState(false);
    const [showMetadataFolderBrowser, setShowMetadataFolderBrowser] = useState(false);
    const [dsaClient, setDsaClient] = useState(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Resource name display
    const [resourceName, setResourceName] = useState(null);
    const [metadataResourceName, setMetadataResourceName] = useState(null);

    useEffect(() => {
        setConfig(dsaAuthStore.config);
    }, []);

    // Fetch resource names when config changes
    useEffect(() => {
        const fetchResourceNames = async () => {
            if (!config.baseUrl || !dsaAuthStore.token) return;

            const client = new DSAClient(config.baseUrl, dsaAuthStore.token);

            // Fetch main resource name
            if (config.resourceId && config.resourceType) {
                try {
                    const resourceInfo = await client.getResourceName(config.resourceId, config.resourceType);
                    setResourceName(resourceInfo);
                } catch (error) {
                    console.warn('Failed to fetch resource name:', error);
                    setResourceName({ name: 'Unknown', type: config.resourceType, id: config.resourceId });
                }
            } else {
                setResourceName(null);
            }

            // Fetch metadata resource name
            if (config.metadataSyncTargetFolder) {
                try {
                    const metadataResourceInfo = await client.getResourceName(config.metadataSyncTargetFolder, 'folder');
                    setMetadataResourceName(metadataResourceInfo);
                } catch (error) {
                    console.warn('Failed to fetch metadata resource name:', error);
                    setMetadataResourceName({ name: 'Unknown', type: 'folder', id: config.metadataSyncTargetFolder });
                }
            } else {
                setMetadataResourceName(null);
            }
        };

        fetchResourceNames();
    }, [config.resourceId, config.resourceType, config.metadataSyncTargetFolder, config.baseUrl]);


    const handleFieldChange = (field, value) => {
        setConfig(prev => {
            const newConfig = { ...prev, [field]: value };

            // Auto-populate metadataSyncTargetFolder with resourceId when resourceId changes and metadataSyncTargetFolder is blank
            if (field === 'resourceId' && !prev.metadataSyncTargetFolder.trim()) {
                newConfig.metadataSyncTargetFolder = value;
            }

            return newConfig;
        });


        // Clear field error when user starts typing
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
        }
    };

    const validateConfig = (requireResourceId = false) => {
        const newErrors = {};

        if (!config.baseUrl.trim()) {
            newErrors.baseUrl = 'DSA server URL is required';
        } else {
            try {
                new URL(config.baseUrl);
            } catch {
                newErrors.baseUrl = 'Please enter a valid URL';
            }
        }

        // Only require Resource ID if explicitly requested (for data loading)
        // Allow saving configuration without Resource ID for initial setup
        if (requireResourceId && !config.resourceId.trim()) {
            newErrors.resourceId = 'Resource ID is required to load data';
        }

        if (config.pageSize && (isNaN(config.pageSize) || config.pageSize < 1)) {
            newErrors.pageSize = 'Page size must be a positive number';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleTestConnection = async () => {
        // Only require base URL for connection test, not Resource ID
        if (!validateConfig(false)) {
            return;
        }

        setIsTesting(true);
        setTestResult(null);

        try {
            // Test basic connection
            const connectionResult = await dsaAuthStore.testConnection();
            setTestResult({
                type: 'success',
                message: `Connection successful! Server version: ${connectionResult.version?.version || 'Unknown'}`
            });
        } catch (error) {
            setTestResult({
                type: 'error',
                message: error.message
            });
        } finally {
            setIsTesting(false);
        }
    };

    const handleSave = () => {
        // Allow saving configuration without Resource ID for initial setup
        if (!validateConfig(false)) {
            return;
        }

        onSave(config);
    };

    // Folder browser handlers
    const openFolderBrowser = () => {
        if (!config.baseUrl.trim()) {
            setErrors(prev => ({ ...prev, baseUrl: 'Please enter a DSA server URL first' }));
            return;
        }

        // Create DSA client
        const client = new DSAClient(config.baseUrl, dsaAuthStore.token);
        setDsaClient(client);
        setShowFolderBrowser(true);
    };

    const openMetadataFolderBrowser = () => {
        if (!config.baseUrl.trim()) {
            setErrors(prev => ({ ...prev, baseUrl: 'Please enter a DSA server URL first' }));
            return;
        }

        // Create DSA client
        const client = new DSAClient(config.baseUrl, dsaAuthStore.token);
        setDsaClient(client);
        setShowMetadataFolderBrowser(true);
    };

    const closeFolderBrowser = () => {
        setShowFolderBrowser(false);
        setDsaClient(null);
    };

    const closeMetadataFolderBrowser = () => {
        setShowMetadataFolderBrowser(false);
        setDsaClient(null);
    };

    const handleResourceSelect = (resource) => {
        console.log('Selected resource:', resource);
        setConfig(prev => ({
            ...prev,
            resourceId: resource._id,
            resourceType: resource.type
        }));
        setResourceName({ name: resource.name, type: resource.type, id: resource._id });
        closeFolderBrowser();
    };

    const handleMetadataResourceSelect = (resource) => {
        console.log('Selected metadata resource:', resource);
        setConfig(prev => ({
            ...prev,
            metadataSyncTargetFolder: resource._id
        }));
        setMetadataResourceName({ name: resource.name, type: resource.type, id: resource._id });
        closeMetadataFolderBrowser();
    };

    // Form is valid if no validation errors (baseUrl is now handled in login)
    // Resource ID is optional for initial setup
    const isFormValid = Object.keys(errors).length === 0;

    return (
        <>
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal-content config-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header">
                        <h2>DSA Server Configuration</h2>
                        <button className="close-button" onClick={onClose}>×</button>
                    </div>

                    <div className="config-form">

                        <div className="form-group">
                            <label htmlFor="resourceId">Resource ID (optional for setup)</label>
                            <div className="input-with-button">
                                <input
                                    type="text"
                                    id="resourceId"
                                    value={config.resourceId}
                                    onChange={(e) => handleFieldChange('resourceId', e.target.value)}
                                    placeholder="e.g., 507f1f77bcf86cd799439011"
                                    className={errors.resourceId ? 'error' : ''}
                                />
                                <button
                                    type="button"
                                    onClick={openFolderBrowser}
                                    className="browse-button"
                                    disabled={!config.baseUrl.trim()}
                                    title={!config.baseUrl.trim() ? 'Enter DSA server URL first' : 'Browse DSA folders and collections'}
                                >
                                    Browse
                                </button>
                            </div>
                            {resourceName && (
                                <div className="resource-name-display">
                                    <span className="resource-name-label">Selected:</span>
                                    <span className="resource-name">{resourceName.name}</span>
                                    <span className="resource-type">({resourceName.type})</span>
                                </div>
                            )}
                            {errors.resourceId && <div className="error-message">{errors.resourceId}</div>}
                            <div className="field-help">
                                The ID of the DSA resource (folder or collection) you want to access
                                <br />
                                <small>💡 You can save the configuration now and select a resource later using the Browse button</small>
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="metadataSyncTargetFolder">Metadata Sync Target Folder</label>
                            <div className="input-with-button">
                                <input
                                    type="text"
                                    id="metadataSyncTargetFolder"
                                    value={config.metadataSyncTargetFolder}
                                    onChange={(e) => handleFieldChange('metadataSyncTargetFolder', e.target.value)}
                                    placeholder="e.g., 507f1f77bcf86cd799439011"
                                    className={errors.metadataSyncTargetFolder ? 'error' : ''}
                                />
                                <button
                                    type="button"
                                    onClick={openMetadataFolderBrowser}
                                    className="browse-button"
                                    disabled={!config.baseUrl.trim()}
                                    title={!config.baseUrl.trim() ? 'Enter DSA server URL first' : 'Browse DSA folders and collections for metadata sync'}
                                >
                                    Browse
                                </button>
                            </div>
                            {metadataResourceName && (
                                <div className="resource-name-display">
                                    <span className="resource-name-label">Selected:</span>
                                    <span className="resource-name">{metadataResourceName.name}</span>
                                    <span className="resource-type">({metadataResourceName.type})</span>
                                </div>
                            )}
                            {errors.metadataSyncTargetFolder && <div className="error-message">{errors.metadataSyncTargetFolder}</div>}
                            <div className="field-help">
                                The ID of the DSA folder where metadata will be synced (if blank, will use the same folder as the main data pull)
                                <br />
                                <small>💡 You can save the configuration now and select a metadata target folder later using the Browse button</small>
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="resourceType">Resource Type</label>
                            <select
                                id="resourceType"
                                value={config.resourceType}
                                onChange={(e) => handleFieldChange('resourceType', e.target.value)}
                            >
                                <option value="folder">Folder</option>
                                <option value="collection">Collection</option>
                            </select>
                            <div className="field-help">
                                The type of DSA resource (usually 'folder')
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="fetchStrategy">Fetch Strategy</label>
                            <select
                                id="fetchStrategy"
                                value={config.fetchStrategy}
                                onChange={(e) => handleFieldChange('fetchStrategy', e.target.value)}
                            >
                                <option value="unlimited">Unlimited (recommended)</option>
                                <option value="paginate">Paginated</option>
                            </select>
                            <div className="field-help">
                                How to fetch data from the server (unlimited is faster for most cases)
                            </div>
                        </div>

                        {config.fetchStrategy === 'paginate' && (
                            <div className="form-group">
                                <label htmlFor="pageSize">Page Size</label>
                                <input
                                    type="number"
                                    id="pageSize"
                                    value={config.pageSize}
                                    onChange={(e) => handleFieldChange('pageSize', parseInt(e.target.value) || 100)}
                                    min="1"
                                    max="1000"
                                    className={errors.pageSize ? 'error' : ''}
                                />
                                {errors.pageSize && <div className="error-message">{errors.pageSize}</div>}
                                <div className="field-help">
                                    Number of items to fetch per page (1-1000)
                                </div>
                            </div>
                        )}

                        {testResult && (
                            <div className={`test-result ${testResult.type}`}>
                                <div className="test-result-icon">
                                    {testResult.type === 'success' ? '✅' : '❌'}
                                </div>
                                <div className="test-result-message">
                                    {testResult.message}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="modal-actions">
                        <button
                            className="test-button"
                            onClick={handleTestConnection}
                            disabled={!config.baseUrl.trim() || isTesting}
                        >
                            {isTesting ? 'Testing...' : 'Test Connection'}
                        </button>

                        <div className="action-buttons">
                            <button
                                className="cancel-button"
                                onClick={onClose}
                            >
                                Cancel
                            </button>
                            <button
                                className="save-button"
                                onClick={handleSave}
                                disabled={!isFormValid}
                            >
                                Save Configuration
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* DSA Folder Browser Modal */}
            <DSAFolderBrowserModal
                isOpen={showFolderBrowser}
                onClose={closeFolderBrowser}
                dsaClient={dsaClient}
                onSelectResource={handleResourceSelect}
                title="Select DSA Resource"
            />

            {/* DSA Metadata Folder Browser Modal */}
            <DSAFolderBrowserModal
                isOpen={showMetadataFolderBrowser}
                onClose={closeMetadataFolderBrowser}
                dsaClient={dsaClient}
                onSelectResource={handleMetadataResourceSelect}
                title="Select Metadata Sync Target Folder"
            />
        </>
    );
};

export default DsaConfigModal;
