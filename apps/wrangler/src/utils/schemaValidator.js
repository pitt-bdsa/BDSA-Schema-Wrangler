// Schema Validator - Loads and validates protocols against BDSA schema
// Provides schema-driven form generation and validation

class SchemaValidator {
    constructor() {
        this.schema = null;
        this.stainSchema = null;
        this.regionSchema = null;
        this.loaded = false;
    }

    async loadSchemas() {
        try {
            // Load the main BDSA schema
            const response = await fetch('/bdsa-schema.json');
            if (!response.ok) {
                throw new Error(`Failed to load schema: ${response.statusText}`);
            }

            this.schema = await response.json();

            // Extract stain definitions from the schema
            if (this.schema.properties && this.schema.properties.stainIDs && this.schema.properties.stainIDs.items) {
                this.stainSchema = this.schema.properties.stainIDs.items.properties;
            }

            // Extract region definitions from the schema
            if (this.schema.properties && this.schema.properties.regionIDs && this.schema.properties.regionIDs.properties) {
                this.regionSchema = this.schema.properties.regionIDs.properties;
            }

            this.loaded = true;
            console.log('BDSA schema loaded successfully', {
                stainTypes: Object.keys(this.stainSchema || {}),
                regionTypes: Object.keys(this.regionSchema?.regions?.properties || {})
            });

            return true;
        } catch (error) {
            console.error('Error loading BDSA schema:', error);
            this.loaded = false;
            return false;
        }
    }

    // Stain Schema Methods
    getStainTypeOptions() {
        if (!this.stainSchema) {
            // Return fallback options if schema isn't loaded
            return [
                { value: 'TDP-43', label: 'TDP-43' },
                { value: 'aSyn', label: 'Alpha Synuclein' },
                { value: 'HE', label: 'Hematoxylin and Eosin' },
                { value: 'Silver', label: 'Silver' },
                { value: 'Tau', label: 'Tau' },
                { value: 'ignore', label: 'IGNORE' }
            ];
        }
        const options = Object.keys(this.stainSchema).map(key => ({
            value: key,
            label: this.stainSchema[key].title || key
        }));
        return options;
    }

    getStainTypeDefinition(stainType) {
        if (!this.stainSchema || !this.stainSchema[stainType]) {
            return null;
        }
        return this.stainSchema[stainType];
    }

    getStainTypeProperties(stainType) {
        const definition = this.getStainTypeDefinition(stainType);
        return definition?.properties || {};
    }

    getStainTypeRequiredFields(stainType) {
        const definition = this.getStainTypeDefinition(stainType);
        return definition?.required || [];
    }

    getAntibodyOptions(stainType) {
        const properties = this.getStainTypeProperties(stainType);
        return properties.antibody?.enum || [];
    }

    getTechniqueOptions(stainType) {
        const properties = this.getStainTypeProperties(stainType);
        return properties.technique?.enum || [];
    }

    getPhosphoSpecificOptions(stainType) {
        const properties = this.getStainTypeProperties(stainType);
        return properties['phospho-specific']?.enum || [];
    }

    getDilutionPattern(stainType) {
        const properties = this.getStainTypeProperties(stainType);
        return properties.dilution?.pattern || null;
    }

    getVendorPattern(stainType) {
        const properties = this.getStainTypeProperties(stainType);
        return properties.vendor?.pattern || null;
    }

    // Region Schema Methods
    getRegionTypeOptions() {
        if (!this.regionSchema || !this.regionSchema.regions || !this.regionSchema.regions.properties) {
            return [];
        }
        return Object.keys(this.regionSchema.regions.properties).map(key => ({
            value: key,
            label: this.regionSchema.regions.properties[key].title || key
        }));
    }

    getRegionTypeDefinition(regionType) {
        if (!this.regionSchema || !this.regionSchema.regions || !this.regionSchema.regions.properties || !this.regionSchema.regions.properties[regionType]) {
            return null;
        }
        return this.regionSchema.regions.properties[regionType];
    }

    getSubRegionOptions(regionType) {
        const definition = this.getRegionTypeDefinition(regionType);
        return definition?.items?.enum || [];
    }

    getLandmarkOptions(regionType) {
        const definition = this.getRegionTypeDefinition(regionType);
        return definition?.items?.enum || [];
    }

    getHemisphereOptions() {
        return this.regionSchema?.hemisphere?.enum || ['left', 'right'];
    }

    getSliceOrientationOptions() {
        return this.regionSchema?.sliceOrientation?.enum || ['axial', 'coronal', 'sagittal'];
    }

    getDamageOptions() {
        return this.regionSchema?.damage?.items?.enum || ['Infarct', 'Lacune', 'Microinfarct', 'CTE', 'TBI'];
    }

