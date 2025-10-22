// Simple test to verify schema validator functionality
import schemaValidator from '../utils/schemaValidator.js';

// Mock fetch for testing
global.fetch = jest.fn();

describe('SchemaValidator', () => {
    beforeEach(() => {
        fetch.mockClear();
    });

    test('should load schema successfully', async () => {
        const mockSchema = {
            properties: {
                stainIDs: {
                    items: {
                        properties: {
                            "TDP-43": {
                                title: "TDP-43",
                                properties: {
                                    "phospho-specific": {
                                        enum: ["yes", "no"]
                                    },
                                    dilution: {
                                        pattern: "^\\d+:\\d+$"
                                    }
                                }
                            }
                        }
                    }
                },
                regionIDs: {
                    properties: {
                        regions: {
                            properties: {
                                "Hippocampus": {
                                    title: "Hippocampus",
                                    items: {
                                        enum: ["CA1-4 with dentate gyrus", "Parahippocampal gyrus"]
                                    }
                                }
                            }
                        },
                        hemisphere: {
                            enum: ["left", "right"]
                        }
                    }
                }
            }
        };

        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockSchema
        });

        const result = await schemaValidator.loadSchemas();
        expect(result).toBe(true);
        expect(schemaValidator.isLoaded()).toBe(true);
    });

    test('should validate stain protocol correctly', () => {
        // Mock loaded schema
        schemaValidator.stainSchema = {
            "TDP-43": {
                properties: {
                    "phospho-specific": {
                        enum: ["yes", "no"]
                    },
                    dilution: {
                        pattern: "^\\d+:\\d+$"
                    }
                }
            }
        };

        const validProtocol = {
            name: "Test TDP-43",
            stainType: "TDP-43",
            phosphoSpecific: "yes",
            dilution: "1:1000"
        };

        const invalidProtocol = {
            name: "",
            stainType: "TDP-43",
            phosphoSpecific: "maybe",
            dilution: "invalid"
        };

        const validErrors = schemaValidator.validateStainProtocol(validProtocol);
        const invalidErrors = schemaValidator.validateStainProtocol(invalidProtocol);

        expect(Object.keys(validErrors)).toHaveLength(0);
        expect(invalidErrors.name).toBe('Protocol name is required');
        expect(invalidErrors.phosphoSpecific).toContain('must be one of');
        expect(invalidErrors.dilution).toContain('must match pattern');
    });

    test('should get stain type options', () => {
        schemaValidator.stainSchema = {
            "TDP-43": { title: "TDP-43" },
            "Tau": { title: "Tau" }
        };

        const options = schemaValidator.getStainTypeOptions();
        expect(options).toHaveLength(2);
        expect(options[0]).toEqual({ value: "TDP-43", label: "TDP-43" });
    });

    test('should get antibody options for specific stain type', () => {
        schemaValidator.stainSchema = {
            "Tau": {
                properties: {
                    antibody: {
                        enum: ["AT8", "PHF1", "CP13"]
                    }
                }
            }
        };

        const options = schemaValidator.getAntibodyOptions("Tau");
        expect(options).toEqual(["AT8", "PHF1", "CP13"]);
    });
});

console.log('Schema validator tests completed successfully!');
