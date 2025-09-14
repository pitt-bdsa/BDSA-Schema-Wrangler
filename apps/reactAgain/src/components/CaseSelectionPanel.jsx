import React, { useState, useEffect } from 'react';

const CaseSelectionPanel = ({ cases, onCaseSelect, selectedCase }) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    // Update current index when selectedCase changes
    useEffect(() => {
        if (selectedCase && cases.length > 0) {
            const index = cases.findIndex(c => c.bdsaId === selectedCase.bdsaId);
            if (index !== -1) {
                setCurrentIndex(index);
            }
        }
    }, [selectedCase, cases]);

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

    const currentCase = cases[currentIndex];
    const unmappedCount = currentCase.slides.filter(s => !s.isMapped).length;

    const handlePrevious = () => {
        const newIndex = currentIndex > 0 ? currentIndex - 1 : cases.length - 1;
        setCurrentIndex(newIndex);
        onCaseSelect(cases[newIndex]);
    };

    const handleNext = () => {
        const newIndex = currentIndex < cases.length - 1 ? currentIndex + 1 : 0;
        setCurrentIndex(newIndex);
        onCaseSelect(cases[newIndex]);
    };


    return (
        <div className="case-selection">
            <h3>🔧 NEW PROTOCOL MAPPING - Select BDSA Case</h3>
            <div className="case-navigation">
                <div className="case-navigator">
                    <button
                        onClick={handlePrevious}
                        className="nav-arrow prev"
                        title="Previous case"
                    >
                        ←
                    </button>

                    <div className="case-display">
                        <div className="case-info">
                            <div className="case-id">
                                {currentCase.bdsaId}
                            </div>
                            <div className="case-details">
                                <span className="local-id">Local: {currentCase.localCaseId}</span>
                                <span className="unmapped-count">
                                    {unmappedCount} unmapped slide{unmappedCount !== 1 ? 's' : ''}
                                </span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleNext}
                        className="nav-arrow next"
                        title="Next case"
                    >
                        →
                    </button>
                </div>

                <div className="case-summary">
                    <p>Use arrows to navigate between cases. Protocol mapping interface appears automatically below.</p>
                    <p>Case {currentIndex + 1} of {cases.length} • {unmappedCount} slides need protocol mapping</p>
                </div>
            </div>
        </div>
    );
};

export default CaseSelectionPanel;
