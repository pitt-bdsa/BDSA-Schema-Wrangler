/**
 * ProtocolCaseGenerator - Handles generation of protocol mapping cases
 * Extracted from the massive dataStore.js to improve maintainability
 */

class ProtocolCaseGenerator {
    constructor() {
        // No state - this is a pure utility class
    }

    /**
     * Generate cases for a specific protocol type (stain or region)
     * @param {Array} processedData - The processed data to analyze
     * @param {Map} caseIdMappings - Map of local case IDs to BDSA case IDs
     * @param {Object} columnMappings - Column mapping configuration
     * @param {string} protocolType - 'stain' or 'region'
     * @returns {Array} Array of cases with relevant slides
     */
    generateProtocolCases(processedData, caseIdMappings, columnMappings, protocolType) {
        if (!processedData.length) {
            console.log('🔍 No processed data available');
            return [];
        }

        // Debugging for protocol case generation
        console.log(`🔍 generate${protocolType.charAt(0).toUpperCase() + protocolType.slice(1)}ProtocolCases: ${processedData.length} rows, ${caseIdMappings.size} case mappings`);

        // Sample first few rows to see what data looks like
        const sampleRows = processedData.slice(0, 3).map(row => ({
            localCaseId: row.BDSA?.bdsaLocal?.localCaseId,
            localStainID: row.BDSA?.bdsaLocal?.localStainID,
            localRegionId: row.BDSA?.bdsaLocal?.localRegionId,
            hasBDSA: !!row.BDSA,
            hasBdsaLocal: !!row.BDSA?.bdsaLocal,
            name: row.name
        }));
        console.log(`🔍 Sample rows (first 3):`, sampleRows);

        // Show what case IDs are actually in the mappings
        const mappingKeys = Array.from(caseIdMappings.keys()).slice(0, 10);
        console.log(`🔍 Case ID mappings (first 10 keys):`, mappingKeys);

        // Check if sample row case IDs are in mappings
        const sampleCaseIds = sampleRows.map(r => r.localCaseId);
        const mappingChecks = sampleCaseIds.map(id => ({
            localCaseId: id,
            hasMapping: caseIdMappings.has(id),
            mappedTo: caseIdMappings.get(id)
        }));
        console.log(`🔍 Sample case ID mapping checks:`, mappingChecks);

        // Use default column mappings for BDSA data if not set
        const columnMapping = columnMappings.localStainID ? columnMappings : {
            localStainID: 'BDSA.bdsaLocal.localStainID',
            localRegionId: 'BDSA.bdsaLocal.localRegionId',
            localCaseId: 'BDSA.bdsaLocal.localCaseId'
        };

        const typeField = protocolType === 'stain' ? 'localStainID' : 'localRegionId';
        const protocolField = protocolType === 'stain' ? 'bdsaStainProtocol' : 'bdsaRegionProtocol';

        // Group slides by case
        const casesMap = new Map();

        processedData.forEach((item, index) => {
            // Access the BDSA data correctly from the nested structure
            const bdsaLocal = item.BDSA?.bdsaLocal;
            if (!bdsaLocal) {
                if (index < 5) {
                    console.log(`🔍 Skipping row ${index} - no BDSA.bdsaLocal:`, {
                        hasBDSA: !!item.BDSA,
                        keys: Object.keys(item),
                        name: item.name
                    });
                }
                return;
            }

            const localCaseId = bdsaLocal.bdsaCaseId;
            const localTypeId = bdsaLocal[typeField];
            const bdsaProtocol = bdsaLocal[protocolField];


            // Parse the protocol data - always store as arrays internally
            let protocols = [];
            if (bdsaProtocol) {
                if (Array.isArray(bdsaProtocol)) {
                    // Already an array, just filter out invalid entries
                    protocols = bdsaProtocol.filter(p => p && typeof p === 'string');
                } else if (typeof bdsaProtocol === 'string') {
                    // Convert string to array
                    protocols = bdsaProtocol.split(',').map(p => p.trim()).filter(p => p);
                }
            }

            // Also check the caseProtocolMappings for any additional mappings
            const additionalSlideProtocols = item.caseProtocolMappings?.[protocolType] || [];

            // Combine protocols from data and mappings for this protocol type
            const allProtocols = [...protocols, ...additionalSlideProtocols];

            // Check if slide is mapped (has protocols for this type)
            const isMapped = allProtocols.length > 0;

            // Debug logging for protocol detection (reduced)
            if (index < 2) { // Show fewer rows
                console.log(`🔍 Row ${index} ${protocolType} protocols:`, { protocols: allProtocols, isMapped });
            }

            // Create slide object with protocol-type specific data
            const slideData = {
                id: item._id || item.dsa_id || item.id, // This is now the actual _id or dsa_id for table reference
                filename: item.name, // This is the display name
                [typeField]: localTypeId,
                [protocolField]: allProtocols,
                isMapped: isMapped,
                bdsaCaseId: bdsaLocal.bdsaCaseId,
                localCaseId: localCaseId
            };

            // Get the BDSA case ID (mapped or fallback)
            const bdsaCaseId = caseIdMappings.get(localCaseId) || bdsaLocal.bdsaCaseId || localCaseId || 'unknown';


            if (!casesMap.has(bdsaCaseId)) {
                casesMap.set(bdsaCaseId, {
                    bdsaId: bdsaCaseId,
                    localCaseId: localCaseId,
                    slides: [],
                    unmappedSlides: [],
                    totalSlides: 0,
                    mappedSlides: 0
                });
            }

            const caseData = casesMap.get(bdsaCaseId);
            caseData.slides.push(slideData);
            caseData.totalSlides++;

            if (isMapped) {
                caseData.mappedSlides++;
            } else {
                caseData.unmappedSlides.push(slideData);
            }
        });

        // Convert to array and add summary stats
        const casesWithRelevantSlides = Array.from(casesMap.values()).map(caseData => {
            // Group slides by type for easier UI handling
            const slidesByType = new Map();
            caseData.slides.forEach(slide => {
                const typeKey = slide[typeField] || 'unknown';
                if (!slidesByType.has(typeKey)) {
                    slidesByType.set(typeKey, []);
                }
                slidesByType.get(typeKey).push(slide);
            });

            return {
                ...caseData,
                slidesByType: slidesByType,
                hasUnmappedSlides: caseData.unmappedSlides.length > 0,
                unmappedCount: caseData.unmappedSlides.length,
                mappedCount: caseData.mappedSlides,
                completionPercentage: caseData.totalSlides > 0 ?
                    Math.round((caseData.mappedSlides / caseData.totalSlides) * 100) : 0
            };
        });

        // Sort by BDSA ID for consistent ordering
        casesWithRelevantSlides.sort((a, b) => {
            const idA = a.bdsaId || '';
            const idB = b.bdsaId || '';
            return idA.localeCompare(idB);
        });

        console.log(`✅ Generated ${casesWithRelevantSlides.length} ${protocolType} protocol cases`);
        return casesWithRelevantSlides;
    }

    /**
     * Generate stain protocol cases
     * @param {Array} processedData - The processed data
     * @param {Map} caseIdMappings - Case ID mappings
     * @param {Object} columnMappings - Column mappings
     * @returns {Array} Array of stain protocol cases
     */
    generateStainProtocolCases(processedData, caseIdMappings, columnMappings) {
        return this.generateProtocolCases(processedData, caseIdMappings, columnMappings, 'stain');
    }

    /**
     * Generate region protocol cases
     * @param {Array} processedData - The processed data
     * @param {Map} caseIdMappings - Case ID mappings
     * @param {Object} columnMappings - Column mappings
     * @returns {Array} Array of region protocol cases
     */
    generateRegionProtocolCases(processedData, caseIdMappings, columnMappings) {
        return this.generateProtocolCases(processedData, caseIdMappings, columnMappings, 'region');
    }
}

// Create singleton instance
const protocolCaseGenerator = new ProtocolCaseGenerator();

export default protocolCaseGenerator;
