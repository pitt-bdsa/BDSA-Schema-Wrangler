import React, { useState, useEffect } from 'react';
import dsaAuthStore from '../utils/dsaAuthStore';
import './DsaConfigModal.css';

const DsaConfigModal = ({ onSave, onClose }) => {
    const [config, setConfig] = useState(dsaAuthStore.config);
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        setConfig(dsaAuthStore.config);
    }, []);

    const handleFieldChange = (field, value) => {
        setConfig(prev => ({ ...prev, [field]: value }));

        // Clear field error when user starts typing
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
        }
    };

    const validateConfig = () => {
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

        if (!config.resourceId.trim()) {
            newErrors.resourceId = 'Resource ID is required';
        }

        if (config.pageSize && (isNaN(config.pageSize) || config.pageSize < 1)) {
            newErrors.pageSize = 'Page size must be a positive number';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleTestConnection = async () => {
        if (!validateConfig()) {
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
        if (!validateConfig()) {
            return;
        }

        onSave(config);
    };

    const isFormValid = config.baseUrl.trim() && config.resourceId.trim() && Object.keys(errors).length === 0;

    return (
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
                        <div className="field-help">
                            The base URL of your Digital Slide Archive server
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="resourceId">Resource ID *</label>
                        <input
                            type="text"
                            id="resourceId"
                            value={config.resourceId}
                            onChange={(e) => handleFieldChange('resourceId', e.target.value)}
                            placeholder="e.g., 507f1f77bcf86cd799439011"
                            className={errors.resourceId ? 'error' : ''}
                        />
                        {errors.resourceId && <div className="error-message">{errors.resourceId}</div>}
                        <div className="field-help">
                            The ID of the DSA resource (folder or collection) you want to access
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
    );
};

export default DsaConfigModal;
