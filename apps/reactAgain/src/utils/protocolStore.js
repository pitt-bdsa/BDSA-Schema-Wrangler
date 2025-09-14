// Protocol Store - Clean data management for protocols with localStorage persistence
// and preparation for future DSA server integration

const STORAGE_KEYS = {
    STAIN_PROTOCOLS: 'bdsa_stain_protocols',
    REGION_PROTOCOLS: 'bdsa_region_protocols',
    LAST_SYNC: 'bdsa_protocols_last_sync',
    CONFLICTS: 'bdsa_protocols_conflicts'
};

// Default protocols
const DEFAULT_STAIN_PROTOCOLS = [
    {
        id: 'ignore',
        name: 'IGNORE',
        description: 'Mark slide for exclusion from processing',
        stainType: 'ignore',
        type: 'ignore',
        _localModified: false,
        _remoteVersion: null
    }
];

const DEFAULT_REGION_PROTOCOLS = [
    {
        id: 'ignore',
        name: 'IGNORE',
        description: 'Mark slide for exclusion from processing',
        regionType: 'ignore',
        type: 'ignore',
        _localModified: false,
        _remoteVersion: null
    }
];

class ProtocolStore {
    constructor() {
        this.listeners = new Set();
        this.stainProtocols = this.loadStainProtocols();
        this.regionProtocols = this.loadRegionProtocols();
        this.conflicts = this.loadConflicts();
        this.lastSync = this.loadLastSync();
        this.migrateProtocolIds();
    }

    // Migrate existing protocols with timestamp-based IDs to use protocol names as IDs
    migrateProtocolIds() {
        let migrated = false;

        // Migrate stain protocols
        this.stainProtocols.forEach(protocol => {
            if (protocol.name && this.isTimestampId(protocol.id)) {
                // Check if a protocol with this name already exists
                const existingProtocol = this.stainProtocols.find(p => p.id === protocol.name);
                if (!existingProtocol) {
                    protocol.id = protocol.name;
                    migrated = true;
                } else {
                    // Remove duplicate protocol with timestamp ID
                    const index = this.stainProtocols.indexOf(protocol);
                    if (index > -1) {
                        this.stainProtocols.splice(index, 1);
                        migrated = true;
                    }
                }
            }
        });

        // Migrate region protocols
        this.regionProtocols.forEach(protocol => {
            if (protocol.name && this.isTimestampId(protocol.id)) {
                // Check if a protocol with this name already exists
                const existingProtocol = this.regionProtocols.find(p => p.id === protocol.name);
                if (!existingProtocol) {
                    protocol.id = protocol.name;
                    migrated = true;
                } else {
                    // Remove duplicate protocol with timestamp ID
                    const index = this.regionProtocols.indexOf(protocol);
                    if (index > -1) {
                        this.regionProtocols.splice(index, 1);
                        migrated = true;
                    }
                }
            }
        });

        if (migrated) {
            this.saveStainProtocols();
            this.saveRegionProtocols();
            console.log('🔄 Migrated protocol IDs to use protocol names instead of timestamps');
        }
    }

