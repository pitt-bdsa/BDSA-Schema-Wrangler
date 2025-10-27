/**
 * Protocol Storage Abstraction
 * 
 * Provides a clean interface for storing/retrieving protocols.
 * Can be swapped with different implementations (localStorage, DSA server, in-memory)
 */

const STORAGE_KEY = 'bdsa_protocols';

/**
 * Generate a unique ID for a protocol
 */
export const generateProtocolId = () => {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `${timestamp}_${randomStr}`;
};

/**
 * LocalStorage implementation of protocol storage
 */
export class LocalStorageProtocolStorage {
    /**
     * Load all protocols from storage
     * @returns {Array} Array of protocol objects
     */
    async load() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Error loading protocols from localStorage:', error);
            return [];
        }
    }

    /**
     * Save all protocols to storage
     * @param {Array} protocols - Array of protocol objects
     */
    async save(protocols) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(protocols));
        } catch (error) {
            console.error('Error saving protocols to localStorage:', error);
            throw error;
        }
    }

    /**
     * Clear all protocols from storage
     */
    async clear() {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (error) {
            console.error('Error clearing protocols from localStorage:', error);
            throw error;
        }
    }
}

/**
 * In-memory implementation (useful for testing)
 */
export class InMemoryProtocolStorage {
    constructor() {
        this.protocols = [];
    }

    async load() {
        return [...this.protocols];
    }

    async save(protocols) {
        this.protocols = [...protocols];
    }

    async clear() {
        this.protocols = [];
    }
}

/**
 * Default storage instance
 */
export const defaultStorage = new LocalStorageProtocolStorage();


