/**
 * Data Source Manager - Handles per-data-source settings and storage
 */

const DATA_SOURCE_TYPES = {
    CSV: 'csv',
    DSA: 'dsa'
};

const STORAGE_KEYS = {
    COLUMN_WIDTHS: 'bdsa_column_widths',
    CASE_ID_MAPPINGS: 'bdsa_case_id_mappings',
    CASE_PROTOCOL_MAPPINGS: 'bdsa_case_protocol_mappings',
    COLUMN_MAPPING: 'bdsa_column_mapping',
    CURRENT_DATA_SOURCE: 'bdsa_current_data_source',
    DSA_CONFIG: 'bdsa_dsa_config',
    REGEX_RULES: 'dsaRegexRules',
    GRID_THEME: 'bdsa_grid_theme',
    GIRDER_TOKEN: 'bdsa_girder_token'
};

/**
 * Generate a hash from a string (simple hash function)
 * @param {string} str - String to hash
 * @returns {string} - Hash string
 */
const simpleHash = (str) => {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
};

/**
 * Generate a unique identifier for a data source
 * @param {string} dataSourceType - Type of data source (csv, dsa)
 * @param {Object} config - Configuration object for the data source
 * @returns {string} - Unique identifier for the data source
 */
const generateDataSourceId = (dataSourceType, config = {}) => {
    if (dataSourceType === DATA_SOURCE_TYPES.CSV) {
        // For CSV, use the filename if available, otherwise use 'default'
        const filename = config.filename || 'default';
        return `csv_${simpleHash(filename)}`;
    } else if (dataSourceType === DATA_SOURCE_TYPES.DSA) {
        // For DSA, use baseUrl and resourceId to create unique identifier
        const baseUrl = config.baseUrl || '';
        const resourceId = config.resourceId || '';
        const identifier = `${baseUrl}_${resourceId}`;
        return `dsa_${simpleHash(identifier)}`;
    }
    return `${dataSourceType}_default`;
};

/**
 * Get storage key for a specific data source
 * @param {string} baseKey - Base storage key
 * @param {string} dataSourceType - Data source type (csv, dsa)
 * @param {Object} config - Configuration object for the data source
 * @returns {string} - Data source specific storage key
 */
const getDataSourceKey = (baseKey, dataSourceType, config = {}) => {
    const dataSourceId = generateDataSourceId(dataSourceType, config);
    return `${baseKey}_${dataSourceId}`;
};

/**
 * Get all data source specific keys for a base key
 * @param {string} baseKey - Base storage key
 * @returns {Array} - Array of data source specific keys
 */
const getAllDataSourceKeys = (baseKey) => {
    return Object.values(DATA_SOURCE_TYPES).map(ds => getDataSourceKey(baseKey, ds));
};

/**
 * Load settings for a specific data source
 * @param {string} dataSource - Data source type
 * @param {string} settingType - Type of setting to load
 * @param {Object} config - Configuration object for the data source
 * @param {*} defaultValue - Default value if not found
 * @returns {*} - Loaded setting value or default
 */
export const loadDataSourceSetting = (dataSource, settingType, config = {}, defaultValue = null) => {
    try {
        const key = getDataSourceKey(STORAGE_KEYS[settingType.toUpperCase()], dataSource, config);
        const stored = localStorage.getItem(key);
        // Check if stored value exists and is not "undefined" string
        if (stored && stored !== 'undefined' && stored !== 'null') {
            const parsed = JSON.parse(stored);
            // Ensure we return the default value if parsed result is null/undefined
            return parsed !== null && parsed !== undefined ? parsed : defaultValue;
        }
        return defaultValue;
    } catch (error) {
        console.error(`Error loading ${settingType} for ${dataSource}:`, error);
        return defaultValue;
    }
};

/**
 * Save settings for a specific data source
 * @param {string} dataSource - Data source type
 * @param {string} settingType - Type of setting to save
 * @param {*} value - Value to save
 * @param {Object} config - Configuration object for the data source
 */
export const saveDataSourceSetting = (dataSource, settingType, value, config = {}) => {
    try {
        const key = getDataSourceKey(STORAGE_KEYS[settingType.toUpperCase()], dataSource, config);
        localStorage.setItem(key, JSON.stringify(value));
        console.log(`Saved ${settingType} for ${dataSource}:`, value);
    } catch (error) {
        console.error(`Error saving ${settingType} for ${dataSource}:`, error);
    }
};

/**
 * Load column widths for a specific data source
 * @param {string} dataSource - Data source type
 * @param {Object} config - Configuration object for the data source
 * @returns {Object} - Column widths object
 */
