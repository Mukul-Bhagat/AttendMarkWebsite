export interface NotificationRouteInput {
  deepLink?: {
    web?: string;
    mobile?: string;
  };
  data?: Record<string, unknown>;
}

export const normalizeRouteFromDeepLink = (
  deepLink?: string | null,
): string | null => {
  if (!deepLink) return null;

  try {
    const parsed = deepLink.startsWith('http')
      ? new URL(deepLink)
      : new URL(deepLink, window.location.origin);

    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return deepLink.startsWith('/') ? deepLink : null;
  }
};

export const resolveNotificationRoute = (
  notification: NotificationRouteInput,
): string | null => {
  const fromDeepLink = normalizeRouteFromDeepLink(notification.deepLink?.web);
  if (fromDeepLink) return fromDeepLink;

  const dataLink = typeof notification.data?.deepLinkWeb === 'string'
    ? notification.data.deepLinkWeb
    : null;

  return normalizeRouteFromDeepLink(dataLink);
};

