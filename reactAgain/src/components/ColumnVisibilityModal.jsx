import React from 'react';
import { HIDDEN_DSA_FIELDS } from '../utils/constants';

const ColumnVisibilityModal = ({
    isOpen,
    onClose,
    dataStatus,
    columnVisibility,
    columnOrder,
    toggleColumnVisibility,
    moveColumn,
    showAllColumns,
    hideAllColumns,
    resetColumnOrder
}) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content column-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Column Visibility</h2>
                    <button className="close-button" onClick={onClose}>×</button>
                </div>

                <div className="column-modal-content">
                    <div className="column-panel-actions">
                        <button onClick={showAllColumns} className="show-all-btn">
                            Show All
                        </button>
                        <button onClick={hideAllColumns} className="hide-all-btn">
                            Hide All
                        </button>
                        <button onClick={resetColumnOrder} className="reset-order-btn">
                            Reset Order
                        </button>
                    </div>

                    <div className="column-list">
                        {(() => {
                            const currentOrder = columnOrder.length > 0 ? columnOrder : Object.keys(dataStatus.processedData[0]);
                            console.log('🔄 Rendering column list:', {
                                columnOrder,
                                currentOrder,
                                dataKeys: Object.keys(dataStatus.processedData[0])
                            });
                            return currentOrder;
                        })().map((columnKey, index) => (
                            <div key={columnKey} className="column-item draggable">
                                <div className="drag-handle">⋮⋮</div>
                                <label className="column-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={columnVisibility[columnKey] !== false && !HIDDEN_DSA_FIELDS.includes(columnKey)}
                                        onChange={() => toggleColumnVisibility(columnKey)}
                                    />
                                    <span className="column-name">{columnKey}</span>
                                </label>
                                <div className="column-controls">
                                    <button
                                        className="move-up-btn"
                                        onClick={() => moveColumn(index, Math.max(0, index - 1))}
                                        disabled={index === 0}
                                        title="Move Up"
                                    >
                                        ↑
                                    </button>
                                    <button
                                        className="move-down-btn"
                                        onClick={() => {
                                            const currentOrder = columnOrder.length > 0 ? columnOrder : Object.keys(dataStatus.processedData[0]);
                                            moveColumn(index, Math.min(currentOrder.length - 1, index + 1));
                                        }}
                                        disabled={index === (columnOrder.length > 0 ? columnOrder : Object.keys(dataStatus.processedData[0])).length - 1}
                                        title="Move Down"
                                    >
                                        ↓
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ColumnVisibilityModal;
