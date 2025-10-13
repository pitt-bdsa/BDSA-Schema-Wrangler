import React, { useState, useEffect } from 'react';
import './RegexRulesModal.css';
import { REGEX_RULE_SETS } from '../utils/constants.js';
import dsaAuthStore from '../utils/dsaAuthStore';
import { syncRegexRulesToFolder, getRegexRulesFromFolder } from '../utils/dsaIntegration';

const RegexRulesModal = ({ isOpen, onClose, onSave, currentRules, selectedRuleSet: initialSelectedRuleSet, sampleData }) => {
    const [rules, setRules] = useState({
        primaryPattern: {
            pattern: '',
            description: 'Single regex pattern with named groups',
            example: '^(?<localCaseId>\\d{8})\\s+(?<localRegionId>\\w+)\\s+(?<localStainID>\\w+)_(?<localImageType>.+?)(?:\\.optimized)?\\.tiff?$'
        },
        fallbackPatterns: {
            localCaseId: {
                pattern: '',
                description: 'Extract case ID from filename',
                example: '05-662-Temporal_AT8.czi → 05-662'
            },
            localStainID: {
                pattern: '',
                description: 'Extract stain ID from filename',
                example: '05-662-Temporal_AT8.czi → AT8'
            },
            localRegionId: {
                pattern: '',
                description: 'Extract region ID from filename',
                example: '05-662-Temporal_AT8.czi → Temporal'
            },
            localImageType: {
                pattern: '',
                description: 'Extract image type from filename',
                example: '20232817 B HE_Default_Extended.tif → Default_Extended'
            }
        }
    });

    const [testResults, setTestResults] = useState({});
    const [activeTab, setActiveTab] = useState('primaryPattern');
    const [selectedRuleSet, setSelectedRuleSet] = useState(initialSelectedRuleSet || '');
    const [showRuleSetSelector, setShowRuleSetSelector] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [forceOverride, setForceOverride] = useState(false);

    useEffect(() => {
        if (currentRules) {
            setRules(currentRules);
        }
    }, [currentRules]);

    useEffect(() => {
        if (initialSelectedRuleSet) {
            setSelectedRuleSet(initialSelectedRuleSet);
        }
    }, [initialSelectedRuleSet]);

    const handleRuleChange = (parentField, childField, property, value) => {
        if (parentField && childField) {
            // Handle nested structure (fallbackPatterns.fieldName.property)
            setRules(prev => ({
                ...prev,
                [parentField]: {
                    ...prev[parentField],
                    [childField]: {
                        ...prev[parentField][childField],
                        [property]: value
                    }
                }
            }));
        } else if (parentField) {
            // Handle direct structure (primaryPattern.property)
            setRules(prev => ({
                ...prev,
                [parentField]: {
                    ...prev[parentField],
                    [property]: value
                }
            }));
        }
    };

    const testRegex = (pattern, testString) => {
        if (!pattern || !testString) return null;

        try {
            const regex = new RegExp(pattern);
            const match = testString.match(regex);

            if (match) {
                // Return the first capture group if it exists, otherwise the full match
                return match[1] || match[0];
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
        const hasFallbackPatterns = Object.values(rules.fallbackPatterns || {}).some(rule => rule.pattern && rule.pattern.trim() !== '');
        const hasRules = hasPrimaryPattern || hasFallbackPatterns;

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

            // Apply regex rules with markAsModified = false to avoid marking as modified
            // Pass forceOverride flag to override all existing values if requested
            const result = dataStore.applyRegexRules(rules, false, forceOverride);

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

    const getSuggestedPatterns = (field) => {
        const suggestions = {
            localCaseId: [
                { pattern: '^(\\d+-\\d+)', description: 'Match digits-digits at start (e.g., 05-662)' },
                { pattern: '^(\\d{2}-\\d{3})', description: 'Match exactly 2 digits, dash, 3 digits' },
                { pattern: '^([^-]+)', description: 'Match everything before first dash' }
            ],
            localStainID: [
                { pattern: '_(\\w+)\\.', description: 'Match word after underscore before extension' },
                { pattern: '_(AT\\d+|\\w+)\\.', description: 'Match AT followed by digits or word after underscore' },
                { pattern: '([A-Z]+\\d*)\\.', description: 'Match uppercase letters followed by optional digits' }
            ],
            localRegionId: [
                { pattern: '-(\\w+)_', description: 'Match word between dash and underscore' },
                { pattern: '-(Temporal|Parietal|MFG)', description: 'Match specific region names' },
                { pattern: '-(\\w+)_\\w+\\.', description: 'Match word between dash and underscore before extension' }
            ],
            localImageType: [
                { pattern: '_(\\w+(?:_\\w+)*)\\.', description: 'Match image type after underscore before extension' },
                { pattern: '_(Default_Extended|Preview_Image|LabelArea_Image)', description: 'Match specific image types' },
                { pattern: '_(\\w+_\\w+)\\.', description: 'Match underscore-separated image type' }
            ]
        };
        return suggestions[field] || [];
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
            const result = await syncRegexRulesToFolder(
                config.baseUrl,
                config.resourceId,
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
            const result = await getRegexRulesFromFolder(
                config.baseUrl,
                config.resourceId,
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
                    <div className="regex-tabs">
                        <button
                            key="primaryPattern"
                            className={`regex-tab ${activeTab === 'primaryPattern' ? 'active' : ''}`}
                            onClick={() => setActiveTab('primaryPattern')}
                        >
                            Primary Pattern
                        </button>
                        {Object.keys(rules.fallbackPatterns || {}).map(field => (
                            <button
                                key={field}
                                className={`regex-tab ${activeTab === field ? 'active' : ''}`}
                                onClick={() => setActiveTab(field)}
                            >
                                {field} (Fallback)
                            </button>
                        ))}
                    </div>

                    <div className="regex-tab-content">
                        <div className="regex-field-config">
                            {activeTab === 'primaryPattern' ? (
                                <>
                                    <h3>{rules.primaryPattern.description}</h3>
                                    <p className="regex-example">{rules.primaryPattern.example}</p>

                                    <div className="regex-input-group">
                                        <label>Primary Regex Pattern (with named groups):</label>
                                        <input
                                            type="text"
                                            value={rules.primaryPattern.pattern}
                                            onChange={(e) => handleRuleChange('primaryPattern', 'pattern', e.target.value)}
                                            placeholder="^(?&lt;localCaseId&gt;\d{8})\s+(?&lt;localRegionId&gt;\w+)\s+(?&lt;localStainID&gt;\w+)_(?&lt;localImageType&gt;.+?)(?:\.optimized)?\.tiff?$"
                                            className="regex-pattern-input"
                                        />
                                    </div>

                                    <div className="regex-suggestions">
                                        <h4>Suggested Primary Patterns:</h4>
                                        <div className="regex-suggestion">
                                            <code>^(?&lt;localCaseId&gt;\d{8})\s+(?&lt;localRegionId&gt;\w+)\s+(?&lt;localStainID&gt;\w+)_(?&lt;localImageType&gt;.+?)(?:\.optimized)?\.tiff?$</code>
                                            <span>For format: 20232824 B TDP43_LabelArea_Image.optimized.tiff</span>
                                            <button
                                                onClick={() => handleRuleChange('primaryPattern', 'pattern', '^(?<localCaseId>\\d{8})\\s+(?<localRegionId>\\w+)\\s+(?<localStainID>\\w+)_(?<localImageType>.+?)(?:\\.optimized)?\\.tiff?$')}
                                                className="regex-use-suggestion"
                                            >
                                                Use
                                            </button>
                                        </div>
                                        <div className="regex-suggestion">
                                            <code>^(?&lt;localCaseId&gt;\d+-\d+)-(?&lt;localRegionId&gt;\w+)_(?&lt;localStainID&gt;\w+)\.</code>
                                            <span>For format: 05-662-Temporal_AT8.czi</span>
                                            <button
                                                onClick={() => handleRuleChange('primaryPattern', 'pattern', '^(?<localCaseId>\\d+-\\d+)-(?<localRegionId>\\w+)_(?<localStainID>\\w+)\\.')}
                                                className="regex-use-suggestion"
                                            >
                                                Use
                                            </button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <h3>{rules.fallbackPatterns[activeTab].description}</h3>
                                    <p className="regex-example">{rules.fallbackPatterns[activeTab].example}</p>

                                    <div className="regex-input-group">
                                        <label>Fallback Regex Pattern:</label>
                                        <input
                                            type="text"
                                            value={rules.fallbackPatterns[activeTab].pattern}
                                            onChange={(e) => handleRuleChange('fallbackPatterns', activeTab, 'pattern', e.target.value)}
                                            placeholder="Enter regex pattern..."
                                            className="regex-pattern-input"
                                        />
                                    </div>

                                    <div className="regex-suggestions">
                                        <h4>Suggested Patterns:</h4>
                                        {getSuggestedPatterns(activeTab).map((suggestion, index) => (
                                            <div key={index} className="regex-suggestion">
                                                <code>{suggestion.pattern}</code>
                                                <span>{suggestion.description}</span>
                                                <button
                                                    onClick={() => handleRuleChange('fallbackPatterns', activeTab, 'pattern', suggestion.pattern)}
                                                    className="regex-use-suggestion"
                                                >
                                                    Use
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
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
    );
};

export default RegexRulesModal;
