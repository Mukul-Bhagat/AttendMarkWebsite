/**
 * Location Validation Utilities
 * 
 * FREE attendance validation using browser Geolocation API and Haversine formula.
 * No Google APIs required - completely free to use.
 * 
 * This module provides:
 * 1. User location retrieval (browser Geolocation API)
 * 2. Distance calculation (Haversine formula)
 * 3. Attendance validation (distance check)
 * 
 * All functions are FREE and don't use any paid APIs.
 */

export interface GeolocationOptions {
  /**
   * Enable high accuracy GPS
   * Default: true
   */
  enableHighAccuracy?: boolean;
  /**
   * Timeout in milliseconds
   * Default: 10000 (10 seconds)
   */
  timeout?: number;
  /**
   * Maximum age of cached position in milliseconds
   * Default: 0 (always fetch fresh)
   */
  maximumAge?: number;
}

export interface LocationValidationResult {
  /**
   * Whether user is within allowed radius
   */
  isWithinRadius: boolean;
  /**
   * Distance from session location in meters
   */
  distance: number;
  /**
   * User's GPS accuracy in meters
   */
  accuracy: number;
  /**
   * User's coordinates
   */
  userLocation: {
    latitude: number;
    longitude: number;
  };
  /**
   * Timestamp of location retrieval
   */
  timestamp: number;
  /**
   * Validation status details
   */
  validationDetails: {
    /**
     * Whether GPS accuracy check passed
     */
    accuracyCheckPassed: boolean;
    /**
     * Whether distance check passed
     */
    distanceCheckPassed: boolean;
    /**
     * Whether time window check passed (if provided)
     */
    timeWindowCheckPassed?: boolean;
  };
}

export interface SessionLocation {
  /**
   * Session latitude
   */
  latitude: number;
  /**
   * Session longitude
   */
  longitude: number;
  /**
   * Allowed radius in meters
   */
  radius: number;
  /**
   * Optional: Session time window for attendance
   * If provided, attendance is only allowed within this window
   */
  timeWindow?: {
    /**
     * Session start time (ISO string or timestamp)
     */
    startTime: string | number;
    /**
     * Session end time (ISO string or timestamp)
     */
    endTime?: string | number;
    /**
     * Optional: Early arrival allowed (minutes before start)
     * Default: 0 (no early arrival)
     */
    earlyArrivalMinutes?: number;
  };
}

/**
 * Get user's current location using browser Geolocation API (FREE)
 * 
 * @param options - Geolocation options
 * @returns Promise with GeolocationPosition
 * @throws Error if geolocation fails or is not supported
 * 
 * @example
 * ```typescript
 * try {
 *   const position = await getUserLocation();
 *   console.log('Lat:', position.coords.latitude);
 *   console.log('Lng:', position.coords.longitude);
 * } catch (error) {
 *   console.error('Failed to get location:', error);
 * }
 * ```
 */
export function getUserLocation(
  options: GeolocationOptions = {}
): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    // Check if geolocation is supported
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    // Default options with high accuracy for attendance validation
    const geolocationOptions: PositionOptions = {
      enableHighAccuracy: options.enableHighAccuracy ?? true,
      timeout: options.timeout ?? 10000,
      maximumAge: options.maximumAge ?? 0, // Always fetch fresh GPS
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Validate position data structure
        if (
          !position.coords ||
          typeof position.coords.latitude !== 'number' ||
          typeof position.coords.longitude !== 'number'
        ) {
          reject(new Error('Invalid location data received from GPS. Please try again.'));
          return;
        }

        // Validate coordinates are within valid ranges
        const { latitude, longitude, accuracy } = position.coords;
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
          reject(new Error('Invalid coordinates received. Please ensure GPS is working correctly.'));
          return;
        }

        // Reject (0, 0) as it's often a default/error value
        if (latitude === 0 && longitude === 0) {
          reject(new Error('Invalid location detected (0, 0). Please ensure GPS is enabled and try again.'));
          return;
        }

        // Validate accuracy is available (important for attendance validation)
        if (accuracy === null || accuracy === undefined || isNaN(accuracy) || accuracy < 0) {
          reject(new Error('GPS accuracy data is missing. Please enable high-accuracy GPS and try again.'));
          return;
        }

        resolve(position);
      },
      (error) => {
        // Convert GeolocationPositionError to user-friendly, actionable error messages
        let errorMessage = 'Unable to retrieve your location.';
        let errorCode = 'UNKNOWN_ERROR';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied. Please enable location access in your browser settings and try again.';
            errorCode = 'PERMISSION_DENIED';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable. Please ensure GPS is enabled on your device and try again.';
            errorCode = 'POSITION_UNAVAILABLE';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out. Please ensure you have a clear view of the sky and try again.';
            errorCode = 'TIMEOUT';
            break;
          default:
            errorMessage = error.message || 'Unknown geolocation error. Please try again.';
            errorCode = 'UNKNOWN_ERROR';
            break;
        }

        // Create error with code for programmatic handling
        const enhancedError = new Error(errorMessage) as Error & { code?: string };
        enhancedError.code = errorCode;
        reject(enhancedError);
      },
      geolocationOptions
    );
  });
}

