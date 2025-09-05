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
    DSA_CONFIG: 'bdsa_dsa_config',
    REGEX_RULES: 'dsaRegexRules',
    GRID_THEME: 'bdsa_grid_theme'
};

/**
 * Get storage key for a specific data source
 * @param {string} baseKey - Base storage key
 * @param {string} dataSource - Data source type (csv, dsa)
 * @returns {string} - Data source specific storage key
 */
const getDataSourceKey = (baseKey, dataSource) => {
    return `${baseKey}_${dataSource}`;
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
 * @returns {*} - Loaded setting value or default
 */
export const loadDataSourceSetting = (dataSource, settingType, defaultValue = null) => {
    try {
        const key = getDataSourceKey(STORAGE_KEYS[settingType.toUpperCase()], dataSource);
        const stored = localStorage.getItem(key);
        if (stored) {
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
 */
export const saveDataSourceSetting = (dataSource, settingType, value) => {
    try {
        const key = getDataSourceKey(STORAGE_KEYS[settingType.toUpperCase()], dataSource);
        localStorage.setItem(key, JSON.stringify(value));
        console.log(`Saved ${settingType} for ${dataSource}:`, value);
    } catch (error) {
        console.error(`Error saving ${settingType} for ${dataSource}:`, error);
    }
};

/**
 * Load column widths for a specific data source
 * @param {string} dataSource - Data source type
 * @returns {Object} - Column widths object
 */
export const loadColumnWidths = (dataSource) => {
    const result = loadDataSourceSetting(dataSource, 'COLUMN_WIDTHS', {});
    return result && typeof result === 'object' ? result : {};
};

/**
 * Save column widths for a specific data source
 * @param {string} dataSource - Data source type
 * @param {Object} widths - Column widths object
 */
export const saveColumnWidths = (dataSource, widths) => {
    saveDataSourceSetting(dataSource, 'COLUMN_WIDTHS', widths);
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
 * Load DSA configuration
 * @returns {Object} - DSA configuration object
 */
export const loadDsaConfig = () => {
    return loadDataSourceSetting(DATA_SOURCE_TYPES.DSA, 'DSA_CONFIG', {
        baseUrl: 'http://multiplex.pathology.emory.edu:8080',
        resourceId: '68bb20d0188a3d83b0a175da',
        resourceType: 'folder',
        apiKey: ''
    });
};

/**
 * Save DSA configuration
 * @param {Object} config - DSA configuration object
 */
export const saveDsaConfig = (config) => {
    saveDataSourceSetting(DATA_SOURCE_TYPES.DSA, 'DSA_CONFIG', config);
};

/**
 * Load regex rules for a specific data source
 * @param {string} dataSource - Data source type
 * @returns {Object} - Regex rules object
 */
export const loadRegexRules = (dataSource) => {
    return loadDataSourceSetting(dataSource, 'REGEX_RULES', {
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

export { DATA_SOURCE_TYPES };
