import api from '../api';
import { AxiosResponse } from 'axios';

/**
 * Backup API utilities
 * Handles export and restore operations for organization backups
 */

/**
 * Export organization backup as compressed blob
 * @param orgId - Organization ID
 * @param collectionPrefix - Organization collection prefix (for Platform Owner context)
 * @returns Promise resolving to Blob
 */
export const exportBackup = async (orgId: string, collectionPrefix?: string): Promise<Blob> => {
  const config: any = {
    responseType: 'blob', // Important: Get response as blob
  };

  // Add organization prefix header for Platform Owner context
  if (collectionPrefix) {
    config.headers = {
      'X-Organization-Prefix': collectionPrefix,
    };
  }

  const response: AxiosResponse<Blob> = await api.get(`/api/backup/${orgId}/export`, config);
  return response.data;
};

/**
 * Download backup to user's computer (triggers browser download)
 * @param orgId - Organization ID
 * @param collectionPrefix - Organization collection prefix (for Platform Owner context)
 * @returns Promise that resolves when download is triggered
 */
export const downloadBackup = async (orgId: string, collectionPrefix?: string): Promise<void> => {
  const config: any = {
    responseType: 'blob', // Important: Get response as blob
  };

  // Add organization prefix header for Platform Owner context
  if (collectionPrefix) {
    config.headers = {
      'X-Organization-Prefix': collectionPrefix,
    };
  }

  const response = await api.get(`/api/backup/${orgId}/export`, config);
  const blob = response.data;

  // Get filename from Content-Disposition header or generate one
  const contentDisposition = response.headers['content-disposition'];
  let filename = `backup-${orgId}-${new Date().toISOString().split('T')[0]}.json.gz`;
  
  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename="(.+)"/);
    if (filenameMatch && filenameMatch[1]) {
      filename = filenameMatch[1];
    }
  }

  // Trigger browser download
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

/**
 * Restore organization from backup file
 * @param orgId - Organization ID
 * @param file - Backup file (compressed .gz file)
 * @param collectionPrefix - Organization collection prefix (for Platform Owner context)
 * @returns Promise resolving to restore response
 */
export const restoreBackup = async (
  orgId: string,
  file: File,
  collectionPrefix?: string
): Promise<{ msg: string; stats: any }> => {
  const formData = new FormData();
  formData.append('backupFile', file);

  const config: any = {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  };

  // Add organization prefix header for Platform Owner context
  if (collectionPrefix) {
    config.headers['X-Organization-Prefix'] = collectionPrefix;
  }

  const response = await api.post(`/api/backup/${orgId}/restore`, formData, config);
  return response.data;
};

/**
 * Restore organization from backup file (context-based, no orgId required)
 * @param file - Backup file (.gz or .json file)
 * @param organizationId - Optional organization ID (for Platform Owner)
 * @returns Promise resolving to restore response
 */
export const restoreData = async (
  file: File,
  organizationId?: string
): Promise<{ msg: string; users: number; sessions: number; attendance: number; classBatches: number; leaveRequests: number }> => {
  const formData = new FormData();
  formData.append('backupFile', file);

  const config: any = {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  };

  // Add organization ID header for Platform Owner
  if (organizationId) {
    config.headers['X-Organization-Id'] = organizationId;
  }

  const response = await api.post('/api/backup/restore', formData, config);
  return response.data;
};

/**
 * Stream organization backup as JSON (zero-storage)
 * @param organizationId - Optional organization ID (for Platform Owner, required in query param)
 * @returns Promise resolving to JSON backup data
 */
export const streamBackup = async (organizationId?: string): Promise<object> => {
  const config: any = {
    responseType: 'json', // Get response as JSON
  };

  // Add organization ID to query params for Platform Owner
  const url = organizationId 
    ? `/api/backup/stream?orgId=${organizationId}`
    : '/api/backup/stream';

  const response = await api.get(url, config);
  return response.data;
};

/**
 * Download streamed backup as JSON file (for Company Admins - context-based)
 * @param organizationId - Optional organization ID (for Platform Owner)
 * @returns Promise that resolves when download is triggered
 */
export const downloadStreamBackup = async (organizationId?: string): Promise<void> => {
  // Fetch backup as JSON
  const backupData = await streamBackup(organizationId);

  // Convert JSON to blob
  const jsonString = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });

  // Generate filename
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const filename = `backup-${dateStr}.json`;

  // Trigger browser download
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

