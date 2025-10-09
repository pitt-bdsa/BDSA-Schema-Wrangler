// ProtocolMapper - Handles adding and removing protocol mappings to slides

class ProtocolMapper {
    constructor() {
        // This class is stateless and operates on provided data
    }

    addProtocolMapping(bdsaCaseId, slideId, protocolId, protocolType, processedData, modifiedItems, caseProtocolMappings, notifyCallback, batchMode = false) {
        console.log(`🔍 addProtocolMapping called: ${bdsaCaseId}, ${slideId}, ${protocolId}, ${protocolType}`);

        // Find the data row that matches this case and slide
        const dataRow = processedData.find(row =>
            row.BDSA?.bdsaLocal?.bdsaCaseId === bdsaCaseId &&
            (row._id === slideId || row.dsa_id === slideId || row.id === slideId)
        );

        if (!dataRow) {
            console.log(`❌ No data row found for case ${bdsaCaseId}, slide ${slideId}`);
            return;
        }

        // Get the field name based on protocol type
        const fieldName = `bdsa${protocolType === 'stain' ? 'Stain' : 'Region'}Protocol`;
        const currentProtocols = dataRow.BDSA?.bdsaLocal?.[fieldName] || [];

        // Convert to array if it's a string
        const protocolArray = Array.isArray(currentProtocols) ? currentProtocols :
            (typeof currentProtocols === 'string' ? currentProtocols.split(',').map(p => p.trim()).filter(p => p) : []);

        console.log(`🔍 Current ${fieldName} for slide ${slideId}:`, protocolArray);

        // Add protocol if not already present
        if (!protocolArray.includes(protocolId)) {
            protocolArray.push(protocolId);
            dataRow.BDSA.bdsaLocal[fieldName] = protocolArray;

            // Mark item as modified
            dataRow.BDSA._lastModified = new Date().toISOString();
            modifiedItems.add(dataRow.id);

            // Only save to storage and notify if not in batch mode
            if (!batchMode) {
                // Skip saveToStorage() for large datasets to avoid quota errors
                // saveToStorage callback would go here
                notifyCallback();
            }
            console.log(`✅ Added protocol ${protocolId} to slide ${slideId}. New protocols:`, protocolArray);
        } else {
            console.log(`🔔 Protocol ${protocolId} already exists for slide ${slideId}`);
        }
    }

    removeProtocolMapping(bdsaCaseId, slideId, protocolId, protocolType, processedData, modifiedItems, caseProtocolMappings, notifyCallback) {
        console.log(`🔍 removeProtocolMapping called: ${bdsaCaseId}, ${slideId}, ${protocolId}, ${protocolType}`);

        // Find the data row that matches this case and slide
        const dataRow = processedData.find(row =>
            row.BDSA?.bdsaLocal?.bdsaCaseId === bdsaCaseId &&
            (row._id === slideId || row.dsa_id === slideId || row.id === slideId)
        );

        if (!dataRow) {
            console.log(`❌ No data row found for case ${bdsaCaseId}, slide ${slideId}`);
            return;
        }

        // Get the field name based on protocol type
        const fieldName = `bdsa${protocolType === 'stain' ? 'Stain' : 'Region'}Protocol`;
        const bdsaProtocol = dataRow.BDSA?.bdsaLocal?.[fieldName];

        // Parse the protocol data - use the same logic as generateUnmappedCases
        let protocols = [];
        if (bdsaProtocol) {
            if (Array.isArray(bdsaProtocol)) {
                protocols = bdsaProtocol.filter(p => p && typeof p === 'string');
            } else if (typeof bdsaProtocol === 'string') {
                protocols = bdsaProtocol.split(',').map(p => p.trim()).filter(p => p);
            }
        }

        // Also check the caseProtocolMappings for any additional mappings (same logic as generateUnmappedCases)
        const additionalSlideProtocols = caseProtocolMappings.get(bdsaCaseId)?.[slideId] || { stain: [], region: [] };

        // Combine protocols from data and mappings (same logic as generateUnmappedCases)
        const allProtocols = [...protocols, ...(additionalSlideProtocols[protocolType] || [])];

        console.log(`🔍 Current ${fieldName} for slide ${slideId}:`, allProtocols);
        console.log(`🔍 Original data:`, protocols);
        console.log(`🔍 Additional mappings:`, additionalSlideProtocols[protocolType] || []);

        // Remove protocol if present
        const index = allProtocols.indexOf(protocolId);
        if (index > -1) {
            console.log(`✅ Found protocol ${protocolId} at index ${index}, removing...`);

            // Remove from the appropriate source
            if (index < protocols.length) {
                // Remove from original data
                protocols.splice(index, 1);
                dataRow.BDSA.bdsaLocal[fieldName] = protocols;
                console.log(`✅ Removed from original data. New protocols:`, protocols);
            } else {
                // Remove from caseProtocolMappings
                const mappingIndex = index - protocols.length;
                additionalSlideProtocols[protocolType].splice(mappingIndex, 1);
                console.log(`✅ Removed from caseProtocolMappings. New mappings:`, additionalSlideProtocols[protocolType]);
            }

            // Mark item as modified
            dataRow.BDSA._lastModified = new Date().toISOString();
            modifiedItems.add(dataRow.id);

            // Skip saveToStorage() for large datasets to avoid quota errors
            // saveToStorage callback would go here
            notifyCallback();
            console.log(`✅ Protocol ${protocolId} removed from slide ${slideId} (marked as modified)`);
        } else {
            console.log(`❌ Protocol ${protocolId} not found in slide protocols:`, allProtocols);
        }
    }
}

const protocolMapper = new ProtocolMapper();
export default protocolMapper;
