/**
 * Example Component: Attendance Validation
 * 
 * This component demonstrates how to use the FREE attendance validation system:
 * 1. Browser Geolocation API (FREE)
 * 2. Haversine distance calculation (FREE)
 * 3. Radius validation (FREE)
 * 
 * No Google APIs required for validation - completely free!
 */

import React, { useState } from 'react';
import { useAttendanceValidation } from '../hooks/useAttendanceValidation';
import { formatDistance } from '../utils/locationValidation';
import { CheckCircle2, XCircle, Loader2, MapPin, AlertCircle } from 'lucide-react';

interface AttendanceValidationExampleProps {
  /**
   * Session location data
   */
  sessionLocation: {
    latitude: number;
    longitude: number;
    radius: number; // in meters
  };
  /**
   * Callback when validation succeeds
   */
  onValidationSuccess?: (result: {
    isWithinRadius: boolean;
    distance: number;
    accuracy: number;
    userLocation: { latitude: number; longitude: number };
  }) => void;
  /**
   * Callback when validation fails
   */
  onValidationError?: (error: string) => void;
}

const AttendanceValidationExample: React.FC<AttendanceValidationExampleProps> = ({
  sessionLocation,
  onValidationSuccess,
  onValidationError,
}) => {
  const { validate, result, isLoading, error, reset } = useAttendanceValidation({
    maxAccuracy: 50, // Require GPS accuracy within 50 meters
  });

  const [hasValidated, setHasValidated] = useState(false);

  const handleValidate = async () => {
    try {
      setHasValidated(false);
      const validationResult = await validate(sessionLocation);
      setHasValidated(true);

      if (onValidationSuccess) {
        onValidationSuccess(validationResult);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Validation failed';
      if (onValidationError) {
        onValidationError(errorMessage);
      }
    }
  };

  const handleReset = () => {
    reset();
    setHasValidated(false);
  };

  return (
    <div className="space-y-4">
      {/* Session Location Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
          Session Location
        </h3>
        <div className="space-y-1 text-sm">
          <p>
            <span className="text-blue-700 dark:text-blue-300">Lat:</span>{' '}
            <span className="font-mono">{sessionLocation.latitude.toFixed(6)}</span>
          </p>
          <p>
            <span className="text-blue-700 dark:text-blue-300">Lng:</span>{' '}
            <span className="font-mono">{sessionLocation.longitude.toFixed(6)}</span>
          </p>
          <p>
            <span className="text-blue-700 dark:text-blue-300">Radius:</span>{' '}
            <span className="font-semibold">{sessionLocation.radius} meters</span>
          </p>
        </div>
      </div>

      {/* Validation Button */}
      <button
        onClick={handleValidate}
        disabled={isLoading}
        className="w-full px-4 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-[#d63a25] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Validating Location...</span>
          </>
        ) : (
          <>
            <MapPin className="w-5 h-5" />
            <span>Validate Attendance Location</span>
          </>
        )}
      </button>

      {/* Loading State */}
      {isLoading && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
            <Loader2 className="w-5 h-5 animate-spin" />
            <p className="text-sm">
              Getting your GPS location... Please ensure location access is enabled.
            </p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">
                Validation Failed
              </p>
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Success State - Within Radius */}
      {result && result.isWithinRadius && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-800 dark:text-green-300 mb-2">
                ✅ Within Attendance Area
              </p>

              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-green-700 dark:text-green-300">Distance:</span>{' '}
                  <span className="font-semibold text-green-900 dark:text-green-100">
                    {formatDistance(result.distance)}
                  </span>
                  <span className="text-green-600 dark:text-green-400 ml-1">
                    (within {sessionLocation.radius}m radius)
                  </span>
                </div>
                <div>
                  <span className="text-green-700 dark:text-green-300">GPS Accuracy:</span>{' '}
                  <span className="font-semibold text-green-900 dark:text-green-100">
                    {Math.round(result.accuracy)}m
                  </span>
                </div>
                <div className="pt-2 border-t border-green-200 dark:border-green-700">
                  <p className="text-xs text-green-600 dark:text-green-400 mb-1">
                    Your Location:
                  </p>
                  <p className="text-xs font-mono text-green-700 dark:text-green-300">
                    Lat: {result.userLocation.latitude.toFixed(6)}, Lng:{' '}
                    {result.userLocation.longitude.toFixed(6)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Failure State - Outside Radius */}
      {result && !result.isWithinRadius && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-orange-800 dark:text-orange-300 mb-2">
                ❌ Outside Attendance Area
              </p>

              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-orange-700 dark:text-orange-300">Distance:</span>{' '}
                  <span className="font-semibold text-orange-900 dark:text-orange-100">
                    {formatDistance(result.distance)}
                  </span>
                  <span className="text-orange-600 dark:text-orange-400 ml-1">
                    (allowed: {sessionLocation.radius}m)
                  </span>
                </div>
                <div>
                  <span className="text-orange-700 dark:text-orange-300">GPS Accuracy:</span>{' '}
                  <span className="font-semibold text-orange-900 dark:text-orange-100">
                    {Math.round(result.accuracy)}m
                  </span>
                </div>
                <div className="pt-2 border-t border-orange-200 dark:border-orange-700">
                  <p className="text-xs text-orange-600 dark:text-orange-400 mb-1">
                    Your Location:
                  </p>
                  <p className="text-xs font-mono text-orange-700 dark:text-orange-300">
                    Lat: {result.userLocation.latitude.toFixed(6)}, Lng:{' '}
                    {result.userLocation.longitude.toFixed(6)}
                  </p>
                </div>
                <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                  Please move within {sessionLocation.radius} meters of the session location to
                  mark attendance.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Button */}
      {hasValidated && (
        <button
          onClick={handleReset}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          Reset & Try Again
        </button>
      )}

      {/* Info Box */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          <strong>Note:</strong> This validation uses browser Geolocation API (FREE) and Haversine
          distance calculation (FREE). No Google APIs are used for validation.
        </p>
      </div>
    </div>
  );
};

export default AttendanceValidationExample;

