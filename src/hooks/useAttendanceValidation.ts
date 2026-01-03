/**
 * React Hook for Attendance Validation
 * 
 * Provides a convenient React hook for validating attendance using
 * browser Geolocation API and Haversine distance calculation.
 * 
 * All operations are FREE - no Google APIs or paid services used.
 */

import { useState, useCallback } from 'react';
import {
  validateAttendance,
  getUserLocation,
  calculateDistance,
  SessionLocation,
  LocationValidationResult,
  GeolocationOptions,
} from '../utils/locationValidation';

interface UseAttendanceValidationOptions {
  /**
   * Maximum allowed GPS accuracy in meters
   * Default: 30 meters (stricter for better accuracy)
   * Set to null to disable accuracy check (not recommended)
   */
  maxAccuracy?: number | null;
  /**
   * Geolocation options
   */
  geolocationOptions?: GeolocationOptions;
}

interface UseAttendanceValidationReturn {
  /**
   * Validate attendance for a session
   */
  validate: (sessionLocation: SessionLocation) => Promise<LocationValidationResult>;
  /**
   * Get user's current location only
   */
  getLocation: () => Promise<GeolocationPosition>;
  /**
   * Calculate distance between two coordinates
   */
  getDistance: (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) => number;
  /**
   * Current validation result
   */
  result: LocationValidationResult | null;
  /**
   * Loading state
   */
  isLoading: boolean;
  /**
   * Error message if validation failed
   */
  error: string | null;
  /**
   * Reset validation state
   */
  reset: () => void;
}

/**
 * React hook for attendance validation
 * 
 * @param options - Validation options
 * @returns Object with validation functions and state
 * 
 * @example
 * ```tsx
 * const { validate, result, isLoading, error } = useAttendanceValidation();
 * 
 * const handleMarkAttendance = async () => {
 *   try {
 *     const result = await validate({
 *       latitude: 19.9975,
 *       longitude: 73.7898,
 *       radius: 100
 *     });
 *     
 *     if (result.isWithinRadius) {
 *       // Mark attendance
 *     } else {
 *       // Show error: outside radius
 *     }
 *   } catch (err) {
 *     // Handle error
 *   }
 * };
 * ```
 */
export function useAttendanceValidation(
  options: UseAttendanceValidationOptions = {}
): UseAttendanceValidationReturn {
  const [result, setResult] = useState<LocationValidationResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const validate = useCallback(
    async (sessionLocation: SessionLocation) => {
      setIsLoading(true);
      setError(null);
      setResult(null);

      try {
        const validationResult = await validateAttendance(sessionLocation, {
          maxAccuracy: options.maxAccuracy,
          geolocationOptions: options.geolocationOptions,
        });

        setResult(validationResult);
        return validationResult;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to validate attendance';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [options.maxAccuracy, options.geolocationOptions]
  );

  const getLocation = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const position = await getUserLocation(options.geolocationOptions);
      return position;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get location';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [options.geolocationOptions]);

  const getDistance = useCallback(
    (lat1: number, lon1: number, lat2: number, lon2: number) => {
      return calculateDistance(lat1, lon1, lat2, lon2);
    },
    []
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    validate,
    getLocation,
    getDistance,
    result,
    isLoading,
    error,
    reset,
  };
}

