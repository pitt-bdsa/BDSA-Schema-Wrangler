/**
 * Unified regex extraction: one patterns[] format, one apply path.
 */

import { DEFAULT_REGEX_RULES } from './constants.js';

export const REGEX_TARGET_FIELDS = ['localCaseId', 'localStainID', 'localRegionId', 'localImageType'];

function isEmptyValue(value) {
    return value == null || value === '' || value === '0';
}

function shouldWriteField(currentValue, currentSource, forceOverride) {
    if (isEmptyValue(currentValue)) return true;
    return Boolean(forceOverride) && currentSource !== 'manual' && currentSource !== 'column_mapping';
}

function ensureBdsa(item) {
    if (!item.BDSA) {
        item.BDSA = {
            bdsaLocal: {},
            _dataSource: {},
            _lastModified: new Date().toISOString()
        };
    }
    if (!item.BDSA.bdsaLocal) {
        item.BDSA.bdsaLocal = {};
    }
    if (!item.BDSA._dataSource) {
        item.BDSA._dataSource = {};
    }
}

function toPattern(entry, index, fallbackId) {
    return {
        id: entry.id || fallbackId || `pattern-${index + 1}`,
        name: entry.name || `Pattern ${index + 1}`,
        pattern: entry.pattern || '',
        description: entry.description || '',
        example: entry.example || '',
        priority: Number.isFinite(Number(entry.priority)) ? Number(entry.priority) : index + 1,
        enabled: entry.enabled !== false,
        ...(entry.field && REGEX_TARGET_FIELDS.includes(entry.field) ? { field: entry.field } : {}),
    };
}

/**
 * Convert any historical rule shape into { patterns: [...] }.
 */
export function normalizeRegexRules(raw) {
    if (!raw || typeof raw !== 'object') {
        return { patterns: [] };
    }

    if (Array.isArray(raw.patterns)) {
        return {
            patterns: raw.patterns
                .filter((entry) => entry && typeof entry === 'object')
                .map((entry, index) => toPattern(entry, index))
                .sort((a, b) => a.priority - b.priority),
        };
    }

    const patterns = [];
    let priority = 1;

    if (raw.primaryPattern?.pattern) {
        patterns.push(toPattern({
            ...raw.primaryPattern,
            id: raw.primaryPattern.id || 'primary-pattern',
            name: raw.primaryPattern.name || 'Primary pattern',
            priority,
        }, 0, 'primary-pattern'));
        priority += 1;
    }

    if (raw.fallbackPatterns && typeof raw.fallbackPatterns === 'object') {
        Object.entries(raw.fallbackPatterns).forEach(([field, rule]) => {
            if (!rule?.pattern || !REGEX_TARGET_FIELDS.includes(field)) return;
            patterns.push(toPattern({
                ...rule,
                id: rule.id || `fallback-${field}`,
                name: rule.name || `${field} fallback`,
                priority,
                field,
            }, patterns.length, `fallback-${field}`));
            priority += 1;
        });
    }

    if (!raw.primaryPattern && !raw.fallbackPatterns) {
        REGEX_TARGET_FIELDS.forEach((field) => {
            const rule = raw[field];
            if (!rule?.pattern) return;
            patterns.push(toPattern({
                ...rule,
                id: rule.id || `field-${field}`,
                name: rule.name || field,
                priority,
                field,
            }, patterns.length, `field-${field}`));
            priority += 1;
        });
    }

    return { patterns };
}

export function getEnabledPatterns(rules) {
    return normalizeRegexRules(rules).patterns.filter(
        (pattern) => pattern.enabled && pattern.pattern && pattern.pattern.trim() !== ''
    );
}

export const extractWithRegex = (text, pattern) => {
    if (!text || !pattern) {
        return null;
    }

    try {
        const regex = new RegExp(pattern);
        const match = text.match(regex);
        if (!match) return null;
        return match[1] || match[0];
    } catch (error) {
        console.error('Regex extraction error:', error);
        return null;
    }
};

export function matchFilename(fileName, pattern) {
    if (!fileName || !pattern) return null;
    try {
        return fileName.match(new RegExp(pattern));
    } catch (error) {
        console.error('Regex extraction error:', error);
        return null;
    }
}

