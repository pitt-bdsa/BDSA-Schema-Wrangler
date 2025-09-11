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
        const newProtocol = {
            ...protocol,
            id: Date.now().toString(),
            _localModified: true,
            _remoteVersion: null
        };
        this.stainProtocols.push(newProtocol);
        this.saveStainProtocols();
        this.notify();
        return newProtocol;
    }

    addRegionProtocol(protocol) {
        const newProtocol = {
            ...protocol,
            id: Date.now().toString(),
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

    // Future DSA Integration Methods
    async syncWithDSA(dsaConfig) {
        // This will be implemented when DSA integration is ready
        // For now, just update the last sync timestamp
        this.lastSync = new Date();
        this.saveLastSync();
        this.notify();

        // TODO: Implement actual DSA sync logic
        console.log('DSA sync not yet implemented', dsaConfig);
    }

    async pullFromDSA(dsaConfig) {
        // This will be implemented when DSA integration is ready
        // For now, just return empty array
        console.log('DSA pull not yet implemented', dsaConfig);
        return [];
    }

    async pushToDSA(dsaConfig) {
        // This will be implemented when DSA integration is ready
        // For now, just return success
        console.log('DSA push not yet implemented', dsaConfig);
        return { success: true, pushed: 0 };
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

export default protocolStore;
