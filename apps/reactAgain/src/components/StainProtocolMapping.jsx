import React, { useState, useEffect } from 'react';
import dataStore from '../utils/dataStore';
import protocolStore from '../utils/protocolStore';
import './StainProtocolMapping.css';

const StainProtocolMapping = () => {
    const [dataStatus, setDataStatus] = useState(dataStore.getStatus());
    const [stainProtocols, setStainProtocols] = useState(protocolStore.stainProtocols);
    const [availableProtocols, setAvailableProtocols] = useState([]);
    const [cases, setCases] = useState([]);
    const [currentCaseIndex, setCurrentCaseIndex] = useState(0);
    const [expandedGroups, setExpandedGroups] = useState(new Set());

    // Subscribe to data store changes
    useEffect(() => {
        const unsubscribe = dataStore.subscribe(() => {
            setDataStatus(dataStore.getStatus());
        });
        return unsubscribe;
    }, []);

    // Subscribe to protocol store changes
    useEffect(() => {
        // Clear localStorage to remove any fake protocols I added
        localStorage.removeItem('bdsa_stain_protocols');

        const unsubscribeProtocols = protocolStore.subscribe(() => {
            setStainProtocols(protocolStore.stainProtocols);
            setAvailableProtocols(protocolStore.stainProtocols || []);
        });

        // Initial load
        setStainProtocols(protocolStore.stainProtocols);
        setAvailableProtocols(protocolStore.stainProtocols || []);

        return unsubscribeProtocols;
    }, []);

    // Generate cases with unmapped stain slides when data changes
    useEffect(() => {
        if (dataStatus.processedData && dataStatus.processedData.length > 0) {
            const allCasesWithStainSlides = dataStore.generateUnmappedCases();
            // The function now returns all cases with stain slides, so we can use them directly
            setCases(allCasesWithStainSlides);
            // Reset to first case when cases change
            setCurrentCaseIndex(0);
        }
    }, [dataStatus.processedData]);

    // Get all slides with stain types for the case (regardless of mapping status)
    const getAllStainSlides = (caseData) => {
        if (!caseData || !caseData.slides) return [];
        return caseData.slides.filter(slide =>
            slide.stainType // Show all slides that have a stain type
        );
    };

    // Group slides by stain type
    const groupSlidesByStainType = (slides) => {
        const groups = {};
        slides.forEach(slide => {
            const stainType = slide.stainType;
            if (!groups[stainType]) {
                groups[stainType] = [];
            }
            groups[stainType].push(slide);
        });
        return groups;
    };

    // Navigation functions
    const handlePreviousCase = () => {
        const newIndex = currentCaseIndex > 0 ? currentCaseIndex - 1 : cases.length - 1;
        setCurrentCaseIndex(newIndex);
    };

    const handleNextCase = () => {
        const newIndex = currentCaseIndex < cases.length - 1 ? currentCaseIndex + 1 : 0;
        setCurrentCaseIndex(newIndex);
    };

    // Toggle group expansion
    const toggleGroupExpansion = (stainType) => {
        const newExpanded = new Set(expandedGroups);
        if (newExpanded.has(stainType)) {
            newExpanded.delete(stainType);
        } else {
            newExpanded.add(stainType);
        }
        setExpandedGroups(newExpanded);
    };

    const handleApplyStainProtocol = (slides, protocolId) => {
        console.log('Applying stain protocol', protocolId, 'to slides:', slides);

        // Get the current case
        const currentCase = cases[currentCaseIndex];
        if (!currentCase) return;

        // Apply protocol to each slide
        slides.forEach(slide => {
            dataStore.addProtocolMapping(currentCase.bdsaId, slide.id, protocolId, 'stain');
        });

        console.log(`✅ Applied protocol ${protocolId} to ${slides.length} slides`);
    };

    const handleRemoveStainProtocol = (slides, protocolToRemove) => {
        console.log('🔍 Removing stain protocol', protocolToRemove, 'from slides:', slides);
        console.log('🔍 Current case:', cases[currentCaseIndex]);

        // Get the current case
        const currentCase = cases[currentCaseIndex];
        if (!currentCase) {
            console.error('❌ No current case found');
            return;
        }

        // Remove protocol from each slide
        slides.forEach(slide => {
            console.log(`🔍 Removing ${protocolToRemove} from slide ${slide.id} (${slide.filename})`);
            console.log(`🔍 Slide current protocols:`, slide.stainProtocols);
            dataStore.removeProtocolMapping(currentCase.bdsaId, slide.id, protocolToRemove, 'stain');
        });

        console.log(`✅ Removed protocol ${protocolToRemove} from ${slides.length} slides`);
    };

    if (cases.length === 0) {
        return (
            <div className="stain-protocol-mapping">
                <div className="header">
                    <h2>Stain Protocol Mapping</h2>
                    <p>No cases with stain slides found.</p>
                </div>
                <div className="no-cases">
                    <p>Make sure you have:</p>
                    <ul>
                        <li>Loaded data with BDSA Case IDs assigned</li>
                        <li>Local Stain IDs in your data</li>
                    </ul>
                </div>
            </div>
        );
    }

    const currentCase = cases[currentCaseIndex];
    const allStainSlides = getAllStainSlides(currentCase);
    const stainGroups = groupSlidesByStainType(allStainSlides);

    // Debug logging
    console.log('🔍 DEBUG - Current case:', {
        bdsaId: currentCase.bdsaId,
        localCaseId: currentCase.localCaseId,
        totalSlides: currentCase.slides.length,
        stainSlides: allStainSlides.length,
        allSlides: currentCase.slides.map(s => ({
            id: s.id,
            stainType: s.stainType,
            status: s.status,
            hasStainProtocol: s.hasStainProtocol
        }))
    });

    console.log('🔍 DEBUG - Stain groups:', stainGroups);

    return (
        <div className="stain-protocol-mapping">
            <div className="header">
                <div className="case-navigation-compact">
                    <button
                        className="nav-btn prev-btn"
                        onClick={handlePreviousCase}
                        disabled={cases.length <= 1}
                    >
                        ←
                    </button>
                    <div className="case-pill">
                        <div className="case-id">{currentCase.bdsaId}</div>
                        <div className="case-details">Local: {currentCase.localCaseId} • {currentCaseIndex + 1} of {cases.length}</div>
                    </div>
                    <button
                        className="nav-btn next-btn"
                        onClick={handleNextCase}
                        disabled={cases.length <= 1}
                    >
                        →
                    </button>
                </div>
            </div>

            <div className="mapping-interface">
                <h3>Map Stain Protocols to Slides</h3>
                <p>Select a stain protocol for each group of slides with the same stain type.</p>

                {Object.keys(stainGroups).length === 0 ? (
                    <div className="no-unmapped-slides">
                        <p>No slides with stain types found in this case.</p>
                    </div>
                ) : (
                    <div className="stain-groups">
                        {Object.entries(stainGroups).map(([stainType, slides]) => {
                            const isExpanded = expandedGroups.has(stainType);
                            const mappedCount = slides.filter(s => s.status === 'mapped').length;
                            const unmappedCount = slides.filter(s => s.status === 'unmapped').length;

                            // Find all protocols that are applied to any slide in this group
                            const allGroupProtocols = slides.length > 0 ? [...new Set(
                                slides.flatMap(slide => slide.stainProtocols || [])
                            )] : [];

                            console.log(`🔍 Group ${stainType} protocols:`, allGroupProtocols);
                            console.log(`🔍 Available protocols:`, availableProtocols.map(p => p.name));
                            console.log(`🔍 Filtered add protocols:`, availableProtocols
                                .filter(protocol => !allGroupProtocols.includes(protocol.name))
                                .map(p => p.name));

                            return (
                                <div key={stainType} className="stain-group">
                                    <div
                                        className="group-header clickable"
                                        onClick={() => toggleGroupExpansion(stainType)}
                                    >
                                        <div className="group-title">
                                            <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                                            <h4>Stain Type: {stainType}</h4>
                                        </div>
                                        <div className="group-stats">
                                            <p>{slides.length} slide(s)</p>
                                            {mappedCount > 0 && <span className="mapped-count">({mappedCount} mapped)</span>}
                                            {unmappedCount > 0 && <span className="unmapped-count">({unmappedCount} unmapped)</span>}
                                        </div>
                                    </div>

                                    {/* Group-level protocols */}
                                    {allGroupProtocols.length > 0 && (
                                        <div className="group-protocols">
                                            <strong>Group Protocols:</strong>
                                            <div className="protocol-chips">
                                                {allGroupProtocols.map((protocol, idx) => (
                                                    <span key={idx} className="protocol-chip group-chip">
                                                        {protocol}
                                                        <button
                                                            className="remove-protocol-btn"
                                                            onClick={() => handleRemoveStainProtocol(slides, protocol)}
                                                            title={`Remove ${protocol} from all slides`}
                                                        >
                                                            ×
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Protocol selection - always visible */}
                                    <div className="protocol-selection">
                                        <label>Add Stain Protocol:</label>
                                        <div className="available-protocols">
                                            {availableProtocols
                                                .filter(protocol => !allGroupProtocols.includes(protocol.name))
                                                .map(protocol => (
                                                    <button
                                                        key={protocol.id}
                                                        className="add-protocol-btn"
                                                        onClick={() => handleApplyStainProtocol(slides, protocol.id)}
                                                        title={`Add ${protocol.name} to all slides`}
                                                    >
                                                        + {protocol.name}
                                                    </button>
                                                ))}
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="slide-list">
                                            {slides.map(slide => (
                                                <div key={slide.id} className={`slide-item ${slide.status === 'mapped' ? 'mapped' : 'unmapped'}`}>
                                                    <div className="slide-main-info">
                                                        <span>File: {slide.filename}</span>
                                                        <span className="slide-id">ID: {slide.id}</span>
                                                        {slide.regionType && (
                                                            <span>Region: {slide.regionType}</span>
                                                        )}
                                                        <span className="status-indicator">
                                                            {slide.status === 'mapped' ? '✓ Mapped' : '○ Unmapped'}
                                                        </span>
                                                    </div>
                                                    {slide.stainProtocols && slide.stainProtocols.length > 0 && (
                                                        <div className="existing-protocols">
                                                            <strong>Existing Protocols:</strong>
                                                            <div className="protocol-chips">
                                                                {slide.stainProtocols.map((protocol, idx) => (
                                                                    <span key={idx} className="protocol-chip">
                                                                        {protocol}
                                                                        <button
                                                                            className="remove-protocol-btn"
                                                                            onClick={() => handleRemoveStainProtocol([slide], protocol)}
                                                                            title={`Remove ${protocol}`}
                                                                        >
                                                                            ×
                                                                        </button>
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StainProtocolMapping;
