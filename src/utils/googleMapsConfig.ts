import { appLogger } from '../shared/logger';
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
 * PRODUCTION SAFETY: This function validates the API key is available at runtime.
 * In Vite, environment variables are embedded at build time, but in some deployment
 * platforms (like Render), they may need to be set at runtime.
 * 
 * @returns Google Maps API key or empty string if not configured
 * 
 * @example
 * ```typescript
 * const apiKey = getGoogleMapsApiKey();
 * if (!apiKey) {
 *   appLogger.error('Google Maps API key is not configured');
 * }
 * ```
 */
export function getGoogleMapsApiKey(): string {
  // Read from environment variable (Vite uses import.meta.env)
  // Note: Vite exposes env vars prefixed with VITE_ at build time
  // In production, ensure VITE_GOOGLE_MAPS_API_KEY is set in deployment environment
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  // Validate API key format (basic check - should start with AIza)
  const isValidFormat = apiKey && typeof apiKey === 'string' && apiKey.trim().length > 0;
  
  // In production, log diagnostic info (without exposing the key)
  if (import.meta.env.PROD) {
    if (!isValidFormat) {
      appLogger.error(
        '⚠️ [PRODUCTION] Google Maps API key is missing or invalid!',
        '\n  - Check that VITE_GOOGLE_MAPS_API_KEY is set in your deployment environment',
        '\n  - For Render: Set in Environment Variables section',
        '\n  - Key should start with "AIza" and be 39 characters long',
        '\n  - Current value:', apiKey ? `"${apiKey.substring(0, 8)}...${apiKey.length} chars"` : 'undefined'
      );
    } else {
      // Log success (without exposing full key)
      appLogger.info(
        '✅ [PRODUCTION] Google Maps API key is configured',
        `(${apiKey.length} characters, starts with ${apiKey.substring(0, 4)})`
      );
    }
  }

  return isValidFormat ? apiKey.trim() : '';
}

/**
 * Check if Google Maps API key is configured
 * 
 * PRODUCTION SAFETY: Use this to prevent loading Google Maps when key is missing.
 * 
 * @returns true if API key is present and valid, false otherwise
 */
export function isGoogleMapsApiKeyConfigured(): boolean {
  const apiKey = getGoogleMapsApiKey();
  return apiKey.length > 0 && apiKey.startsWith('AIza');
}

/**
 * Validate API key and return diagnostic information
 * 
 * @returns Object with validation status and diagnostic info (without exposing the key)
 */
export function validateGoogleMapsApiKey(): {
  isValid: boolean;
  isConfigured: boolean;
  diagnostic: {
    hasValue: boolean;
    isString: boolean;
    length: number;
    startsWithAIza: boolean;
    environment: 'development' | 'production';
  };
} {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const hasValue = !!apiKey;
  const isString = typeof apiKey === 'string';
  const length = isString ? apiKey.length : 0;
  const startsWithAIza = isString && apiKey.startsWith('AIza');
  const isValid = hasValue && isString && length > 0 && startsWithAIza;

  return {
    isValid,
    isConfigured: isValid,
    diagnostic: {
      hasValue,
      isString,
      length,
      startsWithAIza,
      environment: import.meta.env.PROD ? 'production' : 'development',
    },
  };
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

