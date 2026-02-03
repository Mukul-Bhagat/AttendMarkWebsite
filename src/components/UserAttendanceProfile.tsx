import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';

// ============================================
// TYPE DEFINITIONS  
// ============================================

interface UserAttendanceProfileResponse {
    user: {
        userId: string;
        name: string;
        email: string;
        role: string;
        accountCreatedDate: string;
        classesInvolved: number;
    };
    summary: {
        totalSessions: number;
        sessionsAttended: number;
        sessionsMissed: number;
        attendancePercentage: number;
        onTimeCount: number;
        lateCount: number;
    };
    classwiseBreakdown: Array<{
        classId: string;
        className: string;
        totalSessions: number;
        attended: number;
        attendancePercentage: number;
        lastAttendedDate: string | null;
    }>;
    sessionLogs: {
        page: number;
        limit: number;
        totalPages: number;
        totalSessions: number;
        sessions: Array<{
            sessionId: string;
            sessionName: string;
            date: string;
            status: 'PRESENT' | 'ABSENT' | 'LATE';
            checkInTime?: string;
            source?: 'QR_SCAN' | 'MANUAL';
            isLate: boolean;
            lateByMinutes?: number;
        }>;
    };
}

interface UserAttendanceProfileProps {
    userId?: string; // If not provided, uses userId from URL params
    isAdminView?: boolean; // Controls UI permissions (e.g., show edit button)
}

// ============================================
// SHARED USER ATTENDANCE PROFILE COMPONENT
// Used by: Admin view + User "My Attendance" view
// ============================================