/**
 * Calculate distance between two coordinates using Haversine formula (FREE)
 * 
 * This is a mathematical calculation - no API calls required.
 * 
 * @param lat1 - Latitude of first point
 * @param lon1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lon2 - Longitude of second point
 * @returns Distance in meters
 * 
 * @example
 * ```typescript
 * const distance = calculateDistance(
 *   19.9975, 73.7898, // Session location
 *   19.9980, 73.7900  // User location
 * );
 * console.log(`Distance: ${distance.toFixed(2)} meters`);
 * ```
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  // Validate inputs
  if (
    typeof lat1 !== 'number' || typeof lon1 !== 'number' ||
    typeof lat2 !== 'number' || typeof lon2 !== 'number' ||
    isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)
  ) {
    throw new Error('All coordinates must be valid numbers');
  }

  // Validate coordinate ranges
  if (
    lat1 < -90 || lat1 > 90 || lat2 < -90 || lat2 > 90 ||
    lon1 < -180 || lon1 > 180 || lon2 < -180 || lon2 > 180
  ) {
    throw new Error('Coordinates must be within valid ranges (lat: -90 to 90, lng: -180 to 180)');
  }

  // Earth's radius in meters
  const R = 6371000;

  // Convert degrees to radians
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  // Calculate differences
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  // Haversine formula
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // Distance in meters
  return R * c;
}

/**
 * Validate if user is within allowed radius of session location (FREE)
 * 
 * This function:
 * 1. Gets user's GPS location (browser Geolocation API - FREE)
 * 2. Calculates distance using Haversine formula (FREE)
 * 3. Checks if within allowed radius
 * 
 * @param sessionLocation - Session location with coordinates and radius
 * @param options - Optional validation options
 * @returns Validation result with distance, accuracy, and location data
 * @throws Error if location retrieval fails or validation fails
 * 
 * @example
 * ```typescript
 * try {
 *   const result = await validateAttendance({
 *     latitude: 19.9975,
 *     longitude: 73.7898,
 *     radius: 100 // meters
 *   });
 *   
 *   if (result.isWithinRadius) {
 *     console.log(`✅ Within radius! Distance: ${result.distance.toFixed(2)}m`);
 *   } else {
 *     console.log(`❌ Outside radius! Distance: ${result.distance.toFixed(2)}m`);
 *   }
 * } catch (error) {
 *   console.error('Validation failed:', error);
 * }
 * ```
 */
/**
 * Validate attendance with enhanced security checks (FREE)
 * 
 * Validation Rules (MANDATORY):
 * 1. User must be inside allowed radius
 * 2. Location accuracy must be ≤ maxAccuracy (default: 30m for high accuracy)
 * 3. Attendance allowed only within session time window (if provided)
 * 
 * Note: One attendance per user per session is enforced by backend, not frontend.
 * 
 * @param sessionLocation - Session location with coordinates, radius, and optional time window
 * @param options - Validation options
 * @returns Validation result with detailed status
 * @throws Error if any validation check fails
 */
