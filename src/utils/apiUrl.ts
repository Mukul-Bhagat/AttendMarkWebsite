import { appLogger } from '../shared/logger';

/**
 * Get the API base URL from environment variables.
 * Falls back to empty string for Vite proxy in development.
 */
const PROD_API_URL = 'https://attend-mark.onrender.com';

const normalizeEnvApiUrl = (rawValue: string): string => {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return '';
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$/, '');
  }

  return `https://${trimmed.replace(/\/+$/, '')}`;
};

export const getApiUrl = (): string => {
  const envUrl = normalizeEnvApiUrl(import.meta.env.VITE_API_URL || '');

  if (import.meta.env.PROD) {
    if (
      !envUrl ||
      envUrl.includes('localhost') ||
      envUrl.includes('127.0.0.1')
    ) {
      appLogger.warn(
        'PROD detected but VITE_API_URL is missing or localhost. Falling back to production URL.',
      );
      return PROD_API_URL;
    }
  }

  return envUrl;
};

export const getApiEndpoint = (endpoint: string): string => {
  const baseUrl = getApiUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return baseUrl ? `${baseUrl}${cleanEndpoint}` : cleanEndpoint;
};