    // Validation Methods
    validateStainProtocol(protocol) {
        const errors = {};

        // Basic validation
        if (!protocol.name?.trim()) {
            errors.name = 'Protocol name is required';
        }
        if (!protocol.stainType) {
            errors.stainType = 'Stain type is required';
        }

        // Schema-based validation
        if (protocol.stainType && this.stainSchema && this.stainSchema[protocol.stainType]) {
            const stainDef = this.stainSchema[protocol.stainType];
            const properties = stainDef.properties || {};

            // Check required fields
            const requiredFields = stainDef.required || [];
            requiredFields.forEach(field => {
                // Map schema field names to form field names
                const formFieldName = field === 'phospho-specific' ? 'phosphoSpecific' : field;
                if (!protocol[formFieldName]) {
                    errors[formFieldName] = `${field} is required for ${protocol.stainType}`;
                }
            });

            // Check pattern validation
            if (protocol.dilution && properties.dilution?.pattern) {
                const pattern = new RegExp(properties.dilution.pattern);
                if (!pattern.test(protocol.dilution)) {
                    errors.dilution = `Dilution must match pattern: ${properties.dilution.pattern}`;
                }
            }

            // Check vendor pattern
            if (protocol.vendor && properties.vendor?.pattern) {
                const pattern = new RegExp(properties.vendor.pattern);
                if (!pattern.test(protocol.vendor)) {
                    errors.vendor = `Vendor must match pattern: ${properties.vendor.pattern}`;
                }
            }

            // Check enum values
            if (protocol.antibody && properties.antibody?.enum) {
                if (!properties.antibody.enum.includes(protocol.antibody)) {
                    errors.antibody = `Antibody must be one of: ${properties.antibody.enum.join(', ')}`;
                }
            }

            if (protocol.technique && properties.technique?.enum) {
                if (!properties.technique.enum.includes(protocol.technique)) {
                    errors.technique = `Technique must be one of: ${properties.technique.enum.join(', ')}`;
                }
            }

            if (protocol.phosphoSpecific && properties['phospho-specific']?.enum) {
                if (!properties['phospho-specific'].enum.includes(protocol.phosphoSpecific)) {
                    errors.phosphoSpecific = `Phospho-specific must be one of: ${properties['phospho-specific'].enum.join(', ')}`;
                }
            }
        }

        return errors;
    }

    validateRegionProtocol(protocol) {
        const errors = {};

        // Basic validation
        if (!protocol.name?.trim()) {
            errors.name = 'Protocol name is required';
        }
        if (!protocol.regionType) {
            errors.regionType = 'Region type is required';
        }

        // Schema-based validation
        if (protocol.regionType && this.regionSchema && this.regionSchema.regions && this.regionSchema.regions.properties && this.regionSchema.regions.properties[protocol.regionType]) {
            const regionDef = this.regionSchema.regions.properties[protocol.regionType];

            // Check enum values for sub-regions (legacy single-select)
            if (protocol.subRegion && regionDef.items && regionDef.items.enum) {
                if (!regionDef.items.enum.includes(protocol.subRegion)) {
                    errors.subRegion = `Sub-region must be one of: ${regionDef.items.enum.join(', ')}`;
                }
            }

            // Check enum values for landmarks (new multi-select)
            if (protocol.landmarks && Array.isArray(protocol.landmarks) && regionDef.items && regionDef.items.enum) {
                const invalidLandmarks = protocol.landmarks.filter(landmark => !regionDef.items.enum.includes(landmark));
                if (invalidLandmarks.length > 0) {
                    errors.landmarks = `Invalid landmarks: ${invalidLandmarks.join(', ')}. Must be from: ${regionDef.items.enum.join(', ')}`;
                }
            }
        }

        // Validate hemisphere
        if (protocol.hemisphere && this.regionSchema?.hemisphere?.enum) {
            if (!this.regionSchema.hemisphere.enum.includes(protocol.hemisphere)) {
                errors.hemisphere = `Hemisphere must be one of: ${this.regionSchema.hemisphere.enum.join(', ')}`;
            }
        }

        // Validate slice orientation
        if (protocol.sliceOrientation && this.regionSchema?.sliceOrientation?.enum) {
            if (!this.regionSchema.sliceOrientation.enum.includes(protocol.sliceOrientation)) {
                errors.sliceOrientation = `Slice orientation must be one of: ${this.regionSchema.sliceOrientation.enum.join(', ')}`;
            }
        }

        // Validate damage array
        if (protocol.damage && Array.isArray(protocol.damage) && this.regionSchema?.damage?.items?.enum) {
            const invalidDamage = protocol.damage.filter(d => !this.regionSchema.damage.items.enum.includes(d));
            if (invalidDamage.length > 0) {
                errors.damage = `Invalid damage types: ${invalidDamage.join(', ')}. Must be one of: ${this.regionSchema.damage.items.enum.join(', ')}`;
            }
        }

        return errors;
    }

    // Utility Methods
    isLoaded() {
        return this.loaded;
    }

    getSchema() {
        return this.schema;
    }

    getStainSchema() {
        return this.stainSchema;
    }

    getRegionSchema() {
        return this.regionSchema;
    }

    // Generate form fields based on schema
    generateStainFormFields(stainType) {
        if (!stainType || !this.stainSchema || !this.stainSchema[stainType]) {
            return [];
        }

        const properties = this.stainSchema[stainType].properties || {};
        const fields = [];

        // Add fields based on schema properties
        Object.entries(properties).forEach(([key, prop]) => {
            const field = {
                name: key,
                label: prop.title || key,
                type: this.getFieldType(prop),
                required: this.stainSchema[stainType].required?.includes(key) || false,
                options: prop.enum || null,
                pattern: prop.pattern || null,
                description: prop.description || null
            };
            fields.push(field);
        });

        return fields;
    }

    getFieldType(property) {
        if (property.enum) {
            return 'select';
        }
        if (property.type === 'string') {
            return 'text';
        }
        if (property.type === 'integer' || property.type === 'number') {
            return 'number';
        }
        if (property.type === 'boolean') {
            return 'checkbox';
        }
        return 'text';
    }
}

// Create singleton instance
const schemaValidator = new SchemaValidator();

export default schemaValidator;