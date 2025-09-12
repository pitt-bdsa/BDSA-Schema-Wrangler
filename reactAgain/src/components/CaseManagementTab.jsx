import React, { useState, useEffect, useMemo } from 'react';
import './CaseManagementTab.css';
import dataStore, { setCaseIdInData, generateUnmappedCases } from '../utils/dataStore';
import protocolStore from '../utils/protocolStore';
import dsaAuthStore from '../utils/dsaAuthStore';

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
    const [sortField, setSortField] = useState(null); // Start with no sorting
    const [sortDirection, setSortDirection] = useState('asc');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isGeneratingAll, setIsGeneratingAll] = useState(false);
    const [generateAllProgress, setGenerateAllProgress] = useState({ current: 0, total: 0 });
    const [forceUpdate, setForceUpdate] = useState(0);

    // Subscribe to data store updates
    useEffect(() => {
        const unsubscribe = dataStore.subscribe(() => {
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
            const newUnmappedCases = generateUnmappedCases();
            setUnmappedCases(newUnmappedCases);
        }
    }, [dataStatus.processedData, dataStatus.caseIdMappings, dataStatus.caseProtocolMappings]);

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
            const allSlidesMapped = group.slides.every(slide => {
                const slideProtocols = dataStatus.caseProtocolMappings[selectedCase?.bdsaId]?.[slide.id] || { stain: [], region: [] };
                const hasStainProtocols = (slideProtocols.stain || []).length > 0;
                return hasStainProtocols;
            });

            if (allSlidesMapped) {
                group.status = 'mapped';
            }
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

        // Determine which slides to operate on
        const isExpanded = expandedStainGroups.has(slides[0]?.stainType);
        const selectedSlidesInGroup = isExpanded ? getSelectedSlidesInGroup({ slides }) : [];
        const slidesToOperateOn = isExpanded && selectedSlidesInGroup.length > 0 ? selectedSlidesInGroup : slides;

        // Apply protocol to selected slides
        slidesToOperateOn.forEach(slide => {
            dataStore.addProtocolMapping(selectedCase.bdsaId, slide.id, protocolId, 'stain');
        });

        // Update the protocol counter to trigger re-render
        setProtocolUpdateCounter(prev => prev + 1);

        // Refresh unmapped cases
        const newUnmappedCases = generateUnmappedCases();
        setUnmappedCases(newUnmappedCases);
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
            <div className="case-stats">
                <div className="stat-item">
                    <span className="stat-number">{stats.unmappedSlides}</span>
                    <span className="stat-label">Unmapped Slides</span>
                </div>
                <div className="stat-item">
                    <span className="stat-number">{stats.mappedCases}</span>
                    <span className="stat-label">Mapped Cases</span>
                </div>
                <div className="stat-item">
                    <span className="stat-number">{stats.bdsaCaseIds}</span>
                    <span className="stat-label">BDSA Case IDs</span>
                </div>
                {stats.localConflictCount > 0 && (
                    <div className="stat-item conflict-stat">
                        <span className="stat-number conflict">{stats.localConflictCount}</span>
                        <span className="stat-label">Local Case ID Conflicts</span>
                    </div>
                )}
                {stats.bdsaConflictCount > 0 && (
                    <div className="stat-item conflict-stat">
                        <span className="stat-number conflict">{stats.bdsaConflictCount}</span>
                        <span className="stat-label">BDSA Case ID Conflicts</span>
                    </div>
                )}
            </div>

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
                <div className="case-id-mapping-content">
                    {/* Mapping Settings */}
                    <div className="mapping-settings">
                        <div className="setting-group">
                            <label htmlFor="institution-id">BDSA Institution ID:</label>
                            <input
                                id="institution-id"
                                type="text"
                                value={bdsaInstitutionId}
                                onChange={(e) => setBdsaInstitutionId(e.target.value)}
                                className="institution-id-input"
                                placeholder="001"
                            />
                            <small>Used for generating BDSA Case IDs (e.g., BDSA-001-0001)</small>
                        </div>
                        <div className="setting-group">
                            <label>Data Source Column:</label>
                            <div className="data-source-info">
                                <span className="data-source-text">
                                    Showing unique case IDs from column: BDSA.bdsaLocal.localCaseId
                                </span>
                                <br />
                                <span className="total-cases-text">
                                    Total unique cases: {filteredCaseIds.length}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Duplicate Warning */}
                    {duplicateBdsaCaseIds.size > 0 && (
                        <div className="duplicate-warning">
                            <div className="warning-header">
                                <span className="warning-icon">⚠️</span>
                                <span className="warning-text">
                                    Warning: {duplicateBdsaCaseIds.size} duplicate BDSA Case IDs detected!
                                </span>
                            </div>
                            <div className="warning-actions">
                                <button className="view-duplicates-btn" onClick={() => setShowMappedCases(true)}>
                                    View duplicates ({duplicateBdsaCaseIds.size})
                                </button>
                                <button className="clear-duplicates-btn" onClick={clearDuplicates}>
                                    🗑️ Clear Duplicates ({duplicateBdsaCaseIds.size})
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Bulk Generation Progress */}
                    {isGeneratingAll && (
                        <div className="bulk-generation-progress">
                            <div className="progress-info">
                                <span>Generating BDSA Case IDs...</span>
                                <span>{generateAllProgress.current} of {generateAllProgress.total}</span>
                            </div>
                            <div className="progress-bar">
                                <div
                                    className="progress-fill"
                                    style={{ width: `${(generateAllProgress.current / generateAllProgress.total) * 100}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Conflict Resolution Section */}
                    {(stats.localConflictCount > 0 || stats.bdsaConflictCount > 0) && (
                        <div className="conflict-resolution-section">
                            <h3>⚠️ Conflict Resolution Required</h3>

                            {/* Local Case ID Conflicts */}
                            {stats.localConflictCount > 0 && (
                                <div className="conflict-group">
                                    <h4>Local Case ID Conflicts ({stats.localConflictCount})</h4>
                                    <p>Same local case ID mapped to multiple BDSA Case IDs:</p>
                                    <div className="conflict-list">
                                        {Object.entries(stats.localCaseIdConflicts).map(([localCaseId, bdsaCaseIds]) => (
                                            <div key={localCaseId} className="conflict-item">
                                                <div className="conflict-header">
                                                    <strong>{localCaseId}</strong>
                                                    <span className="conflict-count">→ {bdsaCaseIds.length} BDSA IDs</span>
                                                </div>
                                                <div className="conflict-options">
                                                    {bdsaCaseIds.map((bdsaCaseId) => (
                                                        <button
                                                            key={bdsaCaseId}
                                                            className="resolve-conflict-btn"
                                                            onClick={() => {
                                                                dataStore.resolveCaseIdConflict(localCaseId, bdsaCaseId);
                                                                forceCaseIdMappingsUpdate();
                                                            }}
                                                        >
                                                            Keep: {bdsaCaseId}
                                                        </button>
                                                    ))}
                                                    <button
                                                        className="clear-conflict-btn"
                                                        onClick={() => {
                                                            dataStore.clearCaseIdConflict(localCaseId);
                                                            forceCaseIdMappingsUpdate();
                                                        }}
                                                    >
                                                        Clear All
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* BDSA Case ID Conflicts */}
                            {stats.bdsaConflictCount > 0 && (
                                <div className="conflict-group">
                                    <h4>BDSA Case ID Conflicts ({stats.bdsaConflictCount})</h4>
                                    <p>Same BDSA Case ID mapped to multiple local case IDs:</p>
                                    <div className="conflict-list">
                                        {Object.entries(stats.bdsaCaseIdConflicts).map(([bdsaCaseId, localCaseIds]) => (
                                            <div key={bdsaCaseId} className="conflict-item">
                                                <div className="conflict-header">
                                                    <strong>{bdsaCaseId}</strong>
                                                    <span className="conflict-count">← {localCaseIds.length} Local IDs</span>
                                                </div>
                                                <div className="conflict-options">
                                                    {localCaseIds.map((localCaseId) => (
                                                        <button
                                                            key={localCaseId}
                                                            className="resolve-conflict-btn"
                                                            onClick={() => {
                                                                dataStore.resolveBdsaCaseIdConflict(bdsaCaseId, localCaseId);
                                                                forceCaseIdMappingsUpdate();
                                                            }}
                                                        >
                                                            Keep: {localCaseId}
                                                        </button>
                                                    ))}
                                                    <button
                                                        className="clear-conflict-btn"
                                                        onClick={() => {
                                                            dataStore.clearBdsaCaseIdConflict(bdsaCaseId);
                                                            forceCaseIdMappingsUpdate();
                                                        }}
                                                    >
                                                        Clear All
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Case ID Table */}
                    <div className="case-id-mapping-table">
                        <div className="mapping-summary">
                            <div className="summary-info">
                                <p>
                                    Showing unique case IDs from column: BDSA.bdsaLocal.localCaseId
                                </p>
                                <p>Total unique cases: {filteredCaseIds.length}</p>
                            </div>
                            <div className="mapping-controls">
                                <button
                                    className={`toggle-mapped-btn ${temporaryHideMapped ? 'active' : ''}`}
                                    onClick={() => setTemporaryHideMapped(!temporaryHideMapped)}
                                >
                                    👤 {temporaryHideMapped ? 'Show All' : 'Hide Mapped'}
                                </button>
                                <button
                                    className="generate-all-btn"
                                    onClick={generateAllCaseIds}
                                    disabled={isGeneratingAll || filteredCaseIds.filter(c => !c.isMapped).length === 0}
                                >
                                    🚀 Generate All
                                </button>
                                <button
                                    className="dsa-sync-btn"
                                    onClick={handleSyncCaseIdMappingsToDSA}
                                    title="Push case ID mappings to DSA server"
                                >
                                    🔄 Push to DSA
                                </button>
                                <button
                                    className="dsa-sync-btn"
                                    onClick={handlePullCaseIdMappingsFromDSA}
                                    title="Pull case ID mappings from DSA server"
                                >
                                    ⬇️ Pull from DSA
                                </button>
                            </div>
                        </div>

                        <div className="table-container">
                            <table className="case-id-table">
                                <thead>
                                    <tr>
                                        <th
                                            className="sortable-header"
                                            onClick={() => handleSort('localCaseId')}
                                        >
                                            Local Case ID {getSortIcon('localCaseId')}
                                        </th>
                                        <th
                                            className="sortable-header"
                                            onClick={() => handleSort('rowCount')}
                                        >
                                            Row Count {getSortIcon('rowCount')}
                                        </th>
                                        <th
                                            className="sortable-header"
                                            onClick={() => handleSort('bdsaCaseId')}
                                        >
                                            BDSA Case ID {getSortIcon('bdsaCaseId')}
                                        </th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredCaseIds.map((caseData) => (
                                        <tr
                                            key={caseData.localCaseId}
                                            className={duplicateBdsaCaseIds.has(caseData.bdsaCaseId) ? 'duplicate-bdsa-case' : ''}
                                        >
                                            <td className="mapped-case-id">
                                                {caseData.localCaseId}
                                            </td>
                                            <td>{caseData.rowCount}</td>
                                            <td>
                                                <input
                                                    type="text"
                                                    value={caseData.bdsaCaseId || ''}
                                                    onChange={(e) => updateCaseIdMapping(caseData.localCaseId, e.target.value)}
                                                    className="bdsa-case-id-input"
                                                    placeholder="BDSA-001-0001"
                                                />
                                            </td>
                                            <td>
                                                <button
                                                    className="generate-bdsa-id-btn"
                                                    onClick={() => generateSequentialBdsaCaseId(caseData.localCaseId)}
                                                    disabled={isGenerating || caseData.isMapped}
                                                >
                                                    {isGenerating ? 'Generating...' : 'Generate'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Protocol Mapping Content */}
            {activeSubTab === 'protocol-mapping' && (
                <div className="protocol-mapping-content">
                    <div className="cases-panel">
                        <h3>Select BDSA Case</h3>
                        {!dataStatus.columnMappings?.localStainID ? (
                            <div className="no-stain-id-configured">
                                <p>Please configure the Local Stain ID column in the BDSA Settings tab to view unmapped cases.</p>
                            </div>
                        ) : unmappedCases.length === 0 ? (
                            <div className="no-unmapped-cases">
                                <p>No BDSA cases with unmapped stain protocols found.</p>
                                <small>Make sure you have:</small>
                                <ul>
                                    <li>BDSA case IDs mapped in the Case ID Mapping tab</li>
                                    <li>Local stain IDs configured in BDSA Settings</li>
                                    <li>Stain protocols defined in the Protocols tab</li>
                                </ul>
                            </div>
                        ) : (
                            <div className="case-selection">
                                <div className="case-selection-controls">
                                    <label>Choose a BDSA Case:</label>
                                    <select
                                        value={selectedCase?.bdsaId || ''}
                                        onChange={(e) => {
                                            const selectedBdsaId = e.target.value;
                                            const caseData = unmappedCases.find(c => c.bdsaId === selectedBdsaId);
                                            setSelectedCase(caseData || null);
                                        }}
                                        className="case-select-dropdown"
                                    >
                                        <option value="">-- Select BDSA Case --</option>
                                        {unmappedCases.map(caseData => (
                                            <option key={caseData.bdsaId} value={caseData.bdsaId}>
                                                {caseData.bdsaId} ({caseData.slides.filter(s => s.status === 'unmapped').length} unmapped)
                                            </option>
                                        ))}
                                    </select>

                                    <div className="filter-control">
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={showUnmappedOnly}
                                                onChange={(e) => setShowUnmappedOnly(e.target.checked)}
                                            />
                                            <span>Show only cases with unmapped slides</span>
                                        </label>
                                    </div>
                                </div>

                                {selectedCase && (
                                    <div className="selected-case-summary">
                                        <h4>Selected: {selectedCase.bdsaId}</h4>
                                        <p>Local Case ID: {selectedCase.localCaseId}</p>
                                        <div className="case-slides">
                                            {getGroupedSlides(selectedCase.slides).map((group, index) => (
                                                <span
                                                    key={`${group.stainType}-${index}`}
                                                    className={`slide-badge ${group.status}`}
                                                >
                                                    {group.stainType}
                                                    {group.count > 1 && <span className="slide-count-badge">×{group.count}</span>}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="mapping-panel">
                        {selectedCase ? (
                            <div className="selected-case">
                                <div className="case-header-with-actions">
                                    <h3>Mapping Protocols for {selectedCase.bdsaId}</h3>
                                    <div className="action-buttons">
                                        <button
                                            type="button"
                                            className={`hide-mapped-btn ${hideMappedProtocols ? 'active' : ''}`}
                                            onClick={() => setHideMappedProtocols(!hideMappedProtocols)}
                                            title={hideMappedProtocols ? 'Show all protocols' : 'Hide mapped protocols'}
                                        >
                                            {hideMappedProtocols ? '👁️ Show All' : '🙈 Hide Mapped'}
                                        </button>
                                    </div>
                                </div>
                                <div className="slides-mapping">
                                    {getGroupedSlides(selectedCase.slides).map((group, groupIndex) => (
                                        <div key={`${group.stainType}-${groupIndex}`} className="slide-mapping">
                                            <div className="slide-info">
                                                <div className="slide-header">
                                                    <span className="slide-id">
                                                        {group.stainType} ({group.count} slides)
                                                    </span>
                                                    {group.count > 1 && (
                                                        <button
                                                            type="button"
                                                            className="expand-toggle-btn"
                                                            onClick={() => toggleStainGroupExpansion(group.stainType)}
                                                            title={expandedStainGroups.has(group.stainType) ? 'Collapse individual slides' : 'Show individual slides'}
                                                        >
                                                            {expandedStainGroups.has(group.stainType) ? '▼' : '▶'}
                                                        </button>
                                                    )}
                                                </div>
                                                <span className="stain-type">{group.stainType}</span>
                                                <span className={`status ${group.status}`}>
                                                    {group.status === 'mapped' ? '✓ Mapped' : '⏳ Unmapped'}
                                                </span>
                                            </div>

                                            {/* Individual slides when expanded */}
                                            {expandedStainGroups.has(group.stainType) && group.slides.length > 1 && (
                                                <div className="individual-slides">
                                                    <div className="individual-slides-header">
                                                        <div className="selection-controls">
                                                            <button
                                                                type="button"
                                                                className="select-all-btn"
                                                                onClick={() => selectAllSlidesInGroup(group)}
                                                            >
                                                                Select All
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="deselect-all-btn"
                                                                onClick={() => deselectAllSlidesInGroup(group)}
                                                            >
                                                                Deselect All
                                                            </button>
                                                        </div>
                                                        <span className="selected-count">
                                                            {getSelectedSlidesInGroup(group).length} of {group.slides.length} selected
                                                        </span>
                                                    </div>
                                                    {group.slides.map(slide => (
                                                        <div key={slide.id} className="individual-slide">
                                                            <label className="slide-checkbox">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedSlides.has(slide.id)}
                                                                    onChange={() => toggleSlideSelection(slide.id)}
                                                                />
                                                                <span className="slide-detail-id">{slide.filename || slide.localStainId}</span>
                                                            </label>
                                                            <span className={`slide-detail-status ${slide.status}`}>
                                                                {slide.status === 'mapped' ? '✓' : '⏳'}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Protocol selection for unmapped groups */}
                                            {group.status === 'unmapped' && (
                                                <div className="protocol-selection">
                                                    <div className="protocol-buttons">
                                                        {protocolStore.stainProtocols.map(protocol => (
                                                            <button
                                                                key={protocol.id}
                                                                type="button"
                                                                className="protocol-btn"
                                                                onClick={() => handleProtocolMapping(group.slides, protocol.id)}
                                                                title={`Apply ${protocol.name} to all slides in this group`}
                                                            >
                                                                {protocol.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="no-case-selected">
                                <h3>No Case Selected</h3>
                                <p>Please select a BDSA case from the list above to view and map protocols.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div >
    );
};

export default CaseManagementTab;
