import React, { useState, useEffect } from 'react';
import dataStore, { getProtocolSuggestions } from '../utils/dataStore';
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
        const unsubscribeProtocols = protocolStore.subscribe(() => {
            setStainProtocols(protocolStore.stainProtocols);
            setAvailableProtocols(protocolStore.stainProtocols || []);
        });

        // Initial load
        setStainProtocols(protocolStore.stainProtocols);
        setAvailableProtocols(protocolStore.stainProtocols || []);

        return unsubscribeProtocols;
    }, []);

    // Generate cases with stain slides when data changes
    useEffect(() => {
        if (dataStatus.processedData && dataStatus.processedData.length > 0) {
            const stainCases = dataStore.generateStainProtocolCases();

            // Only reset case index if the number of cases changed significantly
            // (e.g., new cases added or cases removed), not just when data is updated
            const previousCaseCount = cases.length;
            const newCaseCount = stainCases.length;

            setCases(stainCases);

            // Only reset to first case if:
            // 1. This is the initial load (no previous cases)
            // 2. The number of cases changed significantly (more than just protocol updates)
            // 3. Current case index is out of bounds
            if (previousCaseCount === 0 ||
                Math.abs(newCaseCount - previousCaseCount) > 0 ||
                currentCaseIndex >= newCaseCount) {
                setCurrentCaseIndex(0);
            }
            // Otherwise, keep the current case index to maintain user's position
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

    // Skip to next case with unmapped stain protocols
    const handleSkipToNextUnmapped = () => {
        // Force a refresh of the cases data to get the latest state
        const freshCases = dataStore.generateStainProtocolCases();
        let foundIndex = -1;

        // Search forward from current position
        for (let i = 0; i < freshCases.length; i++) {
            const caseIndex = (currentCaseIndex + i) % freshCases.length;
            const caseData = freshCases[caseIndex];

            if (caseData && caseData.slides) {
                const allStainSlides = getAllStainSlides(caseData);
                const stainGroups = groupSlidesByStainType(allStainSlides);

                // Check if any stain group has unmapped slides
                const hasUnmapped = Object.entries(stainGroups).some(([stainType, slides]) => {
                    const unmappedCount = slides.filter(s => !s.stainProtocols || s.stainProtocols.length === 0).length;
                    return unmappedCount > 0;
                });

                if (hasUnmapped) {
                    foundIndex = caseIndex;
                    break;
                }
            }
        }

        if (foundIndex !== -1) {
            setCurrentCaseIndex(foundIndex);
            console.log(`⏭️ Skipped to case ${freshCases[foundIndex].bdsaId} with unmapped stain protocols`);
        } else {
            console.log('🎉 No more cases with unmapped stain protocols found!');
            alert('🎉 Great job! No more cases with unmapped stain protocols found.');
        }
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

    // Get suggestion for a specific stain type
    const getSuggestionForStainType = (stainType) => {
        const suggestion = getProtocolSuggestions(stainType, 'stain');
        console.log(`🔍 GETTING SUGGESTION for ${stainType}:`, suggestion);
        return suggestion;
    };

    // Check if a protocol is suggested for a stain type
    const isProtocolSuggested = (protocolName, stainType) => {
        const suggestion = getSuggestionForStainType(stainType);
        console.log(`🔍 SUGGESTION CHECK - ${stainType}:`, {
            protocolName,
            suggestion,
            isSuggested: suggestion.suggested === protocolName
        });
        return suggestion.suggested === protocolName;
    };

    // Get suggestion confidence for a protocol
    const getSuggestionConfidence = (protocolName, stainType) => {
        const suggestion = getSuggestionForStainType(stainType);
        return suggestion.suggested === protocolName ? suggestion.confidence : 0;
    };

    // Auto-apply suggestions for the current case
    const handleAutoApplySuggestions = () => {
        const currentCase = cases[currentCaseIndex];
        if (!currentCase) return;

        const allStainSlides = getAllStainSlides(currentCase);
        const stainGroups = groupSlidesByStainType(allStainSlides);

        let appliedCount = 0;
        let skippedCount = 0;
        const skippedTypes = [];

        console.log('🚀 Starting auto-apply suggestions for case:', currentCase.bdsaId);

        Object.entries(stainGroups).forEach(([stainType, slides]) => {
            const suggestion = getSuggestionForStainType(stainType);
            console.log(`🔍 Processing stain type "${stainType}":`, suggestion);

            // Only apply if we have high confidence (>= 80%) and it's an exact match
            if (suggestion.suggested && suggestion.confidence >= 0.8 && suggestion.isExactMatch) {
                // Check if this protocol is already fully applied to all slides
                const alreadyApplied = slides.every(slide =>
                    slide.stainProtocols && slide.stainProtocols.includes(suggestion.suggested)
                );

                if (!alreadyApplied) {
                    console.log(`✅ Applying suggestion: ${stainType} → ${suggestion.suggested}`);
                    handleApplyStainProtocol(slides, suggestion.suggested);
                    appliedCount++;
                } else {
                    console.log(`ℹ️ Suggestion already applied: ${stainType} → ${suggestion.suggested}`);
                }
            } else {
                skippedCount++;
                skippedTypes.push({
                    type: stainType,
                    reason: suggestion.suggested
                        ? `Low confidence (${Math.round(suggestion.confidence * 100)}%)`
                        : 'No suggestion available'
                });
                console.log(`⚠️ Skipping ${stainType}:`, suggestion.suggested ? `Low confidence (${Math.round(suggestion.confidence * 100)}%)` : 'No suggestion');
            }
        });

        // Show results with better feedback
        console.log(`🎯 Auto-apply complete: ${appliedCount} applied, ${skippedCount} skipped`);

        // Log results to console instead of showing alert
        if (appliedCount > 0) {
            const message = `✅ Auto-applied ${appliedCount} protocol suggestion(s)!` +
                (skippedCount > 0
                    ? ` ⚠️ Skipped ${skippedCount} stain type(s) due to ambiguity: ${skippedTypes.map(t => `${t.type} (${t.reason})`).join(', ')}`
                    : ' 🎉 All suggestions applied successfully!'
                );
            console.log(message);
        } else {
            const message = skippedCount > 0
                ? `⚠️ No suggestions applied. Skipped ${skippedCount} stain type(s) due to ambiguity: ${skippedTypes.map(t => `${t.type} (${t.reason})`).join(', ')}`
                : 'ℹ️ No stain types found in this case.';
            console.log(message);
        }
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
                <div className="auto-apply-section">
                    <button
                        className="auto-apply-btn"
                        onClick={handleAutoApplySuggestions}
                        title="Auto-apply high-confidence protocol suggestions to all stain types in this case"
                    >
                        ⚡ Auto-Apply Suggestions
                    </button>
                    <button
                        className="skip-unmapped-btn"
                        onClick={handleSkipToNextUnmapped}
                        title="Skip to the next case that has unmapped stain protocols"
                    >
                        ⏭️ Skip to Next Unmapped
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
                            const mappedCount = slides.filter(s => s.stainProtocols && s.stainProtocols.length > 0).length;
                            const unmappedCount = slides.filter(s => !s.stainProtocols || s.stainProtocols.length === 0).length;

                            // Find all protocols that are applied to any slide in this group with counts
                            const protocolCounts = {};
                            slides.forEach(slide => {
                                (slide.stainProtocols || []).forEach(protocol => {
                                    protocolCounts[protocol] = (protocolCounts[protocol] || 0) + 1;
                                });
                            });

                            const allGroupProtocols = Object.keys(protocolCounts);
                            const fullyAppliedProtocols = allGroupProtocols.filter(protocol =>
                                protocolCounts[protocol] === slides.length
                            );

                            console.log(`🔍 Group ${stainType} protocol counts:`, protocolCounts);
                            console.log(`🔍 Fully applied protocols:`, fullyAppliedProtocols);

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

                                    {/* Group-level protocols with counts */}
                                    {allGroupProtocols.length > 0 && (
                                        <div className="group-protocols">
                                            <strong>Group Protocols:</strong>
                                            <div className="protocol-chips">
                                                {allGroupProtocols.map((protocol, idx) => {
                                                    const count = protocolCounts[protocol];
                                                    const isFullyApplied = count === slides.length;
                                                    return (
                                                        <span key={idx} className={`protocol-chip group-chip ${isFullyApplied ? 'fully-applied' : 'partially-applied'}`}>
                                                            {protocol} ({count}/{slides.length})
                                                            <button
                                                                className="remove-protocol-btn"
                                                                onClick={() => handleRemoveStainProtocol(slides, protocol)}
                                                                title={`Remove ${protocol} from all slides`}
                                                            >
                                                                ×
                                                            </button>
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Protocol selection - always visible */}
                                    <div className="protocol-selection">
                                        <label>Add Stain Protocol:</label>
                                        <div className="available-protocols">
                                            {availableProtocols
                                                .filter(protocol => !fullyAppliedProtocols.includes(protocol.name))
                                                .map(protocol => {
                                                    const isPartiallyApplied = allGroupProtocols.includes(protocol.name);
                                                    const currentCount = protocolCounts[protocol.name] || 0;
                                                    const isSuggested = isProtocolSuggested(protocol.name, stainType);
                                                    const confidence = getSuggestionConfidence(protocol.name, stainType);

                                                    return (
                                                        <button
                                                            key={protocol.id}
                                                            className={`add-protocol-btn ${isPartiallyApplied ? 'partially-applied' : ''} ${isSuggested ? 'suggested' : ''}`}
                                                            onClick={() => handleApplyStainProtocol(slides, protocol.name)}
                                                            title={isSuggested
                                                                ? `⭐ SUGGESTED: ${protocol.name} (${Math.round(confidence * 100)}% confidence) - ${getSuggestionForStainType(stainType).reason}`
                                                                : isPartiallyApplied
                                                                    ? `Apply ${protocol.name} to remaining ${slides.length - currentCount} slides`
                                                                    : `Add ${protocol.name} to all slides`
                                                            }
                                                        >
                                                            {isSuggested && '⭐ '}
                                                            + {protocol.name}
                                                            {isPartiallyApplied && ` (${currentCount}/${slides.length})`}
                                                        </button>
                                                    );
                                                })}
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="slides-table-container">
                                            <table className="slides-table">
                                                <thead>
                                                    <tr>
                                                        <th>File</th>
                                                        <th>Status</th>
                                                        <th>Protocols</th>
                                                        <th>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {slides.map(slide => (
                                                        <tr key={slide.id} className={`slide-row ${(slide.stainProtocols && slide.stainProtocols.length > 0) ? 'mapped' : 'unmapped'}`}>
                                                            <td className="file-cell">
                                                                <div className="file-name">{slide.filename}</div>
                                                                <div className="slide-id">{slide.id}</div>
                                                            </td>
                                                            <td className="status-cell">
                                                                <span className={`status-badge ${(slide.stainProtocols && slide.stainProtocols.length > 0) ? 'mapped' : 'unmapped'}`}>
                                                                    {(slide.stainProtocols && slide.stainProtocols.length > 0) ? '✓ Mapped' : '○ Unmapped'}
                                                                </span>
                                                            </td>
                                                            <td className="protocols-cell">
                                                                {slide.stainProtocols && slide.stainProtocols.length > 0 ? (
                                                                    <div className="protocol-tags">
                                                                        {slide.stainProtocols.map((protocol, idx) => (
                                                                            <span key={idx} className="protocol-tag">
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
                                                                ) : (
                                                                    <span className="no-protocols">No protocols</span>
                                                                )}
                                                            </td>
                                                            <td className="actions-cell">
                                                                <div className="slide-actions">
                                                                    {availableProtocols
                                                                        .filter(protocol => !(slide.stainProtocols || []).includes(protocol.name))
                                                                        .map(protocol => (
                                                                            <button
                                                                                key={protocol.id}
                                                                                className="apply-protocol-btn"
                                                                                onClick={() => handleApplyStainProtocol([slide], protocol.name)}
                                                                                title={`Apply ${protocol.name}`}
                                                                            >
                                                                                + {protocol.name}
                                                                            </button>
                                                                        ))}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
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
