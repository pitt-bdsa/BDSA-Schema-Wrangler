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

            // Skip if no required data
            if (!localCaseId || !bdsaCaseId || (!localStainId && !localRegionId)) {
                return;
            }

            if (!caseGroups[bdsaCaseId]) {
                caseGroups[bdsaCaseId] = {
                    bdsaId: bdsaCaseId,
                    localCaseId: localCaseId,
                    slides: []
                };
            }

            const slideId = row.dsa_id || row._id || `${bdsaCaseId}_${row.name || 'unknown'}`;
            const stainType = localStainId || 'Unknown';
            const regionType = localRegionId || 'Unknown';

            // Check if slide has protocols mapped
            const hasStainProtocol = row.BDSA?.bdsaStainProtocol;
            const hasRegionProtocol = row.BDSA?.bdsaRegionProtocol;
            const isMapped = hasStainProtocol || hasRegionProtocol;

            caseGroups[bdsaCaseId].slides.push({
                id: slideId,
                stainType: stainType,
                regionType: regionType,
                filename: row.name || row.dsa_name || 'unknown',
                hasStainProtocol: hasStainProtocol,
                hasRegionProtocol: hasRegionProtocol,
                isMapped: isMapped,
                stainProtocol: hasStainProtocol,
                regionProtocol: hasRegionProtocol,
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

    // Map token to protocol with ambiguity detection
    const mapTokenToProtocol = (token, protocolType) => {
        if (protocolType === 'stain') {
            return protocolStore.findStainProtocolByToken(token);
        } else if (protocolType === 'region') {
            return protocolStore.findRegionProtocolByToken(token);
        }
        return null;
    };

    // Check if token is ambiguous and get all matching protocols
    const getAmbiguousProtocols = (token, protocolType) => {
        if (protocolType === 'stain') {
            return protocolStore.getAllMatchingProtocols(token, 'stain');
        } else if (protocolType === 'region') {
            return protocolStore.getAllMatchingProtocols(token, 'region');
        }
        return [];
    };

    // Check if token is ambiguous
    const isTokenAmbiguous = (token, protocolType) => {
        if (protocolType === 'stain') {
            return protocolStore.isTokenAmbiguous(token, 'stain');
        } else if (protocolType === 'region') {
            return protocolStore.isTokenAmbiguous(token, 'region');
        }
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
            const fieldName = protocolType === 'stain' ? 'bdsaStainProtocol' : 'bdsaRegionProtocol';

            // Update the data store using the reactAgain data store method
            dataStore.updateProcessedDataItem(slide.id, {
                BDSA: {
                    ...slide.BDSA,
                    [fieldName]: protocol.name
                }
            }, `Applied ${protocolType} protocol: ${protocol.name}`);
        });

        // Refresh the cases to reflect changes
        const newCases = generateCases();
        setCases(newCases);
    };

    // Remove protocol mapping from slide
    const removeProtocolMapping = (slideId, protocolType) => {
        const fieldName = protocolType === 'stain' ? 'bdsaStainProtocol' : 'bdsaRegionProtocol';

        // Find the slide data to get the BDSA reference
        const slideData = dataStatus.processedData.find(row =>
            (row.dsa_id || row._id || `${row.BDSA?.bdsaLocal?.bdsaCaseId}_${row.name || 'unknown'}`) === slideId
        );

        if (slideData) {
            dataStore.updateProcessedDataItem(slideId, {
                BDSA: {
                    ...slideData.BDSA,
                    [fieldName]: null
                }
            }, `Removed ${protocolType} protocol`);
        }

        // Refresh the cases to reflect changes
        const newCases = generateCases();
        setCases(newCases);
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
                <h3>🔧 NEW PROTOCOL MAPPING - {selectedCase.bdsaId}</h3>
                <p>Local Case ID: {selectedCase.localCaseId}</p>
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
                                                    onClick={() => removeProtocolMapping(slide.id, 'stain')}
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
                                                    onClick={() => removeProtocolMapping(slide.id, 'region')}
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

                                {/* Token Analysis */}
                                {(() => {
                                    const stainToken = group.slides[0]?.stainType;
                                    const regionToken = group.slides[0]?.regionType;
                                    const stainAmbiguous = stainToken && isTokenAmbiguous(stainToken, 'stain');
                                    const regionAmbiguous = regionToken && isTokenAmbiguous(regionToken, 'region');

                                    if (stainAmbiguous || regionAmbiguous) {
                                        return (
                                            <div className="token-analysis">
                                                <h6>⚠️ Ambiguous Token Detected:</h6>
                                                {stainAmbiguous && (
                                                    <div className="ambiguous-token">
                                                        <strong>Stain Token "{stainToken}"</strong> maps to multiple protocols:
                                                        <div className="ambiguous-options">
                                                            {getAmbiguousProtocols(stainToken, 'stain').map(protocol => (
                                                                <div key={protocol.id} className="ambiguous-protocol">
                                                                    <strong>{protocol.name}</strong>
                                                                    <small>{protocol.description}</small>
                                                                    {protocol.protocolDefinition && (
                                                                        <details className="protocol-details">
                                                                            <summary>Protocol Details</summary>
                                                                            <div className="protocol-definition">
                                                                                {protocol.protocolDefinition.antibody && (
                                                                                    <p><strong>Antibody:</strong> {protocol.protocolDefinition.antibody}</p>
                                                                                )}
                                                                                {protocol.protocolDefinition.dilution && (
                                                                                    <p><strong>Dilution:</strong> {protocol.protocolDefinition.dilution}</p>
                                                                                )}
                                                                                {protocol.protocolDefinition.version && (
                                                                                    <p><strong>Version:</strong> {protocol.protocolDefinition.version}</p>
                                                                                )}
                                                                                {protocol.protocolDefinition.dateEstablished && (
                                                                                    <p><strong>Date:</strong> {protocol.protocolDefinition.dateEstablished}</p>
                                                                                )}
                                                                                {protocol.protocolDefinition.notes && (
                                                                                    <p><strong>Notes:</strong> {protocol.protocolDefinition.notes}</p>
                                                                                )}
                                                                            </div>
                                                                        </details>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {regionAmbiguous && (
                                                    <div className="ambiguous-token">
                                                        <strong>Region Token "{regionToken}"</strong> maps to multiple protocols:
                                                        <div className="ambiguous-options">
                                                            {getAmbiguousProtocols(regionToken, 'region').map(protocol => (
                                                                <div key={protocol.id} className="ambiguous-protocol">
                                                                    <strong>{protocol.name}</strong>
                                                                    <small>{protocol.description}</small>
                                                                    {protocol.protocolDefinition && (
                                                                        <details className="protocol-details">
                                                                            <summary>Protocol Details</summary>
                                                                            <div className="protocol-definition">
                                                                                {protocol.protocolDefinition.region && (
                                                                                    <p><strong>Region:</strong> {protocol.protocolDefinition.region}</p>
                                                                                )}
                                                                                {protocol.protocolDefinition.samplingMethod && (
                                                                                    <p><strong>Sampling:</strong> {protocol.protocolDefinition.samplingMethod}</p>
                                                                                )}
                                                                                {protocol.protocolDefinition.version && (
                                                                                    <p><strong>Version:</strong> {protocol.protocolDefinition.version}</p>
                                                                                )}
                                                                            </div>
                                                                        </details>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}

                                {/* Stain Protocol Selection */}
                                {group.slides.some(s => s.stainType && !s.hasStainProtocol) && (
                                    <div className="protocol-type-section">
                                        <h6>Stain Protocols (Token: "{group.slides[0]?.stainType}"):</h6>
                                        <div className="protocol-buttons">
                                            {protocols.stainProtocols.map(protocol => {
                                                const matchesToken = protocol.localTokens &&
                                                    protocol.localTokens.some(token =>
                                                        token.toLowerCase() === group.slides[0]?.stainType?.toLowerCase()
                                                    );
                                                return (
                                                    <button
                                                        key={protocol.id}
                                                        onClick={() => applyProtocolMapping(
                                                            group.slides.filter(s => s.stainType && !s.hasStainProtocol),
                                                            protocol.id,
                                                            'stain'
                                                        )}
                                                        className={`protocol-btn stain ${matchesToken ? 'token-match' : ''}`}
                                                        title={`${protocol.description}${protocol.protocolDefinition ? `\n\nProtocol Details:\nAntibody: ${protocol.protocolDefinition.antibody || 'N/A'}\nVersion: ${protocol.protocolDefinition.version || 'N/A'}\nDate: ${protocol.protocolDefinition.dateEstablished || 'N/A'}` : ''}`}
                                                    >
                                                        {protocol.name}
                                                        {matchesToken && <span className="token-match-indicator">✓</span>}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Region Protocol Selection */}
                                {group.slides.some(s => s.regionType && !s.hasRegionProtocol) && (
                                    <div className="protocol-type-section">
                                        <h6>Region Protocols (Token: "{group.slides[0]?.regionType}"):</h6>
                                        <div className="protocol-buttons">
                                            {protocols.regionProtocols.map(protocol => {
                                                const matchesToken = protocol.localTokens &&
                                                    protocol.localTokens.some(token =>
                                                        token.toLowerCase() === group.slides[0]?.regionType?.toLowerCase()
                                                    );
                                                return (
                                                    <button
                                                        key={protocol.id}
                                                        onClick={() => applyProtocolMapping(
                                                            group.slides.filter(s => s.regionType && !s.hasRegionProtocol),
                                                            protocol.id,
                                                            'region'
                                                        )}
                                                        className={`protocol-btn region ${matchesToken ? 'token-match' : ''}`}
                                                        title={`${protocol.description}${protocol.protocolDefinition ? `\n\nProtocol Details:\nRegion: ${protocol.protocolDefinition.region || 'N/A'}\nVersion: ${protocol.protocolDefinition.version || 'N/A'}\nSampling: ${protocol.protocolDefinition.samplingMethod || 'N/A'}` : ''}`}
                                                    >
                                                        {protocol.name}
                                                        {matchesToken && <span className="token-match-indicator">✓</span>}
                                                    </button>
                                                );
                                            })}
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