export const loadColumnWidths = (dataSource, config = {}) => {
    const result = loadDataSourceSetting(dataSource, 'COLUMN_WIDTHS', config, {});
    return result && typeof result === 'object' ? result : {};
};

/**
 * Save column widths for a specific data source
 * @param {string} dataSource - Data source type
 * @param {Object} widths - Column widths object
 * @param {Object} config - Configuration object for the data source
 */
export const saveColumnWidths = (dataSource, widths, config = {}) => {
    saveDataSourceSetting(dataSource, 'COLUMN_WIDTHS', widths, config);
};

/**
 * Load case ID mappings for a specific data source
 * @param {string} dataSource - Data source type
 * @returns {Object} - Case ID mappings object
 */
export const loadCaseIdMappings = (dataSource) => {
    const result = loadDataSourceSetting(dataSource, 'CASE_ID_MAPPINGS', {});
    return result && typeof result === 'object' ? result : {};
};

/**
 * Save case ID mappings for a specific data source
 * @param {string} dataSource - Data source type
 * @param {Object} mappings - Case ID mappings object
 */
export const saveCaseIdMappings = (dataSource, mappings) => {
    saveDataSourceSetting(dataSource, 'CASE_ID_MAPPINGS', mappings);
};

/**
 * Load case protocol mappings for a specific data source
 * @param {string} dataSource - Data source type
 * @returns {Object} - Case protocol mappings object
 */
export const loadCaseProtocolMappings = (dataSource) => {
    const result = loadDataSourceSetting(dataSource, 'CASE_PROTOCOL_MAPPINGS', {});
    return result && typeof result === 'object' ? result : {};
};

/**
 * Save case protocol mappings for a specific data source
 * @param {string} dataSource - Data source type
 * @param {Object} mappings - Case protocol mappings object
 */
export const saveCaseProtocolMappings = (dataSource, mappings) => {
    saveDataSourceSetting(dataSource, 'CASE_PROTOCOL_MAPPINGS', mappings);
};

/**
 * Load column mapping for a specific data source
 * @param {string} dataSource - Data source type
 * @param {Object} config - Configuration object for the data source
 * @returns {Object} - Column mapping object
 */
export const loadColumnMapping = (dataSource, config = {}) => {
    return loadDataSourceSetting(dataSource, 'COLUMN_MAPPING', config, {
        localStainID: '',
        localCaseId: '',
        localRegionId: ''
    });
};

/**
 * Save column mapping for a specific data source
 * @param {string} dataSource - Data source type
 * @param {Object} mapping - Column mapping object
 * @param {Object} config - Configuration object for the data source
 */
export const saveColumnMapping = (dataSource, mapping, config = {}) => {
    saveDataSourceSetting(dataSource, 'COLUMN_MAPPING', mapping, config);
};

/**
 * Load DSA configuration
 * @returns {Object} - DSA configuration object
 */
export const loadDsaConfig = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.DSA_CONFIG);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (error) {
        console.error('Error loading DSA config:', error);
    }

    // Return default config if nothing is stored
    return {
        baseUrl: 'http://multiplex.pathology.emory.edu:8080',
        resourceId: '68bb20d0188a3d83b0a175da',
        resourceType: 'folder',
        apiKey: ''
    };
};

/**
 * Save DSA configuration
 * @param {Object} config - DSA configuration object
 */
export const saveDsaConfig = (config) => {
    try {
        localStorage.setItem(STORAGE_KEYS.DSA_CONFIG, JSON.stringify(config));
    } catch (error) {
        console.error('Error saving DSA config:', error);
    }
};

/**
 * Load regex rules for a specific data source
 * @param {string} dataSource - Data source type
 * @returns {Object} - Regex rules object
 */
export const loadRegexRules = (dataSource, config = {}) => {
    return loadDataSourceSetting(dataSource, 'REGEX_RULES', config, {
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
    });
};

/**
 * Save regex rules for a specific data source
 * @param {string} dataSource - Data source type
 * @param {Object} rules - Regex rules object
 */
export const saveRegexRules = (dataSource, rules) => {
    saveDataSourceSetting(dataSource, 'REGEX_RULES', rules);
};

/**
 * Load grid theme
 * @returns {string} - Grid theme name
 */
export const loadGridTheme = () => {
    try {
        return localStorage.getItem(STORAGE_KEYS.GRID_THEME) || 'alpine';
    } catch (error) {
        console.error('Error loading grid theme:', error);
        return 'alpine';
    }
};

/**
 * Save grid theme
 * @param {string} theme - Grid theme name
 */
