import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { getOrCreateDeviceId } from '../utils/deviceId';
import { parseQrContent } from '../utils/qrParser';
import { RefreshCw, ArrowLeft } from 'lucide-react';
import { ISession } from '../types';
import { FullScreenAnimation } from '../components/FullScreenAnimation';
import {
  getSessionStatus,
  getSessionStartTimeIST,
  nowIST,
  isSameDay
} from '../utils/sessionStatusUtils';
import { formatIST } from '../utils/time';

import { appLogger } from '../shared/logger';
const ScanQR: React.FC = () => {
  const [searchParams] = useSearchParams();
  const qrTokenFromUrl = searchParams.get('token') || searchParams.get('qrToken');
  const sessionIdFromUrl = searchParams.get('sessionId');

  const navigate = useNavigate();

  // View State Management
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    qrTokenFromUrl ? null : (sessionIdFromUrl || null)
  );
  const [directQrToken, setDirectQrToken] = useState<string | null>(qrTokenFromUrl || null);
  const [sessions, setSessions] = useState<ISession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [sessionError, setSessionError] = useState('');

  // Scanner State
  const [message, setMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info' | ''>('');
  const [isScanning, setIsScanning] = useState(false);
  const [isScannerPaused, setIsScannerPaused] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showDeviceMismatchModal, setShowDeviceMismatchModal] = useState(false);
  const [showTooEarlyModal, setShowTooEarlyModal] = useState(false);
  const [tooEarlyInfo, setTooEarlyInfo] = useState<{
    sessionStartTime: string;
    scanWindowStartTime: string;
    hoursRemaining: number;
    minutesRemaining: number;
  } | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const qrCodeRegionId = 'qr-reader';
  const hasAutoSubmittedRef = useRef(false);
  const isProcessingRef = useRef(false);
  const isScannerPausedRef = useRef(false);

  // Keep refs in sync with state for use in scanner closure callbacks
  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);
  useEffect(() => { isScannerPausedRef.current = isScannerPaused; }, [isScannerPaused]);

  useEffect(() => {
    if (qrTokenFromUrl) {
      setDirectQrToken(qrTokenFromUrl);
      setSelectedSessionId(null);
      hasAutoSubmittedRef.current = false;
      return;
    }

    setDirectQrToken(null);
    if (sessionIdFromUrl) {
      setSelectedSessionId(sessionIdFromUrl);
    }
  }, [qrTokenFromUrl, sessionIdFromUrl]);
  const isLocationError = (reason?: string) => {
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

  // Fetch all sessions on mount
  useEffect(() => {
    const fetchSessions = async () => {
      setIsLoadingSessions(true);
      setSessionError('');
      try {
        const { data } = await api.get('/api/sessions');
        setSessions(data || []);
      } catch (err: any) {
        if (err.response?.status === 401) {
          setSessionError('You are not authorized. Please log in again.');
        } else {
          setSessionError('Failed to load sessions. Please try again.');
        }
        appLogger.error('Error fetching sessions:', err);
      } finally {
        setIsLoadingSessions(false);
      }
    };

    fetchSessions();
  }, []);

  // Fetch session info when selectedSessionId changes
  useEffect(() => {
    const fetchSessionInfo = async () => {
      if (selectedSessionId && !directQrToken) {
        try {
          const { data } = await api.get(`/api/sessions/${selectedSessionId}`);
          setSessionInfo(data);
        } catch (err) {
          appLogger.error('Failed to fetch session info:', err);
        }
      }
    };

    fetchSessionInfo();
  }, [selectedSessionId, directQrToken]);

  // Start scanning when selectedSessionId is set
  useEffect(() => {
    if (directQrToken) {
      stopScanning();
      return;
    }

    if (selectedSessionId) {
      startScanning();
    } else {
      stopScanning();
    }

    // Cleanup: stop scanning when component unmounts or session changes
    return () => {
      stopScanning();
    };
  }, [selectedSessionId, directQrToken]);

  // State for current time - used to trigger re-renders and calculations
  const [currentTime, setCurrentTime] = useState(nowIST());

  // Update time every minute to keep status fresh
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(nowIST());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Filter sessions - Show sessions scheduled for TODAY
  const getFilteredSessions = (): ISession[] => {
    const now = currentTime;

    return sessions.filter(session => {
      try {
        if (!session.startDate || session.isCancelled) return false;

        // 1. Strict Day Check using IST utils
        // Prefer occurrenceDate -> startDate
        const dateToCheck = session.occurrenceDate || session.startDate;
        if (!isSameDay(dateToCheck, now)) return false;

        return true;
      } catch (err) {
        appLogger.error('Error filtering session:', err);
        return false;
      }
    });
  };

  // Helper to get minutes until start
  const getMinutesUntilStart = (session: ISession) => {
    const startIST = getSessionStartTimeIST(session);
    const now = currentTime;
    if (now >= startIST) return 0;
    return Math.floor((startIST - now) / 60000);
  };

  // Helpers for time/date display
  const formatTime12Hour = (timeString: string) => {
    try {
      const [hours, minutes] = timeString.split(':');
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch {
      return timeString;
    }
  };

  const formatDateIST = (session: ISession) => {
    try {
      const startIST = getSessionStartTimeIST(session);
      return formatIST(startIST, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return session.startDate;
    }
  };

  const startScanning = async () => {
    // Prevent starting if already scanning or if scanner is paused
    if (directQrToken || isScanning || scannerRef.current || isScannerPaused || !selectedSessionId) {
      return;
    }

    try {
      setCameraError(false);
      setMessageType('info');
      setMessage('Starting camera...');

      // Log eligibility check
      const currentSession = sessions.find(s => s._id === selectedSessionId);
      if (currentSession) {
        const status = getSessionStatus(currentSession, currentTime);
        appLogger.info('🔍 QR SCAN ELIGIBILITY CHECK:', {
          nowIST: currentTime,
          readableTime: formatIST(currentTime),
          sessionStatus: status,
          isEligible: status === 'live'
        });

        // Logic Update: Allow "Upcoming" sessions if within 2 hours
        // Previously only 'live' used to be allowed.
        const minutesUntilStart = getMinutesUntilStart(currentSession);
        const isLive = status === 'live';
        const isUpcomingWithinWindow = status === 'upcoming' && minutesUntilStart <= 120;

        // Eligibility Check
        if (!isLive && !isUpcomingWithinWindow) {
          setMessageType('error');
          if (status === 'past') {
            setMessage('This session has already ended.');
          } else if (status === 'upcoming') {
            const hours = Math.floor(minutesUntilStart / 60);
            const mins = minutesUntilStart % 60;
            const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
            setMessage(`Attendance not yet open. Starts in ${timeStr}.(Window opens 2 hours before start)`);
          } else {
            setMessage('Attendance is only allowed during the session time.');
          }
          return;
        }
      }

      const html5QrCode = new Html5Qrcode(qrCodeRegionId);
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' }, // Use back camera
        {
          fps: 10, // Frames per second
          qrbox: { width: 250, height: 250 }, // Scanning box size
        },
        (decodedText) => {
          // QR code detected - only process if scanner is not paused
          if (!isScannerPausedRef.current && !isProcessingRef.current) {
            handleScan(decodedText);
          }
        },
        (_errorMessage) => {
          // Error handling is done in onScanFailure callback
        }
      );

      setIsScanning(true);
      setMessage('');
      setMessageType('');
    } catch (err: any) {
      setCameraError(true);
      setMessageType('error');
      const errorMsg = err.message || 'Please allow camera access';
      setMessage(`Failed to start camera: ${errorMsg}. Please check your browser permissions.`);
      appLogger.error('Error starting QR scanner:', err);
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        const scanner = scannerRef.current;
        // Try to stop the scanner if it's running
        try {
          await scanner.stop();
        } catch (stopErr) {
          // Scanner might already be stopped, ignore this error
        }
        // Clear the scanner
        await scanner.clear();
      } catch (err) {
        appLogger.error('Error stopping scanner:', err);
      } finally {
        scannerRef.current = null;
        setIsScanning(false);
      }
    }
  };

  const handleScan = async (scannedQRContent: string) => {
    if (isProcessingRef.current || !scannedQRContent || isScannerPausedRef.current) return;

    // PAUSE SCANNER IMMEDIATELY to prevent multiple scans
    setIsScannerPaused(true);
    isScannerPausedRef.current = true;

    // Stop scanning immediately
    await stopScanning();

    // Parse qrToken/sessionId from QR content (handles URL, raw token, legacy)
    const { qrToken, sessionId: extractedSessionId } = parseQrContent(scannedQRContent);

    if (!qrToken && !extractedSessionId) {
      setMessageType('error');
      setMessage('Invalid QR code. Please scan a valid session QR code.');
      setIsProcessing(false);
      setIsScannerPaused(false);
      return;
    }

    // Validate that scanned QR matches selected session (if one is selected)
    if (selectedSessionId && extractedSessionId && extractedSessionId !== selectedSessionId) {
      setMessageType('error');
      setMessage('QR code does not match the selected session. Please scan the correct QR code.');
      setIsProcessing(false);
      setIsScannerPaused(false);
      return;
    }

    const resolvedSessionId = qrToken ? undefined : (extractedSessionId || selectedSessionId);

    if (!qrToken && !resolvedSessionId) {
      setMessageType('error');
      setMessage('Could not determine session ID. Please try again.');
      setIsProcessing(false);
      setIsScannerPaused(false);
      return;
    }

    setIsProcessing(true);
    isProcessingRef.current = true;
    setMessageType('info');
    setMessage('Validating session...');

    const timestamp = nowIST();
    const deviceId = getOrCreateDeviceId();
    const userAgent = navigator.userAgent;
    const basePayload = {
      deviceId,
      userAgent,
      timestamp,
      ...(qrToken ? { qrToken } : { sessionId: resolvedSessionId }),
    };

    const firstAttempt = await submitAttendance(basePayload);
    if (firstAttempt.ok) {
      handleAttendanceResponse(firstAttempt.data);
      return;
    }

    if (isLocationError(firstAttempt.error?.reason)) {
      if (!navigator.geolocation) {
        setMessageType('error');
        setMessage('Geolocation is not supported by your browser.');
        setIsProcessing(false);
        setIsScannerPaused(false);
        return;
      }

      setMessageType('info');
      setMessage('Location required. Getting your location...');

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          setMessageType('info');
          setMessage('Location found. Verifying attendance...');

          const accuracy = position.coords.accuracy;
          if (!accuracy || accuracy <= 0 || isNaN(accuracy)) {
            setMessageType('error');
            setMessage('GPS accuracy data is missing. Please enable high-accuracy GPS and try again.');
            setIsProcessing(false);
            setIsScannerPaused(false);
            return;
          }

          if (accuracy > 200) {
            setMessageType('error');
            setMessage(`GPS accuracy is too low (${Math.round(accuracy)}m). Please enable high-accuracy GPS and ensure you have a clear view of the sky. Maximum allowed accuracy: 200m.`);
            setIsProcessing(false);
            isProcessingRef.current = false;
            setIsScannerPaused(false);
            isScannerPausedRef.current = false;
            return;
          }

          const userLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };

          const secondAttempt = await submitAttendance({
            ...basePayload,
            userLocation,
            accuracy,
          });

          if (secondAttempt.ok) {
            handleAttendanceResponse(secondAttempt.data);
          } else {
            handleScanFailure(secondAttempt.error);
          }
        },
        (error) => {
          let errorMessage = 'Unable to get your location. ';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location permission denied. Please enable location access in your browser settings and try again.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information is unavailable. Please ensure GPS is enabled and try again.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out. Please try again.';
              break;
            default:
              errorMessage = `Could not get location: ${error.message || 'Unknown error'}. Please enable GPS and try again.`;
              break;
          }
          setMessageType('error');
          setMessage(errorMessage);
          setIsProcessing(false);
          setIsScannerPaused(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
      return;
    }

    handleScanFailure(firstAttempt.error);
  };

  useEffect(() => {
    if (!directQrToken || hasAutoSubmittedRef.current) {
      return;
    }

    hasAutoSubmittedRef.current = true;
    handleScan(directQrToken);
  }, [directQrToken]);

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

  const handleAttendanceResponse = (data: any) => {
    if (data.status === 'MARKED' || data.status === 'ALREADY_MARKED') {
      setMessageType('success');
      setMessage(data.msg);
      setIsSuccess(true);
      setIsProcessing(false);

      setSessionInfo((prev: any) => ({ ...prev, ...data }));

      setTimeout(() => {
        navigate('/dashboard');
      }, 2500);
      return;
    }

    handleScanFailure(data);
  };

  const handleScanFailure = (data: any) => {
    setIsProcessing(false);
    setMessageType('error');

    if (data.reason === 'OUT_OF_RANGE') {
      const dist = data.distanceMeters || 0;
      const distanceText = dist >= 1000 ? `${(dist / 1000).toFixed(1)} km` : `${dist} meters`;
      setMessage(`You are ${distanceText} away from the session location.`);
    } else if (data.reason === 'DEVICE_MISMATCH' || data.reason === 'BROWSER_MISMATCH') {
      setMessage('Device Mismatch: Attendance must be marked from the same device/browser used earlier.');
    } else if (data.reason === 'INVALID_QR') {
      setMessage('Invalid QR Code. Please scan the correct code.');
    } else if (data.reason === 'ORG_MISMATCH') {
      setMessage('This QR code does not belong to your organization.');
    } else if (data.reason === 'ORG_FORBIDDEN') {
      setMessage('You do not have access to the organization that issued this QR code.');
    } else if (data.reason === 'SECURE_QR_REQUIRED') {
      setMessage('Secure QR required. Please scan the latest QR displayed by the instructor.');
    } else if (data.reason === 'USER_NOT_ASSIGNED') {
      setMessage('Access Denied: You are not assigned to this session.');
    } else if (data.type === 'TOO_EARLY' || data.reason === 'ATTENDANCE_WINDOW_CLOSED') {
      setMessage(data.msg || 'Attendance is not open yet.');
    } else {
      setMessage(data.msg || 'Attendance Failed');
    }
  };

  const handleRetry = async () => {
    // Reset all state
    setMessage('');
    setMessageType('');
    setIsProcessing(false);
    setCameraError(false);
    setIsSuccess(false);
    setIsScannerPaused(false); // Unpause scanner

    // Stop any existing scanner
    await stopScanning();

    if (directQrToken) {
      hasAutoSubmittedRef.current = false;
      handleScan(directQrToken);
      return;
    }

    // Small delay to ensure cleanup, then restart
    setTimeout(() => {
      startScanning();
    }, 100);
  };

  const handleBackToList = () => {
    setSelectedSessionId(null);
    setIsSuccess(false);
    setMessage('');
    setMessageType('');
    setIsProcessing(false);
    setCameraError(false);
    setIsScannerPaused(false);
    setDirectQrToken(null);
    hasAutoSubmittedRef.current = false;
    stopScanning();
    if (qrTokenFromUrl) {
      navigate('/scan', { replace: true });
    }
  };

  // If selectedSessionId or direct token is set, show the Scanner View
  if (selectedSessionId || directQrToken) {
    // Success State
    if (isSuccess) {
      const isAlreadyMarked = sessionInfo?.status === 'ALREADY_MARKED';
      const subText = isAlreadyMarked ? '\n(Attendance was already recorded earlier)' : '';
      const sessionDate = sessionInfo?.sessionDate || '';
      const orgLine = sessionInfo?.organizationName ? `\nOrganization: ${sessionInfo.organizationName}` : '';

      return (
        <FullScreenAnimation
          src="/animations/success.lottie"
          title={isAlreadyMarked ? 'Attendance Already Marked' : 'Attendance Marked Successfully'}
          description={`Class: ${sessionInfo?.className || 'Class'}\nSession: ${sessionInfo?.name || sessionInfo?.sessionName || 'Session'}\nDate: ${sessionDate}${orgLine}${subText}`}
          loop={false}
        />
      );
    }

    // Error State (non-camera errors)
    if (messageType === 'error' && !cameraError) {
      return (
        <FullScreenAnimation
          src="/animations/warning.lottie"
          title="Scan Failed"
          description={message || 'Invalid QR code. Please try again.'}
          loop={false}
        />
      );
    }

    // Camera Error State
    if (cameraError) {
      return (
        <div className="group/design-root relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark">
          <div className="layout-container flex h-full grow flex-col">
            <div className="flex flex-1 items-center justify-center bg-background-light p-4 dark:bg-background-dark">
              <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-xl bg-white p-8 text-center shadow-lg dark:bg-gray-800">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50">
                  <span className="material-symbols-outlined text-red-600 dark:text-red-400" style={{ fontSize: '40px' }}>camera_alt</span>
                </div>
                <div className="flex max-w-[480px] flex-col items-center gap-2">
                  <p className="text-lg font-bold leading-tight tracking-[-0.015em] text-[#181511] dark:text-white">Camera Access Required</p>
                  <p className="text-sm font-normal leading-normal text-[#181511] dark:text-gray-300">{message || 'Please allow camera access to scan QR codes.'}</p>
                  <div className="mt-4 text-left w-full">
                    <p className="text-xs font-semibold text-[#181511] dark:text-white mb-2">Camera Access Help:</p>
                    <ul className="text-xs text-[#8a7b60] dark:text-gray-400 space-y-1 list-disc list-inside">
                      <li>Make sure you've granted camera permissions to this website</li>
                      <li>Check your browser settings if the camera isn't working</li>
                      <li>Try refreshing the page and allowing camera access when prompted</li>
                    </ul>
                  </div>
                </div>
                <div className="flex gap-3 w-full">
                  <button
                    onClick={handleBackToList}
                    className="flex flex-1 h-10 min-w-[84px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-sm font-bold leading-normal tracking-[0.015em] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="truncate">Back to Sessions</span>
                  </button>
                  <button
                    onClick={handleRetry}
                    className="flex flex-1 h-10 min-w-[84px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl bg-primary px-4 text-sm font-bold leading-normal tracking-[0.015em] text-white hover:bg-[#d63a25] transition-colors"
                  >
                    <RefreshCw className="w-5 h-5" />
                    <span className="truncate">Retry</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Main Scanner View
    return (
      <div className="group/design-root relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark">
        <div className="layout-container flex h-full grow flex-col">
          {/* QR Scanner Active State */}
          <div className="flex flex-1 flex-col bg-[#0f172a]">
            <header className="absolute top-0 z-10 flex w-full justify-between items-center p-6">
              <button
                onClick={handleBackToList}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="font-medium">Back</span>
              </button>
              <h1 className="text-2xl font-bold text-white">Scan Session QR</h1>
              <div className="w-24"></div> {/* Spacer for centering */}
            </header>

            {/* Session Info Banner (if available) */}
            {sessionInfo && (
              <div className="absolute top-20 left-0 right-0 z-10 mx-4">
                <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-white/20 rounded-lg p-4 shadow-lg">
                  <h3 className="font-semibold text-sm mb-1 text-[#181511] dark:text-white">{sessionInfo.name}</h3>
                  {sessionInfo.description && (
                    <p className="text-xs text-[#8a7b60] dark:text-gray-300 mb-1">{sessionInfo.description}</p>
                  )}
                  <p className="text-xs text-[#8a7b60] dark:text-gray-300">
                    <strong>Time:</strong> {sessionInfo.startTime} - {sessionInfo.endTime}
                  </p>
                </div>
              </div>
            )}

            <main className="flex flex-1 items-center justify-center">
              <div className="relative flex h-80 w-80 items-center justify-center sm:h-96 sm:w-96">
                {/* Corner Borders */}
                <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-lg border-l-4 border-t-4 border-primary"></span>
                <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-lg border-r-4 border-t-4 border-primary"></span>
                <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-lg border-b-4 border-l-4 border-primary"></span>
                <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-lg border-b-4 border-r-4 border-primary"></span>

                {/* Scanner Viewport */}
                <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-lg">
                  {/* Show scanner if not processing and not paused */}
                  {!isProcessing && !isScannerPaused ? (
                    <div id={qrCodeRegionId} className="h-full w-full"></div>
                  ) : (
                    /* Show placeholder when processing or paused */
                    <div className="flex flex-col items-center justify-center gap-4">
                      {isProcessing && messageType === 'info' ? (
                        <>
                          <svg className="animate-spin h-12 w-12 text-primary" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
                          </svg>
                          <p className="text-white text-sm font-medium">{message || 'Processing...'}</p>
                        </>
                      ) : (
                        <span className="material-symbols-outlined text-primary" style={{ fontSize: '64px' }}>qr_code_scanner</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </main>

            <footer className="absolute bottom-0 w-full rounded-t-3xl bg-white p-6 text-center shadow-lg dark:bg-background-dark">
              {isProcessing && messageType === 'info' ? (
                <p className="text-lg font-semibold text-[#181511] dark:text-white">{message || 'Processing...'}</p>
              ) : (
                <p className="text-lg font-semibold text-[#181511] dark:text-white">
                  {message || 'Searching for QR code...'}
                </p>
              )}
            </footer>
          </div>
        </div>
      </div>
    );
  }

  // Default View: Session List
  const filteredSessions = getFilteredSessions();

  const myScanSessions = filteredSessions;

  if (isLoadingSessions) {
    return (
      <div className="group/design-root relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark">
        <div className="layout-container flex h-full grow flex-col">
          <div className="flex flex-1 items-center justify-center p-4">
            <div className="flex flex-col items-center">
              <svg className="animate-spin h-8 w-8 text-[#f04129] mb-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
              </svg>
              <p className="text-[#8a7b60] dark:text-gray-400">Loading sessions...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (sessionError) {
    return (
      <div className="group/design-root relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark">
        <div className="layout-container flex h-full grow flex-col">
          <div className="flex flex-1 items-center justify-center p-4">
            <div className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800 p-4 rounded-xl">
              {sessionError}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group/design-root relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark">
      <div className="layout-container flex h-full grow flex-col">
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <header className="mb-6 md:mb-8">
            <div className="flex items-center gap-2 md:gap-3 mb-2">
              <span className="material-symbols-outlined text-[#f04129] text-2xl md:text-4xl">qr_code_scanner</span>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white leading-tight tracking-[-0.033em]">
                Scan Attendance
              </h1>
            </div>
            <p className="text-sm md:text-base text-slate-500 dark:text-slate-400">
              Select a session to scan QR code and mark your attendance
            </p>
          </header>

          {myScanSessions.length === 0 ? (
            // Empty State
            <div className="mt-12">
              <div className="flex flex-col items-center gap-6 rounded-xl border-2 border-dashed border-[#e6e2db] dark:border-slate-800 px-6 py-14">
                <div className="flex max-w-[480px] flex-col items-center gap-2 text-center">
                  <span className="material-symbols-outlined text-4xl sm:text-6xl text-[#8a7b60] dark:text-gray-400 mb-2">event_busy</span>
                  <p className="text-[#181511] dark:text-white text-base sm:text-lg font-bold leading-tight tracking-[-0.015em]">
                    No Active Sessions
                  </p>
                  <p className="text-[#181511] dark:text-slate-300 text-xs sm:text-sm font-normal leading-normal">
                    {filteredSessions.length > 0
                      ? 'No active sessions found for you to attend.'
                      : 'No active sessions found. Please wait for the next scheduled class.'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            // Session Cards
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {myScanSessions.map((session) => {
                const status = getSessionStatus(session, currentTime);
                const isLive = status === 'live';
                const isUpcoming = status === 'upcoming';
                const minutesUntilStart = isUpcoming ? getMinutesUntilStart(session) : 0;

                return (
                  <div
                    key={session._id}
                    onClick={() => setSelectedSessionId(session._id)}
                    className={`relative flex flex-col rounded-xl border-2 p-4 md:p-6 shadow-sm hover:shadow-md transition-all cursor-pointer ${isLive
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20 dark:border-green-600'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50'
                      }`}
                  >
                    {/* Live Indicator - Pulsing Badge */}
                    {isLive && (
                      <div className="absolute top-4 right-4">
                        <div className="relative">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-500 text-white text-xs font-bold">
                            <span>🔴</span>
                            <span>Live Now</span>
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Upcoming Indicator */}
                    {isUpcoming && minutesUntilStart > 0 && minutesUntilStart <= 120 && (
                      <div className="absolute top-4 right-4">
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold border border-blue-300 dark:border-blue-700">
                          <span className="material-symbols-outlined text-sm">schedule</span>
                          <span>Starts in {minutesUntilStart} {minutesUntilStart === 1 ? 'minute' : 'minutes'}</span>
                        </span>
                      </div>
                    )}

                    {/* Session Content */}
                    <div className="mt-8">
                      <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white mb-2 pr-20">
                        {session.name}
                      </h3>
                      {session.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">
                          {session.description}
                        </p>
                      )}

                      <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-slate-500 dark:text-slate-400 text-lg">calendar_today</span>
                          <span>{formatDateIST(session)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-slate-500 dark:text-slate-400 text-lg">schedule</span>
                          <span>{formatTime12Hour(session.startTime)} - {formatTime12Hour(session.endTime)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-slate-500 dark:text-slate-400 text-lg">location_on</span>
                          <span>{session.locationType || session.sessionType}</span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSessionId(session._id);
                        }}
                        className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-orange-500 to-[#f04129] text-white text-sm font-bold hover:from-orange-600 hover:to-[#d63a25] transition-all"
                      >
                        <span className="material-symbols-outlined text-lg">qr_code_scanner</span>
                        <span>Scan QR Code</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Device Mismatch Modal */}
      {showDeviceMismatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-red-200 dark:border-red-800 w-full max-w-md mx-4">
            <div className="p-6">
              {/* Modal Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50">
                  <span className="material-symbols-outlined text-red-600 dark:text-red-400" style={{ fontSize: '32px' }}>security</span>
                </div>
                <h3 className="text-xl font-bold text-[#181511] dark:text-white">Device Mismatch Detected</h3>
              </div>

              {/* Modal Body */}
              <div className="mb-6">
                <div className="space-y-3 text-sm font-normal leading-normal text-[#181511] dark:text-gray-300">
                  <p className="font-semibold">⚠️ Access Denied: Unrecognized Device.</p>
                  <p>It looks like you are using a new phone, a different browser, or have recently cleared your browser history.</p>
                  <p>To prevent proxy attendance, our system locks to your specific browser.</p>
                  <p>Please ask your Administrator to 'Reset Device' for your account to generate a new login.</p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeviceMismatchModal(false);
                    setIsProcessing(false);
                    setIsScannerPaused(false);
                    handleBackToList();
                  }}
                  className="px-4 py-2 text-sm font-medium text-[#8a7b60] dark:text-gray-400 hover:text-[#181511] dark:hover:text-white transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowDeviceMismatchModal(false);
                    setIsProcessing(false);
                    setIsScannerPaused(false);
                    handleBackToList();
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-orange-500 to-[#f04129] rounded-lg hover:from-orange-600 hover:to-[#d63a25] transition-all"
                >
                  Back to Sessions
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Too Early Modal */}
      {showTooEarlyModal && tooEarlyInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-amber-200 dark:border-amber-700 w-full max-w-md mx-4">
            <div className="p-6">
              {/* Modal Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
                  <span className="material-symbols-outlined text-amber-600 dark:text-amber-400" style={{ fontSize: '32px' }}>schedule</span>
                </div>
                <h3 className="text-xl font-bold text-[#181511] dark:text-white">Too Early!</h3>
              </div>

              {/* Modal Body */}
              <div className="mb-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <span className="text-2xl">⏳</span>
                    <p className="text-lg font-semibold">Attendance Not Yet Open</p>
                  </div>

                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <div className="space-y-2 text-sm text-[#181511] dark:text-gray-300">
                      <div className="flex items-center justify-between">
                        <span className="text-amber-700 dark:text-amber-300">Class starts at:</span>
                        <span className="font-bold text-[#181511] dark:text-white">{tooEarlyInfo.sessionStartTime}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-amber-700 dark:text-amber-300">You can scan from:</span>
                        <span className="font-bold text-[#181511] dark:text-white">{tooEarlyInfo.scanWindowStartTime}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-center">
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Time remaining until scan opens:</p>
                    <div className="flex items-center justify-center gap-2">
                      {tooEarlyInfo.hoursRemaining > 0 && (
                        <div className="flex flex-col items-center bg-slate-100 dark:bg-slate-700 rounded-lg px-4 py-2">
                          <span className="text-2xl font-bold text-[#f04129]">{tooEarlyInfo.hoursRemaining}</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">{tooEarlyInfo.hoursRemaining === 1 ? 'hour' : 'hours'}</span>
                        </div>
                      )}
                      <div className="flex flex-col items-center bg-slate-100 dark:bg-slate-700 rounded-lg px-4 py-2">
                        <span className="text-2xl font-bold text-[#f04129]">{tooEarlyInfo.minutesRemaining}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{tooEarlyInfo.minutesRemaining === 1 ? 'minute' : 'minutes'}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-center text-slate-500 dark:text-slate-400">
                    Attendance can be marked starting 2 hours before the session begins.
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowTooEarlyModal(false);
                    setTooEarlyInfo(null);
                    setIsProcessing(false);
                    setIsScannerPaused(false);
                    handleBackToList();
                  }}
                  className="px-4 py-2 text-sm font-medium text-[#8a7b60] dark:text-gray-400 hover:text-[#181511] dark:hover:text-white transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowTooEarlyModal(false);
                    setTooEarlyInfo(null);
                    setIsProcessing(false);
                    setIsScannerPaused(false);
                    handleBackToList();
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all"
                >
                  Back to Sessions
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScanQR;
