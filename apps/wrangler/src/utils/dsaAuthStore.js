// DSA Authentication Store - Manages DSA server authentication and configuration
// with localStorage persistence and token management

const STORAGE_KEYS = {
    DSA_CONFIG: 'bdsa_dsa_config',
    GIRDER_TOKEN: 'bdsa_girder_token',
    USER_INFO: 'bdsa_user_info',
    LAST_LOGIN: 'bdsa_last_login',
    TOKEN_EXPIRY: 'bdsa_token_expiry'
};

class DsaAuthStore {
    constructor() {
        this.listeners = new Set();
        this.config = this.loadConfig();
        this.token = this.loadToken();
        this.userInfo = this.loadUserInfo();
        this.lastLogin = this.loadLastLogin();
        this.tokenExpiry = this.loadTokenExpiry();
        this.isAuthenticated = this.validateAuthentication();
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
    loadConfig() {
        try {
            const stored = localStorage.getItem(STORAGE_KEYS.DSA_CONFIG);
            return stored ? JSON.parse(stored) : {
                baseUrl: '',
                resourceId: '',
                resourceType: 'folder',
                fetchStrategy: 'unlimited',
                pageSize: 100
            };
        } catch (error) {
            console.error('Error loading DSA config:', error);
            return {
                baseUrl: '',
                resourceId: '',
                resourceType: 'folder',
                fetchStrategy: 'unlimited',
                pageSize: 100
            };
        }
    }

    loadToken() {
        try {
            return localStorage.getItem(STORAGE_KEYS.GIRDER_TOKEN) || '';
        } catch (error) {
            console.error('Error loading Girder token:', error);
            return '';
        }
    }

    loadUserInfo() {
        try {
            const stored = localStorage.getItem(STORAGE_KEYS.USER_INFO);
            return stored ? JSON.parse(stored) : null;
        } catch (error) {
            console.error('Error loading user info:', error);
            return null;
        }
    }

    loadLastLogin() {
        try {
            const stored = localStorage.getItem(STORAGE_KEYS.LAST_LOGIN);
            return stored ? new Date(stored) : null;
        } catch (error) {
            console.error('Error loading last login:', error);
            return null;
        }
    }

    loadTokenExpiry() {
        try {
            const stored = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);
            return stored ? new Date(stored) : null;
        } catch (error) {
            console.error('Error loading token expiry:', error);
            return null;
        }
    }

    saveConfig() {
        try {
            localStorage.setItem(STORAGE_KEYS.DSA_CONFIG, JSON.stringify(this.config));
        } catch (error) {
            console.error('Error saving DSA config:', error);
        }
    }

    saveToken() {
        try {
            localStorage.setItem(STORAGE_KEYS.GIRDER_TOKEN, this.token);
        } catch (error) {
            console.error('Error saving Girder token:', error);
        }
    }

