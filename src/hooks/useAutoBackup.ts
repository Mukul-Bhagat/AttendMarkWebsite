import { useEffect, useCallback, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { streamBackup } from '../api/backupApi';
import { saveBackup, getLastBackupDate } from '../utils/localBackup';

/**
 * Custom hook for automatic daily backup
 * 
 * Smart Logic:
 * - EXIT IMMEDIATELY if user.role === 'PLATFORM_OWNER' (Do not auto-save for Super Admin)
 * - Only proceed if user.role === 'COMPANY_ADMIN'
 * - Check IndexedDB for last backup date
 * - If lastBackup !== today, fetch backup from streaming endpoint and save to IndexedDB
 * - Show subtle toast notification on success
 */
export const useAutoBackup = () => {
  const { user } = useAuth();
  const hasRunRef = useRef(false); // Prevent multiple runs
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  /**
   * Get today's date in YYYY-MM-DD format
   */
  const getTodayDate = useCallback((): string => {
    return new Date().toISOString().split('T')[0];
  }, []);

  /**
   * Perform automatic backup
   */
  const performAutoBackup = useCallback(async (): Promise<void> => {
    if (!user || !user.collectionPrefix) {
      return;
    }

    try {
      // Check last backup date from IndexedDB
      const lastBackupDate = await getLastBackupDate();
      const today = getTodayDate();

      // If backup was already done today, skip
      if (lastBackupDate === today) {
        console.log('[Auto-Backup] Backup already done today');
        return;
      }

      console.log('[Auto-Backup] Starting automatic backup...');
      
      // Fetch backup from streaming endpoint (zero-storage, returns JSON directly)
      const backupData = await streamBackup();

      // Save to IndexedDB using today's date
      await saveBackup(today, backupData);

      console.log('[Auto-Backup] ✅ Backup completed successfully');
      
      // Show success toast (Toast component will auto-dismiss)
      setToast({
        message: 'Daily Backup saved to browser successfully.',
        type: 'success',
      });
    } catch (error: any) {
      // Silently fail - don't interrupt user experience
      console.error('[Auto-Backup] Failed to create automatic backup:', error.message);
    }
  }, [user, getTodayDate]);

  /**
   * Main effect: Check and perform backup if needed
   */
  useEffect(() => {
    // STRICT ROLE CHECK: EXIT IMMEDIATELY if Platform Owner
    if (user?.role === 'PLATFORM_OWNER') {
      return; // Do not auto-save for Super Admin
    }

    // STRICT ROLE CHECK: Only proceed for Company Admin
    if (user?.role !== 'CompanyAdmin') {
      return;
    }

    // Don't run if user is not loaded yet
    if (!user || !user.collectionPrefix) {
      return;
    }

    // Prevent multiple runs
    if (hasRunRef.current) {
      return;
    }

    // Run backup check after a short delay to not block initial render
    const timeoutId = setTimeout(() => {
      hasRunRef.current = true;
      performAutoBackup();
    }, 3000); // 3 second delay

    return () => clearTimeout(timeoutId);
  }, [user, performAutoBackup]);

  const closeToast = useCallback(() => {
    setToast(null);
  }, []);

  return {
    performAutoBackup,
    toast,
    closeToast,
  };
};
