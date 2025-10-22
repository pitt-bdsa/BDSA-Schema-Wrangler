// Data processing utilities for BDSA applications

import { DSAItem, PatientFolder, DataProcessingResult } from '@bdsa/shared-types';
import { extractPatientIdFromItem } from './dsa-api';

export function groupItemsByPatient(items: DSAItem[]): Map<string, PatientFolder> {
  const patientMap = new Map<string, PatientFolder>();

  for (const item of items) {
    const patientId = extractPatientIdFromItem(item);
    
    if (!patientId) {
      console.warn(`Could not extract patient ID from item: ${item.name}`);
      continue;
    }

    if (!patientMap.has(patientId)) {
      patientMap.set(patientId, {
        patientId,
        folderId: '', // Will be set when folder is created
        slides: [],
      });
    }

    patientMap.get(patientId)!.slides.push(item);
  }

  return patientMap;
}

export function processItemsForSync(
  items: DSAItem[],
  options: {
    filterPattern?: RegExp;
    excludePattern?: RegExp;
    minFileSize?: number;
    maxFileSize?: number;
  } = {}
): DataProcessingResult {
  const errors: string[] = [];
  const processedItems: DSAItem[] = [];
  const statistics = {
    totalItems: items.length,
    processedItems: 0,
    errorItems: 0,
    mappedCases: 0,
    unmappedCases: 0,
  };

  const patientIds = new Set<string>();

  for (const item of items) {
    try {
      // Apply filters
      if (options.filterPattern && !options.filterPattern.test(item.name || '')) {
        continue;
      }

      if (options.excludePattern && options.excludePattern.test(item.name || '')) {
        continue;
      }

      if (options.minFileSize && (item.size || 0) < options.minFileSize) {
        continue;
      }

      if (options.maxFileSize && (item.size || 0) > options.maxFileSize) {
        continue;
      }

      // Extract patient ID
      const patientId = extractPatientIdFromItem(item);
      if (patientId) {
        patientIds.add(patientId);
        if (item.bdsaLocal?.bdsaCaseId) {
          statistics.mappedCases++;
        } else {
          statistics.unmappedCases++;
        }
      }

      processedItems.push(item);
      statistics.processedItems++;

    } catch (error: any) {
      errors.push(`Error processing item ${item.name}: ${error.message}`);
      statistics.errorItems++;
    }
  }

  return {
    success: errors.length === 0,
    processedItems,
    errors,
    statistics,
  };
}

export function validateItemForSync(item: DSAItem): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!item._id) {
    errors.push('Item missing ID');
  }

  if (!item.name) {
    errors.push('Item missing name');
  }

  if (!extractPatientIdFromItem(item)) {
    errors.push('Could not extract patient ID from item');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function generateSyncReport(
  sourceItems: DSAItem[],
  targetItems: DSAItem[],
  processedItems: DSAItem[]
): {
  summary: {
    sourceCount: number;
    targetCount: number;
    processedCount: number;
    duplicateCount: number;
  };
  duplicates: DSAItem[];
  missing: DSAItem[];
} {
  const sourceNames = new Set(sourceItems.map(item => item.name));
  const targetNames = new Set(targetItems.map(item => item.name));
  const processedNames = new Set(processedItems.map(item => item.name));

  const duplicates = targetItems.filter(item => sourceNames.has(item.name));
  const missing = sourceItems.filter(item => !targetNames.has(item.name));

  return {
    summary: {
      sourceCount: sourceItems.length,
      targetCount: targetItems.length,
      processedCount: processedItems.length,
      duplicateCount: duplicates.length,
    },
    duplicates,
    missing,
  };
}

export function sortItemsByPatientAndName(items: DSAItem[]): DSAItem[] {
  return items.sort((a, b) => {
    const patientA = extractPatientIdFromItem(a) || '';
    const patientB = extractPatientIdFromItem(b) || '';
    
    if (patientA !== patientB) {
      return patientA.localeCompare(patientB);
    }
    
    return (a.name || '').localeCompare(b.name || '');
  });
}

export function extractMetadataFromItem(item: DSAItem): Record<string, any> {
  const metadata: Record<string, any> = {
    originalName: item.name,
    size: item.size,
    lastModified: item._localLastModified,
  };

  // Extract BDSA metadata
  if (item.bdsaLocal) {
    metadata.bdsaLocal = { ...item.bdsaLocal };
  }

  // Extract other metadata
  if (item.meta) {
    metadata.meta = { ...item.meta };
  }

  return metadata;
}

export function createItemWithMetadata(
  originalItem: DSAItem,
  updates: Partial<DSAItem>
): DSAItem {
  return {
    ...originalItem,
    ...updates,
    meta: {
      ...originalItem.meta,
      ...updates.meta,
      syncMetadata: {
        originalId: originalItem._id,
        originalName: originalItem.name,
        syncedAt: new Date().toISOString(),
        syncVersion: '1.0',
      },
    },
  };
}
