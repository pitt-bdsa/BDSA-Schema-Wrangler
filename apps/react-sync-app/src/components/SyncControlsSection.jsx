import React from 'react';

const SyncControlsSection = ({
    sourceItems,
    targetItems,
    isLoading,
    syncProgress,
    onLoadSourceItems,
    onLoadTargetItems,
    onCreateFolders,
    onStartSync
}) => {
    return (
        <div className="sync-controls">
            <h3>Sync Controls</h3>
            <div className="form-group">
                <button
                    className="btn btn-secondary"
                    onClick={onLoadSourceItems}
                    disabled={isLoading}
                >
                    {isLoading ? 'Loading...' : 'Load Source Items'}
                </button>
                <span className="item-count">
                    {sourceItems.length} items loaded
                </span>
            </div>

            <div className="form-group">
                <button
                    className="btn btn-secondary"
                    onClick={onLoadTargetItems}
                    disabled={isLoading}
                >
                    {isLoading ? 'Loading...' : 'Load Target Items'}
                </button>
                <span className="item-count">
                    {targetItems.length} items loaded
                </span>
            </div>

            <div className="form-group">
                <button
                    className="btn btn-primary"
                    onClick={onCreateFolders}
                    disabled={isLoading || sourceItems.length === 0}
                    style={{ marginRight: '10px' }}
                >
                    Create Folders
                </button>
                <button
                    className="btn btn-success"
                    onClick={onStartSync}
                    disabled={isLoading || sourceItems.length === 0 || syncProgress.status === 'running'}
                >
                    Start Sync
                </button>
            </div>
        </div>
    );
};

export default SyncControlsSection;
