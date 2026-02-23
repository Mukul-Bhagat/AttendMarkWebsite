import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams, Navigate, useLocation } from 'react-router-dom';
import api from '../api';
import { ISession, IClassBatch } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Eye, Edit, ArrowLeft } from 'lucide-react';
import SessionCalendar from '../components/SessionCalendar';
import ModeBadge from '../components/ModeBadge';
import Toast from '../components/Toast';
import { getSessionStatus, getSessionStartTimeIST, nowIST } from '../utils/sessionStatusUtils';
import { isSameISTDay, toISTDateString } from '../utils/time';
import { normalizeSessionMode } from '../utils/sessionMode';

import { appLogger } from '../shared/logger';
const Sessions: React.FC = () => {
  const navigate = useNavigate();
  const { classId } = useParams<{ classId?: string }>();
  const location = useLocation();
  const { user, isSuperAdmin, isCompanyAdmin, isManager, isSessionAdmin, isEndUser } = useAuth();

  // Safety Check: If no classId in URL, redirect to /classes
  // This ensures users never land on the "Mixed/Global" list view
  if (!classId) {
    return <Navigate to="/classes" replace />;
  }
  const [sessions, setSessions] = useState<ISession[]>([]);
  const [classBatch, setClassBatch] = useState<IClassBatch | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showPastSessions, setShowPastSessions] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);
  const [currentViewDate, setCurrentViewDate] = useState(() => new Date(nowIST())); // Initialize to IST Today
  const [currentTime, setCurrentTime] = useState(nowIST()); // Track current IST timestamp for status calculations
  const calendarRef = useRef<HTMLDivElement>(null);

  // SuperAdmin, CompanyAdmin, Manager, and SessionAdmin can create sessions
  const canCreateSession = isSuperAdmin || isCompanyAdmin || isManager || isSessionAdmin;

  // Check if user can edit a specific session
  const canEditSession = (session: ISession) => {
    if (isSuperAdmin) return true; // SuperAdmin can edit any session
    if (isSessionAdmin && session.sessionAdmin === user?.id) return true; // SessionAdmin can edit their assigned sessions
    return false;
  };

  useEffect(() => {
    const fetchSessions = async () => {
      setIsLoading(true);
      try {
        if (classId) {
          // Fetch sessions for a specific class with Month/Year filtering
          const queryParams = new URLSearchParams({
            year: currentViewDate.getFullYear().toString(),
            month: currentViewDate.getMonth().toString()
          });
          const { data } = await api.get(`/api/classes/${classId}/sessions?${queryParams}`);
          setSessions(data.sessions || []);
          setClassBatch(data.classBatch || null);
        } else {
          // Fetch all sessions (backward compatibility)
          const { data } = await api.get('/api/sessions');
          setSessions(data || []);
        }
      } catch (err: any) {
        if (err.response?.status === 401) {
          setError('You are not authorized. Please log in again.');
        } else {
          setError('Failed to load sessions. Please try again.');
        }
        appLogger.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSessions();
  }, [classId, currentViewDate, location.search]);

  // Refresh data when component comes into focus (e.g., navigating back from edit)
  useEffect(() => {
    const handleFocus = () => {
      if (classId) {
        const fetchSessions = async () => {
          try {
            const queryParams = new URLSearchParams({
              year: currentViewDate.getFullYear().toString(),
              month: currentViewDate.getMonth().toString()
            });
            const { data } = await api.get(`/api/classes/${classId}/sessions?${queryParams}`);
            setSessions(data.sessions || []);
            setClassBatch(data.classBatch || null);
          } catch (err) {
            appLogger.error('Error refreshing sessions:', err);
          }
        };
        fetchSessions();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [classId, currentViewDate]);

  // Refresh session status periodically to keep "Live" and "Past" badges accurate
  // This ensures sessions transition from Live to Past correctly after the 10-minute buffer
  useEffect(() => {
    // Update current time every minute to trigger re-calculation of session statuses
    const interval = setInterval(() => {
      setCurrentTime(nowIST()); // Update to current IST timestamp
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const state = location.state as { toast?: { message: string; type: 'success' | 'error' | 'info' } } | null;
    if (state?.toast) {
      setToast(state.toast);
      navigate(`${location.pathname}${location.search}`, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, location.search, navigate]);



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

  const formatTitleDate = (session: ISession) => {
    try {
      const timestamp = getSessionStartTimeIST(session);
      if (isNaN(timestamp)) return session.name;
      return new Intl.DateTimeFormat('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      }).format(timestamp);
    } catch {
      return session.name;
    }
  };

  // Check if a session is scheduled for today using IST day boundaries
  // Button should be available from 00:00 Midnight (IST) on the day of the session
  const isSessionToday = (session: ISession): boolean => {
    try {
      if (!session.startDate || session.isCancelled) return false;

      // Use IST day comparison - no Date objects!
      const now = nowIST();
      const sessionStartIST = getSessionStartTimeIST(session);

      return isSameISTDay(now, sessionStartIST);
    } catch {
      return false;
    }
  };

  // ============================================
  // SESSION STATUS - NOW USING SHARED UTILITY
  // ============================================
  // All status logic moved to: src/utils/sessionStatusUtils.ts

  // Get session status with validation guard
  const getSessionStatusSafe = (session: ISession) => {
    const status = getSessionStatus(session, currentTime);

    // GUARD: Verify session.startDate display matches status calculation date
    // This prevents the bug where UI shows Jan 7 but status uses Jan 31
    const sessionStartIST = getSessionStartTimeIST(session);

    // Check if displayed date matches calculation date
    // Prefer occurrenceDate as the truth
    const displayedDateOnly = toISTDateString(sessionStartIST);
    const calculationDate = toISTDateString(sessionStartIST);

    if (displayedDateOnly !== calculationDate) {
      appLogger.error('🚨 DATE MISMATCH DETECTED!');
      appLogger.error('  UI shows:', displayedDateOnly);
      appLogger.error('  Status calculated using:', calculationDate);
      appLogger.error('  Session:', session);
      throw new Error(
        `TIME_GUARD_VIOLATION: Session date mismatch! ` +
        `UI shows "${displayedDateOnly}" but status uses "${calculationDate}". ` +
        `See TIME_ARCHITECTURE.md for details.`
      );
    }

    return status;
  };

  // ============================================
  // RESTORED: Standard Session Listing (Planning View)
  // ============================================

  // 1. Filter Logic
  const filteredSessions = sessions.filter(session => {
    // A. Date Filter (If Selected)
    if (selectedDate) {
      const targetStr = toISTDateString(selectedDate);
      const sDate = toISTDateString(getSessionStartTimeIST(session));
      if (sDate !== targetStr) return false;
    }

    // B. Status Filter (Hide Past unless toggled)
    if (!showPastSessions) {
      const status = getSessionStatusSafe(session);
      if (status === 'past') return false;
    }

    return true;
  });

  // 2. Sorting (Date + Time)
  const displayedSessions = filteredSessions.sort((a, b) => {
    // Primary: Date
    const dateA = toISTDateString(getSessionStartTimeIST(a));
    const dateB = toISTDateString(getSessionStartTimeIST(b));
    const dateComp = dateA.localeCompare(dateB);
    if (dateComp !== 0) return dateComp;

    // Secondary: Time
    return a.startTime.localeCompare(b.startTime);
  });

  // 3. Past Count (For Badge) - Relevant to current view
  const relevantSessionsForCount = selectedDate
    ? sessions.filter(s => {
      const targetStr = toISTDateString(selectedDate);
      const sDate = s.occurrenceDate || (typeof s.startDate === 'string' ? s.startDate.split('T')[0] : '');
      return sDate === targetStr;
    })
    : sessions;

  const pastSessions = relevantSessionsForCount.filter(s => getSessionStatusSafe(s) === 'past');



  // Scroll to calendar function
  const scrollToCalendar = () => {
    if (calendarRef.current) {
      calendarRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (isLoading) {
    return (
      <div className="relative flex h-auto min-h-screen w-full flex-col group/design-root overflow-x-hidden bg-background-light dark:bg-background-dark">
        <div className="layout-container flex h-full grow flex-col">
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
              <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white leading-tight tracking-[-0.033em]">Classes/Batches</h1>
              {canCreateSession && (
                <Link
                  to="/sessions/create"
                  className="flex min-w-[84px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg h-10 px-5 bg-gradient-to-r from-orange-500 to-[#f04129] text-white text-sm font-bold leading-normal tracking-[0.015em] hover:from-orange-600 hover:to-[#d63a25] transition-all"
                >
                  <span className="material-symbols-outlined text-xl">add</span>
                  <span className="truncate">Create New Class</span>
                </Link>
              )}
            </header>
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center">
                <svg className="animate-spin h-8 w-8 text-[#f04129] mb-4" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
                </svg>
                <p className="text-[#8a7b60] dark:text-gray-400">Loading classes/batches...</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative flex h-auto min-h-screen w-full flex-col group/design-root overflow-x-hidden bg-background-light dark:bg-background-dark">
        <div className="layout-container flex h-full grow flex-col">
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
              <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white leading-tight tracking-[-0.033em]">Classes/Batches</h1>
              {canCreateSession && (
                <Link
                  to="/sessions/create"
                  className="flex min-w-[84px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg h-10 px-5 bg-gradient-to-r from-orange-500 to-[#f04129] text-white text-sm font-bold leading-normal tracking-[0.015em] hover:from-orange-600 hover:to-[#d63a25] transition-all"
                >
                  <span className="material-symbols-outlined text-xl">add</span>
                  <span className="truncate">Create New Class</span>
                </Link>
              )}
            </header>
            <div className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800 p-4 rounded-xl flex items-center">
              <span className="material-symbols-outlined mr-2">error</span>
              {error}
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col group/design-root overflow-x-hidden bg-background-light dark:bg-background-dark">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      <div className="layout-container flex h-full grow flex-col">
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <header className="mb-4 md:mb-8">
            {classId && (
              <Link
                to="/classes"
                className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-[#f5f3f0] dark:bg-slate-800 text-[#181511] dark:text-gray-200 gap-2 text-sm font-bold leading-normal tracking-[0.015em] border border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors mb-4"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="truncate">Back to Classes</span>
              </Link>
            )}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 md:gap-3">
                <span className="material-symbols-outlined text-[#f04129] text-2xl md:text-4xl">calendar_month</span>
                <div>
                  <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white leading-tight tracking-[-0.033em] flex items-center gap-3">
                    {classBatch ? classBatch.name : 'Sessions'}
                    <span className="hidden sm:inline-flex items-center justify-center px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-sm font-medium text-slate-500 dark:text-slate-400">
                      {displayedSessions.length} Total • {displayedSessions.filter(s => getSessionStatusSafe(s) !== 'past').length} Remaining
                    </span>
                  </h1>
                  {classBatch && classBatch.description && (
                    <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">{classBatch.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {!selectedDate && pastSessions.length > 0 && (
                  <button
                    onClick={() => setShowPastSessions(!showPastSessions)}
                    className="flex min-w-[84px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg h-10 px-4 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium leading-normal tracking-[0.015em] hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                  >
                    <span className="material-symbols-outlined text-lg">{showPastSessions ? 'visibility_off' : 'history'}</span>
                    <span className="truncate">{showPastSessions ? 'Hide Past' : `Show Past (${pastSessions.length})`}</span>
                  </button>
                )}
                {selectedDate && (
                  <button
                    onClick={() => setSelectedDate(null)}
                    className="flex min-w-[84px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg h-10 px-4 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium leading-normal tracking-[0.015em] hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                  >
                    <span className="material-symbols-outlined text-lg">clear</span>
                    <span className="truncate">Clear Filter</span>
                  </button>
                )}
                {canCreateSession && (
                  <Link
                    to={classId ? `/sessions/create?classId=${classId}` : "/sessions/create"}
                    className="flex min-w-[84px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg h-10 px-5 bg-gradient-to-r from-orange-500 to-[#f04129] text-white text-sm font-bold leading-normal tracking-[0.015em] hover:from-orange-600 hover:to-[#d63a25] transition-all"
                  >
                    <span className="material-symbols-outlined text-xl">add</span>
                    <span className="truncate">Create New Session</span>
                  </Link>
                )}
              </div>
            </div>
          </header>

          {/* Responsive Layout: Mobile = Flex Column, Desktop = Grid */}
          <div className="flex flex-col md:grid md:grid-cols-12 gap-4 md:gap-8 items-start">
            {/* Calendar Widget - Mobile: Collapsible at top, Desktop: Right Column (sticky) */}
            <div className="w-full md:col-span-4 md:order-2" ref={calendarRef}>
              {/* Mobile: Collapsible Accordion */}
              <div className="md:hidden">
                <button
                  onClick={() => setIsCalendarExpanded(!isCalendarExpanded)}
                  className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-shadow"
                >
                  <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium">
                    <span className="material-symbols-outlined">calendar_month</span>
                    Filter by Date
                  </span>
                  <span className={`material-symbols-outlined transition-transform ${isCalendarExpanded ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </button>
                {isCalendarExpanded && (
                  <div className="mt-2">
                    <SessionCalendar
                      sessions={sessions}
                      selectedDate={selectedDate}
                      onDateSelect={(date) => {
                        setSelectedDate(date);
                        setIsCalendarExpanded(false); // Auto-collapse after selection
                      }}
                      currentMonth={currentViewDate}
                      onMonthChange={setCurrentViewDate}
                    />
                  </div>
                )}
              </div>
              {/* Desktop: Always visible, sticky */}
              <div className="hidden md:block">
                <div className="sticky top-6">
                  <SessionCalendar
                    sessions={sessions}
                    selectedDate={selectedDate}
                    onDateSelect={setSelectedDate}
                    currentMonth={currentViewDate}
                    onMonthChange={setCurrentViewDate}
                  />
                </div>
              </div>
            </div>

            {/* Session List - Mobile: Full width, Desktop: Left Column (8/12 width) */}
            <div className="w-full md:col-span-8 md:order-1">
              {displayedSessions.length === 0 ? (
                <div className="mt-12">
                  <div className="flex flex-col items-center gap-6 rounded-xl border-2 border-dashed border-[#e6e2db] dark:border-slate-800 px-6 py-14">
                    <div className="flex max-w-[480px] flex-col items-center gap-2 text-center">
                      <p className="text-[#181511] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em]">
                        {selectedDate
                          ? 'No Sessions on Selected Date'
                          : classId
                            ? 'No Sessions Available'
                            : 'No Sessions Available'}
                      </p>
                      <p className="text-[#181511] dark:text-slate-300 text-sm font-normal leading-normal">
                        {selectedDate
                          ? 'There are no sessions scheduled for this date. Try selecting a different date from the calendar.'
                          : classId
                            ? 'This class does not have any sessions yet. Create a new session to get started.'
                            : 'There are currently no sessions scheduled. Get started by creating a new one.'}
                      </p>
                    </div>
                    {canCreateSession && !selectedDate && (
                      <Link
                        to={classId ? `/sessions/create?classId=${classId}` : "/sessions/create"}
                        className="flex min-w-[84px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg h-10 px-5 bg-gradient-to-r from-orange-500 to-[#f04129] text-white text-sm font-bold leading-normal tracking-[0.015em] hover:from-orange-600 hover:to-[#d63a25] transition-all"
                      >
                        <span className="material-symbols-outlined text-xl">add</span>
                        <span className="truncate">Create New Session</span>
                      </Link>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 w-full">
                    {displayedSessions.slice(0, 7).map((session) => {
                      // Get status using guarded function
                      const sessionStatus = getSessionStatusSafe(session);
                      const isPast = sessionStatus === 'past';
                      const isLive = sessionStatus === 'live';
                      const isUpcoming = sessionStatus === 'upcoming';
                      const isToday = isSessionToday(session);
                      const showScanButton = isEndUser && isToday;
                      const sessionMode = normalizeSessionMode(session.sessionType || session.locationType);

                      // Fix 2: Date-Based Title (en-GB for "Thu, 8 Jan 2026")
                      const dateTitle = formatTitleDate(session);

                      // Fix 5: Navigation with Date Param
                      const handleNavigate = (e?: React.MouseEvent) => {
                        e?.stopPropagation();
                        // Don't navigate if session is cancelled
                        if (session.isCancelled) return;

                        // Add date query param for correct context
                        const dateParam = session.occurrenceDate ? `?date=${session.occurrenceDate}` : '';

                        // Smart navigation based on session status
                        if (isPast) {
                          // Past sessions: redirect to history
                          if (isEndUser) {
                            // End User: go to personal attendance history
                            navigate(`/my-attendance?scrollTo=${session._id}`);
                          } else {
                            // Admin: go to reports for this class
                            const classBatchId = typeof session.classBatchId === 'object' && session.classBatchId?._id
                              ? session.classBatchId._id
                              : typeof session.classBatchId === 'string'
                                ? session.classBatchId
                                : classId;
                            if (classBatchId) {
                              navigate(`/reports?classBatchId=${classBatchId}&tab=logs`);
                            } else {
                              navigate(`/sessions/${session._id}${dateParam}`); // Fallback
                            }
                          }
                        } else {
                          // Live/Upcoming: normal navigation
                          if (!isEndUser) {
                            navigate(`/sessions/${session._id}${dateParam}`);
                          }
                        }
                      };

                      return (
                        <div
                          key={`${session._id}_${session.occurrenceDate || session.startDate}`}
                          className={`flex flex-col w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-4 md:p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden cursor-pointer ${isPast && !isLive ? 'opacity-60 grayscale' : ''
                            } ${isLive ? 'ring-2 ring-green-500 dark:ring-green-400' : ''}`}
                          onClick={handleNavigate}
                        >
                          {/* Cancellation Overlay */}
                          {session.isCancelled && (
                            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-4 text-center backdrop-blur-sm bg-white/60 dark:bg-slate-900/60 rounded-xl">
                              <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-4 border-2 border-red-300 dark:border-red-700 max-w-sm">
                                <span className="material-symbols-outlined text-5xl text-red-600 dark:text-red-400 mb-3">warning</span>
                                <h3 className="text-xl font-bold text-red-700 dark:text-red-400 mb-2">
                                  ⚠️ Session Cancelled
                                </h3>
                                {session.cancellationReason && (
                                  <p className="text-base font-semibold text-red-800 dark:text-red-300 mt-2 leading-relaxed">
                                    {session.cancellationReason}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                          {/* Class Name Label (Above Session Name) */}
                          {session.classBatchId && typeof session.classBatchId === 'object' && (
                            <div className="mb-2">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {session.classBatchId.name}
                              </span>
                            </div>
                          )}

                          <div className="flex items-start justify-between mb-4 gap-2">
                            <div className="flex-1">
                              {/* Fix 2: Use Date as Title */}
                              <h2 className="text-xl font-bold text-slate-900 dark:text-white break-words">Session – {dateTitle}</h2>
                              {/* Class Description or Session Description (One Only) */}
                              {(session.classBatchId && typeof session.classBatchId === 'object' && session.classBatchId.description) ? (
                                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
                                  {session.classBatchId.description}
                                </p>
                              ) : session.description ? (
                                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
                                  {session.description}
                                </p>
                              ) : null}
                            </div>
                            <div className="flex flex-col gap-2 items-end">
                              <ModeBadge mode={sessionMode} />
                              {session.isCancelled && (
                                <span className="whitespace-nowrap rounded-full bg-orange-100 dark:bg-orange-900/30 px-3 py-1 text-xs font-medium text-orange-600 dark:text-orange-400 border border-orange-300 dark:border-orange-800">
                                  ⚠️ Cancelled
                                </span>
                              )}
                              {/* Status Badge - Using robust getSessionStatus() */}
                              {isLive && (
                                <span className="whitespace-nowrap rounded-full bg-green-100 dark:bg-green-900/30 px-3 py-1 text-xs font-medium text-green-600 dark:text-green-400 border border-green-300 dark:border-green-800 flex items-center gap-1">
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                  </span>
                                  Live Now
                                </span>
                              )}
                              {isPast && (
                                <span className="whitespace-nowrap rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700">
                                  {isEndUser ? 'Past' : 'Past Session'}
                                </span>
                              )}
                              {isUpcoming && isToday && (
                                <span className="whitespace-nowrap rounded-full bg-amber-100 dark:bg-amber-900/30 px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                                  Today
                                </span>
                              )}
                              {isUpcoming && !isToday && (
                                <span className="whitespace-nowrap rounded-full bg-blue-100 dark:bg-blue-900/30 px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-800">
                                  Upcoming
                                </span>
                              )}
                              <span className="whitespace-nowrap rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                                {formatFrequency(session.frequency)}
                              </span>
                            </div>
                          </div>
                          <div className="flex-grow space-y-3 text-slate-700 dark:text-slate-300 mb-4">
                            {/* Removed Duplicate Date (Title already covers it) but kept Time & Location */}
                            <div className="flex items-center text-sm">
                              <span className="material-symbols-outlined mr-2 text-slate-500 dark:text-slate-400 text-lg flex-shrink-0">schedule</span>
                              <span className="break-words whitespace-normal">{formatTime(session.startTime)} - {formatTime(session.endTime)}</span>
                            </div>
                            <div className="flex items-center text-sm">
                              <span className="material-symbols-outlined mr-2 text-slate-500 dark:text-slate-400 text-lg flex-shrink-0">location_on</span>
                              <span className="break-words whitespace-normal">{session.locationType}</span>
                            </div>
                            {session.assignedUsers && Array.isArray(session.assignedUsers) && session.assignedUsers.length > 0 && (
                              <div className="flex items-center text-sm">
                                <span className="material-symbols-outlined mr-2 text-slate-500 dark:text-slate-400 text-lg flex-shrink-0">group</span>
                                <span className="break-words whitespace-normal">{session.assignedUsers.length} Assigned Users</span>
                              </div>
                            )}
                            {/* Fix 3: Duplicate Description Removed */}
                          </div>
                          <div className="mt-auto flex flex-row items-center justify-between gap-3">
                            {showScanButton ? (
                              <button
                                className="flex flex-1 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg h-10 px-3 md:px-4 bg-gradient-to-r from-orange-500 to-[#f04129] text-white text-sm font-bold hover:from-orange-600 hover:to-[#d63a25] transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/scan?sessionId=${session._id}`);
                                }}
                              >
                                <span className="material-symbols-outlined text-lg">qr_code_scanner</span>
                                <span className="truncate whitespace-normal">Scan Attendance</span>
                              </button>
                            ) : (
                              <>
                                {isEndUser ? (
                                  <button
                                    className={`flex flex-1 items-center justify-center gap-2 overflow-hidden rounded-lg h-10 px-3 md:px-4 border text-sm font-medium cursor-not-allowed ${isLive
                                      ? 'border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
                                      : 'border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800'
                                      }`}
                                    disabled
                                  >
                                    <span className="truncate whitespace-normal">
                                      {isLive ? '🟢 In Progress' : isPast ? 'Past Session' : 'Upcoming'}
                                    </span>
                                  </button>
                                ) : (
                                  <button
                                    className="flex flex-1 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg h-10 px-3 md:px-4 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                    onClick={handleNavigate}
                                  >
                                    <Eye className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
                                    <span className="truncate whitespace-normal">View Details</span>
                                  </button>
                                )}
                              </>
                            )}
                            {canEditSession(session) && (
                              <button
                                className="flex flex-1 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg h-10 px-3 md:px-4 border border-[#f04129] text-[#f04129] text-sm font-bold hover:bg-red-50 dark:hover:bg-[#f04129]/10 transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Add date query param for correct context when editing a specific occurrence
                                  const dateParam = session.occurrenceDate ? `?date=${session.occurrenceDate}` : '';
                                  navigate(`/sessions/edit/${session._id}${dateParam}`);
                                }}
                              >
                                <Edit className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
                                <span className="truncate whitespace-normal">Override</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Fix 4: More Sessions Card */}
                    {displayedSessions.length > 7 && (
                      <div
                        className="flex flex-col w-full rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-6 items-center justify-center text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[300px]"
                        onClick={scrollToCalendar}
                      >
                        <span className="material-symbols-outlined text-4xl text-slate-400 mb-4">event_repeat</span>
                        <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">
                          + {displayedSessions.length - 7} more {selectedDate ? 'on this date' : 'upcoming sessions'}
                        </h3>
                        <p className="text-slate-500 dark:text-slate-400 mt-2">
                          Select a date in the calendar to view them.
                        </p>
                      </div>
                    )}
                  </div>
                  {/* Summary Card - Show if more than 7 sessions and no date selected */}

                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Sessions;
