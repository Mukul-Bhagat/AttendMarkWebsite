import { v4 as uuidv4 } from 'uuid';

const DEVICE_ID_KEY = 'app_device_id';

// This function gets the device ID from localStorage.
// If it doesn't exist, it creates one and saves it.
export const getOrCreateDeviceId = (): string => {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  
  if (!deviceId) {
    deviceId = uuidv4();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  
  return deviceId;
};

