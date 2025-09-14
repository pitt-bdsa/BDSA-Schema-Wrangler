import { DSAItem, PatientFolder, DataProcessingResult } from '@bdsa/shared-types';
export declare function groupItemsByPatient(items: DSAItem[]): Map<string, PatientFolder>;
export declare function processItemsForSync(items: DSAItem[], options?: {
    filterPattern?: RegExp;
    excludePattern?: RegExp;
    minFileSize?: number;
    maxFileSize?: number;
}): DataProcessingResult;
export declare function validateItemForSync(item: DSAItem): {
    valid: boolean;
    errors: string[];
};
export declare function generateSyncReport(sourceItems: DSAItem[], targetItems: DSAItem[], processedItems: DSAItem[]): {
    summary: {
        sourceCount: number;
        targetCount: number;
        processedCount: number;
        duplicateCount: number;
    };
    duplicates: DSAItem[];
    missing: DSAItem[];
};
export declare function sortItemsByPatientAndName(items: DSAItem[]): DSAItem[];
export declare function extractMetadataFromItem(item: DSAItem): Record<string, any>;
export declare function createItemWithMetadata(originalItem: DSAItem, updates: Partial<DSAItem>): DSAItem;
