// BdsaInitializer - Handles BDSA structure initialization for data items

class BdsaInitializer {
    constructor() {
        // This class is stateless
    }

    initializeBdsaStructure(data) {
        if (!data || !Array.isArray(data)) {
            return data;
        }

        // console.log('🔧 DEBUG - initializeBdsaStructure called, checking first item:', {
        //     hasBDSA: !!data[0]?.BDSA,
        //     hasBdsaLocal: !!data[0]?.BDSA?.bdsaLocal,
        //     bdsaLocalValues: data[0]?.BDSA?.bdsaLocal
        // });

        return data.map(item => {
            // Initialize BDSA structure if it doesn't exist
            if (!item.BDSA) {
                item.BDSA = {
                    bdsaLocal: {
                        localCaseId: null,
                        localStainID: null,
                        localRegionId: null,
                        bdsaCaseId: null,  // Initialize this field so the column appears
                        bdsaStainProtocol: null,  // Initialize BDSA Region Protocol field (can be array)
                        bdsaRegionProtocol: null  // Initialize BDSA Protocol field (can be array)
                    },
                    _dataSource: {}
                    // Don't set _lastModified here - only set it when actually modifying data
                };
            } else {
                // Ensure bdsaLocal structure exists
                if (!item.BDSA.bdsaLocal) {
                    item.BDSA.bdsaLocal = {
                        localCaseId: null,
                        localStainID: null,
                        localRegionId: null,
                        bdsaCaseId: null,
                        bdsaStainProtocol: null,  // Initialize BDSA Region Protocol field (can be array)
                        bdsaRegionProtocol: null  // Initialize BDSA Protocol field (can be array)
                    };
                } else {
                    // Ensure bdsaCaseId field exists - but preserve existing value if it exists
                    if (!item.BDSA.bdsaLocal.hasOwnProperty('bdsaCaseId')) {
                        item.BDSA.bdsaLocal.bdsaCaseId = null;
                    }
                    // Ensure bdsaStainProtocol field exists - but preserve existing value if it exists
                    if (!item.BDSA.bdsaLocal.hasOwnProperty('bdsaStainProtocol')) {
                        item.BDSA.bdsaLocal.bdsaStainProtocol = null;
                    }
                    // Ensure bdsaRegionProtocol field exists - but preserve existing value if it exists
                    if (!item.BDSA.bdsaLocal.hasOwnProperty('bdsaRegionProtocol')) {
                        item.BDSA.bdsaLocal.bdsaRegionProtocol = null;
                    }
                    // Preserve existing values - don't overwrite them with null
                    // The existing values should already be set by transformDsaData
                }

                // Ensure _dataSource exists
                if (!item.BDSA._dataSource) {
                    item.BDSA._dataSource = {};
                }
            }

            return item;
        });
    }
}

const bdsaInitializer = new BdsaInitializer();
export default bdsaInitializer;
