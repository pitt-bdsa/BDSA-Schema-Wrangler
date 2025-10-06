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
    async getFolders(parentId, parentType = 'collection') {
        try {
            // Use the proper DSA API parameters
            const params = new URLSearchParams({
                parentType: parentType,
                parentId: parentId,
                limit: 0
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

            return {
                hasProtocols,
                hasCaseIdMappings,
                hasAnyBdsaMetadata: hasProtocols || hasCaseIdMappings,
                lastUpdated: data?.meta?.bdsaProtocols?.lastUpdated || null,
                source: data?.meta?.bdsaProtocols?.source || null
            };
        } catch (error) {
            console.error('Failed to check BDSA metadata for folder:', folderId, error);
            return {
                hasProtocols: false,
                hasCaseIdMappings: false,
                hasAnyBdsaMetadata: false,
                lastUpdated: null,
                source: null
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
