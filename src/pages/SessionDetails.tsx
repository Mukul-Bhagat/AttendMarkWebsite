import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { ISession } from '../types';
import { QRCodeCanvas } from 'qrcode.react';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { formatIST, nowIST, toISTDateString } from '../utils/time';
import ModeBadge from '../components/ModeBadge';
import { normalizeSessionMode } from '../utils/sessionMode';
import SkeletonCard from '../components/SkeletonCard';
import AttendanceHub from './AttendanceHub';

import { appLogger } from '../shared/logger';

const QR_TOKEN_MAX_ATTEMPTS = 3;
const QR_TOKEN_RETRY_DELAY_MS = 400;
const QR_CACHE_EXPIRY_BUFFER_MS = 10 * 1000;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type CachedQrTokenPayload = {
  token: string;
  expiresAt: string;
  cachedAt: number;
};

const buildQrCacheKey = (sessionId: string, dateKey?: string) =>
  `attendmark:qr:${sessionId}:${dateKey || 'today'}`;

const readCachedQrToken = (cacheKey: string): CachedQrTokenPayload | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedQrTokenPayload;
    if (!parsed?.token || !parsed?.expiresAt) {
      return null;
    }
    const expiresAtMs = Date.parse(parsed.expiresAt);
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowIST() + QR_CACHE_EXPIRY_BUFFER_MS) {
      window.sessionStorage.removeItem(cacheKey);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const writeCachedQrToken = (cacheKey: string, payload: CachedQrTokenPayload) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(cacheKey, JSON.stringify(payload));
  } catch {
    // Best-effort cache only.
  }
};

const extractErrorStatus = (error: unknown): number | undefined => {
  const candidate = (error as { response?: { status?: unknown } })?.response?.status;
  return typeof candidate === 'number' ? candidate : undefined;
};

const extractErrorMessage = (error: unknown): string => {
  if (error instanceof Error && typeof error.message === 'string') {
    return error.message;
  }
  return '';
};

const extractBackendMsg = (error: unknown): string => {
  const candidate = (error as { response?: { data?: { msg?: unknown } } })?.response?.data?.msg;
  return typeof candidate === 'string' ? candidate : '';
};

