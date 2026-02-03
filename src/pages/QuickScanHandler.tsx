import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { getOrCreateDeviceId } from '../utils/deviceId';
import { useAuth } from '../contexts/AuthContext';
import { FullScreenAnimation } from '../components/FullScreenAnimation';
import { nowIST } from '../utils/time';

type Status = 'loading' | 'success' | 'error';

interface ScanResponse {
  status: 'MARKED' | 'ALREADY_MARKED' | 'FAILED';
  reason: 'DEVICE_MISMATCH' | 'OUT_OF_RANGE' | 'INVALID_QR' | string | null;
  msg: string;
  sessionName?: string;
  className?: string;
  sessionDate?: string;
  distanceMeters?: number;
}

const QuickScanHandler: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [status, setStatus] = useState<Status>('loading');
  const [loadingText, setLoadingText] = useState('Verifying location...');
  const [responseData, setResponseData] = useState<ScanResponse | null>(null);
  const [errorDetails, setErrorDetails] = useState<{ title: string; desc: string }>({ title: '', desc: '' });

  // Dynamic loading text effect
  useEffect(() => {
    if (status === 'loading') {
      const texts = ['Verifying location...', 'Validating session...', 'Marking attendance...'];
      let i = 0;
      const interval = setInterval(() => {
        i = (i + 1) % texts.length;
        setLoadingText(texts[i]);
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [status]);

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      setErrorDetails({ title: 'Invalid Link', desc: 'Session ID is missing.' });
      return;
    }

    // Check if user is authenticated
    if (!user) {
      setStatus('error');
      setErrorDetails({ title: 'Authentication Required', desc: 'You must be logged in to mark attendance.' });
      // Note: ProtectedRoute usually handles this, but safety check
      return;
    }

    const markAttendance = async () => {
      try {
        // Get user's current location
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              const { latitude, longitude } = position.coords;
              const accuracy = position.coords.accuracy;

              const timestamp = nowIST();
              const deviceId = getOrCreateDeviceId();
              const userAgent = navigator.userAgent;
              const token = searchParams.get('token');

              console.log('[ATTENDANCE_SCAN] Sending request:', { sessionId, accuracy });

              // Make API call
              const { data } = await api.post('/api/attendance/scan', {
                sessionId,
                userLocation: { latitude, longitude },
                deviceId,
                userAgent,
                accuracy,
                timestamp,
                ...(token && { token }),
              });

              // Check logic status even if HTTP 200
              if (data.status === 'MARKED' || data.status === 'ALREADY_MARKED') {
                setResponseData(data);
                setStatus('success');

                // Auto redirect
                setTimeout(() => {
                  navigate('/dashboard');
                }, 2500);
              } else {
                // Logic failure (e.g. FAILED status with 200 OK)
                handleFailure(data);
              }

            } catch (err: any) {
              // Handle HTTP 400/403/500 errors
              if (err.response?.data) {
                handleFailure(err.response.data);
              } else {
                setStatus('error');
                setErrorDetails({
                  title: 'Connection Error',
                  desc: 'Failed to connect to server. Please try again.'
                });
              }
            }
          },
          () => {
            setStatus('error');
            setErrorDetails({
              title: 'Location Access Denied',
              desc: 'Please enable GPS/Location in your browser settings to mark attendance.'
            });
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          }
        );
      } catch (err: any) {
        setStatus('error');
        setErrorDetails({ title: 'Unexpected Error', desc: err.message || 'An error occurred.' });
      }
    };

    markAttendance();
  }, [sessionId, user, searchParams, navigate]);

  const handleFailure = (data: ScanResponse) => {
    setStatus('error');

    if (data.reason === 'OUT_OF_RANGE') {
      const dist = data.distanceMeters || 0;
      const distanceText = dist >= 1000 ? `${(dist / 1000).toFixed(1)} km` : `${dist} meters`;
      setErrorDetails({
        title: 'You are not at the correct location',
        desc: `You are ${distanceText} away from the session location.\nPlease move closer and try again.`
      });
    } else if (data.reason === 'DEVICE_MISMATCH' || data.reason === 'BROWSER_MISMATCH') {
      setErrorDetails({
        title: 'Device or Browser Mismatch',
        desc: 'Attendance must be marked from the same device and browser used earlier.'
      });
    } else if (data.reason === 'INVALID_QR') {
      setErrorDetails({
        title: 'Invalid or Expired QR Code',
        desc: 'Please scan the QR displayed by the instructor.'
      });
    } else {
      setErrorDetails({
        title: 'Attendance Failed',
        desc: data.msg || 'Unknown error occurred.'
      });
    }
  };

  // RENDER UI
  if (status === 'loading') {
    return (
      <FullScreenAnimation
        src="/animations/loading.lottie"
        title="Please wait"
        description={loadingText}
        loop
      />
    );
  }

  if (status === 'success' && responseData) {
    const isAlreadyMarked = responseData.status === 'ALREADY_MARKED';
    const subText = isAlreadyMarked ? '\n(Attendance was already recorded earlier)' : '';

    return (
      <FullScreenAnimation
        src="/animations/success.lottie"
        title={isAlreadyMarked ? 'Attendance Already Marked' : 'Attendance Marked Successfully'}
        description={`Class: ${responseData.className || 'Unknown'}\nSession: ${responseData.sessionName || 'Unknown'}\nDate: ${responseData.sessionDate || ''}${subText}`}
        loop={false}
      />
    );
  }

  // Error State
  return (
    <FullScreenAnimation
      src="/animations/warning.lottie"
      title={errorDetails.title}
      description={errorDetails.desc}
      loop={false}
    />
  );
};

export default QuickScanHandler;

