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
        if (dataStatus.processedData && dataStatus.processedData.length > 0) {
            const newCases = generateCases();
            setCases(newCases);
        }
    }, [dataStatus.processedData, dataStatus.caseIdMappings, dataStatus.caseProtocolMappings]);

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

            // Check if slide has protocols mapped using caseProtocolMappings
            const caseProtocolMappings = dataStatus.caseProtocolMappings;
            const slideProtocols = caseProtocolMappings?.[caseId]?.[slideId] || { stain: [], region: [] };
            const hasStainProtocol = (slideProtocols.stain || []).length > 0;
            const hasRegionProtocol = (slideProtocols.region || []).length > 0;
            const isMapped = hasStainProtocol || hasRegionProtocol;

            caseGroups[caseId].slides.push({
                id: slideId,
                stainType: stainType,
                regionType: regionType,
                filename: row.name || row.dsa_name || 'unknown',
                hasStainProtocol: hasStainProtocol,
                hasRegionProtocol: hasRegionProtocol,
                isMapped: isMapped,
                stainProtocol: hasStainProtocol ? slideProtocols.stain[0] : null, // Get first protocol ID
                regionProtocol: hasRegionProtocol ? slideProtocols.region[0] : null, // Get first protocol ID
                BDSA: row.BDSA // Store reference for updates
            });
        });

        return Object.values(caseGroups).filter(caseData =>
            caseData.slides.some(slide => !slide.isMapped)
        );
    };

    // Group slides by stain and region types
    const getGroupedSlides = (slides) => {
        const grouped = {};

        slides.forEach(slide => {
            const key = `${slide.stainType}_${slide.regionType}`;
            if (!grouped[key]) {
                grouped[key] = {
                    stainType: slide.stainType,
                    regionType: slide.regionType,
                    slides: [],
                    allMapped: true,
                    hasStainProtocol: false,
                    hasRegionProtocol: false
                };
            }

            grouped[key].slides.push(slide);
            if (!slide.isMapped) {
                grouped[key].allMapped = false;
            }
            if (slide.hasStainProtocol) {
                grouped[key].hasStainProtocol = true;
            }
            if (slide.hasRegionProtocol) {
                grouped[key].hasRegionProtocol = true;
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

    // Apply protocol mapping to slides
    const applyProtocolMapping = (slides, protocolId, protocolType) => {
        if (!selectedCase) return;

        const protocol = protocolStore.getStainProtocol(protocolId) ||
            protocolStore.getRegionProtocol(protocolId);

        if (!protocol) {
            console.error(`Protocol not found: ${protocolId}`);
            return;
        }

        slides.forEach(slide => {
            // Use the case ID (either BDSA Case ID or local case ID as fallback)
            const caseId = selectedCase.bdsaId || selectedCase.localCaseId;
            // Use the dataStore's addProtocolMapping method
            dataStore.addProtocolMapping(caseId, slide.id, protocolId, protocolType);
        });

        // The dataStore will notify subscribers, which will trigger the useEffect to regenerate cases
    };

    // Remove protocol mapping from slide
    const removeProtocolMapping = (slideId, protocolId, protocolType) => {
        if (!selectedCase) return;

        // Use the case ID (either BDSA Case ID or local case ID as fallback)
        const caseId = selectedCase.bdsaId || selectedCase.localCaseId;
        // Use the dataStore's removeProtocolMapping method
        dataStore.removeProtocolMapping(caseId, slideId, protocolId, protocolType);

        // The dataStore will notify subscribers, which will trigger the useEffect to regenerate cases
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

    if (!selectedCase) {
        return (
            <div className="protocol-mapping">
                <CaseSelectionPanel
                    cases={cases}
                    onCaseSelect={setSelectedCase}
                />
            </div>
        );
    }

    const groupedSlides = getGroupedSlides(selectedCase.slides);

    return (
        <div className="protocol-mapping">
            <div className="case-selection">
                <h3>🔧 NEW PROTOCOL MAPPING - {selectedCase.bdsaId || selectedCase.localCaseId}</h3>
                <p>Local Case ID: {selectedCase.localCaseId}</p>
                {selectedCase.bdsaId && <p>BDSA Case ID: {selectedCase.bdsaId}</p>}
                {!selectedCase.bdsaId && <p><em>⚠️ No BDSA Case ID mapped yet - protocol mapping will use local case ID</em></p>}
                <button
                    onClick={() => setSelectedCase(null)}
                    className="back-button"
                >
                    ← Back to Case Selection
                </button>
            </div>

            <div className="mapping-area">
                <h3>Map Protocols to Slides</h3>

                {groupedSlides.map(group => (
                    <div key={`${group.stainType}_${group.regionType}`} className="slide-group">
                        <div className="group-header">
                            <h4>
                                {group.stainType} / {group.regionType}
                                ({group.slides.length} slides)
                            </h4>
                            <div className="group-actions">
                                <button
                                    onClick={() => autoMapTokens(group.slides)}
                                    className="auto-map-button"
                                    disabled={group.allMapped}
                                >
                                    🔄 Auto-Map Tokens
                                </button>
                                <span className={`status ${group.allMapped ? 'mapped' : 'unmapped'}`}>
                                    {group.allMapped ? '✓ All Mapped' : '⏳ Needs Mapping'}
                                </span>
                            </div>
                        </div>

                        {/* Show current protocol mappings */}
                        {(group.hasStainProtocol || group.hasRegionProtocol) && (
                            <div className="current-protocols">
                                <h5>Current Protocol Mappings:</h5>
                                {group.slides.map(slide => (
                                    <div key={slide.id} className="slide-protocols">
                                        <span className="slide-name">{slide.filename}</span>
                                        {slide.hasStainProtocol && (
                                            <span className="protocol-tag stain">
                                                Stain: {slide.stainProtocol}
                                                <button
                                                    onClick={() => removeProtocolMapping(slide.id, slide.stainProtocol, 'stain')}
                                                    className="remove-protocol"
                                                >
                                                    ✕
                                                </button>
                                            </span>
                                        )}
                                        {slide.hasRegionProtocol && (
                                            <span className="protocol-tag region">
                                                Region: {slide.regionProtocol}
                                                <button
                                                    onClick={() => removeProtocolMapping(slide.id, slide.regionProtocol, 'region')}
                                                    className="remove-protocol"
                                                >
                                                    ✕
                                                </button>
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Show protocol selection for unmapped slides */}
                        {!group.allMapped && (
                            <div className="protocol-selection">
                                <h5>Apply Specific Protocols:</h5>

                                {/* Token Information */}
                                <div className="token-info">
                                    <h6>📋 Token Information:</h6>
                                    <p><strong>Stain Token:</strong> "{group.slides[0]?.stainType}"</p>
                                    <p><strong>Region Token:</strong> "{group.slides[0]?.regionType}"</p>
                                    <p><em>Select appropriate protocols below for these tokens.</em></p>
                                </div>

                                {/* Stain Protocol Selection */}
                                {group.slides.some(s => s.stainType && !s.hasStainProtocol) && (
                                    <div className="protocol-type-section">
                                        <h6>Stain Protocols (Token: "{group.slides[0]?.stainType}"):</h6>
                                        <div className="protocol-buttons">
                                            {protocols.stainProtocols.map(protocol => (
                                                <button
                                                    key={protocol.id}
                                                    onClick={() => applyProtocolMapping(
                                                        group.slides.filter(s => s.stainType && !s.hasStainProtocol),
                                                        protocol.id,
                                                        'stain'
                                                    )}
                                                    className="protocol-btn stain"
                                                    title={protocol.description}
                                                >
                                                    {protocol.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Region Protocol Selection */}
                                {group.slides.some(s => s.regionType && !s.hasRegionProtocol) && (
                                    <div className="protocol-type-section">
                                        <h6>Region Protocols (Token: "{group.slides[0]?.regionType}"):</h6>
                                        <div className="protocol-buttons">
                                            {protocols.regionProtocols.map(protocol => (
                                                <button
                                                    key={protocol.id}
                                                    onClick={() => applyProtocolMapping(
                                                        group.slides.filter(s => s.regionType && !s.hasRegionProtocol),
                                                        protocol.id,
                                                        'region'
                                                    )}
                                                    className="protocol-btn region"
                                                    title={protocol.description}
                                                >
                                                    {protocol.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ProtocolMapping;