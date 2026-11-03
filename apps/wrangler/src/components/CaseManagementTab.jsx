import React, { useState, useEffect, useMemo } from 'react';
import './CaseManagementTab.css';
import dataStore from '../utils/dataStore';
import protocolStore from '../utils/protocolStore';
import dsaAuthStore from '../utils/dsaAuthStore';
import CaseStatsPanel from './CaseStatsPanel';
import CaseIdMappingSection from './CaseIdMappingSection';
import StainProtocolMapping from './StainProtocolMapping';
import RegionProtocolMapping from './RegionProtocolMapping';
import { matchLocalCase } from '../utils/hostCaseMatcher';
import { normalizeLocalCaseId } from '../utils/bdsaCaseIdAllocator';
import {
    inferInstitutionPrefix,
    loadStoredInstitutionId,
    persistInstitutionId,
} from '../utils/bdsaCaseIdAllocator';
import { applyHostCaseMatches } from '../utils/hostCaseMatcher';
import bdsaCatalogService from '../utils/bdsaCatalogService';
import {
    applySectioningProtocolToCases,
    formatWiringSummary,
} from '../utils/bdsaWiringService';

const CaseManagementTab = ({ embedded = false }) => {
    const [activeSubTab, setActiveSubTab] = useState('case-id-mapping');
    const [dataStatus, setDataStatus] = useState(dataStore.getStatus());
    const [bdsaInstitutionId, setBdsaInstitutionId] = useState(() => loadStoredInstitutionId());
    const [institutionLocked, setInstitutionLocked] = useState(Boolean(loadStoredInstitutionId()));
    const [institutionSource, setInstitutionSource] = useState('');
    const [temporaryHideMapped, setTemporaryHideMapped] = useState(false);
    const [showOnlyDuplicates, setShowOnlyDuplicates] = useState(false);
    const [caseIdFilter, setCaseIdFilter] = useState('');
    const [sortField, setSortField] = useState(null);
    const [sortDirection, setSortDirection] = useState('asc');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isGeneratingAll, setIsGeneratingAll] = useState(false);
    const [generateAllProgress, setGenerateAllProgress] = useState({ current: 0, total: 0, label: '' });
    const [hostCaseIndex, setHostCaseIndex] = useState(null);
    const [resourceId, setResourceId] = useState(() => dsaAuthStore.getConfig().resourceId || '');
    const [sectioningProtocols, setSectioningProtocols] = useState([]);
    const [isSavingSectioningProtocol, setIsSavingSectioningProtocol] = useState(false);
    const [sectioningProgress, setSectioningProgress] = useState('');

    // Subscribe to data store updates
    useEffect(() => {
        const unsubscribe = dataStore.subscribe(() => {
            const newStatus = dataStore.getStatus();
            setDataStatus(newStatus);

            // Initialize case ID mappings when data becomes available
            // This should run every time data changes to re-detect conflicts
            if (newStatus.processedData && newStatus.processedData.length > 0) {
                dataStore.initializeCaseIdMappingsFromData();
            }
        });

        return unsubscribe;
    }, []); // Only run once on mount

    useEffect(() => {
        return dsaAuthStore.subscribe(() => {
            setResourceId(dsaAuthStore.getConfig().resourceId || '');
        });
    }, []);

    const hostImported = embedded || dsaAuthStore.hostImported;

    useEffect(() => {
        if (!hostImported) {
            setSectioningProtocols([]);
            return undefined;
        }
        if (activeSubTab !== 'case-id-mapping') {
            return undefined;
        }
        let cancelled = false;
        (async () => {
            try {
                const catalog = await bdsaCatalogService.listSectioningCatalog();
                if (!cancelled) {
                    setSectioningProtocols(catalog.protocols || []);
                }
            } catch (error) {
                console.warn('Could not load sectioning protocols:', error.message);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [hostImported, activeSubTab]);

    const getMetadataTarget = () => {
        const config = dsaAuthStore.getConfig();
        const overrideFolder = (config.metadataSyncTargetFolder || '').trim();
        return {
            baseUrl: config.baseUrl,
            token: dsaAuthStore.getToken(),
            resourceId: overrideFolder || config.resourceId,
            resourceType: overrideFolder ? 'folder' : (config.resourceType || 'folder'),
            resourceName: config.resourceName || '',
        };
    };

    const applyInstitution = (value, { locked = true, source = '', persistLocal = true } = {}) => {
        const next = String(value || '').trim();
        setBdsaInstitutionId(next);
        setInstitutionLocked(Boolean(next) && locked);
        setInstitutionSource(source);
        if (persistLocal) persistInstitutionId(next);
    };

    const saveInstitutionToResource = async (value) => {
        const next = String(value || '').trim();
        if (!next) return { success: false, error: 'Institution ID is required' };
        const target = getMetadataTarget();
        if (!target.resourceId) {
            applyInstitution(next, { locked: true, source: 'local' });
            return { success: true };
        }
        const { setInstitutionIdOnResource } = await import('../utils/DsaFolderMetadataSync.js');
        await setInstitutionIdOnResource(
            target.baseUrl,
            target.resourceId,
            target.token,
            next,
            target.resourceType
        );
        applyInstitution(next, {
            locked: true,
            source: target.resourceType,
        });
        return { success: true };
    };

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const target = getMetadataTarget();
            let fromResource = '';
            if (target.resourceId && target.token) {
                try {
                    const { getInstitutionIdFromResource } = await import('../utils/DsaFolderMetadataSync.js');
                    const result = await getInstitutionIdFromResource(
                        target.baseUrl,
                        target.resourceId,
                        target.token,
                        target.resourceType
                    );
                    fromResource = result.institutionId || '';
                } catch (error) {
                    console.warn('Could not read institution ID from resource:', error.message);
                }
            }

            let fromNode = '';
            if (hostImported) {
                try {
                    const { default: bdsaCatalogClient } = await import('../utils/bdsaCatalogClient.js');
                    const { indexHostCases, asCaseList } = await import('../utils/hostCaseMatcher.js');
                    const [hostCases, localNode] = await Promise.all([
                        bdsaCatalogClient.listCases(),
                        bdsaCatalogClient.getLocalNode().catch(() => null),
                    ]);
                    if (cancelled) return;
                    const index = indexHostCases(hostCases);
                    setHostCaseIndex(index);
                    applyHostCaseMatches(dataStore, index);
                    fromNode = String(localNode?.networkIdentifier || '').trim();
                    if (fromNode === 'NetworkXX') fromNode = '';
                    if (!fromNode) {
                        fromNode = inferInstitutionPrefix(asCaseList(hostCases).map((doc) => doc.networkIdentifier));
                    }
                } catch (error) {
                    console.warn('Could not load host BDSA identity:', error.message);
                }
            }

            if (cancelled) return;
            if (fromResource) {
                applyInstitution(fromResource, { locked: true, source: target.resourceType });
                return;
            }
            if (fromNode && target.resourceId && target.token) {
                try {
                    await saveInstitutionToResource(fromNode);
                    return;
                } catch (error) {
                    console.warn('Could not stamp institution ID on resource:', error.message);
                    applyInstitution(fromNode, { locked: true, source: 'server' });
                    return;
                }
            }
            if (fromNode) {
                applyInstitution(fromNode, { locked: true, source: 'server' });
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [embedded, hostImported, resourceId]);

    // Reset the temporary filters when new items are generated
    const resetTemporaryFilter = () => {
        if (temporaryHideMapped) {
            setTemporaryHideMapped(false);
        }
        if (showOnlyDuplicates) {
            setShowOnlyDuplicates(false);
        }
    };

    // Protocol mapping functions are now handled by the ProtocolMapping component

    // Create a dependency that tracks actual BDSA Case ID values in the data
    const bdsaCaseIdHash = useMemo(() => {
        if (!dataStatus.processedData || dataStatus.processedData.length === 0) {
            return '';
        }

        // Create a hash of all BDSA Case IDs to detect changes
        const bdsaCaseIds = dataStatus.processedData
            .map(row => row.BDSA?.bdsaLocal?.bdsaCaseId || '')
            .filter(id => id)
            .sort()
            .join('|');

        return bdsaCaseIds;
    }, [dataStatus.processedData]);

    // Get unique case IDs from the data (memoized for stability)
    const getUniqueCaseIds = useMemo(() => {
        return () => {
            if (!dataStatus.processedData || dataStatus.processedData.length === 0) {
                return [];
            }

            const caseIdCounts = {};

            // Count occurrences of each local case ID
            dataStatus.processedData.forEach((row) => {
                const localCaseId = normalizeLocalCaseId(row.BDSA?.bdsaLocal?.localCaseId);
                if (localCaseId) {
                    caseIdCounts[localCaseId] = (caseIdCounts[localCaseId] || 0) + 1;
                }
            });

            const caseIdMappings = new Map();
            const sectioningByCase = new Map();
            dataStatus.processedData?.forEach((item) => {
                const localCaseId = normalizeLocalCaseId(item.BDSA?.bdsaLocal?.localCaseId);
                const bdsaCaseId = item.BDSA?.bdsaLocal?.bdsaCaseId;
                if (localCaseId && bdsaCaseId && String(bdsaCaseId).trim()) {
                    caseIdMappings.set(localCaseId, String(bdsaCaseId).trim());
                }
                if (!localCaseId) {
                    return;
                }
                const protocolId = String(item.BDSA?.bdsaLocal?.bdsaSectioningProtocolId || '').trim();
                const protocolName = String(item.BDSA?.bdsaLocal?.bdsaSectioningProtocol || '').trim();
                const current = sectioningByCase.get(localCaseId);
                if (!current) {
                    sectioningByCase.set(localCaseId, {
                        id: protocolId,
                        name: protocolName,
                        mixed: false,
                    });
                    return;
                }
                if ((current.id || '') !== protocolId || (current.name || '') !== protocolName) {
                    current.mixed = true;
                    if (!current.id && !current.name && (protocolId || protocolName)) {
                        current.id = protocolId;
                        current.name = protocolName;
                    }
                }
            });

            const allCases = Object.entries(caseIdCounts)
                .map(([caseId, count]) => {
                    const sectioning = sectioningByCase.get(caseId) || {};
                    return {
                        localCaseId: caseId,
                        rowCount: count,
                        bdsaCaseId: caseIdMappings.get(caseId) || null,
                        isMapped: Boolean(caseIdMappings.get(caseId)),
                        sectioningProtocolId: sectioning.id || '',
                        sectioningProtocolName: sectioning.name || '',
                        sectioningProtocolMixed: Boolean(sectioning.mixed),
                    };
                });

            // Always provide a stable sort to prevent rows from jumping around during edits
            if (sortField) {
                // User has explicitly chosen a sort field - respect that choice
                allCases.sort((a, b) => {
                    let aValue, bValue;
                    switch (sortField) {
                        case 'rowCount':
                            aValue = a.rowCount;
                            bValue = b.rowCount;
                            break;
                        case 'bdsaCaseId':
                            aValue = a.bdsaCaseId || '';
                            bValue = b.bdsaCaseId || '';
                            break;
                        default:
                            aValue = a.localCaseId;
                            bValue = b.localCaseId;
                            break;
                    }

                    if (sortDirection === 'asc') {
                        return aValue > bValue ? 1 : -1;
                    } else {
                        return aValue < bValue ? 1 : -1;
                    }
                });
            } else {
                // No user sorting - maintain stable order by localCaseId to prevent jumping during edits
                allCases.sort((a, b) => a.localCaseId.localeCompare(b.localCaseId));
            }

            return allCases;
        };
    }, [dataStatus.processedData, sortField, sortDirection, bdsaCaseIdHash]);

    // Detect duplicate BDSA Case IDs
    const duplicateBdsaCaseIds = useMemo(() => {
        const allCases = getUniqueCaseIds();
        const bdsaCaseIdCounts = new Map();

        allCases.forEach(caseData => {
            if (caseData.bdsaCaseId) {
                const count = bdsaCaseIdCounts.get(caseData.bdsaCaseId) || 0;
                bdsaCaseIdCounts.set(caseData.bdsaCaseId, count + 1);
            }
        });

        const duplicates = new Set();
        bdsaCaseIdCounts.forEach((count, bdsaCaseId) => {
            if (count > 1) {
                duplicates.add(bdsaCaseId);
            }
        });

        return duplicates;
    }, [dataStatus.processedData, dataStatus.caseIdMappings]);

    // Filter cases based on mapped status, duplicates, and search
    const filteredCaseIds = useMemo(() => {
        const allCases = getUniqueCaseIds();
        let filtered = allCases;

        // Apply search filter
        if (caseIdFilter && caseIdFilter.trim() !== '') {
            const searchTerm = caseIdFilter.toLowerCase().trim();
            filtered = filtered.filter(caseData => {
                const localCaseId = caseData.localCaseId?.toLowerCase() || '';
                const bdsaCaseId = caseData.bdsaCaseId?.toLowerCase() || '';
                return localCaseId.includes(searchTerm) || bdsaCaseId.includes(searchTerm);
            });
        }

        if (temporaryHideMapped) {
            filtered = filtered.filter(caseData => !caseData.isMapped);
        }

        if (showOnlyDuplicates) {
            filtered = filtered.filter(caseData =>
                caseData.bdsaCaseId && duplicateBdsaCaseIds.has(caseData.bdsaCaseId)
            );
        }

        if (hostCaseIndex) {
            return filtered.map((caseData) => {
                const match = matchLocalCase(caseData.localCaseId, caseData.bdsaCaseId, hostCaseIndex);
                return {
                    ...caseData,
                    hostStatus: match.status,
                    hostNetworkId: match.networkIdentifier || null,
                    hostReason: match.reason || '',
                };
            });
        }

        return filtered;
    }, [dataStatus.processedData, dataStatus.caseIdMappings, temporaryHideMapped, showOnlyDuplicates, duplicateBdsaCaseIds, sortField, sortDirection, caseIdFilter, hostCaseIndex]);

    // Get statistics
    const stats = useMemo(() => {
        const allCases = getUniqueCaseIds();
        // Count slides that don't have BDSA stain protocol assignments
        const unmappedStainSlides = dataStatus.processedData?.filter(row => {
            const hasStainProtocols = row.BDSA?.bdsaLocal?.bdsaStainProtocol &&
                Array.isArray(row.BDSA.bdsaLocal.bdsaStainProtocol) &&
                row.BDSA.bdsaLocal.bdsaStainProtocol.length > 0;
            return !hasStainProtocols;
        }).length || 0;

        // Debug: Let's understand the discrepancy
        if (dataStatus.processedData && dataStatus.processedData.length > 0) {
            const itemsWithStainID = dataStatus.processedData.filter(row => {
                const bdsaLocal = row.BDSA?.bdsaLocal;
                return bdsaLocal && bdsaLocal.localStainID;
            });

            const itemsWithEmptyProtocols = itemsWithStainID.filter(row => {
                const protocols = row.BDSA?.bdsaLocal?.bdsaStainProtocol;
                return !protocols || !Array.isArray(protocols) || protocols.length === 0;
            });

            const itemsWithNoProtocolField = itemsWithStainID.filter(row => {
                return !row.BDSA?.bdsaLocal?.bdsaStainProtocol;
            });

            console.log('🔍 DEBUG - Stain Protocol Analysis:', {
                totalItems: dataStatus.processedData.length,
                itemsWithStainID: itemsWithStainID.length,
                unmappedStainSlides, // Items with no protocols at all
                itemsWithEmptyProtocols: itemsWithEmptyProtocols.length, // Items with empty protocol arrays
                itemsWithNoProtocolField: itemsWithNoProtocolField.length // Items with no protocol field
            });

            // Show some examples
            if (itemsWithEmptyProtocols.length > 0) {
                console.log('🔍 Sample items with empty protocols:', itemsWithEmptyProtocols.slice(0, 3).map(item => ({
                    id: item.id,
                    localStainID: item.BDSA?.bdsaLocal?.localStainID,
                    bdsaStainProtocol: item.BDSA?.bdsaLocal?.bdsaStainProtocol
                })));
            }
        }

        // Debug: Let's see what's actually in the data
        if (dataStatus.processedData && dataStatus.processedData.length > 0) {
            const sampleRows = dataStatus.processedData.slice(0, 3);
            // console.log('🔍 DEBUG - Sample data rows for unmapped count:', sampleRows.map(row => ({
            //     id: row.id || row._id,
            //     bdsaStainProtocol: row.BDSA?.bdsaLocal?.bdsaStainProtocol,
            //     hasStainProtocols: !!(row.BDSA?.bdsaLocal?.bdsaStainProtocol &&
            //         Array.isArray(row.BDSA.bdsaLocal.bdsaStainProtocol) &&
            //         row.BDSA.bdsaLocal.bdsaStainProtocol.length > 0)
            // })));

            const mappedCount = dataStatus.processedData.filter(row => {
                const hasStainProtocols = row.BDSA?.bdsaLocal?.bdsaStainProtocol &&
                    Array.isArray(row.BDSA.bdsaLocal.bdsaStainProtocol) &&
                    row.BDSA.bdsaLocal.bdsaStainProtocol.length > 0;
                return hasStainProtocols;
            }).length;

            // console.log(`🔍 DEBUG - Unmapped count: ${unmappedStainSlides}, Mapped count: ${mappedCount}, Total: ${dataStatus.processedData.length}`);
        }

        // Count slides that don't have BDSA region protocol assignments
        const unmappedRegionSlides = dataStatus.processedData?.filter(row => {
            const hasRegionProtocols = row.BDSA?.bdsaLocal?.bdsaRegionProtocol &&
                Array.isArray(row.BDSA.bdsaLocal.bdsaRegionProtocol) &&
                row.BDSA.bdsaLocal.bdsaRegionProtocol.length > 0;
            return !hasRegionProtocols;
        }).length || 0;

        const mappedCases = allCases.filter(caseData => caseData.isMapped).length;

        // Count unique BDSA Case IDs from the actual data
        const bdsaCaseIds = new Set();
        dataStatus.processedData?.forEach(row => {
            const bdsaCaseId = row.BDSA?.bdsaLocal?.bdsaCaseId;
            if (bdsaCaseId) {
                bdsaCaseIds.add(bdsaCaseId);
            }
        });

        // Get conflict counts from dataStore
        const localCaseIdConflicts = dataStore.getCaseIdConflicts();
        const bdsaCaseIdConflicts = dataStore.getBdsaCaseIdConflicts();
        const localConflictCount = Object.keys(localCaseIdConflicts).length;
        const bdsaConflictCount = Object.keys(bdsaCaseIdConflicts).length;

        // Debug logging to see what's happening
        // console.log('🔍 Conflict Detection Debug:', {
        //     localConflictCount,
        //     bdsaConflictCount,
        //     localCaseIdConflicts,
        //     bdsaCaseIdConflicts,
        //     totalCases: allCases.length,
        //     processedDataLength: dataStatus.processedData?.length
        // });

        return {
            unmappedStainSlides,
            unmappedRegionSlides,
            mappedCases,
            bdsaCaseIds: bdsaCaseIds.size,
            localCaseIdConflicts,
            bdsaCaseIdConflicts,
            localConflictCount,
            bdsaConflictCount
        };
    }, [dataStatus.processedData, dataStatus.caseIdConflicts, dataStatus.bdsaCaseIdConflicts, dataStatus.caseIdMappings, bdsaCaseIdHash]);

    const generateOptions = () => ({
        format: hostImported ? 'host' : 'wrangler',
        extraTakenIds: hostCaseIndex ? Array.from(hostCaseIndex.byNetwork.keys()) : [],
    });

    const persistItemsForLocalCases = async (localCaseIds, onProgress) => {
        const assignedLocals = new Set(
            (localCaseIds || []).map((localCaseId) => normalizeLocalCaseId(localCaseId)).filter(Boolean)
        );
        if (assignedLocals.size === 0) {
            return { updatedCount: 0, failedCount: 0 };
        }
        const items = (dataStore.processedData || []).filter((item) => (
            assignedLocals.has(normalizeLocalCaseId(item.BDSA?.bdsaLocal?.localCaseId))
        ));
        if (items.length === 0) {
            return { updatedCount: 0, failedCount: 0 };
        }
        const { persistBdsaLocalBulk } = await import('../utils/DsaMetadataManager.js');
        const result = await persistBdsaLocalBulk(items, onProgress);
        (result.updated || []).forEach((itemId) => dataStore.modifiedItems.delete(itemId));
        dataStore.notify();
        return result;
    };

    const persistAssignedCaseIds = async (assignments, onProgress) => {
        if (!assignments?.length) {
            return { updatedCount: 0, failedCount: 0 };
        }
        return persistItemsForLocalCases(
            assignments.map((assignment) => assignment.localCaseId),
            onProgress
        );
    };

    const describeWiringProblems = (wiring) => {
        const problems = [];
        (wiring?.results || []).forEach((result) => {
            if (result.status === 'applied') {
                (result.issues || []).forEach((issue) => {
                    if (issue.reason !== 'update-failed' && issue.reason !== 'ambiguous-block') {
                        return;
                    }
                    const label = issue.itemName || issue.itemId;
                    const extra = issue.error ? ` (${issue.error})` : '';
                    problems.push(`${result.localCaseId}: ${label} — ${issue.reason}${extra}`);
                });
                return;
            }
            const extra = result.error ? ` (${result.error})` : '';
            problems.push(`${result.localCaseId}: ${result.status}${extra}`);
        });
        return problems;
    };

    const persistAndWireSectioningProtocol = async (localCaseIds, protocol, { singleCase = false } = {}) => {
        setIsSavingSectioningProtocol(true);
        setSectioningProgress(singleCase ? 'Saving sectioning protocol…' : 'Saving sectioning protocol to cases…');
        let persist = { updatedCount: 0, failedCount: 0 };
        let persistError = '';
        let wiring = null;
        let wiringError = '';

        try {
            persist = await persistItemsForLocalCases(localCaseIds);
        } catch (error) {
            persistError = error.message || 'Failed to save the sectioning protocol to this DSA node.';
        }

        if (!persistError) {
            try {
                const regionTemplates = await bdsaCatalogService.listRegionProtocols();
                wiring = await applySectioningProtocolToCases({
                    localCaseIds,
                    protocol,
                    items: dataStore.processedData,
                    regionTemplates,
                    onProgress: ({ current, total, localCaseId }) => {
                        setSectioningProgress(total > 1
                            ? `Wiring sectioning protocol · ${current}/${total} cases (${localCaseId})`
                            : 'Wiring sectioning protocol to the host case…');
                    },
                });
            } catch (error) {
                wiringError = error.message || 'Failed to wire the sectioning protocol to the host case.';
            }
        }

        setIsSavingSectioningProtocol(false);
        setSectioningProgress('');

        const totals = wiring?.totals;
        const notable = Boolean(
            persistError
            || wiringError
            || persist.failedCount
            || totals?.failed
            || totals?.ambiguous
            || totals?.errors
            || totals?.missingCases
            || totals?.protocolChanges
            || totals?.assigned
        );
        if (!notable) {
            return;
        }

        const lines = [];
        if (persist.failedCount) {
            lines.push(`${persist.failedCount} slide(s) failed to save to this DSA node.`);
        }
        if (persistError) {
            lines.push(persistError);
        }
        if (wiringError) {
            lines.push(wiringError);
        }
        if (totals) {
            lines.push(formatWiringSummary(totals, { singleCase }));
            const problems = describeWiringProblems(wiring);
            if (problems.length) {
                lines.push('', ...problems.slice(0, 5));
                if (problems.length > 5) {
                    lines.push(`…and ${problems.length - 5} more.`);
                }
            }
        }
        window.alert(lines.filter(Boolean).join('\n'));
    };

    const handleSetSectioningProtocol = async (localCaseId, protocol) => {
        dataStore.setSectioningProtocolInData(localCaseId, protocol);
        if (!hostImported) {
            return;
        }
        await persistAndWireSectioningProtocol([localCaseId], protocol, { singleCase: true });
    };

    const handleApplySectioningProtocolToAll = async (protocol) => {
        const cases = getUniqueCaseIds();
        if (cases.length === 0) {
            return;
        }
        const label = protocol?.name || 'this sectioning protocol';
        const confirmed = window.confirm(
            `Apply “${label}” as the sectioning protocol for all ${cases.length} cases?\n\n`
            + 'Changing a case protocol rebuilds its blocks and clears existing slide block assignments. '
            + 'Slides are re-assigned only when their regions match a block.'
        );
        if (!confirmed) {
            return;
        }
        const localCaseIds = cases.map((caseData) => caseData.localCaseId);
        dataStore.setSectioningProtocolForCases(localCaseIds, protocol);
        if (!hostImported) {
            return;
        }
        await persistAndWireSectioningProtocol(localCaseIds, protocol);
    };

    const generateCaseId = async (localCaseId) => {
        if (!bdsaInstitutionId || bdsaInstitutionId.trim() === '') {
            alert('Set the BDSA Institution ID on this folder or collection before generating case IDs.');
            return;
        }
        setIsGenerating(true);
        try {
            const result = dataStore.generateBdsaCaseIds(bdsaInstitutionId, [localCaseId], generateOptions());
            if (!result.success) {
                alert(result.error);
                return;
            }
            if (result.assigned.length > 0) {
                resetTemporaryFilter();
                const persist = await persistAssignedCaseIds(result.assigned);
                if (persist.failedCount) {
                    alert(`Generated ${result.assigned.length} Case ID(s), but ${persist.failedCount} slide(s) failed to save to this DSA node.`);
                }
            }
        } catch (error) {
            alert(error.message || 'Failed to save generated Case IDs to this DSA node.');
        } finally {
            setIsGenerating(false);
        }
    };

    const generateAllCaseIds = async () => {
        if (!bdsaInstitutionId || bdsaInstitutionId.trim() === '') {
            alert('Set the BDSA Institution ID on this folder or collection before generating case IDs.');
            return;
        }
        setIsGeneratingAll(true);
        setGenerateAllProgress({ current: 0, total: 0, label: 'Generating BDSA Case IDs...' });
        try {
            const result = dataStore.generateBdsaCaseIds(bdsaInstitutionId, null, generateOptions());
            if (!result.success) {
                alert(result.error);
                return;
            }
            if (result.assigned.length > 0) {
                resetTemporaryFilter();
                const persist = await persistAssignedCaseIds(result.assigned, (progress) => {
                    setGenerateAllProgress({
                        current: progress.current || 0,
                        total: progress.total || 0,
                        label: 'Saving Case IDs to this DSA node...',
                    });
                });
                if (persist.failedCount) {
                    alert(`Generated ${result.assigned.length} Case IDs. Saved ${persist.updatedCount} slides; ${persist.failedCount} failed.`);
                }
            }
        } catch (error) {
            alert(error.message || 'Failed to save generated Case IDs to this DSA node.');
        } finally {
            setIsGeneratingAll(false);
            setGenerateAllProgress({ current: 0, total: 0, label: '' });
        }
    };

    // Clear duplicate BDSA Case IDs
    const clearDuplicates = () => {
        const caseIdMappings = dataStatus.caseIdMappings || {};
        const newMappings = { ...caseIdMappings };

        // Find and clear duplicate mappings
        filteredCaseIds.forEach(caseData => {
            if (caseData.bdsaCaseId && duplicateBdsaCaseIds.has(caseData.bdsaCaseId)) {
                delete newMappings[caseData.localCaseId];
            }
        });

        dataStore.updateCaseIdMappings(newMappings);
    };

    // Sync case ID mappings to DSA server
    const handleSyncCaseIdMappingsToDSA = async () => {
        console.log('🔍 PUSH BUTTON CLICKED - Starting push operation');
        console.log('🔍 Current dataStatus:', dataStatus);
        console.log('🔍 Case ID mappings from dataStore:', dataStore.caseIdMappings);

        const authStatus = dsaAuthStore.getStatus();

        if (!authStatus.isAuthenticated) {
            alert('Please login to DSA server first');
            return;
        }

        if (!authStatus.isConfigured) {
            alert('Please configure DSA server first');
            return;
        }

        try {
            // Test connection first
            await dsaAuthStore.testConnection();

            // Get DSA configuration
            const config = dsaAuthStore.getConfig();
            const dsaConfig = {
                baseUrl: config.baseUrl,
                resourceId: config.resourceId,
                metadataSyncTargetFolder: config.metadataSyncTargetFolder,
                token: dsaAuthStore.token
            };

            // Get current case ID mappings from the same source as the UI
            // (Read directly from processedData items, not from dataStatus.caseIdMappings)
            const caseIdMappings = {};
            dataStatus.processedData?.forEach((item) => {
                const localCaseId = item.BDSA?.bdsaLocal?.localCaseId;
                const bdsaCaseId = item.BDSA?.bdsaLocal?.bdsaCaseId;
                if (localCaseId && bdsaCaseId) {
                    caseIdMappings[localCaseId] = bdsaCaseId;
                }
            });

            console.log('🔍 PUSH DEBUG - Current case ID mappings:', {
                caseIdMappings,
                keys: Object.keys(caseIdMappings),
                length: Object.keys(caseIdMappings).length,
                dataStatus: dataStatus
            });

            if (Object.keys(caseIdMappings).length === 0) {
                console.log('❌ PUSH FAILED - No case ID mappings found');
                alert('No case ID mappings to sync. Please generate some BDSA case IDs first.');
                return;
            }

            // Sync case ID mappings to DSA
            const result = await protocolStore.syncWithDSA(dsaConfig, caseIdMappings, bdsaInstitutionId);

            if (result.success) {
                alert(`Case ID mappings synced successfully!\n\nSynced ${result.pushed.caseIdMappings} case ID mappings to DSA server.`);
            } else {
                alert(`Sync failed: ${result.error}`);
            }
        } catch (error) {
            alert(`DSA sync failed: ${error.message}`);
        }
    };

    // Pull case ID mappings from DSA server
    const handlePullCaseIdMappingsFromDSA = async () => {
        const authStatus = dsaAuthStore.getStatus();

        if (!authStatus.isAuthenticated) {
            alert('Please login to DSA server first');
            return;
        }

        if (!authStatus.isConfigured) {
            alert('Please configure DSA server first');
            return;
        }

        try {
            // Test connection first
            await dsaAuthStore.testConnection();

            // Get DSA configuration
            const config = dsaAuthStore.getConfig();
            const dsaConfig = {
                baseUrl: config.baseUrl,
                resourceId: config.resourceId,
                metadataSyncTargetFolder: config.metadataSyncTargetFolder,
                token: dsaAuthStore.token
            };

            console.log('🔍 PULL DEBUG - DSA Configuration:', {
                baseUrl: dsaConfig.baseUrl,
                resourceId: dsaConfig.resourceId,
                currentCollectionId: dataStatus.dataSourceInfo?.resourceId || dataStatus.dataSourceInfo?.collectionId,
                dataSourceInfo: dataStatus.dataSourceInfo,
                currentDataLength: dataStatus.processedData?.length
            });

            // Check localStorage for cached case ID mappings
            const cachedCaseIdMappings = localStorage.getItem('bdsa_case_id_mappings');
            const cachedDataStore = localStorage.getItem('bdsa_data_store');

            console.log('🔍 PULL DEBUG - localStorage cache check:', {
                hasCachedCaseIdMappings: !!cachedCaseIdMappings,
                cachedCaseIdMappings: cachedCaseIdMappings ? JSON.parse(cachedCaseIdMappings) : null,
                hasCachedDataStore: !!cachedDataStore,
                cachedDataStoreKeys: cachedDataStore ? Object.keys(JSON.parse(cachedDataStore)) : null
            });

            // Confirm before overwriting local mappings
            const confirmMessage = 'This will overwrite your local case ID mappings with the versions from the DSA server. Continue?';
            if (!window.confirm(confirmMessage)) {
                return;
            }

            // Pull case ID mappings from DSA
            const result = await protocolStore.pullFromDSA(dsaConfig);

            if (result.success) {
                console.log('🔍 Pull result from protocolStore:', {
                    result,
                    caseIdMappings: result.caseIdMappings,
                    hasMappings: result.caseIdMappings?.mappings
                });

                if (result.caseIdMappings && result.caseIdMappings.mappings) {
                    console.log('🔍 PULL DEBUG - Processing pulled mappings:', {
                        totalMappings: result.caseIdMappings.mappings.length,
                        firstFewMappings: result.caseIdMappings.mappings.slice(0, 3)
                    });

                    // Convert the pulled mappings to the local format
                    const newMappings = {};

                    // Count institution IDs to find the most common one
                    const institutionIdCounts = {};
                    result.caseIdMappings.mappings.forEach(mapping => {
                        if (mapping.bdsaCaseId) {
                            const match = mapping.bdsaCaseId.match(/BDSA-(\d{3})-/);
                            if (match) {
                                const instId = match[1];
                                institutionIdCounts[instId] = (institutionIdCounts[instId] || 0) + 1;
                            }
                        }
                    });

                    // Find the most common institution ID
                    let extractedInstitutionId = null;
                    let maxCount = 0;
                    for (const [instId, count] of Object.entries(institutionIdCounts)) {
                        if (count > maxCount) {
                            maxCount = count;
                            extractedInstitutionId = instId;
                        }
                    }

                    console.log('🔍 PULL DEBUG - Institution ID analysis:', {
                        institutionIdCounts,
                        extractedInstitutionId,
                        maxCount,
                        totalMappings: result.caseIdMappings.mappings.length
                    });

                    result.caseIdMappings.mappings.forEach(mapping => {
                        newMappings[mapping.localCaseId] = mapping.bdsaCaseId;
                    });

                    // Update local case ID mappings
                    dataStore.updateCaseIdMappings(newMappings);

                    // Auto-set institution ID if we extracted one and it's different from current
                    if (extractedInstitutionId && extractedInstitutionId !== bdsaInstitutionId) {
                        setBdsaInstitutionId(extractedInstitutionId);
                        console.log(`🏛️ Auto-set BDSA Institution ID to: ${extractedInstitutionId} (from DSA collection)`);
                    }

                    const institutionMsg = extractedInstitutionId ? `\n\nInstitution ID auto-set to: ${extractedInstitutionId}` : '';
                    alert(`Case ID mappings pulled successfully!\n\nPulled ${result.pulled.caseIdMappings} case ID mappings from DSA server.${institutionMsg}`);
                } else {
                    // Clear old case ID mappings from previous collection
                    console.log('⚠️ No case ID mappings found on server - clearing old mappings');
                    dataStore.clearCaseIdMappings();
                    alert('No case ID mappings found in DSA server.\n\nOld case ID mappings have been cleared. You can now generate new ones for this collection.');
                }
            } else {
                alert(`Pull failed: ${result.error}`);
            }
        } catch (error) {
            alert(`DSA pull failed: ${error.message}`);
        }
    };

    // Handle sorting
    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    // Get sort icon
    const getSortIcon = (field) => {
        if (sortField !== field) return '↕';
        return sortDirection === 'asc' ? '↑' : '↓';
    };

    return (
        <div className="case-management-tab">
            <CaseStatsPanel stats={stats} />

            {/* Sub-tabs */}
            <div className="case-management-sub-tabs">
                <button
                    className={`sub-tab-btn ${activeSubTab === 'case-id-mapping' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('case-id-mapping')}
                >
                    Case ID Mapping
                </button>
                <button
                    className={`sub-tab-btn ${activeSubTab === 'stain-protocol-mapping' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('stain-protocol-mapping')}
                >
                    Stain Protocol Mapping
                </button>
                <button
                    className={`sub-tab-btn ${activeSubTab === 'region-protocol-mapping' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('region-protocol-mapping')}
                >
                    Region Mapping
                </button>
            </div>

            {/* Case ID Mapping Content */}
            {activeSubTab === 'case-id-mapping' && (
                <CaseIdMappingSection
                    bdsaInstitutionId={bdsaInstitutionId}
                    setBdsaInstitutionId={setBdsaInstitutionId}
                    institutionLocked={institutionLocked}
                    institutionSource={institutionSource}
                    onSaveInstitutionId={saveInstitutionToResource}
                    filteredCaseIds={filteredCaseIds}
                    duplicateBdsaCaseIds={duplicateBdsaCaseIds}
                    clearDuplicates={clearDuplicates}
                    isGeneratingAll={isGeneratingAll}
                    generateAllProgress={generateAllProgress}
                    stats={stats}
                    temporaryHideMapped={temporaryHideMapped}
                    setTemporaryHideMapped={setTemporaryHideMapped}
                    showOnlyDuplicates={showOnlyDuplicates}
                    setShowOnlyDuplicates={setShowOnlyDuplicates}
                    caseIdFilter={caseIdFilter}
                    setCaseIdFilter={setCaseIdFilter}
                    generateAllCaseIds={generateAllCaseIds}
                    handleSyncCaseIdMappingsToDSA={handleSyncCaseIdMappingsToDSA}
                    handlePullCaseIdMappingsFromDSA={handlePullCaseIdMappingsFromDSA}
                    generateCaseId={generateCaseId}
                    isGenerating={isGenerating}
                    sortField={sortField}
                    sortDirection={sortDirection}
                    handleSort={handleSort}
                    getSortIcon={getSortIcon}
                    hostImported={embedded || dsaAuthStore.hostImported}
                    sectioningProtocols={sectioningProtocols}
                    onSetSectioningProtocol={handleSetSectioningProtocol}
                    onApplySectioningProtocolToAll={handleApplySectioningProtocolToAll}
                    isSavingSectioningProtocol={isSavingSectioningProtocol}
                    sectioningProgress={sectioningProgress}
                />
            )}

            {/* Stain Protocol Mapping Content */}
            {activeSubTab === 'stain-protocol-mapping' && (
                <StainProtocolMapping />
            )}

            {/* Region Protocol Mapping Content */}
            {activeSubTab === 'region-protocol-mapping' && (
                <RegionProtocolMapping />
            )}

        </div>
    );
};

export default CaseManagementTab;
