// Naming template utilities for BDSA applications

import { DSAItem } from '@bdsa/shared-types';
import { extractPatientIdFromItem } from './dsa-api';

export interface NamingTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  example: string;
}

export const DEFAULT_NAMING_TEMPLATES: NamingTemplate[] = [
  {
    id: 'patient-slide',
    name: 'Patient-Slide',
    description: 'Format: {patientId}-{slideType}-{stain}',
    template: '{patientId}-{slideType}-{stain}',
    example: 'E05-194-MFG-4G8',
  },
  {
    id: 'patient-slide-index',
    name: 'Patient-Slide-Index',
    description: 'Format: {patientId}-{slideType}-{stain}-{index}',
    template: '{patientId}-{slideType}-{stain}-{index}',
    example: 'E05-194-MFG-4G8-01',
  },
  {
    id: 'patient-region-stain',
    name: 'Patient-Region-Stain',
    description: 'Format: {patientId}-{region}-{stain}',
    template: '{patientId}-{region}-{stain}',
    example: 'E05-194-MFG-4G8',
  },
  {
    id: 'bdsa-standard',
    name: 'BDSA Standard',
    description: 'Format: BDSA-{institutionId}-{patientId}-{region}-{stain}',
    template: 'BDSA-{institutionId}-{patientId}-{region}-{stain}',
    example: 'BDSA-001-E05-194-MFG-4G8',
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Custom template with available variables',
    template: '{patientId}-{region}-{stain}-{timestamp}',
    example: 'E05-194-MFG-4G8-2024-01-15',
  },
];

export function generateNameFromTemplate(
  item: DSAItem,
  template: string,
  options: {
    institutionId?: string;
    slideIndex?: number;
    timestamp?: string;
    customVars?: Record<string, string>;
  } = {}
): string {
  const patientId = extractPatientIdFromItem(item) || 'unknown';
  const originalName = item.name || 'unknown';
  const bdsaLocal = item.bdsaLocal || {};
  
  // Extract region and stain from BDSA metadata or original name
  const region = bdsaLocal.localRegionId || extractRegionFromName(originalName) || 'unknown';
  const stain = bdsaLocal.localStainID || extractStainFromName(originalName) || 'unknown';
  
  // Default values
  const timestamp = options.timestamp || new Date().toISOString().split('T')[0];
  const slideIndex = options.slideIndex || 1;
  const institutionId = options.institutionId || '001';
  
  // Replace template variables
  let result = template
    .replace(/\{patientId\}/g, patientId)
    .replace(/\{region\}/g, region)
    .replace(/\{stain\}/g, stain)
    .replace(/\{slideType\}/g, region) // Alias for region
    .replace(/\{institutionId\}/g, institutionId)
    .replace(/\{index\}/g, slideIndex.toString().padStart(2, '0'))
    .replace(/\{timestamp\}/g, timestamp)
    .replace(/\{originalName\}/g, originalName);
  
  // Replace custom variables
  if (options.customVars) {
    for (const [key, value] of Object.entries(options.customVars)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
  }
  
  // Clean up any remaining template variables
  result = result.replace(/\{[^}]+\}/g, 'unknown');
  
  return result;
}

export function extractRegionFromName(name: string): string | null {
  // Common region patterns
  const regionPatterns = [
    /(MFG|Middle.*Frontal.*Gyrus)/i,
    /(SFG|Superior.*Frontal.*Gyrus)/i,
    /(IFG|Inferior.*Frontal.*Gyrus)/i,
    /(STG|Superior.*Temporal.*Gyrus)/i,
    /(MTG|Middle.*Temporal.*Gyrus)/i,
    /(ITG|Inferior.*Temporal.*Gyrus)/i,
    /(Hippocampus|Hipp)/i,
    /(Amygdala|Amyg)/i,
    /(Cerebellum|Cereb)/i,
    /(Brainstem|BS)/i,
  ];
  
  for (const pattern of regionPatterns) {
    const match = name.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

export function extractStainFromName(name: string): string | null {
  // Common stain patterns
  const stainPatterns = [
    /(4G8|aBeta|ABeta)/i,
    /(6E10|aBeta|ABeta)/i,
    /(Tau|PHF1|AT8|CP13)/i,
    /(TDP43|TDP-43)/i,
    /(aSyn|Alpha.*Synuclein)/i,
    /(HE|H&E|Hematoxylin)/i,
    /(Silver|Bielschowsky|Gallyas)/i,
    /(Thioflavin|Thio)/i,
  ];
  
  for (const pattern of stainPatterns) {
    const match = name.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

export function validateTemplate(template: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
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
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

export function getTemplatePreview(
  template: string,
  sampleItem: DSAItem,
  options: {
    institutionId?: string;
    slideIndex?: number;
    timestamp?: string;
  } = {}
): string {
  try {
    return generateNameFromTemplate(sampleItem, template, options);
  } catch (error) {
    return 'Error generating preview';
  }
}

export function createCustomTemplate(
  name: string,
  description: string,
  template: string
): NamingTemplate {
  const validation = validateTemplate(template);
  if (!validation.valid) {
    throw new Error(`Invalid template: ${validation.errors.join(', ')}`);
  }
  
  return {
    id: `custom-${Date.now()}`,
    name,
    description,
    template,
    example: 'Preview not available',
  };
}
