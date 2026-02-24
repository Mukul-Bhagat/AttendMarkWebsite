import React, { useState, useEffect } from 'react';
import api from '../api';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { ISession } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { formatIST } from '../utils/time';
import ModeBadge from '../components/ModeBadge';
import { normalizeSessionMode } from '../utils/sessionMode';
import SkeletonCard from '../components/SkeletonCard';

import { appLogger } from '../shared/logger';
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

  // Redirect End Users to scanner instead of showing details page
  useEffect(() => {
    if (isEndUser && id) {
      navigate(`/scan?sessionId=${id}`, { replace: true });
    }
  }, [isEndUser, id, navigate]);

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

  useEffect(() => {
    if (!id || isEndUser || !session || session.isCancelled) {
      return;
    }

    const fetchQrToken = async () => {
      try {
        setIsQrLoading(true);
        setQrTokenError('');

        const query = new URLSearchParams(location.search);
        const dateParam = query.get('date');
        const requestUrl = dateParam
          ? `/api/sessions/${id}/qr-token?date=${encodeURIComponent(dateParam)}`
          : `/api/sessions/${id}/qr-token`;

        const { data } = await api.get(requestUrl);
        setQrToken(data?.token || '');
        setQrExpiresAt(data?.expiresAt || null);
      } catch (err: any) {
        setQrToken('');
        setQrExpiresAt(null);
        setQrTokenError('Unable to generate secure QR token. Falling back to legacy QR.');
        appLogger.error('Failed to fetch QR token:', err);
      } finally {
        setIsQrLoading(false);
      }
    };

    fetchQrToken();
  }, [id, isEndUser, session, location.search]);

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

  // The value of the QR code will be a deep link URL to the scan page
  // This allows students to scan with their system camera or Google Lens
  const qrValue = qrToken
    ? `${window.location.origin}/scan?token=${encodeURIComponent(qrToken)}`
    : session._id
      ? `${window.location.origin}/scan?sessionId=${session._id}`
      : '';

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
                      {(() => {
                        const query = new URLSearchParams(location.search);
                        const dateParam = query.get('date');
                        if (dateParam) return formatDate(dateParam);
                        return session.endDate
                          ? `${formatDate(session.startDate)} - ${formatDate(session.endDate)}`
                          : formatDate(session.startDate);
                      })()}
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
                  <h2 className="text-xl font-semibold text-[#181511] dark:text-white mb-6">Scan this code for attendance</h2>
                  <div className="w-64 h-64 sm:w-80 sm:h-80 border border-gray-200 dark:border-gray-700 rounded-lg flex items-center justify-center p-4 mx-auto bg-gray-50 dark:bg-background-dark">
                    <QRCodeSVG
                      value={qrValue}
                      size={256}
                      level={'H'}
                      includeMargin={true}
                    />
                  </div>
                  {isQrLoading && (
                    <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Generating secure QR token...</p>
                  )}
                  {!isQrLoading && qrExpiresAt && (
                    <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                      Expires at {new Date(qrExpiresAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                  {qrTokenError && (
                    <p className="mt-3 text-xs text-orange-600 dark:text-orange-400">{qrTokenError}</p>
                  )}
                </div>
                <footer className="mt-6 w-full">
                  <span className="inline-block bg-gray-100 dark:bg-background-dark text-[#181511] dark:text-gray-300 px-3 py-1 rounded-md font-mono text-sm mb-3 break-all">
                    Session ID: {session._id}
                  </span>
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic mb-2">
                    Students can scan this with their system camera or Google Lens to mark attendance.
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                    The QR code contains a deep link that will automatically open the attendance page.
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
