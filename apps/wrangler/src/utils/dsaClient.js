// DSA Client for BDSA Schema Wrangler
// Provides methods to interact with Digital Slide Archive API

class DSAClient {
    constructor(baseUrl, token = '') {
        this.baseUrl = baseUrl.replace(/\/+$/, ''); // Remove trailing slashes
        this.token = token;
    }

    setToken(token) {
        this.token = token;
    }

    getToken() {
        return this.token;
    }

    // Make authenticated API requests
    async makeRequest(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.token) {
            headers['Girder-Token'] = this.token;
        }

        const response = await fetch(url, {
            ...options,
            headers
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`DSA API Error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        return response.json();
    }

    // Get all collections
    async getCollections() {
        try {
            const data = await this.makeRequest('/api/v1/collection', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            return data || [];
        } catch (error) {
            console.error('Failed to get collections:', error);
            throw new Error(`Failed to get collections: ${error.message}`);
        }
    }

    // Get folders in a collection or folder
    async getFolders(parentId, parentType = 'collection', limit = 20, offset = 0) {
        try {
            // Use the proper DSA API parameters with pagination
            const params = new URLSearchParams({
                parentType: parentType,
                parentId: parentId,
                limit: limit,
                offset: offset
            });

            const data = await this.makeRequest(`/api/v1/folder?${params}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            return data || [];
        } catch (error) {
            console.error('Failed to get folders:', error);
            throw new Error(`Failed to get folders: ${error.message}`);
        }
    }

