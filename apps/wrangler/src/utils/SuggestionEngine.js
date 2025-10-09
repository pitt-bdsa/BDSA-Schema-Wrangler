/**
 * SuggestionEngine - Handles protocol suggestion algorithms
 * Extracted from the massive dataStore.js to improve maintainability
 */

class SuggestionEngine {
    constructor() {
        // No state - this is a pure utility class
    }

    /**
     * Get protocol suggestions based on existing mappings in the collection
     * @param {Array} processedData - The processed data to analyze
     * @param {string} stainType - The stain type to get suggestions for
     * @param {string} protocolType - 'stain' or 'region'
     * @returns {Object} Suggestion data with recommended protocol and confidence
     */
    getProtocolSuggestions(processedData, stainType, protocolType = 'stain') {
        if (!processedData || processedData.length === 0) {
            return { suggested: null, confidence: 0, reason: 'No data available' };
        }

        // For suggestions, we need to look at the BDSA metadata structure
        const protocolField = protocolType === 'stain' ? 'bdsaStainProtocol' : 'bdsaRegionProtocol';
        const typeField = protocolType === 'stain' ? 'localStainID' : 'localRegionId';

        // Collect all mappings for this stain/region type across all cases
        const mappings = new Map(); // stainType -> Set of protocols used

        processedData.forEach(item => {
            const bdsaLocal = item.BDSA?.bdsaLocal;
            if (!bdsaLocal) return;

            const itemStainType = bdsaLocal[typeField];
            const bdsaProtocol = bdsaLocal[protocolField];

            if (itemStainType && bdsaProtocol) {
                // Parse the protocol data - always store as arrays internally
                let protocols = [];
                if (Array.isArray(bdsaProtocol)) {
                    protocols = bdsaProtocol.filter(p => p && typeof p === 'string');
                } else if (typeof bdsaProtocol === 'string') {
                    protocols = bdsaProtocol.split(',').map(p => p.trim()).filter(p => p);
                }

                // Filter out IGNORE protocols from suggestion calculations
                const nonIgnoreProtocols = protocols.filter(protocol =>
                    protocol && protocol.toUpperCase() !== 'IGNORE'
                );

                // Only include this mapping if there are non-IGNORE protocols
                if (nonIgnoreProtocols.length > 0) {
                    if (!mappings.has(itemStainType)) {
                        mappings.set(itemStainType, new Map());
                    }

                    const typeMappings = mappings.get(itemStainType);
                    nonIgnoreProtocols.forEach(protocol => {
                        typeMappings.set(protocol, (typeMappings.get(protocol) || 0) + 1);
                    });
                }
            }
        });

        // Check for exact 1:1 mapping
        if (mappings.has(stainType)) {
            const typeMappings = mappings.get(stainType);
            const entries = Array.from(typeMappings.entries());

            if (entries.length === 1) {
                // Perfect 1:1 mapping
                const [protocol, count] = entries[0];
                return {
                    suggested: protocol,
                    confidence: 1.0,
                    reason: `Perfect 1:1 mapping: ${stainType} → ${protocol} (${count} cases)`,
                    isExactMatch: true
                };
            } else if (entries.length > 1) {
                // Multiple protocols, find the most common
                entries.sort((a, b) => b[1] - a[1]);
                const [mostCommonProtocol, count] = entries[0];
                const totalCases = Array.from(typeMappings.values()).reduce((sum, c) => sum + c, 0);
                const confidence = count / totalCases;

                return {
                    suggested: mostCommonProtocol,
                    confidence: confidence,
                    reason: `Most common mapping: ${stainType} → ${mostCommonProtocol} (${count}/${totalCases} cases, ${Math.round(confidence * 100)}%)`,
                    isExactMatch: false,
                    alternatives: entries.slice(1).map(([protocol, count]) => ({ protocol, count }))
                };
            }
        }

        // Check for similar stain types (fuzzy matching)
        const similarTypes = Array.from(mappings.keys()).filter(type =>
            type.toLowerCase().includes(stainType.toLowerCase()) ||
            stainType.toLowerCase().includes(type.toLowerCase())
        );

        if (similarTypes.length > 0) {
            // Find the most common protocol across similar types
            const similarMappings = new Map();
            similarTypes.forEach(type => {
                const typeMappings = mappings.get(type);
                typeMappings.forEach((count, protocol) => {
                    similarMappings.set(protocol, (similarMappings.get(protocol) || 0) + count);
                });
            });

            const entries = Array.from(similarMappings.entries());
            if (entries.length > 0) {
                entries.sort((a, b) => b[1] - a[1]);
                const [mostCommonProtocol, count] = entries[0];
                const totalCases = Array.from(similarMappings.values()).reduce((sum, c) => sum + c, 0);
                const confidence = count / totalCases;

                return {
                    suggested: mostCommonProtocol,
                    confidence: confidence * 0.8, // Reduce confidence for fuzzy matches
                    reason: `Similar type mapping: ${stainType} similar to ${similarTypes.join(', ')} → ${mostCommonProtocol} (${Math.round(confidence * 100)}% confidence)`,
                    isExactMatch: false,
                    similarTypes: similarTypes
                };
            }
        }

        // No suggestion found
        return {
            suggested: null,
            confidence: 0,
            reason: `No existing mappings found for ${stainType}`
        };
    }

