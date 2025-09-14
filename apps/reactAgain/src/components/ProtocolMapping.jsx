import React, { useState, useEffect } from 'react';
import dataStore from '../utils/dataStore';
import protocolStore from '../utils/protocolStore';
import CaseSelectionPanel from './CaseSelectionPanel';
import './ProtocolMapping.css';

const ProtocolMapping = () => {
    const [selectedCase, setSelectedCase] = useState(null);
    const [cases, setCases] = useState([]);
    const [dataStatus, setDataStatus] = useState(dataStore.getStatus());
    const [protocols, setProtocols] = useState({
        stainProtocols: protocolStore.stainProtocols,
        regionProtocols: protocolStore.regionProtocols
    });
    const [expandedGroups, setExpandedGroups] = useState(new Set()); // Track expanded groups

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
            setProtocols({
                stainProtocols: protocolStore.stainProtocols,
                regionProtocols: protocolStore.regionProtocols
            });
        });
        return unsubscribeProtocols;
    }, []);

    // Generate cases when data changes
    useEffect(() => {
        console.log('🔄 ProtocolMapping: useEffect triggered - regenerating cases');
        console.log('🔄 dataStatus.processedData length:', dataStatus.processedData?.length);
        if (dataStatus.processedData && dataStatus.processedData.length > 0) {
            const newCases = generateCases();
            console.log('🔄 ProtocolMapping: Generated', newCases.length, 'cases');
            console.log('🔄 First case slides:', newCases[0]?.slides?.length);
            setCases(newCases);

            // Auto-select the first case if no case is currently selected
            if (newCases.length > 0 && !selectedCase) {
                setSelectedCase(newCases[0]);
            }
        }
    }, [dataStatus.processedData, dataStatus.caseIdMappings, selectedCase]);

    // Clear expanded groups when case changes (keep groups collapsed by default)
    useEffect(() => {
        if (selectedCase) {
            setExpandedGroups(new Set());
        }
    }, [selectedCase]);

    // Generate cases with unmapped slides
    const generateCases = () => {
        if (!dataStatus.processedData || dataStatus.processedData.length === 0) {
            return [];
        }

        const caseGroups = {};

        dataStatus.processedData.forEach(row => {
            const localCaseId = row.BDSA?.bdsaLocal?.localCaseId;
            const localStainId = row.BDSA?.bdsaLocal?.localStainID;
            const localRegionId = row.BDSA?.bdsaLocal?.localRegionId;
            const bdsaCaseId = row.BDSA?.bdsaLocal?.bdsaCaseId;

            // Skip if no required data - but allow rows without BDSA Case IDs
            if (!localCaseId || (!localStainId && !localRegionId)) {
                return;
            }

            // Use BDSA Case ID if available, otherwise use local case ID as fallback
            const caseId = bdsaCaseId || localCaseId;

            if (!caseGroups[caseId]) {
                caseGroups[caseId] = {
                    bdsaId: bdsaCaseId, // This might be null for unmapped cases
                    localCaseId: localCaseId,
                    slides: []
                };
            }

            const slideId = row.dsa_id || row._id || `${caseId}_${row.name || 'unknown'}`;
            const stainType = localStainId || 'Unknown';
            const regionType = localRegionId || 'Unknown';

            // Check if slide has protocols mapped using BDSA.localData structure
            // Always read fresh from the current data status
            const stainProtocols = row.BDSA?.bdsaLocal?.bdsaStainProtocol || [];
            const regionProtocols = row.BDSA?.bdsaLocal?.bdsaRegionProtocol || [];
            const hasStainProtocol = stainProtocols.length > 0;
            const hasRegionProtocol = regionProtocols.length > 0;
            const isMapped = hasStainProtocol || hasRegionProtocol;

            // Debug logging for slides with protocols
            if (stainProtocols.length > 0 || regionProtocols.length > 0) {
                console.log(`🔍 Slide ${slideId} protocols:`, {
                    stainProtocols,
                    regionProtocols,
                    hasStainProtocol,
                    hasRegionProtocol,
                    isMapped
                });
            }

            caseGroups[caseId].slides.push({
                id: slideId,
                stainType: stainType,
                regionType: regionType,
                filename: row.name || row.dsa_name || 'unknown',
                hasStainProtocol: hasStainProtocol,
                hasRegionProtocol: hasRegionProtocol,
                isMapped: isMapped,
                stainProtocols: [...stainProtocols], // Create a copy to ensure reactivity
                regionProtocols: [...regionProtocols], // Create a copy to ensure reactivity
                BDSA: row.BDSA // Store reference for updates
            });
        });

        return Object.values(caseGroups).filter(caseData =>
            caseData.slides.some(slide => !slide.isMapped)
        );
    };

    // Group slides by localStainId for stain protocol mapping
    const getStainGroups = (slides) => {
        const grouped = {};

        slides.forEach(slide => {
            const stainKey = slide.stainType || 'Unknown';

            if (!grouped[stainKey]) {
                grouped[stainKey] = {
                    stainType: slide.stainType,
                    slides: [],
                    needsMapping: false
                };
            }

            grouped[stainKey].slides.push(slide);

            // Check if this group needs mapping (if any slide doesn't have stain protocols)
            if (slide.stainType && !slide.hasStainProtocol) {
                grouped[stainKey].needsMapping = true;
            }
        });

        // Debug: Log each group's status
        Object.values(grouped).forEach(group => {
            const unmappedCount = group.slides.filter(s => !s.hasStainProtocol).length;
            console.log(`🔍 Stain Group "${group.stainType}":`, {
                totalSlides: group.slides.length,
                unmappedSlides: unmappedCount,
                needsMapping: group.needsMapping,
                slideStatuses: group.slides.map(s => ({
                    id: s.id,
                    hasStainProtocol: s.hasStainProtocol,
                    stainProtocols: s.stainProtocols?.length || 0
                }))
            });
            console.log(`🔍 Full group object:`, group);
        });

        return Object.values(grouped);
    };

    // Group slides by localRegionId for region protocol mapping
    const getRegionGroups = (slides) => {
        const grouped = {};

        slides.forEach(slide => {
            const regionKey = slide.regionType || 'Unknown';

            if (!grouped[regionKey]) {
                grouped[regionKey] = {
                    regionType: slide.regionType,
                    slides: [],
                    needsMapping: false
                };
            }

            grouped[regionKey].slides.push(slide);

            // Check if this group needs mapping (if any slide doesn't have region protocols)
            if (slide.regionType && !slide.hasRegionProtocol) {
                grouped[regionKey].needsMapping = true;
            }
        });

        return Object.values(grouped);
    };

    // Simplified protocol mapping - no token-based matching for now
    const mapTokenToProtocol = (token, protocolType) => {
        // For now, return null - users will need to manually select protocols
        return null;
    };

    // Check if token is ambiguous and get all matching protocols
    const getAmbiguousProtocols = (token, protocolType) => {
        // For now, return empty array - no token-based matching
        return [];
    };

    // Check if token is ambiguous
    const isTokenAmbiguous = (token, protocolType) => {
        // For now, always return false - no token-based matching
        return false;
    };

    // Apply protocol to all slides in a group
    const applyProtocolToGroup = (group, protocolId, protocolType) => {
        console.log(`🎯 Applying ${protocolType} protocol ${protocolId} to group ${group.stainType || group.regionType}`);

        const protocol = protocolType === 'stain'
            ? protocolStore.getStainProtocol(protocolId)
            : protocolStore.getRegionProtocol(protocolId);

        if (!protocol) {
            console.error(`Protocol not found: ${protocolId}`);
            return;
        }

        // Apply protocol to all slides in the group
        group.slides.forEach(slide => {
            const dataItem = dataStatus.processedData.find(item =>
                item.id === slide.id ||
                item.dsa_id === slide.id ||
                (item.BDSA?.bdsaLocal?.bdsaCaseId === selectedCase.bdsaId &&
                    (item.name === slide.filename || item.dsa_name === slide.filename))
            );

            if (dataItem && dataItem.BDSA?.bdsaLocal) {
                const protocolKey = `bdsa${protocolType === 'stain' ? 'Stain' : 'Region'}Protocol`;

                // Ensure protocol array exists
                if (!dataItem.BDSA.bdsaLocal[protocolKey]) {
                    dataItem.BDSA.bdsaLocal[protocolKey] = [];
                }

                // Add protocol if not already present
                if (!dataItem.BDSA.bdsaLocal[protocolKey].includes(protocolId)) {
                    dataItem.BDSA.bdsaLocal[protocolKey] = [...dataItem.BDSA.bdsaLocal[protocolKey], protocolId];
                    dataItem.BDSA._lastModified = new Date().toISOString();
                    dataStore.modifiedItems.add(dataItem.id);
                    console.log(`✅ Added ${protocolType} protocol ${protocolId} to slide ${slide.id}`);
                }
            }
        });

        // Update UI state
        const freshStatus = dataStore.getStatus();
        setDataStatus({
            ...freshStatus,
            processedData: [...freshStatus.processedData]
        });

        dataStore.saveToStorage();
        dataStore.notify();
    };

    // Remove protocol from a specific slide
    const removeProtocolFromSlide = (slideId, protocolId, protocolType) => {
        console.log(`🎯 Removing ${protocolType} protocol ${protocolId} from slide ${slideId}`);

        const dataItem = dataStatus.processedData.find(item =>
            item.id === slideId ||
            item.dsa_id === slideId ||
            (item.BDSA?.bdsaLocal?.bdsaCaseId === selectedCase.bdsaId &&
                (item.name === slideId || item.dsa_name === slideId))
        );

        if (dataItem && dataItem.BDSA?.bdsaLocal) {
            const protocolKey = `bdsa${protocolType === 'stain' ? 'Stain' : 'Region'}Protocol`;
            const protocolArray = dataItem.BDSA.bdsaLocal[protocolKey];

            if (protocolArray && Array.isArray(protocolArray)) {
                dataItem.BDSA.bdsaLocal[protocolKey] = protocolArray.filter(id => id !== protocolId);
                dataItem.BDSA._lastModified = new Date().toISOString();
                dataStore.modifiedItems.add(dataItem.id);
                console.log(`✅ Removed ${protocolType} protocol ${protocolId} from slide ${slideId}`);
            }
        }

        // Update UI state
        const freshStatus = dataStore.getStatus();
        setDataStatus({
            ...freshStatus,
            processedData: [...freshStatus.processedData]
        });

        dataStore.saveToStorage();
        dataStore.notify();
    };

    // Toggle group expansion
    const toggleGroupExpansion = (groupKey) => {
        setExpandedGroups(prev => {
            const newSet = new Set(prev);
            if (newSet.has(groupKey)) {
                newSet.delete(groupKey);
            } else {
                newSet.add(groupKey);
            }
            return newSet;
        });
    };

    // Auto-map tokens to protocols
    const autoMapTokens = (slides) => {
        slides.forEach(slide => {
            // Map stain token
            if (slide.stainType && !slide.hasStainProtocol) {
                const stainProtocol = mapTokenToProtocol(slide.stainType, 'stain');
                if (stainProtocol) {
                    applyProtocolMapping([slide], stainProtocol.id, 'stain');
                }
            }

            // Map region token
            if (slide.regionType && !slide.hasRegionProtocol) {
                const regionProtocol = mapTokenToProtocol(slide.regionType, 'region');
                if (regionProtocol) {
                    applyProtocolMapping([slide], regionProtocol.id, 'region');
                }
            }
        });
    };

    return (
        <div className="protocol-mapping">
            {/* Always show case navigation at the top */}
            <CaseSelectionPanel
                cases={cases}
                onCaseSelect={setSelectedCase}
                selectedCase={selectedCase}
            />

            {/* Show mapping interface when a case is selected */}
            {selectedCase && (
                <>

                    {(() => {
                        console.log('🎨 RENDERING: selectedCase slides:', selectedCase.slides?.length);
                        const stainGroups = getStainGroups(selectedCase.slides);
                        const regionGroups = getRegionGroups(selectedCase.slides);
                        console.log('🎨 RENDERING: stainGroups:', stainGroups.length);
                        return (
                            <>
                                {/* Stain Protocol Mapping Section */}
                                <div className="mapping-area">
                                    <h3>Map Stain Protocols to Slides</h3>
                                    <p className="section-description">Apply stain protocols to groups of slides based on their stain tokens.</p>

                                    {stainGroups.map(group => {
                                        const groupKey = `stain_${group.stainType}`;
                                        const isExpanded = expandedGroups.has(groupKey);

                                        return (
                                            <div key={group.stainType} className="slide-group">
                                                <div className="group-header">
                                                    <div className="group-title" onClick={() => toggleGroupExpansion(groupKey)}>
                                                        <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>▶</span>
                                                        <h4>
                                                            Stain Token: "{group.stainType}"
                                                            ({group.slides.length} slides)
                                                        </h4>
                                                    </div>
                                                    <div className="group-actions">
                                                        <span className={`status ${!group.needsMapping ? 'mapped' : 'unmapped'}`}>
                                                            {!group.needsMapping ? '✓ All Mapped' : '⏳ Needs Mapping'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Show individual slides when expanded */}
                                                {isExpanded && (
                                                    <div className="individual-slides">
                                                        <h5>Individual Slides:</h5>
                                                        {group.slides.map(slide => (
                                                            <div key={slide.id} className="slide-item">
                                                                <div className="slide-info">
                                                                    <span className="slide-name">{slide.filename}</span>
                                                                    <span className="slide-tokens">
                                                                        Stain: {slide.stainType} | Region: {slide.regionType}
                                                                    </span>
                                                                </div>
                                                                <div className="slide-protocols">
                                                                    {slide.stainProtocols && slide.stainProtocols.length > 0 && (
                                                                        <div className="protocol-tags">
                                                                            {slide.stainProtocols.map(protocolId => (
                                                                                <span key={protocolId} className="protocol-tag stain">
                                                                                    {protocolId}
                                                                                    <button
                                                                                        onClick={() => removeProtocolFromSlide(
                                                                                            slide.id,
                                                                                            protocolId,
                                                                                            'stain'
                                                                                        )}
                                                                                        className="remove-protocol"
                                                                                    >
                                                                                        ✕
                                                                                    </button>
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                    {slide.regionProtocols && slide.regionProtocols.length > 0 && (
                                                                        <div className="protocol-tags">
                                                                            {slide.regionProtocols.map(protocolId => (
                                                                                <span key={protocolId} className="protocol-tag region">
                                                                                    {protocolId}
                                                                                    <button
                                                                                        onClick={() => removeProtocolFromSlide(
                                                                                            slide.id,
                                                                                            protocolId,
                                                                                            'region'
                                                                                        )}
                                                                                        className="remove-protocol"
                                                                                    >
                                                                                        ✕
                                                                                    </button>
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Show stain protocol selection */}
                                                {group.needsMapping && (
                                                    <div className="protocol-selection">
                                                        <h5>Apply Stain Protocols:</h5>
                                                        <div className="protocol-buttons">
                                                            {protocols.stainProtocols.map(protocol => (
                                                                <button
                                                                    key={protocol.id}
                                                                    onClick={() => {
                                                                        console.log('🎯 BUTTON CLICKED:', protocol.name, 'for group:', group.stainType);
                                                                        console.log('🎯 Group object:', group);
                                                                        console.log('🎯 Group needsMapping:', group.needsMapping);
                                                                        console.log('🎯 Group slides:', group.slides.length);
                                                                        applyProtocolToGroup(group, protocol.id, 'stain');
                                                                        console.log('🎯 After applyProtocolToGroup call');
                                                                    }}
                                                                    className="protocol-btn stain"
                                                                    title={protocol.description}
                                                                >
                                                                    {protocol.name}
                                                                </button>
                                                            ))}
                                                        </div>
                                                        <div className="batch-info">
                                                            <small>This will apply to {group.slides.filter(s => s.stainType).length} slide(s) with stain token "{group.stainType}"</small>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Region Protocol Mapping Section */}
                                <div className="mapping-area">
                                    <h3>Map Region Protocols to Slides</h3>
                                    <p className="section-description">Apply region protocols to groups of slides based on their region tokens.</p>

                                    {regionGroups.map(group => {
                                        const groupKey = `region_${group.regionType}`;
                                        const isExpanded = expandedGroups.has(groupKey);

                                        return (
                                            <div key={group.regionType} className="slide-group">
                                                <div className="group-header">
                                                    <div className="group-title" onClick={() => toggleGroupExpansion(groupKey)}>
                                                        <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>▶</span>
                                                        <h4>
                                                            Region Token: "{group.regionType}"
                                                            ({group.slides.length} slides)
                                                        </h4>
                                                    </div>
                                                    <div className="group-actions">
                                                        <span className={`status ${!group.needsMapping ? 'mapped' : 'unmapped'}`}>
                                                            {!group.needsMapping ? '✓ All Mapped' : '⏳ Needs Mapping'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Show individual slides when expanded */}
                                                {isExpanded && (
                                                    <div className="individual-slides">
                                                        <h5>Individual Slides:</h5>
                                                        {group.slides.map(slide => (
                                                            <div key={slide.id} className="slide-item">
                                                                <div className="slide-info">
                                                                    <span className="slide-name">{slide.filename}</span>
                                                                    <span className="slide-tokens">
                                                                        Stain: {slide.stainType} | Region: {slide.regionType}
                                                                    </span>
                                                                </div>
                                                                <div className="slide-protocols">
                                                                    {slide.stainProtocols && slide.stainProtocols.length > 0 && (
                                                                        <div className="protocol-tags">
                                                                            {slide.stainProtocols.map(protocolId => (
                                                                                <span key={protocolId} className="protocol-tag stain">
                                                                                    {protocolId}
                                                                                    <button
                                                                                        onClick={() => removeProtocolFromSlide(
                                                                                            slide.id,
                                                                                            protocolId,
                                                                                            'stain'
                                                                                        )}
                                                                                        className="remove-protocol"
                                                                                    >
                                                                                        ✕
                                                                                    </button>
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                    {slide.regionProtocols && slide.regionProtocols.length > 0 && (
                                                                        <div className="protocol-tags">
                                                                            {slide.regionProtocols.map(protocolId => (
                                                                                <span key={protocolId} className="protocol-tag region">
                                                                                    {protocolId}
                                                                                    <button
                                                                                        onClick={() => removeProtocolFromSlide(
                                                                                            slide.id,
                                                                                            protocolId,
                                                                                            'region'
                                                                                        )}
                                                                                        className="remove-protocol"
                                                                                    >
                                                                                        ✕
                                                                                    </button>
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Show region protocol selection */}
                                                {group.needsMapping && (
                                                    <div className="protocol-selection">
                                                        <h5>Apply Region Protocols:</h5>
                                                        <div className="protocol-buttons">
                                                            {protocols.regionProtocols.map(protocol => (
                                                                <button
                                                                    key={protocol.id}
                                                                    onClick={() => {
                                                                        console.log('🎯 REGION BUTTON CLICKED:', protocol.name, 'for group:', group.regionType);
                                                                        // Apply to ALL slides in the group, regardless of current protocol status
                                                                        const slidesToMap = group.slides.filter(s => s.regionType);
                                                                        console.log('🎯 Region slides to map:', slidesToMap.length, slidesToMap.map(s => s.id));
                                                                        applyProtocolToGroup(group, protocol.id, 'region');
                                                                        console.log('🎯 After region applyProtocolMapping call');
                                                                    }}
                                                                    className="protocol-btn region"
                                                                    title={protocol.description}
                                                                >
                                                                    {protocol.name}
                                                                </button>
                                                            ))}
                                                        </div>
                                                        <div className="batch-info">
                                                            <small>This will apply to {group.slides.filter(s => s.regionType).length} slide(s) with region token "{group.regionType}"</small>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        );
                    })()}
                </>
            )}
        </div>
    );
};

export default ProtocolMapping;