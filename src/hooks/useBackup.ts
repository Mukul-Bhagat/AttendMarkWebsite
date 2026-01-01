import { useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';
import { saveBackup, isBackupNeeded } from '../utils/backupStorage';

/**
 * Custom hook for automatic backup management
 * Implements "catch-up strategy" - creates backup when app is opened if needed
 */
export const useBackup = () => {
  const { user, isSuperAdmin, isCompanyAdmin, isPlatformOwner } = useAuth();

  // Get organization ID from user context or fetch it
  const getOrganizationId = useCallback(async (): Promise<string | null> => {
    if (!user?.collectionPrefix) {
      return null;
    }

    try {
      // For Platform Owner, fetch from platform endpoint
      if (isPlatformOwner) {
        const platformResponse = await api.get('/api/platform/organizations');
        const org = platformResponse.data?.organizations?.find(
          (o: any) => o.collectionPrefix === user.collectionPrefix
        );
        return org?.id || null;
      }
      
      // For regular admins, try to get from platform endpoint (if accessible)
      // If not accessible, we'll skip backup (non-critical feature)
      try {
        const platformResponse = await api.get('/api/platform/organizations');
        const org = platformResponse.data?.organizations?.find(
          (o: any) => o.collectionPrefix === user.collectionPrefix
        );
        return org?.id || null;
      } catch (err) {
        // Platform endpoint not accessible for regular admins - skip backup
        // This is acceptable as backup is a convenience feature
        return null;
      }
    } catch (error) {
      console.error('Error fetching organization ID:', error);
      return null;
    }
  }, [user, isPlatformOwner]);

  // Create backup silently in the background
  const createBackup = useCallback(async (orgId: string, collectionPrefix: string): Promise<void> => {
    try {
      // Fetch backup from API
      const response = await api.get(`/api/backup/${orgId}/export`, {
        responseType: 'blob', // Important: Get response as blob
      });

      // Save to IndexedDB using collectionPrefix as key
      await saveBackup(orgId, collectionPrefix, response.data);
      
      console.log(`✅ Backup created successfully for organization ${orgId}`);
    } catch (error: any) {
      // Silently fail - don't interrupt user experience
      console.error('Failed to create automatic backup:', error);
    }
  }, []);

  // Check and create backup if needed
  useEffect(() => {
    // Only run for admins (SuperAdmin, CompanyAdmin, PlatformOwner)
    if (!isSuperAdmin && !isCompanyAdmin && !isPlatformOwner) {
      return;
    }

    // Don't run if user is not loaded yet
    if (!user || !user.collectionPrefix) {
      return;
    }

    const checkAndBackup = async () => {
      try {
        const collectionPrefix = user.collectionPrefix;
        if (!collectionPrefix) {
          return; // Can't backup without collection prefix
        }

        // Check if backup is needed
        const needsBackup = await isBackupNeeded(collectionPrefix);
        if (needsBackup) {
          // Get organization ID for API call
          const orgId = await getOrganizationId();
          if (orgId) {
            // Create backup silently in background
            await createBackup(orgId, collectionPrefix);
          }
        }
      } catch (error) {
        // Silently fail - don't interrupt user experience
        console.error('Error in backup check:', error);
      }
    };

    // Run check after a short delay to not block initial render
    const timeoutId = setTimeout(checkAndBackup, 2000);

    return () => clearTimeout(timeoutId);
  }, [user, isSuperAdmin, isCompanyAdmin, isPlatformOwner, getOrganizationId, createBackup]);

  return {
    createBackup,
    getOrganizationId,
  };
};

