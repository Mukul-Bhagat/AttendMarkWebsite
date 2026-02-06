/**
 * Get the API base URL from environment variables
 * Falls back to empty string for Vite proxy in development
 * 
 * @returns API base URL (e.g., 'https://api.example.com' or '')
 */
// Hardcoded production URL as a safety fallback
const PROD_API_URL = 'https://attend-mark.onrender.com';

export const getApiUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL || '';

  // SAFETY CHECK: If we are in production build, but the API URL is either missing
  // or pointing to localhost (misconfiguration), force use of the production URL.
  if (import.meta.env.PROD) {
    if (!envUrl || envUrl.includes('localhost') || envUrl.includes('127.0.0.1')) {
      console.warn('⚠️ PROD detected but VITE_API_URL is missing or localhost. Falling back to production URL.');
      return PROD_API_URL;
    }
  }

  return envUrl;
};

/**
 * Get the full API URL for a given endpoint
 * 
 * @param endpoint - API endpoint (e.g., '/api/auth/login')
 * @returns Full API URL
 */
export const getApiEndpoint = (endpoint: string): string => {
  const baseUrl = getApiUrl();
  // Remove leading slash from endpoint if baseUrl already ends with one
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return baseUrl ? `${baseUrl}${cleanEndpoint}` : cleanEndpoint;
};

