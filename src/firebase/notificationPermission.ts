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

const getServiceWorkerRegistrationUrl = (): string => {
  const params = new URLSearchParams({
    apiKey: firebaseWebConfig.apiKey || '',
    authDomain: firebaseWebConfig.authDomain || '',
    projectId: firebaseWebConfig.projectId || '',
    messagingSenderId: firebaseWebConfig.messagingSenderId || '',
    appId: firebaseWebConfig.appId || '',
  });

  return `/firebase-messaging-sw.js?${params.toString()}`;
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
      .register(getServiceWorkerRegistrationUrl())
      .then(async (registration) => {
        // Compatibility fallback for existing active workers.
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
    console.log('[Notifications] Notification permission result: granted');
    return 'granted';
  }

  const permission = await Notification.requestPermission();
  console.log('[Notifications] Notification permission result:', permission);
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
    console.warn('[Notifications] Permission not granted. Push registration skipped.');
    return null;
  }

  const messaging = await getMessagingInstance();
  if (!messaging) {
    console.warn('[Notifications] Messaging instance unavailable. Push registration skipped.');
    return null;
  }

  const registration = await bootstrapNotificationServiceWorker();
  if (!registration) {
    console.warn('[Notifications] Service worker registration unavailable.');
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
    console.warn('[Notifications] Firebase token generation returned empty token.');
    return null;
  }

  console.log('[Notifications] FCM token generated:', token);

  const storedToken = getStoredToken();
  if (storedToken === token) {
    return token;
  }

  try {
    await api.post('/api/notifications/devices/register', {
      fcmToken: token,
      platform: 'web',
      deviceId: getOrCreateDeviceId(),
      appVersion: import.meta.env.VITE_APP_VERSION || 'web',
    });

    console.log('[Notifications] FCM token registered with backend.');
  } catch (error) {
    console.error('[Notifications] Failed to register FCM token with backend.', error);
    throw error;
  }

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
