import React, { useState, useEffect } from 'react';
import schemaValidator from '../utils/schemaValidator';
import './ProtocolModal.css';

const ProtocolModal = ({ protocol, type, onSave, onClose }) => {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        stainType: '',
        antibody: '',
        technique: '',
        phosphoSpecific: '',
        dilution: '',
        vendor: '',
        regionType: '',
        subRegion: '',
        hemisphere: '',
        sliceOrientation: '',
        damage: []
    });
    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (protocol) {
            setFormData({
                name: protocol.name || '',
                description: protocol.description || '',
                stainType: protocol.stainType || '',
                antibody: protocol.antibody || '',
                technique: protocol.technique || '',
                phosphoSpecific: protocol.phosphoSpecific || '',
                dilution: protocol.dilution || '',
                vendor: protocol.vendor || '',
                regionType: protocol.regionType || '',
                subRegion: protocol.subRegion || '',
                hemisphere: protocol.hemisphere || '',
                sliceOrientation: protocol.sliceOrientation || '',
                damage: protocol.damage || []
            });
        }
    }, [protocol]);

    const handleFieldChange = (field, value) => {
        const newFormData = { ...formData, [field]: value };
        setFormData(newFormData);

        // Clear field error when user starts typing
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
        }

        // Validate the updated form
        validateForm(newFormData);
    };

    const validateForm = (data) => {
        const validationErrors = type === 'stain'
            ? schemaValidator.validateStainProtocol(data)
            : schemaValidator.validateRegionProtocol(data);
        setErrors(validationErrors);
        return Object.keys(validationErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm(formData)) {
            return;
        }

        setIsLoading(true);
        try {
            await onSave(formData);
        } finally {
            setIsLoading(false);
        }
    };

    const renderStainFields = () => (
        <>
            <div className="form-group">
                <label htmlFor="stainType">Stain Type *</label>
                <select
                    id="stainType"
                    value={formData.stainType}
                    onChange={(e) => handleFieldChange('stainType', e.target.value)}
                    className={errors.stainType ? 'error' : ''}
                >
                    <option value="">Select stain type</option>
                    {schemaValidator.getStainTypeOptions().map(option => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                {errors.stainType && <span className="error-message">{errors.stainType}</span>}
            </div>

            {formData.stainType && formData.stainType !== 'ignore' && (
                <>
                    <div className="form-group">
                        <label htmlFor="antibody">Antibody</label>
                        <select
                            id="antibody"
                            value={formData.antibody}
                            onChange={(e) => handleFieldChange('antibody', e.target.value)}
                        >
                            <option value="">Select antibody</option>
                            {schemaValidator.getAntibodyOptions(formData.stainType).map(antibody => (
                                <option key={antibody} value={antibody}>{antibody}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label htmlFor="technique">Technique</label>
                        <select
                            id="technique"
                            value={formData.technique}
                            onChange={(e) => handleFieldChange('technique', e.target.value)}
                        >
                            <option value="">Select technique</option>
                            {schemaValidator.getTechniqueOptions(formData.stainType).map(technique => (
                                <option key={technique} value={technique}>{technique}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label htmlFor="phosphoSpecific">Phospho-specific</label>
                        <input
                            type="text"
                            id="phosphoSpecific"
                            value={formData.phosphoSpecific}
                            onChange={(e) => handleFieldChange('phosphoSpecific', e.target.value)}
                            placeholder="e.g., pS6, pERK"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="dilution">Dilution</label>
                        <input
                            type="text"
                            id="dilution"
                            value={formData.dilution}
                            onChange={(e) => handleFieldChange('dilution', e.target.value)}
                            placeholder="e.g., 1:1000"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="vendor">Vendor</label>
                        <input
                            type="text"
                            id="vendor"
                            value={formData.vendor}
                            onChange={(e) => handleFieldChange('vendor', e.target.value)}
                            placeholder="e.g., Abcam, Cell Signaling"
                        />
                    </div>
                </>
            )}
        </>
    );

    const renderRegionFields = () => (
        <>
            <div className="form-group">
                <label htmlFor="regionType">Region Type *</label>
                <select
                    id="regionType"
                    value={formData.regionType}
                    onChange={(e) => handleFieldChange('regionType', e.target.value)}
                    className={errors.regionType ? 'error' : ''}
                >
                    <option value="">Select region type</option>
                    {schemaValidator.getRegionTypeOptions().map(option => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                {errors.regionType && <span className="error-message">{errors.regionType}</span>}
            </div>

            {formData.regionType && formData.regionType !== 'ignore' && (
                <>
                    <div className="form-group">
                        <label htmlFor="subRegion">Sub-Region</label>
                        <input
                            type="text"
                            id="subRegion"
                            value={formData.subRegion}
                            onChange={(e) => handleFieldChange('subRegion', e.target.value)}
                            placeholder="e.g., CA1, CA2, CA3"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="hemisphere">Hemisphere</label>
                        <select
                            id="hemisphere"
                            value={formData.hemisphere}
                            onChange={(e) => handleFieldChange('hemisphere', e.target.value)}
                        >
                            <option value="">Select hemisphere</option>
                            <option value="left">Left</option>
                            <option value="right">Right</option>
                            <option value="bilateral">Bilateral</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label htmlFor="sliceOrientation">Slice Orientation</label>
                        <select
                            id="sliceOrientation"
                            value={formData.sliceOrientation}
                            onChange={(e) => handleFieldChange('sliceOrientation', e.target.value)}
                        >
                            <option value="">Select orientation</option>
                            <option value="coronal">Coronal</option>
                            <option value="sagittal">Sagittal</option>
                            <option value="horizontal">Horizontal</option>
                        </select>
                    </div>
                </>
            )}
        </>
    );

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{protocol ? 'Edit' : 'Add New'} {type === 'stain' ? 'Stain' : 'Region'} Protocol</h2>
                    <button className="close-button" onClick={onClose}>×</button>
                </div>

                <form onSubmit={handleSubmit} className="protocol-form">
                    <div className="form-group">
                        <label htmlFor="name">Protocol Name *</label>
                        <input
                            type="text"
                            id="name"
                            value={formData.name}
                            onChange={(e) => handleFieldChange('name', e.target.value)}
                            className={errors.name ? 'error' : ''}
                            placeholder="Enter protocol name"
                        />
                        {errors.name && <span className="error-message">{errors.name}</span>}
                    </div>

                    <div className="form-group">
                        <label htmlFor="description">Description</label>
                        <textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => handleFieldChange('description', e.target.value)}
                            placeholder="Enter protocol description"
                            rows="3"
                        />
                    </div>

                    {type === 'stain' ? renderStainFields() : renderRegionFields()}

                    <div className="modal-actions">
                        <button type="button" onClick={onClose} className="cancel-button">
                            Cancel
                        </button>
                        <button type="submit" className="save-button" disabled={isLoading}>
                            {isLoading ? 'Saving...' : (protocol ? 'Update' : 'Create')} Protocol
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProtocolModal;
