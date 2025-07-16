import React, { useState, useEffect } from 'react';
import './CaseManagementTab.css';

const STAIN_PROTOCOLS_KEY = 'bdsa_stain_protocols';
const CASE_MAPPINGS_KEY = 'bdsa_case_mappings';
const UNMAPPED_CASES_KEY = 'bdsa_unmapped_cases';
const CASE_ID_MAPPINGS_KEY = 'bdsa_case_id_mappings';
const LOCAL_ALIASES_KEY = 'bdsa_local_aliases';

const CaseManagementTab = () => {
    const [activeSubTab, setActiveSubTab] = useState('case-mapping');
    const [unmappedCases, setUnmappedCases] = useState([]);
    const [selectedCase, setSelectedCase] = useState(null);
    const [caseProtocolMappings, setCaseProtocolMappings] = useState({});
    const [stainProtocols, setStainProtocols] = useState([]);
    const [stainSchema, setStainSchema] = useState(null);
    const [caseIdMappings, setCaseIdMappings] = useState({});
    const [bdsaInstitutionId, setBdsaInstitutionId] = useState('001');
    const [csvData, setCsvData] = useState([]);
    const [columnMapping, setColumnMapping] = useState({
        localStainID: '',
        localCaseId: '',
        localRegionId: ''
    });

    const [localAliases, setLocalAliases] = useState({});
    const [showUnmappedOnly, setShowUnmappedOnly] = useState(false);

    // Migration function to convert old single-protocol format to new array format
    const migrateProtocolMappings = (mappings) => {
        const migrated = {};

        Object.keys(mappings).forEach(caseId => {
            migrated[caseId] = {};
            Object.keys(mappings[caseId]).forEach(slideId => {
                const protocolValue = mappings[caseId][slideId];

                // If it's already an array, keep it as is
                if (Array.isArray(protocolValue)) {
                    migrated[caseId][slideId] = protocolValue;
                }
                // If it's a string (old format), convert to array
                else if (typeof protocolValue === 'string' && protocolValue) {
                    migrated[caseId][slideId] = [protocolValue];
                }
                // If it's empty/null/undefined, use empty array
                else {
                    migrated[caseId][slideId] = [];
                }
            });
        });

        return migrated;
    };

    // Load data from localStorage on component mount
    useEffect(() => {
        loadData();
        loadStainSchema();
        loadCSVData();
    }, []);

    // Regenerate unmapped cases when column mapping or CSV data changes
    useEffect(() => {
        if (csvData.length > 0 && columnMapping.localStainID) {
            generateUnmappedCasesFromData();
        }
    }, [csvData, columnMapping.localStainID]);

    // Refresh stain protocols when they change
    useEffect(() => {
        const handleStorageChange = (e) => {
            if (e.key === STAIN_PROTOCOLS_KEY) {
                try {
                    const storedStain = localStorage.getItem(STAIN_PROTOCOLS_KEY);
                    if (storedStain) {
                        setStainProtocols(JSON.parse(storedStain));
                    }
                } catch (error) {
                    console.error('Error refreshing stain protocols:', error);
                }
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    const loadData = () => {
        try {
            // Load stain protocols
            const storedStain = localStorage.getItem(STAIN_PROTOCOLS_KEY);
            if (storedStain) {
                setStainProtocols(JSON.parse(storedStain));
            }

            // Load case mappings
            const storedMappings = localStorage.getItem(CASE_MAPPINGS_KEY);
            if (storedMappings) {
                const parsedMappings = JSON.parse(storedMappings);
                // Migrate from old single-protocol format to new array format
                const migratedMappings = migrateProtocolMappings(parsedMappings);
                setCaseProtocolMappings(migratedMappings);
                localStorage.setItem(CASE_MAPPINGS_KEY, JSON.stringify(migratedMappings));
            } else {
                setCaseProtocolMappings({});
                localStorage.setItem(CASE_MAPPINGS_KEY, JSON.stringify({}));
            }

            // Load case ID mappings
            const storedCaseIdMappings = localStorage.getItem(CASE_ID_MAPPINGS_KEY);
            if (storedCaseIdMappings) {
                setCaseIdMappings(JSON.parse(storedCaseIdMappings));
            }

            // Load column mapping
            const storedColumnMapping = localStorage.getItem('bdsa_column_mapping');
            if (storedColumnMapping) {
                setColumnMapping(JSON.parse(storedColumnMapping));
            }

            // Load BDSA institution ID
            const storedInstitutionId = localStorage.getItem('bdsa_institution_id');
            if (storedInstitutionId) {
                setBdsaInstitutionId(storedInstitutionId);
            }

            // Load local aliases
            const storedLocalAliases = localStorage.getItem(LOCAL_ALIASES_KEY);
            if (storedLocalAliases) {
                setLocalAliases(JSON.parse(storedLocalAliases));
            }

            // Generate unmapped cases from actual data
            generateUnmappedCasesFromData();
        } catch (error) {
            console.error('Error loading case management data from localStorage:', error);
        }
    };

    const loadCSVData = async () => {
        try {
            const response = await fetch('/year_2020_dsametadata.csv');
            const csvText = await response.text();

            // Simple CSV parsing (you might want to use Papa Parse for more robust parsing)
            const lines = csvText.split('\n');
            const headers = lines[0].split(',');
            const data = lines.slice(1).map(line => {
                const values = line.split(',');
                const row = {};
                headers.forEach((header, index) => {
                    row[header.trim()] = values[index]?.trim() || '';
                });
                return row;
            }).filter(row => Object.values(row).some(val => val !== ''));

            setCsvData(data);
        } catch (error) {
            console.error('Error loading CSV data:', error);
        }
    };

    const generateUnmappedCasesFromData = () => {
        if (!csvData.length || !columnMapping.localStainID) return;

        // Group data by BDSA case ID only
        const caseGroups = {};

        csvData.forEach(row => {
            const localCaseId = row[columnMapping.localCaseId];
            const localStainId = row[columnMapping.localStainID];

            // Skip if no stain ID or no BDSA case ID mapping
            if (!localStainId || !caseIdMappings[localCaseId]) return;

            const bdsaCaseId = caseIdMappings[localCaseId];

            if (!caseGroups[bdsaCaseId]) {
                caseGroups[bdsaCaseId] = {
                    bdsaId: bdsaCaseId,
                    localCaseId: localCaseId,
                    slides: []
                };
            }

            const slideId = `${bdsaCaseId}_${localStainId}`;
            const stainType = localStainId;

            // Check if this slide is already mapped to any protocols (now stored as array)
            const slideProtocols = caseProtocolMappings[bdsaCaseId]?.[slideId] || [];
            const isMapped = Array.isArray(slideProtocols) ? slideProtocols.length > 0 : Boolean(slideProtocols);

            caseGroups[bdsaCaseId].slides.push({
                id: slideId,
                stainType: stainType,
                status: isMapped ? 'mapped' : 'unmapped',
                localStainId: localStainId
            });
        });

        const unmappedCasesList = Object.values(caseGroups).filter(caseData =>
            caseData.slides.some(slide => slide.status === 'unmapped')
        );

        setUnmappedCases(unmappedCasesList);
        localStorage.setItem(UNMAPPED_CASES_KEY, JSON.stringify(unmappedCasesList));
    };

    const loadStainSchema = async () => {
        try {
            const response = await fetch('/bdsa-schema.json');
            const schema = await response.json();

            // Extract stain definitions from the schema
            if (schema.properties && schema.properties.stainIDs && schema.properties.stainIDs.items) {
                const stainDefinitions = schema.properties.stainIDs.items.properties;
                setStainSchema(stainDefinitions);
            }
        } catch (error) {
            console.error('Error loading stain schema:', error);
        }
    };

    const handleCaseSelect = (caseData) => {
        setSelectedCase(caseData);
    };

    const handleProtocolMapping = (slideId, protocolId) => {
        if (!selectedCase) return;

        // Get current protocols for this slide (initialize as empty array if none)
        const currentProtocols = caseProtocolMappings[selectedCase.bdsaId]?.[slideId] || [];

        // Add the new protocol if it's not already there
        const updatedProtocols = currentProtocols.includes(protocolId)
            ? currentProtocols
            : [...currentProtocols, protocolId];

        const updatedMappings = {
            ...caseProtocolMappings,
            [selectedCase.bdsaId]: {
                ...caseProtocolMappings[selectedCase.bdsaId],
                [slideId]: updatedProtocols
            }
        };

        setCaseProtocolMappings(updatedMappings);
        localStorage.setItem(CASE_MAPPINGS_KEY, JSON.stringify(updatedMappings));

        // Update the unmapped cases to mark this slide as mapped
        const updatedUnmappedCases = unmappedCases.map(caseData => {
            if (caseData.bdsaId === selectedCase.bdsaId) {
                return {
                    ...caseData,
                    slides: caseData.slides.map(slide =>
                        slide.id === slideId
                            ? { ...slide, status: 'mapped' }
                            : slide
                    )
                };
            }
            return caseData;
        });

        setUnmappedCases(updatedUnmappedCases);
        localStorage.setItem(UNMAPPED_CASES_KEY, JSON.stringify(updatedUnmappedCases));

        // Also update the selectedCase to ensure UI updates immediately
        const updatedSelectedCase = updatedUnmappedCases.find(caseData => caseData.bdsaId === selectedCase.bdsaId);
        if (updatedSelectedCase) {
            setSelectedCase(updatedSelectedCase);
        }
    };

    const removeProtocolMapping = (slideId, protocolId) => {
        if (!selectedCase) return;

        // Get current protocols for this slide
        const currentProtocols = caseProtocolMappings[selectedCase.bdsaId]?.[slideId] || [];

        // Remove the specified protocol
        const updatedProtocols = currentProtocols.filter(id => id !== protocolId);

        const updatedMappings = {
            ...caseProtocolMappings,
            [selectedCase.bdsaId]: {
                ...caseProtocolMappings[selectedCase.bdsaId],
                [slideId]: updatedProtocols
            }
        };

        setCaseProtocolMappings(updatedMappings);
        localStorage.setItem(CASE_MAPPINGS_KEY, JSON.stringify(updatedMappings));

        // Update the unmapped cases - mark as unmapped if no protocols remain
        const updatedUnmappedCases = unmappedCases.map(caseData => {
            if (caseData.bdsaId === selectedCase.bdsaId) {
                return {
                    ...caseData,
                    slides: caseData.slides.map(slide =>
                        slide.id === slideId
                            ? { ...slide, status: updatedProtocols.length > 0 ? 'mapped' : 'unmapped' }
                            : slide
                    )
                };
            }
            return caseData;
        });

        setUnmappedCases(updatedUnmappedCases);
        localStorage.setItem(UNMAPPED_CASES_KEY, JSON.stringify(updatedUnmappedCases));

        // Also update the selectedCase to ensure UI updates immediately
        const updatedSelectedCase = updatedUnmappedCases.find(caseData => caseData.bdsaId === selectedCase.bdsaId);
        if (updatedSelectedCase) {
            setSelectedCase(updatedSelectedCase);
        }
    };

    const getProtocolsForStainType = (stainType) => {
        // Return all protocols, not just those with matching stainType
        return stainProtocols;
    };

    const getStainTypeDisplayName = (stainType) => {
        if (!stainSchema || !stainSchema[stainType]) return stainType;
        return stainSchema[stainType].title || stainType;
    };

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
            const hasMappedSlides = group.slides.some(slide => {
                const slideProtocols = caseProtocolMappings[selectedCase?.bdsaId]?.[slide.id] || [];
                return Array.isArray(slideProtocols) && slideProtocols.length > 0;
            });

            if (hasMappedSlides) {
                group.status = 'mapped';
            }
        });

        return Object.values(grouped);
    };

    const getSuggestedProtocols = (stainType) => {
        const aliases = localAliases[stainType] || [];
        return aliases.map(alias =>
            stainProtocols.find(protocol => protocol.id === alias)
        ).filter(Boolean);
    };

    const getAutoSuggestedProtocol = (stainType) => {
        const suggestions = getSuggestedProtocols(stainType);
        // Return the first suggested protocol, or null if none
        return suggestions.length > 0 ? suggestions[0] : null;
    };

    const addLocalAlias = (stainType, protocolId) => {
        const newAliases = {
            ...localAliases,
            [stainType]: [...(localAliases[stainType] || []), protocolId]
        };
        setLocalAliases(newAliases);
        localStorage.setItem(LOCAL_ALIASES_KEY, JSON.stringify(newAliases));
    };

    const removeLocalAlias = (stainType, protocolId) => {
        const newAliases = {
            ...localAliases,
            [stainType]: (localAliases[stainType] || []).filter(id => id !== protocolId)
        };
        setLocalAliases(newAliases);
        localStorage.setItem(LOCAL_ALIASES_KEY, JSON.stringify(newAliases));
    };

    const getUnmappedCasesCount = () => {
        return unmappedCases.reduce((total, caseData) => {
            return total + caseData.slides.filter(slide => slide.status === 'unmapped').length;
        }, 0);
    };

    const getFilteredCases = () => {
        if (!showUnmappedOnly) return unmappedCases;

        return unmappedCases.filter(caseData =>
            caseData.slides.some(slide => slide.status === 'unmapped')
        );
    };

    const getMappedCasesCount = () => {
        return Object.keys(caseProtocolMappings).length;
    };

    // Case ID Mapping Functions
    const getUniqueCaseIds = () => {
        if (!columnMapping.localCaseId || !csvData.length) return [];

        const caseIdCounts = {};
        csvData.forEach(row => {
            const caseId = row[columnMapping.localCaseId];
            if (caseId) {
                caseIdCounts[caseId] = (caseIdCounts[caseId] || 0) + 1;
            }
        });

        return Object.entries(caseIdCounts)
            .map(([caseId, count]) => ({
                localCaseId: caseId,
                rowCount: count,
                bdsaCaseId: caseIdMappings[caseId] || null
            }))
            .sort((a, b) => a.localCaseId.localeCompare(b.localCaseId));
    };

    const updateCaseIdMapping = (localCaseId, bdsaCaseId) => {
        const newMappings = { ...caseIdMappings };
        if (bdsaCaseId) {
            newMappings[localCaseId] = bdsaCaseId;
        } else {
            delete newMappings[localCaseId];
        }

        setCaseIdMappings(newMappings);
        localStorage.setItem(CASE_ID_MAPPINGS_KEY, JSON.stringify(newMappings));

        // Regenerate unmapped cases after mapping change
        setTimeout(() => generateUnmappedCasesFromData(), 100);
    };

    const getNextSequentialNumber = () => {
        const existingNumbers = Object.values(caseIdMappings)
            .filter(id => id && id.startsWith(`BDSA-${bdsaInstitutionId.padStart(3, '0')}-`))
            .map(id => {
                const match = id.match(/BDSA-\d{3}-(\d{4})/);
                return match ? parseInt(match[1], 10) : 0;
            });

        const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
        return maxNumber + 1;
    };

    const generateSequentialBdsaCaseId = (localCaseId) => {
        if (!localCaseId || !bdsaInstitutionId) return;

        const nextNumber = getNextSequentialNumber();
        const bdsaCaseId = `BDSA-${bdsaInstitutionId.padStart(3, '0')}-${nextNumber.toString().padStart(4, '0')}`;
        updateCaseIdMapping(localCaseId, bdsaCaseId);
    };

    return (
        <div className="case-management-tab">
            <div className="case-management-header">
                <h2>Case Management</h2>
                <p>Manage BDSA case ID mappings and protocol assignments for specific cases.</p>

                <div className="case-stats">
                    <div className="stat-item">
                        <span className="stat-number">{getUnmappedCasesCount()}</span>
                        <span className="stat-label">Unmapped Slides</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-number">{getMappedCasesCount()}</span>
                        <span className="stat-label">Mapped Cases</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-number">{Object.keys(caseIdMappings).length}</span>
                        <span className="stat-label">BDSA Case IDs</span>
                    </div>
                </div>
            </div>

            {/* Sub-tabs */}
            <div className="case-management-sub-tabs">
                <button
                    className={`sub-tab-btn ${activeSubTab === 'case-mapping' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('case-mapping')}
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

            {/* Case ID Mapping Tab */}
            {activeSubTab === 'case-mapping' && (
                <div className="case-id-mapping-content">
                    {!columnMapping.localCaseId ? (
                        <div className="no-case-id-mapped">
                            <h3>No Case ID Column Selected</h3>
                            <p>Please configure case ID settings in the BDSA Settings tab to view and manage case ID mappings.</p>
                        </div>
                    ) : (
                        <div className="case-id-mapping-table">
                            <div className="mapping-summary">
                                <p>Showing unique case IDs from column: <strong>{columnMapping.localCaseId}</strong></p>
                                <p>Total unique cases: <strong>{getUniqueCaseIds().length}</strong></p>
                            </div>

                            <div className="table-container">
                                <table className="case-id-table">
                                    <thead>
                                        <tr>
                                            <th>Local Case ID</th>
                                            <th>Row Count</th>
                                            <th>BDSA Case ID</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {getUniqueCaseIds().map((item, index) => (
                                            <tr key={index}>
                                                <td className={item.bdsaCaseId ? 'mapped-case-id' : ''}>
                                                    {item.localCaseId}
                                                </td>
                                                <td>{item.rowCount}</td>
                                                <td>
                                                    <input
                                                        type="text"
                                                        value={item.bdsaCaseId || ''}
                                                        onChange={(e) => updateCaseIdMapping(item.localCaseId, e.target.value)}
                                                        placeholder="BDSA-001-0001"
                                                        className="bdsa-case-id-input"
                                                    />
                                                </td>
                                                <td>
                                                    <button
                                                        className="generate-bdsa-id-btn"
                                                        onClick={() => generateSequentialBdsaCaseId(item.localCaseId)}
                                                        disabled={!!item.bdsaCaseId}
                                                    >
                                                        Generate
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Protocol Mapping Tab */}
            {activeSubTab === 'protocol-mapping' && (
                <div className="case-management-content">
                    <div className="cases-panel">
                        <h3>Select BDSA Case</h3>
                        {!columnMapping.localStainID ? (
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
                                            const caseData = getFilteredCases().find(c => c.bdsaId === selectedBdsaId);
                                            setSelectedCase(caseData || null);
                                        }}
                                        className="case-select-dropdown"
                                    >
                                        <option value="">-- Select BDSA Case --</option>
                                        {getFilteredCases().map(caseData => (
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
                                                    {getStainTypeDisplayName(group.stainType)}
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
                                    {(() => {
                                        // Check if there are unmapped slides with suggestions
                                        const unmappedSlidesWithSuggestions = selectedCase.slides.filter(slide =>
                                            slide.status === 'unmapped' && getAutoSuggestedProtocol(slide.stainType)
                                        );

                                        if (unmappedSlidesWithSuggestions.length === 0) return null;

                                        return (
                                            <button
                                                type="button"
                                                className="apply-all-suggestions-btn"
                                                onClick={() => {
                                                    // Apply suggested protocols to each unmapped slide
                                                    unmappedSlidesWithSuggestions.forEach(slide => {
                                                        const suggestedProtocol = getAutoSuggestedProtocol(slide.stainType);
                                                        if (suggestedProtocol) {
                                                            handleProtocolMapping(slide.id, suggestedProtocol.id);
                                                        }
                                                    });
                                                }}
                                                title={`Apply suggested protocols to ${unmappedSlidesWithSuggestions.length} unmapped slide${unmappedSlidesWithSuggestions.length !== 1 ? 's' : ''}`}
                                            >
                                                🚀 Apply All Suggestions ({unmappedSlidesWithSuggestions.length})
                                            </button>
                                        );
                                    })()}
                                </div>
                                <div className="slides-mapping">
                                    {getGroupedSlides(selectedCase.slides).map((group, groupIndex) => (
                                        <div key={`${group.stainType}-${groupIndex}`} className="slide-mapping">
                                            <div className="slide-info">
                                                <span className="slide-id">
                                                    {group.stainType} ({group.count} slides)
                                                </span>
                                                <span className="stain-type">{getStainTypeDisplayName(group.stainType)}</span>
                                                <span className={`status ${group.status}`}>
                                                    {group.status === 'mapped' ? (() => {
                                                        // Count total protocols for this group
                                                        const allProtocols = new Set();
                                                        group.slides.forEach(slide => {
                                                            const slideProtocols = caseProtocolMappings[selectedCase.bdsaId]?.[slide.id] || [];
                                                            if (Array.isArray(slideProtocols)) {
                                                                slideProtocols.forEach(protocolId => allProtocols.add(protocolId));
                                                            }
                                                        });
                                                        const protocolCount = allProtocols.size;
                                                        return `✓ Mapped (${protocolCount} protocol${protocolCount !== 1 ? 's' : ''})`;
                                                    })() : '⏳ Unmapped'}
                                                </span>
                                            </div>



                                            {group.status === 'unmapped' && (
                                                <div className="protocol-selection">
                                                    {/* Auto-suggest and Alias management */}
                                                    <div className="alias-management">
                                                        <small>
                                                            <strong>Quick Actions:</strong>



                                                            {/* Protocol buttons */}
                                                            {stainProtocols.map(protocol => {
                                                                const isAlias = (localAliases[group.stainType] || []).includes(protocol.id);

                                                                // Check if this protocol is already applied to any slide in this group
                                                                const isApplied = group.slides.some(slide => {
                                                                    const slideProtocols = caseProtocolMappings[selectedCase.bdsaId]?.[slide.id] || [];
                                                                    return Array.isArray(slideProtocols) && slideProtocols.includes(protocol.id);
                                                                });

                                                                return (
                                                                    <button
                                                                        key={protocol.id}
                                                                        type="button"
                                                                        className={`protocol-btn ${isApplied ? 'applied' : isAlias ? 'suggested' : 'standard'}`}
                                                                        onClick={() => {
                                                                            if (isApplied) {
                                                                                // Remove the protocol from all slides in the group
                                                                                group.slides.forEach(slide => {
                                                                                    removeProtocolMapping(slide.id, protocol.id);
                                                                                });
                                                                            } else {
                                                                                // Apply the protocol to all slides in the group
                                                                                group.slides.forEach(slide => {
                                                                                    handleProtocolMapping(slide.id, protocol.id);
                                                                                });

                                                                                // Also add to suggestions if not already there
                                                                                if (!isAlias) {
                                                                                    addLocalAlias(group.stainType, protocol.id);
                                                                                }
                                                                            }
                                                                        }}
                                                                        title={isApplied ?
                                                                            `Remove "${protocol.name}" from all ${group.count} slides` :
                                                                            `Apply "${protocol.name}" to all ${group.count} slides${isAlias ? ' (suggested)' : ''}`
                                                                        }
                                                                    >
                                                                        {isApplied ? '✓' : isAlias ? '⭐' : '+'} {protocol.name}
                                                                    </button>
                                                                );
                                                            })}


                                                        </small>
                                                    </div>

                                                    {stainProtocols.length === 0 && (
                                                        <div className="no-protocols">
                                                            <p>No protocols available. Create some protocols first.</p>
                                                            <button
                                                                className="add-protocol-btn"
                                                                onClick={() => window.location.hash = 'protocols'}
                                                            >
                                                                + Add New Stain Protocol
                                                            </button>
                                                        </div>
                                                    )}


                                                </div>
                                            )}

                                            {group.status === 'mapped' && (
                                                <div className="mapped-protocol">
                                                    <strong>Mapped protocols:</strong>
                                                    <div className="mapped-protocols-list">
                                                        {(() => {
                                                            // Get all unique protocols for this group
                                                            const allProtocols = new Set();
                                                            group.slides.forEach(slide => {
                                                                const slideProtocols = caseProtocolMappings[selectedCase.bdsaId]?.[slide.id] || [];
                                                                if (Array.isArray(slideProtocols)) {
                                                                    slideProtocols.forEach(protocolId => allProtocols.add(protocolId));
                                                                }
                                                            });

                                                            return Array.from(allProtocols).map(protocolId => {
                                                                const protocol = stainProtocols.find(p => p.id === protocolId);



                                                                return (
                                                                    <div key={protocolId} className="mapped-protocol-item">
                                                                        <span className="protocol-name">{protocol?.name || 'Unknown Protocol'}</span>
                                                                        <button
                                                                            type="button"
                                                                            className="remove-protocol-btn"
                                                                            onClick={() => {
                                                                                group.slides.forEach(slide => {
                                                                                    removeProtocolMapping(slide.id, protocolId);
                                                                                });
                                                                            }}
                                                                            title={`Remove "${protocol?.name || 'Unknown Protocol'}" from all slides in this group`}
                                                                        >
                                                                            ×
                                                                        </button>
                                                                    </div>
                                                                );
                                                            });
                                                        })()}
                                                    </div>
                                                    {group.count > 1 && <span className="group-count"> (applied to {group.count} slides)</span>}

                                                    {/* Show option to add more protocols */}
                                                    <div className="add-more-protocols">
                                                        <small>
                                                            <strong>Add more protocols:</strong>
                                                            {stainProtocols.map(protocol => {
                                                                // Check if this protocol is already applied to all slides in the group
                                                                const isAlreadyApplied = group.slides.every(slide => {
                                                                    const slideProtocols = caseProtocolMappings[selectedCase.bdsaId]?.[slide.id] || [];
                                                                    return Array.isArray(slideProtocols) && slideProtocols.includes(protocol.id);
                                                                });

                                                                if (isAlreadyApplied) return null;

                                                                return (
                                                                    <button
                                                                        key={protocol.id}
                                                                        type="button"
                                                                        className="add-protocol-btn-small"
                                                                        onClick={() => {
                                                                            group.slides.forEach(slide => {
                                                                                handleProtocolMapping(slide.id, protocol.id);
                                                                            });
                                                                        }}
                                                                        title={`Add "${protocol.name}" to all slides in this group`}
                                                                    >
                                                                        + {protocol.name}
                                                                    </button>
                                                                );
                                                            })}
                                                        </small>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="no-case-selected">
                                <h3>Select a Case</h3>
                                <p>Choose a case from the left panel to map protocols to its slides.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CaseManagementTab; 