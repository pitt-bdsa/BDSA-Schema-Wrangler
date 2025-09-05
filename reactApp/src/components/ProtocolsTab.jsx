import React, { useState, useEffect } from 'react';
import './ProtocolsTab.css';

const REGION_PROTOCOLS_KEY = 'bdsa_region_protocols';
const STAIN_PROTOCOLS_KEY = 'bdsa_stain_protocols';

const ProtocolsTab = () => {
    const [activeSubTab, setActiveSubTab] = useState('regions');
    const [regionProtocols, setRegionProtocols] = useState([]);
    const [stainProtocols, setStainProtocols] = useState([]);
    const [stainSchema, setStainSchema] = useState(null);
    const [regionSchema, setRegionSchema] = useState(null);
    const [showAddStainModal, setShowAddStainModal] = useState(false);
    const [showAddRegionModal, setShowAddRegionModal] = useState(false);
    const [showValidationModal, setShowValidationModal] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingProtocolId, setEditingProtocolId] = useState(null);

    const [newStainProtocol, setNewStainProtocol] = useState({
        name: '',
        description: '',
        stainType: '',
        antibody: '',
        technique: '',
        phosphoSpecific: '',
        dilution: '',
        vendor: ''
    });

    const [newRegionProtocol, setNewRegionProtocol] = useState({
        name: '',
        description: '',
        regionType: '',
        subRegion: '',
        hemisphere: '',
        sliceOrientation: '',
        damage: []
    });
    const [validationErrors, setValidationErrors] = useState({});

    // Load protocols from localStorage on component mount
    useEffect(() => {
        loadProtocols();
        loadStainSchema();
    }, []);

    const loadProtocols = () => {
        try {
            // Load region protocols
            const storedRegion = localStorage.getItem(REGION_PROTOCOLS_KEY);
            if (storedRegion) {
                setRegionProtocols(JSON.parse(storedRegion));
            } else {
                // Set default region protocols
                const defaultRegionProtocols = [
                    {
                        id: 'ignore',
                        name: 'IGNORE',
                        description: 'Mark slide for exclusion from processing',
                        regionType: 'ignore',
                        type: 'ignore'
                    }
                ];
                setRegionProtocols(defaultRegionProtocols);
                localStorage.setItem(REGION_PROTOCOLS_KEY, JSON.stringify(defaultRegionProtocols));
            }

            // Load stain protocols
            const storedStain = localStorage.getItem(STAIN_PROTOCOLS_KEY);
            if (storedStain) {
                setStainProtocols(JSON.parse(storedStain));
            } else {
                // Start with IGNORE protocol and empty stain protocols
                const defaultStainProtocols = [
                    {
                        id: 'ignore',
                        name: 'IGNORE',
                        description: 'Mark slide for exclusion from processing',
                        stainType: 'ignore',
                        type: 'ignore'
                    }
                ];
                setStainProtocols(defaultStainProtocols);
                localStorage.setItem(STAIN_PROTOCOLS_KEY, JSON.stringify(defaultStainProtocols));
            }


        } catch (error) {
            console.error('Error loading protocols from localStorage:', error);
        }
    };

    const saveRegionProtocols = (protocols) => {
        try {
            localStorage.setItem(REGION_PROTOCOLS_KEY, JSON.stringify(protocols));
            setRegionProtocols(protocols);
        } catch (error) {
            console.error('Error saving region protocols to localStorage:', error);
        }
    };

    const saveStainProtocols = (protocols) => {
        try {
            localStorage.setItem(STAIN_PROTOCOLS_KEY, JSON.stringify(protocols));
            setStainProtocols(protocols);
        } catch (error) {
            console.error('Error saving stain protocols to localStorage:', error);
        }
    };

    const loadStainSchema = async () => {
        try {
            const response = await fetch('/bdsa-schema.json');
            const schema = await response.json();

            // Extract stain definitions from the schema
            if (schema.properties && schema.properties.stainIDs && schema.properties.stainIDs.items) {
                const stainDefinitions = schema.properties.stainIDs.items.properties;
                setStainSchema(stainDefinitions);
            }

            // Extract region definitions from the schema
            if (schema.properties && schema.properties.regionIDs && schema.properties.regionIDs.properties) {
                const regionDefinitions = schema.properties.regionIDs.properties;
                setRegionSchema(regionDefinitions);
            }
        } catch (error) {
            console.error('Error loading schema:', error);
        }
    };

    const handleAddStainProtocol = () => {
        // Validate the protocol
        const errors = validateProtocol(newStainProtocol);
        setValidationErrors(errors);

        if (Object.keys(errors).length > 0) {
            setShowValidationModal(true);
            return; // Don't save if there are validation errors
        }

        const protocol = {
            id: Date.now().toString(),
            ...newStainProtocol
        };

        const updatedProtocols = [...stainProtocols, protocol];
        saveStainProtocols(updatedProtocols);

        // Reset form
        setNewStainProtocol({
            name: '',
            description: '',
            stainType: '',
            antibody: '',
            technique: '',
            phosphoSpecific: '',
            dilution: '',
            vendor: ''
        });
        setValidationErrors({});
        setIsEditMode(false);
        setEditingProtocolId(null);
        setShowAddStainModal(false);
    };

    const handleAddRegionProtocol = () => {
        // Validate the protocol
        const errors = validateRegionProtocol(newRegionProtocol);
        setValidationErrors(errors);

        if (Object.keys(errors).length > 0) {
            setShowValidationModal(true);
            return; // Don't save if there are validation errors
        }

        const protocol = {
            id: Date.now().toString(),
            ...newRegionProtocol
        };

        const updatedProtocols = [...regionProtocols, protocol];
        saveRegionProtocols(updatedProtocols);

        // Reset form
        setNewRegionProtocol({
            name: '',
            description: '',
            regionType: '',
            subRegion: '',
            hemisphere: '',
            sliceOrientation: '',
            damage: []
        });
        setValidationErrors({});
        setIsEditMode(false);
        setEditingProtocolId(null);
        setShowAddRegionModal(false);
    };

    const getStainTypeOptions = () => {
        if (!stainSchema) return [];
        return Object.keys(stainSchema).map(key => ({
            value: key,
            label: stainSchema[key].title || key
        }));
    };

    const getAntibodyOptions = (stainType) => {
        if (!stainSchema || !stainSchema[stainType] || !stainSchema[stainType].properties?.antibody) {
            return [];
        }
        return stainSchema[stainType].properties.antibody.enum || [];
    };

    const getTechniqueOptions = (stainType) => {
        if (!stainSchema || !stainSchema[stainType] || !stainSchema[stainType].properties?.technique) {
            return [];
        }
        return stainSchema[stainType].properties.technique.enum || [];
    };

    const getRegionTypeOptions = () => {
        if (!regionSchema || !regionSchema.regions || !regionSchema.regions.properties) return [];
        return Object.keys(regionSchema.regions.properties).map(key => ({
            value: key,
            label: regionSchema.regions.properties[key].title || key
        }));
    };

    const getSubRegionOptions = (regionType) => {
        if (!regionSchema || !regionSchema.regions || !regionSchema.regions.properties || !regionSchema.regions.properties[regionType]) {
            return [];
        }
        return regionSchema.regions.properties[regionType].items?.enum || [];
    };

    const validateProtocol = (protocol) => {
        const errors = {};

        // Basic validation
        if (!protocol.name.trim()) {
            errors.name = 'Protocol name is required';
        }
        if (!protocol.stainType) {
            errors.stainType = 'Stain type is required';
        }

        // Schema-based validation
        if (protocol.stainType && stainSchema && stainSchema[protocol.stainType]) {
            const stainDef = stainSchema[protocol.stainType];

            // Check required fields
            if (stainDef.required) {
                stainDef.required.forEach(field => {
                    if (!protocol[field]) {
                        errors[field] = `${field} is required for ${protocol.stainType}`;
                    }
                });
            }

            // Check pattern validation
            if (protocol.dilution && stainDef.properties?.dilution?.pattern) {
                const pattern = new RegExp(stainDef.properties.dilution.pattern);
                if (!pattern.test(protocol.dilution)) {
                    errors.dilution = `Dilution must match pattern: ${stainDef.properties.dilution.pattern}`;
                }
            }

            // Check vendor pattern
            if (protocol.vendor && stainDef.properties?.vendor?.pattern) {
                const pattern = new RegExp(stainDef.properties.vendor.pattern);
                if (!pattern.test(protocol.vendor)) {
                    errors.vendor = `Vendor must match pattern: ${stainDef.properties.vendor.pattern}`;
                }
            }

            // Check enum values
            if (protocol.antibody && stainDef.properties?.antibody?.enum) {
                if (!stainDef.properties.antibody.enum.includes(protocol.antibody)) {
                    errors.antibody = `Antibody must be one of: ${stainDef.properties.antibody.enum.join(', ')}`;
                }
            }

            if (protocol.technique && stainDef.properties?.technique?.enum) {
                if (!stainDef.properties.technique.enum.includes(protocol.technique)) {
                    errors.technique = `Technique must be one of: ${stainDef.properties.technique.enum.join(', ')}`;
                }
            }

            if (protocol.phosphoSpecific && stainDef.properties?.phosphoSpecific?.enum) {
                if (!stainDef.properties.phosphoSpecific.enum.includes(protocol.phosphoSpecific)) {
                    errors.phosphoSpecific = `Phospho-specific must be one of: ${stainDef.properties.phosphoSpecific.enum.join(', ')}`;
                }
            }
        }

        return errors;
    };

    const validateRegionProtocol = (protocol) => {
        const errors = {};

        // Basic validation
        if (!protocol.name.trim()) {
            errors.name = 'Protocol name is required';
        }
        if (!protocol.regionType) {
            errors.regionType = 'Region type is required';
        }

        // Schema-based validation
        if (protocol.regionType && regionSchema && regionSchema.regions && regionSchema.regions.properties && regionSchema.regions.properties[protocol.regionType]) {
            const regionDef = regionSchema.regions.properties[protocol.regionType];

            // Check enum values for sub-regions
            if (protocol.subRegion && regionDef.items && regionDef.items.enum) {
                if (!regionDef.items.enum.includes(protocol.subRegion)) {
                    errors.subRegion = `Sub-region must be one of: ${regionDef.items.enum.join(', ')}`;
                }
            }
        }

        return errors;
    };

    const handleFieldChange = (field, value) => {
        const updatedProtocol = { ...newStainProtocol, [field]: value };
        setNewStainProtocol(updatedProtocol);

        // Clear the specific field error when user starts typing
        if (validationErrors[field]) {
            setValidationErrors(prev => ({ ...prev, [field]: '' }));
        }

        // Validate the updated protocol
        const errors = validateProtocol(updatedProtocol);
        setValidationErrors(errors);
    };

    const handleRegionFieldChange = (field, value) => {
        const updatedProtocol = { ...newRegionProtocol, [field]: value };
        setNewRegionProtocol(updatedProtocol);

        // Clear the specific field error when user starts typing
        if (validationErrors[field]) {
            setValidationErrors(prev => ({ ...prev, [field]: '' }));
        }

        // Validate the updated protocol
        const errors = validateRegionProtocol(updatedProtocol);
        setValidationErrors(errors);
    };

    const handleEditProtocol = (protocol) => {
        setIsEditMode(true);
        setEditingProtocolId(protocol.id);
        setNewStainProtocol({
            name: protocol.name || '',
            description: protocol.description || '',
            stainType: protocol.stainType || '',
            antibody: protocol.antibody || '',
            technique: protocol.technique || '',
            phosphoSpecific: protocol.phosphoSpecific || '',
            dilution: protocol.dilution || '',
            vendor: protocol.vendor || ''
        });
        setValidationErrors({});
        setShowAddStainModal(true);
    };

    const handleEditRegionProtocol = (protocol) => {
        setIsEditMode(true);
        setEditingProtocolId(protocol.id);
        setNewRegionProtocol({
            name: protocol.name || '',
            description: protocol.description || '',
            regionType: protocol.regionType || '',
            subRegion: protocol.subRegion || '',
            hemisphere: protocol.hemisphere || '',
            sliceOrientation: protocol.sliceOrientation || '',
            damage: protocol.damage || []
        });
        setValidationErrors({});
        setShowAddRegionModal(true);
    };

    const handleUpdateProtocol = () => {
        // Validate the protocol
        const errors = validateProtocol(newStainProtocol);
        setValidationErrors(errors);

        if (Object.keys(errors).length > 0) {
            setShowValidationModal(true);
            return; // Don't save if there are validation errors
        }

        const updatedProtocols = stainProtocols.map(protocol =>
            protocol.id === editingProtocolId
                ? { ...protocol, ...newStainProtocol }
                : protocol
        );

        saveStainProtocols(updatedProtocols);

        // Reset form and close modal
        setNewStainProtocol({
            name: '',
            description: '',
            stainType: '',
            antibody: '',
            technique: '',
            phosphoSpecific: '',
            dilution: '',
            vendor: ''
        });
        setValidationErrors({});
        setIsEditMode(false);
        setEditingProtocolId(null);
        setShowAddStainModal(false);
    };

    const handleCancelEdit = () => {
        setNewStainProtocol({
            name: '',
            description: '',
            stainType: '',
            antibody: '',
            technique: '',
            phosphoSpecific: '',
            dilution: '',
            vendor: ''
        });
        setValidationErrors({});
        setIsEditMode(false);
        setEditingProtocolId(null);
        setShowAddStainModal(false);
    };

    const handleUpdateRegionProtocol = () => {
        // Validate the protocol
        const errors = validateRegionProtocol(newRegionProtocol);
        setValidationErrors(errors);

        if (Object.keys(errors).length > 0) {
            setShowValidationModal(true);
            return; // Don't save if there are validation errors
        }

        const updatedProtocols = regionProtocols.map(protocol =>
            protocol.id === editingProtocolId
                ? { ...protocol, ...newRegionProtocol }
                : protocol
        );

        saveRegionProtocols(updatedProtocols);

        // Reset form and close modal
        setNewRegionProtocol({
            name: '',
            description: '',
            regionType: '',
            subRegion: '',
            hemisphere: '',
            sliceOrientation: '',
            damage: []
        });
        setValidationErrors({});
        setIsEditMode(false);
        setEditingProtocolId(null);
        setShowAddRegionModal(false);
    };

    const handleCancelRegionEdit = () => {
        setNewRegionProtocol({
            name: '',
            description: '',
            regionType: '',
            subRegion: '',
            hemisphere: '',
            sliceOrientation: '',
            damage: []
        });
        setValidationErrors({});
        setIsEditMode(false);
        setEditingProtocolId(null);
        setShowAddRegionModal(false);
    };

    return (
        <div className="protocols-tab">
            <div className="protocols-header">
                <h2>Protocols</h2>
                <p>Manage region and staining protocols for BDSA schema compliance</p>
            </div>

            <div className="protocols-sub-tabs">
                <button
                    className={`sub-tab-btn ${activeSubTab === 'regions' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('regions')}
                >
                    Region Protocols
                </button>
                <button
                    className={`sub-tab-btn ${activeSubTab === 'staining' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('staining')}
                >
                    Stain Protocols
                </button>
            </div>

            <div className="protocols-content">
                {activeSubTab === 'regions' && (
                    <div className="region-protocols">
                        <div className="protocols-section">
                            <h3>Region Protocols</h3>
                            <p>Define region protocols for different brain regions and anatomical landmarks.</p>

                            <div className="protocols-list">
                                {regionProtocols.map(protocol => (
                                    <div key={protocol.id} className="protocol-item">
                                        <div className="protocol-header">
                                            <h4>{protocol.name}</h4>
                                            <button
                                                className="edit-protocol-btn"
                                                onClick={() => handleEditRegionProtocol(protocol)}
                                            >
                                                Edit
                                            </button>
                                        </div>
                                        <div className="protocol-details">
                                            <p><strong>Description:</strong> {protocol.description}</p>
                                            {protocol.regionType && <p><strong>Region Type:</strong> {protocol.regionType}</p>}
                                            {protocol.subRegion && <p><strong>Sub-Region:</strong> {protocol.subRegion}</p>}
                                            {protocol.hemisphere && <p><strong>Hemisphere:</strong> {protocol.hemisphere}</p>}
                                            {protocol.sliceOrientation && <p><strong>Slice Orientation:</strong> {protocol.sliceOrientation}</p>}
                                            {protocol.damage && protocol.damage.length > 0 && (
                                                <p><strong>Damage:</strong> {protocol.damage.join(', ')}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                <button
                                    className="add-protocol-btn"
                                    onClick={() => setShowAddRegionModal(true)}
                                >
                                    + Add New Region Protocol
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeSubTab === 'staining' && (
                    <div className="stain-protocols">
                        <div className="protocols-section">
                            <h3>Stain Protocols</h3>
                            <p>Define staining protocols for different tissue types and targets.</p>

                            <div className="protocols-list">
                                {stainProtocols.map(protocol => (
                                    <div key={protocol.id} className="protocol-item">
                                        <div className="protocol-header">
                                            <h4>{protocol.name}</h4>
                                            <button
                                                className="edit-protocol-btn"
                                                onClick={() => handleEditProtocol(protocol)}
                                            >
                                                Edit
                                            </button>
                                        </div>
                                        <div className="protocol-details">
                                            <p><strong>Description:</strong> {protocol.description}</p>
                                            {protocol.stainType && <p><strong>Stain Type:</strong> {protocol.stainType}</p>}
                                            {protocol.antibody && <p><strong>Antibody:</strong> {protocol.antibody}</p>}
                                            {protocol.technique && <p><strong>Technique:</strong> {protocol.technique}</p>}
                                            {protocol.phosphoSpecific && <p><strong>Phospho-specific:</strong> {protocol.phosphoSpecific}</p>}
                                            {protocol.dilution && <p><strong>Dilution:</strong> {protocol.dilution}</p>}
                                            {protocol.vendor && <p><strong>Vendor:</strong> {protocol.vendor}</p>}
                                        </div>
                                    </div>
                                ))}

                                <button
                                    className="add-protocol-btn"
                                    onClick={() => setShowAddStainModal(true)}
                                >
                                    + Add New Stain Protocol
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Add/Edit Stain Protocol Modal */}
            {showAddStainModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>{isEditMode ? 'Edit Stain Protocol' : 'Add New Stain Protocol'}</h2>
                        <div className="protocol-form">
                            <div className="form-group">
                                <label htmlFor="protocol-name">Protocol Name:</label>
                                <input
                                    type="text"
                                    id="protocol-name"
                                    value={newStainProtocol.name}
                                    onChange={(e) => handleFieldChange('name', e.target.value)}
                                    placeholder="e.g., Tau - PHF1"
                                />
                                {validationErrors.name && <div className="error-message">{validationErrors.name}</div>}
                            </div>

                            <div className="form-group">
                                <label htmlFor="protocol-description">Description:</label>
                                <textarea
                                    id="protocol-description"
                                    value={newStainProtocol.description}
                                    onChange={(e) => handleFieldChange('description', e.target.value)}
                                    placeholder="Describe the protocol..."
                                    rows="3"
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="stain-type">Stain Type:</label>
                                <select
                                    id="stain-type"
                                    value={newStainProtocol.stainType}
                                    onChange={(e) => {
                                        const updatedProtocol = {
                                            ...newStainProtocol,
                                            stainType: e.target.value,
                                            antibody: '',
                                            technique: '',
                                            phosphoSpecific: ''
                                        };
                                        setNewStainProtocol(updatedProtocol);
                                        setValidationErrors(prev => ({ ...prev, stainType: '', antibody: '', technique: '', phosphoSpecific: '' }));
                                        const errors = validateProtocol(updatedProtocol);
                                        setValidationErrors(errors);
                                    }}
                                >
                                    <option value="">-- Select Stain Type --</option>
                                    {getStainTypeOptions().map(option => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                                {validationErrors.stainType && <div className="error-message">{validationErrors.stainType}</div>}
                            </div>

                            {newStainProtocol.stainType && stainSchema && stainSchema[newStainProtocol.stainType]?.properties?.antibody && (
                                <div className="form-group">
                                    <label htmlFor="antibody">Antibody:</label>
                                    <select
                                        id="antibody"
                                        value={newStainProtocol.antibody}
                                        onChange={(e) => handleFieldChange('antibody', e.target.value)}
                                    >
                                        <option value="">-- Select Antibody --</option>
                                        {getAntibodyOptions(newStainProtocol.stainType).map(antibody => (
                                            <option key={antibody} value={antibody}>
                                                {antibody}
                                            </option>
                                        ))}
                                    </select>
                                    {validationErrors.antibody && <div className="error-message">{validationErrors.antibody}</div>}
                                </div>
                            )}

                            {newStainProtocol.stainType && stainSchema && stainSchema[newStainProtocol.stainType]?.properties?.technique && (
                                <div className="form-group">
                                    <label htmlFor="technique">Technique:</label>
                                    <select
                                        id="technique"
                                        value={newStainProtocol.technique}
                                        onChange={(e) => handleFieldChange('technique', e.target.value)}
                                    >
                                        <option value="">-- Select Technique --</option>
                                        {getTechniqueOptions(newStainProtocol.stainType).map(technique => (
                                            <option key={technique} value={technique}>
                                                {technique}
                                            </option>
                                        ))}
                                    </select>
                                    {validationErrors.technique && <div className="error-message">{validationErrors.technique}</div>}
                                </div>
                            )}

                            {newStainProtocol.stainType && stainSchema && stainSchema[newStainProtocol.stainType]?.properties?.phosphoSpecific && (
                                <div className="form-group">
                                    <label htmlFor="phospho-specific">Phospho-specific:</label>
                                    <select
                                        id="phospho-specific"
                                        value={newStainProtocol.phosphoSpecific}
                                        onChange={(e) => handleFieldChange('phosphoSpecific', e.target.value)}
                                    >
                                        <option value="">-- Select --</option>
                                        <option value="yes">Yes</option>
                                        <option value="no">No</option>
                                    </select>
                                    {validationErrors.phosphoSpecific && <div className="error-message">{validationErrors.phosphoSpecific}</div>}
                                </div>
                            )}

                            <div className="form-group">
                                <label htmlFor="dilution">Dilution:</label>
                                <input
                                    type="text"
                                    id="dilution"
                                    value={newStainProtocol.dilution}
                                    onChange={(e) => handleFieldChange('dilution', e.target.value)}
                                    placeholder="e.g., 1:1000"
                                />
                                {validationErrors.dilution && <div className="error-message">{validationErrors.dilution}</div>}
                            </div>

                            <div className="form-group">
                                <label htmlFor="vendor">Vendor:</label>
                                <input
                                    type="text"
                                    id="vendor"
                                    value={newStainProtocol.vendor}
                                    onChange={(e) => handleFieldChange('vendor', e.target.value)}
                                    placeholder="e.g., Thermo Fisher"
                                />
                                {validationErrors.vendor && <div className="error-message">{validationErrors.vendor}</div>}
                            </div>
                        </div>

                        <div className="modal-actions">
                            <button
                                className="cancel-btn"
                                onClick={isEditMode ? handleCancelEdit : () => setShowAddStainModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className={`save-btn ${Object.keys(validationErrors).length > 0 ? 'validation-error' : ''}`}
                                onClick={isEditMode ? handleUpdateProtocol : handleAddStainProtocol}
                                disabled={!newStainProtocol.name || !newStainProtocol.stainType || Object.keys(validationErrors).length > 0}
                                title={
                                    !newStainProtocol.name || !newStainProtocol.stainType
                                        ? 'Please fill in required fields'
                                        : Object.keys(validationErrors).length > 0
                                            ? 'Please fix validation errors'
                                            : isEditMode ? 'Update the protocol' : 'Save the protocol'
                                }
                            >
                                {isEditMode ? 'Update Protocol' : 'Save Protocol'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit Region Protocol Modal */}
            {showAddRegionModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>{isEditMode ? 'Edit Region Protocol' : 'Add New Region Protocol'}</h2>
                        <div className="protocol-form">
                            <div className="form-group">
                                <label htmlFor="region-protocol-name">Protocol Name:</label>
                                <input
                                    type="text"
                                    id="region-protocol-name"
                                    value={newRegionProtocol.name}
                                    onChange={(e) => handleRegionFieldChange('name', e.target.value)}
                                    placeholder="e.g., Hippocampus - CA1"
                                />
                                {validationErrors.name && <div className="error-message">{validationErrors.name}</div>}
                            </div>

                            <div className="form-group">
                                <label htmlFor="region-protocol-description">Description:</label>
                                <textarea
                                    id="region-protocol-description"
                                    value={newRegionProtocol.description}
                                    onChange={(e) => handleRegionFieldChange('description', e.target.value)}
                                    placeholder="Describe the region protocol..."
                                    rows="3"
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="region-type">Region Type:</label>
                                <select
                                    id="region-type"
                                    value={newRegionProtocol.regionType}
                                    onChange={(e) => handleRegionFieldChange('regionType', e.target.value)}
                                >
                                    <option value="">-- Select Region Type --</option>
                                    {getRegionTypeOptions().map(option => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                                {validationErrors.regionType && <div className="error-message">{validationErrors.regionType}</div>}
                            </div>

                            {newRegionProtocol.regionType && regionSchema && regionSchema.regions && regionSchema.regions.properties && regionSchema.regions.properties[newRegionProtocol.regionType]?.items?.enum && (
                                <div className="form-group">
                                    <label htmlFor="sub-region">Sub-Region:</label>
                                    <select
                                        id="sub-region"
                                        value={newRegionProtocol.subRegion}
                                        onChange={(e) => handleRegionFieldChange('subRegion', e.target.value)}
                                    >
                                        <option value="">-- Select Sub-Region --</option>
                                        {getSubRegionOptions(newRegionProtocol.regionType).map(subRegion => (
                                            <option key={subRegion} value={subRegion}>
                                                {subRegion}
                                            </option>
                                        ))}
                                    </select>
                                    {validationErrors.subRegion && <div className="error-message">{validationErrors.subRegion}</div>}
                                </div>
                            )}

                            <div className="form-group">
                                <label htmlFor="hemisphere">Hemisphere:</label>
                                <select
                                    id="hemisphere"
                                    value={newRegionProtocol.hemisphere}
                                    onChange={(e) => handleRegionFieldChange('hemisphere', e.target.value)}
                                >
                                    <option value="">-- Select Hemisphere --</option>
                                    <option value="left">Left</option>
                                    <option value="right">Right</option>
                                    <option value="unknown">Unknown</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label htmlFor="slice-orientation">Slice Orientation:</label>
                                <select
                                    id="slice-orientation"
                                    value={newRegionProtocol.sliceOrientation}
                                    onChange={(e) => handleRegionFieldChange('sliceOrientation', e.target.value)}
                                >
                                    <option value="">-- Select Orientation --</option>
                                    <option value="axial">Axial</option>
                                    <option value="coronal">Coronal</option>
                                    <option value="sagittal">Sagittal</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label htmlFor="damage">Damage (Optional):</label>
                                <div className="checkbox-group">
                                    {['Infarct', 'Lacune', 'Microinfarct', 'CTE', 'TBI'].map(damageType => (
                                        <label key={damageType} className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={newRegionProtocol.damage.includes(damageType)}
                                                onChange={(e) => {
                                                    const updatedDamage = e.target.checked
                                                        ? [...newRegionProtocol.damage, damageType]
                                                        : newRegionProtocol.damage.filter(d => d !== damageType);
                                                    handleRegionFieldChange('damage', updatedDamage);
                                                }}
                                            />
                                            <span>{damageType}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="modal-actions">
                            <button
                                className="cancel-btn"
                                onClick={isEditMode ? handleCancelRegionEdit : () => setShowAddRegionModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className={`save-btn ${Object.keys(validationErrors).length > 0 ? 'validation-error' : ''}`}
                                onClick={isEditMode ? handleUpdateRegionProtocol : handleAddRegionProtocol}
                                disabled={!newRegionProtocol.name || !newRegionProtocol.regionType || Object.keys(validationErrors).length > 0}
                                title={
                                    !newRegionProtocol.name || !newRegionProtocol.regionType
                                        ? 'Please fill in required fields'
                                        : Object.keys(validationErrors).length > 0
                                            ? 'Please fix validation errors'
                                            : isEditMode ? 'Update the protocol' : 'Save the protocol'
                                }
                            >
                                {isEditMode ? 'Update Protocol' : 'Save Protocol'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Validation Error Modal */}
            {showValidationModal && (
                <div className="modal-overlay">
                    <div className="modal-content validation-error-modal">
                        <h2>Validation Errors</h2>
                        <div className="validation-summary">
                            <strong>Please fix the following errors before saving:</strong>
                            <ul>
                                {Object.values(validationErrors).map((error, index) => (
                                    <li key={index}>{error}</li>
                                ))}
                            </ul>
                        </div>
                        <div className="modal-actions">
                            <button
                                className="cancel-btn"
                                onClick={() => setShowValidationModal(false)}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProtocolsTab; 