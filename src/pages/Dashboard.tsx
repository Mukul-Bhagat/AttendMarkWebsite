import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import api from '../api';
import { ISession } from '../types';
import { nowIST, formatIST, sessionTimeToIST } from '../utils/time';

interface DashboardSummary {
  organization: {
    name: string;
    logoUrl: string | null;
  };
  activeClasses: number;
  totalUsers: number;
  attendance: {
    percentage: number;
    status: string;
  };
  upcomingLeave: {
    startDate: string;
    endDate: string;
    dates: string[];
    leaveType: string;
    status: 'Pending' | 'Approved' | 'Rejected';
    daysCount: number;
  } | null;
}

const Dashboard: React.FC = () => {
  const { user, isPlatformOwner } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [upcomingSessions, setUpcomingSessions] = useState<ISession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch dashboard stats and upcoming sessions
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch dashboard summary from NEW API
        const { data } = await api.get('/api/dashboard/summary');
        setSummary(data);

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
      } catch (err: any) {
        console.error('Failed to fetch dashboard summary:', err);
        if (err.response?.status === 404 || err.response?.status === 400) {
          setError('Organization data mismatch. Please logout and login again to refresh your session.');
        } else {
          setError('Failed to load dashboard data. Check your connection or try again.');
        }
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

  const getAttendanceStatusColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600 dark:text-green-500';
    if (percentage >= 75) return 'text-orange-500 dark:text-orange-400';
    if (percentage > 0) return 'text-red-500 dark:text-red-400';
    return 'text-text-secondary-light dark:text-text-secondary-dark'; // No data or 0 assigned
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

  const getUserInitials = () => {
    if (user?.profile?.firstName?.[0] && user?.profile?.lastName?.[0]) {
      return `${user.profile.firstName[0]}${user.profile.lastName[0]}`.toUpperCase();
    }
    if (user?.profile?.firstName?.[0]) {
      return user.profile.firstName[0].toUpperCase();
    }
    return 'U';
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

  return (
    <div className="p-4 md:p-10">

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined">error</span>
            <p className="font-medium">{error}</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => window.location.reload()}
              className="text-sm underline hover:text-red-800 dark:hover:text-red-300 font-semibold"
            >
              Reload
            </button>
            {error.includes('logout') && (
              <Link to="/login" onClick={() => localStorage.removeItem('token')} className="text-sm underline hover:text-red-800 dark:hover:text-red-300 font-bold">
                Logout
              </Link>
            )}
          </div>
        </div>
      )}

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
        {/* Organization Name/Logo Card */}
        <div className="flex min-w-[200px] flex-1 flex-col gap-2 rounded-xl bg-surface-light dark:bg-surface-dark p-6 border border-border-light dark:border-border-dark shadow-sm justify-center">
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-[#f04129] text-xl">business</span>
            <p className="text-base font-medium text-text-primary-light dark:text-text-primary-dark">Organization</p>
          </div>
          {summary?.organization.logoUrl ? (
            <div className="organization-logo-wrapper">
              <img
                src={summary.organization.logoUrl}
                alt={summary.organization.name}
              />
            </div>
          ) : (
            <p className="tracking-light text-2xl font-bold text-text-primary-light dark:text-text-primary-dark" title={summary?.organization.name}>
              {summary?.organization.name || 'N/A'}
            </p>
          )}
        </div>

        {/* Active Classes Card */}
        <div className="flex min-w-[200px] flex-1 flex-col gap-2 rounded-xl bg-surface-light dark:bg-surface-dark p-6 border border-border-light dark:border-border-dark shadow-sm justify-center">
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-[#f04129] text-xl">groups</span>
            <p className="text-base font-medium text-text-primary-light dark:text-text-primary-dark">Active Classes/Batches</p>
          </div>
          <p className="tracking-light text-3xl font-bold text-text-primary-light dark:text-text-primary-dark">{summary?.activeClasses || 0}</p>
        </div>

        {/* Total Users Card - Show for EVERYONE now based on redesign specs "Organization-driven" */}
        <div className="flex min-w-[200px] flex-1 flex-col gap-2 rounded-xl bg-surface-light dark:bg-surface-dark p-6 border border-border-light dark:border-border-dark shadow-sm justify-center">
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-[#f04129] text-xl">people</span>
            <p className="text-base font-medium text-text-primary-light dark:text-text-primary-dark">Total Users</p>
          </div>
          <p className="tracking-light text-3xl font-bold text-text-primary-light dark:text-text-primary-dark">{summary?.totalUsers || 0}</p>
        </div>

        {/* Attendance Widget (REDESIGNED) */}
        <div className="flex min-w-[200px] flex-1 flex-col gap-2 rounded-xl bg-surface-light dark:bg-surface-dark p-6 border border-border-light dark:border-border-dark shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-[#f04129] text-xl">check_circle</span>
            <p className="text-base font-medium text-text-primary-light dark:text-text-primary-dark truncate">Avg. Classes/Batches Att.</p>
          </div>
          <div className="flex flex-col">
            <p className="tracking-light text-3xl font-bold text-text-primary-light dark:text-text-primary-dark">
              {summary?.attendance.status === 'Not assigned to any class' && summary.attendance.percentage === 0
                ? '--'
                : `${summary?.attendance.percentage || 0}%`}
            </p>
            <p className={`text-sm font-medium mt-1 ${getAttendanceStatusColor(summary?.attendance.percentage || 0)}`}>
              {summary?.attendance.status || 'No data'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Upcoming Sessions */}
        <div className="lg:col-span-2">
          <div className="w-full rounded-xl bg-surface-light dark:bg-surface-dark p-6 border border-border-light dark:border-border-dark shadow-sm h-full">
            <h2 className="text-xl font-bold mb-4 text-text-primary-light dark:text-text-primary-dark">Upcoming Classes/Batches</h2>
            <div className="flex flex-col gap-4">
              {upcomingSessions.length > 0 ? (
                upcomingSessions.map((session) => (
                  <Link
                    key={session._id}
                    to={`/sessions/${session._id}`}
                    className="flex items-center justify-between p-4 rounded-lg hover:bg-[#f04129]/10 transition-colors bg-background-light dark:bg-background-dark border border-gray-100 dark:border-gray-800"
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

            <div className="mt-4 pt-4 border-t border-border-light dark:border-border-dark flex justify-end">
              <Link to="/sessions" className="text-[#f04129] font-medium text-sm hover:underline">View All Sessions &rarr;</Link>
            </div>
          </div>
        </div>

        {/* Right Column: Profile Only (Leave removed as per redesign simplification) */}
        <div className="flex flex-col gap-6">
          {/* Profile Card */}
          {user && (
            <div className="flex flex-col rounded-xl bg-surface-light dark:bg-surface-dark p-6 border border-border-light dark:border-border-dark shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                {/* Avatar / Initials */}
                <div className="w-16 h-16 bg-[#f04129]/20 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-[#f04129] text-xl font-bold">{getUserInitials()}</span>
                </div>
                <div className="flex flex-col overflow-hidden">
                  <p className="text-lg font-bold tracking-[-0.015em] text-text-primary-light dark:text-text-primary-dark truncate">
                    {user.profile.firstName} {user.profile.lastName}
                  </p>
                  <p className="text-base text-text-secondary-light dark:text-text-secondary-dark truncate">{getRoleDisplay()}</p>
                </div>
              </div>
              <p className="text-base text-text-secondary-light dark:text-text-secondary-dark truncate">{user.email}</p>
            </div>
          )}


          {/* Upcoming Leave Widget */}
          {!isPlatformOwner && (
            <div className="flex flex-col rounded-xl bg-surface-light dark:bg-surface-dark p-6 border border-border-light dark:border-border-dark shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#f04129] text-xl">flight_takeoff</span>
                  <h2 className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark">Upcoming Leave</h2>
                </div>
              </div>

              {summary?.upcomingLeave ? (
                <div className="flex flex-col gap-3">
                  <div className="p-4 rounded-lg bg-background-light dark:bg-background-dark border border-gray-100 dark:border-gray-800">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-text-primary-light dark:text-text-primary-dark text-lg">
                          {summary.upcomingLeave.startDate}
                          {summary.upcomingLeave.startDate !== summary.upcomingLeave.endDate &&
                            ` - ${summary.upcomingLeave.endDate}`
                          }
                        </p>
                        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-0.5">
                          {summary.upcomingLeave.leaveType} • {summary.upcomingLeave.daysCount} Day{summary.upcomingLeave.daysCount > 1 ? 's' : ''}
                        </p>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${summary.upcomingLeave.status === 'Approved'
                        ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
                        : 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800'
                        }`}>
                        {summary.upcomingLeave.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Link to="/leaves" className="text-[#f04129] font-medium text-sm hover:underline flex items-center gap-1">
                      View details <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-text-secondary-light dark:text-text-secondary-dark text-sm">
                    No upcoming leave planned.
                  </p>
                  <Link
                    to="/leaves"
                    className="text-sm font-medium text-[#f04129] hover:underline flex items-center gap-1"
                  >
                    Apply for leave <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Account Status Card - Simplified */}
          {user && !isPlatformOwner && (
            <div className="flex flex-col rounded-xl bg-surface-light dark:bg-surface-dark p-6 border border-border-light dark:border-border-dark shadow-sm">
              <h2 className="text-xl font-bold mb-3 text-text-primary-light dark:text-text-primary-dark">Account Status</h2>
              <div className="flex items-center gap-2 text-green-600 dark:text-green-500 mb-2">
                <span className="material-symbols-outlined">verified</span>
                <p className="font-medium">Active & Verified</p>
              </div>

              {/* Alert/Banner - Show if mustResetPassword */}
              {user.mustResetPassword && (
                <div className="mt-2 flex items-start gap-3 rounded-lg bg-[#f04129]/10 p-4 border border-[#f04129]/20">
                  <span className="material-symbols-outlined text-[#f04129] mt-1 text-sm">warning</span>
                  <div className="flex flex-col">
                    <p className="font-semibold text-[#f04129] text-sm">Action Required</p>
                    <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">
                      Your password must be reset. <Link to="/force-reset-password" className="font-bold underlineDecoration text-[#f04129]">Reset now.</Link>
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


