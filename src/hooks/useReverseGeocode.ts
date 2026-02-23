import { useState, useCallback } from 'react';
import { reverseGeocode, ReverseGeocodeResult, ReverseGeocodeOptions } from '../utils/reverseGeocode';

import { appLogger } from '../shared/logger';
interface UseReverseGeocodeReturn {
  /**
   * Reverse geocode coordinates to address
   */
  geocode: (latitude: number, longitude: number) => Promise<void>;
  /**
   * Current address result
   */
  result: ReverseGeocodeResult | null;
  /**
   * Loading state
   */
  isLoading: boolean;
  /**
   * Error message if geocoding failed
   */
  error: string | null;
  /**
   * Reset the hook state
   */
  reset: () => void;
}

/**
 * React hook for reverse geocoding coordinates to addresses
 * 
 * @param options - Optional configuration for reverse geocoding
 * @returns Object with geocode function, result, loading state, and error
 * 
 * @example
 * ```tsx
 * const { geocode, result, isLoading, error } = useReverseGeocode();
 * 
 * const handleGetAddress = async () => {
 *   await geocode(19.9975, 73.7898);
 * };
 * 
 * return (
 *   <div>
 *     <button onClick={handleGetAddress} disabled={isLoading}>
 *       Get Address
 *     </button>
 *     {result && <p>{result.address}</p>}
 *     {error && <p>Error: {error}</p>}
 *   </div>
 * );
 * ```
 */
export function useReverseGeocode(
  options?: ReverseGeocodeOptions
): UseReverseGeocodeReturn {
  const [result, setResult] = useState<ReverseGeocodeResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const geocode = useCallback(
    async (latitude: number, longitude: number) => {
      setIsLoading(true);
      setError(null);
      setResult(null);

      try {
        const geocodeResult = await reverseGeocode(latitude, longitude, options);
        setResult(geocodeResult);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to reverse geocode coordinates';
        setError(errorMessage);
        appLogger.error('Reverse geocoding error:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [options]
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    geocode,
    result,
    isLoading,
    error,
    reset,
  };
}

