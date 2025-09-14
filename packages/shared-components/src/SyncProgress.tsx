import React from 'react';
import { SyncProgress as SyncProgressType } from '@bdsa/shared-types';

interface SyncProgressProps {
  progress: SyncProgressType;
  onCancel?: () => void;
  showDetails?: boolean;
}

export const SyncProgress: React.FC<SyncProgressProps> = ({
  progress,
  onCancel,
  showDetails = true,
}) => {
  const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  const getStatusColor = () => {
    switch (progress.status) {
      case 'running':
        return '#007bff';
      case 'completed':
        return '#28a745';
      case 'error':
        return '#dc3545';
      default:
        return '#6c757d';
    }
  };

  const getStatusIcon = () => {
    switch (progress.status) {
      case 'running':
        return '🔄';
      case 'completed':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '⏸️';
    }
  };

  return (
    <div className="sync-progress">
      <div className="progress-header">
        <h4>
          {getStatusIcon()} Sync Progress
        </h4>
        {onCancel && progress.status === 'running' && (
          <button
            type="button"
            onClick={onCancel}
            className="cancel-btn"
          >
            Cancel
          </button>
        )}
      </div>

      <div className="progress-bar-container">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{
              width: `${percentage}%`,
              backgroundColor: getStatusColor(),
            }}
          />
        </div>
        <div className="progress-text">
          {progress.current} / {progress.total} ({percentage}%)
        </div>
      </div>

      {showDetails && (
        <div className="progress-details">
          {progress.currentItem && (
            <div className="current-item">
              <strong>Current:</strong> {progress.currentItem}
            </div>
          )}
          
          {progress.status === 'error' && progress.error && (
            <div className="error-message">
              <strong>Error:</strong> {progress.error}
            </div>
          )}
          
          {progress.status === 'completed' && (
            <div className="completion-message">
              ✅ Sync completed successfully!
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .sync-progress {
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 16px;
          margin: 16px 0;
          background: #f8f9fa;
        }

        .progress-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .progress-header h4 {
          margin: 0;
          color: #333;
        }

        .cancel-btn {
          background: #dc3545;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }

        .cancel-btn:hover {
          background: #c82333;
        }

        .progress-bar-container {
          margin-bottom: 12px;
        }

        .progress-bar {
          width: 100%;
          height: 20px;
          background: #e9ecef;
          border-radius: 10px;
          overflow: hidden;
          margin-bottom: 8px;
        }

        .progress-fill {
          height: 100%;
          transition: width 0.3s ease;
          border-radius: 10px;
        }

        .progress-text {
          text-align: center;
          font-size: 14px;
          color: #666;
        }

        .progress-details {
          font-size: 14px;
          color: #555;
        }

        .current-item {
          margin-bottom: 8px;
          word-break: break-all;
        }

        .error-message {
          color: #dc3545;
          background: #f8d7da;
          padding: 8px;
          border-radius: 4px;
          border: 1px solid #f5c6cb;
        }

        .completion-message {
          color: #28a745;
          background: #d4edda;
          padding: 8px;
          border-radius: 4px;
          border: 1px solid #c3e6cb;
        }
      `}</style>
    </div>
  );
};
