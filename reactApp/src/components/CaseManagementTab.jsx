import React, { useState, useEffect, useMemo, useRef } from 'react';
import './CaseManagementTab.css';
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

    // Subscribe to data store changes
    useEffect(() => {
        const unsubscribe = subscribeToDataStore((event) => {
            console.log('CaseManagementTab received data store event:', event.eventType);

            // Update local state with new data store snapshot
            setDataStore(event.dataStore);

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

    // Note: Data loading is now handled by the centralized data store
    // The generateUnmappedCases function is now imported from dataStore

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

    // Helper function to get protocols for a slide (handles both old and new format)
    const getSlideProtocols = (slideId, protocolType = null) => {
        const slideProtocols = caseProtocolMappings[selectedCase?.bdsaId]?.[slideId] || { stain: [], region: [] };

        // Handle old format (array) - return all protocols
        if (Array.isArray(slideProtocols)) {
            return slideProtocols;
        }

        // Handle new format (segregated object)
        if (protocolType) {
            return slideProtocols[protocolType] || [];
        }

        // If no protocol type specified, return all protocols (for backward compatibility)
        return [...(slideProtocols.stain || []), ...(slideProtocols.region || [])];
    };

    const handleProtocolMapping = (slideId, protocolId) => {
        if (!selectedCase) return;

        console.log('=== ADDING PROTOCOL MAPPING (SEGREGATED) ===');
        console.log('Slide ID:', slideId, 'Protocol ID:', protocolId);

        // Get current protocols for this slide (segregated structure)
        const currentSlideProtocols = caseProtocolMappings[selectedCase.bdsaId]?.[slideId] || { stain: [], region: [] };
        console.log('Current slide protocols (segregated):', currentSlideProtocols);

        // Determine protocol type based on available protocols
        const isStainProtocol = stainProtocols.some(p => p.id === protocolId);
        const isRegionProtocol = regionProtocols.some(p => p.id === protocolId);

        console.log('Protocol type detection:', { isStainProtocol, isRegionProtocol });

        // Update the appropriate protocol type
        let updatedSlideProtocols;
        if (isStainProtocol) {
            const currentStainProtocols = Array.isArray(currentSlideProtocols) ? currentSlideProtocols : currentSlideProtocols.stain || [];
            const updatedStainProtocols = currentStainProtocols.includes(protocolId)
                ? currentStainProtocols
                : [...currentStainProtocols, protocolId];

            updatedSlideProtocols = {
                stain: updatedStainProtocols,
                region: Array.isArray(currentSlideProtocols) ? [] : (currentSlideProtocols.region || [])
            };
        } else if (isRegionProtocol) {
            const currentRegionProtocols = Array.isArray(currentSlideProtocols) ? currentSlideProtocols : currentSlideProtocols.region || [];
            const updatedRegionProtocols = currentRegionProtocols.includes(protocolId)
                ? currentRegionProtocols
                : [...currentRegionProtocols, protocolId];

            updatedSlideProtocols = {
                stain: Array.isArray(currentSlideProtocols) ? [] : (currentSlideProtocols.stain || []),
                region: updatedRegionProtocols
            };
        } else {
            console.error('Unknown protocol type for ID:', protocolId);
            return;
        }

        console.log('Updated slide protocols (segregated):', updatedSlideProtocols);

        const updatedMappings = {
            ...caseProtocolMappings,
            [selectedCase.bdsaId]: {
                ...caseProtocolMappings[selectedCase.bdsaId],
                [slideId]: updatedSlideProtocols
            }
        };

        console.log('Updated mappings:', updatedMappings);

        // Use centralized data store update function
        updateCaseProtocolMappings(updatedMappings);

        // The data store will handle localStorage saving and event notifications
        // UI updates will happen automatically via the subscription
    };

    const removeProtocolMapping = (slideId, protocolId) => {
        if (!selectedCase) return;

        console.log('=== REMOVING PROTOCOL MAPPING (SEGREGATED) ===');
        console.log('Slide ID:', slideId, 'Protocol ID:', protocolId, 'Selected Case:', selectedCase.bdsaId);
        console.log('Current protocol mappings:', caseProtocolMappings);

        // Get current protocols for this slide (segregated structure)
        const currentSlideProtocols = caseProtocolMappings[selectedCase.bdsaId]?.[slideId] || { stain: [], region: [] };
        console.log('Current slide protocols (segregated):', currentSlideProtocols);

        // Determine protocol type and remove from appropriate array
        const isStainProtocol = stainProtocols.some(p => p.id === protocolId);
        const isRegionProtocol = regionProtocols.some(p => p.id === protocolId);

        console.log('Protocol type detection:', { isStainProtocol, isRegionProtocol });

        let updatedSlideProtocols;
        if (isStainProtocol) {
            const currentStainProtocols = Array.isArray(currentSlideProtocols) ? currentSlideProtocols : currentSlideProtocols.stain || [];
            const updatedStainProtocols = currentStainProtocols.filter(id => String(id) !== String(protocolId));

            updatedSlideProtocols = {
                stain: updatedStainProtocols,
                region: Array.isArray(currentSlideProtocols) ? [] : (currentSlideProtocols.region || [])
            };

            console.log(`Removed stain protocol ${protocolId}, remaining stain protocols:`, updatedStainProtocols);
        } else if (isRegionProtocol) {
            const currentRegionProtocols = Array.isArray(currentSlideProtocols) ? currentSlideProtocols : currentSlideProtocols.region || [];
            const updatedRegionProtocols = currentRegionProtocols.filter(id => String(id) !== String(protocolId));

            updatedSlideProtocols = {
                stain: Array.isArray(currentSlideProtocols) ? [] : (currentSlideProtocols.stain || []),
                region: updatedRegionProtocols
            };

            console.log(`Removed region protocol ${protocolId}, remaining region protocols:`, updatedRegionProtocols);
        } else {
            console.error('Unknown protocol type for ID:', protocolId);
            return;
        }

        console.log('Updated slide protocols (segregated):', updatedSlideProtocols);

        // Create updated mappings
        const updatedMappings = { ...caseProtocolMappings };

        if (!updatedMappings[selectedCase.bdsaId]) {
            updatedMappings[selectedCase.bdsaId] = {};
        }

        // Check if both stain and region arrays are empty
        if (updatedSlideProtocols.stain.length === 0 && updatedSlideProtocols.region.length === 0) {
            // Remove the slide entry entirely if no protocols remain
            delete updatedMappings[selectedCase.bdsaId][slideId];
            console.log(`Removed slide ${slideId} entirely (no protocols remaining)`);
        } else {
            // Update with remaining protocols
            updatedMappings[selectedCase.bdsaId][slideId] = updatedSlideProtocols;
        }

        console.log('Updated mappings after removal:', updatedMappings);

        // Use centralized data store update function
        updateCaseProtocolMappings(updatedMappings);

        // The data store will handle localStorage saving and event notifications
        // UI updates will happen automatically via the subscription
    };

    const cleanupOrphanedProtocolMappings = () => {
        if (!selectedCase) return;

        console.log('Cleaning up orphaned protocol mappings for case:', selectedCase.bdsaId);

        const updatedMappings = { ...caseProtocolMappings };
        let hasChanges = false;

        // Get all valid protocol IDs
        const validStainProtocolIds = new Set(stainProtocols.map(p => p.id));
        const validRegionProtocolIds = new Set(regionProtocols.map(p => p.id));
        const allValidProtocolIds = new Set([...validStainProtocolIds, ...validRegionProtocolIds]);

        // Clean up each slide's protocol mappings
        Object.keys(updatedMappings[selectedCase.bdsaId] || {}).forEach(slideId => {
            const currentProtocols = updatedMappings[selectedCase.bdsaId][slideId] || [];
            const validProtocols = currentProtocols.filter(protocolId => allValidProtocolIds.has(protocolId));

            if (validProtocols.length !== currentProtocols.length) {
                console.log(`Cleaned up slide ${slideId}: removed ${currentProtocols.length - validProtocols.length} orphaned protocols`);
                updatedMappings[selectedCase.bdsaId][slideId] = validProtocols;
                hasChanges = true;
            }
        });

        if (hasChanges) {
            console.log('Updated mappings after cleanup:', updatedMappings);
            updateCaseProtocolMappings(updatedMappings);
        } else {
            console.log('No orphaned protocols found');
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

        let result = Object.values(grouped);

        // Filter out mapped protocols if hideMappedProtocols is true
        if (hideMappedProtocols) {
            result = result.filter(group => group.status === 'unmapped');
        }

        return result;
    };

    const getSuggestedProtocols = (stainType) => {
        const aliases = localAliases[stainType] || [];
        return aliases.map(alias =>
            stainProtocols.find(protocol => protocol.id === alias)
        ).filter(Boolean);
    };

    const getAutoSuggestedProtocol = (stainType) => {
        const suggestions = getSuggestedProtocols(stainType);
        // Return the suggested protocol only if there's exactly one suggestion
        // If there are multiple suggestions, it's ambiguous, so return null
        return suggestions.length === 1 ? suggestions[0] : null;
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

    // Region protocol functions
    const getProtocolsForRegionType = (regionType) => {
        // Return all region protocols, not just those with matching regionType
        return regionProtocols;
    };

    const getRegionTypeDisplayName = (regionType) => {
        if (!regionSchema || !regionSchema.regions || !regionSchema.regions.properties || !regionSchema.regions.properties[regionType]) return regionType;
        return regionSchema.regions.properties[regionType].title || regionType;
    };

    const getGroupedRegionSlides = (slides) => {
        const grouped = {};
        slides.forEach(slide => {
            const regionType = slide.regionType;
            if (!regionType) return; // Skip slides without region data

            if (!grouped[regionType]) {
                grouped[regionType] = {
                    regionType: regionType,
                    slides: [],
                    count: 0,
                    status: 'unmapped'
                };
            }
            grouped[regionType].slides.push(slide);
            grouped[regionType].count++;

            // If any slide in the group is mapped, mark the group as mapped
            if (slide.status === 'mapped') {
                grouped[regionType].status = 'mapped';
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

        let result = Object.values(grouped);

        // Filter out mapped protocols if hideMappedProtocols is true
        if (hideMappedProtocols) {
            result = result.filter(group => group.status === 'unmapped');
        }

        return result;
    };

    const getSuggestedRegionProtocols = (regionType) => {
        const aliases = regionAliases[regionType] || [];
        return aliases.map(alias =>
            regionProtocols.find(protocol => protocol.id === alias)
        ).filter(Boolean);
    };

    const getAutoSuggestedRegionProtocol = (regionType) => {
        const suggestions = getSuggestedRegionProtocols(regionType);
        // Return the suggested protocol only if there's exactly one suggestion
        // If there are multiple suggestions, it's ambiguous, so return null
        return suggestions.length === 1 ? suggestions[0] : null;
    };

    const getProtocolTooltip = (protocol) => {
        if (!protocol) return '';

        const details = [];

        if (protocol.description) {
            details.push(`Description: ${protocol.description}`);
        }

        if (protocol.stainType) {
            details.push(`Stain Type: ${protocol.stainType}`);
        }

        if (protocol.antibody) {
            details.push(`Antibody: ${protocol.antibody}`);
        }

        if (protocol.technique) {
            details.push(`Technique: ${protocol.technique}`);
        }

        if (protocol.phosphoSpecific) {
            details.push(`Phospho-specific: ${protocol.phosphoSpecific}`);
        }

        if (protocol.dilution) {
            details.push(`Dilution: ${protocol.dilution}`);
        }

        if (protocol.vendor) {
            details.push(`Vendor: ${protocol.vendor}`);
        }

        // Region protocol specific fields
        if (protocol.regionType) {
            details.push(`Region Type: ${protocol.regionType}`);
        }

        if (protocol.subRegion) {
            details.push(`Sub-Region: ${protocol.subRegion}`);
        }

        if (protocol.hemisphere) {
            details.push(`Hemisphere: ${protocol.hemisphere}`);
        }

        if (protocol.sliceOrientation) {
            details.push(`Slice Orientation: ${protocol.sliceOrientation}`);
        }

        if (protocol.damage && protocol.damage.length > 0) {
            details.push(`Damage: ${protocol.damage.join(', ')}`);
        }

        return details.join('\n');
    };

    const addRegionAlias = (regionType, protocolId) => {
        const newAliases = {
            ...regionAliases,
            [regionType]: [...(regionAliases[regionType] || []), protocolId]
        };
        setRegionAliases(newAliases);
        localStorage.setItem(REGION_ALIASES_KEY, JSON.stringify(newAliases));
    };

    const removeRegionAlias = (regionType, protocolId) => {
        const newAliases = {
            ...regionAliases,
            [regionType]: (regionAliases[regionType] || []).filter(id => id !== protocolId)
        };
        setRegionAliases(newAliases);
        localStorage.setItem(REGION_ALIASES_KEY, JSON.stringify(newAliases));
    };

    const toggleRegionGroupExpansion = (regionType) => {
        const newExpanded = new Set(expandedRegionGroups);
        if (newExpanded.has(regionType)) {
            newExpanded.delete(regionType);
        } else {
            newExpanded.add(regionType);
        }
        setExpandedRegionGroups(newExpanded);
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

    const toggleStainGroupExpansion = (stainType) => {
        setExpandedStainGroups(prev => {
            const newSet = new Set(prev);
            if (newSet.has(stainType)) {
                newSet.delete(stainType);
            } else {
                newSet.add(stainType);
            }
            return newSet;
        });
    };

    const toggleSlideSelection = (slideId) => {
        setSelectedSlides(prev => {
            const newSet = new Set(prev);
            if (newSet.has(slideId)) {
                newSet.delete(slideId);
            } else {
                newSet.add(slideId);
            }
            return newSet;
        });
    };

    const selectAllSlidesInGroup = (group) => {
        const allSlideIds = group.slides.map(slide => slide.id);
        setSelectedSlides(prev => new Set([...prev, ...allSlideIds]));
    };

    const deselectAllSlidesInGroup = (group) => {
        const allSlideIds = group.slides.map(slide => slide.id);
        setSelectedSlides(prev => {
            const newSet = new Set(prev);
            allSlideIds.forEach(id => newSet.delete(id));
            return newSet;
        });
    };

    const getSelectedSlidesInGroup = (group) => {
        return group.slides.filter(slide => selectedSlides.has(slide.id));
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
            // Use BDSA.localCaseId as the authoritative source
            const caseId = row.BDSA?.localCaseId || row[columnMapping.localCaseId];
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

    // Memoized sorted case IDs - only recalculates when actual data changes, not during editing
    const sortedCaseIds = useMemo(() => {
        // If currently editing, don't re-sort to prevent disorienting jumps
        if (isEditing) {
            return previousSortedDataRef.current;
        }
        const newData = getUniqueCaseIds();
        previousSortedDataRef.current = newData;
        return newData;
    }, [csvData, caseIdMappings, columnMapping.localCaseId, showMappedCases, sortField, sortDirection, isEditing]);

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
        console.log('bdsaCaseId:', bdsaCaseId);
        console.log('current caseIdMappings:', caseIdMappings);

        const newMappings = { ...caseIdMappings };
        if (bdsaCaseId) {
            newMappings[localCaseId] = bdsaCaseId;
        } else {
            delete newMappings[localCaseId];
        }

        console.log('newMappings:', newMappings);
        console.log('Calling updateCaseIdMappings from data store...');

        // Use centralized data store update function
        updateCaseIdMappings(newMappings);

        console.log('updateCaseIdMappings called successfully');

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
            for (let i = 0; i < unmappedCases.length; i++) {
                // Check if generation was cancelled
                if (generateAllCancelled) {
                    console.log('Generation cancelled by user');
                    break;
                }

                const caseItem = unmappedCases[i];
                console.log(`Generating BDSA Case ID for case ${i + 1}/${unmappedCases.length}: ${caseItem.localCaseId}`);

                // Generate the BDSA Case ID
                const nextNumber = getNextSequentialNumber();
                const bdsaCaseId = `BDSA-${bdsaInstitutionId.padStart(3, '0')}-${nextNumber.toString().padStart(4, '0')}`;

                // Update the mapping
                updateCaseIdMapping(caseItem.localCaseId, bdsaCaseId);

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
                                                <tr key={index} className={isDuplicate ? 'duplicate-bdsa-case' : ''}>
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
                                                            onChange={(e) => {
                                                                // Update local state only - no data store updates until blur/enter
                                                                setLocalInputValues(prev => ({
                                                                    ...prev,
                                                                    [item.localCaseId]: e.target.value
                                                                }));
                                                                // Set editing state to prevent auto-sorting
                                                                setIsEditing(true);
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
                                                                // Clear editing state to allow re-sorting
                                                                setIsEditing(false);
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    console.log('Enter pressed, saving value:', e.target.value);
                                                                    updateCaseIdMapping(item.localCaseId, e.target.value);
                                                                    // Clear local state after saving
                                                                    setLocalInputValues(prev => {
                                                                        const newState = { ...prev };
                                                                        delete newState[item.localCaseId];
                                                                        return newState;
                                                                    });
                                                                    // Clear editing state to allow re-sorting
                                                                    setIsEditing(false);
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
                                    <div className="action-buttons">
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

                                        <button
                                            type="button"
                                            className={`hide-mapped-btn ${hideMappedProtocols ? 'active' : ''}`}
                                            onClick={() => setHideMappedProtocols(!hideMappedProtocols)}
                                            title={hideMappedProtocols ? 'Show all protocols' : 'Hide mapped protocols'}
                                        >
                                            {hideMappedProtocols ? '👁️ Show All' : '🙈 Hide Mapped'}
                                        </button>

                                        <button
                                            type="button"
                                            className="cleanup-orphaned-btn"
                                            onClick={() => {
                                                console.log('=== CLEANUP ORPHANED PROTOCOLS ===');
                                                console.log('Current protocol mappings:', caseProtocolMappings);

                                                // Get all valid protocol IDs
                                                const validStainProtocolIds = new Set(stainProtocols.map(p => String(p.id)));
                                                const validRegionProtocolIds = new Set(regionProtocols.map(p => String(p.id)));
                                                const allValidProtocolIds = new Set([...validStainProtocolIds, ...validRegionProtocolIds]);

                                                console.log('Valid protocol IDs:', Array.from(allValidProtocolIds));

                                                const updatedMappings = { ...caseProtocolMappings };
                                                let hasChanges = false;

                                                // Clean up each case
                                                Object.keys(updatedMappings).forEach(caseId => {
                                                    Object.keys(updatedMappings[caseId] || {}).forEach(slideId => {
                                                        const currentProtocols = updatedMappings[caseId][slideId] || [];
                                                        const validProtocols = currentProtocols.filter(id => allValidProtocolIds.has(String(id)));

                                                        if (validProtocols.length !== currentProtocols.length) {
                                                            console.log(`Cleaned slide ${slideId}: removed ${currentProtocols.length - validProtocols.length} orphaned protocols`);
                                                            updatedMappings[caseId][slideId] = validProtocols;
                                                            hasChanges = true;
                                                        }
                                                    });
                                                });

                                                if (hasChanges) {
                                                    console.log('Updated mappings after cleanup:', updatedMappings);
                                                    updateCaseProtocolMappings(updatedMappings);

                                                    // Force refresh the grid to show updated state
                                                    setTimeout(() => {
                                                        if (gridRef.current && gridRef.current.api) {
                                                            gridRef.current.api.refreshCells({ force: true });
                                                            console.log('Grid refreshed after cleanup');
                                                        }
                                                    }, 100);

                                                    alert('Orphaned protocols removed!');
                                                } else {
                                                    console.log('No orphaned protocols found');
                                                    alert('No orphaned protocols found');
                                                }
                                            }}
                                            title="Remove orphaned protocol mappings that reference non-existent protocols"
                                            style={{
                                                marginLeft: '8px',
                                                padding: '6px 12px',
                                                backgroundColor: '#ffc107',
                                                color: '#000',
                                                border: '1px solid #ffc107',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '0.9rem'
                                            }}
                                        >
                                            🧹 Cleanup Orphaned
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
                                                <span className="stain-type">{getStainTypeDisplayName(group.stainType)}</span>
                                                <span className={`status ${group.status}`}>
                                                    {group.status === 'mapped' ? (() => {
                                                        // Count total protocols for this group
                                                        const allProtocols = new Set();
                                                        group.slides.forEach(slide => {
                                                            const slideProtocols = getSlideProtocols(slide.id, 'stain');
                                                            if (Array.isArray(slideProtocols)) {
                                                                slideProtocols.forEach(protocolId => allProtocols.add(protocolId));
                                                            }
                                                        });
                                                        const protocolCount = allProtocols.size;
                                                        return `✓ Mapped (${protocolCount} protocol${protocolCount !== 1 ? 's' : ''})`;
                                                    })() : '⏳ Unmapped'}
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



                                            {group.status === 'unmapped' && (
                                                <div className="protocol-selection">
                                                    {/* Auto-suggest and Alias management */}
                                                    <div className="alias-management">
                                                        <small>
                                                            <strong>Quick Actions:</strong>



                                                            {/* Protocol buttons */}
                                                            {stainProtocols.map(protocol => {
                                                                const isAlias = (localAliases[group.stainType] || []).includes(protocol.id);
                                                                const isIgnoreProtocol = protocol.id === 'ignore';

                                                                // Check if this protocol is already applied to any slide in this group
                                                                const isApplied = group.slides.some(slide => {
                                                                    const slideProtocols = getSlideProtocols(slide.id, 'stain');
                                                                    return Array.isArray(slideProtocols) && slideProtocols.includes(protocol.id);
                                                                });

                                                                // Determine which slides to operate on
                                                                const isExpanded = expandedStainGroups.has(group.stainType);
                                                                const selectedSlidesInGroup = getSelectedSlidesInGroup(group);
                                                                const slidesToOperateOn = isExpanded && selectedSlidesInGroup.length > 0
                                                                    ? selectedSlidesInGroup
                                                                    : group.slides;

                                                                return (
                                                                    <button
                                                                        key={protocol.id}
                                                                        type="button"
                                                                        className={`protocol-btn ${isApplied ? 'applied' : isAlias ? 'suggested' : isIgnoreProtocol ? 'ignore' : 'standard'}`}
                                                                        onClick={() => {
                                                                            if (isApplied) {
                                                                                // Remove the protocol from selected slides (or all if not expanded)
                                                                                slidesToOperateOn.forEach(slide => {
                                                                                    removeProtocolMapping(slide.id, protocol.id);
                                                                                });
                                                                            } else {
                                                                                // Apply the protocol to selected slides (or all if not expanded)
                                                                                slidesToOperateOn.forEach(slide => {
                                                                                    handleProtocolMapping(slide.id, protocol.id);
                                                                                });

                                                                                // Also add to suggestions if not already there (but not for ignore protocol)
                                                                                if (!isAlias && !isIgnoreProtocol) {
                                                                                    addLocalAlias(group.stainType, protocol.id);
                                                                                }
                                                                            }
                                                                        }}
                                                                        title={`${isApplied ?
                                                                            `Remove "${protocol.name}" from ${isExpanded && selectedSlidesInGroup.length > 0 ? `${selectedSlidesInGroup.length} selected slides` : `all ${group.count} slides`}` :
                                                                            `Apply "${protocol.name}" to ${isExpanded && selectedSlidesInGroup.length > 0 ? `${selectedSlidesInGroup.length} selected slides` : `all ${group.count} slides`}${isAlias ? ' (suggested)' : isIgnoreProtocol ? ' (exclude from processing)' : ''}`
                                                                            }\n\n${getProtocolTooltip(protocol)}`}
                                                                    >
                                                                        {isApplied ? '✓' : isAlias ? '⭐' : isIgnoreProtocol ? '🚫' : '+'} {protocol.name}
                                                                        {isExpanded && selectedSlidesInGroup.length > 0 && (
                                                                            <span className="selected-indicator"> ({selectedSlidesInGroup.length})</span>
                                                                        )}
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
                                                                const slideProtocols = getSlideProtocols(slide.id, 'stain');
                                                                if (Array.isArray(slideProtocols)) {
                                                                    slideProtocols.forEach(protocolId => allProtocols.add(protocolId));
                                                                }
                                                            });

                                                            return Array.from(allProtocols).map(protocolId => {
                                                                const protocol = stainProtocols.find(p => p.id === protocolId);
                                                                const isIgnoreProtocol = protocolId === 'ignore';

                                                                // Debug protocol lookup
                                                                if (!protocol) {
                                                                    console.log(`Stain protocol not found for ID: ${protocolId}`, 'Available protocols:', stainProtocols);
                                                                    console.log('Protocol ID type:', typeof protocolId, 'Protocol ID value:', protocolId);
                                                                }

                                                                return (
                                                                    <div key={protocolId} className={`mapped-protocol-item ${isIgnoreProtocol ? 'ignore-protocol' : ''}`}>
                                                                        <span
                                                                            className={`protocol-name ${isIgnoreProtocol ? 'ignore-protocol-name' : ''}`}
                                                                            title={getProtocolTooltip(protocol)}
                                                                            style={{ cursor: 'help' }}
                                                                        >
                                                                            {isIgnoreProtocol ? '🚫 ' : ''}{protocol?.name || 'Unknown Protocol'}
                                                                        </span>
                                                                        <button
                                                                            type="button"
                                                                            className="remove-protocol-btn"
                                                                            onClick={() => {
                                                                                console.log('=== STAIN PROTOCOL REMOVAL BUTTON CLICKED ===');
                                                                                console.log('Protocol ID to remove:', protocolId);
                                                                                console.log('Group slides:', group.slides);
                                                                                console.log('Selected case:', selectedCase);
                                                                                console.log('Current protocol mappings:', caseProtocolMappings);

                                                                                group.slides.forEach((slide, index) => {
                                                                                    console.log(`=== Processing stain slide ${index + 1}/${group.slides.length} ===`);
                                                                                    console.log(`Slide ID: ${slide.id}`);
                                                                                    console.log(`About to call removeProtocolMapping for slide: ${slide.id}, protocol: ${protocolId}`);
                                                                                    removeProtocolMapping(slide.id, protocolId);
                                                                                });
                                                                            }}
                                                                            title={`Force remove "${protocol?.name || 'Unknown Protocol'}" from all slides in this group`}
                                                                            style={{
                                                                                backgroundColor: '#dc3545',
                                                                                color: 'white',
                                                                                border: '1px solid #dc3545',
                                                                                borderRadius: '3px',
                                                                                cursor: 'pointer',
                                                                                fontWeight: 'bold'
                                                                            }}
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
                                                                const isIgnoreProtocol = protocol.id === 'ignore';

                                                                // Check if this protocol is already applied to all slides in the group
                                                                const isAlreadyApplied = group.slides.every(slide => {
                                                                    const slideProtocols = getSlideProtocols(slide.id, 'stain');
                                                                    return Array.isArray(slideProtocols) && slideProtocols.includes(protocol.id);
                                                                });

                                                                if (isAlreadyApplied) return null;

                                                                // Determine which slides to operate on
                                                                const isExpanded = expandedStainGroups.has(group.stainType);
                                                                const selectedSlidesInGroup = getSelectedSlidesInGroup(group);
                                                                const slidesToOperateOn = isExpanded && selectedSlidesInGroup.length > 0
                                                                    ? selectedSlidesInGroup
                                                                    : group.slides;

                                                                return (
                                                                    <button
                                                                        key={protocol.id}
                                                                        type="button"
                                                                        className={`add-protocol-btn-small ${isIgnoreProtocol ? 'ignore-protocol-btn' : ''}`}
                                                                        onClick={() => {
                                                                            slidesToOperateOn.forEach(slide => {
                                                                                handleProtocolMapping(slide.id, protocol.id);
                                                                            });
                                                                        }}
                                                                        title={`Add "${protocol.name}" to ${isExpanded && selectedSlidesInGroup.length > 0 ? `${selectedSlidesInGroup.length} selected slides` : `all slides in this group`}${isIgnoreProtocol ? ' (exclude from processing)' : ''}\n\n${getProtocolTooltip(protocol)}`}
                                                                    >
                                                                        {isIgnoreProtocol ? '🚫' : '+'} {protocol.name}
                                                                        {isExpanded && selectedSlidesInGroup.length > 0 && (
                                                                            <span className="selected-indicator"> ({selectedSlidesInGroup.length})</span>
                                                                        )}
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

                                {/* Region Protocol Mapping Section */}
                                {columnMapping.localRegionId && (
                                    <div className="region-protocols-section">
                                        <h3>Region Protocol Mapping</h3>
                                        <div className="region-slides-mapping">
                                            {getGroupedRegionSlides(selectedCase.slides).map((group, groupIndex) => (
                                                <div key={`${group.regionType}-${groupIndex}`} className="slide-mapping">
                                                    <div className="slide-info">
                                                        <div className="slide-header">
                                                            <span className="slide-id">
                                                                {group.regionType} ({group.count} slides)
                                                            </span>
                                                            {group.count > 1 && (
                                                                <button
                                                                    type="button"
                                                                    className="expand-toggle-btn"
                                                                    onClick={() => toggleRegionGroupExpansion(group.regionType)}
                                                                    title={expandedRegionGroups.has(group.regionType) ? 'Collapse individual slides' : 'Show individual slides'}
                                                                >
                                                                    {expandedRegionGroups.has(group.regionType) ? '▼' : '▶'}
                                                                </button>
                                                            )}
                                                        </div>
                                                        <span className="region-type">{getRegionTypeDisplayName(group.regionType)}</span>
                                                        <span className={`status ${group.status}`}>
                                                            {group.status === 'mapped' ? (() => {
                                                                // Count total protocols for this group
                                                                const allProtocols = new Set();
                                                                group.slides.forEach(slide => {
                                                                    const slideProtocols = getSlideProtocols(slide.id, 'region');
                                                                    if (Array.isArray(slideProtocols)) {
                                                                        slideProtocols.forEach(protocolId => allProtocols.add(protocolId));
                                                                    }
                                                                });
                                                                const protocolCount = allProtocols.size;
                                                                return `✓ Mapped (${protocolCount} protocol${protocolCount !== 1 ? 's' : ''})`;
                                                            })() : '⏳ Unmapped'}
                                                        </span>
                                                    </div>

                                                    {/* Individual slides when expanded */}
                                                    {expandedRegionGroups.has(group.regionType) && group.slides.length > 1 && (
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
                                                                        <span className="slide-detail-id">{slide.filename || slide.localRegionId}</span>
                                                                    </label>
                                                                    <span className={`slide-detail-status ${slide.status}`}>
                                                                        {slide.status === 'mapped' ? '✓' : '⏳'}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {group.status === 'unmapped' && (
                                                        <div className="protocol-selection">
                                                            {/* Auto-suggest and Alias management */}
                                                            <div className="alias-management">
                                                                <small>
                                                                    <strong>Quick Actions:</strong>

                                                                    {/* Region Protocol buttons */}
                                                                    {regionProtocols.map(protocol => {
                                                                        const isAlias = (regionAliases[group.regionType] || []).includes(protocol.id);
                                                                        const isIgnoreProtocol = protocol.id === 'ignore';

                                                                        // Check if this protocol is already applied to any slide in this group
                                                                        const isApplied = group.slides.some(slide => {
                                                                            const slideProtocols = getSlideProtocols(slide.id, 'region');
                                                                            return Array.isArray(slideProtocols) && slideProtocols.includes(protocol.id);
                                                                        });

                                                                        // Determine which slides to operate on
                                                                        const isExpanded = expandedRegionGroups.has(group.regionType);
                                                                        const selectedSlidesInGroup = getSelectedSlidesInGroup(group);
                                                                        const slidesToOperateOn = isExpanded && selectedSlidesInGroup.length > 0
                                                                            ? selectedSlidesInGroup
                                                                            : group.slides;

                                                                        return (
                                                                            <button
                                                                                key={protocol.id}
                                                                                type="button"
                                                                                className={`protocol-btn ${isApplied ? 'applied' : isAlias ? 'suggested' : isIgnoreProtocol ? 'ignore' : 'standard'}`}
                                                                                onClick={() => {
                                                                                    if (isApplied) {
                                                                                        // Remove the protocol from selected slides (or all if not expanded)
                                                                                        slidesToOperateOn.forEach(slide => {
                                                                                            removeProtocolMapping(slide.id, protocol.id);
                                                                                        });
                                                                                    } else {
                                                                                        // Apply the protocol to selected slides (or all if not expanded)
                                                                                        slidesToOperateOn.forEach(slide => {
                                                                                            handleProtocolMapping(slide.id, protocol.id);
                                                                                        });

                                                                                        // Also add to suggestions if not already there (but not for ignore protocol)
                                                                                        if (!isAlias && !isIgnoreProtocol) {
                                                                                            addRegionAlias(group.regionType, protocol.id);
                                                                                        }
                                                                                    }
                                                                                }}
                                                                                title={`${isApplied ?
                                                                                    `Remove "${protocol.name}" from ${isExpanded && selectedSlidesInGroup.length > 0 ? `${selectedSlidesInGroup.length} selected slides` : `all ${group.count} slides`}` :
                                                                                    `Apply "${protocol.name}" to ${isExpanded && selectedSlidesInGroup.length > 0 ? `${selectedSlidesInGroup.length} selected slides` : `all ${group.count} slides`}${isAlias ? ' (suggested)' : isIgnoreProtocol ? ' (exclude from processing)' : ''}`
                                                                                    }\n\n${getProtocolTooltip(protocol)}`}
                                                                            >
                                                                                {isApplied ? '✓' : isAlias ? '⭐' : isIgnoreProtocol ? '🚫' : '+'} {protocol.name}
                                                                                {isExpanded && selectedSlidesInGroup.length > 0 && (
                                                                                    <span className="selected-indicator"> ({selectedSlidesInGroup.length})</span>
                                                                                )}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </small>
                                                            </div>

                                                            {regionProtocols.length === 0 && (
                                                                <div className="no-protocols">
                                                                    <p>No region protocols available. Create some protocols first.</p>
                                                                    <button
                                                                        className="add-protocol-btn"
                                                                        onClick={() => window.location.hash = 'protocols'}
                                                                    >
                                                                        + Add New Region Protocol
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
                                                                        const slideProtocols = getSlideProtocols(slide.id, 'region');
                                                                        if (Array.isArray(slideProtocols)) {
                                                                            slideProtocols.forEach(protocolId => allProtocols.add(protocolId));
                                                                        }
                                                                    });

                                                                    return Array.from(allProtocols).map(protocolId => {
                                                                        const protocol = regionProtocols.find(p => p.id === protocolId);
                                                                        const isIgnoreProtocol = protocolId === 'ignore';

                                                                        // Debug protocol lookup
                                                                        if (!protocol) {
                                                                            console.log(`Region protocol not found for ID: ${protocolId}`, 'Available protocols:', regionProtocols);
                                                                            console.log('Protocol ID type:', typeof protocolId, 'Protocol ID value:', protocolId);
                                                                            console.log('Available protocol IDs:', regionProtocols.map(p => ({ id: p.id, name: p.name, type: typeof p.id })));
                                                                            console.log('Available protocol ID strings:', regionProtocols.map(p => String(p.id)));
                                                                            console.log('Looking for:', String(protocolId));
                                                                        }

                                                                        return (
                                                                            <div key={protocolId} className={`mapped-protocol-item ${isIgnoreProtocol ? 'ignore-protocol' : ''}`}>
                                                                                <span
                                                                                    className={`protocol-name ${isIgnoreProtocol ? 'ignore-protocol-name' : ''}`}
                                                                                    title={getProtocolTooltip(protocol)}
                                                                                    style={{ cursor: 'help' }}
                                                                                >
                                                                                    {isIgnoreProtocol ? '🚫 ' : ''}{protocol?.name || 'Unknown Protocol'}
                                                                                </span>
                                                                                <button
                                                                                    type="button"
                                                                                    className="remove-protocol-btn"
                                                                                    onClick={() => {
                                                                                        console.log('=== REGION PROTOCOL REMOVAL BUTTON CLICKED ===');
                                                                                        console.log('Protocol ID to remove:', protocolId);
                                                                                        console.log('Current protocol mappings:', caseProtocolMappings);

                                                                                        // Use the centralized removeProtocolMapping function for each slide
                                                                                        console.log('=== REGION PROTOCOL DELETE BUTTON (SEGREGATED) ===');
                                                                                        console.log('Protocol ID to remove:', protocolId);
                                                                                        console.log('Selected case:', selectedCase);
                                                                                        console.log('Current protocol mappings:', caseProtocolMappings);

                                                                                        group.slides.forEach((slide, index) => {
                                                                                            console.log(`=== Processing region slide ${index + 1}/${group.slides.length} ===`);
                                                                                            console.log(`Slide ID: ${slide.id}`);
                                                                                            console.log(`About to call removeProtocolMapping for slide: ${slide.id}, protocol: ${protocolId}`);
                                                                                            removeProtocolMapping(slide.id, protocolId);
                                                                                        });
                                                                                    }}
                                                                                    title={`Force remove "${protocol?.name || 'Unknown Protocol'}" from all slides in this group`}
                                                                                    style={{
                                                                                        backgroundColor: '#dc3545',
                                                                                        color: 'white',
                                                                                        border: '1px solid #dc3545',
                                                                                        borderRadius: '3px',
                                                                                        cursor: 'pointer',
                                                                                        fontWeight: 'bold'
                                                                                    }}
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
                                                                    {regionProtocols.map(protocol => {
                                                                        const isIgnoreProtocol = protocol.id === 'ignore';

                                                                        // Check if this protocol is already applied to all slides in the group
                                                                        const isAlreadyApplied = group.slides.every(slide => {
                                                                            const slideProtocols = getSlideProtocols(slide.id, 'region');
                                                                            return Array.isArray(slideProtocols) && slideProtocols.includes(protocol.id);
                                                                        });

                                                                        if (isAlreadyApplied) return null;

                                                                        // Determine which slides to operate on
                                                                        const isExpanded = expandedRegionGroups.has(group.regionType);
                                                                        const selectedSlidesInGroup = getSelectedSlidesInGroup(group);
                                                                        const slidesToOperateOn = isExpanded && selectedSlidesInGroup.length > 0
                                                                            ? selectedSlidesInGroup
                                                                            : group.slides;

                                                                        return (
                                                                            <button
                                                                                key={protocol.id}
                                                                                type="button"
                                                                                className={`add-protocol-btn-small ${isIgnoreProtocol ? 'ignore-protocol-btn' : ''}`}
                                                                                onClick={() => {
                                                                                    slidesToOperateOn.forEach(slide => {
                                                                                        handleProtocolMapping(slide.id, protocol.id);
                                                                                    });
                                                                                }}
                                                                                title={`Add "${protocol.name}" to ${isExpanded && selectedSlidesInGroup.length > 0 ? `${selectedSlidesInGroup.length} selected slides` : `all slides in this group`}${isIgnoreProtocol ? ' (exclude from processing)' : ''}\n\n${getProtocolTooltip(protocol)}`}
                                                                            >
                                                                                {isIgnoreProtocol ? '🚫' : '+'} {protocol.name}
                                                                                {isExpanded && selectedSlidesInGroup.length > 0 && (
                                                                                    <span className="selected-indicator"> ({selectedSlidesInGroup.length})</span>
                                                                                )}
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
                                )}
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