export async function validateAttendance(
  sessionLocation: SessionLocation,
  options: {
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
    /**
     * Current time for time window validation (default: Date.now())
     * Useful for testing or custom time checks
     */
    currentTime?: number;
  } = {}
): Promise<LocationValidationResult> {
  // Validate session location
  if (
    !sessionLocation ||
    typeof sessionLocation.latitude !== 'number' ||
    typeof sessionLocation.longitude !== 'number' ||
    typeof sessionLocation.radius !== 'number'
  ) {
    throw new Error('Invalid session location data');
  }

  if (sessionLocation.radius <= 0) {
    throw new Error('Session radius must be greater than 0');
  }

  // Validate session coordinates
  const { latitude: sessionLat, longitude: sessionLng } = sessionLocation;
  if (
    sessionLat < -90 || sessionLat > 90 ||
    sessionLng < -180 || sessionLng > 180
  ) {
    throw new Error('Invalid session coordinates');
  }

  // Get user's current location (FREE - browser Geolocation API)
  const position = await getUserLocation(options.geolocationOptions);

  const userLat = position.coords.latitude;
  const userLng = position.coords.longitude;
  const accuracy = position.coords.accuracy || 0; // Accuracy in meters

  // Validation Rule 1: GPS Accuracy Check (MANDATORY for security)
  // Stricter default: 30 meters for high accuracy requirement
  const maxAccuracy = options.maxAccuracy ?? 30; // Default: 30 meters (stricter)
  const accuracyCheckPassed = maxAccuracy === null || accuracy <= maxAccuracy;
  
  if (!accuracyCheckPassed) {
    throw new Error(
      `GPS accuracy is too low (${Math.round(accuracy)}m). ` +
      `Please enable high-accuracy GPS and ensure you have a clear view of the sky. ` +
      `Maximum allowed accuracy: ${maxAccuracy}m.`
    );
  }

  // Validation Rule 2: Time Window Check (if provided)
  // Attendance allowed only within session time window
  let timeWindowCheckPassed: boolean | undefined = undefined;
  if (sessionLocation.timeWindow) {
    const currentTime = options.currentTime ?? Date.now();
    const { startTime, endTime, earlyArrivalMinutes = 0 } = sessionLocation.timeWindow;
    
    // Parse times (handle both ISO strings and timestamps)
    const startTimestamp = typeof startTime === 'string' 
      ? new Date(startTime).getTime() 
      : startTime;
    const endTimestamp = endTime 
      ? (typeof endTime === 'string' ? new Date(endTime).getTime() : endTime)
      : null;
    
    // Calculate effective start time (with early arrival allowance)
    const effectiveStartTime = startTimestamp - (earlyArrivalMinutes * 60 * 1000);
    
    // Check if current time is within window
    if (currentTime < effectiveStartTime) {
      const minutesEarly = Math.ceil((effectiveStartTime - currentTime) / (60 * 1000));
      throw new Error(
        `Attendance is not yet open. ` +
        `Session starts in ${minutesEarly} minute${minutesEarly !== 1 ? 's' : ''}.`
      );
    }
    
    if (endTimestamp && currentTime > endTimestamp) {
      throw new Error(
        `Attendance window has closed. ` +
        `Session ended at ${new Date(endTimestamp).toLocaleTimeString()}.`
      );
    }
    
    timeWindowCheckPassed = true;
  }

  // Validation Rule 3: Distance Check (MANDATORY)
  // Calculate distance using Haversine formula (FREE - mathematical calculation)
  const distance = calculateDistance(
    sessionLat,
    sessionLng,
    userLat,
    userLng
  );

  // Check if user is within allowed radius
  const distanceCheckPassed = distance <= sessionLocation.radius;
  const isWithinRadius = distanceCheckPassed;

  if (!isWithinRadius) {
    throw new Error(
      `You are outside the attendance area. ` +
      `Distance: ${formatDistance(distance)}. ` +
      `Allowed radius: ${sessionLocation.radius}m. ` +
      `Please move closer to the session location.`
    );
  }

  // All validation checks passed
  return {
    isWithinRadius,
    distance,
    accuracy,
    userLocation: {
      latitude: userLat,
      longitude: userLng,
    },
    timestamp: Date.now(),
    validationDetails: {
      accuracyCheckPassed,
      distanceCheckPassed,
      timeWindowCheckPassed,
    },
  };
}

/**
 * Format distance for display
 * 
 * @param distanceInMeters - Distance in meters
 * @returns Formatted distance string
 * 
 * @example
 * ```typescript
 * formatDistance(1250); // "1.25 km"
 * formatDistance(450);  // "450 m"
 * ```
 */
export function formatDistance(distanceInMeters: number): string {
  if (distanceInMeters < 1000) {
    return `${Math.round(distanceInMeters)} m`;
  }
  return `${(distanceInMeters / 1000).toFixed(2)} km`;
}

