/**
 * Utility functions for extracting data using regex rules
 */

/**
 * Apply regex rules to extract localCaseId, localStainID, and localRegionId from file names
 * @param {Array} data - Array of data items
 * @param {Object} regexRules - Object containing regex patterns for each field
 * @returns {Array} - Array of data items with extracted values
 */
export const applyRegexRules = (data, regexRules) => {
    if (!data || !Array.isArray(data) || !regexRules) {
        return data;
    }

    return data.map(item => {
        const fileName = item.name || item.dsa_name || '';
        const updatedItem = { ...item };

        // Extract localCaseId
        if (regexRules.localCaseId?.pattern) {
            const extractedCaseId = extractWithRegex(fileName, regexRules.localCaseId.pattern);
            if (extractedCaseId && (!updatedItem.localCaseId || updatedItem.localCaseId === '0' || updatedItem.localCaseId === '')) {
                updatedItem.localCaseId = extractedCaseId;
            }
        }

        // Extract localStainID
        if (regexRules.localStainID?.pattern) {
            const extractedStainId = extractWithRegex(fileName, regexRules.localStainID.pattern);
            if (extractedStainId && (!updatedItem.localStainID || updatedItem.localStainID === '0' || updatedItem.localStainID === '')) {
                updatedItem.localStainID = extractedStainId;
            }
        }

        // Extract localRegionId
        if (regexRules.localRegionId?.pattern) {
            const extractedRegionId = extractWithRegex(fileName, regexRules.localRegionId.pattern);
            if (extractedRegionId && (!updatedItem.localRegionId || updatedItem.localRegionId === '0' || updatedItem.localRegionId === '')) {
                updatedItem.localRegionId = extractedRegionId;
            }
        }

        return updatedItem;
    });
};

/**
 * Extract value from string using regex pattern
 * @param {string} text - Text to extract from
 * @param {string} pattern - Regex pattern
 * @returns {string|null} - Extracted value or null if no match
 */
export const extractWithRegex = (text, pattern) => {
    if (!text || !pattern) {
        return null;
    }

    try {
        const regex = new RegExp(pattern);
        const match = text.match(regex);

        if (match) {
            // Return the first capture group if it exists, otherwise the full match
            return match[1] || match[0];
        }
        return null;
    } catch (error) {
        console.error('Regex extraction error:', error);
        return null;
    }
};

/**
 * Test regex pattern against sample data
 * @param {string} pattern - Regex pattern to test
 * @param {Array} sampleData - Array of sample data items
 * @returns {Object} - Test results
 */
export const testRegexPattern = (pattern, sampleData) => {
    if (!pattern || !sampleData || !Array.isArray(sampleData)) {
        return { success: false, error: 'Invalid input' };
    }

    const results = {
        success: true,
        matches: 0,
        total: sampleData.length,
        results: []
    };

    sampleData.forEach((item, index) => {
        const fileName = item.name || item.dsa_name || '';
        const extracted = extractWithRegex(fileName, pattern);

        results.results.push({
            index,
            fileName,
            extracted,
            success: extracted !== null
        });

        if (extracted !== null) {
            results.matches++;
        }
    });

    results.successRate = results.total > 0 ? (results.matches / results.total) * 100 : 0;
    return results;
};

/**
 * Get default regex rules for common filename patterns
 * @returns {Object} - Default regex rules
 */
export const getDefaultRegexRules = () => {
    return {
        localCaseId: {
            pattern: '^(\\d+-\\d+)',
            description: 'Extract case ID from filename',
            example: '05-662-Temporal_AT8.czi → 05-662'
        },
        localStainID: {
            pattern: '_(\\w+)\\.',
            description: 'Extract stain ID from filename',
            example: '05-662-Temporal_AT8.czi → AT8'
        },
        localRegionId: {
            pattern: '-(\\w+)_',
            description: 'Extract region ID from filename',
            example: '05-662-Temporal_AT8.czi → Temporal'
        }
    };
};

/**
 * Validate regex pattern
 * @param {string} pattern - Regex pattern to validate
 * @returns {Object} - Validation result
 */
export const validateRegexPattern = (pattern) => {
    if (!pattern) {
        return { valid: false, error: 'Pattern is required' };
    }

    try {
        new RegExp(pattern);
        return { valid: true };
    } catch (error) {
        return { valid: false, error: error.message };
    }
};

/**
 * Get suggested patterns based on sample data analysis
 * @param {Array} sampleData - Array of sample data items
 * @returns {Object} - Suggested patterns for each field
 */
export const getSuggestedPatterns = (sampleData) => {
    if (!sampleData || !Array.isArray(sampleData) || sampleData.length === 0) {
        return getDefaultRegexRules();
    }

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

    return suggestions;
};
