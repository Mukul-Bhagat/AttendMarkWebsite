/**
 * Get the API base URL from environment variables
 * Falls back to empty string for Vite proxy in development
 * 
 * @returns API base URL (e.g., 'https://api.example.com' or '')
 */
export const getApiUrl = (): string => {
  return import.meta.env.VITE_API_URL || '';
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

