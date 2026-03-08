importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

let messaging = null;

const parseConfigFromQuery = () => {
  try {
    const url = new URL(self.location.href);

    return {
      apiKey: url.searchParams.get('apiKey') || '',
      authDomain: url.searchParams.get('authDomain') || '',
      projectId: url.searchParams.get('projectId') || '',
      messagingSenderId: url.searchParams.get('messagingSenderId') || '',
      appId: url.searchParams.get('appId') || '',
    };
  } catch {
    return null;
  }
};

const initializeMessaging = (config) => {
  if (messaging || !config || !config.apiKey) {
    return;
  }

  firebase.initializeApp(config);
  messaging = firebase.messaging();

  messaging.onBackgroundMessage(function (payload) {
    const notification = payload.notification || {};
    const title = notification.title || payload.data?.title || 'New notification';
    const body = notification.body || payload.data?.body || '';
    const icon = payload.data?.icon || '/assets/favicon.png';
    const deepLink = payload.data?.deepLinkWeb || '/dashboard';

    self.registration.showNotification(title, {
      body,
      icon,
      data: {
        deepLink,
      },
    });
  });
};

// Deterministic initialization from registration URL query params.
const bootstrapConfig = parseConfigFromQuery();
initializeMessaging(bootstrapConfig);

// Compatibility fallback for older clients using postMessage config.
self.addEventListener('message', (event) => {
  if (event?.data?.type === 'FIREBASE_CONFIG' && event?.data?.config) {
    initializeMessaging(event.data.config);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const deepLink = event.notification?.data?.deepLink || '/dashboard';
  const targetUrl = new URL(deepLink, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }

      return null;
    }),
  );
});
