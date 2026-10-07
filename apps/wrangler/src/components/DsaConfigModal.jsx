import React, { useState, useEffect } from 'react';
import dsaAuthStore from '../utils/dsaAuthStore';
import DSAClient from '../utils/dsaClient';
import DSAFolderBrowserModal from './DSAFolderBrowserModal';
import './DsaConfigModal.css';

const DsaConfigModal = ({ onSave, onClose, embedded = false }) => {
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

    // Resolve folder name, path, and type when ids change
    useEffect(() => {
        const fetchResourceNames = async () => {
            if (!config.baseUrl || !dsaAuthStore.token) return;

            const client = new DSAClient(config.baseUrl, dsaAuthStore.token);

            if (config.resourceId) {
                try {
                    const resourceInfo = await client.resolveResource(config.resourceId, config.resourceType);
                    setResourceName(resourceInfo);
                    setConfig((prev) => (
                        prev.resourceType === resourceInfo.type
                        && prev.resourceName === resourceInfo.name
                        && prev.resourcePath === resourceInfo.path
                            ? prev
                            : {
                                ...prev,
                                resourceType: resourceInfo.type,
                                resourceName: resourceInfo.name,
                                resourcePath: resourceInfo.path,
                            }
                    ));
                } catch (error) {
                    console.warn('Failed to fetch resource name:', error);
                    setResourceName({
                        name: config.resourceName || 'Unknown',
                        type: config.resourceType,
                        id: config.resourceId,
                        path: config.resourcePath || '',
                    });
                }
            } else {
                setResourceName(null);
            }

            if (config.metadataSyncTargetFolder) {
                try {
                    const metadataResourceInfo = await client.resolveResource(
                        config.metadataSyncTargetFolder,
                        'folder'
                    );
                    setMetadataResourceName(metadataResourceInfo);
                    setConfig((prev) => (
                        prev.metadataResourceName === metadataResourceInfo.name
                        && prev.metadataResourcePath === metadataResourceInfo.path
                            ? prev
                            : {
                                ...prev,
                                metadataResourceName: metadataResourceInfo.name,
                                metadataResourcePath: metadataResourceInfo.path,
                            }
                    ));
                } catch (error) {
                    console.warn('Failed to fetch metadata resource name:', error);
                    setMetadataResourceName({
                        name: config.metadataResourceName || 'Unknown',
                        type: 'folder',
                        id: config.metadataSyncTargetFolder,
                        path: config.metadataResourcePath || '',
                    });
                }
            } else {
                setMetadataResourceName(null);
            }
        };

        fetchResourceNames();
    }, [config.resourceId, config.metadataSyncTargetFolder, config.baseUrl]);


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
            setErrors(prev => ({
                ...prev,
                baseUrl: embedded ? 'Host session is not ready' : 'Please enter a DSA server URL first'
            }));
            return;
        }

        // Create DSA client
        const client = new DSAClient(config.baseUrl, dsaAuthStore.token);
        setDsaClient(client);
        setShowFolderBrowser(true);
    };

    const openMetadataFolderBrowser = () => {
        if (!config.baseUrl.trim()) {
            setErrors(prev => ({
                ...prev,
                baseUrl: embedded ? 'Host session is not ready' : 'Please enter a DSA server URL first'
            }));
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

    const applyResolvedResource = (prev, details, { metadataOnly = false } = {}) => {
        if (metadataOnly) {
            return {
                ...prev,
                metadataSyncTargetFolder: details.id,
                metadataResourceName: details.name,
                metadataResourcePath: details.path,
            };
        }

        const reuseMetadata = !prev.metadataSyncTargetFolder?.trim();
        return {
            ...prev,
            resourceId: details.id,
            resourceType: details.type,
            resourceName: details.name,
            resourcePath: details.path,
            ...(reuseMetadata ? {
                metadataSyncTargetFolder: details.id,
                metadataResourceName: details.name,
                metadataResourcePath: details.path,
            } : {}),
        };
    };

    const handleResourceSelect = async (resource) => {
        const client = new DSAClient(config.baseUrl, dsaAuthStore.token);
        const details = await client.resolveResource(resource._id, resource.type);
        setConfig((prev) => applyResolvedResource(prev, details));
        setResourceName(details);
        closeFolderBrowser();
    };

    const handleMetadataResourceSelect = async (resource) => {
        const client = new DSAClient(config.baseUrl, dsaAuthStore.token);
        const details = await client.resolveResource(resource._id, resource.type);
        setConfig((prev) => applyResolvedResource(prev, details, { metadataOnly: true }));
        setMetadataResourceName(details);
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
                        <h2>{embedded ? 'DSA Source' : 'DSA Server Configuration'}</h2>
                        <button className="close-button" onClick={onClose}>×</button>
                    </div>

                    <div className="config-form">
                        {embedded && (
                            <div className="form-group">
                                <div className="field-help">
                                    Using this BDSA instance. Browse to the folder you want to load.
                                </div>
                            </div>
                        )}

                        <div className="form-group">
                            <label>Data folder</label>
                            <div className="source-picker">
                                <div className={`source-summary ${errors.resourceId ? 'error' : ''}`}>
                                    {resourceName ? (
                                        <>
                                            <div className="source-name">{resourceName.name}</div>
                                            {resourceName.path && (
                                                <div className="source-path">{resourceName.path}</div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="source-empty">No folder selected</div>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={openFolderBrowser}
                                    className="browse-button"
                                    disabled={!config.baseUrl.trim()}
                                    title={!config.baseUrl.trim()
                                        ? (embedded ? 'Host session is not ready' : 'Enter DSA server URL first')
                                        : 'Browse folders'}
                                >
                                    Browse
                                </button>
                            </div>
                            {errors.resourceId && <div className="error-message">{errors.resourceId}</div>}
                            <div className="field-help">
                                Choose the folder to load slides from. Type is detected automatically.
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Metadata folder</label>
                            <div className="source-picker">
                                <div className={`source-summary ${errors.metadataSyncTargetFolder ? 'error' : ''}`}>
                                    {metadataResourceName ? (
                                        <>
                                            <div className="source-name">{metadataResourceName.name}</div>
                                            {metadataResourceName.path && (
                                                <div className="source-path">{metadataResourceName.path}</div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="source-empty">Same as data folder</div>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={openMetadataFolderBrowser}
                                    className="browse-button"
                                    disabled={!config.baseUrl.trim()}
                                    title={!config.baseUrl.trim()
                                        ? (embedded ? 'Host session is not ready' : 'Enter DSA server URL first')
                                        : 'Browse folders for metadata sync'}
                                >
                                    Browse
                                </button>
                            </div>
                            {errors.metadataSyncTargetFolder && <div className="error-message">{errors.metadataSyncTargetFolder}</div>}
                            <div className="field-help">
                                Where protocols and mappings are stored. Defaults to the data folder.
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
                        {!embedded && (
                            <button
                                className="test-button"
                                onClick={handleTestConnection}
                                disabled={!config.baseUrl.trim() || isTesting}
                            >
                                {isTesting ? 'Testing...' : 'Test Connection'}
                            </button>
                        )}

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
                title="Select data folder"
            />

            {/* DSA Metadata Folder Browser Modal */}
            <DSAFolderBrowserModal
                isOpen={showMetadataFolderBrowser}
                onClose={closeMetadataFolderBrowser}
                dsaClient={dsaClient}
                onSelectResource={handleMetadataResourceSelect}
                title="Select metadata folder"
            />
        </>
    );
};

export default DsaConfigModal;
