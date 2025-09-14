import React, { useState, useEffect } from 'react';
import schemaValidator from '../utils/schemaValidator';
import ProtocolFormFields from './ProtocolFormFields';
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
    const [schemaLoaded, setSchemaLoaded] = useState(false);

    useEffect(() => {
        // Load schema on component mount
        const loadSchema = async () => {
            const loaded = await schemaValidator.loadSchemas();
            setSchemaLoaded(loaded);
        };
        loadSchema();
    }, []);

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

    const renderStainFields = () => {
        if (!schemaLoaded) {
            return <div className="loading">Loading schema...</div>;
        }

        return (
            <>
                <div className="form-group">
                    <label htmlFor="stainType">Stain Type *</label>
                    <select
                        id="stainType"
                        value={formData.stainType}
                        onChange={(e) => {
                            const newFormData = {
                                ...formData,
                                stainType: e.target.value,
                                // Clear dependent fields when stain type changes
                                antibody: '',
                                technique: '',
                                phosphoSpecific: ''
                            };
                            setFormData(newFormData);
                            setErrors(prev => ({ ...prev, stainType: '', antibody: '', technique: '', phosphoSpecific: '' }));
                            validateForm(newFormData);
                        }}
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
                        {/* Antibody field - only show if schema defines it */}
                        {schemaValidator.getAntibodyOptions(formData.stainType).length > 0 && (
                            <div className="form-group">
                                <label htmlFor="antibody">Antibody</label>
                                <select
                                    id="antibody"
                                    value={formData.antibody}
                                    onChange={(e) => handleFieldChange('antibody', e.target.value)}
                                    className={errors.antibody ? 'error' : ''}
                                >
                                    <option value="">Select antibody</option>
                                    {schemaValidator.getAntibodyOptions(formData.stainType).map(antibody => (
                                        <option key={antibody} value={antibody}>{antibody}</option>
                                    ))}
                                </select>
                                {errors.antibody && <span className="error-message">{errors.antibody}</span>}
                            </div>
                        )}

                        {/* Technique field - only show if schema defines it */}
                        {schemaValidator.getTechniqueOptions(formData.stainType).length > 0 && (
                            <div className="form-group">
                                <label htmlFor="technique">Technique</label>
                                <select
                                    id="technique"
                                    value={formData.technique}
                                    onChange={(e) => handleFieldChange('technique', e.target.value)}
                                    className={errors.technique ? 'error' : ''}
                                >
                                    <option value="">Select technique</option>
                                    {schemaValidator.getTechniqueOptions(formData.stainType).map(technique => (
                                        <option key={technique} value={technique}>{technique}</option>
                                    ))}
                                </select>
                                {errors.technique && <span className="error-message">{errors.technique}</span>}
                            </div>
                        )}

                        {/* Phospho-specific field - only show if schema defines it */}
                        {schemaValidator.getPhosphoSpecificOptions(formData.stainType).length > 0 && (
                            <div className="form-group">
                                <label htmlFor="phosphoSpecific">Phospho-specific</label>
                                <select
                                    id="phosphoSpecific"
                                    value={formData.phosphoSpecific}
                                    onChange={(e) => handleFieldChange('phosphoSpecific', e.target.value)}
                                    className={errors.phosphoSpecific ? 'error' : ''}
                                >
                                    <option value="">Select phospho-specific</option>
                                    {schemaValidator.getPhosphoSpecificOptions(formData.stainType).map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                                {errors.phosphoSpecific && <span className="error-message">{errors.phosphoSpecific}</span>}
                            </div>
                        )}

                        {/* Dilution field - always show for non-ignore stains */}
                        <div className="form-group">
                            <label htmlFor="dilution">Dilution</label>
                            <input
                                type="text"
                                id="dilution"
                                value={formData.dilution}
                                onChange={(e) => handleFieldChange('dilution', e.target.value)}
                                placeholder="e.g., 1:1000"
                                className={errors.dilution ? 'error' : ''}
                            />
                            {errors.dilution && <span className="error-message">{errors.dilution}</span>}
                            {schemaValidator.getDilutionPattern(formData.stainType) && (
                                <small className="field-hint">
                                    Pattern: {schemaValidator.getDilutionPattern(formData.stainType)}
                                </small>
                            )}
                        </div>

                        {/* Vendor field - always show for non-ignore stains */}
                        <div className="form-group">
                            <label htmlFor="vendor">Vendor</label>
                            <input
                                type="text"
                                id="vendor"
                                value={formData.vendor}
                                onChange={(e) => handleFieldChange('vendor', e.target.value)}
                                placeholder="e.g., Abcam, Cell Signaling"
                                className={errors.vendor ? 'error' : ''}
                            />
                            {errors.vendor && <span className="error-message">{errors.vendor}</span>}
                            {schemaValidator.getVendorPattern(formData.stainType) && (
                                <small className="field-hint">
                                    Pattern: {schemaValidator.getVendorPattern(formData.stainType)}
                                </small>
                            )}
                        </div>
                    </>
                )}
            </>
        );
    };

    const renderRegionFields = () => {
        if (!schemaLoaded) {
            return <div className="loading">Loading schema...</div>;
        }

        return (
            <>
                <div className="form-group">
                    <label htmlFor="regionType">Region Type *</label>
                    <select
                        id="regionType"
                        value={formData.regionType}
                        onChange={(e) => {
                            const newFormData = {
                                ...formData,
                                regionType: e.target.value,
                                // Clear dependent fields when region type changes
                                subRegion: ''
                            };
                            setFormData(newFormData);
                            setErrors(prev => ({ ...prev, regionType: '', subRegion: '' }));
                            validateForm(newFormData);
                        }}
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
                        {/* Sub-Region field - only show if schema defines it */}
                        {schemaValidator.getSubRegionOptions(formData.regionType).length > 0 && (
                            <div className="form-group">
                                <label htmlFor="subRegion">Sub-Region</label>
                                <select
                                    id="subRegion"
                                    value={formData.subRegion}
                                    onChange={(e) => handleFieldChange('subRegion', e.target.value)}
                                    className={errors.subRegion ? 'error' : ''}
                                >
                                    <option value="">Select sub-region</option>
                                    {schemaValidator.getSubRegionOptions(formData.regionType).map(subRegion => (
                                        <option key={subRegion} value={subRegion}>{subRegion}</option>
                                    ))}
                                </select>
                                {errors.subRegion && <span className="error-message">{errors.subRegion}</span>}
                            </div>
                        )}

                        {/* Hemisphere field */}
                        <div className="form-group">
                            <label htmlFor="hemisphere">Hemisphere</label>
                            <select
                                id="hemisphere"
                                value={formData.hemisphere}
                                onChange={(e) => handleFieldChange('hemisphere', e.target.value)}
                                className={errors.hemisphere ? 'error' : ''}
                            >
                                <option value="">Select hemisphere</option>
                                {schemaValidator.getHemisphereOptions().map(hemisphere => (
                                    <option key={hemisphere} value={hemisphere}>
                                        {hemisphere.charAt(0).toUpperCase() + hemisphere.slice(1)}
                                    </option>
                                ))}
                            </select>
                            {errors.hemisphere && <span className="error-message">{errors.hemisphere}</span>}
                        </div>

                        {/* Slice Orientation field */}
                        <div className="form-group">
                            <label htmlFor="sliceOrientation">Slice Orientation</label>
                            <select
                                id="sliceOrientation"
                                value={formData.sliceOrientation}
                                onChange={(e) => handleFieldChange('sliceOrientation', e.target.value)}
                                className={errors.sliceOrientation ? 'error' : ''}
                            >
                                <option value="">Select orientation</option>
                                {schemaValidator.getSliceOrientationOptions().map(orientation => (
                                    <option key={orientation} value={orientation}>
                                        {orientation.charAt(0).toUpperCase() + orientation.slice(1)}
                                    </option>
                                ))}
                            </select>
                            {errors.sliceOrientation && <span className="error-message">{errors.sliceOrientation}</span>}
                        </div>

                        {/* Damage field - Hidden for now as it's slide-specific, not protocol-level */}
                        {/* 
                        <div className="form-group">
                            <label>Damage (Optional)</label>
                            <div className="checkbox-group">
                                {schemaValidator.getDamageOptions().map(damageType => (
                                    <label key={damageType} className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={formData.damage.includes(damageType)}
                                            onChange={(e) => {
                                                const updatedDamage = e.target.checked
                                                    ? [...formData.damage, damageType]
                                                    : formData.damage.filter(d => d !== damageType);
                                                handleFieldChange('damage', updatedDamage);
                                            }}
                                        />
                                        <span>{damageType}</span>
                                    </label>
                                ))}
                            </div>
                            {errors.damage && <span className="error-message">{errors.damage}</span>}
                        </div>
                        */}
                    </>
                )}
            </>
        );
    };

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
