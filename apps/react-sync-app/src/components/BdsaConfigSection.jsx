import React from 'react';

const BdsaConfigSection = ({
  metadataConfig,
  onConfigChange,
  isLoading
}) => {
  return (
    <div className="metadata-config">
      <h3>BDSA Configuration</h3>
      <div className="config-section">
        <label>
          BDSA Naming Template:
          <input
            type="text"
            value={metadataConfig.bdsaNamingTemplate}
            onChange={(e) => onConfigChange('bdsaNamingTemplate', e.target.value)}
            placeholder="{bdsaCaseId}-{bdsaRegionProtocol}-{bdsaStainProtocol}"
            disabled={isLoading}
          />
          <small className="help-text">
            Available placeholders: {'{bdsaCaseId}'}, {'{bdsaRegionProtocol}'}, {'{bdsaStainProtocol}'}, {'{originalName}'}
          </small>
        </label>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={metadataConfig.syncAllItems}
            onChange={(e) => onConfigChange('syncAllItems', e.target.checked)}
            disabled={isLoading}
          />
          Sync All Items
        </label>
        <small className="help-text">
          <strong>Checked:</strong> Sync all items (recommended for first-time sync)<br />
          <strong>Unchecked:</strong> Only sync items that have been modified since last sync
        </small>
      </div>
    </div>
  );
};

export default BdsaConfigSection;