    saveUserInfo() {
        try {
            localStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(this.userInfo));
        } catch (error) {
            console.error('Error saving user info:', error);
        }
    }

    saveLastLogin() {
        try {
            localStorage.setItem(STORAGE_KEYS.LAST_LOGIN, this.lastLogin?.toISOString() || '');
        } catch (error) {
            console.error('Error saving last login:', error);
        }
    }

    saveTokenExpiry() {
        try {
            localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, this.tokenExpiry?.toISOString() || '');
        } catch (error) {
            console.error('Error saving token expiry:', error);
        }
    }

    // Authentication Management
    validateAuthentication() {
        if (!this.token || !this.config.baseUrl) {
            return false;
        }

        // Check if token has expired (if we have expiry info)
        if (this.tokenExpiry && new Date() > this.tokenExpiry) {
            console.log('Token has expired');
            this.logout();
            return false;
        }

        return true;
    }

    async authenticate(username, password) {
        try {
            if (!this.config.baseUrl) {
                throw new Error('DSA server URL not configured');
            }

            const credentials = btoa(`${username}:${password}`);
            const response = await fetch(`${this.config.baseUrl}/api/v1/user/authentication`, {
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${credentials}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Authentication failed: ${response.status}`);
            }

            const authData = await response.json();
            const girderToken = authData?.authToken?.token;
            const userData = authData?.user;

            if (!girderToken) {
                throw new Error('No authentication token received from server');
            }

            // Store authentication data
            this.token = girderToken;
            this.userInfo = {
                id: userData?._id || userData?.id,
                name: userData?.login || userData?.firstName || userData?.email || 'User',
                email: userData?.email,
                login: userData?.login
            };
            this.lastLogin = new Date();

            // Set token expiry (Girder tokens typically last 30 days)
            this.tokenExpiry = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000));

            this.isAuthenticated = true;

            // Save to localStorage
            this.saveToken();
            this.saveUserInfo();
            this.saveLastLogin();
            this.saveTokenExpiry();

            this.notify();
            return { success: true, user: this.userInfo };
        } catch (error) {
            console.error('Authentication failed:', error);
            this.logout();
            throw error;
        }
    }

    async logout() {
        try {
            // If we have a token and server URL, try to logout from server
            if (this.token && this.config.baseUrl) {
                await fetch(`${this.config.baseUrl}/api/v1/user/authentication`, {
                    method: 'DELETE',
                    headers: {
                        'Girder-Token': this.token
                    }
                });
            }
        } catch (error) {
            console.warn('Server logout failed:', error);
            // Continue with local logout even if server logout fails
        }

        // Clear local state
        this.token = '';
        this.userInfo = null;
        this.lastLogin = null;
        this.tokenExpiry = null;
        this.isAuthenticated = false;

        // Clear localStorage
        localStorage.removeItem(STORAGE_KEYS.GIRDER_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.USER_INFO);
        localStorage.removeItem(STORAGE_KEYS.LAST_LOGIN);
        localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY);

        this.notify();
    }

    async validateToken() {
        if (!this.token || !this.config.baseUrl) {
            return false;
        }

        try {
            const response = await fetch(`${this.config.baseUrl}/api/v1/user/me`, {
                headers: {
                    'Girder-Token': this.token
                }
            });

            if (response.ok) {
                return true;
            } else {
                console.log('Token validation failed, logging out');
                this.logout();
                return false;
            }
        } catch (error) {
            console.error('Token validation error:', error);
            this.logout();
            return false;
        }
    }

    // Configuration Management
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.saveConfig();
        this.notify();
    }

    setServerUrl(baseUrl) {
        this.config.baseUrl = baseUrl;
        this.saveConfig();
        this.notify();
    }

    setResourceConfig(resourceId, resourceType = 'folder') {
        this.config.resourceId = resourceId;
        this.config.resourceType = resourceType;
        this.saveConfig();
        this.notify();
    }

    // Utility Methods
    getAuthHeaders() {
        if (!this.isAuthenticated) {
            return {};
        }
        return {
            'Girder-Token': this.token,
            'Content-Type': 'application/json'
        };
    }

    getApiUrl(endpoint) {
        if (!this.config.baseUrl) {
            throw new Error('DSA server URL not configured');
        }
        return `${this.config.baseUrl}${endpoint}`;
    }

    getResourceApiUrl() {
        if (!this.config.resourceId) {
            throw new Error('DSA resource ID not configured');
        }
        return `${this.config.baseUrl}/resource/${this.config.resourceId}`;
    }

    isConfigured() {
        return !!(this.config.baseUrl && this.config.resourceId);
    }

    getStatus() {
        return {
            isAuthenticated: this.isAuthenticated,
            isConfigured: this.isConfigured(),
            hasToken: !!this.token,
            hasConfig: !!this.config.baseUrl,
            user: this.userInfo,
            serverUrl: this.config.baseUrl,
            resourceId: this.config.resourceId,
            resourceType: this.config.resourceType,
            lastLogin: this.lastLogin,
            tokenExpiry: this.tokenExpiry
        };
    }

    getConfig() {
        return { ...this.config };
    }

    getToken() {
        return this.token;
    }

    // Test connection to DSA server
    async testConnection() {
        if (!this.config.baseUrl) {
            throw new Error('DSA server URL not configured');
        }

        try {
            const response = await fetch(`${this.config.baseUrl}/api/v1/system/version`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const versionData = await response.json();
                return {
                    success: true,
                    version: versionData,
                    message: 'Connection successful'
                };
            } else {
                throw new Error(`Server responded with status: ${response.status}`);
            }
        } catch (error) {
            throw new Error(`Connection failed: ${error.message}`);
        }
    }

    // Test resource access
    async testResourceAccess() {
        if (!this.isAuthenticated || !this.isConfigured()) {
            throw new Error('Not authenticated or not configured');
        }

        try {
            const response = await fetch(`${this.getResourceApiUrl()}/items?limit=1`, {
                headers: this.getAuthHeaders()
            });

            if (response.ok) {
                return {
                    success: true,
                    message: 'Resource access successful'
                };
            } else {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Resource access failed: ${response.status}`);
            }
        } catch (error) {
            throw new Error(`Resource access failed: ${error.message}`);
        }
    }
}

// Create singleton instance
const dsaAuthStore = new DsaAuthStore();

export default dsaAuthStore;
