import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockApiPost, mockGetMessagingInstance, mockGetToken } = vi.hoisted(() => ({
  mockApiPost: vi.fn(),
  mockGetMessagingInstance: vi.fn(),
  mockGetToken: vi.fn(),
}));

vi.mock('../../api', () => ({
  default: {
    post: mockApiPost,
  },
}));

vi.mock('../firebase', () => ({
  firebaseWebConfig: {
    apiKey: 'api-key',
    authDomain: 'auth-domain',
    projectId: 'project-id',
    messagingSenderId: 'sender-id',
    appId: 'app-id',
  },
  hasFirebaseMessagingConfig: true,
  getMessagingInstance: mockGetMessagingInstance,
}));

vi.mock('firebase/messaging', () => ({
  getToken: mockGetToken,
}));

import {
  deactivateWebPushDevice,
  registerWebPushDevice,
} from '../notificationPermission';

const setupServiceWorker = () => {
  const activeWorker = {
    postMessage: vi.fn(),
  } as unknown as ServiceWorker;

  const register = vi.fn();
  const registration = {
    active: activeWorker,
  } as ServiceWorkerRegistration;

  register.mockResolvedValue(registration);

  Object.defineProperty(window.navigator, 'serviceWorker', {
    configurable: true,
    value: {
      register,
      ready: Promise.resolve(registration),
    },
  });

  return { registration, activeWorker, register };
};

describe('notificationPermission', () => {
  let registerSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_FIREBASE_VAPID_KEY', 'test-vapid-key');
    localStorage.clear();

    const setup = setupServiceWorker();
    registerSpy = setup.register;

    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: {
        permission: 'granted',
        requestPermission: vi.fn().mockResolvedValue('granted'),
      },
    });

    mockGetMessagingInstance.mockResolvedValue({});
    mockGetToken.mockResolvedValue('token-123');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('registers web device token via backend API', async () => {
    const token = await registerWebPushDevice();

    expect(token).toBe('token-123');
    expect(registerSpy).toHaveBeenCalledWith(
      expect.stringContaining('/firebase-messaging-sw.js?'),
    );
    expect(mockApiPost).toHaveBeenCalledWith(
      '/api/notifications/devices/register',
      expect.objectContaining({
        fcmToken: 'token-123',
        platform: 'web',
      }),
    );
    expect(localStorage.getItem('notification_web_fcm_token')).toBe('token-123');
  });

  it('deactivates stored token and clears local cache', async () => {
    localStorage.setItem('notification_web_fcm_token', 'token-xyz');

    await deactivateWebPushDevice();

    expect(mockApiPost).toHaveBeenCalledWith('/api/notifications/devices/deactivate', {
      fcmToken: 'token-xyz',
    });
    expect(localStorage.getItem('notification_web_fcm_token')).toBeNull();
  });
});
