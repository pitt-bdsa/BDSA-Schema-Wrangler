// DSA API utilities for BDSA applications

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { DSAConfig, DSAItem, DSAAuthStatus, SyncResult } from '@bdsa/shared-types';

export class DSAApiClient {
  private client: AxiosInstance;
  private config: DSAConfig;
  private token: string = '';

  constructor(config: DSAConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to include auth token
    this.client.interceptors.request.use((config) => {
      if (this.token) {
        config.headers['Girder-Token'] = this.token;
      }
      return config;
    });
  }

  setToken(token: string) {
    this.token = token;
  }

  setConfig(config: DSAConfig) {
    this.config = config;
    this.client.defaults.baseURL = config.baseUrl;
  }

  // Authentication methods
  async authenticate(username: string, password: string): Promise<{ success: boolean; token?: string; user?: any }> {
    try {
      const credentials = btoa(`${username}:${password}`);
      const response = await this.client.get('/api/v1/user/authentication', {
        headers: {
          'Authorization': `Basic ${credentials}`,
        },
      });

      const authData = response.data;
      const girderToken = authData?.authToken?.token;
      const userData = authData?.user;

      if (!girderToken) {
        throw new Error('No authentication token received from server');
      }

      this.token = girderToken;
      return {
        success: true,
        token: girderToken,
        user: userData,
      };
    } catch (error: any) {
      console.error('Authentication failed:', error);
      throw new Error(error.response?.data?.message || `Authentication failed: ${error.message}`);
    }
  }

  async validateToken(): Promise<boolean> {
    if (!this.token) return false;

    try {
      const response = await this.client.get('/api/v1/user/me');
      return response.status === 200;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }

  async testConnection(): Promise<{ success: boolean; version?: any; message: string }> {
    try {
      const response = await this.client.get('/api/v1/system/version');
      return {
        success: true,
        version: response.data,
        message: 'Connection successful',
      };
    } catch (error: any) {
      throw new Error(`Connection failed: ${error.message}`);
    }
  }

  // Resource methods
  async getResourceItems(resourceId: string, limit?: number, offset?: number): Promise<DSAItem[]> {
    try {
      const params: any = {};
      if (limit) params.limit = limit;
      if (offset) params.offset = offset;

      const response = await this.client.get(`/resource/${resourceId}/items`, { params });
      return response.data || [];
    } catch (error: any) {
      console.error('Failed to get resource items:', error);
      throw new Error(`Failed to get resource items: ${error.message}`);
    }
  }

  async getAllResourceItems(resourceId: string): Promise<DSAItem[]> {
    const allItems: DSAItem[] = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const items = await this.getResourceItems(resourceId, limit, offset);
      if (items.length === 0) break;

      allItems.push(...items);
      offset += limit;

      // Safety check to prevent infinite loops
      if (items.length < limit) break;
    }

    return allItems;
  }

  async getItem(itemId: string): Promise<DSAItem> {
    try {
      const response = await this.client.get(`/api/v1/item/${itemId}`);
      return response.data;
    } catch (error: any) {
      console.error('Failed to get item:', error);
      throw new Error(`Failed to get item: ${error.message}`);
    }
  }

  async updateItem(itemId: string, updates: Partial<DSAItem>): Promise<DSAItem> {
    try {
      const response = await this.client.put(`/api/v1/item/${itemId}`, updates);
      return response.data;
    } catch (error: any) {
      console.error('Failed to update item:', error);
      throw new Error(`Failed to update item: ${error.message}`);
    }
  }

  // Folder operations
  async createFolder(parentId: string, name: string, description?: string): Promise<DSAItem> {
    try {
      const response = await this.client.post('/api/v1/folder', {
        parentId,
        name,
        description,
      });
      return response.data;
    } catch (error: any) {
      console.error('Failed to create folder:', error);
      throw new Error(`Failed to create folder: ${error.message}`);
    }
  }

  async getFolder(folderId: string): Promise<DSAItem> {
    try {
      const response = await this.client.get(`/api/v1/folder/${folderId}`);
      return response.data;
    } catch (error: any) {
      console.error('Failed to get folder:', error);
      throw new Error(`Failed to get folder: ${error.message}`);
    }
  }

  async getFolderItems(folderId: string, limit?: number, offset?: number): Promise<DSAItem[]> {
    try {
      const params: any = {};
      if (limit) params.limit = limit;
      if (offset) params.offset = offset;

      const response = await this.client.get(`/api/v1/folder/${folderId}/items`, { params });
      return response.data || [];
    } catch (error: any) {
      console.error('Failed to get folder items:', error);
      throw new Error(`Failed to get folder items: ${error.message}`);
    }
  }

