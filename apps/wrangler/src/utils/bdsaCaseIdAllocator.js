export function normalizeLocalCaseId(value) {
    if (value == null) return '';
    return String(value).trim();
}

export function isFilledBdsaCaseId(value) {
    return Boolean(value && String(value).trim());
}

export const INSTITUTION_STORAGE_KEY = 'bdsa_institution_id';

export function padInstitution(institutionId) {
    return String(institutionId || '').trim().padStart(3, '0');
}

export function loadStoredInstitutionId() {
    try {
        return String(localStorage.getItem(INSTITUTION_STORAGE_KEY) || '').trim();
    } catch {
        return '';
    }
}

export function persistInstitutionId(institutionId) {
    const value = String(institutionId || '').trim();
    try {
        if (value) {
            localStorage.setItem(INSTITUTION_STORAGE_KEY, value);
        } else {
            localStorage.removeItem(INSTITUTION_STORAGE_KEY);
        }
    } catch {
        // ignore quota / private-mode failures
    }
    return value;
}

export function formatWranglerCaseId(institutionId, sequence) {
    return `BDSA-${padInstitution(institutionId)}-${String(sequence).padStart(4, '0')}`;
}

export function formatHostCaseId(institutionId, sequence) {
    return `${String(institutionId || '').trim()}-${String(sequence).padStart(3, '0')}`;
}

export function formatBdsaCaseId(institutionId, sequence, format = 'wrangler') {
    return format === 'host'
        ? formatHostCaseId(institutionId, sequence)
        : formatWranglerCaseId(institutionId, sequence);
}

function sequenceFromId(bdsaCaseId, institutionId, format = 'wrangler') {
    const value = String(bdsaCaseId || '').trim();
    if (format === 'host') {
        const prefix = `${String(institutionId || '').trim()}-`;
        if (!value.startsWith(prefix)) return null;
        const match = value.slice(prefix.length).match(/^(\d{3,4})$/);
        return match ? parseInt(match[1], 10) : null;
    }
    const prefix = `BDSA-${padInstitution(institutionId)}-`;
    if (!value.startsWith(prefix)) return null;
    const match = value.slice(prefix.length).match(/^(\d{4})$/);
    return match ? parseInt(match[1], 10) : null;
}

export function inferInstitutionPrefix(ids) {
    const counts = {};
    (ids || []).forEach((id) => {
        const match = String(id || '').trim().match(/^(.*)-(\d{3,4})$/);
        if (!match || !match[1]) return;
        if (match[1].startsWith('BDSA-')) return;
        counts[match[1]] = (counts[match[1]] || 0) + 1;
    });
    let best = '';
    let bestCount = 0;
    Object.entries(counts).forEach(([prefix, count]) => {
        if (count > bestCount) {
            best = prefix;
            bestCount = count;
        }
    });
    return best;
}

export function collectCaseIdState(processedData) {
    const byLocal = new Map();
    const takenIds = new Set();

    (processedData || []).forEach((item) => {
        const localCaseId = normalizeLocalCaseId(item.BDSA?.bdsaLocal?.localCaseId);
        if (!localCaseId) return;
        if (!byLocal.has(localCaseId)) {
            byLocal.set(localCaseId, { localCaseId, bdsaCaseId: null });
        }
        const bdsaCaseId = item.BDSA?.bdsaLocal?.bdsaCaseId;
        if (isFilledBdsaCaseId(bdsaCaseId)) {
            const trimmed = String(bdsaCaseId).trim();
            byLocal.get(localCaseId).bdsaCaseId = trimmed;
            takenIds.add(trimmed);
        }
    });

    return { byLocal, takenIds };
}

/**
 * Allocate unused BDSA-{inst}-{nnnn} IDs for local cases that have none.
 * Reads live row data only. Already-mapped locals are skipped.
 */
export function allocateBdsaCaseIds(processedData, institutionId, localCaseIds = null, {
    format = 'wrangler',
    extraTakenIds = [],
} = {}) {
    const institution = String(institutionId || '').trim();
    if (!institution) {
        return { error: 'Please set the site / institution prefix first.', assignments: [] };
    }

    const { byLocal, takenIds } = collectCaseIdState(processedData);
    (extraTakenIds || []).forEach((id) => {
        if (isFilledBdsaCaseId(id)) takenIds.add(String(id).trim());
    });
    const takenNumbers = new Set();
    takenIds.forEach((id) => {
        const sequence = sequenceFromId(id, institution, format);
        if (sequence != null) takenNumbers.add(sequence);
    });

    const targets = (localCaseIds && localCaseIds.length > 0)
        ? localCaseIds.map(normalizeLocalCaseId).filter(Boolean)
        : Array.from(byLocal.keys());

    let next = 1;
    const nextUnused = () => {
        while (takenNumbers.has(next)) next += 1;
        const sequence = next;
        takenNumbers.add(sequence);
        next += 1;
        return sequence;
    };

    const seen = new Set();
    const assignments = [];
    targets.forEach((localCaseId) => {
        if (seen.has(localCaseId)) return;
        seen.add(localCaseId);
        if (byLocal.get(localCaseId)?.bdsaCaseId) return;
        const bdsaCaseId = formatBdsaCaseId(institution, nextUnused(), format);
        takenIds.add(bdsaCaseId);
        assignments.push({ localCaseId, bdsaCaseId });
    });

    return { assignments };
}
