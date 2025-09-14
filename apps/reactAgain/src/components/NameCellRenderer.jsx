import React, { useState, useRef, useEffect } from 'react';
import './NameCellRenderer.css';

const NameCellRenderer = ({ value }) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const [isTruncated, setIsTruncated] = useState(false);
    const textRef = useRef(null);

    useEffect(() => {
        if (textRef.current) {
            // Check if text is actually truncated by comparing scroll width to client width
            const element = textRef.current;
            setIsTruncated(element.scrollWidth > element.clientWidth);
        }
    }, [value]);

    if (!value) {
        return <span className="name-cell">-</span>;
    }

    return (
        <div
            className="name-cell-container"
            onMouseEnter={() => isTruncated && setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            <span ref={textRef} className="name-cell">{value}</span>
            {showTooltip && isTruncated && (
                <div className="name-tooltip">
                    {value}
                </div>
            )}
        </div>
    );
};

export default NameCellRenderer;
