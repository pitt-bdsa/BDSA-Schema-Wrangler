import { DSAItem } from '@bdsa/shared-types';
export interface NamingTemplate {
    id: string;
    name: string;
    description: string;
    template: string;
    example: string;
}
export declare const DEFAULT_NAMING_TEMPLATES: NamingTemplate[];
export declare function generateNameFromTemplate(item: DSAItem, template: string, options?: {
    institutionId?: string;
    slideIndex?: number;
    timestamp?: string;
    customVars?: Record<string, string>;
}): string;
export declare function extractRegionFromName(name: string): string | null;
export declare function extractStainFromName(name: string): string | null;
export declare function validateTemplate(template: string): {
    valid: boolean;
    errors: string[];
};
export declare function getTemplatePreview(template: string, sampleItem: DSAItem, options?: {
    institutionId?: string;
    slideIndex?: number;
    timestamp?: string;
}): string;
export declare function createCustomTemplate(name: string, description: string, template: string): NamingTemplate;
