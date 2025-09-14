import React, { useState, useEffect } from 'react';
import dataStore from '../utils/dataStore';
import protocolStore from '../utils/protocolStore';
import './StainProtocolMapping.css'; // Reuse the same styles

const RegionProtocolMapping = () => {
    const [dataStatus, setDataStatus] = useState(dataStore.getStatus());
    const [regionProtocols, setRegionProtocols] = useState(protocolStore.regionProtocols);
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
            setRegionProtocols(protocolStore.regionProtocols);
            setAvailableProtocols(protocolStore.regionProtocols || []);
        });

        // Initial load
        setRegionProtocols(protocolStore.regionProtocols);
        setAvailableProtocols(protocolStore.regionProtocols || []);

        return unsubscribeProtocols;
    }, []);

    // Generate cases with region slides when data changes
    useEffect(() => {
        if (dataStatus.processedData && dataStatus.processedData.length > 0) {
            const regionCases = dataStore.generateRegionProtocolCases();

            // Only reset case index if the number of cases changed significantly
            // (e.g., new cases added or cases removed), not just when data is updated
            const previousCaseCount = cases.length;
            const newCaseCount = regionCases.length;

            setCases(regionCases);

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

    // Get all slides with region types for the case (regardless of mapping status)
    const getAllRegionSlides = (caseData) => {
        if (!caseData || !caseData.slides) return [];
        return caseData.slides.filter(slide =>
            slide.regionType // Show all slides that have a region type
        );
    };

    // Group slides by region type
    const groupSlidesByRegionType = (slides) => {
        const groups = {};
        slides.forEach(slide => {
            const regionType = slide.regionType;
            if (!groups[regionType]) {
                groups[regionType] = [];
            }
            groups[regionType].push(slide);
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
    const toggleGroupExpansion = (regionType) => {
        const newExpanded = new Set(expandedGroups);
        if (newExpanded.has(regionType)) {
            newExpanded.delete(regionType);
        } else {
            newExpanded.add(regionType);
        }
        setExpandedGroups(newExpanded);
    };

    const handleApplyRegionProtocol = (slides, protocolId) => {
        console.log('Applying region protocol', protocolId, 'to slides:', slides);

        // Get the current case
        const currentCase = cases[currentCaseIndex];
        if (!currentCase) return;

        // Apply protocol to each slide
        slides.forEach(slide => {
            dataStore.addProtocolMapping(currentCase.bdsaId, slide.id, protocolId, 'region');
        });

        console.log(`✅ Applied protocol ${protocolId} to ${slides.length} slides`);
    };

    const handleRemoveRegionProtocol = (slides, protocolToRemove) => {
        console.log('🔍 Removing region protocol', protocolToRemove, 'from slides:', slides);

        // Get the current case
        const currentCase = cases[currentCaseIndex];
        if (!currentCase) {
            console.error('❌ No current case found');
            return;
        }

        // Remove protocol from each slide
        slides.forEach(slide => {
            console.log(`🔍 Removing ${protocolToRemove} from slide ${slide.id} (${slide.filename})`);
            dataStore.removeProtocolMapping(currentCase.bdsaId, slide.id, protocolToRemove, 'region');
        });

        console.log(`✅ Removed protocol ${protocolToRemove} from ${slides.length} slides`);
    };

    if (cases.length === 0) {
        return (
            <div className="stain-protocol-mapping">
                <div className="header">
                    <h2>Region Protocol Mapping</h2>
                    <p>No cases with region slides found.</p>
                </div>
                <div className="no-cases">
                    <p>Make sure you have:</p>
                    <ul>
                        <li>Loaded data with BDSA Case IDs assigned</li>
                        <li>Local Region IDs in your data</li>
                    </ul>
                </div>
            </div>
        );
    }

    const currentCase = cases[currentCaseIndex];
    const allRegionSlides = getAllRegionSlides(currentCase);
    const regionGroups = groupSlidesByRegionType(allRegionSlides);

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
                <h3>Map Region Protocols to Slides</h3>
                <p>Select a region protocol for each group of slides with the same region type.</p>

                {Object.keys(regionGroups).length === 0 ? (
                    <div className="no-unmapped-slides">
                        <p>No slides with region types found in this case.</p>
                    </div>
                ) : (
                    <div className="stain-groups">
                        {Object.entries(regionGroups).map(([regionType, slides]) => {
                            const isExpanded = expandedGroups.has(regionType);
                            const mappedCount = slides.filter(s => s.regionProtocols && s.regionProtocols.length > 0).length;
                            const unmappedCount = slides.filter(s => !s.regionProtocols || s.regionProtocols.length === 0).length;

                            // Find all protocols that are applied to any slide in this group with counts
                            const protocolCounts = {};
                            slides.forEach(slide => {
                                (slide.regionProtocols || []).forEach(protocol => {
                                    protocolCounts[protocol] = (protocolCounts[protocol] || 0) + 1;
                                });
                            });

                            const allGroupProtocols = Object.keys(protocolCounts);
                            const fullyAppliedProtocols = allGroupProtocols.filter(protocol =>
                                protocolCounts[protocol] === slides.length
                            );

                            return (
                                <div key={regionType} className="stain-group">
                                    <div
                                        className="group-header clickable"
                                        onClick={() => toggleGroupExpansion(regionType)}
                                    >
                                        <div className="group-title">
                                            <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                                            <h4>Region Type: {regionType}</h4>
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
                                                                onClick={() => handleRemoveRegionProtocol(slides, protocol)}
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
                                        <label>Add Region Protocol:</label>
                                        <div className="available-protocols">
                                            {availableProtocols
                                                .filter(protocol => !fullyAppliedProtocols.includes(protocol.name))
                                                .map(protocol => {
                                                    const isPartiallyApplied = allGroupProtocols.includes(protocol.name);
                                                    const currentCount = protocolCounts[protocol.name] || 0;
                                                    return (
                                                        <button
                                                            key={protocol.id}
                                                            className={`add-protocol-btn ${isPartiallyApplied ? 'partially-applied' : ''}`}
                                                            onClick={() => handleApplyRegionProtocol(slides, protocol.name)}
                                                            title={isPartiallyApplied
                                                                ? `Apply ${protocol.name} to remaining ${slides.length - currentCount} slides`
                                                                : `Add ${protocol.name} to all slides`
                                                            }
                                                        >
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
                                                        <tr key={slide.id} className={`slide-row ${(slide.regionProtocols && slide.regionProtocols.length > 0) ? 'mapped' : 'unmapped'}`}>
                                                            <td className="file-cell">
                                                                <div className="file-name">{slide.filename}</div>
                                                                <div className="slide-id">{slide.id}</div>
                                                            </td>
                                                            <td className="status-cell">
                                                                <span className={`status-badge ${(slide.regionProtocols && slide.regionProtocols.length > 0) ? 'mapped' : 'unmapped'}`}>
                                                                    {(slide.regionProtocols && slide.regionProtocols.length > 0) ? '✓ Mapped' : '○ Unmapped'}
                                                                </span>
                                                            </td>
                                                            <td className="protocols-cell">
                                                                {slide.regionProtocols && slide.regionProtocols.length > 0 ? (
                                                                    <div className="protocol-tags">
                                                                        {slide.regionProtocols.map((protocol, idx) => (
                                                                            <span key={idx} className="protocol-tag">
                                                                                {protocol}
                                                                                <button
                                                                                    className="remove-protocol-btn"
                                                                                    onClick={() => handleRemoveRegionProtocol([slide], protocol)}
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
                                                                        .filter(protocol => !(slide.regionProtocols || []).includes(protocol.name))
                                                                        .map(protocol => (
                                                                            <button
                                                                                key={protocol.id}
                                                                                className="apply-protocol-btn"
                                                                                onClick={() => handleApplyRegionProtocol([slide], protocol.name)}
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

export default RegionProtocolMapping;
