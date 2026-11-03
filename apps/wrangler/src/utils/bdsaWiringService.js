// Wires a Wrangler case's sectioning protocol into the host BDSA backend:
//   1. PUT /bdsa/case/:id with protocol_id (the backend copies protocol blocks
//      onto the case and clears blockId on affected slides when it changes)
//   2. re-read the case so we have the new case blocks and slide region data
//   3. PUT /bdsa/item/:itemId for slides we can confidently map to a case block

import bdsaCatalogClient from './bdsaCatalogClient';
import {
    asCaseList,
    indexHostCases,
    matchLocalCase,
    normalizeCaseId,
} from './hostCaseMatcher';
import {
    blockAssignmentMatches,
    chooseBlockForRegionKeys,
    regionKeysForWranglerItem,
    regionKeysFromDefinitions,
} from './bdsaBlockAssignment';

function itemIdOf(item) {
    return String(item?.id || item?._id || item?.dsa_id || '');
}

function caseNetworkIdForLocalCase(items, localCaseId) {
    const target = normalizeCaseId(localCaseId);
    if (!target) return '';
    for (const item of items || []) {
        const local = normalizeCaseId(item?.BDSA?.bdsaLocal?.localCaseId);
        if (local === target) {
            const networkId = normalizeCaseId(item?.BDSA?.bdsaLocal?.bdsaCaseId);
            if (networkId) return networkId;
        }
    }
    return '';
}

function pickBlockForItem({ caseItem, wranglerItem, caseBlocks, regionTemplates }) {
    const attempts = [];
    const wranglerKeys = regionKeysForWranglerItem(wranglerItem, regionTemplates);
    if (wranglerKeys.size) {
        attempts.push({ source: 'wrangler', keys: wranglerKeys });
    }
    const itemKeys = regionKeysFromDefinitions(caseItem?.bdsaData?.regions);
    if (itemKeys.size) {
        attempts.push({ source: 'item', keys: itemKeys });
    }

    let ambiguous = null;
    for (const attempt of attempts) {
        const choice = chooseBlockForRegionKeys(attempt.keys, caseBlocks);
        if (choice.status === 'match') {
            return { ...choice, source: attempt.source };
        }
        if (choice.status === 'ambiguous' && !ambiguous) {
            ambiguous = { ...choice, source: attempt.source };
        }
    }
    if (ambiguous) return ambiguous;
    return { status: 'none', block: null, candidates: [], source: attempts[0]?.source || '' };
}

function blockName(block) {
    return block?.name || (block?._id ? String(block._id) : '');
}

export async function applySectioningProtocolToCase({
    localCaseId,
    protocol,
    items,
    hostCases,
    regionTemplates,
}) {
    const currentCaseId = caseNetworkIdForLocalCase(items, localCaseId);
    const index = indexHostCases(hostCases);
    const match = matchLocalCase(localCaseId, currentCaseId, index);

    if (match.status !== 'existing' || !match.case?._id) {
        return {
            status: match.status === 'conflict' ? 'local-conflict' : 'missing-host-case',
            localCaseId,
            error: match.reason || '',
        };
    }

    const caseDoc = match.case;
    const targetProtocolId = protocol?.id ? String(protocol.id) : null;
    const currentProtocolId = caseDoc.protocolId ? String(caseDoc.protocolId) : '';
    const protocolChanged = targetProtocolId
        ? currentProtocolId !== targetProtocolId
        : Boolean(currentProtocolId);

    if (protocolChanged) {
        await bdsaCatalogClient.updateCase(caseDoc._id, {
            protocolId: targetProtocolId,
            details: caseDoc.details || {},
            localIdentifier: caseDoc.localIdentifier,
            schemaId: caseDoc.schemaId || undefined,
        });
    }

    let fresh = await bdsaCatalogClient.getCase({ id: caseDoc._id });
    let caseBlocks = Array.isArray(fresh?.blocks) ? fresh.blocks : [];
    if (targetProtocolId && caseBlocks.length === 0) {
        // Older cases can have a protocol but no case blocks. Ask the backend to
        // materialise them rather than reporting every slide as unmatched.
        await bdsaCatalogClient.refreshCaseProtocolBlocks(caseDoc._id);
        fresh = await bdsaCatalogClient.getCase({ id: caseDoc._id });
        caseBlocks = Array.isArray(fresh?.blocks) ? fresh.blocks : [];
    }
    const caseItems = Array.isArray(fresh?.items) ? fresh.items : [];

    const wranglerItems = (items || []).filter((item) => (
        normalizeCaseId(item?.BDSA?.bdsaLocal?.localCaseId) === normalizeCaseId(localCaseId)
        || (currentCaseId && normalizeCaseId(item?.BDSA?.bdsaLocal?.bdsaCaseId) === currentCaseId)
        || (normalizeCaseId(match.networkIdentifier)
            && normalizeCaseId(item?.BDSA?.bdsaLocal?.bdsaCaseId) === normalizeCaseId(match.networkIdentifier))
    ));
    const wranglerById = new Map(wranglerItems.map((item) => [itemIdOf(item), item]));

    const result = {
        status: 'applied',
        localCaseId,
        caseId: String(caseDoc._id),
        networkIdentifier: match.networkIdentifier || caseDoc.networkIdentifier || currentCaseId,
        protocolId: targetProtocolId,
        protocolChanged,
        caseBlockCount: caseBlocks.length,
        slideCount: caseItems.length,
        assigned: 0,
        already: 0,
        unmatched: 0,
        ambiguous: 0,
        failed: 0,
        issues: [],
    };

    for (const caseItem of caseItems) {
        const itemId = String(caseItem?._id || '');
        if (!itemId) continue;
        const wranglerItem = wranglerById.get(itemId);
        const choice = pickBlockForItem({
            caseItem,
            wranglerItem,
            caseBlocks,
            regionTemplates,
        });

        if (choice.status === 'ambiguous') {
            result.ambiguous += 1;
            result.issues.push({
                itemId,
                itemName: caseItem?.name || '',
                reason: 'ambiguous-block',
                candidates: (choice.candidates || []).map(blockName),
            });
            continue;
        }

        if (choice.status !== 'match' || !choice.block) {
            if (caseItem?.bdsaData?.blockId) {
                const existing = caseBlocks.find(
                    (block) => String(block._id) === String(caseItem.bdsaData.blockId)
                );
                if (existing) {
                    result.already += 1;
                    continue;
                }
            }
            result.unmatched += 1;
            result.issues.push({
                itemId,
                itemName: caseItem?.name || '',
                reason: choice.status === 'empty' ? 'no-regions' : 'no-matching-block',
            });
            continue;
        }

        const block = choice.block;
        if (blockAssignmentMatches(caseItem?.bdsaData, block)) {
            result.already += 1;
            continue;
        }

        try {
            await bdsaCatalogClient.updateItem(itemId, {
                blockId: block._id,
                regions: Array.isArray(block.regionDefinitions) ? block.regionDefinitions : [],
            });
            result.assigned += 1;
        } catch (error) {
            result.failed += 1;
            result.issues.push({
                itemId,
                itemName: caseItem?.name || '',
                reason: 'update-failed',
                error: error.message || String(error),
            });
        }
    }

    return result;
}