    /**
     * Get all protocol suggestions for a given protocol type
     * @param {Array} processedData - The processed data to analyze
     * @param {string} protocolType - 'stain' or 'region'
     * @returns {Map} Map of stain/region types to their suggestions
     */
    getAllProtocolSuggestions(processedData, protocolType = 'stain') {
        const suggestions = new Map();

        if (!processedData || processedData.length === 0) {
            return suggestions;
        }

        const typeField = protocolType === 'stain' ? 'localStainID' : 'localRegionId';

        // Get all unique stain/region types in the data
        const types = new Set();
        processedData.forEach(item => {
            const bdsaLocal = item.BDSA?.bdsaLocal;
            if (bdsaLocal) {
                const type = bdsaLocal[typeField];
                if (type) {
                    types.add(type);
                }
            }
        });

        // Get suggestions for each type
        types.forEach(type => {
            const suggestion = this.getProtocolSuggestions(processedData, type, protocolType);
            if (suggestion.suggested) {
                suggestions.set(type, suggestion);
            }
        });

        return suggestions;
    }

    /**
     * Analyze protocol mappings from data for debugging purposes
     * @param {Array} processedData - The processed data to analyze
     * @param {string} protocolType - 'stain' or 'region'
     * @returns {Map} Map of protocols to their usage statistics
     */
    getProtocolMappingsFromData(processedData, protocolType) {
        const mappings = new Map();

        if (!processedData || processedData.length === 0) {
            return mappings;
        }

        const typeField = protocolType === 'stain' ? 'localStainID' : 'localRegionId';
        const protocolField = protocolType === 'stain' ? 'bdsaStainProtocol' : 'bdsaRegionProtocol';

        processedData.forEach(item => {
            const bdsaLocal = item.BDSA?.bdsaLocal;
            if (!bdsaLocal) return;

            const type = bdsaLocal[typeField];
            const protocols = bdsaLocal[protocolField] || [];

            if (type && protocols.length > 0) {
                protocols.forEach(protocol => {
                    if (!mappings.has(protocol)) {
                        mappings.set(protocol, {
                            suggested: protocol,
                            confidence: 1.0,
                            reason: `Found in BDSA data`,
                            isExactMatch: true,
                            totalCases: 0,
                            uniqueTypes: new Set()
                        });
                    }

                    const mapping = mappings.get(protocol);
                    mapping.totalCases++;
                    mapping.uniqueTypes.add(type);
                });
            }
        });

        // Convert Set to Array for display
        mappings.forEach(mapping => {
            mapping.uniqueTypes = Array.from(mapping.uniqueTypes);
        });

        return mappings;
    }
}

// Create singleton instance
const suggestionEngine = new SuggestionEngine();

export default suggestionEngine;
