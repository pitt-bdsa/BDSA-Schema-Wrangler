import bdsaCatalogClient from './bdsaCatalogClient';
import { resolveTemplateIdForRegion } from './bdsaBlockAssignment';
import {
    IGNORE_REGION,
    IGNORE_STAIN,
    latestSchema,
    protocolToRegionPayload,
    protocolToStainPayload,
    regionDocToProtocol,
    regionTypeOptionsFromSchema,
    stainDocToProtocol,
    stainTypeOptionsFromSchema,
    validateCatalogType,
} from './bdsaCatalogMapper';

function asList(value) {
    return Array.isArray(value) ? value : [];
}

class BdsaCatalogService {
    constructor() {
        this.stainSchema = null;
        this.regionSchema = null;
        this.stainProtocols = [IGNORE_STAIN];
        this.regionProtocols = [IGNORE_REGION];
        this.listeners = new Set();
        this._loaded = false;
        this._loadPromise = null;
    }

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notify() {
        this.listeners.forEach((listener) => listener());
    }

    setProtocolLists(stain, region) {
        this.stainProtocols = Array.isArray(stain) && stain.length ? stain : [IGNORE_STAIN];
        this.regionProtocols = Array.isArray(region) && region.length ? region : [IGNORE_REGION];
        this._loaded = true;
        this.notify();
        return {
            stain: this.stainProtocols,
            region: this.regionProtocols,
        };
    }

    async refreshProtocols() {
        const [stain, region] = await Promise.all([
            this.listStainProtocols(),
            this.listRegionProtocols(),
        ]);
        return this.setProtocolLists(stain, region);
    }

    async ensureProtocolsLoaded() {
        if (this._loaded) {
            return {
                stain: this.stainProtocols,
                region: this.regionProtocols,
            };
        }
        if (this._loadPromise) {
            return this._loadPromise;
        }
        this._loadPromise = this.refreshProtocols().finally(() => {
            this._loadPromise = null;
        });
        return this._loadPromise;
    }

    async loadSchemas() {
        const [stainDocs, regionDocs] = await Promise.all([
            bdsaCatalogClient.listSchemas('stain'),
            bdsaCatalogClient.listSchemas('region'),
        ]);
        this.stainSchema = latestSchema(asList(stainDocs));
        this.regionSchema = latestSchema(asList(regionDocs));
        return {
            stainSchema: this.stainSchema,
            regionSchema: this.regionSchema,
            stainOptions: stainTypeOptionsFromSchema(this.stainSchema),
            regionOptions: regionTypeOptionsFromSchema(this.regionSchema),
        };
    }

    stainOptions() {
        return stainTypeOptionsFromSchema(this.stainSchema);
    }

    regionOptions() {
        return regionTypeOptionsFromSchema(this.regionSchema);
    }

    requireStainSchemaId() {
        const id = this.stainSchema ? String(this.stainSchema._id || '') : '';
        if (!id) {
            throw new Error('No published stain schema is available on this node');
        }
        return id;
    }

    requireRegionSchemaId() {
        const id = this.regionSchema ? String(this.regionSchema._id || '') : '';
        if (!id) {
            throw new Error('No published region schema is available on this node');
        }
        return id;
    }

    async listStainProtocols() {
        const docs = asList(await bdsaCatalogClient.listStains());
        return [IGNORE_STAIN, ...docs.map(stainDocToProtocol)];
    }

    async listRegionProtocols() {
        const docs = asList(await bdsaCatalogClient.listRegionTemplates());
        return [IGNORE_REGION, ...docs.map(regionDocToProtocol)];
    }

    assertStainType(stainType) {
        const error = validateCatalogType(stainType, this.stainOptions(), 'Stain type');
        if (error) throw new Error(error);
    }

    assertRegionType(regionType) {
        const error = validateCatalogType(regionType, this.regionOptions(), 'Region type');
        if (error) throw new Error(error);
    }

    async saveStainProtocol(protocol, existingId) {
        if (existingId === 'ignore' || protocol.id === 'ignore') {
            throw new Error('IGNORE is local-only and is not saved to this node');
        }
        this.assertStainType(protocol.stainType);
        const payload = protocolToStainPayload(protocol, this.requireStainSchemaId());
        if (!payload.name) {
            throw new Error('Protocol name is required');
        }
        if (existingId) {
            return stainDocToProtocol(await bdsaCatalogClient.updateStain(existingId, payload));
        }
        return stainDocToProtocol(await bdsaCatalogClient.createStain(payload));
    }

