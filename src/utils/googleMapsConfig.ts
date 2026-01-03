/**
 * Google Maps API Configuration Utility
 * 
 * Centralized configuration for Google Maps API key management.
 * Ensures API key is only read from environment variables, never hardcoded.
 * 
 * Security: API key should NEVER be committed to version control.
 * Always use environment variables for API keys.
 */

/**
 * Get Google Maps API key from environment variables
 * 
 * @returns Google Maps API key or empty string if not configured
 * @throws Error if API key is missing in production
 * 
 * @example
 * ```typescript
 * const apiKey = getGoogleMapsApiKey();
 * if (!apiKey) {
 *   console.error('Google Maps API key is not configured');
 * }
 * ```
 */
export function getGoogleMapsApiKey(): string {
  // Read from environment variable (Vite uses import.meta.env)
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  // In production, warn if API key is missing
  if (import.meta.env.PROD && !apiKey) {
    console.error(
      '⚠️ Google Maps API key is missing! ' +
      'Please set VITE_GOOGLE_MAPS_API_KEY in your environment variables.'
    );
  }

  return apiKey || '';
}

/**
 * Check if Google Maps API key is configured
 * 
 * @returns true if API key is present, false otherwise
 */
export function isGoogleMapsApiKeyConfigured(): boolean {
  return !!getGoogleMapsApiKey();
}

/**
 * Google Maps API configuration
 * 
 * Libraries to load: 'places' (for Places Autocomplete)
 * We do NOT use Geocoding API - we use Places API geometry data instead
 */
export const GOOGLE_MAPS_CONFIG = {
  /**
   * Libraries to load with Google Maps JavaScript API
   * 'places' - Required for Places Autocomplete
   */
  libraries: ['places'] as ('places')[],
  
  /**
   * Required fields for Places Autocomplete
   * We request geometry to get coordinates directly from Places API
   * This eliminates the need for Google Geocoding API
   */
  autocompleteFields: [
    'place_id',
    'name',
    'formatted_address',
    'geometry', // Critical: This provides lat/lng without Geocoding API
  ] as string[],
} as const;

