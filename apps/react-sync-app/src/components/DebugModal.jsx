import React from 'react';

const DebugModal = ({ debugInfo, onClose }) => {
  if (!debugInfo) return null;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(debugInfo.data, null, 2));
  };

  return (
    <div className="debug-modal-overlay" onClick={onClose}>
      <div className="debug-modal" onClick={(e) => e.stopPropagation()}>
        <div className="debug-modal-header">
          <h3>{debugInfo.title}</h3>
          <button className="debug-close-btn" onClick={onClose}>×</button>
        </div>
        <div className="debug-modal-content">
          <div className="debug-json">
            <pre>{JSON.stringify(debugInfo.data, null, 2)}</pre>
          </div>
          <div className="debug-actions">
            <button onClick={copyToClipboard}>Copy to Clipboard</button>
            <button onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DebugModal;
