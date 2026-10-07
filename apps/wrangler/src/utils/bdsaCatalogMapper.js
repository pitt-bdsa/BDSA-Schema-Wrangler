const STAIN_DETAIL_KEYS = [
    'antibody',
    'technique',
    'phosphoSpecific',
    'dilution',
    'vendor',
    'chromogen',
];

const REGION_DETAIL_KEYS = [
    'landmarks',
    'hemisphere',
    'sliceOrientation',
    'damage',
    'regionCategory',
];

export const IGNORE_STAIN = {
    id: 'ignore',
    name: 'IGNORE',
    description: 'Mark slide for exclusion from processing',
    stainType: 'ignore',
    type: 'ignore',
};

export const IGNORE_REGION = {
    id: 'ignore',
    name: 'IGNORE',
    description: 'Mark slide for exclusion from processing',
    regionType: 'ignore',
    type: 'ignore',
};

export function latestSchema(docs) {
    if (!Array.isArray(docs) || docs.length === 0) return null;
    return [...docs].sort((a, b) => (b.version || 0) - (a.version || 0))[0];
}

export function stainTypeOptionsFromSchema(schema) {
    const properties = schema?.definition?.properties?.bdsa_stain_id?.items?.properties || {};
    return Object.entries(properties).map(([key, value]) => ({
        value: key,
        label: value.title || key,
    }));
}

export function regionTypeOptionsFromSchema(schema) {
    const properties = schema?.definition?.properties?.bdsa_region_ids?.properties?.regions?.properties || {};
    return Object.entries(properties).map(([key, value]) => ({
        value: key,
        label: value.title || key,
        abbreviation: value.abbreviation || '',
    }));
}

export function docId(doc) {
    if (!doc) return '';
    if (doc.id) return String(doc.id);
    if (doc._id && typeof doc._id === 'object' && doc._id.$oid) return String(doc._id.$oid);
    return String(doc._id || '');
}

export function stainDocToProtocol(doc) {
    const details = doc.details && typeof doc.details === 'object' ? doc.details : {};
    return {
        id: docId(doc),
        name: doc.name || '',
        description: doc.description || '',
        stainType: doc.schemaStainKey || '',
        antibody: details.antibody || '',
        technique: details.technique || '',
        phosphoSpecific: details.phosphoSpecific || details['phospho-specific'] || '',
        dilution: details.dilution || '',
        vendor: details.vendor || '',
        chromogen: details.chromogen || '',
        schemaId: docId({ _id: doc.schemaId }),
        _catalog: true,
    };
}

export function protocolToStainPayload(protocol, schemaId) {
    const details = {};
    STAIN_DETAIL_KEYS.forEach((key) => {
        if (protocol[key] !== undefined && protocol[key] !== '') {
            details[key] = protocol[key];
        }
    });
    return {
        name: (protocol.name || '').trim(),
        schemaId,
        schemaStainKey: protocol.stainType,
        details,
        description: protocol.description || '',
    };
}

export function regionDocToProtocol(doc) {
    const details = doc.details && typeof doc.details === 'object' ? doc.details : {};
    return {
        id: docId(doc),
        name: doc.displayName || doc.name || '',
        description: doc.description || '',
        abbreviation: doc.abbreviation || '',
        regionType: doc.schemaRegionKey || '',
        landmarks: Array.isArray(details.landmarks) ? details.landmarks : [],
        hemisphere: details.hemisphere || '',
        sliceOrientation: details.sliceOrientation || '',
        damage: Array.isArray(details.damage) ? details.damage : [],
        schemaId: docId({ _id: doc.schemaId }),
        _catalog: true,
    };
}

export function protocolToRegionPayload(protocol, schemaId) {
    const details = {};
    REGION_DETAIL_KEYS.forEach((key) => {
        const value = protocol[key];
        if (value === undefined || value === '') return;
        details[key] = value;
    });
    if (!Array.isArray(details.landmarks)) {
        details.landmarks = [];
    }

    const abbreviation = (protocol.abbreviation || '').trim()
        || defaultAbbreviation(protocol.regionType, protocol.name);

    return {
        abbreviation,
        displayName: (protocol.name || '').trim(),
        schemaId,
        schemaRegionKey: protocol.regionType,
        details,
        description: protocol.description || '',
    };
}

export function defaultAbbreviation(regionType, name) {
    const source = (regionType || name || '').trim();
    if (!source) return '';
    if (/^[A-Za-z0-9]{1,12}$/.test(source)) return source.toUpperCase();
    const letters = source
        .split(/[\s/_-]+/)
        .filter(Boolean)
        .map((part) => part[0])
        .join('')
        .toUpperCase();
    return (letters || source.slice(0, 6)).toUpperCase();
}

export function validateCatalogType(value, options, fieldLabel) {
    if (!value) {
        return `${fieldLabel} is required`;
    }
    if (value === 'ignore') {
        return `${fieldLabel} cannot be IGNORE when saving to this DSA node`;
    }
    if (Array.isArray(options) && options.length > 0 && !options.some((opt) => opt.value === value)) {
        return `${fieldLabel} is not in the published schema`;
    }
    return '';
}
