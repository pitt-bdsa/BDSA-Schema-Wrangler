import React, { useState, useEffect, useMemo } from 'react';
import './CaseManagementTab.css';
import dataStore, { setCaseIdInData, generateUnmappedCases } from '../utils/dataStore';
import protocolStore from '../utils/protocolStore';
import dsaAuthStore from '../utils/dsaAuthStore';
import ProtocolMapping from './ProtocolMapping';
import CaseStatsPanel from './CaseStatsPanel';
import CaseIdMappingSection from './CaseIdMappingSection';

const CaseManagementTab = () => {
    const [activeSubTab, setActiveSubTab] = useState('case-id-mapping');
    const [dataStatus, setDataStatus] = useState(dataStore.getStatus());
    const [bdsaInstitutionId, setBdsaInstitutionId] = useState('001');
    const [temporaryHideMapped, setTemporaryHideMapped] = useState(false);
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
            if (newStatus.processedData && newStatus.processedData.length > 0) {
                dataStore.initializeCaseIdMappingsFromData();
            }
        });

        return unsubscribe;
    }, []); // Only run once on mount

    // Reset the temporary filter when new items are generated
    const resetTemporaryFilter = () => {
        if (temporaryHideMapped) {
            setTemporaryHideMapped(false);
        }
    };

    // Protocol mapping functions are now handled by the ProtocolMapping component

    // Get unique case IDs from the data
    const getUniqueCaseIds = () => {
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

        // Only apply sorting if a sort field is explicitly set
        if (sortField) {
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
        }

        return allCases;
    };

    // Filter cases based on mapped status
    const filteredCaseIds = useMemo(() => {
        const allCases = getUniqueCaseIds();
        if (temporaryHideMapped) {
            return allCases.filter(caseData => !caseData.isMapped);
        }
        return allCases;
    }, [dataStatus.processedData, dataStatus.caseIdMappings, temporaryHideMapped, sortField, sortDirection]);

    // Detect duplicate BDSA Case IDs
    const duplicateBdsaCaseIds = useMemo(() => {
        const bdsaCaseIdCounts = new Map();

        filteredCaseIds.forEach(caseData => {
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
    }, [filteredCaseIds]);

    // Get statistics
    const stats = useMemo(() => {
        const allCases = getUniqueCaseIds();
        const unmappedSlides = dataStatus.processedData?.filter(row =>
            !row.BDSA?.bdsaLocal?.localCaseId ||
            !row.BDSA?.bdsaLocal?.bdsaCaseId
        ).length || 0;

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

        return {
            unmappedSlides,
            mappedCases,
            bdsaCaseIds: bdsaCaseIds.size,
            localCaseIdConflicts,
            bdsaCaseIdConflicts,
            localConflictCount,
            bdsaConflictCount
        };
    }, [dataStatus.processedData]);

    // Generate sequential BDSA Case ID (alias for generateCaseId)
    const generateCaseId = (localCaseId) => {
        generateSequentialBdsaCaseId(localCaseId);
    };

    // Generate sequential BDSA Case ID
    const generateSequentialBdsaCaseId = (localCaseId) => {
        if (!localCaseId || !bdsaInstitutionId) {
            return;
        }

        // Check if this case already has a BDSA Case ID by looking at the data
        const existingCase = dataStatus.processedData?.find(row =>
            row.BDSA?.bdsaLocal?.localCaseId === localCaseId &&
            row.BDSA?.bdsaLocal?.bdsaCaseId
        );

        if (existingCase) {
            return;
        }

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

            // Set the case ID directly in the data items (single source of truth)
            setCaseIdInData(localCaseId, bdsaCaseId);
            resetTemporaryFilter(); // Show the newly generated item

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
                token: authStatus.token
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
                token: authStatus.token
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
                    result.caseIdMappings.mappings.forEach(mapping => {
                        newMappings[mapping.localCaseId] = mapping.bdsaCaseId;
                    });

                    // Update local case ID mappings
                    dataStore.updateCaseIdMappings(newMappings);

                    alert(`Case ID mappings pulled successfully!\n\nPulled ${result.pulled.caseIdMappings} case ID mappings from DSA server.`);
                } else {
                    alert('No case ID mappings found in DSA server.');
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
                    className={`sub-tab-btn ${activeSubTab === 'protocol-mapping' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('protocol-mapping')}
                >
                    Protocol Mapping
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

            {/* Protocol Mapping Content */}
            {activeSubTab === 'protocol-mapping' && (
                <ProtocolMapping />
            )}
        </div>
    );
};

export default CaseManagementTab;
