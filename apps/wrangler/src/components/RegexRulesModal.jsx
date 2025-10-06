import React, { useState, useEffect } from 'react';
import './RegexRulesModal.css';

const RegexRulesModal = ({ isOpen, onClose, onSave, currentRules, sampleData }) => {
    const [rules, setRules] = useState({
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
        }
    });

    const [testResults, setTestResults] = useState({});
    const [activeTab, setActiveTab] = useState('localCaseId');

    useEffect(() => {
        if (currentRules) {
            setRules(currentRules);
        }
    }, [currentRules]);

    const handleRuleChange = (field, property, value) => {
        setRules(prev => ({
            ...prev,
            [field]: {
                ...prev[field],
                [property]: value
            }
        }));
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
        onSave(rules);
        onClose();
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
            ]
        };
        return suggestions[field] || [];
    };

    if (!isOpen) return null;

    return (
        <div className="regex-modal-overlay">
            <div className="regex-modal-content">
                <div className="regex-modal-header">
                    <h2>Regex Rules for Data Extraction</h2>
                    <button className="regex-modal-close" onClick={onClose}>×</button>
                </div>

                <div className="regex-modal-body">
                    <div className="regex-tabs">
                        {Object.keys(rules).map(field => (
                            <button
                                key={field}
                                className={`regex-tab ${activeTab === field ? 'active' : ''}`}
                                onClick={() => setActiveTab(field)}
                            >
                                {field}
                            </button>
                        ))}
                    </div>

                    <div className="regex-tab-content">
                        <div className="regex-field-config">
                            <h3>{rules[activeTab].description}</h3>
                            <p className="regex-example">{rules[activeTab].example}</p>

                            <div className="regex-input-group">
                                <label>Regex Pattern:</label>
                                <input
                                    type="text"
                                    value={rules[activeTab].pattern}
                                    onChange={(e) => handleRuleChange(activeTab, 'pattern', e.target.value)}
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
                                            onClick={() => handleRuleChange(activeTab, 'pattern', suggestion.pattern)}
                                            className="regex-use-suggestion"
                                        >
                                            Use
                                        </button>
                                    </div>
                                ))}
                            </div>
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
                    <button onClick={onClose} className="regex-cancel-btn">Cancel</button>
                    <button onClick={handleSave} className="regex-save-btn">Save Rules</button>
                </div>
            </div>
        </div>
    );
};

export default RegexRulesModal;