  async getAllFolderItems(folderId: string): Promise<DSAItem[]> {
    const allItems: DSAItem[] = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const items = await this.getFolderItems(folderId, limit, offset);
      if (items.length === 0) break;

      allItems.push(...items);
      offset += limit;

      // Safety check to prevent infinite loops
      if (items.length < limit) break;
    }

    return allItems;
  }

  // Copy operations
  async copyItem(itemId: string, targetFolderId: string, newName?: string): Promise<DSAItem> {
    try {
      const response = await this.client.post(`/api/v1/item/${itemId}/copy`, {
        targetFolderId,
        name: newName,
      });
      return response.data;
    } catch (error: any) {
      console.error('Failed to copy item:', error);
      throw new Error(`Failed to copy item: ${error.message}`);
    }
  }

  async moveItem(itemId: string, targetFolderId: string): Promise<DSAItem> {
    try {
      const response = await this.client.put(`/api/v1/item/${itemId}`, {
        folderId: targetFolderId,
      });
      return response.data;
    } catch (error: any) {
      console.error('Failed to move item:', error);
      throw new Error(`Failed to move item: ${error.message}`);
    }
  }

  // Batch operations
  async batchUpdateItems(updates: Array<{ itemId: string; updates: Partial<DSAItem> }>): Promise<DSAItem[]> {
    const results: DSAItem[] = [];
    const errors: string[] = [];

    for (const { itemId, updates: itemUpdates } of updates) {
      try {
        const result = await this.updateItem(itemId, itemUpdates);
        results.push(result);
      } catch (error: any) {
        errors.push(`Failed to update item ${itemId}: ${error.message}`);
      }
    }

    if (errors.length > 0) {
      console.warn('Some items failed to update:', errors);
    }

    return results;
  }

  async batchCopyItems(copies: Array<{ itemId: string; targetFolderId: string; newName?: string }>): Promise<DSAItem[]> {
    const results: DSAItem[] = [];
    const errors: string[] = [];

    for (const { itemId, targetFolderId, newName } of copies) {
      try {
        const result = await this.copyItem(itemId, targetFolderId, newName);
        results.push(result);
      } catch (error: any) {
        errors.push(`Failed to copy item ${itemId}: ${error.message}`);
      }
    }

    if (errors.length > 0) {
      console.warn('Some items failed to copy:', errors);
    }

    return results;
  }
}

// Utility functions
export function createDSAClient(config: DSAConfig): DSAApiClient {
  return new DSAApiClient(config);
}

export function validateDSAConfig(config: Partial<DSAConfig>): config is DSAConfig {
  return !!(config.baseUrl && config.resourceId);
}

export function extractPatientIdFromItem(item: DSAItem): string | null {
  // Try to extract patient ID from various possible fields
  const name = item.name || '';
  const meta = item.meta || {};
  const bdsaLocal = item.bdsaLocal || {};

  // Check BDSA local case ID first
  if (bdsaLocal.localCaseId) {
    return bdsaLocal.localCaseId;
  }

  // Check BDSA case ID
  if (bdsaLocal.bdsaCaseId) {
    return bdsaLocal.bdsaCaseId;
  }

  // Try to extract from filename patterns
  const patterns = [
    /^([A-Z0-9]+)-/,  // Pattern like "E05-194-..."
    /^([0-9]{2}-[0-9]+)/,  // Pattern like "02-109-..."
    /^([A-Z0-9]+)_/,  // Pattern like "E05_194_..."
  ];

  for (const pattern of patterns) {
    const match = name.match(pattern);
    if (match) {
      return match[1];
    }
  }

  // Check metadata fields
  if (meta.caseID) return meta.caseID;
  if (meta.caseId) return meta.caseId;
  if (meta.patientId) return meta.patientId;

  return null;
}

export function generateStandardizedName(item: DSAItem, template: string): string {
  const patientId = extractPatientIdFromItem(item);
  const originalName = item.name || 'unknown';
  
  // Simple template replacement for now
  // Could be enhanced with more sophisticated templating
  return template
    .replace('{patientId}', patientId || 'unknown')
    .replace('{originalName}', originalName)
    .replace('{timestamp}', new Date().toISOString().split('T')[0]);
}
