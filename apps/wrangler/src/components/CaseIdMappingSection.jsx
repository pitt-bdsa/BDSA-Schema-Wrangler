import React, { useRef } from 'react';
import dataStore from '../utils/dataStore';

const CaseIdMappingSection = ({
    bdsaInstitutionId,
    setBdsaInstitutionId,
    filteredCaseIds,
    duplicateBdsaCaseIds,
    clearDuplicates,
    isGeneratingAll,
    generateAllProgress,
    stats,
    temporaryHideMapped,
    setTemporaryHideMapped,
    showOnlyDuplicates,
    setShowOnlyDuplicates,
    caseIdFilter,
    setCaseIdFilter,
    generateAllCaseIds,
    isGeneratingAll: isGenerating,
    handleSyncCaseIdMappingsToDSA,
    handlePullCaseIdMappingsFromDSA,
    filteredCaseIds: caseIds,
    generateCaseId,
    isGenerating: isGeneratingSingle,
    sortField,
    sortDirection,
    handleSort,
    getSortIcon
}) => {
    // Track the original institution ID value for confirmation
    const originalInstitutionId = useRef(bdsaInstitutionId);

    return (
        <div className="case-id-mapping-content">
            {/* Mapping Settings */}
            <div className="mapping-settings">
                <div className="setting-group">
                    <label htmlFor="institution-id">BDSA Institution ID:</label>
                    <input
                        id="institution-id"
                        type="text"
                        value={bdsaInstitutionId}
                        onChange={(e) => {
                            // Just update the local state, don't trigger confirmation yet
                            setBdsaInstitutionId(e.target.value);
                        }}
                        onBlur={(e) => {
                            const newValue = e.target.value.trim();
                            const originalValue = originalInstitutionId.current;

                            // Only show confirmation if there's an actual change and original value exists
                            if (originalValue && originalValue.trim() !== '' && newValue !== originalValue && newValue !== '') {
                                const confirmMessage = `Are you sure you want to change the BDSA Institution ID from "${originalValue}" to "${newValue}"?\n\nThis will affect all future BDSA Case ID generation.`;
                                if (!window.confirm(confirmMessage)) {
                                    // Reset to original value if user cancels
                                    setBdsaInstitutionId(originalValue);
                                    e.target.value = originalValue;
                                } else {
                                    // Update the ref to the new value
                                    originalInstitutionId.current = newValue;
                                }
                            } else if (newValue !== originalValue) {
                                // Update the ref when value changes (even if no confirmation needed)
                                originalInstitutionId.current = newValue;
                            }
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.target.blur(); // Trigger the blur handler
                            }
                        }}
                        className="institution-id-input"
                        placeholder="Auto-set from DSA collection (or enter manually)"
                        style={{
                            backgroundColor: bdsaInstitutionId ? '#f0f8ff' : '#fff',
                            borderColor: bdsaInstitutionId ? '#4a90e2' : '#ccc'
                        }}
                    />
                    <small>
                        {bdsaInstitutionId
                            ? `Used for generating BDSA Case IDs (e.g., BDSA-${bdsaInstitutionId}-0001)`
                            : 'Will be auto-set when you pull data from DSA, or enter manually if needed'
                        }
                    </small>
                </div>
                <div className="setting-group">
                    <label>Data Source Column:</label>
                    <div className="data-source-info">
                        <span className="data-source-text">
                            Showing unique case IDs from column: BDSA.bdsaLocal.localCaseId
                        </span>
                        <br />
                        <span className="total-cases-text">
                            Total unique cases: {filteredCaseIds.length}
                        </span>
                    </div>
                </div>
            </div>

            {/* Duplicate Warning */}
            {duplicateBdsaCaseIds.size > 0 && (
                <div className="duplicate-warning">
                    <div className="warning-header">
                        <span className="warning-icon">⚠️</span>
                        <span className="warning-text">
                            Warning: {duplicateBdsaCaseIds.size} duplicate BDSA Case IDs detected!
                        </span>
                    </div>
                    <div className="warning-actions">
                        <button className="clear-duplicates-btn" onClick={clearDuplicates}>
                            🗑️ Clear Duplicates ({duplicateBdsaCaseIds.size})
                        </button>
                    </div>
                </div>
            )}

            {/* Bulk Generation Progress */}
            {isGeneratingAll && (
                <div className="bulk-generation-progress">
                    <div className="progress-info">
                        <span>Generating BDSA Case IDs...</span>
                        <span>{generateAllProgress.current} of {generateAllProgress.total}</span>
                    </div>
                    <div className="progress-bar">
                        <div
                            className="progress-fill"
                            style={{ width: `${(generateAllProgress.current / generateAllProgress.total) * 100}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Case ID Table */}
            <div className="case-id-mapping-table">
                <div className="mapping-summary">
                    <div className="summary-info">
                        <p>
                            Showing unique case IDs from column: BDSA.bdsaLocal.localCaseId
                        </p>
                        <p>Total unique cases: {filteredCaseIds.length}</p>
                    </div>
                    <div className="mapping-controls">
                        <div className="search-filter">
                            <input
                                type="text"
                                placeholder="Search by Local Case ID or BDSA Case ID..."
                                value={caseIdFilter}
                                onChange={(e) => setCaseIdFilter(e.target.value)}
                                className="case-search-input"
                                style={{
                                    padding: '8px 12px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    fontSize: '14px',
                                    minWidth: '300px'
                                }}
                            />
                            {caseIdFilter && (
                                <button
                                    onClick={() => setCaseIdFilter('')}
                                    className="clear-search-btn"
                                    style={{
                                        marginLeft: '8px',
                                        padding: '8px 12px',
                                        border: '1px solid #ccc',
                                        borderRadius: '4px',
                                        backgroundColor: '#f5f5f5',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                        <button
                            className={`toggle-mapped-btn ${temporaryHideMapped ? 'active' : ''}`}
                            onClick={() => setTemporaryHideMapped(!temporaryHideMapped)}
                        >
                            👤 {temporaryHideMapped ? 'Show All' : 'Hide Mapped'}
                        </button>
                        {duplicateBdsaCaseIds.size > 0 && (
                            <button
                                className={`show-duplicates-btn ${showOnlyDuplicates ? 'active' : ''}`}
                                onClick={() => {
                                    setShowOnlyDuplicates(!showOnlyDuplicates);
                                    // Reset the hide mapped filter when showing duplicates
                                    if (!showOnlyDuplicates && temporaryHideMapped) {
                                        setTemporaryHideMapped(false);
                                    }
                                }}
                            >
                                🟠 {showOnlyDuplicates ? 'Show All' : `Show Only Duplicates (${duplicateBdsaCaseIds.size})`}
                            </button>
                        )}
                        <button
                            className="clear-all-btn"
                            onClick={() => {
                                if (window.confirm('Clear all BDSA Case ID mappings?\n\nThis will remove all BDSA Case IDs but preserve your local case IDs, stain IDs, and region IDs.')) {
                                    dataStore.clearCaseIdMappings();
                                }
                            }}
                            disabled={isGeneratingAll || filteredCaseIds.filter(c => c.isMapped).length === 0}
                            style={{
                                backgroundColor: '#dc3545',
                                color: 'white',
                                border: 'none',
                                padding: '10px 16px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: '500',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            🗑️ Clear All Mappings
                        </button>
                        <button
                            className="generate-all-btn"
                            onClick={generateAllCaseIds}
                            disabled={isGeneratingAll || filteredCaseIds.filter(c => !c.isMapped).length === 0}
                        >
                            🚀 Generate All
                        </button>
                        <button
                            className="dsa-sync-btn"
                            onClick={handleSyncCaseIdMappingsToDSA}
                            title="Push case ID mappings to DSA server"
                        >
                            🔄 Push to DSA
                        </button>
                        <button
                            className="dsa-sync-btn"
                            onClick={handlePullCaseIdMappingsFromDSA}
                            title="Pull case ID mappings from DSA server"
                        >
                            ⬇️ Pull from DSA
                        </button>
                    </div>
                </div>

                <div className="table-container">
                    <table className="case-id-table">
                        <thead>
                            <tr>
                                <th
                                    className="sortable"
                                    onClick={() => handleSort('localCaseId')}
                                >
                                    Local Case ID {getSortIcon('localCaseId')}
                                </th>
                                <th
                                    className="sortable"
                                    onClick={() => handleSort('bdsaCaseId')}
                                >
                                    BDSA Case ID {getSortIcon('bdsaCaseId')}
                                </th>
                                <th
                                    className="sortable"
                                    onClick={() => handleSort('rowCount')}
                                >
                                    Rows {getSortIcon('rowCount')}
                                </th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCaseIds.map((caseId) => {
                                const isDuplicate = caseId.bdsaCaseId && duplicateBdsaCaseIds.has(caseId.bdsaCaseId);
                                return (
                                    <tr
                                        key={caseId.localCaseId}
                                        className={`${caseId.isMapped ? 'mapped' : 'unmapped'} ${isDuplicate ? 'duplicate-bdsa-case' : ''}`}
                                    >
                                        <td>{caseId.localCaseId}</td>
                                        <td>
                                            {caseId.isMapped ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <input
                                                        type="text"
                                                        value={caseId.bdsaCaseId || ''}
                                                        onChange={(e) => {
                                                            // Update immediately as user types for better UX
                                                            const newValue = e.target.value.trim();
                                                            if (newValue !== caseId.bdsaCaseId) {
                                                                console.log(`🔧 Updating BDSA Case ID for localCaseId "${caseId.localCaseId}": "${caseId.bdsaCaseId}" → "${newValue}"`);
                                                                dataStore.setCaseIdInData(caseId.localCaseId, newValue);
                                                            }
                                                        }}
                                                        onKeyDown={(e) => {
                                                            // Handle Enter key
                                                            if (e.key === 'Enter') {
                                                                e.target.blur();
                                                            }
                                                        }}
                                                        className={`bdsa-case-id-input ${isDuplicate ? 'duplicate' : ''}`}
                                                        style={{
                                                            flex: 1,
                                                            minWidth: '150px'
                                                        }}
                                                    />
                                                    {isDuplicate && <span style={{ fontSize: '0.8em', color: '#856404' }}>🟠 DUPLICATE</span>}
                                                </div>
                                            ) : (
                                                <span className="unmapped-case-id">Not mapped</span>
                                            )}
                                        </td>
                                        <td>{caseId.rowCount}</td>
                                        <td>
                                            {!caseId.isMapped ? (
                                                <button
                                                    className="generate-case-id-btn"
                                                    onClick={() => generateCaseId(caseId.localCaseId)}
                                                    disabled={isGenerating}
                                                >
                                                    {isGenerating ? '⏳' : '🚀'} Generate
                                                </button>
                                            ) : (
                                                <span className="mapped-indicator">
                                                    ✓ Mapped
                                                    {isDuplicate && <span style={{ marginLeft: '4px' }}>🟠</span>}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default CaseIdMappingSection;
