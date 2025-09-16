import React, { useState, useRef } from 'react';

const LargeImageConfigSection = ({
    dsaClient,
    config,
    isLoading,
    onError
}) => {
    const [configContent, setConfigContent] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState('');
    const [validationErrors, setValidationErrors] = useState([]);
    const fileInputRef = useRef(null);

    // Default template based on the large_image config format
    const defaultConfig = `---
# Large Image Configuration
# This file configures how items appear in item lists and other large_image features

# Item list configuration
itemList:
  layout:
    flatten: true
    mode: grid
    max-width: 250
  navigate:
    type: itemList
    name: studyList
  columns:
    - type: image
      value: thumbnail
      title: Thumbnail
      width: 250
      height: 250
    - type: image
      value: label
      title: Slide Label
    - type: record
      value: name
    - type: record
      value: size
    - type: record
      value: controls
    - type: metadata
      value: Stain
      format: text
    - type: metadata
      value: npSchema.stainID
      title: Stain ID
    - type: metadata
      value: npSchema.blockID
      title: Block ID
      edit: true
      description: Block identifier
      required: true
  defaultSort:
    - type: metadata
      value: npSchema.stainID
      dir: up
    - type: record
      value: name
      dir: down

# Dialog configuration
itemListDialog:
  columns:
    - type: image
      value: thumbnail
      title: Thumbnail
    - type: record
      value: name
    - type: metadata
      value: Stain
      format: text
    - type: record
      value: size

# Item metadata configuration
itemMetadata:
  - value: stain
    title: Stain
    description: Staining method
    required: true
    enum:
      - Eosin
      - H&E
      - Other
    default: H&E
  - value: rating
    type: number
    minimum: 0
    maximum: 10
`;

    const validateYaml = (yamlContent) => {
        const errors = [];

        // Basic YAML structure validation
        if (!yamlContent.trim()) {
            errors.push('Configuration cannot be empty');
            return errors;
        }

        // Check for required sections
        const requiredSections = ['itemList'];
        requiredSections.forEach(section => {
            if (!yamlContent.includes(`${section}:`)) {
                errors.push(`Missing required section: ${section}`);
            }
        });

        // Check for valid YAML syntax (basic checks)
        const lines = yamlContent.split('\n');
        let indentLevel = 0;
        let inList = false;

        lines.forEach((line, index) => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;

            // Check for proper indentation
            const currentIndent = line.length - line.trimStart().length;
            if (currentIndent % 2 !== 0 && currentIndent > 0) {
                errors.push(`Line ${index + 1}: Invalid indentation (should be multiples of 2 spaces)`);
            }

            // Check for list items
            if (trimmed.startsWith('-')) {
                inList = true;
            } else if (trimmed.includes(':') && !inList) {
                inList = false;
            }
        });

        return errors;
    };

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (file.name !== '.large_image_config.yaml' && !file.name.endsWith('.yaml') && !file.name.endsWith('.yml')) {
            onError('Please select a YAML file (.yaml or .yml extension)');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            setConfigContent(content);
            setValidationErrors([]);
            setUploadStatus('');
        };
        reader.readAsText(file);
    };

    const handleLoadDefault = () => {
        setConfigContent(defaultConfig);
        setValidationErrors([]);
        setUploadStatus('');
    };

    const handleLoadFromServer = async () => {
        if (!dsaClient || !config.targetResourceId) {
            onError('Please configure DSA client and target resource ID first');
            return;
        }

        setIsUploading(true);
        setUploadStatus('');
        setValidationErrors([]);

        try {
            // Look for the .large_image_config.yaml file in the target folder
            const targetItems = await dsaClient.getResourceItems(config.targetResourceId, 0, undefined, config.resourceType || 'folder');
            const configFile = targetItems.find(item => item.name === '.large_image_config.yaml');

            if (!configFile) {
                setUploadStatus('ℹ️ No .large_image_config.yaml file found in target folder.');
                setIsUploading(false);
                return;
            }

            // Download the file content
            const response = await fetch(`${dsaClient.getNormalizedBaseUrl()}/api/v1/item/${configFile._id}/download`, {
                headers: {
                    'Girder-Token': dsaClient.getToken() || '',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to download config file: ${response.statusText}`);
            }

            const content = await response.text();
            setConfigContent(content);
            setUploadStatus('✅ Configuration loaded from server!');
            onError(''); // Clear any previous errors
        } catch (error) {
            const errorMsg = `Failed to load configuration: ${error.message}`;
            setUploadStatus(`❌ ${errorMsg}`);
            onError(errorMsg);
            console.error('Load error:', error);
        } finally {
            setIsUploading(false);
        }
    };

    const handleContentChange = (event) => {
        const content = event.target.value;
        setConfigContent(content);

        // Validate on change
        const errors = validateYaml(content);
        setValidationErrors(errors);
    };

    const handleUploadToServer = async () => {
        if (!dsaClient || !config.targetResourceId) {
            onError('Please configure DSA client and target resource ID first');
            return;
        }

        // Validate before upload
        const errors = validateYaml(configContent);
        if (errors.length > 0) {
            setValidationErrors(errors);
            onError('Please fix validation errors before uploading');
            return;
        }

        setIsUploading(true);
        setUploadStatus('');
        setValidationErrors([]);

        try {
            // Create a Blob with the YAML content
            const blob = new Blob([configContent], { type: 'application/x-yaml' });
            const file = new File([blob], '.large_image_config.yaml', { type: 'application/x-yaml' });

            console.log('🔧 File created:', {
                name: file.name,
                size: file.size,
                type: file.type,
                contentLength: configContent.length
            });
            console.log('🔧 Uploading .large_image_config.yaml to target folder:', config.targetResourceId);

            // Upload the file directly to the target folder
            const result = await dsaClient.uploadFile(config.targetResourceId, file, config.resourceType || 'folder');

            if (result.success) {
                setUploadStatus('✅ Configuration uploaded successfully to target folder!');
                onError(''); // Clear any previous errors
                console.log('✅ Large image config uploaded to:', result.item);
            } else {
                throw new Error(result.error || 'Upload failed');
            }
        } catch (error) {
            const errorMsg = `Failed to upload configuration: ${error.message}`;
            setUploadStatus(`❌ ${errorMsg}`);
            onError(errorMsg);
            console.error('Upload error:', error);
        } finally {
            setIsUploading(false);
        }
    };

    const handleDownloadConfig = () => {
        const blob = new Blob([configContent || defaultConfig], { type: 'text/yaml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '.large_image_config.yaml';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleClearConfig = () => {
        setConfigContent('');
        setValidationErrors([]);
        setUploadStatus('');
    };

    return (
        <div className="large-image-config-section">
            <h3>Large Image Configuration</h3>
            <p className="section-description">
                Upload or update the <code>.large_image_config.yaml</code> file to your target folder.
                This configures how items appear in DSA's large image viewer.
            </p>

            <div className="config-actions">
                <div className="action-group">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept=".yaml,.yml"
                        style={{ display: 'none' }}
                    />
                    <button
                        className="btn btn-secondary"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isLoading || isUploading}
                    >
                        📁 Load from File
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={handleLoadDefault}
                        disabled={isLoading || isUploading}
                    >
                        📋 Load Default Template
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={handleLoadFromServer}
                        disabled={isLoading || isUploading}
                    >
                        🔄 Load from Server
                    </button>
                </div>

                <div className="action-group">
                    <button
                        className="btn btn-primary"
                        onClick={handleUploadToServer}
                        disabled={isLoading || isUploading || !configContent.trim() || validationErrors.length > 0}
                    >
                        {isUploading ? '⏳ Uploading...' : '⬆️ Upload to Server'}
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={handleDownloadConfig}
                        disabled={isLoading || isUploading}
                    >
                        ⬇️ Download Config
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={handleClearConfig}
                        disabled={isLoading || isUploading}
                    >
                        🗑️ Clear
                    </button>
                </div>
            </div>

            {uploadStatus && (
                <div className={`upload-status ${uploadStatus.includes('✅') ? 'success' : 'error'}`}>
                    {uploadStatus}
                </div>
            )}

            {validationErrors.length > 0 && (
                <div className="validation-errors">
                    <h4>⚠️ Validation Errors:</h4>
                    <ul>
                        {validationErrors.map((error, index) => (
                            <li key={index}>{error}</li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="config-editor">
                <label htmlFor="config-content">
                    <strong>Configuration Content:</strong>
                </label>
                <textarea
                    id="config-content"
                    value={configContent}
                    onChange={handleContentChange}
                    placeholder="Paste your .large_image_config.yaml content here or load from file..."
                    rows={20}
                    disabled={isLoading || isUploading}
                    className={validationErrors.length > 0 ? 'error' : ''}
                />
                <div className="editor-info">
                    <small>
                        💡 Tip: Use the "Load Default Template" button to start with a basic configuration,
                        or upload an existing .yaml file to modify it.
                    </small>
                </div>
            </div>

            <div className="config-help">
                <details>
                    <summary>📖 Configuration Help</summary>
                    <div className="help-content">
                        <h4>Key Configuration Sections:</h4>
                        <ul>
                            <li><strong>itemList:</strong> Controls how items appear in folder listings</li>
                            <li><strong>itemListDialog:</strong> Controls how items appear in file dialogs</li>
                            <li><strong>itemMetadata:</strong> Defines metadata fields and their validation rules</li>
                            <li><strong>imageFramePresets:</strong> Defines viewing presets for images</li>
                        </ul>

                        <h4>Common Column Types:</h4>
                        <ul>
                            <li><strong>image:</strong> Display thumbnails or associated images</li>
                            <li><strong>record:</strong> Display item properties (name, size, created, etc.)</li>
                            <li><strong>metadata:</strong> Display custom metadata fields</li>
                        </ul>

                        <p>
                            <strong>Reference:</strong>
                            <a
                                href="https://girder.github.io/large_image/girder_config_options.html#large-image-config-yaml"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Large Image Configuration Documentation
                            </a>
                        </p>
                    </div>
                </details>
            </div>
        </div>
    );
};

export default LargeImageConfigSection;
