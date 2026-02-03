import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import api from '../api';
import { ISession } from '../types';
import { nowIST, formatIST, sessionTimeToIST, istDayStart, istDayEnd } from '../utils/time';

const Dashboard: React.FC = () => {
  const { user, isEndUser, isPlatformOwner } = useAuth();
  const [stats, setStats] = useState({
    orgName: '',
    activeClasses: 0,
    totalUsers: 0,
    attendancePercentage: 0,
    upcomingLeave: null as {
      startDate: string;
      endDate: string;
      dates?: string[]; // Array of specific dates (for non-consecutive dates)
      leaveType: string;
    } | null,
  });
  const [upcomingSessions, setUpcomingSessions] = useState<ISession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch dashboard stats and upcoming sessions
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch dashboard stats from API
        const { data } = await api.get('/api/dashboard/stats');
        setStats({
          orgName: data.orgName || '',
          activeClasses: data.activeClasses || 0,
          totalUsers: data.totalUsers || 0,
          attendancePercentage: data.attendancePercentage || 0,
          upcomingLeave: data.upcomingLeave || null,
        });

        // Fetch sessions to get upcoming ones
        try {
          const { data: sessions } = await api.get('/api/sessions');
          if (sessions && Array.isArray(sessions)) {
            // Filter for upcoming sessions (startDate is in the future or today)
            const now = nowIST();
            const upcoming = sessions
              .filter((session: ISession) => {
                const sessionDate = sessionTimeToIST(session.startDate, session.startTime);
                return sessionDate >= now;
              })
              .sort((a: ISession, b: ISession) => {
                const dateA = sessionTimeToIST(a.startDate, a.startTime);
                const dateB = sessionTimeToIST(b.startDate, b.startTime);
                return dateA - dateB;
              })
              .slice(0, 3); // Get top 3 upcoming sessions

            setUpcomingSessions(upcoming);

          }
        } catch (sessionErr) {
          console.error('Failed to fetch sessions:', sessionErr);
        }
      } catch (err) {
        console.error('Failed to fetch dashboard stats:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const formatSessionDate = (dateString: string, timeString: string) => {
    try {
      const sessionTimestamp = sessionTimeToIST(dateString, timeString);
      if (isNaN(sessionTimestamp)) {
        return dateString;
      }
      // formatIST handles both date and time formatting based on options
      return formatIST(sessionTimestamp, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return dateString;
    }
  };

  // Format date for leave display (MMM dd format)
  const formatLeaveDate = (dateString: string) => {
    try {
      const timestamp = new Date(dateString).getTime();
      if (isNaN(timestamp)) {
        return dateString;
      }
      return formatIST(timestamp, {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  // Format leave date range
  const formatLeaveDateRange = (startDate: string, endDate: string, dates?: string[]) => {
    // If dates array exists and has multiple non-consecutive dates, show count
    if (dates && dates.length > 0) {
      const sortedTimestamps = dates.map(d => istDayStart(d)).sort((a, b) => a - b);
      const startTimestamp = sortedTimestamps[0];
      const endTimestamp = sortedTimestamps[sortedTimestamps.length - 1];

      const startFormatted = formatLeaveDate(new Date(startTimestamp).toISOString());
      const endFormatted = formatLeaveDate(new Date(endTimestamp).toISOString());

      // Check if dates are consecutive
      const ONE_DAY_MS = 24 * 60 * 60 * 1000;
      const isConsecutive = dates.length === 1 ||
        (endTimestamp - startTimestamp) ===
        ((dates.length - 1) * ONE_DAY_MS);

      if (isConsecutive) {
        // Consecutive dates - show range
        if (startFormatted === endFormatted) {
          return startFormatted;
        }
        return `${startFormatted} - ${endFormatted}`;
      } else {
        // Non-consecutive dates - show range with count
        return `${startFormatted} - ${endFormatted} (${dates.length} days)`;
      }
    }

    // Fallback to start/end date range
    const startFormatted = formatLeaveDate(startDate);
    const endFormatted = formatLeaveDate(endDate);
    if (startFormatted === endFormatted) {
      return startFormatted;
    }
    return `${startFormatted} - ${endFormatted}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center">
          <svg className="animate-spin h-8 w-8 text-primary mb-4" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
          </svg>
          <p className="text-text-secondary-light dark:text-text-secondary-dark">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Get user avatar URL or initials
  const getUserAvatar = () => {
    // For now, return null to use initials fallback
    return null;
  };

  const getUserInitials = () => {
    if (user?.profile?.firstName?.[0] && user?.profile?.lastName?.[0]) {
      return `${user.profile.firstName[0]}${user.profile.lastName[0]}`.toUpperCase();
    }
    if (user?.profile?.firstName?.[0]) {
      return user.profile.firstName[0].toUpperCase();
    }
    return 'U';
  };

  const getRoleDisplay = () => {
    if (!user?.role) return '';
    const roleMap: { [key: string]: string } = {
      'SuperAdmin': 'Company Administrator',
      'CompanyAdmin': 'Company Administrator',
      'Manager': 'Manager',
      'SessionAdmin': 'Session Administrator',
      'EndUser': 'End User',
      'PLATFORM_OWNER': 'Platform Owner',
    };
    return roleMap[user.role] || user.role;
  };

  return (
    <div className="p-4 md:p-10">
      {/* PageHeading */}
      <div className="flex flex-wrap justify-between gap-3 mb-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-black leading-tight tracking-[-0.033em] text-text-primary-light dark:text-text-primary-dark">
            Welcome Back, {user?.profile.firstName || 'AttendMark'}!
          </h1>
          <p className="text-base font-normal text-text-secondary-light dark:text-text-secondary-dark">
            Here's what's happening with your account today.
          </p>
        </div>
      </div>

      {/* Stats Grid - 4 Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
        {/* Organization Name Card */}
        <div className="flex min-w-[158px] flex-1 flex-col gap-2 rounded-xl bg-surface-light dark:bg-surface-dark p-6 border border-border-light dark:border-border-dark shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-[#f04129] text-xl">business</span>
            <p className="text-base font-medium text-text-primary-light dark:text-text-primary-dark">Organization</p>
          </div>
          <p className="tracking-light text-2xl font-bold text-text-primary-light dark:text-text-primary-dark truncate" title={stats.orgName}>
            {stats.orgName || 'N/A'}
          </p>
        </div>

        {/* Active Classes Card */}
        <div className="flex min-w-[158px] flex-1 flex-col gap-2 rounded-xl bg-surface-light dark:bg-surface-dark p-6 border border-border-light dark:border-border-dark shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-[#f04129] text-xl">groups</span>
            <p className="text-base font-medium text-text-primary-light dark:text-text-primary-dark">Active Classes/Batches</p>
          </div>
          <p className="tracking-light text-3xl font-bold text-text-primary-light dark:text-text-primary-dark">{stats.activeClasses || 0}</p>
        </div>

        {/* Total Users Card - Only show for non-EndUsers */}
        {!isEndUser && (
          <div className="flex min-w-[158px] flex-1 flex-col gap-2 rounded-xl bg-surface-light dark:bg-surface-dark p-6 border border-border-light dark:border-border-dark shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-[#f04129] text-xl">people</span>
              <p className="text-base font-medium text-text-primary-light dark:text-text-primary-dark">Total Users</p>
            </div>
            <p className="tracking-light text-3xl font-bold text-text-primary-light dark:text-text-primary-dark">{stats.totalUsers || 0}</p>
          </div>
        )}

        {/* This Month's Attendance Card */}
        <div className="flex min-w-[158px] flex-1 flex-col gap-2 rounded-xl bg-surface-light dark:bg-surface-dark p-6 border border-border-light dark:border-border-dark shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-[#f04129] text-xl">check_circle</span>
            <p className="text-base font-medium text-text-primary-light dark:text-text-primary-dark">This Month's Attendance</p>
          </div>
          <p className="tracking-light text-3xl font-bold text-text-primary-light dark:text-text-primary-dark">{stats.attendancePercentage || 0}%</p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Upcoming Sessions */}
        <div className="lg:col-span-2">
          <div className="w-full rounded-xl bg-surface-light dark:bg-surface-dark p-6 border border-border-light dark:border-border-dark shadow-sm">
            <h2 className="text-xl font-bold mb-4 text-text-primary-light dark:text-text-primary-dark">Upcoming Classes/Batches</h2>
            <div className="flex flex-col gap-4">
              {upcomingSessions.length > 0 ? (
                upcomingSessions.map((session) => (
                  <Link
                    key={session._id}
                    to={`/sessions/${session._id}`}
                    className="flex items-center justify-between p-4 rounded-lg hover:bg-[#f04129]/10 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#f04129]/20 text-[#f04129]">
                        <span className="material-symbols-outlined text-[#f04129]">event</span>
                      </div>
                      <div>
                        <p className="font-semibold text-text-primary-light dark:text-text-primary-dark">
                          {session.classBatchId && typeof session.classBatchId === 'object'
                            ? session.classBatchId.name
                            : session.name}
                        </p>
                        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                          {formatSessionDate(session.startDate, session.startTime)}
                        </p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-text-secondary-light dark:text-text-secondary-dark">chevron_right</span>
                  </Link>
                ))
              ) : (
                <p className="text-text-secondary-light dark:text-text-secondary-dark text-sm py-4">No upcoming classes/batches scheduled.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Profile and Account Status */}
        <div className="flex flex-col gap-6">
          {/* Profile Card */}
          {user && (
            <div className="flex flex-col rounded-xl bg-surface-light dark:bg-surface-dark p-6 border border-border-light dark:border-border-dark shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                {getUserAvatar() ? (
                  <div
                    className="w-16 h-16 bg-center bg-no-repeat bg-cover rounded-full"
                    style={{ backgroundImage: `url(${getUserAvatar()})` }}
                  />
                ) : (
                  <div className="w-16 h-16 bg-[#f04129]/20 rounded-full flex items-center justify-center">
                    <span className="text-[#f04129] text-xl font-bold">{getUserInitials()}</span>
                  </div>
                )}
                <div className="flex flex-col">
                  <p className="text-lg font-bold tracking-[-0.015em] text-text-primary-light dark:text-text-primary-dark">
                    {user.profile.firstName} {user.profile.lastName}
                  </p>
                  <p className="text-base text-text-secondary-light dark:text-text-secondary-dark">{getRoleDisplay()}</p>
                </div>
              </div>
              <p className="text-base text-text-secondary-light dark:text-text-secondary-dark">{user.email}</p>
            </div>
          )}

          {/* Upcoming Leave Card - Hide for Platform Owner */}
          {!isPlatformOwner && (
            <div className="flex flex-col rounded-xl bg-surface-light dark:bg-surface-dark p-6 border border-border-light dark:border-border-dark shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-[#f04129] text-xl">flight_takeoff</span>
                <h2 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">Upcoming Leave</h2>
              </div>
              {stats.upcomingLeave ? (
                <div className="flex flex-col gap-2">
                  <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                    <p className="text-lg font-bold text-green-800 dark:text-green-300 mb-1">
                      {formatLeaveDateRange(stats.upcomingLeave.startDate, stats.upcomingLeave.endDate, stats.upcomingLeave.dates)}
                    </p>
                    {stats.upcomingLeave.dates && stats.upcomingLeave.dates.length > 0 && (
                      <p className="text-xs text-green-600 dark:text-green-500 mb-1" title={stats.upcomingLeave.dates.sort().map(d => formatLeaveDate(d)).join(', ')}>
                        Multiple Dates: {stats.upcomingLeave.dates.length} days
                      </p>
                    )}
                    <p className="text-sm text-green-700 dark:text-green-400">
                      {stats.upcomingLeave.leaveType} (Approved)
                    </p>
                  </div>
                  <Link
                    to="/leaves"
                    className="text-sm text-[#f04129] hover:underline font-medium mt-2"
                  >
                    View all leaves →
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-text-secondary-light dark:text-text-secondary-dark">
                    No upcoming leaves scheduled.
                  </p>
                  <Link
                    to="/leaves"
                    className="text-sm text-[#f04129] hover:underline font-medium"
                  >
                    Apply Now →
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Account Status Card - Hide for Platform Owner */}
          {user && !isPlatformOwner && (
            <div className="flex flex-col rounded-xl bg-surface-light dark:bg-surface-dark p-6 border border-border-light dark:border-border-dark shadow-sm">
              <h2 className="text-xl font-bold mb-3 text-text-primary-light dark:text-text-primary-dark">Account Status</h2>
              <p className="text-text-secondary-light dark:text-text-secondary-dark mb-4">Your account is active and verified.</p>

              {/* Alert/Banner - Show if mustResetPassword */}
              {user.mustResetPassword && (
                <div className="flex items-start gap-3 rounded-lg bg-[#f04129]/20 p-4">
                  <span className="material-symbols-outlined text-[#f04129] mt-1">warning</span>
                  <div className="flex flex-col">
                    <p className="font-semibold text-[#f04129]">Password Reset Required</p>
                    <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                      Your password must be reset. <Link to="/force-reset-password" className="font-bold underline text-[#f04129]">Reset now.</Link>
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

