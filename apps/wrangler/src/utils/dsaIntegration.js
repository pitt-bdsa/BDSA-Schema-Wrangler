/**
 * DSA Integration Utilities
 * Main entry point for all Digital Slide Archive API interactions and data processing
 * 
 * This file re-exports functionality from focused, single-responsibility modules.
 */

// Authentication
export { testDirectToken, testResourceAccess } from './DsaAuth.js';

// Data Transformation
export { transformDsaData, enhanceDataWithExistingMetadata, filterFilesByExtension, flattenObject } from './DsaDataTransformer.js';

// Data Fetching
export { loadDsaData, fetchAllDsaItems, fetchAllDsaItemsUnlimited, fetchAllDsaItemsPaginated, loadMoreDsaDataPaginated, fetchDsaDataWithRegex } from './DsaDataFetcher.js';

// Metadata Management
export { addItemMetadata, updateItemMetadata, addFolderMetadata, syncItemBdsaMetadata, syncAllBdsaMetadata } from './DsaMetadataManager.js';

// Folder Metadata Sync
export {
    syncProtocolsToFolder,
    syncApprovedProtocolsToFolder,
    getApprovedProtocolsFromFolder,
    syncCaseIdMappingsToFolder,
    syncRegexRulesToFolder,
    getRegexRulesFromFolder,
    syncColumnMappingsToFolder,
    getColumnMappingsFromFolder,
    getCaseIdMappingsFromFolder,
    getProtocolsFromFolder
} from './DsaFolderMetadataSync.js';

// Protocol Store Integration
export { pullProtocolsFromDSA } from './ProtocolStoreIntegration.js';

// Batch Processing
export { DsaBatchProcessor } from './DsaBatchProcessor.js';