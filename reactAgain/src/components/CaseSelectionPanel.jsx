import React from 'react';

const CaseSelectionPanel = ({ cases, onCaseSelect }) => {
    if (cases.length === 0) {
        return (
            <div className="case-selection">
                <h3>🔧 NEW PROTOCOL MAPPING - Select BDSA Case</h3>
                <div className="no-cases">
                    <p>No cases with unmapped slides found.</p>
                    <p>Make sure you have:</p>
                    <ul>
                        <li>Loaded data with BDSA Case IDs assigned</li>
                        <li>Local Stain IDs and/or Region IDs in your data</li>
                    </ul>
                </div>
            </div>
        );
    }

    return (
        <div className="case-selection">
            <h3>🔧 NEW PROTOCOL MAPPING - Select BDSA Case</h3>
            <div className="case-list">
                <select
                    value=""
                    onChange={(e) => {
                        const caseData = cases.find(c => c.bdsaId === e.target.value);
                        onCaseSelect(caseData || null);
                    }}
                    className="case-selector"
                >
                    <option value="">Select a BDSA Case...</option>
                    {cases.map(caseData => (
                        <option key={caseData.bdsaId} value={caseData.bdsaId}>
                            {caseData.bdsaId} - {caseData.localCaseId} ({caseData.slides.filter(s => !s.isMapped).length} unmapped slides)
                        </option>
                    ))}
                </select>
                
                <div className="case-summary">
                    <p>Select a case above to map protocols to its unmapped slides.</p>
                    <p>Each case shows the number of slides that need protocol mapping.</p>
                </div>
            </div>
        </div>
    );
};

export default CaseSelectionPanel;
