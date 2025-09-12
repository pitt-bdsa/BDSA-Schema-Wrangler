/**
 * Constants for BDSA Schema Wrangler
 */

// DSA fields that should be hidden by default in the column display
export const HIDDEN_DSA_FIELDS = [
    // Original meta.bdsaLocal fields (we manage BDSA data separately)
    'meta.bdsaLocal.localCaseId',
    'meta.bdsaLocal.localStainID',
    'meta.bdsaLocal.localRegionId',
    'meta.bdsaLocal.lastUpdated',
    'meta.bdsaLocal.source',

    // Imported meta.BDSA fields (we manage BDSA data separately, so hide the imported versions)
    'meta.BDSA.bdsaLocal.localCaseId',
    'meta.BDSA.bdsaLocal.localStainID',
    'meta.BDSA.bdsaLocal.localRegionId',
    'meta.BDSA.bdsaLocal.bdsaCaseId',
    'meta.BDSA.bdsaLocal.lastUpdated',
    'meta.BDSA.bdsaLocal.source',

    // Internal DSA fields that are not useful for users
    '_id',
    '_modelType',
    '_accessLevel',
    '_version',
    '_text',
    '_textScore',

    // Large binary/metadata fields that clutter the interface
    'meta.originalName',
    'meta.contentType',
    'meta.size',
    'meta.checksum',
    'meta.creatorId',
    'meta.creatorName',
    'meta.updated',
    'meta.created',

    // Girder-specific fields
    'girder',
    'girderId',
    'girderParentId',
    'girderParentCollection',

    // Other common DSA fields that are typically not needed
    'description',
    'notes',
    'tags',
    'public',
    'folderId',
    'parentId',
    'parentCollection',
    'baseParentId',
    'baseParentType'
];

// BDSA fields that should always be visible (our managed fields)
export const PRIORITY_BDSA_FIELDS = [
    'id',
    'name',
    'BDSA.bdsaLocal.bdsaCaseId',
    'BDSA.bdsaLocal.localCaseId',
    'BDSA.bdsaLocal.localRegionId',
    'BDSA.bdsaLocal.localStainID',
    'dsa_name',
    'dsa_created',
    'dsa_updated',
    'dsa_size',
    'dsa_mimeType'
];

// Default regex rules for common filename patterns
export const DEFAULT_REGEX_RULES = {
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

// Data source types
export const DATA_SOURCE_TYPES = {
    CSV: 'csv',
    DSA: 'dsa'
};

// Column visibility settings
export const DEFAULT_COLUMN_VISIBILITY = {
    // Hide all the DSA fields by default
    ...Object.fromEntries(HIDDEN_DSA_FIELDS.map(field => [field, false]))
};
