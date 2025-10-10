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
    const [urlNormalized, setUrlNormalized] = useState(false);

    // Folder browser state
    const [showFolderBrowser, setShowFolderBrowser] = useState(false);
    const [dsaClient, setDsaClient] = useState(null);

    useEffect(() => {
        setConfig(dsaAuthStore.config);
    }, []);

    // Normalize DSA server URL to handle common formatting issues
    const normalizeDsaUrl = (url) => {
        if (!url || typeof url !== 'string') {
            return url;
        }

        let normalizedUrl = url.trim();

        // Remove trailing slashes
        normalizedUrl = normalizedUrl.replace(/\/+$/, '');

        // Remove /api/v1 if it was accidentally added by the user
        normalizedUrl = normalizedUrl.replace(/\/api\/v1\/?$/, '');

        // Ensure protocol is present
        if (!normalizedUrl.match(/^https?:\/\//)) {
            normalizedUrl = `http://${normalizedUrl}`;
        }

        // Remove any duplicate slashes
        normalizedUrl = normalizedUrl.replace(/([^:]\/)\/+/g, '$1');

        return normalizedUrl;
    };

    const handleFieldChange = (field, value) => {
        let processedValue = value;
        let wasNormalized = false;

        // Apply URL normalization for baseUrl field
        if (field === 'baseUrl') {
            const originalValue = value;
            processedValue = normalizeDsaUrl(value);
            wasNormalized = originalValue !== processedValue;
        }

        setConfig(prev => ({ ...prev, [field]: processedValue }));

        // Show normalization indicator
        if (field === 'baseUrl') {
            setUrlNormalized(wasNormalized);
            // Hide the indicator after 3 seconds
            if (wasNormalized) {
                setTimeout(() => setUrlNormalized(false), 3000);
            }
        }

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

    const closeFolderBrowser = () => {
        setShowFolderBrowser(false);
        setDsaClient(null);
    };

    const handleResourceSelect = (resource) => {
        console.log('Selected resource:', resource);
        setConfig(prev => ({
            ...prev,
            resourceId: resource._id,
            resourceType: resource.type
        }));
        closeFolderBrowser();
    };

    // Form is valid if base URL is provided and no validation errors
    // Resource ID is optional for initial setup
    const isFormValid = config.baseUrl.trim() && Object.keys(errors).length === 0;

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
                            <label htmlFor="baseUrl">DSA Server URL *</label>
                            <input
                                type="url"
                                id="baseUrl"
                                value={config.baseUrl}
                                onChange={(e) => handleFieldChange('baseUrl', e.target.value)}
                                placeholder="https://your-dsa-server.com"
                                className={errors.baseUrl ? 'error' : ''}
                            />
                            {errors.baseUrl && <div className="error-message">{errors.baseUrl}</div>}
                            {urlNormalized && (
                                <div className="normalization-indicator">
                                    ✨ URL automatically cleaned up
                                </div>
                            )}
                            <div className="field-help">
                                The base URL of your Digital Slide Archive server (e.g., http://multiplex.pathology.emory.edu:8080)
                                <br />
                                <small>💡 Tip: Don't include /api/v1 - it will be added automatically</small>
                            </div>
                        </div>

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
                            {errors.resourceId && <div className="error-message">{errors.resourceId}</div>}
                            <div className="field-help">
                                The ID of the DSA resource (folder or collection) you want to access
                                <br />
                                <small>💡 You can save the configuration now and select a resource later using the Browse button</small>
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
        </>
    );
};

export default DsaConfigModal;
