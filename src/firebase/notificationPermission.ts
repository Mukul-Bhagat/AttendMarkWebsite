import { getToken } from 'firebase/messaging';

import api from '../api';
import { appLogger } from '../shared/logger';
import {
  firebaseWebConfig,
  getMessagingInstance,
  hasFirebaseMessagingConfig,
} from './firebase';

const FCM_TOKEN_STORAGE_KEY = 'notification_web_fcm_token';
const DEVICE_ID_STORAGE_KEY = 'notification_web_device_id';

const getOrCreateDeviceId = (): string => {
  const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const generated =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  localStorage.setItem(DEVICE_ID_STORAGE_KEY, generated);
  return generated;
};

const postFirebaseConfigToServiceWorker = async (
  registration: ServiceWorkerRegistration,
): Promise<void> => {
  if (!navigator.serviceWorker) {
    return;
  }

  const readyRegistration = await navigator.serviceWorker.ready;
  const target = registration.active || readyRegistration.active;
  target?.postMessage({
    type: 'FIREBASE_CONFIG',
    config: firebaseWebConfig,
  });
};

let workerRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export const bootstrapNotificationServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  if (!hasFirebaseMessagingConfig) {
    return null;
  }

  if (!workerRegistrationPromise) {
    workerRegistrationPromise = navigator.serviceWorker
      .register('/firebase-messaging-sw.js')
      .then(async (registration) => {
        await postFirebaseConfigToServiceWorker(registration);
        return registration;
      })
      .catch((error) => {
        appLogger.error('Failed to register firebase messaging service worker', error);
        return null;
      });
  }

  return workerRegistrationPromise;
};

export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  const permission = await Notification.requestPermission();
  return permission;
};

const getStoredToken = (): string | null => {
  return localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
};

const storeToken = (token: string): void => {
  localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);
};

const clearStoredToken = (): void => {
  localStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
};

export const registerWebPushDevice = async (): Promise<string | null> => {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!hasFirebaseMessagingConfig) {
    return null;
  }

  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    return null;
  }

  const messaging = await getMessagingInstance();
  if (!messaging) {
    return null;
  }

  const registration = await bootstrapNotificationServiceWorker();
  if (!registration) {
    return null;
  }

  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    appLogger.warn('Missing VITE_FIREBASE_VAPID_KEY. Push registration skipped.');
    return null;
  }

  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration,
  });

  if (!token) {
    return null;
  }

  const storedToken = getStoredToken();
  if (storedToken === token) {
    return token;
  }

  await api.post('/api/notifications/devices/register', {
    fcmToken: token,
    platform: 'web',
    deviceId: getOrCreateDeviceId(),
    appVersion: import.meta.env.VITE_APP_VERSION || 'web',
  });

  storeToken(token);
  return token;
};

export const deactivateWebPushDevice = async (): Promise<void> => {
  const storedToken = getStoredToken();
  if (!storedToken) {
    return;
  }

  try {
    await api.post('/api/notifications/devices/deactivate', {
      fcmToken: storedToken,
    });
  } catch (error) {
    appLogger.warn('Failed to deactivate web push token', error);
  } finally {
    clearStoredToken();
  }
};