export function testPatternAgainstFilename(pattern, fileName, field = null) {
    if (!pattern || !fileName) return null;
    try {
        const match = fileName.match(new RegExp(pattern));
        if (!match) return null;
        if (match.groups && Object.keys(match.groups).length > 0) {
            return match.groups;
        }
        if (field) {
            return { [field]: match[1] || match[0] };
        }
        return { match: match[1] || match[0] };
    } catch (error) {
        return { error: error.message };
    }
}

function writeExtracted(item, field, extractedValue) {
    const currentValue = item.BDSA.bdsaLocal[field];
    const changed = currentValue !== extractedValue;
    item.BDSA.bdsaLocal[field] = extractedValue;
    item.BDSA._dataSource[field] = 'regex';
    item.BDSA._lastModified = new Date().toISOString();
    return changed;
}

/**
 * Apply normalized patterns to items in place.
 * Named-group patterns: first match wins for that file.
 * Field-scoped fallbacks keep filling other empty target fields.
 */
export function applyRegexRulesToItems(items, rules, {
    forceOverride = false,
    markAsModified = true,
    modifiedItems = null,
} = {}) {
    if (!items || !Array.isArray(items) || items.length === 0) {
        return {
            success: false,
            error: 'No data available',
            extractedCount: 0,
            updatedItems: 0,
            skippedItems: 0,
            totalItems: 0,
        };
    }

    const enabled = getEnabledPatterns(rules);
    if (enabled.length === 0) {
        return {
            success: false,
            error: 'No regex patterns defined. Please add some patterns first.',
            extractedCount: 0,
            updatedItems: 0,
            skippedItems: 0,
            totalItems: items.length,
        };
    }

    let extractedCount = 0;
    let skippedCount = 0;

    items.forEach((item) => {
        const fileName = item.name || item.dsa_name || '';
        ensureBdsa(item);
        let itemUpdated = false;
        let valueChanged = false;
        let usedNamedGroupPattern = false;

        enabled.forEach((pattern) => {
            if (usedNamedGroupPattern) return;
            const match = matchFilename(fileName, pattern.pattern);
            if (!match) return;

            const namedGroups = match.groups
                ? Object.entries(match.groups).filter(([field, value]) => (
                    REGEX_TARGET_FIELDS.includes(field) && value
                ))
                : [];

            if (namedGroups.length > 0) {
                namedGroups.forEach(([field, extractedValue]) => {
                    const currentValue = item.BDSA.bdsaLocal[field];
                    const currentSource = item.BDSA._dataSource[field];
                    if (!shouldWriteField(currentValue, currentSource, forceOverride)) return;
                    if (writeExtracted(item, field, extractedValue)) {
                        valueChanged = true;
                    }
                    itemUpdated = true;
                });
                usedNamedGroupPattern = true;
                return;
            }

            if (pattern.field && REGEX_TARGET_FIELDS.includes(pattern.field)) {
                const extractedValue = match[1] || match[0];
                if (!extractedValue) return;
                const currentValue = item.BDSA.bdsaLocal[pattern.field];
                const currentSource = item.BDSA._dataSource[pattern.field];
                if (!shouldWriteField(currentValue, currentSource, forceOverride)) return;
                if (writeExtracted(item, pattern.field, extractedValue)) {
                    valueChanged = true;
                }
                itemUpdated = true;
            }
        });

        if (itemUpdated) {
            extractedCount += 1;
            if (markAsModified && valueChanged && modifiedItems) {
                const itemId = item.id || item._id || item.dsa_id;
                if (itemId) {
                    modifiedItems.add(itemId);
                }
            }
        } else {
            skippedCount += 1;
        }
    });

    return {
        success: true,
        extractedCount,
        updatedItems: extractedCount,
        skippedItems: skippedCount,
        totalItems: items.length,
    };
}

/** In-place apply used by older transform callers. */
export const applyRegexRules = (data, regexRules) => {
    if (!data || !Array.isArray(data) || !regexRules) {
        return data;
    }
    applyRegexRulesToItems(data, regexRules, { markAsModified: false, forceOverride: false });
    return data;
};

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
            results.matches += 1;
        }
    });

    results.successRate = results.total > 0 ? (results.matches / results.total) * 100 : 0;
    return results;
};

export const getDefaultRegexRules = () => normalizeRegexRules(DEFAULT_REGEX_RULES);

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

export const getSuggestedPatterns = (sampleData) => {
    if (!sampleData || !Array.isArray(sampleData) || sampleData.length === 0) {
        return getDefaultRegexRules();
    }

    return {
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
};
