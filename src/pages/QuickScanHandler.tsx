import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { getOrCreateDeviceId } from '../utils/deviceId';
import { useAuth } from '../contexts/AuthContext';
import { FullScreenAnimation } from '../components/FullScreenAnimation';
import { nowIST } from '../utils/time';

import { appLogger } from '../shared/logger';
type Status = 'loading' | 'success' | 'error';

interface ScanResponse {
  status: 'MARKED' | 'ALREADY_MARKED' | 'FAILED';
  reason: 'DEVICE_MISMATCH' | 'OUT_OF_RANGE' | 'INVALID_QR' | string | null;
  msg: string;
  sessionName?: string;
  className?: string;
  sessionDate?: string;
  distanceMeters?: number;
  organizationId?: string;
  organizationName?: string;
}

const QuickScanHandler: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [status, setStatus] = useState<Status>('loading');
  const [loadingText, setLoadingText] = useState('Validating session...');
  const [responseData, setResponseData] = useState<ScanResponse | null>(null);
  const [errorDetails, setErrorDetails] = useState<{ title: string; desc: string }>({ title: '', desc: '' });

  const isLocationError = (reason?: string | null) => {
    if (!reason) return false;
    const locationReasons = new Set([
      'LOCATION_REQUIRED',
      'ACCURACY_REQUIRED',
      'INVALID_LOCATION_COORDS',
      'INVALID_LOCATION_ZERO',
      'INVALID_COORDINATES',
      'INVALID_ACCURACY',
      'INVALID_ACCURACY_RANGE',
    ]);
    return locationReasons.has(reason);
  };

  // Dynamic loading text effect
  useEffect(() => {
    if (status === 'loading') {
      const texts = ['Validating session...', 'Checking eligibility...', 'Marking attendance...'];
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
        const timestamp = nowIST();
        const deviceId = getOrCreateDeviceId();
        const userAgent = navigator.userAgent;
        const qrToken = searchParams.get('token') || searchParams.get('qrToken');

        const basePayload = {
          deviceId,
          userAgent,
          timestamp,
          ...(qrToken ? { qrToken } : { sessionId }),
        };

        const firstAttempt = await submitAttendance(basePayload);
        if (firstAttempt.ok) {
          handleResponse(firstAttempt.data);
          return;
        }

        if (isLocationError(firstAttempt.error?.reason)) {
          if (!navigator.geolocation) {
            setStatus('error');
            setErrorDetails({
              title: 'Geolocation Not Supported',
              desc: 'Your browser does not support location services.',
            });
            return;
          }

          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const { latitude, longitude } = position.coords;
              const accuracy = position.coords.accuracy;

              const secondAttempt = await submitAttendance({
                ...basePayload,
                userLocation: { latitude, longitude },
                accuracy,
              });

              if (secondAttempt.ok) {
                handleResponse(secondAttempt.data);
              } else {
                handleFailure(secondAttempt.error);
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
          return;
        }

        handleFailure(firstAttempt.error);
      } catch (err: any) {
        setStatus('error');
        setErrorDetails({ title: 'Unexpected Error', desc: err.message || 'An error occurred.' });
      }
    };

    markAttendance();
  }, [sessionId, user, searchParams, navigate]);

  const submitAttendance = async (payload: Record<string, any>) => {
    try {
      appLogger.info('[ATTENDANCE_SCAN] Sending request:', {
        sessionId: payload.sessionId,
        hasQrToken: !!payload.qrToken,
        hasLocation: !!payload.userLocation,
        accuracy: payload.accuracy,
      });
      const { data } = await api.post('/api/attendance/scan', payload);
      return { ok: true, data };
    } catch (err: any) {
      return { ok: false, error: err.response?.data || { msg: 'Failed to connect to server.' } };
    }
  };

  const handleResponse = (data: ScanResponse) => {
    if (data.status === 'MARKED' || data.status === 'ALREADY_MARKED') {
      setResponseData(data);
      setStatus('success');

      setTimeout(() => {
        navigate('/dashboard');
      }, 2500);
    } else {
      handleFailure(data);
    }
  };

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
    } else if (data.reason === 'SECURE_QR_REQUIRED') {
      setErrorDetails({
        title: 'Secure QR Required',
        desc: 'This QR code is no longer supported. Please scan the latest QR displayed by the instructor.'
      });
    } else if (data.reason === 'ORG_FORBIDDEN') {
      setErrorDetails({
        title: 'Organization Access Denied',
        desc: 'You do not have access to the organization that issued this QR code.'
      });
    } else if (data.reason === 'ORG_MISMATCH') {
      setErrorDetails({
        title: 'Organization Mismatch',
        desc: 'This QR code does not belong to your organization.'
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
    const orgLine = responseData.organizationName ? `\nOrganization: ${responseData.organizationName}` : '';

    return (
      <FullScreenAnimation
        src="/animations/success.lottie"
        title={isAlreadyMarked ? 'Attendance Already Marked' : 'Attendance Marked Successfully'}
        description={`Class: ${responseData.className || 'Unknown'}\nSession: ${responseData.sessionName || 'Unknown'}\nDate: ${responseData.sessionDate || ''}${orgLine}${subText}`}
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

