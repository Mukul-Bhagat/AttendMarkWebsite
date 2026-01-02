import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useSearchParams } from 'react-router-dom';
import api from '../api';
import { getOrCreateDeviceId } from '../utils/deviceId';
import { extractSessionIdFromQR } from '../utils/qrParser';
import { RefreshCw, ArrowLeft } from 'lucide-react';
import { ISession } from '../types';
import { useAuth } from '../contexts/AuthContext';

const ScanQR: React.FC = () => {
  const [searchParams] = useSearchParams();
  const sessionIdFromUrl = searchParams.get('sessionId');
  const { user } = useAuth();
  
  // View State Management
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(sessionIdFromUrl || null);
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
        console.error('Error fetching sessions:', err);
      } finally {
        setIsLoadingSessions(false);
      }
    };

    fetchSessions();
  }, []);

  // Fetch session info when selectedSessionId changes
  useEffect(() => {
    const fetchSessionInfo = async () => {
      if (selectedSessionId) {
        try {
          const { data } = await api.get(`/api/sessions/${selectedSessionId}`);
          setSessionInfo(data);
        } catch (err) {
          console.error('Failed to fetch session info:', err);
        }
      }
    };

    fetchSessionInfo();
  }, [selectedSessionId]);

  // Start scanning when selectedSessionId is set
  useEffect(() => {
    if (selectedSessionId) {
      startScanning();
    } else {
      stopScanning();
    }

    // Cleanup: stop scanning when component unmounts or session changes
    return () => {
      stopScanning();
    };
  }, [selectedSessionId]);

  // Filter sessions based on 2-Hour Rule - STRICTLY TODAY ONLY
  const getFilteredSessions = (): ISession[] => {
    // Helper function to check if a date is today (explicit day/month/year comparison)
    const isToday = (dateString: string | Date): boolean => {
      const today = new Date();
      const check = new Date(dateString);
      return today.getDate() === check.getDate() &&
             today.getMonth() === check.getMonth() &&
             today.getFullYear() === check.getFullYear();
    };

    const now = new Date();

    return sessions.filter(session => {
      try {
        // 1. Strict Day Check: MUST be today
        if (!isToday(session.startDate)) return false;

        // 2. Cancellation Check
        if (session.isCancelled) return false;

        // 3. Time Window Check (Start Time)
        // Parse session start time (e.g., "11:00")
        const [startHours, startMinutes] = session.startTime.split(':').map(Number);
        const sessionStart = new Date();
        sessionStart.setHours(startHours, startMinutes, 0, 0);

        // Create "Scan Window Open" time (2 hours before start)
        const scanWindowOpen = new Date(sessionStart);
        scanWindowOpen.setHours(sessionStart.getHours() - 2);

        // 4. Time Window Check (End Time + 10 mins buffer)
        const [endHours, endMinutes] = session.endTime.split(':').map(Number);
        const sessionEnd = new Date();
        sessionEnd.setHours(endHours, endMinutes, 0, 0);

        const scanWindowClose = new Date(sessionEnd);
        scanWindowClose.setMinutes(sessionEnd.getMinutes() + 10); // 10 min buffer

        // Final Logic: Must be TODAY + Inside the Time Window
        return now >= scanWindowOpen && now <= scanWindowClose;
      } catch (err) {
        console.error('Error filtering session:', err);
        return false;
      }
    });
  };

  // Get session status (Live or Upcoming)
  const getSessionStatus = (session: ISession): { type: 'live' | 'upcoming'; minutesUntilStart?: number } => {
    try {
      const now = new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [startHour, startMinute] = session.startTime.split(':').map(Number);
      const [endHour, endMinute] = session.endTime.split(':').map(Number);

      let sessionStartDateTime: Date;
      let sessionEndDateTime: Date;

      if (session.frequency === 'OneTime') {
        sessionStartDateTime = new Date(session.startDate);
        sessionStartDateTime.setHours(startHour, startMinute, 0, 0);
        sessionEndDateTime = new Date(session.startDate);
        sessionEndDateTime.setHours(endHour, endMinute, 59, 999);
      } else {
        sessionStartDateTime = new Date(today);
        sessionStartDateTime.setHours(startHour, startMinute, 0, 0);
        sessionEndDateTime = new Date(today);
        sessionEndDateTime.setHours(endHour, endMinute, 59, 999);
      }

      if (now >= sessionStartDateTime && now <= sessionEndDateTime) {
        return { type: 'live' };
      } else if (sessionStartDateTime > now) {
        const minutesUntilStart = Math.floor((sessionStartDateTime.getTime() - now.getTime()) / (1000 * 60));
        return { type: 'upcoming', minutesUntilStart };
      }

      return { type: 'upcoming', minutesUntilStart: 0 };
    } catch {
      return { type: 'upcoming', minutesUntilStart: 0 };
    }
  };

  const formatTime = (timeString: string) => {
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

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString;
      }
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const startScanning = async () => {
    // Prevent starting if already scanning or if scanner is paused
    if (isScanning || scannerRef.current || isScannerPaused || !selectedSessionId) {
      return;
    }

    try {
      setCameraError(false);
      setMessageType('info');
      setMessage('Starting camera...');
      
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
          if (!isScannerPaused && !isProcessing) {
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
      console.error('Error starting QR scanner:', err);
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
        console.error('Error stopping scanner:', err);
      } finally {
        scannerRef.current = null;
        setIsScanning(false);
      }
    }
  };

  const handleScan = async (scannedQRContent: string) => {
    if (isProcessing || !scannedQRContent || isScannerPaused) return;

    // PAUSE SCANNER IMMEDIATELY to prevent multiple scans
    setIsScannerPaused(true);
    
    // Stop scanning immediately
    await stopScanning();

    // Parse sessionId from QR content (handles both URL and raw sessionId)
    const extractedSessionId = extractSessionIdFromQR(scannedQRContent);
    
    if (!extractedSessionId) {
      setMessageType('error');
      setMessage('Invalid QR code. Please scan a valid session QR code.');
      setIsProcessing(false);
      setIsScannerPaused(false);
      return;
    }

    // Validate that scanned QR matches selected session (if one is selected)
    if (selectedSessionId && extractedSessionId !== selectedSessionId) {
      setMessageType('error');
      setMessage('QR code does not match the selected session. Please scan the correct QR code.');
      setIsProcessing(false);
      setIsScannerPaused(false);
      return;
    }

    // Use extracted sessionId (from QR) or selectedSessionId as fallback
    const sessionId = extractedSessionId || selectedSessionId;
    
    if (!sessionId) {
      setMessageType('error');
      setMessage('Could not determine session ID. Please try again.');
      setIsProcessing(false);
      setIsScannerPaused(false);
      return;
    }

    setIsProcessing(true);
    setMessageType('info');
    setMessage('QR Code detected! Getting your location...');

    // 1. Get User's Geolocation
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // 2. Location successful
        setMessageType('info');
        setMessage('Location found. Verifying attendance...');
        const userLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        // 3. Get GPS accuracy and timestamp (REQUIRED)
        const accuracy = position.coords.accuracy; // Accuracy in meters (required)
        if (!accuracy || accuracy <= 0) {
          setMessageType('error');
          setMessage('GPS accuracy data is missing. Please enable high-accuracy GPS and try again.');
          setIsProcessing(false);
          setIsScannerPaused(false);
          return;
        }
        const timestamp = Date.now(); // Timestamp in milliseconds (number)

        // 4. Get the unique device ID and user agent
        const deviceId = getOrCreateDeviceId();
        const userAgent = navigator.userAgent;

        // 5. Call the backend API with MapmyIndia verification data
        markAttendance(sessionId, userLocation, deviceId, userAgent, accuracy, timestamp);
      },
      (error) => {
        // 2. Location failed
        setMessageType('error');
        setMessage(`Error: Could not get location. Please enable GPS. (${error.message})`);
        setIsProcessing(false);
      },
      { 
        enableHighAccuracy: true, 
        timeout: 10000,
        maximumAge: 0 // Always fetch fresh GPS, no caching
      }
    );
  };

  // This function sends all data to our backend
  const markAttendance = async (
    sessionId: string, 
    userLocation: { latitude: number; longitude: number }, 
    deviceId: string, 
    userAgent: string,
    accuracy: number,
    timestamp: number
  ) => {
    // Validate location before sending
    if (!userLocation || typeof userLocation.latitude !== 'number' || typeof userLocation.longitude !== 'number') {
      setMessageType('error');
      setMessage('Location data is invalid. Please enable GPS and try again.');
      setIsProcessing(false);
      setIsScannerPaused(false);
      return;
    }

    // Validate location is not (0,0) - common default/error value
    if (userLocation.latitude === 0 && userLocation.longitude === 0) {
      setMessageType('error');
      setMessage('Invalid location detected. Please ensure GPS is enabled and try again.');
      setIsProcessing(false);
      setIsScannerPaused(false);
      return;
    }

    try {
      console.log('[ATTENDANCE_SCAN] Sending request:', {
        sessionId,
        userLocation,
        deviceId: deviceId.substring(0, 8) + '...', // Log partial deviceId for privacy
        userAgent: userAgent.substring(0, 50) + '...', // Log partial userAgent
        scanSource: 'web_scanner'
      });

      const { data } = await api.post('/api/attendance/scan', {
        sessionId,
        userLocation,
        deviceId, // Send the device "fingerprint"
        userAgent, // Send the browser/OS signature
        accuracy, // GPS accuracy in meters (required for MapmyIndia)
        timestamp, // Timestamp of GPS reading
      });

      setMessageType('success');
      setMessage(data.msg || 'Attendance marked successfully!');
      setIsSuccess(true);
      setIsProcessing(false);
    } catch (err: any) {
      // Extract the exact error message from backend
      const errorMsg = err.response?.data?.msg || err.response?.data?.errors?.[0]?.msg || 'Failed to mark attendance';
      const errorType = err.response?.data?.type;
      
      // Check for 403/Device Mismatch error specifically
      if (err.response?.status === 403 && (errorMsg.includes('Security Alert') || errorMsg.includes('Device Mismatch') || errorMsg.includes('Cloning detected') || errorMsg.includes('device registration'))) {
        // Show Modal with user-friendly explanation
        setShowDeviceMismatchModal(true);
        setIsProcessing(false);
      } else if (errorType === 'TOO_EARLY' || errorMsg.includes('Attendance not yet open')) {
        // Show "Too Early" modal with countdown info
        setTooEarlyInfo({
          sessionStartTime: err.response?.data?.sessionStartTime || '',
          scanWindowStartTime: err.response?.data?.scanWindowStartTime || '',
          hoursRemaining: err.response?.data?.hoursRemaining || 0,
          minutesRemaining: err.response?.data?.minutesRemaining || 0,
        });
        setShowTooEarlyModal(true);
        setIsProcessing(false);
      } else {
        setMessageType('error');
        setMessage(errorMsg); // Show the exact backend error message
        setIsProcessing(false);
      }
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
    stopScanning();
  };

  // If selectedSessionId is set, show the Scanner View
  if (selectedSessionId) {
    // Success State
    if (isSuccess) {
      return (
        <div className="group/design-root relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark">
          <div className="layout-container flex h-full grow flex-col">
            <div className="flex flex-1 items-center justify-center bg-background-light p-4 dark:bg-background-dark">
              <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-xl bg-white p-8 text-center shadow-lg dark:bg-gray-800">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/50">
                  <span className="material-symbols-outlined text-green-600 dark:text-green-400" style={{ fontSize: '40px' }}>check</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <p className="text-lg font-bold leading-tight tracking-[-0.015em] text-[#181511] dark:text-white">Attendance Marked!</p>
                  {message && (
                    <p className="text-sm font-normal leading-normal text-[#8a7b60] dark:text-gray-400">{message}</p>
                  )}
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
                    className="flex flex-1 h-10 min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-primary px-4 text-sm font-bold leading-normal tracking-[0.015em] text-white hover:bg-[#d63a25] transition-colors"
                  >
                    <span className="truncate">Scan Again</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Error State (non-camera errors)
    if (messageType === 'error' && !cameraError) {
      return (
        <div className="group/design-root relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark">
          <div className="layout-container flex h-full grow flex-col">
            <div className="flex flex-1 items-center justify-center bg-background-light p-4 dark:bg-background-dark">
              <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-xl bg-white p-8 text-center shadow-lg dark:bg-gray-800">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50">
                  <span className="material-symbols-outlined text-red-600 dark:text-red-400" style={{ fontSize: '40px' }}>close</span>
                </div>
                <div className="flex max-w-[480px] flex-col items-center gap-2">
                  <p className="text-lg font-bold leading-tight tracking-[-0.015em] text-[#181511] dark:text-white">Scan Failed</p>
                  <p className="text-sm font-normal leading-normal text-[#181511] dark:text-gray-300">{message || 'Invalid QR code. Please try again.'}</p>
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
                    <span className="truncate">Retry Scan</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
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
  
  // Filter sessions to only show those where the current user is assigned
  const myScanSessions = filteredSessions.filter(session => {
    if (!user) return false;
    if (!session.assignedUsers || !Array.isArray(session.assignedUsers)) return false;
    
    // Check if user is in assignedUsers by userId or email
    return session.assignedUsers.some(u => 
      u.userId === user.id || u.email === user.email
    );
  });

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
                const status = getSessionStatus(session);
                const isLive = status.type === 'live';

                return (
                  <div
                    key={session._id}
                    onClick={() => setSelectedSessionId(session._id)}
                    className={`relative flex flex-col rounded-xl border-2 p-4 md:p-6 shadow-sm hover:shadow-md transition-all cursor-pointer ${
                      isLive
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
                    {status.type === 'upcoming' && status.minutesUntilStart !== undefined && (
                      <div className="absolute top-4 right-4">
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold border border-blue-300 dark:border-blue-700">
                          <span className="material-symbols-outlined text-sm">schedule</span>
                          <span>Starts in {status.minutesUntilStart} {status.minutesUntilStart === 1 ? 'minute' : 'minutes'}</span>
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
                          <span>{formatDate(session.startDate)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-slate-500 dark:text-slate-400 text-lg">schedule</span>
                          <span>{formatTime(session.startTime)} - {formatTime(session.endTime)}</span>
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
