import React from 'react';

const ProtocolMappingInterface = ({
    selectedCase,
    setSelectedCase,
    groupedSlides,
    autoMapTokens,
    applyProtocolMapping,
    getAmbiguousProtocols,
    protocols
}) => {
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
                                        <div className="protocol-tags">
                                            {slide.stainProtocol && (
                                                <span className="protocol-tag stain">
                                                    🧪 {slide.stainProtocol.name}
                                                </span>
                                            )}
                                            {slide.regionProtocol && (
                                                <span className="protocol-tag region">
                                                    🗺️ {slide.regionProtocol.name}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Protocol Selection */}
                        {!group.allMapped && (
                            <div className="protocol-selection">
                                <h5>Select Protocols:</h5>

                                {/* Token Analysis */}
                                {(() => {
                                    const stainToken = group.slides.find(s => s.stainToken)?.stainToken;
                                    const regionToken = group.slides.find(s => s.regionToken)?.regionToken;
                                    const stainAmbiguous = stainToken && getAmbiguousProtocols(stainToken, 'stain').length > 1;
                                    const regionAmbiguous = regionToken && getAmbiguousProtocols(regionToken, 'region').length > 1;

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
                                                                                {protocol.protocolDefinition.technique && (
                                                                                    <p><strong>Technique:</strong> {protocol.protocolDefinition.technique}</p>
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
                                                                                {protocol.protocolDefinition.subRegion && (
                                                                                    <p><strong>Sub-region:</strong> {protocol.protocolDefinition.subRegion}</p>
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
                                {group.stainType && !group.hasStainProtocol && (
                                    <div className="protocol-section stain-protocols">
                                        <h6>🧪 Stain Protocols:</h6>
                                        <div className="protocol-buttons">
                                            {protocols.stainProtocols.map(protocol => {
                                                const stainToken = group.slides.find(s => s.stainToken)?.stainToken;
                                                const matchesToken = stainToken && protocol.tokens && protocol.tokens.includes(stainToken);

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
                                {group.regionType && !group.hasRegionProtocol && (
                                    <div className="protocol-section region-protocols">
                                        <h6>🗺️ Region Protocols:</h6>
                                        <div className="protocol-buttons">
                                            {protocols.regionProtocols.map(protocol => {
                                                const regionToken = group.slides.find(s => s.regionToken)?.regionToken;
                                                const matchesToken = regionToken && protocol.tokens && protocol.tokens.includes(regionToken);

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

export default ProtocolMappingInterface;
