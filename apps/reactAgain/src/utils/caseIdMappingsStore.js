// Case ID Mappings Store - Manages case ID mappings separately from main data
// This store will eventually fetch mappings from a DSA server

class CaseIdMappingsStore {
    constructor() {
        this.listeners = new Set();
        this.caseIdMappings = new Map();
        this.isLoading = false;
        this.lastFetchTimestamp = null;
        this.serverUrl = null;

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
            const stored = localStorage.getItem('bdsa_case_id_mappings');
            if (stored) {
                const data = JSON.parse(stored);
                this.caseIdMappings = new Map(data.mappings || []);
                this.lastFetchTimestamp = data.lastFetchTimestamp;
                this.serverUrl = data.serverUrl;
            }
        } catch (error) {
            console.error('Error loading case ID mappings from storage:', error);
        }
    }

    saveToStorage() {
        try {
            const data = {
                mappings: Array.from(this.caseIdMappings),
                lastFetchTimestamp: this.lastFetchTimestamp,
                serverUrl: this.serverUrl
            };
            localStorage.setItem('bdsa_case_id_mappings', JSON.stringify(data));
        } catch (error) {
            console.error('Error saving case ID mappings to storage:', error);
        }
    }

    // Get current status
    getStatus() {
        return {
            caseIdMappings: Object.fromEntries(this.caseIdMappings),
            isLoading: this.isLoading,
            lastFetchTimestamp: this.lastFetchTimestamp,
            serverUrl: this.serverUrl
        };
    }

    // Update case ID mappings
    updateCaseIdMappings(mappings) {
        if (mappings instanceof Map) {
            this.caseIdMappings = new Map(mappings);
        } else if (typeof mappings === 'object') {
            this.caseIdMappings = new Map(Object.entries(mappings));
        } else {
            throw new Error('Invalid mappings format. Expected Object or Map.');
        }

        this.saveToStorage();
        this.notify();
    }

    // Add or update a single mapping
    setCaseIdMapping(localCaseId, bdsaCaseId) {
        const trimmedValue = bdsaCaseId ? bdsaCaseId.trim() : '';

        if (trimmedValue) {
            this.caseIdMappings.set(localCaseId, trimmedValue);
        } else {
            this.caseIdMappings.delete(localCaseId);
        }

        this.saveToStorage();
        this.notify();
    }

    // Get BDSA Case ID for a local case ID
    getBdsaCaseId(localCaseId) {
        return this.caseIdMappings.get(localCaseId) || null;
    }

    // Check if a local case ID is mapped
    isCaseIdMapped(localCaseId) {
        return this.caseIdMappings.has(localCaseId);
    }

    // Get all mappings as an object
    getAllMappings() {
        return Object.fromEntries(this.caseIdMappings);
    }

    // Clear all mappings
    clearMappings() {
        this.caseIdMappings.clear();
        this.saveToStorage();
        this.notify();
    }

    // Clear duplicate mappings (remove all but the first occurrence of each BDSA Case ID)
    clearDuplicateMappings() {
        const seenBdsaIds = new Set();
        const newMappings = new Map();

        for (const [localCaseId, bdsaCaseId] of this.caseIdMappings) {
            if (!seenBdsaIds.has(bdsaCaseId)) {
                newMappings.set(localCaseId, bdsaCaseId);
                seenBdsaIds.add(bdsaCaseId);
            }
        }

        this.caseIdMappings = newMappings;
        this.saveToStorage();
        this.notify();
    }

    // Get duplicate BDSA Case IDs
    getDuplicateBdsaCaseIds() {
        const bdsaIdCounts = new Map();
        const duplicates = new Set();

        for (const [localCaseId, bdsaCaseId] of this.caseIdMappings) {
            const count = bdsaIdCounts.get(bdsaCaseId) || 0;
            bdsaIdCounts.set(bdsaCaseId, count + 1);

            if (count > 0) {
                duplicates.add(bdsaCaseId);
            }
        }

        return Array.from(duplicates);
    }

    // Get local case IDs that have duplicate BDSA Case IDs
    getLocalCaseIdsWithDuplicates() {
        const duplicates = this.getDuplicateBdsaCaseIds();
        const duplicateLocalIds = [];

        for (const [localCaseId, bdsaCaseId] of this.caseIdMappings) {
            if (duplicates.includes(bdsaCaseId)) {
                duplicateLocalIds.push(localCaseId);
            }
        }

        return duplicateLocalIds;
    }

    // Fetch mappings from DSA server (placeholder for future implementation)
    async fetchMappingsFromServer(serverUrl, authToken) {
        this.isLoading = true;
        this.serverUrl = serverUrl;
        this.notify();

        try {
            // TODO: Implement actual DSA server fetch
            // For now, just simulate a successful fetch
            console.log('🔄 Fetching case ID mappings from DSA server...', serverUrl);

            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));

            // For now, return empty mappings
            // In the future, this would fetch from the DSA server
            const serverMappings = {};

            this.caseIdMappings = new Map(Object.entries(serverMappings));
            this.lastFetchTimestamp = new Date().toISOString();

            this.saveToStorage();
            this.notify();

            return {
                success: true,
                mappingsCount: this.caseIdMappings.size,
                message: 'Successfully fetched case ID mappings from server'
            };

        } catch (error) {
            console.error('Error fetching case ID mappings from server:', error);
            this.isLoading = false;
            this.notify();

            return {
                success: false,
                error: error.message
            };
        } finally {
            this.isLoading = false;
        }
    }

    // Sync mappings to DSA server (placeholder for future implementation)
    async syncMappingsToServer(serverUrl, authToken) {
        this.isLoading = true;
        this.notify();

        try {
            // TODO: Implement actual DSA server sync
            console.log('🔄 Syncing case ID mappings to DSA server...', serverUrl);

            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));

            this.lastFetchTimestamp = new Date().toISOString();
            this.saveToStorage();
            this.notify();

            return {
                success: true,
                mappingsCount: this.caseIdMappings.size,
                message: 'Successfully synced case ID mappings to server'
            };

        } catch (error) {
            console.error('Error syncing case ID mappings to server:', error);
            this.isLoading = false;
            this.notify();

            return {
                success: false,
                error: error.message
            };
        } finally {
            this.isLoading = false;
        }
    }

    // Generate next sequential BDSA Case ID
    generateNextSequentialId(institutionId = '001') {
        const existingNumbers = Array.from(this.caseIdMappings.values())
            .filter(id => id && id.startsWith(`BDSA-${institutionId.padStart(3, '0')}-`))
            .map(id => {
                const match = id.match(/BDSA-\d{3}-(\d{4})/);
                return match ? parseInt(match[1], 10) : 0;
            });

        const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
        return `BDSA-${institutionId.padStart(3, '0')}-${(maxNumber + 1).toString().padStart(4, '0')}`;
    }

    // Get statistics
    getStatistics() {
        const totalMappings = this.caseIdMappings.size;
        const uniqueBdsaIds = new Set(this.caseIdMappings.values()).size;
        const duplicates = this.getDuplicateBdsaCaseIds().length;

        return {
            totalMappings,
            uniqueBdsaIds,
            duplicates,
            lastFetchTimestamp: this.lastFetchTimestamp,
            serverUrl: this.serverUrl
        };
    }
}

// Create singleton instance
const caseIdMappingsStore = new CaseIdMappingsStore();

export default caseIdMappingsStore;
