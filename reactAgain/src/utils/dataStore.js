// Data Store - Manages loaded data from CSV files and DSA servers
// with localStorage persistence and data transformation

class DataStore {
    constructor() {
        this.listeners = new Set();
        this.processedData = [];
        this.dataSource = null;
        this.dataSourceInfo = null;
        this.dataLoadTimestamp = null;
        this.modifiedItems = new Set();
        this.caseIdMappings = new Map();
        this.caseProtocolMappings = new Map();

        // Load from localStorage on initialization
        this.loadFromStorage();
    }

    // Event system for UI updates
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notify() {
        this.listeners.forEach(listener => listener());
    }

    // Local Storage Management
    loadFromStorage() {
        try {
            const stored = localStorage.getItem('bdsa_data_store');
            if (stored) {
                const data = JSON.parse(stored);
                this.processedData = data.processedData || [];
                this.dataSource = data.dataSource;
                this.dataSourceInfo = data.dataSourceInfo;
                this.dataLoadTimestamp = data.dataLoadTimestamp;
                this.modifiedItems = new Set(data.modifiedItems || []);
                this.caseIdMappings = new Map(data.caseIdMappings || []);
                this.caseProtocolMappings = new Map(data.caseProtocolMappings || []);
            }
        } catch (error) {
            console.error('Error loading data store from storage:', error);
        }
    }

    saveToStorage() {
        try {
            const data = {
                processedData: this.processedData,
                dataSource: this.dataSource,
                dataSourceInfo: this.dataSourceInfo,
                dataLoadTimestamp: this.dataLoadTimestamp,
                modifiedItems: Array.from(this.modifiedItems),
                caseIdMappings: Array.from(this.caseIdMappings),
                caseProtocolMappings: Array.from(this.caseProtocolMappings)
            };
            localStorage.setItem('bdsa_data_store', JSON.stringify(data));
        } catch (error) {
            console.error('Error saving data store to storage:', error);
        }
    }

    // CSV Data Loading
    async loadCsvData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const csvText = e.target.result;
                    const data = this.parseCsv(csvText);

                    this.processedData = data;
                    this.dataSource = 'csv';
                    this.dataSourceInfo = {
                        fileName: file.name,
                        fileSize: file.size,
                        lastModified: file.lastModified
                    };
                    this.dataLoadTimestamp = new Date().toISOString();
                    this.modifiedItems.clear();

                    this.saveToStorage();
                    this.notify();