const SessionDetails: React.FC = () => {
  const [session, setSession] = useState<ISession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [qrToken, setQrToken] = useState('');
  const [qrExpiresAt, setQrExpiresAt] = useState<string | null>(null);
  const [qrTokenError, setQrTokenError] = useState('');
  const [isQrLoading, setIsQrLoading] = useState(false);
  const [isSharingQr, setIsSharingQr] = useState(false);
  const [qrSecondsRemaining, setQrSecondsRemaining] = useState<number | null>(null);
  const qrCanvasWrapperRef = useRef<HTMLDivElement | null>(null);
  const qrTokenRef = useRef('');
  const qrExpiresAtRef = useRef<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isSuperAdmin, isSessionAdmin, isEndUser } = useAuth();

  const { id: paramId } = useParams<{ id: string }>(); // Get the session ID from the URL

  // Backward Capability: Handle composite IDs (sessionId_YYYY-MM-DD)
  // If the ID contains '_', split it. The first part is the ID, the second part 'might' be useful but we prefer query params.
  const id = (paramId || '').includes('_') ? (paramId || '').split('_')[0] : paramId;

  // 🛡️ DEV GUARD: Warn about legacy composite routes
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && paramId?.includes('_')) {
      appLogger.warn(
        '🚨 [LEGACY ROUTE DETECTED] Composite sessionId used:',
        paramId,
        '\n👉 Please use /sessions/:id?date=YYYY-MM-DD instead.'
      );
    }
  }, [paramId]);

  // Check if user can manage this session
  const canManageSession = () => {
    if (!session || !user) return false;
    if (isSuperAdmin) return true;
    if (isSessionAdmin && session.sessionAdmin === user.id) return true;
    return false;
  };

  // 🛡️ AUTO-MIGRATE LEGACY URLS
  // Converts /sessions/XXX_DATE -> /sessions/XXX?date=DATE
  useEffect(() => {
    if (paramId && paramId.includes('_')) {
      const [cleanId, legacyDate] = paramId.split('_');
      const query = new URLSearchParams(location.search); // Use fresh search params
      const date = query.get('date') || legacyDate;

      appLogger.warn(
        '[LEGACY ROUTE AUTO-FIXED]',
        paramId,
        '→',
        `/sessions/${cleanId}?date=${date}`
      );

      navigate(`/sessions/${cleanId}?date=${date}`, { replace: true });
    }
  }, [paramId, location.search, navigate]);

  useEffect(() => {
    // Don't fetch session data if user is an End User (they'll be redirected)
    if (isEndUser) {
      return;
    }

    const fetchSession = async () => {
      if (!id) {
        setError('Invalid class/batch ID.');
        setIsLoading(false);
        return;
      }

      try {
        // Use proper details endpoint with date context
        const query = new URLSearchParams(location.search);
        const dateParam = query.get('date');

        // If date exists, fetch details, otherwise fallback to standard fetch
        const requestUrl = dateParam
          ? `/api/sessions/${id}/details?date=${dateParam}`
          : `/api/sessions/${id}`;

        const { data } = await api.get(requestUrl);

        // Handle combined payload or standard payload
        if (data.session) {
          setSession(data.session);
        } else {
          setSession(data);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        if (err.response?.status === 401) {
          setError('You are not authorized to view this class/batch.');
        } else if (err.response?.status === 404) {
          setError('Class/Batch not found.');
        } else {
          setError('Failed to load class/batch. Please try again.');
        }
        appLogger.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();
  }, [id, isEndUser, location.search]);

  const query = new URLSearchParams(location.search);
  const queryDate = query.get('date');
  const qrDateSource = queryDate || session?.occurrenceDate || session?.startDate;
  const qrDateKey = qrDateSource ? toISTDateString(qrDateSource) : null;
  const todayKey = toISTDateString(nowIST());
  const isQrDayActive = Boolean(qrDateKey && qrDateKey === todayKey);

  useEffect(() => {
    qrTokenRef.current = qrToken;
    qrExpiresAtRef.current = qrExpiresAt;
  }, [qrToken, qrExpiresAt]);

  useEffect(() => {
    if (!session) return;
    if (!isQrDayActive) {
      setQrToken('');
      setQrExpiresAt(null);
      setQrTokenError('');
      setIsQrLoading(false);
    }
  }, [session, isQrDayActive]);

  useEffect(() => {
    if (!id || isEndUser || !session || session.isCancelled || !isQrDayActive) {
      return;
    }

    let isStale = false;

    const fetchQrToken = async () => {
      const existingTokenAtStart = qrTokenRef.current;
      const existingExpiresAt = qrExpiresAtRef.current;
      setQrTokenError('');

      const query = new URLSearchParams(location.search);
      const dateParam = query.get('date');
      const resolvedDate = session?.occurrenceDate || dateParam || undefined;
      const qrSessionId = session?._id || id;
      const requestUrl = resolvedDate
        ? `/api/sessions/${qrSessionId}/qr-token?date=${encodeURIComponent(resolvedDate)}`
        : `/api/sessions/${qrSessionId}/qr-token`;
      const cacheKey = buildQrCacheKey(qrSessionId, resolvedDate);
      const cachedToken = readCachedQrToken(cacheKey);

      if (cachedToken) {
        setQrToken(cachedToken.token);
        setQrExpiresAt(cachedToken.expiresAt);
      }

      setIsQrLoading(true);

      let lastError: unknown = null;

      for (let attempt = 1; attempt <= QR_TOKEN_MAX_ATTEMPTS; attempt += 1) {
        try {
          const { data } = await api.get(requestUrl);
          if (isStale) return;

          const token = typeof data?.token === 'string' ? data.token : '';
          if (!token) {
            throw new Error('QR token missing in response');
          }

          setQrToken(token);
          setQrExpiresAt(data?.expiresAt || null);
          setQrTokenError('');
          if (data?.expiresAt) {
            writeCachedQrToken(cacheKey, {
              token,
              expiresAt: data.expiresAt,
              cachedAt: nowIST(),
            });
          }
          return;
        } catch (err: unknown) {
          lastError = err;
          const status = extractErrorStatus(err);
          const shouldRetry = (!status || status >= 500) && attempt < QR_TOKEN_MAX_ATTEMPTS;
          appLogger.error('Failed to fetch QR token:', {
            attempt,
            status,
            message: extractErrorMessage(err),
          });

          if (!shouldRetry) {
            break;
          }

          await wait(QR_TOKEN_RETRY_DELAY_MS * attempt);
        }
      }

      if (isStale) return;
      const backendMessage = extractBackendMsg(lastError);
      const hasUnexpiredCurrentToken = Boolean(
        existingTokenAtStart &&
        existingExpiresAt &&
        Date.parse(existingExpiresAt) > nowIST() + QR_CACHE_EXPIRY_BUFFER_MS,
      );
      const hasFallbackToken = Boolean(cachedToken?.token || hasUnexpiredCurrentToken);
      if (hasFallbackToken) {
        setQrTokenError('Live refresh failed. Showing the last valid secure QR.');
        return;
      }
      setQrTokenError(backendMessage || 'Unable to generate secure QR token. Please refresh and try again.');
      setQrToken('');
      setQrExpiresAt(null);
    };

    fetchQrToken().finally(() => {
      if (!isStale) {
        setIsQrLoading(false);
      }
    });

    return () => {
      isStale = true;
    };
  }, [id, isEndUser, session, session?._id, session?.occurrenceDate, session?.isCancelled, location.search, isQrDayActive]);

  useEffect(() => {
    if (!qrExpiresAt) {
      setQrSecondsRemaining(null);
      return;
    }

    const expiresAtMs = Date.parse(qrExpiresAt);
    if (!Number.isFinite(expiresAtMs)) {
      setQrSecondsRemaining(null);
      return;
    }

    const updateRemaining = () => {
      const nextSeconds = Math.floor((expiresAtMs - nowIST()) / 1000);
      setQrSecondsRemaining(nextSeconds > 0 ? nextSeconds : 0);
    };

    updateRemaining();
    const timerId = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timerId);
  }, [qrExpiresAt]);

  const formatQrCountdown = (totalSeconds: number) => {
    const safeSeconds = totalSeconds > 0 ? totalSeconds : 0;
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  };

  const handleShareQrImage = async () => {
    if (!session || !qrToken || isQrLoading || isSharingQr) return;

    const canvas = qrCanvasWrapperRef.current?.querySelector('canvas');
    if (!canvas) {
      setQrTokenError('QR is still rendering. Please try again.');
      return;
    }

    setIsSharingQr(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((value) => resolve(value), 'image/png');
      });

      if (!blob) {
        throw new Error('QR image conversion failed');
      }

      const fileName = `attendmark-qr-${(session._id || 'session').slice(0, 8)}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });
      const nav = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
      };

      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({
          files: [file],
          title: 'AttendMark Session QR',
        });
      } else {
        const imageUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(imageUrl);
      }
    } catch (err) {
      appLogger.error('Failed to share QR image:', err);
      setQrTokenError('Unable to share QR image right now.');
    } finally {
      setIsSharingQr(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setIsSubmitting(true);
    try {
      await api.delete(`/api/sessions/${id}`);
      navigate('/classes');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to delete session');
    } finally {
      setIsSubmitting(false);
      setShowDeleteModal(false);
    }
  };

  const handleCancel = async () => {
    if (!id) return;
    setIsSubmitting(true);
    try {
      await api.put(`/api/sessions/${id}`, {
        isCancelled: true,
        cancellationReason: cancellationReason.trim() || undefined,
      });
      // Refresh session data
      const { data } = await api.get(`/api/sessions/${id}`);
      setSession(data);
      setShowCancelModal(false);
      setCancellationReason('');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to cancel session');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeCancellation = async () => {
    if (!id) return;
    setIsSubmitting(true);
    try {
      await api.put(`/api/sessions/${id}`, {
        isCancelled: false,
      });
      // Refresh session data
      const { data } = await api.get(`/api/sessions/${id}`);
      setSession(data);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to revoke cancellation');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine back navigation URL based on classBatchId
  const getBackUrl = () => {
    if (session?.classBatchId && typeof session.classBatchId === 'object' && session.classBatchId._id) {
      return `/classes/${session.classBatchId._id}/sessions`;
    }
    return '/classes';
  };

  if (isEndUser) {
    return <AttendanceHub />;
  }

  if (isLoading) {
    return (
      <div className="relative flex h-auto min-h-screen w-full flex-col group/design-root overflow-x-hidden bg-background-light dark:bg-background-dark font-display text-[#181511] dark:text-gray-200">
        <div className="layout-container flex h-full grow flex-col">
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <header className="mb-8">
              <div className="flex min-w-[84px] max-w-[480px] items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-[#f5f3f0] dark:bg-background-dark/50 border border-gray-300 dark:border-gray-700 opacity-50 mb-4 w-32">
                <ArrowLeft className="w-4 h-4 mr-2" />
                <span>Back</span>
              </div>
            </header>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
              <SkeletonCard variant="card" className="h-[500px]" />
              <SkeletonCard variant="card" className="h-[500px]" />
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="relative flex h-auto min-h-screen w-full flex-col group/design-root overflow-x-hidden bg-background-light dark:bg-background-dark font-display text-[#181511] dark:text-gray-200">
        <div className="layout-container flex h-full grow flex-col">
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <header className="mb-8">
              <Link
                to="/classes"
                className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-[#f5f3f0] dark:bg-background-dark/50 text-[#181511] dark:text-gray-200 gap-2 text-sm font-bold leading-normal tracking-[0.015em] border border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-background-dark"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="truncate">Back to Classes</span>
              </Link>
            </header>
            <div className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800 p-4 rounded-xl flex items-center mb-4">
              <span className="material-symbols-outlined mr-2">error</span>
              {error || 'Class/Batch not found.'}
            </div>
          </main>
        </div>
      </div>
    );
  }

  const configuredUniversalScanBaseUrl =
    (import.meta.env.VITE_UNIVERSAL_SCAN_BASE_URL as string | undefined)?.trim();
  const useCompactQrPayload =
    ((import.meta.env.VITE_QR_COMPACT_PAYLOAD as string | undefined)?.trim() || 'true') !== 'false';
  const runtimeScanBaseUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin.replace(/\/+$/, '')}/scan`
      : 'https://attendmark.com/scan';
  const universalScanBaseUrl = configuredUniversalScanBaseUrl || runtimeScanBaseUrl;
  const qrValue = qrToken
    ? (useCompactQrPayload
      ? qrToken
      : `${universalScanBaseUrl}?token=${encodeURIComponent(qrToken)}`)
    : '';
  const hasQrValue = Boolean(qrValue);
  const showQrLoadingState = isQrLoading || (!hasQrValue && !qrTokenError);
  const isQrNearExpiry = typeof qrSecondsRemaining === 'number' && qrSecondsRemaining <= 60;

  const formatDate = (dateString: string) => {
    try {
      // eslint-disable-next-line no-restricted-syntax
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString; // Return original if invalid
      }
      return formatIST(date.getTime(), {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'Asia/Kolkata',
      });
    } catch {
      return dateString; // Return original if error
    }
  };

  const formatFrequency = (frequency: string) => {
    const freqMap: { [key: string]: string } = {
      OneTime: 'One Time',
      Daily: 'Daily',
      Weekly: 'Weekly',
      Monthly: 'Monthly',
    };
    return freqMap[frequency] || frequency;
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

  const qrDateLabel = qrDateSource ? formatDate(qrDateSource) : 'N/A';
  const qrClassName =
    session.classBatchId && typeof session.classBatchId === 'object'
      ? (session.classBatchId.name || 'N/A')
      : 'N/A';
  const qrOrganizationName = user?.organizationName || user?.organization || 'N/A';

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col group/design-root overflow-x-hidden bg-background-light dark:bg-background-dark font-display text-[#181511] dark:text-gray-200">
      <div className="layout-container flex h-full grow flex-col">
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <header className="mb-8">
            <Link
              to={getBackUrl()}
              className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-[#f5f3f0] dark:bg-background-dark/50 text-[#181511] dark:text-gray-200 gap-2 text-sm font-bold leading-normal tracking-[0.015em] border border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-background-dark"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="truncate">Back to Class Sessions</span>
            </Link>
          </header>

          {/* Management Section */}
          {canManageSession() && (
            <div className="mb-6 flex flex-wrap gap-3">
              {!session.isCancelled ? (
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">cancel</span>
                  Cancel Session
                </button>
              ) : (
                <button
                  onClick={handleRevokeCancellation}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-lg">undo</span>
                  Revoke Cancellation
                </button>
              )}
              <button
                onClick={() => setShowDeleteModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                <span className="material-symbols-outlined text-lg">delete</span>
                Delete Session
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Column 1: Session Information */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 sm:p-8 relative">
              {session.isCancelled && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/30 dark:bg-black/40 backdrop-blur-md rounded-xl">
                  <div className="bg-red-100 dark:bg-red-900/80 text-red-800 dark:text-white rounded-lg p-6 max-w-md mx-4 shadow-lg border-2 border-red-300 dark:border-red-700">
                    <div className="text-center">
                      <span className="material-symbols-outlined text-5xl text-red-600 dark:text-red-400 mb-3">warning</span>
                      <h3 className="text-xl font-bold text-red-800 dark:text-white mb-3">
                        ⚠️ Session Cancelled
                      </h3>
                      {session.cancellationReason && (
                        <div className="mt-4 pt-4 border-t border-red-300 dark:border-red-700">
                          <p className="text-sm font-semibold text-red-700 dark:text-red-200 mb-2">Cancellation Reason:</p>
                          <p className="text-base text-red-900 dark:text-white leading-relaxed">
                            {session.cancellationReason}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              <div className="flex min-w-72 flex-col gap-2 mb-6">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-[#181511] dark:text-white text-3xl font-black leading-tight tracking-[-0.033em]">{session.name}</p>
                  <ModeBadge mode={normalizeSessionMode(session.sessionType || session.locationType)} size="md" />
                </div>
                {session.description && (
                  <p className="text-[#8a7b60] dark:text-gray-400 text-base font-normal leading-normal">{session.description}</p>
                )}
              </div>

              <div className="space-y-3">
                {/* Frequency */}
                <div className="flex items-center gap-4 px-0 min-h-14 justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-[#181511] dark:text-gray-200 flex items-center justify-center rounded-lg bg-[#f5f3f0] dark:bg-background-dark/50 shrink-0 size-10">
                      <span className="material-symbols-outlined">repeat</span>
                    </div>
                    <p className="text-[#181511] dark:text-gray-200 text-base font-medium leading-normal flex-1 truncate">Frequency</p>
                  </div>
                  <div className="shrink-0">
                    <p className="text-[#181511] dark:text-gray-200 text-base font-normal leading-normal">{formatFrequency(session.frequency)}</p>
                  </div>
                </div>

                {/* Date */}
                <div className="flex items-center gap-4 px-0 min-h-14 justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-[#181511] dark:text-gray-200 flex items-center justify-center rounded-lg bg-[#f5f3f0] dark:bg-background-dark/50 shrink-0 size-10">
                      <span className="material-symbols-outlined">calendar_month</span>
                    </div>
                    <p className="text-[#181511] dark:text-gray-200 text-base font-medium leading-normal flex-1 truncate">Date</p>
                  </div>
                  <div className="shrink-0">
                    <p className="text-[#181511] dark:text-gray-200 text-base font-normal leading-normal">
                      {queryDate
                        ? formatDate(queryDate)
                        : session.endDate
                          ? `${formatDate(session.startDate)} - ${formatDate(session.endDate)}`
                          : formatDate(session.startDate)}
                    </p>
                  </div>
                </div>

                {/* Time */}
                <div className="flex items-center gap-4 px-0 min-h-14 justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-[#181511] dark:text-gray-200 flex items-center justify-center rounded-lg bg-[#f5f3f0] dark:bg-background-dark/50 shrink-0 size-10">
                      <span className="material-symbols-outlined">schedule</span>
                    </div>
                    <p className="text-[#181511] dark:text-gray-200 text-base font-medium leading-normal flex-1 truncate">Time</p>
                  </div>
                  <div className="shrink-0">
                    <p className="text-[#181511] dark:text-gray-200 text-base font-normal leading-normal">
                      {formatTime(session.startTime)} - {formatTime(session.endTime)}
                    </p>
                  </div>
                </div>

                {/* Location */}
                <div className="flex items-start gap-4 px-0 min-h-14">
                  <div className="flex items-center gap-4">
                    <div className="text-[#181511] dark:text-gray-200 flex items-center justify-center rounded-lg bg-[#f5f3f0] dark:bg-background-dark/50 shrink-0 size-10 mt-1">
                      <span className="material-symbols-outlined">location_on</span>
                    </div>
                  </div>
                  <div className="flex flex-col flex-1">
                    <div className="flex justify-between w-full">
                      <p className="text-[#181511] dark:text-gray-200 text-base font-medium leading-normal truncate">Location Type</p>
                      <p className="text-[#181511] dark:text-gray-200 text-base font-normal leading-normal">{session.locationType}</p>
                    </div>
                    {session.physicalLocation && (
                      <p className="text-[#181511] dark:text-gray-200 text-sm font-normal leading-normal mt-1">{session.physicalLocation}</p>
                    )}
                    {session.virtualLocation && (
                      <a
                        className="text-blue-500 hover:underline flex items-center mt-1 text-sm"
                        href={session.virtualLocation}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <span className="material-symbols-outlined text-sm mr-1">link</span>
                        Virtual Meeting Link
                      </a>
                    )}
                  </div>
                </div>

                {/* Assigned Users */}
                {session.assignedUsers && Array.isArray(session.assignedUsers) && session.assignedUsers.length > 0 && (
                  <div
                    onClick={() => setShowUsersModal(true)}
                    className="flex items-center gap-4 px-0 min-h-14 justify-between cursor-pointer hover:opacity-70 transition-opacity"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-[#181511] dark:text-gray-200 flex items-center justify-center rounded-lg bg-[#f5f3f0] dark:bg-background-dark/50 shrink-0 size-10">
                        <span className="material-symbols-outlined">group</span>
                      </div>
                      <p className="text-[#181511] dark:text-gray-200 text-base font-medium leading-normal flex-1 truncate">Assigned Users</p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <p className="text-[#181511] dark:text-gray-200 text-base font-normal leading-normal">{session.assignedUsers.length} user(s)</p>
                      <span className="material-symbols-outlined text-gray-400">chevron_right</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Column 2: QR Code */}
            {session.isCancelled && !canManageSession() ? (
              // For non-admin users (End Users), show cancelled message instead of QR code
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl shadow-sm border-2 border-red-300 dark:border-red-800 p-6 sm:p-8 flex flex-col items-center justify-center text-center min-h-[400px]">
                <div className="text-center">
                  <span className="material-symbols-outlined text-7xl text-red-500 dark:text-red-400 mb-6">block</span>
                  <h2 className="text-3xl font-bold text-red-600 dark:text-red-400 mb-6">
                    🚫 Class Cancelled
                  </h2>
                  {session.cancellationReason ? (
                    <div className="mt-4 p-5 bg-white dark:bg-slate-800 rounded-lg border-2 border-red-200 dark:border-red-800 max-w-md mx-auto">
                      <p className="text-sm font-semibold text-red-700 dark:text-red-300 mb-2">Cancellation Reason:</p>
                      <p className="text-base text-red-900 dark:text-white leading-relaxed">
                        {session.cancellationReason}
                      </p>
                    </div>
                  ) : (
                    <p className="text-lg text-red-700 dark:text-red-300 mt-2 font-medium">
                      This session has been cancelled.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 sm:p-8 flex flex-col items-center justify-between text-center relative">
                {session.isCancelled && canManageSession() && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/30 dark:bg-black/40 backdrop-blur-md rounded-xl">
                    <div className="bg-red-100 dark:bg-red-900/80 text-red-800 dark:text-white rounded-lg p-6 max-w-md mx-4 shadow-lg border-2 border-red-300 dark:border-red-700">
                      <div className="text-center">
                        <span className="material-symbols-outlined text-5xl text-red-600 dark:text-red-400 mb-3">warning</span>
                        <h3 className="text-xl font-bold text-red-800 dark:text-white mb-3">
                          ⚠️ Session Cancelled
                        </h3>
                        {session.cancellationReason && (
                          <div className="mt-4 pt-4 border-t border-red-300 dark:border-red-700">
                            <p className="text-sm font-semibold text-red-700 dark:text-red-200 mb-2">Cancellation Reason:</p>
                            <p className="text-base text-red-900 dark:text-white leading-relaxed">
                              {session.cancellationReason}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                <div className="w-full">
                  <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-lg sm:text-xl font-semibold text-[#181511] dark:text-white text-center sm:text-left">
                      Scan this code for attendance
                    </h2>
                    {hasQrValue && isQrDayActive && (
                      <button
                        type="button"
                        onClick={handleShareQrImage}
                        disabled={isSharingQr}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-slate-600 px-3 py-2 text-sm font-medium text-[#181511] dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="material-symbols-outlined text-base">share</span>
                        {isSharingQr ? 'Sharing...' : 'Share QR'}
                      </button>
                    )}
                  </div>
                  {!isQrDayActive ? (
                    <div className="w-full max-w-[320px] aspect-square border border-amber-200 dark:border-amber-700 rounded-lg flex flex-col items-center justify-center p-4 mx-auto bg-amber-50 dark:bg-amber-900/20 text-center">
                      <span className="material-symbols-outlined text-4xl text-amber-500 dark:text-amber-400 mb-2">schedule</span>
                      <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                        QR available on the session day only (IST).
                      </p>
                      <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                        This QR will appear at 12:00 AM IST and close after the day ends.
                      </p>
                    </div>
                  ) : hasQrValue ? (
                    <div
                      ref={qrCanvasWrapperRef}
                      className="w-full max-w-[280px] sm:max-w-[320px] aspect-square border border-gray-200 dark:border-gray-700 rounded-lg flex items-center justify-center p-4 mx-auto bg-gray-50 dark:bg-background-dark"
                    >
                      <QRCodeCanvas value={qrValue} size={240} level="L" includeMargin={true} />
                    </div>
                  ) : showQrLoadingState ? (
                    <div className="w-full max-w-[280px] sm:max-w-[320px] aspect-square border border-gray-200 dark:border-gray-700 rounded-lg flex flex-col items-center justify-center p-4 mx-auto bg-gray-50 dark:bg-background-dark text-center">
                      <span className="material-symbols-outlined text-4xl text-gray-500 dark:text-gray-400 mb-2 animate-spin">progress_activity</span>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Generating secure QR...
                      </p>
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Please wait a moment.
                      </p>
                    </div>
                  ) : (
                    <div className="w-full max-w-[280px] sm:max-w-[320px] aspect-square border border-red-200 dark:border-red-800 rounded-lg flex flex-col items-center justify-center p-4 mx-auto bg-red-50 dark:bg-red-900/20 text-center">
                      <span className="material-symbols-outlined text-4xl text-red-500 dark:text-red-400 mb-2">error</span>
                      <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                        Secure QR unavailable
                      </p>
                      <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                        Please refresh or contact support. Legacy QR is disabled for security.
                      </p>
                    </div>
                  )}
                  {isQrDayActive && isQrLoading && (
                    <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Generating secure QR token...</p>
                  )}
                  {isQrDayActive && !isQrLoading && qrExpiresAt && (
                    <div className="mt-3 space-y-1 text-xs">
                      {typeof qrSecondsRemaining === 'number' && (
                        <p
                          className={
                            isQrNearExpiry
                              ? 'font-semibold text-orange-600 dark:text-orange-400'
                              : 'text-gray-600 dark:text-gray-300'
                          }
                        >
                          Expires in {formatQrCountdown(qrSecondsRemaining)}
                        </p>
                      )}
                      <p className="text-gray-500 dark:text-gray-400">
                        Expires at {formatIST(Date.parse(qrExpiresAt), { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  )}
                  {isQrDayActive && qrTokenError && (
                    <p className="mt-3 text-xs text-orange-600 dark:text-orange-400">{qrTokenError}</p>
                  )}
                  <div className="mt-5 space-y-1 text-left text-xs font-light text-gray-500 dark:text-gray-400">
                    <p>Class: {qrClassName}</p>
                    <p>Session: {session.name}</p>
                    <p>Date: {qrDateLabel}</p>
                    <p>Organization: {qrOrganizationName}</p>
                  </div>
                </div>
                <footer className="mt-6 w-full">
                  <span className="inline-block bg-gray-100 dark:bg-background-dark text-[#181511] dark:text-gray-300 px-3 py-1 rounded-md font-mono text-sm mb-3 break-all">
                    Session ID: {session._id}
                  </span>
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic mb-2">
                    Students can scan this with AttendMark scanner to mark attendance quickly.
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                    Share sends only the QR image.
                  </p>
                </footer>
              </div>
            )}
          </div>

          {/* Delete Confirmation Modal */}
          {showDeleteModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg max-w-md w-full p-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Delete Session</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Are you sure you want to delete this session? This action cannot be undone.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Cancel Session Modal */}
          {showCancelModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg max-w-md w-full p-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Cancel Session</h3>
                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Reason for cancellation (optional, max 30 words)
                </label>
                <textarea
                  value={cancellationReason}
                  onChange={(e) => {
                    const words = e.target.value.trim().split(/\s+/).filter(Boolean);
                    if (words.length <= 30) {
                      setCancellationReason(e.target.value);
                    }
                  }}
                  rows={4}
                  className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="Enter reason for cancellation..."
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {cancellationReason.trim().split(/\s+/).filter(Boolean).length}/30 words
                </p>
                <div className="flex gap-3 justify-end mt-6">
                  <button
                    onClick={() => {
                      setShowCancelModal(false);
                      setCancellationReason('');
                    }}
                    className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'Cancelling...' : 'Cancel Session'}
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* Assigned Users Modal */}
          {showUsersModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg max-w-2xl w-full p-6 flex flex-col max-h-[80vh]">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Assigned Users ({session.assignedUsers?.length})</h3>
                  <button onClick={() => setShowUsersModal(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                <div className="relative mb-4">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400">search</span>
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div className="flex-1 overflow-y-auto">
                  <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                    <thead className="bg-gray-50 dark:bg-slate-700/50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-gray-900 dark:text-white">Name</th>
                        <th className="px-4 py-3 font-semibold text-gray-900 dark:text-white">Email</th>
                        <th className="px-4 py-3 font-semibold text-gray-900 dark:text-white">Mode</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                      {session.assignedUsers
                        ?.filter(u => {
                          const search = userSearch.toLowerCase();
                          const name = `${u.firstName || ''} ${u.lastName || ''}`;
                          return name.toLowerCase().includes(search) ||
                            u.email.toLowerCase().includes(search);
                        })
                        .map((u, i) => (
                          <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                              {u.firstName} {u.lastName}
                            </td>
                            <td className="px-4 py-3">{u.email}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.mode === 'REMOTE'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                                : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'}`}>
                                {u.mode || 'PHYSICAL'}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {session.assignedUsers?.filter(u => {
                    const search = userSearch.toLowerCase();
                    const name = `${u.firstName || ''} ${u.lastName || ''}`;
                    return name.toLowerCase().includes(search) ||
                      u.email.toLowerCase().includes(search);
                  }).length === 0 && (
                      <div className="p-8 text-center text-gray-500">No users found.</div>
                    )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default SessionDetails;
