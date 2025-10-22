import React, { useState, useEffect } from 'react';
import './RegexRulesModal.css';
import { REGEX_RULE_SETS } from '../utils/constants.js';
import dsaAuthStore from '../utils/dsaAuthStore';
import { syncRegexRulesToFolder, getRegexRulesFromFolder } from '../utils/dsaIntegration';

const RegexRulesModal = ({ isOpen, onClose, onSave, currentRules, selectedRuleSet: initialSelectedRuleSet, sampleData }) => {
    const [rules, setRules] = useState({
        patterns: [
            {
                id: 'pattern-1',
                name: 'Underscore Format',
                pattern: '^(?<localCaseId>\\d+)_(?<regionNumber>\\d+)_(?<localStainID>[A-Za-z0-9_-]+)_(?<slideNumber>\\d+)$',
                description: 'Format: 550058_2_Sil_1.mrxs',
                example: '550058_2_Sil_1.mrxs',
                priority: 1,
                enabled: true
            },
            {
                id: 'pattern-2',
                name: 'Space Format',
                pattern: '^(?<localCaseId>\\d+)\\s+(?<localRegionId>\\w+)\\s+(?<localStainID>\\w+)_(?<imageType>\\w+)$',
                description: 'Format: 20232824 B TDP43_LabelArea_Image.optimized.tiff',
                example: '20232824 B TDP43_LabelArea_Image.optimized.tiff',
                priority: 2,
                enabled: true
            },
            {
                id: 'pattern-3',
                name: 'Extended Format',
                pattern: '^(?<localCaseId>\\d+)\\s+(?<localRegionId>\\w+)\\s+(?<localStainID>\\w+)_(?<imageType>\\w+)_(?<extendedType>\\w+)$',
                description: 'Format: 20243819 H PTDP43_Default_Extended.optimized.tiff',
                example: '20243819 H PTDP43_Default_Extended.optimized.tiff',
                priority: 3,
                enabled: true
            }
        ]
    });

    const [testResults, setTestResults] = useState({});
    const [selectedRuleSet, setSelectedRuleSet] = useState(initialSelectedRuleSet || '');
    const [showRuleSetSelector, setShowRuleSetSelector] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [forceOverride, setForceOverride] = useState(false);

    useEffect(() => {
        if (currentRules) {
            // Ensure currentRules has a patterns array
            const rulesWithPatterns = {
                ...currentRules,
                patterns: currentRules.patterns || []
            };
            setRules(rulesWithPatterns);
        }
    }, [currentRules]);

    useEffect(() => {
        if (initialSelectedRuleSet) {
            setSelectedRuleSet(initialSelectedRuleSet);
        }
    }, [initialSelectedRuleSet]);

    const handleRuleChange = (property, value) => {
        setRules(prev => ({
            ...prev,
            primaryPattern: {
                ...prev.primaryPattern,
                [property]: value
            }
        }));
    };

    // Pattern management functions
    const addPattern = () => {
        const newPattern = {
            id: `pattern-${Date.now()}`,
            name: 'New Pattern',
            pattern: '',
            description: 'Enter pattern description',
            example: 'example.filename',
            priority: rules.patterns.length + 1,
            enabled: true
        };

        setRules(prev => ({
            ...prev,
            patterns: [...prev.patterns, newPattern]
        }));
    };

    const updatePattern = (patternId, field, value) => {
        setRules(prev => ({
            ...prev,
            patterns: prev.patterns.map(pattern =>
                pattern.id === patternId
                    ? { ...pattern, [field]: value }
                    : pattern
            )
        }));
    };

    const deletePattern = (patternId) => {
        setRules(prev => ({
            ...prev,
            patterns: prev.patterns.filter(pattern => pattern.id !== patternId)
        }));
    };

    const movePattern = (patternId, direction) => {
        setRules(prev => {
            const patterns = [...prev.patterns];
            const index = patterns.findIndex(p => p.id === patternId);

            if (direction === 'up' && index > 0) {
                [patterns[index], patterns[index - 1]] = [patterns[index - 1], patterns[index]];
            } else if (direction === 'down' && index < patterns.length - 1) {
                [patterns[index], patterns[index + 1]] = [patterns[index + 1], patterns[index]];
            }

            // Update priorities
            patterns.forEach((pattern, idx) => {
                pattern.priority = idx + 1;
            });

            return { ...prev, patterns };
        });
    };

    const testRegex = (pattern, testString) => {
        if (!pattern || !testString) return null;

        try {
            const regex = new RegExp(pattern);
            const match = testString.match(regex);

            if (match && match.groups) {
                // Return the named groups if they exist
                return match.groups;
            } else if (match) {
                // Fallback: return the first capture group if it exists, otherwise the full match
                return { primaryPattern: match[1] || match[0] };
            }
            return null;
        } catch (error) {
            return { error: error.message };
        }
    };

    const testAllRules = () => {
        if (!sampleData || sampleData.length === 0) {
            alert('No sample data available for testing. Please load DSA data first.');
            return;
        }

        const results = {};
        const testSample = sampleData.slice(0, 5); // Test first 5 items

        testSample.forEach((item, index) => {
            const fileName = item.name || item.dsa_name || '';
            results[index] = {
                fileName,
                results: {}
            };

            Object.keys(rules).forEach(field => {
                const pattern = rules[field].pattern;
                if (pattern) {
                    results[index].results[field] = testRegex(pattern, fileName);
                }
            });
        });

        setTestResults(results);
    };

    const handleSave = () => {
        onSave(rules, selectedRuleSet);
        onClose();
    };

    const handleApplyRegexRules = async () => {
        // Import dataStore dynamically to avoid circular dependencies
        const { default: dataStore } = await import('../utils/dataStore');

        // Get current data status
        const dataStatus = dataStore.getStatus();

        if (!dataStatus.processedData || dataStatus.processedData.length === 0) {
            alert('No data loaded. Please load data first.');
            return;
        }

        // Check if there are any rules to apply
        const hasPrimaryPattern = rules.primaryPattern?.pattern && rules.primaryPattern.pattern.trim() !== '';
        const hasRules = hasPrimaryPattern;

        if (!hasRules) {
            alert('No regex patterns defined. Please add some patterns first.');
            return;
        }

        // Confirm before applying
        const confirmMessage = forceOverride
            ? '🔄 REGEX OVERRIDE MODE 🔄\n\n' +
            'This will re-apply REGEX rules and REPLACE values that were previously filled by regex.\n\n' +
            '✅ Will override:\n' +
            '- Empty fields\n' +
            '- Values from previous regex rules\n\n' +
            '🛡️ PROTECTED (will NOT override):\n' +
            '- Manual edits\n' +
            '- Column mappings\n\n' +
            'Use this when you\'ve corrected a regex pattern and need to re-extract.\n\n' +
            'Continue?'
            : 'This will apply REGEX rules to extract data from filenames.\n\n' +
            '✅ SAFE MODE: Rules will ONLY be applied to:\n' +
            '- Empty fields (no existing value)\n\n' +
            '🛡️ PROTECTED: Manual edits, column mappings, and existing regex values will NOT be overwritten.\n\n' +
            'Continue?';

        const confirmed = window.confirm(confirmMessage);

        if (!confirmed) {
            return;
        }

        try {
            // Debug: Log the rules being applied
            console.log('🔍 Applying REGEX rules:', rules);
            console.log('🔍 Rules summary:', Object.entries(rules).map(([field, rule]) => ({
                field,
                pattern: rule.pattern,
                hasPattern: !!rule.pattern && rule.pattern.trim() !== ''
            })));

            // Apply regex rules - only mark as modified when in override mode
            // Pass forceOverride flag to override all existing values if requested
            console.log('🔍 About to apply regex rules with:', {
                rules,
                markAsModified: forceOverride, // Only mark as modified when overriding
                forceOverride,
                checkboxChecked: forceOverride
            });

            const result = dataStore.applyRegexRules(rules, forceOverride, forceOverride);

            console.log('🔍 REGEX application result:', result);

            if (result.success) {
                const message = `✅ REGEX Rules Applied Successfully!\n\n` +
                    `📊 Results:\n` +
                    `- Items processed: ${result.totalItems}\n` +
                    `- Items updated: ${result.updatedItems || result.extractedCount}\n` +
                    `- Items skipped (already had values): ${result.skippedItems || (result.totalItems - (result.updatedItems || result.extractedCount))}\n` +
                    `- Fields extracted: ${result.extractedCount}`;

                alert(message);

                // Close the modal after successful application
                onClose();
            } else {
                alert(`❌ Error applying REGEX rules: ${result.error}`);
            }
        } catch (error) {
            console.error('Error applying regex rules:', error);
            alert(`❌ Error applying REGEX rules: ${error.message}`);
        }
    };

    const handleRuleSetSelect = (ruleSetKey) => {
        const ruleSet = REGEX_RULE_SETS[ruleSetKey];
        if (ruleSet) {
            setRules(ruleSet.rules);
            setSelectedRuleSet(ruleSetKey);
            setShowRuleSetSelector(false);
        }
    };

    const handleCustomRules = () => {
        setShowRuleSetSelector(false);
        setSelectedRuleSet('');
    };


    const handlePushToDSA = async () => {
        const authStatus = dsaAuthStore.getStatus();

        if (!authStatus.isAuthenticated) {
            alert('Please login to DSA server first');
            return;
        }

        if (!authStatus.isConfigured) {
            alert('Please configure DSA server first');
            return;
        }

        setIsSyncing(true);
        try {
            await dsaAuthStore.testConnection();

            const config = dsaAuthStore.getConfig();
            // Use metadataSyncTargetFolder if set, otherwise fall back to resourceId
            const metadataTargetFolder = config.metadataSyncTargetFolder && config.metadataSyncTargetFolder.trim()
                ? config.metadataSyncTargetFolder.trim()
                : config.resourceId;

            const result = await syncRegexRulesToFolder(
                config.baseUrl,
                metadataTargetFolder,
                dsaAuthStore.getToken(),
                rules,
                selectedRuleSet
            );

            if (result.success) {
                alert('Regex rules pushed successfully to DSA server!');
            } else {
                alert(`Push failed: ${result.error}`);
            }
        } catch (error) {
            alert(`DSA push failed: ${error.message}`);
        } finally {
            setIsSyncing(false);
        }
    };

    const handlePullFromDSA = async () => {
        const authStatus = dsaAuthStore.getStatus();

        if (!authStatus.isAuthenticated) {
            alert('Please login to DSA server first');
            return;
        }

        if (!authStatus.isConfigured) {
            alert('Please configure DSA server first');
            return;
        }

        setIsSyncing(true);
        try {
            await dsaAuthStore.testConnection();

            const config = dsaAuthStore.getConfig();
            // Use metadataSyncTargetFolder if set, otherwise fall back to resourceId
            const metadataTargetFolder = config.metadataSyncTargetFolder && config.metadataSyncTargetFolder.trim()
                ? config.metadataSyncTargetFolder.trim()
                : config.resourceId;

            const result = await getRegexRulesFromFolder(
                config.baseUrl,
                metadataTargetFolder,
                dsaAuthStore.getToken()
            );

            if (result.success && result.regexRules) {
                const pulledRules = result.regexRules.rules;
                const pulledRuleSetName = result.regexRules.ruleSetName || '';

                // Confirm before overwriting
                if (!window.confirm('This will overwrite your current regex rules with the versions from the DSA server. Continue?')) {
                    setIsSyncing(false);
                    return;
                }

                setRules(pulledRules);
                setSelectedRuleSet(pulledRuleSetName);
                alert('Regex rules pulled successfully from DSA server!');
            } else {
                alert('No regex rules found on DSA server.');
            }
        } catch (error) {
            alert(`DSA pull failed: ${error.message}`);
        } finally {
            setIsSyncing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="regex-modal-overlay">
            <div className="regex-modal-content">
                <div className="regex-modal-header">
                    <h2>Regex Rules for Data Extraction</h2>
                    <div className="regex-header-actions">
                        <button
                            className="regex-rule-set-btn"
                            onClick={() => setShowRuleSetSelector(!showRuleSetSelector)}
                        >
                            {selectedRuleSet ? `Using: ${REGEX_RULE_SETS[selectedRuleSet]?.name}` : 'Choose Rule Set'}
                        </button>
                        <button className="regex-modal-close" onClick={onClose}>×</button>
                    </div>
                </div>

                {showRuleSetSelector && (
                    <div className="regex-rule-set-selector">
                        <h3>Select a Predefined Rule Set</h3>
                        <div className="regex-rule-set-options">
                            {Object.entries(REGEX_RULE_SETS).map(([key, ruleSet]) => (
                                <div key={key} className="regex-rule-set-option">
                                    <h4>{ruleSet.name}</h4>
                                    <p>{ruleSet.description}</p>
                                    <button
                                        className="regex-use-rule-set-btn"
                                        onClick={() => handleRuleSetSelect(key)}
                                    >
                                        Use This Rule Set
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="regex-rule-set-actions">
                            <button
                                className="regex-custom-rules-btn"
                                onClick={handleCustomRules}
                            >
                                Create Custom Rules
                            </button>
                        </div>
                    </div>
                )}

                <div className="regex-modal-body">
                    <div className="regex-tab-content">
                        <div className="regex-field-config">
                            <div className="pattern-management-header">
                                <h3>📝 Regex Pattern Management</h3>
                                <p>Manage multiple regex patterns with fallback priority. Patterns are tested in order until one matches.</p>

                                <div className="pattern-actions">
                                    <button
                                        onClick={addPattern}
                                        className="add-pattern-btn"
                                        title="Add new pattern"
                                    >
                                        ➕ Add Pattern
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
                                        {rules.patterns && rules.patterns.map((pattern, index) => (
                                            <tr key={pattern.id} className={`pattern-row ${!pattern.enabled ? 'disabled' : ''}`}>
                                                <td className="priority-cell">
                                                    #{pattern.priority}
                                                </td>
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
                                                        ⬆️
                                                    </button>
                                                    <button
                                                        onClick={() => movePattern(pattern.id, 'down')}
                                                        disabled={index === rules.patterns.length - 1}
                                                        title="Move down"
                                                        className="action-btn"
                                                    >
                                                        ⬇️
                                                    </button>
                                                    <button
                                                        onClick={() => deletePattern(pattern.id)}
                                                        className="action-btn delete-btn"
                                                        title="Delete pattern"
                                                    >
                                                        🗑️
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>


                            <div className="regex-test-section">
                                <h4>Test Results</h4>
                                <button onClick={testAllRules} className="regex-test-btn">
                                    Test All Rules
                                </button>

                                {Object.keys(testResults).length > 0 && (
                                    <div className="regex-test-results">
                                        {Object.keys(testResults).map(index => (
                                            <div key={index} className="regex-test-item">
                                                <div className="regex-test-filename">
                                                    <strong>{testResults[index].fileName}</strong>
                                                </div>
                                                <div className="regex-test-extractions">
                                                    {Object.keys(testResults[index].results).map(field => {
                                                        const result = testResults[index].results[field];
                                                        if (result && typeof result === 'object' && !result.error) {
                                                            // Display individual named groups
                                                            return Object.entries(result).map(([key, value]) => (
                                                                <div key={`${field}-${key}`} className="regex-test-field">
                                                                    <span className="regex-field-name">{key}:</span>
                                                                    <span className="regex-field-value success">
                                                                        {value || 'No match'}
                                                                    </span>
                                                                </div>
                                                            ));
                                                        } else {
                                                            // Fallback for simple results
                                                            return (
                                                                <div key={field} className="regex-test-field">
                                                                    <span className="regex-field-name">{field}:</span>
                                                                    <span className={`regex-field-value ${result ? 'success' : 'empty'}`}>
                                                                        {result ? (result.error ? `Error: ${result.error}` : result) : 'No match'}
                                                                    </span>
                                                                </div>
                                                            );
                                                        }
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
                            <button
                                onClick={handlePullFromDSA}
                                className="regex-dsa-btn"
                                disabled={isSyncing}
                                title="Pull regex rules from DSA server"
                            >
                                {isSyncing ? '⏳' : '⬇️'} Pull from DSA
                            </button>
                            <button
                                onClick={handlePushToDSA}
                                className="regex-dsa-btn regex-push-btn"
                                disabled={isSyncing}
                                title="Push regex rules to DSA server"
                            >
                                {isSyncing ? '⏳' : '🔄'} Push to DSA
                            </button>
                        </div>
                        <div className="regex-footer-center">
                            <label className="regex-override-checkbox" title="Re-apply regex rules to values that were previously extracted by regex (protects manual edits and column mappings)">
                                <input
                                    type="checkbox"
                                    checked={forceOverride}
                                    onChange={(e) => setForceOverride(e.target.checked)}
                                />
                                <span>Override existing regex values</span>
                            </label>
                        </div>
                        <div className="regex-footer-right">
                            <button onClick={handleApplyRegexRules} className="regex-apply-btn">Apply REGEX Rules</button>
                            <button onClick={onClose} className="regex-cancel-btn">Cancel</button>
                            <button onClick={handleSave} className="regex-save-btn">Save Rules</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RegexRulesModal;