                    resolve({
                        success: true,
                        itemCount: data.length,
                        message: `Successfully loaded ${data.length} items from CSV`
                    });
                } catch (error) {
                    reject(new Error(`Failed to parse CSV: ${error.message}`));
                }
            };

            reader.onerror = () => {
                reject(new Error('Failed to read CSV file'));
            };

            reader.readAsText(file);
        });
    }

    parseCsv(csvText) {
        const lines = csvText.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
            throw new Error('CSV file must have at least a header and one data row');
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCsvLine(lines[i]);
            if (values.length !== headers.length) {
                console.warn(`Row ${i + 1} has ${values.length} values but expected ${headers.length}`);
                continue;
            }

            const item = {};
            headers.forEach((header, index) => {
                item[header] = values[index];
            });

            // Add BDSA structure for consistency
            item.BDSA = {
                localCaseId: item.caseId || item.localCaseId || item.case_id || '',
                localStainID: item.stainId || item.localStainID || item.stain_id || '',
                localRegionId: item.regionId || item.localRegionId || item.region_id || '',
                stainProtocols: [],
                regionProtocols: []
            };

            data.push(item);
        }

        return data;
    }

    parseCsvLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim().replace(/"/g, ''));
                current = '';
            } else {
                current += char;
            }
        }

        values.push(current.trim().replace(/"/g, ''));
        return values;
    }

    // DSA Data Loading
    async loadDsaData(dsaAuthStore) {
        try {
            const authStatus = dsaAuthStore.getStatus();
            if (!authStatus.isAuthenticated) {
                throw new Error('Not authenticated with DSA server');
            }

            if (!authStatus.isConfigured) {
                throw new Error('DSA server not configured');
            }

            const config = dsaAuthStore.config;
            const token = dsaAuthStore.token;

            const items = await this.fetchDsaItems(config, token);
            const transformedData = this.transformDsaData(items);

            this.processedData = transformedData;
            this.dataSource = 'dsa';
            this.dataSourceInfo = {
                baseUrl: config.baseUrl,
                resourceId: config.resourceId,
                resourceType: config.resourceType
            };
            this.dataLoadTimestamp = new Date().toISOString();
            this.modifiedItems.clear();

            this.saveToStorage();
            this.notify();

            return {
                success: true,
                itemCount: transformedData.length,
                message: `Successfully loaded ${transformedData.length} items from DSA`
            };
        } catch (error) {
            throw new Error(`Failed to load DSA data: ${error.message}`);
        }
    }

    async fetchDsaItems(config, token) {
        const apiUrl = `${config.baseUrl}/resource/${config.resourceId}/items?type=${config.resourceType || 'folder'}&limit=0`;

        const headers = {
            'Content-Type': 'application/json',
            'Girder-Token': token
        };

        console.log('Fetching DSA items from:', apiUrl);

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: headers
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('DSA API Error:', {
                status: response.status,
                statusText: response.statusText,
                url: apiUrl,
                response: errorText
            });
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        const items = await response.json();
        console.log(`✅ Fetched ${items.length} items from DSA`);
        return items;
    }

    transformDsaData(dsaData) {
        if (!dsaData || !Array.isArray(dsaData)) {
            return [];
        }

        console.log('🔄 Transforming DSA data:', {
            itemCount: dsaData.length,
            sampleItem: dsaData[0] ? Object.keys(dsaData[0]) : []
        });

        return dsaData.map((item, index) => {
            // Flatten the entire item, including nested objects and arrays
            const flattenedItem = this.flattenObject(item);

            // Extract common metadata fields from various possible locations
            const extractField = (possibleKeys) => {
                for (const key of possibleKeys) {
                    if (flattenedItem[key] && flattenedItem[key] !== '') {
                        return flattenedItem[key];
                    }
                }
                return '';
            };

            // Create a simplified transformed item
            const transformedItem = {
                // Basic identification
                id: flattenedItem._id || flattenedItem.id || `dsa_item_${index}`,
                name: flattenedItem.name || flattenedItem.filename || flattenedItem.title || '',

                // Include all flattened fields for exploration
                ...flattenedItem,

                // Add DSA-specific fields for reference
                dsa_id: flattenedItem._id || flattenedItem.id || '',
                dsa_name: flattenedItem.name || '',
                dsa_created: flattenedItem.created || flattenedItem.createdAt || '',
                dsa_updated: flattenedItem.updated || flattenedItem.updatedAt || '',
                dsa_size: flattenedItem.size || flattenedItem.fileSize || '',
                dsa_mimeType: flattenedItem.mimeType || flattenedItem.contentType || '',

                // Simple BDSA structure - we'll build this out later
                BDSA: {
                    localCaseId: extractField([
                        'meta.caseId', 'meta.localCaseId', 'caseId', 'localCaseId',
                        'metadata.caseId', 'metadata.localCaseId', 'case_id', 'local_case_id'
                    ]),
                    localStainID: extractField([
                        'meta.stainId', 'meta.localStainID', 'stainId', 'localStainID',
                        'metadata.stainId', 'metadata.localStainID', 'stain_id', 'local_stain_id'
                    ]),
                    localRegionId: extractField([
                        'meta.regionId', 'meta.localRegionId', 'regionId', 'localRegionId',
                        'metadata.regionId', 'metadata.localRegionId', 'region_id', 'local_region_id'
                    ]),
                    stainProtocols: [],
                    regionProtocols: []
                }
            };

            return transformedItem;
        });
    }

    flattenObject(obj, prefix = '') {
        const flattened = {};

        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const newKey = prefix ? `${prefix}.${key}` : key;
                const value = obj[key];

                if (value === null || value === undefined) {
                    // Handle null/undefined values
                    flattened[newKey] = value;
                } else if (Array.isArray(value)) {
                    // Handle arrays - convert to comma-separated string or index-based keys
                    if (value.length === 0) {
                        flattened[newKey] = '';
                    } else if (value.every(item => typeof item === 'string' || typeof item === 'number')) {
                        // Simple array of primitives - join with commas
                        flattened[newKey] = value.join(', ');
                    } else {
                        // Complex array - create indexed entries
                        value.forEach((item, index) => {
                            if (typeof item === 'object' && item !== null) {
                                // Recursively flatten complex array items
                                Object.assign(flattened, this.flattenObject(item, `${newKey}[${index}]`));
                            } else {
                                flattened[`${newKey}[${index}]`] = item;
                            }
                        });
                    }
                } else if (typeof value === 'object') {
                    // Recursively flatten nested objects
                    Object.assign(flattened, this.flattenObject(value, newKey));
                } else {
                    // Add primitive values directly
                    flattened[newKey] = value;
                }
            }
        }

        return flattened;
    }

    // Data Management
    clearData() {
        this.processedData = [];
        this.dataSource = null;
        this.dataSourceInfo = null;
        this.dataLoadTimestamp = null;
        this.modifiedItems.clear();
        this.caseIdMappings.clear();
        this.caseProtocolMappings.clear();

        this.saveToStorage();
        this.notify();
    }

    // Status and Getters
    getStatus() {
        return {
            processedData: this.processedData,
            dataSource: this.dataSource,
            dataSourceInfo: this.dataSourceInfo,
            dataLoadTimestamp: this.dataLoadTimestamp,
            modifiedItems: Array.from(this.modifiedItems),
            caseIdMappings: Array.from(this.caseIdMappings),
            caseProtocolMappings: Array.from(this.caseProtocolMappings)
        };
    }

    // Data Query Methods
    getItemsByCaseId(caseId) {
        return this.processedData.filter(item => item.BDSA.localCaseId === caseId);
    }

    getItemsByStainProtocol(protocolName) {
        return this.processedData.filter(item =>
            item.BDSA.stainProtocols.includes(protocolName)
        );
    }

    getItemsByRegionProtocol(protocolName) {
        return this.processedData.filter(item =>
            item.BDSA.regionProtocols.includes(protocolName)
        );
    }

    getUnmappedCases() {
        return this.processedData.filter(item =>
            item.BDSA.localCaseId && !item.BDSA.bdsaCaseId
        );
    }

    getMappedCases() {
        return this.processedData.filter(item =>
            item.BDSA.localCaseId && item.BDSA.bdsaCaseId
        );
    }

    // Statistics
    getStatistics() {
        const totalItems = this.processedData.length;
        const mappedCases = this.getMappedCases().length;
        const unmappedCases = this.getUnmappedCases().length;
        const uniqueCases = new Set(this.processedData.map(item => item.BDSA.localCaseId)).size;
        const uniqueStainProtocols = new Set(
            this.processedData.flatMap(item => item.BDSA.stainProtocols)
        ).size;
        const uniqueRegionProtocols = new Set(
            this.processedData.flatMap(item => item.BDSA.regionProtocols)
        ).size;

        return {
            totalItems,
            uniqueCases,
            mappedCases,
            unmappedCases,
            uniqueStainProtocols,
            uniqueRegionProtocols,
            modifiedItems: this.modifiedItems.size
        };
    }
}

// Create singleton instance
const dataStore = new DataStore();

export default dataStore;
