import React, { useEffect, useRef, useState } from 'react';
import dataStore from '../utils/dataStore';
import { formatBdsaCaseId } from '../utils/bdsaCaseIdAllocator';

const CaseIdMappingSection = ({
    bdsaInstitutionId,
    setBdsaInstitutionId,
    institutionLocked = false,
    institutionSource = '',
    onSaveInstitutionId,
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
    handleSyncCaseIdMappingsToDSA,
    handlePullCaseIdMappingsFromDSA,
    generateCaseId,
    isGenerating,
    sortField,
    sortDirection,
    handleSort,
    getSortIcon,
    hostImported = false,
}) => {
    const originalInstitutionId = useRef(bdsaInstitutionId);
    const [draftInstitutionId, setDraftInstitutionId] = useState(bdsaInstitutionId);

    useEffect(() => {
        setDraftInstitutionId(bdsaInstitutionId);
        originalInstitutionId.current = bdsaInstitutionId;
    }, [bdsaInstitutionId]);
    const [isUnlocking, setIsUnlocking] = useState(false);
    const [isSavingInstitution, setIsSavingInstitution] = useState(false);
    const exampleId = bdsaInstitutionId
        ? formatBdsaCaseId(bdsaInstitutionId, 1, hostImported ? 'host' : 'wrangler')
        : '';
    const sourceLabel = institutionSource === 'collection'
        ? 'this collection'
        : institutionSource === 'server'
            ? 'this BDSA server'
            : 'this folder';
    const showHostCaseColumn = hostImported && filteredCaseIds.some((caseId) => (
        caseId.hostStatus === 'existing' || caseId.hostStatus === 'conflict'
    ));

    const requestUnlock = () => {
        const confirmed = window.confirm(
            `This Institution ID is stored on ${sourceLabel}. Changing it does not rewrite existing BDSA Case IDs, so new IDs can diverge.\n\nOnly change this if you know the stored value is wrong.`
        );
        if (!confirmed) return;
        const typed = window.prompt(`Type the current Institution ID to unlock:\n${bdsaInstitutionId}`);
        if (typed !== bdsaInstitutionId) {
            if (typed != null) alert('Unlock cancelled. The typed value did not match.');
            return;
        }
        setDraftInstitutionId(bdsaInstitutionId);
        setIsUnlocking(true);
    };

    const saveInstitution = async () => {
        const next = (isUnlocking ? draftInstitutionId : bdsaInstitutionId).trim();
        if (!next) {
            alert('Enter an Institution ID first.');
            return;
        }
        setIsSavingInstitution(true);
        try {
            if (onSaveInstitutionId) {
                await onSaveInstitutionId(next);
            } else {
                setBdsaInstitutionId(next);
            }
            originalInstitutionId.current = next;
            setIsUnlocking(false);
        } catch (error) {
            alert(error.message || 'Could not save Institution ID');
        } finally {
            setIsSavingInstitution(false);
        }
    };

    return (
        <div className="case-id-mapping-content">
            {/* Mapping Settings */}
            <div className="mapping-settings">
                <div className="setting-group">
                    <label htmlFor="institution-id">BDSA Institution ID:</label>
                    {institutionLocked && !isUnlocking ? (
                        <div className="institution-locked">
                            <code className="institution-locked-value">{bdsaInstitutionId}</code>
                            <button
                                type="button"
                                className="institution-change-btn"
                                onClick={requestUnlock}
                            >
                                Change…
                            </button>
                        </div>
                    ) : (
                        <div className="institution-edit">
                            <input
                                id="institution-id"
                                type="text"
                                value={isUnlocking ? draftInstitutionId : bdsaInstitutionId}
                                onChange={(e) => {
                                    if (isUnlocking) {
                                        setDraftInstitutionId(e.target.value);
                                    } else {
                                        setBdsaInstitutionId(e.target.value);
                                    }
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveInstitution();
                                }}
                                className="institution-id-input"
                                placeholder="e.g. BDSA02"
                            />
                            <button
                                type="button"
                                className="institution-save-btn"
                                onClick={saveInstitution}
                                disabled={isSavingInstitution}
                            >
                                {isSavingInstitution ? 'Saving…' : 'Save to folder'}
                            </button>
                            {isUnlocking && (
                                <button
                                    type="button"
                                    className="institution-cancel-btn"
                                    onClick={() => {
                                        setIsUnlocking(false);
                                        setDraftInstitutionId(bdsaInstitutionId);
                                    }}
                                >
                                    Cancel
                                </button>
                            )}
                        </div>
                    )}
                    <small>
                        {bdsaInstitutionId
                            ? `Stored on ${sourceLabel}. New IDs look like ${exampleId}.`
                            : 'Set once on this folder or collection. After that it stays locked so IDs do not drift.'}
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
                        {!hostImported && (
                            <>
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
                            </>
                        )}
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
                                {showHostCaseColumn && <th>Host case</th>}
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
                                        {showHostCaseColumn && (
                                            <td>
                                                {(caseId.hostStatus === 'existing' || caseId.hostStatus === 'conflict') ? (
                                                    <span
                                                        className={`host-case-badge host-case-${caseId.hostStatus}`}
                                                        title={caseId.hostReason || caseId.hostNetworkId || ''}
                                                    >
                                                        {caseId.hostStatus === 'existing' ? 'Existing' : 'Conflict'}
                                                    </span>
                                                ) : null}
                                            </td>
                                        )}
                                        <td>
                                            {!caseId.isMapped ? (
                                                <button
                                                    className="generate-case-id-btn"
                                                    onClick={() => generateCaseId(caseId.localCaseId)}
                                                    disabled={isGenerating || isGeneratingAll}
                                                >
                                                    {isGenerating || isGeneratingAll ? '⏳' : '🚀'} Generate
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
