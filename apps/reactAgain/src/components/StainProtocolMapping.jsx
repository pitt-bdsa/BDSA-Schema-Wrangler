import React, { useState, useEffect } from 'react';
import dataStore from '../utils/dataStore';
import protocolStore from '../utils/protocolStore';
import './StainProtocolMapping.css';

const StainProtocolMapping = () => {
    const [dataStatus, setDataStatus] = useState(dataStore.getStatus());
    const [stainProtocols, setStainProtocols] = useState(protocolStore.stainProtocols);
    const [cases, setCases] = useState([]);
    const [currentCaseIndex, setCurrentCaseIndex] = useState(0);

    // Subscribe to data store changes
    useEffect(() => {
        const unsubscribe = dataStore.subscribe(() => {
            setDataStatus(dataStore.getStatus());
        });
        return unsubscribe;
    }, []);

    // Subscribe to protocol store changes
    useEffect(() => {
        const unsubscribeProtocols = protocolStore.subscribe(() => {
            setStainProtocols(protocolStore.stainProtocols);
        });
        return unsubscribeProtocols;
    }, []);

    // Generate cases with unmapped stain slides when data changes
    useEffect(() => {
        if (dataStatus.processedData && dataStatus.processedData.length > 0) {
            const allUnmappedCases = dataStore.generateUnmappedCases();
            // Filter to only cases that have slides with stain types
            const casesWithStainSlides = allUnmappedCases.filter(caseData => {
                const stainSlides = getAllStainSlides(caseData);
                return stainSlides.length > 0;
            });
            setCases(casesWithStainSlides);
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

    const handleApplyStainProtocol = (slides, protocolId) => {
        // TODO: Implement stain protocol application
        console.log('Applying stain protocol', protocolId, 'to slides:', slides);
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
                <h2>Stain Protocol Mapping</h2>
                <div className="case-navigation">
                    <button
                        className="nav-btn prev-btn"
                        onClick={handlePreviousCase}
                        disabled={cases.length <= 1}
                    >
                        ← Previous
                    </button>
                    <div className="case-info">
                        <h3>{currentCase.bdsaId}</h3>
                        <p>Local Case ID: {currentCase.localCaseId}</p>
                        <p>Case {currentCaseIndex + 1} of {cases.length}</p>
                    </div>
                    <button
                        className="nav-btn next-btn"
                        onClick={handleNextCase}
                        disabled={cases.length <= 1}
                    >
                        Next →
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
                        {Object.entries(stainGroups).map(([stainType, slides]) => (
                            <div key={stainType} className="stain-group">
                                <div className="group-header">
                                    <h4>Stain Type: {stainType}</h4>
                                    <p>{slides.length} slide(s)</p>
                                </div>

                                <div className="slide-list">
                                    {slides.map(slide => (
                                        <div key={slide.id} className={`slide-item ${slide.status === 'mapped' ? 'mapped' : 'unmapped'}`}>
                                            <span>Slide ID: {slide.id}</span>
                                            {slide.regionType && (
                                                <span>Region: {slide.regionType}</span>
                                            )}
                                            <span className="status-indicator">
                                                {slide.status === 'mapped' ? '✓ Mapped' : '○ Unmapped'}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                <div className="protocol-selection">
                                    <label>Select Stain Protocol:</label>
                                    <select
                                        className="protocol-select"
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                handleApplyStainProtocol(slides, e.target.value);
                                            }
                                        }}
                                    >
                                        <option value="">Choose a protocol...</option>
                                        {stainProtocols.map(protocol => (
                                            <option key={protocol.id} value={protocol.id}>
                                                {protocol.name} ({protocol.id})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StainProtocolMapping;
