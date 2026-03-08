import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { getMessaging, isSupported, Messaging } from 'firebase/messaging';

import { appLogger } from '../shared/logger';

export const firebaseWebConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isConfiguredFirebaseValue = (value: string | undefined): boolean => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return false;
  }

  const lowered = normalized.toLowerCase();
  return !(
    lowered === '...' ||
    lowered.endsWith('...') ||
    lowered.includes('placeholder') ||
    lowered.includes('changeme') ||
    lowered.includes('your_')
  );
};

export const firebaseWebConfigIssues = Object.entries(firebaseWebConfig)
  .filter(([, value]) => !isConfiguredFirebaseValue(value))
  .map(([key]) => key);

export const hasFirebaseMessagingConfig = [
  firebaseWebConfig.apiKey,
  firebaseWebConfig.authDomain,
  firebaseWebConfig.projectId,
  firebaseWebConfig.messagingSenderId,
  firebaseWebConfig.appId,
].every((value) => isConfiguredFirebaseValue(value));

let appInstance: FirebaseApp | null = null;
let messagingPromise: Promise<Messaging | null> | null = null;

export const getFirebaseApp = (): FirebaseApp | null => {
  if (!hasFirebaseMessagingConfig) {
    return null;
  }

  if (appInstance) {
    return appInstance;
  }

  appInstance = getApps().length > 0 ? getApp() : initializeApp(firebaseWebConfig);
  return appInstance;
};

export const getMessagingInstance = async (): Promise<Messaging | null> => {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!hasFirebaseMessagingConfig) {
    appLogger.warn(
      `Firebase messaging env config is incomplete or uses placeholders. Invalid keys: ${firebaseWebConfigIssues.join(
        ', ',
      ) || 'unknown'}. Push registration skipped.`,
    );
    return null;
  }

  if (!messagingPromise) {
    messagingPromise = isSupported()
      .then((supported) => {
        if (!supported) {
          appLogger.warn('Firebase messaging is not supported in this browser.');
          return null;
        }

        const app = getFirebaseApp();
        if (!app) {
          return null;
        }

        return getMessaging(app);
      })
      .catch((error) => {
        appLogger.error('Failed to initialize firebase messaging', error);
        return null;
      });
  }

  return messagingPromise;
};
