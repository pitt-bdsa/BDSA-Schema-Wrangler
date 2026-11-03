// Pure helpers for mapping Wrangler slide regions onto case-level BDSA blocks.
// No network access; keep this module easy to test in isolation.

export function normalizeRegionKey(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_');
}

export function regionIdentity(region) {
    if (!region || typeof region !== 'object') return '';
    return normalizeRegionKey(
        region.schemaRegionKey
        || region.regionType
        || region.abbreviation
        || region.displayName
        || region.name
        || ''
    );
}

export function templateIdentity(template) {
    if (!template || typeof template !== 'object') return '';
    return normalizeRegionKey(
        template.regionType
        || template.schemaRegionKey
        || template.abbreviation
        || template.displayName
        || template.name
        || ''
    );
}

export function regionKeysFromDefinitions(definitions) {
    const keys = new Set();
    (Array.isArray(definitions) ? definitions : []).forEach((region) => {
        const key = regionIdentity(region);
        if (key) keys.add(key);
    });
    return keys;
}

export function buildTemplateIndex(templates) {
    const list = (Array.isArray(templates) ? templates : [])
        .filter((template) => template && String(template.id || template._id || '') !== 'ignore');
    const byId = new Map();
    const byKey = new Map();
    list.forEach((template) => {
        const id = String(template.id || template._id || '');
        if (id) byId.set(id, template);
        const key = templateIdentity(template);
        if (key && !byKey.has(key)) byKey.set(key, template);
    });
    return { list, byId, byKey };
}

export function resolveTemplateForRef(ref, index) {
    const value = String(ref || '').trim();
    if (!value) return null;
    if (index.byId.has(value)) return index.byId.get(value);
    const key = normalizeRegionKey(value);
    if (index.byKey.has(key)) return index.byKey.get(key);
    return null;
}

export function regionKeysFromRefs(refs, templates) {
    const index = buildTemplateIndex(templates);
    const keys = new Set();
    (Array.isArray(refs) ? refs : []).forEach((ref) => {
        const raw = String(ref || '').trim();
        if (!raw || raw.toLowerCase() === 'ignore') return;
        const template = resolveTemplateForRef(ref, index);
        if (template) {
            const key = templateIdentity(template);
            if (key) keys.add(key);
            return;
        }
        const fallback = normalizeRegionKey(ref);
        if (fallback) keys.add(fallback);
    });
    return keys;
}

/**
 * Pick the case block that owns a slide's regions.
 *
 * A slide usually carries a subset of a block's regions, so the rule is:
 * candidates are blocks whose region keys contain every slide key; an exact
 * match wins, otherwise the smallest unique superset wins. Anything else is
 * reported as ambiguous instead of guessing.
 */
export function chooseBlockForRegionKeys(keys, blocks) {
    const wanted = new Set([...keys].filter(Boolean));
    if (wanted.size === 0) {
        return { status: 'empty', block: null, candidates: [] };
    }

    const candidates = [];
    (Array.isArray(blocks) ? blocks : []).forEach((block) => {
        const blockKeys = regionKeysFromDefinitions(block?.regionDefinitions);
        if (blockKeys.size === 0) return;
        for (const key of wanted) {
            if (!blockKeys.has(key)) return;
        }
        candidates.push({
            block,
            size: blockKeys.size,
            exact: blockKeys.size === wanted.size,
        });
    });

    if (candidates.length === 0) {
        return { status: 'none', block: null, candidates: [] };
    }

    const exact = candidates.filter((candidate) => candidate.exact);
    if (exact.length === 1) {
        return { status: 'match', block: exact[0].block, candidates: [exact[0].block] };
    }
    if (exact.length > 1) {
        return { status: 'ambiguous', block: null, candidates: exact.map((c) => c.block) };
    }

    const minSize = Math.min(...candidates.map((candidate) => candidate.size));
    const smallest = candidates.filter((candidate) => candidate.size === minSize);
    if (smallest.length === 1) {
        return { status: 'match', block: smallest[0].block, candidates: [smallest[0].block] };
    }
    return { status: 'ambiguous', block: null, candidates: smallest.map((c) => c.block) };
}

export function blockAssignmentMatches(itemBdsaData, block) {
    if (!itemBdsaData || !block) return false;
    if (String(itemBdsaData.blockId || '') !== String(block._id || '')) return false;
    const itemKeys = regionKeysFromDefinitions(itemBdsaData.regions);
    const blockKeys = regionKeysFromDefinitions(block.regionDefinitions);
    if (itemKeys.size !== blockKeys.size) return false;
    for (const key of itemKeys) {
        if (!blockKeys.has(key)) return false;
    }
    return true;
}

export function regionKeysForWranglerItem(item, templates) {
    const refs = item?.BDSA?.bdsaLocal?.bdsaRegionProtocol;
    return regionKeysFromRefs(refs, templates);
}

export function resolveTemplateIdForRegion(region, templates) {
    const index = buildTemplateIndex(templates);
    if (!region || typeof region !== 'object') return '';
    const sourceId = String(region.sourceId || '');
    if (sourceId && index.byId.has(sourceId)) return sourceId;
    const regionId = String(region._id || '');
    if (regionId && index.byId.has(regionId)) return regionId;
    const key = regionIdentity(region);
    if (!key || !index.byKey.has(key)) return '';
    const template = index.byKey.get(key);
    return String(template.id || template._id || '');
}