export const saveGridTheme = (theme) => {
    try {
        localStorage.setItem(STORAGE_KEYS.GRID_THEME, theme);
    } catch (error) {
        console.error('Error saving grid theme:', error);
    }
};

/**
 * Load current data source
 * @returns {string} - Current data source ('csv' or 'dsa')
 */
export const loadCurrentDataSource = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.CURRENT_DATA_SOURCE);
        return stored || DATA_SOURCE_TYPES.DSA; // Default to DSA
    } catch (error) {
        console.error('Error loading current data source:', error);
        return DATA_SOURCE_TYPES.DSA;
    }
};

/**
 * Save current data source
 * @param {string} dataSource - Data source to save
 */
export const saveCurrentDataSource = (dataSource) => {
    try {
        localStorage.setItem(STORAGE_KEYS.CURRENT_DATA_SOURCE, dataSource);
    } catch (error) {
        console.error('Error saving current data source:', error);
    }
};

/**
 * Migrate old global settings to data source specific settings
 * This function should be called once to migrate existing data
 */
export const migrateOldSettings = () => {
    const migrationKey = 'bdsa_settings_migrated';

    if (localStorage.getItem(migrationKey)) {
        return; // Already migrated
    }

    try {
        // Migrate column widths
        const oldColumnWidths = localStorage.getItem(STORAGE_KEYS.COLUMN_WIDTHS);
        if (oldColumnWidths) {
            const widths = JSON.parse(oldColumnWidths);
            saveColumnWidths(DATA_SOURCE_TYPES.CSV, widths);
            saveColumnWidths(DATA_SOURCE_TYPES.DSA, widths);
            localStorage.removeItem(STORAGE_KEYS.COLUMN_WIDTHS);
        }

        // Migrate case ID mappings
        const oldCaseIdMappings = localStorage.getItem(STORAGE_KEYS.CASE_ID_MAPPINGS);
        if (oldCaseIdMappings) {
            const mappings = JSON.parse(oldCaseIdMappings);
            saveCaseIdMappings(DATA_SOURCE_TYPES.CSV, mappings);
            saveCaseIdMappings(DATA_SOURCE_TYPES.DSA, mappings);
            localStorage.removeItem(STORAGE_KEYS.CASE_ID_MAPPINGS);
        }

        // Migrate case protocol mappings
        const oldCaseProtocolMappings = localStorage.getItem(STORAGE_KEYS.CASE_PROTOCOL_MAPPINGS);
        if (oldCaseProtocolMappings) {
            const mappings = JSON.parse(oldCaseProtocolMappings);
            saveCaseProtocolMappings(DATA_SOURCE_TYPES.CSV, mappings);
            saveCaseProtocolMappings(DATA_SOURCE_TYPES.DSA, mappings);
            localStorage.removeItem(STORAGE_KEYS.CASE_PROTOCOL_MAPPINGS);
        }

        // Migrate DSA config
        const oldDsaConfig = localStorage.getItem(STORAGE_KEYS.DSA_CONFIG);
        if (oldDsaConfig) {
            const config = JSON.parse(oldDsaConfig);
            saveDsaConfig(config);
            localStorage.removeItem(STORAGE_KEYS.DSA_CONFIG);
        }

        // Migrate regex rules
        const oldRegexRules = localStorage.getItem(STORAGE_KEYS.REGEX_RULES);
        if (oldRegexRules) {
            const rules = JSON.parse(oldRegexRules);
            saveRegexRules(DATA_SOURCE_TYPES.DSA, rules);
            localStorage.removeItem(STORAGE_KEYS.REGEX_RULES);
        }

        // Mark migration as complete
        localStorage.setItem(migrationKey, 'true');
        console.log('Successfully migrated old settings to data source specific storage');
    } catch (error) {
        console.error('Error during settings migration:', error);
    }
};

/**
 * Load Girder token from localStorage
 * @returns {string} - Girder token
 */
export const loadGirderToken = () => {
    try {
        return localStorage.getItem(STORAGE_KEYS.GIRDER_TOKEN) || '';
    } catch (error) {
        console.error('Error loading Girder token:', error);
        return '';
    }
};

/**
 * Save Girder token to localStorage
 * @param {string} token - Girder token
 */
export const saveGirderToken = (token) => {
    try {
        if (token) {
            localStorage.setItem(STORAGE_KEYS.GIRDER_TOKEN, token);
        } else {
            localStorage.removeItem(STORAGE_KEYS.GIRDER_TOKEN);
        }
    } catch (error) {
        console.error('Error saving Girder token:', error);
    }
};

export { DATA_SOURCE_TYPES, simpleHash };
