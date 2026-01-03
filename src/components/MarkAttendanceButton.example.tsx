/**
 * Example: How to use MarkAttendanceButton component
 * 
 * This demonstrates the complete attendance validation flow:
 * 1. Admin sets location via Google Maps (already done)
 * 2. User clicks "Mark Attendance"
 * 3. Browser gets GPS location (FREE)
 * 4. Distance calculated (FREE - Haversine)
 * 5. Validation result shown
 */

import { useState } from 'react';
import MarkAttendanceButton from './MarkAttendanceButton';
import { SessionLocation, LocationValidationResult } from '../utils/locationValidation';
import api from '../api';

// Example: Using in a session details page
export function SessionDetailsExample() {
  const [attendanceMarked, setAttendanceMarked] = useState(false);

  // Session location (set by admin via Google Maps)
  const sessionLocation: SessionLocation = {
    latitude: 19.9975,  // Set by admin
    longitude: 73.7898, // Set by admin
    radius: 100,        // Set by admin (meters)
  };

  const handleValidationSuccess = async (validationResult: LocationValidationResult) => {
    if (validationResult.isWithinRadius) {
      try {
        // Call your API to mark attendance
        await api.post('/api/attendance/scan', {
          sessionId: 'session-id-here',
          userLocation: validationResult.userLocation,
          accuracy: validationResult.accuracy,
          timestamp: validationResult.timestamp,
          // Include validation data for audit
          validationData: {
            distance: validationResult.distance,
            isWithinRadius: validationResult.isWithinRadius,
          },
        });

        setAttendanceMarked(true);
      } catch (error) {
        console.error('Failed to mark attendance:', error);
      }
    }
  };

  const handleValidationError = (error: string) => {
    console.error('Validation error:', error);
    // Show error to user (already shown by component)
  };

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-xl font-bold">Session: Math 101</h2>
      
      {attendanceMarked ? (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <p className="text-green-800 dark:text-green-300">
            ✅ Attendance marked successfully!
          </p>
        </div>
      ) : (
        <MarkAttendanceButton
          sessionLocation={sessionLocation}
          sessionName="Math 101"
          onValidationSuccess={handleValidationSuccess}
          onValidationError={handleValidationError}
          maxAccuracy={50}
          showDetails={true}
        />
      )}
    </div>
  );
}

// Example: Simple usage
export function SimpleExample() {
  const sessionLocation: SessionLocation = {
    latitude: 19.9975,
    longitude: 73.7898,
    radius: 100,
  };

  return (
    <MarkAttendanceButton
      sessionLocation={sessionLocation}
      onValidationSuccess={(result) => {
        if (result.isWithinRadius) {
          console.log('✅ Within radius!', result);
          // Mark attendance
        } else {
          console.log('❌ Outside radius!', result);
          // Show error
        }
      }}
    />
  );
}

