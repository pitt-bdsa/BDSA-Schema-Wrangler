import React, { useState, useEffect, useMemo } from 'react';
import './CaseManagementTab.css';
import dataStore, { setCaseIdInData } from '../utils/dataStore';

const CaseManagementTab = () => {
    const [activeSubTab, setActiveSubTab] = useState('case-id-mapping');
    const [dataStatus, setDataStatus] = useState(dataStore.getStatus());
    const [bdsaInstitutionId, setBdsaInstitutionId] = useState('001');
    const [showMappedCases, setShowMappedCases] = useState(true);
    const [sortField, setSortField] = useState('localCaseId');
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

    // Force update when case ID mappings change (since updateCaseIdMappings doesn't notify)
    const forceCaseIdMappingsUpdate = () => {
        setForceUpdate(prev => prev + 1);
        setDataStatus(dataStore.getStatus());
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

        return Object.entries(caseIdCounts)
            .map(([caseId, count]) => ({
                localCaseId: caseId,
                rowCount: count,
                bdsaCaseId: caseIdMappings.get(caseId) || null,
                isMapped: Boolean(caseIdMappings.get(caseId))
            }))
            .sort((a, b) => {
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
    };

    // Filter cases based on mapped status
    const filteredCaseIds = useMemo(() => {
        const allCases = getUniqueCaseIds();
        if (showMappedCases) {
            return allCases;
        }
        return allCases.filter(caseData => !caseData.isMapped);
    }, [dataStatus.processedData, dataStatus.caseIdMappings, showMappedCases, sortField, sortDirection]);

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
            <div className="case-management-header">
                <h2>Case Management</h2>
                <p>Manage BDSA case ID mappings and protocol assignments for specific cases.</p>

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
                                    className={`toggle-mapped-btn ${showMappedCases ? 'active' : ''}`}
                                    onClick={() => setShowMappedCases(!showMappedCases)}
                                >
                                    👤 {showMappedCases ? 'Hide Mapped' : 'Show Mapped'}
                                </button>
                                <button
                                    className="generate-all-btn"
                                    onClick={generateAllCaseIds}
                                    disabled={isGeneratingAll || filteredCaseIds.filter(c => !c.isMapped).length === 0}
                                >
                                    🚀 Generate All
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
                    <div className="no-case-selected">
                        <h3>Protocol Mapping</h3>
                        <p>Protocol mapping functionality will be implemented here.</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CaseManagementTab;
