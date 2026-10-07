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
    'meta.BDSA.bdsaLocal.localImageType',
    'meta.BDSA.bdsaLocal.bdsaCaseId',
    'meta.BDSA.bdsaLocal.bdsaStainProtocol',
    'meta.BDSA.bdsaLocal.bdsaRegionProtocol',
    'meta.BDSA.bdsaLocal.lastUpdated',
    'meta.BDSA.bdsaLocal.source',

    // Girder item id — not useful in the Input Data grid
    'id',
    'dsa_id',
    'dsa_name',
    'dsa_created',
    'dsa_updated',
    'dsa_size',
    'dsa_mimeType',
    'created',
    'updated',

    // Raw duplicate fields from transformDsaData (we use BDSA.bdsaLocal versions instead)
    // These are created during DSA import and conflict with our managed BDSA fields
    'localCaseId',
    'localStainID',
    'localRegionId',
    'localImageType',
    'BDSA.bdsaLocal.localImageType',

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

    // BDSA internal tracking fields
    'BDSA._dataSource.localCaseId',
    'BDSA._dataSource.localStainID',
    'BDSA._dataSource.localRegionId',
    'BDSA._dataSource.bdsaCaseId',
    'BDSA._dataSource.bdsaStainProtocol',
    'BDSA._dataSource.bdsaRegionProtocol',
    'BDSA._lastModified',

    // Internal tracking fields (should never be shown to users)
    '_hasServerMetadata',
    '_serverMetadataSource',
    '_serverMetadataLastUpdated',
    '_localLastModified',
    '_dataSource',
    '_lastModified',

    // Computed/UI fields that shouldn't appear in column settings
    '_status',

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
    'name',
    'BDSA.bdsaLocal.localCaseId',
    'BDSA.bdsaLocal.localRegionId',
    'BDSA.bdsaLocal.localStainID',
    'BDSA.bdsaLocal.bdsaCaseId',
    'BDSA.bdsaLocal.bdsaStainProtocol',
    'BDSA.bdsaLocal.bdsaRegionProtocol',
];

export const COLUMN_LAYOUT_VERSION = 'v3';

// Default regex rules: ordered named-group patterns. First match wins per file.
export const DEFAULT_REGEX_RULES = {
    patterns: [
        {
            id: 'pattern-1',
            name: 'Underscore Format',
            pattern: '^(?<localCaseId>\\d+)_(?<regionNumber>\\d+)_(?<localStainID>[A-Za-z0-9_-]+)_(?<slideNumber>\\d+)',
            description: 'Format: 550058_2_Sil_1.mrxs',
            example: '550058_2_Sil_1.mrxs',
            priority: 1,
            enabled: true
        },
        {
            id: 'pattern-2',
            name: 'Space Format',
            pattern: '^(?<localCaseId>\\d+)\\s+(?<localRegionId>\\w+)\\s+(?<localStainID>\\w+)_(?<localImageType>\\w+)',
            description: 'Format: 20232824 B TDP43_LabelArea_Image.optimized.tiff',
            example: '20232824 B TDP43_LabelArea_Image.optimized.tiff',
            priority: 2,
            enabled: true
        },
        {
            id: 'pattern-3',
            name: 'Extended Format',
            pattern: '^(?<localCaseId>\\d+)\\s+(?<localRegionId>\\w+)\\s+(?<localStainID>\\w+)_(?<localImageType>\\w+)_(?<extendedType>\\w+)',
            description: 'Format: 20243819 H PTDP43_Default_Extended.optimized.tiff',
            example: '20243819 H PTDP43_Default_Extended.optimized.tiff',
            priority: 3,
            enabled: true
        }
    ]
};

// Data source types
export const DATA_SOURCE_TYPES = {
    CSV: 'csv',
    EXCEL: 'excel',
    DSA: 'dsa'
};

// Column visibility settings
export const DEFAULT_COLUMN_VISIBILITY = {
    // Hide all the DSA fields by default
    ...Object.fromEntries(HIDDEN_DSA_FIELDS.map(field => [field, false]))
};
