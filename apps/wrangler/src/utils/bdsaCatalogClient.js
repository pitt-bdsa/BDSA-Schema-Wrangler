// Host-node BDSA catalog client. Uses FormData like the manage-app API.js
// so Girder autoDescribeRoute form/query params parse the same way.

import dsaAuthStore from './dsaAuthStore';

function buildQuery(query = {}) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        params.append(key, String(value));
    });
    const qs = params.toString();
    return qs ? `?${qs}` : '';
}

function toFormData(body = {}) {
    const fd = new FormData();
    Object.entries(body).forEach(([key, value]) => {
        if (value === undefined) return;
        fd.append(key, typeof value === 'string' ? value : JSON.stringify(value));
    });
    return fd;
}

function parseErrorPayload(text, status, statusText) {
    if (!text) return `${status} ${statusText}`;
    try {
        const json = JSON.parse(text);
        return json.message || json.error || json.type || text;
    } catch {
        return text;
    }
}

class BdsaCatalogClient {
    getBaseUrl() {
        const config = dsaAuthStore.getConfig();
        const base = (config.baseUrl || '').replace(/\/+$/, '');
        if (!base) {
            throw new Error('Host DSA session is not ready');
        }
        return base;
    }

    getToken() {
        return dsaAuthStore.getToken() || '';
    }

    async request(method, path, { query, body } = {}) {
        const url = `${this.getBaseUrl()}/api/v1${path}${buildQuery(query)}`;
        const headers = {};
        const token = this.getToken();
        if (token) {
            headers['Girder-Token'] = token;
        }

        const options = { method, headers };
        if (body && method !== 'GET' && method !== 'DELETE') {
            options.body = toFormData(body);
        }

        const response = await fetch(url, options);
        const text = await response.text();
        if (!response.ok) {
            throw new Error(parseErrorPayload(text, response.status, response.statusText));
        }
        if (!text) return null;
        try {
            return JSON.parse(text);
        } catch {
            return text;
        }
    }

    get(path, query) {
        return this.request('GET', path, { query });
    }

    post(path, { query, body } = {}) {
        return this.request('POST', path, { query, body });
    }

    put(path, { query, body } = {}) {
        return this.request('PUT', path, { query, body });
    }

    delete(path) {
        return this.request('DELETE', path);
    }

    listStains() {
        return this.get('/bdsa/stain');
    }

    createStain({ name, schemaId, schemaStainKey, details, description }) {
        return this.post('/bdsa/stain', {
            query: { name },
            body: {
                schema_id: schemaId,
                schema_stain_key: schemaStainKey,
                details: details || {},
                description: description || '',
            },
        });
    }

    updateStain(id, { name, schemaId, schemaStainKey, details, description }) {
        return this.put(`/bdsa/stain/${id}`, {
            body: {
                name,
                schema_id: schemaId,
                schema_stain_key: schemaStainKey,
                details: details || {},
                description: description || '',
            },
        });
    }

    deleteStain(id) {
        return this.delete(`/bdsa/stain/${id}`);
    }

    listRegionTemplates() {
        return this.get('/bdsa/region/template');
    }

    createRegionTemplate({ abbreviation, displayName, schemaId, schemaRegionKey, details, description }) {
        return this.post('/bdsa/region/template', {
            query: { abbreviation },
            body: {
                display_name: displayName,
                schema_id: schemaId,
                schema_region_key: schemaRegionKey,
                details: details || {},
                description: description || '',
            },
        });
    }

    updateRegionTemplate(id, { abbreviation, displayName, schemaId, schemaRegionKey, details, description }) {
        return this.put(`/bdsa/region/template/${id}`, {
            body: {
                abbreviation,
                display_name: displayName,
                schema_id: schemaId,
                schema_region_key: schemaRegionKey,
                details: details || {},
                description: description || '',
            },
        });
    }

    deleteRegionTemplate(id) {
        return this.delete(`/bdsa/region/template/${id}`);
    }

    listSchemas(name) {
        return this.get('/bdsa/schema', { name, includeDrafts: false });
    }

    listSectioningProtocols() {
        return this.get('/bdsa/protocol');
    }

    createSectioningProtocol({ name, description }) {
        return this.post('/bdsa/protocol', {
            query: { name },
            body: { description: description || '' },
        });
    }

    updateSectioningProtocol(id, { name, description }) {
        return this.put(`/bdsa/protocol/${id}`, {
            body: {
                name,
                description: description || '',
            },
        });
    }

    deleteSectioningProtocol(id) {
        return this.delete(`/bdsa/protocol/${id}`);
    }

    listBlocks() {
        return this.get('/bdsa/block', { includeRegions: true });
    }

    createBlock({ name, protocolId }) {
        return this.post('/bdsa/block', {
            query: { name },
            body: { name, protocol_id: protocolId },
        });
    }

    updateBlock(id, { name, protocolId }) {
        return this.put(`/bdsa/block/${id}`, {
            body: {
                name,
                protocol_id: protocolId,
            },
        });
    }

    deleteBlock(id) {
        return this.delete(`/bdsa/block/${id}`);
    }

    addBlockRegions(blockId, regionIds) {
        return this.post(`/bdsa/block/${blockId}/regions`, {
            body: { regionIds },
        });
    }

    deleteRegion(id) {
        return this.delete(`/bdsa/region/${id}`);
    }

    listCases() {
        return this.get('/bdsa/case');
    }

    getLocalNode() {
        return this.get('/network/local');
    }

    async postItemMetadataBulk(updates, { onProgress } = {}) {
        const chunkSize = 500;
        const allUpdated = [];
        const allFailed = [];
        const total = updates.length;
        for (let i = 0; i < updates.length; i += chunkSize) {
            const chunk = updates.slice(i, i + chunkSize);
            const result = await this.post('/bdsa/item/metadata/bulk', {
                body: { updates: chunk },
            });
            allUpdated.push(...(result?.updated || []));
            allFailed.push(...(result?.failed || []));
            const processed = Math.min(i + chunk.length, total);
            if (typeof onProgress === 'function') {
                onProgress({
                    current: processed,
                    processed,
                    total,
                    percentage: total ? Math.round((processed / total) * 100) : 100,
                    success: allUpdated.length,
                    errors: allFailed.length,
                    skipped: 0,
                });
            }
        }
        return {
            updated: allUpdated,
            failed: allFailed,
            updatedCount: allUpdated.length,
            failedCount: allFailed.length,
        };
    }
}

const bdsaCatalogClient = new BdsaCatalogClient();
export default bdsaCatalogClient;
