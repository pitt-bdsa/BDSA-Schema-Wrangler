import { DSAItem, SchemaValidationResult } from '@bdsa/shared-types';
export declare function validateDSAItem(item: DSAItem): SchemaValidationResult;
export declare function isValidBDSAId(id: string): boolean;
export declare function validateFolderSyncConfig(config: {
    sourceFolderId: string;
    targetFolderId: string;
    namingTemplate: string;
    createPatientFolders: boolean;
    dryRun: boolean;
}): SchemaValidationResult;
export declare function validateNamingTemplate(template: string): SchemaValidationResult;
export declare function validateBatchOperation(items: DSAItem[], operation: 'copy' | 'move' | 'update'): SchemaValidationResult;
export declare function sanitizeFileName(name: string): string;
export declare function validateInstitutionId(id: string): boolean;
export declare function validateCaseId(caseId: string): boolean;
