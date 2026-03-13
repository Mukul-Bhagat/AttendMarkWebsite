import { v4 as uuidv4 } from 'uuid';
import { safeLocalStorage } from './safeStorage';

const DEVICE_ID_KEY = 'app_device_id';

// This function gets the device ID from storage (with in-memory fallback).
// If it doesn't exist, it creates one and saves it.
export const getOrCreateDeviceId = (): string => {
  let deviceId = safeLocalStorage.getItem(DEVICE_ID_KEY);
  
  if (!deviceId) {
    deviceId = uuidv4();
    safeLocalStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  
  return deviceId;
};

