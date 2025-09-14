export interface DSAConfig {
    baseUrl: string;
    resourceId: string;
    resourceType?: 'folder' | 'collection';
    fetchStrategy?: 'unlimited' | 'paginated';
    pageSize?: number;
}
export interface DSAItem {
    _id: string;
    name: string;
    size?: number;
    meta?: Record<string, any>;
    bdsaLocal?: {
        localCaseId?: string;
        localStainID?: string;
        localRegionId?: string;
        bdsaCaseId?: string;
        stainProtocols?: string[];
        regionProtocols?: string[];
    };
    _localLastModified?: string;
    _hasServerMetadata?: boolean;
    _modelType?: string;
    modelType?: string;
}
export interface DSAAuthStatus {
    isAuthenticated: boolean;
    isConfigured: boolean;
    hasToken: boolean;
    hasConfig: boolean;
    user?: {
        id: string;
        name: string;
        email?: string;
        login?: string;
    };
    serverUrl?: string;
    lastLogin?: Date;
    tokenExpiry?: Date;
}
export interface SyncProgress {
    current: number;
    total: number;
    currentItem?: string;
    status: 'idle' | 'running' | 'completed' | 'error';
    error?: string;
}
export interface FolderSyncConfig {
    sourceFolderId: string;
    targetFolderId: string;
    namingTemplate: string;
    createPatientFolders: boolean;
    dryRun: boolean;
}
export interface PatientFolder {
    patientId: string;
    folderId: string;
    slides: DSAItem[];
}
export interface SyncResult {
    success: boolean;
    message: string;
    processed: number;
    errors: string[];
    createdFolders: string[];
    copiedItems: string[];
}
export interface Protocol {
    id: string;
    name: string;
    description?: string;
    type: 'stain' | 'region' | 'ignore';
    stainType?: string;
    regionType?: string;
    properties?: Record<string, any>;
    _localModified?: boolean;
    _remoteVersion?: string | null;
}
export interface CaseIdMapping {
    localCaseId: string;
    bdsaCaseId: string;
}
export interface BDSAStainProtocol extends Protocol {
    stainType: string;
    antibody?: string;
    technique?: string;
    dilution?: string;
    vendor?: string;
    phosphoSpecific?: string;
}
export interface BDSARegionProtocol extends Protocol {
    regionType: string;
    subRegion?: string;
    hemisphere?: 'left' | 'right';
    sliceOrientation?: 'axial' | 'coronal' | 'sagittal';
    damage?: string[];
}
export interface SchemaValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}
export interface DataProcessingResult {
    success: boolean;
    processedItems: DSAItem[];
    errors: string[];
    statistics: {
        totalItems: number;
        processedItems: number;
        errorItems: number;
        mappedCases: number;
        unmappedCases: number;
    };
}
