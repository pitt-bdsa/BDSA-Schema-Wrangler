// Demo script to show schema-driven protocol creation
import schemaValidator from './schemaValidator.js';

export const demonstrateSchemaUsage = async () => {
    console.log('🔬 BDSA Schema-Driven Protocol Management Demo');
    console.log('===============================================\n');

    // Load the schema
    console.log('1. Loading BDSA schema...');
    const loaded = await schemaValidator.loadSchemas();

    if (!loaded) {
        console.error('❌ Failed to load schema');
        return;
    }

    console.log('✅ Schema loaded successfully!\n');

    // Demonstrate stain protocol options
    console.log('2. Available Stain Types:');
    const stainTypes = schemaValidator.getStainTypeOptions();
    stainTypes.forEach(type => {
        console.log(`   - ${type.value}: ${type.label}`);
    });
    console.log('');

    // Show specific stain type details
    if (stainTypes.length > 0) {
        const firstStainType = stainTypes[0].value;
        console.log(`3. Details for "${firstStainType}" stain type:`);

        const antibodies = schemaValidator.getAntibodyOptions(firstStainType);
        if (antibodies.length > 0) {
            console.log(`   Antibodies: ${antibodies.join(', ')}`);
        }

        const techniques = schemaValidator.getTechniqueOptions(firstStainType);
        if (techniques.length > 0) {
            console.log(`   Techniques: ${techniques.join(', ')}`);
        }

        const phosphoOptions = schemaValidator.getPhosphoSpecificOptions(firstStainType);
        if (phosphoOptions.length > 0) {
            console.log(`   Phospho-specific options: ${phosphoOptions.join(', ')}`);
        }

        const dilutionPattern = schemaValidator.getDilutionPattern(firstStainType);
        if (dilutionPattern) {
            console.log(`   Dilution pattern: ${dilutionPattern}`);
        }

        const vendorPattern = schemaValidator.getVendorPattern(firstStainType);
        if (vendorPattern) {
            console.log(`   Vendor pattern: ${vendorPattern}`);
        }
        console.log('');
    }

    // Demonstrate region protocol options
    console.log('4. Available Region Types:');
    const regionTypes = schemaValidator.getRegionTypeOptions();
    regionTypes.slice(0, 5).forEach(type => { // Show first 5
        console.log(`   - ${type.value}: ${type.label}`);
    });
    if (regionTypes.length > 5) {
        console.log(`   ... and ${regionTypes.length - 5} more`);
    }
    console.log('');

    // Show specific region type details
    if (regionTypes.length > 0) {
        const firstRegionType = regionTypes[0].value;
        console.log(`5. Details for "${firstRegionType}" region type:`);

        const subRegions = schemaValidator.getSubRegionOptions(firstRegionType);
        if (subRegions.length > 0) {
            console.log(`   Sub-regions: ${subRegions.slice(0, 3).join(', ')}${subRegions.length > 3 ? '...' : ''}`);
        }
        console.log('');
    }

    // Demonstrate validation
    console.log('6. Protocol Validation Examples:');

    // Valid stain protocol
    const validStainProtocol = {
        name: 'TDP-43 Phosphorylation',
        stainType: 'TDP-43',
        phosphoSpecific: 'yes',
        dilution: '1:1000',
        vendor: 'Abcam'
    };

    const stainErrors = schemaValidator.validateStainProtocol(validStainProtocol);
    console.log(`   Valid stain protocol errors: ${Object.keys(stainErrors).length === 0 ? 'None ✅' : Object.keys(stainErrors).join(', ')}`);

    // Invalid stain protocol
    const invalidStainProtocol = {
        name: '', // Missing name
        stainType: 'TDP-43',
        phosphoSpecific: 'maybe', // Invalid value
        dilution: 'invalid', // Wrong pattern
        vendor: 'Ab cam' // Wrong pattern
    };

    const invalidStainErrors = schemaValidator.validateStainProtocol(invalidStainProtocol);
    console.log(`   Invalid stain protocol errors: ${Object.keys(invalidStainErrors).length} found`);
    Object.entries(invalidStainErrors).forEach(([field, error]) => {
        console.log(`     - ${field}: ${error}`);
    });
    console.log('');

    // Valid region protocol
    const validRegionProtocol = {
        name: 'Hippocampus CA1',
        regionType: 'Hippocampus',
        subRegion: 'CA1-4 with dentate gyrus',
        hemisphere: 'left',
        sliceOrientation: 'coronal'
    };

    const regionErrors = schemaValidator.validateRegionProtocol(validRegionProtocol);
    console.log(`   Valid region protocol errors: ${Object.keys(regionErrors).length === 0 ? 'None ✅' : Object.keys(regionErrors).join(', ')}`);

    console.log('\n🎉 Schema-driven protocol management is working correctly!');
    console.log('The UI will now dynamically generate forms based on the BDSA schema definitions.');
};

// Auto-run demo if this file is executed directly
if (typeof window !== 'undefined') {
    // Browser environment
    window.demonstrateSchemaUsage = demonstrateSchemaUsage;
} else {
    // Node environment
    demonstrateSchemaUsage().catch(console.error);
}
