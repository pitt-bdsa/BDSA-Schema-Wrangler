import React, { useState, useEffect, useMemo } from 'react';
import './CaseManagementTab.css';
import dataStore, { setCaseIdInData, generateUnmappedCases } from '../utils/dataStore';
import protocolStore from '../utils/protocolStore';
import dsaAuthStore from '../utils/dsaAuthStore';
import CaseStatsPanel from './CaseStatsPanel';
import CaseIdMappingSection from './CaseIdMappingSection';
import StainProtocolMapping from './StainProtocolMapping';
import RegionProtocolMapping from './RegionProtocolMapping';

const CaseManagementTab = () => {
    const [activeSubTab, setActiveSubTab] = useState('case-id-mapping');
    const [dataStatus, setDataStatus] = useState(dataStore.getStatus());
    const [bdsaInstitutionId, setBdsaInstitutionId] = useState('');
    const [temporaryHideMapped, setTemporaryHideMapped] = useState(false);
    const [showOnlyDuplicates, setShowOnlyDuplicates] = useState(false);
    const [caseIdFilter, setCaseIdFilter] = useState('');
    const [sortField, setSortField] = useState(null);
    const [sortDirection, setSortDirection] = useState('asc');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isGeneratingAll, setIsGeneratingAll] = useState(false);
    const [generateAllProgress, setGenerateAllProgress] = useState({ current: 0, total: 0 });

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

    // Get unique case IDs from the data (memoized for stability)
    const getUniqueCaseIds = useMemo(() => {
        return () => {
            if (!dataStatus.processedData || dataStatus.processedData.length === 0) {
                return [];
            }

            const caseIdCounts = {};

            // Count occurrences of each local case ID
            dataStatus.processedData.forEach((row) => {
                const localCaseId = row.BDSA?.bdsaLocal?.localCaseId;
                if (localCaseId) {
                    caseIdCounts[localCaseId] = (caseIdCounts[localCaseId] || 0) + 1;
                }
            });

            // Read case ID mappings directly from the data items (single source of truth)
            const caseIdMappings = new Map();
            dataStatus.processedData?.forEach((item) => {
                const localCaseId = item.BDSA?.bdsaLocal?.localCaseId;
                const bdsaCaseId = item.BDSA?.bdsaLocal?.bdsaCaseId;
                if (localCaseId) {
                    // Only set mapping if BDSA Case ID exists, otherwise leave as undefined
                    if (bdsaCaseId) {
                        // console.log(`🔍 Mapping: localCaseId="${localCaseId}" → bdsaCaseId="${bdsaCaseId}"`);
                        caseIdMappings.set(localCaseId, bdsaCaseId);
                    }
                }
            });

            const allCases = Object.entries(caseIdCounts)
                .map(([caseId, count]) => ({
                    localCaseId: caseId,
                    rowCount: count,
                    bdsaCaseId: caseIdMappings.get(caseId) || null,
                    isMapped: Boolean(caseIdMappings.get(caseId))
                }));

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
    }, [dataStatus.processedData, sortField, sortDirection]);

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

        return filtered;
    }, [dataStatus.processedData, dataStatus.caseIdMappings, temporaryHideMapped, showOnlyDuplicates, duplicateBdsaCaseIds, sortField, sortDirection, caseIdFilter]);

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
    }, [dataStatus.processedData, dataStatus.caseIdConflicts, dataStatus.bdsaCaseIdConflicts]);

    // Generate sequential BDSA Case ID (alias for generateCaseId)
    const generateCaseId = (localCaseId) => {
        generateSequentialBdsaCaseId(localCaseId);
    };

    // Generate sequential BDSA Case ID
    const generateSequentialBdsaCaseId = (localCaseId) => {
        console.log(`🚀 Generate button clicked for localCaseId: ${localCaseId}`);

        if (!localCaseId) {
            console.log('❌ No localCaseId provided');
            return;
        }

        if (!bdsaInstitutionId || bdsaInstitutionId.trim() === '') {
            console.log('❌ No BDSA Institution ID set');
            alert('Please set the BDSA Institution ID first. You can:\n1. Pull data from DSA to auto-set it\n2. Enter it manually in the Institution ID field');
            return;
        }

        console.log(`✅ BDSA Institution ID: ${bdsaInstitutionId}`);

        // Check if this case already has a BDSA Case ID by looking at the data
        const existingCase = dataStatus.processedData?.find(row =>
            row.BDSA?.bdsaLocal?.localCaseId === localCaseId &&
            row.BDSA?.bdsaLocal?.bdsaCaseId
        );

        if (existingCase) {
            console.log(`⚠️ Case ${localCaseId} already has BDSA Case ID: ${existingCase.BDSA.bdsaLocal.bdsaCaseId}`);
            return;
        }

        console.log(`🔄 Starting generation for case ${localCaseId}...`);
        setIsGenerating(true);

        try {
            // Get next sequential number from existing BDSA Case IDs in the data
            const existingNumbers = [];
            dataStatus.processedData?.forEach(row => {
                const bdsaCaseId = row.BDSA?.bdsaLocal?.bdsaCaseId;
                if (bdsaCaseId && bdsaCaseId.startsWith(`BDSA-${bdsaInstitutionId.padStart(3, '0')}-`)) {
                    const match = bdsaCaseId.match(/BDSA-\d{3}-(\d{4})/);
                    if (match) {
                        existingNumbers.push(parseInt(match[1], 10));
                    }
                }
            });

            const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
            const nextNumber = maxNumber + 1;
            const bdsaCaseId = `BDSA-${bdsaInstitutionId.padStart(3, '0')}-${nextNumber.toString().padStart(4, '0')}`;

            console.log(`🎯 Generated BDSA Case ID: ${bdsaCaseId} (next number: ${nextNumber})`);

            // Set the case ID directly in the data items (single source of truth)
            console.log(`📝 Calling setCaseIdInData(${localCaseId}, ${bdsaCaseId})`);
            setCaseIdInData(localCaseId, bdsaCaseId);
            console.log(`🔄 Calling resetTemporaryFilter()`);
            resetTemporaryFilter(); // Show the newly generated item
            console.log(`✅ Generation complete for case ${localCaseId}`);

        } finally {
            setTimeout(() => setIsGenerating(false), 500);
        }
    };

    // Update case ID mapping
    const updateCaseIdMapping = (localCaseId, bdsaCaseId) => {
        const trimmedValue = bdsaCaseId ? bdsaCaseId.trim() : '';

        if (trimmedValue) {
            // Set the case ID directly in the data items
            setCaseIdInData(localCaseId, trimmedValue);
        } else {
            // Clear the case ID by setting it to null
            setCaseIdInData(localCaseId, null);
        }
    };

    // Generate all unmapped case IDs
    const generateAllCaseIds = async () => {
        if (!bdsaInstitutionId || bdsaInstitutionId.trim() === '') {
            alert('Please set the BDSA Institution ID first. You can:\n1. Pull data from DSA to auto-set it\n2. Enter it manually in the Institution ID field');
            return;
        }

        const unmappedCases = filteredCaseIds.filter(caseData => !caseData.isMapped);
        if (unmappedCases.length === 0) {
            return;
        }

        setIsGeneratingAll(true);
        setGenerateAllProgress({ current: 0, total: unmappedCases.length });

        try {
            // Get all mappings at once to avoid race conditions
            const caseIdMappings = dataStatus.caseIdMappings || {};
            const newMappings = { ...caseIdMappings };

            // Generate all BDSA Case IDs without individual updates
            for (let i = 0; i < unmappedCases.length; i++) {
                const caseData = unmappedCases[i];
                const localCaseId = caseData.localCaseId;

                // Check if this case already has a BDSA Case ID
                if (!newMappings[localCaseId]) {
                    // Get next sequential number from the current mappings
                    const existingNumbers = Object.values(newMappings)
                        .filter(id => id && id.startsWith(`BDSA-${bdsaInstitutionId.padStart(3, '0')}-`))
                        .map(id => {
                            const match = id.match(/BDSA-\d{3}-(\d{4})/);
                            return match ? parseInt(match[1], 10) : 0;
                        });

                    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
                    const nextNumber = maxNumber + 1;
                    const bdsaCaseId = `BDSA-${bdsaInstitutionId.padStart(3, '0')}-${nextNumber.toString().padStart(4, '0')}`;

                    // Add to the batch
                    newMappings[localCaseId] = bdsaCaseId;
                }

                setGenerateAllProgress({ current: i + 1, total: unmappedCases.length });
            }

            // Update all mappings at once
            dataStore.updateCaseIdMappings(newMappings);
            resetTemporaryFilter(); // Show all newly generated items

        } finally {
            setIsGeneratingAll(false);
            setGenerateAllProgress({ current: 0, total: 0 });
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
                token: dsaAuthStore.token
            };

            // Get current case ID mappings
            const caseIdMappings = dataStatus.caseIdMappings || {};

            if (Object.keys(caseIdMappings).length === 0) {
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
                token: dsaAuthStore.token
            };

            // Confirm before overwriting local mappings
            const confirmMessage = 'This will overwrite your local case ID mappings with the versions from the DSA server. Continue?';
            if (!window.confirm(confirmMessage)) {
                return;
            }

            // Pull case ID mappings from DSA
            const result = await protocolStore.pullFromDSA(dsaConfig);

            if (result.success) {
                if (result.caseIdMappings && result.caseIdMappings.mappings) {
                    // Convert the pulled mappings to the local format
                    const newMappings = {};
                    let extractedInstitutionId = null;

                    result.caseIdMappings.mappings.forEach(mapping => {
                        newMappings[mapping.localCaseId] = mapping.bdsaCaseId;

                        // Extract institution ID from BDSA Case ID if not already set
                        if (!extractedInstitutionId && mapping.bdsaCaseId) {
                            const match = mapping.bdsaCaseId.match(/BDSA-(\d{3})-/);
                            if (match) {
                                extractedInstitutionId = match[1];
                            }
                        }
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
                    Region Protocol Mapping
                </button>
            </div>

            {/* Case ID Mapping Content */}
            {activeSubTab === 'case-id-mapping' && (
                <CaseIdMappingSection
                    bdsaInstitutionId={bdsaInstitutionId}
                    setBdsaInstitutionId={setBdsaInstitutionId}
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
