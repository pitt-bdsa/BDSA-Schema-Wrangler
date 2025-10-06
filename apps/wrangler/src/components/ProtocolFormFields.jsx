import React from 'react';
import schemaValidator from '../utils/schemaValidator';

const ProtocolFormFields = ({
    type,
    formData,
    errors,
    onFieldChange,
    onStainTypeChange,
    onRegionTypeChange
}) => {
    const renderStainFields = () => {
        return (
            <>
                <div className="form-group">
                    <label htmlFor="stainType">Stain Type *</label>
                    <select
                        id="stainType"
                        value={formData.stainType}
                        onChange={onStainTypeChange}
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
                            <label htmlFor="antibody">Antibody *</label>
                            <input
                                type="text"
                                id="antibody"
                                value={formData.antibody}
                                onChange={(e) => onFieldChange('antibody', e.target.value)}
                                className={errors.antibody ? 'error' : ''}
                                placeholder="Enter antibody name"
                            />
                            {errors.antibody && <span className="error-message">{errors.antibody}</span>}
                        </div>

                        <div className="form-group">
                            <label htmlFor="technique">Technique *</label>
                            <select
                                id="technique"
                                value={formData.technique}
                                onChange={(e) => onFieldChange('technique', e.target.value)}
                                className={errors.technique ? 'error' : ''}
                            >
                                <option value="">Select technique</option>
                                {schemaValidator.getTechniqueOptions().map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            {errors.technique && <span className="error-message">{errors.technique}</span>}
                        </div>

                        <div className="form-group">
                            <label htmlFor="phosphoSpecific">Phospho-specific</label>
                            <select
                                id="phosphoSpecific"
                                value={formData.phosphoSpecific}
                                onChange={(e) => onFieldChange('phosphoSpecific', e.target.value)}
                            >
                                <option value="">Select phospho-specific</option>
                                {schemaValidator.getPhosphoSpecificOptions().map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="dilution">Dilution</label>
                            <input
                                type="text"
                                id="dilution"
                                value={formData.dilution}
                                onChange={(e) => onFieldChange('dilution', e.target.value)}
                                placeholder="e.g., 1:1000"
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="vendor">Vendor</label>
                            <input
                                type="text"
                                id="vendor"
                                value={formData.vendor}
                                onChange={(e) => onFieldChange('vendor', e.target.value)}
                                placeholder="Enter vendor name"
                            />
                        </div>
                    </>
                )}
            </>
        );
    };

    const renderRegionFields = () => {
        return (
            <>
                <div className="form-group">
                    <label htmlFor="regionType">Region Type *</label>
                    <select
                        id="regionType"
                        value={formData.regionType}
                        onChange={onRegionTypeChange}
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
                            <label htmlFor="subRegion">Sub-region</label>
                            <select
                                id="subRegion"
                                value={formData.subRegion}
                                onChange={(e) => onFieldChange('subRegion', e.target.value)}
                                className={errors.subRegion ? 'error' : ''}
                            >
                                <option value="">Select sub-region</option>
                                {schemaValidator.getSubRegionOptions(formData.regionType).map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            {errors.subRegion && <span className="error-message">{errors.subRegion}</span>}
                        </div>

                        <div className="form-group">
                            <label htmlFor="hemisphere">Hemisphere</label>
                            <select
                                id="hemisphere"
                                value={formData.hemisphere}
                                onChange={(e) => onFieldChange('hemisphere', e.target.value)}
                            >
                                <option value="">Select hemisphere</option>
                                {schemaValidator.getHemisphereOptions().map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="sliceOrientation">Slice Orientation</label>
                            <select
                                id="sliceOrientation"
                                value={formData.sliceOrientation}
                                onChange={(e) => onFieldChange('sliceOrientation', e.target.value)}
                            >
                                <option value="">Select slice orientation</option>
                                {schemaValidator.getSliceOrientationOptions().map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="sliceThickness">Slice Thickness (μm)</label>
                            <input
                                type="number"
                                id="sliceThickness"
                                value={formData.sliceThickness || ''}
                                onChange={(e) => onFieldChange('sliceThickness', parseFloat(e.target.value) || '')}
                                placeholder="Enter thickness in microns"
                                min="0.1"
                                max="1000"
                                step="0.1"
                            />
                        </div>
                    </>
                )}
            </>
        );
    };

    return (
        <>
            {type === 'stain' ? renderStainFields() : renderRegionFields()}
        </>
    );
};

export default ProtocolFormFields;
