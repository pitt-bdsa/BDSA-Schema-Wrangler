import React, { useState, useEffect } from 'react';
import dataStore from '../utils/dataStore';
import suggestionEngine from '../utils/SuggestionEngine';
import './ProtocolDebugPanel.css';

const ProtocolDebugPanel = () => {
    const [activeTab, setActiveTab] = useState('stain');
    const [protocolData, setProtocolData] = useState({ stain: new Map(), region: new Map() });
    const [selectedProtocol, setSelectedProtocol] = useState('');
    const [mappingDetails, setMappingDetails] = useState(null);
    const [stainTokenStats, setStainTokenStats] = useState([]);
    const [regionTokenStats, setRegionTokenStats] = useState([]);

    useEffect(() => {
        loadProtocolData();
    }, []);

    const loadProtocolData = () => {
        console.log('🔍 Loading protocol data...');
        console.log('📊 DataStore processedData length:', dataStore.processedData?.length || 0);

        // Use the new SuggestionEngine to get protocol mappings
        const stainMappings = suggestionEngine.getProtocolMappingsFromData(dataStore.processedData, 'stain');
        const regionMappings = suggestionEngine.getProtocolMappingsFromData(dataStore.processedData, 'region');

        console.log('🧪 Stain mappings found:', stainMappings.size);
        console.log('🧠 Region mappings found:', regionMappings.size);

        setProtocolData({
            stain: stainMappings,
            region: regionMappings
        });

        // Calculate token statistics
        calculateTokenStats();
    };

    const calculateTokenStats = () => {
        if (!dataStore.processedData || dataStore.processedData.length === 0) {
            setStainTokenStats([]);
            setRegionTokenStats([]);
            return;
        }

        const stainTokenCounts = new Map();
        const regionTokenCounts = new Map();

        dataStore.processedData.forEach(item => {
            const bdsaLocal = item.BDSA?.bdsaLocal;
            if (!bdsaLocal) return;

            // Count stain tokens
            const stainToken = bdsaLocal.localStainID;
            if (stainToken) {
                stainTokenCounts.set(stainToken, (stainTokenCounts.get(stainToken) || 0) + 1);
            }

            // Count region tokens
            const regionToken = bdsaLocal.localRegionId;
            if (regionToken) {
                regionTokenCounts.set(regionToken, (regionTokenCounts.get(regionToken) || 0) + 1);
            }
        });

        // Convert to sorted arrays
        const stainStats = Array.from(stainTokenCounts.entries())
            .map(([token, count]) => ({ token, count }))
            .sort((a, b) => b.count - a.count); // Sort by count descending

        const regionStats = Array.from(regionTokenCounts.entries())
            .map(([token, count]) => ({ token, count }))
            .sort((a, b) => b.count - a.count); // Sort by count descending

        setStainTokenStats(stainStats);
        setRegionTokenStats(regionStats);

        console.log('📊 Token statistics calculated:', {
            stainTokens: stainStats.length,
            regionTokens: regionStats.length,
            topStainTokens: stainStats.slice(0, 5),
            topRegionTokens: regionStats.slice(0, 5)
        });
    };


    const getProtocolMappings = (protocolType) => {
        const mappings = new Map();

        if (!dataStore.processedData || dataStore.processedData.length === 0) {
            return mappings;
        }

        const typeField = protocolType === 'stain' ? 'stainType' : 'regionType';
        const protocolField = protocolType === 'stain' ? 'stainProtocols' : 'regionProtocols';

        dataStore.processedData.forEach(item => {
            const type = item[typeField];
            const protocols = item[protocolField] || [];

            if (type && protocols.length > 0) {
                protocols.forEach(protocol => {
                    if (!mappings.has(protocol)) {
                        mappings.set(protocol, new Map());
                    }

                    const protocolMappings = mappings.get(protocol);
                    const count = protocolMappings.get(type) || 0;
                    protocolMappings.set(type, count + 1);
                });
            }
        });

        return mappings;
    };

    const getDetailedMappingInfo = (protocolName, protocolType) => {
        const cases = [];
        const tokens = new Set();

        dataStore.processedData.forEach((item, index) => {
            const bdsaLocal = item.BDSA?.bdsaLocal;
            if (!bdsaLocal) return;

            const protocols = bdsaLocal[protocolType === 'stain' ? 'bdsaStainProtocol' : 'bdsaRegionProtocol'] || [];
            if (protocols.includes(protocolName)) {
                const caseInfo = {
                    caseId: bdsaLocal.bdsaCaseId,
                    slideId: item._id || item.dsa_id,
                    filename: item.name,
                    type: bdsaLocal[protocolType === 'stain' ? 'localStainID' : 'localRegionId'],
                    index: index
                };
                cases.push(caseInfo);

                // Extract potential tokens from filename
                if (item.name) {
                    // Common token patterns
                    const patterns = [
                        /_([A-Z]+)\d*\./g,  // AT123, HE456, etc.
                        /_([A-Z]{2,})\d*/g, // Multiple uppercase letters
                        /-([A-Z]+)_/g,      // Between dashes and underscores
                        /([A-Z]+)\d*\./g    // At start before extension
                    ];

                    patterns.forEach(pattern => {
                        let match;
                        while ((match = pattern.exec(item.name)) !== null) {
                            tokens.add(match[1]);
                        }
                    });
                }
            }
        });

        return {
            cases,
            tokens: Array.from(tokens),
            totalCases: cases.length,
            uniqueTypes: [...new Set(cases.map(c => c.type))],
            uniqueCases: [...new Set(cases.map(c => c.caseId))]
        };
    };

    const handleProtocolSelect = (protocolName) => {
        setSelectedProtocol(protocolName);
        const details = getDetailedMappingInfo(protocolName, activeTab);
        setMappingDetails(details);
    };

    const refreshData = () => {
        loadProtocolData();
        if (selectedProtocol) {
            handleProtocolSelect(selectedProtocol);
        }
    };

    const currentProtocols = Array.from(protocolData[activeTab].keys()).sort();
    const protocolMappings = getProtocolMappings(activeTab);

    return (
        <div className="protocol-debug-panel">
            <div className="debug-header">
                <h2>🔍 Protocol Debug Panel</h2>
                <p>Inspect protocol mappings and token associations to identify misassignments</p>
                <button onClick={refreshData} className="refresh-btn">🔄 Refresh Data</button>
            </div>

            <div className="debug-tabs">
                <button
                    className={activeTab === 'stain' ? 'active' : ''}
                    onClick={() => setActiveTab('stain')}
                >
                    🧪 Stain Protocols
                </button>
                <button
                    className={activeTab === 'region' ? 'active' : ''}
                    onClick={() => setActiveTab('region')}
                >
                    🧠 Region Protocols
                </button>
            </div>

            <div className="debug-content">
                <div className="protocol-list">
                    <h3>Available {activeTab} Protocols ({currentProtocols.length})</h3>
                    <div className="protocol-grid">
                        {currentProtocols.map(protocol => {
                            const protocolInfo = protocolData[activeTab].get(protocol);
                            const typeCount = protocolInfo ? protocolInfo.uniqueTypes.length : 0;
                            const totalCases = protocolInfo ? protocolInfo.totalCases : 0;

                            return (
                                <div
                                    key={protocol}
                                    className={`protocol-card ${selectedProtocol === protocol ? 'selected' : ''}`}
                                    onClick={() => handleProtocolSelect(protocol)}
                                >
                                    <div className="protocol-name">{protocol}</div>
                                    <div className="protocol-stats">
                                        <span className="type-count">{typeCount} types</span>
                                        <span className="case-count">{totalCases} cases</span>
                                        {protocolInfo && (
                                            <span className={`confidence ${protocolInfo.confidence >= 0.8 ? 'high' : protocolInfo.confidence >= 0.5 ? 'medium' : 'low'}`}>
                                                {Math.round(protocolInfo.confidence * 100)}%
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Token Statistics Table */}
                <div className="token-stats-section">
                    <h3>📊 {activeTab === 'stain' ? 'Stain' : 'Region'} Token Statistics</h3>
                    <p>Count of items by {activeTab === 'stain' ? 'localStainID' : 'localRegionId'} - prioritize cleanup by frequency</p>

                    <div className="token-stats-table">
                        <div className="table-header">
                            <div className="col-token">Token</div>
                            <div className="col-count">Count</div>
                            <div className="col-percentage">% of Total</div>
                            <div className="col-mapped">Has Protocol</div>
                        </div>

                        {(activeTab === 'stain' ? stainTokenStats : regionTokenStats).map(({ token, count }, index) => {
                            const totalItems = dataStore.processedData?.length || 1;
                            const percentage = Math.round((count / totalItems) * 100);

                            // Check if this token has any protocol mappings
                            const hasProtocol = activeTab === 'stain'
                                ? protocolData.stain.has(token)
                                : protocolData.region.has(token);

                            return (
                                <div key={token} className={`table-row ${index < 10 ? 'priority' : ''}`}>
                                    <div className="col-token">
                                        <span className="token-name">{token}</span>
                                        {index < 5 && <span className="priority-badge">🔥</span>}
                                    </div>
                                    <div className="col-count">{count.toLocaleString()}</div>
                                    <div className="col-percentage">{percentage}%</div>
                                    <div className="col-mapped">
                                        <span className={`mapped-status ${hasProtocol ? 'mapped' : 'unmapped'}`}>
                                            {hasProtocol ? '✅ Mapped' : '❌ Unmapped'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {mappingDetails && (
                    <div className="mapping-details">
                        <h3>📊 Mapping Details: {selectedProtocol}</h3>

                        <div className="summary-stats">
                            <div className="stat">
                                <span className="label">Total Cases:</span>
                                <span className="value">{mappingDetails.totalCases}</span>
                            </div>
                            <div className="stat">
                                <span className="label">Unique Cases:</span>
                                <span className="value">{mappingDetails.uniqueCases.length}</span>
                            </div>
                            <div className="stat">
                                <span className="label">Types Mapped:</span>
                                <span className="value">{mappingDetails.uniqueTypes.length}</span>
                            </div>
                            <div className="stat">
                                <span className="label">Tokens Found:</span>
                                <span className="value">{mappingDetails.tokens.length}</span>
                            </div>
                        </div>

                        <div className="tokens-section">
                            <h4>🔤 Extracted Tokens</h4>
                            <div className="tokens-list">
                                {mappingDetails.tokens.map(token => (
                                    <span key={token} className="token">{token}</span>
                                ))}
                            </div>
                        </div>

                        <div className="types-section">
                            <h4>🏷️ Mapped Types</h4>
                            <div className="types-list">
                                {mappingDetails.uniqueTypes.map(type => (
                                    <span key={type} className="type-tag">{type}</span>
                                ))}
                            </div>
                        </div>

                        <div className="cases-section">
                            <h4>📋 Recent Cases</h4>
                            <div className="cases-table">
                                <div className="table-header">
                                    <span>Case ID</span>
                                    <span>Filename</span>
                                    <span>Type</span>
                                </div>
                                {mappingDetails.cases.slice(0, 10).map((caseInfo, index) => (
                                    <div key={index} className="table-row">
                                        <span>{caseInfo.caseId}</span>
                                        <span title={caseInfo.filename}>{caseInfo.filename}</span>
                                        <span>{caseInfo.type}</span>
                                    </div>
                                ))}
                                {mappingDetails.cases.length > 10 && (
                                    <div className="table-footer">
                                        ... and {mappingDetails.cases.length - 10} more cases
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProtocolDebugPanel;