    // Helper function to check if an ID is a timestamp
    isTimestampId(id) {
        // Check if the ID is a numeric string that looks like a timestamp
        return /^\d{13}$/.test(id) || /^\d{10}$/.test(id);
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
    loadStainProtocols() {
        try {
            const stored = localStorage.getItem(STORAGE_KEYS.STAIN_PROTOCOLS);
            return stored ? JSON.parse(stored) : [...DEFAULT_STAIN_PROTOCOLS];
        } catch (error) {
            console.error('Error loading stain protocols:', error);
            return [...DEFAULT_STAIN_PROTOCOLS];
        }
    }

    loadRegionProtocols() {
        try {
            const stored = localStorage.getItem(STORAGE_KEYS.REGION_PROTOCOLS);
            return stored ? JSON.parse(stored) : [...DEFAULT_REGION_PROTOCOLS];
        } catch (error) {
            console.error('Error loading region protocols:', error);
            return [...DEFAULT_REGION_PROTOCOLS];
        }
    }

    loadConflicts() {
        try {
            const stored = localStorage.getItem(STORAGE_KEYS.CONFLICTS);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Error loading conflicts:', error);
            return [];
        }
    }

    loadLastSync() {
        try {
            const stored = localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
            return stored ? new Date(stored) : null;
        } catch (error) {
            console.error('Error loading last sync:', error);
            return null;
        }
    }

    saveStainProtocols() {
        try {
            localStorage.setItem(STORAGE_KEYS.STAIN_PROTOCOLS, JSON.stringify(this.stainProtocols));
        } catch (error) {
            console.error('Error saving stain protocols:', error);
        }
    }

    saveRegionProtocols() {
        try {
            localStorage.setItem(STORAGE_KEYS.REGION_PROTOCOLS, JSON.stringify(this.regionProtocols));
        } catch (error) {
            console.error('Error saving region protocols:', error);
        }
    }

    saveConflicts() {
        try {
            localStorage.setItem(STORAGE_KEYS.CONFLICTS, JSON.stringify(this.conflicts));
        } catch (error) {
            console.error('Error saving conflicts:', error);
        }
    }

    saveLastSync() {
        try {
            localStorage.setItem(STORAGE_KEYS.LAST_SYNC, this.lastSync?.toISOString() || '');
        } catch (error) {
            console.error('Error saving last sync:', error);
        }
    }

    // Protocol Management
    addStainProtocol(protocol) {
        // Require a name for the protocol - this should be the primary identifier
        if (!protocol.name || protocol.name.trim() === '') {
            throw new Error('Protocol name is required');
        }

        // Use the protocol name as the ID, ensuring uniqueness
        const protocolId = protocol.name.trim();

        // Check if a protocol with this ID already exists
        const existingIndex = this.stainProtocols.findIndex(p => p.id === protocolId);
        if (existingIndex !== -1) {
            // Update existing protocol instead of creating duplicate
            this.stainProtocols[existingIndex] = {
                ...this.stainProtocols[existingIndex],
                ...protocol,
                id: protocolId,
                _localModified: true,
                _remoteVersion: null
            };
            this.saveStainProtocols();
            this.notify();
            return this.stainProtocols[existingIndex];
        }

        const newProtocol = {
            ...protocol,
            id: protocolId,
            _localModified: true,
            _remoteVersion: null
        };
        this.stainProtocols.push(newProtocol);
        this.saveStainProtocols();
        this.notify();
        return newProtocol;
    }

    addRegionProtocol(protocol) {
        // Require a name for the protocol - this should be the primary identifier
        if (!protocol.name || protocol.name.trim() === '') {
            throw new Error('Protocol name is required');
        }

        // Use the protocol name as the ID, ensuring uniqueness
        const protocolId = protocol.name.trim();

        // Check if a protocol with this ID already exists
        const existingIndex = this.regionProtocols.findIndex(p => p.id === protocolId);
        if (existingIndex !== -1) {
            // Update existing protocol instead of creating duplicate
            this.regionProtocols[existingIndex] = {
                ...this.regionProtocols[existingIndex],
                ...protocol,
                id: protocolId,
                _localModified: true,
                _remoteVersion: null
            };
            this.saveRegionProtocols();
            this.notify();
            return this.regionProtocols[existingIndex];
        }

        const newProtocol = {
            ...protocol,
            id: protocolId,
            _localModified: true,
            _remoteVersion: null
        };
        this.regionProtocols.push(newProtocol);
        this.saveRegionProtocols();
        this.notify();
        return newProtocol;
    }

    updateStainProtocol(id, updates) {
        const index = this.stainProtocols.findIndex(p => p.id === id);
        if (index !== -1) {
            this.stainProtocols[index] = {
                ...this.stainProtocols[index],
                ...updates,
                _localModified: true
            };
            this.saveStainProtocols();
            this.notify();
            return this.stainProtocols[index];
        }
        return null;
    }

    updateRegionProtocol(id, updates) {
        const index = this.regionProtocols.findIndex(p => p.id === id);
        if (index !== -1) {
            this.regionProtocols[index] = {
                ...this.regionProtocols[index],
                ...updates,
                _localModified: true
            };
            this.saveRegionProtocols();
            this.notify();
            return this.regionProtocols[index];
        }
        return null;
    }

    deleteStainProtocol(id) {
        if (id === 'ignore') return false; // Can't delete ignore protocol
        const index = this.stainProtocols.findIndex(p => p.id === id);
        if (index !== -1) {
            this.stainProtocols.splice(index, 1);
            this.saveStainProtocols();
            this.notify();
            return true;
        }
        return false;
    }

    deleteRegionProtocol(id) {
        if (id === 'ignore') return false; // Can't delete ignore protocol
        const index = this.regionProtocols.findIndex(p => p.id === id);
        if (index !== -1) {
            this.regionProtocols.splice(index, 1);
            this.saveRegionProtocols();
            this.notify();
            return true;
        }
        return false;
    }

    // Conflict Management (for future DSA integration)
    addConflict(protocolId, type, localVersion, remoteVersion) {
        const conflict = {
            id: Date.now().toString(),
            protocolId,
            type, // 'stain' or 'region'
            localVersion,
            remoteVersion,
            timestamp: new Date().toISOString(),
            resolved: false
        };
        this.conflicts.push(conflict);
        this.saveConflicts();
        this.notify();
        return conflict;
    }

    resolveConflict(conflictId, resolution) {
        const conflict = this.conflicts.find(c => c.id === conflictId);
        if (conflict) {
            conflict.resolved = true;
            conflict.resolution = resolution;
            conflict.resolvedAt = new Date().toISOString();
            this.saveConflicts();
            this.notify();
            return conflict;
        }
        return null;
    }

    getUnresolvedConflicts() {
        return this.conflicts.filter(c => !c.resolved);
    }

    // DSA Integration Methods
    async syncWithDSA(dsaConfig, caseIdMappings = null, institutionId = null) {
        try {
            if (!dsaConfig || !dsaConfig.baseUrl || !dsaConfig.resourceId || !dsaConfig.token) {
                throw new Error('DSA configuration incomplete. Missing baseUrl, resourceId, or token.');
            }

            console.log('Starting DSA sync for protocols and case ID mappings...', {
                baseUrl: dsaConfig.baseUrl,
                resourceId: dsaConfig.resourceId,
                stainCount: this.stainProtocols.length,
                regionCount: this.regionProtocols.length,
                hasCaseIdMappings: !!caseIdMappings,
                institutionId
            });

            // Import the DSA integration functions
            const { syncProtocolsToFolder, syncCaseIdMappingsToFolder } = await import('./dsaIntegration.js');

            const results = {
                protocols: null,
                caseIdMappings: null
            };

            // Push local protocols to DSA folder
            const protocolsResult = await syncProtocolsToFolder(
                dsaConfig.baseUrl,
                dsaConfig.resourceId,
                dsaConfig.token,
                this.stainProtocols,
                this.regionProtocols
            );

            if (!protocolsResult.success) {
                throw new Error(`Failed to push protocols to DSA: ${protocolsResult.error}`);
            }
            results.protocols = protocolsResult;

            // Push case ID mappings if provided
            if (caseIdMappings) {
                const caseIdResult = await syncCaseIdMappingsToFolder(
                    dsaConfig.baseUrl,
                    dsaConfig.resourceId,
                    dsaConfig.token,
                    caseIdMappings,
                    institutionId
                );

                if (!caseIdResult.success) {
                    console.warn(`Failed to push case ID mappings to DSA: ${caseIdResult.error}`);
                    // Don't throw here - protocols sync succeeded
                } else {
                    results.caseIdMappings = caseIdResult;
                }
            }

            // Clear local modification flags since we've successfully synced
            this.stainProtocols = this.stainProtocols.map(p => ({
                ...p,
                _localModified: false,
                _remoteVersion: new Date().toISOString()
            }));
            this.regionProtocols = this.regionProtocols.map(p => ({
                ...p,
                _localModified: false,
                _remoteVersion: new Date().toISOString()
            }));

            // Save the updated protocols
            this.saveStainProtocols();
            this.saveRegionProtocols();

            // Update last sync timestamp
            this.lastSync = new Date();
            this.saveLastSync();
            this.notify();

            console.log('Successfully synced to DSA folder:', dsaConfig.resourceId);
            return {
                success: true,
                message: 'Data synced successfully',
                pushed: {
                    stainProtocols: this.stainProtocols.length,
                    regionProtocols: this.regionProtocols.length,
                    caseIdMappings: caseIdMappings ? (caseIdMappings instanceof Map ? caseIdMappings.size : Object.keys(caseIdMappings).length) : 0
                }
            };
        } catch (error) {
            console.error('Error syncing with DSA:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async pullFromDSA(dsaConfig) {
        try {
            if (!dsaConfig || !dsaConfig.baseUrl || !dsaConfig.resourceId || !dsaConfig.token) {
                throw new Error('DSA configuration incomplete. Missing baseUrl, resourceId, or token.');
            }

            console.log('Pulling protocols and case ID mappings from DSA folder...', {
                baseUrl: dsaConfig.baseUrl,
                resourceId: dsaConfig.resourceId
            });

            // Import the DSA integration functions
            const { getProtocolsFromFolder, getCaseIdMappingsFromFolder } = await import('./dsaIntegration.js');

            const results = {
                protocols: null,
                caseIdMappings: null
            };

            // Retrieve protocols from DSA folder
            const protocolsResult = await getProtocolsFromFolder(
                dsaConfig.baseUrl,
                dsaConfig.resourceId,
                dsaConfig.token
            );

            if (!protocolsResult.success) {
                throw new Error(`Failed to pull protocols from DSA: ${protocolsResult.error}`);
            }
            results.protocols = protocolsResult;

            // Retrieve case ID mappings from DSA folder
            const caseIdResult = await getCaseIdMappingsFromFolder(
                dsaConfig.baseUrl,
                dsaConfig.resourceId,
                dsaConfig.token
            );

            if (!caseIdResult.success) {
                console.warn(`Failed to pull case ID mappings from DSA: ${caseIdResult.error}`);
            } else {
                results.caseIdMappings = caseIdResult;
            }

            // Update local protocols with remote versions
            if (results.protocols?.protocols) {
                const { stainProtocols, regionProtocols } = results.protocols.protocols;

                if (stainProtocols && Array.isArray(stainProtocols)) {
                    this.stainProtocols = stainProtocols.map(p => ({
                        ...p,
                        _localModified: false,
                        _remoteVersion: p.lastUpdated
                    }));
                    this.saveStainProtocols();
                }

                if (regionProtocols && Array.isArray(regionProtocols)) {
                    this.regionProtocols = regionProtocols.map(p => ({
                        ...p,
                        _localModified: false,
                        _remoteVersion: p.lastUpdated
                    }));
                    this.saveRegionProtocols();
                }
            }

            this.lastSync = new Date();
            this.saveLastSync();
            this.notify();

            const pulledData = {
                stainProtocols: results.protocols?.protocols?.stainProtocols?.length || 0,
                regionProtocols: results.protocols?.protocols?.regionProtocols?.length || 0,
                caseIdMappings: results.caseIdMappings?.caseIdMappings?.totalMappings || 0
            };

            console.log('Successfully pulled data from DSA folder:', pulledData);

            return {
                success: true,
                message: 'Data pulled successfully',
                pulled: pulledData,
                caseIdMappings: results.caseIdMappings?.caseIdMappings || null
            };
        } catch (error) {
            console.error('Error pulling data from DSA:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async pushToDSA(dsaConfig) {
        // Alias for syncWithDSA to maintain backward compatibility
        return this.syncWithDSA(dsaConfig);
    }

    // Utility Methods
    getStainProtocol(id) {
        return this.stainProtocols.find(p => p.id === id);
    }

    getRegionProtocol(id) {
        return this.regionProtocols.find(p => p.id === id);
    }

    getModifiedProtocols() {
        return {
            stain: this.stainProtocols.filter(p => p._localModified),
            region: this.regionProtocols.filter(p => p._localModified)
        };
    }

    resetToDefaults() {
        this.stainProtocols = [...DEFAULT_STAIN_PROTOCOLS];
        this.regionProtocols = [...DEFAULT_REGION_PROTOCOLS];
        this.conflicts = [];
        this.lastSync = null;
        this.saveStainProtocols();
        this.saveRegionProtocols();
        this.saveConflicts();
        this.saveLastSync();
        this.notify();
    }


    exportProtocols() {
        return {
            stainProtocols: this.stainProtocols,
            regionProtocols: this.regionProtocols,
            exportedAt: new Date().toISOString(),
            version: '1.0'
        };
    }

    importProtocols(data) {
        try {
            if (data.stainProtocols) {
                this.stainProtocols = data.stainProtocols.map(p => ({
                    ...p,
                    _localModified: true,
                    _remoteVersion: null
                }));
                this.saveStainProtocols();
            }
            if (data.regionProtocols) {
                this.regionProtocols = data.regionProtocols.map(p => ({
                    ...p,
                    _localModified: true,
                    _remoteVersion: null
                }));
                this.saveRegionProtocols();
            }
            this.notify();
            return true;
        } catch (error) {
            console.error('Error importing protocols:', error);
            return false;
        }
    }
}

// Create singleton instance
const protocolStore = new ProtocolStore();

// Make it available globally for debugging
if (typeof window !== 'undefined') {
    window.protocolStore = protocolStore;
}

export default protocolStore;
