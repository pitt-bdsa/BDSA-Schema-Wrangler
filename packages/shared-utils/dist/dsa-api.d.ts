/// <reference types="node" />
import { DSAConfig, DSAItem } from '@bdsa/shared-types';
export declare class DSAApiClient {
    private client;
    private config;
    private token;
    constructor(config: DSAConfig);
    setToken(token: string): void;
    getToken(): string;
    setConfig(config: DSAConfig): void;
    private normalizeBaseUrl;
    getNormalizedBaseUrl(): string;
    authenticate(username: string, password: string): Promise<{
        success: boolean;
        token?: string;
        user?: any;
    }>;
    validateToken(): Promise<boolean>;
    logout(): Promise<void>;
    testConnection(): Promise<{
        success: boolean;
        version?: any;
        message: string;
    }>;
    getResourceItems(resourceId: string, limit?: number, offset?: number, resourceType?: string): Promise<DSAItem[]>;
    getAllResourceItems(resourceId: string, resourceType?: string): Promise<DSAItem[]>;
    getItem(itemId: string): Promise<DSAItem>;
    updateItem(itemId: string, updates: Partial<DSAItem>): Promise<DSAItem>;
    createFolder(parentId: string, name: string, description?: string, parentType?: 'folder' | 'collection', reuseExisting?: boolean): Promise<DSAItem>;
    getFolder(folderId: string): Promise<DSAItem>;
    getFolderItems(folderId: string, limit?: number, offset?: number): Promise<DSAItem[]>;
    getAllFolderItems(folderId: string): Promise<DSAItem[]>;
    getAllExistingFolders(parentResourceId: string, parentType?: 'folder' | 'collection'): Promise<DSAItem[]>;
    findFolderByName(parentResourceId: string, folderName: string, parentType?: 'folder' | 'collection'): Promise<DSAItem | null>;
    ensureFoldersExist(parentResourceId: string, folderNames: string[], parentType?: 'folder' | 'collection'): Promise<{
        [folderName: string]: DSAItem;
    }>;
    ensureFolderExists(parentResourceId: string, folderName: string, description?: string, parentType?: 'folder' | 'collection'): Promise<DSAItem>;
    copyItem(itemId: string, targetFolderId: string, newName?: string): Promise<DSAItem>;
    moveItem(itemId: string, targetFolderId: string): Promise<DSAItem>;
    uploadFile(parentId: string, file: File, parentType?: 'folder' | 'collection', replaceExisting?: boolean): Promise<{
        success: boolean;
        item?: DSAItem;
        error?: string;
    }>;
    batchUpdateItems(updates: Array<{
        itemId: string;
        updates: Partial<DSAItem>;
    }>): Promise<DSAItem[]>;
    batchCopyItems(copies: Array<{
        itemId: string;
        targetFolderId: string;
        newName?: string;
    }>): Promise<DSAItem[]>;
}
export declare function createDSAClient(config: DSAConfig): DSAApiClient;
export declare function validateDSAConfig(config: Partial<DSAConfig>): config is DSAConfig;
export declare function extractPatientIdFromItem(item: DSAItem): string | null;
export declare function generateStandardizedName(item: DSAItem, template: string): string;
