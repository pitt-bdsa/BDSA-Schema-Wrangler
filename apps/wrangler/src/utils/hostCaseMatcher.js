export function normalizeCaseId(value) {
    return String(value || '').trim();
}

export function asCaseList(value) {
    if (Array.isArray(value)) return value;
    if (value && Array.isArray(value.data)) return value.data;
    if (value && Array.isArray(value.results)) return value.results;
    if (value && typeof value === 'object' && (value.networkIdentifier || value.localIdentifier)) {
        return [value];
    }
    return [];
}

export function indexHostCases(cases) {
    const byLocal = new Map();
    const byNetwork = new Map();
    const localConflicts = new Set();

    asCaseList(cases).forEach((doc) => {
        const local = normalizeCaseId(doc.localIdentifier);
        const network = normalizeCaseId(doc.networkIdentifier);
        if (local) {
            if (byLocal.has(local) && byLocal.get(local)._id !== doc._id) {
                localConflicts.add(local);
            } else {
                byLocal.set(local, doc);
            }
        }
        if (network) {
            byNetwork.set(network, doc);
        }
    });

    return { byLocal, byNetwork, localConflicts };
}

export function matchLocalCase(localCaseId, currentBdsaCaseId, index) {
    const local = normalizeCaseId(localCaseId);
    if (!local) {
        return { status: 'unmapped' };
    }
    if (index?.localConflicts?.has(local)) {
        return {
            status: 'conflict',
            reason: 'Multiple host cases share this local identifier',
        };
    }
    const byLocal = index?.byLocal?.get(local);
    if (byLocal) {
        return {
            status: 'existing',
            case: byLocal,
            networkIdentifier: normalizeCaseId(byLocal.networkIdentifier),
        };
    }
    const byNetwork = index?.byNetwork?.get(normalizeCaseId(currentBdsaCaseId));
    if (byNetwork) {
        return {
            status: 'existing',
            case: byNetwork,
            networkIdentifier: normalizeCaseId(byNetwork.networkIdentifier),
        };
    }
    return { status: 'would-create' };
}

export function applyHostCaseMatches(dataStore, index) {
    if (!dataStore?.processedData || !index) {
        return { changedLocalIds: [] };
    }

    const seen = new Set();
    const changedLocalIds = [];

    dataStore.processedData.forEach((item) => {
        const local = normalizeCaseId(item.BDSA?.bdsaLocal?.localCaseId);
        if (!local || seen.has(local)) return;
        seen.add(local);
        const current = item.BDSA?.bdsaLocal?.bdsaCaseId;
        const match = matchLocalCase(local, current, index);
        if (
            match.status === 'existing'
            && match.networkIdentifier
            && normalizeCaseId(current) !== match.networkIdentifier
        ) {
            dataStore.setCaseIdInData(local, match.networkIdentifier);
            changedLocalIds.push(local);
        }
    });

    return { changedLocalIds };
}

export function collectBdsaLocalUpdates(items) {
    return (items || []).map((item) => {
        const itemId = item.id || item._id || item.dsa_id;
        const bdsaLocal = item.BDSA?.bdsaLocal;
        if (!itemId || !bdsaLocal) return null;
        const fieldSource = item.BDSA?._dataSource && typeof item.BDSA._dataSource === 'object'
            ? { ...item.BDSA._dataSource }
            : (bdsaLocal.fieldSource || null);
        return {
            itemId: String(itemId),
            bdsaLocal: {
                localCaseId: bdsaLocal.localCaseId || null,
                localStainID: bdsaLocal.localStainID || null,
                localRegionId: bdsaLocal.localRegionId || null,
                bdsaCaseId: bdsaLocal.bdsaCaseId || null,
                bdsaStainProtocol: bdsaLocal.bdsaStainProtocol || null,
                bdsaRegionProtocol: bdsaLocal.bdsaRegionProtocol || null,
                bdsaSectioningProtocol: bdsaLocal.bdsaSectioningProtocol || null,
                bdsaSectioningProtocolId: bdsaLocal.bdsaSectioningProtocolId || null,
                fieldSource,
            },
        };
    }).filter(Boolean);
}
