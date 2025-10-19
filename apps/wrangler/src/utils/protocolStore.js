// Protocol Store - Clean data management for protocols with localStorage persistence
// and preparation for future DSA server integration

const STORAGE_KEYS = {
    CURRENT_COLLECTION: 'bdsa_current_collection_id',
    STAIN_PROTOCOLS: 'bdsa_stain_protocols',
    REGION_PROTOCOLS: 'bdsa_region_protocols',
    LAST_SYNC: 'bdsa_protocols_last_sync',
    CONFLICTS: 'bdsa_protocols_conflicts'
};

// Get collection-specific storage key
const getCollectionKey = (baseKey, collectionId) => {
    if (!collectionId) return baseKey; // Fallback to global key
    return `${baseKey}_${collectionId}`;
};

// Generate a GUID for protocols: {collectionId}_{randomChars}
// e.g., "STAIN_a7f9c2", "REGION_3k8p1x"
const generateProtocolGuid = (collectionId) => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let randomPart = '';
    for (let i = 0; i < 6; i++) {
        randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${collectionId}_${randomPart}`;
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
        this.currentCollectionId = this.loadCurrentCollectionId();
        this.stainProtocols = this.loadStainProtocols();
        this.regionProtocols = this.loadRegionProtocols();
        this.conflicts = this.loadConflicts();
        this.lastSync = this.loadLastSync();
        this.migrateProtocolIds();
    }

    // Load/Save current collection ID
    loadCurrentCollectionId() {
        try {
            const stored = localStorage.getItem(STORAGE_KEYS.CURRENT_COLLECTION);
            return stored ? JSON.parse(stored) : null;
        } catch (error) {
            console.error('Error loading current collection ID:', error);
            return null;
        }
    }

    saveCurrentCollectionId() {
        try {
            localStorage.setItem(STORAGE_KEYS.CURRENT_COLLECTION, JSON.stringify(this.currentCollectionId));
        } catch (error) {
            console.error('Error saving current collection ID:', error);
        }
    }

    // Set the current collection and load its protocols
    setCurrentCollection(collectionId) {
        const previousCollectionId = this.currentCollectionId;

        if (previousCollectionId === collectionId) {
            console.log(`📂 Already on collection: ${collectionId}`);
            return; // No change needed
        }

        console.log(`📂 Switching collections: ${previousCollectionId} → ${collectionId}`);

        // Save current collection's protocols before switching
        if (previousCollectionId) {
            console.log(`💾 Saving protocols for collection: ${previousCollectionId}`);
            this.saveStainProtocols();
            this.saveRegionProtocols();
            this.saveConflicts();
            this.saveLastSync();
        }

        // Update current collection
        this.currentCollectionId = collectionId;
        this.saveCurrentCollectionId();

        // Load new collection's protocols (or defaults if none exist)
        console.log(`📂 Loading protocols for collection: ${collectionId}`);
        this.stainProtocols = this.loadStainProtocols();
        this.regionProtocols = this.loadRegionProtocols();
        this.conflicts = this.loadConflicts();
        this.lastSync = this.loadLastSync();

        console.log(`✅ Collection switched to: ${collectionId}`, {
            stainProtocols: this.stainProtocols.length,
            regionProtocols: this.regionProtocols.length
        });

        this.notify();
    }

    // Migrate existing protocols to use GUID-based IDs
    migrateProtocolIds() {
        let migrated = false;
        const idMapping = {
            stain: new Map(),  // Maps old ID -> new GUID
            region: new Map()
        };

        // Migrate stain protocols: Convert name-based or timestamp IDs to GUIDs
        this.stainProtocols.forEach(protocol => {
            const needsMigration = !protocol.id.startsWith('STAIN_') && protocol.id !== 'ignore';

            if (needsMigration) {
                const oldId = protocol.id;
                const newGuid = generateProtocolGuid('STAIN');
                protocol.id = newGuid;
                idMapping.stain.set(oldId, newGuid);
                migrated = true;
                console.log(`🔄 Migrated stain protocol "${protocol.name}": ${oldId} -> ${newGuid}`);
            }
        });

        // Migrate region protocols: Convert name-based or timestamp IDs to GUIDs
        this.regionProtocols.forEach(protocol => {
            const needsMigration = !protocol.id.startsWith('REGION_') && protocol.id !== 'ignore';

            if (needsMigration) {
                const oldId = protocol.id;
                const newGuid = generateProtocolGuid('REGION');
                protocol.id = newGuid;
                idMapping.region.set(oldId, newGuid);
                migrated = true;
                console.log(`🔄 Migrated region protocol "${protocol.name}": ${oldId} -> ${newGuid}`);
            }
        });

        if (migrated) {
            this.saveStainProtocols();
            this.saveRegionProtocols();

            // Store the ID mapping for reference (useful for updating item references)
            localStorage.setItem('bdsa_protocol_id_migration', JSON.stringify({
                stain: Array.from(idMapping.stain.entries()),
                region: Array.from(idMapping.region.entries()),
                migratedAt: new Date().toISOString()
            }));

            console.log('✅ Migrated protocol IDs to use GUID format', {
                stainMigrations: idMapping.stain.size,
                regionMigrations: idMapping.region.size
            });
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

    // Local Storage Management (collection-aware)
    loadStainProtocols() {
        try {
            const key = getCollectionKey(STORAGE_KEYS.STAIN_PROTOCOLS, this.currentCollectionId);
            const stored = localStorage.getItem(key);
            return stored ? JSON.parse(stored) : [...DEFAULT_STAIN_PROTOCOLS];
        } catch (error) {
            console.error('Error loading stain protocols:', error);
            return [...DEFAULT_STAIN_PROTOCOLS];
        }
    }

    loadRegionProtocols() {
        try {
            const key = getCollectionKey(STORAGE_KEYS.REGION_PROTOCOLS, this.currentCollectionId);
            const stored = localStorage.getItem(key);
            return stored ? JSON.parse(stored) : [...DEFAULT_REGION_PROTOCOLS];
        } catch (error) {
            console.error('Error loading region protocols:', error);
            return [...DEFAULT_REGION_PROTOCOLS];
        }
    }

    loadConflicts() {
        try {
            const key = getCollectionKey(STORAGE_KEYS.CONFLICTS, this.currentCollectionId);
            const stored = localStorage.getItem(key);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Error loading conflicts:', error);
            return [];
        }
    }

    loadLastSync() {
        try {
            const key = getCollectionKey(STORAGE_KEYS.LAST_SYNC, this.currentCollectionId);
            const stored = localStorage.getItem(key);
            return stored ? new Date(stored) : null;
        } catch (error) {
            console.error('Error loading last sync:', error);
            return null;
        }
    }

    saveStainProtocols() {
        try {
            const key = getCollectionKey(STORAGE_KEYS.STAIN_PROTOCOLS, this.currentCollectionId);
            localStorage.setItem(key, JSON.stringify(this.stainProtocols));
        } catch (error) {
            console.error('Error saving stain protocols:', error);
        }
    }

    saveRegionProtocols() {
        try {
            const key = getCollectionKey(STORAGE_KEYS.REGION_PROTOCOLS, this.currentCollectionId);
            localStorage.setItem(key, JSON.stringify(this.regionProtocols));
        } catch (error) {
            console.error('Error saving region protocols:', error);
        }
    }

    saveConflicts() {
        try {
            const key = getCollectionKey(STORAGE_KEYS.CONFLICTS, this.currentCollectionId);
            localStorage.setItem(key, JSON.stringify(this.conflicts));
        } catch (error) {
            console.error('Error saving conflicts:', error);
        }
    }

    saveLastSync() {
        try {
            const key = getCollectionKey(STORAGE_KEYS.LAST_SYNC, this.currentCollectionId);
            localStorage.setItem(key, this.lastSync?.toISOString() || '');
        } catch (error) {
            console.error('Error saving last sync:', error);
        }
    }



    // Protocol Management
    addStainProtocol(protocol) {
        // Require a name for the protocol
        if (!protocol.name || protocol.name.trim() === '') {
            throw new Error('Protocol name is required');
        }

        // If updating an existing protocol (has an ID), preserve the ID
        if (protocol.id) {
            const existingIndex = this.stainProtocols.findIndex(p => p.id === protocol.id);
            if (existingIndex !== -1) {
                // Update existing protocol, preserving the ID
                this.stainProtocols[existingIndex] = {
                    ...this.stainProtocols[existingIndex],
                    ...protocol,
                    id: protocol.id, // Keep the original ID
                    _localModified: true,
                    _remoteVersion: null
                };
                this.saveStainProtocols();
                this.notify();
                return this.stainProtocols[existingIndex];
            }
        }

        // Check for duplicate names (warn but allow)
        const duplicateName = this.stainProtocols.find(p =>
            p.name.trim().toLowerCase() === protocol.name.trim().toLowerCase()
        );
        if (duplicateName) {
            console.warn(`⚠️ Protocol with name "${protocol.name}" already exists with ID "${duplicateName.id}"`);
        }

        // Generate a new GUID for new protocols
        const protocolId = generateProtocolGuid('STAIN');

        const newProtocol = {
            ...protocol,
            id: protocolId,
            name: protocol.name.trim(),
            _localModified: true,
            _remoteVersion: null
        };
        this.stainProtocols.push(newProtocol);
        this.saveStainProtocols();
        this.notify();
        return newProtocol;
    }

    addRegionProtocol(protocol) {
        // Require a name for the protocol
        if (!protocol.name || protocol.name.trim() === '') {
            throw new Error('Protocol name is required');
        }

        // If updating an existing protocol (has an ID), preserve the ID
        if (protocol.id) {
            const existingIndex = this.regionProtocols.findIndex(p => p.id === protocol.id);
            if (existingIndex !== -1) {
                // Update existing protocol, preserving the ID
                this.regionProtocols[existingIndex] = {
                    ...this.regionProtocols[existingIndex],
                    ...protocol,
                    id: protocol.id, // Keep the original ID
                    _localModified: true,
                    _remoteVersion: null
                };
                this.saveRegionProtocols();
                this.notify();
                return this.regionProtocols[existingIndex];
            }
        }

        // Check for duplicate names (warn but allow)
        const duplicateName = this.regionProtocols.find(p =>
            p.name.trim().toLowerCase() === protocol.name.trim().toLowerCase()
        );
        if (duplicateName) {
            console.warn(`⚠️ Protocol with name "${protocol.name}" already exists with ID "${duplicateName.id}"`);
        }

        // Generate a new GUID for new protocols
        const protocolId = generateProtocolGuid('REGION');

        const newProtocol = {
            ...protocol,
            id: protocolId,
            name: protocol.name.trim(),
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

    // Helper methods to find protocols by name (for backward compatibility)
    getStainProtocolByName(name) {
        if (!name) return null;
        return this.stainProtocols.find(p =>
            p.name.trim().toLowerCase() === name.trim().toLowerCase()
        ) || null;
    }

    getRegionProtocolByName(name) {
        if (!name) return null;
        return this.regionProtocols.find(p =>
            p.name.trim().toLowerCase() === name.trim().toLowerCase()
        ) || null;
    }

    // Get protocol ID by name (useful for migrations and lookups)
    getStainProtocolIdByName(name) {
        const protocol = this.getStainProtocolByName(name);
        return protocol ? protocol.id : null;
    }

    getRegionProtocolIdByName(name) {
        const protocol = this.getRegionProtocolByName(name);
        return protocol ? protocol.id : null;
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
                console.log('🔍 PUSH SYNC - About to sync case ID mappings:', {
                    caseIdMappings,
                    keys: Object.keys(caseIdMappings),
                    length: Object.keys(caseIdMappings).length,
                    institutionId
                });

                const caseIdResult = await syncCaseIdMappingsToFolder(
                    dsaConfig.baseUrl,
                    dsaConfig.resourceId,
                    dsaConfig.token,
                    caseIdMappings,
                    institutionId
                );

                console.log('🔍 PUSH SYNC - Case ID sync result:', caseIdResult);

                if (!caseIdResult.success) {
                    console.warn(`Failed to push case ID mappings to DSA: ${caseIdResult.error}`);
                    // Don't throw here - protocols sync succeeded
                } else {
                    results.caseIdMappings = caseIdResult;
                }
            } else {
                console.log('🔍 PUSH SYNC - No case ID mappings provided');
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
                console.log('🔍 Retrieved case ID mappings from DSA:', {
                    caseIdResult,
                    mappings: caseIdResult.caseIdMappings?.mappings,
                    totalMappings: caseIdResult.caseIdMappings?.totalMappings
                });
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

    resetToDefaults(reason = 'manual') {
        console.log(`🧹 Resetting protocols to defaults. Reason: ${reason}`);

        this.stainProtocols = [...DEFAULT_STAIN_PROTOCOLS];
        this.regionProtocols = [...DEFAULT_REGION_PROTOCOLS];
        this.conflicts = [];
        this.lastSync = null;


        // Save all cleared state to localStorage
        this.saveStainProtocols();
        this.saveRegionProtocols();
        this.saveConflicts();
        this.saveLastSync();

        // Store reason for clearing (useful for UI notifications)
        this.lastResetReason = reason;
        this.saveLastResetReason();

        console.log(`✅ Protocols reset to defaults:`, {
            stainProtocols: this.stainProtocols.length,
            regionProtocols: this.regionProtocols.length,
            reason
        });

        this.notify();
    }

    saveLastResetReason() {
        try {
            localStorage.setItem('protocolStore_lastResetReason', JSON.stringify(this.lastResetReason));
        } catch (error) {
            console.warn('Failed to save last reset reason:', error);
        }
    }

    getLastResetReason() {
        try {
            const saved = localStorage.getItem('protocolStore_lastResetReason');
            return saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.warn('Failed to load last reset reason:', error);
            return null;
        }
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