    // Get items in a folder or collection
    async getItems(resourceId, resourceType = 'folder') {
        try {
            const endpoint = resourceType === 'collection'
                ? `/api/v1/item?folderId=${resourceId}`
                : `/api/v1/item?folderId=${resourceId}`;

            const data = await this.makeRequest(endpoint, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            return data || [];
        } catch (error) {
            console.error('Failed to get items:', error);
            throw new Error(`Failed to get items: ${error.message}`);
        }
    }

    // Get resource name by ID and type
    async getResourceName(resourceId, resourceType = 'folder') {
        try {
            const endpoint = resourceType === 'collection'
                ? `/api/v1/collection/${resourceId}`
                : `/api/v1/folder/${resourceId}`;

            const data = await this.makeRequest(endpoint, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            return {
                name: data?.name || 'Unknown',
                type: resourceType,
                id: resourceId
            };
        } catch (error) {
            console.error('Failed to get resource name:', error);
            return {
                name: 'Unknown',
                type: resourceType,
                id: resourceId
            };
        }
    }

    // Check if a collection has BDSA protocols metadata
    async hasBdsaMetadataForCollection(collectionId) {
        try {
            const data = await this.makeRequest(`/api/v1/collection/${collectionId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            // Check for BDSA protocols metadata
            const hasProtocols = data?.meta?.bdsaProtocols &&
                (data.meta.bdsaProtocols.stainProtocols?.length > 0 ||
                    data.meta.bdsaProtocols.regionProtocols?.length > 0);

            // Check for BDSA case ID mappings
            const hasCaseIdMappings = data?.meta?.bdsaCaseIdMappings &&
                Object.keys(data.meta.bdsaCaseIdMappings).length > 0;

            // Get detailed statistics
            const stainProtocolCount = data?.meta?.bdsaProtocols?.stainProtocols?.length || 0;
            const regionProtocolCount = data?.meta?.bdsaProtocols?.regionProtocols?.length || 0;
            const caseIdMappingCount = data?.meta?.bdsaCaseIdMappings?.mappings?.length || 0;
            const totalMappings = data?.meta?.bdsaCaseIdMappings?.totalMappings || 0;

            // Check for additional metadata types
            const hasColumnMappings = data?.meta?.bdsaColumnMappings && Object.keys(data.meta.bdsaColumnMappings).length > 0;
            const hasRegexRules = data?.meta?.bdsaRegexRules && Object.keys(data.meta.bdsaRegexRules).length > 0;

            // Get institution ID if available
            const institutionId = data?.meta?.bdsaCaseIdMappings?.institutionId ||
                data?.meta?.bdsaProtocols?.institutionId || null;

            // Check for metadata folder references (when using separate metadata folders)
            const metadataFolderRef = data?.meta?.bdsaMetadataFolder || null;
            const isMetadataFolder = data?.meta?.bdsaIsMetadataFolder || false;

            // Check if this collection has been indexed/processed by BDSA Wrangler
            const hasBeenIndexed = data?.meta?.bdsaIndexed ||
                data?.meta?.bdsaProcessed ||
                data?.meta?.bdsaWranglerTouch || false;

            // Check for BDSA Wrangler touch indicator
            const hasWranglerTouch = data?.meta?.bdsaWranglerTouch || false;

            // Determine collection type for display
            const collectionType = isMetadataFolder ? 'metadata' :
                hasWranglerTouch ? 'wrangler-touched' :
                    hasBeenIndexed ? 'indexed' :
                        (hasProtocols || hasCaseIdMappings) ? 'indexed' : null;

            return {
                hasProtocols,
                hasCaseIdMappings,
                hasAnyBdsaMetadata: hasProtocols || hasCaseIdMappings,
                hasBeenIndexed,
                hasWranglerTouch,
                isMetadataFolder,
                collectionType,
                lastUpdated: data?.meta?.bdsaProtocols?.lastUpdated ||
                    data?.meta?.bdsaCaseIdMappings?.lastUpdated || null,
                source: data?.meta?.bdsaProtocols?.source ||
                    data?.meta?.bdsaCaseIdMappings?.source || null,

                // Detailed statistics
                statistics: {
                    stainProtocolCount,
                    regionProtocolCount,
                    caseIdMappingCount,
                    totalMappings,
                    hasColumnMappings,
                    hasRegexRules,
                    institutionId,
                    metadataFolderRef,
                    isMetadataFolder,
                    hasBeenIndexed
                },

                // Quick access to counts
                totalProtocols: stainProtocolCount + regionProtocolCount,
                totalMetadataTypes: [
                    hasProtocols && 'protocols',
                    hasCaseIdMappings && 'caseIdMappings',
                    hasColumnMappings && 'columnMappings',
                    hasRegexRules && 'regexRules'
                ].filter(Boolean).length
            };
        } catch (error) {
            console.error('Failed to check BDSA metadata for collection:', collectionId, error);
            return {
                hasProtocols: false,
                hasCaseIdMappings: false,
                hasAnyBdsaMetadata: false,
                hasBeenIndexed: false,
                hasWranglerTouch: false,
                isMetadataFolder: false,
                collectionType: null,
                lastUpdated: null,
                source: null,
                statistics: {
                    stainProtocolCount: 0,
                    regionProtocolCount: 0,
                    caseIdMappingCount: 0,
                    totalMappings: 0,
                    hasColumnMappings: false,
                    hasRegexRules: false,
                    institutionId: null,
                    metadataFolderRef: null,
                    isMetadataFolder: false,
                    hasBeenIndexed: false
                },
                totalProtocols: 0,
                totalMetadataTypes: 0
            };
        }
    }

    // Check if a folder has BDSA protocols metadata
    async hasBdsaMetadata(folderId) {
        try {
            const data = await this.makeRequest(`/api/v1/folder/${folderId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            // Check for BDSA protocols metadata
            const hasProtocols = data?.meta?.bdsaProtocols &&
                (data.meta.bdsaProtocols.stainProtocols?.length > 0 ||
                    data.meta.bdsaProtocols.regionProtocols?.length > 0);

            // Check for BDSA case ID mappings
            const hasCaseIdMappings = data?.meta?.bdsaCaseIdMappings &&
                Object.keys(data.meta.bdsaCaseIdMappings).length > 0;

            // Get detailed statistics
            const stainProtocolCount = data?.meta?.bdsaProtocols?.stainProtocols?.length || 0;
            const regionProtocolCount = data?.meta?.bdsaProtocols?.regionProtocols?.length || 0;
            const caseIdMappingCount = data?.meta?.bdsaCaseIdMappings?.mappings?.length || 0;
            const totalMappings = data?.meta?.bdsaCaseIdMappings?.totalMappings || 0;

            // Check for additional metadata types
            const hasColumnMappings = data?.meta?.bdsaColumnMappings && Object.keys(data.meta.bdsaColumnMappings).length > 0;
            const hasRegexRules = data?.meta?.bdsaRegexRules && Object.keys(data.meta.bdsaRegexRules).length > 0;

            // Get institution ID if available
            const institutionId = data?.meta?.bdsaCaseIdMappings?.institutionId ||
                data?.meta?.bdsaProtocols?.institutionId || null;

            // Check for metadata folder references (when using separate metadata folders)
            const metadataFolderRef = data?.meta?.bdsaMetadataFolder || null;
            const isMetadataFolder = data?.meta?.bdsaIsMetadataFolder || false;

            // Check if this folder has been indexed/processed by BDSA Wrangler
            const hasBeenIndexed = data?.meta?.bdsaIndexed ||
                data?.meta?.bdsaProcessed ||
                data?.meta?.bdsaWranglerTouch || false;

            // Check for BDSA Wrangler touch indicator
            const hasWranglerTouch = data?.meta?.bdsaWranglerTouch || false;

            // Determine folder type for display
            const folderType = isMetadataFolder ? 'metadata' :
                hasWranglerTouch ? 'wrangler-touched' :
                    hasBeenIndexed ? 'indexed' :
                        (hasProtocols || hasCaseIdMappings) ? 'indexed' : null;

            return {
                hasProtocols,
                hasCaseIdMappings,
                hasAnyBdsaMetadata: hasProtocols || hasCaseIdMappings,
                hasBeenIndexed,
                hasWranglerTouch,
                isMetadataFolder,
                folderType,
                lastUpdated: data?.meta?.bdsaProtocols?.lastUpdated ||
                    data?.meta?.bdsaCaseIdMappings?.lastUpdated || null,
                source: data?.meta?.bdsaProtocols?.source ||
                    data?.meta?.bdsaCaseIdMappings?.source || null,

                // Detailed statistics
                statistics: {
                    stainProtocolCount,
                    regionProtocolCount,
                    caseIdMappingCount,
                    totalMappings,
                    hasColumnMappings,
                    hasRegexRules,
                    institutionId,
                    metadataFolderRef,
                    isMetadataFolder,
                    hasBeenIndexed
                },

                // Quick access to counts
                totalProtocols: stainProtocolCount + regionProtocolCount,
                totalMetadataTypes: [
                    hasProtocols && 'protocols',
                    hasCaseIdMappings && 'caseIdMappings',
                    hasColumnMappings && 'columnMappings',
                    hasRegexRules && 'regexRules'
                ].filter(Boolean).length
            };
        } catch (error) {
            console.error('Failed to check BDSA metadata for folder:', folderId, error);
            return {
                hasProtocols: false,
                hasCaseIdMappings: false,
                hasAnyBdsaMetadata: false,
                hasBeenIndexed: false,
                hasWranglerTouch: false,
                isMetadataFolder: false,
                folderType: null,
                lastUpdated: null,
                source: null,
                statistics: {
                    stainProtocolCount: 0,
                    regionProtocolCount: 0,
                    caseIdMappingCount: 0,
                    totalMappings: 0,
                    hasColumnMappings: false,
                    hasRegexRules: false,
                    institutionId: null,
                    metadataFolderRef: null,
                    isMetadataFolder: false,
                    hasBeenIndexed: false
                },
                totalProtocols: 0,
                totalMetadataTypes: 0
            };
        }
    }

    // Test connection to DSA server
    async testConnection() {
        try {
            const data = await this.makeRequest('/api/v1/system/check', {
                method: 'GET'
            });
            return {
                success: true,
                version: data,
                message: 'Connection successful'
            };
        } catch (error) {
            return {
                success: false,
                message: `Connection failed: ${error.message}`
            };
        }
    }

    // Authenticate with username and password
    async authenticate(username, password) {
        try {
            const credentials = btoa(`${username}:${password}`);
            const data = await this.makeRequest('/api/v1/user/authentication', {
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${credentials}`
                }
            });

            const girderToken = data?.authToken?.token;
            const userData = data?.user;

            if (!girderToken) {
                throw new Error('No authentication token received from server');
            }

            this.token = girderToken;
            return {
                success: true,
                token: girderToken,
                user: userData
            };
        } catch (error) {
            console.error('Authentication failed:', error);
            throw new Error(`Authentication failed: ${error.message}`);
        }
    }

    // Validate current token
    async validateToken() {
        if (!this.token) return false;

        try {
            await this.makeRequest('/api/v1/user/me', {
                method: 'GET'
            });
            return true;
        } catch (error) {
            console.error('Token validation failed:', error);
            return false;
        }
    }

    // Logout
    async logout() {
        try {
            if (this.token) {
                await this.makeRequest('/api/v1/user/authentication', {
                    method: 'DELETE'
                });
            }
            this.token = '';
            return { success: true };
        } catch (error) {
            console.error('Logout failed:', error);
            // Clear token even if logout request fails
            this.token = '';
            return { success: true };
        }
    }
}

export default DSAClient;