const UserAttendanceProfile: React.FC<UserAttendanceProfileProps> = ({
    userId: propUserId,
    isAdminView = false
}) => {
    const { userId: paramUserId } = useParams<{ userId: string }>();
    const userId = propUserId || paramUserId;

    // State
    const [data, setData] = useState<UserAttendanceProfileResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string>('');

    // Date range (default: last 30 days)
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [startDate, setStartDate] = useState(() => {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        return date.toISOString().split('T')[0];
    });

    // Session logs pagination
    const [sessionLogsPage, setSessionLogsPage] = useState(1);

    // UI state
    const [expandedClassId, setExpandedClassId] = useState<string | null>(null);

    // Fetch data
    useEffect(() => {
        if (!userId) return;

        const fetchData = async () => {
            setIsLoading(true);
            setError('');

            try {
                const params = new URLSearchParams({
                    startDate,
                    endDate,
                    sessionLogsPage: sessionLogsPage.toString(),
                    sessionLogsLimit: '20'
                });

                const { data: response } = await api.get<UserAttendanceProfileResponse>(
                    `/api/reports/user/${userId}/attendance?${params.toString()}`
                );

                setData(response);
            } catch (err: any) {
                console.error('Error fetching user attendance profile:', err);
                setError(err.response?.data?.msg || 'Failed to load attendance profile');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [userId, startDate, endDate, sessionLogsPage]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PRESENT':
                return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800';
            case 'LATE':
                return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800';
            case 'ABSENT':
                return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800';
            default:
                return 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400 border-slate-200 dark:border-slate-800';
        }
    };

    // Loading skeleton
    if (isLoading) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark p-4 sm:p-6 lg:p-8">
                <div className="max-w-6xl mx-auto">
                    <div className="h-10 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-8"></div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"></div>
                        ))}
                    </div>
                    <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"></div>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark p-4 sm:p-6 lg:p-8">
                <div className="max-w-6xl mx-auto">
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-red-600 dark:text-red-400">error</span>
                            <div>
                                <h3 className="text-red-900 dark:text-red-200 font-semibold">Error Loading Profile</h3>
                                <p className="text-red-700 dark:text-red-300 text-sm mt-1">{error}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark p-4 sm:p-6 lg:p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <header className="mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-1">
                                {data.user.name}
                            </h1>
                            <p className="text-slate-600 dark:text-slate-400">
                                {data.user.email} • {data.user.role}
                            </p>
                        </div>
                        {isAdminView && (
                            <span className="px-3 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full">
                                Admin View
                            </span>
                        )}
                    </div>
                </header>

                {/* Date Range Filter */}
                <div className="bg-white dark:bg-slate-800 rounded-xl p-6 mb-6 shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Start Date
                            </label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                End Date
                            </label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary"
                            />
                        </div>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* Attendance Percentage */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">Attendance Rate</h3>
                            <span className="material-symbols-outlined text-primary">trending_up</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className={`text-4xl font-black ${data.summary.attendancePercentage >= 90 ? 'text-green-600 dark:text-green-400' :
                                    data.summary.attendancePercentage >= 75 ? 'text-yellow-600 dark:text-yellow-400' :
                                        'text-red-600 dark:text-red-400'
                                }`}>
                                {data.summary.attendancePercentage.toFixed(1)}%
                            </span>
                        </div>
                        <div className="mt-4 flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                            <div
                                className={`h-full rounded-full ${data.summary.attendancePercentage >= 90 ? 'bg-green-500' :
                                        data.summary.attendancePercentage >= 75 ? 'bg-yellow-500' :
                                            'bg-red-500'
                                    }`}
                                style={{ width: `${data.summary.attendancePercentage}%` }}
                            ></div>
                        </div>
                    </div>

                    {/* Sessions Attended */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">Sessions Attended</h3>
                            <span className="material-symbols-outlined text-green-600 dark:text-green-400">check_circle</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black text-slate-900 dark:text-white">
                                {data.summary.sessionsAttended}
                            </span>
                            <span className="text-lg text-slate-500 dark:text-slate-400">
                                / {data.summary.totalSessions}
                            </span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                            On-time: {data.summary.onTimeCount} • Late: {data.summary.lateCount}
                        </p>
                    </div>

                    {/* Sessions Missed */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">Sessions Missed</h3>
                            <span className="material-symbols-outlined text-red-600 dark:text-red-400">cancel</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black text-slate-900 dark:text-white">
                                {data.summary.sessionsMissed}
                            </span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                            Classes involved: {data.user.classesInvolved}
                        </p>
                    </div>
                </div>

                {/* Class-wise Breakdown */}
                {data.classwiseBreakdown.length > 0 && (
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 mb-8 shadow-sm border border-slate-200 dark:border-slate-700">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Class-wise Breakdown</h2>
                        <div className="space-y-2">
                            {data.classwiseBreakdown.map((classData) => (
                                <div key={classData.classId} className="border border-slate-200 dark:border-slate-700 rounded-lg">
                                    <button
                                        onClick={() => setExpandedClassId(expandedClassId === classData.classId ? null : classData.classId)}
                                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors rounded-lg"
                                    >
                                        <div className="flex items-center gap-4 flex-1">
                                            <div className="text-left">
                                                <h3 className="font-semibold text-slate-900 dark:text-white">{classData.className}</h3>
                                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                                    {classData.attended}/{classData.totalSessions} sessions
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className={`font-semibold ${classData.attendancePercentage >= 90 ? 'text-green-600 dark:text-green-400' :
                                                    classData.attendancePercentage >= 75 ? 'text-yellow-600 dark:text-yellow-400' :
                                                        'text-red-600 dark:text-red-400'
                                                }`}>
                                                {classData.attendancePercentage.toFixed(1)}%
                                            </span>
                                            <span className="material-symbols-outlined text-slate-400">
                                                {expandedClassId === classData.classId ? 'expand_less' : 'expand_more'}
                                            </span>
                                        </div>
                                    </button>
                                    {expandedClassId === classData.classId && (
                                        <div className="px-4 pb-3 border-t border-slate-200 dark:border-slate-700 pt-3">
                                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                                Last attended: {classData.lastAttendedDate
                                                    ? new Date(classData.lastAttendedDate).toLocaleDateString()
                                                    : 'Never'}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Session Logs */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Session Logs</h2>
                    </div>

                    {data.sessionLogs.sessions.length === 0 ? (
                        <div className="p-12 text-center">
                            <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-600 mb-4 block">
                                event_busy
                            </span>
                            <p className="text-slate-500 dark:text-slate-400">No sessions in selected date range</p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">Date</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">Session</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">Status</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">Check-in</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                        {data.sessionLogs.sessions.map((session) => (
                                            <tr key={session.sessionId} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                                <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">
                                                    {new Date(session.date).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-slate-900 dark:text-white">{session.sessionName}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(session.status)}`}>
                                                        {session.status}
                                                        {session.isLate && session.lateByMinutes && (
                                                            <span className="text-xs">({session.lateByMinutes}m)</span>
                                                        )}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                                                    {session.checkInTime
                                                        ? new Date(session.checkInTime).toLocaleTimeString()
                                                        : '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {data.sessionLogs.totalPages > 1 && (
                                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                    <div className="text-sm text-slate-600 dark:text-slate-400">
                                        Page {data.sessionLogs.page} of {data.sessionLogs.totalPages}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setSessionLogsPage(p => Math.max(1, p - 1))}
                                            disabled={sessionLogsPage === 1}
                                            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Previous
                                        </button>
                                        <button
                                            onClick={() => setSessionLogsPage(p => Math.min(data.sessionLogs.totalPages, p + 1))}
                                            disabled={sessionLogsPage === data.sessionLogs.totalPages}
                                            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserAttendanceProfile;
