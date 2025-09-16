import React, { useState, useEffect } from 'react';
import './ApplyAllCasesModal.css';

const ApplyAllCasesModal = ({ isOpen, onClose, onApplyAll, protocolType, totalCases }) => {
    const [progress, setProgress] = useState({
        current: 0,
        total: totalCases || 0,
        percentage: 0,
        applied: 0,
        skipped: 0,
        currentCase: null
    });
    const [isRunning, setIsRunning] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [results, setResults] = useState(null);

    useEffect(() => {
        if (isOpen) {
            // Reset state when modal opens
            setProgress({
                current: 0,
                total: totalCases || 0,
                percentage: 0,
                applied: 0,
                skipped: 0,
                currentCase: null
            });
            setIsRunning(false);
            setIsComplete(false);
            setResults(null);
        }
    }, [isOpen, totalCases]);

    const handleStart = async () => {
        setIsRunning(true);
        setIsComplete(false);
        setResults(null);

        try {
            const results = await onApplyAll((updateProgress) => {
                setProgress(updateProgress);
            });

            setResults(results);
            setIsComplete(true);
        } catch (error) {
            console.error('Error during apply all:', error);
            setResults({ error: error.message });
            setIsComplete(true);
        } finally {
            setIsRunning(false);
        }
    };

    const handleClose = () => {
        if (!isRunning) {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal-content apply-all-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Apply {protocolType === 'stain' ? 'Stain' : 'Region'} Protocols to All Cases</h2>
                    <button
                        className="close-modal-btn"
                        onClick={handleClose}
                        title="Close"
                        disabled={isRunning}
                    >
                        ×
                    </button>
                </div>
                <div className="modal-body">
                    <div className="apply-all-info">
                        <p>This will apply high-confidence protocol suggestions to all {totalCases} cases.</p>
                        <p>Only suggestions with ≥80% confidence and exact matches will be applied.</p>
                    </div>

                    {!isRunning && !isComplete && (
                        <div className="apply-all-actions">
                            <button
                                className="start-apply-btn"
                                onClick={handleStart}
                            >
                                🚀 Start Applying to All Cases
                            </button>
                            <button
                                className="cancel-apply-btn"
                                onClick={handleClose}
                            >
                                Cancel
                            </button>
                        </div>
                    )}

                    {(isRunning || isComplete) && (
                        <div className="apply-all-progress">
                            <div className="progress-header">
                                <h3>Processing Cases...</h3>
                                {progress.currentCase && (
                                    <div className="current-case">
                                        Currently processing: <strong>{progress.currentCase}</strong>
                                    </div>
                                )}
                            </div>

                            <div className="progress-bar">
                                <div
                                    className="progress-fill"
                                    style={{ width: `${progress.percentage}%` }}
                                ></div>
                            </div>

                            <div className="progress-text">
                                {progress.current} / {progress.total} cases
                                ({Math.round(progress.percentage)}%)
                            </div>

                            <div className="progress-details">
                                ✅ {progress.applied} applied |
                                ⚠️ {progress.skipped} skipped
                            </div>
                        </div>
                    )}

                    {isComplete && results && (
                        <div className="apply-all-results">
                            <h3>Results</h3>
                            {results.error ? (
                                <div className="error-message">
                                    ❌ Error: {results.error}
                                </div>
                            ) : (
                                <div className="success-message">
                                    <div className="results-summary">
                                        ✅ Applied {results.applied} protocol suggestions across {results.processed} cases
                                    </div>
                                    {results.skipped > 0 && (
                                        <div className="results-details">
                                            ⚠️ Skipped {results.skipped} stain types due to ambiguity
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="results-actions">
                                <button
                                    className="close-results-btn"
                                    onClick={handleClose}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ApplyAllCasesModal;
