/**
 * Mark Attendance Button Component
 * 
 * Complete attendance validation using FREE browser APIs:
 * 1. Browser Geolocation API (FREE) - Get user GPS
 * 2. Haversine Formula (FREE) - Calculate distance
 * 3. Validation - Check if within radius
 * 
 * No Google APIs used for validation - completely FREE!
 */

import React, { useState } from 'react';
import { useAttendanceValidation } from '../hooks/useAttendanceValidation';
import { formatDistance, SessionLocation, LocationValidationResult } from '../utils/locationValidation';
import { CheckCircle2, XCircle, Loader2, MapPin, AlertCircle, Clock, RefreshCw } from 'lucide-react';

interface MarkAttendanceButtonProps {
  /**
   * Session location data (set by admin via Google Maps)
   */
  sessionLocation: SessionLocation;
  /**
   * Session name (for display)
   */
  sessionName?: string;
  /**
   * Callback when attendance is successfully validated
   * @param validationResult - Contains distance, accuracy, user location, validation details, etc.
   */
  onValidationSuccess?: (validationResult: LocationValidationResult) => void;
  /**
   * Callback when validation fails
   * @param error - Error message
   */
  onValidationError?: (error: string) => void;
  /**
   * Maximum allowed GPS accuracy in meters
   * Default: 30 meters (stricter for better accuracy)
   * Set to null to disable accuracy check (not recommended)
   */
  maxAccuracy?: number | null;
  /**
   * Custom button text
   */
  buttonText?: string;
  /**
   * Show detailed validation info
   */
  showDetails?: boolean;
  /**
   * Additional CSS classes
   */
  className?: string;
}

const MarkAttendanceButton: React.FC<MarkAttendanceButtonProps> = ({
  sessionLocation,
  onValidationSuccess,
  onValidationError,
  maxAccuracy = 30, // Stricter default: 30 meters for high accuracy
  buttonText = 'Mark Attendance',
  showDetails = true,
  className = '',
}) => {
  const { validate, result, isLoading, error } = useAttendanceValidation({
    maxAccuracy, // Stricter GPS accuracy requirement
  });

  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 2;

  const handleMarkAttendance = async () => {
    try {
      // Validate user is within allowed radius
      // This uses FREE browser Geolocation API + FREE Haversine calculation
      // No Google APIs used - completely FREE!
      const validationResult = await validate(sessionLocation);

      // Reset retry count on success
      setRetryCount(0);

      // Call success callback if provided
      if (onValidationSuccess) {
        onValidationSuccess(validationResult);
      }
    } catch (err) {
      // Error is already handled by the hook and set in error state
      // Call error callback if provided
      if (onValidationError && error) {
        onValidationError(error);
      }
    }
  };

  // Determine if error is recoverable based on error message
  const isErrorRecoverable = error && (
    error.includes('timeout') || 
    error.includes('unavailable') ||
    error.includes('try again')
  );

  const requiresAction = error && (
    error.includes('permission') || 
    error.includes('enable') ||
    error.includes('settings')
  );

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Button */}
      <button
        onClick={handleMarkAttendance}
        disabled={isLoading}
        className="w-full px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-[#d63a25] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Getting location...</span>
          </>
        ) : (
          <>
            <MapPin className="w-5 h-5" />
            <span>{buttonText}</span>
          </>
        )}
      </button>

      {/* Error Display with Actionable Messages */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-300">
                {requiresAction ? 'Action Required' : 'Validation Error'}
              </p>
              <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                {error}
              </p>
              {isErrorRecoverable && retryCount < MAX_RETRIES && (
                <button
                  onClick={handleMarkAttendance}
                  disabled={isLoading}
                  className="mt-2 text-xs text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100 flex items-center gap-1 disabled:opacity-50"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Try Again</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Validation Result */}
      {result && showDetails && (
        <div
          className={`p-4 rounded-lg border ${
            result.isWithinRadius
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
          }`}
        >
          <div className="flex items-start gap-2">
            {result.isWithinRadius ? (
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p
                className={`text-sm font-semibold mb-2 ${
                  result.isWithinRadius
                    ? 'text-green-800 dark:text-green-300'
                    : 'text-orange-800 dark:text-orange-300'
                }`}
              >
                {result.isWithinRadius
                  ? '✅ Within Attendance Area'
                  : '❌ Outside Attendance Area'}
              </p>

              {showDetails && (
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Distance:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatDistance(result.distance)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Allowed Radius:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {sessionLocation.radius} m
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">GPS Accuracy:</span>
                    <span className={`font-medium ${
                      result.accuracy <= 30 
                        ? 'text-green-700 dark:text-green-300' 
                        : result.accuracy <= 50
                        ? 'text-yellow-700 dark:text-yellow-300'
                        : 'text-red-700 dark:text-red-300'
                    }`}>
                      {Math.round(result.accuracy)} m
                      {result.accuracy <= 30 && ' ✓'}
                    </span>
                  </div>
                  {result.validationDetails && (
                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          {result.validationDetails.accuracyCheckPassed ? (
                            <CheckCircle2 className="w-3 h-3 text-green-600" />
                          ) : (
                            <XCircle className="w-3 h-3 text-red-600" />
                          )}
                          <span className="text-gray-600 dark:text-gray-400">
                            GPS Accuracy: {result.validationDetails.accuracyCheckPassed ? 'Passed' : 'Failed'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {result.validationDetails.distanceCheckPassed ? (
                            <CheckCircle2 className="w-3 h-3 text-green-600" />
                          ) : (
                            <XCircle className="w-3 h-3 text-red-600" />
                          )}
                          <span className="text-gray-600 dark:text-gray-400">
                            Distance Check: {result.validationDetails.distanceCheckPassed ? 'Passed' : 'Failed'}
                          </span>
                        </div>
                        {result.validationDetails.timeWindowCheckPassed !== undefined && (
                          <div className="flex items-center gap-1.5">
                            {result.validationDetails.timeWindowCheckPassed ? (
                              <CheckCircle2 className="w-3 h-3 text-green-600" />
                            ) : (
                              <XCircle className="w-3 h-3 text-red-600" />
                            )}
                            <span className="text-gray-600 dark:text-gray-400">
                              Time Window: {result.validationDetails.timeWindowCheckPassed ? 'Passed' : 'Failed'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {!result.isWithinRadius && (
                    <div className="mt-2 pt-2 border-t border-orange-200 dark:border-orange-700">
                      <p className="text-orange-700 dark:text-orange-300 text-xs">
                        You are {formatDistance(result.distance)} away from the session location.
                        Please move within {sessionLocation.radius}m to mark attendance.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Info Note */}
      {!result && !error && !isLoading && (
        <div className="text-center space-y-1">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Click to get your location and validate attendance
          </p>
          {sessionLocation.timeWindow && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <Clock className="w-3 h-3" />
              <span>
                Attendance window: {new Date(sessionLocation.timeWindow.startTime).toLocaleTimeString()}
                {sessionLocation.timeWindow.endTime && 
                  ` - ${new Date(sessionLocation.timeWindow.endTime).toLocaleTimeString()}`
                }
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MarkAttendanceButton;

