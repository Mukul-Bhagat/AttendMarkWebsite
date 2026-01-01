/**
 * IndexedDB wrapper for storing backup files locally
 * Database: AttendMarkBackups
 * Store: attendmark-backups
 */

const DB_NAME = 'AttendMarkBackups';
const DB_VERSION = 1;
const STORE_NAME = 'attendmark-backups';

interface BackupSnapshot {
  id: string; // Composite key: `${orgId}_${dateKey}`
  orgId: string;
  dateKey: string; // Format: YYYY-MM-DD
  timestamp: number;
  blob: Blob;
  size: number;
}

// Open database connection
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        objectStore.createIndex('orgId', 'orgId', { unique: false });
        objectStore.createIndex('dateKey', 'dateKey', { unique: false });
      }
    };
  });
};

/**
 * Get today's date key in YYYY-MM-DD format
 */
const getTodayDateKey = (): string => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

/**
 * Save a backup blob to IndexedDB
 * @param orgId - Organization ID
 * @param blob - Compressed backup blob
 */
export const saveBackup = async (orgId: string, blob: Blob): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const dateKey = getTodayDateKey();
    const timestamp = Date.now();
    const id = `${orgId}_${dateKey}`; // Composite key

    const snapshot: BackupSnapshot = {
      id,
      orgId,
      dateKey,
      timestamp,
      blob,
      size: blob.size,
    };

    // Save backup
    await new Promise<void>((resolve, reject) => {
      const request = store.put(snapshot);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to save backup'));
    });

    db.close();
  } catch (error) {
    console.error('Error saving backup to IndexedDB:', error);
    throw error;
  }
};

/**
 * Get all backups for an organization
 * @param orgId - Organization ID
 * @returns Array of backup snapshots (sorted by date, newest first)
 */
export const getBackups = async (orgId: string): Promise<BackupSnapshot[]> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('orgId');

    return new Promise<BackupSnapshot[]>((resolve, reject) => {
      const request = index.getAll(orgId);
      request.onsuccess = () => {
        const backups: BackupSnapshot[] = request.result;
        // Sort by timestamp (newest first)
        backups.sort((a, b) => b.timestamp - a.timestamp);
        resolve(backups);
      };
      request.onerror = () => {
        reject(new Error('Failed to retrieve backups'));
      };
    });
  } catch (error) {
    console.error('Error retrieving backups from IndexedDB:', error);
    return [];
  }
};

/**
 * Delete a specific backup by ID
 * @param id - Backup ID (composite key: `${orgId}_${dateKey}`)
 */
export const deleteBackup = async (id: string): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete backup'));
    });

    db.close();
  } catch (error) {
    console.error('Error deleting backup from IndexedDB:', error);
    throw error;
  }
};

/**
 * Check if a backup is needed for today
 * @param orgId - Organization ID
 * @returns true if backup is needed (no backup exists for today), false otherwise
 */
export const isBackupNeeded = async (orgId: string): Promise<boolean> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    const dateKey = getTodayDateKey();
    const id = `${orgId}_${dateKey}`;

    return new Promise<boolean>((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => {
        // If backup exists for today, it's not needed
        resolve(!request.result);
      };
      request.onerror = () => {
        reject(new Error('Failed to check backup status'));
      };
    });
  } catch (error) {
    console.error('Error checking if backup is needed:', error);
    // On error, assume backup is needed
    return true;
  }
};
