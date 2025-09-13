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

    // Protocol mapping state
    const [unmappedCases, setUnmappedCases] = useState([]);
    const [selectedCase, setSelectedCase] = useState(null);
    const [showUnmappedOnly, setShowUnmappedOnly] = useState(true);
    const [hideMappedProtocols, setHideMappedProtocols] = useState(false);
    const [expandedStainGroups, setExpandedStainGroups] = useState(new Set());
    const [expandedRegionGroups, setExpandedRegionGroups] = useState(new Set());
    const [selectedSlides, setSelectedSlides] = useState(new Set());
    const [protocolUpdateCounter, setProtocolUpdateCounter] = useState(0);
    const [dataStatus, setDataStatus] = useState(dataStore.getStatus());
    const [bdsaInstitutionId, setBdsaInstitutionId] = useState('001');
    const [temporaryHideMapped, setTemporaryHideMapped] = useState(false);
    const [showMappedCases, setShowMappedCases] = useState(true);
    const [sortField, setSortField] = useState(null); // Start with no sorting
    const [sortDirection, setSortDirection] = useState('asc');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isGeneratingAll, setIsGeneratingAll] = useState(false);
    const [generateAllProgress, setGenerateAllProgress] = useState({ current: 0, total: 0 });
    const [forceUpdate, setForceUpdate] = useState(0);

    // Subscribe to data store updates
    useEffect(() => {
        const unsubscribe = dataStore.subscribe(() => {
            console.log('🔔 Data store notification received, updating component state');
            setDataStatus(dataStore.getStatus());
        });
        return unsubscribe;
    }, []);

    // Initialize case ID mappings from existing data when data is loaded
    useEffect(() => {
        if (dataStatus.processedData && dataStatus.processedData.length > 0) {
            dataStore.initializeCaseIdMappingsFromData();
        }
    }, [dataStatus.processedData]);

    // Generate unmapped cases when data changes
    useEffect(() => {
        if (dataStatus.processedData && dataStatus.processedData.length > 0) {
            console.log('🔍 Generating unmapped cases with data:', {
                processedDataLength: dataStatus.processedData.length,
                columnMappings: dataStatus.columnMappings,
                caseIdMappings: Object.keys(dataStatus.caseIdMappings || {}).length,
                caseProtocolMappings: dataStatus.caseProtocolMappings?.length || 0,
                protocolUpdateCounter: protocolUpdateCounter
            });
            const newUnmappedCases = generateUnmappedCases();
            console.log('🔍 Generated unmapped cases:', newUnmappedCases.length);
            setUnmappedCases(newUnmappedCases);
        }
    }, [dataStatus.processedData, dataStatus.caseIdMappings, dataStatus.caseProtocolMappings, dataStatus.columnMappings]);

    // Force update when case ID mappings change (since updateCaseIdMappings doesn't notify)
    const forceCaseIdMappingsUpdate = () => {
        setForceUpdate(prev => prev + 1);
        setDataStatus(dataStore.getStatus());
    };

    // Reset the temporary filter when new items are generated
    const resetTemporaryFilter = () => {
        if (temporaryHideMapped) {
            setTemporaryHideMapped(false);
        }
    };

    // Protocol mapping helper functions
    const getGroupedSlides = (slides) => {
        // Get fresh protocol mappings from dataStore
        const freshDataStatus = dataStore.getStatus();
        const caseProtocolMappings = freshDataStatus.caseProtocolMappings;

        console.log('🔧 getGroupedSlides called with fresh data:', {
            selectedCase: selectedCase?.bdsaId,
            caseProtocolMappings: caseProtocolMappings?.length || 0,
            slidesCount: slides.length,
            caseProtocolMappingsKeys: Object.keys(caseProtocolMappings || {}),
            selectedCaseProtocols: caseProtocolMappings?.[selectedCase?.bdsaId] || 'NOT FOUND'
        });

        const grouped = {};
        slides.forEach(slide => {
            const stainType = slide.stainType;
            if (!grouped[stainType]) {
                grouped[stainType] = {
                    stainType: stainType,
                    slides: [],
                    count: 0,
                    status: 'unmapped'
                };
            }
            grouped[stainType].slides.push(slide);
            grouped[stainType].count++;

            // If any slide in the group is mapped, mark the group as mapped
            if (slide.status === 'mapped') {
                grouped[stainType].status = 'mapped';
            }
        });

        // Double-check the status by looking at actual protocol mappings
        Object.values(grouped).forEach(group => {
            const anySlidesMapped = group.slides.some(slide => {
                const slideProtocols = caseProtocolMappings[selectedCase?.bdsaId]?.[slide.id] || { stain: [], region: [] };
                const hasStainProtocols = (slideProtocols.stain || []).length > 0;

                // Debug individual slide protocol lookup
                if (group.stainType === '4G8' && slide === group.slides[0]) {
                    console.log('🔧 Debug slide protocol lookup:', {
                        slideId: slide.id,
                        selectedCase: selectedCase?.bdsaId,
                        slideProtocols,
                        hasStainProtocols,
                        caseProtocolMappingsForCase: caseProtocolMappings[selectedCase?.bdsaId]
                    });
                }

                return hasStainProtocols;
            });

            const allSlidesMapped = group.slides.every(slide => {
                const slideProtocols = caseProtocolMappings[selectedCase?.bdsaId]?.[slide.id] || { stain: [], region: [] };
                const hasStainProtocols = (slideProtocols.stain || []).length > 0;
                return hasStainProtocols;
            });

            // Set group status based on whether ALL slides are mapped
            if (allSlidesMapped) {
                group.status = 'mapped';
            } else if (anySlidesMapped) {
                group.status = 'partially-mapped'; // New status for mixed groups
            } else {
                group.status = 'unmapped';
            }

            console.log(`🔧 Group ${group.stainType} status:`, {
                status: group.status,
                anySlidesMapped,
                allSlidesMapped,
                slidesCount: group.slides.length
            });
        });

        return Object.values(grouped);
    };

    const toggleStainGroupExpansion = (stainType) => {
        const newExpanded = new Set(expandedStainGroups);
        if (newExpanded.has(stainType)) {
            newExpanded.delete(stainType);
        } else {
            newExpanded.add(stainType);
        }
        setExpandedStainGroups(newExpanded);
    };

    const toggleSlideSelection = (slideId) => {
        const newSelected = new Set(selectedSlides);
        if (newSelected.has(slideId)) {
            newSelected.delete(slideId);
        } else {
            newSelected.add(slideId);
        }
        setSelectedSlides(newSelected);
    };

    const selectAllSlidesInGroup = (group) => {
        const newSelected = new Set(selectedSlides);
        group.slides.forEach(slide => newSelected.add(slide.id));
        setSelectedSlides(newSelected);
    };

    const deselectAllSlidesInGroup = (group) => {
        const newSelected = new Set(selectedSlides);
        group.slides.forEach(slide => newSelected.delete(slide.id));
        setSelectedSlides(newSelected);
    };

    const getSelectedSlidesInGroup = (group) => {
        return group.slides.filter(slide => selectedSlides.has(slide.id));
    };

    const handleProtocolMapping = (slides, protocolId) => {
        if (!selectedCase) return;

        console.log('🔧 Applying protocol mapping:', {
            protocolId,
            slidesCount: slides.length,
            selectedCase: selectedCase.bdsaId,
            slides: slides.map(s => ({ id: s.id, filename: s.filename, stainType: s.stainType }))
        });

        // Determine which slides to operate on
        const isExpanded = expandedStainGroups.has(slides[0]?.stainType);
        const selectedSlidesInGroup = isExpanded ? getSelectedSlidesInGroup({ slides }) : [];
        const slidesToOperateOn = isExpanded && selectedSlidesInGroup.length > 0 ? selectedSlidesInGroup : slides;

        // Apply protocol to selected slides - this will trigger dataStore.notify()
        slidesToOperateOn.forEach(slide => {
            console.log('🔧 Adding protocol mapping:', {
                bdsaCaseId: selectedCase.bdsaId,
                slideId: slide.id,
                protocolId,
                protocolType: 'stain'
            });
            dataStore.addProtocolMapping(selectedCase.bdsaId, slide.id, protocolId, 'stain');
        });

        console.log('🔧 Protocol mapping applied, dataStore should notify subscribers');
    };

    const handleRemoveProtocolMapping = (slideId, protocolId, protocolType) => {
        if (!selectedCase) return;

        // Remove protocol from the specific slide - this will trigger dataStore.notify()
        dataStore.removeProtocolMapping(selectedCase.bdsaId, slideId, protocolId, protocolType);
    };

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
            if (localCaseId && bdsaCaseId) {
                caseIdMappings.set(localCaseId, bdsaCaseId);
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
            forceCaseIdMappingsUpdate();
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

        forceCaseIdMappingsUpdate();
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
            forceCaseIdMappingsUpdate();
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
        forceCaseIdMappingsUpdate();
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
                    forceCaseIdMappingsUpdate();

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
                    setShowMappedCases={setShowMappedCases}
                    clearDuplicates={clearDuplicates}
                    isGeneratingAll={isGeneratingAll}
                    generateAllProgress={generateAllProgress}
                    stats={stats}
                    forceCaseIdMappingsUpdate={forceCaseIdMappingsUpdate}
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
