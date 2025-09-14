// Validation utilities for BDSA applications
export function validateDSAItem(item) {
    const errors = [];
    const warnings = [];
    // Required fields
    if (!item._id) {
        errors.push('Item missing required field: _id');
    }
    if (!item.name) {
        errors.push('Item missing required field: name');
    }
    // BDSA metadata validation
    if (item.bdsaLocal) {
        const bdsa = item.bdsaLocal;
        // Validate case ID format
        if (bdsa.bdsaCaseId && !isValidBDSAId(bdsa.bdsaCaseId)) {
            errors.push(`Invalid BDSA case ID format: ${bdsa.bdsaCaseId}`);
        }
        // Validate protocol arrays
        if (bdsa.stainProtocols && !Array.isArray(bdsa.stainProtocols)) {
            errors.push('stainProtocols must be an array');
        }
        if (bdsa.regionProtocols && !Array.isArray(bdsa.regionProtocols)) {
            errors.push('regionProtocols must be an array');
        }
        // Check for missing mappings
        if (bdsa.localCaseId && !bdsa.bdsaCaseId) {
            warnings.push('Local case ID present but no BDSA case ID mapped');
        }
    }
    // File size validation
    if (item.size !== undefined) {
        if (item.size < 0) {
            errors.push('File size cannot be negative');
        }
        else if (item.size === 0) {
            warnings.push('File size is zero - may indicate empty file');
        }
        else if (item.size > 10 * 1024 * 1024 * 1024) { // 10GB
            warnings.push('File size is very large (>10GB)');
        }
    }
    // Name validation
    if (item.name) {
        if (item.name.length > 255) {
            errors.push('Item name is too long (>255 characters)');
        }
        // Check for problematic characters
        const problematicChars = /[<>:"/\\|?*]/;
        if (problematicChars.test(item.name)) {
            warnings.push('Item name contains characters that may cause issues: < > : " / \\ | ? *');
        }
    }
    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}
export function isValidBDSAId(id) {
    // BDSA ID format: BDSA-XXX-YYYY where XXX is 3-digit institution ID and YYYY is 4-digit case number
    const bdsaPattern = /^BDSA-\d{3}-\d{4}$/;
    return bdsaPattern.test(id);
}
export function validateFolderSyncConfig(config) {
    const errors = [];
    const warnings = [];
    if (!config.sourceFolderId) {
        errors.push('Source folder ID is required');
    }
    if (!config.targetFolderId) {
        errors.push('Target folder ID is required');
    }
    if (config.sourceFolderId === config.targetFolderId) {
        errors.push('Source and target folders cannot be the same');
    }
    if (!config.namingTemplate) {
        errors.push('Naming template is required');
    }
    // Validate naming template
    if (config.namingTemplate) {
        const templateValidation = validateNamingTemplate(config.namingTemplate);
        if (!templateValidation.valid) {
            errors.push(...templateValidation.errors);
        }
    }
    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}
export function validateNamingTemplate(template) {
    const errors = [];
    const warnings = [];
    if (!template) {
        errors.push('Template cannot be empty');
        return { valid: false, errors, warnings };
    }
    // Check for balanced braces
    const openBraces = (template.match(/\{/g) || []).length;
    const closeBraces = (template.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
        errors.push('Unbalanced braces in template');
    }
    // Check for valid variables
    const validVariables = [
        'patientId', 'region', 'stain', 'slideType', 'institutionId',
        'index', 'timestamp', 'originalName'
    ];
    const templateVars = template.match(/\{([^}]+)\}/g) || [];
    for (const varMatch of templateVars) {
        const varName = varMatch.slice(1, -1); // Remove braces
        if (!validVariables.includes(varName)) {
            errors.push(`Unknown variable: ${varName}`);
        }
    }
    // Check for required variables
    if (!template.includes('{patientId}')) {
        warnings.push('Template should include {patientId} for proper organization');
    }
    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}
export function validateBatchOperation(items, operation) {
    const errors = [];
    const warnings = [];
    if (!Array.isArray(items)) {
        errors.push('Items must be an array');
        return { valid: false, errors, warnings };
    }
    if (items.length === 0) {
        warnings.push('No items to process');
    }
    if (items.length > 1000) {
        warnings.push('Large batch operation (>1000 items) may take a long time');
    }
    // Validate each item
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemValidation = validateDSAItem(item);
        if (!itemValidation.valid) {
            errors.push(`Item ${i + 1} (${item.name || 'unnamed'}): ${itemValidation.errors.join(', ')}`);
        }
        warnings.push(...itemValidation.warnings.map(w => `Item ${i + 1}: ${w}`));
    }
    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}
export function sanitizeFileName(name) {
    // Remove or replace problematic characters
    return name
        .replace(/[<>:"/\\|?*]/g, '_') // Replace problematic chars with underscore
        .replace(/\s+/g, '_') // Replace spaces with underscore
        .replace(/_+/g, '_') // Collapse multiple underscores
        .replace(/^_|_$/g, '') // Remove leading/trailing underscores
        .substring(0, 255); // Limit length
}
export function validateInstitutionId(id) {
    // Institution ID should be 3 digits
    return /^\d{3}$/.test(id);
}
export function validateCaseId(caseId) {
    // Case ID should be alphanumeric with optional hyphens
    return /^[A-Z0-9-]+$/i.test(caseId);
}
