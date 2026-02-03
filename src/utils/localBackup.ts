/**
 * IndexedDB utility for storing daily backups locally
 * Uses idb library for cleaner IndexedDB API
 * Database: AttendMarkBackups
 * Store: daily_backups
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { nowIST, toISTDateString } from './time';

interface BackupData {
  date: string; // Format: YYYY-MM-DD
  data: object; // The backup JSON data
  timestamp: number;
}

interface BackupDB extends DBSchema {
  daily_backups: {
    key: string; // date (YYYY-MM-DD)
    value: BackupData;
    indexes: { 'by-timestamp': number };
  };
}

const DB_NAME = 'AttendMarkBackups';
const DB_VERSION = 1;
const STORE_NAME = 'daily_backups';

let dbInstance: IDBPDatabase<BackupDB> | null = null;

/**
 * Open database connection
 */
const getDB = async (): Promise<IDBPDatabase<BackupDB>> => {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<BackupDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'date' });
        store.createIndex('by-timestamp', 'timestamp');
      }
    },
  });

  return dbInstance;
};

/**
 * Get today's date in YYYY-MM-DD format
 */
const getTodayDate = (): string => {
  return toISTDateString(nowIST());
};

/**
 * Save a backup to IndexedDB
 * @param date - Date string in YYYY-MM-DD format (defaults to today)
 * @param data - The backup JSON data object
 */
export const saveBackup = async (date: string = getTodayDate(), data: object): Promise<void> => {
  try {
    const db = await getDB();
    const backupData: BackupData = {
      date,
      data,
      timestamp: nowIST(),
    };

    await db.put(STORE_NAME, backupData);
    console.log(`[LocalBackup] Backup saved for date: ${date}`);
  } catch (error) {
    console.error('[LocalBackup] Error saving backup:', error);
    throw error;
  }
};

/**
 * Get a backup by date
 * @param date - Date string in YYYY-MM-DD format
 * @returns Backup data or null if not found
 */
export const getBackup = async (date: string): Promise<BackupData | null> => {
  try {
    const db = await getDB();
    const backup = await db.get(STORE_NAME, date);
    return backup || null;
  } catch (error) {
    console.error('[LocalBackup] Error getting backup:', error);
    return null;
  }
};

/**
 * Get the last backup date
 * @returns Date string (YYYY-MM-DD) or null if no backup exists
 */
export const getLastBackupDate = async (): Promise<string | null> => {
  try {
    const db = await getDB();
    const index = db.transaction(STORE_NAME).store.index('by-timestamp');
    
    // Get the last backup (highest timestamp)
    const cursor = await index.openCursor(null, 'prev');
    
    if (cursor) {
      return cursor.value.date;
    }
    
    return null;
  } catch (error) {
    console.error('[LocalBackup] Error getting last backup date:', error);
    return null;
  }
};

