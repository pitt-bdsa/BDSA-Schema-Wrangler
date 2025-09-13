import React, { useState, useEffect, useMemo, useRef } from 'react';
import './CaseManagementTab.css';
import ProtocolMapping from './ProtocolMapping';
import {
    subscribeToDataStore,
    getDataStoreSnapshot,
    updateCaseIdMappings,
    updateCaseProtocolMappings,
    generateUnmappedCases,
    getCurrentData,
    DATA_CHANGE_EVENTS
} from '../utils/dataStore';

const STAIN_PROTOCOLS_KEY = 'bdsa_stain_protocols';
const REGION_PROTOCOLS_KEY = 'bdsa_region_protocols';
const CASE_MAPPINGS_KEY = 'bdsa_case_mappings';
const UNMAPPED_CASES_KEY = 'bdsa_unmapped_cases';
const CASE_ID_MAPPINGS_KEY = 'bdsa_case_id_mappings';
const LOCAL_ALIASES_KEY = 'bdsa_local_aliases';
const REGION_ALIASES_KEY = 'bdsa_region_aliases';

const CaseManagementTab = () => {
    const [activeSubTab, setActiveSubTab] = useState('case-mapping');
    const [unmappedCases, setUnmappedCases] = useState([]);
    const [selectedCase, setSelectedCase] = useState(null);
    const [stainProtocols, setStainProtocols] = useState([]);
    const [regionProtocols, setRegionProtocols] = useState([]);
    const [stainSchema, setStainSchema] = useState(null);
    const [regionSchema, setRegionSchema] = useState(null);
    const [bdsaInstitutionId, setBdsaInstitutionId] = useState('001');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isGeneratingAll, setIsGeneratingAll] = useState(false);
    const [generateAllProgress, setGenerateAllProgress] = useState({ current: 0, total: 0 });
    const [localInputValues, setLocalInputValues] = useState({});
    const [isEditing, setIsEditing] = useState(false);
    const previousSortedDataRef = useRef([]);
    const [generateAllCancelled, setGenerateAllCancelled] = useState(false);

    // Data from centralized store
    const [dataStore, setDataStore] = useState(getDataStoreSnapshot());
    // Force re-render when protocols change
    const [protocolUpdateCounter, setProtocolUpdateCounter] = useState(0);
    // Simple local tracking of applied protocols
    const [localProtocolState, setLocalProtocolState] = useState({});

    // Subscribe to data store updates
    useEffect(() => {
        const unsubscribe = subscribeToDataStore((event) => {
            // Update local data store snapshot when changes occur
            const newDataStore = getDataStoreSnapshot();
            setDataStore(newDataStore);

            // Force re-render for protocol changes
            if (event.eventType === 'protocolsChanged') {
                setProtocolUpdateCounter(prev => prev + 1);
            }
        });

        return unsubscribe;
    }, []);

    // Destructure commonly used data from store
    const {
        processedData: csvData,
        columnMapping,
        caseIdMappings,
        caseProtocolMappings,
        currentDataSource,
        isLoading,
        regexApplied,
        regexGeneratedValues,
        pendingRegexApplication
    } = dataStore;

    const [localAliases, setLocalAliases] = useState({});
    const [regionAliases, setRegionAliases] = useState({});
    const [showUnmappedOnly, setShowUnmappedOnly] = useState(false);
    const [hideMappedProtocols, setHideMappedProtocols] = useState(false);
    const [expandedStainGroups, setExpandedStainGroups] = useState(new Set());
    const [expandedRegionGroups, setExpandedRegionGroups] = useState(new Set());
    const [selectedSlides, setSelectedSlides] = useState(new Set());

    // Case ID table state
    const [sortField, setSortField] = useState('localCaseId');
    const [sortDirection, setSortDirection] = useState('asc');
    const [showMappedCases, setShowMappedCases] = useState(true);

    // Subscribe to data store changes
    useEffect(() => {
        const unsubscribe = subscribeToDataStore((event) => {
            // Update local state with new data store snapshot
            const newDataStore = getDataStoreSnapshot();
            setDataStore(newDataStore);

            // Force re-render for protocol changes
            if (event.eventType === DATA_CHANGE_EVENTS.PROTOCOLS_CHANGED) {
                setProtocolUpdateCounter(prev => prev + 1);
            }

            // Handle specific events
            switch (event.eventType) {
                case DATA_CHANGE_EVENTS.DATA_LOADED:
                case DATA_CHANGE_EVENTS.DATA_UPDATED:
                case DATA_CHANGE_EVENTS.MAPPINGS_CHANGED:
                case DATA_CHANGE_EVENTS.PROTOCOLS_CHANGED:
                    // Regenerate unmapped cases when data changes
                    setTimeout(() => {
                        const newUnmappedCases = generateUnmappedCases();
                        setUnmappedCases(newUnmappedCases);
                    }, 100);
                    break;
                default:
                    break;
            }
        });

        // Load initial data
        loadStainSchema();
        loadInitialData();

        return unsubscribe;
    }, []);

    // Generate unmapped cases when data changes
    useEffect(() => {
        if (csvData.length > 0 && (columnMapping.localStainID || columnMapping.localRegionId)) {
            const newUnmappedCases = generateUnmappedCases();
            setUnmappedCases(newUnmappedCases);
        }
    }, [csvData, columnMapping.localStainID, columnMapping.localRegionId]);

    // Refresh protocols when they change
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
            if (e.key === REGION_PROTOCOLS_KEY) {
                try {
                    const storedRegion = localStorage.getItem(REGION_PROTOCOLS_KEY);
                    if (storedRegion) {
                        setRegionProtocols(JSON.parse(storedRegion));
                    }
                } catch (error) {
                    console.error('Error refreshing region protocols:', error);
                }
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    const loadInitialData = () => {
        try {
            console.log('CaseManagementTab loading initial data...');
            console.log('Current data source:', currentDataSource);
            console.log('CSV data length:', csvData.length);
            console.log('Column mapping:', columnMapping);

            // Load stain protocols
            const storedStain = localStorage.getItem(STAIN_PROTOCOLS_KEY);
            if (storedStain) {
                setStainProtocols(JSON.parse(storedStain));
            }

            // Load region protocols
            const storedRegion = localStorage.getItem(REGION_PROTOCOLS_KEY);
            if (storedRegion) {
                setRegionProtocols(JSON.parse(storedRegion));
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

            // Load region aliases
            const storedRegionAliases = localStorage.getItem(REGION_ALIASES_KEY);
            if (storedRegionAliases) {
                setRegionAliases(JSON.parse(storedRegionAliases));
            }

            // Generate unmapped cases from current data store
            if (csvData.length > 0) {
                const newUnmappedCases = generateUnmappedCases();
                setUnmappedCases(newUnmappedCases);
            }
        } catch (error) {
            console.error('Error loading case management data:', error);
        }
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

            // Extract region definitions from the schema
            if (schema.properties && schema.properties.regionIDs && schema.properties.regionIDs.properties) {
                const regionDefinitions = schema.properties.regionIDs.properties;
                setRegionSchema(regionDefinitions);
            }
        } catch (error) {
            console.error('Error loading schema:', error);
        }
    };

    const handleCaseSelect = (caseData) => {
        setSelectedCase(caseData);
    };

    // Helper function to check if a value was generated by regex
    const isValueRegexGenerated = (rowIndex, fieldName) => {
        return regexGeneratedValues.has(`${rowIndex}_${fieldName}`);
    };

    // Case ID Mapping Functions
    const getUniqueCaseIds = () => {
        if (!columnMapping.localCaseId || !csvData.length) return [];

        const caseIdCounts = {};
        const caseIdSources = {}; // Track which rows have regex-generated case IDs

        csvData.forEach((row, index) => {
            // Use the original localCaseId column as the source
            const caseId = row[columnMapping.localCaseId];
            if (caseId) {
                caseIdCounts[caseId] = (caseIdCounts[caseId] || 0) + 1;

                // Check if this case ID was generated by regex
                if (isValueRegexGenerated(index, 'localCaseId')) {
                    if (!caseIdSources[caseId]) {
                        caseIdSources[caseId] = { hasRegexGenerated: false, hasStored: false, hasConflict: false };
                    }
                    caseIdSources[caseId].hasRegexGenerated = true;
                } else {
                    if (!caseIdSources[caseId]) {
                        caseIdSources[caseId] = { hasRegexGenerated: false, hasStored: false, hasConflict: false };
                    }
                    caseIdSources[caseId].hasStored = true;
                }

                // Check for data source conflicts
                if (row._dataSource?.localCaseId === 'regex' && columnMapping.localCaseId && row[columnMapping.localCaseId]) {
                    const sourceValue = row[columnMapping.localCaseId];
                    const storedValue = row.BDSA?.localCaseId;
                    if (sourceValue !== storedValue) {
                        caseIdSources[caseId].hasConflict = true;
                    }
                }
            }
        });

        let cases = Object.entries(caseIdCounts)
            .map(([caseId, count]) => ({
                localCaseId: caseId,
                rowCount: count,
                bdsaCaseId: caseIdMappings[caseId] || null,
                isMapped: Boolean(caseIdMappings[caseId]),
                hasRegexGenerated: caseIdSources[caseId]?.hasRegexGenerated || false,
                hasStored: caseIdSources[caseId]?.hasStored || false,
                hasConflict: caseIdSources[caseId]?.hasConflict || false,
                isMixed: (caseIdSources[caseId]?.hasRegexGenerated && caseIdSources[caseId]?.hasStored) || false
            }));

        // Filter mapped/unmapped cases
        if (!showMappedCases) {
            cases = cases.filter(caseItem => !caseItem.isMapped);
        }

        // Sort cases
        cases.sort((a, b) => {
            let aValue, bValue;

            switch (sortField) {
                case 'localCaseId':
                    aValue = a.localCaseId;
                    bValue = b.localCaseId;
                    break;
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
            }

            if (sortField === 'rowCount') {
                // Numeric sort for row count
                return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
            } else {
                // String sort for other fields
                const comparison = aValue.localeCompare(bValue);
                return sortDirection === 'asc' ? comparison : -comparison;
            }
        });

        return cases;
    };

    // Static reference to prevent auto-resorting - only updates when user manually changes sort/filter
    const [staticSortedCaseIds, setStaticSortedCaseIds] = useState([]);
    const tableInitializedRef = useRef(false);

    // Initialize table data only once when component loads
    useEffect(() => {
        if (!tableInitializedRef.current && csvData.length > 0) {
            const newData = getUniqueCaseIds();
            setStaticSortedCaseIds(newData);
            tableInitializedRef.current = true;
        }
    }, [csvData, columnMapping.localCaseId]);

    // Only update table data when user manually changes sort/filter settings
    useEffect(() => {
        if (tableInitializedRef.current) {
            const newData = getUniqueCaseIds();
            setStaticSortedCaseIds(newData);
        }
    }, [showMappedCases, sortField, sortDirection]);

    // Also update static data when protocols change (but don't re-sort, just refresh data)
    useEffect(() => {
        console.log('Refreshing static data due to protocol changes...');
        const newData = getUniqueCaseIds();
        setStaticSortedCaseIds(newData);
    }, [protocolUpdateCounter]);

    const sortedCaseIds = staticSortedCaseIds;

    // Memoized duplicate detection - only recalculates when sorted case IDs change
    const duplicateBdsaCaseIds = useMemo(() => {
        const bdsaCaseIdCounts = new Map();

        // Count occurrences of each BDSA Case ID
        sortedCaseIds.forEach(caseData => {
            if (caseData.bdsaCaseId) {
                const count = bdsaCaseIdCounts.get(caseData.bdsaCaseId) || 0;
                bdsaCaseIdCounts.set(caseData.bdsaCaseId, count + 1);
            }
        });

        // Find duplicates (BDSA Case IDs that appear more than once)
        const duplicates = new Set();
        bdsaCaseIdCounts.forEach((count, bdsaCaseId) => {
            if (count > 1) {
                duplicates.add(bdsaCaseId);
            }
        });

        return duplicates;
    }, [sortedCaseIds]);

    const handleSort = (field) => {
        if (sortField === field) {
            // Toggle direction if same field
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            // Set new field with ascending direction
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const getSortIcon = (field) => {
        if (sortField !== field) return '↕️';
        return sortDirection === 'asc' ? '↑' : '↓';
    };

    const updateCaseIdMapping = (localCaseId, bdsaCaseId) => {
        console.log('=== UPDATE CASE ID MAPPING ===');
        console.log('localCaseId:', localCaseId);
        console.log('bdsaCaseId:', `"${bdsaCaseId}"`); // Show quotes to see exact value
        console.log('bdsaCaseId type:', typeof bdsaCaseId);
        console.log('bdsaCaseId length:', bdsaCaseId ? bdsaCaseId.length : 'null/undefined');
        console.log('current caseIdMappings:', caseIdMappings);

        const newMappings = { ...caseIdMappings };
        // Trim whitespace and check if value is empty
        const trimmedValue = bdsaCaseId ? bdsaCaseId.trim() : '';

        if (trimmedValue) {
            console.log('Setting mapping:', localCaseId, '→', trimmedValue);
            newMappings[localCaseId] = trimmedValue;
        } else {
            console.log('Deleting mapping for:', localCaseId);
            delete newMappings[localCaseId];
        }

        console.log('newMappings after update:', newMappings);
        console.log('Current dataStore.caseIdMappings before update:', dataStore.caseIdMappings);
        console.log('Calling updateCaseIdMappings from data store...');

        // Create a targeted update that only changes the specific case ID
        const targetedUpdate = { ...dataStore.caseIdMappings };
        if (trimmedValue) {
            targetedUpdate[localCaseId] = trimmedValue;
        } else {
            delete targetedUpdate[localCaseId];
        }

        console.log('Targeted update:', targetedUpdate);
        console.log('Specific change:', localCaseId, '→', trimmedValue);

        // Use the proper data store function with the targeted update
        updateCaseIdMappings(targetedUpdate, {
            saveToStorage: true,
            syncToServer: false
        });

        // Update only the specific item that was changed, not the entire table
        setStaticSortedCaseIds(prevData => {
            return prevData.map(item => {
                if (item.localCaseId === localCaseId) {
                    // Update only the specific item that was changed
                    const updatedItem = { ...item, bdsaCaseId: trimmedValue || null, isMapped: Boolean(trimmedValue) };
                    console.log(`Updating item ${item.localCaseId}: ${item.bdsaCaseId} → ${updatedItem.bdsaCaseId}`);
                    return updatedItem;
                }
                return item;
            });
        });

        // If we just generated a BDSA Case ID, temporarily show all cases so the user can see their change
        if (bdsaCaseId && showMappedCases === false) {
            console.log('Temporarily showing all cases to display the newly generated BDSA Case ID');
            setShowMappedCases(true);
        }

        // The data store will handle localStorage saving and event notifications
        // Unmapped cases will be regenerated automatically via the subscription
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
        console.log('=== GENERATE BDSA CASE ID ===');
        console.log('localCaseId:', localCaseId);
        console.log('bdsaInstitutionId:', bdsaInstitutionId);
        console.log('current caseIdMappings:', caseIdMappings);
        console.log('isGenerating:', isGenerating);

        if (!localCaseId || !bdsaInstitutionId) {
            console.log('Missing required values - localCaseId:', localCaseId, 'bdsaInstitutionId:', bdsaInstitutionId);
            return;
        }

        // Prevent multiple simultaneous generations
        if (isGenerating) {
            console.log('Already generating, skipping...');
            return;
        }

        // Check if this case already has a BDSA Case ID
        if (caseIdMappings[localCaseId]) {
            console.log('Case already has BDSA Case ID:', caseIdMappings[localCaseId]);
            return;
        }

        setIsGenerating(true);

        try {
            const nextNumber = getNextSequentialNumber();
            const bdsaCaseId = `BDSA-${bdsaInstitutionId.padStart(3, '0')}-${nextNumber.toString().padStart(4, '0')}`;

            console.log('Generated BDSA Case ID:', bdsaCaseId);
            console.log('Calling updateCaseIdMapping with:', localCaseId, bdsaCaseId);

            updateCaseIdMapping(localCaseId, bdsaCaseId);
        } finally {
            // Reset the generating flag after a short delay to allow the UI to update
            setTimeout(() => {
                setIsGenerating(false);
            }, 100);
        }
    };

    const clearDuplicateCaseIds = () => {
        console.log('=== CLEAR DUPLICATE CASE IDS ===');

        // Get fresh data to ensure we have current duplicates
        const freshCaseIds = getUniqueCaseIds();
        console.log('Fresh case IDs:', freshCaseIds);

        // Recalculate duplicates from fresh data
        const bdsaCaseIdCounts = new Map();
        freshCaseIds.forEach(caseData => {
            if (caseData.bdsaCaseId) {
                const count = bdsaCaseIdCounts.get(caseData.bdsaCaseId) || 0;
                bdsaCaseIdCounts.set(caseData.bdsaCaseId, count + 1);
            }
        });

        // Find duplicate BDSA Case IDs
        const freshDuplicates = new Set();
        bdsaCaseIdCounts.forEach((count, bdsaCaseId) => {
            if (count > 1) {
                freshDuplicates.add(bdsaCaseId);
            }
        });

        console.log('Fresh duplicates found:', Array.from(freshDuplicates));

        // Get all local case IDs that have duplicate BDSA Case IDs
        const duplicateCaseIds = [];
        freshCaseIds.forEach(caseData => {
            if (caseData.bdsaCaseId && freshDuplicates.has(caseData.bdsaCaseId)) {
                duplicateCaseIds.push(caseData.localCaseId);
            }
        });

        console.log(`Found ${duplicateCaseIds.length} cases with duplicate BDSA Case IDs:`, duplicateCaseIds);

        if (duplicateCaseIds.length === 0) {
            console.log('No duplicates found to clear');
            return;
        }

        // Clear all duplicate mappings
        const newMappings = { ...caseIdMappings };
        duplicateCaseIds.forEach(localCaseId => {
            console.log(`Clearing mapping for ${localCaseId}`);
            delete newMappings[localCaseId];
        });

        console.log('New mappings after clearing:', newMappings);
        console.log('Calling updateCaseIdMappings...');

        // Temporarily allow data store updates for this operation
        setIsEditing(false);

        updateCaseIdMappings(newMappings);

        // Force multiple refresh attempts to ensure UI updates
        const forceRefresh = () => {
            console.log('Forcing comprehensive refresh...');
            const refreshedData = getUniqueCaseIds();
            setStaticSortedCaseIds(refreshedData);

            // Also update the main data store state to trigger re-render
            const newDataStore = getDataStoreSnapshot();
            setDataStore(newDataStore);

            // Force a component re-render by updating a counter
            setProtocolUpdateCounter(prev => prev + 1);
        };

        // Try multiple refresh attempts
        setTimeout(forceRefresh, 100);
        setTimeout(forceRefresh, 300);
        setTimeout(forceRefresh, 500);

        console.log(`Successfully cleared ${duplicateCaseIds.length} duplicate case IDs`);
    };

    const generateAllBdsaCaseIds = async () => {
        console.log('=== GENERATE ALL BDSA CASE IDS ===');

        const allCases = getUniqueCaseIds();
        const unmappedCases = allCases.filter(caseItem => !caseItem.isMapped);

        console.log(`Found ${unmappedCases.length} unmapped cases out of ${allCases.length} total cases`);

        if (unmappedCases.length === 0) {
            console.log('No unmapped cases to generate BDSA Case IDs for');
            return;
        }

        setIsGeneratingAll(true);
        setGenerateAllProgress({ current: 0, total: unmappedCases.length });
        setGenerateAllCancelled(false);

        try {
            // Get the starting sequential number once, then increment locally
            let nextNumber = getNextSequentialNumber();

            for (let i = 0; i < unmappedCases.length; i++) {
                // Check if generation was cancelled
                if (generateAllCancelled) {
                    console.log('Generation cancelled by user');
                    break;
                }

                const caseItem = unmappedCases[i];
                console.log(`Generating BDSA Case ID for case ${i + 1}/${unmappedCases.length}: ${caseItem.localCaseId}`);

                // Generate the BDSA Case ID using the current nextNumber
                const bdsaCaseId = `BDSA-${bdsaInstitutionId.padStart(3, '0')}-${nextNumber.toString().padStart(4, '0')}`;

                // Update the mapping
                updateCaseIdMapping(caseItem.localCaseId, bdsaCaseId);

                // Increment for the next iteration
                nextNumber++;

                // Update progress
                setGenerateAllProgress({ current: i + 1, total: unmappedCases.length });

                // Small delay to keep UI responsive and allow data store updates
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            if (!generateAllCancelled) {
                console.log(`Successfully generated BDSA Case IDs for ${unmappedCases.length} cases`);
            }
        } catch (error) {
            console.error('Error during bulk generation:', error);
        } finally {
            setIsGeneratingAll(false);
            setGenerateAllProgress({ current: 0, total: 0 });
        }
    };

    const cancelGenerateAll = () => {
        console.log('Cancelling bulk generation...');
        setGenerateAllCancelled(true);
    };

    const getUnmappedCasesCount = () => {
        return unmappedCases.reduce((total, caseData) => {
            return total + caseData.slides.filter(slide => slide.status === 'unmapped').length;
        }, 0);
    };

    const getMappedCasesCount = () => {
        return Object.keys(caseProtocolMappings).length;
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
                            <div style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
                                Debug: columnMapping = {JSON.stringify(columnMapping)}
                            </div>
                        </div>
                    ) : (
                        <div className="case-id-mapping-table">
                            <div className="mapping-summary">
                                <div className="summary-info">
                                    <p>Showing unique case IDs from column: <strong>{columnMapping.localCaseId}</strong></p>
                                    <p>Total unique cases: <strong>{sortedCaseIds.length}</strong></p>
                                    {(() => {
                                        if (duplicateBdsaCaseIds.size > 0) {
                                            return (
                                                <div className="duplicate-warning">
                                                    <p style={{ color: '#dc3545', fontWeight: 'bold' }}>
                                                        ⚠️ Warning: {duplicateBdsaCaseIds.size} duplicate BDSA Case ID{duplicateBdsaCaseIds.size !== 1 ? 's' : ''} detected!
                                                    </p>
                                                    <details style={{ marginTop: '5px' }}>
                                                        <summary style={{ cursor: 'pointer', color: '#dc3545' }}>
                                                            View duplicates ({duplicateBdsaCaseIds.size})
                                                        </summary>
                                                        <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                                                            {Array.from(duplicateBdsaCaseIds).map(bdsaCaseId => (
                                                                <li key={bdsaCaseId} style={{ color: '#dc3545' }}>
                                                                    {bdsaCaseId}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </details>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}
                                </div>
                                <div className="mapping-controls">
                                    <button
                                        type="button"
                                        className={`toggle-mapped-btn ${showMappedCases ? 'active' : ''}`}
                                        onClick={() => setShowMappedCases(!showMappedCases)}
                                        title={showMappedCases ? 'Hide already mapped cases' : 'Show already mapped cases'}
                                    >
                                        {showMappedCases ? '🙈 Hide Mapped' : '👁️ Show All'}
                                    </button>

                                    <button
                                        type="button"
                                        className={`generate-all-btn ${isGeneratingAll ? 'generating' : ''}`}
                                        onClick={isGeneratingAll ? cancelGenerateAll : generateAllBdsaCaseIds}
                                        disabled={isGenerating || (isGeneratingAll && generateAllCancelled)}
                                        title={isGeneratingAll ? 'Cancel bulk generation' : 'Generate BDSA Case IDs for all unmapped cases'}
                                    >
                                        {isGeneratingAll ? '⏹️ Cancel' : '🚀 Generate All'}
                                    </button>

                                    {duplicateBdsaCaseIds.size > 0 && (
                                        <button
                                            type="button"
                                            className="clear-duplicates-btn"
                                            onClick={clearDuplicateCaseIds}
                                            disabled={isGenerating || isGeneratingAll}
                                            title={`Clear all ${duplicateBdsaCaseIds.size} duplicate BDSA Case IDs`}
                                        >
                                            🗑️ Clear Duplicates ({duplicateBdsaCaseIds.size})
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Progress indicator for bulk generation */}
                            {isGeneratingAll && (
                                <div className="bulk-generation-progress">
                                    <div className="progress-info">
                                        <span>🚀 Generating BDSA Case IDs...</span>
                                        <span>{generateAllProgress.current} of {generateAllProgress.total} completed</span>
                                    </div>
                                    <div className="progress-bar">
                                        <div
                                            className="progress-fill"
                                            style={{
                                                width: `${(generateAllProgress.current / generateAllProgress.total) * 100}%`
                                            }}
                                        ></div>
                                    </div>
                                </div>
                            )}

                            <div className="table-container">
                                <table className="case-id-table">
                                    <thead>
                                        <tr>
                                            <th
                                                className="sortable-header"
                                                onClick={() => handleSort('localCaseId')}
                                                title="Click to sort by Local Case ID"
                                            >
                                                Local Case ID {getSortIcon('localCaseId')}
                                            </th>
                                            <th
                                                className="sortable-header"
                                                onClick={() => handleSort('rowCount')}
                                                title="Click to sort by Row Count"
                                            >
                                                Row Count {getSortIcon('rowCount')}
                                            </th>
                                            <th
                                                className="sortable-header"
                                                onClick={() => handleSort('bdsaCaseId')}
                                                title="Click to sort by BDSA Case ID"
                                            >
                                                BDSA Case ID {getSortIcon('bdsaCaseId')}
                                            </th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedCaseIds.map((item, index) => {
                                            const isDuplicate = item.bdsaCaseId && duplicateBdsaCaseIds.has(item.bdsaCaseId);

                                            return (
                                                <tr key={`${item.localCaseId}-${index}`} className={isDuplicate ? 'duplicate-bdsa-case' : ''}>
                                                    <td className={`${item.bdsaCaseId ? 'mapped-case-id' : ''} ${item.hasRegexGenerated ? 'regex-generated' : ''} ${item.isMixed ? 'mixed-source' : ''} ${item.hasConflict ? 'data-conflict' : ''}`}>
                                                        <div className="case-id-cell">
                                                            <span className="case-id-value">{item.localCaseId}</span>
                                                            {item.hasRegexGenerated && (
                                                                <span className="regex-indicator" title="This value was generated by regex rules">
                                                                    🔧
                                                                </span>
                                                            )}
                                                            {item.hasConflict && (
                                                                <span className="conflict-indicator" title="Data source conflict: original data differs from stored value">
                                                                    ⚠️
                                                                </span>
                                                            )}
                                                            {item.isMixed && !item.hasConflict && (
                                                                <span className="mixed-indicator" title="This case ID appears in both stored data and regex-generated data">
                                                                    📊
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td>{item.rowCount}</td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            value={localInputValues[item.localCaseId] !== undefined ? localInputValues[item.localCaseId] : (item.bdsaCaseId || '')}
                                                            onFocus={() => {
                                                                console.log('🎯 INPUT FOCUSED - Case ID:', item.localCaseId);
                                                            }}
                                                            onChange={(e) => {
                                                                console.log('🔄 INPUT CHANGE - Case ID:', item.localCaseId, 'New value:', e.target.value);
                                                                // Update local state only - no data store updates until blur/enter
                                                                setLocalInputValues(prev => ({
                                                                    ...prev,
                                                                    [item.localCaseId]: e.target.value
                                                                }));
                                                            }}
                                                            onBlur={(e) => {
                                                                console.log('Input blurred, saving value:', e.target.value);
                                                                updateCaseIdMapping(item.localCaseId, e.target.value);
                                                                // Clear local state after saving
                                                                setLocalInputValues(prev => {
                                                                    const newState = { ...prev };
                                                                    delete newState[item.localCaseId];
                                                                    return newState;
                                                                });
                                                            }}
                                                            onKeyDown={(e) => {
                                                                console.log('⌨️ KEY DOWN - Key:', e.key, 'Value:', e.target.value);
                                                                if (e.key === 'Enter') {
                                                                    console.log('✅ ENTER PRESSED - Saving value:', e.target.value);
                                                                    updateCaseIdMapping(item.localCaseId, e.target.value);
                                                                    // Clear local state after saving
                                                                    setLocalInputValues(prev => {
                                                                        const newState = { ...prev };
                                                                        delete newState[item.localCaseId];
                                                                        return newState;
                                                                    });
                                                                    e.target.blur(); // Remove focus after Enter
                                                                }
                                                            }}
                                                            placeholder="BDSA-001-0001"
                                                            className="bdsa-case-id-input"
                                                        />
                                                    </td>
                                                    <td>
                                                        <button
                                                            className="generate-bdsa-id-btn"
                                                            onClick={() => generateSequentialBdsaCaseId(item.localCaseId)}
                                                            disabled={!!item.bdsaCaseId || isGenerating}
                                                        >
                                                            {isGenerating ? 'Generating...' : 'Generate'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Protocol Mapping Tab */}
            {activeSubTab === 'protocol-mapping' && (
                <div>
                    <h3>🔧 NEW PROTOCOL MAPPING COMPONENT LOADED</h3>
                    <ProtocolMapping />
                </div>
            )}
        </div>
    );
};

export default CaseManagementTab;
