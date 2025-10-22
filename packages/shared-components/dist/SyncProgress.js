import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
export const SyncProgress = ({ progress, onCancel, showDetails = true, }) => {
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
    return (_jsxs("div", { className: "sync-progress", children: [_jsxs("div", { className: "progress-header", children: [_jsxs("h4", { children: [getStatusIcon(), " Sync Progress"] }), onCancel && progress.status === 'running' && (_jsx("button", { type: "button", onClick: onCancel, className: "cancel-btn", children: "Cancel" }))] }), _jsxs("div", { className: "progress-bar-container", children: [_jsx("div", { className: "progress-bar", children: _jsx("div", { className: "progress-fill", style: {
                                width: `${percentage}%`,
                                backgroundColor: getStatusColor(),
                            } }) }), _jsxs("div", { className: "progress-text", children: [progress.current, " / ", progress.total, " (", percentage, "%)"] })] }), showDetails && (_jsxs("div", { className: "progress-details", children: [progress.currentItem && (_jsxs("div", { className: "current-item", children: [_jsx("strong", { children: "Current:" }), " ", progress.currentItem] })), progress.status === 'error' && progress.error && (_jsxs("div", { className: "error-message", children: [_jsx("strong", { children: "Error:" }), " ", progress.error] })), progress.status === 'completed' && (_jsx("div", { className: "completion-message", children: "\u2705 Sync completed successfully!" }))] })), _jsx("style", { children: `
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
      ` })] }));
};
