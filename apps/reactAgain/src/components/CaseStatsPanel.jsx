import React from 'react';

const CaseStatsPanel = ({ stats }) => {
    return (
        <div className="case-stats">
            <div className="stat-item">
                <span className="stat-number">{stats.unmappedSlides}</span>
                <span className="stat-label">Unmapped Slides</span>
            </div>
            <div className="stat-item">
                <span className="stat-number">{stats.mappedCases}</span>
                <span className="stat-label">Mapped Cases</span>
            </div>
            <div className="stat-item">
                <span className="stat-number">{stats.bdsaCaseIds}</span>
                <span className="stat-label">BDSA Case IDs</span>
            </div>
            {stats.localConflictCount > 0 && (
                <div className="stat-item conflict-stat">
                    <span className="stat-number conflict">{stats.localConflictCount}</span>
                    <span className="stat-label">Local Case ID Conflicts</span>
                </div>
            )}
            {stats.bdsaConflictCount > 0 && (
                <div className="stat-item conflict-stat">
                    <span className="stat-number conflict">{stats.bdsaConflictCount}</span>
                    <span className="stat-label">BDSA Case ID Conflicts</span>
                </div>
            )}
        </div>
    );
};

export default CaseStatsPanel;
