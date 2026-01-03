/**
 * Attendance Validation Service
 * 
 * Production-grade attendance validation service with strict security rules.
 * 
 * Validation Rules (MANDATORY):
 * 1. User must be inside allowed radius
 * 2. Location accuracy must be ≤ 30-50 meters (configurable, default: 30m)
 * 3. Attendance allowed only within session time window (if provided)
 * 
 * Note: One attendance per user per session is enforced by backend, not frontend.
 * 
 * All validation uses FREE browser APIs - no Google API costs.
 */

import {
  validateAttendance,
  getUserLocation,
  calculateDistance,
  SessionLocation,
  LocationValidationResult,
  GeolocationOptions,
} from '../utils/locationValidation';

export interface AttendanceValidationOptions {
  /**
   * Maximum allowed GPS accuracy in meters
   * Default: 30 meters (stricter for production)
   */
  maxAccuracy?: number | null;
  /**
   * Geolocation options
   */
  geolocationOptions?: GeolocationOptions;
  /**
   * Current time for time window validation
   * Default: Date.now()
   */
  currentTime?: number;
}

export interface ValidationError {
  code: string;
  message: string;
  details?: {
    distance?: number;
    accuracy?: number;
    allowedRadius?: number;
    maxAccuracy?: number;
  };
}

/**
 * Validate attendance with enhanced security checks
 * 
 * This is the main validation function that enforces all security rules:
 * - GPS accuracy check (≤ 30m default)
 * - Distance check (within radius)
 * - Time window check (if provided)
 * 
 * @param sessionLocation - Session location with coordinates, radius, and optional time window
 * @param options - Validation options
 * @returns Validation result with detailed status
 * @throws ValidationError with code and message for programmatic handling
 */
export async function validateAttendanceWithSecurity(
  sessionLocation: SessionLocation,
  options: AttendanceValidationOptions = {}
): Promise<LocationValidationResult> {
  try {
    const result = await validateAttendance(sessionLocation, {
      maxAccuracy: options.maxAccuracy ?? 30, // Stricter default: 30m
      geolocationOptions: options.geolocationOptions,
      currentTime: options.currentTime,
    });

    return result;
  } catch (error) {
    // Convert to structured error for better handling
    const validationError: ValidationError = {
      code: (error as Error & { code?: string }).code || 'VALIDATION_ERROR',
      message: error instanceof Error ? error.message : 'Unknown validation error',
    };

    // Add details based on error type
    if (error instanceof Error) {
      if (error.message.includes('accuracy')) {
        validationError.details = {
          accuracy: extractNumber(error.message),
          maxAccuracy: options.maxAccuracy ?? 30,
        };
      } else if (error.message.includes('outside') || error.message.includes('Distance')) {
        validationError.details = {
          distance: extractNumber(error.message),
          allowedRadius: sessionLocation.radius,
        };
      }
    }

    throw validationError;
  }
}

/**
 * Extract number from error message (helper function)
 */
function extractNumber(message: string): number | undefined {
  const match = message.match(/(\d+(?:\.\d+)?)\s*m/);
  return match ? parseFloat(match[1]) : undefined;
}

/**
 * Get user-friendly error message from validation error
 * 
 * @param error - Validation error
 * @returns User-friendly error message
 */
export function getValidationErrorMessage(error: ValidationError | Error): string {
  if (error instanceof Error && !('code' in error)) {
    return error.message;
  }

  const validationError = error as ValidationError;

  switch (validationError.code) {
    case 'PERMISSION_DENIED':
      return 'Location permission denied. Please enable location access in your browser settings.';
    
    case 'POSITION_UNAVAILABLE':
      return 'GPS location unavailable. Please ensure GPS is enabled on your device.';
    
    case 'TIMEOUT':
      return 'Location request timed out. Please ensure you have a clear view of the sky and try again.';
    
    case 'VALIDATION_ERROR':
    default:
      return validationError.message || 'Validation failed. Please try again.';
  }
}

/**
 * Check if error is a recoverable error (user can retry)
 */
export function isRecoverableError(error: ValidationError | Error): boolean {
  if (error instanceof Error && !('code' in error)) {
    return true; // Assume recoverable if not structured error
  }

  const validationError = error as ValidationError;
  const recoverableCodes = ['TIMEOUT', 'POSITION_UNAVAILABLE'];
  return recoverableCodes.includes(validationError.code);
}

/**
 * Check if error requires user action (permission, settings, etc.)
 */
export function requiresUserAction(error: ValidationError | Error): boolean {
  if (error instanceof Error && !('code' in error)) {
    return error.message.includes('permission') || error.message.includes('enable');
  }

  const validationError = error as ValidationError;
  return validationError.code === 'PERMISSION_DENIED';
}

// Re-export utilities for convenience
export {
  getUserLocation,
  calculateDistance,
  type SessionLocation,
  type LocationValidationResult,
  type GeolocationOptions,
};

