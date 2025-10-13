/**
 * Protocol Store Integration
 * Handles pulling protocols from DSA and integrating them with the local protocol store
 */

import { getProtocolsFromFolder } from './DsaFolderMetadataSync.js';
import protocolStore from './protocolStore.js';

/**
 * Pulls protocols from DSA server and integrates them with the local protocol store
 * @param {string} baseUrl - DSA base URL
 * @param {string} resourceId - DSA resource ID
 * @param {string} girderToken - Authentication token
 * @returns {Promise<Object>} Result with pulled protocol information
 */
export const pullProtocolsFromDSA = async (baseUrl, resourceId, girderToken) => {
    try {
        console.log('🔄 Pulling protocols from DSA server...', {
            baseUrl,
            resourceId
        });

        // Get protocols from DSA folder
        const result = await getProtocolsFromFolder(baseUrl, resourceId, girderToken);

        if (!result.success) {
            throw new Error(`Failed to pull protocols from DSA: ${result.error}`);
        }

        if (!result.protocols) {
            console.log('ℹ️ No protocols found in DSA folder metadata');
            return {
                success: true,
                message: 'No protocols found in DSA folder',
                stainProtocols: [],
                regionProtocols: []
            };
        }

        const { stainProtocols = [], regionProtocols = [] } = result.protocols;

        console.log(`📊 Found protocols in DSA: ${stainProtocols.length} stain, ${regionProtocols.length} region`);

        // Import protocols into the protocol store
        const importResult = protocolStore.importProtocols({
            stainProtocols,
            regionProtocols
        });

        if (importResult) {
            console.log('✅ Successfully imported protocols from DSA into protocol store');
            return {
                success: true,
                message: `Successfully imported ${stainProtocols.length} stain and ${regionProtocols.length} region protocols`,
                stainProtocols,
                regionProtocols
            };
        } else {
            throw new Error('Failed to import protocols into protocol store');
        }

    } catch (error) {
        console.error('❌ Error pulling protocols from DSA:', error);
        return {
            success: false,
            error: error.message,
            stainProtocols: [],
            regionProtocols: []
        };
    }
};