    async saveRegionProtocol(protocol, existingId) {
        if (existingId === 'ignore' || protocol.id === 'ignore') {
            throw new Error('IGNORE is local-only and is not saved to this node');
        }
        this.assertRegionType(protocol.regionType);
        const payload = protocolToRegionPayload(protocol, this.requireRegionSchemaId());
        if (!payload.displayName) {
            throw new Error('Protocol name is required');
        }
        if (!payload.abbreviation) {
            throw new Error('Abbreviation is required');
        }
        if (existingId) {
            return regionDocToProtocol(await bdsaCatalogClient.updateRegionTemplate(existingId, payload));
        }
        return regionDocToProtocol(await bdsaCatalogClient.createRegionTemplate(payload));
    }

    async deleteStainProtocol(id) {
        if (id === 'ignore') return;
        await bdsaCatalogClient.deleteStain(id);
    }

    async deleteRegionProtocol(id) {
        if (id === 'ignore') return;
        await bdsaCatalogClient.deleteRegionTemplate(id);
    }

    async listSectioningCatalog() {
        const [protocols, blocks] = await Promise.all([
            bdsaCatalogClient.listSectioningProtocols(),
            bdsaCatalogClient.listBlocks(),
        ]);
        return {
            protocols: asList(protocols),
            blocks: asList(blocks),
        };
    }

    async saveSectioningProtocol({ name, description }, existingId) {
        const trimmed = (name || '').trim();
        if (!trimmed) {
            throw new Error('Protocol name is required');
        }
        if (existingId) {
            return bdsaCatalogClient.updateSectioningProtocol(existingId, {
                name: trimmed,
                description,
            });
        }
        return bdsaCatalogClient.createSectioningProtocol({
            name: trimmed,
            description,
        });
    }

    async deleteSectioningProtocol(id) {
        await bdsaCatalogClient.deleteSectioningProtocol(id);
    }

    async saveBlock({ name, protocolId, regionIds, templates }, existingBlock) {
        const trimmed = (name || '').trim();
        if (!trimmed) {
            throw new Error('Block name is required');
        }
        if (!protocolId) {
            throw new Error('Sectioning protocol is required');
        }

        const selected = new Set((regionIds || []).map(String));
        let block = existingBlock;
        if (existingBlock?._id) {
            block = await bdsaCatalogClient.updateBlock(existingBlock._id, {
                name: trimmed,
                protocolId,
            });
        } else {
            block = await bdsaCatalogClient.createBlock({
                name: trimmed,
                protocolId,
            });
        }

        // Regions copied from a protocol/schema often have no sourceId (and their
        // _id is not a template id). Resolve by lineage first, then by identity
        // (schemaRegionKey / abbreviation / display name) so editing a block does
        // not silently duplicate regions that are already there.
        const templateList = (Array.isArray(templates) && templates.length
            ? templates
            : this.regionProtocols).filter((template) => (
            template && String(template.id || template._id || '') !== 'ignore'
        ));
        const currentRegions = asList(existingBlock?.regionDefinitions);
        const existingTemplateIds = new Set(
            currentRegions
                .map((region) => resolveTemplateIdForRegion(region, templateList))
                .filter(Boolean)
        );

        const toAdd = [...selected].filter((id) => !existingTemplateIds.has(id));

        const toRemove = currentRegions.filter((region) => {
            const templateId = resolveTemplateIdForRegion(region, templateList);
            // Unresolvable regions are preserved rather than guessed at.
            if (!templateId) return false;
            return !selected.has(templateId);
        });

        if (toAdd.length) {
            await bdsaCatalogClient.addBlockRegions(block._id, toAdd);
        }
        await Promise.all(toRemove.map((region) => bdsaCatalogClient.deleteRegion(region._id)));
        return block;
    }

    async deleteBlock(id) {
        await bdsaCatalogClient.deleteBlock(id);
    }
}

const bdsaCatalogService = new BdsaCatalogService();
export default bdsaCatalogService;
