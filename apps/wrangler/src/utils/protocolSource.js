import dsaAuthStore from './dsaAuthStore';
import protocolStore from './protocolStore';
import bdsaCatalogService from './bdsaCatalogService';

export function usesHostCatalog() {
    return !!dsaAuthStore.hostImported;
}

export function getStainProtocols() {
    return usesHostCatalog()
        ? bdsaCatalogService.stainProtocols
        : protocolStore.stainProtocols;
}

export function getRegionProtocols() {
    return usesHostCatalog()
        ? bdsaCatalogService.regionProtocols
        : protocolStore.regionProtocols;
}

export function getProtocols(type) {
    return type === 'region' ? getRegionProtocols() : getStainProtocols();
}

export function subscribeProtocols(listener) {
    if (usesHostCatalog()) {
        return bdsaCatalogService.subscribe(listener);
    }
    return protocolStore.subscribe(listener);
}

export async function ensureProtocolsLoaded() {
    if (usesHostCatalog()) {
        await bdsaCatalogService.ensureProtocolsLoaded();
    }
    return {
        stain: getStainProtocols(),
        region: getRegionProtocols(),
    };
}
