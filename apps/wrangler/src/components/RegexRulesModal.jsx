import React, { useState, useEffect } from 'react';
import './RegexRulesModal.css';
import dsaAuthStore from '../utils/dsaAuthStore';
import { syncRegexRulesToFolder } from '../utils/dsaIntegration';
import {
    getDefaultRegexRules,
    getEnabledPatterns,
    normalizeRegexRules,
    testPatternAgainstFilename,
} from '../utils/regexExtractor';

async function persistRulesToFolder(normalized) {
    const authStatus = dsaAuthStore.getStatus();
    if (!authStatus.isAuthenticated || !authStatus.isConfigured) {
        return;
    }
    const config = dsaAuthStore.getConfig();
    const folderId = config.metadataSyncTargetFolder?.trim() || config.resourceId;
    if (!folderId) {
        return;
    }
    try {
        const result = await syncRegexRulesToFolder(
            config.baseUrl,
            folderId,
            dsaAuthStore.getToken(),
            normalized,
            ''
        );
        if (!result.success) {
            console.warn('Could not save regex rules to folder:', result.error);
        }
    } catch (error) {
        console.warn('Could not save regex rules to folder:', error.message);
    }
}

const RegexRulesModal = ({
    isOpen,
    onClose,
    onApplied,
    currentRules,
    sampleData,
}) => {
    const [rules, setRules] = useState(() => (
        currentRules ? normalizeRegexRules(currentRules) : getDefaultRegexRules()
    ));
    const [testResults, setTestResults] = useState({});
    const [forceOverride, setForceOverride] = useState(false);

    useEffect(() => {
        if (currentRules) {
            setRules(normalizeRegexRules(currentRules));
        }
    }, [currentRules]);

    const addPattern = () => {
        const newPattern = {
            id: `pattern-${Date.now()}`,
            name: 'New Pattern',
            pattern: '',
            description: 'Enter pattern description',
            example: 'example.filename',
            priority: (rules.patterns || []).length + 1,
            enabled: true
        };

        setRules((prev) => ({
            ...prev,
            patterns: [...(prev.patterns || []), newPattern]
        }));
    };

    const updatePattern = (patternId, field, value) => {
        setRules((prev) => ({
            ...prev,
            patterns: prev.patterns.map((pattern) => (
                pattern.id === patternId
                    ? { ...pattern, [field]: value }
                    : pattern
            ))
        }));
    };

    const deletePattern = (patternId) => {
        setRules((prev) => ({
            ...prev,
            patterns: prev.patterns.filter((pattern) => pattern.id !== patternId)
        }));
    };

    const movePattern = (patternId, direction) => {
        setRules((prev) => {
            const patterns = [...(prev.patterns || [])];
            const index = patterns.findIndex((p) => p.id === patternId);

            if (direction === 'up' && index > 0) {
                [patterns[index], patterns[index - 1]] = [patterns[index - 1], patterns[index]];
            } else if (direction === 'down' && index >= 0 && index < patterns.length - 1) {
                [patterns[index], patterns[index + 1]] = [patterns[index + 1], patterns[index]];
            }

            patterns.forEach((pattern, idx) => {
                pattern.priority = idx + 1;
            });

            return { ...prev, patterns };
        });
    };

    const testAllRules = () => {
        if (!sampleData || sampleData.length === 0) {
            alert('No sample data available for testing. Please load DSA data first.');
            return;
        }

        const enabled = getEnabledPatterns(rules);
        if (enabled.length === 0) {
            alert('No regex patterns defined. Please add some patterns first.');
            return;
        }

        const results = {};
        sampleData.slice(0, 5).forEach((item, index) => {
            const fileName = item.name || item.dsa_name || '';
            results[index] = { fileName, results: {} };
            enabled.forEach((pattern) => {
                results[index].results[pattern.name || pattern.id] = testPatternAgainstFilename(
                    pattern.pattern,
                    fileName,
                    pattern.field
                );
            });
        });
        setTestResults(results);
    };

    const handleApplyRegexRules = async () => {
        const { default: dataStore } = await import('../utils/dataStore');
        const dataStatus = dataStore.getStatus();

        if (!dataStatus.processedData || dataStatus.processedData.length === 0) {
            alert('No data loaded. Please load data first.');
            return;
        }

        const normalized = normalizeRegexRules(rules);
        if (getEnabledPatterns(normalized).length === 0) {
            alert('No regex patterns defined. Please add some patterns first.');
            return;
        }

        const confirmMessage = forceOverride
            ? 'Re-apply regex and replace values previously filled by regex.\n\nManual edits and column mappings are left alone.\n\nContinue?'
            : 'Apply regex to empty fields only.\n\nExisting values are left alone.\n\nContinue?';

        if (!window.confirm(confirmMessage)) {
            return;
        }

        try {
            const result = dataStore.applyRegexRules(normalized, true, forceOverride);
            if (!result.success) {
                alert(`Could not apply regex rules: ${result.error}`);
                return;
            }
            await persistRulesToFolder(normalized);
            if (typeof onApplied === 'function') {
                onApplied(normalized);
            }
            alert(
                `Applied regex rules.\n\n` +
                `Items processed: ${result.totalItems}\n` +
                `Items updated: ${result.updatedItems || result.extractedCount}\n` +
                `Items skipped: ${result.skippedItems || 0}`
            );
            onClose();
        } catch (error) {
            console.error('Error applying regex rules:', error);
            alert(`Could not apply regex rules: ${error.message}`);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="regex-modal-overlay">
            <div className="regex-modal-content">
                <div className="regex-modal-header">
                    <h2>Regex Rules for Data Extraction</h2>
                    <div className="regex-header-actions">
                        <button className="regex-modal-close" onClick={onClose}>×</button>
                    </div>
                </div>

                <div className="regex-modal-body">
                    <div className="regex-tab-content">
                        <div className="regex-field-config">
                            <div className="pattern-management-header">
                                <h3>Filename patterns</h3>
                                <p>Enabled patterns are tried in order. The first match fills local case, stain, and region from named groups.</p>
                                <div className="pattern-actions">
                                    <button
                                        onClick={addPattern}
                                        className="add-pattern-btn"
                                        title="Add new pattern"
                                    >
                                        Add Pattern
                                    </button>
                                </div>
                            </div>

                            <div className="patterns-table-container">
                                <table className="patterns-table">
                                    <thead>
                                        <tr>
                                            <th>Priority</th>
                                            <th>Name</th>
                                            <th>Enabled</th>
                                            <th>Description</th>
                                            <th>Regex Pattern</th>
                                            <th>Example</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(rules.patterns || []).map((pattern, index) => (
                                            <tr key={pattern.id} className={`pattern-row ${!pattern.enabled ? 'disabled' : ''}`}>
                                                <td className="priority-cell">#{pattern.priority}</td>
                                                <td className="name-cell">
                                                    <input
                                                        type="text"
                                                        value={pattern.name}
                                                        onChange={(e) => updatePattern(pattern.id, 'name', e.target.value)}
                                                        className="pattern-name-input"
                                                        placeholder="Pattern name"
                                                    />
                                                </td>
                                                <td className="enabled-cell">
                                                    <input
                                                        type="checkbox"
                                                        checked={pattern.enabled}
                                                        onChange={(e) => updatePattern(pattern.id, 'enabled', e.target.checked)}
                                                    />
                                                </td>
                                                <td className="description-cell">
                                                    <input
                                                        type="text"
                                                        value={pattern.description}
                                                        onChange={(e) => updatePattern(pattern.id, 'description', e.target.value)}
                                                        placeholder="Pattern description"
                                                        className="pattern-description-input"
                                                    />
                                                </td>
                                                <td className="regex-cell">
                                                    <input
                                                        type="text"
                                                        value={pattern.pattern}
                                                        onChange={(e) => updatePattern(pattern.id, 'pattern', e.target.value)}
                                                        placeholder="^(?&lt;localCaseId&gt;\d+)_(?&lt;localStainID&gt;\w+)$"
                                                        className="pattern-regex-input"
                                                    />
                                                </td>
                                                <td className="example-cell">
                                                    <input
                                                        type="text"
                                                        value={pattern.example}
                                                        onChange={(e) => updatePattern(pattern.id, 'example', e.target.value)}
                                                        placeholder="example.filename"
                                                        className="pattern-example-input"
                                                    />
                                                </td>
                                                <td className="actions-cell">
                                                    <button
                                                        onClick={() => movePattern(pattern.id, 'up')}
                                                        disabled={index === 0}
                                                        title="Move up"
                                                        className="action-btn"
                                                    >
                                                        ↑
                                                    </button>
                                                    <button
                                                        onClick={() => movePattern(pattern.id, 'down')}
                                                        disabled={index === (rules.patterns || []).length - 1}
                                                        title="Move down"
                                                        className="action-btn"
                                                    >
                                                        ↓
                                                    </button>
                                                    <button
                                                        onClick={() => deletePattern(pattern.id)}
                                                        className="action-btn delete-btn"
                                                        title="Delete pattern"
                                                    >
                                                        Delete
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="regex-test-section">
                                <h4>Test against loaded filenames</h4>
                                <button onClick={testAllRules} className="regex-test-btn">
                                    Test first 5 files
                                </button>

                                {Object.keys(testResults).length > 0 && (
                                    <div className="regex-test-results">
                                        {Object.keys(testResults).map((index) => (
                                            <div key={index} className="regex-test-item">
                                                <div className="regex-test-filename">
                                                    <strong>{testResults[index].fileName}</strong>
                                                </div>
                                                <div className="regex-test-extractions">
                                                    {Object.keys(testResults[index].results).map((field) => {
                                                        const result = testResults[index].results[field];
                                                        if (result && typeof result === 'object' && !result.error) {
                                                            return Object.entries(result).map(([key, value]) => (
                                                                <div key={`${field}-${key}`} className="regex-test-field">
                                                                    <span className="regex-field-name">{key}:</span>
                                                                    <span className="regex-field-value success">
                                                                        {value || 'No match'}
                                                                    </span>
                                                                </div>
                                                            ));
                                                        }
                                                        return (
                                                            <div key={field} className="regex-test-field">
                                                                <span className="regex-field-name">{field}:</span>
                                                                <span className={`regex-field-value ${result ? 'success' : 'empty'}`}>
                                                                    {result ? (result.error ? `Error: ${result.error}` : result) : 'No match'}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="regex-modal-footer">
                        <div className="regex-footer-left">
                            <label className="regex-override-checkbox" title="Replace values previously filled by regex. Manual edits and column mappings stay protected.">
                                <input
                                    type="checkbox"
                                    checked={forceOverride}
                                    onChange={(e) => setForceOverride(e.target.checked)}
                                />
                                <span>Override existing regex values</span>
                            </label>
                        </div>
                        <div className="regex-footer-right">
                            <button onClick={onClose} className="regex-cancel-btn">Cancel</button>
                            <button onClick={handleApplyRegexRules} className="regex-apply-btn">Apply</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RegexRulesModal;
