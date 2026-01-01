import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import api from '../api';
import { getOrCreateDeviceId } from '../utils/deviceId';
import { useAuth } from '../contexts/AuthContext';

type Status = 'loading' | 'success' | 'error';

const QuickScanHandler: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('Verifying Location & Session...');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      setError('Invalid session ID. Please use a valid attendance link.');
      return;
    }

    // Check if user is authenticated
    if (!user) {
      setStatus('error');
      setError('You must be logged in to mark attendance. Redirecting to login...');
      // Note: ProtectedRoute will handle redirect to login
      return;
    }

    const markAttendance = async () => {
      try {
        setMessage('Getting your location...');

        // Get user's current location
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              setMessage('Marking your attendance...');

              const { latitude, longitude } = position.coords;
              const deviceId = getOrCreateDeviceId();
              const userAgent = navigator.userAgent;
              
              // Optional: Check for token in query params (if QR codes use dynamic tokens)
              const token = searchParams.get('token');

              // Validate location before sending
              if (latitude === 0 && longitude === 0) {
                setStatus('error');
                setError('Invalid location detected. Please ensure GPS is enabled and try again.');
                return;
              }

              console.log('[ATTENDANCE_SCAN] Sending request from QuickScanHandler:', {
                sessionId,
                userLocation: { latitude, longitude },
                deviceId: deviceId.substring(0, 8) + '...',
                userAgent: userAgent.substring(0, 50) + '...',
                scanSource: 'google_lens_or_deep_link'
              });

              // Make API call to mark attendance
              const { data } = await api.post('/api/attendance/scan', {
                sessionId,
                userLocation: {
                  latitude,
                  longitude,
                },
                deviceId,
                userAgent,
                ...(token && { token }), // Include token if provided
              });

              // Success!
              setStatus('success');
              setMessage(data.msg || 'Attendance marked successfully!');
            } catch (err: any) {
              // Handle API errors
              const errorMsg = err.response?.data?.msg || 
                              err.response?.data?.errors?.[0]?.msg || 
                              'Failed to mark attendance. Please try again.';
              
              setStatus('error');
              setError(errorMsg);
            }
          },
          (locationError) => {
            // Handle geolocation errors
            let errorMessage = 'Unable to get your location. ';
            switch (locationError.code) {
              case locationError.PERMISSION_DENIED:
                errorMessage += 'Please enable location permissions and try again.';
                break;
              case locationError.POSITION_UNAVAILABLE:
                errorMessage += 'Location information is unavailable.';
                break;
              case locationError.TIMEOUT:
                errorMessage += 'Location request timed out. Please try again.';
                break;
              default:
                errorMessage += locationError.message || 'Unknown error occurred.';
                break;
            }
            
            setStatus('error');
            setError(errorMessage);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0, // Don't use cached location
          }
        );
      } catch (err: any) {
        setStatus('error');
        setError(err.message || 'An unexpected error occurred. Please try again.');
      }
    };

    markAttendance();
  }, [sessionId, user, searchParams]);

  // Loading State
  if (status === 'loading') {
    return (
      <div className="group/design-root relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark">
        <div className="layout-container flex h-full grow flex-col">
          <div className="flex flex-1 items-center justify-center p-4">
            <div className="flex flex-col items-center gap-6 rounded-xl bg-white p-8 text-center shadow-lg dark:bg-gray-800 max-w-md w-full">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50">
                <svg className="animate-spin h-8 w-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <div className="flex flex-col items-center gap-2">
                <p className="text-lg font-bold leading-tight tracking-[-0.015em] text-[#181511] dark:text-white">
                  {message}
                </p>
                <p className="text-sm font-normal leading-normal text-[#8a7b60] dark:text-gray-400">
                  Please wait...
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Success State
  if (status === 'success') {
    return (
      <div className="group/design-root relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark">
        <div className="layout-container flex h-full grow flex-col">
          <div className="flex flex-1 items-center justify-center p-4">
            <div className="flex flex-col items-center gap-6 rounded-xl bg-white p-8 text-center shadow-lg dark:bg-gray-800 max-w-md w-full">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/50">
                <span className="material-symbols-outlined text-green-600 dark:text-green-400" style={{ fontSize: '48px' }}>
                  check_circle
                </span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <p className="text-lg font-bold leading-tight tracking-[-0.015em] text-[#181511] dark:text-white">
                  Attendance Marked!
                </p>
                <p className="text-sm font-normal leading-normal text-[#8a7b60] dark:text-gray-400">
                  {message}
                </p>
                <p className="text-xs font-normal leading-normal text-[#8a7b60] dark:text-gray-400 mt-2">
                  You can close this page.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error State
  return (
    <div className="group/design-root relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark">
      <div className="layout-container flex h-full grow flex-col">
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="flex flex-col items-center gap-6 rounded-xl bg-white p-8 text-center shadow-lg dark:bg-gray-800 max-w-md w-full">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50">
              <span className="material-symbols-outlined text-red-600 dark:text-red-400" style={{ fontSize: '48px' }}>
                close
              </span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <p className="text-lg font-bold leading-tight tracking-[-0.015em] text-[#181511] dark:text-white">
                Attendance Failed
              </p>
              <p className="text-sm font-normal leading-normal text-red-600 dark:text-red-400">
                {error}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickScanHandler;

