import React from 'react';

const SyncResultsSection = ({ 
  syncProgress, 
  syncResult, 
  sourceItems,
  uniqueBdsaCaseIds,
  modifiedItems 
}) => {
  return (
    <div className="sync-results">
      <div className="sync-progress">
        <h4>
          {syncProgress.status === 'running' ? '🔄' :
            syncProgress.status === 'completed' ? '✅' :
              syncProgress.status === 'error' ? '❌' : '⏸️'} Sync Progress
        </h4>
        {syncProgress.status === 'running' && (
          <div className="progress-details">
            <p>Processing: {syncProgress.currentItem}</p>
            <div className="progress-bar-container">
              <div
                className="progress-bar"
                style={{
                  width: `${syncProgress.total > 0 ? Math.round((syncProgress.current / syncProgress.total) * 100) : 0}%`,
                  backgroundColor: syncProgress.status === 'running' ? '#007bff' :
                    syncProgress.status === 'completed' ? '#28a745' :
                      syncProgress.status === 'error' ? '#dc3545' : '#6c757d',
                }}
              />
            </div>
            <p className="progress-text">
              {syncProgress.current} / {syncProgress.total} ({syncProgress.total > 0 ? Math.round((syncProgress.current / syncProgress.total) * 100) : 0}%)
            </p>
          </div>
        )}

        {syncProgress.status === 'completed' && (
          <div className="completion-message">
            ✅ Sync completed successfully!
          </div>
        )}

        {syncProgress.status === 'error' && (
          <div className="error-message">
            ❌ Error: {syncProgress.error}
          </div>
        )}
      </div>

      {syncResult && (
        <div className="sync-result">
          <h4>Sync Results</h4>
          <div className="result-summary">
            <p><strong>Processed:</strong> {syncResult.processed} items</p>
            <p><strong>Copied:</strong> {syncResult.copiedItems.length} items</p>
            <p><strong>Skipped:</strong> {syncResult.skippedDuplicates.length} duplicates</p>
            <p><strong>Errors:</strong> {syncResult.errors.length} errors</p>
            <p><strong>Created Folders:</strong> {syncResult.createdFolders.length} folders</p>
          </div>

          {syncResult.errors.length > 0 && (
            <div className="error-list">
              <h5>Errors:</h5>
              <ul>
                {syncResult.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {syncResult.copiedItems.length > 0 && (
            <div className="copied-items">
              <h5>Copied Items:</h5>
              <ul>
                {syncResult.copiedItems.slice(0, 10).map((item, index) => (
                  <li key={index}>
                    {item.originalName} → {item.newName}
                  </li>
                ))}
                {syncResult.copiedItems.length > 10 && (
                  <li>... and {syncResult.copiedItems.length - 10} more</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Statistics Section */}
      {sourceItems.length > 0 && (
        <div className="statistics">
          <h4>Statistics</h4>
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-value">{sourceItems.length}</div>
              <div className="stat-label">Total Source Items</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{uniqueBdsaCaseIds.length}</div>
              <div className="stat-label">Unique BDSA Case IDs</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">
                {sourceItems.filter(item => item.bdsaCaseId && item.bdsaCaseId !== 'unknown' && item.bdsaCaseId.trim() !== '').length}
              </div>
              <div className="stat-label">Items with BDSA Case ID</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">
                {sourceItems.filter(item => !item.bdsaCaseId || item.bdsaCaseId === 'unknown' || item.bdsaCaseId.trim() === '').length}
              </div>
              <div className="stat-label">Items Missing BDSA Case ID</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">
                {sourceItems.filter(item => item.BDSA?.bdsaLocal?.bdsaStainProtocol && item.BDSA.bdsaLocal.bdsaStainProtocol.length > 0).length}
              </div>
              <div className="stat-label">Items with Stain Protocols</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">
                {sourceItems.filter(item => item.BDSA?.bdsaLocal?.bdsaRegionProtocol && item.BDSA.bdsaLocal.bdsaRegionProtocol.length > 0).length}
              </div>
              <div className="stat-label">Items with Region Protocols</div>
            </div>
            <div className="stat-item">
              <div className="stat-value" style={{ color: modifiedItems.size > 0 ? '#ff6b35' : '#007bff' }}>
                {modifiedItems.size}
              </div>
              <div className="stat-label">Modified Items (Need Sync)</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SyncResultsSection;
