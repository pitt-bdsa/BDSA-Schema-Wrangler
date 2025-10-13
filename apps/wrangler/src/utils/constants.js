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

    // Raw duplicate fields from transformDsaData (we use BDSA.bdsaLocal versions instead)
    // These are created during DSA import and conflict with our managed BDSA fields
    'localCaseId',
    'localStainID',
    'localRegionId',
    'localImageType',

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
    'id',
    'name',
    'BDSA.bdsaLocal.bdsaCaseId',
    'BDSA.bdsaLocal.bdsaStainProtocol',
    'BDSA.bdsaLocal.bdsaRegionProtocol',
    'BDSA.bdsaLocal.localCaseId',
    'BDSA.bdsaLocal.localRegionId',
    'BDSA.bdsaLocal.localStainID',
    'BDSA.bdsaLocal.localImageType',
    'dsa_name',
    'dsa_created',
    'dsa_updated',
    'dsa_size',
    'dsa_mimeType'
];

// Default regex rules for common filename patterns
export const DEFAULT_REGEX_RULES = {
    // Primary regex with named groups (single pattern approach)
    primaryPattern: {
        pattern: '^(?<localCaseId>\\d+-\\d+)-(?<localRegionId>\\w+)_(?<localStainID>\\w+)\\.',
        description: 'Single regex pattern with named groups',
        example: '05-662-Temporal_AT8.czi → Case: 05-662, Region: Temporal, Stain: AT8'
    },
    // Fallback individual patterns (for complex cases)
    fallbackPatterns: {
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
    }
};

// Predefined regex rule sets for different dataset patterns
export const REGEX_RULE_SETS = {
    'legacy-dash-format': {
        name: 'Legacy Dash Format',
        description: 'Format: 05-662-Temporal_AT8.czi',
        rules: {
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
        }
    },
    'numeric-space-format': {
        name: 'Numeric Space Format',
        description: 'Format: ######## # Stain (e.g., 20232824 B TDP43)',
        rules: {
            primaryPattern: {
                pattern: '^(?<localCaseId>\\d{8})\\s+(?<localRegionId>\\w+)\\s+(?<localStainID>\\w+)_(?<localImageType>.+?)(?:\\.optimized)?\\.tiff?$',
                description: 'Single regex with named groups for numeric-space format',
                example: '20232824 B TDP43_LabelArea_Image.optimized.tiff → Case: 20232824, Region: B, Stain: TDP43, Type: LabelArea_Image'
            },
            fallbackPatterns: {
                localCaseId: {
                    pattern: '^(\\d{8})',
                    description: 'Extract 8-digit case ID from filename',
                    example: '20232817 B HE_Default_Extended.tif → 20232817'
                },
                localStainID: {
                    pattern: '\\d{8}\\s+\\w+\\s+([^_]+)(?=_)',
                    description: 'Extract stain ID after case ID and region, stopping at underscore',
                    example: '20232817 B HE_Default_Extended.tif → HE'
                },
                localRegionId: {
                    pattern: '\\d{8}\\s+(\\w+)',
                    description: 'Extract region ID after case ID',
                    example: '20232817 B HE_Default_Extended.tif → B'
                },
                localImageType: {
                    pattern: '\\d{8}\\s+\\w+\\s+\\w+_(\\w+(?:_\\w+)*)',
                    description: 'Extract image type after stain (e.g., Default_Extended, Preview_Image)',
                    example: '20232817 B HE_Default_Extended.tif → Default_Extended'
                }
            }
        }
    }
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
