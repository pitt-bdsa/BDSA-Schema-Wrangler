// Configuration settings for BDSA Schema Wrangler

// Auto-refresh data after DSA sync completion
// Set to true to automatically refresh data after sync, false to keep current behavior
// To override: create a .env file with VITE_AUTO_REFRESH_AFTER_SYNC=false
export const AUTO_REFRESH_AFTER_SYNC = import.meta.env.VITE_AUTO_REFRESH_AFTER_SYNC !== 'false'; // Default to true

// Other configuration options can be added here
export const CONFIG = {
    AUTO_REFRESH_AFTER_SYNC
};