export async function applySectioningProtocolToCases({
    localCaseIds,
    protocol,
    items,
    regionTemplates,
    onProgress,
}) {
    const ids = (Array.isArray(localCaseIds) ? localCaseIds : []).filter(Boolean);
    if (ids.length === 0) {
        return { results: [], totals: emptyTotals() };
    }

    let hostCases = [];
    try {
        hostCases = asCaseList(await bdsaCatalogClient.listCases());
    } catch (error) {
        return {
            results: ids.map((localCaseId) => ({
                status: 'error',
                localCaseId,
                error: error.message || String(error),
            })),
            totals: { ...emptyTotals(), errors: ids.length },
        };
    }

    const results = [];
    for (let i = 0; i < ids.length; i += 1) {
        const localCaseId = ids[i];
        try {
            results.push(await applySectioningProtocolToCase({
                localCaseId,
                protocol,
                items,
                hostCases,
                regionTemplates,
            }));
        } catch (error) {
            results.push({
                status: 'error',
                localCaseId,
                error: error.message || String(error),
            });
        }
        if (typeof onProgress === 'function') {
            onProgress({
                current: i + 1,
                total: ids.length,
                localCaseId,
                result: results[results.length - 1],
            });
        }
    }

    return { results, totals: summarizeWiringResults(results) };
}

function emptyTotals() {
    return {
        cases: 0,
        appliedCases: 0,
        protocolChanges: 0,
        assigned: 0,
        already: 0,
        unmatched: 0,
        ambiguous: 0,
        failed: 0,
        missingCases: 0,
        errors: 0,
    };
}

export function summarizeWiringResults(results) {
    const totals = emptyTotals();
    (results || []).forEach((result) => {
        totals.cases += 1;
        if (result.status === 'applied') {
            totals.appliedCases += 1;
            if (result.protocolChanged) totals.protocolChanges += 1;
            totals.assigned += result.assigned || 0;
            totals.already += result.already || 0;
            totals.unmatched += result.unmatched || 0;
            totals.ambiguous += result.ambiguous || 0;
            totals.failed += result.failed || 0;
        } else if (result.status === 'missing-host-case' || result.status === 'would-create') {
            totals.missingCases += 1;
        } else {
            totals.errors += 1;
        }
    });
    return totals;
}

export function formatWiringSummary(totals, { singleCase = false } = {}) {
    if (!totals) return '';
    const parts = [];
    if (!singleCase) parts.push(`${totals.appliedCases}/${totals.cases} case(s) wired`);
    if (totals.protocolChanges) {
        parts.push(`${totals.protocolChanges} sectioning protocol change(s)`);
    }
    parts.push(`${totals.assigned} slide(s) assigned to blocks`);
    if (totals.already) parts.push(`${totals.already} already correct`);
    if (totals.unmatched) parts.push(`${totals.unmatched} unmatched`);
    if (totals.ambiguous) parts.push(`${totals.ambiguous} ambiguous`);
    if (totals.failed) parts.push(`${totals.failed} failed`);
    if (totals.missingCases) parts.push(`${totals.missingCases} case(s) not on the host yet`);
    if (totals.errors) parts.push(`${totals.errors} error(s)`);
    return parts.join(', ');
}
