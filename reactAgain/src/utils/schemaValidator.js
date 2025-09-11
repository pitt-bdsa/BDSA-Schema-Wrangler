// Schema Validator - Validates protocols against JSON schemas
// and provides helpful error messages

class SchemaValidator {
    constructor() {
        this.stainSchema = null;
        this.regionSchema = null;
    }

    async loadSchemas() {
        try {
            // Load stain schema
            const stainResponse = await fetch('/slide-level-metadata.json');
            if (stainResponse.ok) {
                const stainData = await stainResponse.json();
                this.stainSchema = stainData;
            }

            // Load region schema  
            const regionResponse = await fetch('/region-metadata.json');
            if (regionResponse.ok) {
                const regionData = await regionResponse.json();
                this.regionSchema = regionData;
            }
        } catch (error) {
            console.error('Error loading schemas:', error);
        }
    }

    // Stain Protocol Validation
    validateStainProtocol(protocol) {
        const errors = {};

        // Basic validation
        if (!protocol.name?.trim()) {
            errors.name = 'Protocol name is required';
        }

        if (!protocol.stainType) {
            errors.stainType = 'Stain type is required';
        }

        return errors;
    }

    // Region Protocol Validation
    validateRegionProtocol(protocol) {
        const errors = {};

        // Basic validation
        if (!protocol.name?.trim()) {
            errors.name = 'Protocol name is required';
        }

        if (!protocol.regionType) {
            errors.regionType = 'Region type is required';
        }

        return errors;
    }

    // Get available options for dropdowns
    getStainTypeOptions() {
        return [
            { value: 'ignore', label: 'Ignore' },
            { value: 'h_and_e', label: 'H&E' },
            { value: 'immunohistochemistry', label: 'Immunohistochemistry' },
            { value: 'immunofluorescence', label: 'Immunofluorescence' },
            { value: 'special_stain', label: 'Special Stain' }
        ];
    }

    getRegionTypeOptions() {
        return [
            { value: 'ignore', label: 'Ignore' },
            { value: 'cerebral_cortex', label: 'Cerebral Cortex' },
            { value: 'hippocampus', label: 'Hippocampus' },
            { value: 'cerebellum', label: 'Cerebellum' },
            { value: 'brainstem', label: 'Brainstem' }
        ];
    }

    getAntibodyOptions(stainType) {
        // Simplified for now - would be loaded from schema
        return [
            'GFAP', 'NeuN', 'Iba1', 'CD68', 'CD3', 'CD20', 'Ki67', 'p53'
        ];
    }

    getTechniqueOptions(stainType) {
        return [
            'IHC', 'IF', 'H&E', 'Luxol Fast Blue', 'Nissl'
        ];
    }
}

// Create singleton instance
const schemaValidator = new SchemaValidator();

export default schemaValidator;
