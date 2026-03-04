import { describe, expect, it } from 'vitest';

import {
  normalizeRouteFromDeepLink,
  resolveNotificationRoute,
} from '../notificationDeepLink';

describe('notificationDeepLink', () => {
  it('normalizes absolute links into app route + query', () => {
    const route = normalizeRouteFromDeepLink('https://example.com/leaves?id=1');
    expect(route).toBe('/leaves?id=1');
  });

  it('resolves route from deepLink.web first', () => {
    const route = resolveNotificationRoute({
      deepLink: {
        web: '/sessions/abc?tab=details',
      },
      data: {
        deepLinkWeb: '/dashboard',
      },
    });

    expect(route).toBe('/sessions/abc?tab=details');
  });

  it('falls back to payload deepLinkWeb metadata', () => {
    const route = resolveNotificationRoute({
      data: {
        deepLinkWeb: '/my-attendance',
      },
    });

    expect(route).toBe('/my-attendance');
  });
});

